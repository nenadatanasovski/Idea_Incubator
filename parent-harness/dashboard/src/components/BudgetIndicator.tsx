import { useState, useEffect, useCallback } from 'react'

interface BudgetStatus {
  daily: {
    tokens: { input: number; output: number; total: number }
    cost_usd: number
    limit_tokens: number
    percent_used: number
  }
  budget_status: string
}

const API_BASE = 'http://localhost:3333/api'

export function BudgetIndicator() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/config/budget`)
      if (res.ok) {
        setBudget(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch budget:', err)
    }
  }, [])

  useEffect(() => {
    fetchBudget()
    
    // Poll as fallback
    const interval = setInterval(fetchBudget, 30000)
    
    // WebSocket for real-time updates
    let ws: WebSocket | null = null
    try {
      ws = new WebSocket('ws://localhost:3333/ws')
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'budget:updated') {
          fetchBudget() // Refresh on budget update
        }
      }
      ws.onerror = () => {} // Ignore errors, fallback to polling
    } catch { /* ignore */ }
    
    return () => {
      clearInterval(interval)
      ws?.close()
    }
  }, [fetchBudget])

  if (!budget) return null

  const percent = budget.daily.percent_used
  const isWarning = percent >= 50 && percent < 80
  const isDanger = percent >= 80

  // Color classes
  const barColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
  const textColor = isDanger ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
      >
        <span className="text-lg">💰</span>
        <span className={`text-sm font-medium ${textColor}`}>
          {percent.toFixed(0)}%
        </span>
        {/* Mini progress bar */}
        <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50 p-4">
          <h4 className="font-semibold text-white mb-3">Daily Budget</h4>
          
          {/* Large progress bar */}
          <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${barColor} transition-all duration-300`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-400 mb-4">
            <span>{percent.toFixed(1)}% used</span>
            <span>{(100 - percent).toFixed(1)}% remaining</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Tokens Used:</span>
              <span className="text-white font-mono">{budget.daily.tokens.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Token Limit:</span>
              <span className="text-white font-mono">{budget.daily.limit_tokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Est. Cost:</span>
              <span className="text-white font-mono">${budget.daily.cost_usd.toFixed(2)}</span>
            </div>
          </div>

          {budget.budget_status !== 'OK' && (
            <div className={`mt-3 p-2 rounded text-xs ${isDanger ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
              {budget.budget_status.replace('_', ' ')}
            </div>
          )}

          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 w-full text-xs text-gray-400 hover:text-white text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

export default BudgetIndicator
