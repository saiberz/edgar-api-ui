import type { Static } from "elysia";
import type { Company } from "./schemas";
import { AppError, TICKERS_URL, type SecFetch } from "./sec";

// company_tickers.json is an object keyed by "0", "1", ...
type TickerList = Record<string, { cik_str: number; ticker: string; title: string }>;

// Case doesn't matter, and BRK.B is the same as BRK-B
export function normalize(ticker: string): string {
  return ticker.trim().toUpperCase().replaceAll(".", "-");
}

export async function resolveTicker(input: string, secFetch: SecFetch): Promise<Static<typeof Company>> {
  const tickers = (await secFetch(TICKERS_URL)) as TickerList;
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
