import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare,
  Clock,
  Lightbulb,
  Radio,
  ChevronRight,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  CheckCircle,
  FileText,
} from 'lucide-react'
import { getDebateSessions, type DebateSession } from '../api/client'

// Copy to clipboard helper
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
      title="Copy session ID"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

// Status indicator component
function StatusIndicator({ status }: { status?: DebateSession['status'] }) {
  switch (status) {
    case 'complete':
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3" />
          Complete
        </span>
      )
    case 'in-progress':
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          In Progress
        </span>
      )
    case 'evaluation-only':
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title="Evaluation ran without debate phase">
          <FileText className="h-3 w-3" />
          Eval Only
        </span>
      )
    default:
      return null
  }
}

export default function DebateList() {
  const [sessions, setSessions] = useState<DebateSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDebateSessions()
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span className="text-red-700">{error}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Debates</h1>
          <p className="mt-1 text-sm text-gray-500">
            View past evaluation debates and red team challenges
          </p>
        </div>
        <Link
          to="/debate/live"
          className="btn btn-primary inline-flex items-center"
        >
          <Radio className="h-4 w-4 mr-2" />
          Live Debate
        </Link>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No debates yet</h3>
          <p className="text-gray-500 mb-4">
            Debates are generated when you run an AI evaluation on an idea.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
            <h4 className="text-sm font-medium text-gray-700 mb-2">How to start a debate:</h4>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Go to an idea's detail page</li>
              <li>Click the "Run Evaluation" button</li>
              <li>The AI will evaluate and debate the idea's merits</li>
              <li>Come back here to review the debate history</li>
            </ol>
          </div>
          <div className="mt-4">
            <Link
              to="/"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Browse ideas to evaluate →
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {sessions.map((session) => (
              <li key={session.evaluation_run_id}>
                <Link
                  to={`/debate/session/${session.evaluation_run_id}`}
                  className="block hover:bg-gray-50 transition-colors"
                >
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-primary-600" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <Lightbulb className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {session.idea_title}
                            </span>
                            <StatusIndicator status={session.status} />
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              {formatRelativeTime(session.latest_at)}
                            </span>
                            {session.round_count > 0 && (
                              <span>
                                {session.round_count} round{session.round_count !== 1 ? 's' : ''}
                              </span>
                            )}
                            {session.criterion_count > 0 && (
                              <span>
                                {session.criterion_count} criteri{session.criterion_count !== 1 ? 'a' : 'on'}
                              </span>
                            )}
                            {session.status === 'evaluation-only' && (
                              <span className="text-amber-600">No debate</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>

                    {/* Session ID */}
                    <div className="mt-2 ml-14 flex items-center space-x-2">
                      <span className="text-xs text-gray-400 font-mono">
                        {session.evaluation_run_id}
                      </span>
                      <CopyButton text={session.evaluation_run_id} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
