import React, { useState, useMemo } from 'react'
import { useSessions } from '../hooks/useData'
import EmptyState from '../components/EmptyState'
import Badge from '../components/Badge'
import { fmtCost, fmtDuration, fmtDateShort, fmtPct, costColor, shortModel } from '../utils'
import type { SessionType, EnrichedSession } from '../../src/types'

const ALL_TYPES = '__all__' as const
type TypeFilter = SessionType | typeof ALL_TYPES

const SESSION_TYPES: SessionType[] = ['feature', 'bug', 'refactor', 'explore', 'research', 'other']

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

function JournalPanel({ session }: { session: EnrichedSession }) {
  const content = (session as unknown as { rawContent?: string }).rawContent

  return (
    <tr>
      <td colSpan={9} style={{ background: '#0d1117', borderBottom: '1px solid #21262d', padding: 0 }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Goal</div>
              <div style={{ fontSize: 13, color: '#c9d1d9' }}>{session.goal || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Project</div>
              <div style={{ fontSize: 13, color: '#c9d1d9' }}>{session.project || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Commits</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{session.commits ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Lines Added</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#3fb950' }}>+{session.linesAdded ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Lines Removed</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f85149' }}>-{session.linesRemoved ?? 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Conversations</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>{session.conversations.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Cache Hit</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: (session.cacheHitRate ?? 0) > 0.5 ? '#3fb950' : '#8b949e' }}>
                {session.cacheHitRate != null ? fmtPct(session.cacheHitRate) : '—'}
              </div>
            </div>
            {session.model && (
              <div>
                <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Model</div>
                <Badge label={shortModel(session.model)} type="model" />
              </div>
            )}
          </div>

          {content ? (
            <div>
              <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Journal</div>
              <pre style={{
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: 6,
                padding: '14px 16px',
                fontSize: 12,
                color: '#c9d1d9',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 400,
                overflowY: 'auto',
                lineHeight: 1.6,
              }}>
                {content}
              </pre>
            </div>
          ) : session.filePath ? (
            <div style={{ fontSize: 12, color: '#6e7681', fontFamily: 'monospace' }}>
              {session.filePath}
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export default function SessionsView() {
  const { data: sessions, loading, error, refetch } = useSessions()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(ALL_TYPES)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!sessions) return []
    if (typeFilter === ALL_TYPES) return sessions
    return sessions.filter(s => s.type === typeFilter)
  }, [sessions, typeFilter])

  const typeCounts = useMemo(() => {
    if (!sessions) return {} as Record<string, number>
    const counts: Record<string, number> = { [ALL_TYPES]: sessions.length }
    for (const s of sessions) {
      counts[s.type] = (counts[s.type] ?? 0) + 1
    }
    return counts
  }, [sessions])

  if (loading) return <Spinner />
  if (error) return (
    <div style={{ background: '#160b0b', border: '1px solid #4a1218', borderRadius: 8, padding: '16px 20px', color: '#ff7b72', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>Failed to load sessions: {error}</span>
      <button onClick={refetch} style={{ background: 'transparent', border: '1px solid #f85149', borderRadius: 6, color: '#ff7b72', cursor: 'pointer', fontSize: 12, padding: '4px 10px' }}>
        Retry
      </button>
    </div>
  )
  if (!sessions?.length) return (
    <EmptyState
      icon="📓"
      title="No sessions found"
      message="Sessions are tracked via markdown journal files in a claude-sessions directory. Create session journals to see your work summarized here."
    >
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: 6,
        padding: '12px 16px',
        fontSize: 12,
        color: '#8b949e',
        textAlign: 'left',
        fontFamily: 'monospace',
        marginTop: 8,
      }}>
        <div style={{ color: '#6e7681', marginBottom: 6 }}># Example session journal</div>
        <div>---</div>
        <div>type: feature</div>
        <div>goal: Add user authentication</div>
        <div>---</div>
      </div>
    </EmptyState>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Type filter tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setTypeFilter(ALL_TYPES)}
          style={{
            background: typeFilter === ALL_TYPES ? '#21262d' : 'transparent',
            border: `1px solid ${typeFilter === ALL_TYPES ? '#30363d' : '#21262d'}`,
            borderRadius: 20,
            color: typeFilter === ALL_TYPES ? '#e6edf3' : '#8b949e',
            cursor: 'pointer',
            fontSize: 13,
            padding: '5px 14px',
          }}
        >
          All <span style={{ fontSize: 11, color: '#6e7681' }}>{typeCounts[ALL_TYPES] ?? 0}</span>
        </button>
        {SESSION_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              background: typeFilter === t ? '#21262d' : 'transparent',
              border: `1px solid ${typeFilter === t ? '#30363d' : '#21262d'}`,
              borderRadius: 20,
              color: typeFilter === t ? '#e6edf3' : '#8b949e',
              cursor: 'pointer',
              fontSize: 13,
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ textTransform: 'capitalize' }}>{t}</span>
            {typeCounts[t] != null && (
              <span style={{ fontSize: 11, color: '#6e7681' }}>{typeCounts[t]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21262d' }}>
                {['Date', 'Name', 'Type', 'Goal', 'Cost', 'Commits', '$/commit', 'Cache%', 'Model'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6e7681',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((session, i) => {
                const isSelected = selectedId === session.filePath
                const isDeadEnd = session.efficiency.isDeadEnd
                const cost = session.cost ?? 0
                const commits = session.commits ?? 0
                const cpc = session.efficiency.costPerCommit

                return (
                  <React.Fragment key={session.filePath}>
                    <tr
                      onClick={() => setSelectedId(isSelected ? null : session.filePath)}
                      style={{
                        borderBottom: '1px solid #21262d',
                        cursor: 'pointer',
                        background: isSelected ? '#1c2128' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#1c2128' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {fmtDateShort(session.startTime)}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#e6edf3', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isDeadEnd && (
                          <span title="Dead-end: cost > $2 with 0 commits" style={{ marginRight: 6, fontSize: 14 }}>⚠️</span>
                        )}
                        {session.name}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Badge label={session.type} type="session" />
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.goal || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: costColor(cost), whiteSpace: 'nowrap' }}>
                        {fmtCost(cost)}
                      </td>
                      <td style={{ padding: '10px 16px', color: commits > 0 ? '#e6edf3' : '#f85149', fontSize: 13, fontWeight: commits > 0 ? 400 : 600 }}>
                        {commits}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13 }}>
                        {cpc != null ? fmtCost(cpc) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: (session.cacheHitRate ?? 0) > 0.5 ? '#3fb950' : '#8b949e' }}>
                        {session.cacheHitRate != null ? fmtPct(session.cacheHitRate) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {session.model ? <Badge label={shortModel(session.model)} type="model" /> : <span style={{ color: '#6e7681' }}>—</span>}
                      </td>
                    </tr>
                    {isSelected && <JournalPanel session={session} />}
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
