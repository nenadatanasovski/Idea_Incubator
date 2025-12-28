#!/usr/bin/env tsx
import { Command } from 'commander';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';
import { getDb, closeDb, query } from '../database/db.js';
import { runMigrations } from '../database/migrate.js';

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

// Parse and execute
program.parse();
