/**
 * Spec Agent Types
 *
 * Type definitions for the AI-powered technical specification generation agent.
 */

/**
 * Input brief for specification generation
 */
export interface SpecificationBrief {
  /** Task ID this specification is for */
  taskId?: string;
  /** Task display ID (e.g., TASK-025) */
  displayId?: string;
  /** Brief title of what needs to be specified */
  title: string;
  /** Description of the requirement */
  description: string;
  /** Category of work (task, bug, feature, etc.) */
  category?: string;
  /** Any existing context or constraints */
  context?: string;
  /** Related file paths or components */
  relatedFiles?: string[];
  /** Acceptance criteria if already known */
  acceptanceCriteria?: string[];
}

/**
 * Generated technical specification output
 */
export interface TechnicalSpecification {
  /** Title of the specification */
  title: string;
  /** Overview/summary of what needs to be done */
  overview: string;
  /** Detailed requirements */
  requirements: SpecRequirement[];
  /** Technical design approach */
  technicalDesign: TechnicalDesign;
  /** Pass criteria (must be testable) */
  passCriteria: PassCriterion[];
  /** Dependencies and prerequisites */
  dependencies: Dependency[];
  /** Estimated effort */
  effort?: string;
  /** Potential risks or considerations */
  risks?: string[];
  /** Implementation notes */
  notes?: string[];
}

/**
 * A single requirement
 */
export interface SpecRequirement {
  /** Requirement ID (e.g., REQ-1) */
  id: string;
  /** Requirement description */
  description: string;
  /** Priority (must-have, should-have, nice-to-have) */
  priority: "must-have" | "should-have" | "nice-to-have";
  /** Related acceptance criteria indices */
  addressesCriteria?: number[];
}

/**
 * Technical design section
 */
export interface TechnicalDesign {
  /** High-level approach */
  approach: string;
  /** Files to be created */
  filesToCreate?: FileChange[];
  /** Files to be modified */
  filesToModify?: FileChange[];
  /** Key interfaces or types to define */
  keyTypes?: TypeDefinition[];
  /** Architecture patterns to follow */
  patterns?: string[];
  /** Code examples if helpful */
  examples?: CodeExample[];
}

/**
 * File change description
 */
export interface FileChange {
  /** File path */
  path: string;
  /** Description of changes */
  description: string;
  /** Rationale for the change */
  rationale?: string;
}

/**
 * Type definition to create
 */
export interface TypeDefinition {
  /** Type name */
  name: string;
  /** Type description */
  description: string;
  /** Example signature (optional) */
  signature?: string;
}

/**
 * Code example
 */
export interface CodeExample {
  /** Description of what this example shows */
  description: string;
  /** Code snippet */
  code: string;
  /** Language for syntax highlighting */
  language?: string;
}

/**
 * Pass criterion (must be testable)
 */
export interface PassCriterion {
  /** Criterion ID (e.g., PC-1) */
  id: string;
  /** Description of the criterion */
  description: string;
  /** How to test/verify this criterion */
  verificationMethod: string;
  /** Expected outcome */
  expectedOutcome: string;
}

/**
 * Dependency or prerequisite
 */
export interface Dependency {
  /** What is depended upon */
  name: string;
  /** Type of dependency */
  type: "file" | "task" | "service" | "library" | "api";
  /** Description of why it's needed */
  reason: string;
  /** Whether it's optional or required */
  required: boolean;
}

/**
 * Specification breakdown into subtasks
 */
export interface SpecificationBreakdown {
  /** Whether the spec should be broken into subtasks */
  shouldBreakdown: boolean;
  /** Reasoning for the breakdown decision */
  reasoning: string;
  /** Proposed subtasks */
  subtasks: SubtaskProposal[];
  /** Confidence in the breakdown (0-1) */
  confidence: number;
}

/**
 * Proposed subtask from breakdown
 */
export interface SubtaskProposal {
  /** Subtask title */
  title: string;
  /** Description */
  description: string;
  /** Category */
  category?: string;
  /** Effort estimate */
  effort?: string;
  /** Pass criteria for this subtask */
  passCriteria: string[];
  /** File impacts */
  fileImpacts: string[];
  /** Dependencies on other subtasks (by index) */
  dependsOnIndex?: number[];
  /** Rationale for this subtask */
  rationale: string;
}

/**
 * Complete output from spec agent
 */
export interface SpecAgentOutput {
  /** The technical specification */
  specification: TechnicalSpecification;
  /** Optional breakdown into subtasks */
  breakdown?: SpecificationBreakdown;
  /** Token usage */
  tokensUsed: number;
  /** Execution time in ms */
  executionTimeMs: number;
}

/**
 * Options for spec agent
 */
export interface SpecAgentOptions {
  /** Claude model to use (default: claude-opus-4-6) */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Whether to also generate task breakdown */
  includeBreakdown?: boolean;
  /** Max retry attempts for API calls */
  maxRetries?: number;
  /** Base delay for retries in ms */
  baseDelay?: number;
}
