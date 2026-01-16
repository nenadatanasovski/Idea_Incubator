/**
 * RelationshipDiagram
 *
 * Visualizes the relationships between strategic approach, profile,
 * allocation, opportunities, and risks in a cohesive diagram.
 */

import type {
  StrategicApproach,
  IdeaFinancialAllocation,
  UserProfileSummary,
  ValidatedOpportunity,
  CompetitiveRisk,
  EnhancedStrategy,
} from "../types";
import { strategicApproachMeta } from "../types";

interface Props {
  approach?: StrategicApproach;
  allocation?: IdeaFinancialAllocation | null;
  profile?: UserProfileSummary | null;
  opportunities?: ValidatedOpportunity[];
  risks?: CompetitiveRisk[];
  strategy?: EnhancedStrategy;
  className?: string;
}

interface ConnectionStrength {
  from: string;
  to: string;
  strength: "strong" | "moderate" | "weak";
  label?: string;
}

function calculateConnections(props: Props): ConnectionStrength[] {
  const connections: ConnectionStrength[] = [];
  const { approach, allocation, profile, opportunities, risks, strategy } =
    props;

  // Profile -> Approach connections
  if (profile && approach) {
    let profileFit: "strong" | "moderate" | "weak" = "moderate";

    if (approach === "specialize" && profile.domain_expertise) {
      profileFit = "strong";
    } else if (approach === "localize" && (profile as any).city) {
      profileFit = "strong";
    } else if (approach === "create" && profile.risk_tolerance === "high") {
      profileFit = "strong";
    }

    connections.push({
      from: "profile",
      to: "approach",
      strength: profileFit,
      label: profileFit === "strong" ? "Great fit" : undefined,
    });
  }

  // Allocation -> Approach connections
  if (allocation && approach) {
    let allocationFit: "strong" | "moderate" | "weak" = "moderate";
    const runway = allocation.allocatedRunwayMonths || 0;

    if (approach === "create" && runway >= 18) {
      allocationFit = "strong";
    } else if (approach === "create" && runway < 12) {
      allocationFit = "weak";
    } else if (["copy_improve", "localize"].includes(approach) && runway <= 8) {
      allocationFit = "strong";
    }

    connections.push({
      from: "allocation",
      to: "approach",
      strength: allocationFit,
      label: allocationFit === "weak" ? "Runway concern" : undefined,
    });
  }

  // Approach -> Opportunities
  if (approach && opportunities && opportunities.length > 0) {
    connections.push({
      from: "approach",
      to: "opportunities",
      strength: opportunities.length >= 3 ? "strong" : "moderate",
      label: `${opportunities.length} found`,
    });
  }

  // Approach -> Risks
  if (approach && risks && risks.length > 0) {
    const highRisks = risks.filter((r) => r.severity === "high").length;
    connections.push({
      from: "approach",
      to: "risks",
      strength:
        highRisks >= 2 ? "weak" : highRisks === 1 ? "moderate" : "strong",
      label: highRisks > 0 ? `${highRisks} high` : undefined,
    });
  }

  // Strategy synthesis
  if (strategy && approach) {
    connections.push({
      from: "opportunities",
      to: "strategy",
      strength: "strong",
    });
    connections.push({
      from: "risks",
      to: "strategy",
      strength: "moderate",
    });
  }

  return connections;
}

const nodeStyles = {
  profile: {
    bg: "bg-blue-100",
    border: "border-blue-300",
    text: "text-blue-800",
    icon: "👤",
  },
  allocation: {
    bg: "bg-green-100",
    border: "border-green-300",
    text: "text-green-800",
    icon: "💰",
  },
  approach: {
    bg: "bg-purple-100",
    border: "border-purple-300",
    text: "text-purple-800",
    icon: "🎯",
  },
  opportunities: {
    bg: "bg-amber-100",
    border: "border-amber-300",
    text: "text-amber-800",
    icon: "💡",
  },
  risks: {
    bg: "bg-red-100",
    border: "border-red-300",
    text: "text-red-800",
    icon: "⚠️",
  },
  strategy: {
    bg: "bg-indigo-100",
    border: "border-indigo-300",
    text: "text-indigo-800",
    icon: "🎲",
  },
};

const connectionColors = {
  strong: "stroke-green-500",
  moderate: "stroke-yellow-500",
  weak: "stroke-red-500",
};

interface NodeProps {
  id: keyof typeof nodeStyles;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  active: boolean;
}

function Node({ id, label, sublabel, x, y, active }: NodeProps) {
  const styles = nodeStyles[id];

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-60}
        y={-30}
        width={120}
        height={60}
        rx={8}
        className={`${active ? styles.bg : "fill-gray-100"} ${active ? styles.border : "stroke-gray-300"}`}
        strokeWidth={2}
        fill="currentColor"
        style={{ fill: active ? undefined : "#f3f4f6" }}
      />
      <text
        textAnchor="middle"
        y={-8}
        className={`text-lg ${active ? "" : "fill-gray-400"}`}
        style={{ fontSize: "20px" }}
      >
        {styles.icon}
      </text>
      <text
        textAnchor="middle"
        y={12}
        className={`text-xs font-medium ${active ? styles.text : "fill-gray-400"}`}
        style={{ fontSize: "11px" }}
      >
        {label}
      </text>
      {sublabel && active && (
        <text
          textAnchor="middle"
          y={24}
          className="fill-gray-500"
          style={{ fontSize: "9px" }}
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

export default function RelationshipDiagram({
  approach,
  allocation,
  profile,
  opportunities,
  risks,
  strategy,
  className = "",
}: Props) {
  const connections = calculateConnections({
    approach,
    allocation,
    profile,
    opportunities,
    risks,
    strategy,
  });

  const hasApproach = !!approach;
  const hasOpportunities = opportunities && opportunities.length > 0;
  const hasRisks = risks && risks.length > 0;
  const hasStrategy = !!strategy;

  // Node positions
  const nodes: NodeProps[] = [
    {
      id: "profile",
      label: "Your Profile",
      sublabel: profile?.name,
      x: 80,
      y: 50,
      active: !!profile,
    },
    {
      id: "allocation",
      label: "Allocation",
      sublabel: allocation
        ? `${allocation.allocatedRunwayMonths}mo runway`
        : undefined,
      x: 80,
      y: 150,
      active: !!allocation,
    },
    {
      id: "approach",
      label: "Approach",
      sublabel: approach ? strategicApproachMeta[approach].label : undefined,
      x: 220,
      y: 100,
      active: hasApproach,
    },
    {
      id: "opportunities",
      label: "Opportunities",
      sublabel: hasOpportunities
        ? `${opportunities!.length} identified`
        : undefined,
      x: 360,
      y: 50,
      active: Boolean(hasOpportunities),
    },
    {
      id: "risks",
      label: "Risks",
      sublabel: hasRisks ? `${risks!.length} identified` : undefined,
      x: 360,
      y: 150,
      active: Boolean(hasRisks),
    },
    {
      id: "strategy",
      label: "Strategy",
      sublabel: hasStrategy ? "Defined" : undefined,
      x: 500,
      y: 100,
      active: hasStrategy,
    },
  ];

  // Connection lines
  const lines: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strength: "strong" | "moderate" | "weak";
    label?: string;
  }[] = [];

  connections.forEach((conn) => {
    const from = nodes.find((n) => n.id === conn.from);
    const to = nodes.find((n) => n.id === conn.to);
    if (from && to) {
      lines.push({
        x1: from.x + 60,
        y1: from.y,
        x2: to.x - 60,
        y2: to.y,
        strength: conn.strength,
        label: conn.label,
      });
    }
  });

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Strategic Relationship Map
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        How your profile, resources, and chosen approach connect to
        opportunities and risks.
      </p>

      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 580 200"
          className="w-full min-w-[500px]"
          style={{ maxWidth: "100%", height: "auto", minHeight: "200px" }}
        >
          {/* Connection lines */}
          {lines.map((line, idx) => (
            <g key={idx}>
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className={connectionColors[line.strength]}
                strokeWidth={2}
                strokeDasharray={line.strength === "weak" ? "4,4" : undefined}
              />
              {line.label && (
                <text
                  x={(line.x1 + line.x2) / 2}
                  y={(line.y1 + line.y2) / 2 - 8}
                  textAnchor="middle"
                  className="fill-gray-500"
                  style={{ fontSize: "9px" }}
                >
                  {line.label}
                </text>
              )}
            </g>
          ))}

          {/* Nodes */}
          {nodes.map((node) => (
            <Node key={node.id} {...node} />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-6 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-green-500" />
          <span>Strong connection</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-yellow-500" />
          <span>Moderate connection</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-0.5 bg-red-500"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #ef4444, #ef4444 4px, transparent 4px, transparent 8px)",
            }}
          />
          <span>Weak/concerning connection</span>
        </div>
      </div>

      {/* Summary */}
      {hasApproach && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-800 mb-2">
            Connection Summary
          </h4>
          <ul className="space-y-1 text-sm text-gray-600">
            {connections.map((conn, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    conn.strength === "strong"
                      ? "bg-green-500"
                      : conn.strength === "moderate"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="capitalize">
                  {conn.from.replace("_", " ")}
                </span>
                <span className="text-gray-400">→</span>
                <span className="capitalize">{conn.to.replace("_", " ")}</span>
                {conn.label && (
                  <span className="text-gray-400">({conn.label})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
