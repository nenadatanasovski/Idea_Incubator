#!/usr/bin/env npx tsx
/**
 * Schema Migration Helper
 *
 * This script helps identify types that have been migrated to the new schema system
 * and shows the migration status.
 *
 * Run: npm run schema:migrate-helper
 * Or:  npx tsx scripts/migrate-types-to-schema.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const typesDir = path.join(rootDir, "types");
const schemaDir = path.join(rootDir, "schema/entities");

interface MigrationStatus {
  file: string;
  typesFile: boolean;
  schemaFile: boolean;
  status: "migrated" | "pending" | "types-only" | "schema-only";
}

// Map of old types files to new schema entity files
const migrationMap: Record<string, string> = {
  "project.ts": "project.ts",
  "prd.ts": "prd.ts",
  "task-agent.ts": "task.ts", // Main task types
  // Future migrations
  "task-appendix.ts": "task-appendix.ts",
  "task-impact.ts": "task-impact.ts",
  "task-version.ts": "task-version.ts",
  "build-agent.ts": "build-agent-instance.ts",
  "notification.ts": "notification.ts",
  "ideation.ts": "ideation-session.ts",
};

// Types that have been migrated to schema/
const migratedTypes: Record<string, string[]> = {
  "schema/entities/project.ts": [
    "Project",
    "NewProject",
    "UpdateProject",
    "ProjectStatus",
    "projectStatuses",
  ],
  "schema/entities/task.ts": [
    "Task",
    "NewTask",
    "UpdateTask",
    "TaskStatus",
    "TaskCategory",
    "TaskPriority",
    "TaskEffort",
    "TaskOwner",
    "TaskQueue",
    "taskStatuses",
    "taskCategories",
    "taskPriorities",
    "taskEfforts",
    "taskOwners",
    "taskQueues",
  ],
  "schema/entities/task-list.ts": [
    "TaskList",
    "NewTaskList",
    "UpdateTaskList",
    "TaskListStatus",
    "taskListStatuses",
  ],
  "schema/entities/task-relationship.ts": [
    "TaskRelationship",
    "NewTaskRelationship",
    "CreateTaskRelationship",
    "RelationshipType",
    "relationshipTypes",
  ],
  "schema/entities/prd.ts": [
    "PRD",
    "NewPRD",
    "UpdatePRD",
    "PrdStatus",
    "prdStatuses",
  ],
  "schema/entities/idea.ts": [
    "Idea",
    "NewIdea",
    "UpdateIdea",
    "IdeaType",
    "LifecycleStage",
    "ideaTypes",
    "lifecycleStages",
  ],
};

async function analyzeTypesFiles(): Promise<MigrationStatus[]> {
  const results: MigrationStatus[] = [];

  // Get all files in types/
  const typesFiles = fs.readdirSync(typesDir).filter((f) => f.endsWith(".ts"));

  // Get all files in schema/entities/
  const schemaFiles = fs.existsSync(schemaDir)
    ? fs
        .readdirSync(schemaDir)
        .filter((f) => f.endsWith(".ts") && f !== "_template.ts")
    : [];

  // Analyze each types file
  for (const typesFile of typesFiles) {
    const schemaFile = migrationMap[typesFile];
    const hasTypes = true;
    const hasSchema = schemaFile ? schemaFiles.includes(schemaFile) : false;

    let status: MigrationStatus["status"];
    if (hasTypes && hasSchema) {
      status = "migrated";
    } else if (hasTypes && !hasSchema) {
      status = "types-only";
    } else if (!hasTypes && hasSchema) {
      status = "schema-only";
    } else {
      status = "pending";
    }

    results.push({
      file: typesFile,
      typesFile: hasTypes,
      schemaFile: hasSchema,
      status,
    });
  }

  return results;
}

async function main() {
  console.log("=== Schema Migration Status ===\n");

  console.log("Schema directory:", schemaDir);
  console.log("Types directory:", typesDir);
  console.log("");

  const status = await analyzeTypesFiles();

  console.log("Migration Status by File:\n");
  console.log("| File                  | types/ | schema/ | Status      |");
  console.log("|-----------------------|--------|---------|-------------|");

  for (const item of status) {
    const typesCheck = item.typesFile ? "  ✓   " : "  ✗   ";
    const schemaCheck = item.schemaFile ? "   ✓   " : "   ✗   ";
    const statusLabel = item.status.padEnd(11);
    console.log(
      `| ${item.file.padEnd(21)} |${typesCheck}|${schemaCheck}| ${statusLabel} |`,
    );
  }

  console.log("");
  console.log("Migrated Types from schema/:\n");

  for (const [file, types] of Object.entries(migratedTypes)) {
    console.log(`${file}:`);
    console.log(`  ${types.join(", ")}`);
    console.log("");
  }

  console.log("Import Examples:\n");
  console.log("// New (recommended):");
  console.log("import { Task, NewTask, TaskStatus } from '@/schema';");
  console.log(
    "import { insertTaskSchema, selectTaskSchema } from '@/schema';\n",
  );

  console.log("// Old (still works, but deprecated for migrated types):");
  console.log("import { Task } from '@/types/task-agent';  // ⚠️ Deprecated\n");

  console.log("For more info, see: /api/schema or run: npm run schema:studio");
}

main().catch(console.error);
