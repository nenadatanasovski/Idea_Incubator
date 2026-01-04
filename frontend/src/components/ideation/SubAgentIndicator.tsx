// =============================================================================
// FILE: frontend/src/components/ideation/SubAgentIndicator.tsx
// Visual indicator for sub-agents working on tasks
// =============================================================================

import { useEffect, useState } from 'react';
import { Check, X, Loader2, Clock } from 'lucide-react';
import type { SubAgent, SubAgentStatus, SubAgentIndicatorProps } from '../../types/ideation';

// Status icon component
function StatusIcon({ status }: { status: SubAgentStatus }) {
  switch (status) {
    case 'spawning':
      return <Clock className="w-4 h-4 text-gray-400" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <Check className="w-4 h-4 text-green-500" />;
    case 'failed':
      return <X className="w-4 h-4 text-red-500" />;
  }
}

// Status background color classes
function getStatusClasses(status: SubAgentStatus): string {
  switch (status) {
    case 'spawning':
      return 'bg-gray-50 border-gray-200';
    case 'running':
      return 'bg-blue-50 border-blue-200';
    case 'completed':
      return 'bg-green-50 border-green-200';
    case 'failed':
      return 'bg-red-50 border-red-200';
  }
}

// Status text color classes
function getTextClasses(status: SubAgentStatus): string {
  switch (status) {
    case 'spawning':
      return 'text-gray-500';
    case 'running':
      return 'text-blue-700';
    case 'completed':
      return 'text-green-700';
    case 'failed':
      return 'text-red-700';
  }
}

// Individual agent row component with animation
function AgentRow({ agent, index }: { agent: SubAgent; index: number }) {
  const [isVisible, setIsVisible] = useState(false);

  // Staggered entrance animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * 100); // 100ms delay between each agent
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-md border
        transition-all duration-300 ease-out
        ${getStatusClasses(agent.status)}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
    >
      <div className="flex-shrink-0">
        <StatusIcon status={agent.status} />
      </div>
      <span className={`text-sm font-medium ${getTextClasses(agent.status)}`}>
        {agent.name}
      </span>
      {agent.status === 'running' && (
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}

export function SubAgentIndicator({ agents }: SubAgentIndicatorProps) {
  const [isExiting, setIsExiting] = useState(false);

  // Check if all agents are done (completed or failed)
  const allDone = agents.length > 0 && agents.every(
    (agent) => agent.status === 'completed' || agent.status === 'failed'
  );

  // Trigger exit animation when all done
  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, 1500); // Show completed state for 1.5s before fading
      return () => clearTimeout(timer);
    } else {
      setIsExiting(false);
    }
  }, [allDone]);

  if (agents.length === 0) return null;

  // Calculate progress
  const completed = agents.filter(
    (a) => a.status === 'completed' || a.status === 'failed'
  ).length;
  const total = agents.length;
  const progressPercent = (completed / total) * 100;

  return (
    <div
      className={`
        sub-agent-indicator
        bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden
        transition-all duration-500 ease-out
        ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
      `}
    >
      {/* Header with progress bar */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Sub-agents
          </span>
          <span className="text-xs text-gray-500">
            {completed}/{total} complete
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Agent list */}
      <div className="p-3 space-y-2">
        {agents.map((agent, index) => (
          <AgentRow key={agent.id} agent={agent} index={index} />
        ))}
      </div>
    </div>
  );
}

export default SubAgentIndicator;
