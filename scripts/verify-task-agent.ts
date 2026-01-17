
import { v4 as uuidv4 } from "uuid";
import { run, saveDb } from "../database/db.js";


const BASE_URL = "http://localhost:3001/api";

async function main() {
  const listId = uuidv4();
  console.log(`Creating Task List with ID: ${listId}`);

  // 1. Create Task List in DB
  await run(
    `INSERT INTO task_lists_v2 (id, name, status, total_tasks, completed_tasks, failed_tasks, created_at) 
     VALUES (?, 'Agentic Verification List UUID', 'draft', 0, 0, 0, datetime('now'))`,
    [listId]
  );
  await saveDb();
  console.log("Task List created in DB.");

  // 1.5 Reload DB in Server
  console.log("Reloading Server DB...");
  const reloadRes = await fetch(`${BASE_URL}/db/reload`, { method: "POST" });
  if (!reloadRes.ok) console.error("Failed to reload DB:", await reloadRes.text());
  else console.log("Server DB reloaded.");

  // 2. Create Task 1 via API
  console.log("Creating Task 1...");
  const task1Res = await fetch(`${BASE_URL}/task-agent/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Verify System Readiness UUID",
      description: "A random task to verify readiness.",
      category: "task",
      targetTaskListId: listId,
      priority: "P1"
    })
  });
  const task1Data = await task1Res.json();
  if (!task1Res.ok) throw new Error(`Failed to create task 1: ${JSON.stringify(task1Data)}`);
  const task1Id = task1Data.task.id;
  console.log(`Task 1 created: ${task1Id}`);

  // 3. Create Task 2 via API
  console.log("Creating Task 2...");
  const task2Res = await fetch(`${BASE_URL}/task-agent/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Verify Build Loop UUID",
      description: "Another task to verify the loop.",
      category: "task",
      targetTaskListId: listId,
      priority: "P1"
    })
  });
  const task2Data = await task2Res.json();
  if (!task2Res.ok) throw new Error(`Failed to create task 2: ${JSON.stringify(task2Data)}`);
  const task2Id = task2Data.task.id;
  console.log(`Task 2 created: ${task2Id}`);

  // 4. Add Appendices to Task 1
  console.log("Adding appendices to Task 1...");
  await addAppendix(task1Id, "acceptance_criteria", "- Verify system is ready");
  await addAppendix(task1Id, "test_context", "Run: npm test");

  // 5. Add Appendices to Task 2
  console.log("Adding appendices to Task 2...");
  await addAppendix(task2Id, "acceptance_criteria", "- Verify build loop works");
  await addAppendix(task2Id, "test_context", "Run: npm test");

  // 6. Execute Task List
  console.log("Executing Task List...");
  const execRes = await fetch(`${BASE_URL}/task-agent/task-lists/${listId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxConcurrent: 1 })
  });
  const execData = await execRes.json();
  console.log("Execution Response:", JSON.stringify(execData, null, 2));
}

async function addAppendix(taskId: string, type: string, content: string) {
  const res = await fetch(`${BASE_URL}/task-agent/tasks/${taskId}/appendices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appendixType: type, content })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Failed to add appendix ${type} to ${taskId}: ${JSON.stringify(data)}`);
  }
}

main().catch(console.error);
