/**
 * ExecutionComplexity
 *
 * Visualizes the complexity and effort required to execute the
 * chosen strategic approach, helping users understand what they're committing to.
 */

import type {
  StrategicApproach,
  EnhancedStrategy,
  IdeaFinancialAllocation,
} from "../types";

interface Props {
  approach?: StrategicApproach;
  strategy?: EnhancedStrategy;
  allocation?: IdeaFinancialAllocation | null;
  className?: string;
}

interface ComplexityDimension {
  id: string;
  label: string;
  description: string;
  level: 1 | 2 | 3 | 4 | 5;
  icon: string;
}

interface ApproachProfile {
  overall: "low" | "medium" | "high" | "very_high";
  timeToRevenue: string;
  dimensions: ComplexityDimension[];
  keyChallenge: string;
  successFactors: string[];
}

const APPROACH_PROFILES: Record<StrategicApproach, ApproachProfile> = {
  create: {
    overall: "very_high",
    timeToRevenue: "12-24 months",
    dimensions: [
      {
        id: "market_education",
        label: "Market Education",
        description: "Teaching customers about a new category",
        level: 5,
        icon: "📚",
      },
      {
        id: "product_development",
        label: "Product Development",
        description: "Building something truly new",
        level: 5,
        icon: "🔨",
      },
      {
        id: "validation",
        label: "Validation Difficulty",
        description: "No existing benchmarks to compare against",
        level: 4,
        icon: "🎯",
      },
      {
        id: "capital_requirements",
        label: "Capital Requirements",
        description: "Runway needed before revenue",
        level: 4,
        icon: "💰",
      },
      {
        id: "competitive_pressure",
        label: "Competitive Pressure",
        description: "Initial lack of competition",
        level: 1,
        icon: "⚔️",
      },
    ],
    keyChallenge:
      "Creating demand for something people don't know they need yet",
    successFactors: [
      "Deep understanding of latent customer needs",
      "Ability to articulate a compelling vision",
      "Patience and long runway",
      "Strong storytelling and marketing skills",
    ],
  },
  copy_improve: {
    overall: "medium",
    timeToRevenue: "3-9 months",
    dimensions: [
      {
        id: "market_education",
        label: "Market Education",
        description: "Market already understands the category",
        level: 1,
        icon: "📚",
      },
      {
        id: "product_development",
        label: "Product Development",
        description: "Building on proven patterns",
        level: 3,
        icon: "🔨",
      },
      {
        id: "validation",
        label: "Validation Difficulty",
        description: "Can benchmark against existing solutions",
        level: 2,
        icon: "🎯",
      },
      {
        id: "differentiation",
        label: "Differentiation Challenge",
        description: "Need clear improvements over incumbents",
        level: 4,
        icon: "✨",
      },
      {
        id: "competitive_pressure",
        label: "Competitive Pressure",
        description: "Established competitors exist",
        level: 4,
        icon: "⚔️",
      },
    ],
    keyChallenge: "Differentiating enough to win customers from incumbents",
    successFactors: [
      "Clear understanding of incumbent weaknesses",
      "Specific improvement that matters to customers",
      "Efficient execution to reach market quickly",
      "Strong competitive positioning",
    ],
  },
  combine: {
    overall: "high",
    timeToRevenue: "6-12 months",
    dimensions: [
      {
        id: "integration_complexity",
        label: "Integration Complexity",
        description: "Combining multiple concepts into one",
        level: 4,
        icon: "🔗",
      },
      {
        id: "product_development",
        label: "Product Development",
        description: "Building a novel combination",
        level: 4,
        icon: "🔨",
      },
      {
        id: "market_education",
        label: "Market Education",
        description: "Explaining a new combination",
        level: 3,
        icon: "📚",
      },
      {
        id: "validation",
        label: "Validation Difficulty",
        description: "Testing if combination adds value",
        level: 3,
        icon: "🎯",
      },
      {
        id: "competitive_pressure",
        label: "Competitive Pressure",
        description: "Unique positioning reduces direct competition",
        level: 2,
        icon: "⚔️",
      },
    ],
    keyChallenge:
      "Ensuring the combination creates more value than the sum of parts",
    successFactors: [
      "Clear synergy between combined elements",
      "Technical ability to integrate well",
      "Understanding of both source domains",
      "Ability to communicate combined value clearly",
    ],
  },
  localize: {
    overall: "medium",
    timeToRevenue: "2-6 months",
    dimensions: [
      {
        id: "market_knowledge",
        label: "Local Market Knowledge",
        description: "Understanding local needs and culture",
        level: 4,
        icon: "🌍",
      },
      {
        id: "product_development",
        label: "Product Development",
        description: "Adapting existing model to local context",
        level: 2,
        icon: "🔨",
      },
      {
        id: "operations",
        label: "Operational Complexity",
        description: "Local partnerships and logistics",
        level: 3,
        icon: "⚙️",
      },
      {
        id: "competitive_pressure",
        label: "Competitive Pressure",
        description: "May face local competitors",
        level: 3,
        icon: "⚔️",
      },
      {
        id: "scalability",
        label: "Scalability",
        description: "Growth limited to geographic area",
        level: 4,
        icon: "📈",
      },
    ],
    keyChallenge: "Understanding local nuances that make or break adaptation",
    successFactors: [
      "Deep knowledge of local market",
      "Strong local network and relationships",
      "Understanding of cultural differences",
      "Ability to build local trust",
    ],
  },
  specialize: {
    overall: "medium",
    timeToRevenue: "3-8 months",
    dimensions: [
      {
        id: "domain_expertise",
        label: "Domain Expertise Required",
        description: "Deep knowledge of the niche",
        level: 5,
        icon: "🎓",
      },
      {
        id: "product_development",
        label: "Product Development",
        description: "Tailoring solution to niche needs",
        level: 3,
        icon: "🔨",
      },
      {
        id: "market_size_risk",
        label: "Market Size Risk",
        description: "Niche may be too small",
        level: 4,
        icon: "📊",
      },
      {
        id: "competitive_pressure",
        label: "Competitive Pressure",
        description: "Generalists rarely compete in niches",
        level: 1,
        icon: "⚔️",
      },
      {
        id: "customer_acquisition",
        label: "Customer Acquisition",
        description: "Finding niche customers efficiently",
        level: 3,
        icon: "👥",
      },
    ],
    keyChallenge: "Ensuring the niche is large enough to sustain the business",
    successFactors: [
      "Genuine expertise in the niche domain",
      "Existing connections in the niche community",
      "Deep understanding of niche-specific problems",
      "Ability to become a trusted authority",
    ],
  },
  time: {
    overall: "high",
    timeToRevenue: "1-6 months",
    dimensions: [
      {
        id: "speed",
        label: "Speed to Market",
        description: "Must move faster than others",
        level: 5,
        icon: "⚡",
      },
      {
        id: "trend_reading",
        label: "Trend Reading",
        description: "Accurately identifying timing",
        level: 5,
        icon: "🔮",
      },
      {
        id: "product_development",
        label: "Product Development",
        description: "Building quickly to capture window",
        level: 3,
        icon: "🔨",
      },
      {
        id: "sustainability",
        label: "Sustainability Risk",
        description: "Timing advantage may be temporary",
        level: 5,
        icon: "♻️",
      },
      {
        id: "competitive_pressure",
        label: "Future Competition",
        description: "Others will follow if successful",
        level: 4,
        icon: "⚔️",
      },
    ],
    keyChallenge:
      "Building fast enough to capture the window and sustainable enough to survive competition",
    successFactors: [
      "Rapid execution capability",
      "Strong trend awareness",
      "Ability to pivot as market matures",
      "Plan for sustaining advantage",
    ],
  },
};

const overallStyles = {
  low: { bg: "bg-green-100", text: "text-green-800", label: "Low Complexity" },
  medium: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    label: "Medium Complexity",
  },
  high: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    label: "High Complexity",
  },
  very_high: {
    bg: "bg-red-100",
    text: "text-red-800",
    label: "Very High Complexity",
  },
};

function ComplexityBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-4 h-2 rounded-sm ${
            i <= level ? "bg-indigo-500" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function ExecutionComplexity({
  approach,
  strategy: _strategy,
  allocation,
  className = "",
}: Props) {
  if (!approach) {
    return (
      <div
        className={`bg-gray-50 rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <p className="text-gray-500 text-center">
          Select a strategic approach to see execution complexity analysis
        </p>
      </div>
    );
  }

  const profile = APPROACH_PROFILES[approach];
  const styles = overallStyles[profile.overall];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Execution Complexity
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${styles.bg} ${styles.text}`}
          >
            {styles.label}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Typical time to revenue: <strong>{profile.timeToRevenue}</strong>
        </p>
      </div>

      <div className="p-6 space-y-4">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Complexity Dimensions
        </h4>

        {profile.dimensions.map((dimension) => (
          <div key={dimension.id} className="flex items-center gap-4">
            <span className="text-xl w-8">{dimension.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800">
                  {dimension.label}
                </span>
                <ComplexityBar level={dimension.level} />
              </div>
              <p className="text-xs text-gray-500">{dimension.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-amber-50 border-t border-amber-100">
        <h4 className="text-sm font-medium text-amber-800 mb-2">
          Key Challenge
        </h4>
        <p className="text-sm text-amber-700">{profile.keyChallenge}</p>
      </div>

      <div className="p-6 border-t border-gray-100">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Success Factors
        </h4>
        <ul className="space-y-2">
          {profile.successFactors.map((factor, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm text-gray-600"
            >
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {factor}
            </li>
          ))}
        </ul>
      </div>

      {allocation && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Your Resources vs Requirements
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Your runway:</span>
              <span className="ml-2 font-medium">
                {allocation.allocatedRunwayMonths || 0} months
              </span>
            </div>
            <div>
              <span className="text-gray-500">Typical needed:</span>
              <span className="ml-2 font-medium">{profile.timeToRevenue}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
