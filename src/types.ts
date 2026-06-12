export interface ActorInput {
    coinIds?: string[];
    searchQueries?: string[];
    maxSearchResults?: number;
    topCoins?: number;
    vsCurrency?: string;
    apiKey?: string;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        proxyUrls?: string[];
    };
}

export interface CoinRecord {
    id: string;
    symbol: string | null;
    name: string | null;
    vsCurrency: string;
    currentPrice: number | null;
    marketCap: number | null;
    marketCapRank: number | null;
    fullyDilutedValuation: number | null;
    totalVolume: number | null;
    high24h: number | null;
    low24h: number | null;
    priceChange24h: number | null;
    priceChangePercentage24h: number | null;
    marketCapChange24h: number | null;
    marketCapChangePercentage24h: number | null;
    circulatingSupply: number | null;
    totalSupply: number | null;
    maxSupply: number | null;
    ath: number | null;
    athChangePercentage: number | null;
    athDate: string | null;
    atl: number | null;
    atlChangePercentage: number | null;
    atlDate: string | null;
    imageUrl: string | null;
    lastUpdated: string | null;
    scrapedAt: string;
}
