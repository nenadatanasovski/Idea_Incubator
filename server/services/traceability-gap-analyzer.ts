/**
 * TraceabilityGapAnalyzer - AI-powered gap detection and suggestion service
 *
 * Analyzes traceability between PRD requirements and tasks to find:
 * - Uncovered requirements (no linked tasks)
 * - Weak coverage (only 1 task, no tests)
 * - Orphan tasks (no linked requirements)
 * - Category mismatches (bug task implements feature, etc.)
 */

import { v4 as uuidv4 } from "uuid";
import { query, getOne, run } from "../../database/db.js";
import { traceabilityService } from "./traceability-service.js";
import { createAnthropicClient } from "../../utils/anthropic-client.js";

// Types
export interface TraceabilityGap {
  id: string;
  projectId: string;
  gapType: "uncovered" | "weak_coverage" | "orphan" | "mismatch";
  entityType: "requirement" | "task";
  entityRef: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  suggestions: string[];
  status: "open" | "resolved" | "ignored";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface GapRow {
  id: string;
  project_id: string;
  gap_type: string;
  entity_type: string;
  entity_ref: string;
  severity: string;
  title: string;
  description: string;
  suggestions: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// Rate limiting
const rateLimits: Record<string, number> = {};
const RATE_LIMIT_MS = 10000;

function checkRateLimit(operation: string): boolean {
  const now = Date.now();
  const lastCall = rateLimits[operation] || 0;
  if (now - lastCall < RATE_LIMIT_MS) return false;
  rateLimits[operation] = now;
  return true;
}

export class TraceabilityGapAnalyzer {
  private client = createAnthropicClient();

  /**
   * Analyze a project for traceability gaps
   */
  async analyzeProject(projectId: string): Promise<TraceabilityGap[]> {
    const gaps: TraceabilityGap[] = [];

    // 1. Find uncovered requirements (from existing service)
    const coverageGaps = await traceabilityService.getCoverageGaps(projectId);
    for (const gap of coverageGaps) {
      gaps.push({
        id: uuidv4(),
        projectId,
        gapType: "uncovered",
        entityType: "requirement",
        entityRef: `${gap.sectionType}[${gap.itemIndex}]`,
        severity: gap.severity === "high" ? "critical" : "warning",
        title: `Uncovered: ${gap.sectionTitle} #${gap.itemIndex + 1}`,
        description: gap.itemContent,
        suggestions: [],
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Find weak coverage (only 1 task, no tests)
    const coverage = await traceabilityService.getSpecCoverage(projectId);
    if (coverage) {
      for (const section of coverage.sections) {
        for (const item of section.items) {
          if (item.isCovered && item.linkedTasks.length === 1) {
            const hasTest = item.linkedTasks.some(
              (t) => t.linkType === "tests",
            );
            if (!hasTest) {
              gaps.push({
                id: uuidv4(),
                projectId,
                gapType: "weak_coverage",
                entityType: "requirement",
                entityRef: `${section.sectionType}[${item.index}]`,
                severity: "warning",
                title: `Weak Coverage: ${section.sectionTitle} #${item.index + 1}`,
                description: `${item.content}\n\n(Only 1 task linked, no tests)`,
                suggestions: [],
                status: "open",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // 3. Find orphan tasks (from existing service)
    const orphanTasks = await traceabilityService.getOrphanTasks(projectId);

    // Check dismissed list
    const dismissedIds = await query<{ task_id: string }>(
      "SELECT task_id FROM dismissed_orphans WHERE project_id = ?",
      [projectId],
    );
    const dismissedSet = new Set(dismissedIds.map((d) => d.task_id));

    for (const task of orphanTasks) {
      if (dismissedSet.has(task.id)) continue;

      gaps.push({
        id: uuidv4(),
        projectId,
        gapType: "orphan",
        entityType: "task",
        entityRef: task.id,
        severity: "info",
        title: `Orphan: ${task.displayId}`,
        description: `${task.title}\n\nThis task is not linked to any PRD requirement.`,
        suggestions: [],
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Store gaps in database (clear old ones first)
    await run("DELETE FROM traceability_gaps WHERE project_id = ?", [
      projectId,
    ]);

    for (const gap of gaps) {
      await run(
        `
        INSERT INTO traceability_gaps
        (id, project_id, gap_type, entity_type, entity_ref, severity, title, description, suggestions, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          gap.id,
          gap.projectId,
          gap.gapType,
          gap.entityType,
          gap.entityRef,
          gap.severity,
          gap.title,
          gap.description,
          JSON.stringify(gap.suggestions),
          gap.status,
          gap.createdAt,
          gap.updatedAt,
        ],
      );
    }

    return gaps;
  }

  /**
   * Get stored gaps for a project
   */
  async getGaps(
    projectId: string,
    status?: string,
  ): Promise<TraceabilityGap[]> {
    let sql = "SELECT * FROM traceability_gaps WHERE project_id = ?";
    const params: string[] = [projectId];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql +=
      " ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC";

    const rows = await query<GapRow>(sql, params);

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      gapType: row.gap_type as TraceabilityGap["gapType"],
      entityType: row.entity_type as TraceabilityGap["entityType"],
      entityRef: row.entity_ref,
      severity: row.severity as TraceabilityGap["severity"],
      title: row.title,
      description: row.description,
      suggestions: JSON.parse(row.suggestions || "[]"),
      status: row.status as TraceabilityGap["status"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at || undefined,
      resolvedBy: row.resolved_by || undefined,
    }));
  }

  /**
   * Generate AI suggestions for a gap
   */
  async generateSuggestions(gapId: string): Promise<string[]> {
    if (!checkRateLimit(`suggestions-${gapId}`)) {
      // Return cached suggestions if rate limited
      const gap = await getOne<GapRow>(
        "SELECT suggestions FROM traceability_gaps WHERE id = ?",
        [gapId],
      );
      return gap ? JSON.parse(gap.suggestions || "[]") : [];
    }

    const gap = await getOne<GapRow>(
      "SELECT * FROM traceability_gaps WHERE id = ?",
      [gapId],
    );

    if (!gap) return [];

    const prompt = this.buildSuggestionPrompt(gap);

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a project management assistant helping to improve traceability between requirements and tasks. Provide a clear, cohesive action plan to address the gap. Write a brief paragraph explaining what should be done and why.`,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const suggestions = this.parseSuggestions(text);

      // Store suggestions
      await run(
        "UPDATE traceability_gaps SET suggestions = ?, updated_at = ? WHERE id = ?",
        [JSON.stringify(suggestions), new Date().toISOString(), gapId],
      );

      return suggestions;
    } catch (error) {
      console.error("Error generating suggestions:", error);
      return [];
    }
  }

  private buildSuggestionPrompt(gap: GapRow): string {
    switch (gap.gap_type) {
      case "uncovered":
        return `A requirement is not covered by any tasks:
"${gap.description}"

Provide a clear action plan: What task(s) should be created to implement this requirement? Be specific about what needs to be built.`;

      case "weak_coverage":
        return `A requirement has weak test coverage:
"${gap.description}"

Provide a clear action plan: What additional tasks or tests should be created to properly cover this requirement?`;

      case "orphan":
        return `A task exists but isn't linked to any requirement:
"${gap.description}"

Provide guidance: Which requirement should this task be linked to, or explain why it might be intentionally unlinked (infrastructure, tech debt, etc.)?`;

      default:
        return `Address this traceability gap:
"${gap.description}"

Provide a clear action plan to resolve this gap.`;
    }
  }

  private parseSuggestions(text: string): string[] {
    // Return the full AI response as a single cohesive suggestion
    const cleaned = text.trim();
    if (cleaned.length > 10) {
      return [cleaned];
    }
    return [];
  }

  /**
   * Resolve a gap
   */
  async resolveGap(
    gapId: string,
    resolvedBy: "user" | "ai" = "user",
  ): Promise<void> {
    await run(
      `
      UPDATE traceability_gaps
      SET status = 'resolved', resolved_at = ?, resolved_by = ?, updated_at = ?
      WHERE id = ?
    `,
      [new Date().toISOString(), resolvedBy, new Date().toISOString(), gapId],
    );
  }

  /**
   * Ignore a gap
   */
  async ignoreGap(gapId: string): Promise<void> {
    await run(
      `
      UPDATE traceability_gaps
      SET status = 'ignored', updated_at = ?
      WHERE id = ?
    `,
      [new Date().toISOString(), gapId],
    );
  }

  /**
   * Get gap counts by status
   */
  async getGapCounts(
    projectId: string,
  ): Promise<{ open: number; resolved: number; ignored: number }> {
    const rows = await query<{ status: string; count: number }>(
      `
      SELECT status, COUNT(*) as count
      FROM traceability_gaps
      WHERE project_id = ?
      GROUP BY status
    `,
      [projectId],
    );

    const counts = { open: 0, resolved: 0, ignored: 0 };
    for (const row of rows) {
      counts[row.status as keyof typeof counts] = row.count;
    }
    return counts;
  }

  /**
   * Dismiss an orphan task (mark as intentionally unlinked)
   */
  async dismissOrphan(
    taskId: string,
    projectId: string,
    reason?: string,
  ): Promise<void> {
    const id = uuidv4();
    await run(
      `
      INSERT OR REPLACE INTO dismissed_orphans (id, task_id, project_id, reason, dismissed_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `,
      [id, taskId, projectId, reason || null],
    );
  }
}

// Export singleton
export const traceabilityGapAnalyzer = new TraceabilityGapAnalyzer();
export default traceabilityGapAnalyzer;
