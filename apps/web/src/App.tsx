import { useState } from 'react'
import FilingsPage from './FilingsPage.tsx'
import SummaryPage from './SummaryPage.tsx'

type Tab = 'filings' | 'summary'

function App() {
  const [tab, setTab] = useState<Tab>('filings')

  return (
    <main>
      <h1>EDGAR filings</h1>
      <nav className="tabs">
        <button type="button" aria-pressed={tab === 'filings'} onClick={() => setTab('filings')}>
          Filings
        </button>
        <button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>
          Summary
        </button>
      </nav>
      <div hidden={tab !== 'filings'}>
        <FilingsPage />
      </div>
      <div hidden={tab !== 'summary'}>
        <SummaryPage />
      </div>
    </main>
  )
}

export default App
