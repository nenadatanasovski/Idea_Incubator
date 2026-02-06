import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../api/client'

export interface Session {
  id: string
  agent_id: string
  task_id: string | null
  run_id: string | null
  wave_number: number | null
  lane_id: string | null
  status: 'starting' | 'running' | 'completed' | 'failed' | 'paused'
  started_at: string
  completed_at: string | null
  current_iteration: number
  total_iterations: number
  tasks_completed: number
  tasks_failed: number
  parent_session_id: string | null
  metadata: Record<string, unknown> | null
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiClient.get<Session[]>('/api/sessions')
      setSessions(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    // Refresh every 5 seconds
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  return { sessions, loading, error, refetch: fetchSessions }
}
