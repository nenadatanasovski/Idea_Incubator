/**
 * ProjectsSubTabs - Sub-tab navigation for project detail view
 */

import { Link } from "react-router-dom";
import { LayoutDashboard, FileText, Hammer } from "lucide-react";
import clsx from "clsx";

export type ProjectTab = "overview" | "spec" | "build";

interface SubTab {
  id: ProjectTab;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
}

interface ProjectsSubTabsProps {
  projectSlug: string;
  activeTab: ProjectTab;
}

export default function ProjectsSubTabs({
  projectSlug,
  activeTab,
}: ProjectsSubTabsProps) {
  const subTabs: SubTab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      href: `/projects/${projectSlug}`,
    },
    {
      id: "spec",
      label: "Specification",
      icon: FileText,
      href: `/projects/${projectSlug}/spec`,
    },
    {
      id: "build",
      label: "Build",
      icon: Hammer,
      href: `/projects/${projectSlug}/build`,
    },
  ];

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-6">
        <nav className="flex gap-4" aria-label="Tabs">
          {subTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={clsx(
                  "flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "text-primary-600 border-primary-600"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
