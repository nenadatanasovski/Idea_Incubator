/**
 * Export/Import Routes
 * Routes for exporting and importing ideas and data
 */
import { Router } from 'express';
import { asyncHandler, respond, IdeaRow } from './shared.js';
import { query, getOne } from '../../database/db.js';

const router = Router();

// GET /api/export/ideas - Export all ideas as JSON
router.get('/export/ideas', asyncHandler(async (_req, res) => {
  const ideas = await query<IdeaRow>(
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
router.get('/export/ideas/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<IdeaRow & { avg_final_score: number | null; avg_confidence: number | null }>(
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

// POST /api/import - Import ideas from JSON
router.post('/import', asyncHandler(async (req, res) => {
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
router.get('/export/csv', asyncHandler(async (_req, res) => {
  const ideas = await query<IdeaRow & { avg_final_score: number | null; avg_confidence: number | null }>(
    `SELECT i.*, s.avg_score as avg_final_score, s.avg_confidence
     FROM ideas i
     LEFT JOIN idea_scores s ON i.id = s.id
     ORDER BY i.updated_at DESC`
  );

  // Get category scores for each idea
  const ideasWithScores = await Promise.all(
    ideas.map(async (idea) => {
      // First principles: final_score is now correctly updated after debate
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

export default router;
