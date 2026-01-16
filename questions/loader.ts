import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import { getDb, query, run, saveDb } from "../database/db.js";
import { logInfo, logSuccess, logError, logWarning } from "../utils/logger.js";
import {
  QuestionBankFileSchema,
  QuestionWithCategory,
  QuestionCategory,
  QuestionPriority,
  IdeaTypeFilter,
  LifecycleStageFilter,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get path to questions directory
function getQuestionsDir(): string {
  return __dirname;
}

// List all YAML files in questions directory
function getQuestionFiles(): string[] {
  const dir = getQuestionsDir();
  const files = fs.readdirSync(dir);
  return files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
}

// Load and parse a single YAML file
function loadQuestionFile(filename: string): QuestionWithCategory[] {
  const filepath = path.join(getQuestionsDir(), filename);
  const content = fs.readFileSync(filepath, "utf-8");
  const data = parseYaml(content);

  // Validate with Zod
  const parsed = QuestionBankFileSchema.parse(data);

  // Add category to each question
  return parsed.questions.map((q) => ({
    ...q,
    category: parsed.category,
  }));
}

// Load all questions from all YAML files
export function loadAllQuestions(): QuestionWithCategory[] {
  const files = getQuestionFiles();
  const allQuestions: QuestionWithCategory[] = [];

  for (const file of files) {
    try {
      const questions = loadQuestionFile(file);
      allQuestions.push(...questions);
      logInfo(`Loaded ${questions.length} questions from ${file}`);
    } catch (error) {
      logError(`Failed to load ${file}`, error as Error);
    }
  }

  return allQuestions;
}

// Check if question bank is populated
export async function isQuestionBankPopulated(): Promise<boolean> {
  const result = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM question_bank",
  );
  return result.length > 0 && result[0].count > 0;
}

// Clear existing question bank
export async function clearQuestionBank(): Promise<void> {
  await run("DELETE FROM question_bank");
  logInfo("Cleared question bank");
}

// Insert questions into database
export async function populateQuestionBank(
  force: boolean = false,
): Promise<number> {
  const exists = await isQuestionBankPopulated();

  if (exists && !force) {
    logWarning("Question bank already populated. Use force=true to reload.");
    return 0;
  }

  if (force) {
    await clearQuestionBank();
  }

  const questions = loadAllQuestions();
  let inserted = 0;

  for (const q of questions) {
    try {
      await run(
        `INSERT INTO question_bank
         (id, criterion, category, question_text, question_type, priority,
          idea_types, lifecycle_stages, depends_on, follow_up_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          q.criterion,
          q.category,
          q.text,
          q.type,
          q.priority,
          q.idea_types ? JSON.stringify(q.idea_types) : null,
          q.lifecycle_stages ? JSON.stringify(q.lifecycle_stages) : null,
          q.depends_on ? JSON.stringify(q.depends_on) : null,
          q.follow_ups ? JSON.stringify(q.follow_ups) : null,
        ],
      );
      inserted++;
    } catch (error) {
      logError(`Failed to insert question ${q.id}`, error as Error);
    }
  }

  await saveDb();
  logSuccess(`Populated question bank with ${inserted} questions`);
  return inserted;
}

// Get all questions from database
export async function getAllQuestions(): Promise<QuestionWithCategory[]> {
  interface DBQuestion {
    id: string;
    criterion: string;
    category: string;
    question_text: string;
    question_type: string;
    priority: string;
    idea_types: string | null;
    lifecycle_stages: string | null;
    depends_on: string | null;
    follow_up_ids: string | null;
    [key: string]: unknown;
  }

  const rows = await query<DBQuestion>(
    "SELECT * FROM question_bank ORDER BY criterion, priority",
  );

  return rows.map((row) => ({
    id: row.id,
    criterion: row.criterion,
    category: row.category as QuestionCategory,
    text: row.question_text,
    type: row.question_type as "factual" | "analytical" | "reflective",
    priority: row.priority as QuestionPriority,
    idea_types: row.idea_types ? JSON.parse(row.idea_types) : null,
    lifecycle_stages: row.lifecycle_stages
      ? JSON.parse(row.lifecycle_stages)
      : null,
    depends_on: row.depends_on ? JSON.parse(row.depends_on) : null,
    follow_ups: row.follow_up_ids ? JSON.parse(row.follow_up_ids) : null,
  }));
}

// Get questions by category
export async function getQuestionsByCategory(
  category: QuestionCategory,
): Promise<QuestionWithCategory[]> {
  interface DBQuestion {
    id: string;
    criterion: string;
    category: string;
    question_text: string;
    question_type: string;
    priority: string;
    idea_types: string | null;
    lifecycle_stages: string | null;
    depends_on: string | null;
    follow_up_ids: string | null;
    [key: string]: unknown;
  }

  const rows = await query<DBQuestion>(
    "SELECT * FROM question_bank WHERE category = ? ORDER BY criterion, priority",
    [category],
  );

  return rows.map((row) => ({
    id: row.id,
    criterion: row.criterion,
    category: row.category as QuestionCategory,
    text: row.question_text,
    type: row.question_type as "factual" | "analytical" | "reflective",
    priority: row.priority as QuestionPriority,
    idea_types: row.idea_types ? JSON.parse(row.idea_types) : null,
    lifecycle_stages: row.lifecycle_stages
      ? JSON.parse(row.lifecycle_stages)
      : null,
    depends_on: row.depends_on ? JSON.parse(row.depends_on) : null,
    follow_ups: row.follow_up_ids ? JSON.parse(row.follow_up_ids) : null,
  }));
}

// Get questions filtered by idea type and lifecycle stage
export async function getRelevantQuestions(
  ideaType: IdeaTypeFilter | null,
  lifecycleStage: LifecycleStageFilter | null,
): Promise<QuestionWithCategory[]> {
  const allQuestions = await getAllQuestions();

  return allQuestions.filter((q) => {
    // Filter by idea type (null = all types)
    if (ideaType && q.idea_types && !q.idea_types.includes(ideaType)) {
      return false;
    }

    // Filter by lifecycle stage (null = all stages)
    if (
      lifecycleStage &&
      q.lifecycle_stages &&
      !q.lifecycle_stages.includes(lifecycleStage)
    ) {
      return false;
    }

    return true;
  });
}

// Get a single question by ID
export async function getQuestionById(
  questionId: string,
): Promise<QuestionWithCategory | null> {
  interface DBQuestion {
    id: string;
    criterion: string;
    category: string;
    question_text: string;
    question_type: string;
    priority: string;
    idea_types: string | null;
    lifecycle_stages: string | null;
    depends_on: string | null;
    follow_up_ids: string | null;
    [key: string]: unknown;
  }

  const rows = await query<DBQuestion>(
    "SELECT * FROM question_bank WHERE id = ?",
    [questionId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    criterion: row.criterion,
    category: row.category as QuestionCategory,
    text: row.question_text,
    type: row.question_type as "factual" | "analytical" | "reflective",
    priority: row.priority as QuestionPriority,
    idea_types: row.idea_types ? JSON.parse(row.idea_types) : null,
    lifecycle_stages: row.lifecycle_stages
      ? JSON.parse(row.lifecycle_stages)
      : null,
    depends_on: row.depends_on ? JSON.parse(row.depends_on) : null,
    follow_ups: row.follow_up_ids ? JSON.parse(row.follow_up_ids) : null,
  };
}

// Get multiple questions by IDs (batch query to avoid N+1 problem)
export async function getQuestionsByIds(
  questionIds: string[],
): Promise<QuestionWithCategory[]> {
  if (questionIds.length === 0) return [];

  interface DBQuestion {
    id: string;
    criterion: string;
    category: string;
    question_text: string;
    question_type: string;
    priority: string;
    idea_types: string | null;
    lifecycle_stages: string | null;
    depends_on: string | null;
    follow_up_ids: string | null;
    [key: string]: unknown;
  }

  // Build placeholders for the IN clause
  const placeholders = questionIds.map(() => "?").join(",");
  const rows = await query<DBQuestion>(
    `SELECT * FROM question_bank WHERE id IN (${placeholders})`,
    questionIds,
  );

  return rows.map((row) => ({
    id: row.id,
    criterion: row.criterion,
    category: row.category as QuestionCategory,
    text: row.question_text,
    type: row.question_type as "factual" | "analytical" | "reflective",
    priority: row.priority as QuestionPriority,
    idea_types: row.idea_types ? JSON.parse(row.idea_types) : null,
    lifecycle_stages: row.lifecycle_stages
      ? JSON.parse(row.lifecycle_stages)
      : null,
    depends_on: row.depends_on ? JSON.parse(row.depends_on) : null,
    follow_ups: row.follow_up_ids ? JSON.parse(row.follow_up_ids) : null,
  }));
}

// Get question count statistics
export async function getQuestionStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byCriterion: Record<string, number>;
}> {
  interface CountResult {
    category: string;
    count: number;
    [key: string]: unknown;
  }

  interface PriorityResult {
    priority: string;
    count: number;
    [key: string]: unknown;
  }

  interface CriterionResult {
    criterion: string;
    count: number;
    [key: string]: unknown;
  }

  const [totalResult, categoryResult, priorityResult, criterionResult] =
    await Promise.all([
      query<{ count: number }>("SELECT COUNT(*) as count FROM question_bank"),
      query<CountResult>(
        "SELECT category, COUNT(*) as count FROM question_bank GROUP BY category",
      ),
      query<PriorityResult>(
        "SELECT priority, COUNT(*) as count FROM question_bank GROUP BY priority",
      ),
      query<CriterionResult>(
        "SELECT criterion, COUNT(*) as count FROM question_bank GROUP BY criterion",
      ),
    ]);

  return {
    total: totalResult[0]?.count || 0,
    byCategory: Object.fromEntries(
      categoryResult.map((r) => [r.category, r.count]),
    ),
    byPriority: Object.fromEntries(
      priorityResult.map((r) => [r.priority, r.count]),
    ),
    byCriterion: Object.fromEntries(
      criterionResult.map((r) => [r.criterion, r.count]),
    ),
  };
}

// CLI entry point for populating question bank
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  try {
    await getDb();
    const count = await populateQuestionBank(force);

    if (count > 0) {
      const stats = await getQuestionStats();
      console.log("\nQuestion Bank Statistics:");
      console.log("========================");
      console.log(`Total: ${stats.total}`);
      console.log("\nBy Category:");
      Object.entries(stats.byCategory).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
      console.log("\nBy Priority:");
      Object.entries(stats.byPriority).forEach(([pri, count]) => {
        console.log(`  ${pri}: ${count}`);
      });
    }
  } catch (error) {
    logError("Failed to populate question bank", error as Error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("loader.ts") ||
    process.argv[1].endsWith("loader.js"));

if (isMainModule) {
  main();
}
