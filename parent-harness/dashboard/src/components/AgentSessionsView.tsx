/**
 * AgentSessionsView - View for tracking agent sessions, lineage, and log files
 * Table-based layout with horizontal loop iteration display
 * Ported from Vibe Platform for parent-harness dashboard.
 */

import { useState, useMemo } from 'react';
import type { Session } from '../hooks/useSessions';
import { LogFileModal } from './LogFileModal';
import type { AgentSessionStatus, LoopIteration } from '../types/pipeline';

interface AgentSessionsViewProps {
  sessions: Session[];
  className?: string;
}

export function AgentSessionsView({ sessions, className = '' }: AgentSessionsViewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedLogFile, setSelectedLogFile] = useState<{
    id: string;
    sessionName: string;
    iteration: number;
    allIterations: LoopIteration[];
    content: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgentSessionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build lineage map (parent -> children)
  const sessionLineageMap = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach((session) => {
      if (session.parent_session_id) {
        const children = map.get(session.parent_session_id) || [];
        children.push(session);
        map.set(session.parent_session_id, children);
      }
    });
    return map;
  }, [sessions]);

  // Filter sessions (only root sessions - those without parents)
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.parent_session_id) return false;
      if (statusFilter !== 'all' && session.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          session.agent_id.toLowerCase().includes(query) ||
          session.id.toLowerCase().includes(query) ||
          (session.task_id?.toLowerCase().includes(query) ?? false)
        );
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  const toggleRow = (sessionId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedRows(newExpanded);
  };

  const statusCounts = useMemo(() => {
    return {
      running: sessions.filter((s) => s.status === 'running').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      failed: sessions.filter((s) => s.status === 'failed').length,
      paused: sessions.filter((s) => s.status === 'paused').length,
    };
  }, [sessions]);

  // Generate mock iterations for a session
  const generateIterations = (session: Session): LoopIteration[] => {
    const iterations: LoopIteration[] = [];
    const startTime = new Date(session.started_at).getTime();
    
    for (let i = 1; i <= session.current_iteration; i++) {
      const isLast = i === session.current_iteration;
      const iterStart = new Date(startTime + (i - 1) * 300000).toISOString();
      const iterEnd = isLast && session.status === 'running' 
        ? undefined 
        : new Date(startTime + i * 300000).toISOString();
      
      iterations.push({
        iteration: i,
        startedAt: iterStart,
        completedAt: iterEnd,
        status: isLast ? (session.status as AgentSessionStatus) : 'completed',
        tasksCompleted: Math.floor(session.tasks_completed / session.current_iteration),
        tasksFailed: i === session.current_iteration ? session.tasks_failed : 0,
        duration: iterEnd ? 300000 : undefined,
        logFileId: `${session.id}-iter-${i}`,
        logFilePreview: `Iteration ${i} log preview...`,
      });
    }
    return iterations;
  };

  const openLogModal = (session: Session, iteration: number) => {
    const iterations = generateIterations(session);
    const iter = iterations.find(i => i.iteration === iteration);
    if (iter) {
      setSelectedLogFile({
        id: iter.logFileId,
        sessionName: session.agent_id,
        iteration,
        allIterations: iterations,
        content: generateMockLogContent(session, iteration),
      });
    }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex-1 bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col min-h-0 border border-gray-700">
        {/* Header with stats and filters */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-700">
          {/* Compact stats */}
          <div className="flex items-center gap-3">
            <StatBadge label="Running" value={statusCounts.running} color="blue" icon="▶️" />
            <StatBadge label="Completed" value={statusCounts.completed} color="green" icon="✅" />
            <StatBadge label="Failed" value={statusCounts.failed} color="red" icon="❌" />
            <StatBadge label="Paused" value={statusCounts.paused} color="orange" icon="⏸️" />
          </div>

          <div className="w-px h-6 bg-gray-700" />

          {/* Filter dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">🔍</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AgentSessionStatus | 'all')}
              className="text-sm bg-gray-700 text-gray-300 border-gray-600 rounded-md py-1 px-2"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-gray-700 text-gray-300 border-gray-600 rounded-md py-1 px-3"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto max-h-[calc(100vh-340px)]">
          <table className="w-full">
            <thead className="bg-gray-900 sticky top-0 z-10">
              <tr className="border-b border-gray-700">
                <th className="w-10 px-3 py-3"></th>
                <th className="min-w-[180px] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Agent
                </th>
                <th className="min-w-[140px] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Task
                </th>
                <th className="min-w-[100px] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="min-w-[70px] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Loop
                </th>
                <th className="min-w-[90px] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="min-w-[80px] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <span className="text-4xl block mb-2">🔗</span>
                    <p>No agent sessions found</p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    childSessions={sessionLineageMap.get(session.id) || []}
                    isExpanded={expandedRows.has(session.id)}
                    onToggle={() => toggleRow(session.id)}
                    onViewLog={(iteration) => openLogModal(session, iteration)}
                    expandedRows={expandedRows}
                    onToggleChild={(id) => toggleRow(id)}
                    sessionLineageMap={sessionLineageMap}
                    depth={0}
                    generateIterations={generateIterations}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log file modal */}
      {selectedLogFile && (
        <LogFileModal
          logFileId={selectedLogFile.id}
          sessionName={selectedLogFile.sessionName}
          iteration={selectedLogFile.iteration}
          content={selectedLogFile.content}
          allIterations={selectedLogFile.allIterations}
          onClose={() => setSelectedLogFile(null)}
          onNavigateIteration={(newLogFileId, newIteration) =>
            setSelectedLogFile((prev) =>
              prev
                ? { 
                    ...prev, 
                    id: newLogFileId, 
                    iteration: newIteration,
                    content: generateMockLogContent({ id: prev.id } as Session, newIteration)
                  }
                : null,
            )
          }
        />
      )}
    </div>
  );
}

// Generate mock log content
function generateMockLogContent(session: Session, iteration: number): string {
  return `[${new Date().toISOString()}] [INFO] Session ${session.id} - Iteration ${iteration}
[${new Date().toISOString()}] [INFO] Starting task execution...
[${new Date().toISOString()}] [TASK] Processing tasks from queue
[${new Date().toISOString()}] [SUCCESS] ✓ Task completed successfully
[${new Date().toISOString()}] [INFO] Iteration ${iteration} finished`;
}

// Stat Badge Component
interface StatBadgeProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'orange';
  icon: string;
}

function StatBadge({ label, value, color, icon }: StatBadgeProps) {
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
  };

  return (
    <div className={`flex items-center gap-1.5 ${colors[color]}`}>
      <span>{icon}</span>
      <span className="font-semibold">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// Session Row Component
interface SessionRowProps {
  session: Session;
  childSessions: Session[];
  isExpanded: boolean;
  onToggle: () => void;
  onViewLog: (iteration: number) => void;
  expandedRows: Set<string>;
  onToggleChild: (id: string) => void;
  sessionLineageMap: Map<string, Session[]>;
  depth: number;
  generateIterations: (session: Session) => LoopIteration[];
}

function SessionRow({
  session,
  childSessions,
  isExpanded,
  onToggle,
  onViewLog,
  expandedRows,
  onToggleChild,
  sessionLineageMap,
  depth,
  generateIterations,
}: SessionRowProps) {
  const statusConfig = {
    starting: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', icon: '🔄' },
    running: { bg: 'bg-blue-900/50', text: 'text-blue-300', icon: '▶️' },
    completed: { bg: 'bg-green-900/50', text: 'text-green-300', icon: '✅' },
    failed: { bg: 'bg-red-900/50', text: 'text-red-300', icon: '❌' },
    paused: { bg: 'bg-orange-900/50', text: 'text-orange-300', icon: '⏸️' },
  };

  const config = statusConfig[session.status] || statusConfig.starting;
  const iterations = generateIterations(session);

  return (
    <>
      {/* Main row */}
      <tr
        className={`hover:bg-gray-700 cursor-pointer transition-colors ${isExpanded ? config.bg : ''}`}
        onClick={onToggle}
      >
        <td className="w-10 px-3 py-3">
          <button className="p-1 hover:bg-gray-600 rounded">
            {isExpanded ? (
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </td>
        <td className="min-w-[180px] px-4 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
            {depth > 0 && <span className="text-indigo-400">↳</span>}
            <span className="text-lg">🤖</span>
            <span className="font-medium text-gray-200 truncate">{session.agent_id}</span>
          </div>
        </td>
        <td className="min-w-[140px] px-4 py-3 text-sm text-gray-400">
          <span className="truncate block">{session.task_id?.slice(0, 8) || '-'}...</span>
        </td>
        <td className="min-w-[100px] px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            {config.icon} {session.status}
          </span>
        </td>
        <td className="min-w-[70px] px-4 py-3">
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span className="font-medium">{session.current_iteration}</span>
            <span className="text-gray-600">/</span>
            <span>{session.total_iterations || '∞'}</span>
          </div>
        </td>
        <td className="min-w-[90px] px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-green-400">
              ✓ {session.tasks_completed}
            </span>
            {session.tasks_failed > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                ✗ {session.tasks_failed}
              </span>
            )}
          </div>
        </td>
        <td className="min-w-[80px] px-4 py-3 text-sm text-gray-500">
          {new Date(session.started_at).toLocaleTimeString()}
        </td>
      </tr>

      {/* Expanded row with horizontal loops */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-4 py-4 bg-gray-900">
            <div className="space-y-4">
              {/* Session ID */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="font-mono">ID: {session.id}</span>
                {session.parent_session_id && (
                  <span className="flex items-center gap-1">
                    ↳ Parent: {session.parent_session_id.slice(0, 8)}...
                  </span>
                )}
              </div>

              {/* Horizontal loop iterations */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gray-400">🔄</span>
                  <span className="text-sm font-medium text-gray-300">Loop Iterations</span>
                </div>
                <div className="w-full">
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-3 w-max">
                      {iterations.map((iteration) => (
                        <IterationCard
                          key={iteration.iteration}
                          iteration={iteration}
                          isLatest={iteration.iteration === session.current_iteration}
                          onViewLog={() => onViewLog(iteration.iteration)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Child sessions */}
              {childSessions.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-indigo-400">🔗</span>
                    <span className="text-sm font-medium text-gray-300">
                      Spawned Sessions ({childSessions.length})
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    <table className="w-full">
                      <tbody className="divide-y divide-gray-700">
                        {childSessions.map((child) => (
                          <SessionRow
                            key={child.id}
                            session={child}
                            childSessions={sessionLineageMap.get(child.id) || []}
                            isExpanded={expandedRows.has(child.id)}
                            onToggle={() => onToggleChild(child.id)}
                            onViewLog={(iter) => onViewLog(iter)}
                            expandedRows={expandedRows}
                            onToggleChild={onToggleChild}
                            sessionLineageMap={sessionLineageMap}
                            depth={depth + 1}
                            generateIterations={generateIterations}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Iteration Card Component
interface IterationCardProps {
  iteration: LoopIteration;
  isLatest: boolean;
  onViewLog: () => void;
}

function IterationCard({ iteration, isLatest, onViewLog }: IterationCardProps) {
  const statusColors = {
    running: { border: 'border-blue-500', bg: 'bg-blue-900/30', header: 'bg-blue-900/50', text: 'text-blue-300' },
    completed: { border: 'border-green-500', bg: 'bg-green-900/30', header: 'bg-green-900/50', text: 'text-green-300' },
    failed: { border: 'border-red-500', bg: 'bg-red-900/30', header: 'bg-red-900/50', text: 'text-red-300' },
    paused: { border: 'border-orange-500', bg: 'bg-orange-900/30', header: 'bg-orange-900/50', text: 'text-orange-300' },
    cancelled: { border: 'border-gray-500', bg: 'bg-gray-900/30', header: 'bg-gray-900/50', text: 'text-gray-300' },
  };

  const colors = statusColors[iteration.status];

  return (
    <div
      className={`
        flex-shrink-0 w-64 rounded-lg border-2 overflow-hidden
        ${colors.border}
        ${isLatest ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}
      `}
    >
      {/* Header */}
      <div className={`px-3 py-2 flex items-center justify-between ${colors.header}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${colors.text}`}>
            #{iteration.iteration}
          </span>
          {iteration.status === 'running' && (
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
        </div>
        <span className={`text-xs font-medium ${colors.text}`}>
          {iteration.status}
        </span>
      </div>

      {/* Body */}
      <div className={`px-3 py-2 space-y-2 ${colors.bg}`}>
        {/* Time and duration */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            🕐 {new Date(iteration.startedAt).toLocaleTimeString()}
          </span>
          {iteration.duration && (
            <span>{Math.round(iteration.duration / 1000)}s</span>
          )}
        </div>

        {/* Task counts */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-400">
            ✓ {iteration.tasksCompleted} done
          </span>
          {iteration.tasksFailed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              ✗ {iteration.tasksFailed} failed
            </span>
          )}
        </div>

        {/* Preview */}
        {iteration.logFilePreview && (
          <div className="text-xs font-mono bg-gray-900 text-gray-400 rounded p-2 max-h-16 overflow-hidden">
            {iteration.logFilePreview.split('\n').slice(0, 2).join('\n')}...
          </div>
        )}

        {/* View log button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewLog();
          }}
          className="w-full flex items-center justify-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded py-1 transition-colors"
        >
          📄 View Log
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default AgentSessionsView;
