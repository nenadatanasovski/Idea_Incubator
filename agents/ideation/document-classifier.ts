/**
 * Document Classifier
 *
 * Classifies documents as required, recommended, or optional based on
 * the current lifecycle stage and phase requirements.
 */

import * as fs from "fs";
import * as path from "path";
import type { LifecycleStage } from "../../utils/schemas.js";
import {
  Classification,
  PHASE_REQUIREMENTS,
  CONTENT_INFERENCE_RULES,
} from "./classification-rules.js";
import { getConfig } from "../../config/index.js";

// ============================================================================
// TYPES
// ============================================================================

export type { Classification };

/**
 * Result of classifying a document.
 */
export interface DocumentClassification {
  /** Relative path to the document within the idea folder */
  path: string;
  /** Classification level */
  classification: Classification;
  /** Reason explaining why this classification was assigned */
  reason?: string;
}

// ============================================================================
// CORE CLASSIFIER
// ============================================================================

/**
 * Classify a document based on the current lifecycle phase.
 *
 * @param ideaSlug - The idea slug (for future extensibility)
 * @param filePath - The document path relative to the idea folder
 * @param phase - The current lifecycle stage
 * @returns The classification: 'required' | 'recommended' | 'optional'
 */
export async function classifyDocument(
  _ideaSlug: string,
  filePath: string,
  phase: LifecycleStage,
): Promise<Classification> {
  // Get phase requirements
  const requirements = PHASE_REQUIREMENTS[phase];
  if (!requirements) {
    // Unknown phase, default to optional
    return "optional";
  }

  // Normalize the file path for comparison (remove leading ./ or /)
  const normalizedPath = filePath.replace(/^\.?\//, "");

  // Check if document is in required list
  if (requirements.required.includes(normalizedPath)) {
    return "required";
  }

  // Check if document is in recommended list
  if (requirements.recommended.includes(normalizedPath)) {
    return "recommended";
  }

  // Default to optional
  return "optional";
}

// ============================================================================
// CLASSIFICATION ORDERING
// ============================================================================

/**
 * Classification priority ordering (higher index = higher priority).
 * Used to determine if one classification "upgrades" another.
 */
const CLASSIFICATION_PRIORITY: Record<Classification, number> = {
  optional: 0,
  recommended: 1,
  required: 2,
};

/**
 * Get the higher priority classification between two.
 */
function getHigherClassification(
  a: Classification,
  b: Classification,
): Classification {
  return CLASSIFICATION_PRIORITY[a] >= CLASSIFICATION_PRIORITY[b] ? a : b;
}

// ============================================================================
// CONTENT INFERENCE CLASSIFIER
// ============================================================================

/**
 * Check if a text contains any of the keywords (case-insensitive).
 */
function containsKeywords(
  text: string,
  keywords: string[],
  matchAll?: boolean,
): boolean {
  const lowerText = text.toLowerCase();

  if (matchAll) {
    return keywords.every((keyword) =>
      lowerText.includes(keyword.toLowerCase()),
    );
  }

  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Classify a document based on lifecycle phase AND conversation context.
 *
 * Content inference can upgrade a classification (optional → recommended → required)
 * but can never downgrade one. Phase rules provide the baseline classification,
 * and content triggers can only increase the priority.
 *
 * @param ideaSlug - The idea slug (for future extensibility)
 * @param filePath - The document path relative to the idea folder
 * @param phase - The current lifecycle stage
 * @param conversationContext - The conversation text to analyze for content triggers
 * @returns The classification: 'required' | 'recommended' | 'optional'
 */
export async function classifyWithContentInference(
  ideaSlug: string,
  filePath: string,
  phase: LifecycleStage,
  conversationContext: string,
): Promise<Classification> {
  // Get baseline classification from phase rules
  let classification = await classifyDocument(ideaSlug, filePath, phase);

  // Normalize the file path for comparison
  const normalizedPath = filePath.replace(/^\.?\//, "");

  // Check content inference rules
  for (const rule of CONTENT_INFERENCE_RULES) {
    // Check if the rule applies to this document
    if (rule.effect.document !== normalizedPath) {
      continue;
    }

    // Check if the conversation contains the trigger keywords
    if (
      containsKeywords(
        conversationContext,
        rule.trigger.keywords,
        rule.trigger.matchAll,
      )
    ) {
      // If the rule specifies a classification, try to upgrade
      if (rule.effect.classification) {
        classification = getHigherClassification(
          classification,
          rule.effect.classification,
        );
      }

      // If the rule only specifies a requirement note (not a classification),
      // and the current classification is 'optional', upgrade to 'recommended'
      if (
        rule.effect.requirement &&
        !rule.effect.classification &&
        classification === "optional"
      ) {
        classification = "recommended";
      }
    }
  }

  return classification;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the root directory for users.
 */
function getUsersRoot(): string {
  const config = getConfig();
  // Users directory is at the same level as ideas directory
  const projectRoot = path.dirname(config.paths.ideas);
  return path.join(projectRoot, "users");
}

/**
 * Get the absolute path to an idea folder.
 */
function getIdeaFolderPath(userSlug: string, ideaSlug: string): string {
  const usersRoot = getUsersRoot();
  return path.resolve(usersRoot, userSlug, "ideas", ideaSlug);
}

/**
 * Recursively find all markdown files in a directory.
 */
function findMarkdownFilesRecursively(
  dir: string,
  baseDir: string,
  excludeDirs: string[] = [".metadata", ".versions"],
): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // Skip excluded directories
      if (excludeDirs.includes(entry.name)) {
        continue;
      }
      // Recurse into subdirectory
      results.push(
        ...findMarkdownFilesRecursively(fullPath, baseDir, excludeDirs),
      );
    } else if (entry.isFile()) {
      // Include markdown files
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".md") {
        results.push(relativePath);
      }
    }
  }

  return results;
}

/**
 * Generate a reason explaining why a document was classified.
 */
function generateClassificationReason(
  filePath: string,
  classification: Classification,
  phase: LifecycleStage,
  wasUpgradedByContent: boolean,
): string {
  const normalizedPath = filePath.replace(/^\.?\//, "");
  const requirements = PHASE_REQUIREMENTS[phase];

  if (classification === "required") {
    if (requirements?.required.includes(normalizedPath)) {
      return `Phase requirement: ${normalizedPath} is required in ${phase} phase`;
    }
    if (wasUpgradedByContent) {
      return `Content inference: upgraded to required based on conversation context`;
    }
    return `Required document for ${phase} phase`;
  }

  if (classification === "recommended") {
    if (requirements?.recommended.includes(normalizedPath)) {
      return `Phase recommendation: ${normalizedPath} is recommended in ${phase} phase`;
    }
    if (wasUpgradedByContent) {
      return `Content inference: upgraded to recommended based on conversation context`;
    }
    return `Recommended document for ${phase} phase`;
  }

  // optional
  return `Optional document: not required for ${phase} phase`;
}

// ============================================================================
// BULK CLASSIFIER
// ============================================================================

/**
 * Classify all documents in an idea folder.
 *
 * Lists all markdown files in the idea folder and classifies each one based on
 * the current lifecycle phase and optional conversation context. Results are
 * sorted by classification priority (required first, then recommended, then optional).
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param phase - The current lifecycle stage
 * @param conversationContext - Optional conversation text for content inference
 * @returns Array of document classifications, sorted by priority
 */
export async function classifyAllDocuments(
  userSlug: string,
  ideaSlug: string,
  phase: LifecycleStage,
  conversationContext?: string,
): Promise<DocumentClassification[]> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);

  // If folder doesn't exist, return empty array
  if (!fs.existsSync(ideaFolder)) {
    return [];
  }

  // Find all markdown files recursively
  const filePaths = findMarkdownFilesRecursively(ideaFolder, ideaFolder);

  const classifications: DocumentClassification[] = [];

  for (const filePath of filePaths) {
    // Get base classification from phase rules
    const baseClassification = await classifyDocument(
      ideaSlug,
      filePath,
      phase,
    );

    let finalClassification: Classification;
    let wasUpgradedByContent = false;

    // If conversation context is provided, apply content inference
    if (conversationContext) {
      finalClassification = await classifyWithContentInference(
        ideaSlug,
        filePath,
        phase,
        conversationContext,
      );
      // Check if content inference upgraded the classification
      wasUpgradedByContent =
        CLASSIFICATION_PRIORITY[finalClassification] >
        CLASSIFICATION_PRIORITY[baseClassification];
    } else {
      finalClassification = baseClassification;
    }

    // Generate reason for the classification
    const reason = generateClassificationReason(
      filePath,
      finalClassification,
      phase,
      wasUpgradedByContent,
    );

    classifications.push({
      path: filePath,
      classification: finalClassification,
      reason,
    });
  }

  // Sort by classification priority (required first, then recommended, then optional)
  classifications.sort((a, b) => {
    const priorityA = CLASSIFICATION_PRIORITY[a.classification];
    const priorityB = CLASSIFICATION_PRIORITY[b.classification];
    // Higher priority (required=2) should come first
    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }
    // Same priority: sort alphabetically by path
    return a.path.localeCompare(b.path);
  });

  return classifications;
}

// ============================================================================
// CLASSIFICATION CACHE
// ============================================================================

/**
 * Structure of the classifications cache file.
 */
export interface ClassificationCache {
  /** ISO timestamp of when the cache was generated */
  timestamp: string;
  /** The lifecycle phase these classifications were generated for */
  phase: LifecycleStage;
  /** The classified documents */
  documents: DocumentClassification[];
}

/**
 * Read the current lifecycle phase from an idea's README.md frontmatter.
 */
async function readCurrentPhase(
  userSlug: string,
  ideaSlug: string,
): Promise<LifecycleStage> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);
  const readmePath = path.join(ideaFolder, "README.md");

  if (!fs.existsSync(readmePath)) {
    return "SPARK"; // Default phase if no README
  }

  try {
    const content = fs.readFileSync(readmePath, "utf-8");
    // Simple YAML frontmatter parsing
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const frontmatter = match[1];
      const phaseMatch = frontmatter.match(/lifecycle_stage:\s*(\w+)/);
      if (phaseMatch) {
        return phaseMatch[1] as LifecycleStage;
      }
    }
  } catch {
    // Fall through to default
  }

  return "SPARK";
}

/**
 * Save classifications to the metadata cache file.
 *
 * Writes the classifications to `.metadata/classifications.json` within the idea folder.
 * The cache includes a timestamp for invalidation purposes and the phase for which
 * the classifications were generated.
 *
 * @param userSlug - The user slug (owner)
 * @param ideaSlug - The idea slug
 * @param classifications - Array of document classifications to save
 */
export async function saveClassifications(
  userSlug: string,
  ideaSlug: string,
  classifications: DocumentClassification[],
): Promise<void> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);
  const metadataDir = path.join(ideaFolder, ".metadata");
  const cacheFilePath = path.join(metadataDir, "classifications.json");

  // Create .metadata directory if it doesn't exist
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  // Read current phase from README.md
  const phase = await readCurrentPhase(userSlug, ideaSlug);

  // Build cache object
  const cache: ClassificationCache = {
    timestamp: new Date().toISOString(),
    phase,
    documents: classifications.map((c) => ({
      path: c.path,
      classification: c.classification,
      reason: c.reason,
    })),
  };

  // Write to file (overwrites existing)
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), "utf-8");
}

// ============================================================================
// CLASSIFICATION CHANGE ANNOUNCEMENTS
// ============================================================================

/**
 * Represents a change in document classification.
 */
export interface ClassificationChange {
  /** The document path that changed classification */
  document: string;
  /** The previous classification */
  oldClassification: Classification;
  /** The new classification */
  newClassification: Classification;
  /** The reason for the change */
  reason: string;
}

/**
 * Generate a natural language announcement for classification changes.
 *
 * Takes an array of classification changes and produces a friendly, natural
 * language announcement that explains the changes and suggests next actions.
 *
 * @param changes - Array of classification changes to announce
 * @returns A natural language announcement string
 */
export function generateClassificationAnnouncement(
  changes: ClassificationChange[],
): string {
  if (changes.length === 0) {
    return "";
  }

  const announcements: string[] = [];

  for (const change of changes) {
    // Extract document name from path (e.g., "research/competitive.md" -> "Competitive Analysis")
    const docName = formatDocumentName(change.document);

    // Generate the announcement based on the classification change
    let announcement: string;

    if (change.newClassification === "required") {
      announcement = `I've marked '${docName}' as **required** - you'll need this for a solid evaluation. ${change.reason}. Would you like me to help create it?`;
    } else if (change.newClassification === "recommended") {
      announcement = `Based on our discussion, I'd now **recommend** creating '${docName}'. ${change.reason}. Should I help you get started?`;
    } else {
      // Downgrade or staying optional
      announcement = `'${docName}' has been updated to ${change.newClassification}. ${change.reason}.`;
    }

    announcements.push(announcement);
  }

  // Combine multiple announcements
  if (announcements.length === 1) {
    return announcements[0];
  }

  // Multiple changes - create a summary
  const intro = `Based on our conversation, I've updated some document recommendations:\n\n`;
  const items = announcements.map((a, i) => `${i + 1}. ${a}`).join("\n");
  const outro = "\n\nWould you like help with any of these documents?";

  return intro + items + outro;
}

/**
 * Format a document path into a human-readable name.
 * e.g., "research/competitive.md" -> "Competitive Analysis"
 *       "target-users.md" -> "Target Users"
 */
function formatDocumentName(documentPath: string): string {
  // Special cases for common documents
  const nameMap: Record<string, string> = {
    "README.md": "Idea Overview",
    "development.md": "Development Notes",
    "evaluation.md": "Evaluation",
    "redteam.md": "Red Team Analysis",
    "target-users.md": "Target Users",
    "research/market.md": "Market Analysis",
    "research/competitive.md": "Competitive Analysis",
    "research/technical.md": "Technical Research",
    "planning/brief.md": "Handoff Brief",
    "planning/investor-pitch.md": "Investor Pitch",
  };

  if (nameMap[documentPath]) {
    return nameMap[documentPath];
  }

  // Extract filename without extension
  const baseName = path.basename(documentPath, ".md");

  // Convert kebab-case or snake_case to Title Case
  return baseName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
