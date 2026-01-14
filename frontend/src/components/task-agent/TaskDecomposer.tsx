/**
 * Task Decomposer Component
 *
 * UI for decomposing non-atomic tasks into subtasks.
 * Part of: Task System V2 Implementation Plan (IMPL-7.11)
 */

import { useState, useEffect } from 'react'
import {
  Scissors,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  RefreshCw,
  Wand2
} from 'lucide-react'

interface ProposedSubtask {
  title: string
  description?: string
  category: string
  estimatedEffort: string
  fileImpacts: string[]
  acceptanceCriteria: string[]
}

interface DecompositionResult {
  originalTaskId: string
  subtasks: ProposedSubtask[]
  reasoning: string
  estimatedTotalEffort: string
}

interface TaskDecomposerProps {
  taskId: string
  taskTitle: string
  onDecompose?: (subtaskIds: string[]) => void
  onCancel?: () => void
}

export default function TaskDecomposer({ taskId, taskTitle, onDecompose, onCancel }: TaskDecomposerProps) {
  const [decomposition, setDecomposition] = useState<DecompositionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editedSubtasks, setEditedSubtasks] = useState<ProposedSubtask[]>([])
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  const generateDecomposition = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/decompose`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to generate decomposition')

      const result = await response.json()
      setDecomposition(result)
      setEditedSubtasks(result.subtasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const executeDecomposition = async () => {
    try {
      setExecuting(true)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/decompose/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtasks: editedSubtasks })
      })

      if (!response.ok) throw new Error('Failed to create subtasks')

      const result = await response.json()
      onDecompose?.(result.subtaskIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setExecuting(false)
    }
  }

  const updateSubtask = (index: number, updates: Partial<ProposedSubtask>) => {
    const newSubtasks = [...editedSubtasks]
    newSubtasks[index] = { ...newSubtasks[index], ...updates }
    setEditedSubtasks(newSubtasks)
  }

  const removeSubtask = (index: number) => {
    setEditedSubtasks(editedSubtasks.filter((_, i) => i !== index))
  }

  const addSubtask = () => {
    setEditedSubtasks([
      ...editedSubtasks,
      {
        title: 'New Subtask',
        description: '',
        category: 'feature',
        estimatedEffort: 'small',
        fileImpacts: [],
        acceptanceCriteria: []
      }
    ])
    setExpandedIndex(editedSubtasks.length)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Scissors className="h-5 w-5 text-gray-400" />
            Decompose Task
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Breaking down: <span className="font-medium">{taskTitle}</span>
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Generate Button */}
      {!decomposition && (
        <div className="text-center py-8">
          <Scissors className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 mb-4">
            Generate AI-suggested subtasks for this non-atomic task
          </p>
          <button
            onClick={generateDecomposition}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mx-auto"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {loading ? 'Analyzing...' : 'Generate Subtasks'}
          </button>
        </div>
      )}

      {/* Decomposition Result */}
      {decomposition && (
        <>
          {/* Reasoning */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">{decomposition.reasoning}</p>
            <p className="text-xs text-blue-600 mt-1">
              Estimated total effort: {decomposition.estimatedTotalEffort}
            </p>
          </div>

          {/* Subtasks List */}
          <div className="space-y-2">
            {editedSubtasks.map((subtask, index) => {
              const isExpanded = expandedIndex === index

              return (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Subtask Header */}
                  <div className="flex items-center gap-2 p-3 bg-gray-50">
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : index)}
                      className="flex-1 flex items-center gap-2"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="font-medium text-gray-900">{subtask.title}</span>
                      <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded">
                        {subtask.estimatedEffort}
                      </span>
                    </button>
                    <button
                      onClick={() => removeSubtask(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Expanded Edit Form */}
                  {isExpanded && (
                    <div className="p-4 space-y-3 border-t border-gray-100">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={subtask.title}
                          onChange={e => updateSubtask(index, { title: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={subtask.description || ''}
                          onChange={e => updateSubtask(index, { description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Category
                          </label>
                          <select
                            value={subtask.category}
                            onChange={e => updateSubtask(index, { category: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="feature">Feature</option>
                            <option value="bug">Bug Fix</option>
                            <option value="enhancement">Enhancement</option>
                            <option value="refactor">Refactor</option>
                            <option value="test">Test</option>
                            <option value="docs">Documentation</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Effort
                          </label>
                          <select
                            value={subtask.estimatedEffort}
                            onChange={e => updateSubtask(index, { estimatedEffort: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          >
                            <option value="tiny">Tiny (~5 min)</option>
                            <option value="small">Small (~15 min)</option>
                            <option value="medium">Medium (~30 min)</option>
                            <option value="large">Large (~1 hour)</option>
                            <option value="xlarge">XLarge (~2+ hours)</option>
                          </select>
                        </div>
                      </div>

                      {/* File Impacts */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          File Impacts
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {subtask.fileImpacts.map((file, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                            >
                              {file}
                            </span>
                          ))}
                          {subtask.fileImpacts.length === 0 && (
                            <span className="text-xs text-gray-400">No file impacts specified</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add Subtask */}
          <button
            onClick={addSubtask}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Subtask
          </button>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={generateDecomposition}
              disabled={loading}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
            <button
              onClick={executeDecomposition}
              disabled={executing || editedSubtasks.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {executing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create {editedSubtasks.length} Subtasks
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}
