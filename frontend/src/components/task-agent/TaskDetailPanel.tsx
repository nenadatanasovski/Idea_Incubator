/**
 * Task Detail Panel Component
 *
 * Combined view showing all task details, impacts, versions, tests.
 * Part of: Task System V2 Implementation Plan (IMPL-7.14)
 */

import { useState, useEffect } from 'react'
import {
  FileText,
  Layers,
  History,
  TestTube,
  Workflow,
  FileCode,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  X
} from 'lucide-react'

import TaskImpactViewer from './TaskImpactViewer'
import TaskAppendixEditor from './TaskAppendixEditor'
import TaskVersionViewer from './TaskVersionViewer'
import TaskTestViewer from './TaskTestViewer'
import TaskStateHistory from './TaskStateHistory'
import CascadeEffectViewer from './CascadeEffectViewer'
import QuestionEnginePanel from './QuestionEnginePanel'
import PriorityDisplay from './PriorityDisplay'
import AtomicityWarning from './AtomicityWarning'
import TaskDecomposer from './TaskDecomposer'

interface Task {
  id: string
  displayId: string
  title: string
  description?: string
  category: string
  priority: string
  effort: string
  status: string
  taskListId?: string
  createdAt: string
  updatedAt: string
}

type TabId = 'overview' | 'impacts' | 'appendices' | 'versions' | 'tests' | 'history' | 'cascade' | 'questions'

interface TaskDetailPanelProps {
  taskId: string
  onClose?: () => void
  initialTab?: TabId
}

const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'impacts', label: 'Impacts', icon: Layers },
  { id: 'appendices', label: 'Appendices', icon: FileCode },
  { id: 'versions', label: 'Versions', icon: History },
  { id: 'tests', label: 'Tests', icon: TestTube },
  { id: 'history', label: 'History', icon: History },
  { id: 'cascade', label: 'Cascade', icon: Workflow },
  { id: 'questions', label: 'Questions', icon: HelpCircle }
]

export default function TaskDetailPanel({ taskId, onClose, initialTab = 'overview' }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [showDecomposer, setShowDecomposer] = useState(false)

  useEffect(() => {
    fetchTask()
  }, [taskId])

  const fetchTask = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/task-agent/tasks/${taskId}`)
      if (!response.ok) throw new Error('Task not found')
      setTask(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error || 'Task not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-blue-600">{task.displayId}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                task.status === 'completed' ? 'bg-green-100 text-green-700' :
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                task.status === 'failed' ? 'bg-red-100 text-red-700' :
                task.status === 'blocked' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {task.status}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mt-1">{task.title}</h2>
            {task.description && (
              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <span className="text-gray-500">Category: <span className="text-gray-700">{task.category}</span></span>
          <span className="text-gray-500">Priority: <span className="text-gray-700">{task.priority}</span></span>
          <span className="text-gray-500">Effort: <span className="text-gray-700">{task.effort}</span></span>
        </div>

        {/* Atomicity Warning */}
        <div className="mt-3">
          <AtomicityWarning
            taskId={taskId}
            compact
            onDecompose={() => setShowDecomposer(true)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => {
            const TabIcon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showDecomposer ? (
          <TaskDecomposer
            taskId={taskId}
            taskTitle={task.title}
            onDecompose={() => {
              setShowDecomposer(false)
              fetchTask()
            }}
            onCancel={() => setShowDecomposer(false)}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Priority Display */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                    Priority Score
                  </h3>
                  <PriorityDisplay taskId={taskId} />
                </div>

                {/* Atomicity Full View */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-gray-400" />
                    Atomicity Check
                  </h3>
                  <AtomicityWarning
                    taskId={taskId}
                    onDecompose={() => setShowDecomposer(true)}
                  />
                </div>

                {/* Metadata */}
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
                  <p>Updated: {new Date(task.updatedAt).toLocaleString()}</p>
                  {task.taskListId && (
                    <p>Task List: {task.taskListId.slice(0, 8)}</p>
                  )}
                  <p className="font-mono text-xs text-gray-400">ID: {task.id}</p>
                </div>
              </div>
            )}

            {activeTab === 'impacts' && (
              <TaskImpactViewer taskId={taskId} />
            )}

            {activeTab === 'appendices' && (
              <TaskAppendixEditor taskId={taskId} />
            )}

            {activeTab === 'versions' && (
              <TaskVersionViewer taskId={taskId} />
            )}

            {activeTab === 'tests' && (
              <TaskTestViewer taskId={taskId} />
            )}

            {activeTab === 'history' && (
              <TaskStateHistory taskId={taskId} />
            )}

            {activeTab === 'cascade' && (
              <CascadeEffectViewer taskId={taskId} />
            )}

            {activeTab === 'questions' && (
              <QuestionEnginePanel taskId={taskId} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
