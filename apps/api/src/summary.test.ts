import { describe, expect, test } from "bun:test";
import { toFilings, type Submissions } from "./filings";
import { summarize, summaryWindow } from "./summary";

const fixture = (name: string): Promise<Submissions> =>
  Bun.file(`${import.meta.dir}/../../../fixtures/${name}`).json();

const aapl = await fixture("AAPL.json");
const spot = await fixture("SPOT.json");

const window = { from: "2025-11-17", to: "2026-11-16" };
const apple = { ticker: "AAPL", cik: "0000320193", name: "Apple Inc." };
const spotify = { ticker: "SPOT", cik: "0001639920", name: "Spotify Technology S.A." };

describe("summaryWindow", () => {
  test("the last 12 months, using the UTC date", () => {
    expect(summaryWindow(Date.parse("2026-11-16T12:00:00Z"))).toEqual(window);
  });

  test("uses the UTC date, not the local one", () => {
    expect(summaryWindow(Date.parse("2026-11-16T23:59:59Z")).to).toBe("2026-11-16");
    expect(summaryWindow(Date.parse("2026-11-17T00:00:00Z")).to).toBe("2026-11-17");
  });

  test("handles 29 February", () => {
    expect(summaryWindow(Date.parse("2028-02-29T12:00:00Z"))).toEqual({ from: "2027-03-01", to: "2028-02-29" });
  });
});

describe("summarize", () => {
  test("counts filings per form in the window, with form names exactly as the SEC writes them", () => {
    expect(summarize(apple, toFilings(aapl), window).countsByForm).toEqual({
      "3": 3,
      "4": 53,
      "144": 12,
      "25-NSE": 1,
      "8-K": 9,
      "8-K/A": 1,
      "424B2": 2,
      FWP: 1,
      "10-K": 1,
      "10-Q": 3,
      SD: 1,
      "SCHEDULE 13G": 1,
      "SCHEDULE 13G/A": 1,
      PX14A6G: 1,
      DEFA14A: 1,
      "DEF 14A": 1,
    });
  });

  test("counts filings dated after the window's end (late filings dated next Monday)", () => {
    const late = { ...toFilings(aapl)[0], form: "LATE", filingDate: "2026-11-23" };

    expect(summarize(apple, [late], window).countsByForm).toEqual({ LATE: 1 });
  });

  test("counts filings on the first day of the window", () => {
    const filing = { ...toFilings(aapl)[0], form: "8-K", filingDate: window.from };

    expect(summarize(apple, [filing], window).countsByForm).toEqual({ "8-K": 1 });
  });

  test("doesn't count filings before the window", () => {
    const old = { ...toFilings(aapl)[0], form: "OLD", filingDate: "2025-11-16" };

    expect(summarize(apple, [old], window).countsByForm).toEqual({});
  });

  test("finds the latest 10-K for a US company", () => {
    const summary = summarize(apple, toFilings(aapl), window);

    expect(summary).toMatchObject(apple);
    expect(summary.latest10K).toEqual({
      filingDate: "2026-11-03",
      url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
    });
    expect(summary.latestAnnualReport).toEqual({ form: "10-K", ...summary.latest10K! });
  });

  test("uses the 20-F as the annual report for a foreign company", () => {
    const summary = summarize(spotify, toFilings(spot), window);

    expect(summary.latest10K).toBeNull();
    expect(summary.latestAnnualReport).toEqual({
      form: "20-F",
      filingDate: "2026-02-10",
      url: "https://www.sec.gov/Archives/edgar/data/1639920/000162828026006874/ck0001639920-20251231.htm",
    });
  });

  test("skips amendments", () => {
    const rows = toFilings(aapl).map((f) => (f.form === "10-K" ? { ...f, form: "10-K/A" } : f));
    const summary = summarize(apple, rows, window);

    expect(summary.latest10K).toBeNull();
    expect(summary.latestAnnualReport).toBeNull();
  });

  test("accepts a 40-F as the annual report", () => {
    const row = { ...toFilings(aapl)[0], form: "40-F" };

    expect(summarize(apple, [row], window).latestAnnualReport?.form).toBe("40-F");
  });
});
