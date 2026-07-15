import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CoinGeckoClient } from './coingecko.js';
import { normalizeInput } from './input.js';
import { runScrape } from './scraper.js';
import type { CoinRecord } from './types.js';

function response(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function client(handler: (url: URL) => Response): CoinGeckoClient {
    return new CoinGeckoClient({
        apiAccess: 'keyless',
        maxAttempts: 1,
        fetchFn: (async (input) => handler(new URL(String(input)))) as typeof fetch,
    });
}

const fixedNow = () => new Date('2026-07-15T00:00:00.000Z');

test('runScrape saves a valid requested coin with attribution', async () => {
    const saved: CoinRecord[] = [];
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 123 }]));

    const status = await runScrape(normalizeInput({}), {
        client: api,
        now: fixedNow,
        pushRecord: async (record) => {
            saved.push(record);
            return { saved: true, limitReached: false };
        },
    });

    assert.equal(status.outcome, 'succeeded');
    assert.equal(status.records.saved, 1);
    assert.equal(saved[0].attribution, 'Data provided by CoinGecko');
    assert.equal(saved[0].currentPrice, 123);
});

test('runScrape reports a legitimate unknown coin as empty, not failed', async () => {
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies') ? response(['usd']) : response([]));
    const status = await runScrape(normalizeInput({ coinIds: ['not-a-real-coin'] }), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'empty');
    assert.equal(status.records.noMatchRequestedIds, 1);
    assert.equal(status.requests.failed, 0);
});

test('runScrape marks a saved run partial when a search request fails', async () => {
    const api = client((url) => {
        if (url.pathname.endsWith('supported_vs_currencies')) return response(['usd']);
        if (url.pathname.endsWith('/search')) return response({ error: 'temporary' }, 503);
        return response([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]);
    });
    const status = await runScrape(normalizeInput({ coinIds: ['bitcoin'], searchQueries: ['ether'] }), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'partial');
    assert.equal(status.search.failed, 1);
    assert.equal(status.records.saved, 1);
    assert.equal(status.diagnostics[0].statusCode, 503);
});

test('runScrape fails before market calls for an unsupported quote currency', async () => {
    let calls = 0;
    const api = client(() => {
        calls += 1;
        return response(['usd']);
    });
    const status = await runScrape(normalizeInput({ vsCurrency: 'zzz' }), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'failed');
    assert.equal(status.diagnostics[0].code, 'unsupported_currency');
    assert.equal(calls, 1);
});

test('runScrape deduplicates requested and top-market rows', async () => {
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]));
    const status = await runScrape(normalizeInput({ coinIds: ['bitcoin'], topCoins: 1 }), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'succeeded');
    assert.equal(status.records.saved, 1);
    assert.equal(status.records.duplicate, 1);
});

test('runScrape records spending-limit stops without charging past the stop', async () => {
    let pushes = 0;
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response([
            { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
            { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
        ]));
    const status = await runScrape(normalizeInput({ coinIds: ['bitcoin', 'ethereum'] }), {
        client: api,
        now: fixedNow,
        pushRecord: async () => {
            pushes += 1;
            return { saved: true, limitReached: true };
        },
    });
    assert.equal(status.outcome, 'stopped_spending_limit');
    assert.equal(status.records.saved, 1);
    assert.equal(pushes, 1);
});

test('runScrape fails honestly when dataset writes fail', async () => {
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]));
    const status = await runScrape(normalizeInput({}), {
        client: api,
        now: fixedNow,
        pushRecord: async () => { throw new Error('storage unavailable'); },
    });
    assert.equal(status.outcome, 'failed');
    assert.equal(status.diagnostics[0].code, 'output_write_failed');
    assert.equal(status.records.saved, 0);
});

test('runScrape fails closed when all upstream market rows are malformed', async () => {
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response([{ name: 'Missing ID' }]));
    const status = await runScrape(normalizeInput({}), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'failed');
    assert.equal(status.records.invalid, 1);
    assert.equal(status.records.saved, 0);
});

test('runScrape classifies a malformed HTTP-200 market shape as failed', async () => {
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response({ unexpected: true }));
    const status = await runScrape(normalizeInput({}), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'failed');
    assert.equal(status.diagnostics[0].code, 'invalid_response');
});

test('runScrape treats a valid no-match search as an empty result', async () => {
    const api = client((url) => url.pathname.endsWith('supported_vs_currencies')
        ? response(['usd'])
        : response({ coins: [] }));
    const status = await runScrape(normalizeInput({ coinIds: [], searchQueries: ['definitely-no-match'] }), {
        client: api,
        now: fixedNow,
        pushRecord: async () => ({ saved: true, limitReached: false }),
    });
    assert.equal(status.outcome, 'empty');
    assert.equal(status.search.noMatches, 1);
    assert.equal(status.search.failed, 0);
});
