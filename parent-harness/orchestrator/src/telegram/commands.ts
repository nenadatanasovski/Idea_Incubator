/**
 * Telegram Bot Command Handlers
 *
 * Implements commands for each bot type.
 */
import { registerCommand, registerGlobalCommand } from "../api/webhook.js";
import { getDb } from "../db/index.js";
import { getRuntimeMode } from "../runtime/mode.js";

function tableExists(db: ReturnType<typeof getDb>, tableName: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(tableName) as { name: string } | undefined;
  return !!row;
}

// ============================================
// Global Commands (available on all bots)
// ============================================

registerGlobalCommand("help", async (args, chatId, messageId, botType) => {
  const helpTexts: Record<string, string> = {
    planning: `📋 *Planning Bot Commands*
/approve <taskId> - Approve task for execution
/reject <taskId> <reason> - Reject task with reason
/clarify <taskId> <question> - Request clarification
/pending - List pending approval tasks
/priority <taskId> <p0|p1|p2> - Change priority
/phase [num] - View phase tasks`,

    build: `🔨 *Build Bot Commands*
/status [taskId] - Current build status
/retry <taskId> - Retry failed task
/pause <taskId> - Pause task
/resume <taskId> - Resume paused task
/logs <taskId> - Get agent output
/model <taskId> <opus|sonnet|haiku> - Switch model`,

    validation: `✅ *Validation Bot Commands*
/retest <taskId> - Re-run tests
/skip <testId> <reason> - Skip failing test
/approve_fix <fixTaskId> - Approve QA fix
/reject_fix <fixTaskId> <reason> - Reject fix
/details <testId> - Full test details
/coverage - Test coverage stats`,

    clarification: `❓ *Clarification Bot Commands*
/newplan - Generate a new strategic plan
/pending - Show pending plans
/plan [id] - View plan details
/approve [planId] - Approve & execute plan
/reject [reason] - Reject plan
/respond <taskId> <answer> - Answer clarification
/skip <taskId> - Skip clarification`,

    sia: `🧠 *SIA Bot Commands*
/status - System health
/agents - List active agents
/budget - Budget usage
/pause_all - Pause agent spawning
/resume_all - Resume spawning
/stop - Stop orchestrator
/start - Start orchestrator
/restart - Restart harness`,

    monitor: `👁️ *Monitor Bot Commands*
/status - System health
/agents - Active agents
/errors - Recent errors
/budget - Budget status
/stop - Stop orchestrator
/start - Start orchestrator
/restart - Restart harness`,

    orchestrator: `🎯 *Orchestrator Bot Commands*
/wave [num] - Wave status
/spawn <taskId> - Manually spawn agent
/kill <agentId> - Terminate agent
/stop - Stop orchestrator
/start - Start orchestrator
/restart - Restart harness`,
  };

  return helpTexts[botType] || `Available commands: /help, /status`;
});

registerGlobalCommand("status", async (args, chatId, messageId, botType) => {
  const db = getDb();

  // Get basic stats
  const taskStats = db
    .prepare(
      `
    SELECT 
      status,
      COUNT(*) as count
    FROM tasks 
    GROUP BY status
  `,
    )
    .all() as { status: string; count: number }[];

  const agentStats = db
    .prepare(
      `
    SELECT 
      status,
      COUNT(*) as count
    FROM agents 
    GROUP BY status
  `,
    )
    .all() as { status: string; count: number }[];

  const formatStats = (stats: { status: string; count: number }[]) =>
    stats.map((s) => `${s.status}: ${s.count}`).join(", ") || "none";

  return `📊 *System Status*
  
*Tasks:* ${formatStats(taskStats)}
*Agents:* ${formatStats(agentStats)}`;
});

// ============================================
// Planning Bot Commands
// ============================================

registerCommand("planning", "approve", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /approve <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  // Find task
  const task = db
    .prepare(
      `
    SELECT id, display_id, title, status FROM tasks 
    WHERE display_id = ? OR id = ?
  `,
    )
    .get(taskId, taskId) as
    | { id: string; display_id: string; title: string; status: string }
    | undefined;

  if (!task) {
    return `❌ Task not found: ${taskId}`;
  }

  if (!["pending_approval", "proposed", "evaluating"].includes(task.status)) {
    return `⚠️ Task ${task.display_id} is not pending approval (status: ${task.status})`;
  }

  // Approve task
  db.prepare(
    `
    UPDATE tasks SET status = 'pending', updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(task.id);

  return `✅ *Approved:* \`${task.display_id}\`\n${task.title}\n\nTask moved to execution queue.`;
});

registerCommand("planning", "reject", async (args) => {
  if (args.length < 2) {
    return "❌ Usage: /reject <taskId> <reason>";
  }

  const taskId = args[0];
  const reason = args.slice(1).join(" ");
  const db = getDb();

  const task = db
    .prepare(
      `
    SELECT id, display_id, title FROM tasks 
    WHERE display_id = ? OR id = ?
  `,
    )
    .get(taskId, taskId) as
    | { id: string; display_id: string; title: string }
    | undefined;

  if (!task) {
    return `❌ Task not found: ${taskId}`;
  }

  db.prepare(
    `
    UPDATE tasks
    SET status = 'skipped',
        description = COALESCE(description, '') || '\n\nRejected: ' || ?,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(reason, task.id);

  return `❌ *Rejected:* \`${task.display_id}\`\n${task.title}\n\n*Reason:* ${reason}`;
});

registerCommand("planning", "pending", async () => {
  const db = getDb();

  const tasks = db
    .prepare(
      `
    SELECT display_id, title, priority, created_at
    FROM tasks 
    WHERE status IN ('pending_approval', 'proposed', 'evaluating')
    ORDER BY 
      CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
      created_at ASC
    LIMIT 10
  `,
    )
    .all() as {
    display_id: string;
    title: string;
    priority: string;
    created_at: string;
  }[];

  if (tasks.length === 0) {
    return "✅ No tasks pending approval";
  }

  const lines = tasks.map(
    (t, i) =>
      `${i + 1}. \`${t.display_id}\` [${t.priority}]\n   ${t.title.slice(0, 60)}`,
  );

  return `📋 *Pending Approval (${tasks.length})*\n\n${lines.join("\n\n")}\n\nUse /approve <taskId> or /reject <taskId> <reason>`;
});

registerCommand("planning", "priority", async (args) => {
  if (args.length < 2) {
    return "❌ Usage: /priority <taskId> <P0|P1|P2>";
  }

  const [taskId, priority] = args;
  const normalized = priority.toUpperCase();
  if (!["P0", "P1", "P2", "P3", "P4"].includes(normalized)) {
    return "❌ Priority must be P0, P1, P2, P3, or P4";
  }

  const db = getDb();
  const result = db
    .prepare(
      `
    UPDATE tasks SET priority = ? WHERE display_id = ? OR id = ?
  `,
    )
    .run(normalized, taskId, taskId);

  if (result.changes === 0) {
    return `❌ Task not found: ${taskId}`;
  }

  return `✅ Priority updated to *${normalized}* for \`${taskId}\``;
});

// ============================================
// Build Bot Commands
// ============================================

registerCommand("build", "retry", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /retry <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  const task = db
    .prepare(
      `
    SELECT id, display_id, title, status FROM tasks 
    WHERE display_id = ? OR id = ?
  `,
    )
    .get(taskId, taskId) as
    | { id: string; display_id: string; title: string; status: string }
    | undefined;

  if (!task) {
    return `❌ Task not found: ${taskId}`;
  }

  if (task.status !== "failed" && task.status !== "error") {
    return `⚠️ Task ${task.display_id} is not in failed state (status: ${task.status})`;
  }

  // Reset task to pending without incrementing retry_count.
  // Retry increments are owned by the failed-transition path only.
  db.prepare(
    `
    UPDATE tasks SET status = 'pending', assigned_agent_id = NULL, updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(task.id);

  return `🔄 *Retrying:* \`${task.display_id}\`\n${task.title}\n\nTask re-queued for execution.`;
});

registerCommand("build", "pause", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /pause <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  const result = db
    .prepare(
      `
    UPDATE tasks SET status = 'blocked', updated_at = datetime('now')
    WHERE (display_id = ? OR id = ?) AND status = 'in_progress'
  `,
    )
    .run(taskId, taskId);

  if (result.changes === 0) {
    return `❌ Task not found or not in progress: ${taskId}`;
  }

  return `⏸️ *Paused:* \`${taskId}\``;
});

registerCommand("build", "resume", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /resume <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  const result = db
    .prepare(
      `
    UPDATE tasks SET status = 'pending', updated_at = datetime('now')
    WHERE (display_id = ? OR id = ?) AND status = 'blocked'
  `,
    )
    .run(taskId, taskId);

  if (result.changes === 0) {
    return `❌ Task not found or not paused: ${taskId}`;
  }

  return `▶️ *Resumed:* \`${taskId}\``;
});

registerCommand("build", "logs", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /logs <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  const logs = db
    .prepare(
      `
    SELECT
      COALESCE(il.log_content, il.log_preview, s.metadata) AS content,
      COALESCE(il.completed_at, il.started_at, s.completed_at, s.started_at) AS created_at
    FROM agent_sessions s
    LEFT JOIN iteration_logs il ON il.session_id = s.id
    WHERE s.task_id = (SELECT id FROM tasks WHERE display_id = ? OR id = ?)
    ORDER BY COALESCE(il.completed_at, il.started_at, s.completed_at, s.started_at) DESC
    LIMIT 1
  `,
    )
    .get(taskId, taskId) as
    | { content: string | null; created_at: string | null }
    | undefined;

  if (!logs || !logs.content) {
    return `📝 No logs found for \`${taskId}\``;
  }

  // Truncate to fit Telegram message limit
  const normalizedContent =
    logs.content.length > 3500
      ? logs.content.slice(-3500) + "\n...(truncated)"
      : logs.content;

  return `📝 *Logs for* \`${taskId}\`\n\n\`\`\`\n${normalizedContent}\n\`\`\``;
});

// ============================================
// Validation Bot Commands
// ============================================

registerCommand("validation", "retest", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /retest <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  if (!tableExists(db, "test_results")) {
    return "⚠️ Legacy `test_results` table is not available in this schema.";
  }

  // Reset test results for this task
  const result = db
    .prepare(
      `
    UPDATE test_results SET status = 'pending'
    WHERE task_id = (SELECT id FROM tasks WHERE display_id = ? OR id = ?)
  `,
    )
    .run(taskId, taskId);

  if (result.changes === 0) {
    return `❌ No tests found for: ${taskId}`;
  }

  // Mark task for re-validation
  db.prepare(
    `
    UPDATE tasks SET needs_retest = 1
    WHERE display_id = ? OR id = ?
  `,
  ).run(taskId, taskId);

  return `🔄 *Retest queued:* \`${taskId}\`\n${result.changes} test(s) will be re-run.`;
});

registerCommand("validation", "skip", async (args) => {
  if (args.length < 2) {
    return "❌ Usage: /skip <testId> <reason>";
  }

  const testId = args[0];
  const reason = args.slice(1).join(" ");
  const db = getDb();

  if (!tableExists(db, "test_results")) {
    return "⚠️ Legacy `test_results` table is not available in this schema.";
  }

  const result = db
    .prepare(
      `
    UPDATE test_results SET status = 'skipped', skip_reason = ?
    WHERE id = ? OR test_name = ?
  `,
    )
    .run(reason, testId, testId);

  if (result.changes === 0) {
    return `❌ Test not found: ${testId}`;
  }

  return `⏭️ *Skipped:* \`${testId}\`\n*Reason:* ${reason}`;
});

registerCommand("validation", "coverage", async () => {
  const db = getDb();

  if (!tableExists(db, "test_results")) {
    return "⚠️ Legacy `test_results` table is not available in this schema.";
  }

  const stats = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
    FROM test_results
    WHERE created_at > datetime('now', '-7 days')
  `,
    )
    .get() as {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };

  const passRate =
    stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

  return `📊 *Test Coverage (7 days)*

✅ Passed: ${stats.passed}
❌ Failed: ${stats.failed}
⏭️ Skipped: ${stats.skipped}
📈 Pass Rate: ${passRate}%`;
});

// ============================================
// Clarification Bot Commands
// ============================================

registerCommand("clarification", "respond", async (args) => {
  if (args.length < 2) {
    return "❌ Usage: /respond <taskId> <answer>";
  }

  const taskId = args[0];
  const answer = args.slice(1).join(" ");
  const db = getDb();

  // Store clarification response
  const result = db
    .prepare(
      `
    UPDATE tasks SET 
      description = COALESCE(description, '') || '\n\nClarification response: ' || ?,
      updated_at = datetime('now'),
      status = CASE WHEN status = 'blocked' THEN 'pending' ELSE status END
    WHERE display_id = ? OR id = ?
  `,
    )
    .run(answer, taskId, taskId);

  if (result.changes === 0) {
    return `❌ Task not found: ${taskId}`;
  }

  return `✅ *Clarification provided for* \`${taskId}\`\n\n${answer.slice(0, 300)}`;
});

registerCommand("clarification", "newplan", async () => {
  const db = getDb();

  // Clear cached plan to force new planning
  try {
    const fs = await import("fs");
    const cachePath = "/home/ned-atanasovski/.harness/approved-plan.json";
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  } catch (e) {
    // Ignore
  }

  // Mark any pending plans as superseded
  db.prepare(
    `UPDATE plan_approvals SET status = 'superseded' WHERE status = 'pending'`,
  ).run();

  // Signal orchestrator to run planning on next tick
  db.prepare(
    `INSERT OR REPLACE INTO system_state (key, value) VALUES ('trigger_planning', 'true')`,
  ).run();

  return `🧠 *New Planning Triggered*\n\nThe orchestrator will generate a fresh strategic plan on the next tick.\n\nYou'll receive it here for approval.`;
});

registerCommand("clarification", "pending", async () => {
  const db = getDb();

  // Get pending plans
  const pending = db
    .prepare(
      `
    SELECT id, status, created_at, plan_data 
    FROM plan_approvals 
    WHERE status = 'pending'
    ORDER BY created_at DESC 
    LIMIT 5
  `,
    )
    .all() as {
    id: string;
    status: string;
    created_at: string;
    plan_data: string;
  }[];

  if (pending.length === 0) {
    // Show most recent plan instead
    const recent = db
      .prepare(
        `
      SELECT id, status, created_at, plan_data 
      FROM plan_approvals 
      ORDER BY created_at DESC 
      LIMIT 1
    `,
      )
      .get() as
      | { id: string; status: string; created_at: string; plan_data: string }
      | undefined;

    if (recent) {
      const plan = JSON.parse(recent.plan_data);
      return `📋 *No pending plans*\n\n*Most recent plan:*\nID: \`${recent.id}\`\nStatus: ${recent.status}\nPhases: ${plan.phases?.length || 0}\n\nUse /plan to see details.`;
    }
    return "📋 No plans in database.";
  }

  const lines = pending.map((p) => {
    const plan = JSON.parse(p.plan_data);
    return `• \`${p.id.slice(0, 8)}\` - ${plan.phases?.length || 0} phases`;
  });

  return `📋 *Pending Plans (${pending.length})*\n\n${lines.join("\n")}\n\nUse /approve to approve the latest, or /plan to see details.`;
});

registerCommand("clarification", "plan", async (args) => {
  const db = getDb();

  // Get specific plan or most recent
  const planId = args[0];
  const query = planId
    ? `SELECT id, status, created_at, plan_data FROM plan_approvals WHERE id LIKE ? || '%' ORDER BY created_at DESC LIMIT 1`
    : `SELECT id, status, created_at, plan_data FROM plan_approvals ORDER BY created_at DESC LIMIT 1`;

  const plan = planId
    ? (db.prepare(query).get(planId) as
        | { id: string; status: string; created_at: string; plan_data: string }
        | undefined)
    : (db.prepare(query).get() as
        | { id: string; status: string; created_at: string; plan_data: string }
        | undefined);

  if (!plan) {
    return "❌ No plan found.";
  }

  const data = JSON.parse(plan.plan_data);

  let msg = `🧠 *Strategic Plan*\n`;
  msg += `ID: \`${plan.id}\`\n`;
  msg += `Status: ${plan.status}\n\n`;

  if (data.visionSummary) {
    msg += `*Vision:*\n${data.visionSummary.slice(0, 300)}...\n\n`;
  }

  if (data.phases && data.phases.length > 0) {
    msg += `*Phases (${data.phases.length}):*\n`;
    for (let i = 0; i < Math.min(data.phases.length, 7); i++) {
      const phase = data.phases[i];
      msg += `${i + 1}. ${phase.name} [${phase.priority}]\n`;
    }
  }

  if (plan.status === "pending") {
    msg += `\n✅ /approve - Accept this plan\n❌ /reject <reason> - Reject`;
  }

  return msg;
});

registerCommand("clarification", "approve", async (args) => {
  const db = getDb();

  // Find pending plan approval
  const planId = args[0];
  const query = planId
    ? `SELECT id, plan_data, task_list_id FROM plan_approvals WHERE id LIKE ? || '%' AND status = 'pending'`
    : `SELECT id, plan_data, task_list_id FROM plan_approvals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1`;

  const pending = planId
    ? (db.prepare(query).get(planId) as
        | { id: string; plan_data: string; task_list_id: string }
        | undefined)
    : (db.prepare(query).get() as
        | { id: string; plan_data: string; task_list_id: string }
        | undefined);

  if (!pending) {
    return "❌ No pending plan to approve.\n\nUse /pending to see plans, or /plan to view the most recent.";
  }

  const plan = JSON.parse(pending.plan_data);

  // Approve the plan
  db.prepare(
    `UPDATE plan_approvals SET status = 'approved', updated_at = datetime('now') WHERE id = ?`,
  ).run(pending.id);

  // Cache the approved plan so orchestrator uses it
  try {
    const fs = await import("fs");
    const cachePath = "/home/ned-atanasovski/.harness/approved-plan.json";
    const now = new Date();
    const cached = {
      ...plan,
      createdAt: now.toISOString(),
      approvedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      taskListId: pending.task_list_id || "default-task-list",
      tacticalTasksCreated: false,
    };
    fs.writeFileSync(cachePath, JSON.stringify(cached, null, 2));
  } catch (e) {
    // Ignore cache errors
  }

  // Signal orchestrator to proceed with tactical planning
  db.prepare(
    `INSERT OR REPLACE INTO system_state (key, value) VALUES ('plan_approved', ?)`,
  ).run(pending.id);

  return `✅ *Plan Approved!*\n\nPlan ID: \`${pending.id}\`\nPhases: ${plan.phases?.length || 0}\n\nThe orchestrator will now create tasks and assign them to agents.`;
});

registerCommand("clarification", "reject", async (args) => {
  const db = getDb();
  const reason = args.join(" ") || "No reason provided";

  // Find pending plan approval
  const pending = db
    .prepare(
      `
    SELECT id FROM plan_approvals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1
  `,
    )
    .get() as { id: string } | undefined;

  if (!pending) {
    return "❌ No pending plan to reject.";
  }

  // Reject the plan
  db.prepare(
    `UPDATE plan_approvals SET status = 'rejected', feedback = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(reason, pending.id);

  return `❌ *Plan Rejected*\n\nPlan ID: \`${pending.id}\`\nReason: ${reason}`;
});

registerCommand("clarification", "skip", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /skip <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  const result = db
    .prepare(
      `
    UPDATE tasks SET 
      status = 'pending',
      updated_at = datetime('now')
    WHERE (display_id = ? OR id = ?) AND status = 'blocked'
  `,
    )
    .run(taskId, taskId);

  if (result.changes === 0) {
    return `❌ Task not found or not awaiting clarification: ${taskId}`;
  }

  return `⏭️ *Skipped clarification for* \`${taskId}\`\n\nTask moved back to pending queue.`;
});

// ============================================
// SIA/Monitor Bot Commands
// ============================================

registerCommand("sia", "agents", async () => {
  const db = getDb();

  const agents = db
    .prepare(
      `
    SELECT type, status, current_task_id,
           ROUND((julianday('now') - julianday(COALESCE(last_heartbeat, updated_at, created_at))) * 24 * 60) as minutes
    FROM agents 
    WHERE status IN ('working', 'idle')
    ORDER BY updated_at DESC
    LIMIT 15
  `,
    )
    .all() as {
    type: string;
    status: string;
    current_task_id: string | null;
    minutes: number;
  }[];

  if (agents.length === 0) {
    return "🤖 No active agents";
  }

  const lines = agents.map((a) => {
    const taskInfo = a.current_task_id
      ? ` → \`${a.current_task_id.slice(0, 12)}\``
      : "";
    return `• ${a.type} [${a.status}] ${Math.round(a.minutes)}m${taskInfo}`;
  });

  return `🤖 *Active Agents (${agents.length})*\n\n${lines.join("\n")}`;
});

registerCommand("sia", "budget", async () => {
  // Import budget module dynamically
  const { getDailyUsage, getBudgetConfig } = await import("../budget/index.js");

  const usage = getDailyUsage();
  const config = getBudgetConfig();

  const spent = usage.totalCostUsd;
  const limit = config.dailyLimitUsd;
  const percent = Math.round((spent / limit) * 100);
  const remaining = Math.max(0, limit - spent);

  const bar =
    "█".repeat(Math.min(10, Math.round(percent / 10))) +
    "░".repeat(Math.max(0, 10 - Math.round(percent / 10)));

  return `💰 *Budget Status*

[${bar}] ${percent}%

*Spent:* $${spent.toFixed(2)}
*Limit:* $${limit.toFixed(2)}
*Remaining:* $${remaining.toFixed(2)}`;
});

registerCommand("sia", "pause_all", async () => {
  const db = getDb();

  // Pause spawning by setting a flag
  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('spawning_paused', 'true')
  `,
  ).run();

  return `⏸️ *All agent spawning paused*\n\nUse /resume_all to resume.`;
});

registerCommand("sia", "resume_all", async () => {
  const db = getDb();

  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'spawning_paused'
  `,
  ).run();

  return `▶️ *Agent spawning resumed*`;
});

// Monitor bot has same commands as SIA - define them separately
// (Can't share handlers due to module structure)
registerCommand("monitor", "agents", async () => {
  const db = getDb();

  const agents = db
    .prepare(
      `
    SELECT type, status, current_task_id,
           ROUND((julianday('now') - julianday(COALESCE(last_heartbeat, updated_at, created_at))) * 24 * 60) as minutes
    FROM agents 
    WHERE status IN ('working', 'idle')
    ORDER BY updated_at DESC
    LIMIT 15
  `,
    )
    .all() as {
    type: string;
    status: string;
    current_task_id: string | null;
    minutes: number;
  }[];

  if (agents.length === 0) {
    return "🤖 No active agents";
  }

  const lines = agents.map((a) => {
    const taskInfo = a.current_task_id
      ? ` → \`${a.current_task_id.slice(0, 12)}\``
      : "";
    return `• ${a.type} [${a.status}] ${Math.round(a.minutes)}m${taskInfo}`;
  });

  return `🤖 *Active Agents (${agents.length})*\n\n${lines.join("\n")}`;
});

registerCommand("monitor", "budget", async () => {
  const { getDailyUsage, getBudgetConfig } = await import("../budget/index.js");

  const usage = getDailyUsage();
  const config = getBudgetConfig();

  const spent = usage.totalCostUsd;
  const limit = config.dailyLimitUsd;
  const percent = Math.round((spent / limit) * 100);
  const remaining = Math.max(0, limit - spent);

  const bar =
    "█".repeat(Math.min(10, Math.round(percent / 10))) +
    "░".repeat(Math.max(0, 10 - Math.round(percent / 10)));

  return `💰 *Budget Status*

[${bar}] ${percent}%

*Spent:* $${spent.toFixed(2)}
*Limit:* $${limit.toFixed(2)}
*Remaining:* $${remaining.toFixed(2)}`;
});

// ============================================
// Orchestrator Bot Commands
// ============================================

registerCommand("orchestrator", "wave", async (args) => {
  const db = getDb();

  const waveNum = args[0] ? parseInt(args[0]) : null;

  const query = waveNum
    ? `SELECT status, COUNT(*) as count FROM tasks WHERE wave_number = ? GROUP BY status`
    : `SELECT status, COUNT(*) as count FROM tasks WHERE wave_number = (SELECT MAX(wave_number) FROM tasks) GROUP BY status`;

  const stats = (
    waveNum ? db.prepare(query).all(waveNum) : db.prepare(query).all()
  ) as { status: string; count: number }[];

  const currentWave = db
    .prepare(`SELECT MAX(wave_number) as wave FROM tasks`)
    .get() as { wave: number | null };

  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    in_progress: "🔄",
    completed: "✅",
    failed: "❌",
    paused: "⏸️",
  };

  const lines = stats.map(
    (s) => `${statusEmoji[s.status] || "•"} ${s.status}: ${s.count}`,
  );

  const resolvedWave = waveNum || currentWave.wave || 0;
  return `🌊 *Wave ${resolvedWave}*\n\n${lines.join("\n")}`;
});

registerCommand("orchestrator", "spawn", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /spawn <taskId>";
  }

  const taskId = args[0];
  const db = getDb();

  const task = db
    .prepare(
      `
    SELECT id, display_id, title, status FROM tasks 
    WHERE display_id = ? OR id = ?
  `,
    )
    .get(taskId, taskId) as
    | { id: string; display_id: string; title: string; status: string }
    | undefined;

  if (!task) {
    return `❌ Task not found: ${taskId}`;
  }

  // Mark for immediate spawn
  db.prepare(
    `
    UPDATE tasks
    SET status = 'pending',
        priority = 'P0',
        assigned_agent_id = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(task.id);

  return `🚀 *Spawn queued:* \`${task.display_id}\`\n${task.title}\n\nWill spawn on next tick.`;
});

registerCommand("orchestrator", "kill", async (args) => {
  if (args.length < 1) {
    return "❌ Usage: /kill <agentId>";
  }

  const agentId = args[0];
  const db = getDb();

  const result = db
    .prepare(
      `
    UPDATE agents
    SET status = 'stopped',
        current_task_id = NULL,
        current_session_id = NULL,
        updated_at = datetime('now')
    WHERE id = ? OR current_session_id = ?
  `,
    )
    .run(agentId, agentId);

  if (result.changes === 0) {
    return `❌ Agent not found: ${agentId}`;
  }

  return `💀 *Terminated:* \`${agentId}\``;
});

// ============================================
// System Control Commands (orchestrator + sia)
// ============================================

registerCommand("orchestrator", "stop", async () => {
  const db = getDb();
  const mode = getRuntimeMode();

  // Pause orchestrator ticks
  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('orchestrator_paused', 'true')
  `,
  ).run();

  // Also pause spawning
  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('spawning_paused', 'true')
  `,
  ).run();

  return `⏹️ *Orchestrator STOPPED* (mode: ${mode})

Ticks paused. No new tasks will be assigned.
Running agents will complete their current work.

Use /start to resume.`;
});

registerCommand("orchestrator", "start", async () => {
  const db = getDb();
  const mode = getRuntimeMode();

  // Resume orchestrator ticks
  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'orchestrator_paused'
  `,
  ).run();

  // Also resume spawning
  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'spawning_paused'
  `,
  ).run();

  return `▶️ *Orchestrator STARTED* (mode: ${mode})

Ticks resumed. Tasks will be assigned on next tick.`;
});

registerCommand("orchestrator", "restart", async () => {
  // This will cause pm2 to restart the process
  setTimeout(() => {
    console.log(
      "🔄 Restart requested via Telegram - exiting for pm2 restart...",
    );
    process.exit(0);
  }, 1000);

  return `🔄 *Restarting harness...*

Process will restart in 1 second.
This clears all in-memory state.`;
});

// SIA bot also gets system control commands
registerCommand("sia", "stop", async () => {
  const db = getDb();

  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('orchestrator_paused', 'true')
  `,
  ).run();

  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('spawning_paused', 'true')
  `,
  ).run();

  return `⏹️ *Orchestrator STOPPED*

Ticks paused. No new tasks will be assigned.
Use /start to resume.`;
});

registerCommand("sia", "start", async () => {
  const db = getDb();

  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'orchestrator_paused'
  `,
  ).run();

  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'spawning_paused'
  `,
  ).run();

  return `▶️ *Orchestrator STARTED*

Ticks resumed. Tasks will be assigned on next tick.`;
});

registerCommand("sia", "restart", async () => {
  setTimeout(() => {
    console.log(
      "🔄 Restart requested via Telegram - exiting for pm2 restart...",
    );
    process.exit(0);
  }, 1000);

  return `🔄 *Restarting harness...*

Process will restart in 1 second.`;
});

// Monitor bot also gets control commands
registerCommand("monitor", "stop", async () => {
  const db = getDb();

  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('orchestrator_paused', 'true')
  `,
  ).run();

  db.prepare(
    `
    INSERT OR REPLACE INTO system_state (key, value) 
    VALUES ('spawning_paused', 'true')
  `,
  ).run();

  return `⏹️ *Orchestrator STOPPED*

Use /start to resume.`;
});

registerCommand("monitor", "start", async () => {
  const db = getDb();

  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'orchestrator_paused'
  `,
  ).run();

  db.prepare(
    `
    DELETE FROM system_state WHERE key = 'spawning_paused'
  `,
  ).run();

  return `▶️ *Orchestrator STARTED*`;
});

registerCommand("monitor", "restart", async () => {
  setTimeout(() => {
    console.log(
      "🔄 Restart requested via Telegram - exiting for pm2 restart...",
    );
    process.exit(0);
  }, 1000);

  return `🔄 *Restarting...*`;
});

console.log("📋 Telegram command handlers registered");
