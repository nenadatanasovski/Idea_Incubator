/**
 * Lineage & Branching System
 *
 * Allows creating variant ideas that maintain relationship to parent.
 * Tracks full lineage tree for idea families.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { run, query, getOne } from '../database/db.js';
import { logInfo } from '../utils/logger.js';
import { pauseIdea, abandonIdea } from './status.js';
import { createInitialVersionSnapshot } from './versioning.js';
import {
  IdeaLineage,
  IdeaSummary,
  IdeaStatus,
  BranchRequest
} from '../types/incubation.js';

/**
 * Generate a slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Create a branch (variant) of an idea
 */
export async function createBranch(request: BranchRequest): Promise<string> {
  const { parentIdeaId, newTitle, branchReason, parentAction } = request;

  // Get parent idea
  const parent = await getOne<{
    id: string;
    slug: string;
    title: string;
    folder_path: string;
    idea_type: string;
    lifecycle_stage: string;
    current_version: number;
  }>(
    'SELECT id, slug, title, folder_path, idea_type, lifecycle_stage, current_version FROM ideas WHERE id = ?',
    [parentIdeaId]
  );

  if (!parent) {
    throw new Error(`Parent idea not found: ${parentIdeaId}`);
  }

  // Generate slug for new idea
  const baseSlug = generateSlug(newTitle);
  let slug = baseSlug;
  let counter = 1;

  // Check for existing slugs
  while (true) {
    const existing = await getOne<{ id: string }>(
      'SELECT id FROM ideas WHERE slug = ?',
      [slug]
    );
    if (!existing) break;
    slug = `${baseSlug}-${counter++}`;
  }

  // Create folder for new idea
  const ideasDir = path.dirname(parent.folder_path);
  const newFolderPath = path.join(ideasDir, slug);

  if (!fs.existsSync(newFolderPath)) {
    fs.mkdirSync(newFolderPath, { recursive: true });
  }

  // Create README.md with initial content
  const readmeContent = `---
id: ${uuid()}
title: "${newTitle}"
type: ${parent.idea_type}
stage: SPARK
created: ${new Date().toISOString().split('T')[0]}
updated: ${new Date().toISOString().split('T')[0]}
tags: []
summary: "Branched from ${parent.title}"
---

# ${newTitle}

> Branched from [${parent.title}](../${parent.slug}/README.md)
>
> Reason: ${branchReason}

## What's Different

${branchReason}

## Original Context

See parent idea for original context.

## Problem

(To be defined)

## Solution

(To be defined)

## Target User

(To be defined)
`;

  fs.writeFileSync(path.join(newFolderPath, 'README.md'), readmeContent);

  // Create new idea record
  const newIdeaId = uuid();

  await run(
    `INSERT INTO ideas (
      id, slug, title, summary, idea_type, lifecycle_stage,
      folder_path, status, current_version, iteration_number,
      parent_idea_id, branch_reason, incubation_phase,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 1, ?, ?, 'capture', datetime('now'), datetime('now'))`,
    [
      newIdeaId,
      slug,
      newTitle,
      `Branched from ${parent.title}: ${branchReason}`,
      parent.idea_type,
      'SPARK',
      newFolderPath,
      parentIdeaId,
      branchReason
    ]
  );

  // Create initial version snapshot for new idea
  await createInitialVersionSnapshot(newIdeaId);

  // Handle parent action
  switch (parentAction) {
    case 'pause':
      await pauseIdea(parentIdeaId, `Branched to ${slug}`);
      break;
    case 'abandon':
      await abandonIdea(parentIdeaId, `Replaced by ${slug}`);
      break;
    case 'keep_active':
    default:
      // No change to parent
      break;
  }

  logInfo(`Created branch ${slug} from ${parent.slug} (parent action: ${parentAction})`);

  return slug;
}

/**
 * Get full lineage tree for an idea
 */
export async function getLineage(ideaId: string): Promise<IdeaLineage> {
  // Get current idea
  const current = await getIdeaSummary(ideaId);
  if (!current) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  // Get parent (if exists)
  const parentId = await getOne<{ parent_idea_id: string | null }>(
    'SELECT parent_idea_id FROM ideas WHERE id = ?',
    [ideaId]
  );
  let parent: IdeaSummary | undefined;
  if (parentId?.parent_idea_id) {
    parent = await getIdeaSummary(parentId.parent_idea_id) || undefined;
  }

  // Get children
  const childRows = await query<{ id: string }>(
    'SELECT id FROM ideas WHERE parent_idea_id = ?',
    [ideaId]
  );
  const children: IdeaSummary[] = [];
  for (const row of childRows) {
    const child = await getIdeaSummary(row.id);
    if (child) children.push(child);
  }

  // Get all ancestors (follow parent chain)
  const ancestors: IdeaSummary[] = [];
  let ancestorId = parentId?.parent_idea_id;
  while (ancestorId) {
    const ancestor = await getIdeaSummary(ancestorId);
    if (ancestor) {
      ancestors.push(ancestor);
      const nextParent = await getOne<{ parent_idea_id: string | null }>(
        'SELECT parent_idea_id FROM ideas WHERE id = ?',
        [ancestorId]
      );
      ancestorId = nextParent?.parent_idea_id || null;
    } else {
      break;
    }
  }

  return {
    current,
    parent,
    children,
    ancestors
  };
}

/**
 * Get idea summary for lineage display
 */
async function getIdeaSummary(ideaId: string): Promise<IdeaSummary | null> {
  const row = await getOne<{
    id: string;
    slug: string;
    title: string;
    status: string;
    current_version: number;
    branch_reason: string | null;
  }>(
    'SELECT id, slug, title, status, current_version, branch_reason FROM ideas WHERE id = ?',
    [ideaId]
  );

  if (!row) return null;

  // Get latest score if exists
  const scoreRow = await getOne<{ overall_score: number }>(
    `SELECT overall_score FROM final_syntheses
     WHERE idea_id = ? ORDER BY completed_at DESC LIMIT 1`,
    [ideaId]
  );

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status as IdeaStatus,
    currentVersion: row.current_version,
    latestScore: scoreRow?.overall_score,
    branchReason: row.branch_reason || undefined
  };
}

/**
 * Get branch reason for an idea
 */
export async function getBranchReason(ideaId: string): Promise<string | null> {
  const row = await getOne<{ branch_reason: string | null }>(
    'SELECT branch_reason FROM ideas WHERE id = ?',
    [ideaId]
  );
  return row?.branch_reason || null;
}

/**
 * Get all descendants of an idea (children, grandchildren, etc.)
 */
export async function getAllDescendants(ideaId: string): Promise<IdeaSummary[]> {
  const descendants: IdeaSummary[] = [];
  const queue = [ideaId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const children = await query<{ id: string }>(
      'SELECT id FROM ideas WHERE parent_idea_id = ?',
      [currentId]
    );

    for (const child of children) {
      const summary = await getIdeaSummary(child.id);
      if (summary) {
        descendants.push(summary);
        queue.push(child.id);
      }
    }
  }

  return descendants;
}

/**
 * Get root ancestor of an idea
 */
export async function getRootAncestor(ideaId: string): Promise<IdeaSummary | null> {
  let currentId = ideaId;
  let lastSummary: IdeaSummary | null = null;

  while (true) {
    const row = await getOne<{
      id: string;
      parent_idea_id: string | null;
    }>(
      'SELECT id, parent_idea_id FROM ideas WHERE id = ?',
      [currentId]
    );

    if (!row) break;

    const summary = await getIdeaSummary(row.id);
    if (summary) lastSummary = summary;

    if (!row.parent_idea_id) break;
    currentId = row.parent_idea_id;
  }

  return lastSummary;
}

/**
 * Format lineage tree for display
 */
export function formatLineageTree(lineage: IdeaLineage): string {
  const width = 64;
  const border = '═'.repeat(width - 2);

  let output = `
╔${border}╗
║${' '.repeat((width - 18) / 2)}IDEA FAMILY TREE${' '.repeat((width - 18) / 2)}║
╠${border}╣
║${' '.repeat(width - 2)}║
`;

  // Show ancestors (in reverse order - oldest first)
  for (let i = lineage.ancestors.length - 1; i >= 0; i--) {
    const ancestor = lineage.ancestors[i];
    const indent = '  '.repeat(lineage.ancestors.length - i - 1);
    output += formatLineageNode(ancestor, indent, false, width);
    output += `║${' '.repeat(2)}${indent}│${' '.repeat(width - 5 - indent.length)}║\n`;
  }

  // Show parent
  if (lineage.parent) {
    const indent = lineage.ancestors.length > 0 ? '  '.repeat(lineage.ancestors.length) : '';
    output += formatLineageNode(lineage.parent, indent, false, width);
    output += `║${' '.repeat(2)}${indent}│${' '.repeat(width - 5 - indent.length)}║\n`;
  }

  // Show current (highlighted)
  const currentIndent = lineage.parent
    ? '  '.repeat(lineage.ancestors.length + 1)
    : '';
  output += formatLineageNode(lineage.current, currentIndent, true, width);

  // Show children
  if (lineage.children.length > 0) {
    output += `║${' '.repeat(2)}${currentIndent}│${' '.repeat(width - 5 - currentIndent.length)}║\n`;

    for (let i = 0; i < lineage.children.length; i++) {
      const child = lineage.children[i];
      const isLast = i === lineage.children.length - 1;
      const prefix = isLast ? '└──► ' : '├──► ';
      output += formatLineageNode(child, currentIndent + prefix, false, width);

      if (child.branchReason) {
        const reasonText = child.branchReason.length > 40
          ? child.branchReason.substring(0, 37) + '...'
          : child.branchReason;
        output += `║${' '.repeat(4)}${currentIndent}     Reason: ${reasonText}${' '.repeat(Math.max(0, width - 17 - currentIndent.length - reasonText.length))}║\n`;
      }
    }
  }

  output += `║${' '.repeat(width - 2)}║\n`;
  output += `╚${border}╝`;

  return output;
}

/**
 * Format a single lineage node
 */
function formatLineageNode(
  idea: IdeaSummary,
  indent: string,
  isCurrent: boolean,
  width: number
): string {
  const statusBadge = `[${idea.status.toUpperCase()}]`;
  const currentMarker = isCurrent ? ' ← current' : '';
  const name = `${idea.slug} (v${idea.currentVersion})`;

  const firstLine = `${indent}${name} ${statusBadge}${currentMarker}`;
  const truncated = firstLine.length > width - 4
    ? firstLine.substring(0, width - 7) + '...'
    : firstLine;

  let output = `║  ${truncated}${' '.repeat(Math.max(0, width - 4 - truncated.length))}║\n`;

  // Score line
  const scoreLine = idea.latestScore
    ? `${indent}  └─ Score: ${idea.latestScore.toFixed(1)}/10`
    : `${indent}  └─ Score: (not evaluated)`;
  const truncatedScore = scoreLine.length > width - 4
    ? scoreLine.substring(0, width - 7) + '...'
    : scoreLine;
  output += `║  ${truncatedScore}${' '.repeat(Math.max(0, width - 4 - truncatedScore.length))}║\n`;

  return output;
}
