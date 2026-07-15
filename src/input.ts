import type { ActorInput, ApiAccess, NormalizedInput } from './types.js';

const TOP_LEVEL_KEYS = new Set([
    'coinIds',
    'searchQueries',
    'maxSearchResults',
    'topCoins',
    'vsCurrency',
    'apiAccess',
    'apiKey',
    'proxyConfiguration',
]);
const COIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const CURRENCY_PATTERN = /^[a-z0-9-]{2,16}$/;
const MAX_SEARCH_QUERIES = 10;
const MAX_SEARCH_RESULTS = 20;
const MAX_PRO_RESULTS = 1_000;
const MAX_DEMO_RESULTS = 250;
const MAX_KEYLESS_RESULTS = 25;

export class InputError extends Error {
    public readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'InputError';
        this.code = code;
    }
}

function asObject(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new InputError('invalid_input', 'Input must be a JSON object.');
    }
    return value as Record<string, unknown>;
}

function normalizeStringArray(
    value: unknown,
    field: string,
    maxItems: number,
    maxLength: number,
    transform: (value: string) => string,
): string[] {
    if (!Array.isArray(value)) throw new InputError('invalid_input', `${field} must be an array of strings.`);
    if (value.length > maxItems) throw new InputError('input_too_large', `${field} accepts at most ${maxItems} items.`);

    const output: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (typeof item !== 'string') throw new InputError('invalid_input', `${field} must contain only strings.`);
        const normalized = transform(item.trim());
        if (!normalized) continue;
        if (normalized.length > maxLength) {
            throw new InputError('invalid_input', `${field} values must be at most ${maxLength} characters.`);
        }
        const dedupeKey = normalized.toLowerCase();
        if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            output.push(normalized);
        }
    }
    return output;
}

function integer(value: unknown, field: string, defaultValue: number, min: number, max: number): number {
    const candidate = value === undefined ? defaultValue : value;
    if (!Number.isInteger(candidate) || (candidate as number) < min || (candidate as number) > max) {
        throw new InputError('invalid_input', `${field} must be an integer from ${min} to ${max}.`);
    }
    return candidate as number;
}

function validateProxyConfiguration(value: unknown): void {
    if (value === undefined) return;
    const proxy = asObject(value);
    const enabled = proxy.useApifyProxy === true;
    const proxyUrls = Array.isArray(proxy.proxyUrls) ? proxy.proxyUrls.filter(Boolean) : [];
    const groups = Array.isArray(proxy.apifyProxyGroups) ? proxy.apifyProxyGroups.filter(Boolean) : [];
    if (enabled || proxyUrls.length > 0 || groups.length > 0) {
        throw new InputError(
            'proxy_not_supported',
            'Proxy rotation is disabled for this Actor. It must not be used to bypass CoinGecko rate limits.',
        );
    }
}

function resolveApiAccess(rawAccess: unknown, apiKey: string): ApiAccess {
    if (rawAccess === undefined) return apiKey ? 'demo' : 'keyless';
    if (rawAccess !== 'keyless' && rawAccess !== 'demo' && rawAccess !== 'pro') {
        throw new InputError('invalid_input', 'apiAccess must be keyless, demo, or pro.');
    }
    if (rawAccess === 'keyless' && apiKey) {
        throw new InputError('invalid_input', 'Remove apiKey when apiAccess is keyless, or select demo/pro.');
    }
    if (rawAccess !== 'keyless' && !apiKey) {
        throw new InputError('missing_api_key', `apiKey is required when apiAccess is ${rawAccess}.`);
    }
    return rawAccess;
}

export function normalizeInput(raw: unknown): NormalizedInput {
    const input = asObject(raw ?? {});
    const unknownKeys = Object.keys(input).filter((key) => !TOP_LEVEL_KEYS.has(key));
    if (unknownKeys.length > 0) {
        throw new InputError('unknown_input_field', `Unknown input field(s): ${unknownKeys.join(', ')}.`);
    }

    const coinIds = normalizeStringArray(input.coinIds ?? ['bitcoin'], 'coinIds', MAX_PRO_RESULTS, 128, (value) => value.toLowerCase());
    for (const coinId of coinIds) {
        if (!COIN_ID_PATTERN.test(coinId)) {
            throw new InputError('invalid_coin_id', `Invalid CoinGecko coin ID: ${coinId}.`);
        }
    }
    const searchQueries = normalizeStringArray(
        input.searchQueries ?? [],
        'searchQueries',
        MAX_SEARCH_QUERIES,
        100,
        (value) => value,
    );
    const maxSearchResults = integer(input.maxSearchResults, 'maxSearchResults', 2, 1, MAX_SEARCH_RESULTS);
    const topCoins = integer(input.topCoins, 'topCoins', 0, 0, MAX_PRO_RESULTS);

    const vsCurrencyRaw = input.vsCurrency === undefined ? 'usd' : input.vsCurrency;
    if (typeof vsCurrencyRaw !== 'string') throw new InputError('invalid_input', 'vsCurrency must be a string.');
    const vsCurrency = vsCurrencyRaw.trim().toLowerCase();
    if (!CURRENCY_PATTERN.test(vsCurrency)) {
        throw new InputError('invalid_currency', 'vsCurrency must be a valid CoinGecko quote-currency code.');
    }

    const apiKeyRaw = input.apiKey ?? '';
    if (typeof apiKeyRaw !== 'string') throw new InputError('invalid_input', 'apiKey must be a string.');
    const apiKey = apiKeyRaw.trim();
    if (apiKey.length > 512) throw new InputError('invalid_input', 'apiKey must be at most 512 characters.');
    const apiAccess = resolveApiAccess(input.apiAccess, apiKey);

    validateProxyConfiguration(input.proxyConfiguration);

    if (coinIds.length === 0 && searchQueries.length === 0 && topCoins === 0) {
        throw new InputError('no_targets', 'Provide at least one coinId, search query, or topCoins count.');
    }

    const potentialResults = coinIds.length + (searchQueries.length * maxSearchResults) + topCoins;
    const planLimit = apiAccess === 'keyless'
        ? MAX_KEYLESS_RESULTS
        : apiAccess === 'demo'
            ? MAX_DEMO_RESULTS
            : MAX_PRO_RESULTS;
    if (potentialResults > planLimit) {
        throw new InputError(
            'input_too_large',
            `${apiAccess} access allows at most ${planLimit} potential results per run; this input requests up to ${potentialResults}.`,
        );
    }

    return {
        coinIds,
        searchQueries,
        maxSearchResults,
        topCoins,
        vsCurrency,
        apiAccess,
        apiKey,
        potentialResults,
    };
}
