import type { CoinRecord } from './types.js';

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function mapCoin(c: any, vsCurrency: string): CoinRecord {
    return {
        id: c.id,
        symbol: typeof c.symbol === 'string' ? c.symbol.toUpperCase() : null,
        name: c.name ?? null,
        vsCurrency,
        currentPrice: n(c.current_price),
        marketCap: n(c.market_cap),
        marketCapRank: n(c.market_cap_rank),
        fullyDilutedValuation: n(c.fully_diluted_valuation),
        totalVolume: n(c.total_volume),
        high24h: n(c.high_24h),
        low24h: n(c.low_24h),
        priceChange24h: n(c.price_change_24h),
        priceChangePercentage24h: n(c.price_change_percentage_24h),
        marketCapChange24h: n(c.market_cap_change_24h),
        marketCapChangePercentage24h: n(c.market_cap_change_percentage_24h),
        circulatingSupply: n(c.circulating_supply),
        totalSupply: n(c.total_supply),
        maxSupply: n(c.max_supply),
        ath: n(c.ath),
        athChangePercentage: n(c.ath_change_percentage),
        athDate: c.ath_date ?? null,
        atl: n(c.atl),
        atlChangePercentage: n(c.atl_change_percentage),
        atlDate: c.atl_date ?? null,
        imageUrl: c.image ?? null,
        lastUpdated: c.last_updated ?? null,
        scrapedAt: new Date().toISOString(),
    };
}
