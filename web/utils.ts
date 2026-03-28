export function fmtCost(val: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(val)
}

export function fmtCostAxis(val: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(val)
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function fmtDuration(minutes: number): string {
  if (!minutes || minutes < 1) return '< 1m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function fmtDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtPct(val: number): string {
  return `${(val * 100).toFixed(1)}%`
}

export function costColor(cost: number): string {
  if (cost < 2) return '#3fb950'
  if (cost < 8) return '#d29922'
  return '#f85149'
}

export function shortModel(model: string): string {
  // claude-opus-4-5 => opus-4-5
  return model.replace(/^claude-/, '')
}

export function fmtProjectSlug(slug: string): string {
  // "-Users-ali-projects-Lexicon" → "Lexicon"
  // "-Users-ali-projects-my-app" → "my-app"
  let s = slug
  s = s.replace(/^-(Users|home)-[^-]+-/, '')
  s = s.replace(/^(projects|work|dev|code|src|repos|Documents|Desktop|Developer)-/, '')
  return s || slug
}

// ---------------------------------------------------------------------------
// Conversation grouping
// ---------------------------------------------------------------------------

import type { ParsedConversation } from '../src/types'

export type ConversationGroup = {
  sessionId: string
  parent: ParsedConversation | null
  subagents: ParsedConversation[]
  title: string
  projectSlug: string
  startTime: Date
  endTime: Date
  durationMin: number
  totalCost: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  cacheHitRate: number
  webSearches: number
  model: string
  messages: number
}

export function groupConversations(convs: ParsedConversation[]): ConversationGroup[] {
  const map = new Map<string, ParsedConversation[]>()
  for (const c of convs) {
    const list = map.get(c.sessionId) ?? []
    list.push(c)
    map.set(c.sessionId, list)
  }

  const groups: ConversationGroup[] = []
  for (const [sessionId, entries] of map) {
    const parent = entries.find(e => !e.isSubagent) ?? null
    const subagents = entries.filter(e => e.isSubagent)
    const representative = parent ?? entries[0]

    const totalCost = entries.reduce((s, e) => s + e.totalCost, 0)
    const inputTokens = entries.reduce((s, e) => s + e.inputTokens, 0)
    const outputTokens = entries.reduce((s, e) => s + e.outputTokens, 0)
    const cacheCreationTokens = entries.reduce((s, e) => s + e.cacheCreationTokens, 0)
    const cacheReadTokens = entries.reduce((s, e) => s + e.cacheReadTokens, 0)
    const webSearches = entries.reduce((s, e) => s + e.webSearches, 0)
    const messages = entries.reduce((s, e) => s + e.messages, 0)
    const totalCache = cacheCreationTokens + cacheReadTokens
    const cacheHitRate = totalCache > 0 ? cacheReadTokens / totalCache : 0

    const timestamps = entries.flatMap(e => [e.startTime, e.endTime])
    const startTime = new Date(Math.min(...timestamps.map(t => new Date(t).getTime())))
    const endTime = new Date(Math.max(...timestamps.map(t => new Date(t).getTime())))
    const durationMin = (endTime.getTime() - startTime.getTime()) / 60_000

    groups.push({
      sessionId,
      parent,
      subagents,
      title: representative.title,
      projectSlug: representative.projectSlug,
      startTime,
      endTime,
      durationMin,
      totalCost,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      cacheHitRate,
      webSearches,
      model: representative.model,
      messages,
    })
  }

  return groups
}
