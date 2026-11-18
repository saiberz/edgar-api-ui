# Notes

How I built this, step by step. ai-log/ has the Claude Code export of each session. Long tool outputs are collapsed in the exports, but every prompt and answer is there.

### 1. Project setup and test data

I set up the project by hand and saved real SEC responses for Apple, Spotify and JPMorgan in fixtures/.

### 2. Glossary

Claude drafted GLOSSARY.md from my list of unknown terms. I checked it and rewrote it in my own words, and later fixed two mistakes the reviews found.

### 3. Spec and review

I wrote SPEC.md and schemas.ts, and Claude reviewed them. I fixed the real mistakes (url was only a path, the 12-month window was 366 days) and kept old and new form names separate.

### 4. SEC client, cache and data transform

Claude asked which CIK format to use, and I chose the 10-digit one after checking the SEC data. It also found that TypeScript 7 rejects the template's moduleResolution setting and told me the fix. It didn't change my config. I applied the fix myself.

### 5. Endpoints

I made sure coverage uses all filings, not just the filtered ones. Then I tested both endpoints by hand against the real SEC.

### 6. Errors and README

Claude compared the code with the spec and listed six edge cases. I fixed one: bad data from the SEC now gives a 502 instead of a 500, for both the company filings and the ticker list. The check runs before caching, so one bad response isn't kept. Then it wrote the README, and I checked it works in a clean copy.

### 7. Manual changes

I added some manual tests and checked for typos on this file

### 8. Frontend

I created the React app by hand with Vite. Claude built the two pages, using Eden Treaty for the API types and the Vite proxy so the API needs no CORS.
Bun installed two copies of Elysia, so Eden rejected the API's types. I chose a small tsconfig fix in apps/web instead of changing package versions, because it doesn't touch the API.
I tested it in the browser with AAPL, SPOT, JPM and NOPE, on both pages.
After testing I found a blank page after every search, because Eden turned dates into Date objects. I turned that off with `parseDate: false` and fixed the README setup steps.
