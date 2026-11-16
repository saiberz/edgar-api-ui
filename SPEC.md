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

- Dates are "YYYY-MM-DD" strings, not Date
- If any values return "" we map it to null.
- url built in the backend: /Archives/edgar/data/{CIK no zeros}/{accession no dashes}/{primaryDocument}
- Ticker lookup case-insensitive: "." and "-" are the same (BRK.B = BRK-B), the response returns the format BRK-B
- total = count after filtering. Page past the end -> empty items, correct total. No matches -> total 0, totalPages 0.
- Sort by filingDate (asc|desc, default desc). If two filings have the same date, sort them by acceptanceDateTime, then accessionNumber.
- Form filter: exact match, case-insensitive, comma-separated. 10-K/A is its own form.
- Data source: use filings.recent only , include a coverage fields that tells the client the date range and whether older filings exist (complete = filings.files is empty). Coverage is about all the loaded filings, not only the filtered ones.
- Summary window: filingDate >= today - 365 days, today included, returned as window. "today" is the UTC date, not the local date.
- countsByForm uses the form names exactly as the SEC writes them. Amendments are counted on their own (10-K/A).
- latest10K ignores 10-K/A. latestAnnualReport is the newest 10-K, 20-F or 40-F (for foreign companies like SPOT). Both look at all of filings.recent, not only the last 12 months.
- Summary: partial success (200 with results + errors, even if every ticker fails). Results keep the order of the request.
- SEC: User-Agent from env SEC_USER_AGENT (check at startup , fail if missing), max 10 req/s.
- Cache: in memory, tickers 24 h, submissions 10 min, if same URL calls fetch only once, don't cache failed calls. Expired data is never returned (502 instead).
- Framework: Elysia 1.4 , stable version
- Tests give the code a fixed "today" (the day the fixtures were downloaded), so the 12-month counts in the tests don't change when the real date moves on

## Errors

- Unknown ticker (filings endpoint), 404, { code: "UNKNOWN_TICKER", message }
- A ticker fails inside summary, 200, that ticker is listed in errors[] with its code
- Bad query, 422 Elysia, validation error
- SEC down / 403 / 429 / timeout, and no fresh cache entry, 502, { code: "UPSTREAM_UNAVAILABLE", message }

## Not in scope

No database, no auth, no persistent cache, no full history via filings.files
