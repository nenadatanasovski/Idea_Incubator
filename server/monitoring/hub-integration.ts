// server/monitoring/hub-integration.ts
// MON-002: Event bus listener - Integrates MonitoringAgent with CommunicationHub
// MON-006: Response escalator integration

import { CommunicationHub } from "../communication/communication-hub";
import {
  MonitoringAgent,
  DetectedIssue,
  MonitoringConfig,
} from "./monitoring-agent";
import { ResponseEscalator } from "./response-escalator";
import {
  emitAgentRegistered,
  emitAgentStarted,
  emitAgentBlocked,
  emitAgentUnblocked,
  emitQuestionAnswered,
  emitSystemAlert,
} from "../websocket";

/**
 * Wire up the MonitoringAgent to listen to CommunicationHub events.
 * This is the primary data source for the monitoring system (MON-002).
 * Also wires up ResponseEscalator for graduated responses (MON-006).
 */
export function integrateMonitoringWithHub(
  monitoringAgent: MonitoringAgent,
  communicationHub: CommunicationHub,
  responseEscalator?: ResponseEscalator,
): void {
  console.log(
    "[HubIntegration] Connecting MonitoringAgent to CommunicationHub...",
  );

  // ============================================
  // Agent Lifecycle Events
  // ============================================

  // Agent registered and ready
  communicationHub.on(
    "agent:ready",
    (data: {
      agentId: string;
      session: { agentType: string; sessionId?: string };
    }) => {
      const { agentId, session } = data;

      // Register with monitoring agent
      monitoringAgent.registerAgent(
        agentId,
        session.agentType,
        session.sessionId,
      );

      // Update status to working
      monitoringAgent.updateAgentStatus(agentId, "working");

      // Emit WebSocket events
      emitAgentRegistered(agentId, session.agentType);
      emitAgentStarted(agentId, session.agentType, session.sessionId);

      console.log(
        `[HubIntegration] Agent ready: ${agentId} (${session.agentType})`,
      );
    },
  );

  // Agent blocked (waiting for answer)
  communicationHub.on(
    "agent:blocked",
    (data: {
      agentId: string;
      agentType: string;
      reason: string;
      questionIds: string[];
    }) => {
      const { agentId, agentType, questionIds } = data;

      // Update monitoring state
      monitoringAgent.updateAgentStatus(agentId, "blocked", {
        blockedBy: questionIds,
      });

      // Record question asked
      for (const questionId of questionIds) {
        monitoringAgent.recordQuestionAsked(agentId, questionId, true);
      }

      // Emit WebSocket event
      if (questionIds.length > 0) {
        emitAgentBlocked(agentId, agentType, questionIds[0]);
      }

      console.log(
        `[HubIntegration] Agent blocked: ${agentId} (${questionIds.length} questions)`,
      );
    },
  );

  // Agent unblocked (answer received)
  communicationHub.on(
    "agent:unblocked",
    (data: { agentId: string; agentType: string; previousStatus: string }) => {
      const { agentId, agentType } = data;

      // Update monitoring state
      monitoringAgent.updateAgentStatus(agentId, "working");

      // Emit WebSocket event
      emitAgentUnblocked(agentId, agentType, "answered");

      console.log(`[HubIntegration] Agent unblocked: ${agentId}`);
    },
  );

  // Agent halted
  communicationHub.on(
    "agent:halted",
    (event: {
      agentId: string;
      agentType: string;
      reason: string;
      details: string;
    }) => {
      const { agentId, reason, details } = event;

      // Update monitoring state
      monitoringAgent.updateAgentStatus(agentId, "halted", {
        errorMessage: `${reason}: ${details}`,
      });

      // Record error
      monitoringAgent.recordError(agentId, `Halted: ${reason} - ${details}`);

      // Emit alert
      emitSystemAlert(`Agent ${agentId} halted: ${reason}`, "error");

      console.log(`[HubIntegration] Agent halted: ${agentId} (${reason})`);
    },
  );

  // Agent resumed
  communicationHub.on(
    "agent:resumed",
    (event: { agentId: string; agentType: string }) => {
      const { agentId } = event;

      // Update monitoring state
      monitoringAgent.updateAgentStatus(agentId, "working");

      console.log(`[HubIntegration] Agent resumed: ${agentId}`);
    },
  );

  // ============================================
  // Answer Events
  // ============================================

  communicationHub.on(
    "answer:received",
    (answer: {
      questionId: string;
      agentId: string;
      value: string;
      receivedAt: Date;
      askedAt?: Date;
    }) => {
      const { questionId, agentId, receivedAt, askedAt } = answer;

      // Calculate response time
      const responseTimeMs = askedAt
        ? receivedAt.getTime() - new Date(askedAt).getTime()
        : 0;

      // Record answer
      monitoringAgent.recordQuestionAnswered(
        agentId,
        questionId,
        responseTimeMs,
      );

      // Get agent state to emit WebSocket event
      const state = monitoringAgent.getAgentState(agentId);
      if (state) {
        emitQuestionAnswered(questionId, agentId, state.agentType);
      }

      console.log(
        `[HubIntegration] Answer received for question ${questionId} (${responseTimeMs}ms)`,
      );
    },
  );

  // ============================================
  // Hub Lifecycle Events
  // ============================================

  communicationHub.on("hub:started", () => {
    console.log("[HubIntegration] CommunicationHub started");
    emitSystemAlert("Communication system online", "info");
  });

  communicationHub.on("hub:stopped", () => {
    console.log("[HubIntegration] CommunicationHub stopped");
    emitSystemAlert("Communication system offline", "warning");
  });

  // ============================================
  // Monitoring Agent Events -> WebSocket
  // ============================================

  monitoringAgent.on("issue:detected", async (issue: DetectedIssue) => {
    // Emit WebSocket alert
    emitSystemAlert(
      issue.description,
      issue.severity as "info" | "warning" | "error" | "critical",
    );

    // Route to ResponseEscalator if available (MON-006)
    if (responseEscalator) {
      try {
        const action = await responseEscalator.handleIssue(issue);
        console.log(
          `[HubIntegration] Issue ${issue.id} handled with ${action.level} response`,
        );
      } catch (error) {
        console.error(
          `[HubIntegration] Failed to escalate issue ${issue.id}:`,
          error,
        );
      }
    }
  });

  monitoringAgent.on("health:check", (metrics: Record<string, number>) => {
    // Health check metrics are automatically emitted by MonitoringAgent
    console.log(
      `[HubIntegration] Health check: ${metrics.activeAgents} active, ${metrics.blockedAgents} blocked`,
    );
  });

  // ============================================
  // ResponseEscalator Events (MON-006)
  // ============================================

  if (responseEscalator) {
    responseEscalator.on(
      "response:executed",
      (action: { level: string; issueId: string; result?: string }) => {
        console.log(
          `[HubIntegration] Escalation response executed: ${action.level} for ${action.issueId}`,
        );
      },
    );

    responseEscalator.on("issue:resolved", (data: { issueId: string }) => {
      console.log(`[HubIntegration] Issue resolved: ${data.issueId}`);
    });

    console.log("[HubIntegration] ResponseEscalator connected");
  }

  console.log("[HubIntegration] MonitoringAgent connected to CommunicationHub");
}

// Database interface for MonitoringAgent
interface MonitoringDatabase {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Create a fully integrated monitoring setup.
 * Returns both the MonitoringAgent and ResponseEscalator.
 */
export async function createIntegratedMonitoring(
  db: MonitoringDatabase,
  communicationHub: CommunicationHub,
  config?: Partial<MonitoringConfig>,
): Promise<{
  monitoringAgent: MonitoringAgent;
  responseEscalator: ResponseEscalator;
}> {
  const monitoringAgent = new MonitoringAgent(db, config);
  const responseEscalator = new ResponseEscalator(communicationHub);

  // Wire up integration with escalator
  integrateMonitoringWithHub(
    monitoringAgent,
    communicationHub,
    responseEscalator,
  );

  // Start monitoring
  await monitoringAgent.start();

  return { monitoringAgent, responseEscalator };
}
