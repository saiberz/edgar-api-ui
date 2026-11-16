# Notes

How I built this, step by step. The full input and output of every Claude session is in ai-log/.

### 1. Project setup and test data

I created the project by with bun create elysia. I saved real responses for in fixtures/, and cut company_tickers.json down to the 6 tickers the tests will use

### 2. Glossary

I listed the terms I didn't know after reading the SEC docs and the responses. Claude drafted GLOSSARY.md, and I checked them against the SEC pages. I also asked it to list anything odd in the data, which I saved in fixtures/README.md.

### 3. Spec and review

I wrote SPEC.md and schemas.ts, and Claude reviewed them. I fixed the real mistakes (url was only a path, the 12-month window was 366 days) and kept old and new form names separate.

### 4. SEC client, cache and data transform

Claude asked which CIK format to use, and I chose the 10-digit one after checking the SEC data. I fixed a TypeScript 7 config issue myself.

### 5. Endpoints

I made sure coverage uses all filings, not just the filtered ones. Then I tested both endpoints by hand against the real SEC.
