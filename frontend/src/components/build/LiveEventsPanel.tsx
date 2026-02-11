/**
 * LiveEventsPanel.tsx
 * Real-time display of build events
 */

import { useEffect, useRef } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  GitCommit,
  AlertTriangle,
  User,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import type { BuildEvent } from "../../hooks/useBuildSession";

interface LiveEventsPanelProps {
  events: BuildEvent[];
  isConnected: boolean;
}

export function LiveEventsPanel({ events, isConnected }: LiveEventsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // Get event config
  const getEventConfig = (
    type: string,
  ): {
    icon: React.ReactNode;
    color: string;
    label: string;
  } => {
    switch (type) {
      case "taskStarted":
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          color: "text-blue-600",
          label: "Task Started",
        };
      case "taskComplete":
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          color: "text-green-600",
          label: "Task Complete",
        };
      case "taskFailed":
        return {
          icon: <XCircle className="w-3 h-3" />,
          color: "text-red-600",
          label: "Task Failed",
        };
      case "siaTriggered":
        return {
          icon: <Sparkles className="w-3 h-3" />,
          color: "text-purple-600",
          label: "SIA Triggered",
        };
      case "siaSuccess":
        return {
          icon: <Zap className="w-3 h-3" />,
          color: "text-purple-600",
          label: "SIA Fixed",
        };
      case "siaDecomposed":
        return {
          icon: <Sparkles className="w-3 h-3" />,
          color: "text-purple-600",
          label: "SIA Decomposed",
        };
      case "humanNeeded":
        return {
          icon: <User className="w-3 h-3" />,
          color: "text-amber-600",
          label: "Human Needed",
        };
      case "buildComplete":
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          color: "text-green-600",
          label: "Build Complete",
        };
      case "commit":
        return {
          icon: <GitCommit className="w-3 h-3" />,
          color: "text-gray-600",
          label: "Git Commit",
        };
      default:
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          color: "text-gray-500",
          label: type,
        };
    }
  };

  // Format event message
  const formatEventMessage = (event: BuildEvent): string => {
    switch (event.type) {
      case "taskStarted":
        return `Starting: ${event.taskName}${event.attempt && event.attempt > 1 ? ` (attempt ${event.attempt})` : ""}`;
      case "taskComplete":
        return `Completed: ${event.taskName}${event.commitHash ? ` [${event.commitHash.slice(0, 7)}]` : ""}`;
      case "taskFailed":
        return `Failed: ${event.taskName} - ${event.error || "Unknown error"}`;
      case "siaTriggered":
        return `SIA intervention #${event.attempt || 1} for ${event.taskName}`;
      case "siaSuccess":
        return `SIA suggested fix for ${event.taskName}`;
      case "siaDecomposed":
        return `SIA decomposed task into subtasks`;
      case "humanNeeded":
        return `Human intervention needed for ${event.taskName}`;
      case "buildComplete":
        return "Build completed successfully! 🎉";
      default:
        return JSON.stringify(event);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 shrink-0">
        <h4 className="text-xs font-medium text-gray-500 uppercase">
          Live Activity
        </h4>
        <div className="flex items-center gap-1.5">
          <span
            className={clsx(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500",
            )}
          />
          <span className="text-xs text-gray-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Events */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-2 font-mono text-xs space-y-1"
      >
        {events.length === 0 ? (
          <div className="text-gray-400 text-center py-4">
            Waiting for build events...
          </div>
        ) : (
          events.map((event, index) => {
            const config = getEventConfig(event.type);
            return (
              <div
                key={index}
                className={clsx(
                  "flex items-start gap-2 p-1.5 rounded hover:bg-gray-50",
                  config.color,
                )}
              >
                <span className="text-gray-400 shrink-0 w-16">
                  {formatTime(event.timestamp)}
                </span>
                <span className="shrink-0 mt-0.5">{config.icon}</span>
                <span className="flex-1 text-gray-700 break-words">
                  {formatEventMessage(event)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default LiveEventsPanel;
