/**
 * QuickStats - Summary statistics panel for observability
 *
 * Features:
 * - Active executions count
 * - Tool calls per minute
 * - Pass rate percentage
 * - Error count with link
 * - Discovery count
 * - Real-time updates via WebSocket
 * - Mini sparklines for trends
 * - Click handlers to navigate to filtered views
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import {
  useToolSummary,
  useAssertionSummary,
  useDiscoveries,
} from "../../hooks/useObservability";
import { useObservabilityStream } from "../../hooks/useObservabilityStream";

interface QuickStatsProps {
  executionId?: string;
  onStatClick?: (statType: string) => void;
}

// Mini sparkline component
function MiniSparkline({
  data,
  color = "currentColor",
  height = 20,
  width = 60,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Stat card component
interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof Activity;
  color: string;
  bgColor: string;
  sparklineData?: number[];
  onClick?: () => void;
  trend?: "up" | "down" | "neutral";
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  sparklineData,
  onClick,
  trend,
}: StatCardProps) {
  return (
    <div
      className={`${bgColor} rounded-lg p-4 flex flex-col cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs font-medium text-gray-600">{label}</span>
        </div>
        {trend && trend !== "neutral" && (
          <TrendingUp
            className={`h-3 w-3 ${
              trend === "up" ? "text-green-500" : "text-red-500 rotate-180"
            }`}
          />
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {sparklineData && sparklineData.length > 1 && (
          <MiniSparkline
            data={sparklineData}
            color={
              color.replace("text-", "").includes("blue")
                ? "#2563eb"
                : "#10b981"
            }
            height={20}
            width={50}
          />
        )}
      </div>
    </div>
  );
}

export default function QuickStats({
  executionId,
  onStatClick,
}: QuickStatsProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  // Fetch summaries
  const { summary: toolSummary, loading: toolLoading } =
    useToolSummary(executionId);
  const { summary: assertionSummary, loading: assertionLoading } =
    useAssertionSummary(executionId);
  const { discoveries, loading: discoveriesLoading } = useDiscoveries(
    executionId,
    { limit: 100 },
  );

  // Real-time updates
  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  // Track historical values for sparklines
  const [toolCallHistory, setToolCallHistory] = useState<number[]>([]);
  const [assertionHistory, setAssertionHistory] = useState<number[]>([]);

  // Update history when summaries change
  useEffect(() => {
    if (toolSummary?.total !== undefined) {
      setToolCallHistory((prev) => {
        const updated = [...prev, toolSummary.total];
        return updated.slice(-10); // Keep last 10 data points
      });
    }
  }, [toolSummary?.total]);

  useEffect(() => {
    if (assertionSummary?.passed !== undefined) {
      setAssertionHistory((prev) => {
        const updated = [...prev, assertionSummary.passed];
        return updated.slice(-10);
      });
    }
  }, [assertionSummary?.passed]);

  // Calculate real-time stats from events
  const realTimeStats = useMemo(() => {
    const toolEvents = events.filter((e) => e.type.startsWith("tooluse:"));
    const assertionEvents = events.filter((e) => e.type === "assertion:result");
    // Discovery events come through transcript entries
    const discoveryEvents = events.filter((e) => e.type === "transcript:entry");

    return {
      additionalTools: toolEvents.length,
      additionalAssertions: assertionEvents.length,
      additionalDiscoveries: discoveryEvents.length,
    };
  }, [events]);

  const loading = toolLoading || assertionLoading || discoveriesLoading;

  const handleStatClick = useCallback(
    (statType: string) => {
      onStatClick?.(statType);

      // Navigate to appropriate filtered view
      switch (statType) {
        case "tools":
          setSearchParams({ view: "tool-uses" });
          break;
        case "assertions":
          setSearchParams({ view: "assertions" });
          break;
        case "passed":
          setSearchParams({ view: "assertions", filter: "passed" });
          break;
        case "failed":
          setSearchParams({ view: "assertions", filter: "failed" });
          break;
        case "errors":
          setSearchParams({ view: "tool-uses", filter: "error" });
          break;
        case "discoveries":
          if (executionId) {
            navigate(`/observability/executions/${executionId}/discoveries`);
          }
          break;
      }
    },
    [onStatClick, setSearchParams, navigate, executionId],
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 h-20" />
        ))}
      </div>
    );
  }

  const totalTools = (toolSummary?.total ?? 0) + realTimeStats.additionalTools;
  const totalAssertions =
    (assertionSummary?.total ?? 0) + realTimeStats.additionalAssertions;
  const totalDiscoveries =
    (discoveries?.length ?? 0) + realTimeStats.additionalDiscoveries;

  const stats: StatCardProps[] = [
    {
      label: "Tool Calls",
      value: totalTools,
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      sparklineData: toolCallHistory,
      onClick: () => handleStatClick("tools"),
    },
    {
      label: "Assertions",
      value: totalAssertions,
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      onClick: () => handleStatClick("assertions"),
    },
    {
      label: "Passed",
      value: assertionSummary?.passed ?? 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
      sparklineData: assertionHistory,
      trend:
        assertionHistory.length > 1 &&
        assertionHistory[assertionHistory.length - 1] >
          assertionHistory[assertionHistory.length - 2]
          ? "up"
          : "neutral",
      onClick: () => handleStatClick("passed"),
    },
    {
      label: "Failed",
      value: assertionSummary?.failed ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      onClick: () => handleStatClick("failed"),
    },
    {
      label: "Errors",
      value: toolSummary?.byStatus?.error ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      onClick: () => handleStatClick("errors"),
    },
    {
      label: "Discoveries",
      value: totalDiscoveries,
      icon: Lightbulb,
      color: "text-teal-600",
      bgColor: "bg-teal-100",
      onClick: () => handleStatClick("discoveries"),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Real-time indicator */}
      {isConnected && realTimeStats.additionalTools > 0 && (
        <div className="flex items-center justify-end gap-2 text-xs text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />+
          {realTimeStats.additionalTools} tools since page load
        </div>
      )}
    </div>
  );
}

// Compact version for smaller spaces
export function QuickStatsCompact({ executionId }: QuickStatsProps) {
  const { summary: toolSummary, loading: toolLoading } =
    useToolSummary(executionId);
  const { summary: assertionSummary, loading: assertionLoading } =
    useAssertionSummary(executionId);

  const loading = toolLoading || assertionLoading;

  if (loading) {
    return <div className="h-8 bg-gray-100 rounded animate-pulse" />;
  }

  const passRate = assertionSummary?.passRate ?? 0;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="flex items-center gap-1">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="font-medium">{toolSummary?.total ?? 0}</span>
        <span className="text-gray-500">tools</span>
      </span>
      <span className="flex items-center gap-1">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="font-medium">{(passRate * 100).toFixed(0)}%</span>
        <span className="text-gray-500">pass</span>
      </span>
      <span className="flex items-center gap-1">
        <XCircle className="h-4 w-4 text-red-600" />
        <span className="font-medium">{assertionSummary?.failed ?? 0}</span>
        <span className="text-gray-500">failed</span>
      </span>
    </div>
  );
}
