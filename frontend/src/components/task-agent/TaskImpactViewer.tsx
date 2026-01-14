/**
 * Task Impact Viewer Component
 *
 * Displays and manages task impacts (file, API, function, database, type).
 * Part of: Task System V2 Implementation Plan (IMPL-7.4)
 */

import { useState, useEffect } from 'react'
import {
  File,
  Globe,
  Code,
  Database,
  Type,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit2
} from 'lucide-react'

type ImpactType = 'file' | 'api' | 'function' | 'database' | 'type'
type ImpactOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
type ImpactSource = 'ai_estimated' | 'user_declared' | 'discovered' | 'inherited'

interface TaskImpact {
  id: string
  taskId: string
  impactType: ImpactType
  operation: ImpactOperation
  target: string
  details?: string
  confidence: number
  source: ImpactSource
  createdAt: string
}

interface ImpactConflict {
  taskAId: string
  taskBId: string
  conflictType: string
  target: string
  severity: 'high' | 'medium' | 'low'
}

interface TaskImpactViewerProps {
  taskId: string
  readOnly?: boolean
  onImpactChange?: () => void
}

const impactTypeConfig = {
  file: { icon: File, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'File' },
  api: { icon: Globe, color: 'text-green-600', bgColor: 'bg-green-100', label: 'API' },
  function: { icon: Code, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Function' },
  database: { icon: Database, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Database' },
  type: { icon: Type, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Type' }
}

const operationColors = {
  CREATE: 'text-green-600 bg-green-50',
  READ: 'text-blue-600 bg-blue-50',
  UPDATE: 'text-amber-600 bg-amber-50',
  DELETE: 'text-red-600 bg-red-50'
}

export default function TaskImpactViewer({ taskId, readOnly = false, onImpactChange }: TaskImpactViewerProps) {
  const [impacts, setImpacts] = useState<TaskImpact[]>([])
  const [conflicts, setConflicts] = useState<ImpactConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState<Set<ImpactType>>(new Set(['file']))

  // Form state for adding new impact
  const [newImpact, setNewImpact] = useState({
    impactType: 'file' as ImpactType,
    operation: 'UPDATE' as ImpactOperation,
    target: ''
  })

  useEffect(() => {
    fetchImpacts()
  }, [taskId])

  const fetchImpacts = async () => {
    try {
      setLoading(true)
      const [impactsRes, conflictsRes] = await Promise.all([
        fetch(`/api/task-agent/tasks/${taskId}/impacts`),
        fetch(`/api/task-agent/tasks/${taskId}/impacts/conflicts`)
      ])

      if (impactsRes.ok) {
        setImpacts(await impactsRes.json())
      }
      if (conflictsRes.ok) {
        setConflicts(await conflictsRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddImpact = async () => {
    if (!newImpact.target.trim()) return

    try {
      const response = await fetch(`/api/task-agent/tasks/${taskId}/impacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newImpact,
          confidence: 1.0,
          source: 'user_declared'
        })
      })

      if (!response.ok) throw new Error('Failed to add impact')

      setShowAddForm(false)
      setNewImpact({ impactType: 'file', operation: 'UPDATE', target: '' })
      fetchImpacts()
      onImpactChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleRemoveImpact = async (impactId: string) => {
    try {
      const response = await fetch(`/api/task-agent/tasks/${taskId}/impacts/${impactId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove impact')

      fetchImpacts()
      onImpactChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const toggleType = (type: ImpactType) => {
    const newExpanded = new Set(expandedTypes)
    if (newExpanded.has(type)) {
      newExpanded.delete(type)
    } else {
      newExpanded.add(type)
    }
    setExpandedTypes(newExpanded)
  }

  // Group impacts by type
  const groupedImpacts = impacts.reduce((acc, impact) => {
    if (!acc[impact.impactType]) {
      acc[impact.impactType] = []
    }
    acc[impact.impactType].push(impact)
    return acc
  }, {} as Record<ImpactType, TaskImpact[]>)

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
            <AlertTriangle className="h-5 w-5" />
            {conflicts.length} Potential Conflict{conflicts.length > 1 ? 's' : ''}
          </div>
          <div className="space-y-1">
            {conflicts.slice(0, 3).map((c, i) => (
              <p key={i} className="text-sm text-amber-600">
                {c.conflictType} on <code className="bg-amber-100 px-1 rounded">{c.target}</code>
                {' '}({c.severity} severity)
              </p>
            ))}
            {conflicts.length > 3 && (
              <p className="text-sm text-amber-500">...and {conflicts.length - 3} more</p>
            )}
          </div>
        </div>
      )}

      {/* Add Impact Button */}
      {!readOnly && (
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Impact
        </button>
      )}

      {/* Add Impact Form */}
      {showAddForm && (
        <div className="p-4 border border-gray-200 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newImpact.impactType}
                onChange={e => setNewImpact({ ...newImpact, impactType: e.target.value as ImpactType })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {Object.entries(impactTypeConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
              <select
                value={newImpact.operation}
                onChange={e => setNewImpact({ ...newImpact, operation: e.target.value as ImpactOperation })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="CREATE">CREATE</option>
                <option value="READ">READ</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
            <input
              type="text"
              value={newImpact.target}
              onChange={e => setNewImpact({ ...newImpact, target: e.target.value })}
              placeholder="e.g., server/routes/api.ts"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddImpact}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Impacts by Type */}
      {impacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <File className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No impacts defined</p>
          <p className="text-sm">Add impacts to track what this task affects</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(Object.keys(impactTypeConfig) as ImpactType[]).map(type => {
            const typeImpacts = groupedImpacts[type] || []
            if (typeImpacts.length === 0) return null

            const config = impactTypeConfig[type]
            const TypeIcon = config.icon
            const isExpanded = expandedTypes.has(type)

            return (
              <div key={type} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleType(type)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className={`p-1.5 rounded ${config.bgColor}`}>
                    <TypeIcon className={`h-4 w-4 ${config.color}`} />
                  </span>
                  <span className="font-medium">{config.label}</span>
                  <span className="text-sm text-gray-500">({typeImpacts.length})</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {typeImpacts.map(impact => (
                      <div
                        key={impact.id}
                        className="flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${operationColors[impact.operation]}`}>
                            {impact.operation}
                          </span>
                          <code className="text-sm text-gray-700">{impact.target}</code>
                          <span className="text-xs text-gray-400">
                            {Math.round(impact.confidence * 100)}% ({impact.source})
                          </span>
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() => handleRemoveImpact(impact.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
