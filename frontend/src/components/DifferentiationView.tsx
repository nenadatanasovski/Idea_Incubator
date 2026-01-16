import { useState } from "react";
import {
  Loader2,
  Target,
  TrendingUp,
  Shield,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  MapPin,
  DollarSign,
  Lightbulb,
  HelpCircle,
  Zap,
  Calendar,
} from "lucide-react";
import clsx from "clsx";

// 5W+H Framework interface
export interface FiveWH {
  what?: string;
  why?: string;
  how?: string;
  when?: string;
  where?: string;
  howMuch?: string;
}

export interface MarketOpportunity {
  id: string;
  segment: string;
  description: string;
  fit: "high" | "medium" | "low";
  confidence: number;
  reasons: string[];
  // Extended 5W+H fields
  why?: string;
  marketSize?: string;
  timing?: string;
}

export interface DifferentiationStrategy {
  id: string;
  approach: string;
  description: string;
  validated: boolean;
  validationNotes?: string;
  alignedWith: string[];
  risks: string[];
  fitScore?: number; // 1-10
  fiveWH?: FiveWH; // Comprehensive breakdown
}

export interface CompetitiveRisk {
  id: string;
  competitor: string;
  threat: string;
  severity: "high" | "medium" | "low";
  mitigation?: string;
  competitors?: string[];
  timeframe?: string;
}

export interface MarketTiming {
  currentWindow: string;
  urgency: "high" | "medium" | "low";
  keyTrends: string[];
  recommendation: string;
}

interface DifferentiationViewProps {
  isAnalyzing: boolean;
  progress?: number;
  progressMessage?: string;
  opportunities: MarketOpportunity[];
  strategies: DifferentiationStrategy[];
  competitiveRisks: CompetitiveRisk[];
  marketTiming?: MarketTiming;
  overallConfidence?: number; // 0-100
  summary?: string;
  onAcceptStrategy?: (strategyId: string) => void;
  onRejectStrategy?: (strategyId: string) => void;
  onRunAnalysis?: () => void;
  onContinue?: () => void;
  className?: string;
  hasExistingResults?: boolean; // If true, shows "Run Again" instead of "Run Analysis"
}

const fitConfig = {
  high: { label: "High Fit", color: "text-green-600", bgColor: "bg-green-100" },
  medium: {
    label: "Medium Fit",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
  },
  low: { label: "Low Fit", color: "text-red-600", bgColor: "bg-red-100" },
};

const severityConfig = {
  high: {
    label: "High",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  medium: {
    label: "Medium",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  low: {
    label: "Low",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

export default function DifferentiationView({
  isAnalyzing,
  progress = 0,
  progressMessage = "Analyzing...",
  opportunities,
  strategies,
  competitiveRisks,
  marketTiming,
  overallConfidence,
  summary,
  onAcceptStrategy,
  onRejectStrategy,
  onRunAnalysis,
  onContinue,
  className,
  hasExistingResults: _hasExistingResults = false,
}: DifferentiationViewProps) {
  const [expandedSection, setExpandedSection] = useState<
    "opportunities" | "strategies" | "risks" | "timing" | null
  >("opportunities");
  const [acceptedStrategies, setAcceptedStrategies] = useState<Set<string>>(
    new Set(),
  );
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  const handleAcceptStrategy = (id: string) => {
    setAcceptedStrategies((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    onAcceptStrategy?.(id);
  };

  const handleRejectStrategy = (id: string) => {
    setAcceptedStrategies((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onRejectStrategy?.(id);
  };

  // Show loading state while analyzing
  if (isAnalyzing) {
    return (
      <div className={clsx("card text-center py-12", className)}>
        <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary-500 animate-spin" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Market Differentiation Analysis
        </h3>
        <p className="text-gray-500 mb-6">{progressMessage}</p>
        <div className="max-w-xs mx-auto">
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">{progress}% complete</p>
        </div>
      </div>
    );
  }

  // Show empty state if no analysis yet
  if (opportunities.length === 0 && strategies.length === 0) {
    return (
      <div className={clsx("card text-center py-12", className)}>
        <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Market Analysis Not Yet Run
        </h3>
        <p className="text-gray-500 mb-6">
          Run the differentiation analysis to identify market opportunities and
          positioning strategies.
        </p>
        {onRunAnalysis && (
          <button onClick={onRunAnalysis} className="btn btn-primary">
            Run Analysis
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={clsx("space-y-6", className)}>
      {/* Summary header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Market Analysis Results
            </h3>
            {overallConfidence !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all",
                      overallConfidence >= 70
                        ? "bg-green-500"
                        : overallConfidence >= 50
                          ? "bg-amber-500"
                          : "bg-red-500",
                    )}
                    style={{ width: `${overallConfidence}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">
                  {overallConfidence}% confidence
                </span>
              </div>
            )}
          </div>
          {onRunAnalysis && (
            <button
              onClick={onRunAnalysis}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Run Again
            </button>
          )}
        </div>

        {summary && (
          <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
            {summary}
          </p>
        )}

        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-cyan-600">
              {opportunities.length}
            </div>
            <div className="text-sm text-gray-500">Opportunities</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {strategies.length}
            </div>
            <div className="text-sm text-gray-500">Strategies</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {competitiveRisks.filter((r) => r.severity === "high").length}
            </div>
            <div className="text-sm text-gray-500">High Risks</div>
          </div>
          {marketTiming && (
            <div>
              <div
                className={clsx(
                  "text-2xl font-bold",
                  marketTiming.urgency === "high"
                    ? "text-green-600"
                    : marketTiming.urgency === "medium"
                      ? "text-amber-600"
                      : "text-gray-600",
                )}
              >
                {marketTiming.urgency === "high"
                  ? "🔥"
                  : marketTiming.urgency === "medium"
                    ? "⏰"
                    : "📅"}
              </div>
              <div className="text-sm text-gray-500">Timing</div>
            </div>
          )}
        </div>
      </div>

      {/* Market Opportunities */}
      <div className="card">
        <button
          onClick={() =>
            setExpandedSection(
              expandedSection === "opportunities" ? null : "opportunities",
            )
          }
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-cyan-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Market Opportunities
            </h3>
            <span className="text-sm text-gray-500">
              ({opportunities.length})
            </span>
          </div>
          {expandedSection === "opportunities" ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === "opportunities" && (
          <div className="mt-4 space-y-4">
            {opportunities.map((opp, idx) => {
              const fitStyle = fitConfig[opp.fit];
              return (
                <div
                  key={opp.id || idx}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{opp.segment}</h4>
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "text-xs px-2 py-0.5 rounded font-medium",
                          fitStyle.bgColor,
                          fitStyle.color,
                        )}
                      >
                        {fitStyle.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {opp.confidence}% confidence
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {opp.description}
                  </p>

                  {/* Extended 5W+H fields for opportunity */}
                  {(opp.why || opp.marketSize || opp.timing) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
                      {opp.why && (
                        <div className="flex items-start gap-2">
                          <HelpCircle className="h-4 w-4 text-cyan-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs text-gray-500 font-medium">
                              Why
                            </span>
                            <p className="text-xs text-gray-700">{opp.why}</p>
                          </div>
                        </div>
                      )}
                      {opp.marketSize && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs text-gray-500 font-medium">
                              Market Size
                            </span>
                            <p className="text-xs text-gray-700">
                              {opp.marketSize}
                            </p>
                          </div>
                        </div>
                      )}
                      {opp.timing && (
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs text-gray-500 font-medium">
                              Timing
                            </span>
                            <p className="text-xs text-gray-700">
                              {opp.timing}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {opp.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {opp.reasons.map((reason, ridx) => (
                        <span
                          key={ridx}
                          className="text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Differentiation Strategies */}
      <div className="card">
        <button
          onClick={() =>
            setExpandedSection(
              expandedSection === "strategies" ? null : "strategies",
            )
          }
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Differentiation Strategies
            </h3>
            <span className="text-sm text-gray-500">({strategies.length})</span>
          </div>
          {expandedSection === "strategies" ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === "strategies" && (
          <div className="mt-4 space-y-4">
            {strategies.map((strategy, idx) => {
              const isAccepted = acceptedStrategies.has(strategy.id);
              const isExpanded = expandedStrategy === strategy.id;
              const hasFiveWH =
                strategy.fiveWH &&
                Object.values(strategy.fiveWH).some((v) => v);

              return (
                <div
                  key={strategy.id || idx}
                  className={clsx(
                    "p-4 rounded-lg border-2 transition-all",
                    isAccepted
                      ? "border-purple-300 bg-purple-50"
                      : "border-gray-200 bg-gray-50",
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">
                        {strategy.approach}
                      </h4>
                      {strategy.fitScore && (
                        <span
                          className={clsx(
                            "text-xs px-2 py-0.5 rounded font-medium",
                            strategy.fitScore >= 8
                              ? "bg-green-100 text-green-700"
                              : strategy.fitScore >= 6
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700",
                          )}
                        >
                          Fit: {strategy.fitScore}/10
                        </span>
                      )}
                    </div>
                    {strategy.validated && (
                      <span className="flex items-center text-xs text-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Validated
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {strategy.description}
                  </p>

                  {/* 5W+H Breakdown - Expandable */}
                  {hasFiveWH && (
                    <div className="mb-3">
                      <button
                        onClick={() =>
                          setExpandedStrategy(isExpanded ? null : strategy.id)
                        }
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        <Zap className="h-3 w-3" />
                        {isExpanded
                          ? "Hide Implementation Details"
                          : "Show Implementation Details (5W+H)"}
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {isExpanded && strategy.fiveWH && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200 space-y-3">
                          {strategy.fiveWH.what && (
                            <div className="flex items-start gap-2">
                              <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">
                                  WHAT - What to do
                                </span>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {strategy.fiveWH.what}
                                </p>
                              </div>
                            </div>
                          )}
                          {strategy.fiveWH.why && (
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">
                                  WHY - Strategic rationale
                                </span>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {strategy.fiveWH.why}
                                </p>
                              </div>
                            </div>
                          )}
                          {strategy.fiveWH.how && (
                            <div className="flex items-start gap-2">
                              <Zap className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">
                                  HOW - Implementation approach
                                </span>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {strategy.fiveWH.how}
                                </p>
                              </div>
                            </div>
                          )}
                          {strategy.fiveWH.when && (
                            <div className="flex items-start gap-2">
                              <Calendar className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">
                                  WHEN - Timeline & milestones
                                </span>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {strategy.fiveWH.when}
                                </p>
                              </div>
                            </div>
                          )}
                          {strategy.fiveWH.where && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">
                                  WHERE - Market & channels
                                </span>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {strategy.fiveWH.where}
                                </p>
                              </div>
                            </div>
                          )}
                          {strategy.fiveWH.howMuch && (
                            <div className="flex items-start gap-2">
                              <DollarSign className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-medium text-gray-700">
                                  HOW MUCH - Resources & ROI
                                </span>
                                <p className="text-sm text-gray-600 mt-0.5">
                                  {strategy.fiveWH.howMuch}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {strategy.alignedWith.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500">
                        Aligned with:{" "}
                      </span>
                      {strategy.alignedWith.map((item, aidx) => (
                        <span
                          key={aidx}
                          className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded mr-1"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {strategy.risks.length > 0 && (
                    <div className="mb-3">
                      <span className="text-xs text-gray-500">Risks: </span>
                      {strategy.risks.map((risk, ridx) => (
                        <span
                          key={ridx}
                          className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded mr-1"
                        >
                          {risk}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        isAccepted
                          ? handleRejectStrategy(strategy.id)
                          : handleAcceptStrategy(strategy.id)
                      }
                      className={clsx(
                        "text-sm px-3 py-1 rounded transition-colors",
                        isAccepted
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300",
                      )}
                    >
                      {isAccepted ? "Selected" : "Select Strategy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Competitive Risks */}
      <div className="card">
        <button
          onClick={() =>
            setExpandedSection(expandedSection === "risks" ? null : "risks")
          }
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Competitive Risks
            </h3>
            <span className="text-sm text-gray-500">
              ({competitiveRisks.length})
            </span>
          </div>
          {expandedSection === "risks" ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSection === "risks" && (
          <div className="mt-4 space-y-3">
            {competitiveRisks.map((risk, idx) => {
              const sevStyle = severityConfig[risk.severity];
              return (
                <div
                  key={risk.id || idx}
                  className={clsx(
                    "p-4 rounded-lg border",
                    sevStyle.bgColor,
                    sevStyle.borderColor,
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={clsx("h-4 w-4", sevStyle.color)}
                      />
                      <span className="font-medium text-gray-900">
                        {risk.competitor}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {risk.timeframe && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {risk.timeframe}
                        </span>
                      )}
                      <span
                        className={clsx(
                          "text-xs px-2 py-0.5 rounded font-medium",
                          sevStyle.bgColor,
                          sevStyle.color,
                        )}
                      >
                        {sevStyle.label} Risk
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{risk.threat}</p>
                  {risk.mitigation && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Mitigation:</span>{" "}
                      {risk.mitigation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Market Timing */}
      {marketTiming && (
        <div className="card">
          <button
            onClick={() =>
              setExpandedSection(expandedSection === "timing" ? null : "timing")
            }
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                Market Timing
              </h3>
              <span
                className={clsx(
                  "text-xs px-2 py-0.5 rounded font-medium",
                  marketTiming.urgency === "high"
                    ? "bg-green-100 text-green-700"
                    : marketTiming.urgency === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700",
                )}
              >
                {marketTiming.urgency === "high"
                  ? "Act Now"
                  : marketTiming.urgency === "medium"
                    ? "Time Sensitive"
                    : "Flexible"}
              </span>
            </div>
            {expandedSection === "timing" ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {expandedSection === "timing" && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Current Window
                </h4>
                <p className="text-sm text-gray-700">
                  {marketTiming.currentWindow}
                </p>
              </div>

              {marketTiming.keyTrends && marketTiming.keyTrends.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Key Trends
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {marketTiming.keyTrends.map((trend, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded"
                      >
                        {trend}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Recommendation
                </h4>
                <p className="text-sm text-gray-700">
                  {marketTiming.recommendation}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      {onContinue && (
        <div className="flex justify-end">
          <button
            onClick={onContinue}
            disabled={acceptedStrategies.size === 0}
            className="btn btn-primary disabled:opacity-50"
          >
            Accept & Continue to Update
          </button>
        </div>
      )}
    </div>
  );
}
