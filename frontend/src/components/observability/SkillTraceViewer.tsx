/**
 * SkillTraceViewer - Detailed view of a single skill invocation
 *
 * Features:
 * - Skill file reference with link
 * - Invocation context (task, input, output)
 * - Tool calls made during skill
 * - Metrics (duration, tokens)
 * - Status indicator
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Lightbulb,
  FileCode,
  Clock,
  Zap,
  Hash,
  ChevronRight,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useToolUses } from "../../hooks/useObservability";
import type { ToolUse, SkillTrace } from "../../types/observability";

interface SkillTraceViewerProps {
  skillTrace?: SkillTrace;
  skillTraceId?: string;
  executionId?: string;
  onToolClick?: (toolUse: ToolUse) => void;
  onFileClick?: (filePath: string, line?: number) => void;
}

export default function SkillTraceViewer({
  skillTrace: propSkillTrace,
  skillTraceId,
  executionId,
  onToolClick,
  onFileClick,
}: SkillTraceViewerProps) {
  const [skillTrace, setSkillTrace] = useState<SkillTrace | null>(
    propSkillTrace || null,
  );
  const [loading, setLoading] = useState(!propSkillTrace && !!skillTraceId);

  // Fetch skill trace if ID is provided but not the trace itself
  useEffect(() => {
    if (propSkillTrace) {
      setSkillTrace(propSkillTrace);
      setLoading(false);
      return;
    }

    if (!skillTraceId) {
      setLoading(false);
      return;
    }

    const fetchSkillTrace = async () => {
      try {
        const response = await fetch(
          `/api/observability/skill-traces/${skillTraceId}`,
        );
        if (response.ok) {
          const json = await response.json();
          if (json.success) {
            setSkillTrace(json.data);
          }
        }
      } catch {
        // Error fetching skill trace
      } finally {
        setLoading(false);
      }
    };

    fetchSkillTrace();
  }, [skillTraceId, propSkillTrace]);

  // Use withinSkill field to filter tool uses for this skill invocation
  const { toolUses } = useToolUses(executionId, {
    limit: 100,
  });

  // Filter tool uses that belong to this skill
  const skillToolUses = useMemo(() => {
    if (!skillTrace?.id) return [];
    return toolUses.filter((tu) => tu.withinSkill === skillTrace.id);
  }, [toolUses, skillTrace?.id]);

  const invocation = skillTrace;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedInput, setExpandedInput] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState(false);

  // Copy to clipboard
  const handleCopy = useCallback(async (content: string, field: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  // Parse file:line reference
  const fileReference = useMemo(() => {
    if (!invocation?.skillFile) return null;
    const match = invocation.skillFile.match(/^(.+):(\d+)$/);
    if (match) {
      return { path: match[1], line: parseInt(match[2], 10) };
    }
    return { path: invocation.skillFile, line: undefined };
  }, [invocation?.skillFile]);

  // Calculate duration
  const duration = useMemo(() => {
    if (!invocation?.startTime) return null;
    const start = new Date(invocation.startTime).getTime();
    const end = invocation.endTime
      ? new Date(invocation.endTime).getTime()
      : Date.now();
    return end - start;
  }, [invocation]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-16 bg-gray-100 rounded-lg" />
        <div className="h-32 bg-gray-100 rounded-lg" />
        <div className="h-48 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (!invocation) {
    return (
      <div className="p-8 text-center text-gray-500">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Skill invocation not found</p>
      </div>
    );
  }

  const statusColor =
    invocation.status === "success"
      ? "text-green-600 bg-green-100"
      : invocation.status === "failed"
        ? "text-red-600 bg-red-100"
        : "text-yellow-600 bg-yellow-100";

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Lightbulb className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {invocation.skillName || "Unknown Skill"}
              </h2>
              <p className="text-sm text-gray-500">
                ID: {invocation.id.slice(0, 8)}...
              </p>
            </div>
          </div>
          <span className={`px-2 py-1 text-xs rounded ${statusColor}`}>
            {invocation.status}
          </span>
        </div>

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Duration */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">Duration</div>
              <div className="text-sm font-medium">
                {duration ? `${duration}ms` : "-"}
              </div>
            </div>
          </div>

          {/* Tool Calls */}
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-400" />
            <div>
              <div className="text-xs text-gray-500">Tool Calls</div>
              <div className="text-sm font-medium">{skillToolUses.length}</div>
            </div>
          </div>

          {/* Tokens */}
          {invocation.tokenEstimate !== undefined &&
            invocation.tokenEstimate !== null && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-purple-400" />
                <div>
                  <div className="text-xs text-gray-500">Tokens</div>
                  <div className="text-sm font-medium">
                    {invocation.tokenEstimate.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

          {/* Started At */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <div>
              <div className="text-xs text-gray-500">Started</div>
              <div className="text-sm font-medium">
                {invocation.startTime
                  ? new Date(invocation.startTime).toLocaleTimeString()
                  : "-"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File Reference */}
      {fileReference && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">Skill File</span>
            </div>
            <button
              onClick={() =>
                onFileClick?.(fileReference.path, fileReference.line)
              }
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              {fileReference.path}
              {fileReference.line && `:${fileReference.line}`}
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {invocation.inputSummary && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <button
              onClick={() => setExpandedInput(!expandedInput)}
              className="flex items-center gap-2"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${expandedInput ? "rotate-90" : ""}`}
              />
              <span className="text-sm font-medium">Input</span>
            </button>
            <button
              onClick={() => handleCopy(invocation.inputSummary || "", "input")}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Copy input"
            >
              {copiedField === "input" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          {expandedInput && (
            <pre className="p-4 bg-gray-900 text-gray-100 text-xs font-mono overflow-auto max-h-64">
              {invocation.inputSummary}
            </pre>
          )}
        </div>
      )}

      {/* Output */}
      {invocation.outputSummary && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
            <button
              onClick={() => setExpandedOutput(!expandedOutput)}
              className="flex items-center gap-2"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${expandedOutput ? "rotate-90" : ""}`}
              />
              <span className="text-sm font-medium">Output</span>
            </button>
            <button
              onClick={() =>
                handleCopy(invocation.outputSummary || "", "output")
              }
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Copy output"
            >
              {copiedField === "output" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          {expandedOutput && (
            <pre className="p-4 bg-gray-900 text-gray-100 text-xs font-mono overflow-auto max-h-64">
              {invocation.outputSummary}
            </pre>
          )}
        </div>
      )}

      {/* Tool Calls */}
      {skillToolUses.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">
                Tool Calls ({skillToolUses.length})
              </span>
            </div>
          </div>
          <div className="divide-y max-h-64 overflow-auto">
            {skillToolUses.map((toolUse, idx) => (
              <button
                key={toolUse.id}
                onClick={() => onToolClick?.(toolUse)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
              >
                <span className="text-xs text-gray-400 w-6">#{idx + 1}</span>
                {toolUse.isError ? (
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {toolUse.tool}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {toolUse.durationMs}ms
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {invocation.errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Error</h4>
              <pre className="mt-2 text-xs text-red-700 font-mono whitespace-pre-wrap">
                {invocation.errorMessage}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Context */}
      {invocation.taskId && (
        <div className="bg-white border rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Context</h4>
          <div className="text-sm text-gray-600">
            Task ID:{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">
              {invocation.taskId}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
