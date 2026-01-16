import { useState, useEffect } from "react";
import type {
  IdeaFinancialAllocation,
  StrategicApproach,
  EnhancedStrategy,
  PositioningDecision,
  UserProfileSummary,
  StrategicSummary,
  ValidatedOpportunity,
} from "../types";
import {
  getFinancialAllocation,
  getPositioningDecision,
  runPositioningAnalysis,
  getPositioningResults,
  type PositioningAnalysisResult,
} from "../api/client";
import FinancialAllocationForm from "./FinancialAllocationForm";
import StrategicApproachSelector from "./StrategicApproachSelector";
import StrategyComparisonMatrix from "./StrategyComparisonMatrix";
import StrategyDetailPanel from "./StrategyDetailPanel";
import DecisionCapture from "./DecisionCapture";

// Step in the Position phase flow
type PositionStep =
  | "allocation"
  | "approach"
  | "analysis"
  | "compare"
  | "decide";

interface Props {
  slug: string;
  profile?: UserProfileSummary | null;
  onPhaseComplete: () => void;
  onBack?: () => void;
}

export default function PositionPhaseContainer({
  slug,
  profile,
  onPhaseComplete,
  onBack,
}: Props) {
  // State
  const [currentStep, setCurrentStep] = useState<PositionStep>("allocation");
  const [allocation, setAllocation] = useState<IdeaFinancialAllocation | null>(
    null,
  );
  const [selectedApproach, setSelectedApproach] =
    useState<StrategicApproach | null>(null);
  const [analyzedApproach, setAnalyzedApproach] =
    useState<StrategicApproach | null>(null); // Track which approach was analyzed
  const [strategies, setStrategies] = useState<EnhancedStrategy[]>([]);
  const [opportunities, setOpportunities] = useState<ValidatedOpportunity[]>(
    [],
  );
  const [risks, setRisks] = useState<
    Array<{
      id: string;
      description: string;
      severity: "high" | "medium" | "low";
      mitigation?: string;
    }>
  >([]);
  const [strategicSummary, setStrategicSummary] =
    useState<StrategicSummary | null>(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    null,
  );
  const [detailStrategy, setDetailStrategy] = useState<EnhancedStrategy | null>(
    null,
  );
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Helper to populate state from positioning results
  const populateFromResults = (results: PositioningAnalysisResult) => {
    setStrategies(
      results.strategies.map((s, i) => ({
        ...s,
        id: s.id || `strategy-${i}`,
      })),
    );
    setOpportunities(
      results.marketOpportunities.map((o, i) => ({
        ...o,
        id: o.id || `opp-${i}`,
      })) as ValidatedOpportunity[],
    );
    setRisks(
      results.competitiveRisks.map((r, i) => ({
        id: r.id || `risk-${i}`,
        description: r.description,
        severity: r.severity,
        mitigation: r.mitigation,
      })),
    );
    if (results.strategicSummary) {
      setStrategicSummary(results.strategicSummary as StrategicSummary);
    }
  };

  // Load existing data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Load allocation
        const allocationData = await getFinancialAllocation(slug);
        if (allocationData.exists) {
          setAllocation(allocationData as IdeaFinancialAllocation);
          if (allocationData.strategicApproach) {
            setSelectedApproach(allocationData.strategicApproach);
          }
        }

        // Check for existing positioning decision
        const decisionData = await getPositioningDecision(slug);
        if (decisionData.exists) {
          setSelectedStrategyId(decisionData.primaryStrategyId || null);
        }

        // Try to load existing positioning analysis results
        try {
          const results = await getPositioningResults(slug);
          if (results && results.strategies && results.strategies.length > 0) {
            populateFromResults(results);
            // Track which approach was used for these results
            if (results.approach) {
              setAnalyzedApproach(results.approach as StrategicApproach);
            } else if (allocationData.strategicApproach) {
              setAnalyzedApproach(allocationData.strategicApproach);
            }

            // If we have existing results and allocation with approach, skip to compare
            if (allocationData.exists && allocationData.strategicApproach) {
              setCurrentStep("compare");
            }
          }
        } catch {
          // No existing results, that's fine - user will run fresh analysis
        }
      } catch (err) {
        console.error("Failed to load position phase data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Step handlers
  const handleAllocationComplete = (newAllocation: IdeaFinancialAllocation) => {
    setAllocation(newAllocation);
    setCurrentStep("approach");
  };

  const handleApproachSelected = (approach: StrategicApproach) => {
    setSelectedApproach(approach);
  };

  const handleApproachComplete = async (forceRerun = false) => {
    if (!selectedApproach) return;

    // If we already have valid analysis for this approach and not forcing rerun, skip to compare
    if (
      !forceRerun &&
      strategies.length > 0 &&
      analyzedApproach === selectedApproach
    ) {
      setCurrentStep("compare");
      return;
    }

    setCurrentStep("analysis");
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisProgress("Preparing positioning analysis...");

    try {
      // Run the positioning analysis with the selected approach
      setAnalysisProgress(
        "Running AI analysis with your strategic approach...",
      );
      const results = await runPositioningAnalysis(slug, selectedApproach);

      if (results && results.strategies && results.strategies.length > 0) {
        populateFromResults(results);
        setAnalyzedApproach(selectedApproach); // Track which approach was analyzed
        setCurrentStep("compare");
      } else {
        setAnalysisError(
          "Analysis completed but no strategies were generated. Please try again or adjust your approach.",
        );
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Analysis failed. Please try again.";
      // Check for specific error cases
      if (message.includes("viability gate") || message.includes("readiness")) {
        setAnalysisError(
          "Your idea needs to pass the viability gate first. Please complete more questions in the Clarify phase to reach 50% readiness.",
        );
      } else {
        setAnalysisError(message);
      }
    } finally {
      setAnalysisLoading(false);
      setAnalysisProgress("");
    }
  };

  // Handler to force re-run analysis
  const handleRerunAnalysis = () => {
    handleApproachComplete(true);
  };

  const handleStrategySelect = (strategyId: string) => {
    setSelectedStrategyId(strategyId);
    const strategy = strategies.find((s) => (s.id || s.name) === strategyId);
    if (strategy) {
      setDetailStrategy(strategy);
    }
  };

  const handleDetailClose = () => {
    setDetailStrategy(null);
  };

  const handleProceedToDecision = () => {
    setDetailStrategy(null);
    setCurrentStep("decide");
  };

  const handleDecisionComplete = (_decision: PositioningDecision) => {
    onPhaseComplete();
  };

  const handleBack = () => {
    switch (currentStep) {
      case "approach":
        setCurrentStep("allocation");
        break;
      case "analysis":
      case "compare":
        setCurrentStep("approach");
        break;
      case "decide":
        setCurrentStep("compare");
        break;
      default:
        if (onBack) onBack();
    }
  };

  // Step navigation
  const steps: Array<{ key: PositionStep; label: string }> = [
    { key: "allocation", label: "Resources" },
    { key: "approach", label: "Approach" },
    { key: "analysis", label: "Analysis" },
    { key: "compare", label: "Strategies" },
    { key: "decide", label: "Decision" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isComplete = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.key} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isComplete
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isComplete ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-6 text-xs whitespace-nowrap ${
                      isCurrent ? "font-medium text-blue-600" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      index < currentStepIndex ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-12">
        {/* Step 1: Resource Allocation */}
        {currentStep === "allocation" && (
          <FinancialAllocationForm
            slug={slug}
            profile={profile}
            onSave={handleAllocationComplete}
            onNext={() => setCurrentStep("approach")}
          />
        )}

        {/* Step 2: Strategic Approach Selection */}
        {currentStep === "approach" && (
          <StrategicApproachSelector
            slug={slug}
            allocation={allocation}
            profile={profile}
            onApproachSelected={handleApproachSelected}
            onNext={handleApproachComplete}
            onBack={handleBack}
          />
        )}

        {/* Step 3: Analysis (loading state) */}
        {currentStep === "analysis" && (
          <div className="text-center py-12">
            {analysisLoading ? (
              <div>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  Running Positioning Analysis...
                </p>
                <p className="text-gray-500 mt-2">
                  {analysisProgress ||
                    "Analyzing market opportunities and generating strategies"}
                </p>
                <p className="text-xs text-gray-400 mt-4">
                  This may take 30-60 seconds depending on complexity
                </p>
              </div>
            ) : analysisError ? (
              <div>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-red-600">
                  Analysis Error
                </p>
                <p className="text-gray-500 mt-2">{analysisError}</p>
                <button
                  onClick={handleBack}
                  className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Go Back
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Step 4: Strategy Comparison */}
        {currentStep === "compare" && (
          <div className="space-y-6">
            {/* Analysis Info Bar */}
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">
                  Analysis complete for{" "}
                  <span className="font-medium text-gray-900">
                    {analyzedApproach}
                  </span>{" "}
                  approach
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {strategies.length} strategies generated
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {opportunities.length} opportunities
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {risks.length} risks
                </span>
              </div>
              <button
                onClick={handleRerunAnalysis}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-800 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Re-run Analysis
              </button>
            </div>

            {/* Summary Card - Improved */}
            {strategicSummary && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Recommended Strategy
                    </h4>
                    <p className="font-semibold text-gray-900 text-lg">
                      {strategicSummary.recommendedStrategy.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-medium text-blue-600">
                        {strategicSummary.recommendedStrategy.fitScore}/10 fit
                      </span>
                      <span className="text-xs text-gray-400">
                        profile match
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Primary Opportunity
                    </h4>
                    <p className="font-medium text-gray-900 text-sm leading-relaxed">
                      {strategicSummary.primaryOpportunity.segment}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Key Risk to Mitigate
                    </h4>
                    <p
                      className="font-medium text-gray-900 text-sm leading-relaxed"
                      title={strategicSummary.criticalRisk.description}
                    >
                      {strategicSummary.criticalRisk.description}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Market Timing
                    </h4>
                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                        strategicSummary.timingAssessment.urgency === "high"
                          ? "bg-red-100 text-red-700"
                          : strategicSummary.timingAssessment.urgency ===
                              "medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          strategicSummary.timingAssessment.urgency === "high"
                            ? "bg-red-500"
                            : strategicSummary.timingAssessment.urgency ===
                                "medium"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                      />
                      {strategicSummary.timingAssessment.urgency.toUpperCase()}{" "}
                      URGENCY
                    </div>
                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {strategicSummary.timingAssessment.window}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Comparison Matrix */}
            <StrategyComparisonMatrix
              strategies={strategies}
              allocation={allocation}
              selectedStrategyId={selectedStrategyId}
              onSelectStrategy={handleStrategySelect}
              recommendedStrategyId={strategicSummary?.recommendedStrategy.id}
            />

            {/* Detail Panel (slide-over or modal) */}
            {detailStrategy && (
              <div className="fixed inset-0 z-50 overflow-hidden">
                <div
                  className="absolute inset-0 bg-black/30"
                  onClick={handleDetailClose}
                />
                <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-xl overflow-y-auto">
                  <StrategyDetailPanel
                    strategy={detailStrategy}
                    allocation={allocation}
                    onClose={handleDetailClose}
                    onSelect={() => {
                      setSelectedStrategyId(
                        detailStrategy.id || detailStrategy.name,
                      );
                      handleProceedToDecision();
                    }}
                    isSelected={
                      selectedStrategyId ===
                      (detailStrategy.id || detailStrategy.name)
                    }
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleProceedToDecision}
                disabled={!selectedStrategyId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Decision
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Decision Capture */}
        {currentStep === "decide" && (
          <DecisionCapture
            slug={slug}
            strategies={strategies}
            risks={risks}
            selectedStrategyId={selectedStrategyId}
            selectedApproach={selectedApproach}
            timingUrgency={strategicSummary?.timingAssessment.urgency}
            timingWindow={strategicSummary?.timingAssessment.window}
            onComplete={handleDecisionComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
