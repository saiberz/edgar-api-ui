# edgar-api-ui

A small API over the SEC's EDGAR data: list a company's filings, or summarize recent filings for several companies at once.

- `apps/api`: the API, built with Bun and Elysia 1.4
- `apps/web`: a React frontend, built with Vite

## Endpoints

- `GET /companies/:ticker/filings`: one company's filings, filtered by form, sorted by date and paged
- `GET /filings/summary?tickers=AAPL,SPOT`: filing counts by form for the last 12 months, plus the latest annual report for each ticker

```bash
curl "localhost:3000/companies/AAPL/filings?form=10-K,8-K&pageSize=5"
curl "localhost:3000/filings/summary?tickers=AAPL,SPOT"
```

Interactive docs are at http://localhost:3000/openapi.

[SPEC.md](SPEC.md) has the full rules: params, response shapes, errors and caching. [GLOSSARY.md](GLOSSARY.md) explains the SEC terms.

## Setup

You need [Bun](https://bun.com).

```bash
bun install
```

The SEC asks every client to send a User-Agent with a name and email. Create `apps/api/.env`:

```bash
SEC_USER_AGENT="Jane Doe jane@example.com"
```

The server won't start without it. Bun loads `.env` automatically.

## Run

From the repo root, after creating `apps/api/.env` as in Setup:

```bash
bun install
bun run dev
```

This starts both apps:

- Web app: http://localhost:5173
- API: http://localhost:3000

## Test

```bash
cd apps/api
bun test
bunx tsc --noEmit
```

The tests never call the SEC. They use saved SEC responses in [fixtures/](fixtures/README.md) and a fixed "today" (2026-11-16), so results don't change over time.

## Notes

- Data comes from `filings.recent` only, so very old filings may be missing. The `coverage` field in the response says which dates are included.
- Responses are cached in memory: 24 hours for the ticker list, 10 minutes for company filings. Requests to the SEC are limited to 10 per second.
- If the SEC is down or sends data in an unexpected shape, the API returns 502.
