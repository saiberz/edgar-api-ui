import { openapi } from "@elysiajs/openapi";
import { Elysia, t, ValidationError } from "elysia";
import { coverage, filterByForm, parseList, sortFilings, toFiling, toFilings, type Submissions } from "./filings";
import { ApiError, FilingsPage, SummaryResponse } from "./schemas";
import { AppError, submissionsUrl, TICKERS_URL, type SecFetch } from "./sec";
import { summarize, summaryWindow } from "./summary";
import { normalize, resolveTicker } from "./tickers";

// The tickers list after clean-up, used to return a normal 422 when there are too few or too many
const TickerList = t.Object({ tickers: t.Array(t.String(), { minItems: 1, maxItems: 20 }) });

type AppOptions = {
  secFetch: SecFetch;
  now: () => number;
};

export function createApp({ secFetch, now }: AppOptions) {
  async function loadFilings(cik: string) {
    const submissions = (await secFetch(submissionsUrl(cik))) as Submissions;
    return { submissions, rows: toFilings(submissions) };
  }

  return new Elysia()
    .use(openapi())
    // Elysia passes AppError's own code ("UNKNOWN_TICKER") as `code`, so we check the class instead
    .onError(({ error, status }) => {
      if (error instanceof AppError) {
        return status(error.code === "UNKNOWN_TICKER" ? 404 : 502, { code: error.code, message: error.message });
      }
    })
    .get(
      "/companies/:ticker/filings",
      async ({ params, query }) => {
        const { sort = "desc", page = 1, pageSize = 25 } = query;

        const company = await resolveTicker(params.ticker, secFetch);
        const { submissions, rows } = await loadFilings(company.cik);

        const filtered = filterByForm(rows, parseList(query.form));
        const sorted = sortFilings(filtered, sort);
        const items = sorted.slice((page - 1) * pageSize, page * pageSize);

        return {
          company,
          items: items.map(toFiling),
          page,
          pageSize,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / pageSize),
          coverage: coverage(submissions, rows),
        };
      },
      {
        query: t.Object({
          form: t.Optional(t.String({ description: "Comma-separated form types, e.g. 10-K,8-K" })),
          sort: t.Optional(t.UnionEnum(["asc", "desc"], { default: "desc" })),
          page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
          pageSize: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
        }),
        response: { 200: FilingsPage, 404: ApiError, 502: ApiError },
      },
    )
    .get(
      "/filings/summary",
      async ({ query }) => {
        const tickers = [...new Set(parseList(query.tickers).map(normalize))];
        if (tickers.length < 1 || tickers.length > 20) {
          throw new ValidationError("query", TickerList, { tickers });
        }

        // If the ticker list can't be loaded, the whole request fails with 502
        await secFetch(TICKERS_URL);

        const window = summaryWindow(now());
        const outcomes = await Promise.all(
          tickers.map(async (ticker) => {
            try {
              const company = await resolveTicker(ticker, secFetch);
              const { rows } = await loadFilings(company.cik);
              return { result: summarize(company, rows, window) };
            } catch (error) {
              if (!(error instanceof AppError)) throw error;
              return { error: { ticker, code: error.code, message: error.message } };
            }
          }),
        );

        return {
          window,
          results: outcomes.flatMap((outcome) => (outcome.result ? [outcome.result] : [])),
          errors: outcomes.flatMap((outcome) => (outcome.error ? [outcome.error] : [])),
        };
      },
      {
        query: t.Object({
          tickers: t.String({ description: "Comma-separated tickers, 1 to 20, e.g. AAPL,SPOT" }),
        }),
        response: { 200: SummaryResponse, 502: ApiError },
      },
    );
}
