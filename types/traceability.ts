/**
 * Traceability Types
 *
 * Types for tracing PRD/Spec requirements to tasks and vice versa.
 * Used by the Project Traceability system to show coverage analysis.
 */

import type { TaskStatus } from "./task-agent.js";

// ============================================
// Core Traceability Types
// ============================================

/**
 * Link type for PRD-Task relationships
 */
export type TraceabilityLinkType = "implements" | "tests" | "related";

/**
 * A task linked to a spec requirement
 */
export interface LinkedTask {
  id: string;
  displayId: string;
  title: string;
  status: TaskStatus;
  linkType: TraceabilityLinkType;
}

/**
 * Coverage status for a single spec item (e.g., one success criterion)
 */
export interface SpecItemCoverage {
  index: number;
  content: string;
  linkedTasks: LinkedTask[];
  isCovered: boolean;
}

/**
 * Coverage status for a spec section (e.g., all success criteria)
 */
export interface SpecSectionCoverage {
  sectionType: string;
  sectionTitle: string;
  totalItems: number;
  coveredItems: number;
  coveragePercentage: number;
  items: SpecItemCoverage[];
}

/**
 * Complete traceability view for a project
 */
export interface ProjectTraceability {
  projectId: string;
  prdId: string;
  prdTitle: string;
  sections: SpecSectionCoverage[];
  overallCoverage: number;
  orphanTaskCount: number;
  gapCount: number;
}

// ============================================
// Orphan & Gap Types
// ============================================

/**
 * A task with no PRD links (orphan)
 */
export interface OrphanTask {
  id: string;
  displayId: string;
  title: string;
  status: TaskStatus;
  category: string;
  createdAt: string;
}

/**
 * A spec requirement with no task links (gap)
 */
export interface CoverageGap {
  prdId: string;
  prdTitle: string;
  sectionType: string;
  sectionTitle: string;
  itemIndex: number;
  itemContent: string;
  severity: "high" | "medium" | "low";
}

// ============================================
// Task Spec Link Types
// ============================================

/**
 * Link between a task and a PRD requirement
 */
export interface TaskSpecLink {
  id: string;
  taskId: string;
  prdId: string;
  prdTitle: string;
  requirementRef: string;
  sectionType: string;
  itemIndex: number;
  itemContent: string;
  linkType: TraceabilityLinkType;
  createdAt: string;
}

/**
 * Input for creating a new task-spec link
 */
export interface CreateTaskSpecLinkInput {
  taskId: string;
  prdId: string;
  requirementRef: string;
  linkType: TraceabilityLinkType;
}

// ============================================
// Coverage Statistics Types
// ============================================

/**
 * Coverage statistics for a project (used in overview cards)
 */
export interface CoverageStats {
  overallCoverage: number;
  coveredRequirements: number;
  totalRequirements: number;
  orphanTaskCount: number;
  gapCount: number;
}

/**
 * Project with coverage stats attached
 */
export interface ProjectWithCoverage {
  coverageStats?: CoverageStats;
}

// ============================================
// API Response Types
// ============================================

/**
 * Response from /api/projects/:id/traceability
 */
export interface TraceabilityResponse {
  traceability: ProjectTraceability;
}

/**
 * Response from /api/projects/:id/coverage-gaps
 */
export interface CoverageGapsResponse {
  gaps: CoverageGap[];
  totalCount: number;
}

/**
 * Response from /api/projects/:id/orphan-tasks
 */
export interface OrphanTasksResponse {
  tasks: OrphanTask[];
  totalCount: number;
}

/**
 * Response from /api/tasks/:id/spec-links
 */
export interface TaskSpecLinksResponse {
  links: TaskSpecLink[];
  totalCount: number;
}

// ============================================
// Database Row Types
// ============================================

/**
 * Database row for prd_tasks junction table
 */
export interface PrdTaskRow {
  id: string;
  prd_id: string;
  task_id: string;
  requirement_ref: string | null;
  link_type: string;
  created_at: string;
}

/**
 * Database row for spec_sections table
 */
export interface SpecSectionRow {
  id: string;
  prd_id: string;
  section_type: string;
  section_title: string;
  content: string;
  position: number;
  confidence_score: number | null;
  needs_review: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Map database row to TaskSpecLink
 */
export function mapPrdTaskRow(
  row: PrdTaskRow,
  prdTitle: string,
  sectionType: string,
  itemIndex: number,
  itemContent: string,
): TaskSpecLink {
  return {
    id: row.id,
    taskId: row.task_id,
    prdId: row.prd_id,
    prdTitle,
    requirementRef: row.requirement_ref || "",
    sectionType,
    itemIndex,
    itemContent,
    linkType: row.link_type as TraceabilityLinkType,
    createdAt: row.created_at,
  };
}

/**
 * Calculate coverage percentage from section data
 */
export function calculateCoveragePercentage(
  covered: number,
  total: number,
): number {
  if (total === 0) return 100; // No requirements = fully covered
  return Math.round((covered / total) * 100);
}

/**
 * Determine severity of a coverage gap based on section type
 */
export function determineGapSeverity(
  sectionType: string,
): "high" | "medium" | "low" {
  switch (sectionType) {
    case "success_criteria":
      return "high";
    case "constraints":
      return "medium";
    default:
      return "low";
  }
}

/**
 * Parse requirement ref string (e.g., "success_criteria[0]") into parts
 */
export function parseRequirementRef(ref: string): {
  sectionType: string;
  index: number;
} | null {
  const match = ref.match(/^(\w+)\[(\d+)\]$/);
  if (!match) return null;
  return {
    sectionType: match[1],
    index: parseInt(match[2], 10),
  };
}

/**
 * Build a requirement ref string from parts
 */
export function buildRequirementRef(
  sectionType: string,
  index: number,
): string {
  return `${sectionType}[${index}]`;
}
