import { describe, expect, test } from "bun:test";
import { AppError, TICKERS_URL } from "./sec";
import { checkTickers, resolveTicker } from "./tickers";

const tickers = await Bun.file(`${import.meta.dir}/../../../fixtures/company_tickers.json`).json();

// A fake secFetch that only knows the ticker list, and records the check it was given
function setup() {
  const urls: string[] = [];
  const checks: unknown[] = [];
  const secFetch = async (url: string, check?: (data: unknown) => void) => {
    urls.push(url);
    checks.push(check);
    if (url !== TICKERS_URL) throw new Error(`Unexpected URL: ${url}`);
    return tickers;
  };
  return { secFetch, urls, checks };
}

test("asks secFetch to check the ticker list", async () => {
  const { secFetch, checks } = setup();

  await resolveTicker("AAPL", secFetch);

  expect(checks).toEqual([checkTickers]);
});

describe("checkTickers", () => {
  function expectBadData(data: unknown) {
    expect(() => checkTickers(data)).toThrow(AppError);
    expect(() => checkTickers(data)).toThrow("The SEC returned an unexpected ticker list");
  }

  test("accepts the fixture", () => {
    expect(() => checkTickers(tickers)).not.toThrow();
  });

  test.each([[null], ["<html>"], [[]], [{}]])("throws UPSTREAM_UNAVAILABLE for %p", (data) => {
    expectBadData(data);
  });

  // Each one breaks the first entry of a copy of company_tickers.json
  test.each([
    ["an entry that is not an object", (t: any) => (t["0"] = "AAPL")],
    ["no ticker", (t: any) => delete t["0"].ticker],
    ["no title", (t: any) => delete t["0"].title],
    ["a cik_str that is not a number", (t: any) => (t["0"].cik_str = "320193")],
  ])("throws UPSTREAM_UNAVAILABLE for %s", (_, breakIt) => {
    const data = structuredClone(tickers);
    breakIt(data);

    expectBadData(data);
  });
});

test.each(["AAPL", "aapl", " AAPL "])("resolves %p", async (input) => {
  const { secFetch } = setup();

  expect(await resolveTicker(input, secFetch)).toEqual({ ticker: "AAPL", cik: "0000320193", name: "Apple Inc." });
});

test.each(["BRK-B", "brk.b", "Brk.B", "BRK.B"])("treats . and - the same: %p", async (input) => {
  const { secFetch } = setup();

  expect(await resolveTicker(input, secFetch)).toEqual({
    ticker: "BRK-B",
    cik: "0001067983",
    name: "BERKSHIRE HATHAWAY INC",
  });
});

test.each(["ZZZZ", "JPM-PC", ""])("throws UNKNOWN_TICKER for %p", async (input) => {
  const { secFetch } = setup();

  const error = await resolveTicker(input, secFetch).catch((e) => e);

  expect(error).toBeInstanceOf(AppError);
  expect(error.code).toBe("UNKNOWN_TICKER");
});

test("passes upstream errors through", async () => {
  const failing = async () => {
    throw new AppError("UPSTREAM_UNAVAILABLE", "SEC is down");
  };

  const error = await resolveTicker("AAPL", failing).catch((e) => e);

  expect(error.code).toBe("UPSTREAM_UNAVAILABLE");
});
