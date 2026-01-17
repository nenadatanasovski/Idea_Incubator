/**
 * Spec Generator Service
 *
 * Generates structured specifications from ideation session content.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-004-A)
 */

import { v4 as uuidv4 } from "uuid";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { query, run } from "../../database/db.js";
import { messageStore } from "./message-store.js";
import { buildSpecGenerationPrompt } from "./prompts/spec-generation.js";
import type { IdeationMessage } from "../../types/ideation.js";
import type {
  Spec,
  SpecSection,
  SpecSectionType,
  SpecGenerationResult,
  CreateSpecInput,
} from "../../types/spec.js";

// Confidence threshold for flagging sections as needing review
const LOW_CONFIDENCE_THRESHOLD = 50;

// Section type order for display
const SECTION_ORDER: SpecSectionType[] = [
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
