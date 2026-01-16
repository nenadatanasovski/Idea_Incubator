import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

export interface Gap {
  id: string;
  category:
    | "problem"
    | "solution"
    | "market"
    | "user"
    | "technical"
    | "execution";
  description: string;
  impact: "critical" | "significant" | "minor";
  confidence: "low" | "medium" | "high";
  evidence?: string;
  resolved: boolean;
  resolution?: string;
  questionId?: string;
}

interface GapAnalysisViewProps {
  gaps: Gap[];
  onAddressGap?: (gapId: string, resolution: string) => void;
  onGetSuggestions?: (gapId: string) => Promise<string[]>;
  onSkipGap?: (gapId: string) => void;
  className?: string;
}

const impactConfig = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  significant: {
    icon: AlertCircle,
    label: "Significant",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  minor: {
    icon: Info,
    label: "Minor",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

const categoryLabels: Record<Gap["category"], string> = {
  problem: "Problem",
  solution: "Solution",
  market: "Market",
  user: "User",
  technical: "Technical",
  execution: "Execution",
};

export default function GapAnalysisView({
  gaps,
  onAddressGap,
  onGetSuggestions,
  onSkipGap,
  className,
}: GapAnalysisViewProps) {
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(
    null,
  );
  const [resolutionText, setResolutionText] = useState<Record<string, string>>(
    {},
  );

  const criticalGaps = gaps.filter(
    (g) => g.impact === "critical" && !g.resolved,
  );
  const significantGaps = gaps.filter(
    (g) => g.impact === "significant" && !g.resolved,
  );
  const minorGaps = gaps.filter((g) => g.impact === "minor" && !g.resolved);
  const resolvedGaps = gaps.filter((g) => g.resolved);

  const handleGetSuggestions = async (gapId: string) => {
    if (!onGetSuggestions || suggestions[gapId]) return;

    setLoadingSuggestions(gapId);
    try {
      const result = await onGetSuggestions(gapId);
      setSuggestions((prev) => ({ ...prev, [gapId]: result }));
    } catch (error) {
      console.error("Failed to get suggestions:", error);
    } finally {
      setLoadingSuggestions(null);
    }
  };

  const handleSelectSuggestion = (gapId: string, suggestion: string) => {
    setResolutionText((prev) => ({ ...prev, [gapId]: suggestion }));
  };

  const handleSubmitResolution = (gapId: string) => {
    const resolution = resolutionText[gapId];
    if (resolution && onAddressGap) {
      onAddressGap(gapId, resolution);
      setResolutionText((prev) => {
        const updated = { ...prev };
        delete updated[gapId];
        return updated;
      });
      setExpandedGap(null);
    }
  };

  const renderGapCard = (gap: Gap) => {
    const config = impactConfig[gap.impact];
    const Icon = config.icon;
    const isExpanded = expandedGap === gap.id;
    const gapSuggestions = suggestions[gap.id] || [];
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
        {/* Gap header */}
        <button
          onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
          className="w-full p-4 flex items-start gap-3 text-left"
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
                {categoryLabels[gap.category]}
              </span>
              <span className="text-xs text-gray-400">
                • Confidence: {gap.confidence}
              </span>
            </div>

            <p className="text-sm text-gray-900">{gap.description}</p>

            {gap.evidence && (
              <p className="text-xs text-gray-500 mt-1">
                Evidence: {gap.evidence}
              </p>
            )}
          </div>

          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="pt-4 space-y-4">
              {/* AI Suggestions */}
              {onGetSuggestions && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      AI Suggestions
                    </span>
                    {gapSuggestions.length === 0 && (
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

                  {gapSuggestions.length > 0 && (
                    <div className="space-y-2">
                      {gapSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            handleSelectSuggestion(gap.id, suggestion)
                          }
                          className={clsx(
                            "w-full p-2 text-left text-sm rounded border transition-colors",
                            resolutionText[gap.id] === suggestion
                              ? "border-primary-500 bg-primary-50 text-primary-900"
                              : "border-gray-200 hover:border-gray-300 text-gray-700",
                          )}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Manual resolution input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Response
                </label>
                <textarea
                  value={resolutionText[gap.id] || ""}
                  onChange={(e) =>
                    setResolutionText((prev) => ({
                      ...prev,
                      [gap.id]: e.target.value,
                    }))
                  }
                  placeholder="Address this gap with evidence or a plan..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onSkipGap?.(gap.id)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => handleSubmitResolution(gap.id)}
                  disabled={!resolutionText[gap.id]}
                  className="btn btn-primary text-sm disabled:opacity-50"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Address Gap
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={clsx("space-y-6", className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gap Analysis</h3>
          <p className="text-sm text-gray-500">
            {gaps.filter((g) => !g.resolved).length} gaps identified •{" "}
            {criticalGaps.length} critical
          </p>
        </div>
      </div>

      {/* Critical gaps */}
      {criticalGaps.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-red-700 mb-3">
            <AlertTriangle className="h-4 w-4" />
            Critical Gaps ({criticalGaps.length})
          </h4>
          <div className="space-y-3">{criticalGaps.map(renderGapCard)}</div>
        </div>
      )}

      {/* Significant gaps */}
      {significantGaps.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-3">
            <AlertCircle className="h-4 w-4" />
            Significant Gaps ({significantGaps.length})
          </h4>
          <div className="space-y-3">{significantGaps.map(renderGapCard)}</div>
        </div>
      )}

      {/* Minor gaps */}
      {minorGaps.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-3">
            <Info className="h-4 w-4" />
            Minor Gaps ({minorGaps.length})
          </h4>
          <div className="space-y-3">{minorGaps.map(renderGapCard)}</div>
        </div>
      )}

      {/* Resolved gaps */}
      {resolvedGaps.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-green-700 mb-3">
            <Check className="h-4 w-4" />
            Addressed ({resolvedGaps.length})
          </h4>
          <div className="space-y-2">
            {resolvedGaps.map((gap) => (
              <div
                key={gap.id}
                className="p-3 border border-green-200 bg-green-50 rounded-lg"
              >
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-900">{gap.description}</p>
                    {gap.resolution && (
                      <p className="text-xs text-green-700 mt-1">
                        Resolution: {gap.resolution}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {gaps.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Check className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium">No gaps identified</p>
          <p className="text-sm">Your idea is well-developed</p>
        </div>
      )}
    </div>
  );
}
