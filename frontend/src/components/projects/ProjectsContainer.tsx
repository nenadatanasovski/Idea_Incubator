/**
 * ProjectsContainer - Container layout for project detail page
 * Provides header, sub-tabs, and content area
 */

import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, FolderKanban, Lightbulb, ExternalLink } from "lucide-react";
import clsx from "clsx";
import ProjectsSubTabs, { ProjectTab } from "./ProjectsSubTabs";
import type { ProjectWithStats } from "../../../../types/project";

interface ProjectsContainerProps {
  project: ProjectWithStats;
  children: ReactNode;
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

export default function ProjectsContainer({
  project,
  children,
}: ProjectsContainerProps) {
  const location = useLocation();
  const status = statusConfig[project.status] || statusConfig.active;

  // Derive active tab from URL
  const getActiveTab = (): ProjectTab => {
    const path = location.pathname;
    if (path.endsWith("/spec")) return "spec";
    if (path.endsWith("/traceability")) return "traceability";
    if (path.endsWith("/build")) return "build";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button */}
            <Link
              to="/projects"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            {/* Project icon and name */}
            <div className="flex items-center gap-3">
              <FolderKanban className="h-6 w-6 text-primary-600" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">
                    {project.name}
                  </h1>
                  <span
                    className={clsx(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      status.bgColor,
                      status.color,
                    )}
                  >
                    {status.label}
                  </span>
                  <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {project.code}
                  </span>
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Linked idea link */}
          {project.ideaSlug && (
            <Link
              to={`/ideas/${project.ideaSlug}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>View Idea</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <ProjectsSubTabs projectSlug={project.slug} activeTab={activeTab} />

      {/* Content area */}
      <div className="flex-1 overflow-auto bg-gray-50">{children}</div>
    </div>
  );
}
