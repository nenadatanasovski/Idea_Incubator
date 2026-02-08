/**
 * Task Version Viewer Component
 *
 * Displays version history with diff comparison and rollback.
 * Part of: Task System V2 Implementation Plan (IMPL-7.6)
 */

import { useState, useEffect } from "react";
import {
  History,
  GitCommit,
  RotateCcw,
  Flag,
  ArrowRight,
  Plus,
  Minus,
  AlertCircle,
} from "lucide-react";

interface TaskVersion {
  id: string;
  taskId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changeReason?: string;
  changedBy: string;
  isCheckpoint: boolean;
  checkpointName?: string;
  createdAt: string;
}

interface VersionDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: "added" | "removed" | "modified";
}

interface TaskVersionViewerProps {
  taskId: string;
  onRestore?: (version: number) => void;
}

export default function TaskVersionViewer({
  taskId,
  onRestore,
}: TaskVersionViewerProps) {
  const [versions, setVersions] = useState<TaskVersion[]>([]);
  const [checkpoints, setCheckpoints] = useState<TaskVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<TaskVersion | null>(
    null,
  );
  const [compareVersions, setCompareVersions] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [diff, setDiff] = useState<VersionDiff[]>([]);
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [checkpointName, setCheckpointName] = useState("");

  useEffect(() => {
    fetchVersions();
  }, [taskId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const [versionsRes, checkpointsRes] = await Promise.all([
        fetch(`/api/task-agent/tasks/${taskId}/versions`),
        fetch(`/api/task-agent/tasks/${taskId}/versions/checkpoints`),
      ]);

      if (versionsRes.ok) {
        const data = await versionsRes.json();
        setVersions(data);
        if (data.length > 0) {
          setSelectedVersion(data[0]);
        }
      }
      if (checkpointsRes.ok) {
        setCheckpoints(await checkpointsRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDiff = async (fromVersion: number, toVersion: number) => {
    try {
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/versions/diff?from=${fromVersion}&to=${toVersion}`,
      );
      if (response.ok) {
        const data = await response.json();
        setDiff(data.changes || []);
      }
    } catch (err) {
      console.error("Failed to fetch diff:", err);
    }
  };

  const handleCompare = (from: number, to: number) => {
    setCompareVersions({ from, to });
    fetchDiff(from, to);
  };

  const handleRestore = async (version: number) => {
    if (
      !confirm(
        `Restore task to version ${version}? This will create a new version.`,
      )
    )
      return;

    try {
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/versions/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetVersion: version }),
        },
      );

      if (!response.ok) throw new Error("Failed to restore version");

      fetchVersions();
      onRestore?.(version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleCreateCheckpoint = async () => {
    if (!checkpointName.trim()) return;

    try {
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/versions/checkpoint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: checkpointName }),
        },
      );

      if (!response.ok) throw new Error("Failed to create checkpoint");

      setShowCreateCheckpoint(false);
      setCheckpointName("");
      fetchVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-gray-400" />
          <h3 className="font-medium">Version History</h3>
          <span className="text-sm text-gray-500">
            ({versions.length} versions)
          </span>
        </div>
        <button
          onClick={() => setShowCreateCheckpoint(!showCreateCheckpoint)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <Flag className="h-4 w-4" />
          Create Checkpoint
        </button>
      </div>

      {/* Create Checkpoint Form */}
      {showCreateCheckpoint && (
        <div className="p-4 border border-gray-200 rounded-lg space-y-3">
          <input
            type="text"
            value={checkpointName}
            onChange={(e) => setCheckpointName(e.target.value)}
            placeholder="Checkpoint name (e.g., 'Before refactor')"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateCheckpoint(false)}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCheckpoint}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Checkpoints */}
      {checkpoints.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Checkpoints</h4>
          <div className="flex flex-wrap gap-2">
            {checkpoints.map((cp) => (
              <button
                key={cp.id}
                onClick={() => handleRestore(cp.version)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm"
              >
                <Flag className="h-3 w-3" />
                {cp.checkpointName} (v{cp.version})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Version Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {versions.map((version, index) => {
            const isSelected = selectedVersion?.id === version.id;
            const isLatest = index === 0;

            return (
              <div key={version.id} className="relative pl-10">
                {/* Timeline dot */}
                <div
                  className={`
                  absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${
                    version.isCheckpoint
                      ? "bg-amber-100 border-amber-400"
                      : isLatest
                        ? "bg-green-100 border-green-400"
                        : "bg-white border-gray-300"
                  }
                `}
                >
                  {version.isCheckpoint ? (
                    <Flag className="h-3 w-3 text-amber-600" />
                  ) : (
                    <GitCommit className="h-3 w-3 text-gray-400" />
                  )}
                </div>

                <div
                  onClick={() => setSelectedVersion(version)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Version {version.version}
                      </span>
                      {isLatest && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          Current
                        </span>
                      )}
                      {version.isCheckpoint && version.checkpointName && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                          {version.checkpointName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {index < versions.length - 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompare(
                              versions[index + 1].version,
                              version.version,
                            );
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Compare
                        </button>
                      )}
                      {!isLatest && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(version.version);
                          }}
                          className="flex items-center gap-1 text-xs text-amber-600 hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {version.changeReason || "No reason provided"}
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{new Date(version.createdAt).toLocaleString()}</span>
                    <span>by {version.changedBy}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diff View */}
      {compareVersions && diff.length > 0 && (
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="font-medium">Changes</h4>
            <span className="text-sm text-gray-500">
              v{compareVersions.from} <ArrowRight className="h-3 w-3 inline" />{" "}
              v{compareVersions.to}
            </span>
          </div>
          <div className="space-y-2">
            {diff.map((change, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {change.changeType === "added" && (
                  <Plus className="h-4 w-4 text-green-500 mt-0.5" />
                )}
                {change.changeType === "removed" && (
                  <Minus className="h-4 w-4 text-red-500 mt-0.5" />
                )}
                {change.changeType === "modified" && (
                  <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5" />
                )}
                <div>
                  <span className="font-medium">{change.field}</span>
                  {change.changeType === "modified" && (
                    <div className="text-gray-500">
                      <span className="line-through text-red-400">
                        {String(change.oldValue)}
                      </span>
                      {" → "}
                      <span className="text-green-600">
                        {String(change.newValue)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
