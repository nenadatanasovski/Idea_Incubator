#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getConfig } from '../config/index.js';
import { getDb, closeDb, query, run, insert, update, saveDb } from '../database/db.js';
import { runMigrations } from '../database/migrate.js';
import { parseMarkdown, computeHash, titleToSlug } from '../utils/parser.js';
import { logInfo, logSuccess, logError, logWarning, logDebug } from '../utils/logger.js';
import { IdeaFrontmatter } from '../utils/schemas.js';
import { parseDevlopmentMd } from '../questions/parser.js';
import { classifyQuestionToId } from '../questions/classifier.js';
import { saveAnswer } from '../questions/readiness.js';

interface SyncResult {
  created: string[];
  updated: string[];
  deleted: string[];
  stale: string[];
  errors: Array<{ path: string; error: string }>;
  developmentSynced: number;
  developmentFailed: number;
}

interface DevSyncResult {
  synced: number;
  failed: number;
  skipped: number;
}

/**
 * Compute content hash including development.md for staleness detection.
 * If development.md changes, the hash changes, triggering re-evaluation.
 */
function computeIdeaHash(ideaPath: string): string {
  const filesToHash = [
    path.join(ideaPath, 'README.md'),
    path.join(ideaPath, 'development.md')
  ];

  // Also include any research files
  const researchPath = path.join(ideaPath, 'research');
  if (fs.existsSync(researchPath)) {
    const researchFiles = fs.readdirSync(researchPath)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(researchPath, f));
    filesToHash.push(...researchFiles);
  }

  const contents = filesToHash
    .filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, 'utf-8'))
    .join('\n---FILE-BOUNDARY---\n');

  return createHash('md5').update(contents).digest('hex');
}

/**
 * Sync development.md answers to idea_answers table.
 * Parses Q&A from markdown and maps to question bank IDs.
 */
async function syncDevelopmentAnswers(
  ideaId: string,
  folderPath: string
): Promise<DevSyncResult> {
  const devPath = path.join(folderPath, 'development.md');

  if (!fs.existsSync(devPath)) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  const content = fs.readFileSync(devPath, 'utf-8');

  // Skip if file is too short (likely just template)
  if (content.length < 100) {
    return { synced: 0, failed: 0, skipped: 1 };
  }

  // Parse Q&A pairs from the development.md file
  // Note: We skip LLM fallback during sync to avoid unexpected costs
  const qaPairs = await parseDevlopmentMd(content, undefined, false);

  let synced = 0;
  let failed = 0;

  for (const { question, answer, confidence } of qaPairs) {
    const questionId = classifyQuestionToId(question);

    if (questionId) {
      try {
        await saveAnswer(ideaId, questionId, answer, 'user', confidence);
        synced++;
        logDebug(`  Mapped "${question.slice(0, 30)}..." -> ${questionId}`);
      } catch (error) {
        logWarning(`Failed to save answer for ${questionId}: ${error}`);
        failed++;
      }
    } else {
      logDebug(`Could not classify: "${question.slice(0, 40)}..."`);
      failed++;
    }
  }

  return { synced, failed, skipped: 0 };
}

/**
 * Sync markdown files to database
 */
export async function syncIdeasToDb(): Promise<SyncResult> {
  const config = getConfig();
  const ideasDir = config.paths.ideas;

  const result: SyncResult = {
    created: [],
    updated: [],
    deleted: [],
    stale: [],
    errors: [],
    developmentSynced: 0,
    developmentFailed: 0
  };

  // Ensure ideas directory exists
  if (!fs.existsSync(ideasDir)) {
    fs.mkdirSync(ideasDir, { recursive: true });
    logInfo(`Created ideas directory: ${ideasDir}`);
    return result;
  }

  // Find all idea README.md files
  const ideaFiles = await glob('*/README.md', { cwd: ideasDir });
  const processedSlugs = new Set<string>();

  logInfo(`Found ${ideaFiles.length} idea file(s) to process.`);

  for (const relPath of ideaFiles) {
    const fullPath = path.join(ideasDir, relPath);
    const slug = path.dirname(relPath);
    processedSlugs.add(slug);

    try {
      const { frontmatter, content, hash: readmeHash } = parseMarkdown(fullPath);
      const ideaFolder = path.dirname(fullPath);

      // Compute comprehensive hash including development.md
      const hash = computeIdeaHash(ideaFolder);

      // Check if idea exists in database
      const existing = await query<{
        id: string;
        content_hash: string;
        updated_at: string;
      }>('SELECT id, content_hash, updated_at FROM ideas WHERE slug = ?', [slug]);

      if (existing.length === 0) {
        // Create new idea
        const id = frontmatter.id || uuidv4();
        await insert('ideas', {
          id,
          slug,
          title: frontmatter.title,
          summary: frontmatter.summary || null,
          idea_type: frontmatter.type,
          lifecycle_stage: frontmatter.stage,
          content_hash: hash,
          folder_path: ideaFolder,
          created_at: frontmatter.created,
          updated_at: new Date().toISOString()
        });

        // Sync tags
        await syncTags(id, frontmatter.tags || []);

        // Sync development.md answers
        const devResult = await syncDevelopmentAnswers(id, ideaFolder);
        result.developmentSynced += devResult.synced;
        result.developmentFailed += devResult.failed;
        if (devResult.synced > 0) {
          logInfo(`  Synced ${devResult.synced} development answers`);
        }

        result.created.push(slug);
        logSuccess(`Created: ${slug}`);
      } else {
        const idea = existing[0];

        // Check if content changed (including development.md)
        if (idea.content_hash !== hash) {
          await update('ideas', {
            title: frontmatter.title,
            summary: frontmatter.summary || null,
            idea_type: frontmatter.type,
            lifecycle_stage: frontmatter.stage,
            content_hash: hash,
            updated_at: new Date().toISOString()
          }, 'id = ?', [idea.id]);

          // Sync tags
          await syncTags(idea.id, frontmatter.tags || []);

          // Sync development.md answers
          const devResult = await syncDevelopmentAnswers(idea.id, ideaFolder);
          result.developmentSynced += devResult.synced;
          result.developmentFailed += devResult.failed;
          if (devResult.synced > 0) {
            logInfo(`  Synced ${devResult.synced} development answers`);
          }

          result.updated.push(slug);
          logInfo(`Updated: ${slug}`);

          // Check staleness against last evaluation
          await checkStaleness(idea.id, slug, hash, result);
        }
      }
    } catch (error) {
      result.errors.push({
        path: fullPath,
        error: (error as Error).message
      });
      logError(`Failed to process ${fullPath}`, error as Error);
    }
  }

  // Find deleted ideas (in DB but not in files)
  const dbIdeas = await query<{ slug: string }>('SELECT slug FROM ideas');
  for (const dbIdea of dbIdeas) {
    if (!processedSlugs.has(dbIdea.slug)) {
      // Idea was deleted from filesystem
      await run('DELETE FROM ideas WHERE slug = ?', [dbIdea.slug]);
      result.deleted.push(dbIdea.slug);
      logWarning(`Deleted from DB: ${dbIdea.slug}`);
    }
  }

  // Generate index file
  await generateIndex();

  await saveDb();

  return result;
}

/**
 * Sync tags for an idea
 */
async function syncTags(ideaId: string, tags: string[]): Promise<void> {
  // Remove existing tags
  await run('DELETE FROM idea_tags WHERE idea_id = ?', [ideaId]);

  for (const tagName of tags) {
    // Get or create tag
    let tag = await query<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);

    if (tag.length === 0) {
      await insert('tags', { name: tagName });
      tag = await query<{ id: number }>('SELECT id FROM tags WHERE name = ?', [tagName]);
    }

    // Link tag to idea
    await run('INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)', [
      ideaId,
      tag[0].id
    ]);
  }
}

/**
 * Check if evaluation is stale compared to content
 */
async function checkStaleness(
  ideaId: string,
  slug: string,
  currentHash: string,
  result: SyncResult
): Promise<void> {
  const config = getConfig();

  // Get last evaluation
  const lastEval = await query<{
    evaluated_at: string;
    evaluation_run_id: string;
  }>(
    `SELECT MAX(evaluated_at) as evaluated_at, evaluation_run_id
     FROM evaluations WHERE idea_id = ?
     GROUP BY evaluation_run_id
     ORDER BY evaluated_at DESC LIMIT 1`,
    [ideaId]
  );

  if (lastEval.length === 0) return;

  const evalDate = new Date(lastEval[0].evaluated_at);
  const now = new Date();
  const daysSince = (now.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24);

  // Check if evaluation is older than threshold
  if (daysSince > config.staleness.evaluationAgeDays) {
    result.stale.push(slug);
    logWarning(`Stale evaluation: ${slug} (${Math.round(daysSince)} days old)`);
  }
}

/**
 * Generate ideas index file
 */
async function generateIndex(): Promise<void> {
  const config = getConfig();
  const indexPath = path.join(config.paths.ideas, '_index.md');

  const ideas = await query<{
    slug: string;
    title: string;
    lifecycle_stage: string;
    idea_type: string;
    updated_at: string;
  }>(
    `SELECT i.slug, i.title, i.lifecycle_stage, i.idea_type, i.updated_at,
            (SELECT AVG(final_score) FROM evaluations e WHERE e.idea_id = i.id) as avg_score
     FROM ideas i
     ORDER BY i.updated_at DESC`
  );

  let content = `# Idea Index

> Auto-generated by sync script. Do not edit manually.

Last updated: ${new Date().toISOString()}

## All Ideas (${ideas.length})

| Idea | Stage | Type | Updated |
|------|-------|------|---------|
`;

  for (const idea of ideas) {
    const date = new Date(idea.updated_at).toISOString().split('T')[0];
    content += `| [${idea.title}](./${idea.slug}/README.md) | ${idea.lifecycle_stage} | ${idea.idea_type || '-'} | ${date} |\n`;
  }

  fs.writeFileSync(indexPath, content, 'utf-8');
  logInfo(`Generated index: ${indexPath}`);
}

// CLI entry point
async function main(): Promise<void> {
  try {
    logInfo('Starting sync...');
    await runMigrations();
    const result = await syncIdeasToDb();

    console.log('\nSync Summary:');
    console.log('=============');
    console.log(`  Created: ${result.created.length}`);
    console.log(`  Updated: ${result.updated.length}`);
    console.log(`  Deleted: ${result.deleted.length}`);

    if (result.developmentSynced > 0 || result.developmentFailed > 0) {
      console.log(`\n  Development Answers:`);
      console.log(`    Synced: ${result.developmentSynced}`);
      if (result.developmentFailed > 0) {
        console.log(`    Could not map: ${result.developmentFailed}`);
      }
    }

    if (result.stale.length > 0) {
      console.log(`\n  Stale evaluations: ${result.stale.length}`);
      result.stale.forEach(s => console.log(`    - ${s}`));
      console.log('\n  Run `npm run evaluate <slug>` to update evaluations.');
    }

    if (result.errors.length > 0) {
      console.log(`\n  Errors: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`    - ${e.path}: ${e.error}`));
    }

    logSuccess('Sync complete.');
  } catch (error) {
    logError('Sync failed', error as Error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run if called directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('sync.ts') ||
  process.argv[1].endsWith('sync.js')
);

if (isMainModule) {
  main();
}

export { generateIndex };
