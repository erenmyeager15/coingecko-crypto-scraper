# CoinGecko Crypto Scraper - Prices & Market Data

Collect public cryptocurrency market data from CoinGecko. The Actor can fetch specific CoinGecko coin IDs, resolve coin names or symbols through search, or collect top coins by market cap.

It returns current price, market cap, rank, volume, 24-hour change, supply, all-time high/low, image URL, update time, and scrape timestamp. It is for market-data research and dashboards, not financial advice or trading signals.

## Quick Start

```json
{
  "coinIds": ["bitcoin"],
  "searchQueries": [],
  "maxSearchResults": 2,
  "topCoins": 0,
  "vsCurrency": "usd",
  "apiKey": "",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

This fetches one Bitcoin market-data row and keeps the first run very small.

## Input

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `coinIds` | string array | `["bitcoin"]` | CoinGecko IDs such as `bitcoin`, `ethereum`, or `solana`. |
| `searchQueries` | string array | `[]` | Names or symbols to resolve through CoinGecko search. |
| `maxSearchResults` | integer | `2` | Maximum selected matches per search query. |
| `topCoins` | integer | `0` | Number of top market-cap coins to collect. Use `0` for only explicit IDs/searches. |
| `vsCurrency` | string | `usd` | Quote currency such as `usd`, `eur`, `inr`, or `btc`. |
| `apiKey` | string | empty | Optional CoinGecko Demo API key for higher limits. |
| `proxyConfiguration` | object | disabled | Usually not needed for small API runs. |

## Output

Each dataset row is one unique coin:

| Field | Description |
| --- | --- |
| `id`, `symbol`, `name` | CoinGecko identity fields. |
| `vsCurrency`, `currentPrice` | Quote currency and current price. |
| `marketCap`, `marketCapRank`, `fullyDilutedValuation` | Market valuation metrics. |
| `totalVolume`, `high24h`, `low24h` | Trading activity and 24-hour range. |
| `priceChange24h`, `priceChangePercentage24h` | 24-hour price movement. |
| `circulatingSupply`, `totalSupply`, `maxSupply` | Supply metrics. |
| `ath`, `athDate`, `atl`, `atlDate` | All-time high/low values and dates. |
| `imageUrl`, `lastUpdated`, `scrapedAt` | Image and source/scrape timestamps. |

## Verified Sample

An existing successful run returned this Bitcoin row:

```json
{
  "id": "bitcoin",
  "symbol": "BTC",
  "name": "Bitcoin",
  "vsCurrency": "usd",
  "currentPrice": 64119,
  "marketCap": 1284597160495,
  "marketCapRank": 1,
  "totalVolume": 17656174356,
  "priceChangePercentage24h": 0.67428,
  "circulatingSupply": 20045853,
  "maxSupply": 21000000,
  "lastUpdated": "2026-06-21T12:11:51.759Z"
}
```

## Pricing

Active pay-per-event pricing:

| Event | Price |
| --- | ---: |
| `coin-scraped` | `$0.001` per coin |
| `apify-actor-start` | `$0.00005` per GB at run start |

Each unique coin is saved and charged atomically. Duplicate coins across ID, search, and top-coin modes are skipped, and the Actor stops further batches/pages when the user's spending limit is reached.

## Common Workflows

1. Pull a scheduled crypto watchlist by explicit CoinGecko IDs.
2. Build a dashboard table for price, rank, market cap, and 24-hour change.
3. Compare top market-cap coins by setting `topCoins`.
4. Resolve names or symbols with `searchQueries`, then export matched coin rows.
5. Export to CSV, Excel, JSON, HTML, or connect through the Apify API.

## Notes and Limits

- Market data comes from CoinGecko and follows its availability, update timing, and API limits.
- A CoinGecko Demo API key can improve limits for larger workloads.
- Proxy rotation is normally unnecessary for small public API runs.
- This Actor does not provide investment recommendations, risk scores, buy/sell signals, or guaranteed real-time prices.

## Responsible Use

Use this Actor for lawful collection of public market data. Respect CoinGecko API terms, attribution requirements, usage limits, and any rules that apply to storing or redistributing market data.

## License

Apache-2.0
