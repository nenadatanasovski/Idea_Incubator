/**
 * Phase Manager
 *
 * Manages lifecycle phase transitions for ideas. Reads and updates
 * phase information from README.md frontmatter and timeline metadata.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { getConfig } from "../../config/index.js";
import type { LifecycleStage } from "../../utils/schemas.js";
import { LifecycleStageSchema } from "../../utils/schemas.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the root directory for users
 */
function getUsersRoot(): string {
  const config = getConfig();
  const projectRoot = path.dirname(config.paths.ideas);
  return path.join(projectRoot, "users");
}

/**
 * Get the path to an idea's README.md file
 */
function getReadmePath(userSlug: string, ideaSlug: string): string {
  const usersRoot = getUsersRoot();
  return path.join(usersRoot, userSlug, "ideas", ideaSlug, "README.md");
}

/**
 * Validate that a stage string is a valid LifecycleStage
 */
function isValidLifecycleStage(stage: string): stage is LifecycleStage {
  const result = LifecycleStageSchema.safeParse(stage);
  return result.success;
}

// ============================================================================
// PHASE MANAGER FUNCTIONS
// ============================================================================

/**
 * Get the current lifecycle phase for an idea.
 *
 * Reads the lifecycle_stage from the idea's README.md frontmatter.
 * Returns 'SPARK' if no phase is set or if the file doesn't exist.
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @returns The current lifecycle stage
 */
export async function getCurrentPhase(
  userSlug: string,
  ideaSlug: string,
): Promise<LifecycleStage> {
  const readmePath = getReadmePath(userSlug, ideaSlug);

  // Handle missing file gracefully
  if (!fs.existsSync(readmePath)) {
    return "SPARK";
  }

  try {
    const raw = fs.readFileSync(readmePath, "utf-8");
    const { data } = matter(raw);

    // Check for lifecycle_stage first (preferred), then stage as fallback
    const stage = data.lifecycle_stage || data.stage;

    if (!stage) {
      return "SPARK";
    }

    // Validate the stage is a valid lifecycle stage
    if (isValidLifecycleStage(stage)) {
      return stage;
    }

    // Invalid stage value - return default
    return "SPARK";
  } catch (error) {
    // Handle parsing errors gracefully
    return "SPARK";
  }
}

// ============================================================================
// TIMELINE HELPERS
// ============================================================================

/**
 * Get the path to an idea's timeline.json file
 */
function getTimelinePath(userSlug: string, ideaSlug: string): string {
  const usersRoot = getUsersRoot();
  return path.join(
    usersRoot,
    userSlug,
    "ideas",
    ideaSlug,
    ".metadata",
    "timeline.json",
  );
}

/**
 * Timeline structure for phase tracking
 */
interface Timeline {
  current_phase: LifecycleStage;
  phase_started: string | null;
  target_dates: Record<string, string>;
}

/**
 * Read the timeline.json file for an idea
 */
function readTimeline(userSlug: string, ideaSlug: string): Timeline {
  const timelinePath = getTimelinePath(userSlug, ideaSlug);

  if (!fs.existsSync(timelinePath)) {
    // Return default timeline if file doesn't exist
    return {
      current_phase: "SPARK",
      phase_started: null,
      target_dates: {},
    };
  }

  try {
    const raw = fs.readFileSync(timelinePath, "utf-8");
    return JSON.parse(raw) as Timeline;
  } catch {
    // Return default timeline on parse error
    return {
      current_phase: "SPARK",
      phase_started: null,
      target_dates: {},
    };
  }
}

/**
 * Write the timeline.json file for an idea
 */
function writeTimeline(
  userSlug: string,
  ideaSlug: string,
  timeline: Timeline,
): void {
  const timelinePath = getTimelinePath(userSlug, ideaSlug);
  const metadataDir = path.dirname(timelinePath);

  // Ensure .metadata directory exists
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2), "utf-8");
}

// ============================================================================
// UPDATE PHASE
// ============================================================================

/**
 * Update the lifecycle phase for an idea.
 *
 * Updates both the README.md frontmatter (lifecycle_stage) and the
 * .metadata/timeline.json file (current_phase and phase_started).
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @param newPhase - The new lifecycle stage to transition to
 * @throws Error if newPhase is not a valid lifecycle stage
 */
export async function updatePhase(
  userSlug: string,
  ideaSlug: string,
  newPhase: LifecycleStage,
): Promise<void> {
  // Validate newPhase is a valid lifecycle stage
  if (!isValidLifecycleStage(newPhase)) {
    throw new Error(`Invalid lifecycle stage: ${newPhase}`);
  }

  const readmePath = getReadmePath(userSlug, ideaSlug);

  // Update README.md frontmatter
  if (fs.existsSync(readmePath)) {
    const raw = fs.readFileSync(readmePath, "utf-8");
    const { data: frontmatter, content } = matter(raw);

    // Update lifecycle_stage while preserving other frontmatter fields
    frontmatter.lifecycle_stage = newPhase;

    // Write back the file with updated frontmatter
    const updatedContent = matter.stringify(content, frontmatter);
    fs.writeFileSync(readmePath, updatedContent, "utf-8");
  } else {
    // Create README.md with minimal frontmatter if it doesn't exist
    const minimalFrontmatter = {
      lifecycle_stage: newPhase,
    };
    const newContent = matter.stringify("", minimalFrontmatter);

    // Ensure the idea directory exists
    const ideaDir = path.dirname(readmePath);
    if (!fs.existsSync(ideaDir)) {
      fs.mkdirSync(ideaDir, { recursive: true });
    }

    fs.writeFileSync(readmePath, newContent, "utf-8");
  }

  // Update timeline.json
  const timeline = readTimeline(userSlug, ideaSlug);
  timeline.current_phase = newPhase;
  timeline.phase_started = new Date().toISOString();
  writeTimeline(userSlug, ideaSlug, timeline);

  // Log phase change
  console.log(
    `[Phase Manager] Phase updated: ${userSlug}/${ideaSlug} -> ${newPhase}`,
  );
}

// ============================================================================
// PHASE TRANSITION READINESS
// ============================================================================

/**
 * Result of a phase transition operation.
 */
export interface TransitionResult {
  /** Whether the transition was successful */
  success: boolean;
  /** The phase before the transition */
  previousPhase: LifecycleStage;
  /** The phase after the transition (same as previousPhase if failed) */
  newPhase: LifecycleStage;
  /** The generated handoff brief (only on success) */
  handoffBrief?: string;
  /** Error message if transition failed */
  error?: string;
}

/**
 * Result of checking if a phase transition is possible.
 */
export interface TransitionCheck {
  /** Whether the transition is allowed */
  canTransition: boolean;
  /** The current lifecycle phase */
  currentPhase: LifecycleStage;
  /** The target lifecycle phase */
  targetPhase: LifecycleStage;
  /** Percentage of required documents that are complete (0-100) */
  completionPercent: number;
  /** List of required documents that are missing or incomplete */
  missingRequired: string[];
  /** List of recommended documents that are incomplete (non-blocking) */
  warnings: string[];
}

/**
 * Lifecycle stage ordering for transition validation.
 * Some transitions are non-linear (e.g., to PIVOT, PAUSE, SUNSET, ARCHIVE, ABANDONED).
 */
const LIFECYCLE_ORDER: LifecycleStage[] = [
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
];

/**
 * Special phases that can be transitioned to from any phase.
 */
const SPECIAL_PHASES: LifecycleStage[] = [
  "PIVOT",
  "PAUSE",
  "SUNSET",
  "ARCHIVE",
  "ABANDONED",
];

/**
 * Check if a target phase is a valid transition from the current phase.
 */
function isValidTransition(
  current: LifecycleStage,
  target: LifecycleStage,
): boolean {
  // Special phases can always be transitioned to
  if (SPECIAL_PHASES.includes(target)) {
    return true;
  }

  // Can't transition to the same phase
  if (current === target) {
    return false;
  }

  // From special phases, can only go to other special phases or SPARK
  if (SPECIAL_PHASES.includes(current)) {
    return target === "SPARK" || SPECIAL_PHASES.includes(target);
  }

  // For normal phases, check ordering (can go forward, or back to earlier phases)
  const currentIndex = LIFECYCLE_ORDER.indexOf(current);
  const targetIndex = LIFECYCLE_ORDER.indexOf(target);

  // If either phase not in order list, allow it (custom handling)
  if (currentIndex === -1 || targetIndex === -1) {
    return true;
  }

  // Allow forward progression or going back
  return true;
}

/**
 * Get the path to an idea folder.
 */
function getIdeaFolderPath(userSlug: string, ideaSlug: string): string {
  const usersRoot = getUsersRoot();
  return path.join(usersRoot, userSlug, "ideas", ideaSlug);
}

/**
 * Check if a document exists and has content (not just frontmatter).
 */
function isDocumentComplete(ideaFolder: string, docPath: string): boolean {
  const fullPath = path.join(ideaFolder, docPath);

  if (!fs.existsSync(fullPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    const { content: bodyContent } = matter(content);

    // Consider document complete if it has more than just whitespace in the body
    const trimmedContent = bodyContent.trim();
    return trimmedContent.length > 0;
  } catch {
    return false;
  }
}

/**
 * Import PHASE_REQUIREMENTS dynamically to avoid circular dependency issues.
 */
async function getPhaseRequirements(): Promise<
  Record<LifecycleStage, { required: string[]; recommended: string[] }>
> {
  const { PHASE_REQUIREMENTS } = await import("./classification-rules.js");
  return PHASE_REQUIREMENTS;
}

/**
 * Check if an idea is ready to transition to a target phase.
 *
 * This function checks:
 * 1. If required documents for the current phase are complete
 * 2. If recommended documents are incomplete (as warnings)
 * 3. If the target phase is a valid transition from current
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @param targetPhase - The phase to transition to
 * @returns TransitionCheck with readiness status and blockers
 */
export async function canTransitionTo(
  userSlug: string,
  ideaSlug: string,
  targetPhase: LifecycleStage,
): Promise<TransitionCheck> {
  // Get current phase
  const currentPhase = await getCurrentPhase(userSlug, ideaSlug);

  // Initialize result
  const result: TransitionCheck = {
    canTransition: true,
    currentPhase,
    targetPhase,
    completionPercent: 100,
    missingRequired: [],
    warnings: [],
  };

  // Validate target phase is a valid lifecycle stage
  if (!isValidLifecycleStage(targetPhase)) {
    result.canTransition = false;
    result.warnings.push(`Invalid target phase: ${targetPhase}`);
    return result;
  }

  // Check if transition is valid
  if (!isValidTransition(currentPhase, targetPhase)) {
    result.canTransition = false;
    result.warnings.push(
      `Cannot transition from ${currentPhase} to ${targetPhase}`,
    );
    return result;
  }

  // Get phase requirements
  const phaseRequirements = await getPhaseRequirements();
  const requirements = phaseRequirements[currentPhase];

  if (!requirements) {
    // Unknown phase, allow transition
    return result;
  }

  // Get idea folder path
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);

  // Check required documents
  const totalRequired = requirements.required.length;
  let completedRequired = 0;

  for (const doc of requirements.required) {
    if (isDocumentComplete(ideaFolder, doc)) {
      completedRequired++;
    } else {
      result.missingRequired.push(doc);
    }
  }

  // Check recommended documents (for warnings)
  for (const doc of requirements.recommended) {
    if (!isDocumentComplete(ideaFolder, doc)) {
      result.warnings.push(`Recommended document incomplete: ${doc}`);
    }
  }

  // Calculate completion percentage
  if (totalRequired > 0) {
    result.completionPercent = Math.round(
      (completedRequired / totalRequired) * 100,
    );
  }

  // Set canTransition based on required documents
  if (result.missingRequired.length > 0) {
    result.canTransition = false;
  }

  return result;
}

// ============================================================================
// PHASE TRANSITION EXECUTION
// ============================================================================

/**
 * Generate a simple handoff brief for phase transitions.
 * This is a stub implementation - the full version is in handoff-generator.ts (TEST-PH-011)
 */
async function generateSimpleHandoffBrief(
  userSlug: string,
  ideaSlug: string,
  fromPhase: LifecycleStage,
  toPhase: LifecycleStage,
): Promise<string> {
  const timestamp = new Date().toISOString();

  // Try to import the handoff generator if it exists
  // Using dynamic path to avoid compile-time module resolution errors
  try {
    // Get the directory of current file using import.meta.url (ESM compatible)
    const currentFileUrl = import.meta.url;
    const currentDir = path.dirname(currentFileUrl.replace("file://", ""));
    const handoffGeneratorPath = path.join(currentDir, "handoff-generator.js");

    if (fs.existsSync(handoffGeneratorPath)) {
      // Dynamic import using file URL for ESM compatibility
      const handoffModule = await import("./handoff-generator.js" as string);
      if (
        handoffModule &&
        typeof handoffModule.generateHandoffBrief === "function"
      ) {
        return await handoffModule.generateHandoffBrief(
          userSlug,
          ideaSlug,
          fromPhase,
          toPhase,
        );
      }
    }
  } catch {
    // Fall through to default brief
  }

  // Default simple brief if handoff-generator doesn't exist yet
  return `# Handoff Brief

**Idea**: ${ideaSlug}
**Transition**: ${fromPhase} → ${toPhase}
**Date**: ${timestamp}

## Summary

This idea has transitioned from the ${fromPhase} phase to the ${toPhase} phase.

## What's Complete

- Phase ${fromPhase} requirements met

## What's Incomplete

- Review recommended documents for ${toPhase} phase

## Key Insights for Next Phase

- Proceed with ${toPhase} phase activities

## AI Recommendation

**Confidence**: Medium

Continue with the ${toPhase} phase activities.

---

*Generated automatically during phase transition*
`;
}

/**
 * Execute a phase transition for an idea.
 *
 * This function:
 * 1. Checks if the transition is allowed (unless force=true)
 * 2. Updates the phase if allowed
 * 3. Generates a handoff brief on success
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @param targetPhase - The phase to transition to
 * @param force - If true, skip readiness checks and force the transition
 * @returns TransitionResult with success status and handoff brief
 */
export async function transitionPhase(
  userSlug: string,
  ideaSlug: string,
  targetPhase: LifecycleStage,
  force?: boolean,
): Promise<TransitionResult> {
  // Get current phase first
  const previousPhase = await getCurrentPhase(userSlug, ideaSlug);

  // Initialize result
  const result: TransitionResult = {
    success: false,
    previousPhase,
    newPhase: previousPhase, // Will be updated on success
  };

  // Check readiness unless force is true
  if (!force) {
    const readinessCheck = await canTransitionTo(
      userSlug,
      ideaSlug,
      targetPhase,
    );

    if (!readinessCheck.canTransition) {
      result.error = `Cannot transition to ${targetPhase}. Missing required documents: ${readinessCheck.missingRequired.join(", ") || "Unknown reason"}`;
      if (readinessCheck.warnings.length > 0) {
        result.error += `. Warnings: ${readinessCheck.warnings.join(", ")}`;
      }
      return result;
    }
  }

  try {
    // Update the phase
    await updatePhase(userSlug, ideaSlug, targetPhase);

    // Generate handoff brief
    const handoffBrief = await generateSimpleHandoffBrief(
      userSlug,
      ideaSlug,
      previousPhase,
      targetPhase,
    );

    // Update result on success
    result.success = true;
    result.newPhase = targetPhase;
    result.handoffBrief = handoffBrief;

    console.log(
      `[Phase Manager] Phase transition complete: ${userSlug}/${ideaSlug} ${previousPhase} -> ${targetPhase}`,
    );

    return result;
  } catch (error) {
    result.error = `Failed to transition phase: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
}
