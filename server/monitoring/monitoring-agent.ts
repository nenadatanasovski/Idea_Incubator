// server/monitoring/monitoring-agent.ts
// MON-001: Monitoring Agent Core Architecture
// The "System Soul" - watches all agents and system health

import { EventEmitter } from "events";
import {
  emitAgentEvent,
  emitSystemHealth,
  emitSystemAlert,
  AgentEventType,
} from "../websocket";

interface Database {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export type MonitoringLevel = "minimal" | "standard" | "verbose" | "debug";

export interface AgentState {
  agentId: string;
  agentType: string;
  status: "idle" | "working" | "blocked" | "error" | "halted";
  sessionId?: string;
  currentTask?: string;
  lastHeartbeat: Date;
  lastActivity: Date;
  blockedBy?: string[]; // Question IDs
  errorMessage?: string;
  metrics: {
    questionsAsked: number;
    questionsAnswered: number;
    tasksCompleted: number;
    errorsEncountered: number;
    totalRuntime: number; // ms
  };
}

export interface SystemMetrics {
  activeAgents: number;
  blockedAgents: number;
  pendingQuestions: number;
  questionsAnsweredToday: number;
  averageResponseTime: number; // ms
  systemUptime: number; // ms
  lastHealthCheck: Date;
}

export interface DetectedIssue {
  id: string;
  type: "timeout" | "error" | "drift" | "anomaly" | "threshold";
  severity: "low" | "medium" | "high" | "critical";
  agentId?: string;
  sessionId?: string;
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface MonitoringConfig {
  level: MonitoringLevel;
  heartbeatIntervalMs: number;
  healthCheckIntervalMs: number;
  agentTimeoutMs: number;
  maxBlockDurationMs: number;
  alertThresholds: {
    pendingQuestions: number;
    blockedAgents: number;
    errorRate: number; // percentage
    responseTimeMs: number;
  };
}

const DEFAULT_CONFIG: MonitoringConfig = {
  level: "standard",
  heartbeatIntervalMs: 30 * 1000, // 30 seconds
  healthCheckIntervalMs: 60 * 1000, // 1 minute
  agentTimeoutMs: 5 * 60 * 1000, // 5 minutes
  maxBlockDurationMs: 24 * 60 * 60 * 1000, // 24 hours
  alertThresholds: {
    pendingQuestions: 10,
    blockedAgents: 3,
    errorRate: 10, // 10%
    responseTimeMs: 60 * 1000, // 1 minute
  },
};

export class MonitoringAgent extends EventEmitter {
  private db: Database;
  private config: MonitoringConfig;
  private agentStates: Map<string, AgentState> = new Map();
  private detectedIssues: Map<string, DetectedIssue> = new Map();
  private systemMetrics: SystemMetrics;
  private startTime: Date;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private running: boolean = false;

  constructor(db: Database, config: Partial<MonitoringConfig> = {}) {
    super();
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = new Date();
    this.systemMetrics = {
      activeAgents: 0,
      blockedAgents: 0,
      pendingQuestions: 0,
      questionsAnsweredToday: 0,
      averageResponseTime: 0,
      systemUptime: 0,
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Start the monitoring agent
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[MonitoringAgent] Already running");
      return;
    }

    this.running = true;
    this.startTime = new Date();

    // Load existing agent states from DB
    await this.loadAgentStates();

    // Start periodic health checks
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckIntervalMs,
    );

    // Start heartbeat emission
    this.heartbeatInterval = setInterval(
      () => this.emitHeartbeat(),
      this.config.heartbeatIntervalMs,
    );

    // Perform initial health check
    await this.performHealthCheck();

    console.log(`[MonitoringAgent] Started with level: ${this.config.level}`);
    this.emit("started");
  }

  /**
   * Stop the monitoring agent
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    console.log("[MonitoringAgent] Stopped");
    this.emit("stopped");
  }

  /**
   * Register an agent for monitoring
   */
  registerAgent(agentId: string, agentType: string, sessionId?: string): void {
    const now = new Date();
    const state: AgentState = {
      agentId,
      agentType,
      status: "idle",
      sessionId,
      lastHeartbeat: now,
      lastActivity: now,
      metrics: {
        questionsAsked: 0,
        questionsAnswered: 0,
        tasksCompleted: 0,
        errorsEncountered: 0,
        totalRuntime: 0,
      },
    };

    this.agentStates.set(agentId, state);
    this.updateAgentInDb(state);

    console.log(
      `[MonitoringAgent] Registered agent: ${agentId} (${agentType})`,
    );
    this.emit("agent:registered", { agentId, agentType, sessionId });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      this.agentStates.delete(agentId);
      console.log(`[MonitoringAgent] Unregistered agent: ${agentId}`);
      this.emit("agent:unregistered", { agentId, agentType: state.agentType });
    }
  }

  /**
   * Update agent status
   */
  updateAgentStatus(
    agentId: string,
    status: AgentState["status"],
    details?: Partial<AgentState>,
  ): void {
    const state = this.agentStates.get(agentId);
    if (!state) {
      console.warn(`[MonitoringAgent] Unknown agent: ${agentId}`);
      return;
    }

    const previousStatus = state.status;
    state.status = status;
    state.lastActivity = new Date();

    if (details) {
      Object.assign(state, details);
    }

    this.updateAgentInDb(state);

    // Emit WebSocket event
    const eventType: AgentEventType =
      status === "blocked"
        ? "agent:blocked"
        : status === "error"
          ? "agent:error"
          : status === "halted"
            ? "agent:halted"
            : status === "working" && previousStatus === "blocked"
              ? "agent:unblocked"
              : "agent:heartbeat";

    emitAgentEvent(eventType, agentId, state.agentType, {
      status,
      message: details?.currentTask,
    });

    this.emit("agent:status", { agentId, status, previousStatus });
  }

  /**
   * Record agent heartbeat
   */
  recordHeartbeat(agentId: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.lastHeartbeat = new Date();
      this.updateAgentInDb(state);
    }
  }

  /**
   * Record a question being asked
   */
  recordQuestionAsked(
    agentId: string,
    questionId: string,
    blocking: boolean,
  ): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.metrics.questionsAsked++;
      if (blocking) {
        state.status = "blocked";
        state.blockedBy = state.blockedBy || [];
        state.blockedBy.push(questionId);
      }
      this.updateAgentInDb(state);
    }
  }

  /**
   * Record a question being answered
   */
  recordQuestionAnswered(
    agentId: string,
    questionId: string,
    responseTimeMs: number,
  ): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.metrics.questionsAnswered++;
      if (state.blockedBy) {
        state.blockedBy = state.blockedBy.filter((id) => id !== questionId);
        if (state.blockedBy.length === 0) {
          state.status = "working";
          state.blockedBy = undefined;
        }
      }
      this.updateAgentInDb(state);
    }

    // Update system metrics
    this.updateAverageResponseTime(responseTimeMs);
  }

  /**
   * Record an error
   */
  recordError(agentId: string, error: string): void {
    const state = this.agentStates.get(agentId);
    if (state) {
      state.metrics.errorsEncountered++;
      state.errorMessage = error;
      this.updateAgentInDb(state);
    }

    // Create detected issue
    this.createIssue({
      type: "error",
      severity: "medium",
      agentId,
      description: `Agent error: ${error}`,
      evidence: { error },
    });
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get all agent states
   */
  getAgentStates(): AgentState[] {
    return Array.from(this.agentStates.values());
  }

  /**
   * Get agent state by ID
   */
  getAgentState(agentId: string): AgentState | null {
    return this.agentStates.get(agentId) || null;
  }

  /**
   * Get detected issues
   */
  getDetectedIssues(includeResolved: boolean = false): DetectedIssue[] {
    const issues = Array.from(this.detectedIssues.values());
    return includeResolved ? issues : issues.filter((i) => !i.resolved);
  }

  /**
   * Resolve an issue
   */
  resolveIssue(issueId: string): void {
    const issue = this.detectedIssues.get(issueId);
    if (issue) {
      issue.resolved = true;
      issue.resolvedAt = new Date();
      this.emit("issue:resolved", issue);
    }
  }

  /**
   * Perform periodic health check
   */
  private async performHealthCheck(): Promise<void> {
    const now = new Date();

    // Update system metrics
    this.systemMetrics.systemUptime = now.getTime() - this.startTime.getTime();
    this.systemMetrics.activeAgents = Array.from(
      this.agentStates.values(),
    ).filter((s) => s.status === "working").length;
    this.systemMetrics.blockedAgents = Array.from(
      this.agentStates.values(),
    ).filter((s) => s.status === "blocked").length;
    this.systemMetrics.lastHealthCheck = now;

    // Get pending questions count from DB
    try {
      const result = await this.db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM questions WHERE status = ?",
        ["pending"],
      );
      this.systemMetrics.pendingQuestions = result?.count || 0;
    } catch {
      // Ignore DB errors during health check
    }

    // Check for issues
    await this.checkForIssues();

    // Emit health metrics via WebSocket
    emitSystemHealth({
      activeAgents: this.systemMetrics.activeAgents,
      blockedAgents: this.systemMetrics.blockedAgents,
      pendingQuestions: this.systemMetrics.pendingQuestions,
      averageResponseTime: this.systemMetrics.averageResponseTime,
      systemUptime: this.systemMetrics.systemUptime,
    });

    this.emit("health:check", this.systemMetrics);
  }

  /**
   * Check for potential issues
   */
  private async checkForIssues(): Promise<void> {
    const thresholds = this.config.alertThresholds;

    // Check pending questions threshold
    if (this.systemMetrics.pendingQuestions > thresholds.pendingQuestions) {
      this.createIssue({
        type: "threshold",
        severity: "medium",
        description: `High number of pending questions: ${this.systemMetrics.pendingQuestions}`,
        evidence: {
          count: this.systemMetrics.pendingQuestions,
          threshold: thresholds.pendingQuestions,
        },
      });
    }

    // Check blocked agents threshold
    if (this.systemMetrics.blockedAgents > thresholds.blockedAgents) {
      this.createIssue({
        type: "threshold",
        severity: "high",
        description: `Too many blocked agents: ${this.systemMetrics.blockedAgents}`,
        evidence: {
          count: this.systemMetrics.blockedAgents,
          threshold: thresholds.blockedAgents,
        },
      });
    }

    // Check for agent timeouts
    const now = new Date();
    for (const state of this.agentStates.values()) {
      const timeSinceHeartbeat = now.getTime() - state.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > this.config.agentTimeoutMs) {
        this.createIssue({
          type: "timeout",
          severity: "high",
          agentId: state.agentId,
          description: `Agent ${state.agentId} has not sent heartbeat in ${Math.round(timeSinceHeartbeat / 1000)}s`,
          evidence: {
            lastHeartbeat: state.lastHeartbeat.toISOString(),
            timeoutMs: this.config.agentTimeoutMs,
          },
        });
      }
    }
  }

  /**
   * Manually detect/create an issue (public API for external use)
   */
  detectIssue(
    type: DetectedIssue["type"],
    severity: DetectedIssue["severity"],
    description: string,
    evidence: Record<string, unknown>,
    agentId?: string,
    sessionId?: string,
  ): DetectedIssue {
    return this.createIssue({
      type,
      severity,
      description,
      evidence,
      agentId,
      sessionId,
    });
  }

  /**
   * Create a detected issue (internal)
   */
  private createIssue(
    data: Omit<DetectedIssue, "id" | "detectedAt" | "resolved">,
  ): DetectedIssue {
    const id = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const issue: DetectedIssue = {
      id,
      ...data,
      detectedAt: new Date(),
      resolved: false,
    };

    this.detectedIssues.set(id, issue);
    this.storeIssueInDb(issue);

    // Emit alert via WebSocket (map severity to websocket severity)
    const alertSeverity = this.mapSeverityToAlert(issue.severity);
    emitSystemAlert(issue.description, alertSeverity);

    this.emit("issue:detected", issue);
    console.log(`[MonitoringAgent] Issue detected: ${issue.description}`);

    return issue;
  }

  /**
   * Emit heartbeat to WebSocket clients
   */
  private emitHeartbeat(): void {
    emitSystemHealth({
      activeAgents: this.systemMetrics.activeAgents,
      blockedAgents: this.systemMetrics.blockedAgents,
      pendingQuestions: this.systemMetrics.pendingQuestions,
      averageResponseTime: this.systemMetrics.averageResponseTime,
      systemUptime: Date.now() - this.startTime.getTime(),
    });
  }

  /**
   * Map issue severity to alert severity for WebSocket emission.
   */
  private mapSeverityToAlert(
    severity: DetectedIssue["severity"],
  ): "info" | "warning" | "error" | "critical" {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newResponseTime: number): void {
    const count = this.systemMetrics.questionsAnsweredToday + 1;
    const current = this.systemMetrics.averageResponseTime;
    this.systemMetrics.averageResponseTime =
      (current * (count - 1) + newResponseTime) / count;
    this.systemMetrics.questionsAnsweredToday = count;
  }

  /**
   * Load agent states from database
   */
  private async loadAgentStates(): Promise<void> {
    try {
      const rows = await this.db.all<{
        agent_id: string;
        agent_type: string;
        status: string;
        session_id: string | null;
        current_task: string | null;
        last_activity: string;
      }>("SELECT * FROM agent_states WHERE status != ?", ["completed"]);

      for (const row of rows) {
        const state: AgentState = {
          agentId: row.agent_id,
          agentType: row.agent_type,
          status: row.status as AgentState["status"],
          sessionId: row.session_id || undefined,
          currentTask: row.current_task || undefined,
          lastHeartbeat: new Date(row.last_activity),
          lastActivity: new Date(row.last_activity),
          metrics: {
            questionsAsked: 0,
            questionsAnswered: 0,
            tasksCompleted: 0,
            errorsEncountered: 0,
            totalRuntime: 0,
          },
        };
        this.agentStates.set(state.agentId, state);
      }

      console.log(
        `[MonitoringAgent] Loaded ${this.agentStates.size} agent states`,
      );
    } catch (error) {
      console.error("[MonitoringAgent] Failed to load agent states:", error);
    }
  }

  /**
   * Update agent state in database
   */
  private async updateAgentInDb(state: AgentState): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO agent_states (agent_id, agent_type, status, session_id, current_task, last_activity, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET
           status = excluded.status,
           current_task = excluded.current_task,
           last_activity = excluded.last_activity,
           updated_at = excluded.updated_at`,
        [
          state.agentId,
          state.agentType,
          state.status,
          state.sessionId || null,
          state.currentTask || null,
          state.lastActivity.toISOString(),
          new Date().toISOString(),
        ],
      );
    } catch (error) {
      console.error("[MonitoringAgent] Failed to update agent state:", error);
    }
  }

  /**
   * Store detected issue in database
   */
  private async storeIssueInDb(issue: DetectedIssue): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO detected_issues (id, type, severity, agent_id, session_id, description, evidence, detected_at, resolved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          issue.id,
          issue.type,
          issue.severity,
          issue.agentId || null,
          issue.sessionId || null,
          issue.description,
          JSON.stringify(issue.evidence),
          issue.detectedAt.toISOString(),
          issue.resolved ? 1 : 0,
          new Date().toISOString(),
        ],
      );
    } catch (error) {
      console.error("[MonitoringAgent] Failed to store issue:", error);
    }
  }
}
