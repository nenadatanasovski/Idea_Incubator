/**
 * SkillFlowDiagram - Hierarchical skill invocation visualization
 */

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Wrench,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";
import { useSkillTraces, useToolUses } from "../../hooks/useObservability";
import type { SkillTrace, ToolUse } from "../../types/observability";

interface SkillFlowDiagramProps {
  executionId: string;
  onSkillClick?: (skill: SkillTrace) => void;
  onToolUseClick?: (toolUse: ToolUse) => void;
}

interface SkillNode {
  skill: SkillTrace;
  toolUses: ToolUse[];
  children: SkillNode[];
}

export default function SkillFlowDiagram({
  executionId,
  onSkillClick,
  onToolUseClick,
}: SkillFlowDiagramProps) {
  const { skills, loading: skillsLoading } = useSkillTraces(executionId, {
    limit: 100,
  });
  const { toolUses, loading: toolUsesLoading } = useToolUses(executionId, {
    limit: 500,
  });
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  const loading = skillsLoading || toolUsesLoading;

  // Build skill tree
  const rootNodes = useMemo(() => {
    if (skills.length === 0) return [];

    // Map tool uses to skills
    const toolUsesBySkill = new Map<string, ToolUse[]>();
    toolUses.forEach((tu) => {
      if (tu.withinSkill) {
        if (!toolUsesBySkill.has(tu.withinSkill)) {
          toolUsesBySkill.set(tu.withinSkill, []);
        }
        toolUsesBySkill.get(tu.withinSkill)!.push(tu);
      }
    });

    // Build nodes
    const skillNodes = new Map<string, SkillNode>();
    skills.forEach((skill) => {
      skillNodes.set(skill.id, {
        skill,
        toolUses: toolUsesBySkill.get(skill.id) || [],
        children: [],
      });
    });

    // Link parent-child
    const roots: SkillNode[] = [];
    skills.forEach((skill) => {
      const node = skillNodes.get(skill.id)!;
      if (skill.subSkills && skill.subSkills.length > 0) {
        skill.subSkills.forEach((childId) => {
          const childNode = skillNodes.get(childId);
          if (childNode) {
            node.children.push(childNode);
          }
        });
      }
      // If no parent found, it's a root
      const hasParent = skills.some((s) => s.subSkills?.includes(skill.id));
      if (!hasParent) {
        roots.push(node);
      }
    });

    return roots.sort(
      (a, b) =>
        new Date(a.skill.startTime).getTime() -
        new Date(b.skill.startTime).getTime(),
    );
  }, [skills, toolUses]);

  const toggleSkill = (id: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderSkillNode = (node: SkillNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedSkills.has(node.skill.id);
    const hasChildren = node.children.length > 0 || node.toolUses.length > 0;
    const StatusIcon =
      node.skill.status === "success"
        ? CheckCircle
        : node.skill.status === "failed"
          ? XCircle
          : Clock;
    const statusColor =
      node.skill.status === "success"
        ? "text-green-500"
        : node.skill.status === "failed"
          ? "text-red-500"
          : "text-blue-500";

    return (
      <div
        key={node.skill.id}
        className="border-l-2 border-gray-200"
        style={{ marginLeft: depth * 16 }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
          onClick={() =>
            hasChildren
              ? toggleSkill(node.skill.id)
              : onSkillClick?.(node.skill)
          }
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )
          ) : (
            <div className="w-4" />
          )}
          <FileCode className="h-4 w-4 text-indigo-500" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {node.skill.skillName}
              </span>
              <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                {node.skill.skillFile}:{node.skill.lineNumber || "?"}
              </span>
              {node.skill.durationMs && <span>{node.skill.durationMs}ms</span>}
              {node.toolUses.length > 0 && (
                <span>{node.toolUses.length} tools</span>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-4">
            {/* Tool uses */}
            {node.toolUses.length > 0 && (
              <div className="border-l-2 border-purple-200 ml-4">
                {node.toolUses.map((tu) => (
                  <div
                    key={tu.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-purple-50 cursor-pointer"
                    onClick={() => onToolUseClick?.(tu)}
                  >
                    <Wrench className="h-3 w-3 text-purple-500" />
                    <span className="text-xs font-medium">{tu.tool}</span>
                    <span className="text-xs text-gray-500 truncate flex-1">
                      {tu.inputSummary}
                    </span>
                    <span
                      className={`text-xs ${tu.isError ? "text-red-500" : tu.isBlocked ? "text-orange-500" : "text-gray-400"}`}
                    >
                      {tu.durationMs}ms
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Child skills */}
            {node.children.map((child) => renderSkillNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (rootNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Zap className="h-12 w-12 mb-4" />
        <p>No skill traces available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Summary */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-gray-600">
          Total Skills: <strong>{skills.length}</strong>
        </span>
        <span className="text-green-600">
          Success:{" "}
          <strong>{skills.filter((s) => s.status === "success").length}</strong>
        </span>
        <span className="text-red-600">
          Failed:{" "}
          <strong>{skills.filter((s) => s.status === "failed").length}</strong>
        </span>
      </div>

      {/* Tree */}
      <div className="border rounded-lg divide-y">
        {rootNodes.map((node) => renderSkillNode(node))}
      </div>
    </div>
  );
}
