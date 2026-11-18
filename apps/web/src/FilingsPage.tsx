import { useState, type SubmitEvent } from 'react'
import { api, errorMessage, type FilingsResult } from './api.ts'

type Sort = 'asc' | 'desc'

type Search = {
  ticker: string
  form: string
  sort: Sort
  pageSize: number
}

const PAGE_SIZES = [10, 25, 50, 100]

function FilingsPage() {
  const [ticker, setTicker] = useState('AAPL')
  const [form, setForm] = useState('')
  const [sort, setSort] = useState<Sort>('desc')
  const [pageSize, setPageSize] = useState(25)

  // The last submitted search, so Prev/Next keep it even if the inputs change
  const [search, setSearch] = useState<Search | null>(null)
  const [result, setResult] = useState<FilingsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(nextSearch: Search, page: number) {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await api.companies({ ticker: nextSearch.ticker }).filings.get({
        query: {
          form: nextSearch.form || undefined,
          sort: nextSearch.sort,
          page,
          pageSize: nextSearch.pageSize,
        },
      })
      if (error) {
        setResult(null)
        setError(errorMessage(error))
      } else {
        setSearch(nextSearch)
        setResult(data)
      }
    } catch {
      setResult(null)
      setError('Could not reach the API')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    load({ ticker: ticker.trim(), form: form.trim(), sort, pageSize }, 1)
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label>
          Ticker
          <input value={ticker} onChange={(event) => setTicker(event.target.value)} required />
        </label>
        <label>
          Forms
          <input value={form} onChange={(event) => setForm(event.target.value)} placeholder="10-K,8-K" />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        <label>
          Per page
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && search && (
        <>
          <h2>
            {result.company.name} ({result.company.ticker})
          </h2>
          <p>
            CIK {result.company.cik} · {result.total} filings
          </p>
          {!result.coverage.complete && (
            <p className="note">Older filings are not loaded. Data starts on {result.coverage.from}.</p>
          )}

          <table>
            <thead>
              <tr>
                <th>Filing date</th>
                <th>Form</th>
                <th>Report date</th>
                <th>Description</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((filing) => (
                <tr key={filing.accessionNumber}>
                  <td>{filing.filingDate}</td>
                  <td>{filing.form}</td>
                  <td>{filing.reportDate ?? '—'}</td>
                  <td>{filing.description ?? '—'}</td>
                  <td>
                    <a href={filing.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button type="button" disabled={loading || result.page <= 1} onClick={() => load(search, result.page - 1)}>
              Prev
            </button>
            <span>
              Page {result.page} of {Math.max(result.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={loading || result.page >= result.totalPages}
              onClick={() => load(search, result.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export default FilingsPage
