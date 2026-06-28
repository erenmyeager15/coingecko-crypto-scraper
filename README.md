# CoinGecko Crypto Scraper - Prices and Market Data

Collect structured cryptocurrency market data from CoinGecko. Scrape specific CoinGecko coin IDs, resolve coin names or symbols through search, or retrieve the leading cryptocurrencies by market capitalization.

The Actor returns current price, market cap, rank, 24-hour volume and price movement, supply data, all-time high and low, image URL, and source timestamps. It uses CoinGecko's public API and supports an optional Demo API key for higher limits.

## Features

- Specific coin IDs such as `bitcoin`, `ethereum`, and `solana`
- Coin search with a configurable match limit
- Top cryptocurrencies ranked by market cap
- Quote currencies including USD, EUR, INR, and BTC
- Automatic deduplication across all input modes
- Optional proxy rotation for rate-limited large runs
- Atomic save-and-charge billing for each clean coin record
- Automatic stop before later batches or pages when the spending limit is reached

## Input

| Field | Description | Default |
|---|---|---|
| `coinIds` | CoinGecko coin IDs | `[]` |
| `searchQueries` | Coin names or symbols to search | `[]` |
| `maxSearchResults` | Maximum selected matches per search query | `5` |
| `topCoins` | Number of leading coins by market cap | `10` |
| `vsCurrency` | Quote currency | `usd` |
| `apiKey` | Optional CoinGecko Demo API key | None |
| `proxyConfiguration` | Optional proxy rotation | Disabled |

```json
{
  "coinIds": ["solana"],
  "searchQueries": ["dogecoin"],
  "maxSearchResults": 2,
  "topCoins": 5,
  "vsCurrency": "usd",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

## Sample output

```json
{
  "id": "solana",
  "symbol": "SOL",
  "name": "Solana",
  "vsCurrency": "usd",
  "currentPrice": 65.23,
  "marketCap": 37808420731,
  "marketCapRank": 7,
  "totalVolume": 3341336457,
  "high24h": 65.38,
  "low24h": 62.38,
  "priceChangePercentage24h": 2.03,
  "circulatingSupply": 579707291.97,
  "maxSupply": null,
  "ath": 293.31,
  "athDate": "2025-01-19T11:15:27.957Z",
  "atl": 0.500801,
  "imageUrl": "https://coin-images.coingecko.com/coins/images/...",
  "lastUpdated": "2026-06-12T16:00:00.000Z",
  "scrapedAt": "2026-06-12T16:00:01.000Z"
}
```

## How to scrape CoinGecko data

1. Add coin IDs, search queries, or set `topCoins`.
2. Choose the quote currency.
3. Leave proxy rotation disabled for normal API runs.
4. Add a CoinGecko Demo API key for larger workloads when needed.
5. Run the Actor and export the dataset as JSON, CSV, Excel, or another supported format.

## Use cases

- Cryptocurrency dashboards and market tables
- Portfolio valuation and scheduled price monitoring
- Trading and quantitative research
- Market-cap, volume, and momentum analysis
- Historical ATH and ATL reference datasets

## Pricing

| Event | Price |
|---|---|
| `coin-scraped` | $0.001 per successfully saved coin |

Each unique coin is saved and charged atomically. Duplicate coins are skipped, and the Actor stops further batches and pages when the user's spending limit is reached. Optional proxy usage remains disabled by default.

## Data source

Market data is provided by CoinGecko. Users are responsible for following CoinGecko's API terms, attribution requirements, and applicable usage limits.

## Responsible Use

This Actor is intended for lawful collection of publicly available information only. Users are responsible for ensuring their use complies with the source website's terms, robots.txt, applicable privacy laws, including India's DPDP Act, and all local regulations.

Do not use this Actor to collect, store, sell, or misuse personal data without a lawful basis. The Actor author is not responsible for misuse by end users.

## License

Apache-2.0
