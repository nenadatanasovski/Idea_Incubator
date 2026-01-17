/**
 * ObservabilityHub - Main container for observability views
 */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import type { ObservabilityView } from "../../types/observability";
import { useObservabilityStream } from "../../hooks/useObservabilityStream";
import QuickStats from "./QuickStats";
import ViewSelector from "./ViewSelector";
import ExecutionTimeline from "./ExecutionTimeline";
import ToolUseList from "./ToolUseList";
import AssertionList from "./AssertionList";
import SkillTraceList from "./SkillTraceList";
import LogViewer from "./LogViewer";

interface ObservabilityHubProps {
  executionId?: string;
}

export default function ObservabilityHub({
  executionId,
}: ObservabilityHubProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view") as ObservabilityView | null;
  const [currentView, setCurrentView] = useState<ObservabilityView>(
    viewParam || "timeline",
  );

  const { isConnected, isReconnecting, eventCount } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  const handleViewChange = (view: ObservabilityView) => {
    setCurrentView(view);
    setSearchParams({ view });
  };

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Observability</h2>

        {executionId && (
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Live</span>
                {eventCount > 0 && (
                  <span className="text-gray-400">({eventCount} events)</span>
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

      {/* Quick stats */}
      {executionId && <QuickStats executionId={executionId} />}

      {/* View selector */}
      <ViewSelector currentView={currentView} onViewChange={handleViewChange} />

      {/* Current view content */}
      <div className="min-h-[400px]">
        {!executionId ? (
          <div className="text-gray-500 text-center py-12">
            Select an execution to view observability data
          </div>
        ) : (
          <ViewContent executionId={executionId} view={currentView} />
        )}
      </div>
    </div>
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
    default:
      return <div className="text-gray-500">Unknown view</div>;
  }
}
