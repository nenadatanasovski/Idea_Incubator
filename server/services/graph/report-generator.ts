/**
 * Node Group Report Generator Service
 *
 * Uses Claude Opus 4.5 to intelligently synthesize reports for connected node groups
 * in the memory graph. Each report provides an overview, key themes, narrative story,
 * and identifies open questions.
 */

import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { client as anthropicClient } from "../../../utils/anthropic-client.js";
import { query, run, saveDb } from "../../../database/db.js";

// ============================================================================
// Types
// ============================================================================

export interface GraphNode {
  id: string;
  type: string;
  title: string | null;
  content: string;
  status?: string;
  confidence?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  linkType: string;
}

export interface ReportGenerationInput {
  sessionId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  componentNodeIds: string[];
  otherGroupSummaries?: Array<{
    groupHash: string;
    groupName: string;
    overview: string;
  }>;
}

export interface GeneratedReport {
  groupName: string;
  overview: string;
  keyThemes: string[];
  story: string;
  relationshipsToGroups: Array<{
    groupHash: string;
    groupName: string;
    relationship: string;
  }>;
  openQuestions: string[];
  nodesSummary: Array<{ nodeId: string; title: string; oneLiner: string }>;
}

export interface StoredReport {
  id: string;
  sessionId: string;
  nodeIds: string[];
  groupHash: string;
  groupName: string | null;
  overview: string | null;
  keyThemes: string[];
  story: string | null;
  relationshipsToGroups: GeneratedReport["relationshipsToGroups"];
  openQuestions: string[];
  nodesSummary: GeneratedReport["nodesSummary"];
  status: "current" | "stale";
  nodeCount: number;
  edgeCount: number;
  generatedAt: string;
  generationDurationMs: number | null;
  modelUsed: string | null;
}

// ============================================================================
// AI Report Prompt
// ============================================================================

const REPORT_GENERATION_SYSTEM_PROMPT = `You are a strategic analyst synthesizing insights from a connected group of knowledge nodes.

Your task is to create a comprehensive report that:
1. Names the group based on its dominant theme
2. Provides an overview of what this group represents
3. Identifies key themes across the nodes
4. Weaves a coherent story connecting the ideas
5. Notes relationships to other groups (if provided)
6. Highlights open questions or tensions

IMPORTANT: When referencing specific nodes, use their exact titles in double quotes.
Example: The insight "Market size validation" suggests...

This allows the UI to create clickable links from quoted node titles.

Guidelines:
- The group name should be concise (2-5 words) and descriptive
- Overview should be 1-2 paragraphs summarizing what this group represents
- Key themes should be 3-7 bullet points capturing major concepts
- Story should be 2-4 paragraphs weaving together the ideas with node references
- Open questions should identify gaps, tensions, or areas needing exploration
- Nodes summary should give a one-liner for each node's contribution

Output JSON matching this structure exactly:
{
  "groupName": "string - descriptive name for this group",
  "overview": "string - 1-2 paragraphs summarizing what this group represents",
  "keyThemes": ["array", "of", "theme", "bullets"],
  "story": "string - multi-paragraph narrative connecting the ideas, referencing node titles in quotes",
  "relationshipsToGroups": [{"groupHash": "string", "groupName": "string", "relationship": "string"}],
  "openQuestions": ["array", "of", "gaps", "or", "tensions"],
  "nodesSummary": [{"nodeId": "string", "title": "string", "oneLiner": "string"}]
}`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute a deterministic hash for a group of node IDs
 */
export function computeGroupHash(nodeIds: string[]): string {
  const sorted = [...nodeIds].sort();
  return crypto.createHash("sha256").update(sorted.join(",")).digest("hex");
}

/**
 * Build the user prompt for report generation
 */
export function buildReportPrompt(
  nodes: GraphNode[],
  edges: GraphEdge[],
  otherGroupSummaries?: Array<{
    groupHash: string;
    groupName: string;
    overview: string;
  }>,
): { system: string; user: string } {
  // Build nodes section
  const nodesSection = nodes
    .map(
      (n) =>
        `Node ID: ${n.id}
Type: ${n.type}
Title: ${n.title || "(untitled)"}
Content: ${n.content}
${n.confidence ? `Confidence: ${(n.confidence * 100).toFixed(0)}%` : ""}`,
    )
    .join("\n\n---\n\n");

  // Build edges section
  const edgesSection = edges
    .map((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      const targetNode = nodes.find((n) => n.id === e.target);
      return `"${sourceNode?.title || e.source}" --[${e.linkType}]--> "${targetNode?.title || e.target}"`;
    })
    .join("\n");

  // Build other groups section if available
  let otherGroupsSection = "";
  if (otherGroupSummaries && otherGroupSummaries.length > 0) {
    otherGroupsSection = `

## OTHER GROUPS IN THIS SESSION (for relationship analysis)

${otherGroupSummaries.map((g) => `Group: "${g.groupName}" (hash: ${g.groupHash.slice(0, 8)})\nOverview: ${g.overview.slice(0, 300)}...`).join("\n\n")}`;
  }

  const userPrompt = `Analyze this connected group of knowledge nodes and create a comprehensive report.

## NODES (${nodes.length} total)

${nodesSection}

## RELATIONSHIPS (${edges.length} total)

${edgesSection}
${otherGroupsSection}

## TASK

Create a report that:
1. Gives this group a descriptive name based on its dominant theme
2. Summarizes what this group represents
3. Identifies 3-7 key themes
4. Tells the story of how these ideas connect (reference node titles in quotes)
5. ${otherGroupSummaries?.length ? "Identifies relationships to other groups" : "Leave relationshipsToGroups as an empty array"}
6. Highlights open questions or tensions

Return your analysis as JSON.`;

  return {
    system: REPORT_GENERATION_SYSTEM_PROMPT,
    user: userPrompt,
  };
}

/**
 * Parse the AI response into a structured report
 */
export function parseReportResponse(response: string): GeneratedReport {
  let jsonText = response.trim();

  // Extract JSON from code block if present
  const jsonCodeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonCodeBlockMatch) {
    jsonText = jsonCodeBlockMatch[1].trim();
  } else {
    // Try to find JSON object directly
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  const parsed = JSON.parse(jsonText);

  // Validate and provide defaults for required fields
  return {
    groupName: parsed.groupName || "Unnamed Group",
    overview: parsed.overview || "",
    keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
    story: parsed.story || "",
    relationshipsToGroups: Array.isArray(parsed.relationshipsToGroups)
      ? parsed.relationshipsToGroups
      : [],
    openQuestions: Array.isArray(parsed.openQuestions)
      ? parsed.openQuestions
      : [],
    nodesSummary: Array.isArray(parsed.nodesSummary) ? parsed.nodesSummary : [],
  };
}

// ============================================================================
// Report Generator Class
// ============================================================================

export class ReportGenerator {
  private client: typeof anthropicClient;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Generate a report for a connected component of nodes
   */
  async generateGroupReport(
    input: ReportGenerationInput,
    abortSignal?: AbortSignal,
  ): Promise<GeneratedReport> {
    const { nodes, edges, otherGroupSummaries } = input;

    if (nodes.length === 0) {
      throw new Error("Cannot generate report for empty node group");
    }

    console.log(
      `[ReportGenerator] Generating report for ${nodes.length} nodes, ${edges.length} edges`,
    );

    // Build the prompt
    const { system, user } = buildReportPrompt(
      nodes,
      edges,
      otherGroupSummaries,
    );

    // Check for cancellation before API call
    if (abortSignal?.aborted) {
      throw new Error("Report generation cancelled");
    }

    try {
      const response = await this.client.messages.create({
        model: "claude-opus-4-6", // Using Opus 4.6
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: user }],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text content in AI response");
      }

      const report = parseReportResponse(textContent.text);
      console.log(`[ReportGenerator] Generated report: "${report.groupName}"`);

      return report;
    } catch (error) {
      console.error(`[ReportGenerator] AI API call failed:`, error);
      throw error;
    }
  }

  /**
   * Store a generated report in the database
   */
  async storeReport(
    sessionId: string,
    nodeIds: string[],
    edgeCount: number,
    report: GeneratedReport,
    durationMs: number,
  ): Promise<StoredReport> {
    const reportId = uuidv4();
    const groupHash = computeGroupHash(nodeIds);
    const now = new Date().toISOString();

    // Upsert - update if exists (same session + group hash), insert if new
    await run(
      `INSERT INTO node_group_reports (
        id, session_id, node_ids, group_hash, group_name,
        overview, key_themes, story, relationships_to_groups,
        open_questions, nodes_summary, status, node_count, edge_count,
        generated_at, generation_duration_ms, model_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, group_hash) DO UPDATE SET
        node_ids = excluded.node_ids,
        group_name = excluded.group_name,
        overview = excluded.overview,
        key_themes = excluded.key_themes,
        story = excluded.story,
        relationships_to_groups = excluded.relationships_to_groups,
        open_questions = excluded.open_questions,
        nodes_summary = excluded.nodes_summary,
        status = 'current',
        node_count = excluded.node_count,
        edge_count = excluded.edge_count,
        generated_at = excluded.generated_at,
        generation_duration_ms = excluded.generation_duration_ms,
        model_used = excluded.model_used`,
      [
        reportId,
        sessionId,
        JSON.stringify(nodeIds),
        groupHash,
        report.groupName,
        report.overview,
        JSON.stringify(report.keyThemes),
        report.story,
        JSON.stringify(report.relationshipsToGroups),
        JSON.stringify(report.openQuestions),
        JSON.stringify(report.nodesSummary),
        "current",
        nodeIds.length,
        edgeCount,
        now,
        durationMs,
        "claude-opus-4-6",
      ],
    );

    await saveDb();

    return {
      id: reportId,
      sessionId,
      nodeIds,
      groupHash,
      groupName: report.groupName,
      overview: report.overview,
      keyThemes: report.keyThemes,
      story: report.story,
      relationshipsToGroups: report.relationshipsToGroups,
      openQuestions: report.openQuestions,
      nodesSummary: report.nodesSummary,
      status: "current",
      nodeCount: nodeIds.length,
      edgeCount,
      generatedAt: now,
      generationDurationMs: durationMs,
      modelUsed: "claude-opus-4-6",
    };
  }

  /**
   * Get all reports for a session
   */
  async getReportsForSession(sessionId: string): Promise<StoredReport[]> {
    const rows = await query<{
      id: string;
      session_id: string;
      node_ids: string;
      group_hash: string;
      group_name: string | null;
      overview: string | null;
      key_themes: string | null;
      story: string | null;
      relationships_to_groups: string | null;
      open_questions: string | null;
      nodes_summary: string | null;
      status: string;
      node_count: number;
      edge_count: number;
      generated_at: string;
      generation_duration_ms: number | null;
      model_used: string | null;
    }>(
      `SELECT * FROM node_group_reports WHERE session_id = ? ORDER BY node_count DESC`,
      [sessionId],
    );

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      nodeIds: JSON.parse(row.node_ids),
      groupHash: row.group_hash,
      groupName: row.group_name,
      overview: row.overview,
      keyThemes: row.key_themes ? JSON.parse(row.key_themes) : [],
      story: row.story,
      relationshipsToGroups: row.relationships_to_groups
        ? JSON.parse(row.relationships_to_groups)
        : [],
      openQuestions: row.open_questions ? JSON.parse(row.open_questions) : [],
      nodesSummary: row.nodes_summary ? JSON.parse(row.nodes_summary) : [],
      status: row.status as "current" | "stale",
      nodeCount: row.node_count,
      edgeCount: row.edge_count,
      generatedAt: row.generated_at,
      generationDurationMs: row.generation_duration_ms,
      modelUsed: row.model_used,
    }));
  }

  /**
   * Get report for a specific node (by finding its group)
   */
  async getReportForNode(
    sessionId: string,
    nodeId: string,
  ): Promise<StoredReport | null> {
    // Find report containing this node
    const rows = await query<{
      id: string;
      session_id: string;
      node_ids: string;
      group_hash: string;
      group_name: string | null;
      overview: string | null;
      key_themes: string | null;
      story: string | null;
      relationships_to_groups: string | null;
      open_questions: string | null;
      nodes_summary: string | null;
      status: string;
      node_count: number;
      edge_count: number;
      generated_at: string;
      generation_duration_ms: number | null;
      model_used: string | null;
    }>(`SELECT * FROM node_group_reports WHERE session_id = ?`, [sessionId]);

    for (const row of rows) {
      const nodeIds = JSON.parse(row.node_ids) as string[];
      if (nodeIds.includes(nodeId)) {
        return {
          id: row.id,
          sessionId: row.session_id,
          nodeIds,
          groupHash: row.group_hash,
          groupName: row.group_name,
          overview: row.overview,
          keyThemes: row.key_themes ? JSON.parse(row.key_themes) : [],
          story: row.story,
          relationshipsToGroups: row.relationships_to_groups
            ? JSON.parse(row.relationships_to_groups)
            : [],
          openQuestions: row.open_questions
            ? JSON.parse(row.open_questions)
            : [],
          nodesSummary: row.nodes_summary ? JSON.parse(row.nodes_summary) : [],
          status: row.status as "current" | "stale",
          nodeCount: row.node_count,
          edgeCount: row.edge_count,
          generatedAt: row.generated_at,
          generationDurationMs: row.generation_duration_ms,
          modelUsed: row.model_used,
        };
      }
    }

    return null;
  }

  /**
   * Get report by ID
   */
  async getReportById(reportId: string): Promise<StoredReport | null> {
    const rows = await query<{
      id: string;
      session_id: string;
      node_ids: string;
      group_hash: string;
      group_name: string | null;
      overview: string | null;
      key_themes: string | null;
      story: string | null;
      relationships_to_groups: string | null;
      open_questions: string | null;
      nodes_summary: string | null;
      status: string;
      node_count: number;
      edge_count: number;
      generated_at: string;
      generation_duration_ms: number | null;
      model_used: string | null;
    }>(`SELECT * FROM node_group_reports WHERE id = ?`, [reportId]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      sessionId: row.session_id,
      nodeIds: JSON.parse(row.node_ids),
      groupHash: row.group_hash,
      groupName: row.group_name,
      overview: row.overview,
      keyThemes: row.key_themes ? JSON.parse(row.key_themes) : [],
      story: row.story,
      relationshipsToGroups: row.relationships_to_groups
        ? JSON.parse(row.relationships_to_groups)
        : [],
      openQuestions: row.open_questions ? JSON.parse(row.open_questions) : [],
      nodesSummary: row.nodes_summary ? JSON.parse(row.nodes_summary) : [],
      status: row.status as "current" | "stale",
      nodeCount: row.node_count,
      edgeCount: row.edge_count,
      generatedAt: row.generated_at,
      generationDurationMs: row.generation_duration_ms,
      modelUsed: row.model_used,
    };
  }

  /**
   * Mark reports containing specific nodes as stale
   */
  async markReportsStale(
    sessionId: string,
    changedNodeIds: string[],
  ): Promise<string[]> {
    const reports = await this.getReportsForSession(sessionId);
    const staleReportIds: string[] = [];

    for (const report of reports) {
      if (report.status === "current") {
        const hasOverlap = changedNodeIds.some((id) =>
          report.nodeIds.includes(id),
        );
        if (hasOverlap) {
          staleReportIds.push(report.id);
        }
      }
    }

    if (staleReportIds.length > 0) {
      await run(
        `UPDATE node_group_reports SET status = 'stale' WHERE id IN (${staleReportIds.map(() => "?").join(",")})`,
        staleReportIds,
      );
      await saveDb();
      console.log(
        `[ReportGenerator] Marked ${staleReportIds.length} reports as stale`,
      );
    }

    return staleReportIds;
  }

  /**
   * Delete all reports for a session
   */
  async deleteReportsForSession(sessionId: string): Promise<void> {
    await run(`DELETE FROM node_group_reports WHERE session_id = ?`, [
      sessionId,
    ]);
    await saveDb();
  }
}

// Singleton export
export const reportGenerator = new ReportGenerator();
