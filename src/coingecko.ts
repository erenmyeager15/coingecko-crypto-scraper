import type { ApiAccess } from './types.js';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export interface ApiMetrics {
    attempted: number;
    succeeded: number;
    failed: number;
    retries: number;
    rateLimited: number;
    timedOut: number;
}

export interface SearchResult {
    ids: string[];
    invalidMatches: number;
    totalMatches: number;
}

export interface CoinGeckoClientOptions {
    apiAccess: ApiAccess;
    apiKey?: string;
    fetchFn?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    requestTimeoutMs?: number;
    maxAttempts?: number;
    maxResponseBytes?: number;
}

export class CoinGeckoApiError extends Error {
    public readonly code: string;
    public readonly statusCode?: number;
    public readonly retryable: boolean;

    constructor(code: string, message: string, statusCode?: number, retryable = false) {
        super(message);
        this.name = 'CoinGeckoApiError';
        this.code = code;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(header: string | null, attempt: number): number {
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 30_000);
        const date = Date.parse(header);
        if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), 30_000);
    }
    return Math.min(1_000 * (2 ** attempt), 8_000);
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new CoinGeckoApiError('response_too_large', `CoinGecko response exceeded ${maxBytes} bytes.`);
    }
    if (!response.body) return '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let text = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new CoinGeckoApiError('response_too_large', `CoinGecko response exceeded ${maxBytes} bytes.`);
        }
        text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
}

function apiMessage(text: string, fallback: string): string {
    if (!text) return fallback;
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const candidate = parsed.error ?? parsed.error_message ?? (parsed.status as Record<string, unknown> | undefined)?.error_message;
        if (typeof candidate === 'string') return candidate.slice(0, 300);
    } catch {
        // The HTTP status remains the authoritative diagnostic.
    }
    return fallback;
}

function object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

export class CoinGeckoClient {
    private readonly apiAccess: ApiAccess;
    private readonly apiKey: string;
    private readonly fetchFn: typeof fetch;
    private readonly sleepFn: (milliseconds: number) => Promise<void>;
    private readonly requestTimeoutMs: number;
    private readonly maxAttempts: number;
    private readonly maxResponseBytes: number;
    private readonly baseUrl: string;
    private readonly headers: Record<string, string>;
    private readonly apiMetrics: ApiMetrics = {
        attempted: 0,
        succeeded: 0,
        failed: 0,
        retries: 0,
        rateLimited: 0,
        timedOut: 0,
    };

    constructor(options: CoinGeckoClientOptions) {
        this.apiAccess = options.apiAccess;
        this.apiKey = options.apiKey?.trim() ?? '';
        if (this.apiAccess !== 'keyless' && !this.apiKey) {
            throw new CoinGeckoApiError('missing_api_key', `An API key is required for ${this.apiAccess} access.`);
        }
        this.fetchFn = options.fetchFn ?? fetch;
        this.sleepFn = options.sleep ?? sleep;
        this.requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
        this.maxAttempts = options.maxAttempts ?? 3;
        this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
        this.baseUrl = this.apiAccess === 'pro'
            ? 'https://pro-api.coingecko.com/api/v3'
            : 'https://api.coingecko.com/api/v3';
        this.headers = {
            Accept: 'application/json',
            'User-Agent': 'apify-coingecko-market-data/1.0',
        };
        if (this.apiAccess === 'demo') this.headers['x-cg-demo-api-key'] = this.apiKey;
        if (this.apiAccess === 'pro') this.headers['x-cg-pro-api-key'] = this.apiKey;
    }

    get metrics(): ApiMetrics {
        return { ...this.apiMetrics };
    }

    private async requestJson(path: string, scope: string): Promise<unknown> {
        let finalError: CoinGeckoApiError | undefined;
        for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
            this.apiMetrics.attempted += 1;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
            try {
                const response = await this.fetchFn(`${this.baseUrl}${path}`, {
                    method: 'GET',
                    headers: this.headers,
                    signal: controller.signal,
                });
                const responseText = await readLimitedText(response, this.maxResponseBytes);
                if (!response.ok) {
                    const retryable = RETRYABLE_STATUSES.has(response.status);
                    if (response.status === 429) this.apiMetrics.rateLimited += 1;
                    const error = new CoinGeckoApiError(
                        response.status === 429 ? 'rate_limited' : `http_${response.status}`,
                        apiMessage(responseText, `${scope} failed with HTTP ${response.status}.`),
                        response.status,
                        retryable,
                    );
                    if (retryable && attempt + 1 < this.maxAttempts) {
                        finalError = error;
                        this.apiMetrics.retries += 1;
                        await this.sleepFn(retryDelay(response.headers.get('retry-after'), attempt));
                        continue;
                    }
                    throw error;
                }

                let parsed: unknown;
                try {
                    parsed = JSON.parse(responseText);
                } catch {
                    throw new CoinGeckoApiError('invalid_json', `${scope} returned invalid JSON.`);
                }
                const parsedObject = object(parsed);
                if (parsedObject?.status && object(parsedObject.status)?.error_message) {
                    throw new CoinGeckoApiError('api_error', `${scope} returned an API error.`);
                }
                this.apiMetrics.succeeded += 1;
                return parsed;
            } catch (error) {
                const timedOut = controller.signal.aborted;
                const apiError = error instanceof CoinGeckoApiError
                    ? error
                    : new CoinGeckoApiError(
                        timedOut ? 'timeout' : 'network_error',
                        timedOut ? `${scope} timed out.` : `${scope} failed due to a network error.`,
                        undefined,
                        true,
                    );
                if (timedOut) this.apiMetrics.timedOut += 1;
                if (apiError.retryable && attempt + 1 < this.maxAttempts) {
                    finalError = apiError;
                    this.apiMetrics.retries += 1;
                    await this.sleepFn(retryDelay(null, attempt));
                    continue;
                }
                this.apiMetrics.failed += 1;
                throw apiError;
            } finally {
                clearTimeout(timeout);
            }
        }
        this.apiMetrics.failed += 1;
        throw finalError ?? new CoinGeckoApiError('request_failed', `${scope} failed.`);
    }

    async getSupportedCurrencies(): Promise<string[]> {
        const data = await this.requestJson('/simple/supported_vs_currencies', 'Supported-currency lookup');
        if (!Array.isArray(data)) throw new CoinGeckoApiError('invalid_response', 'Supported-currency lookup returned an invalid shape.');
        const currencies = [...new Set(data
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean))];
        if (currencies.length === 0) throw new CoinGeckoApiError('invalid_response', 'Supported-currency lookup returned no currencies.');
        return currencies;
    }

    async search(query: string): Promise<SearchResult> {
        const params = new URLSearchParams({ query });
        const data = await this.requestJson(`/search?${params.toString()}`, 'Coin search');
        const coins = object(data)?.coins;
        if (!Array.isArray(coins)) throw new CoinGeckoApiError('invalid_response', 'Coin search returned an invalid shape.');

        const ids: string[] = [];
        let invalidMatches = 0;
        for (const value of coins) {
            const id = object(value)?.id;
            if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(id.toLowerCase())) {
                invalidMatches += 1;
                continue;
            }
            ids.push(id.toLowerCase());
        }
        return { ids, invalidMatches, totalMatches: coins.length };
    }

    async getMarketsByIds(ids: string[], vsCurrency: string): Promise<unknown[]> {
        const params = new URLSearchParams({
            vs_currency: vsCurrency,
            ids: ids.join(','),
            order: 'market_cap_desc',
            per_page: '250',
            page: '1',
            price_change_percentage: '24h',
        });
        const data = await this.requestJson(`/coins/markets?${params.toString()}`, 'Coin market lookup');
        if (!Array.isArray(data)) throw new CoinGeckoApiError('invalid_response', 'Coin market lookup returned an invalid shape.');
        return data;
    }

    async getTopMarkets(vsCurrency: string, page: number, perPage: number): Promise<unknown[]> {
        const params = new URLSearchParams({
            vs_currency: vsCurrency,
            order: 'market_cap_desc',
            per_page: String(perPage),
            page: String(page),
            price_change_percentage: '24h',
        });
        const data = await this.requestJson(`/coins/markets?${params.toString()}`, 'Top-market lookup');
        if (!Array.isArray(data)) throw new CoinGeckoApiError('invalid_response', 'Top-market lookup returned an invalid shape.');
        return data;
    }
}
