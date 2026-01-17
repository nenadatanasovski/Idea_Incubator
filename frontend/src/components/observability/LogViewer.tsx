/**
 * LogViewer - Message bus log viewer with filtering
 */

import { useState } from "react";
import {
  Filter,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";
import { useMessageBusLogs } from "../../hooks/useObservability";
import type { MessageBusLogEntry, Severity } from "../../types/observability";

interface LogViewerProps {
  executionId?: string;
}

const severityConfig: Record<
  Severity,
  { icon: typeof Info; color: string; bgColor: string }
> = {
  info: { icon: Info, color: "text-blue-600", bgColor: "bg-blue-50" },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  error: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-50" },
  critical: { icon: XCircle, color: "text-red-800", bgColor: "bg-red-100" },
};

export default function LogViewer({ executionId }: LogViewerProps) {
  const [filters, setFilters] = useState<{
    severity?: string;
    category?: string;
    source?: string;
  }>({});

  const { logs, loading, error, total, hasMore, refetch } = useMessageBusLogs({
    executionId,
    ...filters,
    limit: 100,
  });

  if (loading) {
    return (
      <div className="space-y-1 animate-pulse">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        Error loading logs: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={filters.severity || ""}
          onChange={(e) =>
            setFilters({ ...filters, severity: e.target.value || undefined })
          }
          className="text-sm border-gray-300 rounded-md"
        >
          <option value="">All Severity</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={filters.category || ""}
          onChange={(e) =>
            setFilters({ ...filters, category: e.target.value || undefined })
          }
          className="text-sm border-gray-300 rounded-md"
        >
          <option value="">All Categories</option>
          <option value="lifecycle">Lifecycle</option>
          <option value="coordination">Coordination</option>
          <option value="failure">Failure</option>
          <option value="decision">Decision</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">{total} logs</span>
      </div>

      {/* Log entries */}
      <div className="font-mono text-sm space-y-1 max-h-[600px] overflow-auto">
        {logs.length === 0 ? (
          <div className="text-gray-500 p-4 text-center font-sans">
            No logs found
          </div>
        ) : (
          logs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
      </div>

      {hasMore && (
        <button
          onClick={refetch}
          className="mt-4 w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
        >
          Load more...
        </button>
      )}
    </div>
  );
}

interface LogEntryProps {
  log: MessageBusLogEntry;
}

function LogEntry({ log }: LogEntryProps) {
  const config = severityConfig[log.severity];
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-2 p-2 rounded ${config.bgColor}`}>
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-gray-500 text-xs">[{log.source}]</span>
          <span className="text-xs font-medium text-gray-600">
            {log.eventType}
          </span>
        </div>
        <p className={`${config.color} text-sm mt-0.5`}>{log.humanSummary}</p>
      </div>
    </div>
  );
}
