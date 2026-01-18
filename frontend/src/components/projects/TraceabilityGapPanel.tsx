/**
 * TraceabilityGapPanel - AI-powered gap analysis panel
 */

import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import type {
  TraceabilityGap,
  GapCounts,
} from "../../hooks/useTraceabilityGaps";

interface TraceabilityGapPanelProps {
  gaps: TraceabilityGap[];
  counts: GapCounts;
  isAnalyzing: boolean;
  onAnalyze: () => Promise<void>;
  onGetSuggestions: (gapId: string) => Promise<string[]>;
  onResolve: (gapId: string) => Promise<void>;
  onIgnore: (gapId: string) => Promise<void>;
  onRefetch: () => Promise<void>;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  warning: {
    icon: AlertCircle,
    label: "Warning",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  info: {
    icon: Info,
    label: "Info",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

const gapTypeLabels: Record<string, string> = {
  uncovered: "Uncovered Requirement",
  weak_coverage: "Weak Coverage",
  orphan: "Orphan Task",
  mismatch: "Category Mismatch",
};

export default function TraceabilityGapPanel({
  gaps,
  counts,
  isAnalyzing,
  onAnalyze,
  onGetSuggestions,
  onResolve,
  onIgnore,
  onRefetch,
}: TraceabilityGapPanelProps) {
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(
    null,
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group gaps by status
  const openGaps = gaps.filter((g) => g.status === "open");
  const resolvedGaps = gaps.filter((g) => g.status === "resolved");

  // Group open gaps by severity
  const criticalGaps = openGaps.filter((g) => g.severity === "critical");
  const warningGaps = openGaps.filter((g) => g.severity === "warning");
  const infoGaps = openGaps.filter((g) => g.severity === "info");

  const handleGetSuggestions = async (gapId: string) => {
    setLoadingSuggestions(gapId);
    await onGetSuggestions(gapId);
    setLoadingSuggestions(null);
  };

  const renderGapCard = (gap: TraceabilityGap) => {
    const config = severityConfig[gap.severity];
    const Icon = config.icon;
    const isExpanded = expandedGap === gap.id;
    const isLoadingSuggestions = loadingSuggestions === gap.id;

    return (
      <div
        key={gap.id}
        className={clsx(
          "border rounded-lg transition-all",
          config.borderColor,
          isExpanded && config.bgColor,
        )}
      >
        {/* Header */}
        <button
          onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
          className="w-full p-3 flex items-start gap-3 text-left"
        >
          <Icon
            className={clsx("h-5 w-5 flex-shrink-0 mt-0.5", config.color)}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={clsx(
                  "text-xs font-medium px-2 py-0.5 rounded",
                  config.bgColor,
                  config.color,
                )}
              >
                {config.label}
              </span>
              <span className="text-xs text-gray-500">
                {gapTypeLabels[gap.gapType]}
              </span>
            </div>
            <p className="text-sm text-gray-900 line-clamp-2">
              {gap.description}
            </p>
          </div>

          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-gray-100">
            <div className="pt-3 space-y-3">
              {/* Suggestions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    AI Suggestions
                  </span>
                  {gap.suggestions.length === 0 && (
                    <button
                      onClick={() => handleGetSuggestions(gap.id)}
                      disabled={isLoadingSuggestions}
                      className="text-xs text-primary-600 hover:text-primary-700 inline-flex items-center"
                    >
                      {isLoadingSuggestions ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Get Suggestions
                        </>
                      )}
                    </button>
                  )}
                </div>

                {gap.suggestions.length > 0 && (
                  <div className="space-y-2">
                    {gap.suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-2 text-sm text-gray-700 bg-white rounded border border-gray-200"
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onIgnore(gap.id)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
                >
                  Ignore
                </button>
                <button
                  onClick={() => onResolve(gap.id)}
                  className="text-sm bg-primary-600 text-white hover:bg-primary-700 px-3 py-1 rounded inline-flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">
            AI Gap Analysis
          </h3>
          {counts.open > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {counts.open} open
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefetch}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {/* No gaps */}
          {openGaps.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Check className="h-12 w-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium">No gaps detected</p>
              <p className="text-sm">
                Click &quot;Analyze&quot; to check for issues
              </p>
            </div>
          )}

          {/* Critical gaps */}
          {criticalGaps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-red-700 mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Critical ({criticalGaps.length})
              </h4>
              <div className="space-y-2">{criticalGaps.map(renderGapCard)}</div>
            </div>
          )}

          {/* Warning gaps */}
          {warningGaps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-amber-700 mb-2">
                <AlertCircle className="h-3.5 w-3.5" />
                Warnings ({warningGaps.length})
              </h4>
              <div className="space-y-2">{warningGaps.map(renderGapCard)}</div>
            </div>
          )}

          {/* Info gaps */}
          {infoGaps.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-2">
                <Info className="h-3.5 w-3.5" />
                Info ({infoGaps.length})
              </h4>
              <div className="space-y-2">{infoGaps.map(renderGapCard)}</div>
            </div>
          )}

          {/* Resolved gaps (collapsed) */}
          {resolvedGaps.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="flex items-center gap-2 text-xs font-medium text-green-700 mb-2">
                <Check className="h-3.5 w-3.5" />
                Resolved ({resolvedGaps.length})
              </h4>
              <p className="text-xs text-gray-500">
                {resolvedGaps.length} gaps have been resolved
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
