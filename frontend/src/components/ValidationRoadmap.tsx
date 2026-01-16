/**
 * ValidationRoadmap
 *
 * Displays a prioritized list of validation steps based on
 * the chosen strategic approach and identified risks.
 */

import type {
  EnhancedStrategy,
  StrategicApproach,
  ValidatedOpportunity,
  CompetitiveRisk,
} from "../types";

interface Props {
  approach?: StrategicApproach;
  strategies?: EnhancedStrategy[];
  opportunities?: ValidatedOpportunity[];
  risks?: CompetitiveRisk[];
  className?: string;
}

interface ValidationStep {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  effort: "minimal" | "moderate" | "significant";
  category: "market" | "technical" | "financial" | "customer";
  approaches: StrategicApproach[];
}

const VALIDATION_STEPS: ValidationStep[] = [
  {
    id: "customer_interviews",
    title: "Customer Discovery Interviews",
    description:
      "Talk to 10-20 potential customers to validate the problem exists and understand their current solutions",
    priority: "critical",
    effort: "moderate",
    category: "customer",
    approaches: [
      "create",
      "copy_improve",
      "combine",
      "localize",
      "specialize",
      "time",
    ],
  },
  {
    id: "competitor_analysis",
    title: "Deep Competitor Analysis",
    description:
      "Map existing solutions, their pricing, and gaps they leave unaddressed",
    priority: "high",
    effort: "moderate",
    category: "market",
    approaches: ["copy_improve", "combine", "localize", "specialize"],
  },
  {
    id: "unique_value_test",
    title: "Unique Value Proposition Test",
    description:
      "A/B test messaging to validate your differentiation resonates with target audience",
    priority: "high",
    effort: "moderate",
    category: "customer",
    approaches: ["create", "combine", "specialize"],
  },
  {
    id: "mvp_prototype",
    title: "MVP/Prototype Build",
    description:
      "Create minimal version to test core functionality and gather feedback",
    priority: "high",
    effort: "significant",
    category: "technical",
    approaches: ["create", "combine", "time"],
  },
  {
    id: "pricing_validation",
    title: "Pricing Validation",
    description:
      "Test willingness to pay through landing pages or direct conversations",
    priority: "high",
    effort: "minimal",
    category: "financial",
    approaches: [
      "create",
      "copy_improve",
      "combine",
      "localize",
      "specialize",
      "time",
    ],
  },
  {
    id: "local_market_research",
    title: "Local Market Research",
    description:
      "Validate demand exists in target geography through surveys and interviews",
    priority: "critical",
    effort: "moderate",
    category: "market",
    approaches: ["localize"],
  },
  {
    id: "niche_size_validation",
    title: "Niche Size Validation",
    description:
      "Confirm the specialized niche is large enough to sustain your income goals",
    priority: "critical",
    effort: "moderate",
    category: "market",
    approaches: ["specialize"],
  },
  {
    id: "timing_window",
    title: "Timing Window Analysis",
    description:
      "Validate the market timing opportunity has sufficient runway before competition arrives",
    priority: "critical",
    effort: "minimal",
    category: "market",
    approaches: ["time"],
  },
  {
    id: "landing_page",
    title: "Landing Page Test",
    description:
      "Create a landing page to measure interest and collect signups",
    priority: "medium",
    effort: "minimal",
    category: "customer",
    approaches: [
      "create",
      "copy_improve",
      "combine",
      "localize",
      "specialize",
      "time",
    ],
  },
  {
    id: "technical_feasibility",
    title: "Technical Feasibility Spike",
    description: "Build proof-of-concept for technically risky components",
    priority: "high",
    effort: "significant",
    category: "technical",
    approaches: ["create", "combine", "time"],
  },
  {
    id: "partnership_outreach",
    title: "Partnership/Channel Validation",
    description:
      "Test potential distribution channels or partnership opportunities",
    priority: "medium",
    effort: "moderate",
    category: "market",
    approaches: ["localize", "specialize"],
  },
  {
    id: "cost_structure",
    title: "Cost Structure Validation",
    description:
      "Map all costs to ensure unit economics work at your price point",
    priority: "high",
    effort: "moderate",
    category: "financial",
    approaches: ["copy_improve", "localize"],
  },
];

function getStepsForApproach(approach?: StrategicApproach): ValidationStep[] {
  if (!approach) return VALIDATION_STEPS.slice(0, 5); // Default selection
  return VALIDATION_STEPS.filter((step) => step.approaches.includes(approach));
}

function prioritizeSteps(
  steps: ValidationStep[],
  risks?: CompetitiveRisk[],
): ValidationStep[] {
  // Boost priority for steps that address identified risks
  const boosted = steps.map((step) => {
    let boost = 0;

    if (risks) {
      // If there are high-severity risks, boost related categories
      const highRisks = risks.filter((r) => r.severity === "high");
      highRisks.forEach((risk) => {
        if (risk.type === "market_saturation" && step.category === "market")
          boost++;
        if (risk.type === "price_war" && step.category === "financial") boost++;
        if (risk.type === "feature_parity" && step.category === "technical")
          boost++;
      });
    }

    return { ...step, boost };
  });

  // Sort by priority (with boost) then effort
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const effortOrder = { minimal: 0, moderate: 1, significant: 2 };

  return boosted.sort((a, b) => {
    const aPriority = priorityOrder[a.priority] - a.boost;
    const bPriority = priorityOrder[b.priority] - b.boost;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return effortOrder[a.effort] - effortOrder[b.effort];
  });
}

const priorityStyles = {
  critical: {
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
  },
  high: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  medium: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-200",
  },
  low: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
};

const effortStyles = {
  minimal: { icon: "⚡", label: "Quick win" },
  moderate: { icon: "🔧", label: "Moderate effort" },
  significant: { icon: "🏗️", label: "Major effort" },
};

const categoryIcons = {
  market: "📊",
  technical: "💻",
  financial: "💰",
  customer: "👥",
};

export default function ValidationRoadmap({
  approach,
  strategies: _strategies,
  opportunities: _opportunities,
  risks,
  className = "",
}: Props) {
  const baseSteps = getStepsForApproach(approach);
  const prioritizedSteps = prioritizeSteps(baseSteps, risks);

  // Take top 6 most relevant steps
  const displaySteps = prioritizedSteps.slice(0, 6);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Validation Roadmap
        </h3>
        {approach && (
          <span className="text-sm text-gray-500 capitalize">
            For: {approach.replace("_", " ")} approach
          </span>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Prioritized steps to validate your idea before committing significant
        resources.
      </p>

      <div className="space-y-4">
        {displaySteps.map((step, index) => {
          const pStyles = priorityStyles[step.priority];
          const eStyles = effortStyles[step.effort];
          const catIcon = categoryIcons[step.category];

          return (
            <div
              key={step.id}
              className={`flex gap-4 p-4 rounded-lg border ${pStyles.border} ${pStyles.bg}`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center font-semibold text-gray-700 border border-gray-200">
                {index + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{catIcon}</span>
                  <h4 className={`font-medium ${pStyles.text}`}>
                    {step.title}
                  </h4>
                </div>
                <p className="text-sm text-gray-600">{step.description}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${pStyles.bg} ${pStyles.text} font-medium`}
                  >
                    {step.priority}
                  </span>
                  <span className="text-xs text-gray-500">
                    {eStyles.icon} {eStyles.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {prioritizedSteps.length > 6 && (
        <p className="mt-4 text-sm text-gray-500 text-center">
          +{prioritizedSteps.length - 6} more validation steps available
        </p>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          Validation Best Practice
        </h4>
        <p className="text-sm text-blue-700">
          Start with customer interviews. Understanding real customer pain
          points will inform all subsequent validation activities and help you
          avoid building something nobody wants.
        </p>
      </div>
    </div>
  );
}
