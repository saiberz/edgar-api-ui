# Spec

## Endpoints

### GET /companies/:ticker/filings -> FilingsPage

Params:

- form: optional, default all forms. Comma-separated form types (10-K,8-K). An unknown form returns an empty list, not an error.
- sort: optional, default desc. asc or desc, always by filingDate. Anything else -> 422.
- page: optional, default 1. Integer, 1 or more. Otherwise -> 422.
- pageSize: optional, default 25. Integer, 1 to 100. Otherwise -> 422.

### GET /filings/summary -> SummaryResponse

Params:

- tickers: required. Comma-separated, 1 to 20 tickers. Missing, empty or more than 20 -> 422.

### Both endpoints

- Lists use commas (form=10-K,8-K), not repeated params: shorter URLs that are easy to share, and no form type or ticker contains a comma.
- Each value is trimmed and compared case insensitively, duplicates are removed. Spaces and slashes inside a form are kept (DEF 14A, 10-K/A)
- An empty form means no filter, unknown params are ignored

## Shapes

Types are defined in apps/api/src/schemas.ts

## Decisions

- Dates are plain "YYYY-MM-DD" strings, not Date objects.
- reportDate and description are sometimes empty in the SEC data. We return null for those.
- url is the full link to the document on sec.gov.
- Tickers are not case sensitive, and BRK.B and BRK-B are the same. We return the ticker the way the SEC writes it (BRK-B).
- If a ticker is not in company_tickers.json, we return 404.
- For the tickers list, we first clean up spaces, case and duplicates, then check there are between 1 and 20.
- total counts the filings after the filter. A page after the last one gives an empty list.
- Filings are sorted by filing date, newest first by default. If two have the same date, we use the time the SEC accepted them, then the accession number.
- The form filter needs the exact form name, but case doesn't matter. 10-K doesn't match 10-K/A.
- We only use filings.recent. The coverage field says which dates we have and if there are older filings we didn't load
- The summary counts filings from the last 12 months, using the UTC date. The SEC gives some late filings next Monday's date, and we count those too.
- Form names are counted exactly as the SEC writes them, so 10-K/A, SC 13G and SCHEDULE 13G each get their own count.
- latest10K and latestAnnualReport skip amendments. latestAnnualReport also accepts 20-F and 40-F, for foreign companies like Spotify. null means we didn't find one in filings.recent.
- If one ticker fails in the summary, we still return the others and list the failed one in errors. Results come back in the same order as the request. If the ticker list from the SEC can't be loaded, the whole request fails with 502.
- The SEC needs a User-Agent with a name and email. It comes from SEC_USER_AGENT, and the server won't start without it. We send at most 10 requests per second.
- The cache is in memory: 24 hours for the ticker list, 10 minutes for company filings. If two requests ask for the same URL at the same time, we only call the SEC once. Failed calls are not cached. We never return expired data, we return 502 instead.
- We use Elysia 1.4, the stable version.
- Tests use a fixed "today" (2026-11-16), so the 12-month counts don't change over time.

## Errors

- Unknown ticker (filings endpoint), 404, { code: "UNKNOWN_TICKER", message }
- A ticker fails inside summary, 200, that ticker is listed in errors[] with its code
- Bad query, 422 Elysia, validation error
- SEC down / 403 / 429 / timeout, and no fresh cache entry, 502, { code: "UPSTREAM_UNAVAILABLE", message }

## Not in scope

- No database, no auth, no persistent cache, no full history via filings.files
