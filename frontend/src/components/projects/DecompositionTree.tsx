/**
 * DecompositionTree - Hierarchical tree view for task decomposition
 *
 * Shows parent-child relationships between tasks with expand/collapse.
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Pause,
  GitBranch,
} from "lucide-react";
import clsx from "clsx";

interface DecomposableTask {
  id: string;
  displayId?: string;
  title: string;
  status: string;
  parentTaskId?: string | null;
  isDecomposed?: boolean;
}

interface TreeNode {
  task: DecomposableTask;
  children: TreeNode[];
}

interface DecompositionTreeProps {
  tasks: DecomposableTask[];
  projectSlug: string;
  defaultExpandedIds?: Set<string>;
}

// Status config
const statusConfig: Record<
  string,
  { color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  completed: {
    color: "text-green-600",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  in_progress: { color: "text-blue-600", bg: "bg-blue-100", icon: Clock },
  pending: { color: "text-gray-600", bg: "bg-gray-100", icon: AlertCircle },
  failed: { color: "text-red-600", bg: "bg-red-100", icon: XCircle },
  blocked: { color: "text-amber-600", bg: "bg-amber-100", icon: Pause },
};

function buildTree(tasks: DecomposableTask[]): {
  roots: TreeNode[];
  orphans: DecomposableTask[];
} {
  const taskMap = new Map<string, DecomposableTask>();
  const childrenMap = new Map<string, DecomposableTask[]>();

  // Index all tasks
  for (const task of tasks) {
    taskMap.set(task.id, task);
    if (task.parentTaskId) {
      const siblings = childrenMap.get(task.parentTaskId) || [];
      siblings.push(task);
      childrenMap.set(task.parentTaskId, siblings);
    }
  }

  // Build tree recursively
  function buildNode(task: DecomposableTask): TreeNode {
    const children = childrenMap.get(task.id) || [];
    return {
      task,
      children: children.map(buildNode),
    };
  }

  // Find root tasks (tasks without parent or with parent not in list)
  const roots: TreeNode[] = [];
  const orphans: DecomposableTask[] = [];

  for (const task of tasks) {
    if (!task.parentTaskId) {
      // True root
      roots.push(buildNode(task));
    } else if (!taskMap.has(task.parentTaskId)) {
      // Orphan - parent not in list
      orphans.push(task);
    }
    // Tasks with valid parents are handled as children
  }

  return { roots, orphans };
}

interface TreeNodeComponentProps {
  node: TreeNode;
  projectSlug: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  level: number;
}

function TreeNodeComponent({
  node,
  projectSlug,
  expandedIds,
  onToggle,
  level,
}: TreeNodeComponentProps) {
  const { task, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(task.id);
  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div>
      <div
        className={clsx(
          "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors",
          level > 0 && "ml-6 border-l border-gray-200",
        )}
        style={{ marginLeft: level > 0 ? level * 24 : 0 }}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(task.id)}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5" /> // Spacer
        )}

        {/* Status icon */}
        <StatusIcon className={clsx("h-4 w-4 flex-shrink-0", config.color)} />

        {/* Task info */}
        <Link
          to={`/projects/${projectSlug}/build?task=${task.displayId || task.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary-600">
              {task.displayId || task.id.slice(0, 8)}
            </span>
            {task.isDecomposed && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                <GitBranch className="h-3 w-3" />
                decomposed
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 truncate">{task.title}</p>
        </Link>

        {/* Status badge */}
        <span
          className={clsx(
            "text-xs px-2 py-0.5 rounded flex-shrink-0",
            config.bg,
            config.color,
          )}
        >
          {task.status.replace("_", " ")}
        </span>

        {/* Child count */}
        {hasChildren && (
          <span className="text-xs text-gray-500">({children.length})</span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeNodeComponent
              key={child.task.id}
              node={child}
              projectSlug={projectSlug}
              expandedIds={expandedIds}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DecompositionTree({
  tasks,
  projectSlug,
  defaultExpandedIds,
}: DecompositionTreeProps) {
  const { roots, orphans } = useMemo(() => buildTree(tasks), [tasks]);

  // Initialize with all roots expanded if no default provided
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (defaultExpandedIds) return defaultExpandedIds;
    return new Set(roots.map((n) => n.task.id));
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (roots.length === 0 && orphans.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p>No decomposed tasks found</p>
        <p className="text-sm mt-1">
          Decompose a task to see the hierarchy here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((node) => (
        <TreeNodeComponent
          key={node.task.id}
          node={node}
          projectSlug={projectSlug}
          expandedIds={expandedIds}
          onToggle={toggleExpand}
          level={0}
        />
      ))}

      {orphans.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Orphaned Tasks ({orphans.length})
          </h4>
          <div className="space-y-2">
            {orphans.map((task) => {
              const config = statusConfig[task.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <Link
                  key={task.id}
                  to={`/projects/${projectSlug}/build?task=${task.displayId || task.id}`}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <StatusIcon
                    className={clsx("h-4 w-4 flex-shrink-0", config.color)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-primary-600">
                      {task.displayId || task.id.slice(0, 8)}
                    </span>
                    <p className="text-sm text-gray-700 truncate">
                      {task.title}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded flex-shrink-0",
                      config.bg,
                      config.color,
                    )}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
