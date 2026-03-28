import React, { useState, useMemo } from 'react'
import { useConversations } from '../hooks/useData'
import EmptyState from '../components/EmptyState'
import Badge from '../components/Badge'
import { fmtTokens, fmtDuration, fmtDateShort, fmtPct, costColor, shortModel, fmtProjectSlug, groupConversations } from '../utils'
import { useCurrency } from '../hooks/useCurrency'
import type { ConversationGroup } from '../utils'

type SortKey = keyof Pick<
  ConversationGroup,
  'startTime' | 'projectSlug' | 'title' | 'durationMin' | 'totalCost' | 'inputTokens' | 'outputTokens' | 'cacheHitRate' | 'model' | 'webSearches'
>

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function SubagentRow({ conv, fmt }: { conv: ParsedConversation; fmt: (v: number) => string }) {
  const label = conv.filePath.split('/').pop() ?? conv.filePath
  return (
    <tr style={{ borderBottom: '1px solid #21262d' }}>
      <td style={{ padding: '8px 16px', color: '#8b949e', fontSize: 12, fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </td>
      <td style={{ padding: '8px 16px', color: '#8b949e', fontSize: 12, textAlign: 'right' }}>{fmtDuration(conv.durationMin)}</td>
      <td style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: costColor(conv.totalCost) }}>{fmt(conv.totalCost)}</td>
      <td style={{ padding: '8px 16px', color: '#8b949e', fontSize: 12, textAlign: 'right' }}>{fmtTokens(conv.inputTokens)}</td>
      <td style={{ padding: '8px 16px', color: '#8b949e', fontSize: 12, textAlign: 'right' }}>{fmtTokens(conv.outputTokens)}</td>
      <td style={{ padding: '8px 16px', fontSize: 12, textAlign: 'right', color: conv.cacheHitRate > 0.5 ? '#3fb950' : '#8b949e' }}>{fmtPct(conv.cacheHitRate)}</td>
      <td style={{ padding: '8px 16px', color: '#8b949e', fontSize: 12 }}>{conv.messages} msgs</td>
    </tr>
  )
}

function DetailPanel({ group }: { group: ConversationGroup }) {
  const { fmt } = useCurrency()
  const allEntries = [...(group.parent ? [group.parent] : []), ...group.subagents]
  const hasSubagents = group.subagents.length > 0

  return (
    <tr>
      <td colSpan={10} style={{ background: '#0d1117', borderBottom: '1px solid #21262d', padding: 0 }}>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Aggregated stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Session ID</div>
              <div style={{ fontSize: 12, color: '#8b949e', fontFamily: 'monospace', wordBreak: 'break-all' }}>{group.sessionId}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Working Dir</div>
              <div style={{ fontSize: 12, color: '#8b949e', wordBreak: 'break-all' }}>{group.parent?.cwd || group.subagents[0]?.cwd || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Messages</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{group.messages}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Input Tokens</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{fmtTokens(group.inputTokens)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Output Tokens</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{fmtTokens(group.outputTokens)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cache Writes</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{fmtTokens(group.cacheCreationTokens)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cache Reads</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#3fb950' }}>{fmtTokens(group.cacheReadTokens)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Web Searches</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{group.webSearches}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Cost</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: costColor(group.totalCost) }}>{fmt(group.totalCost)}</div>
            </div>
          </div>

          {/* Subagent breakdown */}
          {hasSubagents && (
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                Agents ({allEntries.length})
              </div>
              <div style={{ border: '1px solid #21262d', borderRadius: 6, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #21262d', background: '#161b22' }}>
                      {['File', 'Duration', 'Cost', 'Tokens In', 'Tokens Out', 'Cache%', 'Messages'].map(h => (
                        <th key={h} style={{ padding: '6px 16px', fontSize: 10, fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: h === 'File' ? 'left' : 'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.parent && (
                      <SubagentRow conv={group.parent} fmt={fmt} />
                    )}
                    {group.subagents.map(s => (
                      <SubagentRow key={s.filePath} conv={s} fmt={fmt} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

const ALL_MODELS = '__all__'

export default function ConversationsView() {
  const { data: conversations, loading, error, refetch } = useConversations()
  const { fmt } = useCurrency()

  const [sortKey, setSortKey] = useState<SortKey>('startTime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [filterModel, setFilterModel] = useState(ALL_MODELS)
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [filterMinCost, setFilterMinCost] = useState('')

  const groups = useMemo(() => {
    if (!conversations) return []
    return groupConversations(conversations)
  }, [conversations])

  const models = useMemo(() => {
    const s = new Set(groups.map(g => g.model))
    return Array.from(s).sort()
  }, [groups])

  const filtered = useMemo(() => {
    return groups.filter(g => {
      if (filterModel !== ALL_MODELS && g.model !== filterModel) return false
      if (filterDateStart && new Date(g.startTime) < new Date(filterDateStart)) return false
      if (filterDateEnd && new Date(g.startTime) > new Date(filterDateEnd + 'T23:59:59')) return false
      if (filterMinCost && g.totalCost < parseFloat(filterMinCost)) return false
      return true
    })
  }, [groups, filterModel, filterDateStart, filterDateEnd, filterMinCost])

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
    { label: 'Title', key: 'title' },
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
          {sorted.length} of {groups.length} sessions
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
              {sorted.map((group) => {
                const isSelected = selectedId === group.sessionId
                const agentCount = group.subagents.length
                return (
                  <React.Fragment key={group.sessionId}>
                    <tr
                      onClick={() => setSelectedId(isSelected ? null : group.sessionId)}
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
                        {fmtDateShort(group.startTime)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={group.projectSlug || undefined}>
                        {group.projectSlug ? fmtProjectSlug(group.projectSlug) : <span style={{ color: '#6e7681' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={group.title || undefined}>
                        <span style={{ color: '#c9d1d9' }}>{group.title || <span style={{ color: '#6e7681' }}>—</span>}</span>
                        {agentCount > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: '#6e7681', background: '#21262d', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                            +{agentCount} agent{agentCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, textAlign: 'right' }}>
                        {fmtDuration(group.durationMin)}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: costColor(group.totalCost) }}>
                        {fmt(group.totalCost)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, textAlign: 'right' }}>
                        {fmtTokens(group.inputTokens)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, textAlign: 'right' }}>
                        {fmtTokens(group.outputTokens)}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', color: group.cacheHitRate > 0.5 ? '#3fb950' : '#8b949e' }}>
                        {fmtPct(group.cacheHitRate)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Badge label={shortModel(group.model)} type="model" />
                      </td>
                      <td style={{ padding: '10px 16px', color: group.webSearches > 0 ? '#d29922' : '#6e7681', fontSize: 13, textAlign: 'right' }}>
                        {group.webSearches}
                      </td>
                    </tr>
                    {isSelected && <DetailPanel group={group} />}
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
