import React, { useState } from 'react'
import Overview from './views/Overview'
import ConversationsView from './views/ConversationsView'
import SessionsView from './views/SessionsView'
import EfficiencyView from './views/EfficiencyView'

type Tab = 'Overview' | 'Conversations' | 'Sessions' | 'Efficiency'
const TABS: Tab[] = ['Overview', 'Conversations', 'Sessions', 'Efficiency']

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  return (
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

          <nav style={{ display: 'flex', gap: 4 }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#21262d' : 'transparent',
                  border: activeTab === tab ? '1px solid #30363d' : '1px solid transparent',
                  borderRadius: 6,
                  color: activeTab === tab ? '#e6edf3' : '#8b949e',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 600 : 400,
                  padding: '5px 12px',
                  transition: 'all 0.15s',
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
  )
}
