import { describe, expect, spyOn, test } from "bun:test";
import { AppError, createSecFetch, requireUserAgent, TICKERS_URL } from "./sec";

const USER_AGENT = "Test User test@example.com";
const FILINGS_URL = "https://data.sec.gov/submissions/CIK0000320193.json";

// A fake clock, a sleep that moves it, and a fake fetch that records when each call started
function setup(respond: (url: string) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  let time = 0;
  const calls: { url: string; time: number; init?: RequestInit }[] = [];
  const secFetch = createSecFetch({
    userAgent: USER_AGENT,
    fetch: async (url, init) => {
      calls.push({ url, time, init });
      return respond(url);
    },
    now: () => time,
    sleep: async (ms) => {
      time += ms;
    },
  });
  return {
    secFetch,
    calls,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("requireUserAgent", () => {
  test("returns SEC_USER_AGENT", () => {
    expect(requireUserAgent({ SEC_USER_AGENT: USER_AGENT })).toBe(USER_AGENT);
  });

  test("throws when it is missing or blank", () => {
    expect(() => requireUserAgent({})).toThrow("SEC_USER_AGENT");
    expect(() => requireUserAgent({ SEC_USER_AGENT: "  " })).toThrow("SEC_USER_AGENT");
  });
});

describe("secFetch", () => {
  test("sends the User-Agent and returns the parsed JSON", async () => {
    const { secFetch, calls } = setup(() => Response.json({ hello: "world" }));

    expect(await secFetch(FILINGS_URL)).toEqual({ hello: "world" });
    expect(calls[0].init?.headers).toEqual({ "User-Agent": USER_AGENT });
  });

  test("gives each request a 10-second timeout", async () => {
    const timeout = spyOn(AbortSignal, "timeout");
    const { secFetch, calls } = setup();

    await secFetch(FILINGS_URL);

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(calls[0].init?.signal).toBe(timeout.mock.results[0].value as AbortSignal);
    timeout.mockRestore();
  });

  test("serves a second call from the cache", async () => {
    const { secFetch, calls } = setup();

    await secFetch(FILINGS_URL);
    await secFetch(FILINGS_URL);

    expect(calls).toHaveLength(1);
  });

  test("caches company filings for 10 minutes", async () => {
    const { secFetch, calls, advance } = setup();

    await secFetch(FILINGS_URL);
    advance(10 * 60_000 - 1);
    await secFetch(FILINGS_URL);
    expect(calls).toHaveLength(1);

    advance(1);
    await secFetch(FILINGS_URL);
    expect(calls).toHaveLength(2);
  });

  test("caches the ticker list for 24 hours", async () => {
    const { secFetch, calls, advance } = setup();

    await secFetch(TICKERS_URL);
    advance(23 * 60 * 60_000);
    await secFetch(TICKERS_URL);
    expect(calls).toHaveLength(1);

    advance(60 * 60_000);
    await secFetch(TICKERS_URL);
    expect(calls).toHaveLength(2);
  });

  test("makes one request when the same URL is asked for twice at the same time", async () => {
    const { secFetch, calls } = setup(() => Response.json({ n: 1 }));

    const [a, b] = await Promise.all([secFetch(FILINGS_URL), secFetch(FILINGS_URL)]);

    expect(calls).toHaveLength(1);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual({ n: 1 });
  });

  test.each([
    ["403", () => new Response("Forbidden", { status: 403 })],
    ["429", () => new Response("Too many requests", { status: 429 })],
    ["403 with a JSON body", () => Response.json({ error: "Forbidden" }, { status: 403 })],
    ["429 with a JSON body", () => Response.json({ error: "Too many requests" }, { status: 429 })],
    ["500", () => new Response("Error", { status: 500 })],
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["invalid JSON", () => new Response("<html>")],
  ])("%s gives UPSTREAM_UNAVAILABLE and is not cached", async (_, failure) => {
    let fail = true;
    const { secFetch, calls } = setup(() => (fail ? failure() : Response.json({ ok: true })));

    const error = (await secFetch(FILINGS_URL).catch((e) => e)) as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("UPSTREAM_UNAVAILABLE");

    fail = false;
    expect(await secFetch(FILINGS_URL)).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  test("callers sharing a failed request all get the error, and the next call tries again", async () => {
    let fail = true;
    const { secFetch, calls } = setup(() => (fail ? new Response("Error", { status: 500 }) : Response.json({ ok: true })));

    const results = await Promise.allSettled([secFetch(FILINGS_URL), secFetch(FILINGS_URL)]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(calls).toHaveLength(1);

    fail = false;
    expect(await secFetch(FILINGS_URL)).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  test("runs the check before caching, so bad data is not cached", async () => {
    let good = false;
    const { secFetch, calls } = setup(() => Response.json({ good }));
    const check = (data: unknown) => {
      if (!(data as { good: boolean }).good) throw new AppError("UPSTREAM_UNAVAILABLE", "bad data");
    };

    await expect(secFetch(FILINGS_URL, check)).rejects.toThrow("bad data");

    good = true;
    expect(await secFetch(FILINGS_URL, check)).toEqual({ good: true });
    expect(calls).toHaveLength(2);
  });

  test("starts requests at least 100 ms apart", async () => {
    const { secFetch, calls } = setup();

    await Promise.all([secFetch("https://sec.test/a"), secFetch("https://sec.test/b"), secFetch("https://sec.test/c")]);

    expect(calls.map((c) => c.time)).toEqual([0, 100, 200]);
  });

  test("keeps the queue working after a failed request", async () => {
    const { secFetch, calls } = setup((url) =>
      url.endsWith("/a") ? Promise.reject(new TypeError("fetch failed")) : Response.json({ url }),
    );

    const [a, b] = await Promise.allSettled([secFetch("https://sec.test/a"), secFetch("https://sec.test/b")]);

    expect(a.status).toBe("rejected");
    expect(b).toEqual({ status: "fulfilled", value: { url: "https://sec.test/b" } });
    expect(calls.map((c) => c.time)).toEqual([0, 100]);
  });
});
