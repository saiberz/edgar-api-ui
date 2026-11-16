import { expect, test } from "bun:test";
import { AppError, TICKERS_URL } from "./sec";
import { resolveTicker } from "./tickers";

const tickers = await Bun.file(`${import.meta.dir}/../../../fixtures/company_tickers.json`).json();

// A fake secFetch that only knows the ticker list
function setup() {
  const urls: string[] = [];
  const secFetch = async (url: string) => {
    urls.push(url);
    if (url !== TICKERS_URL) throw new Error(`Unexpected URL: ${url}`);
    return tickers;
  };
  return { secFetch, urls };
}

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
