/**
 * QuickStats - Summary statistics panel for observability
 */

import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import {
  useToolSummary,
  useAssertionSummary,
} from "../../hooks/useObservability";

interface QuickStatsProps {
  executionId?: string;
}

export default function QuickStats({ executionId }: QuickStatsProps) {
  const { summary: toolSummary, loading: toolLoading } =
    useToolSummary(executionId);
  const { summary: assertionSummary, loading: assertionLoading } =
    useAssertionSummary(executionId);

  const loading = toolLoading || assertionLoading;

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 h-20" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Tool Calls",
      value: toolSummary?.total ?? 0,
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Assertions",
      value: assertionSummary?.total ?? 0,
      icon: Activity,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "Passed",
      value: assertionSummary?.passed ?? 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Failed",
      value: assertionSummary?.failed ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
    {
      label: "Errors",
      value: toolSummary?.byStatus?.error ?? 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      label: "Avg Duration",
      value: `${toolSummary?.avgDurationMs ?? 0}ms`,
      icon: Clock,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={`${stat.bgColor} rounded-lg p-4 flex flex-col`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs font-medium text-gray-600">
                {stat.label}
              </span>
            </div>
            <span className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        );
      })}
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
