# Test data

Real answers from the SEC endpoint.

| File                           | Origin                                                     |
| ------------------------------ | ---------------------------------------------------------- |
| company_tickers.json           | sec.gov/files/company_tickers.json, trimmered to 6 entries |
| AAPL.json, SPOT.json, JPM.json | data.sec.gov/submissions/CIK##########.json                |

- AAPL: a normal US company.
- SPOT: not a US company
- JPM: big recent list

## Details about test data

**Shape and identifiers**

- **`recent` is stored as columns, not rows.** Each field is a separate parallel array, so you rebuild a filing from index `i` across all of them, e.g. `recent.form[0]` + `recent.accessionNumber[0]`.
- **The CIK has two formats.** It's a zero-padded string in submissions and a plain number in tickers, e.g. `"0000320193"` vs `cik_str: 320193`.
- **`company_tickers.json` is an object with numeric-string keys, not an array**, e.g. `{"0": {...}, "1": {...}}`.
- **Ticker spellings vary.** e.g. `"BRK-B"`, and JPM's `"JPM-PC"`, `"JPM-PD"`.
- **One company can have several tickers.** `exchanges` is a parallel array that repeats values, e.g. JPM has 9 tickers and 9 × `"NYSE"`.
- **Name casing differs between companies.** e.g. `"Apple Inc."` vs `"JPMORGAN CHASE & CO"`.

**Paging and volume**

- **`recent` size varies a lot.** AAPL has 1002 rows, SPOT 390, JPM 26,453 (4.7 MB), and JPM's rows span only one year (2025-11-14 → 2026-11-16).
- **Older history lives in `filings.files`.** It has to be fetched separately and may be empty, e.g. SPOT `files: []`, JPM 72 files.

**Empty values**

- **Empty can be `""` or `null`, depending on the field.** e.g. `lei: null` vs `description: ""`, `website: ""`, `flags: ""`.
- **`reportDate` is often `""`.** e.g. empty in 26,284 of JPM's 26,453 rows; always empty for 424B2/FWP/144.
- **`act`, `fileNumber` and `filmNumber` are often `""`.** e.g. AAPL Form 4: `act: ""`, `fileNumber: ""`, `filmNumber: ""`.
- **`items` is mostly empty, and not always 8-K item codes.** SPOT has `"POS AM,0001193125-18-197836,2018-06-21"` (EFFECT), `"06b"` (D), `"20180326,20180326"` (CT ORDER). JPM has `",,"` (EFFECT).
- **`isXBRLNumeric` can be `0`, `1` or `null`.** e.g. null in 941 of AAPL's 1002 rows.
- **Booleans come as `0`/`1` integers.** e.g. `isXBRL: 1`, `insiderTransactionForOwnerExists: 0`.
- **`isForeignLocation` disagrees between the two addresses.** e.g. AAPL `mailing.isForeignLocation: 0` vs `business.isForeignLocation: null`.
- **Placeholder EIN.** e.g. SPOT `ein: "000000000"`.
- **Foreign addresses have `null` state/zip.** e.g. SPOT `stateOrCountry: null`, `zipCode: null`, `countryCode: "N4"`.

**Same thing written differently**

- **Old and new form names both appear.** e.g. `"SC 13G"` / `"SC 13G/A"` and `"SCHEDULE 13G"` / `"SCHEDULE 13G/A"`, both in AAPL and SPOT.
- **`primaryDocDescription` is free text with no consistency.** e.g. AAPL 8-K: `"8-K"` ×78, `"FORM 8-K"` ×23, `""` ×1. JPM 424B2 has `"PRELIMINARY PRICING SUPPLEMEN"` (truncated) and `"AMENDED & RESTATED"` vs `"AMENDED AND RESTATED"`.
- **The "Description" fields sometimes just repeat the code.** e.g. AAPL `stateOfIncorporationDescription: "CA"`, but SPOT has `"N4"` → `"Luxembourg"`.
- **Phone numbers have no fixed format.** e.g. `"(408) 996-1010"`, `"2122706000"`, `"1-917-748-6610"`.
- **`fiscalYearEnd` is an `MMDD` string, not a date.** e.g. AAPL `"0926"`.
- **`formerNames` timestamps carry different offsets.** e.g. `T05:00:00.000Z`, `T04:00:00.000Z`, `T00:00:00.000Z`.

**Values that aren't unique**

- **`accessionNumber` is the only unique filing key.** It was unique in all three files.
- **`acceptanceDateTime` repeats.** e.g. JPM `2026-05-04T12:17:13.000Z` ×9 (several SCHEDULE 13G/A).
- **`primaryDocument` repeats across filings.** e.g. JPM `form424b2.htm` ×9372, SPOT `filename1.htm` ×7. Only accession number + document identifies a file.
- **`fileNumber` is shared by many filings.** It's a registration number, not a filing ID, e.g. JPM `333-293684` ×14,678.
- **The accession prefix is the submitter's CIK, not always the company's.** e.g. only 161 of JPM's 26,453 accession numbers start with `0000019617`.

**Dates**

- **`filingDate` can be days after the acceptance date.** e.g. JPM `filingDate: "2026-11-16"`, accepted `2026-11-14T02:03:23Z`.
- **`filingDate` can also be earlier than the acceptance date (in UTC).** e.g. AAPL Form 4 `filingDate: "2023-10-03"`, accepted `2023-10-04T01:09:17Z`.
- **`reportDate` can be after `filingDate`.** e.g. AAPL DEF 14A `reportDate: "2026-02-24"`, `filingDate: "2026-01-08"`. That date may be the meeting date (?). TODO: Confirm this with more data
- **`formerNames` includes the current name, and ranges overlap.** e.g. JPM `"JPMORGAN CHASE & CO"` runs 2009-02-02 → 2026-11-16, overlapping `"J P MORGAN CHASE & CO"` 2001 → 2011.
- **`formerNames` can have a zero-length range.** e.g. AAPL `"APPLE COMPUTER INC/ FA"` from = to = 1997-07-28.

**Document types and links**

- **`primaryDocument` isn't always HTML.** e.g. `.xml` (with an `xsl…/` prefix), `.txt`, `.pdf`, and `.paper` (`"9999999997-17-000002.paper"`, `"AUTO-GENERATED PAPER DOCUMENT"`).
- **Size varies widely.** e.g. `size` ranges from 1,347 to 74,694,140 bytes.

**Foreign issuer data**

- **A company's forms can change over time.** e.g. SPOT's last 20-F is 2026-02-10, and it has Forms 3/4 only from 2026-03-18 on. Whether this means it lost foreign private issuer status is not confirmed (?). # TODO Verify this with more data
- **`entityType` differs.** e.g. `"operating"` (AAPL, JPM) vs `"other"` (SPOT).
