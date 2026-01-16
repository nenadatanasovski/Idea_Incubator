/**
 * CompetitiveResponseCard
 *
 * Displays analysis of likely competitive responses and
 * how to prepare for them based on the chosen strategic approach.
 */

import type {
  StrategicApproach,
  CompetitiveRisk,
  EnhancedStrategy,
} from "../types";

interface Props {
  approach?: StrategicApproach;
  risks?: CompetitiveRisk[];
  strategy?: EnhancedStrategy;
  className?: string;
}

interface CompetitiveScenario {
  id: string;
  title: string;
  likelihood: "low" | "medium" | "high";
  timeframe: string;
  description: string;
  preparation: string[];
  approaches: StrategicApproach[];
}

const COMPETITIVE_SCENARIOS: CompetitiveScenario[] = [
  {
    id: "incumbent_copy",
    title: "Incumbents Copy Your Feature",
    likelihood: "high",
    timeframe: "6-12 months",
    description:
      "Established players add your innovation to their product, leveraging their existing user base.",
    preparation: [
      "Build deep customer relationships before they can react",
      "Focus on execution speed and quality",
      "Create switching costs through integrations",
      "Build brand loyalty in your niche",
    ],
    approaches: ["create", "copy_improve", "combine"],
  },
  {
    id: "price_war",
    title: "Price Competition Begins",
    likelihood: "medium",
    timeframe: "3-6 months",
    description:
      "Competitors lower prices to prevent you from gaining market share.",
    preparation: [
      "Differentiate on value, not just price",
      "Build operational efficiency from day one",
      "Create premium tier with unique value",
      "Focus on customer segments willing to pay",
    ],
    approaches: ["copy_improve", "localize"],
  },
  {
    id: "fast_follower",
    title: "Fast Followers Enter",
    likelihood: "high",
    timeframe: "3-9 months",
    description:
      "New competitors copy your approach after seeing initial traction.",
    preparation: [
      "Move fast to capture market share early",
      "Build defensible moats (network effects, data, brand)",
      "Secure key partnerships before competitors",
      "Document and protect innovations if possible",
    ],
    approaches: ["create", "time", "localize"],
  },
  {
    id: "niche_ignored",
    title: "Large Players Ignore You",
    likelihood: "high",
    timeframe: "Ongoing",
    description:
      "Your niche is too small for incumbents to care about, giving you room to grow.",
    preparation: [
      "Maximize this advantage while it lasts",
      "Build strong position before expanding",
      "Be careful not to attract attention prematurely",
      "Plan eventual expansion strategy",
    ],
    approaches: ["specialize"],
  },
  {
    id: "acquisition_interest",
    title: "Acquisition Interest",
    likelihood: "medium",
    timeframe: "12-24 months",
    description:
      "Larger players may attempt to acquire you rather than compete.",
    preparation: [
      "Know your desired outcome (sell vs. keep building)",
      "Build value in defensible ways",
      "Maintain relationships with potential acquirers",
      "Keep options open but stay focused",
    ],
    approaches: ["create", "combine", "specialize"],
  },
  {
    id: "local_competition",
    title: "Local Competitors Emerge",
    likelihood: "medium",
    timeframe: "6-18 months",
    description:
      "Other entrepreneurs see your success and start similar local ventures.",
    preparation: [
      "Build strong local brand and relationships",
      "Lock in key partnerships early",
      "Create operational advantages",
      "Consider expanding to adjacent areas",
    ],
    approaches: ["localize"],
  },
  {
    id: "market_matures",
    title: "Market Matures Quickly",
    likelihood: "high",
    timeframe: "12-24 months",
    description:
      "The timing window closes as the market becomes crowded and commoditized.",
    preparation: [
      "Plan transition strategy before maturation",
      "Build assets that transfer to next phase",
      "Identify adjacent opportunities",
      "Consider pivoting to related markets",
    ],
    approaches: ["time"],
  },
];

function getScenariosForApproach(
  approach?: StrategicApproach,
): CompetitiveScenario[] {
  if (!approach) return COMPETITIVE_SCENARIOS.slice(0, 3);
  return COMPETITIVE_SCENARIOS.filter((s) => s.approaches.includes(approach));
}

function enrichWithRisks(
  scenarios: CompetitiveScenario[],
  risks?: CompetitiveRisk[],
): CompetitiveScenario[] {
  if (!risks || risks.length === 0) return scenarios;

  return scenarios.map((scenario) => {
    // Boost likelihood if related risk is identified
    const relatedRisk = risks.find((r) => {
      if (r.type === "price_war" && scenario.id === "price_war") return true;
      if (r.type === "feature_parity" && scenario.id === "incumbent_copy")
        return true;
      if (r.type === "market_saturation" && scenario.id === "fast_follower")
        return true;
      return false;
    });

    if (relatedRisk && relatedRisk.severity === "high") {
      return { ...scenario, likelihood: "high" as const };
    }
    return scenario;
  });
}

const likelihoodStyles = {
  low: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
  },
  medium: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
  },
  high: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
};

export default function CompetitiveResponseCard({
  approach,
  risks,
  strategy: _strategy,
  className = "",
}: Props) {
  const baseScenarios = getScenariosForApproach(approach);
  const scenarios = enrichWithRisks(baseScenarios, risks);

  // Sort by likelihood
  const likelihoodOrder = { high: 0, medium: 1, low: 2 };
  const sortedScenarios = [...scenarios].sort(
    (a, b) => likelihoodOrder[a.likelihood] - likelihoodOrder[b.likelihood],
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">
          Competitive Response Analysis
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Likely competitive scenarios and how to prepare for them
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {sortedScenarios.map((scenario) => {
          const styles = likelihoodStyles[scenario.likelihood];

          return (
            <div key={scenario.id} className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-medium text-gray-900">{scenario.title}</h4>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`px-2 py-0.5 rounded-full ${styles.bg} ${styles.text} text-xs font-medium`}
                  >
                    {scenario.likelihood} likelihood
                  </span>
                  <span className="text-gray-500">{scenario.timeframe}</span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {scenario.description}
              </p>

              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                  How to Prepare
                </h5>
                <ul className="space-y-2">
                  {scenario.preparation.map((prep, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <svg
                        className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                      {prep}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {risks && risks.length > 0 && (
        <div className="p-6 bg-amber-50 border-t border-amber-100">
          <h4 className="text-sm font-medium text-amber-800 mb-2">
            Identified Competitive Risks
          </h4>
          <ul className="space-y-1">
            {risks.slice(0, 3).map((risk, idx) => (
              <li
                key={idx}
                className="text-sm text-amber-700 flex items-center gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    risk.severity === "high"
                      ? "bg-red-500"
                      : risk.severity === "medium"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                />
                {risk.type.replace(/_/g, " ")}:{" "}
                {risk.competitor || "General market"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-6 border-t border-gray-200">
        <div className="flex items-start gap-3 text-sm">
          <svg
            className="w-5 h-5 text-blue-500 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-gray-600">
            <strong className="text-gray-800">Remember:</strong> Competition
            validates the market. Focus on serving customers better rather than
            worrying about competitors. Build something people genuinely love.
          </p>
        </div>
      </div>
    </div>
  );
}
