import { Actor, log } from 'apify';
import { ProxyAgent } from 'undici';
import type { ActorInput } from './types.js';
import { mapCoin } from './routes.js';

await Actor.init();

const input = ((await Actor.getInput<ActorInput>()) ?? {}) as ActorInput;
const {
    coinIds = [],
    searchQueries = [],
    maxSearchResults = 5,
    topCoins = 10,
    vsCurrency = 'usd',
    apiKey = '',
    proxyConfiguration: proxyInput,
} = input;

const vs = (vsCurrency || 'usd').toLowerCase();
const ids = [...new Set(coinIds.map((c) => c.trim().toLowerCase()).filter(Boolean))];
const queries = searchQueries.map((q) => q.trim()).filter(Boolean);

if (ids.length === 0 && queries.length === 0 && (!topCoins || topCoins <= 0)) {
    log.error('No input. Provide coinIds, searchQueries, or a topCoins count.');
    await Actor.exit();
}

const proxyConfiguration = (proxyInput?.useApifyProxy || proxyInput?.proxyUrls?.length)
    ? await Actor.createProxyConfiguration(proxyInput)
    : undefined;

// CoinGecko Demo API keys use the api.coingecko.com host with a header.
const baseHost = 'https://api.coingecko.com/api/v3';
const headers: Record<string, string> = { 'User-Agent': 'apify-coingecko-scraper', Accept: 'application/json' };
if (apiKey) headers['x-cg-demo-api-key'] = apiKey.trim();

async function cgFetch(path: string): Promise<any> {
    const url = `${baseHost}${path}`;
    for (let attempt = 0; attempt < 5; attempt++) {
        let dispatcher: ProxyAgent | undefined;
        if (proxyConfiguration) {
            const purl = await proxyConfiguration.newUrl();
            if (purl) dispatcher = new ProxyAgent(purl);
        }
        try {
            const res = await fetch(url, { headers, ...(dispatcher ? { dispatcher } : {}) } as any);
            if (res.status === 429) {
                log.warning(`Rate limited (429) - attempt ${attempt + 1}`);
                if (!proxyConfiguration) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
                continue;
            }
            if (!res.ok) {
                log.warning(`HTTP ${res.status} on ${path}`);
                return null;
            }
            return await res.json();
        } catch (e) {
            log.warning(`Request error on ${path}: ${(e as Error).message}`);
        }
    }
    return null;
}

// Resolve search queries -> coin ids.
const allIds = new Set<string>(ids);
for (const q of queries) {
    const data = await cgFetch(`/search?query=${encodeURIComponent(q)}`);
    const coins: any[] = data?.coins ?? [];
    const matches = coins.slice(0, Math.max(1, Math.min(maxSearchResults, 50)));
    for (const c of matches) if (c.id) allIds.add(c.id);
    log.info(`Search "${q}" -> ${matches.length} selected coin(s) from ${coins.length} match(es)`);
}

let scraped = 0;
const seen = new Set<string>();

async function pushCoins(list: any[]): Promise<void> {
    for (const c of list) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        await Actor.pushData(mapCoin(c, vs));
        await Actor.charge({ eventName: 'coin-scraped' }).catch(() => null);
        scraped++;
    }
}

// Specific coin ids (batched, up to 250 per request).
const idArray = [...allIds];
for (let i = 0; i < idArray.length; i += 250) {
    const batch = idArray.slice(i, i + 250);
    const data = await cgFetch(`/coins/markets?vs_currency=${vs}&ids=${batch.join(',')}&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h`);
    if (Array.isArray(data)) await pushCoins(data);
    log.info(`Fetched ${batch.length} requested coin(s)`);
}

// Top coins by market cap.
if (topCoins && topCoins > 0) {
    const perPage = 250;
    const pages = Math.ceil(Math.min(topCoins, 10000) / perPage);
    for (let page = 1; page <= pages; page++) {
        const data = await cgFetch(`/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=${perPage}&page=${page}&price_change_percentage=24h`);
        if (!Array.isArray(data) || data.length === 0) break;
        const slice = data.slice(0, Math.max(0, topCoins - (page - 1) * perPage));
        await pushCoins(slice);
        log.info(`Top coins page ${page}: ${slice.length} coins (total ${scraped})`);
        if (data.length < perPage) break;
    }
}

log.info(`CoinGecko scrape finished. ${scraped} coins scraped.`);
await Actor.exit();
