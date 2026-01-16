/**
 * Idea Context Builder
 *
 * Builds layered context for ideation agents, providing structured information
 * about an idea's identity, progress, relationships, and documents.
 */

import * as fs from "fs";
import * as path from "path";
import { getIdeaFolderPath } from "../../utils/folder-structure.js";
import type { IdeaType } from "../../utils/folder-structure.js";
import type { LifecycleStage } from "../../utils/schemas.js";
import { query } from "../../database/db.js";

// ============================================================================
// LAYER 1: IDEA IDENTITY
// ============================================================================

/**
 * Core identity information about an idea.
 * Always loaded, minimal token footprint (~500 tokens max).
 */
export interface IdeaIdentity {
  /** User slug who owns the idea */
  userSlug: string;
  /** Unique slug identifier for the idea */
  ideaSlug: string;
  /** Type of idea: business, feature_internal, feature_external, service, pivot */
  type: IdeaType;
  /** Parent reference for child ideas (features, pivots) */
  parent?: {
    type: "internal" | "external";
    ref: string;
  };
  /** Current lifecycle phase */
  currentPhase: LifecycleStage;
}

// ============================================================================
// LAYER 2: PROGRESS STATE
// ============================================================================

/**
 * Progress tracking information.
 * Always loaded, ~300 tokens.
 */
export interface ProgressState {
  /** Current lifecycle phase */
  phase: LifecycleStage;
  /** Overall completion percentage (0-100) */
  completionPercent: number;
  /** List of documents that are complete */
  documentsComplete: string[];
  /** List of required documents that are missing/incomplete */
  documentsMissing: string[];
  /** Timestamp of last activity */
  lastActivity: Date;
  /** List of identified blockers */
  blockers: string[];
  /** Suggested next action for the user */
  nextRecommendedAction: string;
}

// ============================================================================
// LAYER 3: RELATIONSHIPS
// ============================================================================

/**
 * Relationship information connecting ideas.
 * ~200 tokens.
 */
export interface RelationshipInfo {
  /** Parent idea reference (if this is a child idea) */
  parent?: {
    type: "internal" | "external";
    ref: string;
    title?: string;
  };
  /** Child ideas (features, sub-ideas) */
  children: Array<{
    slug: string;
    title: string;
    type: IdeaType;
  }>;
  /** Integration references to other systems/platforms */
  integrations: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  /** People collaborating on this idea */
  collaborators: Array<{
    name: string;
    role?: string;
  }>;
}

// ============================================================================
// LAYER 4: CORE DOCUMENTS
// ============================================================================

/**
 * Summaries of core documents (README and development).
 * ~1000 tokens max.
 */
export interface CoreDocs {
  /** README.md summary */
  readme: {
    /** Concise summary of the idea (< 500 tokens) */
    summary: string;
    /** Full path to the README.md file */
    fullPath: string;
  };
  /** development.md content */
  development: {
    /** Recent Q&A entries (last 5) */
    recentQA: Array<{
      question: string;
      answer: string;
    }>;
    /** Identified gaps and TODOs */
    gaps: string[];
  };
}

// ============================================================================
// LAYER 5: PHASE DOCUMENTS
// ============================================================================

/**
 * A document loaded based on current phase requirements.
 * Token budget: 5000 tokens total for all phase docs.
 */
export interface PhaseDoc {
  /** Relative path to the document */
  path: string;
  /** Full or summarized content of the document */
  content: string;
  /** Estimated token count for this document */
  tokenCount: number;
}

// ============================================================================
// LAYER 6: AVAILABLE DOCUMENTS INDEX
// ============================================================================

/**
 * Index entry for a document not fully loaded but available.
 * Brief summary for discovery.
 */
export interface AvailableDoc {
  /** Relative path to the document */
  path: string;
  /** Brief summary (1-2 sentences, < 50 tokens) */
  summary: string;
  /** Last updated timestamp */
  lastUpdated: Date;
}

// ============================================================================
// COMPLETE AGENT CONTEXT
// ============================================================================

/**
 * Complete layered context for an ideation agent.
 * Total token budget: < 22000 tokens (leaves room for conversation).
 *
 * Layer breakdown:
 * - idea: ~500 tokens
 * - progress: ~300 tokens
 * - relationships: ~200 tokens
 * - coreDocs: ~1000 tokens
 * - phaseDocs: ~5000 tokens
 * - availableDocuments: ~500 tokens (index only)
 * Total: ~7500 tokens base + conversation buffer
 */
export interface AgentContext {
  /** Layer 1: Core identity information */
  idea: IdeaIdentity;
  /** Layer 2: Progress tracking */
  progress: ProgressState;
  /** Layer 3: Relationship graph */
  relationships: RelationshipInfo;
  /** Layer 4: Core document summaries */
  coreDocs: CoreDocs;
  /** Layer 5: Phase-specific documents (full or summarized) */
  phaseDocs: PhaseDoc[];
  /** Layer 6: Index of available but not loaded documents */
  availableDocuments: AvailableDoc[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate token count for a string.
 * Uses rough approximation: 1 token ≈ 4 characters.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// ============================================================================
// LAYER BUILDERS
// ============================================================================

/**
 * Parse YAML frontmatter from markdown content.
 * Returns an object with the parsed frontmatter fields.
 *
 * @param content - Markdown content with optional frontmatter
 * @returns Parsed frontmatter object
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatterText = frontmatterMatch[1];
  const result: Record<string, unknown> = {};

  // Simple YAML parser for key: value pairs
  const lines = frontmatterText.split("\n");
  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value: unknown = line.substring(colonIndex + 1).trim();

      // Handle quoted strings
      if (
        typeof value === "string" &&
        value.startsWith('"') &&
        value.endsWith('"')
      ) {
        value = value.slice(1, -1);
      }

      // Handle arrays (basic support for single-line arrays like [])
      if (typeof value === "string" && value === "[]") {
        value = [];
      }

      result[key] = value;
    }
  }

  return result;
}

/**
 * Build the identity layer for an idea.
 * Reads from README.md frontmatter and relationships.json.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns IdeaIdentity with all fields populated
 */
export async function buildIdentityLayer(
  userSlug: string,
  ideaSlug: string,
): Promise<IdeaIdentity> {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const readmePath = path.join(ideaPath, "README.md");
  const relationshipsPath = path.join(
    ideaPath,
    ".metadata",
    "relationships.json",
  );

  // Default values
  let type: IdeaType = "business";
  let currentPhase: LifecycleStage = "SPARK";
  let parent: IdeaIdentity["parent"] | undefined;

  // Read README.md for frontmatter
  if (fs.existsSync(readmePath)) {
    try {
      const readmeContent = fs.readFileSync(readmePath, "utf-8");
      const frontmatter = parseFrontmatter(readmeContent);

      // Read idea_type from frontmatter
      if (frontmatter.idea_type && typeof frontmatter.idea_type === "string") {
        const validTypes: IdeaType[] = [
          "business",
          "feature_internal",
          "feature_external",
          "service",
          "pivot",
        ];
        if (validTypes.includes(frontmatter.idea_type as IdeaType)) {
          type = frontmatter.idea_type as IdeaType;
        }
      }

      // Read lifecycle_stage from frontmatter (or 'stage' for compatibility)
      const stageValue = frontmatter.lifecycle_stage || frontmatter.stage;
      if (stageValue && typeof stageValue === "string") {
        const validStages: LifecycleStage[] = [
          "SPARK",
          "CLARIFY",
          "RESEARCH",
          "IDEATE",
          "EVALUATE",
          "VALIDATE",
          "DESIGN",
          "PROTOTYPE",
          "TEST",
          "REFINE",
          "BUILD",
          "LAUNCH",
          "GROW",
          "MAINTAIN",
          "PIVOT",
          "PAUSE",
          "SUNSET",
          "ARCHIVE",
          "ABANDONED",
        ];
        if (validStages.includes(stageValue as LifecycleStage)) {
          currentPhase = stageValue as LifecycleStage;
        }
      }
    } catch {
      // Use defaults if file cannot be read
    }
  }

  // Read relationships.json for parent info
  if (fs.existsSync(relationshipsPath)) {
    try {
      const relationshipsContent = fs.readFileSync(relationshipsPath, "utf-8");
      const relationships = JSON.parse(relationshipsContent);

      // Extract parent info if present
      if (relationships.parent && typeof relationships.parent === "object") {
        const parentData = relationships.parent;
        if (parentData.type && (parentData.slug || parentData.name)) {
          parent = {
            type: parentData.type as "internal" | "external",
            ref: parentData.slug || parentData.name,
          };
        }
      }

      // Also check if idea_type is defined in relationships.json (as backup)
      if (!type && relationships.idea_type) {
        const validTypes: IdeaType[] = [
          "business",
          "feature_internal",
          "feature_external",
          "service",
          "pivot",
        ];
        if (validTypes.includes(relationships.idea_type as IdeaType)) {
          type = relationships.idea_type as IdeaType;
        }
      }
    } catch {
      // Use defaults if file cannot be read or parsed
    }
  }

  return {
    userSlug,
    ideaSlug,
    type,
    parent,
    currentPhase,
  };
}

/**
 * List of required/core documents for an idea folder.
 * Used to track completion progress.
 */
const CORE_DOCUMENTS = [
  "README.md",
  "development.md",
  "problem-solution.md",
  "target-users.md",
  "business-model.md",
  "team.md",
];

/**
 * Phase-specific recommended actions based on lifecycle stage.
 */
const PHASE_RECOMMENDATIONS: Record<LifecycleStage, string> = {
  SPARK:
    "Capture initial idea details in README.md and define the problem statement",
  CLARIFY:
    "Answer clarifying questions in development.md and identify knowledge gaps",
  RESEARCH:
    "Complete market research and competitive analysis in research/ folder",
  IDEATE: "Brainstorm features and solutions, document in development.md",
  EVALUATE: "Run idea evaluation to score against criteria",
  VALIDATE: "Document validation experiments and results in validation/ folder",
  DESIGN: "Create architecture and MVP scope in planning/ folder",
  PROTOTYPE: "Build initial prototype and document in build/ folder",
  TEST: "Run user tests and document results in validation/results.md",
  REFINE: "Iterate based on feedback, update relevant documents",
  BUILD: "Implement full solution, track tasks in build/tasks.md",
  LAUNCH: "Execute launch plan from marketing/launch-plan.md",
  GROW: "Focus on growth metrics and optimization",
  MAINTAIN: "Regular maintenance and incremental improvements",
  PIVOT: "Re-evaluate direction, update README.md with new focus",
  PAUSE: "Document pause reason and re-activation criteria",
  SUNSET: "Document learnings and transition plan",
  ARCHIVE: "Ensure all documentation is complete for reference",
  ABANDONED: "Document why idea was abandoned for future learning",
};

/**
 * Check if a document section is complete by looking for checked checkboxes.
 * Returns number of completed sections and total sections.
 */
function analyzeDocumentCompletion(content: string): {
  completed: number;
  total: number;
} {
  // Count sections marked as "- [x] Defined: Yes" vs "- [ ] Defined: No"
  const checkedPattern = /- \[x\] Defined: Yes/gi;
  const uncheckedPattern = /- \[ \] Defined: No/gi;

  const checkedMatches = content.match(checkedPattern) || [];
  const uncheckedMatches = content.match(uncheckedPattern) || [];

  const completed = checkedMatches.length;
  const total = completed + uncheckedMatches.length;

  return { completed, total };
}

/**
 * Check if a document is a template (not filled in yet).
 * A document is considered a template if it has placeholder patterns.
 */
function isTemplateDocument(content: string): boolean {
  // Check for common template placeholders
  const templatePatterns = [
    /\{\{[^}]+\}\}/, // {{placeholder}}
    /<!-- Agent fills/, // Agent fill markers
    /\*Brief description/, // Default placeholder text
    /\*What problem/, // Default placeholder text
    /\*How does this/, // Default placeholder text
  ];

  // If content has any template patterns and no completed sections, it's a template
  const { completed } = analyzeDocumentCompletion(content);
  const hasTemplatePatterns = templatePatterns.some((p) => p.test(content));

  return hasTemplatePatterns && completed === 0;
}

/**
 * Recursively get all markdown files in a directory.
 */
function getAllMarkdownFiles(dirPath: string, basePath: string = ""): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories
      if (!entry.name.startsWith(".")) {
        files.push(...getAllMarkdownFiles(fullPath, relativePath));
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Get the most recent modification time from a list of files.
 */
function getLatestModificationTime(ideaPath: string, files: string[]): Date {
  let latestTime = new Date(0);

  for (const file of files) {
    const filePath = path.join(ideaPath, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.mtime > latestTime) {
        latestTime = stats.mtime;
      }
    } catch {
      // Ignore errors for files that don't exist
    }
  }

  return latestTime.getTime() === 0 ? new Date() : latestTime;
}

/**
 * Identify blockers based on document state and phase.
 */
function identifyBlockers(
  phase: LifecycleStage,
  documentsMissing: string[],
  completionPercent: number,
): string[] {
  const blockers: string[] = [];

  // Phase-specific blocker detection
  if (phase === "CLARIFY" && documentsMissing.includes("README.md")) {
    blockers.push("README.md needs to be filled before moving to next phase");
  }

  if (
    phase === "RESEARCH" &&
    !documentsMissing.some((d) => d.startsWith("research/"))
  ) {
    // Research phase but no research docs - could be intentional
  } else if (phase === "RESEARCH" && documentsMissing.length > 3) {
    blockers.push("Multiple core documents still need attention");
  }

  if (
    phase === "VALIDATE" &&
    documentsMissing.some((d) => d.startsWith("validation/"))
  ) {
    blockers.push("Validation documents need to be completed");
  }

  if (
    phase === "BUILD" &&
    documentsMissing.some((d) => d.includes("planning/"))
  ) {
    blockers.push("Planning documents should be complete before building");
  }

  // Generic blockers based on completion
  if (
    completionPercent < 20 &&
    !["SPARK", "ABANDONED", "ARCHIVE"].includes(phase)
  ) {
    blockers.push("Very low completion - consider filling core documents");
  }

  return blockers;
}

/**
 * Build the progress layer for an idea.
 * Calculates completion percentage, identifies complete/missing documents,
 * and suggests next actions.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns ProgressState with all fields populated
 */
export async function buildProgressLayer(
  userSlug: string,
  ideaSlug: string,
): Promise<ProgressState> {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const readmePath = path.join(ideaPath, "README.md");

  // Get current phase from README frontmatter
  let phase: LifecycleStage = "SPARK";
  if (fs.existsSync(readmePath)) {
    try {
      const readmeContent = fs.readFileSync(readmePath, "utf-8");
      const frontmatter = parseFrontmatter(readmeContent);
      const stageValue = frontmatter.lifecycle_stage || frontmatter.stage;
      if (stageValue && typeof stageValue === "string") {
        const validStages: LifecycleStage[] = [
          "SPARK",
          "CLARIFY",
          "RESEARCH",
          "IDEATE",
          "EVALUATE",
          "VALIDATE",
          "DESIGN",
          "PROTOTYPE",
          "TEST",
          "REFINE",
          "BUILD",
          "LAUNCH",
          "GROW",
          "MAINTAIN",
          "PIVOT",
          "PAUSE",
          "SUNSET",
          "ARCHIVE",
          "ABANDONED",
        ];
        if (validStages.includes(stageValue as LifecycleStage)) {
          phase = stageValue as LifecycleStage;
        }
      }
    } catch {
      // Use default phase
    }
  }

  // Get all markdown files in the idea folder
  const allFiles = getAllMarkdownFiles(ideaPath);

  // Analyze each document for completion
  const documentsComplete: string[] = [];
  const documentsMissing: string[] = [];
  let totalSections = 0;
  let completedSections = 0;

  for (const file of allFiles) {
    const filePath = path.join(ideaPath, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { completed, total } = analyzeDocumentCompletion(content);

      totalSections += total;
      completedSections += completed;

      // Document is complete if all its sections are checked
      if (total > 0 && completed === total) {
        documentsComplete.push(file);
      } else if (total > 0 && completed < total) {
        // Document has sections but not all are complete
        documentsMissing.push(file);
      } else if (total === 0) {
        // No checkboxes - check if it's a template or has content
        if (isTemplateDocument(content)) {
          documentsMissing.push(file);
        } else if (content.trim().length > 100) {
          // Has substantial content, consider it complete
          documentsComplete.push(file);
        } else {
          documentsMissing.push(file);
        }
      }
    } catch {
      documentsMissing.push(file);
    }
  }

  // Check for core documents that might not exist
  for (const coreDoc of CORE_DOCUMENTS) {
    if (!allFiles.includes(coreDoc)) {
      if (!documentsMissing.includes(coreDoc)) {
        documentsMissing.push(coreDoc);
      }
    }
  }

  // Calculate completion percentage
  // If we have sections, use section completion
  // Otherwise, use document count ratio
  let completionPercent: number;
  if (totalSections > 0) {
    completionPercent = Math.round((completedSections / totalSections) * 100);
  } else {
    const totalDocs = documentsComplete.length + documentsMissing.length;
    completionPercent =
      totalDocs > 0
        ? Math.round((documentsComplete.length / totalDocs) * 100)
        : 0;
  }

  // Ensure percentage is within bounds
  completionPercent = Math.max(0, Math.min(100, completionPercent));

  // Get last activity timestamp
  const lastActivity = getLatestModificationTime(ideaPath, allFiles);

  // Identify blockers
  const blockers = identifyBlockers(phase, documentsMissing, completionPercent);

  // Determine next recommended action
  let nextRecommendedAction =
    PHASE_RECOMMENDATIONS[phase] || "Continue developing your idea";

  // Override with more specific recommendations if needed
  if (documentsMissing.includes("README.md")) {
    nextRecommendedAction =
      "Fill in the README.md with your idea overview and problem statement";
  } else if (
    documentsMissing.includes("problem-solution.md") &&
    ["SPARK", "CLARIFY"].includes(phase)
  ) {
    nextRecommendedAction =
      "Define the problem and solution in problem-solution.md";
  } else if (blockers.length > 0) {
    nextRecommendedAction = `Address blocker: ${blockers[0]}`;
  }

  return {
    phase,
    completionPercent,
    documentsComplete,
    documentsMissing,
    lastActivity,
    blockers,
    nextRecommendedAction,
  };
}

// ============================================================================
// LAYER 3: RELATIONSHIPS
// ============================================================================

/**
 * Relationship data stored in relationships.json file
 */
interface RelationshipsFile {
  idea_type?: string;
  parent?: {
    type?: "internal" | "external";
    slug?: string;
    name?: string;
  } | null;
  integrates_with?: Array<{
    type: string;
    slug?: string;
    name?: string;
    description?: string;
  }>;
  collaboration?: {
    contributors?: Array<{
      name: string;
      role?: string;
    }>;
    ai_suggested_partners?: unknown[];
  };
  ai_detected?: {
    competes_with?: unknown[];
    shares_audience_with?: unknown[];
  };
}

/**
 * Database row for idea relationships
 */
interface IdeaRelationshipRow extends Record<string, unknown> {
  id: string;
  from_user: string;
  from_idea: string;
  to_user: string | null;
  to_idea: string | null;
  to_external: string | null;
  relationship_type: string;
  metadata: string | null;
}

/**
 * Build the relationships layer for an idea.
 * Reads from relationships.json and queries database for children.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns RelationshipInfo with all fields populated
 */
export async function buildRelationshipsLayer(
  userSlug: string,
  ideaSlug: string,
): Promise<RelationshipInfo> {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const relationshipsPath = path.join(
    ideaPath,
    ".metadata",
    "relationships.json",
  );

  // Default values
  let parent: RelationshipInfo["parent"] | undefined;
  const integrations: RelationshipInfo["integrations"] = [];
  const collaborators: RelationshipInfo["collaborators"] = [];

  // Read relationships.json file
  if (fs.existsSync(relationshipsPath)) {
    try {
      const relationshipsContent = fs.readFileSync(relationshipsPath, "utf-8");
      const relationships: RelationshipsFile = JSON.parse(relationshipsContent);

      // Extract parent info
      if (relationships.parent && typeof relationships.parent === "object") {
        const parentData = relationships.parent;
        if (parentData.type && (parentData.slug || parentData.name)) {
          parent = {
            type: parentData.type,
            ref: parentData.slug || parentData.name || "",
            title: parentData.name,
          };
        }
      }

      // Extract integrations
      if (Array.isArray(relationships.integrates_with)) {
        for (const integration of relationships.integrates_with) {
          if (integration && typeof integration === "object") {
            integrations.push({
              name: integration.name || integration.slug || "Unknown",
              type: integration.type || "external",
              description: integration.description,
            });
          }
        }
      }

      // Extract collaborators
      if (
        relationships.collaboration?.contributors &&
        Array.isArray(relationships.collaboration.contributors)
      ) {
        for (const contributor of relationships.collaboration.contributors) {
          if (contributor && typeof contributor === "object") {
            collaborators.push({
              name: contributor.name || "Unknown",
              role: contributor.role,
            });
          }
        }
      }
    } catch {
      // Use defaults if file cannot be read or parsed
    }
  }

  // Query database for children (ideas that have this idea as parent)
  const children: RelationshipInfo["children"] = [];

  try {
    // Find relationships where this idea is the parent
    const childRelationships = await query<IdeaRelationshipRow>(
      `SELECT to_user, to_idea, metadata
       FROM idea_relationships
       WHERE from_user = ? AND from_idea = ? AND relationship_type = 'parent'`,
      [userSlug, ideaSlug],
    );

    for (const row of childRelationships) {
      if (row.to_idea) {
        // Try to get title from metadata or use slug
        let title = row.to_idea;
        let type: IdeaType = "feature_internal";

        if (row.metadata) {
          try {
            const metadata = JSON.parse(row.metadata);
            if (metadata.title) title = metadata.title;
            if (metadata.type) type = metadata.type as IdeaType;
          } catch {
            // Ignore metadata parse errors
          }
        }

        children.push({
          slug: row.to_idea,
          title,
          type,
        });
      }
    }

    // Also check for child relationships (where this idea is the child's target)
    const childRelationships2 = await query<IdeaRelationshipRow>(
      `SELECT from_user, from_idea, metadata
       FROM idea_relationships
       WHERE to_user = ? AND to_idea = ? AND relationship_type = 'child'`,
      [userSlug, ideaSlug],
    );

    for (const row of childRelationships2) {
      if (row.from_idea && !children.some((c) => c.slug === row.from_idea)) {
        let title = row.from_idea;
        let type: IdeaType = "feature_internal";

        if (row.metadata) {
          try {
            const metadata = JSON.parse(row.metadata);
            if (metadata.title) title = metadata.title;
            if (metadata.type) type = metadata.type as IdeaType;
          } catch {
            // Ignore metadata parse errors
          }
        }

        children.push({
          slug: row.from_idea,
          title,
          type,
        });
      }
    }
  } catch {
    // Database query failed - return empty children array
    // This can happen if database is not initialized
  }

  return {
    parent,
    children,
    integrations,
    collaborators,
  };
}

// ============================================================================
// LAYER 4: CORE DOCUMENTS
// ============================================================================

/**
 * Token budget constants for core docs layer
 */
const CORE_DOCS_TOKEN_BUDGET = 1000;
const README_SUMMARY_TOKEN_BUDGET = 500;

/**
 * Extract the summary/overview section from README.md content.
 * Looks for the Overview/Summary section or uses the first few paragraphs.
 *
 * @param content - Full README.md content
 * @returns Summary text, truncated to fit token budget
 */
function extractReadmeSummary(content: string): string {
  // Remove frontmatter
  let cleanContent = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");

  // Try to find Overview or Summary section
  const overviewMatch = cleanContent.match(
    /##?\s*(?:Overview|Summary|About|Description)\s*\n([\s\S]*?)(?=\n##|$)/i,
  );

  let summary: string;

  if (overviewMatch) {
    summary = overviewMatch[1].trim();
  } else {
    // Fall back to first heading content or first few paragraphs
    const titleMatch = cleanContent.match(/^#\s+[^\n]+\n([\s\S]*?)(?=\n##|$)/);
    if (titleMatch) {
      summary = titleMatch[1].trim();
    } else {
      // Just take the first ~500 tokens worth of content
      summary = cleanContent.trim();
    }
  }

  // Clean up markdown formatting for summary
  summary = summary
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
    .replace(/```[\s\S]*?```/g, "[code]") // Replace code blocks
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // Remove inline code backticks
    .replace(/^\s*[-*+]\s*/gm, "• ") // Standardize list items
    .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
    .trim();

  // Truncate to fit token budget (~500 tokens = ~2000 chars)
  const maxChars = README_SUMMARY_TOKEN_BUDGET * 4;
  if (summary.length > maxChars) {
    summary = summary.substring(0, maxChars - 3) + "...";
  }

  return summary || "No summary available.";
}

/**
 * Extract Q&A entries from development.md content.
 * Q&A format expected: "**Q:** question\n**A:** answer" or "### Question\nanswer"
 *
 * @param content - Full development.md content
 * @param maxEntries - Maximum number of entries to return
 * @returns Array of Q&A objects
 */
function extractRecentQA(
  content: string,
  maxEntries: number = 5,
): Array<{ question: string; answer: string }> {
  const qaEntries: Array<{ question: string; answer: string }> = [];

  // Pattern 1: **Q:** / **A:** format
  const qaBoldPattern =
    /\*\*Q(?:uestion)?:\*\*\s*([^\n]+(?:\n(?!\*\*[QA]).*)*)\s*\*\*A(?:nswer)?:\*\*\s*([^\n]+(?:\n(?!\*\*Q).*)*)/gi;
  let match;

  while ((match = qaBoldPattern.exec(content)) !== null) {
    qaEntries.push({
      question: match[1].trim().replace(/\n+/g, " "),
      answer: match[2].trim().replace(/\n+/g, " "),
    });
  }

  // Pattern 2: ### Question heading followed by content
  if (qaEntries.length === 0) {
    const questionHeadingPattern =
      /###\s*([^\n]+\?)\s*\n([\s\S]*?)(?=\n###|\n##|$)/gi;
    while ((match = questionHeadingPattern.exec(content)) !== null) {
      qaEntries.push({
        question: match[1].trim(),
        answer: match[2].trim().replace(/\n+/g, " ").substring(0, 500),
      });
    }
  }

  // Pattern 3: Simple Q: / A: format
  if (qaEntries.length === 0) {
    const simpleQAPattern = /Q:\s*([^\n]+)\s*\nA:\s*([^\n]+(?:\n(?!Q:).*)*)/gi;
    while ((match = simpleQAPattern.exec(content)) !== null) {
      qaEntries.push({
        question: match[1].trim(),
        answer: match[2].trim().replace(/\n+/g, " "),
      });
    }
  }

  // Return the most recent entries (last N)
  return qaEntries.slice(-maxEntries);
}

/**
 * Extract gaps and TODOs from development.md content.
 * Looks for: [ ] unchecked boxes, TODO markers, "Gap:" prefixes, "Missing:" prefixes
 *
 * @param content - Full development.md content
 * @returns Array of identified gaps/todos
 */
function extractGaps(content: string): string[] {
  const gaps: string[] = [];

  // Pattern 1: Unchecked checkboxes [ ]
  const uncheckedPattern = /- \[ \]\s*(.+)/g;
  let match;
  while ((match = uncheckedPattern.exec(content)) !== null) {
    gaps.push(match[1].trim());
  }

  // Pattern 2: TODO markers
  const todoPattern = /TODO[:\s]*(.+)/gi;
  while ((match = todoPattern.exec(content)) !== null) {
    const todo = match[1].trim();
    if (!gaps.includes(todo)) {
      gaps.push(todo);
    }
  }

  // Pattern 3: Gap: or Missing: prefixes
  const gapPattern = /(?:Gap|Missing|Needs|TBD)[:\s]+(.+)/gi;
  while ((match = gapPattern.exec(content)) !== null) {
    const gap = match[1].trim();
    if (!gaps.includes(gap) && gap.length > 0) {
      gaps.push(gap);
    }
  }

  // Pattern 4: Questions without answers (heading ending in ?)
  const unansweredPattern = /###\s*([^\n]+\?)\s*\n\s*(?:\n|$)/g;
  while ((match = unansweredPattern.exec(content)) !== null) {
    const question = `Unanswered: ${match[1].trim()}`;
    if (!gaps.includes(question)) {
      gaps.push(question);
    }
  }

  // Limit to reasonable number and truncate long entries
  return gaps
    .slice(0, 20)
    .map((gap) => (gap.length > 100 ? gap.substring(0, 97) + "..." : gap));
}

/**
 * Summarize content to fit within a token budget.
 * Truncates and adds ellipsis if needed.
 *
 * @param content - Content to summarize
 * @param tokenBudget - Maximum tokens allowed
 * @returns Summarized content
 */
function summarizeToFitBudget(content: string, tokenBudget: number): string {
  const currentTokens = estimateTokens(content);

  if (currentTokens <= tokenBudget) {
    return content;
  }

  // Truncate to fit budget (~4 chars per token)
  const maxChars = tokenBudget * 4;
  return content.substring(0, maxChars - 3) + "...";
}

/**
 * Build the core docs layer for an idea.
 * Reads README.md and development.md, extracts summaries and Q&A.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns CoreDocs with readme and development summaries
 */
export async function buildCoreDocsLayer(
  userSlug: string,
  ideaSlug: string,
): Promise<CoreDocs> {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const readmePath = path.join(ideaPath, "README.md");
  const developmentPath = path.join(ideaPath, "development.md");

  // Initialize with defaults
  const coreDocs: CoreDocs = {
    readme: {
      summary: "No README found.",
      fullPath: readmePath,
    },
    development: {
      recentQA: [],
      gaps: [],
    },
  };

  // Read and process README.md
  if (fs.existsSync(readmePath)) {
    try {
      const readmeContent = fs.readFileSync(readmePath, "utf-8");
      coreDocs.readme.summary = extractReadmeSummary(readmeContent);
    } catch {
      coreDocs.readme.summary = "Error reading README.md";
    }
  }

  // Read and process development.md
  if (fs.existsSync(developmentPath)) {
    try {
      const developmentContent = fs.readFileSync(developmentPath, "utf-8");
      coreDocs.development.recentQA = extractRecentQA(developmentContent, 5);
      coreDocs.development.gaps = extractGaps(developmentContent);
    } catch {
      // Use empty defaults on error
    }
  }

  // Ensure total token budget is respected
  const totalTokens = estimateTokens(JSON.stringify(coreDocs));
  if (totalTokens > CORE_DOCS_TOKEN_BUDGET) {
    // Trim README summary first
    const readmeTokens = estimateTokens(coreDocs.readme.summary);
    if (readmeTokens > README_SUMMARY_TOKEN_BUDGET) {
      coreDocs.readme.summary = summarizeToFitBudget(
        coreDocs.readme.summary,
        README_SUMMARY_TOKEN_BUDGET,
      );
    }

    // Trim Q&A entries if still over budget
    while (
      estimateTokens(JSON.stringify(coreDocs)) > CORE_DOCS_TOKEN_BUDGET &&
      coreDocs.development.recentQA.length > 0
    ) {
      coreDocs.development.recentQA.shift(); // Remove oldest entry
    }

    // Trim gaps if still over budget
    while (
      estimateTokens(JSON.stringify(coreDocs)) > CORE_DOCS_TOKEN_BUDGET &&
      coreDocs.development.gaps.length > 0
    ) {
      coreDocs.development.gaps.pop();
    }
  }

  return coreDocs;
}

// ============================================================================
// LAYER 5: PHASE DOCUMENTS
// ============================================================================

/**
 * Phase document classification rules from priority.json.
 * Maps lifecycle stages to their required/recommended documents.
 */
interface PriorityRules {
  always_show: string[];
  by_phase: Record<string, string[]>;
  recently_updated: string[];
  ai_recommended: string[];
}

/**
 * Default phase priority rules used when priority.json is missing.
 */
const DEFAULT_PRIORITY_RULES: PriorityRules = {
  always_show: ["README.md", "development.md"],
  by_phase: {
    SPARK: ["README.md", "development.md"],
    CLARIFY: [
      "README.md",
      "development.md",
      "target-users.md",
      "problem-solution.md",
    ],
    RESEARCH: [
      "research/market.md",
      "research/competitive.md",
      "research/user-personas.md",
    ],
    IDEATE: ["development.md", "problem-solution.md"],
    EVALUATE: ["analysis/redteam.md", "analysis/risk-mitigation.md"],
    VALIDATE: ["validation/assumptions.md", "validation/results.md"],
    DESIGN: ["planning/brief.md", "planning/architecture.md"],
    PROTOTYPE: ["planning/mvp-scope.md", "build/spec.md"],
    TEST: ["validation/results.md", "build/tasks.md"],
    REFINE: ["development.md", "build/decisions.md"],
    BUILD: ["build/spec.md", "build/tasks.md", "build/decisions.md"],
    LAUNCH: ["marketing/launch-plan.md", "marketing/gtm.md"],
    GROW: ["marketing/channels.md", "networking/opportunities.md"],
    MAINTAIN: ["build/tasks.md", "team.md"],
    PIVOT: ["analysis/redteam.md", "development.md"],
    PAUSE: ["README.md"],
    SUNSET: ["README.md"],
    ARCHIVE: ["README.md"],
    ABANDONED: ["README.md"],
  },
  recently_updated: [],
  ai_recommended: [],
};

/**
 * Token budget for phase docs layer.
 */
const PHASE_DOCS_TOKEN_BUDGET = 5000;

/**
 * Load priority rules from idea's .metadata/priority.json file.
 * Falls back to default rules if file is missing.
 *
 * @param ideaPath - Path to the idea folder
 * @returns Priority rules object
 */
function loadPriorityRules(ideaPath: string): PriorityRules {
  const priorityPath = path.join(ideaPath, ".metadata", "priority.json");

  if (fs.existsSync(priorityPath)) {
    try {
      const content = fs.readFileSync(priorityPath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        always_show: parsed.always_show || DEFAULT_PRIORITY_RULES.always_show,
        by_phase: parsed.by_phase || DEFAULT_PRIORITY_RULES.by_phase,
        recently_updated: parsed.recently_updated || [],
        ai_recommended: parsed.ai_recommended || [],
      };
    } catch {
      return DEFAULT_PRIORITY_RULES;
    }
  }

  return DEFAULT_PRIORITY_RULES;
}

/**
 * Get prioritized document list for a phase.
 * Priority order: always_show > by_phase > recently_updated > ai_recommended
 *
 * @param rules - Priority rules
 * @param phase - Current lifecycle phase
 * @returns Ordered list of document paths
 */
function getPrioritizedDocs(
  rules: PriorityRules,
  phase: LifecycleStage,
): string[] {
  const docs: string[] = [];
  const seen = new Set<string>();

  // 1. Always show docs (highest priority - required)
  for (const doc of rules.always_show) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  // 2. Phase-specific docs (required for current phase)
  const phaseDocs = rules.by_phase[phase] || [];
  for (const doc of phaseDocs) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  // 3. Recently updated docs (recommended)
  for (const doc of rules.recently_updated) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  // 4. AI recommended docs (lowest priority)
  for (const doc of rules.ai_recommended) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  return docs;
}

/**
 * Generate a brief summary of document content.
 * Used for recommended docs to save token budget.
 *
 * @param content - Full document content
 * @param maxTokens - Maximum tokens for summary
 * @returns Brief summary string
 */
function generateDocSummary(content: string, maxTokens: number = 200): string {
  // Remove frontmatter
  let cleanContent = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");

  // Extract title if present
  const titleMatch = cleanContent.match(/^#\s+([^\n]+)/);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Get first substantial paragraph after title
  cleanContent = cleanContent.replace(/^#\s+[^\n]+\n/, "").trim();

  // Find first non-empty paragraph
  const paragraphs = cleanContent
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);
  let summary = paragraphs[0] || "";

  // Clean markdown formatting
  summary = summary
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // Remove inline code backticks
    .replace(/^\s*[-*+]\s*/gm, "") // Remove list markers
    .replace(/\n+/g, " ") // Collapse newlines
    .trim();

  // Prepend title if available
  if (title && !summary.toLowerCase().includes(title.toLowerCase())) {
    summary = `${title}: ${summary}`;
  }

  // Truncate to fit token budget
  const maxChars = maxTokens * 4;
  if (summary.length > maxChars) {
    summary = summary.substring(0, maxChars - 3) + "...";
  }

  return summary || "No content available.";
}

/**
 * Build the phase docs layer for an idea.
 * Loads full content for required docs and summaries for recommended docs,
 * prioritized by classification rules.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param phase - Current lifecycle phase
 * @returns Array of PhaseDoc objects within token budget
 */
export async function buildPhaseDocsLayer(
  userSlug: string,
  ideaSlug: string,
  phase: LifecycleStage,
): Promise<PhaseDoc[]> {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const phaseDocs: PhaseDoc[] = [];
  let totalTokens = 0;

  // Load priority rules
  const rules = loadPriorityRules(ideaPath);

  // Get prioritized document list
  const prioritizedDocs = getPrioritizedDocs(rules, phase);

  // Determine which docs are "required" (always_show + by_phase)
  const requiredDocs = new Set<string>([
    ...rules.always_show,
    ...(rules.by_phase[phase] || []),
  ]);

  // Load documents in priority order
  for (const docPath of prioritizedDocs) {
    const fullPath = path.join(ideaPath, docPath);

    // Skip if file doesn't exist
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const isRequired = requiredDocs.has(docPath);

      let docContent: string;
      let tokenCount: number;

      if (isRequired) {
        // Required docs: load full content (within remaining budget)
        const remainingBudget = PHASE_DOCS_TOKEN_BUDGET - totalTokens;
        const contentTokens = estimateTokens(content);

        if (contentTokens <= remainingBudget) {
          docContent = content;
          tokenCount = contentTokens;
        } else {
          // Truncate to fit remaining budget
          const maxChars = remainingBudget * 4;
          docContent = content.substring(0, maxChars);
          if (docContent.length < content.length) {
            docContent += "\n\n[Content truncated due to token budget]";
          }
          tokenCount = estimateTokens(docContent);
        }
      } else {
        // Recommended docs: load summary only
        const summaryBudget = Math.min(
          200,
          PHASE_DOCS_TOKEN_BUDGET - totalTokens,
        );
        if (summaryBudget <= 0) {
          continue; // No more budget
        }
        docContent = `[Summary] ${generateDocSummary(content, summaryBudget)}`;
        tokenCount = estimateTokens(docContent);
      }

      // Check if we have budget for this document
      if (totalTokens + tokenCount > PHASE_DOCS_TOKEN_BUDGET) {
        // For required docs, truncate; for recommended, skip
        if (isRequired) {
          const remainingBudget = PHASE_DOCS_TOKEN_BUDGET - totalTokens;
          if (remainingBudget > 100) {
            const maxChars = remainingBudget * 4;
            docContent = docContent.substring(0, maxChars) + "\n\n[Truncated]";
            tokenCount = estimateTokens(docContent);
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      phaseDocs.push({
        path: docPath,
        content: docContent,
        tokenCount,
      });

      totalTokens += tokenCount;

      // Stop if we've exhausted the budget
      if (totalTokens >= PHASE_DOCS_TOKEN_BUDGET) {
        break;
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return phaseDocs;
}

// ============================================================================
// LAYER 6: AVAILABLE DOCUMENTS INDEX
// ============================================================================

/**
 * Token budget for individual document summaries in the available docs index.
 * Each summary should be brief (< 50 tokens).
 */
const AVAILABLE_DOC_SUMMARY_TOKEN_BUDGET = 50;

/**
 * Generate a very brief summary for the available docs index.
 * Limited to 1-2 sentences (< 50 tokens).
 *
 * @param content - Full document content
 * @returns Brief summary string (1-2 sentences)
 */
function generateBriefSummary(content: string): string {
  // Remove frontmatter
  let cleanContent = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");

  // Extract title if present
  const titleMatch = cleanContent.match(/^#\s+([^\n]+)/);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Get first substantial paragraph after title
  cleanContent = cleanContent.replace(/^#\s+[^\n]+\n/, "").trim();

  // Find first non-empty paragraph
  const paragraphs = cleanContent
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);
  let summary = paragraphs[0] || "";

  // Clean markdown formatting
  summary = summary
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links but keep text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1)) // Remove inline code backticks
    .replace(/^\s*[-*+]\s*/gm, "") // Remove list markers
    .replace(/\n+/g, " ") // Collapse newlines
    .trim();

  // Get just the first sentence or two
  const sentences = summary.match(/[^.!?]+[.!?]+/g) || [summary];
  summary = sentences.slice(0, 2).join(" ").trim();

  // Prepend title if available and short enough
  if (title && title.length < 40) {
    summary = `${title}: ${summary}`;
  }

  // Truncate to fit token budget (~50 tokens = ~200 chars)
  const maxChars = AVAILABLE_DOC_SUMMARY_TOKEN_BUDGET * 4;
  if (summary.length > maxChars) {
    summary = summary.substring(0, maxChars - 3) + "...";
  }

  return summary || "Document with no summary available.";
}

/**
 * Get file modification time.
 *
 * @param filePath - Path to the file
 * @returns Date object representing last modification time
 */
function getFileModificationTime(filePath: string): Date {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch {
    return new Date(0);
  }
}

/**
 * Build the available documents index for an idea.
 * Lists all documents not included in phase docs with brief summaries.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param excludePaths - Optional array of paths to exclude (e.g., docs already in phaseDocs)
 * @returns Array of AvailableDoc objects sorted by lastUpdated (most recent first)
 */
export async function buildAvailableDocsIndex(
  userSlug: string,
  ideaSlug: string,
  excludePaths: string[] = [],
): Promise<AvailableDoc[]> {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  const availableDocs: AvailableDoc[] = [];

  // Get all markdown files in the idea folder (including subdirectories)
  const allFiles = getAllMarkdownFiles(ideaPath);

  // Create a set of paths to exclude for efficient lookup
  const excludeSet = new Set(excludePaths);

  // Process each file
  for (const filePath of allFiles) {
    // Skip files that are in the exclude list (e.g., already loaded in phaseDocs)
    if (excludeSet.has(filePath)) {
      continue;
    }

    const fullPath = path.join(ideaPath, filePath);

    try {
      // Read file content for summary generation
      const content = fs.readFileSync(fullPath, "utf-8");

      // Generate brief summary
      const summary = generateBriefSummary(content);

      // Get last modification time
      const lastUpdated = getFileModificationTime(fullPath);

      availableDocs.push({
        path: filePath,
        summary,
        lastUpdated,
      });
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  // Sort by lastUpdated (most recent first)
  availableDocs.sort(
    (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime(),
  );

  return availableDocs;
}

// ============================================================================
// FULL CONTEXT BUILDER
// ============================================================================

/**
 * Token budget for complete context.
 * Leaves room for conversation (~8000 tokens for messages).
 */
const TOTAL_CONTEXT_TOKEN_BUDGET = 22000;

/**
 * Build the complete layered context for an idea.
 * Assembles all layers (identity, progress, relationships, coreDocs, phaseDocs, availableDocuments)
 * and ensures the total context stays within token budget.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns Complete AgentContext with all layers populated
 */
export async function buildIdeaContext(
  userSlug: string,
  ideaSlug: string,
): Promise<AgentContext> {
  const startTime = Date.now();

  // Initialize with defaults for graceful error handling
  const context: AgentContext = {
    idea: {
      userSlug,
      ideaSlug,
      type: "business",
      currentPhase: "SPARK",
    },
    progress: {
      phase: "SPARK",
      completionPercent: 0,
      documentsComplete: [],
      documentsMissing: [],
      lastActivity: new Date(),
      blockers: [],
      nextRecommendedAction: "Start capturing your idea",
    },
    relationships: {
      children: [],
      integrations: [],
      collaborators: [],
    },
    coreDocs: {
      readme: {
        summary: "No README found.",
        fullPath: "",
      },
      development: {
        recentQA: [],
        gaps: [],
      },
    },
    phaseDocs: [],
    availableDocuments: [],
  };

  // Token tracking for logging
  const tokenBreakdown: Record<string, number> = {};

  // Layer 1: Build identity layer
  try {
    context.idea = await buildIdentityLayer(userSlug, ideaSlug);
    tokenBreakdown.identity = estimateTokens(JSON.stringify(context.idea));
  } catch (error) {
    console.warn(`[buildIdeaContext] Failed to build identity layer: ${error}`);
    tokenBreakdown.identity = estimateTokens(JSON.stringify(context.idea));
  }

  // Layer 2: Build progress layer
  try {
    context.progress = await buildProgressLayer(userSlug, ideaSlug);
    tokenBreakdown.progress = estimateTokens(JSON.stringify(context.progress));
  } catch (error) {
    console.warn(`[buildIdeaContext] Failed to build progress layer: ${error}`);
    tokenBreakdown.progress = estimateTokens(JSON.stringify(context.progress));
  }

  // Layer 3: Build relationships layer
  try {
    context.relationships = await buildRelationshipsLayer(userSlug, ideaSlug);
    tokenBreakdown.relationships = estimateTokens(
      JSON.stringify(context.relationships),
    );
  } catch (error) {
    console.warn(
      `[buildIdeaContext] Failed to build relationships layer: ${error}`,
    );
    tokenBreakdown.relationships = estimateTokens(
      JSON.stringify(context.relationships),
    );
  }

  // Layer 4: Build core docs layer
  try {
    context.coreDocs = await buildCoreDocsLayer(userSlug, ideaSlug);
    tokenBreakdown.coreDocs = estimateTokens(JSON.stringify(context.coreDocs));
  } catch (error) {
    console.warn(
      `[buildIdeaContext] Failed to build core docs layer: ${error}`,
    );
    tokenBreakdown.coreDocs = estimateTokens(JSON.stringify(context.coreDocs));
  }

  // Layer 5: Build phase docs layer
  try {
    // Use currentPhase from identity layer (which may have been updated from README)
    const phase = context.idea.currentPhase;
    context.phaseDocs = await buildPhaseDocsLayer(userSlug, ideaSlug, phase);
    tokenBreakdown.phaseDocs = context.phaseDocs.reduce(
      (sum, doc) => sum + doc.tokenCount,
      0,
    );
  } catch (error) {
    console.warn(
      `[buildIdeaContext] Failed to build phase docs layer: ${error}`,
    );
    tokenBreakdown.phaseDocs = 0;
  }

  // Layer 6: Build available docs index
  try {
    // Exclude documents already loaded in phaseDocs
    const loadedPaths = context.phaseDocs.map((doc) => doc.path);
    context.availableDocuments = await buildAvailableDocsIndex(
      userSlug,
      ideaSlug,
      loadedPaths,
    );
    tokenBreakdown.availableDocuments = estimateTokens(
      JSON.stringify(context.availableDocuments),
    );
  } catch (error) {
    console.warn(
      `[buildIdeaContext] Failed to build available docs index: ${error}`,
    );
    tokenBreakdown.availableDocuments = 0;
  }

  // Calculate total tokens
  const totalTokens = Object.values(tokenBreakdown).reduce(
    (sum, count) => sum + count,
    0,
  );
  const elapsedTime = Date.now() - startTime;

  // Log token breakdown
  console.log(`[buildIdeaContext] Built context for ${userSlug}/${ideaSlug}:`);
  console.log(`  - Identity layer: ${tokenBreakdown.identity} tokens`);
  console.log(`  - Progress layer: ${tokenBreakdown.progress} tokens`);
  console.log(
    `  - Relationships layer: ${tokenBreakdown.relationships} tokens`,
  );
  console.log(`  - Core docs layer: ${tokenBreakdown.coreDocs} tokens`);
  console.log(`  - Phase docs layer: ${tokenBreakdown.phaseDocs} tokens`);
  console.log(
    `  - Available docs index: ${tokenBreakdown.availableDocuments} tokens`,
  );
  console.log(
    `  Total: ${totalTokens} tokens (budget: ${TOTAL_CONTEXT_TOKEN_BUDGET})`,
  );
  console.log(`  Time: ${elapsedTime}ms`);

  // Warn if over budget
  if (totalTokens > TOTAL_CONTEXT_TOKEN_BUDGET) {
    console.warn(
      `[buildIdeaContext] WARNING: Context exceeds token budget (${totalTokens} > ${TOTAL_CONTEXT_TOKEN_BUDGET})`,
    );
  }

  // Warn if slow
  if (elapsedTime > 2000) {
    console.warn(
      `[buildIdeaContext] WARNING: Context build took ${elapsedTime}ms (target: < 2000ms)`,
    );
  }

  return context;
}
