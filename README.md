# CoinGecko Crypto Scraper - Prices & Market Data

Scrape **cryptocurrency market data from CoinGecko** - no API key required. Get live prices, market cap, rank, 24-hour volume and change, circulating/total/max supply, and all-time high/low for any coin. Scrape specific coins, search by name, or pull the top coins by market cap, in any quote currency. Export to **JSON, CSV, Excel, or HTML**, or pull via the Apify API.

Perfect for **crypto dashboards, portfolio tracking, trading bots, and market research**.

## Features

- ✅ **No API key needed** - uses CoinGecko's free public API (optional key for higher limits)
- ✅ **Three modes** - specific coin IDs, search queries, or top-N by market cap
- ✅ **Any quote currency** - USD, EUR, INR, BTC, and more
- ✅ **Rich data** - price, market cap, rank, volume, 24h change, supply, ATH/ATL
- ✅ **Fast & lightweight** - pure API, no headless browser

## Input

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `coinIds` | `string[]` | CoinGecko coin IDs (e.g. `"bitcoin"`, `"ethereum"`) | `[]` |
| `searchQueries` | `string[]` | Names/symbols to resolve to coin IDs | `[]` |
| `topCoins` | `integer` | Top N coins by market cap (`0` = only specified) | `100` |
| `vsCurrency` | `string` | Quote currency (`usd`, `eur`, `inr`, `btc`) | `usd` |
| `apiKey` | `string` (secret) | Optional CoinGecko Demo API key | — |
| `proxyConfiguration` | `object` | Proxy settings | Apify Proxy |

### Example input

```json
{
  "coinIds": ["bitcoin", "ethereum", "solana"],
  "topCoins": 250,
  "vsCurrency": "usd"
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
  "lastUpdated": "2026-06-11T06:31:09.541Z",
  "scrapedAt": "2026-06-11T06:31:10.370Z"
}
```

## Pricing

This Actor uses **pay-per-result** pricing:

| Event | Price |
|-------|-------|
| Per coin scraped | **$0.001** ($1 / 1,000 coins) |

You are only charged for coins actually returned. Apify platform usage is billed separately by Apify.

## Use cases

- **Crypto dashboards** - power price tables and market overviews
- **Portfolio tracking** - pull live valuations on a schedule
- **Trading research & bots** - feed market data into strategies
- **Market analysis** - rank coins by cap, volume, and momentum

## How to Scrape CoinGecko (Step by Step)

1. Click **Try for free** / **Run**.
2. Enter the coins you want: add CoinGecko coin IDs (e.g. `bitcoin`, `ethereum`) or `searchQueries`, or set `topCoins` to pull the market leaders.
3. Pick your quote currency in `vsCurrency` (e.g. `usd`, `eur`, `inr`, `btc`).
4. Run the Actor (start with a small `topCoins` value to test).
5. Export the results as JSON, CSV, Excel, or HTML, or pull them via the Apify API.

## Tips

- Coin IDs are CoinGecko's slugs (e.g. `bitcoin`, not `BTC`) - use `searchQueries` if unsure.
- Set `topCoins` to grab the market leaders, and add `coinIds` for specific extras.
- Add a free CoinGecko **Demo API key** for higher rate limits on large runs.

## License

Apache-2.0
