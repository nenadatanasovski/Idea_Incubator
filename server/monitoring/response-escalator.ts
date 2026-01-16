// server/monitoring/response-escalator.ts
// MON-006: Graduated response system for detected issues

import { EventEmitter } from "events";
import { v4 as uuid } from "uuid";
import { DetectedIssue } from "./monitoring-agent";
import { CommunicationHub } from "../communication/communication-hub";
import {
  Question,
  QuestionOption,
  QuestionType,
} from "../communication/question-delivery";
import {
  Notification,
  NotificationSeverity,
} from "../communication/notification-dispatcher";
import { AgentType } from "../communication/types";
import { HaltReason } from "../communication/halt-controller";

/**
 * Response levels in order of severity.
 * Each level includes all actions from previous levels.
 */
export enum ResponseLevel {
  LOG = "log", // Level 1: Just log
  NOTIFY = "notify", // Level 2: Send notification
  ALERT = "alert", // Level 3: Non-blocking alert question
  ESCALATE = "escalate", // Level 4: Blocking escalation question
  HALT = "halt", // Level 5: Halt and require approval
}

/**
 * Response action that can be taken.
 */
export interface ResponseAction {
  level: ResponseLevel;
  issueId: string;
  issueSeverity: string;
  issueType: string;
  description: string;
  timestamp: Date;
  agentId?: string;
  sessionId?: string;
  questionId?: string; // If a question was created
  notificationId?: string; // If a notification was sent
  executed: boolean;
  result?: string;
}

/**
 * Escalation rule configuration.
 */
export interface EscalationRule {
  issueType: string; // Type of issue (stalled, drift, error, etc.)
  severity: string; // Severity level
  initialLevel: ResponseLevel; // Starting response level
  escalationDelay: number; // Time in ms before escalating
  maxLevel: ResponseLevel; // Maximum escalation level
}

/**
 * Escalation state for tracking issue progression.
 */
interface EscalationState {
  issueId: string;
  currentLevel: ResponseLevel;
  actions: ResponseAction[];
  escalationTimer?: ReturnType<typeof setTimeout>;
  resolved: boolean;
  createdAt: Date;
  lastActionAt: Date;
}

/**
 * Default escalation rules based on issue type and severity.
 */
const DEFAULT_RULES: EscalationRule[] = [
  // Critical issues start at HALT
  {
    issueType: "error",
    severity: "critical",
    initialLevel: ResponseLevel.HALT,
    escalationDelay: 0,
    maxLevel: ResponseLevel.HALT,
  },
  {
    issueType: "security",
    severity: "critical",
    initialLevel: ResponseLevel.HALT,
    escalationDelay: 0,
    maxLevel: ResponseLevel.HALT,
  },

  // High severity starts at ALERT, escalates to HALT
  {
    issueType: "stalled",
    severity: "high",
    initialLevel: ResponseLevel.ALERT,
    escalationDelay: 60000,
    maxLevel: ResponseLevel.HALT,
  },
  {
    issueType: "drift",
    severity: "high",
    initialLevel: ResponseLevel.ALERT,
    escalationDelay: 60000,
    maxLevel: ResponseLevel.HALT,
  },
  {
    issueType: "error",
    severity: "high",
    initialLevel: ResponseLevel.ESCALATE,
    escalationDelay: 30000,
    maxLevel: ResponseLevel.HALT,
  },

  // Medium severity starts at NOTIFY, escalates to ESCALATE
  {
    issueType: "stalled",
    severity: "medium",
    initialLevel: ResponseLevel.NOTIFY,
    escalationDelay: 120000,
    maxLevel: ResponseLevel.ESCALATE,
  },
  {
    issueType: "drift",
    severity: "medium",
    initialLevel: ResponseLevel.NOTIFY,
    escalationDelay: 120000,
    maxLevel: ResponseLevel.ESCALATE,
  },
  {
    issueType: "timeout",
    severity: "medium",
    initialLevel: ResponseLevel.ALERT,
    escalationDelay: 60000,
    maxLevel: ResponseLevel.ESCALATE,
  },

  // Low severity logs only
  {
    issueType: "heartbeat_missed",
    severity: "low",
    initialLevel: ResponseLevel.LOG,
    escalationDelay: 180000,
    maxLevel: ResponseLevel.NOTIFY,
  },
  {
    issueType: "warning",
    severity: "low",
    initialLevel: ResponseLevel.LOG,
    escalationDelay: 0,
    maxLevel: ResponseLevel.LOG,
  },

  // Default catch-all
  {
    issueType: "*",
    severity: "*",
    initialLevel: ResponseLevel.NOTIFY,
    escalationDelay: 120000,
    maxLevel: ResponseLevel.ESCALATE,
  },
];

/**
 * Response Escalator - Implements graduated response system.
 *
 * When an issue is detected, the escalator:
 * 1. Determines the appropriate response level based on rules
 * 2. Executes the response action
 * 3. Sets up escalation timers if issue persists
 * 4. Tracks response history for analysis
 */
export class ResponseEscalator extends EventEmitter {
  private communicationHub: CommunicationHub;
  private rules: EscalationRule[];
  private escalationStates: Map<string, EscalationState> = new Map();
  private actionHistory: ResponseAction[] = [];
  private maxHistorySize = 1000;

  constructor(communicationHub: CommunicationHub, rules?: EscalationRule[]) {
    super();
    this.communicationHub = communicationHub;
    this.rules = rules || DEFAULT_RULES;
  }

  /**
   * Handle a detected issue and determine appropriate response.
   */
  async handleIssue(issue: DetectedIssue): Promise<ResponseAction> {
    const rule = this.findMatchingRule(issue);
    const level = this.determineResponseLevel(issue, rule);

    // Create or update escalation state
    let state = this.escalationStates.get(issue.id);
    if (!state) {
      state = {
        issueId: issue.id,
        currentLevel: level,
        actions: [],
        resolved: false,
        createdAt: new Date(),
        lastActionAt: new Date(),
      };
      this.escalationStates.set(issue.id, state);
    }

    // Execute the response
    const action = await this.executeResponse(level, issue, state);

    // Set up escalation timer if not at max level
    if (level !== rule.maxLevel && rule.escalationDelay > 0) {
      this.setupEscalationTimer(issue, state, rule);
    }

    return action;
  }

  /**
   * Resolve an issue, canceling any pending escalations.
   */
  resolveIssue(issueId: string): void {
    const state = this.escalationStates.get(issueId);
    if (state) {
      state.resolved = true;
      if (state.escalationTimer) {
        clearTimeout(state.escalationTimer);
        state.escalationTimer = undefined;
      }

      console.log(`[Escalator] Issue ${issueId} resolved`);
      this.emit("issue:resolved", { issueId });
    }
  }

  /**
   * Find the matching rule for an issue.
   */
  private findMatchingRule(issue: DetectedIssue): EscalationRule {
    // Try exact match first
    let rule = this.rules.find(
      (r) => r.issueType === issue.type && r.severity === issue.severity,
    );

    // Try type match with wildcard severity
    if (!rule) {
      rule = this.rules.find(
        (r) => r.issueType === issue.type && r.severity === "*",
      );
    }

    // Try severity match with wildcard type
    if (!rule) {
      rule = this.rules.find(
        (r) => r.issueType === "*" && r.severity === issue.severity,
      );
    }

    // Fall back to catch-all
    if (!rule) {
      rule = this.rules.find((r) => r.issueType === "*" && r.severity === "*");
    }

    return rule || DEFAULT_RULES[DEFAULT_RULES.length - 1];
  }

  /**
   * Determine the response level based on issue and current state.
   */
  private determineResponseLevel(
    issue: DetectedIssue,
    rule: EscalationRule,
  ): ResponseLevel {
    const state = this.escalationStates.get(issue.id);

    if (state && !state.resolved) {
      // Already tracking this issue, check if we should escalate
      const nextLevel = this.getNextLevel(state.currentLevel);
      if (nextLevel && this.compareLevels(nextLevel, rule.maxLevel) <= 0) {
        return nextLevel;
      }
      return state.currentLevel;
    }

    return rule.initialLevel;
  }

  /**
   * Execute the response action.
   */
  private async executeResponse(
    level: ResponseLevel,
    issue: DetectedIssue,
    state: EscalationState,
  ): Promise<ResponseAction> {
    const action: ResponseAction = {
      level,
      issueId: issue.id,
      issueSeverity: issue.severity,
      issueType: issue.type,
      description: issue.description,
      timestamp: new Date(),
      agentId: issue.agentId,
      executed: false,
    };

    try {
      switch (level) {
        case ResponseLevel.LOG:
          await this.executeLogAction(issue, action);
          break;

        case ResponseLevel.NOTIFY:
          await this.executeNotifyAction(issue, action);
          break;

        case ResponseLevel.ALERT:
          await this.executeAlertAction(issue, action);
          break;

        case ResponseLevel.ESCALATE:
          await this.executeEscalateAction(issue, action);
          break;

        case ResponseLevel.HALT:
          await this.executeHaltAction(issue, action);
          break;
      }

      action.executed = true;
    } catch (error) {
      action.result = `Failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(`[Escalator] Failed to execute ${level} response:`, error);
    }

    // Record action
    state.actions.push(action);
    state.currentLevel = level;
    state.lastActionAt = new Date();
    this.addToHistory(action);

    this.emit("response:executed", action);
    return action;
  }

  /**
   * Level 1: Log only.
   */
  private async executeLogAction(
    issue: DetectedIssue,
    action: ResponseAction,
  ): Promise<void> {
    console.log(
      `[Escalator] LOG: ${issue.type} (${issue.severity}) - ${issue.description}`,
    );
    action.result = "Logged";
  }

  /**
   * Level 2: Send notification (includes LOG).
   */
  private async executeNotifyAction(
    issue: DetectedIssue,
    action: ResponseAction,
  ): Promise<void> {
    // Log first
    console.log(
      `[Escalator] NOTIFY: ${issue.type} (${issue.severity}) - ${issue.description}`,
    );

    // Send notification via Communication Hub
    try {
      const notificationId = uuid();
      const notification: Notification = {
        id: notificationId,
        agentType: this.extractAgentType(issue.agentId),
        category: "error",
        severity: this.mapSeverity(issue.severity),
        title: `${issue.type.toUpperCase()}: ${issue.severity}`,
        message: issue.description,
        data: {
          issueId: issue.id,
          issueType: issue.type,
          responseLevel: ResponseLevel.NOTIFY,
        },
      };

      await this.communicationHub.notify(notification);

      action.notificationId = notificationId;
      action.result = `Notification sent: ${notificationId}`;
    } catch (error) {
      // Fallback to log only
      action.result = `Notification failed, logged only: ${error instanceof Error ? error.message : "Unknown"}`;
    }
  }

  /**
   * Level 3: Create non-blocking alert question (includes NOTIFY).
   */
  private async executeAlertAction(
    issue: DetectedIssue,
    action: ResponseAction,
  ): Promise<void> {
    // Notify first
    await this.executeNotifyAction(issue, action);

    // Create ALERT type question (non-blocking)
    try {
      const questionId = uuid();
      const question: Question = {
        id: questionId,
        agentId: issue.agentId || "monitoring",
        type: "ALERT" as QuestionType,
        content: `Alert: ${issue.description}`,
        options: this.createOptions(["Acknowledge", "Investigate", "Dismiss"]),
        blocking: false,
        priority: this.severityToPriorityNumber(issue.severity),
        context: {
          issueId: issue.id,
          issueType: issue.type,
          responseLevel: ResponseLevel.ALERT,
        },
      };

      const result = await this.communicationHub.askQuestion(question);

      action.questionId = questionId;
      action.result = result.success
        ? `Alert question created: ${questionId}`
        : `Alert question delivery failed: ${result.error}`;
    } catch (error) {
      action.result = `${action.result}; Alert question failed: ${error instanceof Error ? error.message : "Unknown"}`;
    }
  }

  /**
   * Level 4: Create blocking escalation question (includes ALERT).
   */
  private async executeEscalateAction(
    issue: DetectedIssue,
    action: ResponseAction,
  ): Promise<void> {
    // Notify (skip non-blocking alert for escalation)
    console.log(
      `[Escalator] ESCALATE: ${issue.type} (${issue.severity}) - ${issue.description}`,
    );

    // Send urgent notification
    const notificationId = uuid();
    const notification: Notification = {
      id: notificationId,
      agentType: this.extractAgentType(issue.agentId),
      category: "approval_needed",
      severity: "error",
      title: `ESCALATION: ${issue.type.toUpperCase()}`,
      message: `Requires attention: ${issue.description}`,
      data: {
        issueId: issue.id,
        issueType: issue.type,
        responseLevel: ResponseLevel.ESCALATE,
      },
    };
    await this.communicationHub.notify(notification);

    // Create ESCALATION type question (blocking)
    try {
      const questionId = uuid();
      const question: Question = {
        id: questionId,
        agentId: issue.agentId || "monitoring",
        type: "ESCALATION" as QuestionType,
        content: `ESCALATION: ${issue.description}\n\nThis issue requires your decision to proceed.`,
        options: this.createOptions([
          "Fix and continue",
          "Retry",
          "Skip this",
          "Halt agent",
        ]),
        blocking: true,
        priority: 3, // High priority
        context: {
          issueId: issue.id,
          issueType: issue.type,
          responseLevel: ResponseLevel.ESCALATE,
        },
      };

      const result = await this.communicationHub.askQuestion(question);

      action.questionId = questionId;
      action.result = result.success
        ? `Escalation question created (blocking): ${questionId}`
        : `Escalation question delivery failed: ${result.error}`;
    } catch (error) {
      action.result = `Escalation question failed: ${error instanceof Error ? error.message : "Unknown"}`;
    }
  }

  /**
   * Level 5: Halt agent and require approval (includes ESCALATE notification).
   */
  private async executeHaltAction(
    issue: DetectedIssue,
    action: ResponseAction,
  ): Promise<void> {
    console.log(
      `[Escalator] HALT: ${issue.type} (${issue.severity}) - ${issue.description}`,
    );

    // Send critical notification
    const notificationId = uuid();
    const notification: Notification = {
      id: notificationId,
      agentType: this.extractAgentType(issue.agentId),
      category: "approval_needed",
      severity: "critical",
      title: `AGENT HALTED: ${issue.type.toUpperCase()}`,
      message: `Agent has been halted due to: ${issue.description}. Approval required to resume.`,
      data: {
        issueId: issue.id,
        issueType: issue.type,
        responseLevel: ResponseLevel.HALT,
      },
    };
    await this.communicationHub.notify(notification);

    // Halt the agent if we have an ID
    if (issue.agentId) {
      const agentType = this.extractAgentType(issue.agentId);
      await this.communicationHub.haltAgent(
        issue.agentId,
        agentType,
        "error_threshold" as HaltReason, // Monitoring-detected issue
        issue.description,
      );
    }

    // Create APPROVAL type question (blocking, requires explicit approval)
    try {
      const questionId = uuid();
      const question: Question = {
        id: questionId,
        agentId: issue.agentId || "monitoring",
        type: "APPROVAL" as QuestionType,
        content: `APPROVAL REQUIRED\n\nAgent has been halted due to: ${issue.description}\n\nPlease review and approve one of the following actions:`,
        options: this.createOptions([
          "Resume agent",
          "Resume with fix",
          "Terminate agent",
          "Investigate first",
        ]),
        blocking: true,
        priority: 4, // Critical priority
        context: {
          issueId: issue.id,
          issueType: issue.type,
          responseLevel: ResponseLevel.HALT,
          agentHalted: true,
        },
      };

      const result = await this.communicationHub.askQuestion(question);

      action.questionId = questionId;
      action.result = result.success
        ? `Agent halted, approval question created: ${questionId}`
        : `Agent halted, approval question delivery failed: ${result.error}`;
    } catch (error) {
      action.result = `Halt notification sent, approval question failed: ${error instanceof Error ? error.message : "Unknown"}`;
    }
  }

  /**
   * Set up timer for automatic escalation.
   */
  private setupEscalationTimer(
    issue: DetectedIssue,
    state: EscalationState,
    rule: EscalationRule,
  ): void {
    // Clear existing timer
    if (state.escalationTimer) {
      clearTimeout(state.escalationTimer);
    }

    state.escalationTimer = setTimeout(async () => {
      // Check if issue is still unresolved
      if (!state.resolved) {
        console.log(`[Escalator] Auto-escalating issue ${issue.id}`);

        // Re-fetch issue to get latest state
        const updatedIssue: DetectedIssue = {
          ...issue,
          id: issue.id,
        };

        await this.handleIssue(updatedIssue);
      }
    }, rule.escalationDelay);
  }

  /**
   * Get the next escalation level.
   */
  private getNextLevel(current: ResponseLevel): ResponseLevel | null {
    const levels = Object.values(ResponseLevel);
    const currentIndex = levels.indexOf(current);

    if (currentIndex < levels.length - 1) {
      return levels[currentIndex + 1];
    }

    return null;
  }

  /**
   * Compare two response levels.
   * Returns negative if a < b, 0 if equal, positive if a > b.
   */
  private compareLevels(a: ResponseLevel, b: ResponseLevel): number {
    const levels = Object.values(ResponseLevel);
    return levels.indexOf(a) - levels.indexOf(b);
  }

  /**
   * Convert severity to numeric priority.
   */
  private severityToPriorityNumber(severity: string): number {
    switch (severity) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      default:
        return 1;
    }
  }

  /**
   * Map severity string to NotificationSeverity.
   */
  private mapSeverity(severity: string): NotificationSeverity {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
      case "error":
        return "error";
      case "medium":
      case "warning":
        return "warning";
      default:
        return "info";
    }
  }

  /**
   * Extract agent type from agent ID.
   */
  private extractAgentType(agentId?: string): AgentType {
    if (!agentId) return "monitoring";

    // Extract type from ID pattern like "spec-agent-123"
    const parts = agentId.split("-");
    if (parts.length >= 2) {
      const type = parts[0];
      const validTypes: AgentType[] = [
        "monitoring",
        "orchestrator",
        "spec",
        "build",
        "validation",
        "sia",
        "system",
      ];
      if (validTypes.includes(type as AgentType)) {
        return type as AgentType;
      }
    }

    return "monitoring";
  }

  /**
   * Create QuestionOption array from labels.
   */
  private createOptions(labels: string[]): QuestionOption[] {
    return labels.map((label) => ({
      label,
      action: label.toLowerCase().replace(/\s+/g, "_"),
    }));
  }

  /**
   * Add action to history with size limit.
   */
  private addToHistory(action: ResponseAction): void {
    this.actionHistory.push(action);

    // Trim history if needed
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory = this.actionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get action history for analysis.
   */
  getActionHistory(): ResponseAction[] {
    return [...this.actionHistory];
  }

  /**
   * Get current escalation states.
   */
  getEscalationStates(): Map<string, EscalationState> {
    return new Map(this.escalationStates);
  }

  /**
   * Get unresolved issues count by level.
   */
  getUnresolvedCounts(): Record<ResponseLevel, number> {
    const counts: Record<ResponseLevel, number> = {
      [ResponseLevel.LOG]: 0,
      [ResponseLevel.NOTIFY]: 0,
      [ResponseLevel.ALERT]: 0,
      [ResponseLevel.ESCALATE]: 0,
      [ResponseLevel.HALT]: 0,
    };

    for (const state of this.escalationStates.values()) {
      if (!state.resolved) {
        counts[state.currentLevel]++;
      }
    }

    return counts;
  }

  /**
   * Clean up stale escalation states.
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();

    for (const [issueId, state] of this.escalationStates.entries()) {
      if (state.resolved && now - state.lastActionAt.getTime() > maxAge) {
        if (state.escalationTimer) {
          clearTimeout(state.escalationTimer);
        }
        this.escalationStates.delete(issueId);
      }
    }
  }

  /**
   * Stop all escalation timers (for shutdown).
   */
  stopAll(): void {
    for (const state of this.escalationStates.values()) {
      if (state.escalationTimer) {
        clearTimeout(state.escalationTimer);
        state.escalationTimer = undefined;
      }
    }
  }
}
