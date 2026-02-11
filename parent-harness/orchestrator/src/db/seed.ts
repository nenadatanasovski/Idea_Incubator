import db from "./index.js";
import { v4 as uuidv4 } from "uuid";
import { seedPhase1Tests } from "./seed-phase1-tests.js";

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

  // Seed test suites for all 16 phases
  const phases = [
    "Frontend Shell",
    "Data Model",
    "Backend API",
    "Frontend + API",
    "WebSocket",
    "Telegram Bot",
    "Orchestrator",
    "Clarification Agent",
    "Agent Spawner",
    "Agent Memory",
    "QA Validation",
    "Human Sim Agent",
    "Wave Execution",
    "Planning Agent",
    "Self-Improvement",
    "Polish",
  ];

  const insertSuite = db.getDb().prepare(`
    INSERT OR REPLACE INTO test_suites (id, name, description, type, source, phase, enabled)
    VALUES (?, ?, ?, 'verification', 'phases', ?, 1)
  `);

  phases.forEach((name, index) => {
    const phaseNum = index + 1;
    insertSuite.run(
      `phase_${phaseNum}`,
      `Phase ${phaseNum}: ${name}`,
      `Verification tests for Phase ${phaseNum}`,
      phaseNum,
    );
  });
  console.log(`✅ Seeded ${phases.length} test suites`);

  // Seed Phase 1 test cases, steps, and assertions
  seedPhase1Tests();

  db.close();
  console.log("🎉 Seeding complete");
} catch (error) {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
}
