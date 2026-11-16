 ▐▛███▛█   Claude Code v2.1.311
▝▜██████▀  Opus 5.5 · Claude Pro
 ▝▝   ▝▝   ~/Developer/playground/edgar-api-ui/apps/api


❯ /clear                                                                        

❯ Compare the code in apps/api with SPEC.md and list anything that doesn't      
  match. only list for now, dont fix it yet                                     

  Searched for 1 pattern, ran 2 shell commands (ctrl+o to expand)

⏺ Let me probe a few edge cases against the real app to confirm behavior instead
  of guessing.

  Ran 2 shell commands (ctrl+o to expand)

⏺ I found no clear mismatches between apps/api and SPEC.md. There are four edge
  cases and two judgment calls listed below. All 88 tests pass, and I tried the
  edge cases against the real app using the fixtures.

  Edge cases where the code could break the spec

  1. Malformed SEC data gives a 500 instead of a 502 or an errors[] entry. In
     src/app.ts:82, the summary only catches AppError and re-throws anything
     else. If the SEC sends valid JSON in an unexpected shape (for example, no
     filings.recent), toFilings throws a TypeError. The whole summary then fails
     with a 500, but the spec says the other tickers should still come back
     with that one listed in errors. The filings endpoint has the same problem:
     it returns 500, not 502 UPSTREAM_UNAVAILABLE.
  2. coverage when filings.recent is empty. In src/filings.ts:80-86, from and to
     become undefined, but schemas.ts says they must be strings. So a company
     with no recent filings would probably fail response validation instead of
     returning an empty page. The spec doesn't say what coverage should be in
     that case.
  3. The User-Agent isn't checked for a name and email. In src/sec.ts:21-27,
     requireUserAgent only checks that SEC_USER_AGENT is not empty. The spec
     says the SEC needs a name and email, and the server won't start without the
     variable. The "won't start" part is done, but the format isn't checked.
  4. A filing's own form name is matched case-insensitively. filterByForm
     uppercases both sides. That fits "case doesn't matter", and latest10K and
     latestAnnualReport use exact matches, which is right because the SEC writes
     forms in uppercase. This isn't a mismatch, but the two places behave
     differently.

  Ambiguous in the spec (your call)

  5. Is sort case-insensitive? "Both endpoints" says "Each value is trimmed and
     compared case insensitively". Right now sort=ASC and sort=%20asc%20 both
     return 422. I read that rule as covering only the comma-separated lists
     (form, tickers), so 422 looks correct, but the spec could be read either
     way.
  6. Ticker shown in errors[]. A failed ticker appears in its cleaned-up form
     (uppercased, . changed to -), not as the user typed it. The spec doesn't
     say which to use.

  Confirmed to match

  - Params: the defaults and 422 rules for form, sort, page and pageSize work as
    specified. A tickers list that is missing, empty or over 20 returns 422,
    and the count is checked after clean-up and de-duplication. Unknown params
    are ignored.
  - Tickers: 404 UNKNOWN_TICKER works, and BRK.B is treated the same as BRK-B.
  - Sorting and paging: filings are sorted by date, then by acceptance time,
    then by accession number. total counts after the filter, and a page past the
    end gives an empty list.
  - Data: reportDate and description come back as null when empty, and url is
    the full sec.gov link.
  - Summary: it covers 12 months using the UTC date and counts late filings with
    future dates. latest10K and latestAnnualReport skip amendments. A 502 is
    returned when the ticker list can't be loaded.
  - SEC client: it sends at most 10 requests per second and caches for 24 hours
    (ticker list) and 10 minutes (filings). Two requests for the same URL at
    once share one call, failed calls aren't cached, and expired data is never
    returned.

  I haven't changed anything. Tell me which of these you want fixed. For #2 and
  #5, you'd need to decide first how the spec should handle them.

✻ Worked for 59s · done 10:59 AM

※ recap: I compared apps/api with SPEC.md: there are no clear mismatches, just four edge cases (like malformed SEC data giving a 500) and two unclear spec points, and nothing is changed yet. Next, pick which ones you want fixed. (disable recaps in /config)

❯ Fix only 1, but only for bad SEC data (missing fields, or columns of          
  different length). That should be a 502, or go into errors[] in the summary.  
  Any other error stays a 500, so real bugs still show                          
                                                                                
  also make sure one failed SEC request can't break the next ones,  if it's     
  already safe, show me where and add a test                                    
                                                                                
  Tests first                                                                   

  Ran 1 shell command (ctrl+o to expand)

⏺ Already-safe paths in src/sec.ts mean a failed request can't poison later
  ones, but bad JSON that parses would still get cached for 10 minutes, so I'll
  move the data check into secFetch before caching. Writing the tests first.

  Read 1 file, ran 1 shell command (ctrl+o to expand)

⏺ Now the tests. First the unit tests for the new checkSubmissions in
  filings.test.ts:

⏺ Update(src/filings.test.ts)
  ⎿  Added 11 lines, removed 1 line
       1  import { describe, expect, test } from "bun:test";
       2 -import { coverage, filterByForm, parseList, sortFilings, toFili
         -ng, toFilings, type Submissions } from "./filings";            
       2 +import {                                                       
       3 +  checkSubmissions,                                            
       4 +  coverage,                                                    
       5 +  filterByForm,                                                
       6 +  parseList,                                                   
       7 +  sortFilings,                                                 
       8 +  toFiling,                                                    
       9 +  toFilings,                                                   
      10 +  type Submissions,                                            
      11 +} from "./filings";                                            
      12 +import { AppError } from "./sec";                              
      13  
      14  const fixture = (name: string): Promise<Submissions> =>
      15    Bun.file(`${import.meta.dir}/../../../fixtures/${name}`).json
          ();

⏺ Update(src/filings.test.ts)
  ⎿  Added 33 lines
      127    });
      128  });
      129  
      130 +describe("checkSubmissions", () => {                          
      131 +  function expectBadData(data: unknown) {                     
      132 +    expect(() => checkSubmissions(data)).toThrow(AppError);   
      133 +    expect(() => checkSubmissions(data)).toThrow("The SEC retu
          +rned unexpected filings data");                               
      134 +  }                                                           
      135 +                                                              
      136 +  test("accepts the fixtures", () => {                        
      137 +    expect(() => checkSubmissions(aapl)).not.toThrow();       
      138 +    expect(() => checkSubmissions(spot)).not.toThrow();       
      139 +  });                                                         
      140 +                                                              
      141 +  test.each([null, "<html>", []])("throws UPSTREAM_UNAVAILABLE
          + for %p", (data) => {                                         
      142 +    expectBadData(data);                                      
      143 +  });                                                         
      144 +                                                              
      145 +  // Each one breaks a copy of AAPL.json                      
      146 +  test.each([                                                 
      147 +    ["no cik", (s: any) => delete s.cik],                     
      148 +    ["no filings", (s: any) => delete s.filings],             
      149 +    ["no filings.recent", (s: any) => delete s.filings.recent]
          +,                                                             
      150 +    ["a missing column", (s: any) => delete s.filings.recent.f
          +orm],                                                         
      151 +    ["a column that is not a list", (s: any) => (s.filings.rec
          +ent.filingDate = "2026-11-12")],                              
      152 +    ["a value that is not a string", (s: any) => (s.filings.re
          +cent.filingDate[3] = null)],                                  
      153 +    ["columns of different length", (s: any) => s.filings.rece
          +nt.primaryDocument.pop()],                                    
      154 +    ["no filings.files", (s: any) => delete s.filings.files], 
      155 +  ])("throws UPSTREAM_UNAVAILABLE for %s", (_, breakIt) => {  
      156 +    const data = structuredClone(aapl);                       
      157 +    breakIt(data);                                            
      158 +                                                              
      159 +    expectBadData(data);                                      
      160 +  });                                                         
      161 +});                                                           
      162 +                                                              
      163  describe("coverage", () => {
      164    test("oldest and newest filingDate, incomplete when there ar
           e older files", () => {
      165      expect(coverage(aapl, toFilings(aapl))).toEqual({ from: "2
           015-10-07", to: "2026-11-12", complete: false });

⏺ Update(src/sec.test.ts)
  ⎿  Added 27 lines
      111      expect(calls).toHaveLength(2);
      112    });
      113  
      114 +  test("callers sharing a failed request all get the error, an
          +d the next call tries again", async () => {                   
      115 +    let fail = true;                                          
      116 +    const { secFetch, calls } = setup(() => (fail ? new Respon
          +se("Error", { status: 500 }) : Response.json({ ok: true }))); 
      117 +                                                              
      118 +    const results = await Promise.allSettled([secFetch(FILINGS
          +_URL), secFetch(FILINGS_URL)]);                               
      119 +    expect(results.map((r) => r.status)).toEqual(["rejected", 
          +"rejected"]);                                                 
      120 +    expect(calls).toHaveLength(1);                            
      121 +                                                              
      122 +    fail = false;                                             
      123 +    expect(await secFetch(FILINGS_URL)).toEqual({ ok: true });
      124 +    expect(calls).toHaveLength(2);                            
      125 +  });                                                         
      126 +                                                              
      127 +  test("runs the check before caching, so bad data is not cach
          +ed", async () => {                                            
      128 +    let good = false;                                         
      129 +    const { secFetch, calls } = setup(() => Response.json({ go
          +od }));                                                       
      130 +    const check = (data: unknown) => {                        
      131 +      if (!(data as { good: boolean }).good) throw new AppErro
          +r("UPSTREAM_UNAVAILABLE", "bad data");                        
      132 +    };                                                        
      133 +                                                              
      134 +    expect(secFetch(FILINGS_URL, check)).rejects.toThrow("bad 
          +data");                                                       
      135 +                                                              
      136 +    good = true;                                              
      137 +    expect(await secFetch(FILINGS_URL, check)).toEqual({ good:
          + true });                                                     
      138 +    expect(calls).toHaveLength(2);                            
      139 +  });                                                         
      140 +                                                              
      141    test("starts requests at least 100 ms apart", async () => {
      142      const { secFetch, calls } = setup();
      143  

⏺ Update(src/sec.test.ts)
  ⎿  Added 1 line, removed 1 line
      131        if (!(data as { good: boolean }).good) throw new AppErro
           r("UPSTREAM_UNAVAILABLE", "bad data");
      132      };
      133  
      134 -    expect(secFetch(FILINGS_URL, check)).rejects.toThrow("bad 
          -data");                                                       
      134 +    await expect(secFetch(FILINGS_URL, check)).rejects.toThrow
          +("bad data");                                                 
      135  
      136      good = true;
      137      expect(await secFetch(FILINGS_URL, check)).toEqual({ good:
            true });

⏺ Now the endpoint tests in app.test.ts:

⏺ Update(src/app.test.ts)
  ⎿  Added 7 lines, removed 1 line
      14  
      15  const TODAY = Date.parse("2026-11-16T12:00:00Z");
      16  
      17 -function setup({ now = TODAY, down = [] as string[] } = {}) {  
      17 +// Valid JSON, but not the shape we expect: filings.recent is m
         +issing                                                         
      18 +const BAD_SUBMISSIONS = { cik: "0000320193", filings: {} };    
      19 +                                                               
      20 +// down: URLs that return a 500. bad: URLs that return BAD_SUBM
         +ISSIONS.                                                       
      21 +// Tests can empty these lists later to make the SEC work again
         +.                                                              
      22 +function setup({ now = TODAY, down = [] as string[], bad = [] a
         +s string[] } = {}) {                                           
      23    const secFetch = createSecFetch({
      24      userAgent: "Test User test@example.com",
      25      fetch: async (url) => {
      26        const file = files[url];
      27        if (!file || down.includes(url)) return new Response("Err
          or", { status: 500 });
      28 +      if (bad.includes(url)) return Response.json(BAD_SUBMISSIO
         +NS);                                                           
      29        return new Response(Bun.file(`${fixtures}/${file}`));
      30      },
      31      now: () => now,

⏺ Update(src/app.test.ts)
  ⎿  Added 25 lines
      171  
      172      expect((await get("/companies/AAPL/filings")).status).toBe
           (502);
      173    });
      174 +                                                              
      175 +  test("502 when the SEC sends filings data in an unexpected s
          +hape", async () => {                                          
      176 +    const get = setup({ bad: [submissionsUrl("0000320193")] })
          +;                                                             
      177 +    const response = await get("/companies/AAPL/filings");    
      178 +                                                              
      179 +    expect(response.status).toBe(502);                        
      180 +    expect(await response.json()).toEqual({                   
      181 +      code: "UPSTREAM_UNAVAILABLE",                           
      182 +      message: expect.stringContaining("unexpected filings dat
          +a"),                                                          
      183 +    });                                                       
      184 +  });                                                         
      185 +                                                              
      186 +  test.each(["down", "bad"] as const)("a failed SEC request (%
          +s) doesn't break the next one", async (failure) => {          
      187 +    const failing = [submissionsUrl("0000320193")];           
      188 +    const get = setup({ [failure]: failing });                
      189 +                                                              
      190 +    expect((await get("/companies/AAPL/filings")).status).toBe
          +(502);                                                        
      191 +                                                              
      192 +    failing.length = 0;                                       
      193 +    expect((await get("/companies/AAPL/filings")).status).toBe
          +(200);                                                        
      194 +  });                                                         
      195 +                                                              
      196 +  test("any other error is a 500, so bugs still show", async (
          +) => {                                                        
      197 +    expect((await getWithBug("/companies/AAPL/filings")).statu
          +s).toBe(500);                                                 
      198 +  });                                                         
      199  });
      200  
      201  describe("GET /filings/summary", () => {

⏺ Update(src/app.test.ts)
  ⎿  Added 15 lines
      271      expect(response.status).toBe(502);
      272      expect((await response.json()).code).toBe("UPSTREAM_UNAVAI
           LABLE");
      273    });
      274 +                                                              
      275 +  test("bad SEC data for one ticker goes to errors, the others
          + still return", async () => {                                 
      276 +    const get = setup({ bad: [submissionsUrl("0001639920")] })
          +;                                                             
      277 +    const { status, body } = { status: 0, body: null as any, .
          +..(await get("/filings/summary?tickers=AAPL,SPOT").then(async 
          +(r) => ({ status: r.status, body: await r.json() }))) };      
      278 +                                                              
      279 +    expect(status).toBe(200);                                 
      280 +    expect(body.results.map((r: { ticker: string }) => r.ticke
          +r)).toEqual(["AAPL"]);                                        
      281 +    expect(body.errors).toEqual([                             
      282 +      { ticker: "SPOT", code: "UPSTREAM_UNAVAILABLE", message:
          + expect.stringContaining("unexpected filings data") },        
      283 +    ]);                                                       
      284 +  });                                                         
      285 +                                                              
      286 +  test("any other error is a 500, so bugs still show", async (
          +) => {                                                        
      287 +    expect((await getWithBug("/filings/summary?tickers=AAPL"))
          +.status).toBe(500);                                           
      288 +  });                                                         
      289  });
      290  
      291  describe("OpenAPI", () => {

⏺ That summary test line is unreadable, so I'll simplify it. I'll also add the
  getWithBug helper:

⏺ Update(src/app.test.ts)
  ⎿  Added 3 lines, removed 2 lines
      274  
      275    test("bad SEC data for one ticker goes to errors, the others
            still return", async () => {
      276      const get = setup({ bad: [submissionsUrl("0001639920")] })
           ;
      277 -    const { status, body } = { status: 0, body: null as any, .
          -..(await get("/filings/summary?tickers=AAPL,SPOT").then(async 
          -(r) => ({ status: r.status, body: await r.json() }))) };      
      277 +    const response = await get("/filings/summary?tickers=AAPL,
          +SPOT");                                                       
      278 +    const body = await response.json();                       
      279  
      279 -    expect(status).toBe(200);                                 
      280 +    expect(response.status).toBe(200);                        
      281      expect(body.results.map((r: { ticker: string }) => r.ticke
           r)).toEqual(["AAPL"]);
      282      expect(body.errors).toEqual([
      283        { ticker: "SPOT", code: "UPSTREAM_UNAVAILABLE", message:
            expect.stringContaining("unexpected filings data") },

⏺ Update(src/app.test.ts)
  ⎿  Added 10 lines
      37  
      38  const get = setup();
      39  
      40 +// The ticker list loads, but loading filings hits a bug (not a
         +n AppError)                                                    
      41 +const appWithBug = createApp({                                 
      42 +  secFetch: async (url) => {                                   
      43 +    if (url === TICKERS_URL) return Bun.file(`${fixtures}/compa
         +ny_tickers.json`).json();                                      
      44 +    throw new TypeError("a bug");                              
      45 +  },                                                           
      46 +  now: () => TODAY,                                            
      47 +});                                                            
      48 +const getWithBug = (path: string) => appWithBug.handle(new Requ
         +est(`http://localhost${path}`));                               
      49 +                                                               
      50  async function json(path: string) {
      51    const response = await get(path);
      52    return { status: response.status, body: await response.json()
           };

  Ran 1 shell command (ctrl+o to expand)

⏺ The new tests fail as expected, and the ones that already pass confirm
  existing behavior. Next I'm writing the code that makes checkSubmissions
  exist.

⏺ Update(src/filings.ts)
  ⎿  Added 1 line
      1  import type { Static } from "elysia";
      2  import type { Filing } from "./schemas";
      3 +import { AppError } from "./sec";                               
      4  
      5  // Only the parts of the SEC submissions JSON that we read
      6  export type Submissions = {
⏺ Update(src/filings.ts)
  ⎿  Added 36 lines
      21    };
      22  };
      23  
      24 +const COLUMNS: (keyof Submissions["filings"]["recent"])[] = [  
      25 +  "accessionNumber",                                           
      26 +  "filingDate",                                                
      27 +  "reportDate",                                                
      28 +  "acceptanceDateTime",                                        
      29 +  "form",                                                      
      30 +  "primaryDocument",                                           
      31 +  "primaryDocDescription",                                     
      32 +];                                                             
      33 +                                                               
      34 +function badData(reason: string): AppError {                   
      35 +  return new AppError("UPSTREAM_UNAVAILABLE", `The SEC returned
         + unexpected filings data: ${reason}`);                         
      36 +}                                                              
      37 +                                                               
      38 +// Checks the parts of the SEC JSON that we read, so bad data g
         +ives a 502 instead of a crash                                  
      39 +export function checkSubmissions(data: unknown): asserts data i
         +s Submissions {                                                
      40 +  const submissions = data as { cik?: unknown; filings?: { rece
         +nt?: Record<string, unknown>; files?: unknown } } | null;      
      41 +                                                               
      42 +  if (typeof submissions?.cik !== "string") throw badData("cik 
         +is missing");                                                  
      43 +                                                               
      44 +  const recent = submissions.filings?.recent;                  
      45 +  if (typeof recent !== "object" || recent === null) throw badD
         +ata("filings.recent is missing");                              
      46 +                                                               
      47 +  for (const column of COLUMNS) {                              
      48 +    const values = recent[column];                             
      49 +    if (!Array.isArray(values) || !values.every((value) => type
         +of value === "string")) {                                      
      50 +      throw badData(`filings.recent.${column} is missing or not
         + a list of strings`);                                          
      51 +    }                                                          
      52 +  }                                                            
      53 +                                                               
      54 +  const lengths = new Set(COLUMNS.map((column) => (recent[colum
         +n] as string[]).length));                                      
      55 +  if (lengths.size > 1) throw badData("the filings.recent colum
         +ns have different lengths");                                   
      56 +                                                               
      57 +  if (!Array.isArray(submissions.filings?.files)) throw badData
         +("filings.files is missing");                                  
      58 +}                                                              
      59 +                                                               
      60  // acceptanceDateTime is not in the response, we only keep it t
          o sort filings with the same date
      61  export type FilingRow = Static<typeof Filing> & { acceptanceDat
          eTime: string };
      62  

⏺ Update(src/sec.ts)
  ⎿  Added 2 lines, removed 1 line
      27  }
      28  
      29  export type FetchFn = (url: string, init?: RequestInit) => Prom
          ise<Response>;
      30 -export type SecFetch = (url: string) => Promise<unknown>;      
      30 +// check throws if the data doesn't have the shape we expect   
      31 +export type SecFetch = (url: string, check?: (data: unknown) =>
         + void) => Promise<unknown>;                                    
      32  
      33  type SecFetchOptions = {
      34    userAgent: string;

⏺ Update(src/sec.ts)
  ⎿  Added 1 line, removed 1 line
      61      return turn;
      62    }
      63  
      64 -  async function load(url: string): Promise<unknown> {         
      64 +  async function load(url: string, check?: (data: unknown) => v
         +oid): Promise<unknown> {                                       
      65      await waitForTurn();
      66  
      67      let response: Response;

⏺ Update(src/sec.ts)
  ⎿  Added 3 lines
      84        throw new AppError("UPSTREAM_UNAVAILABLE", `The SEC retur
          ned invalid JSON: ${url}`);
      85      }
      86  
      87 +    // Before caching, so bad data is not cached               
      88 +    check?.(data);                                             
      89 +                                                               
      90      const ttl = url === TICKERS_URL ? TICKERS_TTL_MS : FILINGS_
          TTL_MS;
      91      cache.set(url, { data, expiresAt: now() + ttl });
      92      return data;

⏺ Update(src/sec.ts)
  ⎿  Added 2 lines, removed 2 lines
       92      return data;
       93    }
       94  
       95 -  return function secFetch(url: string): Promise<unknown> {   
       95 +  return function secFetch(url: string, check?: (data: unknown
          +) => void): Promise<unknown> {                                
       96      const cached = cache.get(url);
       97      if (cached && now() < cached.expiresAt) return Promise.res
           olve(cached.data);
       98  
       99      const pending = inFlight.get(url);
      100      if (pending) return pending;
      101  
      102 -    const request = load(url).finally(() => inFlight.delete(ur
          -l));                                                          
      102 +    const request = load(url, check).finally(() => inFlight.de
          +lete(url));                                                   
      103      inFlight.set(url, request);
      104      return request;
      105    };

⏺ Update(src/app.ts)
  ⎿  Added 1 line, removed 1 line
      1  import { openapi } from "@elysiajs/openapi";
      2  import { Elysia, t, ValidationError } from "elysia";
      3 -import { coverage, filterByForm, parseList, sortFilings, toFilin
        -g, toFilings, type Submissions } from "./filings";              
      3 +import { checkSubmissions, coverage, filterByForm, parseList, so
        +rtFilings, toFiling, toFilings, type Submissions } from "./filin
        +gs";                                                            
      4  import { ApiError, FilingsPage, SummaryResponse } from "./schema
         s";
      5  import { AppError, submissionsUrl, TICKERS_URL, type SecFetch } 
         from "./sec";
      6  import { summarize, summaryWindow } from "./summary";

⏺ Update(src/app.ts)
  ⎿  Added 1 line, removed 1 line
      16  
      17  export function createApp({ secFetch, now }: AppOptions) {
      18    async function loadFilings(cik: string) {
      19 -    const submissions = (await secFetch(submissionsUrl(cik))) a
         -s Submissions;                                                 
      19 +    const submissions = (await secFetch(submissionsUrl(cik), ch
         +eckSubmissions)) as Submissions;                               
      20      return { submissions, rows: toFilings(submissions) };
      21    }
      22  

  Ran 1 shell command (ctrl+o to expand)

⏺ One test timed out because test.each spreads the [] row into nothing, so Bun
  read data as a done callback. I'm wrapping each row in its own array next.

⏺ Update(src/filings.test.ts)
  ⎿  Added 1 line, removed 1 line
      138      expect(() => checkSubmissions(spot)).not.toThrow();
      139    });
      140  
      141 -  test.each([null, "<html>", []])("throws UPSTREAM_UNAVAILABLE
          - for %p", (data) => {                                         
      141 +  test.each([[null], ["<html>"], [[]]])("throws UPSTREAM_UNAVA
          +ILABLE for %p", (data) => {                                   
      142      expectBadData(data);
      143    });
      144  

  Ran 2 shell commands (ctrl+o to expand)

⏺ Bad SEC data now returns a 502, or an errors[] entry in the summary. Any other
  error still returns a 500. All 108 tests pass and the type check is clean:

   108 pass
   0 fail
   219 expect() calls
  Ran 108 tests across 5 files. [79.00ms]
  --- tsc
  tsc exit: 0

  Fix #1, bad SEC data
  - The check: a new checkSubmissions function in src/filings.ts throws
    AppError("UPSTREAM_UNAVAILABLE", "The SEC returned unexpected filings data: 
    …") in these cases:
    - cik is missing.
    - filings.recent is missing.
    - One of the 7 columns we read is missing or isn't a list of strings.
    - The columns have different lengths.
    - filings.files is missing.
  - What the user sees: the filings endpoint returns 502. The summary puts that
    ticker in errors[] and still returns the others.
  - Other errors: nothing else is caught, so a real bug still gives a 500. A new
    test on each endpoint checks this.
  - Strings check: I also check that the column values are strings. A stray null
    would otherwise crash the sort with a 500. I counted that as a missing
    field; tell me if you'd rather not check values.

  Can one failed request break the next ones?

  This part was already safe, all in src/sec.ts:
  - queue = turn.catch(() => {}) stops an error in one request from blocking the
    rate-limit queue for the ones behind it.
  - .finally(() => inFlight.delete(url)) clears the in-flight entry after a
    failure, so the next call tries the SEC again.
  - cache.set only runs after a successful fetch and JSON parse, so failures
    aren't cached.

  There was one gap, which the fix would have made worse. If I had checked the
  data in app.ts, bad data that parsed as JSON would already be in the cache.
  Every request for that company would then get a 502 for the next 10 minutes.
  To prevent that, secFetch now takes an optional check and runs it before
  caching (the check?.(data) call in src/sec.ts), and app.ts passes
  checkSubmissions to it.

  New tests
  - filings.test.ts: the fixtures pass the check, and 11 broken versions of the
    data are each rejected.
  - sec.test.ts: two callers sharing one failed request both get the error, and
    the next call tries again. Bad data from the check isn't cached.
  - app.test.ts:
    - Bad data gives a 502 on the filings endpoint.
    - A request still works after an earlier one hit an SEC failure, for both
      "SEC down" and "bad data".
    - Bad data for one ticker goes to errors[] in the summary.
    - Any other error gives a 500 on both endpoints.

  The "500 for bugs", "SEC down then works again" and "shared failed request"
  tests already passed before my change, which confirms the old behavior. The
  bad-data tests failed until the fix.

  Not covered: company_tickers.json isn't checked. If its shape were wrong, both
  endpoints would return 500, not 502. Tell me if you want the same check
  there.

  NOTES.md already had changes before I started, and I didn't touch it.

✻ Churned for 2m 34s · done 11:07 AM

❯ also check company_tickers.json the same way: if its shape is wrong, return   
  502, not 500, run the check before caching, like the other one. test first    

  Read 1 file (ctrl+o to expand)

⏺ I'm adding a shared loadTickers helper with checkTickers in tickers.ts so both
  ticker fetches go through the check, and I'll write the tests first.

⏺ Update(src/tickers.test.ts)
  ⎿  Added 43 lines, removed 5 lines
       1 -import { expect, test } from "bun:test";                       
       1 +import { describe, expect, test } from "bun:test";             
       2  import { AppError, TICKERS_URL } from "./sec";
       3 -import { resolveTicker } from "./tickers";                     
       3 +import { checkTickers, resolveTicker } from "./tickers";       
       4  
       5  const tickers = await Bun.file(`${import.meta.dir}/../../../fix
          tures/company_tickers.json`).json();
       6  
       7 -// A fake secFetch that only knows the ticker list             
       7 +// A fake secFetch that only knows the ticker list, and records
         + the check it was given                                        
       8  function setup() {
       9    const urls: string[] = [];
      10 -  const secFetch = async (url: string) => {                    
      10 +  const checks: unknown[] = [];                                
      11 +  const secFetch = async (url: string, check?: (data: unknown) 
         +=> void) => {                                                  
      12      urls.push(url);
      13 +    checks.push(check);                                        
      14      if (url !== TICKERS_URL) throw new Error(`Unexpected URL: $
          {url}`);
      15      return tickers;
      16    };
      15 -  return { secFetch, urls };                                   
      17 +  return { secFetch, urls, checks };                           
      18  }
      19  
      20 +test("asks secFetch to check the ticker list", async () => {   
      21 +  const { secFetch, checks } = setup();                        
      22 +                                                               
      23 +  await resolveTicker("AAPL", secFetch);                       
      24 +                                                               
      25 +  expect(checks).toEqual([checkTickers]);                      
      26 +});                                                            
      27 +                                                               
      28 +describe("checkTickers", () => {                               
      29 +  function expectBadData(data: unknown) {                      
      30 +    expect(() => checkTickers(data)).toThrow(AppError);        
      31 +    expect(() => checkTickers(data)).toThrow("The SEC returned 
         +an unexpected ticker list");                                   
      32 +  }                                                            
      33 +                                                               
      34 +  test("accepts the fixture", () => {                          
      35 +    expect(() => checkTickers(tickers)).not.toThrow();         
      36 +  });                                                          
      37 +                                                               
      38 +  test.each([[null], ["<html>"], [[]], [{}]])("throws UPSTREAM_
         +UNAVAILABLE for %p", (data) => {                               
      39 +    expectBadData(data);                                       
      40 +  });                                                          
      41 +                                                               
      42 +  // Each one breaks the first entry of a copy of company_ticke
         +rs.json                                                        
      43 +  test.each([                                                  
      44 +    ["an entry that is not an object", (t: any) => (t["0"] = "A
         +APL")],                                                        
      45 +    ["no ticker", (t: any) => delete t["0"].ticker],           
      46 +    ["no title", (t: any) => delete t["0"].title],             
      47 +    ["a cik_str that is not a number", (t: any) => (t["0"].cik_
         +str = "320193")],                                              
      48 +  ])("throws UPSTREAM_UNAVAILABLE for %s", (_, breakIt) => {   
      49 +    const data = structuredClone(tickers);                     
      50 +    breakIt(data);                                             
      51 +                                                               
      52 +    expectBadData(data);                                       
      53 +  });                                                          
      54 +});                                                            
      55 +                                                               
      56  test.each(["AAPL", "aapl", " AAPL "])("resolves %p", async (inp
          ut) => {
      57    const { secFetch } = setup();
      58  

⏺ Update(src/app.test.ts)
  ⎿  Added 3 lines, removed 3 lines
      14  
      15  const TODAY = Date.parse("2026-11-16T12:00:00Z");
      16  
      17 -// Valid JSON, but not the shape we expect: filings.recent is m
         -issing                                                         
      18 -const BAD_SUBMISSIONS = { cik: "0000320193", filings: {} };    
      17 +// Valid JSON, but the wrong shape for both the ticker list and
         + company filings                                               
      18 +const BAD_DATA = { cik: "0000320193", filings: {} };           
      19  
      20 -// down: URLs that return a 500. bad: URLs that return BAD_SUBM
         -ISSIONS.                                                       
      20 +// down: URLs that return a 500. bad: URLs that return BAD_DATA
         +.                                                              
      21  // Tests can empty these lists later to make the SEC work again
          .
      22  function setup({ now = TODAY, down = [] as string[], bad = [] a
          s string[] } = {}) {
      23    const secFetch = createSecFetch({

⏺ Update(src/app.test.ts)
  ⎿  Added 1 line, removed 1 line
      25      fetch: async (url) => {
      26        const file = files[url];
      27        if (!file || down.includes(url)) return new Response("Err
          or", { status: 500 });
      28 -      if (bad.includes(url)) return Response.json(BAD_SUBMISSIO
         -NS);                                                           
      28 +      if (bad.includes(url)) return Response.json(BAD_DATA);   
      29        return new Response(Bun.file(`${fixtures}/${file}`));
      30      },
      31      now: () => now,

⏺ Update(src/app.test.ts)
  ⎿  Added 15 lines
      193      });
      194    });
      195  
      196 +  test("502 when the SEC sends a ticker list in an unexpected 
          +shape, and the next request tries again", async () => {       
      197 +    const bad = [TICKERS_URL];                                
      198 +    const get = setup({ bad });                               
      199 +    const response = await get("/companies/AAPL/filings");    
      200 +                                                              
      201 +    expect(response.status).toBe(502);                        
      202 +    expect(await response.json()).toEqual({                   
      203 +      code: "UPSTREAM_UNAVAILABLE",                           
      204 +      message: expect.stringContaining("unexpected ticker list
          +"),                                                           
      205 +    });                                                       
      206 +                                                              
      207 +    bad.length = 0;                                           
      208 +    expect((await get("/companies/AAPL/filings")).status).toBe
          +(200);                                                        
      209 +  });                                                         
      210 +                                                              
      211    test.each(["down", "bad"] as const)("a failed SEC request (%
           s) doesn't break the next one", async (failure) => {
      212      const failing = [submissionsUrl("0000320193")];
      213      const get = setup({ [failure]: failing });

⏺ Update(src/app.test.ts)
  ⎿  Added 12 lines
      297      expect((await response.json()).code).toBe("UPSTREAM_UNAVAI
           LABLE");
      298    });
      299  
      300 +  test("502 when the SEC sends a ticker list in an unexpected 
          +shape, and the next request tries again", async () => {       
      301 +    const bad = [TICKERS_URL];                                
      302 +    const get = setup({ bad });                               
      303 +    const response = await get("/filings/summary?tickers=AAPL"
          +);                                                            
      304 +                                                              
      305 +    expect(response.status).toBe(502);                        
      306 +    expect((await response.json()).code).toBe("UPSTREAM_UNAVAI
          +LABLE");                                                      
      307 +                                                              
      308 +    bad.length = 0;                                           
      309 +    expect((await get("/filings/summary?tickers=AAPL")).status
          +).toBe(200);                                                  
      310 +  });                                                         
      311 +                                                              
      312    test("bad SEC data for one ticker goes to errors, the others
            still return", async () => {
      313      const get = setup({ bad: [submissionsUrl("0001639920")] })
           ;
      314      const response = await get("/filings/summary?tickers=AAPL,
           SPOT");

  Ran 1 shell command (ctrl+o to expand)

⏺ The new tests fail for the right reasons: today a bad ticker list gives a 500,
  and checkTickers doesn't exist yet. Now the code:

⏺ Update(src/tickers.ts)
  ⎿  Added 28 lines, removed 1 line
       5  // company_tickers.json is an object keyed by "0", "1", ...
       6  type TickerList = Record<string, { cik_str: number; ticker: str
          ing; title: string }>;
       7  
       8 +function badData(reason: string): AppError {                   
       9 +  return new AppError("UPSTREAM_UNAVAILABLE", `The SEC returned
         + an unexpected ticker list: ${reason}`);                       
      10 +}                                                              
      11 +                                                               
      12 +// Checks the parts of company_tickers.json that we read, so ba
         +d data gives a 502 instead of a crash                          
      13 +export function checkTickers(data: unknown): asserts data is Ti
         +ckerList {                                                     
      14 +  if (typeof data !== "object" || data === null || Array.isArra
         +y(data)) throw badData("it is not an object");                 
      15 +                                                               
      16 +  const entries = Object.values(data);                         
      17 +  if (entries.length === 0) throw badData("it is empty");      
      18 +                                                               
      19 +  for (const entry of entries) {                               
      20 +    if (                                                       
      21 +      typeof entry?.cik_str !== "number" ||                    
      22 +      typeof entry?.ticker !== "string" ||                     
      23 +      typeof entry?.title !== "string"                         
      24 +    ) {                                                        
      25 +      throw badData("an entry is missing cik_str, ticker or tit
         +le");                                                          
      26 +    }                                                          
      27 +  }                                                            
      28 +}                                                              
      29 +                                                               
      30 +// Always load the ticker list through here, so it is checked b
         +efore it is cached                                             
      31 +export async function loadTickers(secFetch: SecFetch): Promise<
         +TickerList> {                                                  
      32 +  return (await secFetch(TICKERS_URL, checkTickers)) as TickerL
         +ist;                                                           
      33 +}                                                              
      34 +                                                               
      35  // Case doesn't matter, and BRK.B is the same as BRK-B
      36  export function normalize(ticker: string): string {
      37    return ticker.trim().toUpperCase().replaceAll(".", "-");
      38  }
      39  
      40  export async function resolveTicker(input: string, secFetch: Se
          cFetch): Promise<Static<typeof Company>> {
      14 -  const tickers = (await secFetch(TICKERS_URL)) as TickerList; 
      41 +  const tickers = await loadTickers(secFetch);                 
      42    const wanted = normalize(input);
      43    const entry = Object.values(tickers).find((e) => normalize(e.
          ticker) === wanted);
      44  

⏺ Update(src/app.ts)
  ⎿  Added 1 line, removed 1 line
      69          }
      70  
      71          // If the ticker list can't be loaded, the whole reques
          t fails with 502
      72 -        await secFetch(TICKERS_URL);                           
      72 +        await loadTickers(secFetch);                           
      73  
      74          const window = summaryWindow(now());
      75          const outcomes = await Promise.all(
⏺ Update(src/app.ts)
  ⎿  Added 2 lines, removed 2 lines
       2  import { Elysia, t, ValidationError } from "elysia";
       3  import { checkSubmissions, coverage, filterByForm, parseList, s
          ortFilings, toFiling, toFilings, type Submissions } from "./fil
          ings";
       4  import { ApiError, FilingsPage, SummaryResponse } from "./schem
          as";
       5 -import { AppError, submissionsUrl, TICKERS_URL, type SecFetch }
         - from "./sec";                                                 
       5 +import { AppError, submissionsUrl, type SecFetch } from "./sec"
         +;                                                              
       6  import { summarize, summaryWindow } from "./summary";
       7 -import { normalize, resolveTicker } from "./tickers";          
       7 +import { loadTickers, normalize, resolveTicker } from "./ticker
         +s";                                                            
       8  
       9  // The tickers list after clean-up, used to return a normal 422
           when there are too few or too many
      10  const TickerList = t.Object({ tickers: t.Array(t.String(), { mi
          nItems: 1, maxItems: 20 }) });

  Ran 1 shell command (ctrl+o to expand)

⏺ A ticker list with the wrong shape now returns a 502 instead of a 500, and the
  check runs before caching, so bad data isn't kept. All 120 tests pass and the
  type check is clean:

   120 pass
   0 fail
   243 expect() calls
  Ran 120 tests across 5 files. [73.00ms]
  --- tsc
  tsc exit: 0

  What changed
  - The check: checkTickers in src/tickers.ts throws
    AppError("UPSTREAM_UNAVAILABLE", "The SEC returned an unexpected ticker 
    list: …") when:
    - the data isn't an object (including null, a string or an array);
    - the list is empty;
    - any entry is missing a numeric cik_str, a string ticker or a string title.
  - loadTickers(secFetch): a new helper in the same file that calls
    secFetch(TICKERS_URL, checkTickers). Both places that load the list use it:
    resolveTicker and the summary's up-front load in app.ts. So neither can skip
    the check.
  - Endpoints: the filings endpoint returns 502. The summary also returns 502
    for the whole request, as the spec says for a ticker list that can't be
    loaded.

  I treat an empty list as bad data. Otherwise an empty {} from the SEC would
  make every ticker return 404 UNKNOWN_TICKER, which would be misleading. Tell
  me if you'd rather allow it.

  New tests
  - tickers.test.ts:
    - resolveTicker passes checkTickers to secFetch.
    - The fixture passes the check.
    - Eight bad shapes are rejected: null, a string, an array, {}, an entry that
      isn't an object, a missing ticker, a missing title, and a cik_str that
      isn't a number.
  - app.test.ts: on both endpoints, a bad ticker list gives a 502, and the next
    request works once the SEC is fixed, which shows it wasn't cached.

  Before the fix, the two endpoint tests got a 500 and the tickers.test.ts file
  couldn't load because checkTickers didn't exist yet.

  In app.test.ts I renamed BAD_SUBMISSIONS to BAD_DATA, because the same object
  is now the wrong shape for both the ticker list and company filings.

✻ Sautéed for 49s · done 11:13 AM

❯ Write a short README.md at the repo root: what this is, how to run it, how to 
  run the tests and so on                                                       

  Ran 3 shell commands (ctrl+o to expand)

⏺ I checked the server's startup and README details, and the README is an
  outdated bun init template that I'll replace with accurate setup steps,
  including how to create the gitignored .env.

⏺ Write(~/Developer/playground/edgar-api-ui/README.md)
  ⎿  Added 45 lines, removed 7 lines
       1  # edgar-api-ui
       2  
       3 -To install dependencies:                                       
       3 +A small API over the SEC's EDGAR data: list a company's filings
         +, or summarize recent filings for several companies at once.   
       4  
       5 +- `apps/api`: the API, built with Bun and Elysia 1.4           
       6 +- `apps/web`: a React frontend (coming later)                  
       7 +                                                               
       8 +## Endpoints                                                   
       9 +                                                               
      10 +- `GET /companies/:ticker/filings`: one company's filings, filt
         +ered by form, sorted by date and paged                         
      11 +- `GET /filings/summary?tickers=AAPL,SPOT`: filing counts by fo
         +rm for the last 12 months, plus the latest annual report for ea
         +ch ticker                                                      
      12 +                                                               
      13  ```bash
      14 +curl "localhost:3000/companies/AAPL/filings?form=10-K,8-K&pageS
         +ize=5"                                                         
      15 +curl "localhost:3000/filings/summary?tickers=AAPL,SPOT"        
      16 +```                                                            
      17 +                                                               
      18 +Interactive docs are at http://localhost:3000/openapi.         
      19 +                                                               
      20 +[SPEC.md](SPEC.md) has the full rules: params, response shapes,
         + errors and caching. [GLOSSARY.md](GLOSSARY.md) explains the SE
         +C terms.                                                       
      21 +                                                               
      22 +## Setup                                                       
      23 +                                                               
      24 +You need [Bun](https://bun.com).                               
      25 +                                                               
      26 +```bash                                                        
      27  bun install
      28  ```
      29  
       9 -To run:                                                        
      30 +The SEC asks every client to send a User-Agent with a name and 
         +email. Create `apps/api/.env`:                                 
      31  
      32  ```bash
      12 -bun run index.ts                                               
      33 +SEC_USER_AGENT="Jane Doe jane@example.com"                     
      34  ```
      35  
      15 -To type check:                                                 
      36 +The server won't start without it. Bun loads `.env` automatical
         +ly.                                                            
      37  
      38 +## Run                                                         
      39 +                                                               
      40  ```bash
      18 -bun check                                                      
      41 +cd apps/api                                                    
      42 +bun run dev                                                    
      43  ```
      44  
      21 -Run `bun fmt` to format the code.                              
      45 +The API runs at http://localhost:3000 and restarts when files c
         +hange.                                                         
      46  
      23 -This project was created using `bun init` in bun v1.4.4. [Bun](
         -https://bun.com) is a fast all-in-one JavaScript runtime.      
      47 +## Test                                                        
      48 +                                                               
      49 +```bash                                                        
      50 +cd apps/api                                                    
      51 +bun test                                                       
      52 +bunx tsc --noEmit                                              
      53 +```                                                            
      54 +                                                               
      55 +The tests never call the SEC. They use saved SEC responses in [
         +fixtures/](fixtures/README.md) and a fixed "today" (2026-11-16)
         +, so results don't change over time.                           
      56 +                                                               
      57 +## Notes                                                       
      58 +                                                               
      59 +- Data comes from `filings.recent` only, so very old filings ma
         +y be missing. The `coverage` field in the response says which d
         +ates are included.                                             
      60 +- Responses are cached in memory: 24 hours for the ticker list,
         + 10 minutes for company filings. Requests to the SEC are limite
         +d to 10 per second.                                            
      61 +- If the SEC is down or sends data in an unexpected shape, the 
         +API returns 502.                                               

⏺ I replaced README.md at the repo root. The old one was the bun init template,
  and its commands didn't work with this project (bun run index.ts).

  The new README covers:
  - what the project is and the two endpoints, with example curl calls;
  - the /openapi docs page;
  - links to SPEC.md, GLOSSARY.md and the fixtures README;
  - setup: bun install, and creating apps/api/.env with SEC_USER_AGENT, since
    .env is gitignored;
  - how to run (bun run dev in apps/api) and how to test (bun test and bunx tsc 
    --noEmit);
  - short notes on coverage, caching, the rate limit and when you get a 502.

  I checked that the run instructions work: bun run dev starts the server,
  /openapi returns 200, and without SEC_USER_AGENT the server stops with exit
  code 1. I didn't run the two example curl calls, because they would hit the
  real SEC.

  Two things you might want to clean up separately:
  - The root package.json has "typecheck": "bun check", which also came from the
    template. I documented bunx tsc --noEmit from CLAUDE.md instead and left
    the script alone.
  - apps/api/package.json still has the placeholder "test" script that only
    prints an error, so bun run test fails. bun test works fine.

✻ Crunched for 33s · done 11:16 AM