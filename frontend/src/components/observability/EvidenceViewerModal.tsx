/**
 * EvidenceViewerModal - Display assertion evidence details
 *
 * Features:
 * - Command execution display (command, exit code, duration)
 * - Stdout/stderr panels with line numbers
 * - File diff viewer with line highlighting
 * - Related transcript entries with navigation
 * - Copy functionality for command and output
 * - Keyboard shortcut (Esc to close)
 * - Export evidence to JSON
 */

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Terminal,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Download,
  MessageSquare,
} from "lucide-react";
import type { AssertionEvidence } from "../../types/observability";

interface TranscriptEntry {
  id: string;
  type: "user" | "assistant" | "tool_use" | "tool_result";
  preview: string;
  timestamp: string;
}

interface EvidenceViewerModalProps {
  evidence: AssertionEvidence;
  onClose: () => void;
  onNavigate?: (entityType: string, entityId: string) => void;
  transcriptEntries?: TranscriptEntry[];
  onTranscriptClick?: (entryId: string) => void;
}

export default function EvidenceViewerModal({
  evidence,
  onClose,
  onNavigate,
  transcriptEntries = [],
  onTranscriptClick,
}: EvidenceViewerModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["command", "stdout"]),
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Copy to clipboard
  const handleCopy = useCallback(async (content: string, field: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      const input = document.createElement("textarea");
      input.value = content;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  // Export evidence as JSON
  const handleExport = useCallback(() => {
    const exportData = {
      evidence,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidence-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [evidence]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Evidence Details
            </h2>
            <span className="text-xs text-gray-400 ml-2">
              Press Esc to close
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Export as JSON"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Command section */}
          {evidence.command && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center bg-gray-100">
                <button
                  className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-gray-200 transition-colors"
                  onClick={() => toggleSection("command")}
                >
                  {isExpanded("command") ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Terminal className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">Command</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(evidence.command!, "command");
                  }}
                  className={`px-2 py-1 mr-2 text-xs rounded transition-colors ${
                    copiedField === "command"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:bg-gray-200"
                  }`}
                  title="Copy command"
                >
                  {copiedField === "command" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {isExpanded("command") && (
                <div className="p-3 bg-gray-900">
                  <code className="text-sm text-green-400 font-mono break-all">
                    $ {evidence.command}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Exit code & Duration */}
          <div className="flex gap-4">
            {evidence.exitCode !== undefined && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                {evidence.exitCode === 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">
                  Exit code:{" "}
                  <code className="font-mono">{evidence.exitCode}</code>
                </span>
              </div>
            )}
            {evidence.durationMs !== undefined && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{evidence.durationMs}ms</span>
              </div>
            )}
          </div>

          {/* Stdout section */}
          {evidence.stdout && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center bg-gray-100">
                <button
                  className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-gray-200 transition-colors"
                  onClick={() => toggleSection("stdout")}
                >
                  {isExpanded("stdout") ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">Standard Output</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {evidence.stdout.split("\n").length} lines
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(evidence.stdout!, "stdout");
                  }}
                  className={`px-2 py-1 mr-2 text-xs rounded transition-colors ${
                    copiedField === "stdout"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:bg-gray-200"
                  }`}
                  title="Copy stdout"
                >
                  {copiedField === "stdout" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {isExpanded("stdout") && (
                <div className="bg-gray-900 overflow-auto max-h-64">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {evidence.stdout.split("\n").map((line, i) => (
                        <tr key={i} className="hover:bg-gray-800">
                          <td className="px-2 py-0.5 text-gray-500 text-right select-none border-r border-gray-700 w-10">
                            {i + 1}
                          </td>
                          <td className="px-3 py-0.5 text-gray-100 whitespace-pre">
                            {line || " "}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Stderr section */}
          {evidence.stderr && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div className="flex items-center bg-red-50">
                <button
                  className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-red-100 transition-colors"
                  onClick={() => toggleSection("stderr")}
                >
                  {isExpanded("stderr") ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-sm text-red-700">
                    Standard Error
                  </span>
                  <span className="text-xs text-red-500 ml-2">
                    {evidence.stderr.split("\n").length} lines
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(evidence.stderr!, "stderr");
                  }}
                  className={`px-2 py-1 mr-2 text-xs rounded transition-colors ${
                    copiedField === "stderr"
                      ? "bg-green-100 text-green-700"
                      : "text-red-500 hover:bg-red-100"
                  }`}
                  title="Copy stderr"
                >
                  {copiedField === "stderr" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {isExpanded("stderr") && (
                <div className="bg-red-950 overflow-auto max-h-64">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {evidence.stderr.split("\n").map((line, i) => (
                        <tr key={i} className="hover:bg-red-900">
                          <td className="px-2 py-0.5 text-red-400 text-right select-none border-r border-red-800 w-10">
                            {i + 1}
                          </td>
                          <td className="px-3 py-0.5 text-red-100 whitespace-pre">
                            {line || " "}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* File diff section */}
          {evidence.fileDiff && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center bg-gray-100">
                <button
                  className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-gray-200 transition-colors"
                  onClick={() => toggleSection("diff")}
                >
                  {isExpanded("diff") ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span className="font-medium text-sm">File Changes</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {evidence.fileDiff.split("\n").length} lines
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(evidence.fileDiff!, "diff");
                  }}
                  className={`px-2 py-1 mr-2 text-xs rounded transition-colors ${
                    copiedField === "diff"
                      ? "bg-green-100 text-green-700"
                      : "text-gray-500 hover:bg-gray-200"
                  }`}
                  title="Copy diff"
                >
                  {copiedField === "diff" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {isExpanded("diff") && (
                <div className="bg-gray-900 overflow-auto max-h-64">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {evidence.fileDiff.split("\n").map((line, i) => {
                        let bgColor = "";
                        let textColor = "text-gray-100";
                        if (line.startsWith("+") && !line.startsWith("+++")) {
                          bgColor = "bg-green-900/30";
                          textColor = "text-green-400";
                        } else if (
                          line.startsWith("-") &&
                          !line.startsWith("---")
                        ) {
                          bgColor = "bg-red-900/30";
                          textColor = "text-red-400";
                        } else if (line.startsWith("@@")) {
                          bgColor = "bg-blue-900/30";
                          textColor = "text-blue-400";
                        }
                        return (
                          <tr key={i} className={`${bgColor} hover:opacity-80`}>
                            <td className="px-2 py-0.5 text-gray-500 text-right select-none border-r border-gray-700 w-10">
                              {i + 1}
                            </td>
                            <td
                              className={`px-3 py-0.5 ${textColor} whitespace-pre`}
                            >
                              {line || " "}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Related transcript entries */}
          {transcriptEntries.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center bg-gray-100">
                <button
                  className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-gray-200 transition-colors"
                  onClick={() => toggleSection("transcript")}
                >
                  {isExpanded("transcript") ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  <span className="font-medium text-sm">
                    Related Transcript Entries
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {transcriptEntries.length} entries
                  </span>
                </button>
              </div>
              {isExpanded("transcript") && (
                <div className="divide-y max-h-48 overflow-auto">
                  {transcriptEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => onTranscriptClick?.(entry.id)}
                      className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          entry.type === "user"
                            ? "bg-blue-100 text-blue-700"
                            : entry.type === "assistant"
                              ? "bg-green-100 text-green-700"
                              : entry.type === "tool_use"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {entry.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {entry.preview}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Related entities */}
          {evidence.relatedEntities && evidence.relatedEntities.length > 0 && (
            <div className="border rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Related Entities
              </h4>
              <div className="flex flex-wrap gap-2">
                {evidence.relatedEntities.map((entity, i) => (
                  <button
                    key={i}
                    onClick={() => onNavigate?.(entity.type, entity.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {entity.type}: {entity.id.slice(0, 8)}...
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            Press Esc to close · Use ↑↓ to navigate sections
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
