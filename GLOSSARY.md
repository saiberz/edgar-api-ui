# Glossary

Terms used in the SEC EDGAR data under `fixtures/`. Paths use `recent.X` as shorthand for `filings.recent.X`.
Entries marked **(?)** are not confirmed by the fixtures themselves.

| Term | Definition | Where it appears |
| --- | --- | --- |
| **CIK** | Central Index Key: the number the SEC assigns to every filer (company or person), and the key used to fetch a company's submissions. | `cik` in `AAPL.json` etc. as a 10-digit zero-padded **string** (`"0000320193"`); `cik_str` in `company_tickers.json` as an unpadded **number** (`320193`); also the file name `CIK0000320193-submissions-001.json` in `filings.files[].name`. |
| **Accession number** | The unique ID of one filing, formatted `XXXXXXXXXX-YY-NNNNNN`, where the first 10 digits are the CIK of whoever submitted it (often a filing agent, not the company) and `YY` is the year. | `recent.accessionNumber[i]`, e.g. `"0000320193-26-000026"` (Apple's own 10-K) vs `"0001140361-26-042798"` (Apple 8-K submitted by another CIK). |
| **filingDate** | The official date the SEC considers the filing filed (`YYYY-MM-DD`). | `recent.filingDate[i]`, e.g. `"2026-11-03"`. |
| **reportDate** | The period or event date the filing is about (e.g. fiscal period end for a 10-K, event date for an 8-K/Form 4); empty string when not applicable. | `recent.reportDate[i]`, e.g. 10-K filed `2026-11-03` has reportDate `"2026-09-26"`. |
| **acceptanceDateTime** | The exact timestamp EDGAR accepted the submission; can fall on a different calendar day than `filingDate` (late-day submissions get the next business day's filingDate). | `recent.acceptanceDateTime[i]`, e.g. JPM FWP `"2026-11-14T02:03:23.000Z"` with filingDate `"2026-11-16"`. The `Z` suffix and the hour distribution are consistent with UTC (?). |
| **primaryDocument** | File name (relative to the filing's folder) of the main document in the filing; XML forms are prefixed with an XSL stylesheet folder used to render them. | `recent.primaryDocument[i]`, e.g. `"aapl-20260926.htm"`, `"xslF345X06/form4.xml"`. |
| **primaryDocDescription** | Free-text description of the primary document as provided by the filer; often empty or inconsistent. | `recent.primaryDocDescription[i]`, e.g. `"10-K"`, `"FORM 8-K"`, `"PRELIMINARY PRICING SUPPLEMENT"`, `""`. |
| **/A suffix** | Marks an amendment to a previously filed form of the same type. | In `recent.form[i]`, e.g. `"8-K/A"`, `"SC 13G/A"`, `"F-1/A"`, `"13F-HR/A"`. The fixtures do not link an amendment to the filing it amends (?). |
| **20-F** | Annual report filed by a foreign private issuer (the foreign counterpart of a 10-K). | `recent.form[i] == "20-F"` in `SPOT.json` only (8 rows, 2019-02-12 → 2026-02-10). |
| **6-K** | Report a foreign private issuer furnishes for material information it publishes at home (the rough counterpart of 8-K/10-Q). | `recent.form[i] == "6-K"` in `SPOT.json` only (97 rows). |
| **40-F** | Annual report form for certain Canadian issuers under the US–Canada multijurisdictional system (MJDS). | **Not present in any fixture.** |
| **Foreign private issuer (FPI)** | A non-US company that qualifies for the SEC's foreign-issuer rules (e.g. files 20-F/6-K instead of 10-K/10-Q/8-K). | **No explicit field.** Only indirect signals in `SPOT.json`: `stateOfIncorporation: "N4"` / `"Luxembourg"`, `addresses.*.isForeignLocation: 1`, `ein: "000000000"`, `entityType: "other"`, and 20-F/6-K forms. FPI status can't be read from the data directly (?). |
| **filings.recent** | The latest batch of filings as a column-oriented object: each key is an array, and index `i` across all arrays is one filing, newest first. | `filings.recent` in each company file (AAPL 1002 rows, SPOT 390, JPM 26,453). |
| **filings.file** | `filings.files` (plural in the JSON): list of extra JSON files holding older filings that don't fit in `recent`, each with `name`, `filingCount`, `filingFrom`, `filingTo`. | `filings.files`: AAPL 1 file, JPM 72 files, SPOT `[]`. |
