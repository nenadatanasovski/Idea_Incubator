/**
 * ReadinessDashboard Component
 *
 * Displays readiness status for spec, build, and launch phases.
 * Memory Graph Migration: Comprehensive readiness view using graph-based checks.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileText,
  Hammer,
  Rocket,
} from "lucide-react";

// Types for readiness API response
interface ReadinessItem {
  item: string;
  description: string;
  importance: "critical" | "important" | "nice_to_have";
}

interface ReadinessResult {
  ready: boolean;
  score: number;
  missing: ReadinessItem[];
  recommendations: string[];
}

interface OverallReadiness {
  spec: ReadinessResult;
  build: ReadinessResult;
  launch: ReadinessResult;
  currentPhase: "ideation" | "spec" | "build" | "launch";
  nextSteps: string[];
}

interface ReadinessDashboardProps {
  ideaId: string;
  sessionId?: string;
  onPhaseAction?: (phase: "spec" | "build" | "launch") => void;
  compact?: boolean;
}

// Helper function to get color based on score
function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 25) return "text-orange-600";
  return "text-red-600";
}

function getProgressBgColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

function getImportanceIcon(importance: string) {
  switch (importance) {
    case "critical":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case "important":
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-gray-400" />;
  }
}

// Phase Card Component
const PhaseCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  result: ReadinessResult;
  isCurrentPhase: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAction?: () => void;
  actionLabel?: string;
}> = ({
  title,
  icon,
  result,
  isCurrentPhase,
  expanded,
  onToggle,
  onAction,
  actionLabel,
}) => {
  return (
    <div
      className={`border rounded-lg p-4 ${
        isCurrentPhase
          ? "border-blue-500 bg-blue-50"
          : result.ready
            ? "border-green-200 bg-green-50"
            : "border-gray-200 bg-white"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              result.ready ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{title}</h3>
              {isCurrentPhase && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  Current
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {result.ready ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${getScoreColor(result.score)}`}>
                {result.score}% ready
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {result.ready && onAction && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {actionLabel || "Start"}
            </button>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full h-2 bg-gray-200 rounded-full">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getProgressBgColor(result.score)}`}
          style={{ width: `${result.score}%` }}
        />
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {/* Missing Items */}
          {result.missing.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Missing ({result.missing.length})
              </h4>
              <div className="space-y-2">
                {result.missing.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm bg-gray-50 p-2 rounded"
                  >
                    {getImportanceIcon(item.importance)}
                    <div>
                      <span className="font-medium text-gray-900">
                        {item.item}
                      </span>
                      <p className="text-gray-500 text-xs">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Recommendations
              </h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 flex items-start gap-2"
                  >
                    <span className="text-blue-500 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ready State */}
          {result.ready && result.missing.length === 0 && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                All requirements met for this phase
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Dashboard Component
export const ReadinessDashboard: React.FC<ReadinessDashboardProps> = ({
  ideaId,
  sessionId: _sessionId, // Reserved for future use
  onPhaseAction,
  compact = false,
}) => {
  const [readiness, setReadiness] = useState<OverallReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    if (!ideaId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ideation/idea/${encodeURIComponent(ideaId)}/graph/readiness`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch readiness data");
      }

      const data = await response.json();
      setReadiness(data);

      // Auto-expand current phase
      if (!expandedPhase) {
        setExpandedPhase(data.currentPhase);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [ideaId, expandedPhase]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading readiness...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={fetchReadiness}
          className="mt-2 text-sm text-red-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!readiness) {
    return null;
  }

  // Compact view for sidebars
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Readiness</h3>
          <button
            onClick={fetchReadiness}
            className="p-1 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex gap-2">
          {/* Spec */}
          <div
            className={`flex-1 p-2 rounded text-center ${
              readiness.spec.ready ? "bg-green-100" : "bg-gray-100"
            }`}
            title={`Spec: ${readiness.spec.score}%`}
          >
            <FileText
              className={`w-4 h-4 mx-auto ${
                readiness.spec.ready ? "text-green-600" : "text-gray-400"
              }`}
            />
            <span className="text-xs text-gray-600">
              {readiness.spec.score}%
            </span>
          </div>

          {/* Build */}
          <div
            className={`flex-1 p-2 rounded text-center ${
              readiness.build.ready ? "bg-green-100" : "bg-gray-100"
            }`}
            title={`Build: ${readiness.build.score}%`}
          >
            <Hammer
              className={`w-4 h-4 mx-auto ${
                readiness.build.ready ? "text-green-600" : "text-gray-400"
              }`}
            />
            <span className="text-xs text-gray-600">
              {readiness.build.score}%
            </span>
          </div>

          {/* Launch */}
          <div
            className={`flex-1 p-2 rounded text-center ${
              readiness.launch.ready ? "bg-green-100" : "bg-gray-100"
            }`}
            title={`Launch: ${readiness.launch.score}%`}
          >
            <Rocket
              className={`w-4 h-4 mx-auto ${
                readiness.launch.ready ? "text-green-600" : "text-gray-400"
              }`}
            />
            <span className="text-xs text-gray-600">
              {readiness.launch.score}%
            </span>
          </div>
        </div>

        {/* Current phase indicator */}
        <div className="text-xs text-gray-500 text-center">
          Current phase:{" "}
          <span className="font-medium capitalize">
            {readiness.currentPhase}
          </span>
        </div>
      </div>
    );
  }

  // Full dashboard view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Readiness Dashboard
        </h2>
        <button
          onClick={fetchReadiness}
          className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Next Steps */}
      {readiness.nextSteps.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Next Steps</h3>
          <ul className="space-y-1">
            {readiness.nextSteps.map((step, index) => (
              <li
                key={index}
                className="text-sm text-blue-700 flex items-start gap-2"
              >
                <span className="font-medium">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Phase Cards */}
      <div className="space-y-3">
        <PhaseCard
          title="Specification"
          icon={<FileText className="w-5 h-5 text-gray-600" />}
          result={readiness.spec}
          isCurrentPhase={readiness.currentPhase === "ideation"}
          expanded={expandedPhase === "spec" || expandedPhase === "ideation"}
          onToggle={() =>
            setExpandedPhase(expandedPhase === "spec" ? null : "spec")
          }
          onAction={onPhaseAction ? () => onPhaseAction("spec") : undefined}
          actionLabel="Generate Spec"
        />

        <PhaseCard
          title="Build"
          icon={<Hammer className="w-5 h-5 text-gray-600" />}
          result={readiness.build}
          isCurrentPhase={readiness.currentPhase === "spec"}
          expanded={expandedPhase === "build"}
          onToggle={() =>
            setExpandedPhase(expandedPhase === "build" ? null : "build")
          }
          onAction={onPhaseAction ? () => onPhaseAction("build") : undefined}
          actionLabel="Start Build"
        />

        <PhaseCard
          title="Launch"
          icon={<Rocket className="w-5 h-5 text-gray-600" />}
          result={readiness.launch}
          isCurrentPhase={readiness.currentPhase === "build"}
          expanded={expandedPhase === "launch"}
          onToggle={() =>
            setExpandedPhase(expandedPhase === "launch" ? null : "launch")
          }
          onAction={onPhaseAction ? () => onPhaseAction("launch") : undefined}
          actionLabel="Prepare Launch"
        />
      </div>
    </div>
  );
};

export default ReadinessDashboard;
