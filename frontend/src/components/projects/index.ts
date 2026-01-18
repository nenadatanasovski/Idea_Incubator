/**
 * Projects components barrel export
 *
 * Re-exports all project-related components for cleaner imports.
 */

// Core project components
export { default as ProjectCard } from "./ProjectCard";
export { default as ProjectsContainer } from "./ProjectsContainer";
export { default as ProjectsSubTabs } from "./ProjectsSubTabs";
export { default as ProjectOverview } from "./ProjectOverview";
export { default as ProjectSpec } from "./ProjectSpec";
export { default as ProjectBuild } from "./ProjectBuild";

// Traceability components
export { default as TraceabilityView } from "./TraceabilityView";
export { default as SpecSectionCard } from "./SpecSectionCard";
export { default as LinkedTaskChip } from "./LinkedTaskChip";
export { default as CoverageStatsCard } from "./CoverageStatsCard";
export { default as SpecCoverageColumn } from "./SpecCoverageColumn";
export { default as TraceabilityHierarchy } from "./TraceabilityHierarchy";
export { default as TraceabilityGapPanel } from "./TraceabilityGapPanel";
export { default as OrphanTaskPanel } from "./OrphanTaskPanel";
export { default as BulkLinkWizard } from "./BulkLinkWizard";
export { default as BulkTaskCreationWizard } from "./BulkTaskCreationWizard";

// Task grouping components
export { default as TaskGroupSelector } from "./TaskGroupSelector";
export { default as TaskGroupCard } from "./TaskGroupCard";
export { default as DecompositionTree } from "./DecompositionTree";

// AI sync components
export { default as AISyncButton } from "./AISyncButton";
export { default as TaskSpecLinkModal } from "./TaskSpecLinkModal";

// Type exports
export type { TaskGroupMode } from "./TaskGroupSelector";
export type { ProjectTab } from "./ProjectsSubTabs";
