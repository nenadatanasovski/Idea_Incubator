/**
 * Cascade Effect Viewer Component
 *
 * Displays cascade analysis and allows selective execution.
 * Part of: Task System V2 Implementation Plan (IMPL-7.7)
 */

import { useState, useEffect } from 'react'
import {
  Workflow,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Play,
  Pause,
  CheckSquare,
  Square
} from 'lucide-react'

type CascadeTrigger = 'status_change' | 'priority_change' | 'effort_change' | 'requirement_change' | 'impact_change'
type CascadeEffectType = 'recalculate_priority' | 'update_status' | 'notify_dependents' | 'invalidate_analysis' | 'reorder_waves'

interface CascadeEffect {
  id: string
  effectType: CascadeEffectType
  targetTaskId: string
  targetTaskTitle?: string
  targetTaskDisplayId?: string
  description: string
  autoApprove: boolean
  applied: boolean
}

interface CascadeAnalysis {
  sourceTaskId: string
  trigger: CascadeTrigger
  effects: CascadeEffect[]
  totalAffected: number
  requiresApproval: number
  autoApprovable: number
  analyzedAt: string
}

interface CascadeEffectViewerProps {
  taskId: string
  trigger?: CascadeTrigger
  onExecute?: (result: { applied: number; failed: number }) => void
}

const triggerLabels: Record<CascadeTrigger, string> = {
  status_change: 'Status Change',
  priority_change: 'Priority Change',
  effort_change: 'Effort Change',
  requirement_change: 'Requirement Change',
  impact_change: 'Impact Change'
}

const effectTypeConfig: Record<CascadeEffectType, { color: string; bgColor: string; label: string }> = {
  recalculate_priority: { color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Recalculate Priority' },
  update_status: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Update Status' },
  notify_dependents: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Notify Dependents' },
  invalidate_analysis: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Invalidate Analysis' },
  reorder_waves: { color: 'text-cyan-600', bgColor: 'bg-cyan-100', label: 'Reorder Waves' }
}

export default function CascadeEffectViewer({ taskId, trigger, onExecute }: CascadeEffectViewerProps) {
  const [analysis, setAnalysis] = useState<CascadeAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEffects, setSelectedEffects] = useState<Set<string>>(new Set())
  const [expandedEffects, setExpandedEffects] = useState<Set<string>>(new Set())

  const analyzeEffects = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/cascade/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeType: trigger || 'status_change' })
      })

      if (!response.ok) throw new Error('Failed to analyze cascade effects')

      const data = await response.json()
      setAnalysis(data)

      // Auto-select auto-approvable effects
      const autoSelected = new Set(
        data.effects.filter((e: CascadeEffect) => e.autoApprove).map((e: CascadeEffect) => e.id)
      )
      setSelectedEffects(autoSelected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const executeEffects = async (approveAll: boolean = false) => {
    if (!analysis) return

    try {
      setExecuting(true)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/cascade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          approveAll,
          selectedTaskIds: approveAll ? undefined : Array.from(selectedEffects)
        })
      })

      if (!response.ok) throw new Error('Failed to execute cascade effects')

      const result = await response.json()
      onExecute?.(result)

      // Refresh analysis
      analyzeEffects()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setExecuting(false)
    }
  }

  const toggleEffect = (id: string) => {
    const newSelected = new Set(selectedEffects)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedEffects(newSelected)
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedEffects)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedEffects(newExpanded)
  }

  const selectAll = () => {
    if (analysis) {
      setSelectedEffects(new Set(analysis.effects.map(e => e.id)))
    }
  }

  const selectNone = () => {
    setSelectedEffects(new Set())
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-gray-400" />
          <h3 className="font-medium">Cascade Effects</h3>
        </div>
        <button
          onClick={analyzeEffects}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">Trigger:</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm">
                {triggerLabels[analysis.trigger]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{analysis.totalAffected}</div>
                <div className="text-xs text-gray-500">Total Effects</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{analysis.autoApprovable}</div>
                <div className="text-xs text-gray-500">Auto-approve</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{analysis.requiresApproval}</div>
                <div className="text-xs text-gray-500">Need Approval</div>
              </div>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={selectAll}
                className="text-blue-600 hover:underline"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={selectNone}
                className="text-blue-600 hover:underline"
              >
                Select None
              </button>
              <span className="text-gray-500">
                ({selectedEffects.size} selected)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => executeEffects(false)}
                disabled={executing || selectedEffects.size === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                Execute Selected
              </button>
              <button
                onClick={() => executeEffects(true)}
                disabled={executing}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Execute All
              </button>
            </div>
          </div>

          {/* Effects List */}
          <div className="space-y-2">
            {analysis.effects.map(effect => {
              const config = effectTypeConfig[effect.effectType]
              const isSelected = selectedEffects.has(effect.id)
              const isExpanded = expandedEffects.has(effect.id)

              return (
                <div
                  key={effect.id}
                  className={`
                    border rounded-lg overflow-hidden transition-all
                    ${effect.applied ? 'border-green-200 bg-green-50' : 'border-gray-200'}
                  `}
                >
                  <div className="flex items-center gap-2 p-3">
                    {!effect.applied && (
                      <button
                        onClick={() => toggleEffect(effect.id)}
                        className="flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-300" />
                        )}
                      </button>
                    )}
                    {effect.applied && (
                      <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                    )}

                    <button
                      onClick={() => toggleExpanded(effect.id)}
                      className="flex items-center gap-2 flex-1"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className={`px-2 py-0.5 rounded text-xs ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      {effect.targetTaskDisplayId ? (
                        <span className="font-mono text-sm text-blue-600">{effect.targetTaskDisplayId}</span>
                      ) : (
                        <span className="text-sm text-gray-500">{effect.targetTaskId.slice(0, 8)}</span>
                      )}
                    </button>

                    {effect.autoApprove && !effect.applied && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        Auto
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50 text-sm">
                      <p className="text-gray-700">{effect.description}</p>
                      {effect.targetTaskTitle && (
                        <p className="mt-2 text-gray-500">
                          Target: {effect.targetTaskTitle}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {analysis.effects.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Workflow className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No cascade effects detected</p>
              <p className="text-sm">This change doesn't affect other tasks</p>
            </div>
          )}
        </>
      )}

      {!analysis && !loading && (
        <div className="text-center py-8 text-gray-500">
          <Workflow className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Click "Analyze" to detect cascade effects</p>
          <p className="text-sm">See how changes to this task affect others</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}
