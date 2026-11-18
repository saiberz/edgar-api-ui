import { useState, type SubmitEvent } from 'react'
import { api, errorMessage, type SummaryResult } from './api.ts'

// "8-K: 12, 4: 9, 10-K: 1", most frequent form first
function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([form, count]) => `${form}: ${count}`)
    .join(', ')
}

function SummaryPage() {
  const [tickers, setTickers] = useState('AAPL,SPOT')
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await api.filings.summary.get({ query: { tickers } })
      if (error) {
        setResult(null)
        setError(errorMessage(error))
      } else {
        setResult(data)
      }
    } catch {
      setResult(null)
      setError('Could not reach the API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <label>
          Tickers
          <input value={tickers} onChange={(event) => setTickers(event.target.value)} placeholder="AAPL,SPOT" />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Summarize'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <p>
            Filings from {result.window.from} to {result.window.to}
          </p>

          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th>Latest annual report</th>
                <th>Latest 10-K</th>
                <th>Filings by form</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((company) => (
                <tr key={company.ticker}>
                  <td>{company.ticker}</td>
                  <td>{company.name}</td>
                  <td>
                    {company.latestAnnualReport ? (
                      <a href={company.latestAnnualReport.url} target="_blank" rel="noreferrer">
                        {company.latestAnnualReport.form} {company.latestAnnualReport.filingDate}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {company.latest10K ? (
                      <a href={company.latest10K.url} target="_blank" rel="noreferrer">
                        {company.latest10K.filingDate}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{formatCounts(company.countsByForm) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.errors.length > 0 && (
            <ul className="error">
              {result.errors.map((failure) => (
                <li key={failure.ticker}>
                  {failure.ticker}: {failure.message} ({failure.code})
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

export default SummaryPage
