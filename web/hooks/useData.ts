import { useState, useEffect, useCallback, useRef } from 'react'
import type { ParsedConversation, EnrichedSession, PeriodSummary, SessionSummary } from '../../src/types'

export interface SummaryResponse {
  today: PeriodSummary
  thisMonth: PeriodSummary
  allTime: PeriodSummary
  sessions: SessionSummary
}

export interface StatusResponse {
  currentSession: Record<string, unknown> | null
  today: PeriodSummary
  serverTime: string
  claudeDir: string
  sessionsDir: string
}

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// How often to retry failed requests until the first successful response
const RETRY_INTERVAL_MS = 5_000

function useFetch<T>(url: string, pollInterval?: number): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasData = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      hasData.current = true
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    hasData.current = false
    fetchData()
    // If an explicit pollInterval is given, use it. Otherwise retry every
    // RETRY_INTERVAL_MS until the first successful response (handles the
    // race condition where the browser opens before the server is ready).
    const interval = pollInterval ?? RETRY_INTERVAL_MS
    const id = setInterval(() => {
      if (hasData.current && !pollInterval) return
      fetchData()
    }, interval)
    return () => clearInterval(id)
  }, [fetchData, pollInterval])

  return { data, loading, error, refetch: fetchData }
}

export function useConversations() {
  return useFetch<ParsedConversation[]>('/api/conversations')
}

export function useSessions() {
  return useFetch<EnrichedSession[]>('/api/sessions')
}

export function useSummary() {
  return useFetch<SummaryResponse>('/api/summary')
}

export function useStatus() {
  return useFetch<StatusResponse>('/api/status', 30_000)
}
