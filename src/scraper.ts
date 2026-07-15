import { CoinGeckoApiError, type CoinGeckoClient } from './coingecko.js';
import { mapCoin } from './routes.js';
import type { CoinRecord, NormalizedInput, RunDiagnostic, RunStatus } from './types.js';

const MAX_DIAGNOSTICS = 20;
const MARKET_BATCH_SIZE = 250;

export interface PushResult {
    saved: boolean;
    limitReached: boolean;
}

export interface ScrapeDependencies {
    client: CoinGeckoClient;
    pushRecord: (record: CoinRecord) => Promise<PushResult>;
    now?: () => Date;
    log?: {
        info: (message: string) => void;
        warning: (message: string) => void;
    };
}

function diagnostic(error: unknown, scope: string): RunDiagnostic {
    if (error instanceof CoinGeckoApiError) {
        return {
            code: error.code,
            message: error.message,
            scope,
            ...(error.statusCode ? { statusCode: error.statusCode } : {}),
        };
    }
    return {
        code: 'unexpected_error',
        message: error instanceof Error ? error.message.slice(0, 300) : 'Unexpected error.',
        scope,
    };
}

function initialStatus(input: NormalizedInput, startedAt: string): RunStatus {
    return {
        outcome: 'failed',
        summary: 'Run did not complete.',
        source: 'CoinGecko API',
        apiAccess: input.apiAccess,
        attribution: 'Data provided by CoinGecko',
        input: {
            explicitCoinIds: input.coinIds.length,
            searchQueries: input.searchQueries.length,
            topCoins: input.topCoins,
            maxSearchResults: input.maxSearchResults,
            vsCurrency: input.vsCurrency,
            potentialResults: input.potentialResults,
        },
        requests: {
            attempted: 0,
            succeeded: 0,
            failed: 0,
            retries: 0,
            rateLimited: 0,
            timedOut: 0,
        },
        search: {
            attempted: 0,
            succeeded: 0,
            failed: 0,
            matchesSelected: 0,
            noMatches: 0,
            invalidMatches: 0,
        },
        records: {
            received: 0,
            saved: 0,
            invalid: 0,
            duplicate: 0,
            noMatchRequestedIds: 0,
        },
        spendingLimitReached: false,
        diagnostics: [],
        startedAt,
        finishedAt: startedAt,
        durationMs: 0,
    };
}

function finishStatus(status: RunStatus, client: CoinGeckoClient, finishedAt: Date): RunStatus {
    status.requests = client.metrics;
    status.finishedAt = finishedAt.toISOString();
    status.durationMs = Math.max(0, finishedAt.getTime() - Date.parse(status.startedAt));

    if (status.spendingLimitReached) {
        status.outcome = 'stopped_spending_limit';
        status.summary = `Stopped at the user's spending limit after ${status.records.saved} coin(s).`;
    } else if (status.diagnostics.some((item) => item.code === 'unsupported_currency')) {
        status.outcome = 'failed';
        status.summary = `CoinGecko does not support quote currency ${status.input.vsCurrency}.`;
    } else if (status.diagnostics.some((item) => item.code === 'output_write_failed')) {
        status.outcome = 'failed';
        status.summary = 'The dataset write failed.';
    } else if (status.requests.failed > 0 || status.search.failed > 0 || status.diagnostics.length > 0) {
        status.outcome = status.records.saved > 0 ? 'partial' : 'failed';
        status.summary = status.records.saved > 0
            ? `Saved ${status.records.saved} coin(s), but one or more CoinGecko requests failed.`
            : 'CoinGecko requests failed before any valid coins could be saved.';
    } else if (status.records.invalid > 0) {
        status.outcome = status.records.saved > 0 ? 'partial' : 'failed';
        status.summary = status.records.saved > 0
            ? `Saved ${status.records.saved} coin(s); invalid upstream rows were skipped.`
            : 'CoinGecko returned no valid market rows.';
    } else if (status.records.saved === 0) {
        status.outcome = 'empty';
        status.summary = 'CoinGecko returned no matching coins for this input.';
    } else {
        status.outcome = 'succeeded';
        status.summary = `Saved ${status.records.saved} unique coin(s).`;
    }
    return status;
}

export async function runScrape(input: NormalizedInput, dependencies: ScrapeDependencies): Promise<RunStatus> {
    const now = dependencies.now ?? (() => new Date());
    const startedAt = now();
    const status = initialStatus(input, startedAt.toISOString());
    const seen = new Set<string>();
    let stop = false;

    const addDiagnostic = (entry: RunDiagnostic): void => {
        if (status.diagnostics.length < MAX_DIAGNOSTICS) status.diagnostics.push(entry);
        dependencies.log?.warning(`${entry.scope}: ${entry.message}`);
    };

    const pushRows = async (rows: unknown[]): Promise<Set<string>> => {
        const validIds = new Set<string>();
        status.records.received += rows.length;
        for (const row of rows) {
            if (stop) break;
            const record = mapCoin(row, input.vsCurrency, now().toISOString());
            if (!record) {
                status.records.invalid += 1;
                continue;
            }
            validIds.add(record.id);
            if (seen.has(record.id)) {
                status.records.duplicate += 1;
                continue;
            }

            try {
                const result = await dependencies.pushRecord(record);
                if (result.saved) {
                    seen.add(record.id);
                    status.records.saved += 1;
                }
                if (result.limitReached) {
                    status.spendingLimitReached = true;
                    stop = true;
                }
            } catch (error) {
                addDiagnostic({
                    code: 'output_write_failed',
                    message: error instanceof Error ? error.message.slice(0, 300) : 'Dataset write failed.',
                    scope: 'dataset',
                });
                stop = true;
            }
        }
        return validIds;
    };

    try {
        const currencies = await dependencies.client.getSupportedCurrencies();
        if (!currencies.includes(input.vsCurrency)) {
            addDiagnostic({
                code: 'unsupported_currency',
                message: `${input.vsCurrency} is not in CoinGecko's supported quote-currency list.`,
                scope: 'currency_validation',
            });
            return finishStatus(status, dependencies.client, now());
        }
    } catch (error) {
        addDiagnostic(diagnostic(error, 'currency_validation'));
        return finishStatus(status, dependencies.client, now());
    }

    const requestedIds = new Set(input.coinIds);
    for (let index = 0; index < input.searchQueries.length && !stop; index++) {
        status.search.attempted += 1;
        try {
            const result = await dependencies.client.search(input.searchQueries[index]);
            status.search.succeeded += 1;
            status.search.invalidMatches += result.invalidMatches;
            const selected = result.ids.slice(0, input.maxSearchResults);
            if (selected.length === 0) status.search.noMatches += 1;
            status.search.matchesSelected += selected.length;
            for (const id of selected) requestedIds.add(id);
            dependencies.log?.info(`Search ${index + 1}: selected ${selected.length} coin ID(s).`);
        } catch (error) {
            status.search.failed += 1;
            addDiagnostic(diagnostic(error, `search_${index + 1}`));
        }
    }

    const idArray = [...requestedIds];
    for (let index = 0; index < idArray.length && !stop; index += MARKET_BATCH_SIZE) {
        const batch = idArray.slice(index, index + MARKET_BATCH_SIZE);
        try {
            const rows = await dependencies.client.getMarketsByIds(batch, input.vsCurrency);
            const returnedIds = await pushRows(rows);
            if (!stop) status.records.noMatchRequestedIds += batch.filter((id) => !returnedIds.has(id)).length;
            dependencies.log?.info(`Requested-ID batch ${Math.floor(index / MARKET_BATCH_SIZE) + 1}: received ${rows.length} row(s).`);
        } catch (error) {
            addDiagnostic(diagnostic(error, `requested_ids_batch_${Math.floor(index / MARKET_BATCH_SIZE) + 1}`));
        }
    }

    if (input.topCoins > 0 && !stop) {
        const pages = Math.ceil(input.topCoins / MARKET_BATCH_SIZE);
        for (let page = 1; page <= pages && !stop; page++) {
            const remaining = input.topCoins - ((page - 1) * MARKET_BATCH_SIZE);
            const perPage = Math.min(MARKET_BATCH_SIZE, remaining);
            try {
                const rows = await dependencies.client.getTopMarkets(input.vsCurrency, page, perPage);
                if (rows.length === 0) break;
                await pushRows(rows.slice(0, perPage));
                dependencies.log?.info(`Top-market page ${page}: received ${rows.length} row(s).`);
                if (rows.length < perPage) break;
            } catch (error) {
                addDiagnostic(diagnostic(error, `top_market_page_${page}`));
                break;
            }
        }
    }

    return finishStatus(status, dependencies.client, now());
}
