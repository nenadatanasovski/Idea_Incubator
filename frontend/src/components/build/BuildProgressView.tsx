/**
 * BuildProgressView.tsx
 * Main component for the build phase content area
 */

import { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Package,
  XCircle,
  GitCommit,
  FileCode,
} from 'lucide-react';
import clsx from 'clsx';
import { useBuildSession } from '../../hooks/useBuildSession';
import { TaskListPanel } from './TaskListPanel';
import { LiveEventsPanel } from './LiveEventsPanel';

interface BuildProgressViewProps {
  ideaId: string;
}

export function BuildProgressView({ ideaId }: BuildProgressViewProps) {
  const {
    session,
    events,
    isLoading,
    isConnected,
    error,
    startBuild,
    pause,
    resume,
    skip,
    resolve,
    isActive,
    isPaused,
    isComplete,
    needsHuman,
    progressPercent,
    currentTask,
  } = useBuildSession({ ideaId });

  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolution, setResolution] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle resolve submit
  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setIsSubmitting(true);
    const success = await resolve(resolution.trim());
    if (success) {
      setShowResolveDialog(false);
      setResolution('');
    }
    setIsSubmitting(false);
  };

  // No session state - offer to start build
  if (!session && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">Ready to Build</h3>
          <p className="text-gray-600 text-sm mb-4">
            Start the automated build process to generate code based on the specification.
          </p>
          <button
            onClick={startBuild}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Build
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading build status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Status Header */}
      <div className="p-4 border-b bg-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <StatusBadge
              status={session.status}
              isConnected={isConnected}
            />
            <span className="text-sm text-gray-500">
              {session.progress.completed} / {session.progress.total} tasks
            </span>
            {session.siaInterventions > 0 && (
              <span className="text-xs text-purple-600">
                SIA: {session.siaInterventions}x
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {isActive && (
              <button
                onClick={pause}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-1.5"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={resume}
                className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={clsx(
              'h-2 rounded-full transition-all duration-300',
              isComplete ? 'bg-green-500' : 'bg-primary-600'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            {session.generatedFiles} files
          </span>
          <span className="flex items-center gap-1">
            <GitCommit className="w-3 h-3" />
            {session.commits} commits
          </span>
          {currentTask && (
            <span className="flex items-center gap-1 text-blue-600">
              <Loader2 className="w-3 h-3 animate-spin" />
              {currentTask.name}
            </span>
          )}
        </div>
      </div>

      {/* Human Needed Alert */}
      {needsHuman && (
        <div className="p-4 bg-amber-50 border-b shrink-0">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-800">Human intervention needed</h3>
              <p className="text-sm text-amber-700 mt-1">
                The build agent couldn't complete "{currentTask?.name}".
                {session.lastError && (
                  <span className="block mt-1 text-xs text-amber-600">
                    Error: {session.lastError}
                  </span>
                )}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowResolveDialog(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                >
                  I've fixed it
                </button>
                <button
                  onClick={skip}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <SkipForward className="w-4 h-4 inline mr-1" />
                  Skip this task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Banner */}
      {isComplete && (
        <div className="p-4 bg-green-50 border-b shrink-0">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <h3 className="font-medium text-green-800">Build Complete! 🎉</h3>
              <p className="text-sm text-green-700">
                All {session.progress.total} tasks completed successfully.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task List */}
        <div className="flex-1 border-r overflow-hidden">
          <TaskListPanel
            tasks={session.tasks}
            completedTasks={session.completedTasks}
            failedTasks={session.failedTasks}
            currentTaskIndex={session.currentTaskIndex}
            currentAttempt={session.progress.currentAttempt}
            isActive={isActive}
          />
        </div>

        {/* Live Events */}
        <div className="w-80 shrink-0 overflow-hidden bg-gray-50">
          <LiveEventsPanel events={events} isConnected={isConnected} />
        </div>
      </div>

      {/* Resolve Dialog */}
      {showResolveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="font-medium text-gray-900 mb-2">Mark Task as Resolved</h3>
            <p className="text-sm text-gray-600 mb-4">
              Describe what you did to fix "{currentTask?.name}". This will be recorded
              in the git commit.
            </p>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe your resolution..."
              className="w-full p-3 border rounded-md text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={4}
              disabled={isSubmitting}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowResolveDialog(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolution.trim() || isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Mark Resolved
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  isConnected,
}: {
  status: string;
  isConnected: boolean;
}) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'Building', color: 'text-blue-700', bg: 'bg-blue-100' },
    paused: { label: 'Paused', color: 'text-amber-700', bg: 'bg-amber-100' },
    complete: { label: 'Complete', color: 'text-green-700', bg: 'bg-green-100' },
    failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
    human_needed: { label: 'Needs Help', color: 'text-amber-700', bg: 'bg-amber-100' },
  };

  const statusConfig = config[status] || config.active;

  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          'px-2.5 py-1 rounded-full text-xs font-medium',
          statusConfig.bg,
          statusConfig.color
        )}
      >
        {statusConfig.label}
      </span>
      {status === 'active' && (
        <span
          className={clsx(
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          )}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
      )}
    </div>
  );
}

export default BuildProgressView;
