/**
 * Atomicity Warning Component
 *
 * Displays atomicity validation results with rule violations.
 * Part of: Task System V2 Implementation Plan (IMPL-7.10)
 */

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Scissors,
  RefreshCw
} from 'lucide-react'

type AtomicityRule =
  | 'single_file'
  | 'single_concern'
  | 'time_bound'
  | 'testable'
  | 'no_external_deps'
  | 'reversible'

interface RuleViolation {
  rule: AtomicityRule
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion: string
}

interface AtomicityValidation {
  taskId: string
  isAtomic: boolean
  score: number
  violations: RuleViolation[]
  canDecompose: boolean
  suggestedSubtasks?: number
}

interface AtomicityWarningProps {
  taskId: string
  onDecompose?: () => void
  compact?: boolean
}

const ruleConfig: Record<AtomicityRule, { label: string; description: string }> = {
  single_file: {
    label: 'Single File',
    description: 'Task should primarily modify one file'
  },
  single_concern: {
    label: 'Single Concern',
    description: 'Task should address one specific concern'
  },
  time_bound: {
    label: 'Time Bound',
    description: 'Task should be completable in ~30 minutes'
  },
  testable: {
    label: 'Testable',
    description: 'Task completion should be verifiable'
  },
  no_external_deps: {
    label: 'No External Dependencies',
    description: 'Task should not require external decisions'
  },
  reversible: {
    label: 'Reversible',
    description: 'Task changes should be easy to undo'
  }
}

const severityConfig = {
  error: { color: 'text-red-600', bgColor: 'bg-red-100', icon: X },
  warning: { color: 'text-amber-600', bgColor: 'bg-amber-100', icon: AlertTriangle },
  info: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Check }
}

export default function AtomicityWarning({ taskId, onDecompose, compact = false }: AtomicityWarningProps) {
  const [validation, setValidation] = useState<AtomicityValidation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    validateAtomicity()
  }, [taskId])

  const validateAtomicity = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/validate-atomicity`, {
        method: 'POST'
      })

      if (response.ok) {
        setValidation(await response.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Validating...
      </div>
    )
  }

  if (error || !validation) {
    return null
  }

  // Compact mode - just show status badge
  if (compact) {
    return (
      <div className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        ${validation.isAtomic
          ? 'bg-green-100 text-green-700'
          : 'bg-amber-100 text-amber-700'
        }
      `}>
        {validation.isAtomic ? (
          <Check className="h-3 w-3" />
        ) : (
          <AlertTriangle className="h-3 w-3" />
        )}
        {validation.isAtomic ? 'Atomic' : 'Non-atomic'}
        {!validation.isAtomic && validation.suggestedSubtasks && (
          <span className="text-amber-600">→ {validation.suggestedSubtasks} subtasks</span>
        )}
      </div>
    )
  }

  // Full mode - show detailed validation
  if (validation.isAtomic) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          <span className="font-medium">Task is atomic</span>
          <span className="text-sm text-green-600">Score: {validation.score}/100</span>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-amber-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-3 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span className="font-medium text-amber-700">Task may not be atomic</span>
          <span className="text-sm text-amber-600">
            Score: {validation.score}/100 • {validation.violations.length} issues
          </span>
        </div>
        <div className="flex items-center gap-2">
          {validation.canDecompose && (
            <button
              onClick={e => {
                e.stopPropagation()
                onDecompose?.()
              }}
              className="flex items-center gap-1 px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
            >
              <Scissors className="h-3 w-3" />
              Decompose
            </button>
          )}
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-amber-600" />
          ) : (
            <ChevronRight className="h-5 w-5 text-amber-600" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 space-y-3">
          {validation.suggestedSubtasks && (
            <p className="text-sm text-gray-600">
              Suggested decomposition: <strong>{validation.suggestedSubtasks} subtasks</strong>
            </p>
          )}

          {/* Rule Violations */}
          <div className="space-y-2">
            {validation.violations.map((violation, i) => {
              const config = severityConfig[violation.severity]
              const SeverityIcon = config.icon

              return (
                <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className={`p-1 rounded ${config.bgColor}`}>
                      <SeverityIcon className={`h-4 w-4 ${config.color}`} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {ruleConfig[violation.rule].label}
                        </span>
                        <span className={`text-xs ${config.color}`}>
                          {violation.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {violation.message}
                      </p>
                      {violation.suggestion && (
                        <p className="text-sm text-blue-600 mt-2">
                          💡 {violation.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Atomicity Rules Reference */}
          <div className="pt-3 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-500 mb-2">Atomicity Rules</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              {Object.entries(ruleConfig).map(([rule, config]) => (
                <div key={rule} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-gray-200" />
                  {config.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
