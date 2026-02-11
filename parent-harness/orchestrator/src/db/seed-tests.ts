/**
 * Test System Seed Data
 *
 * Creates test suites, cases, and steps for phase 1 tasks.
 * Run with: npm run seed-tests
 */

import { run, query, getOne } from "./index.js";
import { v4 as uuidv4 } from "uuid";

interface SeedSuite {
  name: string;
  description: string;
  cases: SeedCase[];
}

interface SeedCase {
  name: string;
  description: string;
  steps: SeedStep[];
}

interface SeedStep {
  name: string;
  command: string;
  expectedExitCode?: number;
  expectedOutputContains?: string;
}

/**
 * Create test suites with cases and steps
 */
export function seedTests(): void {
  console.log("🧪 Seeding test data...");

  const suites: SeedSuite[] = [
    {
      name: "API Health Checks",
      description: "Verify all API endpoints are responding",
      cases: [
        {
          name: "Health endpoint returns OK",
          description: "GET /health should return status ok",
          steps: [
            {
              name: "Call health endpoint",
              command: "curl -s http://localhost:3333/health",
              expectedExitCode: 0,
              expectedOutputContains: "ok",
            },
          ],
        },
        {
          name: "Agents endpoint returns list",
          description: "GET /api/agents should return array",
          steps: [
            {
              name: "Call agents endpoint",
              command: "curl -s http://localhost:3333/api/agents",
              expectedExitCode: 0,
              expectedOutputContains: "[",
            },
          ],
        },
        {
          name: "Tasks endpoint returns list",
          description: "GET /api/tasks should return array",
          steps: [
            {
              name: "Call tasks endpoint",
              command: "curl -s http://localhost:3333/api/tasks",
              expectedExitCode: 0,
              expectedOutputContains: "[",
            },
          ],
        },
        {
          name: "Sessions endpoint returns list",
          description: "GET /api/sessions should return array",
          steps: [
            {
              name: "Call sessions endpoint",
              command: "curl -s http://localhost:3333/api/sessions",
              expectedExitCode: 0,
              expectedOutputContains: "[",
            },
          ],
        },
        {
          name: "Orchestrator status endpoint",
          description: "GET /api/orchestrator/status should return status",
          steps: [
            {
              name: "Call orchestrator status",
              command: "curl -s http://localhost:3333/api/orchestrator/status",
              expectedExitCode: 0,
              expectedOutputContains: "operational",
            },
          ],
        },
      ],
    },
    {
      name: "TypeScript Build",
      description: "Verify TypeScript compiles without errors",
      cases: [
        {
          name: "Orchestrator builds",
          description: "TypeScript should compile without errors",
          steps: [
            {
              name: "Run TypeScript compiler",
              command: "cd parent-harness/orchestrator && npm run typecheck",
              expectedExitCode: 0,
            },
          ],
        },
        {
          name: "Dashboard builds",
          description: "Dashboard should build without errors",
          steps: [
            {
              name: "Run Vite build",
              command: "cd parent-harness/dashboard && npm run build",
              expectedExitCode: 0,
            },
          ],
        },
      ],
    },
    {
      name: "Unit Tests",
      description: "Run unit test suites",
      cases: [
        {
          name: "Orchestrator unit tests",
          description: "All orchestrator tests should pass",
          steps: [
            {
              name: "Run vitest",
              command: "cd parent-harness/orchestrator && npm test",
              expectedExitCode: 0,
            },
          ],
        },
        {
          name: "Dashboard unit tests",
          description: "All dashboard tests should pass",
          steps: [
            {
              name: "Run vitest",
              command: "cd parent-harness/dashboard && npm test",
              expectedExitCode: 0,
            },
          ],
        },
      ],
    },
    {
      name: "Database Integrity",
      description: "Verify database schema and constraints",
      cases: [
        {
          name: "All tables exist",
          description: "Required tables should exist in the database",
          steps: [
            {
              name: "Check agents table",
              command:
                'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM agents"',
              expectedExitCode: 0,
            },
            {
              name: "Check tasks table",
              command:
                'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM tasks"',
              expectedExitCode: 0,
            },
            {
              name: "Check agent_sessions table",
              command:
                'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM agent_sessions"',
              expectedExitCode: 0,
            },
            {
              name: "Check observability_events table",
              command:
                'sqlite3 parent-harness/data/harness.db "SELECT COUNT(*) FROM observability_events"',
              expectedExitCode: 0,
            },
          ],
        },
        {
          name: "Foreign keys enforced",
          description: "FK constraints should be active",
          steps: [
            {
              name: "Check FK pragma",
              command:
                'sqlite3 parent-harness/data/harness.db "PRAGMA foreign_keys"',
              expectedExitCode: 0,
              expectedOutputContains: "1",
            },
          ],
        },
      ],
    },
    {
      name: "Agent Lifecycle",
      description: "Test agent creation and status transitions",
      cases: [
        {
          name: "Agent can be created",
          description: "POST /api/agents should create an agent",
          steps: [
            {
              name: "Create test agent",
              command:
                'curl -s -X POST http://localhost:3333/api/agents -H "Content-Type: application/json" -d \'{"id":"test_seed_agent","name":"Seed Test Agent","type":"build_agent"}\'',
              expectedExitCode: 0,
              expectedOutputContains: "test_seed_agent",
            },
          ],
        },
        {
          name: "Agent status can be updated",
          description: "PATCH /api/agents/:id should update status",
          steps: [
            {
              name: "Update agent status",
              command:
                'curl -s -X PATCH http://localhost:3333/api/agents/test_seed_agent -H "Content-Type: application/json" -d \'{"status":"working"}\'',
              expectedExitCode: 0,
              expectedOutputContains: "working",
            },
          ],
        },
      ],
    },
    {
      name: "Task Lifecycle",
      description: "Test task creation and state transitions",
      cases: [
        {
          name: "Task can be created",
          description: "POST /api/tasks should create a task",
          steps: [
            {
              name: "Create test task",
              command:
                'curl -s -X POST http://localhost:3333/api/tasks -H "Content-Type: application/json" -d \'{"display_id":"TEST-001","title":"Seed Test Task","category":"test","priority":"P2"}\'',
              expectedExitCode: 0,
              expectedOutputContains: "TEST-001",
            },
          ],
        },
        {
          name: "Task can be assigned",
          description: "PATCH /api/tasks/:id/assign should assign task",
          steps: [
            {
              name: "Assign task to agent",
              command:
                'curl -s -X POST http://localhost:3333/api/tasks/assign -H "Content-Type: application/json" -d \'{"taskDisplayId":"TEST-001","agentId":"test_seed_agent"}\'',
              expectedExitCode: 0,
            },
          ],
        },
      ],
    },
  ];

  // Create suites
  for (const suite of suites) {
    const suiteId = uuidv4();

    run(
      `
      INSERT INTO test_suites (id, name, description, type, source, enabled)
      VALUES (?, ?, ?, 'integration', 'phases', 1)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name
    `,
      [suiteId, suite.name, suite.description],
    );

    console.log(`  📂 Created suite: ${suite.name}`);

    // Create cases
    for (let caseIdx = 0; caseIdx < suite.cases.length; caseIdx++) {
      const testCase = suite.cases[caseIdx];
      const caseId = uuidv4();

      run(
        `
        INSERT INTO test_cases (id, suite_id, name, description, priority, enabled)
        VALUES (?, ?, ?, ?, 'P2', 1)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `,
        [caseId, suiteId, testCase.name, testCase.description],
      );

      console.log(`    📝 Created case: ${testCase.name}`);

      // Create steps
      for (let stepIdx = 0; stepIdx < testCase.steps.length; stepIdx++) {
        const step = testCase.steps[stepIdx];
        const stepId = uuidv4();

        run(
          `
          INSERT INTO test_steps (id, case_id, sequence, name, command, expected_exit_code, expected_output_contains)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name
        `,
          [
            stepId,
            caseId,
            stepIdx + 1,
            step.name,
            step.command,
            step.expectedExitCode ?? 0,
            step.expectedOutputContains ?? null,
          ],
        );
      }
    }
  }

  // Count what we created
  const suiteCount =
    getOne<{ count: number }>("SELECT COUNT(*) as count FROM test_suites")
      ?.count || 0;
  const caseCount =
    getOne<{ count: number }>("SELECT COUNT(*) as count FROM test_cases")
      ?.count || 0;
  const stepCount =
    getOne<{ count: number }>("SELECT COUNT(*) as count FROM test_steps")
      ?.count || 0;

  console.log(
    `\n✅ Seeded ${suiteCount} suites, ${caseCount} cases, ${stepCount} steps`,
  );
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTests();
}

export default seedTests;
