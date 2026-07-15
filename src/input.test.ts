import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputError, normalizeInput } from './input.js';

test('normalizeInput supplies the bounded one-Bitcoin keyless default', () => {
    const input = normalizeInput({});
    assert.deepEqual(input.coinIds, ['bitcoin']);
    assert.equal(input.apiAccess, 'keyless');
    assert.equal(input.potentialResults, 1);
});

test('normalizeInput infers demo access for legacy inputs containing an API key', () => {
    const input = normalizeInput({ apiKey: ' demo-secret ' });
    assert.equal(input.apiAccess, 'demo');
    assert.equal(input.apiKey, 'demo-secret');
});

test('normalizeInput requires a key for demo and pro access', () => {
    assert.throws(() => normalizeInput({ apiAccess: 'demo' }), InputError);
    assert.throws(() => normalizeInput({ apiAccess: 'pro' }), InputError);
});

test('normalizeInput rejects unknown fields and enabled proxy rotation', () => {
    assert.throws(() => normalizeInput({ surprise: true }), /Unknown input field/);
    assert.throws(() => normalizeInput({ proxyConfiguration: { useApifyProxy: true } }), /Proxy rotation is disabled/);
    assert.throws(() => normalizeInput({ proxyConfiguration: { proxyUrls: ['http:\/\/proxy.test'] } }), /Proxy rotation is disabled/);
});

test('normalizeInput accepts the legacy disabled proxy object', () => {
    const input = normalizeInput({ proxyConfiguration: { useApifyProxy: false } });
    assert.equal(input.coinIds[0], 'bitcoin');
});

test('normalizeInput requires at least one target when defaults are explicitly cleared', () => {
    assert.throws(() => normalizeInput({ coinIds: [], searchQueries: [], topCoins: 0 }), /Provide at least one/);
});

test('normalizeInput deduplicates IDs and searches case-insensitively', () => {
    const input = normalizeInput({ coinIds: [' Bitcoin ', 'bitcoin'], searchQueries: ['DOGE', 'doge', ' DOGE '] });
    assert.deepEqual(input.coinIds, ['bitcoin']);
    assert.deepEqual(input.searchQueries, ['DOGE']);
});

test('normalizeInput enforces access-specific workload limits', () => {
    assert.throws(() => normalizeInput({ topCoins: 26 }), /keyless access allows at most 25/);
    assert.throws(() => normalizeInput({ apiAccess: 'demo', apiKey: 'x', topCoins: 251 }), /demo access allows at most 250/);
    const pro = normalizeInput({ apiAccess: 'pro', apiKey: 'x', topCoins: 999, coinIds: ['bitcoin'] });
    assert.equal(pro.potentialResults, 1_000);
});

test('normalizeInput rejects unsafe coin IDs and unsupported API modes', () => {
    assert.throws(() => normalizeInput({ coinIds: ['../secret'] }), /Invalid CoinGecko coin ID/);
    assert.throws(() => normalizeInput({ apiAccess: 'enterprise' }), /apiAccess must be/);
});
