#!/usr/bin/env tsx
/**
 * Review CLI Command
 * Allows user to review and override AI evaluation scores
 */
import { Command } from 'commander';
import * as readline from 'readline';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';
import { query, run, saveDb, closeDb } from '../database/db.js';
import { runMigrations } from '../database/migrate.js';
import { getConfig } from '../config/index.js';
import { CATEGORIES, interpretScore, type Category } from '../agents/config.js';

const program = new Command();

interface EvaluationScore {
  id: string;
  criterion_name: string;
  category: string;
  initial_score: number;
  final_score: number;
  confidence: number;
  reasoning: string;
  user_override: number | null;
  user_notes: string | null;
  [key: string]: unknown;
}

program
  .name('review')
  .description('Review and override AI evaluation scores')
  .argument('<slug>', 'Idea slug to review')
  .option('-a, --accept-all', 'Accept all AI scores without review')
  .option('--show-reasoning', 'Show AI reasoning for each score')
  .action(async (slug, options) => {
    try {
      await runMigrations();

      // Get idea
      const idea = await query<{
        id: string;
        slug: string;
        title: string;
      }>('SELECT id, slug, title FROM ideas WHERE slug = ?', [slug]);

      if (idea.length === 0) {
        logError('Idea not found', new Error(`No idea with slug: ${slug}`));
        process.exit(1);
      }

      const ideaData = idea[0];
      logInfo(`Reviewing: "${ideaData.title}"`);

      // Get latest evaluation session
      const session = await query<{
        id: string;
        created_at: string;
        overall_score: number;
      }>(
        `SELECT id, created_at, overall_score FROM evaluation_sessions
         WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`,
        [ideaData.id]
      );

      if (session.length === 0) {
        logWarning('No evaluation found. Run `npm run evaluate` first.');
        await closeDb();
        return;
      }

      const sessionData = session[0];
      logInfo(`Evaluation from: ${sessionData.created_at}`);
      logInfo(`Overall score: ${sessionData.overall_score.toFixed(2)}/10`);

      // Get all scores
      const scores = await query<EvaluationScore>(
        `SELECT * FROM evaluations
         WHERE session_id = ?
         ORDER BY category, criterion_name`,
        [sessionData.id]
      );

      if (options.acceptAll) {
        logSuccess('All AI scores accepted');
        await closeDb();
        return;
      }

      console.log('\n--- Review Mode ---');
      console.log('For each criterion, press Enter to accept AI score, or type a new score (1-10).');
      console.log('Type "q" to quit, "s" to skip to next category.\n');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const askQuestion = (prompt: string): Promise<string> => {
        return new Promise(resolve => {
          rl.question(prompt, answer => resolve(answer.trim()));
        });
      };

      let hasChanges = false;
      let currentCategory = '';

      for (const score of scores) {
        // Show category header
        if (score.category !== currentCategory) {
          currentCategory = score.category;
          console.log(`\n## ${currentCategory.toUpperCase()}`);
          console.log('─'.repeat(40));
        }

        // Display score
        console.log(`\n${score.criterion_name}`);
        console.log(`  AI Score: ${score.final_score}/10 (${(score.confidence * 100).toFixed(0)}% confidence)`);

        if (options.showReasoning) {
          console.log(`  Reasoning: ${score.reasoning.substring(0, 200)}...`);
        }

        if (score.user_override !== null) {
          console.log(`  Current Override: ${score.user_override}/10`);
        }

        // Ask for input
        const answer = await askQuestion(`  Your score [${score.final_score}]: `);

        if (answer.toLowerCase() === 'q') {
          logInfo('Review cancelled');
          break;
        }

        if (answer.toLowerCase() === 's') {
          logInfo(`Skipping ${currentCategory} category`);
          // Skip remaining in this category
          continue;
        }

        if (answer === '') {
          // Accept AI score
          continue;
        }

        const newScore = parseInt(answer);
        if (isNaN(newScore) || newScore < 1 || newScore > 10) {
          logWarning('Invalid score, keeping AI score');
          continue;
        }

        if (newScore !== score.final_score) {
          // Ask for notes on override
          const notes = await askQuestion('  Notes (optional): ');

          await run(
            `UPDATE evaluations
             SET user_override = ?, user_notes = ?, final_score = ?
             WHERE id = ?`,
            [newScore, notes || null, newScore, score.id]
          );

          hasChanges = true;
          logInfo(`Updated ${score.criterion_name}: ${score.final_score} -> ${newScore}`);
        }
      }

      rl.close();

      if (hasChanges) {
        // Recalculate overall score
        await recalculateOverallScore(sessionData.id, ideaData.id);
        await saveDb();
        logSuccess('Review complete, scores updated');
      } else {
        logInfo('Review complete, no changes made');
      }

      await closeDb();

    } catch (error) {
      logError('Review failed', error as Error);
      await closeDb();
      process.exit(1);
    }
  });

/**
 * Recalculate overall score after user overrides
 */
async function recalculateOverallScore(sessionId: string, _ideaId: string): Promise<void> {
  const config = getConfig();

  // Get all final scores by category
  const categoryScores = await query<{
    category: string;
    avg_score: number;
  }>(
    `SELECT category, AVG(final_score) as avg_score
     FROM evaluations
     WHERE session_id = ?
     GROUP BY category`,
    [sessionId]
  );

  // Calculate weighted overall
  const weights = config.categoryWeights;
  let overall = 0;
  for (const cat of categoryScores) {
    const weight = weights[cat.category as Category] || 0;
    overall += cat.avg_score * weight;
  }

  // Update session
  await run(
    'UPDATE evaluation_sessions SET overall_score = ? WHERE id = ?',
    [overall, sessionId]
  );

  logInfo(`Recalculated overall score: ${overall.toFixed(2)}/10`);

  const interpretation = interpretScore(overall);
  logInfo(`Recommendation: ${interpretation.recommendation} - ${interpretation.description}`);
}

// Export command for comparison view
program
  .command('compare <slug1> <slug2>')
  .description('Compare evaluations of two ideas')
  .action(async (slug1, slug2) => {
    try {
      await runMigrations();

      const getIdeaScores = async (slug: string) => {
        const idea = await query<{ id: string; title: string }>(
          'SELECT id, title FROM ideas WHERE slug = ?', [slug]
        );
        if (idea.length === 0) throw new Error(`Idea not found: ${slug}`);

        const scores = await query<{
          category: string;
          criterion_name: string;
          final_score: number;
        }>(
          `SELECT e.category, e.criterion_name, e.final_score
           FROM evaluations e
           JOIN evaluation_sessions s ON s.id = e.session_id
           WHERE s.idea_id = ?
           AND s.created_at = (SELECT MAX(created_at) FROM evaluation_sessions WHERE idea_id = ?)
           ORDER BY e.category, e.criterion_name`,
          [idea[0].id, idea[0].id]
        );

        return { title: idea[0].title, scores };
      };

      const idea1 = await getIdeaScores(slug1);
      const idea2 = await getIdeaScores(slug2);

      console.log('\n## Idea Comparison\n');
      console.log(`| Criterion | ${idea1.title} | ${idea2.title} | Diff |`);
      console.log(`|-----------|${'-'.repeat(idea1.title.length + 2)}|${'-'.repeat(idea2.title.length + 2)}|------|`);

      for (const score1 of idea1.scores) {
        const score2 = idea2.scores.find(s => s.criterion_name === score1.criterion_name);
        const s2 = score2?.final_score ?? '-';
        const diff = typeof s2 === 'number' ? (score1.final_score - s2).toFixed(1) : '-';
        const diffStr = typeof diff === 'string' && diff !== '-'
          ? (parseFloat(diff) > 0 ? `+${diff}` : diff)
          : diff;

        console.log(`| ${score1.criterion_name} | ${score1.final_score} | ${s2} | ${diffStr} |`);
      }

      // Category averages
      console.log('\n### Category Averages\n');
      for (const category of CATEGORIES) {
        const cat1Scores = idea1.scores.filter(s => s.category === category);
        const cat2Scores = idea2.scores.filter(s => s.category === category);

        const avg1 = cat1Scores.reduce((sum, s) => sum + s.final_score, 0) / cat1Scores.length;
        const avg2 = cat2Scores.reduce((sum, s) => sum + s.final_score, 0) / cat2Scores.length;

        console.log(`${category}: ${avg1.toFixed(1)} vs ${avg2.toFixed(1)} (${avg1 > avg2 ? slug1 : slug2} leads)`);
      }

      await closeDb();

    } catch (error) {
      logError('Comparison failed', error as Error);
      await closeDb();
      process.exit(1);
    }
  });

program.parse();
