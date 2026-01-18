/**
 * LinkedTaskChip - Displays a linked task as a compact chip
 *
 * Shows task displayId, status indicator, and link type badge.
 */

import { Link } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  Circle,
  XCircle,
  PauseCircle,
  Code,
  TestTube,
  Link2,
} from "lucide-react";
import clsx from "clsx";
import type { LinkedTask } from "../../hooks/useTraceability";

interface LinkedTaskChipProps {
  task: LinkedTask;
  projectSlug?: string;
  showLinkType?: boolean;
  size?: "sm" | "md";
}

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle; color: string; label: string }
> = {
  completed: {
    icon: CheckCircle,
    color: "text-green-600 bg-green-50",
    label: "Completed",
  },
  in_progress: {
    icon: Clock,
    color: "text-blue-600 bg-blue-50",
    label: "In Progress",
  },
  pending: {
    icon: Circle,
    color: "text-gray-500 bg-gray-50",
    label: "Pending",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600 bg-red-50",
    label: "Failed",
  },
  blocked: {
    icon: PauseCircle,
    color: "text-amber-600 bg-amber-50",
    label: "Blocked",
  },
};

const linkTypeConfig: Record<
  string,
  { icon: typeof Code; color: string; label: string }
> = {
  implements: {
    icon: Code,
    color: "bg-purple-100 text-purple-700",
    label: "Impl",
  },
  tests: {
    icon: TestTube,
    color: "bg-cyan-100 text-cyan-700",
    label: "Test",
  },
  related: {
    icon: Link2,
    color: "bg-gray-100 text-gray-700",
    label: "Rel",
  },
};

export default function LinkedTaskChip({
  task,
  projectSlug,
  showLinkType = true,
  size = "sm",
}: LinkedTaskChipProps) {
  const status = statusConfig[task.status] || statusConfig.pending;
  const linkType = linkTypeConfig[task.linkType] || linkTypeConfig.related;

  const StatusIcon = status.icon;
  const LinkTypeIcon = linkType.icon;

  const chipContent = (
    <div
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border border-gray-200 hover:border-gray-300 transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
      )}
      title={`${task.title} - ${status.label}`}
    >
      {/* Status icon */}
      <StatusIcon
        className={clsx(
          status.color.split(" ")[0],
          size === "sm" ? "h-3 w-3" : "h-4 w-4",
        )}
      />

      {/* Display ID in monospace */}
      <span className="font-mono font-medium text-gray-900">
        {task.displayId}
      </span>

      {/* Link type badge */}
      {showLinkType && (
        <span
          className={clsx(
            "inline-flex items-center gap-0.5 rounded px-1 py-0.5",
            linkType.color,
            size === "sm" ? "text-[10px]" : "text-xs",
          )}
        >
          <LinkTypeIcon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {linkType.label}
        </span>
      )}
    </div>
  );

  // If projectSlug provided, wrap in link
  if (projectSlug) {
    return (
      <Link
        to={`/projects/${projectSlug}/build?task=${task.id}`}
        className="hover:no-underline"
      >
        {chipContent}
      </Link>
    );
  }

  return chipContent;
}
