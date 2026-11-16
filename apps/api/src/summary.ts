import type { Static } from "elysia";
import { sortFilings, type FilingRow } from "./filings";
import type { Company, CompanySummary } from "./schemas";

type Window = { from: string; to: string };

// "YYYY-MM-DD" of a timestamp, in UTC
function utcDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

// The last 12 months, both ends included: 2025-11-17 to 2026-11-16
export function summaryWindow(now: number): Window {
  const today = new Date(now);
  const year = today.getUTCFullYear() - 1;
  const month = today.getUTCMonth();
  // The same day a year ago (29 February becomes the 28th), then the day after it
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const from = Date.UTC(year, month, Math.min(today.getUTCDate(), daysInMonth) + 1);
  return { from: utcDate(from), to: utcDate(now) };
}

const ANNUAL_REPORT_FORMS = ["10-K", "20-F", "40-F"] as const;
type AnnualReportForm = (typeof ANNUAL_REPORT_FORMS)[number];

function isAnnualReport(form: string): form is AnnualReportForm {
  return (ANNUAL_REPORT_FORMS as readonly string[]).includes(form);
}

export function summarize(
  company: Static<typeof Company>,
  rows: FilingRow[],
  window: Window,
): Static<typeof CompanySummary> {
  // No upper bound: the SEC gives some late filings next Monday's date, and we count those too
  const countsByForm: Record<string, number> = {};
  for (const row of rows) {
    if (row.filingDate >= window.from) {
      countsByForm[row.form] = (countsByForm[row.form] ?? 0) + 1;
    }
  }

  // Exact form names, so amendments (10-K/A) are skipped
  const newestFirst = sortFilings(rows, "desc");
  const tenK = newestFirst.find((row) => row.form === "10-K");
  const annualReport = newestFirst.find((row) => isAnnualReport(row.form));

  return {
    ...company,
    countsByForm,
    latest10K: tenK ? { filingDate: tenK.filingDate, url: tenK.url } : null,
    latestAnnualReport: annualReport
      ? { form: annualReport.form as AnnualReportForm, filingDate: annualReport.filingDate, url: annualReport.url }
      : null,
  };
}
