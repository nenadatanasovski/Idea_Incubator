/**
 * EvidenceViewerModal - Display assertion evidence details
 */

import { useState } from "react";
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
} from "lucide-react";
import type { AssertionEvidence } from "../../types/observability";

interface EvidenceViewerModalProps {
  evidence: AssertionEvidence;
  onClose: () => void;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export default function EvidenceViewerModal({
  evidence,
  onClose,
  onNavigate,
}: EvidenceViewerModalProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["command", "stdout"]),
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const isExpanded = (section: string) => expandedSections.has(section);

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
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Command section */}
          {evidence.command && (
            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
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
              {isExpanded("command") && (
                <div className="p-3 bg-gray-900">
                  <code className="text-sm text-green-400 font-mono">
                    {evidence.command}
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
              <button
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={() => toggleSection("stdout")}
              >
                {isExpanded("stdout") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <FileText className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Standard Output</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {evidence.stdout.split("\n").length} lines
                </span>
              </button>
              {isExpanded("stdout") && (
                <pre className="p-3 bg-gray-900 text-gray-100 text-xs font-mono overflow-auto max-h-64">
                  {evidence.stdout}
                </pre>
              )}
            </div>
          )}

          {/* Stderr section */}
          {evidence.stderr && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 transition-colors"
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
                <span className="text-xs text-red-500 ml-auto">
                  {evidence.stderr.split("\n").length} lines
                </span>
              </button>
              {isExpanded("stderr") && (
                <pre className="p-3 bg-red-900 text-red-100 text-xs font-mono overflow-auto max-h-64">
                  {evidence.stderr}
                </pre>
              )}
            </div>
          )}

          {/* File diff section */}
          {evidence.fileDiff && (
            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={() => toggleSection("diff")}
              >
                {isExpanded("diff") ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <FileText className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-sm">File Changes</span>
              </button>
              {isExpanded("diff") && (
                <pre className="p-3 bg-gray-900 text-xs font-mono overflow-auto max-h-64">
                  {evidence.fileDiff.split("\n").map((line, i) => {
                    let color = "text-gray-100";
                    if (line.startsWith("+")) color = "text-green-400";
                    else if (line.startsWith("-")) color = "text-red-400";
                    else if (line.startsWith("@@")) color = "text-blue-400";
                    return (
                      <div key={i} className={color}>
                        {line}
                      </div>
                    );
                  })}
                </pre>
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
        <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
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
