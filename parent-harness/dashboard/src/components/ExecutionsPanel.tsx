import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3333/api'

interface Execution {
  id: string
  task_id: string
  agent_id: string
  session_id: string | null
  attempt_number: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  output: string | null
  error: string | null
  files_modified: string | null
  tokens_used: number | null
  validation_success: number | null
  created_at: string
}

interface ExecutionsPanelProps {
  taskId: string
}

export function ExecutionsPanel({ taskId }: ExecutionsPanelProps) {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/tasks/${taskId}/executions`)
      .then(res => res.json())
      .then(data => {
        setExecutions(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading executions...</div>
  }

  if (executions.length === 0) {
    return <div className="text-gray-500 text-sm">No execution attempts recorded</div>
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatTime = (ts: string | null) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleTimeString('en-AU', { 
      hour: '2-digit', minute: '2-digit' 
    })
  }

  const parseFiles = (files: string | null): string[] => {
    if (!files) return []
    try {
      return JSON.parse(files)
    } catch {
      return []
    }
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-300 mb-3">
        Execution Attempts ({executions.length})
      </h4>
      
      <div className="space-y-2">
        {executions.map((exec) => (
          <div 
            key={exec.id}
            className="bg-gray-800 rounded p-3 cursor-pointer hover:bg-gray-750"
            onClick={() => setExpanded(expanded === exec.id ? null : exec.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  exec.status === 'completed' ? 'bg-green-600' :
                  exec.status === 'failed' ? 'bg-red-600' :
                  exec.status === 'running' ? 'bg-blue-600' :
                  'bg-gray-600'
                }`}>
                  {exec.attempt_number}
                </span>
                <div>
                  <div className="text-sm text-white">{exec.agent_id}</div>
                  <div className="text-xs text-gray-500">{formatTime(exec.started_at)}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-xs">
                {exec.duration_ms && (
                  <span className="text-gray-400">
                    ⏱ {formatDuration(exec.duration_ms)}
                  </span>
                )}
                {exec.tokens_used && (
                  <span className="text-gray-400">
                    🔤 {exec.tokens_used.toLocaleString()}
                  </span>
                )}
                {exec.validation_success !== null && (
                  <span className={exec.validation_success ? 'text-green-400' : 'text-red-400'}>
                    {exec.validation_success ? '✓ Valid' : '✗ Invalid'}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded ${
                  exec.status === 'completed' ? 'bg-green-900 text-green-300' :
                  exec.status === 'failed' ? 'bg-red-900 text-red-300' :
                  exec.status === 'running' ? 'bg-blue-900 text-blue-300' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {exec.status}
                </span>
              </div>
            </div>
            
            {expanded === exec.id && (
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                {exec.error && (
                  <div className="text-xs">
                    <span className="text-red-400 font-medium">Error: </span>
                    <span className="text-gray-400">{exec.error}</span>
                  </div>
                )}
                
                {parseFiles(exec.files_modified).length > 0 && (
                  <div className="text-xs">
                    <span className="text-blue-400 font-medium">Files Modified: </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {parseFiles(exec.files_modified).map((f, i) => (
                        <span key={i} className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                          {f.split('/').pop()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {exec.output && (
                  <div className="text-xs">
                    <span className="text-green-400 font-medium">Output: </span>
                    <pre className="mt-1 bg-gray-900 p-2 rounded text-gray-400 max-h-32 overflow-auto whitespace-pre-wrap">
                      {exec.output.slice(0, 500)}{exec.output.length > 500 ? '...' : ''}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExecutionsPanel
