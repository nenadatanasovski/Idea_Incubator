/**
 * Versioning System
 *
 * Creates snapshots of idea content at key transitions.
 * Enables version comparison and history tracking.
 */

import * as fs from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";
import { run, query, getOne } from "../database/db.js";
import { logInfo, logWarning } from "../utils/logger.js";
import {
  IdeaVersion,
  VersionDiff,
  ContentChange,
  ScoreChange,
  VersionChangeType,
  IncubationPhase,
} from "../types/incubation.js";

/**
 * Create a version snapshot of an idea
 */
export async function createVersionSnapshot(
  ideaId: string,
  changeType: VersionChangeType,
  changeSummary?: string,
): Promise<string> {
  // Get current idea
  const idea = await getOne<{
    id: string;
    slug: string;
    folder_path: string;
    current_version: number;
    iteration_number: number;
    incubation_phase: string;
  }>(
    "SELECT id, slug, folder_path, current_version, iteration_number, incubation_phase FROM ideas WHERE id = ?",
    [ideaId],
  );

  if (!idea) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  // Read README.md content from filesystem
  const readmePath = path.join(idea.folder_path, "README.md");
  let contentSnapshot = "";

  try {
    if (fs.existsSync(readmePath)) {
      contentSnapshot = fs.readFileSync(readmePath, "utf-8");
    } else {
      logWarning(`README.md not found at ${readmePath}`);
      contentSnapshot = "# " + idea.slug + "\n\nNo content available.";
    }
  } catch (error) {
    logWarning(`Could not read README.md: ${error}`);
    contentSnapshot = "# " + idea.slug + "\n\nNo content available.";
  }

  // Get latest evaluation if exists
  const latestEval = await getOne<{
    evaluation_run_id: string;
  }>(
    `SELECT evaluation_run_id FROM evaluations WHERE idea_id = ?
     ORDER BY evaluated_at DESC LIMIT 1`,
    [ideaId],
  );

  let evaluationSnapshot: string | undefined;

  if (latestEval) {
    const evalScores = await query<{
      criterion: string;
      category: string;
      final_score: number;
      confidence: number;
    }>(
      `SELECT criterion, category, final_score, confidence
       FROM evaluations WHERE idea_id = ? AND evaluation_run_id = ?`,
      [ideaId, latestEval.evaluation_run_id],
    );

    evaluationSnapshot = JSON.stringify(evalScores);
  }

  // Calculate new version number
  const newVersionNumber = idea.current_version + 1;

  // Create version record
  const versionId = uuid();

  await run(
    `INSERT INTO idea_versions
     (id, idea_id, version_number, iteration_number, content_snapshot, evaluation_snapshot, phase, change_type, change_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      versionId,
      ideaId,
      newVersionNumber,
      idea.iteration_number,
      contentSnapshot,
      evaluationSnapshot ?? null,
      idea.incubation_phase,
      changeType,
      changeSummary ?? null,
    ],
  );

  // Update idea's current version
  await run(
    "UPDATE ideas SET current_version = ?, updated_at = datetime('now') WHERE id = ?",
    [newVersionNumber, ideaId],
  );

  logInfo(
    `Created version ${newVersionNumber} for idea ${idea.slug} (${changeType})`,
  );

  return versionId;
}

/**
 * Create initial version snapshot when idea is created
 */
export async function createInitialVersionSnapshot(
  ideaId: string,
): Promise<string> {
  // For initial version, we don't increment - we set it to 1
  const idea = await getOne<{
    id: string;
    slug: string;
    folder_path: string;
    incubation_phase: string;
  }>("SELECT id, slug, folder_path, incubation_phase FROM ideas WHERE id = ?", [
    ideaId,
  ]);

  if (!idea) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  // Read README.md content
  const readmePath = path.join(idea.folder_path, "README.md");
  let contentSnapshot = "";

  try {
    if (fs.existsSync(readmePath)) {
      contentSnapshot = fs.readFileSync(readmePath, "utf-8");
    }
  } catch {
    contentSnapshot = "# " + idea.slug + "\n\nNo content available.";
  }

  const versionId = uuid();

  await run(
    `INSERT INTO idea_versions
     (id, idea_id, version_number, iteration_number, content_snapshot, phase, change_type, change_summary, created_at)
     VALUES (?, ?, 1, 1, ?, ?, 'initial', 'Initial idea capture', datetime('now'))`,
    [versionId, ideaId, contentSnapshot, idea.incubation_phase],
  );

  logInfo(`Created initial version for idea ${idea.slug}`);

  return versionId;
}

/**
 * Get version history for an idea
 */
export async function getVersionHistory(
  ideaId: string,
): Promise<IdeaVersion[]> {
  const rows = await query<{
    id: string;
    idea_id: string;
    version_number: number;
    iteration_number: number;
    content_snapshot: string;
    evaluation_snapshot: string | null;
    phase: string;
    change_type: string;
    change_summary: string | null;
    created_at: string;
  }>(
    `SELECT * FROM idea_versions WHERE idea_id = ? ORDER BY version_number DESC`,
    [ideaId],
  );

  return rows.map((row) => ({
    id: row.id,
    ideaId: row.idea_id,
    versionNumber: row.version_number,
    iterationNumber: row.iteration_number,
    contentSnapshot: row.content_snapshot,
    evaluationSnapshot: row.evaluation_snapshot || undefined,
    phase: row.phase as IncubationPhase,
    changeType: row.change_type as VersionChangeType,
    changeSummary: row.change_summary || undefined,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Get a specific version snapshot
 */
export async function getVersionSnapshot(
  ideaId: string,
  versionNumber: number,
): Promise<IdeaVersion | null> {
  const row = await getOne<{
    id: string;
    idea_id: string;
    version_number: number;
    iteration_number: number;
    content_snapshot: string;
    evaluation_snapshot: string | null;
    phase: string;
    change_type: string;
    change_summary: string | null;
    created_at: string;
  }>("SELECT * FROM idea_versions WHERE idea_id = ? AND version_number = ?", [
    ideaId,
    versionNumber,
  ]);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ideaId: row.idea_id,
    versionNumber: row.version_number,
    iterationNumber: row.iteration_number,
    contentSnapshot: row.content_snapshot,
    evaluationSnapshot: row.evaluation_snapshot || undefined,
    phase: row.phase as IncubationPhase,
    changeType: row.change_type as VersionChangeType,
    changeSummary: row.change_summary || undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Compare two versions of an idea
 */
export async function compareVersions(
  ideaId: string,
  v1: number,
  v2: number,
): Promise<VersionDiff> {
  const version1 = await getVersionSnapshot(ideaId, v1);
  const version2 = await getVersionSnapshot(ideaId, v2);

  if (!version1) {
    throw new Error(`Version ${v1} not found for idea ${ideaId}`);
  }
  if (!version2) {
    throw new Error(`Version ${v2} not found for idea ${ideaId}`);
  }

  // Generate content changes
  const contentChanges = generateContentChanges(
    version1.contentSnapshot,
    version2.contentSnapshot,
  );

  // Generate score changes if both have evaluations
  let scoreChanges: ScoreChange[] | undefined;

  if (version1.evaluationSnapshot && version2.evaluationSnapshot) {
    try {
      const scores1 = JSON.parse(version1.evaluationSnapshot) as Array<{
        criterion: string;
        final_score: number;
      }>;
      const scores2 = JSON.parse(version2.evaluationSnapshot) as Array<{
        criterion: string;
        final_score: number;
      }>;

      scoreChanges = generateScoreChanges(scores1, scores2);
    } catch {
      // Skip score comparison if parsing fails
    }
  }

  return {
    from: v1,
    to: v2,
    contentChanges,
    scoreChanges,
  };
}

/**
 * Generate content changes between two markdown documents
 * Simple implementation - identifies section-level changes
 */
function generateContentChanges(
  before: string,
  after: string,
): ContentChange[] {
  const changes: ContentChange[] = [];

  // Extract sections from markdown
  const beforeSections = extractSections(before);
  const afterSections = extractSections(after);

  // Compare sections
  const allSectionNames = new Set([
    ...Object.keys(beforeSections),
    ...Object.keys(afterSections),
  ]);

  for (const sectionName of allSectionNames) {
    const beforeContent = beforeSections[sectionName] || "";
    const afterContent = afterSections[sectionName] || "";

    if (beforeContent !== afterContent) {
      changes.push({
        field: sectionName,
        before: beforeContent.trim().substring(0, 200),
        after: afterContent.trim().substring(0, 200),
      });
    }
  }

  return changes;
}

/**
 * Extract sections from markdown document
 */
function extractSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split("\n");
  let currentSection = "header";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join("\n");
      }

      // Start new section
      currentSection = headingMatch[2]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save final section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join("\n");
  }

  return sections;
}

/**
 * Generate score changes between two evaluation snapshots
 */
function generateScoreChanges(
  before: Array<{ criterion: string; final_score: number }>,
  after: Array<{ criterion: string; final_score: number }>,
): ScoreChange[] {
  const changes: ScoreChange[] = [];

  const beforeMap = new Map(before.map((s) => [s.criterion, s.final_score]));
  const afterMap = new Map(after.map((s) => [s.criterion, s.final_score]));

  const allCriteria = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const criterion of allCriteria) {
    const beforeScore = beforeMap.get(criterion) ?? 0;
    const afterScore = afterMap.get(criterion) ?? 0;
    const delta = afterScore - beforeScore;

    if (Math.abs(delta) >= 0.5) {
      changes.push({
        criterion,
        before: beforeScore,
        after: afterScore,
        delta,
      });
    }
  }

  // Sort by absolute delta (biggest changes first)
  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Format version history for display
 */
export function formatVersionHistory(versions: IdeaVersion[]): string {
  let output = `
╔══════════════════════════════════════════════════════════════╗
║                    VERSION HISTORY                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
`;

  for (const version of versions) {
    const date = version.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const isCurrent = version.versionNumber === versions[0].versionNumber;
    const label = isCurrent ? " (current)" : "";

    output += `║  v${version.versionNumber}${label}  •  ${date}  •  ${version.changeType.padEnd(20)}║\n`;

    if (version.changeSummary) {
      const summary =
        version.changeSummary.length > 50
          ? version.changeSummary.substring(0, 47) + "..."
          : version.changeSummary;
      output += `║      ${summary.padEnd(54)}║\n`;
    }

    output += `║                                                              ║\n`;
  }

  output += `╚══════════════════════════════════════════════════════════════╝`;

  return output;
}

/**
 * Format version diff for display
 */
export function formatVersionDiff(diff: VersionDiff): string {
  let output = `
## Version Comparison: v${diff.from} → v${diff.to}

### Content Changes
`;

  if (diff.contentChanges.length === 0) {
    output += "No significant content changes detected.\n";
  } else {
    for (const change of diff.contentChanges) {
      output += `
**${change.field}**
- Before: ${change.before || "(empty)"}
- After: ${change.after || "(empty)"}
`;
    }
  }

  if (diff.scoreChanges && diff.scoreChanges.length > 0) {
    output += `
### Score Changes
`;
    for (const change of diff.scoreChanges) {
      const direction = change.delta > 0 ? "↑" : "↓";
      const color = change.delta > 0 ? "+" : "";
      output += `- ${change.criterion}: ${change.before.toFixed(1)} → ${change.after.toFixed(1)} (${color}${change.delta.toFixed(1)} ${direction})\n`;
    }
  }

  return output;
}
