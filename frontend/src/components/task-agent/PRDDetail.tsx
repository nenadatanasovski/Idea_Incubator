/**
 * PRD Detail Component
 *
 * Displays detailed PRD information with coverage and linked tasks.
 * Part of: Task System V2 Implementation Plan (IMPL-7.2)
 */

import { useState, useEffect } from "react";
import {
  FileText,
  Check,
  Clock,
  Link,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import PRDCoverageChart from "./PRDCoverageChart";

interface PRDCoverage {
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercentage: number;
  uncoveredRequirements: string[];
}

interface PRDProgress {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
}

interface LinkedTaskList {
  id: string;
  name: string;
  taskCount: number;
}

interface LinkedTask {
  id: string;
  displayId: string;
  title: string;
  status: string;
  requirementId?: string;
}

interface PRD {
  id: string;
  title: string;
  description?: string;
  status: "draft" | "review" | "approved" | "archived";
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

interface PRDDetailProps {
  prdId: string;
  onClose?: () => void;
  onApprove?: (prdId: string) => void;
}

export default function PRDDetail({
  prdId,
  onClose,
  onApprove,
}: PRDDetailProps) {
  const [prd, setPrd] = useState<PRD | null>(null);
  const [coverage, setCoverage] = useState<PRDCoverage | null>(null);
  const [progress, setProgress] = useState<PRDProgress | null>(null);
  const [taskLists, setTaskLists] = useState<LinkedTaskList[]>([]);
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUncovered, setShowUncovered] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  useEffect(() => {
    fetchPRDData();
  }, [prdId]);

  const fetchPRDData = async () => {
    try {
      setLoading(true);
      const [prdRes, coverageRes, progressRes, taskListsRes, tasksRes] =
        await Promise.all([
          fetch(`/api/prds/${prdId}`),
          fetch(`/api/prds/${prdId}/coverage`),
          fetch(`/api/prds/${prdId}/progress`),
          fetch(`/api/prds/${prdId}/task-lists`),
          fetch(`/api/prds/${prdId}/tasks`),
        ]);

      if (!prdRes.ok) throw new Error("Failed to fetch PRD");

      setPrd(await prdRes.json());
      setCoverage(coverageRes.ok ? await coverageRes.json() : null);
      setProgress(progressRes.ok ? await progressRes.json() : null);
      setTaskLists(taskListsRes.ok ? await taskListsRes.json() : []);
      setTasks(tasksRes.ok ? await tasksRes.json() : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/prds/${prdId}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to approve PRD");
      fetchPRDData();
      onApprove?.(prdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (error || !prd) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error || "PRD not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900">{prd.title}</h2>
          </div>
          {prd.description && (
            <p className="mt-2 text-gray-600">{prd.description}</p>
          )}
        </div>
        {prd.status !== "approved" && prd.status !== "archived" && (
          <button
            onClick={handleApprove}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Approve
          </button>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <span
          className={`
          px-3 py-1 rounded-full text-sm font-medium
          ${prd.status === "approved" ? "bg-green-100 text-green-700" : ""}
          ${prd.status === "review" ? "bg-yellow-100 text-yellow-700" : ""}
          ${prd.status === "draft" ? "bg-gray-100 text-gray-700" : ""}
          ${prd.status === "archived" ? "bg-gray-50 text-gray-500" : ""}
        `}
        >
          {prd.status.charAt(0).toUpperCase() + prd.status.slice(1)}
        </span>
        {prd.approvedAt && (
          <span className="text-sm text-gray-500">
            Approved {new Date(prd.approvedAt).toLocaleDateString()}
            {prd.approvedBy && ` by ${prd.approvedBy}`}
          </span>
        )}
      </div>

      {/* Coverage Chart */}
      {coverage && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium">Coverage</h3>
          </div>
          <PRDCoverageChart coverage={coverage} progress={progress} />

          {/* Uncovered Requirements */}
          {coverage.uncoveredRequirements.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowUncovered(!showUncovered)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                {showUncovered ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {coverage.uncoveredRequirements.length} uncovered requirements
              </button>
              {showUncovered && (
                <ul className="mt-2 space-y-1 pl-5">
                  {coverage.uncoveredRequirements.map((req, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-500 flex items-center gap-2"
                    >
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      {req}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Linked Task Lists */}
      {taskLists.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium">Linked Task Lists</h3>
          </div>
          <div className="space-y-2">
            {taskLists.map((list) => (
              <div
                key={list.id}
                className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
              >
                <span className="font-medium text-gray-700">{list.name}</span>
                <span className="text-sm text-gray-500">
                  {list.taskCount} tasks
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Tasks */}
      {tasks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <button
            onClick={() => setShowTasks(!showTasks)}
            className="flex items-center gap-2 w-full"
          >
            {showTasks ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <h3 className="font-medium">Linked Tasks ({tasks.length})</h3>
          </button>
          {showTasks && (
            <div className="mt-3 space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-gray-50 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-sm text-blue-600">
                      {task.displayId}
                    </span>
                    <span className="ml-2 text-gray-700">{task.title}</span>
                  </div>
                  <span
                    className={`
                    px-2 py-0.5 rounded-full text-xs
                    ${task.status === "completed" ? "bg-green-100 text-green-700" : ""}
                    ${task.status === "in_progress" ? "bg-blue-100 text-blue-700" : ""}
                    ${task.status === "pending" ? "bg-gray-100 text-gray-700" : ""}
                    ${task.status === "failed" ? "bg-red-100 text-red-700" : ""}
                  `}
                  >
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>Created: {new Date(prd.createdAt).toLocaleString()}</p>
        <p>Updated: {new Date(prd.updatedAt).toLocaleString()}</p>
        <p className="font-mono text-xs text-gray-400">ID: {prd.id}</p>
      </div>
    </div>
  );
}
