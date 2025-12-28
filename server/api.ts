import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { spawn } from 'child_process';
import { query, getOne, saveDb } from '../database/db.js';
import { initWebSocket, getActiveRooms, getClientCount, emitDebateEvent } from './websocket.js';
import {
  getRelevantQuestions,
  getQuestionById,
  getQuestionStats,
  populateQuestionBank
} from '../questions/loader.js';
import {
  getAnswersForIdea,
  saveAnswer,
  deleteAnswer,
  calculateReadiness,
  calculateCriterionCoverage,
  startDevelopmentSession,
  completeDevelopmentSession,
  getSessionHistory,
  selectNextQuestions,
  getNextQuestionsAfterAnswer,
  getQuestionsForCriterion,
  getBalancedQuestions
} from '../questions/readiness.js';
import {
  generatePreliminaryChallenges,
  generatePreliminarySynthesis
} from '../questions/preliminary-analysis.js';
import type {
  IdeaTypeFilter,
  LifecycleStageFilter,
  QuestionPriority
} from '../questions/types.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Types
interface Idea {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  idea_type: string;
  lifecycle_stage: string;
  content: string | null;
  content_hash: string | null;
  folder_path: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Helper to wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Response helper
function respond<T>(res: Response, data: T): void {
  res.json({ success: true, data } as ApiResponse<T>);
}

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message } as ApiResponse<null>);
});

// ==================== ROUTES ====================

// GET /api/ideas - List all ideas with optional filters
app.get('/api/ideas', asyncHandler(async (req, res) => {
  const { type, stage, tag, search, sortBy = 'updated_at', sortOrder = 'desc' } = req.query;

  let sql = `
    SELECT
      i.*,
      s.avg_score as avg_final_score,
      s.avg_confidence
    FROM ideas i
    LEFT JOIN idea_scores s ON i.id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (type) {
    sql += ' AND i.idea_type = ?';
    params.push(type as string);
  }

  if (stage) {
    sql += ' AND i.lifecycle_stage = ?';
    params.push(stage as string);
  }

  if (search) {
    sql += ' AND (i.title LIKE ? OR i.summary LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  // Sort
  const validSortFields = ['title', 'created_at', 'updated_at', 'score'];
  const sortField = validSortFields.includes(sortBy as string)
    ? (sortBy === 'score' ? 'avg_final_score' : `i.${sortBy}`)
    : 'i.updated_at';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortField} ${order}`;

  const ideas = await query<Idea & { avg_final_score: number | null }>(sql, params);

  // Fetch tags for each idea
  const ideasWithTags = await Promise.all(
    ideas.map(async (idea) => {
      const tags = await query<{ name: string }>(
        `SELECT t.name FROM tags t
         JOIN idea_tags it ON t.id = it.tag_id
         WHERE it.idea_id = ?`,
        [idea.id]
      );
      return { ...idea, tags: tags.map((t) => t.name) };
    })
  );

  // Filter by tag if specified
  const filtered = tag
    ? ideasWithTags.filter((i) => i.tags.includes(tag as string))
    : ideasWithTags;

  respond(res, filtered);
}));

// GET /api/ideas/:slug - Get single idea
app.get('/api/ideas/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<Idea & { avg_final_score: number | null; avg_confidence: number | null }>(
    `SELECT
      i.*,
      s.avg_score as avg_final_score,
      s.avg_confidence
    FROM ideas i
    LEFT JOIN idea_scores s ON i.id = s.id
    WHERE i.slug = ?`,
    [slug]
  );

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Fetch tags
  const tags = await query<{ name: string }>(
    `SELECT t.name FROM tags t
     JOIN idea_tags it ON t.id = it.tag_id
     WHERE it.idea_id = ?`,
    [idea.id]
  );

  // Read content from README.md file
  let content: string | null = null;
  if (idea.folder_path) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const readmePath = path.join(process.cwd(), idea.folder_path, 'README.md');
      const fileContent = await fs.readFile(readmePath, 'utf-8');

      // Extract body content (everything after the frontmatter closing ---)
      const frontmatterEnd = fileContent.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        // Find the title heading and get everything after it
        const afterFrontmatter = fileContent.slice(frontmatterEnd + 3).trim();
        const titleMatch = afterFrontmatter.match(/^#\s+.+\n+/);
        if (titleMatch) {
          content = afterFrontmatter.slice(titleMatch[0].length).trim();
        } else {
          content = afterFrontmatter;
        }
      }
    } catch (err) {
      console.error(`Failed to read README.md for ${slug}:`, err);
    }
  }

  respond(res, { ...idea, content, tags: tags.map((t) => t.name) });
}));

// POST /api/ideas - Create a new idea
app.post('/api/ideas', asyncHandler(async (req, res) => {
  const { title, summary, idea_type, lifecycle_stage, content, tags } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ success: false, error: 'Title is required' });
    return;
  }

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Check if slug already exists
  const existing = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (existing) {
    res.status(409).json({ success: false, error: 'An idea with this title already exists' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dateOnly = now.split('T')[0];
  const folderPath = `ideas/${slug}`;
  const tagsArray = tags && Array.isArray(tags) ? tags : [];

  // Create idea folder and README.md
  const fs = await import('fs/promises');
  const path = await import('path');
  const cryptoModule = await import('crypto');

  const ideaDir = path.join(process.cwd(), folderPath);
  await fs.mkdir(ideaDir, { recursive: true });
  await fs.mkdir(path.join(ideaDir, 'assets'), { recursive: true });
  await fs.mkdir(path.join(ideaDir, 'notes'), { recursive: true });
  await fs.mkdir(path.join(ideaDir, 'research'), { recursive: true });

  // Create README.md with frontmatter
  const readmeContent = `---
id: ${id}
title: ${title.trim()}
type: ${idea_type || 'business'}
stage: ${lifecycle_stage || 'SPARK'}
created: ${dateOnly}
updated: ${dateOnly}
tags: [${tagsArray.map((t: string) => `"${t}"`).join(', ')}]
related: []
summary: "${(summary || '').replace(/"/g, '\\"')}"
---

# ${title.trim()}

${content || `## Overview

*Brief description of the idea.*

## Problem Statement

*What problem does this solve? Who experiences this problem?*

## Proposed Solution

*How does this idea solve the problem?*
`}
`;

  await fs.writeFile(path.join(ideaDir, 'README.md'), readmeContent, 'utf-8');

  // Compute content hash
  const contentHash = cryptoModule.createHash('md5').update(readmeContent).digest('hex');

  await query(
    `INSERT INTO ideas (id, slug, title, summary, idea_type, lifecycle_stage, content_hash, folder_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      title.trim(),
      summary?.trim() || null,
      idea_type || 'business',
      lifecycle_stage || 'SPARK',
      contentHash,
      folderPath,
      now,
      now,
    ]
  );

  // Add tags if provided
  if (tagsArray.length > 0) {
    for (const tagName of tagsArray) {
      let tag = await getOne<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!tag) {
        await query('INSERT INTO tags (name) VALUES (?)', [tagName]);
        tag = await getOne<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
      }
      if (tag) {
        await query('INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)', [id, tag.id]);
      }
    }
  }

  respond(res, { id, slug });
}));

// PUT /api/ideas/:slug - Update an idea
app.put('/api/ideas/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { title, summary, idea_type, lifecycle_stage, content, tags } = req.body;

  const idea = await getOne<{ id: string; folder_path: string }>('SELECT id, folder_path FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const now = new Date().toISOString();
  const dateOnly = now.split('T')[0];
  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title.trim());
  }
  if (summary !== undefined) {
    updates.push('summary = ?');
    params.push(summary?.trim() || null);
  }
  if (idea_type !== undefined) {
    updates.push('idea_type = ?');
    params.push(idea_type);
  }
  if (lifecycle_stage !== undefined) {
    updates.push('lifecycle_stage = ?');
    params.push(lifecycle_stage);
  }

  // Update README.md if content or metadata changed
  if (idea.folder_path) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const cryptoModule = await import('crypto');

    // Get current values
    const currentIdea = await getOne<{
      title: string;
      summary: string | null;
      idea_type: string;
      lifecycle_stage: string;
    }>('SELECT title, summary, idea_type, lifecycle_stage FROM ideas WHERE id = ?', [idea.id]);

    const finalTitle = title !== undefined ? title.trim() : currentIdea?.title || '';
    const finalSummary = summary !== undefined ? (summary?.trim() || '') : (currentIdea?.summary || '');
    const finalType = idea_type !== undefined ? idea_type : (currentIdea?.idea_type || 'business');
    const finalStage = lifecycle_stage !== undefined ? lifecycle_stage : (currentIdea?.lifecycle_stage || 'SPARK');
    const tagsArray = tags !== undefined ? tags : [];

    // Read existing content from file if not provided
    let finalContent = content;
    if (finalContent === undefined) {
      try {
        const readmePath = path.join(process.cwd(), idea.folder_path, 'README.md');
        const existingFile = await fs.readFile(readmePath, 'utf-8');
        // Extract body content (everything after frontmatter and title)
        const frontmatterEnd = existingFile.indexOf('---', 3);
        if (frontmatterEnd !== -1) {
          const afterFrontmatter = existingFile.slice(frontmatterEnd + 3).trim();
          const titleMatch = afterFrontmatter.match(/^#\s+.+\n+/);
          if (titleMatch) {
            finalContent = afterFrontmatter.slice(titleMatch[0].length).trim();
          } else {
            finalContent = afterFrontmatter;
          }
        }
      } catch (err) {
        console.error('Failed to read existing content:', err);
      }
    }

    // Fall back to template only if we couldn't get existing content
    if (!finalContent) {
      finalContent = `## Overview

*Brief description of the idea.*

## Problem Statement

*What problem does this solve? Who experiences this problem?*

## Proposed Solution

*How does this idea solve the problem?*`;
    }

    const readmeContent = `---
id: ${idea.id}
title: ${finalTitle}
type: ${finalType}
stage: ${finalStage}
created: ${dateOnly}
updated: ${dateOnly}
tags: [${tagsArray.map((t: string) => `"${t}"`).join(', ')}]
related: []
summary: "${finalSummary.replace(/"/g, '\\"')}"
---

# ${finalTitle}

${finalContent}
`;

    const readmePath = path.join(process.cwd(), idea.folder_path, 'README.md');
    await fs.writeFile(readmePath, readmeContent, 'utf-8');

    // Update content hash
    const contentHash = cryptoModule.createHash('md5').update(readmeContent).digest('hex');
    updates.push('content_hash = ?');
    params.push(contentHash);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    params.push(now);
    params.push(idea.id);
    await query(`UPDATE ideas SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Update tags if provided
  if (tags !== undefined && Array.isArray(tags)) {
    // Remove existing tags
    await query('DELETE FROM idea_tags WHERE idea_id = ?', [idea.id]);

    // Add new tags
    for (const tagName of tags) {
      let tag = await getOne<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!tag) {
        await query('INSERT INTO tags (name) VALUES (?)', [tagName]);
        tag = await getOne<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
      }
      if (tag) {
        await query('INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)', [idea.id, tag.id]);
      }
    }
  }

  respond(res, { success: true });
}));

// DELETE /api/ideas/:slug - Delete an idea
app.delete('/api/ideas/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Delete related data (cascading should handle this, but being explicit)
  await query('DELETE FROM idea_tags WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM evaluations WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM debate_rounds WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM redteam_log WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM final_syntheses WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM development_log WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM cost_log WHERE idea_id = ?', [idea.id]);
  await query('DELETE FROM ideas WHERE id = ?', [idea.id]);

  respond(res, { success: true });
}));

// PATCH /api/ideas/:slug/stage - Update lifecycle stage only
app.patch('/api/ideas/:slug/stage', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { lifecycle_stage } = req.body;

  if (!lifecycle_stage) {
    res.status(400).json({ success: false, error: 'lifecycle_stage is required' });
    return;
  }

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  await query(
    'UPDATE ideas SET lifecycle_stage = ?, updated_at = ? WHERE id = ?',
    [lifecycle_stage, new Date().toISOString(), idea.id]
  );

  respond(res, { success: true });
}));

// GET /api/ideas/:slug/evaluations - Get evaluations for an idea
app.get('/api/ideas/:slug/evaluations', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = 'SELECT * FROM evaluations WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (runId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(runId as string);
  } else {
    // Get latest run
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    if (latestRun) {
      sql += ' AND evaluation_run_id = ?';
      params.push(latestRun.evaluation_run_id);
    }
  }

  const evaluations = await query(sql, params);
  respond(res, evaluations);
}));

// GET /api/ideas/:slug/category-scores - Get category scores
app.get('/api/ideas/:slug/category-scores', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Determine run_id
  let targetRunId = runId as string;
  if (!targetRunId) {
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    targetRunId = latestRun?.evaluation_run_id || '';
  }

  if (!targetRunId) {
    respond(res, []);
    return;
  }

  // Get all evaluations for this run
  const evaluations = await query<{
    category: string;
    criterion: string;
    final_score: number;
    confidence: number;
    reasoning: string;
  }>(
    `SELECT category, criterion, final_score, confidence, reasoning
     FROM evaluations
     WHERE idea_id = ? AND evaluation_run_id = ?
     ORDER BY category, criterion`,
    [idea.id, targetRunId]
  );

  // Group by category and calculate averages
  const categoryMap = new Map<string, { scores: number[]; confidences: number[]; criteria: typeof evaluations }>();

  for (const eval_ of evaluations) {
    if (!categoryMap.has(eval_.category)) {
      categoryMap.set(eval_.category, { scores: [], confidences: [], criteria: [] });
    }
    const cat = categoryMap.get(eval_.category)!;
    cat.scores.push(eval_.final_score);
    cat.confidences.push(eval_.confidence);
    cat.criteria.push(eval_);
  }

  const categoryScores = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    avg_score: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    avg_confidence: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length,
    criteria: data.criteria,
  }));

  respond(res, categoryScores);
}));

// GET /api/ideas/:slug/evaluation-runs - Get all evaluation runs for an idea
app.get('/api/ideas/:slug/evaluation-runs', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const runs = await query<{ evaluation_run_id: string }>(
    'SELECT DISTINCT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC',
    [idea.id]
  );

  respond(res, runs.map((r) => r.evaluation_run_id));
}));

// GET /api/ideas/:slug/debates - Get debate rounds
app.get('/api/ideas/:slug/debates', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = 'SELECT * FROM debate_rounds WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (runId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(runId as string);
  }

  sql += ' ORDER BY round_number';

  const rounds = await query(sql, params);
  respond(res, rounds);
}));

// GET /api/ideas/:slug/redteam - Get red team challenges
app.get('/api/ideas/:slug/redteam', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = 'SELECT * FROM redteam_log WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (runId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(runId as string);
  }

  sql += ' ORDER BY logged_at';

  const challenges = await query(sql, params);

  // If no evaluation challenges exist, generate preliminary analysis
  if (challenges.length === 0) {
    const preliminaryChallenges = await generatePreliminaryChallenges(idea.id);
    respond(res, preliminaryChallenges.map(c => ({
      ...c,
      is_preliminary: true
    })));
    return;
  }

  respond(res, challenges);
}));

// GET /api/ideas/:slug/synthesis - Get final synthesis
app.get('/api/ideas/:slug/synthesis', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = 'SELECT * FROM final_syntheses WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (runId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(runId as string);
  }

  sql += ' ORDER BY completed_at DESC LIMIT 1';

  const synthesis = await getOne<{
    key_strengths: string;
    key_weaknesses: string;
    critical_assumptions: string;
    unresolved_questions: string;
    [key: string]: unknown;
  }>(sql, params);

  if (synthesis) {
    // Parse JSON arrays
    respond(res, {
      ...synthesis,
      key_strengths: JSON.parse(synthesis.key_strengths || '[]'),
      key_weaknesses: JSON.parse(synthesis.key_weaknesses || '[]'),
      critical_assumptions: JSON.parse(synthesis.critical_assumptions || '[]'),
      unresolved_questions: JSON.parse(synthesis.unresolved_questions || '[]'),
      is_preliminary: false
    });
  } else {
    // Generate preliminary synthesis if no full evaluation exists
    const preliminarySynthesis = await generatePreliminarySynthesis(idea.id);
    respond(res, preliminarySynthesis);
  }
}));

// GET /api/ideas/:slug/development - Get development log
app.get('/api/ideas/:slug/development', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const log = await query(
    'SELECT * FROM development_log WHERE idea_id = ? ORDER BY created_at',
    [idea.id]
  );
  respond(res, log);
}));

// GET /api/ideas/:slug/relationships - Get idea relationships
app.get('/api/ideas/:slug/relationships', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const relationships = await query(
    `SELECT ir.*, i.title as target_title, i.slug as target_slug
     FROM idea_relationships ir
     JOIN ideas i ON ir.target_idea_id = i.id
     WHERE ir.source_idea_id = ?`,
    [idea.id]
  );
  respond(res, relationships);
}));

// GET /api/ideas/:slug/costs - Get cost log
app.get('/api/ideas/:slug/costs', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const costs = await query(
    'SELECT * FROM cost_log WHERE idea_id = ? ORDER BY timestamp',
    [idea.id]
  );
  respond(res, costs);
}));

// GET /api/ideas/:slug/costs/total - Get total costs
app.get('/api/ideas/:slug/costs/total', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const total = await getOne<{ total: number }>(
    'SELECT SUM(estimated_cost) as total FROM cost_log WHERE idea_id = ?',
    [idea.id]
  );

  const byOperation = await query<{ operation: string; total: number }>(
    'SELECT operation, SUM(estimated_cost) as total FROM cost_log WHERE idea_id = ? GROUP BY operation',
    [idea.id]
  );

  respond(res, {
    total: total?.total || 0,
    byAgent: Object.fromEntries(byOperation.map((a) => [a.operation, a.total])),
  });
}));

// GET /api/stats - Get overall statistics
app.get('/api/stats', asyncHandler(async (_req, res) => {
  const totalIdeas = await getOne<{ count: number }>('SELECT COUNT(*) as count FROM ideas');

  const byType = await query<{ idea_type: string; count: number }>(
    'SELECT idea_type, COUNT(*) as count FROM ideas GROUP BY idea_type'
  );

  const byStage = await query<{ lifecycle_stage: string; count: number }>(
    'SELECT lifecycle_stage, COUNT(*) as count FROM ideas GROUP BY lifecycle_stage'
  );

  const avgScore = await getOne<{ avg: number }>(
    'SELECT AVG(avg_score) as avg FROM idea_scores WHERE avg_score IS NOT NULL'
  );

  const totalCost = await getOne<{ total: number }>('SELECT SUM(estimated_cost) as total FROM cost_log');

  respond(res, {
    totalIdeas: totalIdeas?.count || 0,
    byType: Object.fromEntries(byType.map((t) => [t.idea_type, t.count])),
    byStage: Object.fromEntries(byStage.map((s) => [s.lifecycle_stage, s.count])),
    avgScore: avgScore?.avg || 0,
    totalCost: totalCost?.total || 0,
  });
}));

// ==================== EXPORT ENDPOINTS ====================

// GET /api/export/ideas - Export all ideas as JSON
app.get('/api/export/ideas', asyncHandler(async (_req, res) => {
  const ideas = await query<Idea>(
    `SELECT i.*, s.avg_score as avg_final_score, s.avg_confidence
     FROM ideas i
     LEFT JOIN idea_scores s ON i.id = s.id
     ORDER BY i.updated_at DESC`
  );

  const fullExport = await Promise.all(
    ideas.map(async (idea) => {
      // Get tags
      const tags = await query<{ name: string }>(
        `SELECT t.name FROM tags t
         JOIN idea_tags it ON t.id = it.tag_id
         WHERE it.idea_id = ?`,
        [idea.id]
      );

      // Get evaluations
      const evaluations = await query(
        `SELECT criterion, category, final_score, confidence, reasoning
         FROM evaluations
         WHERE idea_id = ?
         ORDER BY category, criterion`,
        [idea.id]
      );

      // Get synthesis
      const synthesis = await getOne<{
        overall_score: number;
        recommendation: string;
        executive_summary: string;
        key_strengths: string;
        key_weaknesses: string;
      }>(
        `SELECT overall_score, recommendation, executive_summary, key_strengths, key_weaknesses
         FROM final_syntheses
         WHERE idea_id = ?
         ORDER BY completed_at DESC LIMIT 1`,
        [idea.id]
      );

      return {
        ...idea,
        tags: tags.map((t) => t.name),
        evaluations,
        synthesis: synthesis
          ? {
              ...synthesis,
              key_strengths: JSON.parse(synthesis.key_strengths || '[]'),
              key_weaknesses: JSON.parse(synthesis.key_weaknesses || '[]'),
            }
          : null,
      };
    })
  );

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="ideas-export-${new Date().toISOString().split('T')[0]}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: '1.0',
    ideas: fullExport,
  });
}));

// GET /api/export/ideas/:slug - Export single idea as JSON
app.get('/api/export/ideas/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<Idea & { avg_final_score: number | null; avg_confidence: number | null }>(
    `SELECT i.*, s.avg_score as avg_final_score, s.avg_confidence
     FROM ideas i
     LEFT JOIN idea_scores s ON i.id = s.id
     WHERE i.slug = ?`,
    [slug]
  );

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get all related data
  const tags = await query<{ name: string }>(
    `SELECT t.name FROM tags t
     JOIN idea_tags it ON t.id = it.tag_id
     WHERE it.idea_id = ?`,
    [idea.id]
  );

  const evaluations = await query(
    `SELECT criterion, category, final_score, confidence, reasoning, evaluated_at
     FROM evaluations
     WHERE idea_id = ?
     ORDER BY category, criterion`,
    [idea.id]
  );

  const redteam = await query(
    `SELECT persona, criterion, challenge, severity, addressed, resolution
     FROM redteam_log
     WHERE idea_id = ?`,
    [idea.id]
  );

  const debates = await query(
    `SELECT criterion, round_number, evaluator_claim, redteam_challenge, arbiter_verdict
     FROM debate_rounds
     WHERE idea_id = ?
     ORDER BY criterion, round_number`,
    [idea.id]
  );

  const synthesis = await getOne<{
    overall_score: number;
    recommendation: string;
    executive_summary: string;
    key_strengths: string;
    key_weaknesses: string;
    critical_assumptions: string;
    unresolved_questions: string;
  }>(
    `SELECT * FROM final_syntheses WHERE idea_id = ? ORDER BY completed_at DESC LIMIT 1`,
    [idea.id]
  );

  const development = await query(
    `SELECT question, answer, source, created_at
     FROM development_log
     WHERE idea_id = ?
     ORDER BY created_at`,
    [idea.id]
  );

  const relationships = await query(
    `SELECT ir.relationship_type, i.title, i.slug
     FROM idea_relationships ir
     JOIN ideas i ON ir.target_idea_id = i.id
     WHERE ir.source_idea_id = ?`,
    [idea.id]
  );

  const costs = await query(
    `SELECT operation, input_tokens, output_tokens, estimated_cost, timestamp
     FROM cost_log
     WHERE idea_id = ?
     ORDER BY timestamp`,
    [idea.id]
  );

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}-export.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: '1.0',
    idea: {
      ...idea,
      tags: tags.map((t) => t.name),
    },
    evaluations,
    redteam,
    debates,
    synthesis: synthesis
      ? {
          ...synthesis,
          key_strengths: JSON.parse(synthesis.key_strengths || '[]'),
          key_weaknesses: JSON.parse(synthesis.key_weaknesses || '[]'),
          critical_assumptions: JSON.parse(synthesis.critical_assumptions || '[]'),
          unresolved_questions: JSON.parse(synthesis.unresolved_questions || '[]'),
        }
      : null,
    development,
    relationships,
    costs,
  });
}));

// ==================== IMPORT ENDPOINTS ====================

// POST /api/import - Import ideas from JSON
app.post('/api/import', asyncHandler(async (req, res) => {
  const data = req.body;

  if (!data || !data.ideas || !Array.isArray(data.ideas)) {
    res.status(400).json({ success: false, error: 'Invalid import format. Expected { ideas: [...] }' });
    return;
  }

  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const ideaData of data.ideas) {
    try {
      // Check if idea already exists
      const existing = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [ideaData.slug]);

      if (existing) {
        results.skipped++;
        continue;
      }

      // Generate new ID
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const dateOnly = now.split('T')[0];
      const folderPath = `ideas/${ideaData.slug}`;

      // Create folder structure
      const fs = await import('fs/promises');
      const path = await import('path');
      const cryptoModule = await import('crypto');

      const ideaDir = path.join(process.cwd(), folderPath);
      await fs.mkdir(ideaDir, { recursive: true });
      await fs.mkdir(path.join(ideaDir, 'assets'), { recursive: true });
      await fs.mkdir(path.join(ideaDir, 'notes'), { recursive: true });
      await fs.mkdir(path.join(ideaDir, 'research'), { recursive: true });

      const tagsArray = ideaData.tags && Array.isArray(ideaData.tags) ? ideaData.tags : [];

      const readmeContent = `---
id: ${id}
title: ${ideaData.title}
type: ${ideaData.idea_type || 'business'}
stage: ${ideaData.lifecycle_stage || 'SPARK'}
created: ${dateOnly}
updated: ${dateOnly}
tags: [${tagsArray.map((t: string) => `"${t}"`).join(', ')}]
related: []
summary: "${(ideaData.summary || '').replace(/"/g, '\\"')}"
---

# ${ideaData.title}

${ideaData.content || '## Overview\n\n*Imported idea.*'}
`;

      await fs.writeFile(path.join(ideaDir, 'README.md'), readmeContent, 'utf-8');
      const contentHash = cryptoModule.createHash('md5').update(readmeContent).digest('hex');

      // Insert idea
      await query(
        `INSERT INTO ideas (id, slug, title, summary, idea_type, lifecycle_stage, content_hash, folder_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          ideaData.slug,
          ideaData.title,
          ideaData.summary || null,
          ideaData.idea_type || 'business',
          ideaData.lifecycle_stage || 'SPARK',
          contentHash,
          folderPath,
          ideaData.created_at || now,
          now,
        ]
      );

      // Import tags
      if (ideaData.tags && Array.isArray(ideaData.tags)) {
        for (const tagName of ideaData.tags) {
          // Get or create tag
          let tag = await getOne<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
          if (!tag) {
            await query('INSERT INTO tags (name) VALUES (?)', [tagName]);
            tag = await getOne<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
          }
          if (tag) {
            await query(
              'INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)',
              [id, tag.id]
            );
          }
        }
      }

      // Import evaluations
      if (ideaData.evaluations && Array.isArray(ideaData.evaluations)) {
        const runId = crypto.randomUUID();
        for (const eval_ of ideaData.evaluations) {
          await query(
            `INSERT INTO evaluations
             (id, idea_id, evaluation_run_id, criterion, category, agent_score, final_score, confidence, reasoning, evaluated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              id,
              runId,
              eval_.criterion,
              eval_.category,
              eval_.final_score,
              eval_.final_score,
              eval_.confidence || 0.7,
              eval_.reasoning || '',
              now,
            ]
          );
        }
      }

      results.imported++;
    } catch (error) {
      results.errors.push(`Failed to import ${ideaData.slug}: ${(error as Error).message}`);
    }
  }

  respond(res, results);
}));

// GET /api/export/csv - Export all ideas as CSV
app.get('/api/export/csv', asyncHandler(async (_req, res) => {
  const ideas = await query<Idea & { avg_final_score: number | null; avg_confidence: number | null }>(
    `SELECT i.*, s.avg_score as avg_final_score, s.avg_confidence
     FROM ideas i
     LEFT JOIN idea_scores s ON i.id = s.id
     ORDER BY i.updated_at DESC`
  );

  // Get category scores for each idea
  const ideasWithScores = await Promise.all(
    ideas.map(async (idea) => {
      const categoryScores = await query<{ category: string; avg_score: number }>(
        `SELECT category, AVG(final_score) as avg_score
         FROM evaluations
         WHERE idea_id = ?
         GROUP BY category`,
        [idea.id]
      );

      const scores: Record<string, number> = {};
      for (const cs of categoryScores) {
        scores[cs.category] = cs.avg_score;
      }

      const tags = await query<{ name: string }>(
        `SELECT t.name FROM tags t
         JOIN idea_tags it ON t.id = it.tag_id
         WHERE it.idea_id = ?`,
        [idea.id]
      );

      return {
        ...idea,
        tags: tags.map((t) => t.name).join(';'),
        problem_score: scores.problem ?? '',
        solution_score: scores.solution ?? '',
        feasibility_score: scores.feasibility ?? '',
        fit_score: scores.fit ?? '',
        market_score: scores.market ?? '',
        risk_score: scores.risk ?? '',
      };
    })
  );

  // Build CSV
  const headers = [
    'slug',
    'title',
    'summary',
    'idea_type',
    'lifecycle_stage',
    'overall_score',
    'confidence',
    'problem_score',
    'solution_score',
    'feasibility_score',
    'fit_score',
    'market_score',
    'risk_score',
    'tags',
    'created_at',
    'updated_at',
  ];

  const escapeCSV = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = ideasWithScores.map((idea) =>
    headers
      .map((h) => {
        if (h === 'overall_score') return escapeCSV(idea.avg_final_score);
        if (h === 'confidence') return escapeCSV(idea.avg_confidence);
        return escapeCSV((idea as Record<string, unknown>)[h]);
      })
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ideas-export-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
}));

// GET /api/debate/active - Get active debate rooms
app.get('/api/debate/active', asyncHandler(async (_req, res) => {
  const rooms = getActiveRooms();
  const roomInfo = rooms.map((slug) => ({
    slug,
    clients: getClientCount(slug),
  }));
  respond(res, roomInfo);
}));

// GET /api/debate/:slug/status - Get debate status for an idea
app.get('/api/debate/:slug/status', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const clients = getClientCount(slug);
  respond(res, {
    slug,
    clients,
    isActive: clients > 0,
  });
}));

// GET /api/debates - Get all debate sessions (including evaluation-only sessions)
app.get('/api/debates', asyncHandler(async (_req, res) => {
  // First, get sessions from evaluation_events table (captures all evaluation runs)
  const eventSessions = await query<{
    session_id: string;
    idea_id: string;
    started_at: string;
    latest_at: string;
  }>(
    `SELECT
      session_id,
      idea_id,
      MIN(created_at) as started_at,
      MAX(created_at) as latest_at
    FROM evaluation_events
    GROUP BY session_id, idea_id`
  );

  // Build a comprehensive list of sessions
  const sessions = await Promise.all(
    eventSessions.map(async (es) => {
      // Get idea info
      const idea = await getOne<{ slug: string; title: string }>(
        'SELECT slug, title FROM ideas WHERE id = ?',
        [es.idea_id]
      );

      if (!idea) return null;

      // Get debate round counts for this session
      const roundInfo = await getOne<{ round_count: number; criterion_count: number }>(
        `SELECT
          COUNT(*) as round_count,
          COUNT(DISTINCT criterion) as criterion_count
        FROM debate_rounds
        WHERE evaluation_run_id = ?`,
        [es.session_id]
      );

      // Check if synthesis exists (indicates completion)
      const synthesis = await getOne<{ id: number }>(
        'SELECT id FROM final_syntheses WHERE evaluation_run_id = ?',
        [es.session_id]
      );

      // Determine status based on what data exists
      let status: 'complete' | 'in-progress' | 'evaluation-only';
      if (synthesis) {
        status = 'complete';
      } else if (roundInfo && roundInfo.round_count > 0) {
        status = 'in-progress';
      } else {
        status = 'evaluation-only';
      }

      return {
        evaluation_run_id: es.session_id,
        idea_id: es.idea_id,
        idea_slug: idea.slug,
        idea_title: idea.title,
        round_count: roundInfo?.round_count || 0,
        criterion_count: roundInfo?.criterion_count || 0,
        started_at: es.started_at,
        latest_at: es.latest_at,
        status
      };
    })
  );

  // Filter out nulls and sort by latest_at descending
  const validSessions = sessions
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime());

  respond(res, validSessions);
}));

// GET /api/debates/:runId - Get a specific debate session
app.get('/api/debates/:runId', asyncHandler(async (req, res) => {
  const { runId } = req.params;

  // Get session info
  const session = await getOne<{
    evaluation_run_id: string;
    idea_id: string;
    idea_slug: string;
    idea_title: string;
  }>(
    `SELECT
      d.evaluation_run_id,
      d.idea_id,
      i.slug as idea_slug,
      i.title as idea_title
    FROM debate_rounds d
    JOIN ideas i ON d.idea_id = i.id
    WHERE d.evaluation_run_id = ?
    LIMIT 1`,
    [runId]
  );

  if (!session) {
    res.status(404).json({ success: false, error: 'Debate session not found' });
    return;
  }

  // Get all rounds for this session
  const rounds = await query<{
    id: number;
    round_number: number;
    criterion: string;
    challenge_number: number;
    evaluator_claim: string | null;
    redteam_persona: string | null;
    redteam_challenge: string | null;
    evaluator_defense: string | null;
    arbiter_verdict: string | null;
    first_principles_bonus: boolean;
    score_adjustment: number;
    timestamp: string;
  }>(
    `SELECT * FROM debate_rounds
     WHERE evaluation_run_id = ?
     ORDER BY criterion, round_number, challenge_number`,
    [runId]
  );

  // Get red team challenges for this session
  const redteamChallenges = await query(
    `SELECT * FROM redteam_log
     WHERE evaluation_run_id = ?
     ORDER BY logged_at`,
    [runId]
  );

  // Get synthesis if available
  const synthesis = await getOne<{
    overall_score: number;
    recommendation: string;
    executive_summary: string;
    key_strengths: string;
    key_weaknesses: string;
  }>(
    `SELECT overall_score, recommendation, executive_summary, key_strengths, key_weaknesses
     FROM final_syntheses
     WHERE evaluation_run_id = ?
     ORDER BY completed_at DESC LIMIT 1`,
    [runId]
  );

  // Get API call count from the latest budget:status event
  const budgetEvent = await getOne<{ event_data: string }>(
    `SELECT event_data FROM evaluation_events
     WHERE session_id = ? AND event_type = 'budget:status'
     ORDER BY created_at DESC LIMIT 1`,
    [runId]
  );
  let apiCalls: number | undefined;
  if (budgetEvent) {
    try {
      const eventData = JSON.parse(budgetEvent.event_data);
      apiCalls = eventData.apiCalls;
    } catch {
      // Ignore parse errors
    }
  }

  respond(res, {
    ...session,
    rounds,
    redteamChallenges,
    apiCalls,
    synthesis: synthesis
      ? {
          ...synthesis,
          key_strengths: JSON.parse(synthesis.key_strengths || '[]'),
          key_weaknesses: JSON.parse(synthesis.key_weaknesses || '[]'),
        }
      : null,
  });
}));

// POST /api/ideas/:slug/evaluate - Trigger evaluation for an idea
app.post('/api/ideas/:slug/evaluate', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { budget = 15, mode = 'v2', skipDebate = false, unlimited = false } = req.body;

  // Check if idea exists
  const idea = await getOne<{ id: string; title: string }>('SELECT id, title FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Generate a run ID
  const runId = crypto.randomUUID();

  // Emit start event to WebSocket
  emitDebateEvent('debate:started', slug, runId, {
    message: `Starting evaluation for: ${idea.title}`,
  });

  // Spawn the evaluation process in the background
  const args = ['scripts/evaluate.ts', slug, '--budget', String(budget), '--mode', mode, '--force'];
  if (skipDebate) {
    args.push('--skip-debate');
  }
  if (unlimited) {
    args.push('--unlimited');
  }

  console.log(`[Evaluate] Starting: npx tsx ${args.join(' ')}`);

  const child = spawn('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
    env: { ...process.env }, // Explicitly pass environment (includes ANTHROPIC_API_KEY)
  });

  // Log output for debugging
  child.stdout?.on('data', (data) => {
    console.log(`[Evaluate stdout] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', (data) => {
    console.error(`[Evaluate stderr] ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error(`[Evaluate error] Failed to start: ${err.message}`);
    emitDebateEvent('error', slug, runId, { error: err.message });
  });

  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`[Evaluate] Exited with code ${code}, signal ${signal}`);
      emitDebateEvent('error', slug, runId, { error: `Evaluation process exited with code ${code}` });
    } else {
      console.log(`[Evaluate] Completed successfully`);
    }
  });

  // Don't wait for the child process
  child.unref();

  respond(res, {
    message: 'Evaluation started',
    runId,
    slug,
  });
}));

// POST /api/internal/broadcast - Internal endpoint for evaluation script to emit events
app.post('/api/internal/broadcast', asyncHandler(async (req, res) => {
  const { type, ideaSlug, runId, data } = req.body;

  if (!type || !ideaSlug || !runId) {
    res.status(400).json({ success: false, error: 'Missing required fields: type, ideaSlug, runId' });
    return;
  }

  // Get idea ID for database storage
  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [ideaSlug]);

  // Persist event to database for replay capability
  if (idea) {
    try {
      await query(
        `INSERT INTO evaluation_events (session_id, idea_id, event_type, event_data, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [runId, idea.id, type, JSON.stringify(data || {}), new Date().toISOString()]
      );
    } catch (err) {
      console.error('Failed to persist event:', err);
      // Don't fail the broadcast if persistence fails
    }
  }

  emitDebateEvent(type, ideaSlug, runId, data || {});
  respond(res, { success: true });
}));

// GET /api/ideas/:slug/events - Get evaluation events for replay
app.get('/api/ideas/:slug/events', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { sessionId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = `
    SELECT session_id, event_type, event_data, created_at
    FROM evaluation_events
    WHERE idea_id = ?
  `;
  const params: (string | number)[] = [idea.id];

  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId as string);
  }

  sql += ' ORDER BY created_at ASC';

  const events = await query<{
    session_id: string;
    event_type: string;
    event_data: string;
    created_at: string;
  }>(sql, params);

  // Parse event_data JSON
  const parsedEvents = events.map(e => ({
    ...e,
    event_data: JSON.parse(e.event_data || '{}'),
  }));

  respond(res, parsedEvents);
}));

// GET /api/ideas/:slug/events/sessions - Get list of event sessions
app.get('/api/ideas/:slug/events/sessions', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const sessions = await query<{
    session_id: string;
    event_count: number;
    started_at: string;
    ended_at: string;
  }>(
    `SELECT
      session_id,
      COUNT(*) as event_count,
      MIN(created_at) as started_at,
      MAX(created_at) as ended_at
    FROM evaluation_events
    WHERE idea_id = ?
    GROUP BY session_id
    ORDER BY started_at DESC`,
    [idea.id]
  );

  respond(res, sessions);
}));

// GET /api/ideas/:slug/evaluate/status - Check if evaluation is in progress
app.get('/api/ideas/:slug/evaluate/status', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Check for recent evaluations (within last 10 minutes = in progress)
  const recentEval = await getOne<{ evaluation_run_id: string; evaluated_at: string }>(
    `SELECT evaluation_run_id, MAX(evaluated_at) as evaluated_at
     FROM evaluations
     WHERE idea_id = ?
     GROUP BY evaluation_run_id
     ORDER BY evaluated_at DESC
     LIMIT 1`,
    [idea.id]
  );

  // Check WebSocket connections (indicates active viewers)
  const activeClients = getClientCount(slug);

  respond(res, {
    hasEvaluations: !!recentEval,
    lastRunId: recentEval?.evaluation_run_id || null,
    lastEvaluatedAt: recentEval?.evaluated_at || null,
    activeViewers: activeClients,
  });
}));

// ==================== PROFILE ENDPOINTS ====================

// GET /api/profiles - List all user profiles
app.get('/api/profiles', asyncHandler(async (_req, res) => {
  const profiles = await query<{
    id: string;
    name: string;
    slug: string;
    primary_goals: string;
    success_definition: string | null;
    interests: string | null;
    motivations: string | null;
    technical_skills: string | null;
    professional_experience: string | null;
    domain_expertise: string | null;
    industry_connections: string | null;
    professional_network: string | null;
    employment_status: string | null;
    weekly_hours_available: number | null;
    financial_runway_months: number | null;
    risk_tolerance: string | null;
    other_commitments: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM user_profiles ORDER BY updated_at DESC');

  respond(res, profiles);
}));

// GET /api/profiles/:id - Get single profile
app.get('/api/profiles/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const profile = await getOne<{
    id: string;
    name: string;
    slug: string;
    [key: string]: unknown;
  }>('SELECT * FROM user_profiles WHERE id = ?', [id]);

  if (!profile) {
    res.status(404).json({ success: false, error: 'Profile not found' });
    return;
  }

  respond(res, profile);
}));

// GET /api/profiles/:id/ideas - Get ideas linked to a profile
app.get('/api/profiles/:id/ideas', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ideas = await query<{ id: string; title: string; slug: string }>(
    `SELECT i.id, i.title, i.slug
     FROM ideas i
     JOIN idea_profiles ip ON i.id = ip.idea_id
     WHERE ip.profile_id = ?
     ORDER BY i.title`,
    [id]
  );

  respond(res, ideas);
}));

// POST /api/profiles - Create new profile
app.post('/api/profiles', asyncHandler(async (req, res) => {
  const {
    name,
    // Geographic
    country,
    city,
    timezone,
    // Financial
    currency,
    current_monthly_income,
    target_monthly_income,
    monthly_expenses,
    available_capital,
    total_savings,
    // Demographics
    age_range,
    dependents,
    education_level,
    education_field,
    // FT1-FT5 fields
    primary_goals,
    success_definition,
    interests,
    motivations,
    technical_skills,
    professional_experience,
    domain_expertise,
    industry_connections,
    professional_network,
    // Communication & Reach
    languages,
    social_media_following,
    existing_audience,
    // Resources
    has_investor_access,
    has_existing_customers,
    resource_notes,
    // Life stage
    employment_status,
    weekly_hours_available,
    financial_runway_months,
    risk_tolerance,
    other_commitments,
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ success: false, error: 'Name is required' });
    return;
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Check if slug already exists
  const existing = await getOne<{ id: string }>('SELECT id FROM user_profiles WHERE slug = ?', [slug]);
  if (existing) {
    res.status(409).json({ success: false, error: 'A profile with this name already exists' });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO user_profiles (
      id, name, slug,
      country, city, timezone,
      currency, current_monthly_income, target_monthly_income, monthly_expenses, available_capital, total_savings,
      age_range, dependents, education_level, education_field,
      primary_goals, success_definition, interests, motivations,
      technical_skills, professional_experience, domain_expertise, industry_connections,
      professional_network, languages, social_media_following, existing_audience,
      has_investor_access, has_existing_customers, resource_notes,
      employment_status, weekly_hours_available, financial_runway_months,
      risk_tolerance, other_commitments, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name.trim(),
      slug,
      country || null,
      city || null,
      timezone || null,
      currency || 'USD',
      current_monthly_income ?? null,
      target_monthly_income ?? null,
      monthly_expenses ?? null,
      available_capital ?? null,
      total_savings ?? null,
      age_range || null,
      dependents ?? 0,
      education_level || null,
      education_field || null,
      primary_goals || '[]',
      success_definition || null,
      interests || '[]',
      motivations || null,
      technical_skills || '[]',
      professional_experience || null,
      domain_expertise || null,
      industry_connections || '[]',
      professional_network || null,
      languages || '[]',
      social_media_following ?? null,
      existing_audience || null,
      has_investor_access ? 1 : 0,
      has_existing_customers ? 1 : 0,
      resource_notes || null,
      employment_status || null,
      weekly_hours_available ?? null,
      financial_runway_months ?? null,
      risk_tolerance || null,
      other_commitments || null,
      now,
      now,
    ]
  );

  respond(res, { id, slug });
}));

// PUT /api/profiles/:id - Update profile
app.put('/api/profiles/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    // Geographic
    country,
    city,
    timezone,
    // Financial
    currency,
    current_monthly_income,
    target_monthly_income,
    monthly_expenses,
    available_capital,
    total_savings,
    // Demographics
    age_range,
    dependents,
    education_level,
    education_field,
    // FT1-FT5 fields
    primary_goals,
    success_definition,
    interests,
    motivations,
    technical_skills,
    professional_experience,
    domain_expertise,
    industry_connections,
    professional_network,
    // Communication & Reach
    languages,
    social_media_following,
    existing_audience,
    // Resources
    has_investor_access,
    has_existing_customers,
    resource_notes,
    // Life stage
    employment_status,
    weekly_hours_available,
    financial_runway_months,
    risk_tolerance,
    other_commitments,
  } = req.body;

  const existing = await getOne<{ id: string }>('SELECT id FROM user_profiles WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Profile not found' });
    return;
  }

  const now = new Date().toISOString();

  await query(
    `UPDATE user_profiles SET
      name = ?, country = ?, city = ?, timezone = ?,
      currency = ?, current_monthly_income = ?, target_monthly_income = ?, monthly_expenses = ?, available_capital = ?, total_savings = ?,
      age_range = ?, dependents = ?, education_level = ?, education_field = ?,
      primary_goals = ?, success_definition = ?, interests = ?, motivations = ?,
      technical_skills = ?, professional_experience = ?, domain_expertise = ?, industry_connections = ?,
      professional_network = ?, languages = ?, social_media_following = ?, existing_audience = ?,
      has_investor_access = ?, has_existing_customers = ?, resource_notes = ?,
      employment_status = ?, weekly_hours_available = ?, financial_runway_months = ?,
      risk_tolerance = ?, other_commitments = ?, updated_at = ?
     WHERE id = ?`,
    [
      name?.trim(),
      country || null,
      city || null,
      timezone || null,
      currency || 'USD',
      current_monthly_income ?? null,
      target_monthly_income ?? null,
      monthly_expenses ?? null,
      available_capital ?? null,
      total_savings ?? null,
      age_range || null,
      dependents ?? 0,
      education_level || null,
      education_field || null,
      primary_goals || '[]',
      success_definition || null,
      interests || '[]',
      motivations || null,
      technical_skills || '[]',
      professional_experience || null,
      domain_expertise || null,
      industry_connections || '[]',
      professional_network || null,
      languages || '[]',
      social_media_following ?? null,
      existing_audience || null,
      has_investor_access ? 1 : 0,
      has_existing_customers ? 1 : 0,
      resource_notes || null,
      employment_status || null,
      weekly_hours_available ?? null,
      financial_runway_months ?? null,
      risk_tolerance || null,
      other_commitments || null,
      now,
      id,
    ]
  );

  respond(res, { success: true });
}));

// DELETE /api/profiles/:id - Delete profile
app.delete('/api/profiles/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await getOne<{ id: string }>('SELECT id FROM user_profiles WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ success: false, error: 'Profile not found' });
    return;
  }

  // Delete linked ideas first
  await query('DELETE FROM idea_profiles WHERE profile_id = ?', [id]);
  // Delete profile
  await query('DELETE FROM user_profiles WHERE id = ?', [id]);

  respond(res, { success: true });
}));

// POST /api/profiles/:profileId/link/:ideaSlug - Link profile to idea
app.post('/api/profiles/:profileId/link/:ideaSlug', asyncHandler(async (req, res) => {
  const { profileId, ideaSlug } = req.params;

  const profile = await getOne<{ id: string }>('SELECT id FROM user_profiles WHERE id = ?', [profileId]);
  if (!profile) {
    res.status(404).json({ success: false, error: 'Profile not found' });
    return;
  }

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [ideaSlug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Check if already linked
  const existingLink = await getOne<{ idea_id: string }>(
    'SELECT idea_id FROM idea_profiles WHERE idea_id = ? AND profile_id = ?',
    [idea.id, profileId]
  );

  if (!existingLink) {
    await query(
      'INSERT INTO idea_profiles (idea_id, profile_id, linked_at) VALUES (?, ?, ?)',
      [idea.id, profileId, new Date().toISOString()]
    );
    await saveDb();  // Persist to disk
  }

  respond(res, { success: true });
}));

// DELETE /api/profiles/:profileId/link/:ideaSlug - Unlink profile from idea
app.delete('/api/profiles/:profileId/link/:ideaSlug', asyncHandler(async (req, res) => {
  const { profileId, ideaSlug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [ideaSlug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  await query('DELETE FROM idea_profiles WHERE idea_id = ? AND profile_id = ?', [idea.id, profileId]);
  await saveDb();  // Persist to disk

  respond(res, { success: true });
}));

// ==================== DYNAMIC QUESTIONING ENDPOINTS ====================

// GET /api/questions - Get all questions or filtered by type/stage
app.get('/api/questions', asyncHandler(async (req, res) => {
  const { ideaType, stage, category } = req.query;

  let questions = await getRelevantQuestions(
    ideaType as IdeaTypeFilter | null,
    stage as LifecycleStageFilter | null
  );

  // Filter by category if specified
  if (category) {
    questions = questions.filter(q => q.category === category);
  }

  respond(res, questions);
}));

// GET /api/questions/stats - Get question bank statistics
app.get('/api/questions/stats', asyncHandler(async (_req, res) => {
  const stats = await getQuestionStats();
  respond(res, stats);
}));

// POST /api/questions/populate - Populate question bank from YAML files
app.post('/api/questions/populate', asyncHandler(async (req, res) => {
  const { force = false } = req.body;
  const count = await populateQuestionBank(force);
  respond(res, { populated: count, message: `Populated ${count} questions` });
}));

// GET /api/questions/:id - Get single question by ID
app.get('/api/questions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const question = await getQuestionById(id);

  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  respond(res, question);
}));

// GET /api/ideas/:slug/questions - Get next questions for an idea
app.get('/api/ideas/:slug/questions', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { limit = 5 } = req.query;

  // Get idea
  const idea = await getOne<{
    id: string;
    idea_type: string;
    lifecycle_stage: string;
  }>('SELECT id, idea_type, lifecycle_stage FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get relevant questions for this idea type and stage
  const allQuestions = await getRelevantQuestions(
    idea.idea_type as IdeaTypeFilter | null,
    idea.lifecycle_stage as LifecycleStageFilter | null
  );

  // Get existing answers
  const answers = await getAnswersForIdea(idea.id);
  const answeredIds = new Set(answers.map(a => a.questionId));

  // Filter to unanswered questions
  const unanswered = allQuestions.filter(q => !answeredIds.has(q.id));

  // Check dependencies - only show questions whose dependencies are satisfied
  const eligible = unanswered.filter(q => {
    if (!q.depends_on || q.depends_on.length === 0) return true;
    return q.depends_on.every(depId => answeredIds.has(depId));
  });

  // Sort by priority (critical first)
  const sorted = eligible.sort((a, b) => {
    const priorityOrder: Record<QuestionPriority, number> = {
      'critical': 0,
      'important': 1,
      'nice-to-have': 2
    };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Limit results
  const questions = sorted.slice(0, parseInt(limit as string, 10));

  // Get readiness
  const readiness = await calculateReadiness(idea.id);

  // Get coverage
  const coverage = await calculateCriterionCoverage(idea.id);

  respond(res, {
    questions,
    readiness,
    coverage,
    totalQuestions: allQuestions.length,
    answeredCount: answeredIds.size,
    answeredIds: Array.from(answeredIds),
    remainingCount: unanswered.length
  });
}));

// GET /api/ideas/:slug/questions/all - Get ALL questions grouped by category
app.get('/api/ideas/:slug/questions/all', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Get idea
  const idea = await getOne<{
    id: string;
    idea_type: string;
    lifecycle_stage: string;
  }>('SELECT id, idea_type, lifecycle_stage FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get all relevant questions for this idea type and stage
  const allQuestions = await getRelevantQuestions(
    idea.idea_type as IdeaTypeFilter | null,
    idea.lifecycle_stage as LifecycleStageFilter | null
  );

  // Get existing answers
  const answers = await getAnswersForIdea(idea.id);
  const answerMap = new Map(answers.map(a => [a.questionId, a.answer]));

  // Group questions by category
  const categories = ['problem', 'solution', 'feasibility', 'fit', 'market', 'risk', 'business_model'] as const;
  const grouped: Record<string, Array<{
    id: string;
    text: string;
    criterion: string;
    category: string;
    priority: string;
    answered: boolean;
    answer?: string;
  }>> = {};

  for (const cat of categories) {
    grouped[cat] = [];
  }

  for (const q of allQuestions) {
    const isAnswered = answerMap.has(q.id);
    const questionData = {
      id: q.id,
      text: q.text,
      criterion: q.criterion,
      category: q.category,
      priority: q.priority,
      answered: isAnswered,
      answer: isAnswered ? answerMap.get(q.id) : undefined
    };

    if (grouped[q.category]) {
      grouped[q.category].push(questionData);
    }
  }

  // Sort each category by priority
  const priorityOrder: Record<string, number> = {
    'critical': 0,
    'important': 1,
    'nice-to-have': 2
  };

  for (const cat of categories) {
    grouped[cat].sort((a, b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    );
  }

  respond(res, {
    grouped,
    totalQuestions: allQuestions.length,
    answeredCount: answerMap.size
  });
}));

// GET /api/ideas/:slug/answers - Get all answers for an idea
app.get('/api/ideas/:slug/answers', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const answers = await getAnswersForIdea(idea.id);

  // Enrich with question data
  const enrichedAnswers = await Promise.all(
    answers.map(async (answer) => {
      const question = await getQuestionById(answer.questionId);
      return {
        ...answer,
        question
      };
    })
  );

  // Get coverage
  const coverage = await calculateCriterionCoverage(idea.id);

  respond(res, { answers: enrichedAnswers, coverage });
}));

// POST /api/ideas/:slug/answers - Submit an answer to a question
app.post('/api/ideas/:slug/answers', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { questionId, answer, source = 'user', confidence = 1.0 } = req.body;

  if (!questionId || !answer) {
    res.status(400).json({ success: false, error: 'questionId and answer are required' });
    return;
  }

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Verify question exists
  const question = await getQuestionById(questionId);
  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  // Save answer
  const savedAnswer = await saveAnswer(
    idea.id,
    questionId,
    answer,
    source as 'user' | 'ai_extracted' | 'ai_inferred',
    confidence
  );

  // Get updated readiness
  const readiness = await calculateReadiness(idea.id);

  // Get next questions using smart selection algorithm
  const nextQuestions = await getNextQuestionsAfterAnswer(idea.id, questionId, 3);

  respond(res, {
    answer: savedAnswer,
    readiness,
    nextQuestions
  });
}));

// DELETE /api/ideas/:slug/answers/:questionId - Delete an answer
app.delete('/api/ideas/:slug/answers/:questionId', asyncHandler(async (req, res) => {
  const { slug, questionId } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  await deleteAnswer(idea.id, questionId);

  // Get updated readiness
  const readiness = await calculateReadiness(idea.id);

  respond(res, { success: true, readiness });
}));

// GET /api/ideas/:slug/readiness - Get readiness assessment
app.get('/api/ideas/:slug/readiness', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const readiness = await calculateReadiness(idea.id);
  const coverage = await calculateCriterionCoverage(idea.id);

  respond(res, {
    ...readiness,
    coverage
  });
}));

// POST /api/ideas/:slug/develop - Start or continue a development session
app.post('/api/ideas/:slug/develop', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { mode = 'start', sessionId } = req.body;

  const idea = await getOne<{
    id: string;
    idea_type: string;
    lifecycle_stage: string;
  }>('SELECT id, idea_type, lifecycle_stage FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  if (mode === 'start') {
    // Start new session
    const session = await startDevelopmentSession(idea.id);

    // Get initial questions using balanced selection across categories
    let questions = await getBalancedQuestions(idea.id, 2);

    // If no questions found (all have unmet dependencies), try with skipDependencies
    if (questions.length === 0) {
      questions = await getBalancedQuestions(idea.id, 2, true);
    }

    respond(res, { session, questions });
  } else if (mode === 'complete' && sessionId) {
    // Complete session
    const session = await completeDevelopmentSession(sessionId);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    respond(res, { session });
  } else {
    res.status(400).json({ success: false, error: 'Invalid mode or missing sessionId' });
  }
}));

// GET /api/ideas/:slug/readiness/coverage - Get criterion coverage
app.get('/api/ideas/:slug/readiness/coverage', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const coverage = await calculateCriterionCoverage(idea.id);
  respond(res, coverage);
}));

// GET /api/ideas/:slug/develop - Get active development session
app.get('/api/ideas/:slug/develop', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get active (incomplete) session
  const session = await getOne<{
    id: string;
    idea_id: string;
    started_at: string;
    completed_at: string | null;
    questions_asked: number;
    questions_answered: number;
    readiness_before: number;
    readiness_after: number | null;
  }>(`SELECT * FROM development_sessions
      WHERE idea_id = ? AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1`, [idea.id]);

  if (!session) {
    respond(res, null);
    return;
  }

  respond(res, {
    id: session.id,
    ideaId: session.idea_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    questionsAsked: session.questions_asked,
    questionsAnswered: session.questions_answered,
    readinessBefore: session.readiness_before,
    readinessAfter: session.readiness_after
  });
}));

// GET /api/ideas/:slug/develop/history - Get development session history
app.get('/api/ideas/:slug/develop/history', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const sessions = await getSessionHistory(idea.id);
  respond(res, sessions);
}));

// GET /api/ideas/:slug/questions/smart - Get smart-selected questions
app.get('/api/ideas/:slug/questions/smart', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { category, criterion, limit, skipDependencies } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const questions = await selectNextQuestions(idea.id, {
    focusCategory: category as 'problem' | 'solution' | 'feasibility' | 'fit' | 'market' | 'risk' | 'business_model' | undefined,
    focusCriterion: criterion as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 5,
    skipDependencies: skipDependencies === 'true'
  });

  respond(res, questions);
}));

// GET /api/ideas/:slug/questions/criterion/:criterion - Get questions for a specific criterion
app.get('/api/ideas/:slug/questions/criterion/:criterion', asyncHandler(async (req, res) => {
  const { slug, criterion } = req.params;
  const { limit } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const questions = await getQuestionsForCriterion(
    idea.id,
    criterion,
    limit ? parseInt(limit as string, 10) : 5
  );

  respond(res, questions);
}));

// GET /api/ideas/:slug/structured-data - Get structured answers for evaluation
app.get('/api/ideas/:slug/structured-data', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const answers = await getAnswersForIdea(idea.id);

  // Organize answers by criterion
  const structuredData: Record<string, Record<string, string>> = {};

  for (const answer of answers) {
    const question = await getQuestionById(answer.questionId);
    if (!question) continue;

    if (!structuredData[question.category]) {
      structuredData[question.category] = {};
    }

    // Use question ID as key (e.g., P1_CORE, S1_WHAT)
    structuredData[question.category][question.id] = answer.answer;
  }

  const readiness = await calculateReadiness(idea.id);

  respond(res, {
    structuredData,
    readiness,
    hasProfile: readiness.byCategory.fit >= 1.0
  });
}));

// GET /api/ideas/:slug/profile - Get profile linked to an idea
app.get('/api/ideas/:slug/profile', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Get idea
  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get linked profile
  const profile = await getOne<{
    id: string;
    name: string;
    slug: string;
    primary_goals: string;
    success_definition: string | null;
    interests: string | null;
    technical_skills: string | null;
    professional_experience: string | null;
    domain_expertise: string | null;
    employment_status: string | null;
    weekly_hours_available: number | null;
    risk_tolerance: string | null;
    updated_at: string;
  }>(`
    SELECT p.* FROM user_profiles p
    JOIN idea_profiles ip ON p.id = ip.profile_id
    WHERE ip.idea_id = ?
  `, [idea.id]);

  respond(res, profile || null);
}));

// Start server with WebSocket support
export function startServer(): void {
  const server = createServer(app);
  initWebSocket(server);

  server.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  });
}

export default app;
