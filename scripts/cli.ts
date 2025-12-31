#!/usr/bin/env tsx
import { Command } from 'commander';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';
import { getDb, closeDb, query, getOne, saveDb } from '../database/db.js';
import { runMigrations } from '../database/migrate.js';
import {
  pauseIdea,
  resumeIdea,
  abandonIdea,
  resurrectIdea,
  archiveIdea,
  completeIdea,
  getStatusHistory,
  formatStatusHistory,
  getStatusIcon
} from '../utils/status.js';
import {
  createVersionSnapshot,
  getVersionHistory,
  compareVersions,
  formatVersionHistory,
  formatVersionDiff
} from '../utils/versioning.js';
import {
  createBranch,
  getLineage,
  formatLineageTree
} from '../utils/lineage.js';

const program = new Command();

program
  .name('idea-cli')
  .description('Idea Incubator CLI')
  .version('0.1.0');

// List ideas command
program
  .command('list')
  .description('List all ideas')
  .option('-s, --stage <stage>', 'Filter by lifecycle stage')
  .option('-t, --type <type>', 'Filter by idea type')
  .option('--limit <n>', 'Limit number of results', '20')
  .action(async (options) => {
    try {
      await runMigrations();

      let sql = 'SELECT slug, title, lifecycle_stage, idea_type FROM ideas WHERE 1=1';
      const params: string[] = [];

      if (options.stage) {
        sql += ' AND lifecycle_stage = ?';
        params.push(options.stage.toUpperCase());
      }

      if (options.type) {
        sql += ' AND idea_type = ?';
        params.push(options.type.toLowerCase());
      }

      sql += ` ORDER BY updated_at DESC LIMIT ${parseInt(options.limit)}`;

      const ideas = await query<{
        slug: string;
        title: string;
        lifecycle_stage: string;
        idea_type: string;
      }>(sql, params);

      if (ideas.length === 0) {
        logInfo('No ideas found.');
        return;
      }

      console.log('\nIdeas:');
      console.log('======\n');
      ideas.forEach(idea => {
        console.log(`  ${idea.slug}`);
        console.log(`    Title: ${idea.title}`);
        console.log(`    Stage: ${idea.lifecycle_stage} | Type: ${idea.idea_type || 'unset'}`);
        console.log('');
      });
      console.log(`Total: ${ideas.length} idea(s)`);
    } catch (error) {
      logError('Failed to list ideas', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Show idea details command
program
  .command('show <slug>')
  .description('Show idea details')
  .action(async (slug) => {
    try {
      await runMigrations();

      const idea = await query<{
        id: string;
        slug: string;
        title: string;
        summary: string;
        lifecycle_stage: string;
        idea_type: string;
        created_at: string;
        updated_at: string;
        folder_path: string;
      }>('SELECT * FROM ideas WHERE slug = ?', [slug]);

      if (idea.length === 0) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      const i = idea[0];
      console.log('\nIdea Details:');
      console.log('=============\n');
      console.log(`Title: ${i.title}`);
      console.log(`Slug: ${i.slug}`);
      console.log(`Type: ${i.idea_type || 'unset'}`);
      console.log(`Stage: ${i.lifecycle_stage}`);
      console.log(`Summary: ${i.summary || '(no summary)'}`);
      console.log(`Path: ${i.folder_path}`);
      console.log(`Created: ${i.created_at}`);
      console.log(`Updated: ${i.updated_at}`);

      // Get evaluation scores if any
      const scores = await query<{
        category: string;
        avg_score: number;
        avg_confidence: number;
      }>(
        `SELECT category, AVG(final_score) as avg_score, AVG(confidence) as avg_confidence
         FROM evaluations WHERE idea_id = ?
         GROUP BY category`,
        [i.id]
      );

      if (scores.length > 0) {
        console.log('\nEvaluation Scores:');
        scores.forEach(s => {
          console.log(`  ${s.category}: ${s.avg_score?.toFixed(1) || '-'} (${(s.avg_confidence * 100)?.toFixed(0) || '-'}%)`);
        });
      }

      // Get tags
      const tags = await query<{ name: string }>(
        `SELECT t.name FROM tags t
         JOIN idea_tags it ON t.id = it.tag_id
         WHERE it.idea_id = ?`,
        [i.id]
      );

      if (tags.length > 0) {
        console.log(`\nTags: ${tags.map(t => t.name).join(', ')}`);
      }

    } catch (error) {
      logError('Failed to show idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Stats command
program
  .command('stats')
  .description('Show idea statistics')
  .action(async () => {
    try {
      await runMigrations();

      const total = await query<{ count: number }>('SELECT COUNT(*) as count FROM ideas');
      console.log(`\nTotal ideas: ${total[0]?.count || 0}`);

      // By stage
      const byStage = await query<{ lifecycle_stage: string; count: number }>(
        `SELECT lifecycle_stage, COUNT(*) as count FROM ideas
         GROUP BY lifecycle_stage ORDER BY count DESC`
      );

      if (byStage.length > 0) {
        console.log('\nBy Stage:');
        byStage.forEach(s => {
          console.log(`  ${s.lifecycle_stage}: ${s.count}`);
        });
      }

      // By type
      const byType = await query<{ idea_type: string; count: number }>(
        `SELECT idea_type, COUNT(*) as count FROM ideas
         WHERE idea_type IS NOT NULL
         GROUP BY idea_type ORDER BY count DESC`
      );

      if (byType.length > 0) {
        console.log('\nBy Type:');
        byType.forEach(t => {
          console.log(`  ${t.idea_type}: ${t.count}`);
        });
      }

      // Evaluated ideas
      const evaluated = await query<{ count: number }>(
        `SELECT COUNT(DISTINCT idea_id) as count FROM evaluations`
      );
      console.log(`\nEvaluated ideas: ${evaluated[0]?.count || 0}`);

    } catch (error) {
      logError('Failed to get stats', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// ============================================================================
// Status Management Commands
// ============================================================================

// Pause an idea
program
  .command('pause <slug>')
  .description('Pause an active idea')
  .option('-r, --reason <reason>', 'Reason for pausing', 'Paused via CLI')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string; status: string }>(
        'SELECT id, slug, status FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await pauseIdea(idea.id, options.reason);
      await saveDb();
      logSuccess(`Paused: ${slug}`);
      console.log(`Reason: ${options.reason}`);
    } catch (error) {
      logError('Failed to pause idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Resume an idea
program
  .command('resume <slug>')
  .description('Resume a paused idea')
  .action(async (slug) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await resumeIdea(idea.id);
      await saveDb();
      logSuccess(`Resumed: ${slug}`);
    } catch (error) {
      logError('Failed to resume idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Abandon an idea
program
  .command('abandon <slug>')
  .description('Abandon an idea')
  .option('-r, --reason <reason>', 'Reason for abandoning', 'Abandoned via CLI')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await abandonIdea(idea.id, options.reason);
      await saveDb();
      logSuccess(`Abandoned: ${slug}`);
      console.log(`Reason: ${options.reason}`);
    } catch (error) {
      logError('Failed to abandon idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Resurrect an idea
program
  .command('resurrect <slug>')
  .description('Resurrect an abandoned or archived idea')
  .option('-r, --reason <reason>', 'Reason for resurrecting', 'Resurrected via CLI')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await resurrectIdea(idea.id, options.reason);
      await saveDb();
      logSuccess(`Resurrected: ${slug}`);
    } catch (error) {
      logError('Failed to resurrect idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Archive an idea
program
  .command('archive <slug>')
  .description('Archive an idea')
  .action(async (slug) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await archiveIdea(idea.id);
      await saveDb();
      logSuccess(`Archived: ${slug}`);
    } catch (error) {
      logError('Failed to archive idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Complete an idea
program
  .command('complete <slug>')
  .description('Mark an idea as completed')
  .action(async (slug) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await completeIdea(idea.id);
      await saveDb();
      logSuccess(`Completed: ${slug}`);
    } catch (error) {
      logError('Failed to complete idea', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Show status and history
program
  .command('status <slug>')
  .description('Show current status and history')
  .action(async (slug) => {
    try {
      await runMigrations();

      const idea = await getOne<{
        id: string;
        slug: string;
        title: string;
        status: string;
        status_reason: string | null;
        status_changed_at: string | null;
      }>(
        'SELECT id, slug, title, status, status_reason, status_changed_at FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      console.log(`\n${getStatusIcon(idea.status as any)} ${idea.title}`);
      console.log(`Status: ${idea.status.toUpperCase()}`);
      if (idea.status_reason) {
        console.log(`Reason: ${idea.status_reason}`);
      }
      if (idea.status_changed_at) {
        console.log(`Changed: ${idea.status_changed_at}`);
      }

      const history = await getStatusHistory(idea.id);
      console.log(formatStatusHistory(history));
    } catch (error) {
      logError('Failed to get status', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// ============================================================================
// Version Management Commands
// ============================================================================

// List version history
program
  .command('versions <slug>')
  .description('List version history')
  .option('-l, --limit <n>', 'Limit number of versions', '10')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      const versions = await getVersionHistory(idea.id);
      const limited = versions.slice(0, parseInt(options.limit));

      if (limited.length === 0) {
        logInfo('No versions found.');
        return;
      }

      console.log(formatVersionHistory(limited));
    } catch (error) {
      logError('Failed to get versions', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Compare two versions
program
  .command('compare <slug> <v1> <v2>')
  .description('Compare two versions')
  .action(async (slug, v1, v2) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      const diff = await compareVersions(idea.id, parseInt(v1), parseInt(v2));
      console.log(formatVersionDiff(diff));
    } catch (error) {
      logError('Failed to compare versions', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Create manual snapshot
program
  .command('snapshot <slug>')
  .description('Create a manual version snapshot')
  .option('-s, --summary <text>', 'Summary of changes', 'Manual snapshot')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string; current_version: number }>(
        'SELECT id, slug, current_version FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      await createVersionSnapshot(idea.id, 'manual', options.summary);
      await saveDb();
      logSuccess(`Created snapshot v${idea.current_version + 1} for ${slug}`);
    } catch (error) {
      logError('Failed to create snapshot', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// ============================================================================
// Lineage & Branching Commands
// ============================================================================

// Create a branch
program
  .command('branch <slug>')
  .description('Create a branch from an idea')
  .requiredOption('-t, --title <title>', 'Title for the new branch')
  .requiredOption('-r, --reason <reason>', 'How this differs from the original')
  .option('-a, --action <action>', 'What to do with parent: keep, pause, abandon', 'keep')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      const parentAction = options.action === 'pause'
        ? 'pause'
        : options.action === 'abandon'
          ? 'abandon'
          : 'keep_active';

      const newSlug = await createBranch({
        parentIdeaId: idea.id,
        newTitle: options.title,
        branchReason: options.reason,
        parentAction
      });

      await saveDb();
      logSuccess(`Created branch: ${newSlug}`);
      console.log(`Parent action: ${parentAction}`);
    } catch (error) {
      logError('Failed to create branch', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Show lineage tree
program
  .command('lineage <slug>')
  .description("Show idea's family tree")
  .action(async (slug) => {
    try {
      await runMigrations();

      const idea = await getOne<{ id: string; slug: string }>(
        'SELECT id, slug FROM ideas WHERE slug = ?',
        [slug]
      );

      if (!idea) {
        logWarning(`Idea not found: ${slug}`);
        return;
      }

      const lineage = await getLineage(idea.id);
      console.log(formatLineageTree(lineage));
    } catch (error) {
      logError('Failed to get lineage', error as Error);
      process.exit(1);
    } finally {
      await closeDb();
    }
  });

// Parse and execute
program.parse();
