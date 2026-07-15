import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoinGeckoApiError, CoinGeckoClient } from './coingecko.js';

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(value), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
}

test('keyless requests use the public host without an auth header', async () => {
    let seenUrl = '';
    let seenHeaders: Headers | undefined;
    const client = new CoinGeckoClient({
        apiAccess: 'keyless',
        fetchFn: (async (input, init) => {
            seenUrl = String(input);
            seenHeaders = new Headers(init?.headers);
            return jsonResponse(['usd', 'eur']);
        }) as typeof fetch,
    });
    assert.deepEqual(await client.getSupportedCurrencies(), ['usd', 'eur']);
    assert.equal(seenUrl, 'https://api.coingecko.com/api/v3/simple/supported_vs_currencies');
    assert.equal(seenHeaders?.has('x-cg-demo-api-key'), false);
    assert.equal(seenHeaders?.has('x-cg-pro-api-key'), false);
});

test('Demo and Pro access use their documented hosts and headers', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), headers: new Headers(init?.headers) });
        return jsonResponse(['usd']);
    }) as typeof fetch;

    await new CoinGeckoClient({ apiAccess: 'demo', apiKey: 'demo-key', fetchFn }).getSupportedCurrencies();
    await new CoinGeckoClient({ apiAccess: 'pro', apiKey: 'pro-key', fetchFn }).getSupportedCurrencies();

    assert.match(calls[0].url, /^https:\/\/api\.coingecko\.com/);
    assert.equal(calls[0].headers.get('x-cg-demo-api-key'), 'demo-key');
    assert.match(calls[1].url, /^https:\/\/pro-api\.coingecko\.com/);
    assert.equal(calls[1].headers.get('x-cg-pro-api-key'), 'pro-key');
});

test('429 responses honor Retry-After and retry without changing IP', async () => {
    let calls = 0;
    const delays: number[] = [];
    const client = new CoinGeckoClient({
        apiAccess: 'keyless',
        sleep: async (milliseconds) => { delays.push(milliseconds); },
        fetchFn: (async () => {
            calls += 1;
            return calls === 1
                ? jsonResponse({ error: 'rate limited' }, { status: 429, headers: { 'retry-after': '2' } })
                : jsonResponse(['usd']);
        }) as typeof fetch,
    });

    assert.deepEqual(await client.getSupportedCurrencies(), ['usd']);
    assert.deepEqual(delays, [2_000]);
    assert.equal(client.metrics.retries, 1);
    assert.equal(client.metrics.rateLimited, 1);
    assert.equal(client.metrics.failed, 0);
});

test('non-retryable 400 responses fail once with a classified error', async () => {
    let calls = 0;
    const client = new CoinGeckoClient({
        apiAccess: 'keyless',
        fetchFn: (async () => {
            calls += 1;
            return jsonResponse({ error: 'bad currency' }, { status: 400 });
        }) as typeof fetch,
    });

    await assert.rejects(() => client.getSupportedCurrencies(), (error: unknown) => {
        assert.ok(error instanceof CoinGeckoApiError);
        assert.equal(error.code, 'http_400');
        assert.equal(error.statusCode, 400);
        return true;
    });
    assert.equal(calls, 1);
    assert.equal(client.metrics.failed, 1);
});

test('hung requests are aborted and reported as timeouts', async () => {
    const client = new CoinGeckoClient({
        apiAccess: 'keyless',
        requestTimeoutMs: 5,
        maxAttempts: 1,
        fetchFn: ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })) as typeof fetch,
    });

    await assert.rejects(() => client.getSupportedCurrencies(), /timed out/);
    assert.equal(client.metrics.timedOut, 1);
    assert.equal(client.metrics.failed, 1);
});

test('oversized and malformed JSON responses fail closed', async () => {
    const oversized = new CoinGeckoClient({
        apiAccess: 'keyless',
        maxAttempts: 1,
        maxResponseBytes: 10,
        fetchFn: (async () => new Response('01234567890')) as typeof fetch,
    });
    await assert.rejects(() => oversized.getSupportedCurrencies(), /exceeded 10 bytes/);

    const malformed = new CoinGeckoClient({
        apiAccess: 'keyless',
        maxAttempts: 1,
        fetchFn: (async () => new Response('{broken')) as typeof fetch,
    });
    await assert.rejects(() => malformed.getSupportedCurrencies(), /invalid JSON/);
});

test('search rejects malformed response shapes and counts unsafe matches', async () => {
    const malformed = new CoinGeckoClient({
        apiAccess: 'keyless',
        fetchFn: (async () => jsonResponse({ wrong: [] })) as typeof fetch,
    });
    await assert.rejects(() => malformed.search('btc'), /invalid shape/);

    const valid = new CoinGeckoClient({
        apiAccess: 'keyless',
        fetchFn: (async () => jsonResponse({ coins: [{ id: 'bitcoin' }, { id: '../unsafe' }, {}] })) as typeof fetch,
    });
    assert.deepEqual(await valid.search('btc'), { ids: ['bitcoin'], invalidMatches: 2, totalMatches: 3 });
});

test('market requests encode IDs and quote currency with URLSearchParams', async () => {
    let seenUrl = '';
    const client = new CoinGeckoClient({
        apiAccess: 'keyless',
        fetchFn: (async (input) => {
            seenUrl = String(input);
            return jsonResponse([]);
        }) as typeof fetch,
    });
    await client.getMarketsByIds(['bitcoin', 'usd-coin'], 'usd');
    const url = new URL(seenUrl);
    assert.equal(url.searchParams.get('ids'), 'bitcoin,usd-coin');
    assert.equal(url.searchParams.get('vs_currency'), 'usd');
    assert.equal(url.searchParams.get('per_page'), '250');
});
