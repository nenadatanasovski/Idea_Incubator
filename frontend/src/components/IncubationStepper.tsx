import { useState } from "react";
import {
  Check,
  Lightbulb,
  Search,
  Target,
  RefreshCw,
  BarChart3,
  Repeat,
  ChevronRight,
  Lock,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";

// Incubation phases with detailed metadata
// Note: 'position' is the canonical name (was 'differentiate')
export type IncubationPhase =
  | "capture"
  | "clarify"
  | "position"
  | "update"
  | "evaluate"
  | "iterate";

// For backward compatibility
export type LegacyIncubationPhase =
  | "capture"
  | "clarify"
  | "differentiate"
  | "update"
  | "evaluate"
  | "iterate";

// Map legacy phase names to new ones
export const mapPhase = (phase: string): IncubationPhase => {
  if (phase === "differentiate" || phase === "differentiation")
    return "position";
  return phase as IncubationPhase;
};

export interface PhaseConfig {
  id: IncubationPhase;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  instructions: string;
  completionCriteria: string;
}

export const incubationPhases: PhaseConfig[] = [
  {
    id: "capture",
    label: "Capture",
    icon: Lightbulb,
    color: "text-purple-600",
    bgColor: "bg-purple-500",
    borderColor: "border-purple-500",
    description: "Document your idea",
    instructions:
      "Capture the core concept, problem, and initial solution approach.",
    completionCriteria: "Title, summary, and basic description complete",
  },
  {
    id: "clarify",
    label: "Clarify",
    icon: Search,
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    borderColor: "border-blue-500",
    description: "Answer key questions",
    instructions:
      "Answer critical questions to develop your idea and identify gaps.",
    completionCriteria: "80% of critical questions answered",
  },
  {
    id: "position",
    label: "Position",
    icon: Target,
    color: "text-cyan-600",
    bgColor: "bg-cyan-500",
    borderColor: "border-cyan-500",
    description: "Strategic positioning",
    instructions:
      "Set resources, choose strategic approach, and select positioning strategy.",
    completionCriteria:
      "Financial allocation, approach, and strategy decisions captured",
  },
  {
    id: "update",
    label: "Update",
    icon: RefreshCw,
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    borderColor: "border-amber-500",
    description: "Refine your idea",
    instructions:
      "Update your idea based on insights from clarification and positioning.",
    completionCriteria: "Idea content updated with new insights",
  },
  {
    id: "evaluate",
    label: "Evaluate",
    icon: BarChart3,
    color: "text-green-600",
    bgColor: "bg-green-500",
    borderColor: "border-green-500",
    description: "AI-powered scoring",
    instructions:
      "Run the AI evaluation to score your idea against 30 criteria.",
    completionCriteria: "Evaluation complete with score and synthesis",
  },
  {
    id: "iterate",
    label: "Iterate",
    icon: Repeat,
    color: "text-orange-600",
    bgColor: "bg-orange-500",
    borderColor: "border-orange-500",
    description: "Improve and repeat",
    instructions: "Address weak areas identified in evaluation and iterate.",
    completionCriteria: "Improvements made, ready for re-evaluation",
  },
];

interface IncubationStepperProps {
  currentPhase: IncubationPhase;
  completedPhases: IncubationPhase[];
  canAdvance: boolean;
  readinessPercent?: number;
  blockingGaps?: string[];
  onPhaseClick?: (phase: IncubationPhase) => void;
  onAdvance?: () => void;
  onBack?: () => void;
  className?: string;
}

export default function IncubationStepper({
  currentPhase,
  completedPhases,
  canAdvance,
  readinessPercent = 0,
  blockingGaps = [],
  onPhaseClick,
  onAdvance,
  onBack,
  className,
}: IncubationStepperProps) {
  const [expandedPhase, setExpandedPhase] = useState<IncubationPhase | null>(
    currentPhase,
  );

  const currentIndex = incubationPhases.findIndex((p) => p.id === currentPhase);

  const getPhaseStatus = (
    phase: IncubationPhase,
    index: number,
  ): "completed" | "current" | "locked" | "upcoming" => {
    if (completedPhases.includes(phase)) return "completed";
    if (phase === currentPhase) return "current";
    if (index > currentIndex + 1) return "locked";
    return "upcoming";
  };

  const canNavigateToPhase = (
    phase: IncubationPhase,
    index: number,
  ): boolean => {
    const status = getPhaseStatus(phase, index);
    return (
      status === "completed" ||
      status === "current" ||
      (status === "upcoming" && canAdvance)
    );
  };

  return (
    <div className={clsx("card", className)}>
      {/* Phase progress header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">
          Incubation Journey
        </h3>
        <span className="text-sm text-gray-500">
          Phase {currentIndex + 1} of {incubationPhases.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative mb-6">
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-primary-500 rounded-full transition-all duration-500"
            style={{
              width: `${((currentIndex + (canAdvance ? 1 : 0.5)) / incubationPhases.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Phase steps */}
      <div className="relative">
        {/* Connection line */}
        <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-gray-200" />

        <div className="space-y-2">
          {incubationPhases.map((phase, index) => {
            const status = getPhaseStatus(phase.id, index);
            const isExpanded = expandedPhase === phase.id;
            const canNavigate = canNavigateToPhase(phase.id, index);
            const Icon = phase.icon;

            return (
              <div key={phase.id} className="relative">
                {/* Phase item */}
                <button
                  onClick={() => {
                    if (canNavigate && onPhaseClick) {
                      onPhaseClick(phase.id);
                    }
                    setExpandedPhase(isExpanded ? null : phase.id);
                  }}
                  disabled={!canNavigate}
                  className={clsx(
                    "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all",
                    status === "current" &&
                      "bg-primary-50 border-2 border-primary-200",
                    status === "completed" && "hover:bg-gray-50",
                    status === "upcoming" && canAdvance && "hover:bg-gray-50",
                    status === "upcoming" && !canAdvance && "opacity-50",
                    status === "locked" && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {/* Phase icon */}
                  <div
                    className={clsx(
                      "relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all flex-shrink-0",
                      status === "completed" &&
                        "bg-primary-500 border-primary-500 text-white",
                      status === "current" &&
                        `${phase.bgColor} border-white text-white shadow-lg`,
                      status === "upcoming" &&
                        canAdvance &&
                        "bg-white border-gray-300 text-gray-400",
                      status === "upcoming" &&
                        !canAdvance &&
                        "bg-gray-100 border-gray-200 text-gray-300",
                      status === "locked" &&
                        "bg-gray-100 border-gray-200 text-gray-300",
                    )}
                  >
                    {status === "completed" ? (
                      <Check className="h-4 w-4" />
                    ) : status === "locked" ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  {/* Phase content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={clsx(
                          "font-medium",
                          status === "current" && "text-gray-900",
                          status === "completed" && "text-primary-600",
                          (status === "upcoming" || status === "locked") &&
                            "text-gray-500",
                        )}
                      >
                        {phase.label}
                      </span>
                      {status === "completed" && (
                        <Check className="h-4 w-4 text-primary-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {phase.description}
                    </p>

                    {/* Expanded content for current phase */}
                    {isExpanded && status === "current" && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">
                          {phase.instructions}
                        </p>

                        {/* Progress indicator for clarify phase */}
                        {phase.id === "clarify" &&
                          readinessPercent !== undefined && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>Progress</span>
                                <span>{Math.round(readinessPercent)}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full">
                                <div
                                  className={clsx(
                                    "h-1.5 rounded-full transition-all",
                                    readinessPercent >= 80
                                      ? "bg-green-500"
                                      : readinessPercent >= 50
                                        ? "bg-yellow-500"
                                        : "bg-red-400",
                                  )}
                                  style={{ width: `${readinessPercent}%` }}
                                />
                              </div>
                            </div>
                          )}

                        {/* Blocking gaps */}
                        {blockingGaps.length > 0 && (
                          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg text-xs">
                            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium text-amber-700">
                                Blocking gaps:
                              </span>
                              <span className="text-amber-600 ml-1">
                                {blockingGaps.slice(0, 2).join(", ")}
                                {blockingGaps.length > 2 &&
                                  ` +${blockingGaps.length - 2} more`}
                              </span>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-gray-400 mt-2">
                          <span className="font-medium">To complete:</span>{" "}
                          {phase.completionCriteria}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    className={clsx(
                      "h-4 w-4 text-gray-400 transition-transform flex-shrink-0",
                      isExpanded && "rotate-90",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          disabled={currentIndex === 0}
          className="btn btn-secondary disabled:opacity-50"
        >
          ← Back
        </button>

        <button
          onClick={onAdvance}
          disabled={!canAdvance}
          className={clsx(
            "btn",
            canAdvance
              ? "btn-primary"
              : "btn-secondary opacity-50 cursor-not-allowed",
          )}
        >
          {currentIndex === incubationPhases.length - 1
            ? "Complete"
            : "Continue →"}
        </button>
      </div>
    </div>
  );
}
