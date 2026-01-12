/**
 * Context Primer Types
 *
 * Types for loading and managing context for code generation tasks.
 */

/**
 * A file loaded as context
 */
export interface ContextFile {
  path: string;
  content: string;
  relevance: number;
}

/**
 * Primed context for a task
 */
export interface PrimedContext {
  claudeMd: string;
  relatedFiles: ContextFile[];
  gotchas: string[];
  taskRequirements: string[];
  tokenEstimate: number;
}

/**
 * Options for context primer
 */
export interface ContextPrimerConfig {
  tokenLimit?: number;
  projectRoot?: string;
  maxRelatedFiles?: number;
  includeTestFiles?: boolean;
}

/**
 * Result of loading context
 */
export interface LoadContextResult {
  success: boolean;
  context?: PrimedContext;
  error?: string;
  warnings?: string[];
}

/**
 * File relevance scoring
 */
export interface RelevanceScore {
  filePath: string;
  score: number;
  reasons: string[];
}
