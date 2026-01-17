/**
 * Frontend Spec Types
 *
 * Types for spec visualization and editing in the UI.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-002-B)
 */

import type {
  Spec,
  SpecSection,
  SpecWorkflowState,
  SpecSectionType,
  ReadinessScore,
  SpecGenerationResult,
} from "../../../types/spec";

// Re-export base types
export type {
  Spec,
  SpecSection,
  SpecWorkflowState,
  SpecSectionType,
  ReadinessScore,
  SpecGenerationResult,
};

/**
 * Spec artifact type for artifact panel
 */
export interface SpecArtifact {
  id: string;
  type: "spec";
  title: string;
  content: Spec;
  status: "pending" | "loading" | "ready" | "error" | "updating";
  error?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Spec panel component props
 */
export interface SpecPanelProps {
  spec: Spec;
  sections: SpecSection[];
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<Spec>) => Promise<void>;
  onCancel: () => void;
  onTransition: (newState: SpecWorkflowState) => Promise<void>;
  onCreateTasks: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * Spec section editor props
 */
export interface SpecSectionEditorProps {
  section: SpecSection;
  isEditing: boolean;
  onChange: (content: string) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  showConfidence?: boolean;
}

/**
 * Spec section list props (for array fields like successCriteria)
 */
export interface SpecSectionListProps {
  items: string[];
  isEditing: boolean;
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdate: (index: number, value: string) => void;
  placeholder?: string;
}

/**
 * Spec preview props (inline in conversation)
 */
export interface SpecPreviewProps {
  spec: Spec | null;
  sections?: SpecSection[];
  readiness?: ReadinessScore;
  onViewSpec?: () => void;
  onEditSpec?: () => void;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Spec workflow badge props
 */
export interface SpecWorkflowBadgeProps {
  state: SpecWorkflowState;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  showActions?: boolean;
  allowedTransitions?: SpecWorkflowState[];
  onTransition?: (newState: SpecWorkflowState) => void;
}

/**
 * Readiness indicator props
 */
export interface ReadinessIndicatorProps {
  score: ReadinessScore;
  onGenerateSpec?: () => void;
  isGenerating?: boolean;
  showBreakdown?: boolean;
}

/**
 * Spec generation progress props
 */
export interface SpecGenerationProgressProps {
  isGenerating: boolean;
  progress?: number;
  currentStep?: string;
  onCancel?: () => void;
}

/**
 * Spec history viewer props
 */
export interface SpecHistoryViewerProps {
  specId: string;
  currentVersion: number;
  onRevert?: (version: number) => Promise<void>;
}

/**
 * Workflow state colors for UI
 */
export const WORKFLOW_STATE_COLORS: Record<
  SpecWorkflowState,
  { bg: string; text: string; border: string }
> = {
  draft: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-300",
  },
  review: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  approved: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
  },
  archived: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
  },
};

/**
 * Section type labels for UI
 */
export const SECTION_TYPE_LABELS: Record<SpecSectionType, string> = {
  problem: "Problem Statement",
  target_users: "Target Users",
  functional_desc: "Functional Description",
  success_criteria: "Success Criteria",
  constraints: "Constraints",
  out_of_scope: "Out of Scope",
  risks: "Risks",
  assumptions: "Assumptions",
};

/**
 * Section type order for display
 */
export const SECTION_TYPE_ORDER: SpecSectionType[] = [
  "problem",
  "target_users",
  "functional_desc",
  "success_criteria",
  "constraints",
  "out_of_scope",
  "risks",
  "assumptions",
];
