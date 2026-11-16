import { t } from "elysia";

export const Filing = t.Object({
  accessionNumber: t.String(),
  form: t.String(),
  filingDate: t.String(),
  reportDate: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  url: t.String(),
});

export const Company = t.Object({
  ticker: t.String(),
  cik: t.String(),
  name: t.String(),
});

export const FilingsPage = t.Object({
  company: Company,
  items: t.Array(Filing),
  page: t.Number(),
  pageSize: t.Number(),
  total: t.Number(),
  totalPages: t.Number(),
  coverage: t.Object({
    from: t.String(),
    to: t.String(),
    complete: t.Boolean(),
  }),
});

const DocumentRef = t.Object({ filingDate: t.String(), url: t.String() });

export const CompanySummary = t.Object({
  ticker: t.String(),
  cik: t.String(),
  name: t.String(),
  countsByForm: t.Record(t.String(), t.Number()),
  latest10K: t.Nullable(DocumentRef),
  latestAnnualReport: t.Nullable(
    t.Object({
      form: t.Union([t.Literal("10-K"), t.Literal("20-F"), t.Literal("40-F")]),
      filingDate: t.String(),
      url: t.String(),
    }),
  ),
});

const ErrorCode = t.Union([
  t.Literal("UNKNOWN_TICKER"),
  t.Literal("UPSTREAM_UNAVAILABLE"),
]);

// Body of the 404 and 502 responses
export const ApiError = t.Object({
  code: ErrorCode,
  message: t.String(),
});

// One failed ticker inside a 200 summary response
export const SummaryError = t.Object({
  ticker: t.String(),
  code: ErrorCode,
  message: t.String(),
});

export const SummaryResponse = t.Object({
  window: t.Object({ from: t.String(), to: t.String() }),
  results: t.Array(CompanySummary),
  errors: t.Array(SummaryError),
});
