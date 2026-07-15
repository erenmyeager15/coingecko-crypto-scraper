# CoinGecko Crypto Scraper

Fetch normalized cryptocurrency market data from the official CoinGecko API. Look up explicit CoinGecko IDs, resolve names or symbols with search, or collect a bounded top-N market-cap list.

**[Data provided by CoinGecko](https://www.coingecko.com/en/api).** This Actor is an independent API client and is not endorsed by CoinGecko.

## What You Get

- Coin ID, name, symbol, image, and CoinGecko source URL
- Current price in a supported quote currency
- Market capitalization, rank, fully diluted valuation, and 24-hour volume
- 24-hour high, low, absolute change, and percentage change
- Circulating, total, and maximum supply
- All-time high/low values and dates
- CoinGecko update time, attribution, and scrape timestamp
- Machine-readable `RUN_STATUS` diagnostics for requests, retries, rate limits, searches, records, and spending-limit stops

## Quick Start

The default input performs one small keyless evaluation:

```json
{
  "coinIds": ["bitcoin"],
  "searchQueries": [],
  "maxSearchResults": 2,
  "topCoins": 0,
  "vsCurrency": "usd",
  "apiAccess": "keyless",
  "apiKey": "",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

Use official CoinGecko IDs such as `bitcoin`, `ethereum`, or `solana`. Use `searchQueries` when you only know a name or ticker symbol.

## API Access Modes

| Mode | Host | Actor limit | Intended use |
|---|---|---:|---|
| `keyless` | Public API | 25 potential results | Tiny evaluations only |
| `demo` | Public API + Demo header | 250 potential results | Testing with your Demo key |
| `pro` | Paid Pro API | 1,000 potential results | Production use with your appropriately licensed key |

If an older saved task supplies `apiKey` without `apiAccess`, the Actor treats it as a Demo key for backward compatibility. API keys are sent only in CoinGecko's documented request header; they are not written to logs, datasets, or `RUN_STATUS`.

Potential results are calculated before the run as:

```text
coinIds + (searchQueries x maxSearchResults) + topCoins
```

## Example: Top 100 Coins

```json
{
  "coinIds": [],
  "searchQueries": [],
  "topCoins": 100,
  "vsCurrency": "eur",
  "apiAccess": "pro",
  "apiKey": "YOUR_CG_PRO_API_KEY"
}
```

## Reliability Behavior

- Validates the quote currency with CoinGecko before market requests.
- Uses bounded requests and batches coin IDs in groups of 250.
- Applies timeouts and bounded retries only to timeout, rate-limit, and temporary server failures.
- Honors `Retry-After` when CoinGecko returns HTTP 429.
- Rejects malformed JSON, oversized responses, invalid response shapes, and unsafe coin IDs.
- Deduplicates coins found through multiple input modes.
- Reports legitimate no-match inputs as `empty` and upstream failures as `failed` or `partial`.
- Stops atomically at the user's maximum run charge.
- Does not rotate proxies or IPs to evade provider rate limits.

## Output

Dataset rows are available as CSV, Excel, JSON, HTML, XML, RSS, or through the Apify API. Each row includes `coinGeckoUrl` and the attribution text `Data provided by CoinGecko`.

The default key-value store also contains `RUN_STATUS`, including:

- `outcome`: `succeeded`, `partial`, `empty`, `stopped_spending_limit`, or `failed`
- request attempts, successes, failures, retries, rate limits, and timeouts
- search matches and no-match counts
- received, saved, invalid, duplicate, and unresolved-ID counts
- bounded diagnostics with no API keys

## Pricing

- Actor start: **$0.00005** per GB of configured memory, charged once
- Coin saved: **$0.001** per dataset item

The start fee and per-result price are unchanged. CoinGecko API subscription or overage charges, if any, belong to the API-key owner and are separate from Apify Actor charges.

## CoinGecko Terms and Licensing

This Actor does not grant a CoinGecko data license. CoinGecko currently describes keyless access as low-volume evaluation/non-commercial access and requires attribution. Production or commercial users must provide an API key from a plan whose license permits their use.

CoinGecko states that direct redistribution of raw API data can require a custom license. Do not use this Actor to resell or redistribute CoinGecko data unless your CoinGecko agreement explicitly permits it. Review the current [API Terms](https://www.coingecko.com/en/api_terms), [API pricing and license comparison](https://www.coingecko.com/en/api/pricing), and [API documentation](https://docs.coingecko.com/) before use.

## Important Disclaimer

Cryptocurrency data can be delayed, incomplete, volatile, or revised by the source. This Actor provides general market data only. It does not provide financial advice, investment recommendations, trading signals, or guarantees of accuracy or availability.

## License

Actor source code: Apache-2.0. CoinGecko data and branding remain subject to CoinGecko's terms.
