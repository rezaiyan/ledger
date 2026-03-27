import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { useSummary, useStatus, useConversations, type StatusResponse } from '../hooks/useData'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { fmtCost, fmtTokens, fmtDuration, fmtDateShort, fmtPct, costColor, shortModel } from '../utils'
import type { ParsedConversation } from '../../src/types'

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

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{
      background: '#160b0b',
      border: '1px solid #4a1218',
      borderRadius: 8,
      padding: '16px 20px',
      color: '#ff7b72',
      fontSize: 13,
    }}>
      Failed to load data: {msg}
    </div>
  )
}

function ActiveSessionCard({ currentSession, todayCost }: {
  currentSession: Record<string, unknown>
  todayCost: number
}) {
  const name = (currentSession.name as string) ?? 'Active Session'
  const goal = currentSession.goal as string | undefined
  const cost = (currentSession.cost as number) ?? 0
  const durationMin = (currentSession.durationMin as number) ?? 0
  const cacheHitRate = (currentSession.cacheHitRate as number) ?? 0

  return (
    <div style={{
      background: '#0f2a1a',
      border: '1px solid #1a4a2a',
      borderRadius: 8,
      padding: '20px 24px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 6px #3fb950' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#3fb950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Active Session
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>
            {name}
          </div>
          {goal && (
            <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 12 }}>{goal}</div>
          )}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: costColor(cost) }}>{fmtCost(cost)}</div>
              <div style={{ fontSize: 11, color: '#6e7681' }}>session cost</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e6edf3' }}>{fmtDuration(durationMin)}</div>
              <div style={{ fontSize: 11, color: '#6e7681' }}>duration</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: cacheHitRate > 0.5 ? '#3fb950' : '#d29922' }}>
                {fmtPct(cacheHitRate)}
              </div>
              <div style={{ fontSize: 11, color: '#6e7681' }}>cache hit</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: '#8b949e' }}>Today's total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: costColor(todayCost) }}>{fmtCost(todayCost)}</div>
        </div>
      </div>
    </div>
  )
}

function buildDailyData(conversations: ParsedConversation[]) {
  const today = new Date()
  const days: { date: string; cost: number; label: string }[] = []

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, cost: 0, label: fmtDateShort(d) })
  }

  for (const conv of conversations) {
    const key = new Date(conv.startTime).toISOString().slice(0, 10)
    const day = days.find(d => d.date === key)
    if (day) day.cost += conv.totalCost
  }

  return days
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
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
      <div style={{ color: '#8b949e', marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#e6edf3', fontWeight: 600 }}>{fmtCost(payload[0].value)}</div>
    </div>
  )
}

export default function Overview() {
  const summary = useSummary()
  const status = useStatus()
  const conversations = useConversations()

  const dailyData = useMemo(() => {
    if (!conversations.data) return []
    return buildDailyData(conversations.data)
  }, [conversations.data])

  const topConversations = useMemo(() => {
    if (!conversations.data) return []
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    return conversations.data
      .filter(c => new Date(c.startTime) >= thisMonth)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5)
  }, [conversations.data])

  if (summary.loading || status.loading) return <Spinner />
  if (summary.error) return <ErrorMsg msg={summary.error} />
  if (!summary.data) return <EmptyState title="No data yet" message="Run some Claude conversations to see your cost data here." />

  const { today, thisMonth, allTime } = summary.data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Active session */}
      {status.data?.currentSession && (
        <ActiveSessionCard
          currentSession={status.data.currentSession}
          todayCost={status.data.today.cost}
        />
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard
          value={fmtCost(today.cost)}
          label="Today's cost"
          subtitle={`${today.conversations} conversation${today.conversations !== 1 ? 's' : ''}`}
        />
        <StatCard
          value={fmtCost(thisMonth.cost)}
          label="This month"
          subtitle={`${thisMonth.conversations} conversations`}
        />
        <StatCard
          value={fmtCost(allTime.cost)}
          label="All time"
          subtitle={`${allTime.conversations} total conversations`}
        />
        <StatCard
          value={String(allTime.conversations)}
          label="Total conversations"
          subtitle={`${allTime.sessions} sessions tracked`}
        />
      </div>

      {/* Daily spending chart */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
          Daily Spending — Last 30 Days
        </h2>
        {conversations.loading ? <Spinner /> : (
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: 8,
            padding: '20px 16px 8px',
          }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6e7681', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: '#6e7681', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v.toFixed(0)}`}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff0a' }} />
                <Bar dataKey="cost" radius={[3, 3, 0, 0]}>
                  {dailyData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.cost === 0 ? '#21262d' : '#3fb950'}
                      opacity={entry.cost === 0 ? 0.4 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Top conversations this month */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
          Top 5 Most Expensive Conversations — This Month
        </h2>
        {conversations.loading ? <Spinner /> : topConversations.length === 0 ? (
          <EmptyState title="No conversations this month" icon="💬" />
        ) : (
          <div style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #21262d' }}>
                  {['Project', 'Date', 'Duration', 'Tokens In', 'Tokens Out', 'Cache%', 'Cost'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#6e7681',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topConversations.map((conv, i) => (
                  <tr
                    key={conv.sessionId}
                    style={{
                      borderBottom: i < topConversations.length - 1 ? '1px solid #21262d' : 'none',
                    }}
                  >
                    <td style={{ padding: '10px 16px', color: '#e6edf3', fontSize: 13 }}>
                      {conv.projectSlug || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {fmtDateShort(conv.startTime)}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13 }}>
                      {fmtDuration(conv.durationMin)}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13 }}>
                      {fmtTokens(conv.inputTokens)}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#8b949e', fontSize: 13 }}>
                      {fmtTokens(conv.outputTokens)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: conv.cacheHitRate > 0.5 ? '#3fb950' : '#8b949e' }}>
                      {fmtPct(conv.cacheHitRate)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: costColor(conv.totalCost) }}>
                      {fmtCost(conv.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Token & cache summary */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3', marginBottom: 16 }}>
          This Month — Token Summary
        </h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatCard value={fmtTokens(thisMonth.inputTokens)} label="Input tokens" />
          <StatCard value={fmtTokens(thisMonth.outputTokens)} label="Output tokens" />
          <StatCard value={fmtTokens(thisMonth.cacheCreationTokens)} label="Cache writes" />
          <StatCard value={fmtTokens(thisMonth.cacheReadTokens)} label="Cache reads" />
          <StatCard
            value={fmtPct(thisMonth.cacheHitRate)}
            label="Cache hit rate"
            accent={thisMonth.cacheHitRate > 0.5 ? '#3fb950' : '#d29922'}
          />
          <StatCard value={String(thisMonth.webSearches)} label="Web searches" />
        </div>
      </section>
    </div>
  )
}
