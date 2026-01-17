/**
 * Breadcrumb - Navigation breadcrumb for observability views
 */

import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export default function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav
      className="flex items-center text-sm text-gray-500"
      aria-label="Breadcrumb"
    >
      <Link
        to="/observability"
        className="flex items-center hover:text-gray-700"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Observability</span>
      </Link>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;

        return (
          <div key={index} className="flex items-center">
            <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
            {isLast || !segment.href ? (
              <span
                className={isLast ? "font-medium text-gray-900" : ""}
                aria-current={isLast ? "page" : undefined}
              >
                {segment.label}
              </span>
            ) : (
              <Link to={segment.href} className="hover:text-gray-700">
                {segment.label}
              </Link>
            )}
          </div>
        );
      })}
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
