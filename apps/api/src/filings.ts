import type { Static } from "elysia";
import type { Filing } from "./schemas";
import { AppError } from "./sec";

// Only the parts of the SEC submissions JSON that we read
export type Submissions = {
  cik: string;
  name: string;
  filings: {
    // Columns: index i across all arrays is one filing, newest first
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
    files: { name: string; filingCount: number; filingFrom: string; filingTo: string }[];
  };
};

const COLUMNS: (keyof Submissions["filings"]["recent"])[] = [
  "accessionNumber",
  "filingDate",
  "reportDate",
  "acceptanceDateTime",
  "form",
  "primaryDocument",
  "primaryDocDescription",
];

function badData(reason: string): AppError {
  return new AppError("UPSTREAM_UNAVAILABLE", `The SEC returned unexpected filings data: ${reason}`);
}

// Checks the parts of the SEC JSON that we read, so bad data gives a 502 instead of a crash
export function checkSubmissions(data: unknown): asserts data is Submissions {
  const submissions = data as { cik?: unknown; filings?: { recent?: Record<string, unknown>; files?: unknown } } | null;

  if (typeof submissions?.cik !== "string") throw badData("cik is missing");

  const recent = submissions.filings?.recent;
  if (typeof recent !== "object" || recent === null) throw badData("filings.recent is missing");

  for (const column of COLUMNS) {
    const values = recent[column];
    if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
      throw badData(`filings.recent.${column} is missing or not a list of strings`);
    }
  }

  const lengths = new Set(COLUMNS.map((column) => (recent[column] as string[]).length));
  if (lengths.size > 1) throw badData("the filings.recent columns have different lengths");

  if (!Array.isArray(submissions.filings?.files)) throw badData("filings.files is missing");
}

// acceptanceDateTime is not in the response, we only keep it to sort filings with the same date
export type FilingRow = Static<typeof Filing> & { acceptanceDateTime: string };

export function toFilings(submissions: Submissions): FilingRow[] {
  const recent = submissions.filings.recent;
  const cik = Number(submissions.cik);

  return recent.accessionNumber.map((accessionNumber, i) => ({
    accessionNumber,
    form: recent.form[i],
    filingDate: recent.filingDate[i],
    reportDate: recent.reportDate[i] || null,
    description: recent.primaryDocDescription[i] || null,
    url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNumber.replaceAll("-", "")}/${recent.primaryDocument[i]}`,
    acceptanceDateTime: recent.acceptanceDateTime[i],
  }));
}

export function toFiling(row: FilingRow): Static<typeof Filing> {
  return {
    accessionNumber: row.accessionNumber,
    form: row.form,
    filingDate: row.filingDate,
    reportDate: row.reportDate,
    description: row.description,
    url: row.url,
  };
}

// "10-K, 8-k,,10-K" -> ["10-K", "8-K"]. Spaces and slashes inside a value are kept (DEF 14A, 10-K/A)
export function parseList(value: string | undefined): string[] {
  if (!value) return [];
  const items = value.split(",").map((item) => item.trim().toUpperCase());
  return [...new Set(items.filter((item) => item !== ""))];
}

// Exact form names, case insensitive: 10-K doesn't match 10-K/A. No forms means no filter.
export function filterByForm(rows: FilingRow[], forms: string[]): FilingRow[] {
  if (forms.length === 0) return rows;
  return rows.filter((row) => forms.includes(row.form.toUpperCase()));
}

// Oldest first: by filingDate, then the time the SEC accepted it, then accessionNumber
function compareFilings(a: FilingRow, b: FilingRow): number {
  return (
    a.filingDate.localeCompare(b.filingDate) ||
    a.acceptanceDateTime.localeCompare(b.acceptanceDateTime) ||
    a.accessionNumber.localeCompare(b.accessionNumber)
  );
}

export function sortFilings(rows: FilingRow[], sort: "asc" | "desc"): FilingRow[] {
  if (sort === "asc") return [...rows].sort(compareFilings);
  return [...rows].sort((a, b) => compareFilings(b, a));
}

// Which dates we loaded from filings.recent. Pass all rows, not the filtered ones.
export function coverage(submissions: Submissions, rows: FilingRow[]) {
  const dates = rows.map((row) => row.filingDate).sort();
  return {
    from: dates[0],
    to: dates[dates.length - 1],
    complete: submissions.filings.files.length === 0,
  };
}
