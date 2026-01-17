/**
 * ProjectCard - Card component for project list view
 */

import { Link } from "react-router-dom";
import {
  FolderKanban,
  Lightbulb,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import type { ProjectWithStats } from "../../../../types/project";

interface ProjectCardProps {
  project: ProjectWithStats;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  active: {
    label: "Active",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  paused: {
    label: "Paused",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
  },
  completed: {
    label: "Completed",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  archived: {
    label: "Archived",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
};

export default function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status] || statusConfig.active;
  const hasIdea = Boolean(project.ideaSlug);
  const completionPct = project.completionPercentage || 0;

  return (
    <Link
      to={`/projects/${project.slug}`}
      className="block bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200"
    >
      <div className="p-5">
        {/* Header with status badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-gray-400" />
            <span
              className={clsx(
                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                status.bgColor,
                status.color,
              )}
            >
              {status.label}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-mono">
            {project.code}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">
          {project.name}
        </h3>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Linked Idea */}
        {hasIdea && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="line-clamp-1">{project.ideaTitle}</span>
            {project.ideaLifecycleStage && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {project.ideaLifecycleStage}
              </span>
            )}
          </div>
        )}

        {/* Task Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1" title="Completed">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>{project.completedTasks}</span>
          </div>
          <div className="flex items-center gap-1" title="In Progress">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span>{project.inProgressTasks}</span>
          </div>
          <div className="flex items-center gap-1" title="Pending">
            <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
            <span>{project.pendingTasks}</span>
          </div>
          {project.failedTasks > 0 && (
            <div className="flex items-center gap-1" title="Failed">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span>{project.failedTasks}</span>
            </div>
          )}
          <div className="ml-auto text-gray-600 font-medium">
            {project.totalTasks} tasks
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              "absolute left-0 top-0 h-full rounded-full transition-all duration-300",
              completionPct >= 100
                ? "bg-green-500"
                : completionPct >= 50
                  ? "bg-blue-500"
                  : "bg-amber-500",
            )}
            style={{ width: `${Math.min(completionPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{completionPct.toFixed(0)}% complete</span>
          {project.totalTaskLists > 0 && (
            <span>{project.totalTaskLists} task lists</span>
          )}
        </div>
      </div>
    </Link>
  );
}
