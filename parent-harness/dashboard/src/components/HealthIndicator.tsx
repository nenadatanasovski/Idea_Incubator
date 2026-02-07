import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:3333'

interface HealthState {
  status: 'checking' | 'healthy' | 'unhealthy'
  lastCheck: Date | null
  responseTime: number | null
}

export function HealthIndicator() {
  const [health, setHealth] = useState<HealthState>({
    status: 'checking',
    lastCheck: null,
    responseTime: null,
  })

  const checkHealth = useCallback(async () => {
    const start = Date.now()
    try {
      const res = await fetch(`${API_BASE}/health`, { 
        signal: AbortSignal.timeout(5000) 
      })
      const elapsed = Date.now() - start
      
      if (res.ok) {
        setHealth({
          status: 'healthy',
          lastCheck: new Date(),
          responseTime: elapsed,
        })
      } else {
        setHealth({
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: elapsed,
        })
      }
    } catch {
      setHealth({
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: null,
      })
    }
  }, [])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => clearInterval(interval)
  }, [checkHealth])

  const statusColors = {
    checking: 'bg-yellow-500',
    healthy: 'bg-green-500',
    unhealthy: 'bg-red-500 animate-pulse',
  }

  const statusText = {
    checking: 'Checking...',
    healthy: 'Server OK',
    unhealthy: 'Server Down',
  }

  return (
    <div 
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
        health.status === 'unhealthy' ? 'bg-red-900/50 border border-red-500' : 'bg-gray-800'
      }`}
      title={`Last check: ${health.lastCheck?.toLocaleTimeString() || 'never'}${
        health.responseTime ? ` (${health.responseTime}ms)` : ''
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${statusColors[health.status]}`} />
      <span className={`text-xs font-medium ${
        health.status === 'unhealthy' ? 'text-red-300' : 'text-gray-400'
      }`}>
        {statusText[health.status]}
      </span>
    </div>
  )
}

export default HealthIndicator
