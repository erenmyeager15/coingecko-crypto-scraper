export type ApiAccess = 'keyless' | 'demo' | 'pro';

export interface ActorInput {
    coinIds?: string[];
    searchQueries?: string[];
    maxSearchResults?: number;
    topCoins?: number;
    vsCurrency?: string;
    apiAccess?: ApiAccess;
    apiKey?: string;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        proxyUrls?: string[];
    };
}

export interface NormalizedInput {
    coinIds: string[];
    searchQueries: string[];
    maxSearchResults: number;
    topCoins: number;
    vsCurrency: string;
    apiAccess: ApiAccess;
    apiKey: string;
    potentialResults: number;
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
    coinGeckoUrl: string;
    attribution: 'Data provided by CoinGecko';
    scrapedAt: string;
}

export type RunOutcome = 'succeeded' | 'partial' | 'empty' | 'stopped_spending_limit' | 'failed';

export interface RunDiagnostic {
    code: string;
    message: string;
    scope: string;
    statusCode?: number;
}

export interface RunStatus {
    outcome: RunOutcome;
    summary: string;
    source: 'CoinGecko API';
    apiAccess: ApiAccess;
    attribution: 'Data provided by CoinGecko';
    input: {
        explicitCoinIds: number;
        searchQueries: number;
        topCoins: number;
        maxSearchResults: number;
        vsCurrency: string;
        potentialResults: number;
    };
    requests: {
        attempted: number;
        succeeded: number;
        failed: number;
        retries: number;
        rateLimited: number;
        timedOut: number;
    };
    search: {
        attempted: number;
        succeeded: number;
        failed: number;
        matchesSelected: number;
        noMatches: number;
        invalidMatches: number;
    };
    records: {
        received: number;
        saved: number;
        invalid: number;
        duplicate: number;
        noMatchRequestedIds: number;
    };
    spendingLimitReached: boolean;
    diagnostics: RunDiagnostic[];
    startedAt: string;
    finishedAt: string;
    durationMs: number;
}
