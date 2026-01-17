/**
 * SkillTraceList - List of skill invocations
 */

import { Sparkles, Clock, ChevronRight, FileCode } from "lucide-react";
import { useSkillTraces } from "../../hooks/useObservability";
import ObsStatusBadge from "./ObsStatusBadge";
import type { SkillTrace } from "../../types/observability";

interface SkillTraceListProps {
  executionId: string;
  onSkillClick?: (skill: SkillTrace) => void;
}

export default function SkillTraceList({
  executionId,
  onSkillClick,
}: SkillTraceListProps) {
  const { skills, loading, error, total } = useSkillTraces(executionId, {
    limit: 50,
  });

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        Error loading skills: {error.message}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="text-gray-500 p-4 text-center">
        No skill invocations found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">{total} skill invocations</div>

      {skills.map((skill) => (
        <SkillItem
          key={skill.id}
          skill={skill}
          onClick={() => onSkillClick?.(skill)}
        />
      ))}
    </div>
  );
}

interface SkillItemProps {
  skill: SkillTrace;
  onClick?: () => void;
}

function SkillItem({ skill, onClick }: SkillItemProps) {
  return (
    <div
      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{skill.skillName}</span>
              <ObsStatusBadge status={skill.status} size="sm" />
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <FileCode className="h-3 w-3" />
              <span className="font-mono">{skill.skillFile}</span>
              {skill.lineNumber && <span>:{skill.lineNumber}</span>}
            </div>

            {skill.sectionTitle && (
              <p className="text-sm text-gray-600 mt-2">{skill.sectionTitle}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-gray-400">
          {skill.durationMs && (
            <span className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {skill.durationMs}ms
            </span>
          )}
          {skill.tokenEstimate && (
            <span className="text-xs">{skill.tokenEstimate} tokens</span>
          )}
          <ChevronRight className="h-4 w-4 mt-2" />
        </div>
      </div>

      {/* Tool calls summary */}
      {skill.toolCalls && skill.toolCalls.length > 0 && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-500">
          {skill.toolCalls.length} tool calls
        </div>
      )}
    </div>
  );
}
