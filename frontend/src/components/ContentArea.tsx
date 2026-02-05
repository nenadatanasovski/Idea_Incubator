// =============================================================================
// ContentArea.tsx
// Phase-aware content tabs for the unified layout
// =============================================================================

import { useState, ReactNode } from "react";
import clsx from "clsx";
import type { IdeaPhase } from "./UnifiedLayout";

export type ContentTab = 
  | "graph" 
  | "artifacts" 
  | "spec" 
  | "tasks" 
  | "evaluation"
  | "pipeline";

interface ContentAreaProps {
  ideaId: string;
  phase: IdeaPhase;
  // Custom tab content renderers
  renderGraph?: () => ReactNode;
  renderArtifacts?: () => ReactNode;
  renderSpec?: () => ReactNode;
  renderTasks?: () => ReactNode;
  renderEvaluation?: () => ReactNode;
  renderPipeline?: () => ReactNode;
  // Override default tab selection
  defaultTab?: ContentTab;
}

// Tab configuration
const TAB_CONFIG: Record<ContentTab, { label: string; icon?: string }> = {
  graph: { label: "Memory Graph" },
  artifacts: { label: "Artifacts" },
  spec: { label: "Specification" },
  tasks: { label: "Tasks" },
  evaluation: { label: "Evaluation" },
  pipeline: { label: "Pipeline" },
};

// Which tabs are available for each phase
function getTabsForPhase(phase: IdeaPhase): ContentTab[] {
  switch (phase) {
    case "ideation":
    case "ideation_ready":
      return ["graph", "artifacts", "pipeline"];
    case "specification":
    case "spec_ready":
      return ["spec", "graph", "artifacts", "pipeline"];
    case "building":
    case "build_review":
      return ["tasks", "spec", "artifacts", "pipeline"];
    case "deployed":
      return ["tasks", "evaluation", "artifacts", "pipeline"];
    case "paused":
    case "failed":
      return ["graph", "artifacts", "spec", "tasks", "pipeline"];
    default:
      return ["graph", "artifacts"];
  }
}

export function ContentArea({
  ideaId,
  phase,
  renderGraph,
  renderArtifacts,
  renderSpec,
  renderTasks,
  renderEvaluation,
  renderPipeline,
  defaultTab,
}: ContentAreaProps) {
  const availableTabs = getTabsForPhase(phase);
  const [activeTab, setActiveTab] = useState<ContentTab>(
    defaultTab && availableTabs.includes(defaultTab) 
      ? defaultTab 
      : availableTabs[0]
  );

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "graph":
        return renderGraph ? renderGraph() : <TabPlaceholder tab="graph" />;
      case "artifacts":
        return renderArtifacts ? renderArtifacts() : <TabPlaceholder tab="artifacts" />;
      case "spec":
        return renderSpec ? renderSpec() : <TabPlaceholder tab="spec" />;
      case "tasks":
        return renderTasks ? renderTasks() : <TabPlaceholder tab="tasks" />;
      case "evaluation":
        return renderEvaluation ? renderEvaluation() : <TabPlaceholder tab="evaluation" />;
      case "pipeline":
        return renderPipeline ? renderPipeline() : <PipelineStatus ideaId={ideaId} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="h-12 border-b flex items-center px-4 gap-2 shrink-0 bg-white">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition",
              activeTab === tab
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {TAB_CONFIG[tab].label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}

// Placeholder for unimplemented tabs
function TabPlaceholder({ tab }: { tab: ContentTab }) {
  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      <div className="text-center">
        <p className="text-lg font-medium">{TAB_CONFIG[tab].label}</p>
        <p className="text-sm mt-1">Content will be rendered here</p>
      </div>
    </div>
  );
}

// Simple pipeline status display
function PipelineStatus({ ideaId }: { ideaId: string }) {
  return (
    <div className="p-4">
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h3 className="font-medium text-gray-900 mb-4">Pipeline Status</h3>
        <div className="space-y-3">
          <StatusRow label="Idea ID" value={ideaId} />
          <StatusRow label="Current Phase" value="Loading..." />
          <StatusRow label="Auto-advance" value="Enabled" />
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Pipeline status loaded from /api/idea-pipeline/{ideaId}/status
        </p>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default ContentArea;
