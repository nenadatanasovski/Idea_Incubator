/**
 * TaskListPanel.tsx
 * Displays the list of build tasks with their status
 */

import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  SkipForward,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import type { TaskDefinition, TaskStatus } from '../../hooks/useBuildSession';

interface TaskListPanelProps {
  tasks: TaskDefinition[];
  completedTasks: string[];
  failedTasks: string[];
  currentTaskIndex: number;
  currentAttempt: number;
  isActive: boolean;
}

export function TaskListPanel({
  tasks,
  completedTasks,
  failedTasks,
  currentTaskIndex,
  currentAttempt,
  isActive,
}: TaskListPanelProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Determine task status
  const getTaskStatus = (task: TaskDefinition, index: number): TaskStatus => {
    if (completedTasks.includes(task.id)) return 'completed';
    if (failedTasks.includes(task.id)) return 'failed';
    if (index === currentTaskIndex && isActive) return 'running';
    return 'pending';
  };

  // Get task type config
  const typeConfig: Record<TaskDefinition['type'], { icon: string; color: string }> = {
    setup: { icon: '⚙️', color: 'text-gray-600' },
    database: { icon: '🗄️', color: 'text-blue-600' },
    api: { icon: '🔌', color: 'text-green-600' },
    ui: { icon: '🎨', color: 'text-purple-600' },
    integration: { icon: '🔗', color: 'text-amber-600' },
    test: { icon: '🧪', color: 'text-cyan-600' },
  };

  // Group tasks by type for summary
  const tasksByType = tasks.reduce((acc, task) => {
    if (!acc[task.type]) acc[task.type] = { total: 0, completed: 0 };
    acc[task.type].total++;
    if (completedTasks.includes(task.id)) acc[task.type].completed++;
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  return (
    <div className="h-full flex flex-col">
      {/* Summary by type */}
      <div className="p-3 border-b bg-gray-50 shrink-0">
        <div className="flex flex-wrap gap-2">
          {Object.entries(tasksByType).map(([type, counts]) => {
            const config = typeConfig[type as TaskDefinition['type']];
            return (
              <span
                key={type}
                className={clsx(
                  'text-xs px-2 py-1 rounded-full bg-white border',
                  config?.color
                )}
              >
                {config?.icon} {counts.completed}/{counts.total}
              </span>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y">
          {tasks.map((task, index) => {
            const status = getTaskStatus(task, index);
            const isCurrent = index === currentTaskIndex && isActive;
            const isExpanded = expandedTask === task.id;
            const config = typeConfig[task.type];

            return (
              <div
                key={task.id}
                className={clsx(
                  'transition-colors',
                  isCurrent && 'bg-blue-50',
                  status === 'completed' && 'bg-green-50/50',
                  status === 'failed' && 'bg-red-50/50'
                )}
              >
                {/* Task header */}
                <button
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50/50"
                >
                  {/* Status icon */}
                  <StatusIcon status={status} />

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{config?.icon}</span>
                      <span
                        className={clsx(
                          'font-medium text-sm truncate',
                          status === 'completed' && 'text-green-700',
                          status === 'failed' && 'text-red-700',
                          status === 'running' && 'text-blue-700',
                          status === 'pending' && 'text-gray-700'
                        )}
                      >
                        {task.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{task.description}</p>
                  </div>

                  {/* Attempt indicator */}
                  {isCurrent && currentAttempt > 1 && (
                    <span className="text-xs text-amber-600 shrink-0">
                      Attempt {currentAttempt}
                    </span>
                  )}

                  {/* Estimated time */}
                  <span className="text-xs text-gray-400 shrink-0">
                    ~{task.estimatedMinutes}m
                  </span>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t bg-white/50">
                    {/* Technical details */}
                    {task.technicalDetails && (
                      <div>
                        <span className="text-xs font-medium text-gray-500">
                          Technical Details
                        </span>
                        <p className="text-xs text-gray-700 mt-0.5">
                          {task.technicalDetails}
                        </p>
                      </div>
                    )}

                    {/* Dependencies */}
                    {task.dependencies.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500">
                          Dependencies
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {task.dependencies.map((depId) => {
                            const depTask = tasks.find((t) => t.id === depId);
                            return (
                              <span
                                key={depId}
                                className="text-xs px-1.5 py-0.5 bg-gray-100 rounded"
                              >
                                {depTask?.name || depId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Test criteria */}
                    {task.testCriteria.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-500">
                          Test Criteria
                        </span>
                        <ul className="text-xs text-gray-700 mt-0.5 space-y-0.5">
                          {task.testCriteria.map((criterion, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-gray-400">•</span>
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />;
    case 'skipped':
      return <SkipForward className="w-5 h-5 text-gray-400 shrink-0" />;
    case 'pending':
    default:
      return <Circle className="w-5 h-5 text-gray-300 shrink-0" />;
  }
}

export default TaskListPanel;
