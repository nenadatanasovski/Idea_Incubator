/**
 * Spec Generator Service
 *
 * Generates structured specifications from ideation session content.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-004-A)
 * Enhanced for: Phase 9 - Project Folder & Spec Output (T9.4)
 */

import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { query, run } from "../../database/db.js";
import { messageStore } from "./message-store.js";
import { buildSpecGenerationPrompt } from "./prompts/spec-generation.js";
import { getIdeaFolderPath } from "../../utils/folder-structure.js";
import type {
  Spec,
  SpecSection,
  SpecSectionType,
  SpecGenerationResult,
} from "../../types/spec.js";

// Confidence threshold for flagging sections as needing review
const LOW_CONFIDENCE_THRESHOLD = 50;

// Section type order for display (kept for reference but unused)
const _SECTION_ORDER: SpecSectionType[] = [
  "problem",
  "target_users",
  "functional_desc",
  "success_criteria",
  "constraints",
  "out_of_scope",
  "risks",
  "assumptions",
];

/**
 * Parsed response from Claude
 */
interface ParsedSpecResponse {
  title: string;
  problemStatement: {
    content: string;
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  targetUsers: {
    content: string;
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  functionalDescription: {
    content: string;
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  successCriteria: {
    content: string[];
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  constraints: {
    content: string[];
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  outOfScope: {
    content: string[];
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  risks: {
    content: string[];
    confidence: number;
    clarifyingQuestion?: string | null;
  };
  assumptions: {
    content: string[];
    confidence: number;
    clarifyingQuestion?: string | null;
  };
}

/**
 * Generate a URL-safe slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Parse Claude's response into structured format
 */
function parseSpecResponse(response: string): ParsedSpecResponse | null {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[SpecGenerator] No JSON found in response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as ParsedSpecResponse;
  } catch (error) {
    console.error("[SpecGenerator] Failed to parse response:", error);
    return null;
  }
}

/**
 * Calculate overall confidence from section confidences
 */
function calculateOverallConfidence(parsed: ParsedSpecResponse): number {
  const confidences = [
    parsed.problemStatement.confidence,
    parsed.targetUsers.confidence,
    parsed.functionalDescription.confidence,
    parsed.successCriteria.confidence,
    parsed.constraints.confidence,
    parsed.outOfScope.confidence,
  ];

  return Math.round(
    confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
  );
}

/**
 * Get sections that need review (confidence < threshold)
 */
function getNeedsReviewSections(parsed: ParsedSpecResponse): SpecSectionType[] {
  const sections: SpecSectionType[] = [];

  if (parsed.problemStatement.confidence < LOW_CONFIDENCE_THRESHOLD)
    sections.push("problem");
  if (parsed.targetUsers.confidence < LOW_CONFIDENCE_THRESHOLD)
    sections.push("target_users");
  if (parsed.functionalDescription.confidence < LOW_CONFIDENCE_THRESHOLD)
    sections.push("functional_desc");
  if (parsed.successCriteria.confidence < LOW_CONFIDENCE_THRESHOLD)
    sections.push("success_criteria");
  if (parsed.constraints.confidence < LOW_CONFIDENCE_THRESHOLD)
    sections.push("constraints");
  if (parsed.outOfScope.confidence < LOW_CONFIDENCE_THRESHOLD)
    sections.push("out_of_scope");
  if (
    parsed.risks?.confidence &&
    parsed.risks.confidence < LOW_CONFIDENCE_THRESHOLD
  )
    sections.push("risks");
  if (
    parsed.assumptions?.confidence &&
    parsed.assumptions.confidence < LOW_CONFIDENCE_THRESHOLD
  )
    sections.push("assumptions");

  return sections;
}

/**
 * Get clarifying questions from parsed response
 */
function getClarifyingQuestions(parsed: ParsedSpecResponse): string[] {
  const questions: string[] = [];

  const sections = [
    parsed.problemStatement,
    parsed.targetUsers,
    parsed.functionalDescription,
    parsed.successCriteria,
    parsed.constraints,
    parsed.outOfScope,
    parsed.risks,
    parsed.assumptions,
  ];

  for (const section of sections) {
    if (section?.clarifyingQuestion) {
      questions.push(section.clarifyingQuestion);
    }
  }

  return questions;
}

/**
 * Save spec to database
 */
async function saveSpec(
  spec: Omit<Spec, "createdAt" | "updatedAt">,
  userId: string,
): Promise<Spec> {
  const now = new Date().toISOString();

  await run(
    `INSERT INTO prds (
      id, slug, title, user_id, project_id,
      workflow_state, source_session_id, readiness_score, version,
      problem_statement, target_users, functional_description,
      success_criteria, constraints, out_of_scope,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      spec.id,
      spec.slug,
      spec.title,
      userId,
      spec.projectId || null,
      spec.workflowState,
      spec.sourceSessionId || null,
      spec.readinessScore,
      spec.version,
      spec.problemStatement || null,
      spec.targetUsers || null,
      spec.functionalDescription || null,
      JSON.stringify(spec.successCriteria),
      JSON.stringify(spec.constraints),
      JSON.stringify(spec.outOfScope),
      "draft",
      now,
      now,
    ],
  );

  return {
    ...spec,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Save spec sections to database
 */
async function saveSpecSections(
  specId: string,
  parsed: ParsedSpecResponse,
): Promise<SpecSection[]> {
  const now = new Date().toISOString();
  const sections: SpecSection[] = [];

  const sectionData: Array<{
    type: SpecSectionType;
    content: string;
    confidence: number;
  }> = [
    {
      type: "problem",
      content: parsed.problemStatement.content,
      confidence: parsed.problemStatement.confidence,
    },
    {
      type: "target_users",
      content: parsed.targetUsers.content,
      confidence: parsed.targetUsers.confidence,
    },
    {
      type: "functional_desc",
      content: parsed.functionalDescription.content,
      confidence: parsed.functionalDescription.confidence,
    },
    {
      type: "success_criteria",
      content: JSON.stringify(parsed.successCriteria.content),
      confidence: parsed.successCriteria.confidence,
    },
    {
      type: "constraints",
      content: JSON.stringify(parsed.constraints.content),
      confidence: parsed.constraints.confidence,
    },
    {
      type: "out_of_scope",
      content: JSON.stringify(parsed.outOfScope.content),
      confidence: parsed.outOfScope.confidence,
    },
  ];

  // Add optional sections if they exist
  if (parsed.risks) {
    sectionData.push({
      type: "risks",
      content: JSON.stringify(parsed.risks.content),
      confidence: parsed.risks.confidence,
    });
  }
  if (parsed.assumptions) {
    sectionData.push({
      type: "assumptions",
      content: JSON.stringify(parsed.assumptions.content),
      confidence: parsed.assumptions.confidence,
    });
  }

  for (let i = 0; i < sectionData.length; i++) {
    const { type, content, confidence } = sectionData[i];
    const id = uuidv4();
    const needsReview = confidence < LOW_CONFIDENCE_THRESHOLD ? 1 : 0;

    await run(
      `INSERT INTO spec_sections (
        id, spec_id, section_type, content, order_index,
        confidence_score, needs_review, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, specId, type, content, i, confidence, needsReview, now, now],
    );

    sections.push({
      id,
      specId,
      sectionType: type,
      content,
      orderIndex: i,
      confidenceScore: confidence,
      needsReview: needsReview === 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return sections;
}

/**
 * Generate a spec from an ideation session
 *
 * @param sessionId - The ideation session ID
 * @param userId - The user ID
 * @param ideaTitle - Optional idea title
 * @returns SpecGenerationResult with spec and metadata
 */
export async function generateSpec(
  sessionId: string,
  userId: string,
  ideaTitle?: string,
): Promise<SpecGenerationResult> {
  console.log(`[SpecGenerator] Generating spec for session ${sessionId}`);

  // Get session messages
  const messages = await messageStore.getMessages(sessionId);

  if (messages.length < 3) {
    throw new Error("Not enough conversation to generate spec");
  }

  // Build and send prompt to Claude
  const prompt = buildSpecGenerationPrompt(messages, ideaTitle);

  const response = await anthropicClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse response
  const parsed = parseSpecResponse(responseText);

  if (!parsed) {
    throw new Error("Failed to parse spec generation response");
  }

  // Create spec object
  const specId = uuidv4();
  const spec: Omit<Spec, "createdAt" | "updatedAt"> = {
    id: specId,
    slug: generateSlug(parsed.title),
    title: parsed.title,
    userId,
    workflowState: "draft",
    sourceSessionId: sessionId,
    readinessScore: calculateOverallConfidence(parsed),
    version: 1,
    problemStatement: parsed.problemStatement.content,
    targetUsers: parsed.targetUsers.content,
    functionalDescription: parsed.functionalDescription.content,
    successCriteria: parsed.successCriteria.content,
    constraints: parsed.constraints.content,
    outOfScope: parsed.outOfScope.content,
    risks: parsed.risks?.content,
    assumptions: parsed.assumptions?.content,
  };

  // Save to database
  const savedSpec = await saveSpec(spec, userId);
  const sections = await saveSpecSections(specId, parsed);

  // Calculate section confidences
  const sectionConfidences: Record<SpecSectionType, number> = {
    problem: parsed.problemStatement.confidence,
    target_users: parsed.targetUsers.confidence,
    functional_desc: parsed.functionalDescription.confidence,
    success_criteria: parsed.successCriteria.confidence,
    constraints: parsed.constraints.confidence,
    out_of_scope: parsed.outOfScope.confidence,
    risks: parsed.risks?.confidence ?? 0,
    assumptions: parsed.assumptions?.confidence ?? 0,
  };

  console.log(
    `[SpecGenerator] Generated spec ${specId} with confidence ${savedSpec.readinessScore}`,
  );

  return {
    spec: savedSpec,
    confidence: savedSpec.readinessScore,
    sectionConfidences,
    needsReviewSections: getNeedsReviewSections(parsed),
    clarifyingQuestions: getClarifyingQuestions(parsed),
  };
}

/**
 * Get a spec by ID
 */
export async function getSpec(specId: string): Promise<Spec | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prds WHERE id = ?`,
    [specId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    userId: row.user_id as string,
    projectId: row.project_id as string | undefined,
    parentPrdId: row.parent_prd_id as string | undefined,
    workflowState: (row.workflow_state as Spec["workflowState"]) || "draft",
    sourceSessionId: row.source_session_id as string | undefined,
    readinessScore: (row.readiness_score as number) || 0,
    version: (row.version as number) || 1,
    problemStatement: row.problem_statement as string | undefined,
    targetUsers: row.target_users as string | undefined,
    functionalDescription: row.functional_description as string | undefined,
    successCriteria: JSON.parse((row.success_criteria as string) || "[]"),
    constraints: JSON.parse((row.constraints as string) || "[]"),
    outOfScope: JSON.parse((row.out_of_scope as string) || "[]"),
    approvedAt: row.approved_at as string | undefined,
    approvedBy: row.approved_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get spec by session ID
 */
export async function getSpecBySession(
  sessionId: string,
): Promise<Spec | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM prds WHERE source_session_id = ? ORDER BY created_at DESC LIMIT 1`,
    [sessionId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    userId: row.user_id as string,
    projectId: row.project_id as string | undefined,
    workflowState: (row.workflow_state as Spec["workflowState"]) || "draft",
    sourceSessionId: row.source_session_id as string | undefined,
    readinessScore: (row.readiness_score as number) || 0,
    version: (row.version as number) || 1,
    problemStatement: row.problem_statement as string | undefined,
    targetUsers: row.target_users as string | undefined,
    functionalDescription: row.functional_description as string | undefined,
    successCriteria: JSON.parse((row.success_criteria as string) || "[]"),
    constraints: JSON.parse((row.constraints as string) || "[]"),
    outOfScope: JSON.parse((row.out_of_scope as string) || "[]"),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get sections for a spec
 */
export async function getSpecSections(specId: string): Promise<SpecSection[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM spec_sections WHERE spec_id = ? ORDER BY order_index`,
    [specId],
  );

  return rows.map((row) => ({
    id: row.id as string,
    specId: row.spec_id as string,
    sectionType: row.section_type as SpecSectionType,
    content: row.content as string,
    orderIndex: row.order_index as number,
    confidenceScore: row.confidence_score as number,
    needsReview: (row.needs_review as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Update a spec section
 */
export async function updateSpecSection(
  sectionId: string,
  content: string,
): Promise<void> {
  const now = new Date().toISOString();

  await run(
    `UPDATE spec_sections SET content = ?, updated_at = ? WHERE id = ?`,
    [content, now, sectionId],
  );
}

/**
 * Update spec workflow state
 */
export async function updateSpecWorkflowState(
  specId: string,
  newState: Spec["workflowState"],
): Promise<Spec | null> {
  const now = new Date().toISOString();

  // Get current spec to increment version
  const current = await getSpec(specId);
  if (!current) return null;

  await run(
    `UPDATE prds SET
      workflow_state = ?,
      version = ?,
      updated_at = ?
    WHERE id = ?`,
    [newState, current.version + 1, now, specId],
  );

  return getSpec(specId);
}

// ============================================================================
// Phase 9: File Output Functions (T9.4)
// ============================================================================

/**
 * Spec history entry for version tracking
 */
interface SpecHistoryEntry {
  version: number;
  createdAt: string;
  workflowState: string;
  filename: string;
  graphSnapshotId?: string;
  blockReferences?: string[];
}

/**
 * Spec history file structure
 */
interface SpecHistoryFile {
  currentVersion: number;
  history: SpecHistoryEntry[];
}

/**
 * Options for saving spec to file
 */
export interface SaveSpecToFileOptions {
  userSlug: string;
  ideaSlug: string;
  spec: Spec;
  sections: SpecSection[];
  blockReferences?: string[];
  graphSnapshotId?: string;
}

/**
 * Generate markdown content for a spec with YAML frontmatter
 */
function generateSpecMarkdown(
  spec: Spec,
  sections: SpecSection[],
  blockReferences?: string[],
  graphSnapshotId?: string,
): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`id: ${spec.id}`);
  lines.push(`title: ${spec.title}`);
  lines.push(`version: ${spec.version}`);
  lines.push(`workflow_state: ${spec.workflowState}`);
  lines.push(`readiness_score: ${spec.readinessScore}`);
  lines.push(`source_session_id: ${spec.sourceSessionId || "null"}`);
  lines.push(`created_at: ${spec.createdAt}`);
  lines.push(`updated_at: ${spec.updatedAt}`);

  if (graphSnapshotId) {
    lines.push(`graph_snapshot_id: ${graphSnapshotId}`);
  }

  if (blockReferences && blockReferences.length > 0) {
    lines.push("block_references:");
    for (const ref of blockReferences) {
      lines.push(`  - ${ref}`);
    }
  }

  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${spec.title}`);
  lines.push("");
  lines.push(
    `**Version:** ${spec.version} | **Status:** ${spec.workflowState} | **Readiness:** ${spec.readinessScore}%`,
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  // Section definitions with order
  const sectionConfig: Record<
    SpecSectionType,
    { label: string; type: "text" | "list" }
  > = {
    problem: { label: "Problem Statement", type: "text" },
    target_users: { label: "Target Users", type: "text" },
    functional_desc: { label: "Functional Description", type: "text" },
    success_criteria: { label: "Success Criteria", type: "list" },
    constraints: { label: "Constraints", type: "list" },
    out_of_scope: { label: "Out of Scope", type: "list" },
    risks: { label: "Risks", type: "list" },
    assumptions: { label: "Assumptions", type: "list" },
  };

  const sectionOrder: SpecSectionType[] = [
    "problem",
    "target_users",
    "functional_desc",
    "success_criteria",
    "constraints",
    "out_of_scope",
    "risks",
    "assumptions",
  ];

  for (const sectionType of sectionOrder) {
    const section = sections.find((s) => s.sectionType === sectionType);
    const config = sectionConfig[sectionType];

    lines.push(`## ${config.label}`);
    lines.push("");

    if (section && section.content) {
      const confidenceNote =
        section.confidenceScore < 50
          ? ` *(Confidence: ${section.confidenceScore}% - Needs Review)*`
          : ` *(Confidence: ${section.confidenceScore}%)*`;
      lines.push(confidenceNote);
      lines.push("");

      // Parse content (may be JSON array or plain text)
      try {
        const parsed = JSON.parse(section.content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            lines.push(`- ${item}`);
          }
        } else {
          lines.push(String(parsed));
        }
      } catch {
        // Plain text content
        lines.push(section.content);
      }
    } else {
      lines.push("*Not specified*");
    }

    lines.push("");
  }

  // Footer with metadata
  lines.push("---");
  lines.push("");
  lines.push(
    `*Generated from ideation session on ${new Date().toISOString()}*`,
  );

  return lines.join("\n");
}

/**
 * Get the next version number for a spec file
 */
function getNextVersionNumber(metadataDir: string): number {
  const historyPath = path.join(metadataDir, "spec-history.json");

  if (!fs.existsSync(historyPath)) {
    return 1;
  }

  try {
    const content = fs.readFileSync(historyPath, "utf-8");
    const history: SpecHistoryFile = JSON.parse(content);
    return history.currentVersion + 1;
  } catch {
    return 1;
  }
}

/**
 * Update the spec history file
 */
function updateSpecHistory(metadataDir: string, entry: SpecHistoryEntry): void {
  const historyPath = path.join(metadataDir, "spec-history.json");

  let history: SpecHistoryFile;

  if (fs.existsSync(historyPath)) {
    try {
      const content = fs.readFileSync(historyPath, "utf-8");
      history = JSON.parse(content);
    } catch {
      history = { currentVersion: 0, history: [] };
    }
  } else {
    history = { currentVersion: 0, history: [] };
  }

  // Update current version and add entry
  history.currentVersion = entry.version;
  history.history.push(entry);

  // Write updated history
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

/**
 * Archive existing spec file by renaming to versioned filename
 */
function archiveExistingSpec(buildDir: string, currentVersion: number): void {
  const currentSpecPath = path.join(buildDir, "APP-SPEC.md");

  if (fs.existsSync(currentSpecPath)) {
    const archivedFilename = `APP-SPEC-v${currentVersion}.md`;
    const archivedPath = path.join(buildDir, archivedFilename);
    fs.renameSync(currentSpecPath, archivedPath);
    console.log(
      `[SpecGenerator] Archived existing spec to ${archivedFilename}`,
    );
  }
}

/**
 * Save a spec to the project folder file system
 *
 * - Saves to users/[userSlug]/ideas/[ideaSlug]/build/APP-SPEC.md
 * - Auto-versions existing specs (renames to APP-SPEC-vN.md)
 * - Creates/updates .metadata/spec-history.json
 * - Includes YAML frontmatter with block references
 *
 * @param options - Options for saving the spec
 * @returns The path to the saved spec file
 */
export async function saveSpecToFile(
  options: SaveSpecToFileOptions,
): Promise<string> {
  const {
    userSlug,
    ideaSlug,
    spec,
    sections,
    blockReferences,
    graphSnapshotId,
  } = options;

  console.log(
    `[SpecGenerator] Saving spec v${spec.version} to file for ${userSlug}/${ideaSlug}`,
  );

  // Get idea folder path
  const ideaFolderPath = getIdeaFolderPath(userSlug, ideaSlug);

  // Ensure build and metadata directories exist
  const buildDir = path.join(ideaFolderPath, "build");
  const metadataDir = path.join(ideaFolderPath, ".metadata");

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  // Get next version number from history
  const fileVersion = getNextVersionNumber(metadataDir);

  // Archive existing spec if present
  if (fileVersion > 1) {
    archiveExistingSpec(buildDir, fileVersion - 1);
  }

  // Generate markdown content
  const markdownContent = generateSpecMarkdown(
    spec,
    sections,
    blockReferences,
    graphSnapshotId,
  );

  // Write spec file
  const specFilePath = path.join(buildDir, "APP-SPEC.md");
  fs.writeFileSync(specFilePath, markdownContent, "utf-8");

  console.log(`[SpecGenerator] Wrote spec to ${specFilePath}`);

  // Update spec history
  const historyEntry: SpecHistoryEntry = {
    version: fileVersion,
    createdAt: new Date().toISOString(),
    workflowState: spec.workflowState,
    filename: "APP-SPEC.md",
    graphSnapshotId,
    blockReferences,
  };

  updateSpecHistory(metadataDir, historyEntry);

  console.log(`[SpecGenerator] Updated spec history to version ${fileVersion}`);

  return specFilePath;
}

/**
 * Get spec history from file system
 *
 * @param userSlug - User slug
 * @param ideaSlug - Idea slug
 * @returns Spec history or null if not found
 */
export function getSpecHistoryFromFile(
  userSlug: string,
  ideaSlug: string,
): SpecHistoryFile | null {
  try {
    const ideaFolderPath = getIdeaFolderPath(userSlug, ideaSlug);
    const historyPath = path.join(
      ideaFolderPath,
      ".metadata",
      "spec-history.json",
    );

    if (!fs.existsSync(historyPath)) {
      return null;
    }

    const content = fs.readFileSync(historyPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load a specific version of the spec from file
 *
 * @param userSlug - User slug
 * @param ideaSlug - Idea slug
 * @param version - Version number to load (omit for current)
 * @returns Spec markdown content or null if not found
 */
export function loadSpecFromFile(
  userSlug: string,
  ideaSlug: string,
  version?: number,
): string | null {
  try {
    const ideaFolderPath = getIdeaFolderPath(userSlug, ideaSlug);
    const buildDir = path.join(ideaFolderPath, "build");

    let specFilename: string;

    if (version === undefined) {
      specFilename = "APP-SPEC.md";
    } else {
      // Check if this is the current version
      const history = getSpecHistoryFromFile(userSlug, ideaSlug);
      if (history && history.currentVersion === version) {
        specFilename = "APP-SPEC.md";
      } else {
        specFilename = `APP-SPEC-v${version}.md`;
      }
    }

    const specPath = path.join(buildDir, specFilename);

    if (!fs.existsSync(specPath)) {
      return null;
    }

    return fs.readFileSync(specPath, "utf-8");
  } catch {
    return null;
  }
}
