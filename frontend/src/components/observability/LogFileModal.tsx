/**
 * LogFileModal - Fullscreen modal for viewing agent log file contents
 * Displays log files with syntax highlighting, filtering, and iteration navigation
 */

import { useState, useEffect, useRef } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Clock,
  Terminal,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  PauseCircle,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import type { LoopIteration, AgentSessionStatus } from "./AgentSessionsView";

interface LogFileModalProps {
  logFileId: string;
  sessionName: string;
  iteration: number;
  content: string;
  allIterations?: LoopIteration[];
  onClose: () => void;
  onNavigateIteration?: (logFileId: string, iteration: number) => void;
}

// Log line type for syntax highlighting
type LogLevel =
  | "INFO"
  | "SUCCESS"
  | "ERROR"
  | "WARN"
  | "TASK"
  | "CHECKPOINT"
  | "PAUSE"
  | "DEBUG";

interface ParsedLogLine {
  timestamp: string;
  level: LogLevel;
  message: string;
  raw: string;
}

function parseLogLine(line: string): ParsedLogLine | null {
  const match = line.match(/^\[([^\]]+)\]\s+\[([A-Z]+)\]\s+(.*)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: match[2] as LogLevel,
      message: match[3],
      raw: line,
    };
  }
  if (line.trim()) {
    return {
      timestamp: "",
      level: "INFO",
      message: line,
      raw: line,
    };
  }
  return null;
}

function getLevelConfig(level: LogLevel) {
  const configs: Record<
    LogLevel,
    { icon: typeof Info; color: string; bg: string }
  > = {
    INFO: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
    SUCCESS: {
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    ERROR: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
    WARN: {
      icon: AlertTriangle,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    TASK: { icon: Terminal, color: "text-purple-400", bg: "bg-purple-500/10" },
    CHECKPOINT: {
      icon: Clock,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    PAUSE: { icon: Clock, color: "text-orange-400", bg: "bg-orange-500/10" },
    DEBUG: { icon: Info, color: "text-gray-400", bg: "bg-gray-500/10" },
  };
  return configs[level] || configs.INFO;
}

function getIterationStatusIcon(status: AgentSessionStatus) {
  switch (status) {
    case "running":
      return PlayCircle;
    case "completed":
      return CheckCircle;
    case "failed":
      return XCircle;
    case "paused":
      return PauseCircle;
    default:
      return Info;
  }
}

function getIterationStatusColor(status: AgentSessionStatus) {
  switch (status) {
    case "running":
      return "text-blue-400 bg-blue-500/20";
    case "completed":
      return "text-green-400 bg-green-500/20";
    case "failed":
      return "text-red-400 bg-red-500/20";
    case "paused":
      return "text-orange-400 bg-orange-500/20";
    default:
      return "text-gray-400 bg-gray-500/20";
  }
}

export default function LogFileModal({
  logFileId,
  sessionName,
  iteration,
  content,
  allIterations,
  onClose,
  onNavigateIteration,
}: LogFileModalProps) {
  const [copied, setCopied] = useState(false);
  const [filterLevel, setFilterLevel] = useState<LogLevel | "ALL">("ALL");
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse log lines
  const parsedLines = content
    .split("\n")
    .map(parseLogLine)
    .filter(Boolean) as ParsedLogLine[];

  // Filter lines
  const filteredLines = parsedLines.filter(
    (line) => filterLevel === "ALL" || line.level === filterLevel,
  );

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Download as file
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${logFileId}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Navigate with arrow keys
      if (allIterations && onNavigateIteration) {
        const currentIndex = allIterations.findIndex(
          (i) => i.iteration === iteration,
        );
        if (e.key === "ArrowLeft" && currentIndex > 0) {
          const prev = allIterations[currentIndex - 1];
          onNavigateIteration(prev.logFileId, prev.iteration);
        }
        if (e.key === "ArrowRight" && currentIndex < allIterations.length - 1) {
          const next = allIterations[currentIndex + 1];
          onNavigateIteration(next.logFileId, next.iteration);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, allIterations, iteration, onNavigateIteration]);

  // Stats
  const stats = {
    total: parsedLines.length,
    errors: parsedLines.filter((l) => l.level === "ERROR").length,
    warnings: parsedLines.filter((l) => l.level === "WARN").length,
    tasks: parsedLines.filter((l) => l.level === "TASK").length,
    success: parsedLines.filter((l) => l.level === "SUCCESS").length,
  };

  // Navigation
  const currentIndex = allIterations?.findIndex(
    (i) => i.iteration === iteration,
  );
  const hasPrev = currentIndex !== undefined && currentIndex > 0;
  const hasNext =
    currentIndex !== undefined &&
    allIterations &&
    currentIndex < allIterations.length - 1;

  const navigatePrev = () => {
    if (hasPrev && allIterations && onNavigateIteration && currentIndex) {
      const prev = allIterations[currentIndex - 1];
      onNavigateIteration(prev.logFileId, prev.iteration);
    }
  };

  const navigateNext = () => {
    if (
      hasNext &&
      allIterations &&
      onNavigateIteration &&
      currentIndex !== undefined
    ) {
      const next = allIterations[currentIndex + 1];
      onNavigateIteration(next.logFileId, next.iteration);
    }
  };

  const navigateToIteration = (iter: LoopIteration) => {
    if (onNavigateIteration) {
      onNavigateIteration(iter.logFileId, iter.iteration);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Fullscreen modal */}
      <div
        className="relative flex flex-col w-full h-full bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gray-700 rounded-lg">
              <FileText className="h-6 w-6 text-gray-300" />
            </div>
            <div>
              <h3 className="text-xl font-medium text-white flex items-center gap-3">
                {logFileId}
                <span className="px-2 py-0.5 rounded-full text-sm bg-gray-700 text-gray-300">
                  Iteration #{iteration}
                </span>
              </h3>
              <p className="text-sm text-gray-400">{sessionName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation arrows */}
            {allIterations && allIterations.length > 1 && (
              <div className="flex items-center gap-1 mr-4">
                <button
                  onClick={navigatePrev}
                  disabled={!hasPrev}
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    hasPrev
                      ? "text-gray-300 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 cursor-not-allowed",
                  )}
                  title="Previous iteration (←)"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-400 px-2">
                  {(currentIndex ?? 0) + 1} / {allIterations.length}
                </span>
                <button
                  onClick={navigateNext}
                  disabled={!hasNext}
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    hasNext
                      ? "text-gray-300 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 cursor-not-allowed",
                  )}
                  title="Next iteration (→)"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            <button
              onClick={handleCopy}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Download log file"
            >
              <Download className="h-5 w-5" />
            </button>
            <a
              href={`/api/logs/${logFileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in new tab"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors ml-2"
              title="Close (ESC)"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Iteration sidebar */}
          {allIterations && allIterations.length > 1 && (
            <div className="w-64 border-r border-gray-700 bg-gray-800 overflow-y-auto">
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Iterations
                </h4>
                <div className="space-y-2">
                  {allIterations.map((iter) => {
                    const StatusIcon = getIterationStatusIcon(iter.status);
                    const isActive = iter.iteration === iteration;
                    return (
                      <button
                        key={iter.iteration}
                        onClick={() => navigateToIteration(iter)}
                        className={clsx(
                          "w-full text-left p-3 rounded-lg transition-colors",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700/50 text-gray-300 hover:bg-gray-700",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            Loop #{iter.iteration}
                          </span>
                          <span
                            className={clsx(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                              isActive
                                ? "bg-white/20"
                                : getIterationStatusColor(iter.status),
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {iter.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs opacity-80">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {iter.tasksCompleted}
                          </span>
                          {iter.tasksFailed > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              <XCircle className="h-3 w-3" />
                              {iter.tasksFailed}
                            </span>
                          )}
                          {iter.duration && (
                            <span>{Math.round(iter.duration / 1000)}s</span>
                          )}
                        </div>
                        {iter.errors && iter.errors.length > 0 && (
                          <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {iter.errors.length} error(s)
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 bg-gray-800/50">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-400">{stats.total} lines</span>
                {stats.success > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    {stats.success} success
                  </span>
                )}
                {stats.tasks > 0 && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Terminal className="h-4 w-4" />
                    {stats.tasks} tasks
                  </span>
                )}
                {stats.warnings > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    {stats.warnings} warnings
                  </span>
                )}
                {stats.errors > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    {stats.errors} errors
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Filter:</span>
                <select
                  value={filterLevel}
                  onChange={(e) =>
                    setFilterLevel(e.target.value as LogLevel | "ALL")
                  }
                  className="text-sm bg-gray-700 text-gray-300 border-gray-600 rounded-md px-3 py-1.5"
                >
                  <option value="ALL">All Levels</option>
                  <option value="INFO">Info</option>
                  <option value="SUCCESS">Success</option>
                  <option value="TASK">Tasks</option>
                  <option value="WARN">Warnings</option>
                  <option value="ERROR">Errors</option>
                  <option value="CHECKPOINT">Checkpoints</option>
                </select>
              </div>
            </div>

            {/* Log content */}
            <div
              ref={contentRef}
              className="flex-1 overflow-auto p-6 font-mono text-sm"
            >
              <div className="space-y-1">
                {filteredLines.map((line, idx) => {
                  const config = getLevelConfig(line.level);
                  const Icon = config.icon;

                  return (
                    <div
                      key={idx}
                      className={clsx(
                        "flex items-start gap-3 px-3 py-1.5 rounded",
                        line.level === "ERROR" && "bg-red-500/10",
                        line.level === "WARN" && "bg-yellow-500/10",
                      )}
                    >
                      {line.timestamp && (
                        <span className="text-gray-500 text-xs whitespace-nowrap w-20">
                          {formatTimestamp(line.timestamp)}
                        </span>
                      )}
                      <Icon
                        className={clsx(
                          "h-4 w-4 flex-shrink-0 mt-0.5",
                          config.color,
                        )}
                      />
                      <span
                        className={clsx(
                          "flex-1",
                          line.level === "ERROR" && "text-red-300",
                          line.level === "WARN" && "text-yellow-300",
                          line.level === "SUCCESS" && "text-green-300",
                          line.level === "TASK" && "text-purple-300",
                          line.level === "INFO" && "text-gray-300",
                          line.level === "CHECKPOINT" && "text-indigo-300",
                          line.level === "PAUSE" && "text-orange-300",
                        )}
                      >
                        {highlightMessage(line.message)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {filteredLines.length === 0 && (
                <div className="text-center text-gray-500 py-12">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg">No log entries matching filter</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-700 bg-gray-800 text-sm text-gray-500 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span>Press ESC to close</span>
                {allIterations && allIterations.length > 1 && (
                  <span>Use ← → to navigate iterations</span>
                )}
              </div>
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Format timestamp for display
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return timestamp.slice(11, 19);
  }
}

// Highlight special patterns in messages
function highlightMessage(message: string): React.ReactNode {
  const parts = message.split(/(✓|✗|▶|⏸|⚠)/g);

  return parts.map((part, idx) => {
    if (part === "✓") {
      return (
        <span key={idx} className="text-green-400">
          {part}
        </span>
      );
    }
    if (part === "✗") {
      return (
        <span key={idx} className="text-red-400">
          {part}
        </span>
      );
    }
    if (part === "▶") {
      return (
        <span key={idx} className="text-blue-400">
          {part}
        </span>
      );
    }
    if (part === "⏸") {
      return (
        <span key={idx} className="text-orange-400">
          {part}
        </span>
      );
    }
    if (part === "⚠") {
      return (
        <span key={idx} className="text-yellow-400">
          {part}
        </span>
      );
    }
    return part;
  });
}
