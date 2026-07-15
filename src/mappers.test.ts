import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCoin } from './routes.js';

test('mapCoin normalizes identity and adds source attribution', () => {
    const record = mapCoin({ id: 'Bitcoin', symbol: 'btc', name: 'Bitcoin' }, 'usd', '2026-07-15T00:00:00.000Z');
    assert.ok(record);
    assert.equal(record.id, 'bitcoin');
    assert.equal(record.symbol, 'BTC');
    assert.equal(record.name, 'Bitcoin');
    assert.equal(record.vsCurrency, 'usd');
    assert.equal(record.coinGeckoUrl, 'https://www.coingecko.com/en/coins/bitcoin');
    assert.equal(record.attribution, 'Data provided by CoinGecko');
    assert.equal(record.scrapedAt, '2026-07-15T00:00:00.000Z');
});

test('mapCoin converts non-finite numbers to null', () => {
    const record = mapCoin({ id: 'x', current_price: 'nope', market_cap: Number.NaN, total_volume: Infinity }, 'usd');
    assert.ok(record);
    assert.equal(record.currentPrice, null);
    assert.equal(record.marketCap, null);
    assert.equal(record.totalVolume, null);
});

test('mapCoin keeps finite positive and negative values', () => {
    const record = mapCoin({ id: 'eth', current_price: 3500.5, market_cap_rank: 2, price_change_24h: -12.5 }, 'eur');
    assert.ok(record);
    assert.equal(record.currentPrice, 3500.5);
    assert.equal(record.marketCapRank, 2);
    assert.equal(record.priceChange24h, -12.5);
});

test('mapCoin sanitizes invalid dates and non-HTTPS image URLs', () => {
    const record = mapCoin({ id: 'z', image: 'http://example.com/z.png', ath_date: 'not-a-date', last_updated: '2026-07-15T01:02:03Z' }, 'usd');
    assert.ok(record);
    assert.equal(record.imageUrl, null);
    assert.equal(record.athDate, null);
    assert.equal(record.lastUpdated, '2026-07-15T01:02:03.000Z');
});

test('mapCoin rejects malformed rows and unsafe coin IDs', () => {
    assert.equal(mapCoin(null, 'usd'), null);
    assert.equal(mapCoin([], 'usd'), null);
    assert.equal(mapCoin({ id: '../secret' }, 'usd'), null);
    assert.equal(mapCoin({ name: 'Missing ID' }, 'usd'), null);
});
