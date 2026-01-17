/**
 * AgentPool Component
 *
 * Displays all Build Agents and their current status.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { Bot, Users } from "lucide-react";
import type { AgentStatus } from "../../types/pipeline";
import { AgentCard } from "./AgentBadge";

interface AgentPoolProps {
  agents: AgentStatus[];
  onAgentClick?: (agent: AgentStatus) => void;
}

export default function AgentPool({ agents, onAgentClick }: AgentPoolProps) {
  const workingAgents = agents.filter((a) => a.status === "working");
  const idleAgents = agents.filter((a) => a.status === "idle");
  const errorAgents = agents.filter((a) => a.status === "error");

  if (agents.length === 0) {
    return (
      <div
        data-testid="agent-pool"
        className="p-4 bg-white rounded-lg border border-gray-200"
      >
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-600">Agent Pool</h3>
        </div>
        <div className="text-center py-4">
          <Bot className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No agents available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="agent-pool"
      className="p-4 bg-white rounded-lg border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Agent Pool</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-blue-600">{workingAgents.length} working</span>
          <span className="text-gray-500">{idleAgents.length} idle</span>
          {errorAgents.length > 0 && (
            <span className="text-red-600">{errorAgents.length} error</span>
          )}
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onClick={onAgentClick} />
        ))}
      </div>
    </div>
  );
}

// Compact variant for smaller spaces
interface AgentPoolCompactProps {
  agents: AgentStatus[];
}

export function AgentPoolCompact({ agents }: AgentPoolCompactProps) {
  const workingAgents = agents.filter((a) => a.status === "working");
  const idleAgents = agents.filter((a) => a.status === "idle");

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5">
        <Bot className="w-4 h-4 text-gray-500" />
        <span className="text-gray-700">{agents.length}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-blue-600">{workingAgents.length}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-gray-500">{idleAgents.length}</span>
      </div>
    </div>
  );
}
