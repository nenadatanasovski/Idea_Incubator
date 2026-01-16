// server/communication/execution-gate.ts
// COM-011: Execution Gate - Controls whether agents can proceed

import { EventEmitter } from "events";
import { AgentType } from "./types";
import { AnswerProcessor, ProcessedAnswer } from "./answer-processor";

interface Database {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export type GateStatus = "open" | "blocked" | "halted" | "error";

export interface GateState {
  agentId: string;
  agentType: AgentType;
  status: GateStatus;
  reason?: string;
  blockedBy?: string[]; // Question IDs blocking this agent
  blockedSince?: Date;
  haltedSince?: Date;
  lastCheckedAt: Date;
}

export interface GateCheckResult {
  canProceed: boolean;
  status: GateStatus;
  reason?: string;
  waitingFor?: string[];
  estimatedWaitMs?: number;
}

export interface ExecutionGateConfig {
  maxBlockDurationMs: number;
  autoHaltOnTimeout: boolean;
  checkIntervalMs: number;
}

const DEFAULT_CONFIG: ExecutionGateConfig = {
  maxBlockDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  autoHaltOnTimeout: true,
  checkIntervalMs: 10 * 1000, // 10 seconds
};

export class ExecutionGate extends EventEmitter {
  private db: Database;
  private answerProcessor: AnswerProcessor;
  private config: ExecutionGateConfig;
  private gateStates: Map<string, GateState> = new Map();
  private globalHalt: boolean = false;
  private globalHaltReason?: string;
  private checkInterval?: ReturnType<typeof setInterval>;

  constructor(
    db: Database,
    answerProcessor: AnswerProcessor,
    config: Partial<ExecutionGateConfig> = {},
  ) {
    super();
    this.db = db;
    this.answerProcessor = answerProcessor;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Listen for answers to unblock agents
    this.answerProcessor.on(
      "agent:unblocked",
      (data: {
        agentId: string;
        agentType: AgentType;
        answer: ProcessedAnswer;
      }) => {
        this.handleUnblock(data.agentId, data.answer);
      },
    );
  }

  /**
   * Start the execution gate (monitoring).
   */
  async start(): Promise<void> {
    // Load existing gate states
    await this.loadGateStates();

    // Start periodic check
    this.checkInterval = setInterval(() => {
      this.checkBlockTimeouts();
    }, this.config.checkIntervalMs);

    console.log(
      `[ExecutionGate] Started with ${this.gateStates.size} tracked agents`,
    );
  }

  /**
   * Stop the execution gate.
   */
  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log("[ExecutionGate] Stopped");
  }

  /**
   * Check if an agent can proceed with execution.
   */
  checkGate(agentId: string): GateCheckResult {
    // Check global halt
    if (this.globalHalt) {
      return {
        canProceed: false,
        status: "halted",
        reason: this.globalHaltReason || "System halted",
      };
    }

    // Get current state
    const state = this.gateStates.get(agentId);

    if (!state) {
      return { canProceed: true, status: "open" };
    }

    // Update last checked
    state.lastCheckedAt = new Date();

    if (state.status === "open") {
      return { canProceed: true, status: "open" };
    }

    if (state.status === "halted") {
      return {
        canProceed: false,
        status: "halted",
        reason: state.reason,
      };
    }

    if (state.status === "blocked") {
      // Check if still blocked
      const pendingQuestions = this.answerProcessor
        .getPendingQuestionsForAgent(agentId)
        .filter((q) => q.blocking);

      if (pendingQuestions.length === 0) {
        // No longer blocked
        state.status = "open";
        state.blockedBy = undefined;
        state.blockedSince = undefined;
        this.updateStateInDb(state);

        return { canProceed: true, status: "open" };
      }

      return {
        canProceed: false,
        status: "blocked",
        reason: `Waiting for ${pendingQuestions.length} question(s)`,
        waitingFor: pendingQuestions.map((q) => q.id),
      };
    }

    if (state.status === "error") {
      return {
        canProceed: false,
        status: "error",
        reason: state.reason,
      };
    }

    return { canProceed: true, status: "open" };
  }

  /**
   * Block an agent's execution.
   */
  async blockAgent(
    agentId: string,
    agentType: AgentType,
    reason: string,
    questionIds: string[],
  ): Promise<void> {
    const now = new Date();

    const state: GateState = {
      agentId,
      agentType,
      status: "blocked",
      reason,
      blockedBy: questionIds,
      blockedSince: now,
      lastCheckedAt: now,
    };

    this.gateStates.set(agentId, state);
    await this.updateStateInDb(state);

    this.emit("agent:blocked", { agentId, agentType, reason, questionIds });
    console.log(`[ExecutionGate] Blocked agent ${agentId}: ${reason}`);
  }

  /**
   * Unblock an agent.
   */
  async unblockAgent(agentId: string): Promise<void> {
    const state = this.gateStates.get(agentId);

    if (!state || state.status === "open") {
      return;
    }

    const previousStatus = state.status;
    state.status = "open";
    state.blockedBy = undefined;
    state.blockedSince = undefined;
    state.reason = undefined;
    state.lastCheckedAt = new Date();

    await this.updateStateInDb(state);

    this.emit("agent:unblocked", {
      agentId,
      agentType: state.agentType,
      previousStatus,
    });
    console.log(`[ExecutionGate] Unblocked agent ${agentId}`);
  }

  /**
   * Halt an agent (more severe than block).
   */
  async haltAgent(
    agentId: string,
    agentType: AgentType,
    reason: string,
  ): Promise<void> {
    const now = new Date();

    const state: GateState = {
      agentId,
      agentType,
      status: "halted",
      reason,
      haltedSince: now,
      lastCheckedAt: now,
    };

    this.gateStates.set(agentId, state);
    await this.updateStateInDb(state);

    this.emit("agent:halted", { agentId, agentType, reason });
    console.log(`[ExecutionGate] Halted agent ${agentId}: ${reason}`);
  }

  /**
   * Resume a halted agent.
   */
  async resumeAgent(agentId: string): Promise<void> {
    const state = this.gateStates.get(agentId);

    if (!state || state.status !== "halted") {
      return;
    }

    state.status = "open";
    state.haltedSince = undefined;
    state.reason = undefined;
    state.lastCheckedAt = new Date();

    await this.updateStateInDb(state);

    this.emit("agent:resumed", { agentId, agentType: state.agentType });
    console.log(`[ExecutionGate] Resumed agent ${agentId}`);
  }

  /**
   * Set an agent to error state.
   */
  async setAgentError(
    agentId: string,
    agentType: AgentType,
    error: string,
  ): Promise<void> {
    const now = new Date();

    const state: GateState = {
      agentId,
      agentType,
      status: "error",
      reason: error,
      lastCheckedAt: now,
    };

    this.gateStates.set(agentId, state);
    await this.updateStateInDb(state);

    this.emit("agent:error", { agentId, agentType, error });
    console.log(`[ExecutionGate] Error state for ${agentId}: ${error}`);
  }

  /**
   * Clear error state for an agent.
   */
  async clearAgentError(agentId: string): Promise<void> {
    const state = this.gateStates.get(agentId);

    if (!state || state.status !== "error") {
      return;
    }

    state.status = "open";
    state.reason = undefined;
    state.lastCheckedAt = new Date();

    await this.updateStateInDb(state);

    this.emit("agent:error_cleared", { agentId, agentType: state.agentType });
  }

  /**
   * Global halt - stops all agents.
   */
  async globalHaltAll(reason: string): Promise<void> {
    this.globalHalt = true;
    this.globalHaltReason = reason;

    this.emit("global:halt", { reason });
    console.log(`[ExecutionGate] GLOBAL HALT: ${reason}`);
  }

  /**
   * Resume from global halt.
   */
  async globalResume(): Promise<void> {
    this.globalHalt = false;
    this.globalHaltReason = undefined;

    this.emit("global:resume");
    console.log("[ExecutionGate] Global resume");
  }

  /**
   * Check if system is globally halted.
   */
  isGloballyHalted(): boolean {
    return this.globalHalt;
  }

  /**
   * Get all blocked agents.
   */
  getBlockedAgents(): GateState[] {
    const blocked: GateState[] = [];
    for (const state of this.gateStates.values()) {
      if (state.status === "blocked") {
        blocked.push(state);
      }
    }
    return blocked;
  }

  /**
   * Get all halted agents.
   */
  getHaltedAgents(): GateState[] {
    const halted: GateState[] = [];
    for (const state of this.gateStates.values()) {
      if (state.status === "halted") {
        halted.push(state);
      }
    }
    return halted;
  }

  /**
   * Get gate state for an agent.
   */
  getGateState(agentId: string): GateState | null {
    return this.gateStates.get(agentId) || null;
  }

  /**
   * Handle answer unblocking an agent.
   */
  private async handleUnblock(
    agentId: string,
    _answer: ProcessedAnswer,
  ): Promise<void> {
    // Check if agent still has other blocking questions
    const pendingBlocking = this.answerProcessor
      .getPendingQuestionsForAgent(agentId)
      .filter((q) => q.blocking);

    if (pendingBlocking.length === 0) {
      await this.unblockAgent(agentId);
    } else {
      // Still blocked by other questions
      const state = this.gateStates.get(agentId);
      if (state) {
        state.blockedBy = pendingBlocking.map((q) => q.id);
        await this.updateStateInDb(state);
      }
    }
  }

  /**
   * Check for block timeouts and auto-halt if configured.
   */
  private async checkBlockTimeouts(): Promise<void> {
    const now = new Date();

    for (const state of this.gateStates.values()) {
      if (state.status !== "blocked" || !state.blockedSince) {
        continue;
      }

      const blockedDuration = now.getTime() - state.blockedSince.getTime();

      if (blockedDuration > this.config.maxBlockDurationMs) {
        if (this.config.autoHaltOnTimeout) {
          console.log(
            `[ExecutionGate] Block timeout for ${state.agentId}, halting`,
          );
          await this.haltAgent(
            state.agentId,
            state.agentType,
            `Block timeout after ${Math.round(blockedDuration / 1000 / 60)} minutes`,
          );
        }

        this.emit("block:timeout", {
          agentId: state.agentId,
          duration: blockedDuration,
        });
      }
    }
  }

  /**
   * Load gate states from database.
   */
  private async loadGateStates(): Promise<void> {
    const rows = await this.db.all<{
      agent_id: string;
      agent_type: string;
      status: string;
      reason: string | null;
      blocked_by: string | null;
      blocked_since: string | null;
      halted_since: string | null;
      last_checked_at: string;
    }>("SELECT * FROM agent_states WHERE status != ?", ["open"]);

    for (const row of rows) {
      const state: GateState = {
        agentId: row.agent_id,
        agentType: row.agent_type as AgentType,
        status: row.status as GateStatus,
        reason: row.reason ?? undefined,
        blockedBy: row.blocked_by ? JSON.parse(row.blocked_by) : undefined,
        blockedSince: row.blocked_since
          ? new Date(row.blocked_since)
          : undefined,
        haltedSince: row.halted_since ? new Date(row.halted_since) : undefined,
        lastCheckedAt: new Date(row.last_checked_at),
      };

      this.gateStates.set(state.agentId, state);
    }
  }

  /**
   * Update gate state in database.
   */
  private async updateStateInDb(state: GateState): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO agent_states (agent_id, agent_type, status, reason, blocked_by, blocked_since, halted_since, last_checked_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id) DO UPDATE SET
         status = excluded.status,
         reason = excluded.reason,
         blocked_by = excluded.blocked_by,
         blocked_since = excluded.blocked_since,
         halted_since = excluded.halted_since,
         last_checked_at = excluded.last_checked_at,
         updated_at = excluded.updated_at`,
      [
        state.agentId,
        state.agentType,
        state.status,
        state.reason ?? null,
        state.blockedBy ? JSON.stringify(state.blockedBy) : null,
        state.blockedSince?.toISOString() ?? null,
        state.haltedSince?.toISOString() ?? null,
        state.lastCheckedAt.toISOString(),
        now,
      ],
    );
  }
}
