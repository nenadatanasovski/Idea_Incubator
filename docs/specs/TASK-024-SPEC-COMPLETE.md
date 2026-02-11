# TASK-024: Complete Phase 2 Task 2.6 Test System Seed Data - SPECIFICATION

## Overview

Task 2.6 in PHASES.md (Create Test System Tables Seed) is **partially complete**. According to PHASES.md, there should be 16 test suites (one per phase) with complete test data, but currently:

- **✅ Complete**: 1 test suite (`phase_1_frontend_shell`) with 8 test cases, 21 test steps, 28 test assertions
- **❌ Missing**: 15 test suites (phases 2-16) with complete test case data

This specification addresses completing the test system seed data to enable proper test tracking and validation queries across the full phased implementation approach outlined in PHASES.md.

## Current State Analysis

### What Exists ✅

**Database State**:

- 1 test suite: `phase_1_frontend_shell` (Phase 1: Frontend Shell)
- 8 test cases for Phase 1 tasks (task_1 through task_8)
- 21 test steps across all Phase 1 cases
- 28 test assertions for key pass criteria

**Implementation Files**:

- `parent-harness/orchestrator/src/db/seed-phase1-tests.ts` - Complete Phase 1 test data seeding
- `parent-harness/orchestrator/src/db/seed.ts` - Main seed script that calls `seedPhase1Tests()`
- `parent-harness/orchestrator/src/db/verify-phase1-seed.ts` - Phase 1 verification script

### What's Missing ❌

According to PHASES.md Task 2.6 pass criteria:

- **16 test suites** (one per phase) - Currently only 1 exists
- **Test cases for Phase 2-16 tasks** - 0 exist
- **Test steps for each case** - 0 exist
- **Test assertions for key criteria** - 0 exist

**Note**: The main `seed.ts` file does create 16 placeholder test suites (lines 86-107), but only with basic metadata. These are NOT linked to the `test_cases` table with actual test case data.

### Task Breakdown from PHASES.md

| Phase | Name                | Tasks | Suite ID                       |
| ----- | ------------------- | ----- | ------------------------------ |
| 1     | Frontend Shell      | 8     | `phase_1_frontend_shell` ✅    |
| 2     | Data Model          | 6     | `phase_2_data_model` ⚠️        |
| 3     | Backend API         | 7     | `phase_3_backend_api` ⚠️       |
| 4     | Frontend + API      | 7     | `phase_4_frontend_api` ⚠️      |
| 5     | WebSocket           | 7     | `phase_5_websocket` ⚠️         |
| 6     | Telegram Bot        | 7     | `phase_6_telegram_bot` ⚠️      |
| 7     | Orchestrator        | 8     | `phase_7_orchestrator` ⚠️      |
| 8     | Clarification Agent | 6     | `phase_8_clarification` ⚠️     |
| 9     | Agent Spawner       | 7     | `phase_9_agent_spawner` ⚠️     |
| 10    | Agent Memory        | 5     | `phase_10_agent_memory` ⚠️     |
| 11    | QA Validation       | 6     | `phase_11_qa_validation` ⚠️    |
| 12    | Human Sim Agent     | 6     | `phase_12_human_sim` ⚠️        |
| 13    | Wave Execution      | 6     | `phase_13_wave_execution` ⚠️   |
| 14    | Planning Agent      | 6     | `phase_14_planning_agent` ⚠️   |
| 15    | Self-Improvement    | 5     | `phase_15_self_improvement` ⚠️ |
| 16    | Polish              | 9     | `phase_16_polish` ⚠️           |

## Requirements

### Must Have (P0)

1. **All 16 test suites created with proper metadata**
   - Suite ID follows pattern `phase_N_[slug]`
   - Name follows pattern `Phase N: [Name]`
   - Type set to `verification`
   - Source set to `phases`
   - Phase number set correctly (1-16)

2. **Complete Phase 2 test data (6 test cases)**
   - `phase_2_task_1_sqlite_setup`
   - `phase_2_task_2_schema`
   - `phase_2_task_3_seed_agents`
   - `phase_2_task_4_seed_tasks`
   - `phase_2_task_5_queries`
   - `phase_2_task_6_test_seed`
   - Each with appropriate test steps and assertions

3. **Seed script executes without errors**
   - All INSERT statements succeed
   - Foreign key constraints satisfied
   - Idempotent (can be re-run safely)

4. **Validation queries work as expected**
   - Phase completion queries return correct structure
   - Test case queries filter by suite_id correctly

### Should Have (P1)

5. **Phase 3 test data (7 test cases)**
   - All 7 tasks from Phase 3 (Express, API endpoints, error handling)
   - Similar detail level to Phase 1 and Phase 2

6. **Idempotent seeding with ON CONFLICT clauses**
   - Safe to re-run seed script multiple times
   - Updates existing records rather than failing

7. **Verification script for seed completeness**
   - Validates suite count (16 expected)
   - Validates case counts per phase
   - Reports missing data clearly

### Nice to Have (P2)

8. **Phases 4-16 placeholder test cases**
   - Basic test case structure created
   - Can be filled in later as phases are implemented

9. **Documentation**
   - README explaining test system structure
   - Comments in seed scripts explaining validation approach

## Technical Design

### Database Schema Reference

From `parent-harness/database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('unit', 'integration', 'e2e', 'verification', 'lint', 'typecheck')),
    source TEXT NOT NULL CHECK(source IN ('code', 'phases', 'task_agent', 'planning_agent')),
    file_path TEXT,
    phase INTEGER,
    enabled INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    suite_id TEXT NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3', 'P4')) DEFAULT 'P2',
    timeout_ms INTEGER DEFAULT 30000,
    retry_limit INTEGER DEFAULT 5,
    depends_on TEXT,  -- JSON array of test_case IDs
    tags TEXT,        -- JSON array
    enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_steps (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    name TEXT NOT NULL,
    command TEXT,
    expected_exit_code INTEGER DEFAULT 0,
    expected_output_contains TEXT,
    timeout_ms INTEGER DEFAULT 10000,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_assertions (
    id TEXT PRIMARY KEY,
    step_id TEXT NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    assertion_type TEXT NOT NULL CHECK(assertion_type IN ('equals', 'contains', 'matches', 'exists', 'truthy')),
    target TEXT NOT NULL,
    expected_value TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Files to Create/Modify

#### 1. `parent-harness/orchestrator/src/db/seed-phase2-tests.ts` (CREATE)

New file following the exact pattern of `seed-phase1-tests.ts`:

**Purpose**: Seed Phase 2 test cases (6 tasks: 2.1-2.6)

**Structure**:

```typescript
import { run, query, getOne } from "./index.js";

export function seedPhase2Tests(): void {
  console.log("🧪 Seeding Phase 2 test data...");

  const suiteId = "phase_2_data_model";

  // Create Phase 2 test suite
  run(
    `
    INSERT INTO test_suites (id, name, description, type, source, phase, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description
  `,
    [
      suiteId,
      "Phase 2: Data Model",
      "Database ready with schema and seed data",
      "verification",
      "phases",
      2,
      1,
    ],
  );

  // Define test cases array with steps and assertions
  const testCases = [
    // Task 2.1: SQLite Database Setup
    {
      id: "phase_2_task_1_sqlite_setup",
      name: "SQLite Database Setup",
      description: "Verify database connection and initialization",
      priority: "P0" as const,
      steps: [
        {
          name: "Check database file exists",
          command: "test -f parent-harness/data/harness.db",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/data/harness.db",
              errorMessage: "Database file should exist",
            },
          ],
        },
        {
          name: "Verify database connection works",
          command: 'sqlite3 parent-harness/data/harness.db "SELECT 1"',
          expectedExitCode: 0,
          expectedOutputContains: "1",
          assertions: [
            {
              type: "equals" as const,
              target: "exit_code",
              expectedValue: "0",
              errorMessage: "Database should be accessible",
            },
          ],
        },
        {
          name: "Check database module exists",
          command: "test -f parent-harness/orchestrator/src/db/index.ts",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/orchestrator/src/db/index.ts",
              errorMessage: "Database module should exist",
            },
          ],
        },
      ],
    },
    // Task 2.2: Run Schema (33 tables)
    {
      id: "phase_2_task_2_schema",
      name: "Run Schema",
      description: "Verify all 33 tables from schema.sql are created",
      priority: "P0" as const,
      steps: [
        {
          name: "Count tables in database",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'\"",
          expectedExitCode: 0,
          expectedOutputContains: "33",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "33",
              errorMessage: "Should have 33 tables",
            },
          ],
        },
        {
          name: "Verify agents table exists",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT name FROM sqlite_master WHERE type='table' AND name='agents'\"",
          expectedExitCode: 0,
          expectedOutputContains: "agents",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "agents",
              errorMessage: "agents table should exist",
            },
          ],
        },
        {
          name: "Verify tasks table exists",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'\"",
          expectedExitCode: 0,
          expectedOutputContains: "tasks",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "tasks",
              errorMessage: "tasks table should exist",
            },
          ],
        },
      ],
    },
    // Task 2.3: Seed Agents (13 agents)
    {
      id: "phase_2_task_3_seed_agents",
      name: "Seed Agents",
      description:
        "Verify 13 agents are seeded with correct types and telegram channels",
      priority: "P0" as const,
      steps: [
        {
          name: "Count agents in database",
          command:
            'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM agents"',
          expectedExitCode: 0,
          expectedOutputContains: "13",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "13",
              errorMessage: "Should have 13 agents",
            },
          ],
        },
        {
          name: "Verify all agents have telegram_channel",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT COUNT(*) FROM agents WHERE telegram_channel IS NOT NULL AND telegram_channel != ''\"",
          expectedExitCode: 0,
          expectedOutputContains: "13",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "13",
              errorMessage: "All agents should have telegram_channel",
            },
          ],
        },
        {
          name: "Verify orchestrator agent exists",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT id FROM agents WHERE id='orchestrator'\"",
          expectedExitCode: 0,
          expectedOutputContains: "orchestrator",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "orchestrator",
              errorMessage: "orchestrator agent should exist",
            },
          ],
        },
      ],
    },
    // Task 2.4: Seed Sample Tasks
    {
      id: "phase_2_task_4_seed_tasks",
      name: "Seed Sample Tasks",
      description: "Verify task_lists table has rows and sample tasks exist",
      priority: "P1" as const,
      steps: [
        {
          name: "Check task_lists has at least 1 row",
          command:
            'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM task_lists"',
          expectedExitCode: 0,
          assertions: [
            {
              type: "truthy" as const,
              target: "stdout",
              errorMessage: "task_lists should have at least 1 row",
            },
          ],
        },
        {
          name: "Check tasks table has at least 5 rows",
          command:
            'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM tasks"',
          expectedExitCode: 0,
          assertions: [
            {
              type: "truthy" as const,
              target: "stdout",
              errorMessage: "tasks should have at least 5 rows",
            },
          ],
        },
        {
          name: "Verify task relationships exist",
          command:
            'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM task_relationships"',
          expectedExitCode: 0,
          assertions: [
            {
              type: "truthy" as const,
              target: "stdout",
              errorMessage: "task_relationships should have rows",
            },
          ],
        },
      ],
    },
    // Task 2.5: Create Query Functions
    {
      id: "phase_2_task_5_queries",
      name: "Create Query Functions",
      description:
        "Verify TypeScript query modules exist (agents.ts, tasks.ts, sessions.ts, events.ts)",
      priority: "P0" as const,
      steps: [
        {
          name: "Check agents.ts exists",
          command: "test -f parent-harness/orchestrator/src/db/agents.ts",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/orchestrator/src/db/agents.ts",
              errorMessage: "agents.ts should exist",
            },
          ],
        },
        {
          name: "Check tasks.ts exists",
          command: "test -f parent-harness/orchestrator/src/db/tasks.ts",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/orchestrator/src/db/tasks.ts",
              errorMessage: "tasks.ts should exist",
            },
          ],
        },
        {
          name: "Check sessions.ts exists",
          command: "test -f parent-harness/orchestrator/src/db/sessions.ts",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/orchestrator/src/db/sessions.ts",
              errorMessage: "sessions.ts should exist",
            },
          ],
        },
        {
          name: "Check events.ts exists",
          command: "test -f parent-harness/orchestrator/src/db/events.ts",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/orchestrator/src/db/events.ts",
              errorMessage: "events.ts should exist",
            },
          ],
        },
      ],
    },
    // Task 2.6: Create Test System Tables Seed
    {
      id: "phase_2_task_6_test_seed",
      name: "Create Test System Tables Seed",
      description: "Verify 16 test suites exist and Phase 1 has 8 test cases",
      priority: "P0" as const,
      steps: [
        {
          name: "Count test suites with source=phases",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT COUNT(*) FROM test_suites WHERE source='phases'\"",
          expectedExitCode: 0,
          expectedOutputContains: "16",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "16",
              errorMessage: "Should have 16 test suites",
            },
          ],
        },
        {
          name: "Count Phase 1 test cases",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT COUNT(*) FROM test_cases WHERE suite_id='phase_1_frontend_shell'\"",
          expectedExitCode: 0,
          expectedOutputContains: "8",
          assertions: [
            {
              type: "contains" as const,
              target: "stdout",
              expectedValue: "8",
              errorMessage: "Phase 1 should have 8 test cases",
            },
          ],
        },
        {
          name: "Verify test steps exist for Phase 1",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT COUNT(*) FROM test_steps WHERE case_id LIKE 'phase_1_task_%'\"",
          expectedExitCode: 0,
          assertions: [
            {
              type: "truthy" as const,
              target: "stdout",
              errorMessage: "Phase 1 should have test steps",
            },
          ],
        },
        {
          name: "Verify test assertions exist for Phase 1",
          command:
            "sqlite3 parent-harness/data/harness.db \"SELECT COUNT(*) FROM test_assertions WHERE step_id IN (SELECT id FROM test_steps WHERE case_id LIKE 'phase_1_task_%')\"",
          expectedExitCode: 0,
          assertions: [
            {
              type: "truthy" as const,
              target: "stdout",
              errorMessage: "Phase 1 should have test assertions",
            },
          ],
        },
      ],
    },
  ];

  // Insert test cases, steps, and assertions (same pattern as Phase 1)
  for (const testCase of testCases) {
    // Insert test case
    run(
      `
      INSERT INTO test_cases (id, suite_id, name, description, priority, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        priority = excluded.priority
    `,
      [
        testCase.id,
        suiteId,
        testCase.name,
        testCase.description,
        testCase.priority,
        1,
      ],
    );

    console.log(`  📝 Created case: ${testCase.id}`);

    // Insert test steps and assertions
    for (let stepIdx = 0; stepIdx < testCase.steps.length; stepIdx++) {
      const step = testCase.steps[stepIdx];
      const stepId = `${testCase.id}_step_${stepIdx + 1}`;

      run(
        `
        INSERT INTO test_steps (id, case_id, sequence, name, command, expected_exit_code, expected_output_contains)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          command = excluded.command,
          expected_exit_code = excluded.expected_exit_code,
          expected_output_contains = excluded.expected_output_contains
      `,
        [
          stepId,
          testCase.id,
          stepIdx + 1,
          step.name,
          step.command,
          step.expectedExitCode ?? 0,
          step.expectedOutputContains ?? null,
        ],
      );

      // Insert assertions
      if (step.assertions) {
        for (
          let assertIdx = 0;
          assertIdx < step.assertions.length;
          assertIdx++
        ) {
          const assertion = step.assertions[assertIdx];
          const assertionId = `${stepId}_assert_${assertIdx + 1}`;

          run(
            `
            INSERT INTO test_assertions (id, step_id, sequence, assertion_type, target, expected_value, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              assertion_type = excluded.assertion_type,
              target = excluded.target,
              expected_value = excluded.expected_value,
              error_message = excluded.error_message
          `,
            [
              assertionId,
              stepId,
              assertIdx + 1,
              assertion.type,
              assertion.target,
              (assertion as any).expectedValue ?? null,
              assertion.errorMessage,
            ],
          );
        }
      }
    }
  }

  // Count what we created
  const caseCount =
    getOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM test_cases WHERE suite_id = ?",
      [suiteId],
    )?.count || 0;

  const stepCount =
    getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM test_steps
     WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = ?)`,
      [suiteId],
    )?.count || 0;

  const assertionCount =
    getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM test_assertions
     WHERE step_id IN (
       SELECT id FROM test_steps
       WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = ?)
     )`,
      [suiteId],
    )?.count || 0;

  console.log(`\n✅ Phase 2 seed complete:`);
  console.log(`   - 1 suite: ${suiteId}`);
  console.log(`   - ${caseCount} test cases`);
  console.log(`   - ${stepCount} test steps`);
  console.log(`   - ${assertionCount} test assertions`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPhase2Tests();
}

export default seedPhase2Tests;
```

#### 2. `parent-harness/orchestrator/src/db/seed-all-suites.ts` (CREATE)

New lightweight file to create all 16 test suite records with proper metadata:

```typescript
import { run, getOne } from "./index.js";

/**
 * Create all 16 test suite records for PHASES.md phases
 * This ensures the suite hierarchy exists before detailed test case seeding
 */
export function seedAllTestSuites(): void {
  console.log("🧪 Seeding all 16 test suite records...");

  const allPhases = [
    {
      phase: 1,
      id: "phase_1_frontend_shell",
      name: "Frontend Shell",
      description: "Static dashboard that can be tested independently",
    },
    {
      phase: 2,
      id: "phase_2_data_model",
      name: "Data Model",
      description: "Database ready with schema and seed data",
    },
    {
      phase: 3,
      id: "phase_3_backend_api",
      name: "Backend API",
      description: "REST API serving real data",
    },
    {
      phase: 4,
      id: "phase_4_frontend_api",
      name: "Frontend + API",
      description: "Dashboard connected to real API",
    },
    {
      phase: 5,
      id: "phase_5_websocket",
      name: "WebSocket",
      description: "Real-time updates via WebSocket",
    },
    {
      phase: 6,
      id: "phase_6_telegram_bot",
      name: "Telegram Bot",
      description: "Agent notifications via Telegram",
    },
    {
      phase: 7,
      id: "phase_7_orchestrator",
      name: "Orchestrator",
      description: "Task assignment and orchestration logic",
    },
    {
      phase: 8,
      id: "phase_8_clarification",
      name: "Clarification Agent",
      description: "Ask clarifying questions for vague tasks",
    },
    {
      phase: 9,
      id: "phase_9_agent_spawner",
      name: "Agent Spawner",
      description: "Spawn agent instances dynamically",
    },
    {
      phase: 10,
      id: "phase_10_agent_memory",
      name: "Agent Memory",
      description: "Persistent agent memory and context",
    },
    {
      phase: 11,
      id: "phase_11_qa_validation",
      name: "QA Validation",
      description: "Automated QA validation loops",
    },
    {
      phase: 12,
      id: "phase_12_human_sim",
      name: "Human Sim Agent",
      description: "Multi-persona usability testing",
    },
    {
      phase: 13,
      id: "phase_13_wave_execution",
      name: "Wave Execution",
      description: "Parallel task execution in waves",
    },
    {
      phase: 14,
      id: "phase_14_planning_agent",
      name: "Planning Agent",
      description: "Strategic planning and task breakdown",
    },
    {
      phase: 15,
      id: "phase_15_self_improvement",
      name: "Self-Improvement",
      description: "Platform improves itself autonomously",
    },
    {
      phase: 16,
      id: "phase_16_polish",
      name: "Polish",
      description: "Final polish and production readiness",
    },
  ];

  for (const phaseData of allPhases) {
    run(
      `
      INSERT INTO test_suites (id, name, description, type, source, phase, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        phase = excluded.phase
    `,
      [
        phaseData.id,
        `Phase ${phaseData.phase}: ${phaseData.name}`,
        phaseData.description,
        "verification",
        "phases",
        phaseData.phase,
        1,
      ],
    );
  }

  const suiteCount =
    getOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM test_suites WHERE source = ?",
      ["phases"],
    )?.count || 0;

  console.log(`✅ Created ${suiteCount} test suites`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAllTestSuites();
}

export default seedAllTestSuites;
```

#### 3. `parent-harness/orchestrator/src/db/seed.ts` (MODIFY)

Update to call new seed functions. Remove the inline suite creation (lines 85-107) and replace with calls to modular seed functions:

```typescript
import db from "./index.js";
import { v4 as uuidv4 } from "uuid";
import { seedAllTestSuites } from "./seed-all-suites.js";
import { seedPhase1Tests } from "./seed-phase1-tests.js";
import { seedPhase2Tests } from "./seed-phase2-tests.js";

console.log("🌱 Seeding database...");

try {
  // Seed 13 agents
  const agents = [
    {
      id: "orchestrator",
      name: "Orchestrator",
      type: "orchestrator",
      model: "haiku",
      telegram_channel: "@vibe-orchestrator",
    },
    {
      id: "planning_agent",
      name: "Planning Agent",
      type: "planning",
      model: "opus",
      telegram_channel: "@vibe-planning",
    },
    {
      id: "build_agent",
      name: "Build Agent",
      type: "build",
      model: "opus",
      telegram_channel: "@vibe-build",
    },
    {
      id: "spec_agent",
      name: "Spec Agent",
      type: "spec",
      model: "opus",
      telegram_channel: "@vibe-spec",
    },
    {
      id: "qa_agent",
      name: "QA Agent",
      type: "qa",
      model: "opus",
      telegram_channel: "@vibe-qa",
    },
    {
      id: "task_agent",
      name: "Task Agent",
      type: "task",
      model: "sonnet",
      telegram_channel: "@vibe-task",
    },
    {
      id: "sia_agent",
      name: "SIA",
      type: "sia",
      model: "opus",
      telegram_channel: "@vibe-sia",
    },
    {
      id: "research_agent",
      name: "Research Agent",
      type: "research",
      model: "sonnet",
      telegram_channel: "@vibe-research",
    },
    {
      id: "evaluator_agent",
      name: "Evaluator Agent",
      type: "evaluator",
      model: "opus",
      telegram_channel: "@vibe-evaluator",
    },
    {
      id: "decomposition_agent",
      name: "Decomposition Agent",
      type: "decomposition",
      model: "sonnet",
      telegram_channel: "@vibe-decomposition",
    },
    {
      id: "validation_agent",
      name: "Validation Agent",
      type: "validation",
      model: "sonnet",
      telegram_channel: "@vibe-validation",
    },
    {
      id: "clarification_agent",
      name: "Clarification Agent",
      type: "clarification",
      model: "sonnet",
      telegram_channel: "@vibe-clarification",
    },
    {
      id: "human_sim_agent",
      name: "Human Sim Agent",
      type: "human_sim",
      model: "sonnet",
      telegram_channel: "@vibe-human-sim",
    },
  ];

  const insertAgent = db.getDb().prepare(`
    INSERT OR REPLACE INTO agents (id, name, type, model, telegram_channel, status)
    VALUES (?, ?, ?, ?, ?, 'idle')
  `);

  for (const agent of agents) {
    insertAgent.run(
      agent.id,
      agent.name,
      agent.type,
      agent.model,
      agent.telegram_channel,
    );
  }
  console.log(`✅ Seeded ${agents.length} agents`);

  // Seed a sample task list
  const taskListId = uuidv4();
  db.run(
    `
    INSERT INTO task_lists (id, name, description, status)
    VALUES (?, 'Sample Task List', 'Initial task list for testing', 'draft')
  `,
    [taskListId],
  );
  console.log("✅ Seeded 1 task list");

  // Seed 5 sample tasks
  const tasks = [
    {
      displayId: "TASK-001",
      title: "Set up authentication endpoint",
      category: "feature",
      status: "pending",
      priority: "P1",
    },
    {
      displayId: "TASK-002",
      title: "Fix database migration issue",
      category: "bug",
      status: "pending",
      priority: "P0",
    },
    {
      displayId: "TASK-003",
      title: "Add unit tests for user service",
      category: "test",
      status: "pending",
      priority: "P2",
    },
    {
      displayId: "TASK-004",
      title: "Update API documentation",
      category: "documentation",
      status: "pending",
      priority: "P3",
    },
    {
      displayId: "TASK-005",
      title: "Implement WebSocket reconnection",
      category: "feature",
      status: "pending",
      priority: "P2",
    },
  ];

  const insertTask = db.getDb().prepare(`
    INSERT INTO tasks (id, display_id, title, category, status, priority, task_list_id, pass_criteria)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const taskIds: string[] = [];
  for (const task of tasks) {
    const id = uuidv4();
    taskIds.push(id);
    const passCriteria = JSON.stringify([
      `${task.title} is implemented`,
      "All tests pass",
      "Code reviewed",
    ]);
    insertTask.run(
      id,
      task.displayId,
      task.title,
      task.category,
      task.status,
      task.priority,
      taskListId,
      passCriteria,
    );
  }
  console.log(`✅ Seeded ${tasks.length} tasks`);

  // Add some task dependencies
  if (taskIds.length >= 3) {
    db.run(
      `
      INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
      VALUES (?, ?, ?, 'depends_on')
    `,
      [uuidv4(), taskIds[2], taskIds[0]],
    ); // Task 3 depends on Task 1

    db.run(
      `
      INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
      VALUES (?, ?, ?, 'depends_on')
    `,
      [uuidv4(), taskIds[4], taskIds[1]],
    ); // Task 5 depends on Task 2

    console.log("✅ Seeded 2 task relationships");
  }

  // Seed test suites and test cases
  seedAllTestSuites(); // Creates all 16 suite records
  seedPhase1Tests(); // Seeds Phase 1 test cases, steps, assertions
  seedPhase2Tests(); // Seeds Phase 2 test cases, steps, assertions

  db.close();
  console.log("🎉 Seeding complete");
} catch (error) {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
}
```

#### 4. `parent-harness/orchestrator/src/db/verify-test-seed.ts` (CREATE)

New verification script to validate seed data completeness:

```typescript
import { getOne, query } from "./index.js";

/**
 * Verification script for test system seed data
 * Validates that all required test suites, cases, steps, and assertions exist
 */

console.log("🔍 Verifying test system seed data...\n");

let hasErrors = false;

// 1. Verify 16 test suites exist
const suiteCount =
  getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM test_suites WHERE source = ?",
    ["phases"],
  )?.count || 0;

if (suiteCount === 16) {
  console.log("✅ Test suites: 16/16");
} else {
  console.log(`❌ Test suites: ${suiteCount}/16 (expected 16)`);
  hasErrors = true;
}

// 2. Verify Phase 1 test cases
const phase1Cases =
  getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM test_cases WHERE suite_id = ?",
    ["phase_1_frontend_shell"],
  )?.count || 0;

if (phase1Cases === 8) {
  console.log("✅ Phase 1 test cases: 8/8");
} else {
  console.log(`❌ Phase 1 test cases: ${phase1Cases}/8 (expected 8)`);
  hasErrors = true;
}

// 3. Verify Phase 2 test cases
const phase2Cases =
  getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM test_cases WHERE suite_id = ?",
    ["phase_2_data_model"],
  )?.count || 0;

if (phase2Cases === 6) {
  console.log("✅ Phase 2 test cases: 6/6");
} else {
  console.log(`❌ Phase 2 test cases: ${phase2Cases}/6 (expected 6)`);
  hasErrors = true;
}

// 4. Verify Phase 1 test steps
const phase1Steps =
  getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM test_steps
   WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = ?)`,
    ["phase_1_frontend_shell"],
  )?.count || 0;

if (phase1Steps >= 21) {
  console.log(`✅ Phase 1 test steps: ${phase1Steps} (expected ≥21)`);
} else {
  console.log(`❌ Phase 1 test steps: ${phase1Steps} (expected ≥21)`);
  hasErrors = true;
}

// 5. Verify Phase 2 test steps
const phase2Steps =
  getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM test_steps
   WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = ?)`,
    ["phase_2_data_model"],
  )?.count || 0;

if (phase2Steps >= 6) {
  console.log(`✅ Phase 2 test steps: ${phase2Steps} (expected ≥6)`);
} else {
  console.log(`❌ Phase 2 test steps: ${phase2Steps} (expected ≥6)`);
  hasErrors = true;
}

// 6. Verify Phase 1 test assertions
const phase1Assertions =
  getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM test_assertions
   WHERE step_id IN (
     SELECT id FROM test_steps
     WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = ?)
   )`,
    ["phase_1_frontend_shell"],
  )?.count || 0;

if (phase1Assertions >= 28) {
  console.log(`✅ Phase 1 test assertions: ${phase1Assertions} (expected ≥28)`);
} else {
  console.log(`❌ Phase 1 test assertions: ${phase1Assertions} (expected ≥28)`);
  hasErrors = true;
}

// 7. Verify Phase 2 test assertions
const phase2Assertions =
  getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM test_assertions
   WHERE step_id IN (
     SELECT id FROM test_steps
     WHERE case_id IN (SELECT id FROM test_cases WHERE suite_id = ?)
   )`,
    ["phase_2_data_model"],
  )?.count || 0;

if (phase2Assertions >= 10) {
  console.log(`✅ Phase 2 test assertions: ${phase2Assertions} (expected ≥10)`);
} else {
  console.log(`❌ Phase 2 test assertions: ${phase2Assertions} (expected ≥10)`);
  hasErrors = true;
}

// 8. Verify each Phase 2 test case has at least 1 step
const phase2CasesWithSteps = query<{ case_id: string; step_count: number }>(
  `SELECT case_id, COUNT(*) as step_count
   FROM test_steps
   WHERE case_id LIKE 'phase_2_task_%'
   GROUP BY case_id`,
);

const phase2CasesWithoutSteps = 6 - phase2CasesWithSteps.length;
if (phase2CasesWithoutSteps === 0) {
  console.log("✅ All Phase 2 test cases have steps");
} else {
  console.log(`❌ ${phase2CasesWithoutSteps} Phase 2 test cases missing steps`);
  hasErrors = true;
}

console.log("\n" + "=".repeat(50));

if (hasErrors) {
  console.log("❌ Verification FAILED - see errors above");
  process.exit(1);
} else {
  console.log("✅ Verification PASSED - all test seed data complete");
  process.exit(0);
}
```

#### 5. `parent-harness/orchestrator/package.json` (MODIFY)

Add npm scripts for running seed and verification:

```json
{
  "scripts": {
    "seed": "tsx src/db/seed.ts",
    "seed:phase1": "tsx src/db/seed-phase1-tests.ts",
    "seed:phase2": "tsx src/db/seed-phase2-tests.ts",
    "seed:suites": "tsx src/db/seed-all-suites.ts",
    "verify:test-seed": "tsx src/db/verify-test-seed.ts"
  }
}
```

## Pass Criteria

### 1. All 16 Test Suites Created

**Verification Method**:

```bash
sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM test_suites WHERE source = 'phases';"
```

**Expected Output**: `16`

**Test Query**:

```sql
SELECT id, name, phase FROM test_suites WHERE source = 'phases' ORDER BY phase;
```

**Expected**: 16 rows with phase numbers 1-16

### 2. Phase 1 Test Data Complete

**Verification Method**:

```bash
sqlite3 parent-harness/data/harness.db "SELECT COUNT(DISTINCT tc.id) as case_count, COUNT(DISTINCT ts.id) as step_count, COUNT(DISTINCT ta.id) as assertion_count FROM test_cases tc LEFT JOIN test_steps ts ON tc.id = ts.case_id LEFT JOIN test_assertions ta ON ts.id = ta.step_id WHERE tc.suite_id = 'phase_1_frontend_shell';"
```

**Expected Output**: `case_count=8, step_count=21, assertion_count=28`

### 3. Phase 2 Test Data Complete

**Verification Method**:

```bash
sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM test_cases WHERE suite_id = 'phase_2_data_model';"
```

**Expected Output**: `6`

### 4. Each Phase 2 Test Case Has Steps

**Verification Method**:

```bash
sqlite3 parent-harness/data/harness.db "SELECT case_id, COUNT(*) as step_count FROM test_steps WHERE case_id LIKE 'phase_2_task_%' GROUP BY case_id;"
```

**Expected Output**: 6 rows (one per test case) with step_count ≥ 1

### 5. Key Assertions Defined for Phase 2

**Verification Method**:

```bash
sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM test_assertions WHERE step_id IN (SELECT id FROM test_steps WHERE case_id LIKE 'phase_2_task_%');"
```

**Expected Output**: ≥10 (at least 10 assertions total across Phase 2)

### 6. Validation Query Works

**Verification Method**:

```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN tcr.status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results tcr
JOIN test_cases tc ON tcr.case_id = tc.id
WHERE tc.suite_id = 'phase_2_data_model';
```

**Expected**: Query runs without error (may return total=0, passed=0 initially)

### 7. Seed Script Is Idempotent

**Verification Method**:

```bash
cd parent-harness/orchestrator
npm run seed
npm run seed  # Run twice
echo $?       # Should be 0
```

**Expected**: Second run completes successfully with no duplicate records or errors

### 8. TypeScript Compiles Successfully

**Verification Method**:

```bash
cd parent-harness/orchestrator
npm run typecheck
```

**Expected**: No TypeScript errors

### 9. Verification Script Passes

**Verification Method**:

```bash
cd parent-harness/orchestrator
npm run verify:test-seed
```

**Expected Output**: `✅ Verification PASSED - all test seed data complete`

## Dependencies

### Required Before This Task

- ✅ Phase 2 Task 2.1: SQLite Database Setup (complete)
- ✅ Phase 2 Task 2.2: Run Schema (complete - 33 tables exist)
- ✅ `parent-harness/orchestrator/src/db/index.ts` (complete)
- ✅ `parent-harness/database/schema.sql` (complete - test system tables defined)
- ✅ `parent-harness/orchestrator/src/db/seed-phase1-tests.ts` (complete - reference implementation)

### Blocks These Tasks

- Phase 3+ tasks that rely on test system for validation
- Build Agent validation of pass criteria
- QA Agent querying test results
- Orchestrator tracking task completion via test results

### External Dependencies

- better-sqlite3 (already installed)
- TypeScript + tsx (already installed)
- Node.js 18+ runtime
- SQLite3 CLI (for verification queries)

## Implementation Notes

### Execution Order

1. Create `seed-all-suites.ts` (creates 16 suite records)
2. Create `seed-phase2-tests.ts` (adds Phase 2 test cases/steps/assertions)
3. Update `seed.ts` to import and call new functions
4. Create `verify-test-seed.ts` (validation script)
5. Update `package.json` with new npm scripts
6. Run seed script and verify output

### Testing Strategy

1. **Unit test**: Run individual seed functions and check counts
2. **Integration test**: Run full `npm run seed` and validate all tables
3. **Idempotency test**: Run seed twice and ensure no duplicates
4. **Verification test**: Run `npm run verify:test-seed` and check exit code

### Rollback Plan

If seed data is incorrect:

```sql
DELETE FROM test_suites WHERE source = 'phases';
-- CASCADE will delete all test_cases, test_steps, test_assertions
```

Then re-run: `npm run seed`

### Performance Considerations

- Use transactions for batch inserts (wrapped in `run()` function)
- Use `ON CONFLICT` for idempotency instead of DELETE+INSERT
- Seed scripts should complete in <2 seconds total

## Codebase Patterns to Follow

### Pattern 1: Seed Function Structure

Follow `seed-phase1-tests.ts`:

- Export function with clear name (`seedPhase2Tests`)
- Use `ON CONFLICT` for idempotency
- Console log progress with emojis
- Count and report what was created
- Support direct execution with `import.meta.url` check

### Pattern 2: Test Case Definition

Each test case should have:

- Unique ID following pattern `phase_N_task_M_[slug]`
- Descriptive name and description
- Appropriate priority (P0 for critical, P1 for important, P2 for nice-to-have)
- 1-4 test steps with clear command and expected output
- 1-3 assertions per step for key pass criteria

### Pattern 3: Database Queries

Use helper functions from `index.ts`:

- `run()` for INSERT/UPDATE/DELETE
- `query()` for SELECT returning multiple rows
- `getOne()` for SELECT returning single row
- Always use parameterized queries (never string interpolation)

## Open Questions

None - requirements are clear from PHASES.md and existing implementation.

## Alternative Approaches Considered

### Approach 1: Single Monolithic Seed Script

**Pros**: One file to maintain
**Cons**: Hard to debug, slow to run, difficult to extend
**Decision**: ❌ Rejected - not maintainable as project grows

### Approach 2: Separate Script Per Phase (16 files)

**Pros**: Maximum separation of concerns
**Cons**: Too many files, repetitive boilerplate code
**Decision**: ❌ Rejected - too granular

### Approach 3: Hybrid (Suites + Detailed Phase Data) ✅ CHOSEN

**Pros**: Scalable, maintainable, follows existing pattern
**Cons**: Multiple files to maintain
**Decision**: ✅ Accepted - best balance of modularity and maintainability

### Approach 4: Generate Test Data from PHASES.md Parsing

**Pros**: Single source of truth, automatic updates
**Cons**: Complex parser, fragile to PHASES.md format changes
**Decision**: ❌ Rejected - over-engineered for current needs

## References

- **PHASES.md**: `parent-harness/docs/PHASES.md` - source of truth for all tasks
- **Schema**: `parent-harness/database/schema.sql` - test system table definitions
- **Existing seed**: `parent-harness/orchestrator/src/db/seed-phase1-tests.ts` - reference implementation
- **Main seed**: `parent-harness/orchestrator/src/db/seed.ts` - entry point
- **Database module**: `parent-harness/orchestrator/src/db/index.ts` - helper functions
- **TASK-024 existing spec**: `docs/specs/TASK-024-phase2-test-seed-completion.md` - initial analysis

## Success Metrics

After implementation, these commands should all succeed:

```bash
# 1. Seed the database
cd parent-harness/orchestrator
npm run seed

# 2. Verify test seed data
npm run verify:test-seed

# 3. Validate TypeScript compilation
npm run typecheck

# 4. Query validation
sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM test_suites WHERE source='phases';"
# Expected: 16

sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM test_cases WHERE suite_id='phase_2_data_model';"
# Expected: 6

# 5. Idempotency check
npm run seed  # Run again
npm run verify:test-seed  # Should still pass
```

All commands should exit with code 0 and produce expected output.
