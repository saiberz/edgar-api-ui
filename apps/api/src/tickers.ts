import type { Static } from "elysia";
import type { Company } from "./schemas";
import { AppError, TICKERS_URL, type SecFetch } from "./sec";

// company_tickers.json is an object keyed by "0", "1", ...
type TickerList = Record<string, { cik_str: number; ticker: string; title: string }>;

function badData(reason: string): AppError {
  return new AppError("UPSTREAM_UNAVAILABLE", `The SEC returned an unexpected ticker list: ${reason}`);
}

// Checks the parts of company_tickers.json that we read, so bad data gives a 502 instead of a crash
export function checkTickers(data: unknown): asserts data is TickerList {
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw badData("it is not an object");

  const entries = Object.values(data);
  if (entries.length === 0) throw badData("it is empty");

  for (const entry of entries) {
    if (
      typeof entry?.cik_str !== "number" ||
      typeof entry?.ticker !== "string" ||
      typeof entry?.title !== "string"
    ) {
      throw badData("an entry is missing cik_str, ticker or title");
    }
  }
}

// Always load the ticker list through here, so it is checked before it is cached
export async function loadTickers(secFetch: SecFetch): Promise<TickerList> {
  return (await secFetch(TICKERS_URL, checkTickers)) as TickerList;
}

// Case doesn't matter, and BRK.B is the same as BRK-B
export function normalize(ticker: string): string {
  return ticker.trim().toUpperCase().replaceAll(".", "-");
}

export async function resolveTicker(input: string, secFetch: SecFetch): Promise<Static<typeof Company>> {
  const tickers = await loadTickers(secFetch);
  const wanted = normalize(input);
  const entry = Object.values(tickers).find((e) => normalize(e.ticker) === wanted);

  if (!entry) {
    throw new AppError("UNKNOWN_TICKER", `Unknown ticker: ${input.trim()}`);
  }
  return {
    ticker: entry.ticker,
    cik: String(entry.cik_str).padStart(10, "0"),
    name: entry.title,
  };
}
