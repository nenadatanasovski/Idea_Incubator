/**
 * Clarification Agent
 *
 * Handles strategic plan approval and task clarifications.
 * Implements sync loop with human via Telegram.
 */

import { query, run, getOne } from "../db/index.js";
import * as tasks from "../db/tasks.js";
import { notifyAdmin, sendToBot } from "../telegram/index.js";
import { v4 as uuidv4 } from "uuid";

// Store pending plan approvals (in-memory resolvers for async flow)
const pendingApprovals = new Map<
  string,
  {
    planId: string;
    plan: any;
    taskListId: string;
    resolve: (approved: boolean, feedback?: string) => void;
  }
>();

// Approval timeout (30 minutes)
const APPROVAL_TIMEOUT_MS = 30 * 60 * 1000;

// Ensure plan_approvals table exists for persistence
function ensurePlanApprovalsTable(): void {
  run(
    `
    CREATE TABLE IF NOT EXISTS plan_approvals (
      id TEXT PRIMARY KEY,
      plan_data TEXT NOT NULL,
      task_list_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      feedback TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    )
  `,
    [],
  );
  run(
    `CREATE INDEX IF NOT EXISTS idx_plan_approvals_status ON plan_approvals(status)`,
    [],
  );
}

ensurePlanApprovalsTable();

export interface ClarificationRequest {
  id: string;
  task_id: string;
  question: string;
  context: string | null;
  options: string | null; // JSON array of suggested options
  status: "pending" | "answered" | "expired" | "skipped";
  answer: string | null;
  answered_by: string | null;
  created_at: string;
  answered_at: string | null;
  expires_at: string | null;
}

// Ensure clarification table exists
function ensureClarificationTable(): void {
  run(
    `
    CREATE TABLE IF NOT EXISTS clarification_requests (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      question TEXT NOT NULL,
      context TEXT,
      options TEXT,
      status TEXT DEFAULT 'pending',
      answer TEXT,
      answered_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT,
      expires_at TEXT
    )
  `,
    [],
  );

  run(
    `CREATE INDEX IF NOT EXISTS idx_clarification_task ON clarification_requests(task_id)`,
    [],
  );
  run(
    `CREATE INDEX IF NOT EXISTS idx_clarification_status ON clarification_requests(status)`,
    [],
  );
}

ensureClarificationTable();

/**
 * Request clarification for a task
 */
export async function requestClarification(
  taskId: string,
  question: string,
  options?: {
    context?: string;
    suggestedOptions?: string[];
    expiresInHours?: number;
  },
): Promise<ClarificationRequest> {
  const id = uuidv4();
  const expiresAt = options?.expiresInHours
    ? new Date(
        Date.now() + options.expiresInHours * 60 * 60 * 1000,
      ).toISOString()
    : null;

  run(
    `
    INSERT INTO clarification_requests (id, task_id, question, context, options, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      taskId,
      question,
      options?.context ?? null,
      options?.suggestedOptions
        ? JSON.stringify(options.suggestedOptions)
        : null,
      expiresAt,
    ],
  );

  // Block the task until clarification is received
  tasks.updateTask(taskId, { status: "blocked" });

  // Notify via Clarification bot
  const task = tasks.getTask(taskId);
  if (task) {
    await sendToBot(
      "clarification",
      `❓ <b>Clarification Needed</b>\n\n` +
        `Task: <code>${task.display_id}</code>\n` +
        `Question: ${question}` +
        (options?.suggestedOptions
          ? `\n\nOptions:\n${options.suggestedOptions.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
          : ""),
    );
  }

  console.log(
    `❓ Clarification requested for ${task?.display_id}: ${question}`,
  );

  return getClarificationRequest(id)!;
}

/**
 * Answer a clarification request
 */
export async function answerClarification(
  requestId: string,
  answer: string,
  answeredBy?: string,
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== "pending") {
    return undefined;
  }

  run(
    `
    UPDATE clarification_requests 
    SET status = 'answered', answer = ?, answered_by = ?, answered_at = datetime('now')
    WHERE id = ?
  `,
    [answer, answeredBy ?? "human", requestId],
  );

  // Unblock the task
  tasks.updateTask(request.task_id, { status: "pending" });

  console.log(`✅ Clarification answered for request ${requestId}: ${answer}`);

  return getClarificationRequest(requestId);
}

/**
 * Skip a clarification (use default or best guess)
 */
export async function skipClarification(
  requestId: string,
  reason?: string,
): Promise<ClarificationRequest | undefined> {
  const request = getClarificationRequest(requestId);
  if (!request || request.status !== "pending") {
    return undefined;
  }

  run(
    `
    UPDATE clarification_requests 
    SET status = 'skipped', answer = ?, answered_at = datetime('now')
    WHERE id = ?
  `,
    [reason ?? "Skipped - using default", requestId],
  );

  // Unblock the task
  tasks.updateTask(request.task_id, { status: "pending" });

  return getClarificationRequest(requestId);
}

/**
 * Get a clarification request
 */
export function getClarificationRequest(
  id: string,
): ClarificationRequest | undefined {
  return getOne<ClarificationRequest>(
    "SELECT * FROM clarification_requests WHERE id = ?",
    [id],
  );
}

/**
 * Get pending clarifications
 */
export function getPendingClarifications(): ClarificationRequest[] {
  return query<ClarificationRequest>(
    "SELECT * FROM clarification_requests WHERE status = 'pending' ORDER BY created_at ASC",
  );
}

/**
 * Get clarifications for a task
 */
export function getTaskClarifications(taskId: string): ClarificationRequest[] {
  return query<ClarificationRequest>(
    "SELECT * FROM clarification_requests WHERE task_id = ? ORDER BY created_at DESC",
    [taskId],
  );
}

/**
 * Expire old clarifications
 */
export function expireOldClarifications(): number {
  const result = run(`
    UPDATE clarification_requests 
    SET status = 'expired'
    WHERE status = 'pending' 
      AND expires_at IS NOT NULL 
      AND expires_at < datetime('now')
  `);

  if (result.changes > 0) {
    console.log(`⏰ Expired ${result.changes} clarification requests`);
  }

  return result.changes;
}

/**
 * Check if task has pending clarification
 */
export function hasPendingClarification(taskId: string): boolean {
  const pending = getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM clarification_requests WHERE task_id = ? AND status = 'pending'",
    [taskId],
  );
  return (pending?.count ?? 0) > 0;
}

/**
 * Request approval for a strategic plan via Telegram
 */
export async function requestPlanApproval(
  planId: string,
  plan: {
    visionSummary: string;
    currentState: string;
    approach: string;
    phases: Array<{
      name: string;
      goal: string;
      priority: string;
      effort: string;
      dependencies: string;
      deliverables: string[];
    }>;
  },
  taskListId: string,
): Promise<{ approved: boolean; feedback?: string }> {
  // Escape special chars
  const esc = (s: string) =>
    s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");

  // Format FULL plan - sendToBot will auto-chunk if needed
  let message = `🧠 STRATEGIC PLAN REVIEW\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `📋 VISION\n${esc(plan.visionSummary)}\n\n`;

  message += `📊 CURRENT STATE\n${esc(plan.currentState)}\n\n`;

  if (plan.approach) {
    message += `🎯 APPROACH\n${esc(plan.approach)}\n\n`;
  }

  message += `📌 PHASES (${plan.phases.length})\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    message += `\n${i + 1}. ${esc(phase.name)} [${phase.priority}]\n`;
    message += `   Goal: ${esc(phase.goal)}\n`;
    message += `   Effort: ${phase.effort}\n`;
    message += `   Dependencies: ${phase.dependencies}\n`;
    if (phase.deliverables.length > 0) {
      message += `   Deliverables:\n`;
      for (const d of phase.deliverables) {
        message += `   • ${esc(d)}\n`;
      }
    }
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Reply with:\n`;
  message += `✅ /approve - Accept plan and start execution\n`;
  message += `📝 /feedback <text> - Request changes\n`;
  message += `❌ /reject - Cancel planning\n`;
  message += `\nPlan ID: ${planId}`;

  console.log(
    `📨 Sending strategic plan (${message.length} chars) to clarification bot...`,
  );

  // Send to clarification bot
  const sent = await sendToBot("clarification", message);
  if (!sent) {
    console.warn("⚠️ Failed to send to clarification bot, trying admin...");
    await notifyAdmin(message);
  }

  console.log(`📨 Sent strategic plan for approval (ID: ${planId})`);

  // Persist to database for restart recovery
  const expiresAt = new Date(Date.now() + APPROVAL_TIMEOUT_MS).toISOString();
  run(
    `
    INSERT OR REPLACE INTO plan_approvals (id, plan_data, task_list_id, status, expires_at)
    VALUES (?, ?, ?, 'pending', ?)
  `,
    [planId, JSON.stringify(plan), taskListId, expiresAt],
  );

  // Wait for response with timeout
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingApprovals.delete(planId);
      run(
        `UPDATE plan_approvals SET status = 'expired', updated_at = datetime('now') WHERE id = ?`,
        [planId],
      );
      console.log(`⏰ Plan approval timed out: ${planId}`);
      resolve({
        approved: false,
        feedback: "Approval timed out after 30 minutes",
      });
    }, APPROVAL_TIMEOUT_MS);

    pendingApprovals.set(planId, {
      planId,
      plan,
      taskListId,
      resolve: (approved: boolean, feedback?: string) => {
        clearTimeout(timeoutId);
        pendingApprovals.delete(planId);
        // Update DB status
        run(
          `UPDATE plan_approvals SET status = ?, feedback = ?, updated_at = datetime('now') WHERE id = ?`,
          [approved ? "approved" : "rejected", feedback || null, planId],
        );
        resolve({ approved, feedback });
      },
    });
  });
}

/**
 * Handle approval response from Telegram
 */
export function handleApprovalResponse(
  command: string,
  args: string,
  chatId: string,
): { handled: boolean; message?: string } {
  // Check for pending approvals
  if (pendingApprovals.size === 0) {
    return { handled: false };
  }

  // Get most recent pending approval
  const [planId, pending] = [...pendingApprovals.entries()][0];

  if (command === "/approve") {
    console.log(`✅ Plan approved: ${planId}`);
    pending.resolve(true);
    return {
      handled: true,
      message: `✅ Plan approved! Starting task decomposition...`,
    };
  }

  if (command === "/feedback") {
    console.log(`📝 Plan feedback received: ${planId}`);
    pending.resolve(false, args || "Feedback requested");
    return {
      handled: true,
      message: `📝 Feedback received. Revising plan...`,
    };
  }

  if (command === "/reject") {
    console.log(`❌ Plan rejected: ${planId}`);
    pending.resolve(false, "Plan rejected");
    return {
      handled: true,
      message: `❌ Plan rejected. Planning cancelled.`,
    };
  }

  return { handled: false };
}

/**
 * Check if there's a pending approval (in-memory or DB)
 */
export function hasPendingApproval(): boolean {
  if (pendingApprovals.size > 0) return true;
  // Also check DB for pending approvals not yet expired
  const dbPending = getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM plan_approvals WHERE status = 'pending' AND expires_at > datetime('now')",
  );
  return (dbPending?.count ?? 0) > 0;
}

/**
 * Get pending approval details (in-memory first, then DB)
 */
export function getPendingApproval(): {
  planId: string;
  plan: any;
  taskListId: string;
} | null {
  // Check in-memory first
  if (pendingApprovals.size > 0) {
    const [, pending] = [...pendingApprovals.entries()][0];
    return {
      planId: pending.planId,
      plan: pending.plan,
      taskListId: pending.taskListId,
    };
  }
  // Check DB for pending approvals
  const dbPending = getOne<{
    id: string;
    plan_data: string;
    task_list_id: string;
  }>(
    "SELECT id, plan_data, task_list_id FROM plan_approvals WHERE status = 'pending' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
  );
  if (dbPending) {
    return {
      planId: dbPending.id,
      plan: JSON.parse(dbPending.plan_data),
      taskListId: dbPending.task_list_id,
    };
  }
  return null;
}

/**
 * Approve a pending plan directly (for API calls after restart)
 */
export function approvePendingPlan(planId?: string): {
  approved: boolean;
  plan?: any;
  taskListId?: string;
} {
  // If in-memory resolver exists, use it
  if (pendingApprovals.size > 0) {
    const [id, pending] = [...pendingApprovals.entries()][0];
    console.log(`✅ Plan approved (in-memory): ${id}`);
    pending.resolve(true);
    return {
      approved: true,
      plan: pending.plan,
      taskListId: pending.taskListId,
    };
  }

  // Otherwise, check DB and mark as approved
  const targetId = planId;
  const dbPending = targetId
    ? getOne<{ id: string; plan_data: string; task_list_id: string }>(
        "SELECT id, plan_data, task_list_id FROM plan_approvals WHERE id = ? AND status = 'pending'",
        [targetId],
      )
    : getOne<{ id: string; plan_data: string; task_list_id: string }>(
        "SELECT id, plan_data, task_list_id FROM plan_approvals WHERE status = 'pending' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
      );

  if (dbPending) {
    run(
      `UPDATE plan_approvals SET status = 'approved', updated_at = datetime('now') WHERE id = ?`,
      [dbPending.id],
    );
    console.log(`✅ Plan approved (from DB): ${dbPending.id}`);
    return {
      approved: true,
      plan: JSON.parse(dbPending.plan_data),
      taskListId: dbPending.task_list_id,
    };
  }

  return { approved: false };
}

export default {
  requestClarification,
  answerClarification,
  skipClarification,
  getClarificationRequest,
  getPendingClarifications,
  getTaskClarifications,
  expireOldClarifications,
  hasPendingClarification,
  requestPlanApproval,
  handleApprovalResponse,
  hasPendingApproval,
  getPendingApproval,
  approvePendingPlan,
};
