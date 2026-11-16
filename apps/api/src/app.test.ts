import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { createSecFetch, submissionsUrl, TICKERS_URL } from "./sec";

const fixtures = `${import.meta.dir}/../../../fixtures`;

// What the fake SEC knows. Any other URL gets a 500.
const files: Record<string, string> = {
  [TICKERS_URL]: "company_tickers.json",
  [submissionsUrl("0000320193")]: "AAPL.json",
  [submissionsUrl("0001639920")]: "SPOT.json",
  [submissionsUrl("0000019617")]: "JPM.json",
};

const TODAY = Date.parse("2026-11-16T12:00:00Z");

function setup({ now = TODAY, down = [] as string[] } = {}) {
  const secFetch = createSecFetch({
    userAgent: "Test User test@example.com",
    fetch: async (url) => {
      const file = files[url];
      if (!file || down.includes(url)) return new Response("Error", { status: 500 });
      return new Response(Bun.file(`${fixtures}/${file}`));
    },
    now: () => now,
    sleep: async () => {},
  });
  const app = createApp({ secFetch, now: () => now });
  return (path: string) => app.handle(new Request(`http://localhost${path}`));
}

const get = setup();

async function json(path: string) {
  const response = await get(path);
  return { status: response.status, body: await response.json() };
}

describe("GET /companies/:ticker/filings", () => {
  test("defaults: newest first, page 1 of 25", async () => {
    const { status, body } = await json("/companies/AAPL/filings");

    expect(status).toBe(200);
    expect(body.company).toEqual({ ticker: "AAPL", cik: "0000320193", name: "Apple Inc." });
    expect(body).toMatchObject({ page: 1, pageSize: 25, total: 1002, totalPages: 41 });
    expect(body.coverage).toEqual({ from: "2015-10-07", to: "2026-11-12", complete: false });
    expect(body.items).toHaveLength(25);
    expect(body.items[0]).toEqual({
      accessionNumber: "0001140361-26-043484",
      form: "4",
      filingDate: "2026-11-12",
      reportDate: "2026-11-10",
      description: "FORM 4",
      url: "https://www.sec.gov/Archives/edgar/data/320193/000114036126043484/xslF345X06/form4.xml",
    });
  });

  test("items don't include acceptanceDateTime", async () => {
    const { body } = await json("/companies/AAPL/filings");

    for (const item of body.items) expect(item).not.toHaveProperty("acceptanceDateTime");
  });

  test("ticker is not case sensitive", async () => {
    const { body } = await json("/companies/spot/filings");

    expect(body.company.ticker).toBe("SPOT");
    expect(body.coverage).toEqual({ from: "2015-06-12", to: "2026-11-13", complete: true });
  });

  test("filters by form, and total counts the filtered filings", async () => {
    const { body } = await json("/companies/AAPL/filings?form=10-K,8-K&pageSize=100");

    expect(body.total).toBe(12 + 102);
    expect(body.totalPages).toBe(2);
    expect(new Set(body.items.map((f: { form: string }) => f.form))).toEqual(new Set(["10-K", "8-K"]));
  });

  test("form is trimmed, case insensitive, and duplicates are removed", async () => {
    const { body } = await json(`/companies/AAPL/filings?form=${encodeURIComponent(" 10-k , 10-K ")}`);

    expect(body.total).toBe(12);
  });

  test("keeps spaces inside a form", async () => {
    const { body } = await json(`/companies/AAPL/filings?form=${encodeURIComponent("def 14a")}`);

    expect(body.total).toBe(11);
    expect(body.items[0].form).toBe("DEF 14A");
  });

  test("an unknown form returns an empty list", async () => {
    const { status, body } = await json("/companies/AAPL/filings?form=NOPE");

    expect(status).toBe(200);
    expect(body).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  test("an empty form means no filter", async () => {
    const { body } = await json("/companies/AAPL/filings?form=");

    expect(body.total).toBe(1002);
  });

  test("coverage uses all filings, not the filtered ones", async () => {
    const all = (await json("/companies/AAPL/filings")).body.coverage;

    expect((await json("/companies/AAPL/filings?form=10-K")).body.coverage).toEqual(all);
    expect((await json("/companies/AAPL/filings?form=NOPE")).body.coverage).toEqual(all);
  });

  test("sort=asc gives the oldest first", async () => {
    const { body } = await json("/companies/AAPL/filings?sort=asc&pageSize=100");
    const dates = body.items.map((f: { filingDate: string }) => f.filingDate);

    expect(body.items[0].accessionNumber).toBe("0001209191-15-074792");
    expect(dates).toEqual([...dates].sort());
  });

  test("pages follow on from each other", async () => {
    const page1 = (await json("/companies/AAPL/filings?pageSize=10")).body.items;
    const page2 = (await json("/companies/AAPL/filings?pageSize=5&page=2")).body.items;

    expect(page2).toEqual(page1.slice(5, 10));
  });

  test("the last page is partial, and a page after it is empty", async () => {
    const last = (await json("/companies/AAPL/filings?page=41")).body;
    const after = (await json("/companies/AAPL/filings?page=42")).body;

    expect(last.items).toHaveLength(2);
    expect(after).toMatchObject({ items: [], page: 42, total: 1002, totalPages: 41 });
  });

  test("ignores unknown params", async () => {
    const { status } = await json("/companies/AAPL/filings?foo=bar");

    expect(status).toBe(200);
  });

  test.each(["sort=up", "sort=", "page=0", "page=-1", "page=1.5", "page=abc", "pageSize=0", "pageSize=101", "pageSize=x"])(
    "422 for %p",
    async (query) => {
      expect((await get(`/companies/AAPL/filings?${query}`)).status).toBe(422);
    },
  );

  test("404 for an unknown ticker", async () => {
    const { status, body } = await json("/companies/ZZZZ/filings");

    expect(status).toBe(404);
    expect(body).toEqual({ code: "UNKNOWN_TICKER", message: "Unknown ticker: ZZZZ" });
  });

  test("502 when the SEC fails", async () => {
    const get = setup({ down: [submissionsUrl("0000320193")] });
    const response = await get("/companies/AAPL/filings");

    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("UPSTREAM_UNAVAILABLE");
  });

  test("502 when the ticker list fails", async () => {
    const get = setup({ down: [TICKERS_URL] });

    expect((await get("/companies/AAPL/filings")).status).toBe(502);
  });
});

describe("GET /filings/summary", () => {
  test("summarizes each ticker in request order", async () => {
    const { status, body } = await json("/filings/summary?tickers=SPOT,AAPL");

    expect(status).toBe(200);
    expect(body.window).toEqual({ from: "2025-11-17", to: "2026-11-16" });
    expect(body.errors).toEqual([]);
    expect(body.results.map((r: { ticker: string }) => r.ticker)).toEqual(["SPOT", "AAPL"]);

    const [spot, aapl] = body.results;
    expect(spot).toMatchObject({ ticker: "SPOT", cik: "0001639920", name: "Spotify Technology S.A.", latest10K: null });
    expect(spot.latestAnnualReport).toMatchObject({ form: "20-F", filingDate: "2026-02-10" });
    expect(spot.countsByForm).toEqual({ "3": 16, "4": 63, "144": 11, "6-K": 13, "S-8": 2, "20-F": 1 });
    expect(aapl.latest10K).toEqual({
      filingDate: "2026-11-03",
      url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
    });
    expect(aapl.countsByForm).toMatchObject({ "8-K": 9, "8-K/A": 1, "SCHEDULE 13G": 1, "SCHEDULE 13G/A": 1 });
  });

  test("counts late filings the SEC dated next Monday", async () => {
    // Saturday: JPM has filings accepted that day but dated Monday 2026-11-16
    const get = setup({ now: Date.parse("2026-11-14T12:00:00Z") });
    const body = await (await get("/filings/summary?tickers=JPM")).json();

    expect(body.window).toEqual({ from: "2025-11-15", to: "2026-11-14" });
    // 1233 up to 2026-11-14, plus 2 dated 2026-11-16
    expect(body.results[0].countsByForm["424B3"]).toBe(1235);
  });

  test("a failed ticker goes to errors, the others still return", async () => {
    const { status, body } = await json("/filings/summary?tickers=AAPL,ZZZZ,NVDA,SPOT");

    expect(status).toBe(200);
    expect(body.results.map((r: { ticker: string }) => r.ticker)).toEqual(["AAPL", "SPOT"]);
    expect(body.errors).toEqual([
      { ticker: "ZZZZ", code: "UNKNOWN_TICKER", message: "Unknown ticker: ZZZZ" },
      { ticker: "NVDA", code: "UPSTREAM_UNAVAILABLE", message: expect.any(String) },
    ]);
  });

  test("cleans up spaces, case and duplicates (BRK.B is BRK-B)", async () => {
    const { body } = await json(`/filings/summary?tickers=${encodeURIComponent("aapl, AAPL ,brk.b,BRK-B")}`);

    // BRK-B has no fixture, so it fails, but only once
    expect(body.results.map((r: { ticker: string }) => r.ticker)).toEqual(["AAPL"]);
    expect(body.errors.map((e: { ticker: string }) => e.ticker)).toEqual(["BRK-B"]);
  });

  test("duplicates are removed before counting to 20", async () => {
    const tickers = Array(25).fill("AAPL").join(",");

    expect((await get(`/filings/summary?tickers=${tickers}`)).status).toBe(200);
  });

  test("20 tickers is fine, 21 is 422", async () => {
    const names = Array.from({ length: 21 }, (_, i) => `T${i}`);

    expect((await get(`/filings/summary?tickers=${names.slice(0, 20).join(",")}`)).status).toBe(200);
    expect((await get(`/filings/summary?tickers=${names.join(",")}`)).status).toBe(422);
  });

  test.each(["", "?tickers=", "?tickers=%20,%20,"])("422 for missing or empty tickers: %p", async (query) => {
    expect((await get(`/filings/summary${query}`)).status).toBe(422);
  });

  test("502 when the ticker list can't be loaded", async () => {
    const get = setup({ down: [TICKERS_URL] });
    const response = await get("/filings/summary?tickers=AAPL");

    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("OpenAPI", () => {
  test("serves the docs page and a spec with both endpoints", async () => {
    expect((await get("/openapi")).status).toBe(200);

    const spec = await (await get("/openapi/json")).json();
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/companies/{ticker}/filings", "/filings/summary"]),
    );
  });
});
