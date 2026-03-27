import { useState, useEffect, useCallback } from 'react'
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

function useFetch<T>(url: string, pollInterval?: number): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchData()
    if (pollInterval) {
      const id = setInterval(fetchData, pollInterval)
      return () => clearInterval(id)
    }
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
