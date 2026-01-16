/**
 * Handoff Generator
 *
 * Generates structured handoff briefs when transitioning between lifecycle phases.
 * Extracts key insights from completed documents and provides recommendations.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { getConfig } from "../../config/index.js";
import type { LifecycleStage } from "../../utils/schemas.js";
import { PHASE_REQUIREMENTS } from "./classification-rules.js";
import { type DocumentClassification } from "./document-classifier.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Key insight extracted from idea documents.
 */
export interface Insight {
  /** Category of the insight */
  category: "market" | "competition" | "users" | "risk" | "technical" | "other";
  /** Summary text of the insight */
  summary: string;
  /** Source file path where the insight was extracted from */
  source: string;
  /** Confidence level of the insight */
  confidence: "high" | "medium" | "low";
}

/**
 * Confidence score breakdown for phase transitions.
 */
export interface ConfidenceScore {
  /** Overall confidence percentage (0-100) */
  overall: number;
  /** Breakdown of confidence components */
  breakdown: {
    /** Percentage of documents completed */
    documentCompleteness: number;
    /** Quality score based on content depth */
    dataQuality: number;
    /** Validation status score */
    validationStatus: number;
  };
  /** Evaluation criteria that may be impacted by missing data */
  affectedCriteria: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the root directory for users.
 */
function getUsersRoot(): string {
  const config = getConfig();
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
 * Check if a document exists and has content.
 */
function isDocumentComplete(ideaFolder: string, docPath: string): boolean {
  const fullPath = path.join(ideaFolder, docPath);

  if (!fs.existsSync(fullPath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    const { content: bodyContent } = matter(content);
    const trimmedContent = bodyContent.trim();
    return trimmedContent.length > 0;
  } catch {
    return false;
  }
}

/**
 * Read and parse a markdown document.
 */
function readDocument(
  ideaFolder: string,
  docPath: string,
): { content: string; frontmatter: Record<string, unknown> } | null {
  const fullPath = path.join(ideaFolder, docPath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { content, data } = matter(raw);
    return { content, frontmatter: data };
  } catch {
    return null;
  }
}

/**
 * Count occurrences of a pattern in text.
 */
function countPattern(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

// ============================================================================
// KEY INSIGHTS EXTRACTION
// ============================================================================

/**
 * Extract key insights from an idea's documents.
 *
 * Scans completed documents for key data points including:
 * - Market size from market.md
 * - Competitor count from competitive.md
 * - User segments from target-users.md
 * - Risks from various analysis documents
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @returns Array of extracted insights
 */
export async function extractKeyInsights(
  userSlug: string,
  ideaSlug: string,
): Promise<Insight[]> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);
  const insights: Insight[] = [];

  // Check if folder exists
  if (!fs.existsSync(ideaFolder)) {
    return insights;
  }

  // Extract market insights from market.md
  const marketDoc = readDocument(ideaFolder, "research/market.md");
  if (marketDoc && marketDoc.content.trim()) {
    // Look for market size mentions
    const marketSizePatterns = [
      /market size[:\s]+[\$]?[\d.,]+\s*(M|B|K|million|billion|thousand)?/gi,
      /TAM[:\s]+[\$]?[\d.,]+\s*(M|B|K|million|billion|thousand)?/gi,
      /total addressable market[:\s]+[\$]?[\d.,]+\s*(M|B|K|million|billion|thousand)?/gi,
    ];

    for (const pattern of marketSizePatterns) {
      const match = marketDoc.content.match(pattern);
      if (match) {
        insights.push({
          category: "market",
          summary: `Market size mentioned: ${match[0]}`,
          source: "research/market.md",
          confidence: "medium",
        });
        break;
      }
    }

    // Generic market insight if content exists but no size found
    if (
      !insights.some(
        (i) => i.category === "market" && i.source === "research/market.md",
      )
    ) {
      insights.push({
        category: "market",
        summary: "Market research documented",
        source: "research/market.md",
        confidence: "low",
      });
    }
  }

  // Extract competition insights from competitive.md
  const competitiveDoc = readDocument(ideaFolder, "research/competitive.md");
  if (competitiveDoc && competitiveDoc.content.trim()) {
    // Count competitor mentions (look for headers or bullet points mentioning competitors)
    const competitorPatterns = [
      /#+\s+(?:competitor|alternative|rival)/gi,
      /^\s*[-*]\s+(?:[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/gm, // Bullet points with capitalized names
    ];

    let competitorCount = 0;
    for (const pattern of competitorPatterns) {
      competitorCount += countPattern(competitiveDoc.content, pattern);
    }

    if (competitorCount > 0) {
      insights.push({
        category: "competition",
        summary: `${competitorCount} potential competitor${competitorCount > 1 ? "s" : ""} identified`,
        source: "research/competitive.md",
        confidence: competitorCount >= 3 ? "high" : "medium",
      });
    } else {
      insights.push({
        category: "competition",
        summary: "Competitive analysis documented",
        source: "research/competitive.md",
        confidence: "low",
      });
    }
  }

  // Extract user insights from target-users.md
  const usersDoc = readDocument(ideaFolder, "target-users.md");
  if (usersDoc && usersDoc.content.trim()) {
    // Look for user segment patterns
    const segmentPatterns = [
      /#+\s+(?:segment|persona|user type|customer profile)/gi,
      /(?:primary|secondary|tertiary)\s+(?:user|customer|audience)/gi,
    ];

    let segmentCount = 0;
    for (const pattern of segmentPatterns) {
      segmentCount += countPattern(usersDoc.content, pattern);
    }

    if (segmentCount > 0) {
      insights.push({
        category: "users",
        summary: `${segmentCount} user segment${segmentCount > 1 ? "s" : ""} defined`,
        source: "target-users.md",
        confidence: segmentCount >= 2 ? "high" : "medium",
      });
    } else {
      insights.push({
        category: "users",
        summary: "Target users documented",
        source: "target-users.md",
        confidence: "low",
      });
    }
  }

  // Extract risk insights from various analysis files
  const riskDocs = [
    "analysis/redteam.md",
    "analysis/risk-mitigation.md",
    "evaluation.md",
  ];

  for (const docPath of riskDocs) {
    const riskDoc = readDocument(ideaFolder, docPath);
    if (riskDoc && riskDoc.content.trim()) {
      // Look for risk mentions
      const riskPatterns = [
        /#+\s+(?:risk|threat|vulnerability|challenge)/gi,
        /(?:high|critical|major)\s+risk/gi,
      ];

      let riskCount = 0;
      for (const pattern of riskPatterns) {
        riskCount += countPattern(riskDoc.content, pattern);
      }

      if (riskCount > 0) {
        insights.push({
          category: "risk",
          summary: `${riskCount} risk${riskCount > 1 ? "s" : ""} documented in ${docPath}`,
          source: docPath,
          confidence: "medium",
        });
      }
    }
  }

  // Extract technical insights
  const technicalDocs = ["planning/architecture.md", "build/spec.md"];

  for (const docPath of technicalDocs) {
    const techDoc = readDocument(ideaFolder, docPath);
    if (techDoc && techDoc.content.trim()) {
      insights.push({
        category: "technical",
        summary: `Technical documentation in ${docPath}`,
        source: docPath,
        confidence: "medium",
      });
    }
  }

  return insights;
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Criteria mapping for affected criteria calculation.
 */
const DOCUMENT_TO_CRITERIA: Record<string, string[]> = {
  "research/market.md": ["Market Size (MK1)", "Market Growth (MK2)"],
  "research/competitive.md": ["Competition (MK3)", "Solution Uniqueness (SL3)"],
  "target-users.md": ["Target User (PR3)", "Problem Clarity (PR1)"],
  "validation/assumptions.md": [
    "Problem Validation (PR4)",
    "Solution Feasibility (SL2)",
  ],
  "analysis/redteam.md": ["Execution Risk (RS1)", "Market Risk (RS2)"],
  "planning/architecture.md": [
    "Technical Feasibility (FS1)",
    "Technical Risk (RS3)",
  ],
  "planning/mvp-scope.md": [
    "Time to Value (FS4)",
    "Resource Requirements (FS2)",
  ],
};

/**
 * Calculate the confidence score for transitioning to a target phase.
 *
 * Weights completion of different document types and factors in quality
 * indicators like section fill rate and content depth.
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @param targetPhase - The lifecycle stage being transitioned to
 * @returns Confidence score with breakdown
 */
export async function calculateConfidence(
  userSlug: string,
  ideaSlug: string,
  targetPhase: LifecycleStage,
): Promise<ConfidenceScore> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);

  // Initialize result
  const result: ConfidenceScore = {
    overall: 0,
    breakdown: {
      documentCompleteness: 0,
      dataQuality: 0,
      validationStatus: 0,
    },
    affectedCriteria: [],
  };

  // Check if folder exists
  if (!fs.existsSync(ideaFolder)) {
    return result;
  }

  // Get phase requirements
  const requirements = PHASE_REQUIREMENTS[targetPhase];
  if (!requirements) {
    return result;
  }

  // Calculate document completeness
  const allDocs = [...requirements.required, ...requirements.recommended];
  const totalDocs = allDocs.length;
  let completedDocs = 0;
  let totalQualityScore = 0;

  for (const doc of allDocs) {
    if (isDocumentComplete(ideaFolder, doc)) {
      completedDocs++;

      // Calculate quality score for this document
      const docData = readDocument(ideaFolder, doc);
      if (docData) {
        const contentLength = docData.content.trim().length;
        // Quality based on content length (up to 100 for 2000+ chars)
        const lengthScore = Math.min(100, (contentLength / 2000) * 100);
        totalQualityScore += lengthScore;
      }
    } else {
      // Add affected criteria for missing documents
      const criteria = DOCUMENT_TO_CRITERIA[doc];
      if (criteria) {
        result.affectedCriteria.push(...criteria);
      }
    }
  }

  // Calculate completeness percentage
  if (totalDocs > 0) {
    result.breakdown.documentCompleteness = Math.round(
      (completedDocs / totalDocs) * 100,
    );
    result.breakdown.dataQuality =
      completedDocs > 0 ? Math.round(totalQualityScore / completedDocs) : 0;
  } else {
    result.breakdown.documentCompleteness = 100; // No docs required
  }

  // Validation status - check if validation documents exist
  const validationDocs = ["validation/assumptions.md", "validation/results.md"];
  let validationComplete = 0;
  for (const doc of validationDocs) {
    if (isDocumentComplete(ideaFolder, doc)) {
      validationComplete++;
    }
  }
  result.breakdown.validationStatus = Math.round(
    (validationComplete / validationDocs.length) * 100,
  );

  // Calculate overall score (weighted average)
  // Document completeness: 50%, Data quality: 30%, Validation: 20%
  result.overall = Math.round(
    result.breakdown.documentCompleteness * 0.5 +
      result.breakdown.dataQuality * 0.3 +
      result.breakdown.validationStatus * 0.2,
  );

  // Ensure overall is within 0-100
  result.overall = Math.max(0, Math.min(100, result.overall));

  // Deduplicate affected criteria
  result.affectedCriteria = [...new Set(result.affectedCriteria)];

  return result;
}

// ============================================================================
// HANDOFF BRIEF GENERATION
// ============================================================================

/**
 * Generate a structured handoff brief for a phase transition.
 *
 * Creates a markdown document summarizing:
 * - What's complete (with key data points)
 * - What's incomplete
 * - Key insights for the next phase
 * - AI recommendation with confidence score
 * - Decision checkboxes
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @param fromPhase - The phase being transitioned from
 * @param toPhase - The phase being transitioned to
 * @returns Markdown string with the handoff brief
 */
export async function generateHandoffBrief(
  userSlug: string,
  ideaSlug: string,
  fromPhase: LifecycleStage,
  toPhase: LifecycleStage,
): Promise<string> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);
  const timestamp = new Date().toISOString();
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Separate complete and incomplete documents
  const completeRequired: DocumentClassification[] = [];
  const completeRecommended: DocumentClassification[] = [];
  const incompleteRequired: string[] = [];
  const incompleteRecommended: string[] = [];

  const requirements = PHASE_REQUIREMENTS[fromPhase];
  if (requirements) {
    for (const doc of requirements.required) {
      if (isDocumentComplete(ideaFolder, doc)) {
        completeRequired.push({
          path: doc,
          classification: "required",
          reason: "Phase requirement",
        });
      } else {
        incompleteRequired.push(doc);
      }
    }

    for (const doc of requirements.recommended) {
      if (isDocumentComplete(ideaFolder, doc)) {
        completeRecommended.push({
          path: doc,
          classification: "recommended",
          reason: "Phase recommendation",
        });
      } else {
        incompleteRecommended.push(doc);
      }
    }
  }

  // Extract key insights
  const insights = await extractKeyInsights(userSlug, ideaSlug);

  // Calculate confidence
  const confidence = await calculateConfidence(userSlug, ideaSlug, toPhase);

  // Build the handoff brief
  const sections: string[] = [];

  // Header
  sections.push(`# Handoff Brief`);
  sections.push("");
  sections.push(`**Idea**: ${ideaSlug}`);
  sections.push(`**Transition**: ${fromPhase} \u2192 ${toPhase}`);
  sections.push(`**Date**: ${date}`);
  sections.push("");

  // What's Complete section
  sections.push(`## What's Complete`);
  sections.push("");

  if (completeRequired.length > 0 || completeRecommended.length > 0) {
    if (completeRequired.length > 0) {
      sections.push("### Required Documents");
      for (const doc of completeRequired) {
        sections.push(`- \u2713 ${doc.path}`);
      }
      sections.push("");
    }

    if (completeRecommended.length > 0) {
      sections.push("### Recommended Documents");
      for (const doc of completeRecommended) {
        sections.push(`- \u2713 ${doc.path}`);
      }
      sections.push("");
    }

    // Add key data points from insights
    if (insights.length > 0) {
      sections.push("### Key Data Points");
      for (const insight of insights.slice(0, 5)) {
        // Limit to 5 insights
        sections.push(
          `- **${insight.category}**: ${insight.summary} (${insight.confidence} confidence)`,
        );
      }
      sections.push("");
    }
  } else {
    sections.push("No documents completed yet.");
    sections.push("");
  }

  // What's Incomplete section
  sections.push(`## What's Incomplete`);
  sections.push("");

  if (incompleteRequired.length > 0 || incompleteRecommended.length > 0) {
    if (incompleteRequired.length > 0) {
      sections.push("### Missing Required Documents");
      for (const doc of incompleteRequired) {
        sections.push(`- \u2717 ${doc}`);
      }
      sections.push("");
    }

    if (incompleteRecommended.length > 0) {
      sections.push("### Missing Recommended Documents");
      for (const doc of incompleteRecommended) {
        sections.push(`- \u2717 ${doc}`);
      }
      sections.push("");
    }
  } else {
    sections.push("All documents complete!");
    sections.push("");
  }

  // Key Insights for Next Phase
  sections.push(`## Key Insights for Next Phase`);
  sections.push("");

  const nextPhaseRequirements = PHASE_REQUIREMENTS[toPhase];
  if (nextPhaseRequirements) {
    sections.push(`In the **${toPhase}** phase, you'll need to focus on:`);
    sections.push("");

    if (nextPhaseRequirements.required.length > 0) {
      sections.push("**Required:**");
      for (const doc of nextPhaseRequirements.required) {
        const isComplete = isDocumentComplete(ideaFolder, doc);
        sections.push(`- ${isComplete ? "\u2713" : "\u25CB"} ${doc}`);
      }
      sections.push("");
    }

    if (nextPhaseRequirements.recommended.length > 0) {
      sections.push("**Recommended:**");
      for (const doc of nextPhaseRequirements.recommended) {
        const isComplete = isDocumentComplete(ideaFolder, doc);
        sections.push(`- ${isComplete ? "\u2713" : "\u25CB"} ${doc}`);
      }
      sections.push("");
    }
  } else {
    sections.push("Focus on the core requirements of this phase.");
    sections.push("");
  }

  // AI Recommendation section
  sections.push(`## AI Recommendation`);
  sections.push("");

  // Determine confidence level
  let confidenceLevel: string;
  if (confidence.overall >= 80) {
    confidenceLevel = "High";
  } else if (confidence.overall >= 50) {
    confidenceLevel = "Medium";
  } else {
    confidenceLevel = "Low";
  }

  sections.push(
    `**Confidence Score**: ${confidence.overall}% (${confidenceLevel})`,
  );
  sections.push("");
  sections.push("**Score Breakdown:**");
  sections.push(
    `- Document Completeness: ${confidence.breakdown.documentCompleteness}%`,
  );
  sections.push(`- Data Quality: ${confidence.breakdown.dataQuality}%`);
  sections.push(
    `- Validation Status: ${confidence.breakdown.validationStatus}%`,
  );
  sections.push("");

  if (confidence.affectedCriteria.length > 0) {
    sections.push("**Criteria with Incomplete Data:**");
    for (const criteria of confidence.affectedCriteria) {
      sections.push(`- ${criteria}`);
    }
    sections.push("");
  }

  // Recommendation text
  if (confidence.overall >= 80) {
    sections.push(
      `**Recommendation**: Proceed with the ${toPhase} phase. You have strong documentation and data to support this transition.`,
    );
  } else if (confidence.overall >= 50) {
    sections.push(
      `**Recommendation**: You can proceed to ${toPhase}, but consider completing the missing recommended documents for better outcomes.`,
    );
  } else {
    sections.push(
      `**Recommendation**: Consider completing more documentation before transitioning. Key areas need attention for a successful ${toPhase} phase.`,
    );
  }
  sections.push("");

  // Decision checkboxes
  sections.push(`## Decision`);
  sections.push("");
  sections.push("- [ ] Proceed to " + toPhase + " phase");
  sections.push("- [ ] Complete missing documents first");
  sections.push("- [ ] Revisit " + fromPhase + " phase activities");
  sections.push("");
  sections.push("---");
  sections.push("");
  sections.push(
    `*Generated automatically during phase transition at ${timestamp}*`,
  );

  return sections.join("\n");
}

// ============================================================================
// SAVE HANDOFF BRIEF
// ============================================================================

/**
 * Save a handoff brief to the planning directory.
 *
 * Saves the brief to `planning/brief.md` with frontmatter containing
 * generation metadata including timestamp and phase information.
 *
 * @param userSlug - The user's slug identifier
 * @param ideaSlug - The idea's slug identifier
 * @param brief - The handoff brief markdown content
 * @returns The relative file path where the brief was saved
 */
export async function saveHandoffBrief(
  userSlug: string,
  ideaSlug: string,
  brief: string,
): Promise<string> {
  const ideaFolder = getIdeaFolderPath(userSlug, ideaSlug);
  const planningDir = path.join(ideaFolder, "planning");
  const briefPath = path.join(planningDir, "brief.md");
  const relativePath = "planning/brief.md";

  // Create planning directory if it doesn't exist
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  // Extract phase info from brief content
  const fromPhaseMatch = brief.match(
    /\*\*Transition\*\*:\s*(\w+)\s*\u2192\s*(\w+)/,
  );
  const fromPhase = fromPhaseMatch ? fromPhaseMatch[1] : "UNKNOWN";
  const toPhase = fromPhaseMatch ? fromPhaseMatch[2] : "UNKNOWN";

  // Generate unique ID
  const id = `brief-${Date.now()}`;

  // Create frontmatter
  const frontmatter = {
    id,
    title: "Handoff Brief",
    generated_at: new Date().toISOString(),
    from_phase: fromPhase,
    to_phase: toPhase,
  };

  // Combine frontmatter with content
  const fullContent = matter.stringify(brief, frontmatter);

  // Write to file (overwrites existing)
  fs.writeFileSync(briefPath, fullContent, "utf-8");

  return relativePath;
}
