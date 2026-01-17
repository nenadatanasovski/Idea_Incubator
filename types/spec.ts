/**
 * Spec (Specification) Types
 *
 * Types for spec management with workflow state tracking.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-002)
 */

/**
 * Spec workflow states
 * - draft: Initial state, spec is being created/edited
 * - review: Submitted for review
 * - approved: Approved and ready for task creation
 * - archived: Archived after tasks created or manually archived
 */
export type SpecWorkflowState = "draft" | "review" | "approved" | "archived";

/**
 * Spec section types
 * Each section has a different editor type in the UI
 */
export type SpecSectionType =
  | "problem"
  | "target_users"
  | "functional_desc"
  | "success_criteria"
  | "constraints"
  | "out_of_scope"
  | "risks"
  | "assumptions";

/**
 * Readiness dimensions for spec generation
 */
export interface ReadinessDimension {
  name: string;
  score: number; // 0-25 each
  description: string;
}

/**
 * Readiness score breakdown
 */
export interface ReadinessScore {
  total: number; // 0-100
  isReady: boolean; // total >= 75
  dimensions: {
    problemClarity: ReadinessDimension;
    solutionDefinition: ReadinessDimension;
    userUnderstanding: ReadinessDimension;
    scopeBoundaries: ReadinessDimension;
  };
}

/**
 * Individual spec section
 */
export interface SpecSection {
  id: string;
  specId: string;
  sectionType: SpecSectionType;
  content: string;
  orderIndex: number;
  confidenceScore: number; // 0-100
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Spec history entry for versioning
 */
export interface SpecHistory {
  id: string;
  specId: string;
  version: number;
  changesJson: Record<string, { old: unknown; new: unknown }>;
  changedBy?: string;
  fromState?: SpecWorkflowState;
  toState?: SpecWorkflowState;
  reason?: string;
  changedAt: string;
}

/**
 * Main Spec entity (extends PRD with workflow)
 */
export interface Spec {
  id: string;
  slug: string;
  title: string;

  userId: string;
  projectId?: string;
  parentPrdId?: string;

  // Workflow state
  workflowState: SpecWorkflowState;
  sourceSessionId?: string;
  readinessScore: number;
  version: number;

  // Core content
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;

  // Structured data (arrays)
  successCriteria: string[];
  constraints: string[];
  outOfScope: string[];

  // Optional extended sections
  risks?: string[];
  assumptions?: string[];

  // Approval workflow
  approvedAt?: string;
  approvedBy?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Spec with resolved sections
 */
export interface SpecWithSections extends Spec {
  sections: SpecSection[];
}

/**
 * Spec with full history
 */
export interface SpecWithHistory extends Spec {
  history: SpecHistory[];
}

/**
 * Input for creating a spec
 */
export interface CreateSpecInput {
  title: string;
  slug?: string;
  sourceSessionId: string;
  projectId?: string;
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
  risks?: string[];
  assumptions?: string[];
}

/**
 * Input for updating a spec
 */
export interface UpdateSpecInput {
  title?: string;
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
  risks?: string[];
  assumptions?: string[];
}

/**
 * Input for updating a spec section
 */
export interface UpdateSpecSectionInput {
  content: string;
}

/**
 * Workflow transition input
 */
export interface WorkflowTransitionInput {
  reason?: string;
}

/**
 * Generation result from Claude
 */
export interface SpecGenerationResult {
  spec: Spec;
  confidence: number; // Overall confidence 0-100
  sectionConfidences: Record<SpecSectionType, number>;
  needsReviewSections: SpecSectionType[];
  clarifyingQuestions?: string[];
}

/**
 * Database row representation for spec sections
 */
export interface SpecSectionRow {
  id: string;
  spec_id: string;
  section_type: string;
  content: string;
  order_index: number;
  confidence_score: number;
  needs_review: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database row representation for spec history
 */
export interface SpecHistoryRow {
  id: string;
  spec_id: string;
  version: number;
  changes_json: string;
  changed_by: string | null;
  from_state: string | null;
  to_state: string | null;
  reason: string | null;
  changed_at: string;
}

/**
 * Map database row to SpecSection
 */
export function mapSpecSectionRow(row: SpecSectionRow): SpecSection {
  return {
    id: row.id,
    specId: row.spec_id,
    sectionType: row.section_type as SpecSectionType,
    content: row.content,
    orderIndex: row.order_index,
    confidenceScore: row.confidence_score,
    needsReview: row.needs_review === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to SpecHistory
 */
export function mapSpecHistoryRow(row: SpecHistoryRow): SpecHistory {
  return {
    id: row.id,
    specId: row.spec_id,
    version: row.version,
    changesJson: JSON.parse(row.changes_json),
    changedBy: row.changed_by || undefined,
    fromState: (row.from_state as SpecWorkflowState) || undefined,
    toState: (row.to_state as SpecWorkflowState) || undefined,
    reason: row.reason || undefined,
    changedAt: row.changed_at,
  };
}
