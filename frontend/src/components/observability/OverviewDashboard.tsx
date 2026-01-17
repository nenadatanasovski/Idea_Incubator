/**
 * OverviewDashboard - Quick stats and system health overview
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  Play,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import clsx from "clsx";

const API_BASE = "http://localhost:3001";

// Types
interface Stats {
  activeExecutions: number;
  errorRate: string;
  blockedAgents: number;
  pendingQuestions: number;
  lastUpdated: string;
}

interface HealthStatus {
  status: "healthy" | "degraded" | "critical";
  issues: string[];
  metrics: {
    failedExecutionsLastHour: number;
    blockedAgents: number;
    staleQuestions: number;
  };
  lastUpdated: string;
}

interface ActivityItem {
  id: string;
  type: "execution" | "event" | "question" | "agent";
  title: string;
  description: string;
  timestamp: string;
  status?: string;
  href: string;
}

export default function OverviewDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statsRes, healthRes, activityRes] = await Promise.all([
        fetch(`${API_BASE}/api/observability/stats`),
        fetch(`${API_BASE}/api/observability/health`),
        fetch(`${API_BASE}/api/observability/activity?limit=10`),
      ]);

      const [statsData, healthData, activityData] = await Promise.all([
        statsRes.json(),
        healthRes.json(),
        activityRes.json(),
      ]);

      if (statsData.success) setStats(statsData.data);
      if (healthData.success) setHealth(healthData.data);
      if (activityData.success) setActivity(activityData.data);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
          <button onClick={fetchData} className="ml-auto">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Executions"
          value={stats?.activeExecutions?.toString() || "0"}
          icon={Play}
          color="blue"
          href="/observability/executions"
        />
        <StatCard
          label="Error Rate (24h)"
          value={stats?.errorRate || "0%"}
          icon={AlertTriangle}
          color={getErrorRateColor(stats?.errorRate)}
        />
        <StatCard
          label="Blocked Agents"
          value={stats?.blockedAgents?.toString() || "0"}
          icon={Clock}
          color={stats?.blockedAgents ? "orange" : "gray"}
          href="/observability/agents"
        />
        <StatCard
          label="Pending Questions"
          value={stats?.pendingQuestions?.toString() || "0"}
          icon={HelpCircle}
          color={stats?.pendingQuestions ? "yellow" : "gray"}
          href="/observability/agents"
        />
      </div>

      {/* System Health */}
      <SystemHealthIndicator health={health} onRefresh={fetchData} />

      {/* Recent Activity */}
      <RecentActivityFeed activity={activity} />
    </div>
  );
}

// Helper function to determine error rate color
function getErrorRateColor(
  rate: string | undefined,
): "green" | "yellow" | "red" | "gray" {
  if (!rate) return "gray";
  const value = parseFloat(rate);
  if (value >= 10) return "red";
  if (value >= 5) return "yellow";
  return "green";
}

// Stat Card component
interface StatCardProps {
  label: string;
  value: string;
  icon: typeof Activity;
  color: "blue" | "green" | "yellow" | "orange" | "red" | "gray";
  trend?: "up" | "down" | "flat";
  href?: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  href,
}: StatCardProps) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    red: "bg-red-50 text-red-600 border-red-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const content = (
    <div
      className={clsx(
        colors[color],
        "border rounded-lg p-4 flex items-center gap-4 transition-shadow",
        href && "cursor-pointer hover:shadow-md",
      )}
    >
      <div className="p-2 rounded-lg bg-white/50">
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm opacity-80">{label}</p>
      </div>
      {trend && (
        <TrendIcon
          className={clsx(
            "h-4 w-4",
            trend === "up" && "text-red-500",
            trend === "down" && "text-green-500",
            trend === "flat" && "text-gray-400",
          )}
        />
      )}
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

// System Health Indicator
interface SystemHealthIndicatorProps {
  health: HealthStatus | null;
  onRefresh: () => void;
}

function SystemHealthIndicator({
  health,
  onRefresh,
}: SystemHealthIndicatorProps) {
  const statusConfig = {
    healthy: {
      color: "bg-green-50 border-green-200",
      dotColor: "bg-green-500",
      textColor: "text-green-700",
      label: "Healthy",
    },
    degraded: {
      color: "bg-yellow-50 border-yellow-200",
      dotColor: "bg-yellow-500",
      textColor: "text-yellow-700",
      label: "Degraded",
    },
    critical: {
      color: "bg-red-50 border-red-200",
      dotColor: "bg-red-500",
      textColor: "text-red-700",
      label: "Critical",
    },
  };

  const config = health ? statusConfig[health.status] : statusConfig.healthy;

  // Calculate relative time
  const getRelativeTime = (isoString: string) => {
    const now = new Date();
    const then = new Date(isoString);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div
      className={clsx("rounded-lg shadow p-6 mb-6 border", config.color)}
      title={
        health?.issues.length
          ? `Issues: ${health.issues.join(", ")}`
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-gray-900">
            System Health
          </span>
          <span
            className={clsx(
              "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
              config.color,
              config.textColor,
            )}
          >
            <span className={clsx("w-2 h-2 rounded-full", config.dotColor)} />
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated:{" "}
            {health?.lastUpdated ? getRelativeTime(health.lastUpdated) : "—"}
          </span>
          <button
            onClick={onRefresh}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {health?.issues && health.issues.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <ul className="space-y-1">
            {health.issues.map((issue, i) => (
              <li
                key={i}
                className="text-sm text-gray-600 flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Recent Activity Feed
interface RecentActivityFeedProps {
  activity: ActivityItem[];
}

function RecentActivityFeed({ activity }: RecentActivityFeedProps) {
  const typeConfig = {
    execution: {
      color: "bg-blue-100 text-blue-700",
      icon: Play,
    },
    event: {
      color: "bg-purple-100 text-purple-700",
      icon: Activity,
    },
    question: {
      color: "bg-orange-100 text-orange-700",
      icon: HelpCircle,
    },
    agent: {
      color: "bg-green-100 text-green-700",
      icon: CheckCircle,
    },
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
        <Link
          to="/observability/events"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View All →
        </Link>
      </div>

      {activity.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No recent activity</p>
          <p className="text-sm text-gray-400 mt-1">
            Activity will appear here as agents execute tasks
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <Link
                key={item.id}
                to={item.href}
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs text-gray-500 font-mono w-20 flex-shrink-0">
                  {formatTime(item.timestamp)}
                </span>
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                    config.color,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {item.type}
                </span>
                <span className="text-sm text-gray-900 font-medium truncate">
                  {item.title}
                </span>
                <span className="text-sm text-gray-500 truncate flex-1">
                  {item.description}
                </span>
                {item.status && (
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded",
                      item.status === "completed" &&
                        "bg-green-100 text-green-700",
                      item.status === "failed" && "bg-red-100 text-red-700",
                      item.status === "running" && "bg-blue-100 text-blue-700",
                      item.status === "pending" &&
                        "bg-yellow-100 text-yellow-700",
                    )}
                  >
                    {item.status}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
