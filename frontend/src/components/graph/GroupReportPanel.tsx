/**
 * GroupReportPanel Component
 *
 * Displays the AI-generated report for a node's connected group.
 * Shows overview, key themes, story narrative, and open questions.
 * Node titles in the story are clickable to navigate to that node.
 */

import { useMemo, useEffect, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Lightbulb,
  BookOpen,
  HelpCircle,
  Users,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useGroupReport, type GroupReport } from "./hooks/useGroupReport";
import type { GraphNode } from "../../types/graph";

// ============================================================================
// Types
// ============================================================================

export interface GroupReportPanelProps {
  sessionId: string;
  currentNodeId: string;
  nodes: GraphNode[];
  onNodeClick?: (nodeId: string) => void;
  onGenerateReport?: () => void;
  /** Optional refresh trigger - when this changes, the report will be re-fetched */
  refreshTrigger?: number;
  /** Whether this panel is currently active/visible */
  isActive?: boolean;
  /** Callback when report view state changes - handles layout, zoom, and highlighting */
  onReportViewChange?: (active: boolean, nodeIds: string[]) => void;
  /** If report was already fetched by parent, pass it here to avoid double-fetching */
  existingReport?: GroupReport | null;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Renders markdown-like text with clickable node title references.
 * Node titles in quotes like "Market validation" become clickable links.
 */
function MarkdownWithNodeLinks({
  content,
  nodes,
  onNodeClick,
}: {
  content: string;
  nodes: GraphNode[];
  onNodeClick?: (nodeId: string) => void;
}) {
  // Create a map of lowercase titles to node IDs for matching
  const titleToNodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((node) => {
      if (node.title) {
        map.set(node.title.toLowerCase(), node);
      }
    });
    return map;
  }, [nodes]);

  // Parse content and replace quoted titles with clickable spans
  const parts = useMemo(() => {
    const regex = /"([^"]+)"/g;
    const result: Array<{
      type: "text" | "link";
      content: string;
      nodeId?: string;
    }> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          content: content.slice(lastIndex, match.index),
        });
      }

      // Check if quoted text matches a node title
      const quotedText = match[1];
      const matchedNode = titleToNodeMap.get(quotedText.toLowerCase());

      if (matchedNode) {
        result.push({
          type: "link",
          content: `"${quotedText}"`,
          nodeId: matchedNode.id,
        });
      } else {
        result.push({
          type: "text",
          content: `"${quotedText}"`,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push({
        type: "text",
        content: content.slice(lastIndex),
      });
    }

    return result;
  }, [content, titleToNodeMap]);

  return (
    <span>
      {parts.map((part, index) =>
        part.type === "link" && part.nodeId ? (
          <button
            key={index}
            onClick={() => onNodeClick?.(part.nodeId!)}
            className="text-cyan-600 hover:text-cyan-700 hover:underline cursor-pointer font-medium"
            data-testid={`report-node-link-${part.nodeId}`}
          >
            {part.content}
          </button>
        ) : (
          <span key={index}>{part.content}</span>
        ),
      )}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GroupReportPanel({
  sessionId,
  currentNodeId,
  nodes,
  onNodeClick,
  onGenerateReport,
  refreshTrigger,
  isActive = false,
  onReportViewChange,
  existingReport,
}: GroupReportPanelProps) {
  // Use existing report if provided, otherwise fetch
  const {
    report: fetchedReport,
    isLoading,
    error,
    isStale,
    regenerate,
  } = useGroupReport({
    sessionId,
    nodeId: currentNodeId,
    refreshTrigger,
  });

  // Prefer existing report if provided (already fetched by parent)
  const report = existingReport !== undefined ? existingReport : fetchedReport;

  // Use ref to store callback to avoid stale closures in cleanup
  const onReportViewChangeRef = useRef(onReportViewChange);
  onReportViewChangeRef.current = onReportViewChange;

  // Track whether we've activated report view (to know if cleanup should deactivate)
  const reportViewActivatedRef = useRef(false);

  // Activate report view when panel becomes active and has report data
  useEffect(() => {
    const hasNodeIds = report?.nodeIds && report.nodeIds.length > 0;

    if (isActive && hasNodeIds && onReportViewChangeRef.current) {
      onReportViewChangeRef.current(true, report.nodeIds);
      reportViewActivatedRef.current = true;
    } else if (
      !isActive &&
      reportViewActivatedRef.current &&
      onReportViewChangeRef.current
    ) {
      // Deactivate when isActive becomes false
      onReportViewChangeRef.current(false, []);
      reportViewActivatedRef.current = false;
    }

    // Cleanup: deactivate report view when panel unmounts
    return () => {
      if (reportViewActivatedRef.current && onReportViewChangeRef.current) {
        onReportViewChangeRef.current(false, []);
        reportViewActivatedRef.current = false;
      }
    };
  }, [isActive, report?.nodeIds]);

  // Generate reports for the session
  const handleGenerateReport = async () => {
    if (onGenerateReport) {
      onGenerateReport();
    } else {
      // Default: call the regenerate-all endpoint
      try {
        await fetch(
          `/api/ideation/session/${sessionId}/reports/regenerate-all`,
          {
            method: "POST",
          },
        );
      } catch (err) {
        console.error("Error generating reports:", err);
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-sm">Loading report...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <AlertCircle className="w-6 h-6 mb-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  // No report available
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <BookOpen className="w-8 h-8 mb-3 text-gray-400" />
        <span className="text-sm font-medium mb-1">No report available</span>
        <span className="text-xs text-gray-400 text-center px-4 mb-4">
          Generate a report to get an AI-synthesized overview of this node's
          connected group.
        </span>
        <button
          onClick={handleGenerateReport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Generate Report
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* Header with status and regenerate button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {report.groupName || "Unnamed Group"}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {report.nodeCount} nodes, {report.edgeCount} edges
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isStale && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              Stale
            </span>
          )}
          <button
            onClick={regenerate}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Regenerate report"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        </div>
      </div>

      {/* Overview */}
      {report.overview && (
        <section>
          <h4 className="flex items-center gap-1.5 font-medium text-gray-700 mb-2 text-sm">
            <BookOpen className="w-4 h-4" />
            Overview
          </h4>
          <div className="prose prose-sm max-w-none text-gray-600">
            <MarkdownWithNodeLinks
              content={report.overview}
              nodes={nodes}
              onNodeClick={onNodeClick}
            />
          </div>
        </section>
      )}

      {/* Key Themes */}
      {report.keyThemes && report.keyThemes.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 font-medium text-gray-700 mb-2 text-sm">
            <Lightbulb className="w-4 h-4" />
            Key Themes
          </h4>
          <ul className="space-y-1.5">
            {report.keyThemes.map((theme, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-cyan-500 mt-1.5">•</span>
                <span>{theme}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The Story */}
      {report.story && (
        <section>
          <h4 className="flex items-center gap-1.5 font-medium text-gray-700 mb-2 text-sm">
            <BookOpen className="w-4 h-4" />
            The Story
          </h4>
          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line">
            <MarkdownWithNodeLinks
              content={report.story}
              nodes={nodes}
              onNodeClick={onNodeClick}
            />
          </div>
        </section>
      )}

      {/* Open Questions */}
      {report.openQuestions && report.openQuestions.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 font-medium text-gray-700 mb-2 text-sm">
            <HelpCircle className="w-4 h-4" />
            Open Questions
          </h4>
          <ul className="space-y-1.5">
            {report.openQuestions.map((question, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-amber-500 mt-1.5">?</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nodes in Group */}
      {report.nodesSummary && report.nodesSummary.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 font-medium text-gray-700 mb-2 text-sm">
            <Users className="w-4 h-4" />
            Nodes in This Group ({report.nodesSummary.length})
          </h4>
          <ul className="space-y-2">
            {report.nodesSummary.map((nodeSummary) => (
              <li key={nodeSummary.nodeId} className="flex items-start gap-2">
                <button
                  onClick={() => onNodeClick?.(nodeSummary.nodeId)}
                  className="text-sm text-cyan-600 hover:text-cyan-700 hover:underline font-medium shrink-0"
                >
                  {nodeSummary.title || "Untitled"}
                </button>
                <span className="text-xs text-gray-500">
                  — {nodeSummary.oneLiner}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metadata */}
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Generated {new Date(report.generatedAt).toLocaleString()}
          {report.generationDurationMs && (
            <> in {(report.generationDurationMs / 1000).toFixed(1)}s</>
          )}
        </p>
      </div>
    </div>
  );
}

export default GroupReportPanel;
