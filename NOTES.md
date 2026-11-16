# Notes

How I built this, step by step. The full input and output of every Claude session is in ai-log/.

### 1. Project setup and test data

I created the project by with bun create elysia. I saved real responses for in fixtures/, and cut company_tickers.json down to the 6 tickers the tests will use

### 2. Glossary

I listed the terms I didn't know after reading the SEC docs and the responses. Claude drafted GLOSSARY.md, and I checked them against the SEC pages. I also asked it to list anything odd in the data, which I saved in fixtures/README.md.
