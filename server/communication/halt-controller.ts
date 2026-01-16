// server/communication/halt-controller.ts
// COM-012: Halt Behavior Controller - Manages halted agent behavior

import { EventEmitter } from "events";
import { AgentType } from "./types";
import { ExecutionGate } from "./execution-gate";
import { NotificationDispatcher } from "./notification-dispatcher";
import { v4 as uuid } from "uuid";

interface Database {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export type HaltReason =
  | "user_requested"
  | "question_timeout"
  | "approval_denied"
  | "error_threshold"
  | "budget_exceeded"
  | "dependency_failed"
  | "safety_concern"
  | "manual_intervention";

export interface HaltEvent {
  id: string;
  agentId: string;
  agentType: AgentType;
  reason: HaltReason;
  details: string;
  context?: Record<string, unknown>;
  haltedAt: Date;
  resumedAt?: Date;
  resumedBy?: string;
}

export interface HaltPolicy {
  agentType: AgentType;
  reason: HaltReason;
  autoResume: boolean;
  autoResumeDelayMs?: number;
  requireApproval: boolean;
  notifyOnHalt: boolean;
  escalateAfterMs?: number;
}

export interface HaltControllerConfig {
  defaultAutoResume: boolean;
  defaultAutoResumeDelayMs: number;
  maxHaltDurationMs: number;
  notifyOnAllHalts: boolean;
}

const DEFAULT_CONFIG: HaltControllerConfig = {
  defaultAutoResume: false,
  defaultAutoResumeDelayMs: 30 * 60 * 1000, // 30 minutes
  maxHaltDurationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  notifyOnAllHalts: true,
};

const DEFAULT_POLICIES: HaltPolicy[] = [
  {
    agentType: "monitoring",
    reason: "error_threshold",
    autoResume: true,
    autoResumeDelayMs: 5 * 60 * 1000,
    requireApproval: false,
    notifyOnHalt: true,
  },
  {
    agentType: "monitoring",
    reason: "question_timeout",
    autoResume: true,
    autoResumeDelayMs: 60 * 60 * 1000,
    requireApproval: false,
    notifyOnHalt: true,
  },
  {
    agentType: "orchestrator",
    reason: "safety_concern",
    autoResume: false,
    requireApproval: true,
    notifyOnHalt: true,
    escalateAfterMs: 15 * 60 * 1000,
  },
  {
    agentType: "build",
    reason: "budget_exceeded",
    autoResume: false,
    requireApproval: true,
    notifyOnHalt: true,
  },
  {
    agentType: "validation",
    reason: "dependency_failed",
    autoResume: true,
    autoResumeDelayMs: 5 * 60 * 1000,
    requireApproval: false,
    notifyOnHalt: true,
  },
];

export class HaltController extends EventEmitter {
  private db: Database;
  private executionGate: ExecutionGate;
  private notificationDispatcher: NotificationDispatcher;
  private config: HaltControllerConfig;
  private policies: Map<string, HaltPolicy> = new Map();
  private activeHalts: Map<string, HaltEvent> = new Map();
  private autoResumeTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private escalationTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  constructor(
    db: Database,
    executionGate: ExecutionGate,
    notificationDispatcher: NotificationDispatcher,
    config: Partial<HaltControllerConfig> = {},
  ) {
    super();
    this.db = db;
    this.executionGate = executionGate;
    this.notificationDispatcher = notificationDispatcher;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Load default policies
    for (const policy of DEFAULT_POLICIES) {
      const key = `${policy.agentType}:${policy.reason}`;
      this.policies.set(key, policy);
    }
  }

  /**
   * Start the halt controller.
   */
  async start(): Promise<void> {
    // Load active halts from database
    await this.loadActiveHalts();

    // Set up listeners
    this.executionGate.on(
      "agent:halted",
      (data: { agentId: string; agentType: AgentType; reason: string }) => {
        // External halt - record it
        this.recordExternalHalt(data.agentId, data.agentType, data.reason);
      },
    );

    console.log(
      `[HaltController] Started with ${this.activeHalts.size} active halts`,
    );
  }

  /**
   * Stop the halt controller.
   */
  async stop(): Promise<void> {
    // Clear all timers
    for (const timer of this.autoResumeTimers.values()) {
      clearTimeout(timer);
    }
    this.autoResumeTimers.clear();

    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();

    console.log("[HaltController] Stopped");
  }

  /**
   * Halt an agent with policy-based behavior.
   */
  async haltAgent(
    agentId: string,
    agentType: AgentType,
    reason: HaltReason,
    details: string,
    context?: Record<string, unknown>,
  ): Promise<HaltEvent> {
    const haltEvent: HaltEvent = {
      id: uuid(),
      agentId,
      agentType,
      reason,
      details,
      context,
      haltedAt: new Date(),
    };

    // Store halt event
    this.activeHalts.set(agentId, haltEvent);
    await this.storeHaltEvent(haltEvent);

    // Halt via execution gate
    await this.executionGate.haltAgent(agentId, agentType, details);

    // Get policy
    const policy = this.getPolicy(agentType, reason);

    // Send notification if required
    if (policy?.notifyOnHalt || this.config.notifyOnAllHalts) {
      await this.sendHaltNotification(haltEvent, policy);
    }

    // Schedule auto-resume if configured
    if (policy?.autoResume) {
      const delay =
        policy.autoResumeDelayMs || this.config.defaultAutoResumeDelayMs;
      this.scheduleAutoResume(agentId, delay);
    }

    // Schedule escalation if configured
    if (policy?.escalateAfterMs) {
      this.scheduleEscalation(haltEvent, policy.escalateAfterMs);
    }

    this.emit("halt:created", haltEvent);
    console.log(`[HaltController] Halted ${agentId} (${reason}): ${details}`);

    return haltEvent;
  }

  /**
   * Resume a halted agent.
   */
  async resumeAgent(
    agentId: string,
    resumedBy: string = "system",
  ): Promise<boolean> {
    const haltEvent = this.activeHalts.get(agentId);

    if (!haltEvent) {
      console.warn(`[HaltController] No active halt for ${agentId}`);
      return false;
    }

    // Check if approval is required
    const policy = this.getPolicy(haltEvent.agentType, haltEvent.reason);
    if (policy?.requireApproval && resumedBy === "system") {
      console.log(`[HaltController] Resume requires approval for ${agentId}`);
      return false;
    }

    // Cancel any timers
    this.cancelTimers(agentId);

    // Update halt event
    haltEvent.resumedAt = new Date();
    haltEvent.resumedBy = resumedBy;
    await this.updateHaltEvent(haltEvent);

    // Remove from active halts
    this.activeHalts.delete(agentId);

    // Resume via execution gate
    await this.executionGate.resumeAgent(agentId);

    // Send notification
    await this.sendResumeNotification(haltEvent, resumedBy);

    this.emit("halt:resumed", haltEvent);
    console.log(`[HaltController] Resumed ${agentId} by ${resumedBy}`);

    return true;
  }

  /**
   * Request approval to resume a halted agent.
   */
  async requestResumeApproval(agentId: string): Promise<string> {
    const haltEvent = this.activeHalts.get(agentId);

    if (!haltEvent) {
      throw new Error(`No active halt for ${agentId}`);
    }

    const approvalId = uuid();

    await this.notificationDispatcher.dispatch({
      id: uuid(),
      agentType: haltEvent.agentType,
      category: "approval_needed",
      severity: "warning",
      title: `Resume Agent: ${agentId}`,
      message: `Agent ${agentId} is halted due to: ${haltEvent.reason}\n\n${haltEvent.details}\n\nApprove to resume execution.`,
      data: {
        approvalId,
        agentId,
        haltEventId: haltEvent.id,
      },
    });

    return approvalId;
  }

  /**
   * Get current halt status for an agent.
   */
  getHaltStatus(agentId: string): HaltEvent | null {
    return this.activeHalts.get(agentId) || null;
  }

  /**
   * Get all active halts.
   */
  getAllActiveHalts(): HaltEvent[] {
    return Array.from(this.activeHalts.values());
  }

  /**
   * Get halts by agent type.
   */
  getHaltsByAgentType(agentType: AgentType): HaltEvent[] {
    return Array.from(this.activeHalts.values()).filter(
      (h) => h.agentType === agentType,
    );
  }

  /**
   * Check if an agent is halted.
   */
  isHalted(agentId: string): boolean {
    return this.activeHalts.has(agentId);
  }

  /**
   * Set a custom policy.
   */
  setPolicy(policy: HaltPolicy): void {
    const key = `${policy.agentType}:${policy.reason}`;
    this.policies.set(key, policy);
  }

  /**
   * Get policy for agent type and reason.
   */
  private getPolicy(
    agentType: AgentType,
    reason: HaltReason,
  ): HaltPolicy | null {
    // Try specific policy
    const specificKey = `${agentType}:${reason}`;
    if (this.policies.has(specificKey)) {
      return this.policies.get(specificKey)!;
    }

    // Try wildcard agent type
    const wildcardKey = `*:${reason}`;
    if (this.policies.has(wildcardKey)) {
      return this.policies.get(wildcardKey)!;
    }

    return null;
  }

  /**
   * Schedule auto-resume for an agent.
   */
  private scheduleAutoResume(agentId: string, delayMs: number): void {
    const timer = setTimeout(async () => {
      this.autoResumeTimers.delete(agentId);
      console.log(`[HaltController] Auto-resuming ${agentId}`);
      await this.resumeAgent(agentId, "auto_resume");
    }, delayMs);

    this.autoResumeTimers.set(agentId, timer);
    console.log(
      `[HaltController] Scheduled auto-resume for ${agentId} in ${delayMs}ms`,
    );
  }

  /**
   * Schedule escalation for a halt.
   */
  private scheduleEscalation(haltEvent: HaltEvent, delayMs: number): void {
    const timer = setTimeout(async () => {
      this.escalationTimers.delete(haltEvent.agentId);

      // Check if still halted
      if (!this.activeHalts.has(haltEvent.agentId)) {
        return;
      }

      console.log(`[HaltController] Escalating halt for ${haltEvent.agentId}`);

      await this.notificationDispatcher.dispatch({
        id: uuid(),
        agentType: haltEvent.agentType,
        category: "approval_needed",
        severity: "critical",
        title: `[ESCALATED] Agent Halted: ${haltEvent.agentId}`,
        message: `Agent has been halted for over ${Math.round(delayMs / 1000 / 60)} minutes!\n\nReason: ${haltEvent.reason}\n${haltEvent.details}`,
        data: {
          haltEventId: haltEvent.id,
          agentId: haltEvent.agentId,
          escalated: true,
        },
        channel: "both",
      });

      this.emit("halt:escalated", haltEvent);
    }, delayMs);

    this.escalationTimers.set(haltEvent.agentId, timer);
  }

  /**
   * Cancel all timers for an agent.
   */
  private cancelTimers(agentId: string): void {
    const autoResumeTimer = this.autoResumeTimers.get(agentId);
    if (autoResumeTimer) {
      clearTimeout(autoResumeTimer);
      this.autoResumeTimers.delete(agentId);
    }

    const escalationTimer = this.escalationTimers.get(agentId);
    if (escalationTimer) {
      clearTimeout(escalationTimer);
      this.escalationTimers.delete(agentId);
    }
  }

  /**
   * Send halt notification.
   */
  private async sendHaltNotification(
    haltEvent: HaltEvent,
    policy: HaltPolicy | null,
  ): Promise<void> {
    const severity = policy?.requireApproval ? "warning" : "info";

    let message = `Reason: ${haltEvent.reason}\n\n${haltEvent.details}`;

    if (policy?.autoResume) {
      const delay =
        policy.autoResumeDelayMs || this.config.defaultAutoResumeDelayMs;
      message += `\n\nWill auto-resume in ${Math.round(delay / 1000 / 60)} minutes.`;
    } else if (policy?.requireApproval) {
      message += "\n\nApproval required to resume.";
    }

    await this.notificationDispatcher.dispatch({
      id: uuid(),
      agentType: haltEvent.agentType,
      category: "agent_status",
      severity,
      title: `Agent Halted: ${haltEvent.agentId}`,
      message,
      data: {
        haltEventId: haltEvent.id,
        agentId: haltEvent.agentId,
        reason: haltEvent.reason,
      },
    });
  }

  /**
   * Send resume notification.
   */
  private async sendResumeNotification(
    haltEvent: HaltEvent,
    resumedBy: string,
  ): Promise<void> {
    await this.notificationDispatcher.dispatch({
      id: uuid(),
      agentType: haltEvent.agentType,
      category: "agent_status",
      severity: "info",
      title: `Agent Resumed: ${haltEvent.agentId}`,
      message: `Agent resumed by ${resumedBy}.\n\nOriginal halt reason: ${haltEvent.reason}`,
      data: {
        haltEventId: haltEvent.id,
        agentId: haltEvent.agentId,
        resumedBy,
      },
    });
  }

  /**
   * Record an external halt (from execution gate).
   */
  private async recordExternalHalt(
    agentId: string,
    agentType: AgentType,
    reason: string,
  ): Promise<void> {
    if (this.activeHalts.has(agentId)) {
      return; // Already tracking
    }

    const haltEvent: HaltEvent = {
      id: uuid(),
      agentId,
      agentType,
      reason: "manual_intervention" as HaltReason,
      details: reason,
      haltedAt: new Date(),
    };

    this.activeHalts.set(agentId, haltEvent);
    await this.storeHaltEvent(haltEvent);
  }

  /**
   * Load active halts from database.
   */
  private async loadActiveHalts(): Promise<void> {
    const rows = await this.db.all<{
      id: string;
      agent_id: string;
      agent_type: string;
      reason: string;
      details: string;
      context: string | null;
      halted_at: string;
    }>(
      "SELECT * FROM activity_log WHERE action_type = ? AND (context IS NULL OR JSON_EXTRACT(context, '$.resumed') IS NULL)",
      ["halt"],
    );

    for (const row of rows) {
      const haltEvent: HaltEvent = {
        id: row.id,
        agentId: row.agent_id,
        agentType: row.agent_type as AgentType,
        reason: row.reason as HaltReason,
        details: row.details,
        context: row.context ? JSON.parse(row.context) : undefined,
        haltedAt: new Date(row.halted_at),
      };

      this.activeHalts.set(haltEvent.agentId, haltEvent);
    }
  }

  /**
   * Store halt event in database.
   */
  private async storeHaltEvent(event: HaltEvent): Promise<void> {
    await this.db.run(
      `INSERT INTO activity_log (id, agent_id, agent_type, action_type, reason, details, context, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.agentId,
        event.agentType,
        "halt",
        event.reason,
        event.details,
        event.context ? JSON.stringify(event.context) : null,
        event.haltedAt.toISOString(),
      ],
    );
  }

  /**
   * Update halt event in database.
   */
  private async updateHaltEvent(event: HaltEvent): Promise<void> {
    const context = {
      ...event.context,
      resumed: true,
      resumedAt: event.resumedAt?.toISOString(),
      resumedBy: event.resumedBy,
    };

    await this.db.run("UPDATE activity_log SET context = ? WHERE id = ?", [
      JSON.stringify(context),
      event.id,
    ]);
  }
}
