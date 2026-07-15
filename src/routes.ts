import type { CoinRecord } from './types.js';

const COIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

const finiteNumber = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
);

const cleanString = (value: unknown, maxLength: number): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized && normalized.length <= maxLength ? normalized : null;
};

const isoDate = (value: unknown): string | null => {
    if (typeof value !== 'string' || value.length > 64) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const httpsUrl = (value: unknown): string | null => {
    if (typeof value !== 'string' || value.length > 2_048) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
};

export function mapCoin(value: unknown, vsCurrency: string, scrapedAt = new Date().toISOString()): CoinRecord | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const coin = value as Record<string, unknown>;
    const id = cleanString(coin.id, 128)?.toLowerCase() ?? null;
    if (!id || !COIN_ID_PATTERN.test(id)) return null;

    const symbol = cleanString(coin.symbol, 64);
    return {
        id,
        symbol: symbol?.toUpperCase() ?? null,
        name: cleanString(coin.name, 256),
        vsCurrency,
        currentPrice: finiteNumber(coin.current_price),
        marketCap: finiteNumber(coin.market_cap),
        marketCapRank: finiteNumber(coin.market_cap_rank),
        fullyDilutedValuation: finiteNumber(coin.fully_diluted_valuation),
        totalVolume: finiteNumber(coin.total_volume),
        high24h: finiteNumber(coin.high_24h),
        low24h: finiteNumber(coin.low_24h),
        priceChange24h: finiteNumber(coin.price_change_24h),
        priceChangePercentage24h: finiteNumber(coin.price_change_percentage_24h),
        marketCapChange24h: finiteNumber(coin.market_cap_change_24h),
        marketCapChangePercentage24h: finiteNumber(coin.market_cap_change_percentage_24h),
        circulatingSupply: finiteNumber(coin.circulating_supply),
        totalSupply: finiteNumber(coin.total_supply),
        maxSupply: finiteNumber(coin.max_supply),
        ath: finiteNumber(coin.ath),
        athChangePercentage: finiteNumber(coin.ath_change_percentage),
        athDate: isoDate(coin.ath_date),
        atl: finiteNumber(coin.atl),
        atlChangePercentage: finiteNumber(coin.atl_change_percentage),
        atlDate: isoDate(coin.atl_date),
        imageUrl: httpsUrl(coin.image),
        lastUpdated: isoDate(coin.last_updated),
        coinGeckoUrl: `https://www.coingecko.com/en/coins/${encodeURIComponent(id)}`,
        attribution: 'Data provided by CoinGecko',
        scrapedAt,
    };
}
