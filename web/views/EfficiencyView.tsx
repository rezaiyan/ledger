import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell, Sector,
} from 'recharts'
import { useSessions, useSummary, useConversations } from '../hooks/useData'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { fmtCost, fmtDuration, fmtDateShort, fmtPct, costColor, shortModel } from '../utils'
import type { SessionType, EnrichedSession } from '../../src/types'

const SESSION_TYPES: SessionType[] = ['feature', 'bug', 'refactor', 'explore', 'research', 'other']

const TYPE_COLORS: Record<SessionType, string> = {
  feature: '#79c0ff',
  bug: '#ff7b72',
  refactor: '#d29922',
  explore: '#d2a8ff',
  research: '#56d364',
  other: '#8b949e',
}

const PIE_COLORS = ['#3fb950', '#79c0ff', '#d29922', '#ff7b72', '#d2a8ff', '#56d364', '#e6edf3']

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

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1c2128',
      border: '1px solid #30363d',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      {label && <div style={{ color: '#8b949e', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? '#e6edf3', fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ''}{typeof p.value === 'number' ? fmtCost(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

const PctTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1c2128',
      border: '1px solid #30363d',
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      {label && <div style={{ color: '#8b949e', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? '#e6edf3', fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ''}{typeof p.value === 'number' ? fmtPct(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

export default function EfficiencyView() {
  const { data: sessions, loading: sessLoading, error: sessError } = useSessions()
  const { data: summary, loading: sumLoading, error: sumError } = useSummary()
  const { data: conversations, loading: convLoading, error: convError } = useConversations()

  const loading = sessLoading || sumLoading || convLoading
  const fetchError = convError ?? sumError ?? sessError

  // Cost per commit by type
  const costPerCommitData = useMemo(() => {
    if (!sessions) return []
    const byType: Record<SessionType, { totalCost: number; totalCommits: number }> = {} as typeof byType
    for (const s of sessions) {
      if (!byType[s.type]) byType[s.type] = { totalCost: 0, totalCommits: 0 }
      byType[s.type].totalCost += s.cost ?? 0
      byType[s.type].totalCommits += s.commits ?? 0
    }
    return SESSION_TYPES
      .filter(t => byType[t]?.totalCommits > 0)
      .map(t => ({
        type: t,
        cpc: byType[t].totalCost / byType[t].totalCommits,
        color: TYPE_COLORS[t],
      }))
      .sort((a, b) => b.cpc - a.cpc)
  }, [sessions])

  // Input ratio over time (last 30 conversations)
  const inputRatioData = useMemo(() => {
    if (!sessions) return []
    return sessions
      .filter(s => s.efficiency.inputRatio > 0)
      .slice(0, 30)
      .reverse()
      .map((s, i) => ({
        idx: i + 1,
        label: fmtDateShort(s.startTime),
        ratio: s.efficiency.inputRatio,
      }))
  }, [sessions])

  // Cache hit rate by session type
  const cacheByTypeData = useMemo(() => {
    if (!sessions) return []
    const byType: Record<SessionType, { total: number; count: number }> = {} as typeof byType
    for (const s of sessions) {
      if (s.cacheHitRate == null) continue
      if (!byType[s.type]) byType[s.type] = { total: 0, count: 0 }
      byType[s.type].total += s.cacheHitRate
      byType[s.type].count++
    }
    return SESSION_TYPES
      .filter(t => byType[t]?.count > 0)
      .map(t => ({
        type: t,
        cacheHitRate: byType[t].total / byType[t].count,
        color: TYPE_COLORS[t],
      }))
  }, [sessions])

  // Dead-end sessions
  const deadEnds = useMemo(() => {
    if (!sessions) return []
    return sessions
      .filter(s => s.efficiency.isDeadEnd)
      .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
  }, [sessions])

  // Model cost breakdown
  const modelPieData = useMemo(() => {
    if (!conversations) return []
    const byCost: Record<string, number> = {}
    for (const c of conversations) {
      const m = shortModel(c.model)
      byCost[m] = (byCost[m] ?? 0) + c.totalCost
    }
    return Object.entries(byCost)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [conversations])

  const totalModelCost = modelPieData.reduce((s, d) => s + d.value, 0)

  if (loading) return <Spinner />

  if (fetchError && !conversations && !sessions && !summary) return (
    <div style={{ background: '#160b0b', border: '1px solid #4a1218', borderRadius: 8, padding: '16px 20px', color: '#ff7b72' }}>
      Failed to load efficiency data: {fetchError}
    </div>
  )

  const sess = summary?.sessions

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Efficiency profile */}
      {sess && (
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
            Efficiency Profile
          </h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <StatCard
              value={sess.bestSessionType ? sess.bestSessionType.charAt(0).toUpperCase() + sess.bestSessionType.slice(1) : '—'}
              label="Best session type"
              accent="#3fb950"
              subtitle="Lowest $/commit"
            />
            <StatCard
              value={sess.worstSessionType ? sess.worstSessionType.charAt(0).toUpperCase() + sess.worstSessionType.slice(1) : '—'}
              label="Worst session type"
              accent="#f85149"
              subtitle="Highest $/commit"
            />
            <StatCard
              value={String(sess.deadEndSessions)}
              label="Dead-end sessions"
              accent={sess.deadEndSessions > 0 ? '#d29922' : '#3fb950'}
              subtitle={`${fmtCost(sess.deadEndCost)} wasted`}
            />
            <StatCard
              value={fmtCost(sess.avgCostPerSession)}
              label="Avg cost / session"
            />
            <StatCard
              value={sess.avgCostPerCommit != null ? fmtCost(sess.avgCostPerCommit) : '—'}
              label="Avg cost / commit"
            />
            <StatCard
              value={fmtPct(sess.avgCacheHitRate)}
              label="Avg cache hit rate"
              accent={sess.avgCacheHitRate > 0.5 ? '#3fb950' : '#d29922'}
            />
          </div>
        </section>
      )}

      {/* Cost per commit by type */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
          Cost per Commit by Session Type
        </h2>
        {costPerCommitData.length === 0 ? (
          <EmptyState title="No commit data" icon="📊" message="Sessions with commits will show here." />
        ) : (
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '20px 16px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costPerCommitData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#6e7681', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v.toFixed(2)}`}
                />
                <YAxis
                  dataKey="type"
                  type="category"
                  tick={{ fill: '#8b949e', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff0a' }} />
                <Bar dataKey="cpc" radius={[0, 4, 4, 0]} name="$/commit">
                  {costPerCommitData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Input ratio over time */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
            Input Ratio Over Time
            <span style={{ fontSize: 11, color: '#6e7681', fontWeight: 400, marginLeft: 8 }}>
              lower = less context bloat
            </span>
          </h2>
          {inputRatioData.length < 2 ? (
            <EmptyState title="Not enough session data" icon="📈" message="Need at least 2 sessions with token data." />
          ) : (
            <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '20px 16px 8px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={inputRatioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6e7681', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#6e7681', fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ color: '#8b949e', marginBottom: 2 }}>{label}</div>
                          <div style={{ color: '#79c0ff', fontWeight: 600 }}>ratio: {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}</div>
                        </div>
                      )
                    }}
                  />
                  <Line type="monotone" dataKey="ratio" stroke="#79c0ff" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Cache hit rate by type */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
            Cache Hit Rate by Type
          </h2>
          {cacheByTypeData.length === 0 ? (
            <EmptyState title="No cache data" icon="💾" message="Sessions with cache data will show here." />
          ) : (
            <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '20px 16px 8px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cacheByTypeData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: '#8b949e', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fill: '#6e7681', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    width={36}
                    domain={[0, 1]}
                  />
                  <Tooltip content={<PctTooltip />} cursor={{ fill: '#ffffff0a' }} />
                  <Bar dataKey="cacheHitRate" radius={[4, 4, 0, 0]} name="cache hit %">
                    {cacheByTypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Dead-end sessions */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
          Dead-End Sessions
          <span style={{ fontSize: 11, color: '#6e7681', fontWeight: 400, marginLeft: 8 }}>
            cost &gt; $0 with 0 commits
          </span>
        </h2>
        {deadEnds.length === 0 ? (
          <div style={{ background: '#0f2a1a', border: '1px solid #1a4a2a', borderRadius: 8, padding: '16px 20px', color: '#3fb950', fontSize: 13 }}>
            No dead-end sessions! All your sessions produced commits.
          </div>
        ) : (
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #21262d' }}>
                  {['Date', 'Name', 'Type', 'Goal', 'Cost', 'Duration', 'Cache%'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deadEnds.map((s, i) => (
                  <tr key={s.filePath} style={{ borderBottom: i < deadEnds.length - 1 ? '1px solid #21262d' : 'none' }}>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {fmtDateShort(s.startTime)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#e6edf3' }}>
                      ⚠️ {s.name}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge label={s.type} type="session" />
                    </td>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.goal || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#f85149' }}>
                      {fmtCost(s.cost ?? 0)}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13 }}>
                      {s.durationMin != null ? fmtDuration(s.durationMin) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: (s.cacheHitRate ?? 0) > 0.5 ? '#3fb950' : '#8b949e' }}>
                      {s.cacheHitRate != null ? fmtPct(s.cacheHitRate) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Model cost breakdown pie */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
          Cost by Model
        </h2>
        {modelPieData.length === 0 ? (
          <EmptyState title="No conversation data" icon="🤖" />
        ) : (
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
              <PieChart width={200} height={200}>
                <Pie
                  data={modelPieData}
                  cx={100}
                  cy={100}
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {modelPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]
                    return (
                      <div style={{ background: '#1c2128', border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ color: '#e6edf3', fontWeight: 600 }}>{d.name}</div>
                        <div style={{ color: d.payload.fill }}>{fmtCost(d.value as number)}</div>
                        <div style={{ color: '#6e7681' }}>{((d.value as number / totalModelCost) * 100).toFixed(1)}%</div>
                      </div>
                    )
                  }}
                />
              </PieChart>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {modelPieData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#c9d1d9', minWidth: 120 }}>{d.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', minWidth: 60 }}>{fmtCost(d.value)}</span>
                    <span style={{ fontSize: 11, color: '#6e7681' }}>
                      {((d.value / totalModelCost) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
