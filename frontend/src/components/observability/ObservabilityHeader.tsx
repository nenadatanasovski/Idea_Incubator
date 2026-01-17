/**
 * ObservabilityHeader - Header component with unified search and connection status
 */

import { useState, useCallback } from "react";
import { Activity, RefreshCw } from "lucide-react";
import clsx from "clsx";
import ObservabilitySearch from "./ObservabilitySearch";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface ObservabilityHeaderProps {
  connectionStatus: ConnectionStatus;
  onRefresh?: () => void;
}

export default function ObservabilityHeader({
  connectionStatus,
  onRefresh,
}: ObservabilityHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [onRefresh]);

  const statusColors: Record<ConnectionStatus, { dot: string; text: string }> =
    {
      connected: { dot: "bg-green-500", text: "text-green-700" },
      reconnecting: {
        dot: "bg-yellow-500 animate-pulse",
        text: "text-yellow-700",
      },
      offline: { dot: "bg-red-500", text: "text-red-700" },
    };

  const statusLabels: Record<ConnectionStatus, string> = {
    connected: "Live",
    reconnecting: "Reconnecting",
    offline: "Offline",
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Observability</h1>
      </div>

      {/* Search and Controls */}
      <div className="flex items-center gap-4">
        {/* Unified Search */}
        <ObservabilitySearch className="w-80" />

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh data"
          aria-label={isRefreshing ? "Refreshing data" : "Refresh data"}
        >
          <RefreshCw
            className={clsx("h-5 w-5", isRefreshing && "animate-spin")}
            aria-hidden="true"
          />
        </button>

        {/* Connection Status */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg"
          role="status"
          aria-label={`Connection status: ${statusLabels[connectionStatus]}`}
        >
          <span
            className={clsx(
              "w-2 h-2 rounded-full",
              statusColors[connectionStatus].dot,
            )}
            aria-hidden="true"
          />
          <span
            className={clsx(
              "text-sm font-medium",
              statusColors[connectionStatus].text,
            )}
          >
            {statusLabels[connectionStatus]}
          </span>
        </div>
      </div>
    </div>
  );
}
