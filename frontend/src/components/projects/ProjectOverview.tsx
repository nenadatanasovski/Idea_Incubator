/**
 * ProjectOverview - Overview sub-tab content
 * Shows project info, linked idea summary, and task stats
 */

import { useOutletContext, Link } from "react-router-dom";
import {
  Lightbulb,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Pause,
  Calendar,
  ArrowRight,
  ListTodo,
  FileText,
} from "lucide-react";
import clsx from "clsx";
import type { ProjectWithStats } from "../../../../types/project";
import CoverageStatsCard from "./CoverageStatsCard";
import AISyncButton from "./AISyncButton";

interface OutletContext {
  project: ProjectWithStats;
}

export default function ProjectOverview() {
  const { project } = useOutletContext<OutletContext>();
  const completionPct = project.completionPercentage || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked Idea Card */}
          {project.ideaSlug ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Linked Idea
                    </h3>
                    <p className="text-lg font-semibold text-gray-900 mt-0.5">
                      {project.ideaTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {project.ideaLifecycleStage && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          {project.ideaLifecycleStage}
                        </span>
                      )}
                      {project.ideaIncubationPhase && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {project.ideaIncubationPhase}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  to={`/ideas/${project.ideaSlug}`}
                  className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                >
                  View Details
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-5">
              <div className="flex items-center gap-3 text-gray-500">
                <Lightbulb className="h-5 w-5" />
                <span>No idea linked to this project</span>
              </div>
            </div>
          )}

          {/* Task Progress Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Task Progress</h3>
              <Link
                to={`/projects/${project.slug}/build`}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                View all tasks →
              </Link>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
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

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">
                  {completionPct.toFixed(0)}%
                </span>{" "}
                complete
              </span>
              <span className="text-gray-500">
                {project.completedTasks} of {project.totalTasks} tasks
              </span>
            </div>

            {/* Task breakdown */}
            <div className="grid grid-cols-5 gap-4 mt-6">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {project.completedTasks}
                </div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {project.inProgressTasks}
                </div>
                <div className="text-xs text-gray-500">In Progress</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <AlertCircle className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {project.pendingTasks}
                </div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Pause className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {project.blockedTasks}
                </div>
                <div className="text-xs text-gray-500">Blocked</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {project.failedTasks}
                </div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - 1 col */}
        <div className="space-y-6">
          {/* Quick Stats Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <ListTodo className="h-4 w-4" />
                  <span>Task Lists</span>
                </div>
                <span className="font-medium text-gray-900">
                  {project.totalTaskLists}
                </span>
              </div>
              <Link
                to={`/projects/${project.slug}/spec`}
                className="flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
              >
                <div className="flex items-center gap-2 text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>Specifications</span>
                </div>
                <span className="font-medium text-gray-900">
                  {project.totalPrds}
                </span>
              </Link>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Evaluation Queue</span>
                </div>
                <span className="font-medium text-gray-900">
                  {project.evaluationQueueTasks}
                </span>
              </div>
            </div>
          </div>

          {/* Requirement Coverage Card */}
          <CoverageStatsCard
            projectId={project.id}
            projectSlug={project.slug}
          />

          {/* Dates Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Created</span>
                </div>
                <span className="text-sm text-gray-900">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
              {project.startedAt && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Started</span>
                  </div>
                  <span className="text-sm text-gray-900">
                    {new Date(project.startedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {project.completedAt && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Completed</span>
                  </div>
                  <span className="text-sm text-gray-900">
                    {new Date(project.completedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to={`/projects/${project.slug}/spec`}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FileText className="h-4 w-4" />
                View Specification
              </Link>
              <Link
                to={`/projects/${project.slug}/build`}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ListTodo className="h-4 w-4" />
                Manage Tasks
              </Link>
              <Link
                to={`/tasks/kanban?project=${project.slug}`}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
                Open Kanban Board
              </Link>
              <div className="pt-2 border-t border-gray-100 mt-2">
                <AISyncButton
                  endpoint="/api/ai/regenerate-summary"
                  payload={{ projectId: project.id }}
                  buttonText="Regenerate Summary"
                  variant="ghost"
                  size="md"
                  className="w-full justify-center"
                  confirmText="This will use AI to generate a new project summary based on task progress. Continue?"
                  onSuccess={(data) => {
                    console.log("AI summary result:", data);
                    alert(
                      `Generated Summary:\n${JSON.stringify(data, null, 2)}`,
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
