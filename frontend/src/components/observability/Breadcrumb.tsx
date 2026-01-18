/**
 * Breadcrumb - Navigation breadcrumb for observability views
 *
 * Features:
 * - Shows current location hierarchy
 * - Each segment is clickable
 * - Copy link button
 * - Truncation for long paths
 * - Home icon for root
 */

import { useState, useCallback } from "react";
import { ChevronRight, Home, Link2, Check } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  maxLabelLength?: number;
  showCopyLink?: boolean;
}

// Truncate text with ellipsis
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export default function Breadcrumb({
  segments,
  maxLabelLength = 20,
  showCopyLink = true,
}: BreadcrumbProps) {
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}${location.pathname}${location.search}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [location]);

  return (
    <nav
      className="flex items-center justify-between text-sm"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center text-gray-500">
        {/* Home link */}
        <li>
          <Link
            to="/observability"
            className="flex items-center hover:text-gray-700 transition-colors"
            title="Observability Home"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Observability</span>
          </Link>
        </li>

        {/* Segments */}
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const needsTruncation = segment.label.length > maxLabelLength;
          const displayLabel = needsTruncation
            ? truncateText(segment.label, maxLabelLength)
            : segment.label;

          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-2 text-gray-400 flex-shrink-0" />
              {isLast || !segment.href ? (
                <span
                  className={`${isLast ? "font-medium text-gray-900" : ""} ${needsTruncation ? "cursor-help" : ""}`}
                  aria-current={isLast ? "page" : undefined}
                  title={needsTruncation ? segment.label : undefined}
                >
                  {displayLabel}
                </span>
              ) : (
                <Link
                  to={segment.href}
                  className="hover:text-gray-700 transition-colors"
                  title={needsTruncation ? segment.label : undefined}
                >
                  {displayLabel}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {/* Copy link button */}
      {showCopyLink && (
        <button
          onClick={handleCopyLink}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
            copied
              ? "text-green-600 bg-green-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
          title={copied ? "Copied!" : "Copy link to clipboard"}
          aria-label={copied ? "Link copied" : "Copy link"}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      )}
    </nav>
  );
}

// Helper to build common breadcrumb paths
export function buildExecutionBreadcrumb(
  executionId: string,
  additionalSegments?: BreadcrumbSegment[],
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [
    { label: "Executions", href: "/observability" },
    {
      label: executionId.slice(0, 8),
      href: `/observability/executions/${executionId}`,
    },
  ];

  if (additionalSegments) {
    segments.push(...additionalSegments);
  }

  return segments;
}
