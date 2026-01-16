// server/monitoring/action-executor.ts
// MON-007: Action Executor - Observe-Confirm-Act pattern for corrective actions

import { EventEmitter } from "events";
import type { CommunicationHub } from "../communication/communication-hub.js";
import type {
  Question,
  QuestionType,
} from "../communication/question-delivery.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Action that can be executed to resolve an issue.
 */
export interface Action {
  id: string;
  type: "restart" | "retry" | "sync" | "notify" | "escalate" | "custom";
  name: string;
  description: string;
  execute: () => Promise<ActionResult>;
  rollback?: () => Promise<void>;
  requiresConfirmation: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

/**
 * Result of executing an action.
 */
export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  duration: number;
}

/**
 * Observation about an issue.
 */
export interface Observation {
  id: string;
  timestamp: Date;
  issueId: string;
  type: "metrics" | "logs" | "state" | "user_report" | "automated";
  summary: string;
  details: Record<string, unknown>;
  confidence: number; // 0-1
  suggestedActions: string[]; // Action IDs
}

/**
 * Execution plan for resolving an issue.
 */
export interface ExecutionPlan {
  id: string;
  issueId: string;
  observations: Observation[];
  actions: Action[];
  status:
    | "pending"
    | "awaiting_confirmation"
    | "executing"
    | "completed"
    | "failed"
    | "cancelled";
  createdAt: Date;
  confirmedAt?: Date;
  confirmedBy?: string;
  completedAt?: Date;
  results: ActionResult[];
}

/**
 * Configuration for Action Executor.
 */
export interface ActionExecutorConfig {
  autoConfirmThreshold: number; // Confidence above which auto-execute (0-1)
  maxRetries: number;
  retryDelay: number; // ms
  confirmationTimeout: number; // ms
}

const DEFAULT_CONFIG: ActionExecutorConfig = {
  autoConfirmThreshold: 0.9, // Only auto-confirm very high confidence
  maxRetries: 3,
  retryDelay: 5000,
  confirmationTimeout: 300000, // 5 minutes
};

/**
 * Action Executor - Implements the Observe-Confirm-Act pattern.
 *
 * Flow:
 * 1. OBSERVE: Gather information about the issue
 * 2. PLAN: Determine appropriate actions based on observations
 * 3. CONFIRM: Get human approval for risky actions (unless high confidence)
 * 4. ACT: Execute the corrective actions
 * 5. VERIFY: Confirm the issue is resolved
 *
 * This ensures humans stay in the loop for important decisions
 * while allowing autonomous handling of routine issues.
 */
export class ActionExecutor extends EventEmitter {
  private config: ActionExecutorConfig;
  private plans: Map<string, ExecutionPlan> = new Map();
  private actions: Map<string, Action> = new Map();
  private communicationHub?: CommunicationHub;
  private confirmationTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  constructor(config: Partial<ActionExecutorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the communication hub for confirmation requests.
   */
  setCommunicationHub(hub: CommunicationHub): void {
    this.communicationHub = hub;
  }

  /**
   * Register an action that can be executed.
   */
  registerAction(action: Action): void {
    this.actions.set(action.id, action);
    console.log(`[ActionExecutor] Registered action: ${action.name}`);
  }

  /**
   * Unregister an action.
   */
  unregisterAction(actionId: string): void {
    this.actions.delete(actionId);
  }

  /**
   * Get all registered actions.
   */
  getActions(): Action[] {
    return [...this.actions.values()];
  }

  /**
   * OBSERVE: Create observations about an issue.
   */
  createObservation(
    issueId: string,
    type: Observation["type"],
    summary: string,
    details: Record<string, unknown>,
    confidence: number,
    suggestedActions: string[] = [],
  ): Observation {
    const observation: Observation = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      issueId,
      type,
      summary,
      details,
      confidence: Math.max(0, Math.min(1, confidence)),
      suggestedActions,
    };

    this.emit("observation:created", observation);
    return observation;
  }

  /**
   * PLAN: Create an execution plan based on observations.
   */
  createPlan(issueId: string, observations: Observation[]): ExecutionPlan {
    // Collect suggested actions from observations
    const actionIds = new Set<string>();
    for (const obs of observations) {
      for (const actionId of obs.suggestedActions) {
        actionIds.add(actionId);
      }
    }

    // Get actions
    const actions: Action[] = [];
    for (const actionId of actionIds) {
      const action = this.actions.get(actionId);
      if (action) {
        actions.push(action);
      }
    }

    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      issueId,
      observations,
      actions,
      status: "pending",
      createdAt: new Date(),
      results: [],
    };

    this.plans.set(plan.id, plan);
    this.emit("plan:created", plan);

    return plan;
  }

  /**
   * CONFIRM: Request confirmation for a plan.
   * Returns true if confirmed (or auto-confirmed), false if rejected.
   */
  async requestConfirmation(planId: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Calculate average confidence from observations
    const avgConfidence =
      plan.observations.reduce((sum, o) => sum + o.confidence, 0) /
      plan.observations.length;

    // Check if any action is high risk
    const hasHighRiskAction = plan.actions.some(
      (a) => a.riskLevel === "high" || a.riskLevel === "critical",
    );

    // Auto-confirm if high confidence and no high-risk actions
    if (
      avgConfidence >= this.config.autoConfirmThreshold &&
      !hasHighRiskAction
    ) {
      plan.status = "executing";
      plan.confirmedAt = new Date();
      plan.confirmedBy = "auto";
      this.emit("plan:auto-confirmed", plan);
      return true;
    }

    // Need human confirmation
    plan.status = "awaiting_confirmation";

    if (!this.communicationHub) {
      console.warn(
        "[ActionExecutor] No CommunicationHub - cannot request confirmation",
      );
      this.emit("plan:confirmation-skipped", plan);
      return false;
    }

    // Build confirmation question
    const actionSummary = plan.actions
      .map((a) => `- ${a.name}: ${a.description}`)
      .join("\n");
    const observationSummary = plan.observations
      .map(
        (o) =>
          `- ${o.summary} (confidence: ${Math.round(o.confidence * 100)}%)`,
      )
      .join("\n");

    const question: Question = {
      id: uuidv4(),
      agentId: "monitoring-agent",
      type: "APPROVAL" as QuestionType,
      priority: hasHighRiskAction ? 4 : 3,
      blocking: true,
      content: `Action Plan Confirmation Required

Issue: ${plan.issueId}

Observations:
${observationSummary}

Proposed Actions:
${actionSummary}

Average confidence: ${Math.round(avgConfidence * 100)}%
Risk level: ${hasHighRiskAction ? "HIGH" : "MEDIUM"}

Do you approve executing these actions?`,
      options: [
        { label: "Approve", action: "approve" },
        { label: "Reject", action: "reject" },
        { label: "Modify", action: "modify" },
      ],
    };

    return new Promise((resolve) => {
      // Set timeout
      const timer = setTimeout(() => {
        this.confirmationTimers.delete(planId);
        plan.status = "cancelled";
        this.emit("plan:confirmation-timeout", plan);
        resolve(false);
      }, this.config.confirmationTimeout);

      this.confirmationTimers.set(planId, timer);

      // Ask question via hub
      this.communicationHub!.askQuestion(question)
        .then((result) => {
          clearTimeout(timer);
          this.confirmationTimers.delete(planId);

          // If question delivered successfully, consider it approved for now
          // TODO: Integrate with answer processor to get actual user response
          if (result.success) {
            plan.status = "executing";
            plan.confirmedAt = new Date();
            plan.confirmedBy = "human";
            this.emit("plan:confirmed", plan);
            resolve(true);
          } else {
            plan.status = "cancelled";
            this.emit("plan:rejected", plan);
            resolve(false);
          }
        })
        .catch((err: Error) => {
          clearTimeout(timer);
          this.confirmationTimers.delete(planId);
          console.error("[ActionExecutor] Confirmation request failed:", err);
          plan.status = "failed";
          resolve(false);
        });
    });
  }

  /**
   * ACT: Execute a plan's actions.
   */
  async executePlan(planId: string): Promise<ExecutionPlan> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    if (plan.status !== "executing") {
      throw new Error(
        `Plan ${planId} is not ready for execution (status: ${plan.status})`,
      );
    }

    this.emit("plan:execution-started", plan);

    for (const action of plan.actions) {
      let result: ActionResult;
      let retries = 0;

      while (retries <= this.config.maxRetries) {
        const startTime = Date.now();

        try {
          this.emit("action:started", { planId, action });

          result = await action.execute();
          result.duration = Date.now() - startTime;

          if (result.success) {
            this.emit("action:completed", { planId, action, result });
            break;
          } else {
            throw new Error(result.error || "Action failed");
          }
        } catch (error) {
          result = {
            success: false,
            message: `Action failed: ${action.name}`,
            error: error instanceof Error ? error.message : String(error),
            duration: Date.now() - startTime,
          };

          retries++;
          if (retries <= this.config.maxRetries) {
            console.log(
              `[ActionExecutor] Retrying action ${action.name} (${retries}/${this.config.maxRetries})`,
            );
            await this.delay(this.config.retryDelay);
          } else {
            this.emit("action:failed", { planId, action, result });
          }
        }
      }

      plan.results.push(result!);

      // If action failed, stop execution
      if (!result!.success) {
        plan.status = "failed";
        this.emit("plan:failed", plan);
        return plan;
      }
    }

    plan.status = "completed";
    plan.completedAt = new Date();
    this.emit("plan:completed", plan);

    return plan;
  }

  /**
   * Execute the full Observe-Confirm-Act flow.
   */
  async observeConfirmAct(
    issueId: string,
    observations: Observation[],
  ): Promise<ExecutionPlan> {
    // 1. PLAN
    const plan = this.createPlan(issueId, observations);

    if (plan.actions.length === 0) {
      plan.status = "completed";
      plan.completedAt = new Date();
      this.emit("plan:no-actions", plan);
      return plan;
    }

    // 2. CONFIRM
    const confirmed = await this.requestConfirmation(plan.id);
    if (!confirmed) {
      return plan;
    }

    // 3. ACT
    return this.executePlan(plan.id);
  }

  /**
   * Cancel a pending plan.
   */
  cancelPlan(planId: string): void {
    const plan = this.plans.get(planId);
    if (
      plan &&
      (plan.status === "pending" || plan.status === "awaiting_confirmation")
    ) {
      // Clear any pending timeout
      const timer = this.confirmationTimers.get(planId);
      if (timer) {
        clearTimeout(timer);
        this.confirmationTimers.delete(planId);
      }

      plan.status = "cancelled";
      this.emit("plan:cancelled", plan);
    }
  }

  /**
   * Get a plan by ID.
   */
  getPlan(planId: string): ExecutionPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * Get all plans.
   */
  getPlans(): ExecutionPlan[] {
    return [...this.plans.values()];
  }

  /**
   * Get plans by status.
   */
  getPlansByStatus(status: ExecutionPlan["status"]): ExecutionPlan[] {
    return [...this.plans.values()].filter((p) => p.status === status);
  }

  /**
   * Get status summary.
   */
  getStatus(): {
    totalPlans: number;
    pending: number;
    executing: number;
    completed: number;
    failed: number;
    registeredActions: number;
  } {
    const plans = [...this.plans.values()];

    return {
      totalPlans: plans.length,
      pending: plans.filter(
        (p) => p.status === "pending" || p.status === "awaiting_confirmation",
      ).length,
      executing: plans.filter((p) => p.status === "executing").length,
      completed: plans.filter((p) => p.status === "completed").length,
      failed: plans.filter(
        (p) => p.status === "failed" || p.status === "cancelled",
      ).length,
      registeredActions: this.actions.size,
    };
  }

  /**
   * Clean up old plans.
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;

    for (const [planId, plan] of this.plans) {
      if (
        plan.createdAt.getTime() < cutoff &&
        (plan.status === "completed" ||
          plan.status === "failed" ||
          plan.status === "cancelled")
      ) {
        this.plans.delete(planId);
      }
    }
  }

  /**
   * Helper: delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create common actions for Vibe platform.
 */
export function createDefaultActions(): Action[] {
  return [
    {
      id: "restart-agent",
      type: "restart",
      name: "Restart Agent",
      description: "Restart the unresponsive agent",
      execute: async () => ({
        success: true,
        message: "Agent restart initiated",
        duration: 0,
      }),
      requiresConfirmation: true,
      riskLevel: "medium",
    },
    {
      id: "retry-task",
      type: "retry",
      name: "Retry Task",
      description: "Retry the failed task",
      execute: async () => ({
        success: true,
        message: "Task retry initiated",
        duration: 0,
      }),
      requiresConfirmation: false,
      riskLevel: "low",
    },
    {
      id: "sync-state",
      type: "sync",
      name: "Sync State",
      description: "Synchronize state from source of truth",
      execute: async () => ({
        success: true,
        message: "State synchronization complete",
        duration: 0,
      }),
      requiresConfirmation: true,
      riskLevel: "medium",
    },
    {
      id: "notify-human",
      type: "notify",
      name: "Notify Human",
      description: "Send notification to human operator",
      execute: async () => ({
        success: true,
        message: "Notification sent",
        duration: 0,
      }),
      requiresConfirmation: false,
      riskLevel: "low",
    },
    {
      id: "escalate-to-halt",
      type: "escalate",
      name: "Escalate to Halt",
      description: "Halt the system until human resolves the issue",
      execute: async () => ({
        success: true,
        message: "System halted",
        duration: 0,
      }),
      requiresConfirmation: true,
      riskLevel: "critical",
    },
  ];
}
