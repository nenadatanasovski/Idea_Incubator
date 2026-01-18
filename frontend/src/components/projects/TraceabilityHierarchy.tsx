/**
 * TraceabilityHierarchy - Collapsible tree view of PRD-to-Task relationships
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  List,
  Square,
  CheckSquare,
  XSquare,
} from "lucide-react";
import clsx from "clsx";
import type {
  TraceabilityHierarchy as THierarchy,
  HierarchyNode,
} from "../../hooks/useTraceability";

interface TraceabilityHierarchyProps {
  hierarchy: THierarchy;
  projectSlug: string;
  defaultExpanded?: string[];
  onNodeClick?: (node: HierarchyNode) => void;
}

// Status colors matching LinkedTaskChip
const statusColors: Record<string, string> = {
  completed: "text-green-600",
  in_progress: "text-blue-600",
  pending: "text-gray-500",
  failed: "text-red-600",
  blocked: "text-amber-600",
};

// Link type badges
const linkTypeBadges: Record<string, { bg: string; text: string }> = {
  implements: { bg: "bg-purple-100", text: "text-purple-700" },
  tests: { bg: "bg-cyan-100", text: "text-cyan-700" },
  related: { bg: "bg-gray-100", text: "text-gray-700" },
};

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
  projectSlug: string;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onNavigate: (node: HierarchyNode) => void;
}

function TreeNode({
  node,
  level,
  projectSlug,
  expandedNodes,
  onToggle,
  onNavigate,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;

  // Get status icon for tasks
  const getTaskIcon = () => {
    if (node.type !== "task") return null;
    switch (node.status) {
      case "completed":
        return <CheckSquare className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XSquare className="h-4 w-4 text-red-600" />;
      default:
        return <Square className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get icon based on node type
  const getNodeIcon = () => {
    switch (node.type) {
      case "prd":
        return <FileText className="h-4 w-4 text-primary-600" />;
      case "section":
        return <FolderOpen className="h-4 w-4 text-gray-500" />;
      case "requirement":
        return node.isCovered ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-amber-500" />
        );
      case "task_list":
        return <List className="h-4 w-4 text-gray-500" />;
      case "task":
        return getTaskIcon();
      default:
        return <Square className="h-4 w-4 text-gray-400" />;
    }
  };

  const handleClick = () => {
    if (node.type === "task") {
      onNavigate(node);
    } else if (hasChildren) {
      onToggle(node.id);
    }
  };

  return (
    <div>
      {/* Node row */}
      <div
        className={clsx(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-gray-100",
          node.type === "task" && "hover:bg-primary-50",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Node icon */}
        {getNodeIcon()}

        {/* Node label */}
        <span
          className={clsx(
            "flex-1 text-sm truncate",
            node.type === "prd" && "font-semibold text-gray-900",
            node.type === "section" && "font-medium text-gray-800",
            node.type === "requirement" && "text-gray-700",
            node.type === "task_list" && "text-gray-600 italic",
            node.type === "task" && statusColors[node.status || "pending"],
          )}
          title={node.label}
        >
          {node.label}
        </span>

        {/* Metadata badges */}
        {node.type === "section" && node.coverage !== undefined && (
          <span
            className={clsx(
              "text-xs font-medium px-1.5 py-0.5 rounded",
              node.coverage === 100
                ? "bg-green-100 text-green-700"
                : node.coverage >= 50
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700",
            )}
          >
            {node.coverage}%
          </span>
        )}

        {node.type === "task" && node.linkType && (
          <span
            className={clsx(
              "text-xs px-1.5 py-0.5 rounded",
              linkTypeBadges[node.linkType]?.bg,
              linkTypeBadges[node.linkType]?.text,
            )}
          >
            {node.linkType}
          </span>
        )}

        {node.type === "task" && node.metadata?.displayId && (
          <span className="text-xs text-gray-400 font-mono">
            {node.metadata.displayId}
          </span>
        )}

        {node.metadata?.taskCount !== undefined && node.type !== "task" && (
          <span className="text-xs text-gray-400">
            {node.metadata.taskCount} tasks
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="relative">
          {/* Vertical connection line */}
          <div
            className="absolute left-0 top-0 bottom-0 border-l border-gray-200"
            style={{ marginLeft: `${level * 16 + 18}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              projectSlug={projectSlug}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TraceabilityHierarchy({
  hierarchy,
  projectSlug,
  defaultExpanded = [],
  onNodeClick,
}: TraceabilityHierarchyProps) {
  const navigate = useNavigate();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set([hierarchy.root.id, ...defaultExpanded]),
  );

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (node: HierarchyNode) => {
      if (onNodeClick) {
        onNodeClick(node);
        return;
      }

      if (node.type === "task") {
        navigate(`/projects/${projectSlug}/build?task=${node.id}`);
      } else if (node.type === "task_list") {
        navigate(`/projects/${projectSlug}/build?list=${node.id}`);
      }
    },
    [navigate, projectSlug, onNodeClick],
  );

  // Expand all / collapse all
  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (node: HierarchyNode) => {
      allIds.add(node.id);
      node.children.forEach(collectIds);
    };
    collectIds(hierarchy.root);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set([hierarchy.root.id]));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">
          Traceability Hierarchy
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Expand All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="p-2 max-h-[600px] overflow-y-auto">
        <TreeNode
          node={hierarchy.root}
          level={0}
          projectSlug={projectSlug}
          expandedNodes={expandedNodes}
          onToggle={handleToggle}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <span>
          Coverage: {hierarchy.stats.coveredRequirements}/
          {hierarchy.stats.totalRequirements} requirements
        </span>
        <span>&#8226;</span>
        <span>{hierarchy.stats.totalTasks} linked tasks</span>
        {hierarchy.stats.orphanTasks > 0 && (
          <>
            <span>&#8226;</span>
            <span className="text-amber-600">
              {hierarchy.stats.orphanTasks} orphan tasks
            </span>
          </>
        )}
      </div>
    </div>
  );
}
