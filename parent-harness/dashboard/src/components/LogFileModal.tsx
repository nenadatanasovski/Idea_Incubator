/**
 * LogFileModal - Fullscreen modal for viewing agent log file contents
 * Displays log files with syntax highlighting, filtering, and iteration navigation
 * Ported from Vibe Platform for parent-harness dashboard.
 */

import { useState, useEffect, useRef } from 'react';
import type { LoopIteration, AgentSessionStatus } from '../types/pipeline';
import { formatTime as formatTimeSydney, sydneyTimestamp } from '../utils/format';

interface LogFileModalProps {
  logFileId: string;
  sessionName: string;
  iteration: number;
  content: string;
  allIterations?: LoopIteration[];
  onClose: () => void;
  onNavigateIteration?: (logFileId: string, iteration: number) => void;
}

// Log line type for syntax highlighting
type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' | 'TASK' | 'CHECKPOINT' | 'PAUSE' | 'DEBUG';

interface ParsedLogLine {
  timestamp: string;
  level: LogLevel;
  message: string;
  raw: string;
}

function parseLogLine(line: string): ParsedLogLine | null {
  const match = line.match(/^\[([^\]]+)\]\s+\[([A-Z]+)\]\s+(.*)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: match[2] as LogLevel,
      message: match[3],
      raw: line,
    };
  }
  if (line.trim()) {
    return {
      timestamp: '',
      level: 'INFO',
      message: line,
      raw: line,
    };
  }
  return null;
}

function getLevelConfig(level: LogLevel): { icon: string; color: string } {
  const configs: Record<LogLevel, { icon: string; color: string }> = {
    INFO: { icon: 'ℹ️', color: 'text-blue-400' },
    SUCCESS: { icon: '✅', color: 'text-green-400' },
    ERROR: { icon: '❌', color: 'text-red-400' },
    WARN: { icon: '⚠️', color: 'text-yellow-400' },
    TASK: { icon: '📋', color: 'text-purple-400' },
    CHECKPOINT: { icon: '🔖', color: 'text-indigo-400' },
    PAUSE: { icon: '⏸️', color: 'text-orange-400' },
    DEBUG: { icon: '🔍', color: 'text-gray-400' },
  };
  return configs[level] || configs.INFO;
}

function getIterationStatusIcon(status: AgentSessionStatus): string {
  switch (status) {
    case 'running': return '▶️';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'paused': return '⏸️';
    default: return 'ℹ️';
  }
}

function getIterationStatusColor(status: AgentSessionStatus): string {
  switch (status) {
    case 'running': return 'text-blue-400 bg-blue-900/50';
    case 'completed': return 'text-green-400 bg-green-900/50';
    case 'failed': return 'text-red-400 bg-red-900/50';
    case 'paused': return 'text-orange-400 bg-orange-900/50';
    default: return 'text-gray-400 bg-gray-900/50';
  }
}

export function LogFileModal({
  logFileId,
  sessionName,
  iteration,
  content,
  allIterations,
  onClose,
  onNavigateIteration,
}: LogFileModalProps) {
  const [copied, setCopied] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse log lines
  const parsedLines = content
    .split('\n')
    .map(parseLogLine)
    .filter(Boolean) as ParsedLogLine[];

  // Filter lines
  const filteredLines = parsedLines.filter(
    (line) => filterLevel === 'ALL' || line.level === filterLevel,
  );

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download as file
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${logFileId}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle escape key and arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (allIterations && onNavigateIteration) {
        const currentIndex = allIterations.findIndex((i) => i.iteration === iteration);
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          const prev = allIterations[currentIndex - 1];
          onNavigateIteration(prev.logFileId, prev.iteration);
        }
        if (e.key === 'ArrowRight' && currentIndex < allIterations.length - 1) {
          const next = allIterations[currentIndex + 1];
          onNavigateIteration(next.logFileId, next.iteration);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, allIterations, iteration, onNavigateIteration]);

  // Stats
  const stats = {
    total: parsedLines.length,
    errors: parsedLines.filter((l) => l.level === 'ERROR').length,
    warnings: parsedLines.filter((l) => l.level === 'WARN').length,
    tasks: parsedLines.filter((l) => l.level === 'TASK').length,
    success: parsedLines.filter((l) => l.level === 'SUCCESS').length,
  };

  // Navigation
  const currentIndex = allIterations?.findIndex((i) => i.iteration === iteration);
  const hasPrev = currentIndex !== undefined && currentIndex > 0;
  const hasNext = currentIndex !== undefined && allIterations && currentIndex < allIterations.length - 1;

  const navigatePrev = () => {
    if (hasPrev && allIterations && onNavigateIteration && currentIndex) {
      const prev = allIterations[currentIndex - 1];
      onNavigateIteration(prev.logFileId, prev.iteration);
    }
  };

  const navigateNext = () => {
    if (hasNext && allIterations && onNavigateIteration && currentIndex !== undefined) {
      const next = allIterations[currentIndex + 1];
      onNavigateIteration(next.logFileId, next.iteration);
    }
  };

  const navigateToIteration = (iter: LoopIteration) => {
    if (onNavigateIteration) {
      onNavigateIteration(iter.logFileId, iter.iteration);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Fullscreen modal */}
      <div
        className="relative flex flex-col w-full h-full bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-700 rounded-lg">
              <span className="text-2xl">📄</span>
            </div>
            <div>
              <h3 className="text-xl font-medium text-white flex items-center gap-3">
                {logFileId}
                <span className="px-2 py-0.5 rounded-full text-sm bg-gray-700 text-gray-300">
                  Iteration #{iteration}
                </span>
              </h3>
              <p className="text-sm text-gray-400">{sessionName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation arrows */}
            {allIterations && allIterations.length > 1 && (
              <div className="flex items-center gap-1 mr-4">
                <button
                  onClick={navigatePrev}
                  disabled={!hasPrev}
                  className={`p-2 rounded-lg transition-colors ${
                    hasPrev
                      ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                  title="Previous iteration (←)"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm text-gray-400 px-2">
                  {(currentIndex ?? 0) + 1} / {allIterations.length}
                </span>
                <button
                  onClick={navigateNext}
                  disabled={!hasNext}
                  className={`p-2 rounded-lg transition-colors ${
                    hasNext
                      ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                  title="Next iteration (→)"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            <button
              onClick={handleCopy}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? '✓' : '📋'}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Download log file"
            >
              ⬇️
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors ml-2"
              title="Close (ESC)"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Iteration sidebar */}
          {allIterations && allIterations.length > 1 && (
            <div className="w-64 border-r border-gray-700 bg-gray-800 overflow-y-auto">
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Iterations
                </h4>
                <div className="space-y-2">
                  {allIterations.map((iter) => {
                    const isActive = iter.iteration === iteration;
                    return (
                      <button
                        key={iter.iteration}
                        onClick={() => navigateToIteration(iter)}
                        className={`
                          w-full text-left p-3 rounded-lg transition-colors
                          ${isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Loop #{iter.iteration}</span>
                          <span
                            className={`
                              flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                              ${isActive ? 'bg-white/20' : getIterationStatusColor(iter.status)}
                            `}
                          >
                            {getIterationStatusIcon(iter.status)} {iter.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs opacity-80">
                          <span className="flex items-center gap-1">
                            ✓ {iter.tasksCompleted}
                          </span>
                          {iter.tasksFailed > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              ✗ {iter.tasksFailed}
                            </span>
                          )}
                          {iter.duration && (
                            <span>{Math.round(iter.duration / 1000)}s</span>
                          )}
                        </div>
                        {iter.errors && iter.errors.length > 0 && (
                          <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                            ⚠️ {iter.errors.length} error(s)
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-400">{stats.total} lines</span>
                {stats.success > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    ✅ {stats.success} success
                  </span>
                )}
                {stats.tasks > 0 && (
                  <span className="flex items-center gap-1 text-purple-400">
                    📋 {stats.tasks} tasks
                  </span>
                )}
                {stats.warnings > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    ⚠️ {stats.warnings} warnings
                  </span>
                )}
                {stats.errors > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    ❌ {stats.errors} errors
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Filter:</span>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'ALL')}
                  className="text-sm bg-gray-700 text-gray-300 border-gray-600 rounded-md px-3 py-1.5"
                >
                  <option value="ALL">All Levels</option>
                  <option value="INFO">Info</option>
                  <option value="SUCCESS">Success</option>
                  <option value="TASK">Tasks</option>
                  <option value="WARN">Warnings</option>
                  <option value="ERROR">Errors</option>
                  <option value="CHECKPOINT">Checkpoints</option>
                </select>
              </div>
            </div>

            {/* Log content */}
            <div
              ref={contentRef}
              className="flex-1 overflow-auto p-6 font-mono text-sm"
            >
              <div className="space-y-1">
                {filteredLines.map((line, idx) => {
                  const config = getLevelConfig(line.level);

                  return (
                    <div
                      key={idx}
                      className={`
                        flex items-start gap-3 px-3 py-1.5 rounded
                        ${line.level === 'ERROR' ? 'bg-red-900/20' : ''}
                        ${line.level === 'WARN' ? 'bg-yellow-900/20' : ''}
                      `}
                    >
                      {line.timestamp && (
                        <span className="text-gray-500 text-xs whitespace-nowrap w-20">
                          {formatTimestamp(line.timestamp)}
                        </span>
                      )}
                      <span className="flex-shrink-0">{config.icon}</span>
                      <span
                        className={`
                          flex-1
                          ${line.level === 'ERROR' ? 'text-red-300' : ''}
                          ${line.level === 'WARN' ? 'text-yellow-300' : ''}
                          ${line.level === 'SUCCESS' ? 'text-green-300' : ''}
                          ${line.level === 'TASK' ? 'text-purple-300' : ''}
                          ${line.level === 'INFO' ? 'text-gray-300' : ''}
                          ${line.level === 'CHECKPOINT' ? 'text-indigo-300' : ''}
                          ${line.level === 'PAUSE' ? 'text-orange-300' : ''}
                        `}
                      >
                        {highlightMessage(line.message)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {filteredLines.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <span className="text-6xl block mb-4">📄</span>
                  <p className="text-lg">No log entries matching filter</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-700 bg-gray-800 text-sm text-gray-500 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>Press ESC to close</span>
                {allIterations && allIterations.length > 1 && (
                  <span>Use ← → to navigate iterations</span>
                )}
              </div>
              <span>{sydneyTimestamp()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
  try {
    return formatTimeSydney(timestamp);
  } catch {
    return timestamp.slice(11, 19);
  }
}

// Highlight special patterns in messages
function highlightMessage(message: string): React.ReactNode {
  const parts = message.split(/(✓|✗|▶|⏸|⚠)/g);

  return parts.map((part, idx) => {
    if (part === '✓') {
      return <span key={idx} className="text-green-400">{part}</span>;
    }
    if (part === '✗') {
      return <span key={idx} className="text-red-400">{part}</span>;
    }
    if (part === '▶') {
      return <span key={idx} className="text-blue-400">{part}</span>;
    }
    if (part === '⏸') {
      return <span key={idx} className="text-orange-400">{part}</span>;
    }
    if (part === '⚠') {
      return <span key={idx} className="text-yellow-400">{part}</span>;
    }
    return part;
  });
}

export default LogFileModal;
