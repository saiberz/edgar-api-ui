export const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";

export function submissionsUrl(cik: string): string {
  return `https://data.sec.gov/submissions/CIK${cik}.json`;
}

const MIN_INTERVAL_MS = 100;
const TIMEOUT_MS = 10_000;
const TICKERS_TTL_MS = 24 * 60 * 60 * 1000;
const FILINGS_TTL_MS = 10 * 60 * 1000;

export class AppError extends Error {
  constructor(
    public code: "UNKNOWN_TICKER" | "UPSTREAM_UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

export function requireUserAgent(env: Record<string, string | undefined>): string {
  const userAgent = env.SEC_USER_AGENT?.trim();
  if (!userAgent) {
    throw new Error("SEC_USER_AGENT is missing. The SEC needs a name and email, e.g. \"Jane Doe jane@example.com\"");
  }
  return userAgent;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
// check throws if the data doesn't have the shape we expect
export type SecFetch = (url: string, check?: (data: unknown) => void) => Promise<unknown>;

type SecFetchOptions = {
  userAgent: string;
  fetch?: FetchFn;
  now?: () => number;
  sleep?: (ms: number) => Promise<unknown>;
};

export function createSecFetch({
  userAgent,
  fetch = globalThis.fetch,
  now = Date.now,
  sleep = Bun.sleep,
}: SecFetchOptions): SecFetch {
  const cache = new Map<string, { data: unknown; expiresAt: number }>();
  const inFlight = new Map<string, Promise<unknown>>();

  // One queue for all requests: each one waits until 100 ms after the previous one started.
  let queue: Promise<void> = Promise.resolve();
  let lastStart = -Infinity;

  function waitForTurn(): Promise<void> {
    const turn = queue.then(async () => {
      const wait = lastStart + MIN_INTERVAL_MS - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
    });
    // Never let an error in one turn reach the requests behind it
    queue = turn.catch(() => {});
    return turn;
  }

  async function load(url: string, check?: (data: unknown) => void): Promise<unknown> {
    await waitForTurn();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new AppError("UPSTREAM_UNAVAILABLE", `Could not reach the SEC: ${url}`);
    }
    if (!response.ok) {
      throw new AppError("UPSTREAM_UNAVAILABLE", `The SEC returned ${response.status}: ${url}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AppError("UPSTREAM_UNAVAILABLE", `The SEC returned invalid JSON: ${url}`);
    }

    // Before caching, so bad data is not cached
    check?.(data);

    const ttl = url === TICKERS_URL ? TICKERS_TTL_MS : FILINGS_TTL_MS;
    cache.set(url, { data, expiresAt: now() + ttl });
    return data;
  }

  return function secFetch(url: string, check?: (data: unknown) => void): Promise<unknown> {
    const cached = cache.get(url);
    if (cached && now() < cached.expiresAt) return Promise.resolve(cached.data);

    const pending = inFlight.get(url);
    if (pending) return pending;

    const request = load(url, check).finally(() => inFlight.delete(url));
    inFlight.set(url, request);
    return request;
  };
}
