import { Actor, log } from 'apify';
import { CoinGeckoClient } from './coingecko.js';
import { InputError, normalizeInput } from './input.js';
import { runScrape } from './scraper.js';
import type { NormalizedInput, RunStatus } from './types.js';

function failedStatus(input: NormalizedInput | undefined, error: unknown, startedAt: Date): RunStatus {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message.slice(0, 300) : 'Unexpected error.';
    return {
        outcome: 'failed',
        summary: message,
        source: 'CoinGecko API',
        apiAccess: input?.apiAccess ?? 'keyless',
        attribution: 'Data provided by CoinGecko',
        input: {
            explicitCoinIds: input?.coinIds.length ?? 0,
            searchQueries: input?.searchQueries.length ?? 0,
            topCoins: input?.topCoins ?? 0,
            maxSearchResults: input?.maxSearchResults ?? 0,
            vsCurrency: input?.vsCurrency ?? 'unknown',
            potentialResults: input?.potentialResults ?? 0,
        },
        requests: { attempted: 0, succeeded: 0, failed: 0, retries: 0, rateLimited: 0, timedOut: 0 },
        search: { attempted: 0, succeeded: 0, failed: 0, matchesSelected: 0, noMatches: 0, invalidMatches: 0 },
        records: { received: 0, saved: 0, invalid: 0, duplicate: 0, noMatchRequestedIds: 0 },
        spendingLimitReached: false,
        diagnostics: [{
            code: error instanceof InputError ? error.code : 'unexpected_error',
            message,
            scope: error instanceof InputError ? 'input' : 'runtime',
        }],
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    };
}

async function persistStatus(status: RunStatus): Promise<void> {
    await Actor.setValue('RUN_STATUS', status);
    await Actor.setStatusMessage(status.summary);
}

await Actor.main(async () => {
    const startedAt = new Date();
    let input: NormalizedInput | undefined;
    try {
        input = normalizeInput((await Actor.getInput<unknown>()) ?? {});
    } catch (error) {
        const status = failedStatus(undefined, error, startedAt);
        await persistStatus(status);
        throw error;
    }

    const client = new CoinGeckoClient({
        apiAccess: input.apiAccess,
        apiKey: input.apiKey,
    });

    let status: RunStatus;
    try {
        status = await runScrape(input, {
            client,
            log,
            pushRecord: async (record) => {
                const result = await Actor.pushData(record, 'coin-scraped');
                return {
                    saved: result.chargedCount > 0 || !result.eventChargeLimitReached,
                    limitReached: result.eventChargeLimitReached,
                };
            },
        });
    } catch (error) {
        status = failedStatus(input, error, startedAt);
    }

    await persistStatus(status);
    log.info(status.summary);
    if (status.outcome === 'failed') throw new Error(status.summary);
});
