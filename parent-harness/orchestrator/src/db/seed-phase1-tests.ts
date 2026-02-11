/**
 * Phase 1 Test System Seed Data
 *
 * Creates test suite, cases, steps, and assertions for Phase 1 tasks
 * according to PHASES.md specification.
 *
 * This addresses Task 2.6: Create Test System Tables Seed
 * - Creates 1 test_suite for Phase 1
 * - Creates 8 test_cases (one per Phase 1 task)
 * - Creates test_steps for each case
 * - Creates test_assertions for key pass criteria
 */

import { run, query, getOne } from "./index.js";

export function seedPhase1Tests(): void {
  console.log("🧪 Seeding Phase 1 test data...");

  // Create Phase 1 test suite
  const suiteId = "phase_1_frontend_shell";

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
      "Phase 1: Frontend Shell",
      "Static dashboard that can be tested independently",
      "verification",
      "phases",
      1,
      1,
    ],
  );

  console.log(`  📂 Created suite: ${suiteId}`);

  // Define Phase 1 test cases with steps and assertions
  const testCases = [
    {
      id: "phase_1_task_1_vite_setup",
      name: "Vite + React + TypeScript Setup",
      description:
        "Verify Vite project is set up correctly with React and TypeScript",
      priority: "P0" as const,
      steps: [
        {
          name: "Check dashboard folder exists",
          command: "test -d parent-harness/dashboard",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard",
              errorMessage: "Dashboard folder should exist",
            },
          ],
        },
        {
          name: "Check package.json contains required dependencies",
          command: "cat parent-harness/dashboard/package.json",
          expectedExitCode: 0,
          expectedOutputContains: "vite",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/package.json",
              expectedValue: "vite",
              errorMessage: "package.json should contain vite",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/package.json",
              expectedValue: "react",
              errorMessage: "package.json should contain react",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/package.json",
              expectedValue: "typescript",
              errorMessage: "package.json should contain typescript",
            },
          ],
        },
        {
          name: "Check main.tsx exists",
          command: "test -f parent-harness/dashboard/src/main.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/main.tsx",
              errorMessage: "main.tsx should exist",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_2_tailwind",
      name: "Tailwind CSS Configuration",
      description: "Verify Tailwind CSS is configured correctly",
      priority: "P0" as const,
      steps: [
        {
          name: "Check Tailwind packages installed",
          command: "cat parent-harness/dashboard/package.json",
          expectedExitCode: 0,
          expectedOutputContains: "tailwindcss",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/package.json",
              expectedValue: "tailwindcss",
              errorMessage: "Tailwind should be installed",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/package.json",
              expectedValue: "@tailwindcss/vite",
              errorMessage: "Tailwind Vite plugin should be installed",
            },
          ],
        },
        {
          name: "Check vite.config.ts has Tailwind plugin",
          command: "cat parent-harness/dashboard/vite.config.ts",
          expectedExitCode: 0,
          expectedOutputContains: "tailwindcss",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/vite.config.ts",
              expectedValue: "tailwindcss",
              errorMessage: "vite.config.ts should include Tailwind plugin",
            },
          ],
        },
        {
          name: "Check index.css imports Tailwind",
          command: "cat parent-harness/dashboard/src/index.css",
          expectedExitCode: 0,
          expectedOutputContains: '@import "tailwindcss"',
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/index.css",
              expectedValue: '@import "tailwindcss"',
              errorMessage: "index.css should import Tailwind",
            },
          ],
        },
        {
          name: "Verify build succeeds",
          command: "cd parent-harness/dashboard && npm run build",
          expectedExitCode: 0,
          assertions: [
            {
              type: "equals" as const,
              target: "exit_code",
              expectedValue: "0",
              errorMessage: "Build should succeed",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_3_layout",
      name: "Three-Column Layout",
      description: "Verify layout component with header and three columns",
      priority: "P0" as const,
      steps: [
        {
          name: "Check Layout.tsx exists",
          command: "test -f parent-harness/dashboard/src/components/Layout.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/components/Layout.tsx",
              errorMessage: "Layout.tsx should exist",
            },
          ],
        },
        {
          name: "Check Layout has required test IDs",
          command: "cat parent-harness/dashboard/src/components/Layout.tsx",
          expectedExitCode: 0,
          expectedOutputContains: "layout-header",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/Layout.tsx",
              expectedValue: "layout-header",
              errorMessage: "Layout should have header test ID",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/Layout.tsx",
              expectedValue: "layout-left",
              errorMessage: "Layout should have left column test ID",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/Layout.tsx",
              expectedValue: "layout-main",
              errorMessage: "Layout should have main column test ID",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/Layout.tsx",
              expectedValue: "layout-right",
              errorMessage: "Layout should have right column test ID",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_4_agent_card",
      name: "AgentStatusCard Component",
      description: "Verify agent status card component with mock data",
      priority: "P1" as const,
      steps: [
        {
          name: "Check AgentStatusCard.tsx exists",
          command:
            "test -f parent-harness/dashboard/src/components/AgentStatusCard.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target:
                "parent-harness/dashboard/src/components/AgentStatusCard.tsx",
              errorMessage: "AgentStatusCard.tsx should exist",
            },
          ],
        },
        {
          name: "Check component has agent-card test ID",
          command:
            "cat parent-harness/dashboard/src/components/AgentStatusCard.tsx",
          expectedExitCode: 0,
          expectedOutputContains: "agent-card",
          assertions: [
            {
              type: "contains" as const,
              target:
                "parent-harness/dashboard/src/components/AgentStatusCard.tsx",
              expectedValue: "agent-card",
              errorMessage: "Component should have agent-card test ID",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_5_event_stream",
      name: "EventStream Component",
      description: "Verify event stream component with scrolling and mock data",
      priority: "P1" as const,
      steps: [
        {
          name: "Check EventStream.tsx exists",
          command:
            "test -f parent-harness/dashboard/src/components/EventStream.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/components/EventStream.tsx",
              errorMessage: "EventStream.tsx should exist",
            },
          ],
        },
        {
          name: "Check component has event-stream test ID",
          command:
            "cat parent-harness/dashboard/src/components/EventStream.tsx",
          expectedExitCode: 0,
          expectedOutputContains: "event-stream",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/EventStream.tsx",
              expectedValue: "event-stream",
              errorMessage: "Component should have event-stream test ID",
            },
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/EventStream.tsx",
              expectedValue: "event-item",
              errorMessage: "Events should have event-item test ID",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_6_task_card",
      name: "TaskCard Component",
      description: "Verify task card component with priority and status badges",
      priority: "P1" as const,
      steps: [
        {
          name: "Check TaskCard.tsx exists",
          command:
            "test -f parent-harness/dashboard/src/components/TaskCard.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/components/TaskCard.tsx",
              errorMessage: "TaskCard.tsx should exist",
            },
          ],
        },
        {
          name: "Check component has task-card test ID",
          command: "cat parent-harness/dashboard/src/components/TaskCard.tsx",
          expectedExitCode: 0,
          expectedOutputContains: "task-card",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/src/components/TaskCard.tsx",
              expectedValue: "task-card",
              errorMessage: "Component should have task-card test ID",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_7_routing",
      name: "Basic Routing",
      description:
        "Verify React Router setup with Dashboard, Tasks, and Sessions pages",
      priority: "P0" as const,
      steps: [
        {
          name: "Check react-router-dom installed",
          command: "cat parent-harness/dashboard/package.json",
          expectedExitCode: 0,
          expectedOutputContains: "react-router-dom",
          assertions: [
            {
              type: "contains" as const,
              target: "parent-harness/dashboard/package.json",
              expectedValue: "react-router-dom",
              errorMessage: "react-router-dom should be installed",
            },
          ],
        },
        {
          name: "Check Dashboard page exists",
          command: "test -f parent-harness/dashboard/src/pages/Dashboard.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/pages/Dashboard.tsx",
              errorMessage: "Dashboard.tsx page should exist",
            },
          ],
        },
        {
          name: "Check Tasks page exists",
          command: "test -f parent-harness/dashboard/src/pages/Tasks.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/pages/Tasks.tsx",
              errorMessage: "Tasks.tsx page should exist",
            },
          ],
        },
        {
          name: "Check Sessions page exists",
          command: "test -f parent-harness/dashboard/src/pages/Sessions.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target: "parent-harness/dashboard/src/pages/Sessions.tsx",
              errorMessage: "Sessions.tsx page should exist",
            },
          ],
        },
      ],
    },
    {
      id: "phase_1_task_8_notifications",
      name: "Notification Center",
      description: "Verify notification center with bell icon and dropdown",
      priority: "P2" as const,
      steps: [
        {
          name: "Check NotificationCenter.tsx exists",
          command:
            "test -f parent-harness/dashboard/src/components/NotificationCenter.tsx",
          expectedExitCode: 0,
          assertions: [
            {
              type: "exists" as const,
              target:
                "parent-harness/dashboard/src/components/NotificationCenter.tsx",
              errorMessage: "NotificationCenter.tsx should exist",
            },
          ],
        },
        {
          name: "Check component has notification-center test ID",
          command:
            "cat parent-harness/dashboard/src/components/NotificationCenter.tsx",
          expectedExitCode: 0,
          expectedOutputContains: "notification-center",
          assertions: [
            {
              type: "contains" as const,
              target:
                "parent-harness/dashboard/src/components/NotificationCenter.tsx",
              expectedValue: "notification-center",
              errorMessage: "Component should have notification-center test ID",
            },
          ],
        },
      ],
    },
  ];

  // Insert test cases, steps, and assertions
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

  console.log(`\n✅ Phase 1 seed complete:`);
  console.log(`   - 1 suite: ${suiteId}`);
  console.log(`   - ${caseCount} test cases`);
  console.log(`   - ${stepCount} test steps`);
  console.log(`   - ${assertionCount} test assertions`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPhase1Tests();
}

export default seedPhase1Tests;
