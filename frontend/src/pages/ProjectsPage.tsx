/**
 * ProjectsPage - Main project detail page with nested routing
 * Follows the ObservabilityPage pattern
 */

import { useParams } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useProject } from "../hooks/useProject";
import ProjectsContainer from "../components/projects/ProjectsContainer";

export default function ProjectsPage() {
  const { slug } = useParams<{ slug: string }>();

  const { project, isLoading, error } = useProject({
    slug: slug || "",
    withStats: true,
    enabled: Boolean(slug),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
          <p className="text-gray-500">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-gray-900">
            Project Not Found
          </h2>
          <p className="text-gray-500">
            {error || "The requested project could not be found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProjectsContainer project={project}>
      <Outlet context={{ project }} />
    </ProjectsContainer>
  );
}
