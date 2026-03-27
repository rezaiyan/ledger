import React, { useState, useMemo } from 'react'
import { useConversations } from '../hooks/useData'
import EmptyState from '../components/EmptyState'
import Badge from '../components/Badge'
import { fmtCost, fmtTokens, fmtDuration, fmtDateShort, fmtPct, costColor, shortModel } from '../utils'
import type { ParsedConversation } from '../../src/types'

type SortKey = keyof Pick<
  ParsedConversation,
  'startTime' | 'projectSlug' | 'durationMin' | 'totalCost' | 'inputTokens' | 'outputTokens' | 'cacheHitRate' | 'model' | 'webSearches'
>

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
      <div style={{
        width: 28, height: 28,
        border: '3px solid #30363d',
        borderTopColor: '#3fb950',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function SortArrow({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ color: '#30363d', marginLeft: 4 }}>↕</span>
  return <span style={{ color: '#3fb950', marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

function DetailPanel({ conv }: { conv: ParsedConversation }) {
  return (
    <tr>
      <td colSpan={9} style={{ background: '#0d1117', borderBottom: '1px solid #21262d', padding: 0 }}>
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Session ID</div>
            <div style={{ fontSize: 12, color: '#8b949e', fontFamily: 'monospace', wordBreak: 'break-all' }}>{conv.sessionId}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Working Dir</div>
            <div style={{ fontSize: 12, color: '#8b949e', wordBreak: 'break-all' }}>{conv.cwd || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Messages</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{conv.messages}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Input Tokens</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{fmtTokens(conv.inputTokens)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Output Tokens</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{fmtTokens(conv.outputTokens)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cache Writes</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{fmtTokens(conv.cacheCreationTokens)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cache Reads</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#3fb950' }}>{fmtTokens(conv.cacheReadTokens)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Web Searches</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{conv.webSearches}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Subagent</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: conv.isSubagent ? '#d29922' : '#8b949e' }}>
              {conv.isSubagent ? 'Yes' : 'No'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Cost</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: costColor(conv.totalCost) }}>{fmtCost(conv.totalCost)}</div>
          </div>
        </div>
      </td>
    </tr>
  )
}

const ALL_MODELS = '__all__'

export default function ConversationsView() {
  const { data: conversations, loading, error, refetch } = useConversations()

  const [sortKey, setSortKey] = useState<SortKey>('startTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [filterModel, setFilterModel] = useState(ALL_MODELS)
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [filterMinCost, setFilterMinCost] = useState('')

  const models = useMemo(() => {
    if (!conversations) return []
    const s = new Set(conversations.map(c => c.model))
    return Array.from(s).sort()
  }, [conversations])

  const filtered = useMemo(() => {
    if (!conversations) return []
    return conversations.filter(c => {
      if (filterModel !== ALL_MODELS && c.model !== filterModel) return false
      if (filterDateStart && new Date(c.startTime) < new Date(filterDateStart)) return false
      if (filterDateEnd && new Date(c.startTime) > new Date(filterDateEnd + 'T23:59:59')) return false
      if (filterMinCost && c.totalCost < parseFloat(filterMinCost)) return false
      return true
    })
  }, [conversations, filterModel, filterDateStart, filterDateEnd, filterMinCost])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]
      if (av instanceof Date) av = av.getTime() as unknown as typeof av
      if (bv instanceof Date) bv = bv.getTime() as unknown as typeof bv
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const cols: { label: string; key: SortKey; align?: 'right' }[] = [
    { label: 'Date', key: 'startTime' },
    { label: 'Project', key: 'projectSlug' },
    { label: 'Duration', key: 'durationMin', align: 'right' },
    { label: 'Cost', key: 'totalCost', align: 'right' },
    { label: 'Tokens In', key: 'inputTokens', align: 'right' },
    { label: 'Tokens Out', key: 'outputTokens', align: 'right' },
    { label: 'Cache%', key: 'cacheHitRate', align: 'right' },
    { label: 'Model', key: 'model' },
    { label: 'Searches', key: 'webSearches', align: 'right' },
  ]

  if (loading) return <Spinner />
  if (error) return (
    <div style={{ background: '#160b0b', border: '1px solid #4a1218', borderRadius: 8, padding: '16px 20px', color: '#ff7b72', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>Failed to load conversations: {error}</span>
      <button onClick={refetch} style={{ background: 'transparent', border: '1px solid #f85149', borderRadius: 6, color: '#ff7b72', cursor: 'pointer', fontSize: 12, padding: '4px 10px' }}>
        Retry
      </button>
    </div>
  )
  if (!conversations?.length) return (
    <EmptyState
      icon="💬"
      title="No conversations found"
      message="Claude conversations will appear here once you start using Claude Code. Make sure the ledger server can find your ~/.claude/projects directory."
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar */}
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: 8,
        padding: '14px 20px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: '#6e7681', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter</span>

        <select
          value={filterModel}
          onChange={e => setFilterModel(e.target.value)}
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 6,
            color: '#c9d1d9',
            fontSize: 13,
            padding: '5px 10px',
            cursor: 'pointer',
          }}
        >
          <option value={ALL_MODELS}>All models</option>
          {models.map(m => <option key={m} value={m}>{shortModel(m)}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#8b949e' }}>From</span>
          <input
            type="date"
            value={filterDateStart}
            onChange={e => setFilterDateStart(e.target.value)}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#c9d1d9',
              fontSize: 13,
              padding: '5px 10px',
            }}
          />
          <span style={{ fontSize: 12, color: '#8b949e' }}>to</span>
          <input
            type="date"
            value={filterDateEnd}
            onChange={e => setFilterDateEnd(e.target.value)}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#c9d1d9',
              fontSize: 13,
              padding: '5px 10px',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#8b949e' }}>Min $</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={filterMinCost}
            onChange={e => setFilterMinCost(e.target.value)}
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#c9d1d9',
              fontSize: 13,
              padding: '5px 10px',
              width: 80,
            }}
          />
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6e7681' }}>
          {sorted.length} of {conversations.length} conversations
        </div>

        {(filterModel !== ALL_MODELS || filterDateStart || filterDateEnd || filterMinCost) && (
          <button
            onClick={() => { setFilterModel(ALL_MODELS); setFilterDateStart(''); setFilterDateEnd(''); setFilterMinCost('') }}
            style={{
              background: 'transparent',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#8b949e',
              fontSize: 12,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21262d' }}>
                {cols.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    style={{
                      padding: '10px 16px',
                      textAlign: col.align === 'right' ? 'right' : 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: sortKey === col.key ? '#3fb950' : '#6e7681',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                    <SortArrow active={sortKey === col.key} dir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((conv, i) => {
                const isSelected = selectedId === conv.sessionId
                return (
                  <React.Fragment key={conv.sessionId}>
                    <tr
                      onClick={() => setSelectedId(isSelected ? null : conv.sessionId)}
                      style={{
                        borderBottom: '1px solid #21262d',
                        cursor: 'pointer',
                        background: isSelected ? '#161b22' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#1c2128' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {fmtDateShort(conv.startTime)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#e6edf3', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.projectSlug || <span style={{ color: '#6e7681' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, textAlign: 'right' }}>
                        {fmtDuration(conv.durationMin)}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: costColor(conv.totalCost) }}>
                        {fmtCost(conv.totalCost)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, textAlign: 'right' }}>
                        {fmtTokens(conv.inputTokens)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, textAlign: 'right' }}>
                        {fmtTokens(conv.outputTokens)}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', color: conv.cacheHitRate > 0.5 ? '#3fb950' : '#8b949e' }}>
                        {fmtPct(conv.cacheHitRate)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Badge label={shortModel(conv.model)} type="model" />
                      </td>
                      <td style={{ padding: '10px 16px', color: conv.webSearches > 0 ? '#d29922' : '#6e7681', fontSize: 13, textAlign: 'right' }}>
                        {conv.webSearches}
                      </td>
                    </tr>
                    {isSelected && <DetailPanel conv={conv} />}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
