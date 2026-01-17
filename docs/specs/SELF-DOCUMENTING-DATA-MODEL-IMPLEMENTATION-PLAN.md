# Self-Documenting Data Model Implementation Plan

> **Goal**: Create a single source of truth for the data model that automatically generates documentation, types, and validation - eliminating manual synchronization between code, database, and documentation.

---

## Quick Reference: Test Scripts & Pass Criteria

| Phase                         | Test Script                           | Key Pass Criteria                                                          |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| **Phase 1: Foundation**       | `tests/e2e/test-phase1-foundation.sh` | Dependencies installed, directory structure created, first entity compiles |
| **Phase 2: Core Migration**   | `tests/e2e/test-phase2-migration.sh`  | 40+ entities migrated, Zod schemas work, backwards compat maintained       |
| **Phase 3: Discovery API**    | `tests/e2e/test-phase3-api.sh`        | All `/api/schema/*` endpoints return valid JSON, response < 100ms          |
| **Phase 4: Schema Viewer UI** | `tests/e2e/test-phase4-ui.sh`         | `/schema` page renders, ERD displays, search works                         |
| **Phase 5: Backwards Compat** | `tests/e2e/test-phase5-compat.sh`     | Old imports work, full codebase compiles, all tests pass                   |
| **All Phases**                | `tests/e2e/test-all-phases.sh`        | All individual phase tests pass                                            |
| **Quick Check**               | `tests/e2e/test-schema-quick.sh`      | Schema loads, compiles, API responds                                       |

### Running Tests

```bash
# Quick validation
bash tests/e2e/test-schema-quick.sh

# Single phase
bash tests/e2e/test-phase1-foundation.sh

# Full suite
bash tests/e2e/test-all-phases.sh
```

---

## Executive Summary

This plan establishes a **Drizzle + Zod schema-first architecture** where:

1. All entities are defined once in `schema/entities/*.ts`
2. TypeScript types, Zod validators, and migrations are auto-generated
3. A `/api/schema` endpoint serves live documentation (like FastAPI's `/docs`)
4. Agents discover the data model programmatically via the schema registry

---

## Current State Analysis

### Inventory

| Metric                | Count                                             |
| --------------------- | ------------------------------------------------- |
| Type definition files | 19                                                |
| Entity types          | ~200+                                             |
| Database tables       | ~40+                                              |
| Lines of type code    | ~3,200                                            |
| Validation approach   | Mixed (Zod partial, mostly TypeScript interfaces) |

### Current Pain Points

1. **Documentation drift** - Markdown specs diverge from actual implementation
2. **Dual maintenance** - Types defined separately from database schema
3. **Inconsistent validation** - Some entities use Zod, most don't
4. **No discoverability** - Agents can't programmatically discover the data model
5. **Migration fragility** - Manual SQL migrations can diverge from types

### Existing Patterns to Preserve

- ✅ Mapper functions (`mapPrdRow()`, `mapTaskAppendixRow()`)
- ✅ Row types for database representation
- ✅ Input types for creation/updates
- ✅ Dual identity system (UUID + display ID)

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         schema/ (Single Source of Truth)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  entities/           Drizzle table definitions + Zod schemas            │
│  ├── task.ts         export const tasks = pgTable(...)                  │
│  ├── project.ts      export const projects = pgTable(...)               │
│  ├── prd.ts          export const prds = pgTable(...)                   │
│  └── ...             + auto-generated Zod schemas via drizzle-zod       │
│                                                                          │
│  relations.ts        Foreign key and relationship definitions            │
│  registry.ts         Machine-readable schema manifest                    │
│  index.ts            Public exports (types, schemas, registry)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   drizzle-kit   │      │   drizzle-zod   │      │  Direct Import  │
│                 │      │                 │      │                 │
│  - Migrations   │      │  - Zod schemas  │      │  - TS types     │
│  - Push/pull    │      │  - Validation   │      │  - Intellisense │
│  - Studio       │      │  - JSON Schema  │      │  - Type guards  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Database     │      │  /api/schema/*  │      │   Application   │
│   (SQLite →     │      │                 │      │      Code       │
│   PostgreSQL)   │      │  - OpenAPI spec │      │                 │
│                 │      │  - ERD diagram  │      │  Type-safe      │
│                 │      │  - Live docs    │      │  queries        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                    │
                                    ▼
                         ┌─────────────────┐
                         │     Agents      │
                         │                 │
                         │  GET /api/schema│
                         │  to discover    │
                         │  data model     │
                         └─────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

#### Phase 1 Checklist

- [ ] **1.1 Dependencies installed**
  - [ ] `drizzle-orm` installed
  - [ ] `drizzle-zod` installed
  - [ ] `zod` installed
  - [ ] `drizzle-kit` installed (dev)
  - [ ] `zod-to-json-schema` installed
- [ ] **1.2 Directory structure created**
  - [ ] `schema/` root directory
  - [ ] `schema/entities/` subdirectory
  - [ ] `schema/relations/` subdirectory
  - [ ] `schema/enums/` subdirectory
  - [ ] `schema/generated/` subdirectory
- [ ] **1.3 Core files created**
  - [ ] `schema/index.ts` (public API)
  - [ ] `schema/registry.ts` (schema registry)
  - [ ] `schema/db.ts` (database connection)
  - [ ] `schema/entities/_template.ts` (entity template)
- [ ] **1.4 Drizzle config created**
  - [ ] `drizzle.config.ts` at project root
  - [ ] NPM scripts added to `package.json`
- [ ] **1.5 First entity migrated (proof of concept)**
  - [ ] One simple entity defined in new schema
  - [ ] Migration generated successfully
  - [ ] Migration applied to database

#### Phase 1 Test Script

```bash
#!/bin/bash
# tests/e2e/test-phase1-foundation.sh

set -e
echo "=== Phase 1 Foundation Tests ==="

# Test 1.1: Dependencies
echo "Testing dependencies..."
npm ls drizzle-orm drizzle-zod zod drizzle-kit zod-to-json-schema

# Test 1.2: Directory structure
echo "Testing directory structure..."
test -d schema && echo "✓ schema/ exists" || (echo "✗ schema/ missing" && exit 1)
test -d schema/entities && echo "✓ schema/entities/ exists" || (echo "✗ schema/entities/ missing" && exit 1)
test -d schema/relations && echo "✓ schema/relations/ exists" || (echo "✗ schema/relations/ missing" && exit 1)
test -d schema/enums && echo "✓ schema/enums/ exists" || (echo "✗ schema/enums/ missing" && exit 1)

# Test 1.3: Core files
echo "Testing core files..."
test -f schema/index.ts && echo "✓ schema/index.ts exists" || (echo "✗ schema/index.ts missing" && exit 1)
test -f schema/registry.ts && echo "✓ schema/registry.ts exists" || (echo "✗ schema/registry.ts missing" && exit 1)
test -f schema/db.ts && echo "✓ schema/db.ts exists" || (echo "✗ schema/db.ts missing" && exit 1)
test -f schema/entities/_template.ts && echo "✓ template exists" || (echo "✗ template missing" && exit 1)

# Test 1.4: Config
echo "Testing Drizzle config..."
test -f drizzle.config.ts && echo "✓ drizzle.config.ts exists" || (echo "✗ drizzle.config.ts missing" && exit 1)

# Test 1.5: NPM scripts
echo "Testing NPM scripts..."
npm run schema:generate --dry-run 2>/dev/null && echo "✓ schema:generate works" || echo "⚠ schema:generate not configured"
npm run schema:validate --dry-run 2>/dev/null && echo "✓ schema:validate works" || echo "⚠ schema:validate not configured"

# Test 1.6: TypeScript compilation
echo "Testing TypeScript compilation..."
npx tsc --noEmit schema/index.ts && echo "✓ Schema compiles" || (echo "✗ Schema compilation failed" && exit 1)

echo ""
echo "=== Phase 1 Tests Complete ==="
```

#### Phase 1 Pass Criteria

| Criterion           | Requirement                                 | Verification                 |
| ------------------- | ------------------------------------------- | ---------------------------- |
| Dependencies        | All 5 packages installed                    | `npm ls` returns 0           |
| Directory structure | All 4 subdirectories exist                  | `test -d` passes             |
| Core files          | All 4 files exist and compile               | `tsc --noEmit` passes        |
| Drizzle config      | Config file exists and is valid             | `drizzle-kit check` passes   |
| NPM scripts         | `schema:generate` and `schema:migrate` work | Dry run succeeds             |
| Proof of concept    | At least 1 entity migrated                  | Entity queryable via Drizzle |

---

#### 1.1 Install Dependencies

```bash
npm install drizzle-orm drizzle-zod zod zod-to-json-schema
npm install -D drizzle-kit @types/better-sqlite3
```

#### 1.2 Create Schema Directory Structure

```
schema/
├── index.ts                    # Public API exports
├── registry.ts                 # Schema registry for discovery
├── db.ts                       # Database connection
├── entities/                   # Entity definitions
│   ├── _template.ts            # Template for new entities
│   ├── task.ts
│   ├── task-list.ts
│   ├── task-relationship.ts
│   ├── task-appendix.ts
│   ├── task-impact.ts
│   ├── task-version.ts
│   ├── task-test-result.ts
│   ├── project.ts
│   ├── prd.ts
│   ├── idea.ts
│   ├── ideation-session.ts
│   ├── build-agent.ts
│   └── ... (all ~40 tables)
├── relations/                  # Relationship definitions
│   ├── task-relations.ts
│   ├── project-relations.ts
│   └── ...
├── enums/                      # Shared enum definitions
│   ├── task-status.ts
│   ├── task-category.ts
│   ├── relationship-type.ts
│   └── ...
└── generated/                  # Auto-generated artifacts
    ├── types.ts                # Re-exported for backwards compat
    ├── openapi.json            # OpenAPI specification
    └── erd.json                # ERD data for visualization
```

#### 1.3 Create Schema Registry

```typescript
// schema/registry.ts
import type { AnyZodObject } from "zod";

export interface EntityMetadata {
  name: string;
  file: string;
  table: string;
  description: string;
  primaryKey: string;
  foreignKeys: Array<{
    column: string;
    references: { table: string; column: string };
  }>;
  selectSchema: () => Promise<AnyZodObject>;
  insertSchema: () => Promise<AnyZodObject>;
}

export interface SchemaRegistry {
  version: string;
  generatedAt: string;
  entities: Record<string, EntityMetadata>;
  enums: Record<string, string[]>;
  relationships: Array<{
    from: string;
    to: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
    through?: string;
  }>;
}

export const schemaRegistry: SchemaRegistry = {
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  entities: {
    task: {
      name: "Task",
      file: "schema/entities/task.ts",
      table: "tasks",
      description: "Core unit of work with dual identity (UUID + display ID)",
      primaryKey: "id",
      foreignKeys: [
        {
          column: "task_list_id",
          references: { table: "task_lists_v2", column: "id" },
        },
        {
          column: "project_id",
          references: { table: "projects", column: "id" },
        },
      ],
      selectSchema: () =>
        import("./entities/task").then((m) => m.selectTaskSchema),
      insertSchema: () =>
        import("./entities/task").then((m) => m.insertTaskSchema),
    },
    // ... all other entities
  },
  enums: {
    taskStatus: [
      "pending",
      "in_progress",
      "completed",
      "failed",
      "blocked",
      "skipped",
    ],
    taskCategory: [
      "feature",
      "bug",
      "enhancement",
      "refactor",
      "documentation",
      "test",
      "infrastructure",
      "research",
      "security",
      "performance",
    ],
    // ... all other enums
  },
  relationships: [
    { from: "task", to: "task_list", type: "many-to-one" },
    { from: "task", to: "project", type: "many-to-one" },
    { from: "project", to: "idea", type: "one-to-one" },
    // ... all relationships
  ],
};
```

#### 1.4 Entity Template

```typescript
// schema/entities/_template.ts
/**
 * Template for creating new schema entities.
 *
 * WORKFLOW:
 * 1. Copy this file to schema/entities/{entity-name}.ts
 * 2. Define the table using sqliteTable() or pgTable()
 * 3. Add to schema/registry.ts
 * 4. Run: npm run schema:generate
 * 5. Run: npm run schema:migrate
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// 1. Table Definition (Source of Truth)
export const myEntities = sqliteTable("my_entities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "inactive"] }).default("active"),
  createdAt: text("created_at").notNull().default("datetime('now')"),
  updatedAt: text("updated_at"),
});

// 2. Auto-generated Zod Schemas
export const insertMyEntitySchema = createInsertSchema(myEntities, {
  // Optional: Add custom refinements
  name: z.string().min(1).max(200),
});

export const selectMyEntitySchema = createSelectSchema(myEntities);

// 3. Auto-inferred TypeScript Types
export type MyEntity = typeof myEntities.$inferSelect;
export type NewMyEntity = typeof myEntities.$inferInsert;

// 4. Custom Schemas (if needed)
export const updateMyEntitySchema = insertMyEntitySchema
  .partial()
  .omit({ id: true });
```

---

### Phase 2: Core Entity Migration (Week 2-4)

#### Phase 2 Checklist

- [ ] **Wave 1: Base tables (no dependencies)**
  - [ ] `schema/entities/idea.ts` created
  - [ ] `schema/entities/project.ts` created
  - [ ] `schema/entities/user.ts` created (if applicable)
  - [ ] `schema/enums/task-status.ts` created
  - [ ] `schema/enums/task-category.ts` created
  - [ ] All Wave 1 entities registered in registry
  - [ ] Migration generated and applied
- [ ] **Wave 2: First-level dependencies**
  - [ ] `schema/entities/task-list.ts` created (→ projects)
  - [ ] `schema/entities/prd.ts` created (→ projects)
  - [ ] `schema/entities/ideation-session.ts` created
  - [ ] `schema/entities/idea-version.ts` created (→ ideas)
  - [ ] All Wave 2 entities registered in registry
  - [ ] Migration generated and applied
- [ ] **Wave 3: Second-level dependencies**
  - [ ] `schema/entities/task.ts` created (→ task_lists, projects)
  - [ ] `schema/entities/prd-task-link.ts` created (→ prds, task_lists)
  - [ ] `schema/entities/idea-candidate.ts` created
  - [ ] `schema/entities/gap-analysis.ts` created (→ ideas)
  - [ ] All Wave 3 entities registered in registry
  - [ ] Migration generated and applied
- [ ] **Wave 4: Task ecosystem**
  - [ ] `schema/entities/task-relationship.ts` created
  - [ ] `schema/entities/task-appendix.ts` created
  - [ ] `schema/entities/task-file-impact.ts` created
  - [ ] `schema/entities/task-impact.ts` created
  - [ ] `schema/entities/task-version.ts` created
  - [ ] `schema/entities/task-test-result.ts` created
  - [ ] `schema/entities/task-state-history.ts` created
  - [ ] All Wave 4 entities registered in registry
  - [ ] Migration generated and applied
- [ ] **Wave 5: Execution & agents**
  - [ ] `schema/entities/build-agent-instance.ts` created
  - [ ] `schema/entities/task-agent-instance.ts` created
  - [ ] `schema/entities/execution-run.ts` created
  - [ ] `schema/entities/parallel-execution-wave.ts` created
  - [ ] `schema/entities/parallelism-analysis.ts` created
  - [ ] All Wave 5 entities registered in registry
  - [ ] Migration generated and applied
- [ ] **Wave 6: Remaining tables**
  - [ ] `schema/entities/grouping-suggestion.ts` created
  - [ ] `schema/entities/display-id-sequence.ts` created
  - [ ] `schema/entities/notification.ts` created
  - [ ] Knowledge base entities created
  - [ ] All Wave 6 entities registered in registry
  - [ ] Migration generated and applied
- [ ] **Backwards compatibility exports**
  - [ ] `types/task-agent.ts` re-exports from schema
  - [ ] `types/project.ts` re-exports from schema
  - [ ] All existing imports still work

#### Phase 2 Test Script

```bash
#!/bin/bash
# tests/e2e/test-phase2-migration.sh

set -e
echo "=== Phase 2 Entity Migration Tests ==="

ENTITY_DIR="schema/entities"
EXPECTED_ENTITIES=(
  "idea.ts"
  "project.ts"
  "task-list.ts"
  "prd.ts"
  "task.ts"
  "task-relationship.ts"
  "task-appendix.ts"
  "task-file-impact.ts"
  "task-version.ts"
  "task-test-result.ts"
  "build-agent-instance.ts"
  "notification.ts"
)

# Test 2.1: Entity files exist
echo "Testing entity files..."
MISSING=0
for entity in "${EXPECTED_ENTITIES[@]}"; do
  if [ -f "$ENTITY_DIR/$entity" ]; then
    echo "✓ $entity exists"
  else
    echo "✗ $entity missing"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo "⚠ $MISSING entities missing (may be expected if partial migration)"
fi

# Test 2.2: Schema compiles
echo ""
echo "Testing schema compilation..."
npx tsc --noEmit schema/index.ts && echo "✓ Schema compiles" || exit 1

# Test 2.3: Registry is complete
echo ""
echo "Testing registry completeness..."
node -e "
const { schemaRegistry } = require('./schema/registry');
const entityCount = Object.keys(schemaRegistry.entities).length;
const enumCount = Object.keys(schemaRegistry.enums).length;
const relCount = schemaRegistry.relationships.length;
console.log('Entities registered:', entityCount);
console.log('Enums registered:', enumCount);
console.log('Relationships registered:', relCount);
if (entityCount < 10) {
  console.log('⚠ Expected at least 10 entities');
  process.exit(1);
}
console.log('✓ Registry has sufficient entities');
"

# Test 2.4: Migrations apply cleanly
echo ""
echo "Testing migration generation..."
npm run schema:generate -- --dry-run 2>&1 | head -20

# Test 2.5: Backwards compatibility
echo ""
echo "Testing backwards compatibility..."
node -e "
try {
  const { Task, NewTask } = require('./types/task-agent');
  console.log('✓ types/task-agent.ts exports work');
} catch (e) {
  console.log('⚠ types/task-agent.ts backwards compat not set up');
}
"

# Test 2.6: Entity validation schemas work
echo ""
echo "Testing Zod schemas..."
node -e "
const { insertTaskSchema, selectTaskSchema } = require('./schema/entities/task');
const testTask = {
  id: 'test-123',
  title: 'Test Task',
  status: 'pending'
};
const result = insertTaskSchema.safeParse(testTask);
if (result.success) {
  console.log('✓ Zod validation works');
} else {
  console.log('✗ Zod validation failed:', result.error.message);
  process.exit(1);
}
"

echo ""
echo "=== Phase 2 Tests Complete ==="
```

#### Phase 2 Pass Criteria

| Criterion         | Requirement                | Verification                                        |
| ----------------- | -------------------------- | --------------------------------------------------- |
| Wave 1-6 complete | All 40+ entities migrated  | Count files in `schema/entities/`                   |
| Registry complete | All entities in registry   | `Object.keys(schemaRegistry.entities).length >= 40` |
| Compilation       | All schema files compile   | `npx tsc --noEmit schema/**/*.ts`                   |
| Migrations        | All waves have migrations  | `drizzle-kit generate` shows no pending changes     |
| Zod schemas       | Insert/Select schemas work | `insertSchema.safeParse()` succeeds                 |
| Backwards compat  | Old imports still work     | Existing code compiles unchanged                    |
| Foreign keys      | All FKs correctly defined  | `schemaRegistry.entities[x].foreignKeys` populated  |

---

#### Migration Order (by dependency)

```
Wave 1: No dependencies (base tables)
├── ideas
├── projects
├── users (if exists)
└── enums (status, category, etc.)

Wave 2: First-level dependencies
├── task_lists_v2 (→ projects)
├── prds (→ projects)
├── ideation_sessions
└── idea_versions (→ ideas)

Wave 3: Second-level dependencies
├── tasks (→ task_lists_v2, projects)
├── prd_task_lists (→ prds, task_lists_v2)
├── idea_candidates (→ ideation_sessions, ideas)
└── gap_analysis (→ ideas)

Wave 4: Task ecosystem
├── task_relationships (→ tasks)
├── task_appendices (→ tasks)
├── task_file_impacts (→ tasks)
├── task_impacts (→ tasks)
├── task_versions (→ tasks)
├── task_test_results (→ tasks)
└── task_state_history (→ tasks)

Wave 5: Execution & agents
├── build_agent_instances (→ tasks)
├── task_agent_instances (→ projects)
├── execution_runs (→ task_lists_v2)
├── parallel_execution_waves (→ task_lists_v2)
└── parallelism_analysis (→ tasks)

Wave 6: Remaining tables
├── grouping_suggestions
├── display_id_sequences
├── notifications
└── knowledge base tables
```

#### Example: Task Entity Migration

```typescript
// schema/entities/task.ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { taskLists } from "./task-list";
import { projects } from "./project";

// Enum definitions (shared)
export const taskStatuses = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "blocked",
  "skipped",
] as const;
export const taskCategories = [
  "feature",
  "bug",
  "enhancement",
  "refactor",
  "documentation",
  "test",
  "infrastructure",
  "research",
  "security",
  "performance",
] as const;
export const taskPriorities = ["critical", "high", "medium", "low"] as const;

// Table definition
export const tasks = sqliteTable("tasks", {
  // Identity
  id: text("id").primaryKey(),
  displayId: text("display_id").unique(),

  // Core fields
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: taskStatuses }).notNull().default("pending"),
  category: text("category", { enum: taskCategories }),
  priority: text("priority", { enum: taskPriorities }).default("medium"),

  // Relationships
  taskListId: text("task_list_id").references(() => taskLists.id, {
    onDelete: "set null",
  }),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),

  // Metadata
  estimatedEffort: integer("estimated_effort"),
  actualEffort: integer("actual_effort"),
  confidence: real("confidence"),
  orderIndex: integer("order_index").default(0),

  // Execution tracking
  assignedAgentId: text("assigned_agent_id"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),

  // Timestamps
  createdAt: text("created_at").notNull().default("datetime('now')"),
  updatedAt: text("updated_at"),

  // Version tracking
  version: integer("version").default(1),
});

// Display ID pattern validation
const displayIdPattern = /^TU-[A-Z]{2,4}-[A-Z]{3}-\d{3,}$/;

// Auto-generated schemas with refinements
export const insertTaskSchema = createInsertSchema(tasks, {
  title: z.string().min(1).max(500),
  displayId: z.string().regex(displayIdPattern).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const selectTaskSchema = createSelectSchema(tasks);

export const updateTaskSchema = insertTaskSchema
  .partial()
  .omit({ id: true, createdAt: true });

// TypeScript types
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
```

---

### Phase 3: Discovery API (Week 4-5)

#### Phase 3 Checklist

- [ ] **3.1 Core API routes**
  - [ ] `GET /api/schema` - Discovery endpoint
  - [ ] `GET /api/schema/entities/:name` - Entity schema
  - [ ] `GET /api/schema/enums` - All enums
  - [ ] `GET /api/schema/enums/:name` - Specific enum
  - [ ] `GET /api/schema/relationships` - Relationship graph
  - [ ] `GET /api/schema/full` - Complete schema dump
- [ ] **3.2 Documentation endpoints**
  - [ ] `GET /api/schema/openapi.json` - OpenAPI spec
  - [ ] `GET /api/schema/erd` - ERD data for visualization
  - [ ] `GET /api/schema/erd/mermaid` - Mermaid diagram source
- [ ] **3.3 Helper services**
  - [ ] `server/services/schema/erd-generator.ts` created
  - [ ] `server/services/schema/openapi-generator.ts` created
  - [ ] `server/services/schema/schema-service.ts` created
- [ ] **3.4 Route registration**
  - [ ] Routes registered in `server/api.ts`
  - [ ] Routes accessible without authentication
- [ ] **3.5 Response caching**
  - [ ] Static schema responses cached
  - [ ] Cache invalidation on server restart

#### Phase 3 Test Script

```bash
#!/bin/bash
# tests/e2e/test-phase3-api.sh

set -e
BASE_URL="${BASE_URL:-http://localhost:3001}"

echo "=== Phase 3 Discovery API Tests ==="

# Wait for server
echo "Checking server availability..."
curl -s --retry 5 --retry-delay 2 "$BASE_URL/api/health" > /dev/null || {
  echo "✗ Server not available at $BASE_URL"
  exit 1
}
echo "✓ Server is up"

# Test 3.1: Discovery endpoint
echo ""
echo "Testing GET /api/schema..."
RESPONSE=$(curl -s "$BASE_URL/api/schema")
echo "$RESPONSE" | jq -e '.entities | length > 0' > /dev/null && echo "✓ Returns entities list" || exit 1
echo "$RESPONSE" | jq -e '.enums | length > 0' > /dev/null && echo "✓ Returns enums list" || exit 1
echo "$RESPONSE" | jq -e '.endpoints' > /dev/null && echo "✓ Returns endpoint map" || exit 1

# Test 3.2: Entity schema endpoint
echo ""
echo "Testing GET /api/schema/entities/task..."
ENTITY=$(curl -s "$BASE_URL/api/schema/entities/task")
echo "$ENTITY" | jq -e '.name == "Task"' > /dev/null && echo "✓ Returns entity name" || exit 1
echo "$ENTITY" | jq -e '.schemas.select' > /dev/null && echo "✓ Returns select schema" || exit 1
echo "$ENTITY" | jq -e '.schemas.insert' > /dev/null && echo "✓ Returns insert schema" || exit 1
echo "$ENTITY" | jq -e '.foreignKeys | type == "array"' > /dev/null && echo "✓ Returns foreign keys" || exit 1

# Test 3.3: 404 for unknown entity
echo ""
echo "Testing 404 for unknown entity..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/schema/entities/nonexistent")
[ "$STATUS" = "404" ] && echo "✓ Returns 404 for unknown entity" || exit 1

# Test 3.4: Enums endpoint
echo ""
echo "Testing GET /api/schema/enums..."
ENUMS=$(curl -s "$BASE_URL/api/schema/enums")
echo "$ENUMS" | jq -e '.taskStatus | length > 0' > /dev/null && echo "✓ taskStatus enum present" || exit 1
echo "$ENUMS" | jq -e '.taskCategory | length > 0' > /dev/null && echo "✓ taskCategory enum present" || exit 1

# Test 3.5: Relationships endpoint
echo ""
echo "Testing GET /api/schema/relationships..."
RELS=$(curl -s "$BASE_URL/api/schema/relationships")
echo "$RELS" | jq -e 'length > 0' > /dev/null && echo "✓ Returns relationships" || exit 1
echo "$RELS" | jq -e '.[0].from' > /dev/null && echo "✓ Relationships have 'from'" || exit 1
echo "$RELS" | jq -e '.[0].to' > /dev/null && echo "✓ Relationships have 'to'" || exit 1
echo "$RELS" | jq -e '.[0].type' > /dev/null && echo "✓ Relationships have 'type'" || exit 1

# Test 3.6: ERD endpoint
echo ""
echo "Testing GET /api/schema/erd..."
ERD=$(curl -s "$BASE_URL/api/schema/erd")
echo "$ERD" | jq -e '.nodes | length > 0' > /dev/null && echo "✓ ERD has nodes" || exit 1
echo "$ERD" | jq -e '.edges | length > 0' > /dev/null && echo "✓ ERD has edges" || exit 1

# Test 3.7: Full schema dump
echo ""
echo "Testing GET /api/schema/full..."
FULL=$(curl -s "$BASE_URL/api/schema/full")
echo "$FULL" | jq -e '.version' > /dev/null && echo "✓ Full dump has version" || exit 1
echo "$FULL" | jq -e '.entities | length > 10' > /dev/null && echo "✓ Full dump has entities" || exit 1

# Test 3.8: Response time
echo ""
echo "Testing response time..."
TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/schema")
echo "Response time: ${TIME}s"
[ $(echo "$TIME < 0.5" | bc) -eq 1 ] && echo "✓ Response under 500ms" || echo "⚠ Response slow (${TIME}s)"

echo ""
echo "=== Phase 3 Tests Complete ==="
```

#### Phase 3 Pass Criteria

| Criterion          | Requirement                  | Verification                                  |
| ------------------ | ---------------------------- | --------------------------------------------- |
| Discovery endpoint | Returns entity/enum list     | `GET /api/schema` has `entities[]`            |
| Entity schema      | Returns JSON Schema format   | `schemas.select` and `schemas.insert` present |
| 404 handling       | Unknown entities return 404  | Status code check                             |
| Enums endpoint     | Returns all registered enums | All enums from registry present               |
| Relationships      | Returns relationship graph   | Array with `from`, `to`, `type`               |
| ERD data           | Returns nodes and edges      | `nodes[]` and `edges[]` present               |
| Full dump          | Complete schema export       | All entities with full metadata               |
| Response time      | Under 100ms for cached       | Measure with `curl -w`                        |
| No auth required   | Public access                | Endpoints work without token                  |

---

#### 3.1 Schema API Routes

```typescript
// server/routes/schema.ts
import { Router } from "express";
import { schemaRegistry } from "../../schema/registry";
import { zodToJsonSchema } from "zod-to-json-schema";

const router = Router();

// GET /api/schema - Discovery endpoint (entry point for agents)
router.get("/", async (req, res) => {
  res.json({
    version: schemaRegistry.version,
    generatedAt: schemaRegistry.generatedAt,
    entities: Object.keys(schemaRegistry.entities),
    enums: Object.keys(schemaRegistry.enums),
    endpoints: {
      entity: "/api/schema/entities/:name",
      enum: "/api/schema/enums/:name",
      relationships: "/api/schema/relationships",
      openapi: "/api/schema/openapi.json",
      erd: "/api/schema/erd",
      full: "/api/schema/full",
    },
    documentation: "https://docs.example.com/data-model",
  });
});

// GET /api/schema/entities/:name - Get specific entity schema
router.get("/entities/:name", async (req, res) => {
  const entity = schemaRegistry.entities[req.params.name];
  if (!entity) {
    return res
      .status(404)
      .json({ error: `Entity '${req.params.name}' not found` });
  }

  const [selectSchema, insertSchema] = await Promise.all([
    entity.selectSchema(),
    entity.insertSchema(),
  ]);

  res.json({
    name: entity.name,
    table: entity.table,
    description: entity.description,
    file: entity.file,
    primaryKey: entity.primaryKey,
    foreignKeys: entity.foreignKeys,
    schemas: {
      select: zodToJsonSchema(selectSchema),
      insert: zodToJsonSchema(insertSchema),
    },
  });
});

// GET /api/schema/enums/:name - Get enum values
router.get("/enums/:name", (req, res) => {
  const enumValues = schemaRegistry.enums[req.params.name];
  if (!enumValues) {
    return res
      .status(404)
      .json({ error: `Enum '${req.params.name}' not found` });
  }
  res.json({ name: req.params.name, values: enumValues });
});

// GET /api/schema/relationships - Get all relationships
router.get("/relationships", (req, res) => {
  res.json(schemaRegistry.relationships);
});

// GET /api/schema/erd - ERD data for visualization
router.get("/erd", async (req, res) => {
  const erdData = generateERDData(schemaRegistry);
  res.json(erdData);
});

// GET /api/schema/openapi.json - OpenAPI specification
router.get("/openapi.json", async (req, res) => {
  const openapi = await generateOpenAPISpec(schemaRegistry);
  res.json(openapi);
});

// GET /api/schema/full - Complete schema dump (for agents)
router.get("/full", async (req, res) => {
  const full = await generateFullSchema(schemaRegistry);
  res.json(full);
});

export default router;
```

#### 3.2 ERD Generator

```typescript
// server/services/schema/erd-generator.ts
import { SchemaRegistry } from "../../../schema/registry";

interface ERDNode {
  id: string;
  label: string;
  columns: Array<{
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
  }>;
}

interface ERDEdge {
  from: string;
  to: string;
  label: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

export function generateERDData(registry: SchemaRegistry): {
  nodes: ERDNode[];
  edges: ERDEdge[];
} {
  const nodes: ERDNode[] = Object.entries(registry.entities).map(
    ([key, entity]) => ({
      id: entity.table,
      label: entity.name,
      columns: [], // Populated from schema introspection
    }),
  );

  const edges: ERDEdge[] = registry.relationships.map((rel) => ({
    from: rel.from,
    to: rel.to,
    label: rel.through ? `via ${rel.through}` : "",
    type: rel.type,
  }));

  return { nodes, edges };
}

export function generateMermaidERD(registry: SchemaRegistry): string {
  let mermaid = "erDiagram\n";

  for (const rel of registry.relationships) {
    const cardinality =
      rel.type === "one-to-one"
        ? "||--||"
        : rel.type === "one-to-many"
          ? "||--o{"
          : "}o--o{";
    mermaid += `    ${rel.from} ${cardinality} ${rel.to} : "${rel.through || ""}"\n`;
  }

  return mermaid;
}
```

---

### Phase 4: Schema Viewer UI (Week 5-6)

#### Phase 4 Checklist

- [ ] **4.1 Schema page**
  - [ ] `frontend/src/pages/SchemaPage.tsx` created
  - [ ] Route added to router (`/schema`)
  - [ ] Navigation link added to sidebar/header
- [ ] **4.2 Entity list component**
  - [ ] `frontend/src/components/schema/EntityList.tsx` created
  - [ ] Shows all entities with descriptions
  - [ ] Clickable to expand entity details
  - [ ] Search/filter functionality
- [ ] **4.3 Entity detail component**
  - [ ] `frontend/src/components/schema/EntityDetail.tsx` created
  - [ ] Shows all columns with types
  - [ ] Shows foreign key relationships
  - [ ] Shows Zod validation rules
  - [ ] Shows example values
- [ ] **4.4 ERD visualization**
  - [ ] Mermaid integration working
  - [ ] Interactive ERD diagram
  - [ ] Zoom/pan controls
  - [ ] Entity highlighting on hover
- [ ] **4.5 Enum browser**
  - [ ] `frontend/src/components/schema/EnumList.tsx` created
  - [ ] Shows all enums with values
  - [ ] Copy enum values functionality
- [ ] **4.6 Relationship graph**
  - [ ] Visual relationship explorer
  - [ ] Shows cardinality indicators
  - [ ] Junction tables identified
- [ ] **4.7 Search functionality**
  - [ ] Global search across entities
  - [ ] Search in column names
  - [ ] Search in descriptions
- [ ] **4.8 Export options**
  - [ ] Export as JSON
  - [ ] Export as OpenAPI
  - [ ] Copy Mermaid source

#### Phase 4 Test Script

```bash
#!/bin/bash
# tests/e2e/test-phase4-ui.sh

set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== Phase 4 Schema Viewer UI Tests ==="

# Test 4.1: Page loads
echo "Testing schema page loads..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/schema")
[ "$STATUS" = "200" ] && echo "✓ /schema page returns 200" || {
  echo "✗ /schema page not found (status: $STATUS)"
  exit 1
}

# Test 4.2: Page contains expected content
echo ""
echo "Testing page content..."
CONTENT=$(curl -s "$BASE_URL/schema")
echo "$CONTENT" | grep -q "Data Model" && echo "✓ Contains 'Data Model' heading" || echo "⚠ Missing heading"
echo "$CONTENT" | grep -q "Entities" && echo "✓ Contains 'Entities' section" || echo "⚠ Missing entities section"
echo "$CONTENT" | grep -q "mermaid" && echo "✓ Contains Mermaid diagram" || echo "⚠ Missing ERD diagram"

# Test 4.3: React component exists
echo ""
echo "Testing component files..."
test -f frontend/src/pages/SchemaPage.tsx && echo "✓ SchemaPage.tsx exists" || exit 1
test -f frontend/src/components/schema/EntityList.tsx && echo "✓ EntityList.tsx exists" || echo "⚠ EntityList not found"
test -f frontend/src/components/schema/EntityDetail.tsx && echo "✓ EntityDetail.tsx exists" || echo "⚠ EntityDetail not found"

# Test 4.4: TypeScript compilation
echo ""
echo "Testing frontend compilation..."
cd frontend && npx tsc --noEmit && echo "✓ Frontend compiles" || exit 1
cd ..

# Test 4.5: Route exists in router
echo ""
echo "Testing route configuration..."
grep -r "schema" frontend/src/App.tsx frontend/src/routes.tsx 2>/dev/null | grep -q "SchemaPage" && \
  echo "✓ Route configured" || echo "⚠ Route may not be configured"

echo ""
echo "=== Phase 4 Tests Complete ==="
echo ""
echo "Manual verification required:"
echo "  1. Navigate to $BASE_URL/schema"
echo "  2. Verify entity list renders"
echo "  3. Click an entity to see details"
echo "  4. Verify ERD diagram is interactive"
echo "  5. Test search functionality"
```

#### Phase 4 Pass Criteria

| Criterion         | Requirement               | Verification            |
| ----------------- | ------------------------- | ----------------------- |
| Page accessible   | `/schema` returns 200     | HTTP status check       |
| Entity list       | Shows all entities        | Visual verification     |
| Entity details    | Columns, types, FKs shown | Click entity and verify |
| ERD diagram       | Mermaid renders correctly | Visual verification     |
| Interactivity     | Hover/click states work   | Manual testing          |
| Search            | Filters entities/columns  | Type in search box      |
| Responsive        | Works on mobile viewport  | Resize browser          |
| Performance       | Renders in < 1s           | Performance timing      |
| No console errors | Clean browser console     | DevTools check          |

---

#### 4.1 Schema Browser Component

```typescript
// frontend/src/pages/SchemaPage.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Mermaid from '../components/Mermaid';

export function SchemaPage() {
  const { data: registry } = useQuery({
    queryKey: ['schema'],
    queryFn: () => fetch('/api/schema').then(r => r.json()),
  });

  const { data: erd } = useQuery({
    queryKey: ['schema', 'erd'],
    queryFn: () => fetch('/api/schema/erd').then(r => r.json()),
  });

  return (
    <div className="schema-page">
      <h1>Data Model Documentation</h1>

      {/* Entity List */}
      <section>
        <h2>Entities ({registry?.entities?.length})</h2>
        <EntityList entities={registry?.entities} />
      </section>

      {/* ERD Diagram */}
      <section>
        <h2>Entity Relationship Diagram</h2>
        <Mermaid chart={erd?.mermaid} />
      </section>

      {/* Enums */}
      <section>
        <h2>Enumerations</h2>
        <EnumList enums={registry?.enums} />
      </section>
    </div>
  );
}
```

---

### Phase 5: Backwards Compatibility (Week 6-7)

#### Phase 5 Checklist

- [ ] **5.1 Type re-exports**
  - [ ] `types/task-agent.ts` re-exports from schema
  - [ ] `types/project.ts` re-exports from schema
  - [ ] `types/prd.ts` re-exports from schema
  - [ ] `types/ideation.ts` re-exports from schema
  - [ ] `types/task-appendix.ts` re-exports from schema
  - [ ] `types/task-impact.ts` re-exports from schema
  - [ ] `types/task-version.ts` re-exports from schema
  - [ ] `types/task-test.ts` re-exports from schema
  - [ ] `types/build-agent.ts` re-exports from schema
  - [ ] `types/notification.ts` re-exports from schema
- [ ] **5.2 Deprecation notices**
  - [ ] JSDoc `@deprecated` tags added to old type files
  - [ ] Console warnings for direct imports (optional)
  - [ ] Migration guide documentation
- [ ] **5.3 Import path aliases**
  - [ ] `@/schema` alias configured in tsconfig
  - [ ] `@/types` continues to work
- [ ] **5.4 Existing code validation**
  - [ ] All services compile without changes
  - [ ] All routes compile without changes
  - [ ] All tests pass without changes
- [ ] **5.5 Migration helper script**
  - [ ] `scripts/migrate-types-to-schema.ts` created
  - [ ] Script identifies unmigrated types
  - [ ] Script shows migration status
- [ ] **5.6 Documentation updates**
  - [ ] CLAUDE.md updated with new import paths
  - [ ] README updated (if applicable)
  - [ ] Migration guide created

#### Phase 5 Test Script

```bash
#!/bin/bash
# tests/e2e/test-phase5-compat.sh

set -e
echo "=== Phase 5 Backwards Compatibility Tests ==="

# Test 5.1: Old imports still work
echo "Testing old import paths..."
node -e "
const files = [
  './types/task-agent',
  './types/project',
  './types/prd'
];
let failures = 0;
for (const file of files) {
  try {
    require(file);
    console.log('✓', file, 'importable');
  } catch (e) {
    console.log('✗', file, 'failed:', e.message);
    failures++;
  }
}
if (failures > 0) process.exit(1);
"

# Test 5.2: New imports work
echo ""
echo "Testing new import paths..."
node -e "
const { Task, NewTask } = require('./schema');
console.log('✓ schema/index.ts exports Task');
console.log('✓ schema/index.ts exports NewTask');
"

# Test 5.3: Types are identical
echo ""
echo "Testing type equivalence..."
node -e "
const oldTypes = require('./types/task-agent');
const newTypes = require('./schema');

// Check that key types exist in both
const checkTypes = ['Task', 'NewTask', 'TaskList'];
for (const t of checkTypes) {
  if (t in oldTypes && t in newTypes) {
    console.log('✓', t, 'exported from both locations');
  } else {
    console.log('⚠', t, 'may be missing from one location');
  }
}
"

# Test 5.4: Full codebase compilation
echo ""
echo "Testing full codebase compilation..."
npx tsc --noEmit && echo "✓ Full codebase compiles" || exit 1

# Test 5.5: Server starts
echo ""
echo "Testing server startup..."
timeout 10 npm run dev &
SERVER_PID=$!
sleep 5
if kill -0 $SERVER_PID 2>/dev/null; then
  echo "✓ Server starts successfully"
  kill $SERVER_PID 2>/dev/null
else
  echo "✗ Server failed to start"
  exit 1
fi

# Test 5.6: Tests pass
echo ""
echo "Running existing tests..."
npm test -- --passWithNoTests && echo "✓ All tests pass" || exit 1

# Test 5.7: Migration helper works
echo ""
echo "Testing migration helper..."
if [ -f "scripts/migrate-types-to-schema.ts" ]; then
  npx ts-node scripts/migrate-types-to-schema.ts && echo "✓ Migration helper runs" || echo "⚠ Migration helper has issues"
else
  echo "⚠ Migration helper not yet created"
fi

# Test 5.8: No duplicate type definitions
echo ""
echo "Checking for duplicate definitions..."
DUPLICATES=$(grep -rh "^export type Task " types/ schema/ 2>/dev/null | wc -l)
if [ "$DUPLICATES" -gt 1 ]; then
  echo "⚠ Found $DUPLICATES definitions of 'Task' - ensure types/ re-exports from schema/"
else
  echo "✓ No duplicate type definitions"
fi

echo ""
echo "=== Phase 5 Tests Complete ==="
```

#### Phase 5 Pass Criteria

| Criterion           | Requirement                              | Verification         |
| ------------------- | ---------------------------------------- | -------------------- |
| Old imports work    | `require('./types/task-agent')` succeeds | Node.js require test |
| New imports work    | `require('./schema')` succeeds           | Node.js require test |
| Type equivalence    | Same types from both paths               | Compare exports      |
| Full compilation    | `tsc --noEmit` passes                    | Zero errors          |
| Server starts       | Server boots without errors              | Startup test         |
| Tests pass          | All existing tests green                 | `npm test`           |
| No duplicates       | Types defined once, re-exported          | Grep check           |
| Deprecation notices | Old files have `@deprecated`             | Manual verification  |
| Documentation       | CLAUDE.md updated                        | File check           |

---

#### 5.1 Re-export Types for Existing Code

```typescript
// types/task-agent.ts (updated)
// Re-export from new schema location for backwards compatibility
export {
  type Task,
  type NewTask,
  type UpdateTask,
  taskStatuses,
  taskCategories,
  taskPriorities,
} from "../schema/entities/task";

export { type TaskList, type NewTaskList } from "../schema/entities/task-list";

// ... re-export all types

// DEPRECATED: Direct type definitions (keep for reference during migration)
// These will be removed in version 2.0
```

#### 5.2 Migration Script

```typescript
// scripts/migrate-types-to-schema.ts
/**
 * This script helps identify types that need migration.
 * Run: npx ts-node scripts/migrate-types-to-schema.ts
 */

import * as fs from "fs";
import * as path from "path";

const typesDir = path.join(__dirname, "../types");
const schemaDir = path.join(__dirname, "../schema/entities");

// Analyze existing types
const existingTypes = fs
  .readdirSync(typesDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({
    file: f,
    path: path.join(typesDir, f),
    migrated: fs.existsSync(path.join(schemaDir, f)),
  }));

console.log("Type Migration Status:");
console.table(existingTypes);
```

---

## Data Model Change Workflows

### Workflow 1: Adding a New Entity

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW ENTITY WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. CREATE SCHEMA FILE                                               │
│     └── Copy schema/entities/_template.ts                            │
│     └── Define table with sqliteTable() or pgTable()                 │
│     └── Add Zod schemas with refinements                             │
│     └── Export types                                                 │
│                                                                      │
│  2. REGISTER ENTITY                                                  │
│     └── Add entry to schema/registry.ts                              │
│     └── Include all metadata (description, FKs, etc.)                │
│                                                                      │
│  3. DEFINE RELATIONS (if any)                                        │
│     └── Create/update schema/relations/{entity}-relations.ts         │
│     └── Add relationship to registry.relationships[]                 │
│                                                                      │
│  4. GENERATE & MIGRATE                                               │
│     └── npm run schema:generate  (creates migration)                 │
│     └── npm run schema:migrate   (applies to database)               │
│                                                                      │
│  5. VERIFY                                                           │
│     └── Check /api/schema/{entity} returns correct schema            │
│     └── Check /api/schema/erd shows new entity                       │
│     └── TypeScript compilation passes                                │
│                                                                      │
│  6. UPDATE CLAUDE.MD (if significant)                                │
│     └── Add to entity table if core business entity                  │
│     └── Document any special behaviors                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Commands:**

```bash
# Step 1-2: Create and register (manual)
cp schema/entities/_template.ts schema/entities/my-entity.ts
# Edit the file and registry.ts

# Step 4: Generate migration and apply
npm run schema:generate
npm run schema:migrate

# Step 5: Verify
curl http://localhost:3001/api/schema/entities/myEntity | jq
```

---

### Workflow 2: Modifying an Existing Entity

```
┌─────────────────────────────────────────────────────────────────────┐
│                 MODIFY ENTITY WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. UNDERSTAND IMPACT                                                │
│     └── Query /api/schema/relationships to find dependents           │
│     └── Check which services import this type                        │
│     └── Identify breaking vs non-breaking change                     │
│                                                                      │
│  2. MODIFY SCHEMA FILE                                               │
│     └── Edit schema/entities/{entity}.ts                             │
│     └── Update column definitions                                    │
│     └── Update Zod refinements if needed                             │
│                                                                      │
│  3. HANDLE BREAKING CHANGES                                          │
│     ├── ADDING column:                                               │
│     │   └── Provide default value OR make nullable                   │
│     ├── REMOVING column:                                             │
│     │   └── Search codebase for usage first                          │
│     │   └── Remove from schema after code updated                    │
│     ├── RENAMING column:                                             │
│     │   └── Use .as('old_name') for SQL alias during migration       │
│     └── CHANGING type:                                               │
│         └── May require data migration script                        │
│                                                                      │
│  4. GENERATE & MIGRATE                                               │
│     └── npm run schema:generate                                      │
│     └── Review generated migration SQL                               │
│     └── npm run schema:migrate                                       │
│                                                                      │
│  5. UPDATE DEPENDENT CODE                                            │
│     └── TypeScript will show compile errors                          │
│     └── Fix all usages                                               │
│                                                                      │
│  6. VERIFY                                                           │
│     └── npm run typecheck                                            │
│     └── npm run test                                                 │
│     └── Check /api/schema/{entity} reflects changes                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Impact Analysis Command:**

```bash
# Find all files that import this entity
grep -r "from.*schema/entities/task" --include="*.ts" .
grep -r "type Task" --include="*.ts" .

# Check relationships
curl http://localhost:3001/api/schema/relationships | jq '.[] | select(.from == "task" or .to == "task")'
```

---

### Workflow 3: Adding a New Enum

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW ENUM WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. CREATE ENUM DEFINITION                                           │
│     └── Add to schema/enums/{category}.ts                            │
│     └── Export as const array AND as type                            │
│                                                                      │
│  2. REGISTER IN REGISTRY                                             │
│     └── Add to schemaRegistry.enums                                  │
│                                                                      │
│  3. USE IN ENTITY                                                    │
│     └── Reference in table column: text('status', { enum: myEnums }) │
│                                                                      │
│  4. GENERATE (if changes table)                                      │
│     └── npm run schema:generate                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Example:**

```typescript
// schema/enums/task-status.ts
export const taskStatuses = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "blocked",
  "skipped",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

// In entity file:
import { taskStatuses } from "../enums/task-status";

export const tasks = sqliteTable("tasks", {
  status: text("status", { enum: taskStatuses }).notNull().default("pending"),
});
```

---

### Workflow 4: Adding a New Relationship

```
┌─────────────────────────────────────────────────────────────────────┐
│                 NEW RELATIONSHIP WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. DETERMINE RELATIONSHIP TYPE                                      │
│     └── one-to-one: Both sides have unique FK                        │
│     └── one-to-many: Child has FK to parent                          │
│     └── many-to-many: Junction table required                        │
│                                                                      │
│  2. ADD FOREIGN KEY (if not junction)                                │
│     └── Add column with .references() in child entity                │
│                                                                      │
│  3. CREATE JUNCTION TABLE (if many-to-many)                          │
│     └── Create schema/entities/{a}-{b}-link.ts                       │
│     └── Add composite primary key or unique constraint               │
│                                                                      │
│  4. DEFINE DRIZZLE RELATION                                          │
│     └── Add to schema/relations/{entity}-relations.ts                │
│     └── Define both directions                                       │
│                                                                      │
│  5. REGISTER RELATIONSHIP                                            │
│     └── Add to schemaRegistry.relationships[]                        │
│                                                                      │
│  6. GENERATE & MIGRATE                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Example: Many-to-Many Junction**

```typescript
// schema/entities/prd-task-link.ts
import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { prds } from "./prd";
import { tasks } from "./task";

export const prdTaskLinks = sqliteTable(
  "prd_tasks",
  {
    prdId: text("prd_id")
      .notNull()
      .references(() => prds.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    linkType: text("link_type", { enum: ["implements", "tests", "documents"] }),
    createdAt: text("created_at").notNull().default("datetime('now')"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.prdId, table.taskId] }),
  }),
);
```

---

### Workflow 5: Database Migration (SQLite → PostgreSQL)

```
┌─────────────────────────────────────────────────────────────────────┐
│              DATABASE MIGRATION WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. PREPARE                                                          │
│     └── Create PostgreSQL-specific schema/db-pg.ts                   │
│     └── Update drizzle.config.ts for PostgreSQL                      │
│                                                                      │
│  2. CONVERT ENTITIES                                                 │
│     └── Change sqliteTable → pgTable                                 │
│     └── Update type mappings:                                        │
│         - text → varchar/text                                        │
│         - integer → integer/bigint                                   │
│         - real → real/doublePrecision                                │
│         - blob → bytea                                               │
│     └── Add PostgreSQL features:                                     │
│         - uuid().defaultRandom() for IDs                             │
│         - timestamp() instead of text for dates                      │
│         - array types, JSONB, etc.                                   │
│                                                                      │
│  3. DATA MIGRATION                                                   │
│     └── Export SQLite data: npm run db:export                        │
│     └── Transform data format if needed                              │
│     └── Import to PostgreSQL: npm run db:import                      │
│                                                                      │
│  4. UPDATE CONNECTION                                                │
│     └── Switch DB_URL environment variable                           │
│     └── Update schema/db.ts to use pg driver                         │
│                                                                      │
│  5. VERIFY                                                           │
│     └── Run all tests                                                │
│     └── Check /api/schema still works                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Discovery Protocol

### CLAUDE.md Addition

````markdown
## Data Model Discovery

The canonical data model is defined in `schema/entities/*.ts`.

### For Agents (Programmatic Access)

```bash
# List all entities
curl http://localhost:3001/api/schema

# Get specific entity schema (JSON Schema format)
curl http://localhost:3001/api/schema/entities/task

# Get all enums
curl http://localhost:3001/api/schema/enums

# Get relationship graph
curl http://localhost:3001/api/schema/relationships

# Get full schema dump
curl http://localhost:3001/api/schema/full
```
````

### For Code (Type-Safe Import)

```typescript
// Import types
import { Task, NewTask } from "@/schema";

// Import validation schemas
import { insertTaskSchema, selectTaskSchema } from "@/schema";

// Validate input
const result = insertTaskSchema.safeParse(userInput);
```

### Rules

1. **NEVER** define types outside `schema/` directory
2. All database tables **MUST** have a corresponding schema entity
3. When modifying data model, update `schema/entities/*.ts` **ONLY**
4. Registry is auto-updated; no manual sync required

````

---

## NPM Scripts

```json
{
  "scripts": {
    "schema:generate": "drizzle-kit generate",
    "schema:migrate": "drizzle-kit migrate",
    "schema:push": "drizzle-kit push",
    "schema:studio": "drizzle-kit studio",
    "schema:check": "drizzle-kit check",
    "schema:validate": "ts-node scripts/validate-schema.ts",
    "schema:export": "ts-node scripts/export-schema.ts"
  }
}
````

---

## Validation & Testing

### Schema Validation Script

```typescript
// scripts/validate-schema.ts
import { schemaRegistry } from "../schema/registry";

async function validateSchema() {
  const errors: string[] = [];

  // Check all entities are loadable
  for (const [name, entity] of Object.entries(schemaRegistry.entities)) {
    try {
      await entity.selectSchema();
      await entity.insertSchema();
    } catch (e) {
      errors.push(`Entity ${name}: Failed to load schemas - ${e}`);
    }
  }

  // Check relationships reference valid entities
  for (const rel of schemaRegistry.relationships) {
    if (!schemaRegistry.entities[rel.from]) {
      errors.push(`Relationship: Unknown entity '${rel.from}'`);
    }
    if (!schemaRegistry.entities[rel.to]) {
      errors.push(`Relationship: Unknown entity '${rel.to}'`);
    }
  }

  if (errors.length > 0) {
    console.error("Schema validation failed:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("✓ Schema validation passed");
}

validateSchema();
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npm run schema:validate
npm run typecheck
```

---

## Success Metrics

| Metric                     | Target                 |
| -------------------------- | ---------------------- |
| Type files outside schema/ | 0                      |
| Manual migration files     | 0 (all auto-generated) |
| Documentation drift        | 0 (live from code)     |
| Schema API response time   | < 100ms                |
| Type inference accuracy    | 100%                   |

---

## Master Test Suite

### Run All Phase Tests

```bash
#!/bin/bash
# tests/e2e/test-all-phases.sh

set -e
echo "=========================================="
echo "  SELF-DOCUMENTING DATA MODEL TEST SUITE"
echo "=========================================="

PASSED=0
FAILED=0
SKIPPED=0

run_test() {
  local name=$1
  local script=$2

  echo ""
  echo "--- Running: $name ---"

  if [ ! -f "$script" ]; then
    echo "⚠ SKIPPED: $script not found"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if bash "$script"; then
    echo "✓ PASSED: $name"
    PASSED=$((PASSED + 1))
  else
    echo "✗ FAILED: $name"
    FAILED=$((FAILED + 1))
  fi
}

# Run all phase tests
run_test "Phase 1: Foundation" "tests/e2e/test-phase1-foundation.sh"
run_test "Phase 2: Entity Migration" "tests/e2e/test-phase2-migration.sh"
run_test "Phase 3: Discovery API" "tests/e2e/test-phase3-api.sh"
run_test "Phase 4: Schema Viewer UI" "tests/e2e/test-phase4-ui.sh"
run_test "Phase 5: Backwards Compatibility" "tests/e2e/test-phase5-compat.sh"

# Summary
echo ""
echo "=========================================="
echo "  TEST SUMMARY"
echo "=========================================="
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Skipped: $SKIPPED"
echo "=========================================="

if [ $FAILED -gt 0 ]; then
  echo "❌ Some tests failed"
  exit 1
else
  echo "✅ All tests passed!"
  exit 0
fi
```

### Quick Validation Script

```bash
#!/bin/bash
# tests/e2e/test-schema-quick.sh
# Quick smoke test for schema system

set -e
echo "=== Quick Schema Validation ==="

# 1. Schema directory exists
test -d schema && echo "✓ schema/ directory exists" || exit 1

# 2. Registry loads
node -e "require('./schema/registry')" && echo "✓ Registry loads" || exit 1

# 3. TypeScript compiles
npx tsc --noEmit schema/index.ts && echo "✓ Schema compiles" || exit 1

# 4. API responds (if server running)
if curl -s http://localhost:3001/api/schema > /dev/null 2>&1; then
  echo "✓ API endpoint responds"
else
  echo "⚠ API not available (server may not be running)"
fi

echo ""
echo "=== Quick Validation Complete ==="
```

---

## Timeline Summary

| Phase               | Duration | Deliverables                            |
| ------------------- | -------- | --------------------------------------- |
| 1. Foundation       | Week 1-2 | Directory structure, registry, template |
| 2. Core Migration   | Week 2-4 | All 40+ entities migrated               |
| 3. Discovery API    | Week 4-5 | /api/schema endpoints                   |
| 4. Schema Viewer UI | Week 5-6 | /schema page with ERD                   |
| 5. Backwards Compat | Week 6-7 | Re-exports, deprecation notices         |

---

## Appendix: File Inventory for Migration

### High Priority (Core Business Entities)

- [ ] `types/task-agent.ts` → `schema/entities/task.ts`, `task-list.ts`, etc.
- [ ] `types/project.ts` → `schema/entities/project.ts`
- [ ] `types/prd.ts` → `schema/entities/prd.ts`
- [ ] `types/ideation.ts` → `schema/entities/ideation-session.ts`, etc.

### Medium Priority (Supporting Entities)

- [ ] `types/task-appendix.ts` → `schema/entities/task-appendix.ts`
- [ ] `types/task-impact.ts` → `schema/entities/task-impact.ts`
- [ ] `types/task-version.ts` → `schema/entities/task-version.ts`
- [ ] `types/task-test.ts` → `schema/entities/task-test-result.ts`
- [ ] `types/build-agent.ts` → `schema/entities/build-agent.ts`

### Lower Priority (Can Migrate Later)

- [ ] `types/incubation.ts` → Multiple entities
- [ ] `types/notification.ts` → `schema/entities/notification.ts`
- [ ] `types/sia.ts` → `schema/entities/sia-*.ts`
- [ ] `types/validation.ts` → `schema/entities/validation-*.ts`

---

## Overall Completion Checklist

### Pre-Implementation

- [ ] Review and approve this implementation plan
- [ ] Ensure no conflicting work in progress
- [ ] Create feature branch: `git checkout -b feat/self-documenting-data-model`
- [ ] Backup current database: `cp database/ideas.db database/ideas.db.backup`

### Phase Completion Sign-off

| Phase                     | Status         | Date Completed | Verified By | Notes |
| ------------------------- | -------------- | -------------- | ----------- | ----- |
| Phase 1: Foundation       | ⬜ Not Started |                |             |       |
| Phase 2: Core Migration   | ⬜ Not Started |                |             |       |
| Phase 3: Discovery API    | ⬜ Not Started |                |             |       |
| Phase 4: Schema Viewer UI | ⬜ Not Started |                |             |       |
| Phase 5: Backwards Compat | ⬜ Not Started |                |             |       |

### Final Validation

- [ ] All phase test scripts pass: `bash tests/e2e/test-all-phases.sh`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] All existing tests pass: `npm test`
- [ ] Manual smoke test of `/schema` page
- [ ] Schema API responds correctly: `curl http://localhost:3001/api/schema`
- [ ] At least one agent successfully uses schema discovery
- [ ] Documentation updated in CLAUDE.md
- [ ] PR created and reviewed

### Post-Implementation

- [ ] Merge to main branch
- [ ] Delete old type files (after deprecation period)
- [ ] Update any external documentation
- [ ] Announce changes to team

---

## Rollback Plan

If issues are discovered after deployment:

```bash
# 1. Revert to backup database
cp database/ideas.db.backup database/ideas.db

# 2. Revert code changes
git revert HEAD~N  # Where N is number of commits to revert

# 3. Or checkout previous working state
git checkout <last-working-commit> -- types/ schema/

# 4. Restart server
npm run dev
```

### Rollback Triggers

- [ ] Server fails to start after migration
- [ ] More than 5% of API requests fail
- [ ] TypeScript compilation takes > 2x longer
- [ ] Any data loss detected
