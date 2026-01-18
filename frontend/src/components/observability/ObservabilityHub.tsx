/**
 * ObservabilityHub - Main container for observability views
 *
 * Features:
 * - View state management with URL sync
 * - Connection status indicator (Live/Reconnecting/Offline)
 * - Keyboard navigation (g+t → timeline, g+h → heatmap, etc.)
 * - Export functionality (PNG, JSON, Share Link)
 * - Error boundary with graceful degradation
 */

import { useState, useEffect, useCallback, Component, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Wifi,
  WifiOff,
  Download,
  Link2,
  FileJson,
  Image,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import type { ObservabilityView } from "../../types/observability";
import { useObservabilityStream } from "../../hooks/useObservabilityStream";
import { useMessageBusLogs } from "../../hooks/useObservability";
import QuickStats from "./QuickStats";
import ViewSelector from "./ViewSelector";
import ExecutionTimeline from "./ExecutionTimeline";
import ToolUseList from "./ToolUseList";
import AssertionList from "./AssertionList";
import SkillTraceList from "./SkillTraceList";
import LogViewer from "./LogViewer";
import ToolUseHeatMap from "./ToolUseHeatMap";
import UnifiedLogViewer from "./UnifiedLogViewer";
import MessageBusLogViewer from "./MessageBusLogViewer";
import AllEventsViewer from "./AllEventsViewer";

// Keyboard shortcut mappings
const VIEW_SHORTCUTS: Record<string, ObservabilityView> = {
  t: "timeline",
  u: "tool-uses",
  a: "assertions",
  s: "skills",
  l: "logs",
  h: "heatmap",
  f: "unified",
  m: "messages",
  e: "events",
};

interface ObservabilityHubProps {
  executionId?: string;
  onExport?: (format: "json" | "png" | "link") => void;
}

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ObservabilityErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-gray-500 mb-4 text-center max-w-md">
            {this.state.error?.message ||
              "An error occurred while rendering this view"}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              this.props.onReset?.();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Export Menu Component
function ExportMenu({
  executionId,
  onExport,
}: {
  executionId: string;
  onExport?: (format: "json" | "png" | "link") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleExportJSON = useCallback(() => {
    onExport?.("json");
    const url = `/api/observability/executions/${executionId}/export?format=json`;
    window.open(url, "_blank");
    setIsOpen(false);
  }, [executionId, onExport]);

  const handleCopyLink = useCallback(async () => {
    onExport?.("link");
    const shareUrl = `${window.location.origin}/observability/executions/${executionId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Could add toast notification here
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setIsOpen(false);
  }, [executionId, onExport]);

  const handleExportPNG = useCallback(() => {
    onExport?.("png");
    // Trigger PNG export via html2canvas or similar
    // This would need to be implemented based on the current view
    setIsOpen(false);
  }, [onExport]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-20">
            <div className="py-1">
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <FileJson className="h-4 w-4" />
                Export as JSON
              </button>
              <button
                onClick={handleExportPNG}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Image className="h-4 w-4" />
                Export as PNG
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Link2 className="h-4 w-4" />
                Copy Share Link
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 bg-gray-200 rounded w-32" />
        <div className="h-6 bg-gray-200 rounded w-24" />
      </div>

      {/* QuickStats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 h-20" />
        ))}
      </div>

      {/* ViewSelector skeleton */}
      <div className="flex gap-2 border-b pb-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded w-24" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="h-96 bg-gray-100 rounded-lg" />
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <FolderOpen className="h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No execution selected
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-md">
        Select an execution from the list to view detailed observability data
        including timeline, tool uses, assertions, and more.
      </p>
      <div className="mt-6 text-xs text-gray-400">
        <span className="font-medium">Tip:</span> Use keyboard shortcuts{" "}
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
          g + t
        </kbd>{" "}
        for timeline,{" "}
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
          g + a
        </kbd>{" "}
        for assertions
      </div>
    </div>
  );
}

export default function ObservabilityHub({
  executionId,
  onExport,
}: ObservabilityHubProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view") as ObservabilityView | null;
  const [currentView, setCurrentView] = useState<ObservabilityView>(
    viewParam || "timeline",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [gPressed, setGPressed] = useState(false);

  const { isConnected, isReconnecting, eventCount } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  // Simulate initial loading
  useEffect(() => {
    if (executionId) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
    setIsLoading(false);
  }, [executionId]);

  const handleViewChange = useCallback(
    (view: ObservabilityView) => {
      setCurrentView(view);
      setSearchParams({ view });
    },
    [setSearchParams],
  );

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Handle 'g' key prefix for view navigation
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        setGPressed(true);
        setTimeout(() => setGPressed(false), 1000);
        return;
      }

      // If 'g' was pressed, check for view shortcut
      if (gPressed && VIEW_SHORTCUTS[e.key]) {
        e.preventDefault();
        handleViewChange(VIEW_SHORTCUTS[e.key]);
        setGPressed(false);
      }

      // Escape to clear g prefix
      if (e.key === "Escape") {
        setGPressed(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gPressed, handleViewChange]);

  if (isLoading && executionId) {
    return <LoadingSkeleton />;
  }

  return (
    <ObservabilityErrorBoundary onReset={() => setIsLoading(false)}>
      <div className="space-y-6">
        {/* Header with connection status and export */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Observability
            </h2>
            {gPressed && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                g...
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {executionId && (
              <ExportMenu executionId={executionId} onExport={onExport} />
            )}

            {executionId && (
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Live</span>
                    {eventCount > 0 && (
                      <span className="text-gray-400">
                        ({eventCount} events)
                      </span>
                    )}
                  </>
                ) : isReconnecting ? (
                  <>
                    <WifiOff className="h-4 w-4 text-yellow-500 animate-pulse" />
                    <span className="text-yellow-600">Reconnecting...</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">Offline</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        {executionId && <QuickStats executionId={executionId} />}

        {/* View selector */}
        <ViewSelector
          currentView={currentView}
          onViewChange={handleViewChange}
        />

        {/* Current view content */}
        <div className="min-h-[400px]">
          {!executionId ? (
            <EmptyState />
          ) : (
            <ObservabilityErrorBoundary>
              <ViewContent executionId={executionId} view={currentView} />
            </ObservabilityErrorBoundary>
          )}
        </div>
      </div>
    </ObservabilityErrorBoundary>
  );
}

// Wrapper component for MessageBusLogViewer to fetch data via hook
function MessageBusWrapper({ executionId }: { executionId: string }) {
  const { logs, loading, error, refetch } = useMessageBusLogs({ executionId });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded">
        Error loading message bus logs: {error.message}
      </div>
    );
  }

  // Convert MessageBusLogEntry to MessageBusEvent format expected by MessageBusLogViewer
  const events = logs.map((entry) => ({
    id: entry.id,
    type: entry.eventType,
    source: entry.source,
    target: undefined,
    payload: entry.payload,
    timestamp: entry.timestamp,
    correlationId: entry.correlationId ?? undefined,
  }));

  return (
    <MessageBusLogViewer
      events={events}
      loading={loading}
      onRefresh={refetch}
    />
  );
}

interface ViewContentProps {
  executionId: string;
  view: ObservabilityView;
}

function ViewContent({ executionId, view }: ViewContentProps) {
  switch (view) {
    case "timeline":
      return <ExecutionTimeline executionId={executionId} />;
    case "tool-uses":
      return <ToolUseList executionId={executionId} />;
    case "assertions":
      return <AssertionList executionId={executionId} />;
    case "skills":
      return <SkillTraceList executionId={executionId} />;
    case "logs":
      return <LogViewer executionId={executionId} />;
    case "heatmap":
      return <ToolUseHeatMap executionId={executionId} />;
    case "unified":
      return <UnifiedLogViewer executionId={executionId} />;
    case "messages":
      return <MessageBusWrapper executionId={executionId} />;
    case "events":
      return <AllEventsViewer executionId={executionId} />;
    default:
      return <div className="text-gray-500">Unknown view</div>;
  }
}
