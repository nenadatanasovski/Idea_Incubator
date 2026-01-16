import { useState } from "react";
import {
  Clock,
  GitCommit,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowRightLeft,
} from "lucide-react";
import type { IdeaVersion } from "../api/client";

interface VersionTimelineProps {
  versions: IdeaVersion[];
  onViewVersion?: (version: number) => void;
  onCompareVersions?: (v1: number, v2: number) => void;
}

const changeTypeLabels: Record<string, { label: string; color: string }> = {
  initial: { label: "Initial Capture", color: "bg-purple-500" },
  manual: { label: "Manual Snapshot", color: "bg-blue-500" },
  iteration: { label: "Iteration", color: "bg-amber-500" },
  evaluation: { label: "Evaluation", color: "bg-green-500" },
  development: { label: "Development", color: "bg-cyan-500" },
  branch: { label: "Branch", color: "bg-pink-500" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface VersionItemProps {
  version: IdeaVersion;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onView?: () => void;
}

function VersionItem({
  version,
  isCurrent,
  isSelected,
  onSelect,
  onView,
}: VersionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const changeType = changeTypeLabels[version.changeType] || {
    label: version.changeType,
    color: "bg-gray-500",
  };

  return (
    <div
      className={`relative pl-8 pb-6 border-l-2 ${
        isSelected ? "border-blue-500" : "border-gray-200"
      }`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute -left-2 w-4 h-4 rounded-full cursor-pointer transition-all ${
          isSelected ? "bg-blue-500 ring-4 ring-blue-100" : changeType.color
        }`}
        onClick={onSelect}
      />

      <div className="ml-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              v{version.versionNumber}
            </span>
            {isCurrent && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Current
              </span>
            )}
            <span
              className={`text-xs text-white px-2 py-0.5 rounded-full ${changeType.color}`}
            >
              {changeType.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onView && (
              <button
                onClick={onView}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="View this version"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(version.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <GitCommit className="h-3 w-3" />
            Iteration {version.iterationNumber}
          </span>
        </div>

        {/* Summary */}
        {version.changeSummary && (
          <p className="mt-2 text-sm text-gray-600">{version.changeSummary}</p>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
            <div className="text-xs text-gray-500 mb-2">
              Phase: {version.phase}
            </div>
            {version.evaluationSnapshot && (
              <div className="text-xs text-gray-500">Has evaluation data</div>
            )}
            <div className="mt-2 max-h-32 overflow-auto text-xs text-gray-600 font-mono whitespace-pre-wrap">
              {version.contentSnapshot.substring(0, 500)}
              {version.contentSnapshot.length > 500 && "..."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VersionTimeline({
  versions,
  onViewVersion,
  onCompareVersions,
}: VersionTimelineProps) {
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  const toggleSelection = (versionNumber: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionNumber)) {
        return prev.filter((v) => v !== versionNumber);
      }
      if (prev.length >= 2) {
        return [prev[1], versionNumber];
      }
      return [...prev, versionNumber];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompareVersions) {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      onCompareVersions(v1, v2);
    }
  };

  if (versions.length === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        <GitCommit className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No version history available</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Version History</h3>
        {selectedVersions.length === 2 && onCompareVersions && (
          <button
            onClick={handleCompare}
            className="btn btn-secondary text-sm flex items-center gap-1"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Compare v{selectedVersions[0]} with v{selectedVersions[1]}
          </button>
        )}
      </div>

      {selectedVersions.length > 0 && selectedVersions.length < 2 && (
        <p className="text-sm text-gray-500 mb-4">
          Select another version to compare
        </p>
      )}

      <div className="mt-4">
        {versions.map((version, index) => (
          <VersionItem
            key={version.id}
            version={version}
            isCurrent={index === 0}
            isSelected={selectedVersions.includes(version.versionNumber)}
            onSelect={() => toggleSelection(version.versionNumber)}
            onView={
              onViewVersion
                ? () => onViewVersion(version.versionNumber)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
