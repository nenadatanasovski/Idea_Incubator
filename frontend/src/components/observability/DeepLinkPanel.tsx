/**
 * DeepLinkPanel - Generate and share deep links to observability views
 *
 * Features:
 * - Generate deep links for executions, tools, assertions
 * - Copy to clipboard
 * - QR code generation (optional)
 * - Share buttons for common platforms
 * - Link preview
 */

import { useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Share2,
  ChevronDown,
} from "lucide-react";

interface DeepLinkPanelProps {
  executionId?: string;
  toolUseId?: string;
  assertionId?: string;
  taskId?: string;
  view?: string;
  timestamp?: string;
}

type LinkType =
  | "execution"
  | "tool"
  | "assertion"
  | "task"
  | "view"
  | "timestamp";

interface GeneratedLink {
  type: LinkType;
  label: string;
  url: string;
  description: string;
}

export default function DeepLinkPanel({
  executionId,
  toolUseId,
  assertionId,
  taskId,
  view,
  timestamp,
}: DeepLinkPanelProps) {
  const location = useLocation();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const baseUrl = window.location.origin;

  // Generate all available links based on props
  const links = useMemo<GeneratedLink[]>(() => {
    const result: GeneratedLink[] = [];

    // Current page link
    result.push({
      type: "view",
      label: "Current View",
      url: `${baseUrl}${location.pathname}${location.search}`,
      description: "Link to the current page with all filters",
    });

    // Execution link
    if (executionId) {
      result.push({
        type: "execution",
        label: "Execution",
        url: `${baseUrl}/observability/executions/${executionId}`,
        description: `Direct link to execution ${executionId.slice(0, 8)}`,
      });

      // Execution with specific view
      if (view) {
        result.push({
          type: "view",
          label: `Execution (${view})`,
          url: `${baseUrl}/observability/executions/${executionId}?view=${view}`,
          description: `Link to ${view} view of this execution`,
        });
      }

      // Execution at specific timestamp
      if (timestamp) {
        result.push({
          type: "timestamp",
          label: "At Timestamp",
          url: `${baseUrl}/observability/executions/${executionId}?t=${timestamp}`,
          description: `Link to execution at ${new Date(timestamp).toLocaleTimeString()}`,
        });
      }
    }

    // Tool use link
    if (toolUseId) {
      result.push({
        type: "tool",
        label: "Tool Use",
        url: `${baseUrl}/observability/tool-uses/${toolUseId}`,
        description: `Direct link to tool use ${toolUseId.slice(0, 8)}`,
      });
    }

    // Assertion link
    if (assertionId) {
      result.push({
        type: "assertion",
        label: "Assertion",
        url: `${baseUrl}/observability/assertions/${assertionId}`,
        description: `Direct link to assertion ${assertionId.slice(0, 8)}`,
      });
    }

    // Task link
    if (taskId) {
      result.push({
        type: "task",
        label: "Task",
        url: `${baseUrl}/tasks/${taskId}`,
        description: `Direct link to task ${taskId.slice(0, 8)}`,
      });
    }

    return result;
  }, [
    baseUrl,
    location,
    executionId,
    toolUseId,
    assertionId,
    taskId,
    view,
    timestamp,
  ]);

  // Copy link to clipboard
  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  }, []);

  // Open link in new tab
  const handleOpenLink = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // Share via native share API (if available)
  const handleShare = useCallback(
    async (url: string, title: string) => {
      if (navigator.share) {
        try {
          await navigator.share({
            title,
            url,
          });
        } catch (err) {
          // User cancelled or share failed
          console.debug("Share cancelled:", err);
        }
      } else {
        // Fallback to copy
        handleCopy(url);
      }
    },
    [handleCopy],
  );

  if (links.length === 0) {
    return null;
  }

  const primaryLink = links[0];

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* Header with primary link */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Deep Links</span>
        </div>

        {/* Quick copy for primary link */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleCopy(primaryLink.url)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              copiedLink === primaryLink.url
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Copy current page link"
          >
            {copiedLink === primaryLink.url ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>

          {/* Native share button (mobile) */}
          {"share" in navigator && (
            <button
              onClick={() => handleShare(primaryLink.url, "Observability Link")}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              title="Share"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}

          {/* Expand/collapse */}
          {links.length > 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
              title={isExpanded ? "Show less" : "Show more links"}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Link preview */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        <code className="text-xs text-gray-600 break-all">
          {primaryLink.url}
        </code>
      </div>

      {/* Expanded link list */}
      {isExpanded && links.length > 1 && (
        <div className="divide-y">
          {links.slice(1).map((link, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-4 py-2 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <LinkTypeIcon type={link.type} />
                  <span className="text-sm font-medium text-gray-700">
                    {link.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {link.description}
                </p>
              </div>

              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => handleCopy(link.url)}
                  className={`p-1.5 rounded transition-colors ${
                    copiedLink === link.url
                      ? "bg-green-100 text-green-700"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                  title="Copy link"
                >
                  {copiedLink === link.url ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleOpenLink(link.url)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Icon based on link type
function LinkTypeIcon({ type }: { type: LinkType }) {
  const iconClass = "h-4 w-4";

  switch (type) {
    case "execution":
      return <Link2 className={`${iconClass} text-blue-500`} />;
    case "tool":
      return <Link2 className={`${iconClass} text-purple-500`} />;
    case "assertion":
      return <Link2 className={`${iconClass} text-green-500`} />;
    case "task":
      return <Link2 className={`${iconClass} text-orange-500`} />;
    case "timestamp":
      return <Link2 className={`${iconClass} text-gray-500`} />;
    default:
      return <Link2 className={`${iconClass} text-gray-400`} />;
  }
}

// Compact version for inline use
export function DeepLinkButton({
  url,
  label = "Copy Link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
        copied
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied
        </>
      ) : (
        <>
          <Link2 className="h-3 w-3" />
          {label}
        </>
      )}
    </button>
  );
}
