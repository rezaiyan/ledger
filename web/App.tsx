import React, { useState, useMemo } from 'react'
import Overview from './views/Overview'
import ConversationsView from './views/ConversationsView'
import SessionsView from './views/SessionsView'
import EfficiencyView from './views/EfficiencyView'
import { CurrencyContext } from './hooks/useCurrency'
import { fmtCost, fmtCostAxis } from './utils'
import { useConfig } from './hooks/useData'

type Tab = 'Overview' | 'Conversations' | 'Sessions' | 'Efficiency'
const TABS: Tab[] = ['Overview', 'Conversations', 'Sessions', 'Efficiency']

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const { data: config } = useConfig()
  const currency = config?.currency ?? 'EUR'

  const currencyCtx = useMemo(() => ({
    currency,
    fmt: (v: number) => fmtCost(v, currency),
    fmtAxis: (v: number) => fmtCostAxis(v, currency),
  }), [currency])

  return (
    <CurrencyContext.Provider value={currencyCtx}>
      <div style={{
        minHeight: '100vh',
        background: '#0d1117',
        color: '#c9d1d9',
      }}>
        {/* Header */}
        <header style={{
          borderBottom: '1px solid #21262d',
          background: '#161b22',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <div style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            height: 56,
            gap: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #3fb950 0%, #1a7f37 100%)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: '#0d1117',
              }}>L</div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#e6edf3' }}>Ledger</span>
              <span style={{ fontSize: 11, color: '#6e7681', marginLeft: 4 }}>cost intelligence</span>
            </div>

            <nav style={{ display: 'flex', height: '100%', alignItems: 'stretch' }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab ? '#3fb950' : 'transparent'}`,
                    color: activeTab === tab ? '#e6edf3' : '#6e7681',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: activeTab === tab ? 600 : 400,
                    padding: '0 16px',
                    transition: 'color 0.15s, border-color 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
          {activeTab === 'Overview' && <Overview />}
          {activeTab === 'Conversations' && <ConversationsView />}
          {activeTab === 'Sessions' && <SessionsView />}
          {activeTab === 'Efficiency' && <EfficiencyView />}
        </main>
      </div>
    </CurrencyContext.Provider>
  )
}
