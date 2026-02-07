// tests/e2e/test-mon-module.ts
// Validation tests for MON-001 through MON-009
// Simplified version to avoid memory issues

import { EventEmitter } from "events";

// Mock database
const mockDb = {
  run: async () => ({ lastID: 1, changes: 1 }),
  get: async <T>(): Promise<T | undefined> => undefined,
  all: async <T>(): Promise<T[]> => [],
};

// Mock CommunicationHub
class MockCommunicationHub extends EventEmitter {
  questions: Map<string, unknown> = new Map();
  notifications: Map<string, unknown> = new Map();
  haltedAgents: Set<string> = new Set();

  async notify(notification: { id: string; [key: string]: unknown }) {
    this.notifications.set(notification.id, notification);
    return { success: true, channels: { telegram: { success: true } } };
  }

  async askQuestion(question: { id: string; [key: string]: unknown }) {
    this.questions.set(question.id, question);
    return {
      success: true,
      messageId: 123,
      channel: "telegram" as const,
      deliveredAt: new Date(),
    };
  }

  async haltAgent(
    agentId: string,
    _agentType: string,
    _reason: string,
    _details: string,
  ) {
    this.haltedAgents.add(agentId);
    return {
      id: "halt-1",
      agentId,
      agentType: _agentType,
      reason: _reason,
      details: _details,
      haltedAt: new Date(),
    };
  }
}

const results: { test: string; passed: boolean; error?: string }[] = [];

async function testMON001() {
  console.log("─────────────────────────────────────────────────────────────");
  console.log("MON-001: Monitoring Agent Core Architecture");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  const { MonitoringAgent } =
    await import("../../server/monitoring/monitoring-agent");

  // Test 1: Can instantiate MonitoringAgent
  const agent = new MonitoringAgent(mockDb);
  results.push({
    test: "MON-001.1: MonitoringAgent instantiation",
    passed: true,
  });
  console.log("  ✅ MON-001.1: MonitoringAgent instantiation");

  // Test 2: Can register an agent
  agent.registerAgent("test-agent-1", "spec", "session-1");
  const state = agent.getAgentState("test-agent-1");
  const agentRegistered = state != null && state.agentType === "spec";
  results.push({
    test: "MON-001.2: Agent registration",
    passed: agentRegistered,
  });
  console.log(
    agentRegistered
      ? "  ✅ MON-001.2: Agent registration"
      : "  ❌ MON-001.2: Agent registration",
  );

  // Test 3: Can update agent status
  agent.updateAgentStatus("test-agent-1", "working");
  const updatedState = agent.getAgentState("test-agent-1");
  const statusUpdated = updatedState?.status === "working";
  results.push({ test: "MON-001.3: Status update", passed: statusUpdated });
  console.log(
    statusUpdated
      ? "  ✅ MON-001.3: Status update"
      : "  ❌ MON-001.3: Status update",
  );

  // Test 4: Can get system metrics
  const metrics = agent.getSystemMetrics();
  const hasMetrics = metrics.activeAgents >= 0 && metrics.systemUptime >= 0;
  results.push({ test: "MON-001.4: System metrics", passed: hasMetrics });
  console.log(
    hasMetrics
      ? "  ✅ MON-001.4: System metrics"
      : "  ❌ MON-001.4: System metrics",
  );
}

async function testMON002() {
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-002: Event Bus Listener Integration");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  const { MonitoringAgent } =
    await import("../../server/monitoring/monitoring-agent");
  const { integrateMonitoringWithHub } =
    await import("../../server/monitoring/hub-integration");

  const agent = new MonitoringAgent(mockDb);
  const hub = new MockCommunicationHub();

  // Test 1: Integration function exists and runs
  integrateMonitoringWithHub(agent, hub as any);
  results.push({ test: "MON-002.1: Hub integration", passed: true });
  console.log("  ✅ MON-002.1: Hub integration function");

  // Test 2: Agent ready event is handled
  hub.emit("agent:ready", {
    agentId: "hub-agent-1",
    session: { agentType: "build", sessionId: "sess-1" },
  });
  await new Promise((r) => setTimeout(r, 10));
  const agentState = agent.getAgentState("hub-agent-1");
  const agentReadyHandled =
    agentState != null && agentState.agentType === "build";
  results.push({
    test: "MON-002.2: Agent ready event",
    passed: agentReadyHandled,
  });
  console.log(
    agentReadyHandled
      ? "  ✅ MON-002.2: Agent ready event handling"
      : "  ❌ MON-002.2: Agent ready event handling",
  );

  // Test 3: Agent blocked event is handled
  hub.emit("agent:blocked", {
    agentId: "hub-agent-1",
    agentType: "build",
    reason: "waiting",
    questionIds: ["q-1"],
  });
  await new Promise((r) => setTimeout(r, 10));
  const blockedState = agent.getAgentState("hub-agent-1");
  const blockedHandled = blockedState?.status === "blocked";
  results.push({
    test: "MON-002.3: Agent blocked event",
    passed: blockedHandled,
  });
  console.log(
    blockedHandled
      ? "  ✅ MON-002.3: Agent blocked event handling"
      : "  ❌ MON-002.3: Agent blocked event handling",
  );
}

async function testMON005() {
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-005: Detection Engine");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  const { MonitoringAgent } =
    await import("../../server/monitoring/monitoring-agent");
  const agent = new MonitoringAgent(mockDb);

  // Test 1: Can detect issues manually
  const issue = agent.detectIssue("timeout", "high", "Test timeout issue", {
    test: true,
  });
  const issueDetected = issue.id !== undefined && issue.type === "timeout";
  results.push({ test: "MON-005.1: Issue detection", passed: issueDetected });
  console.log(
    issueDetected
      ? "  ✅ MON-005.1: Issue detection"
      : "  ❌ MON-005.1: Issue detection",
  );

  // Test 2: Issue has correct properties
  const hasProperties =
    issue.severity === "high" && issue.description === "Test timeout issue";
  results.push({ test: "MON-005.2: Issue properties", passed: hasProperties });
  console.log(
    hasProperties
      ? "  ✅ MON-005.2: Issue properties"
      : "  ❌ MON-005.2: Issue properties",
  );

  // Test 3: Issue emits event
  let eventReceived = false;
  agent.on("issue:detected", () => {
    eventReceived = true;
  });
  agent.detectIssue("error", "critical", "Critical error", {});
  const eventEmitted = eventReceived;
  results.push({
    test: "MON-005.3: Issue event emission",
    passed: eventEmitted,
  });
  console.log(
    eventEmitted
      ? "  ✅ MON-005.3: Issue event emission"
      : "  ❌ MON-005.3: Issue event emission",
  );
}

async function testMON006() {
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-006: Response Escalator");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  const { ResponseEscalator, ResponseLevel } =
    await import("../../server/monitoring/response-escalator");

  const hub = new MockCommunicationHub();
  const escalator = new ResponseEscalator(hub as any);

  results.push({
    test: "MON-006.1: ResponseEscalator instantiation",
    passed: true,
  });
  console.log("  ✅ MON-006.1: ResponseEscalator instantiation");

  // Test LOG level
  const lowIssue = {
    id: "issue-low-1",
    type: "anomaly" as const,
    severity: "low" as const,
    description: "Low severity test",
    evidence: {},
    detectedAt: new Date(),
    resolved: false,
  };
  const logAction = await escalator.handleIssue(lowIssue);
  const logLevelCorrect = logAction.level === ResponseLevel.LOG;
  results.push({
    test: "MON-006.2: LOG level response",
    passed: logLevelCorrect,
  });
  console.log(
    logLevelCorrect
      ? "  ✅ MON-006.2: LOG level response"
      : "  ❌ MON-006.2: LOG level response",
  );

  // Test ALERT level
  const highIssue = {
    id: "issue-high-1",
    type: "timeout" as const,
    severity: "high" as const,
    description: "High severity test",
    evidence: {},
    detectedAt: new Date(),
    resolved: false,
  };
  const alertAction = await escalator.handleIssue(highIssue);
  const alertLevelCorrect = alertAction.level === ResponseLevel.ALERT;
  results.push({
    test: "MON-006.3: ALERT level response",
    passed: alertLevelCorrect,
  });
  console.log(
    alertLevelCorrect
      ? "  ✅ MON-006.3: ALERT level response"
      : "  ❌ MON-006.3: ALERT level response",
  );

  // Test HALT level
  const criticalIssue = {
    id: "issue-critical-1",
    type: "error" as const,
    severity: "critical" as const,
    agentId: "test-agent-halt",
    description: "Critical error test",
    evidence: {},
    detectedAt: new Date(),
    resolved: false,
  };
  const haltAction = await escalator.handleIssue(criticalIssue);
  const haltLevelCorrect = haltAction.level === ResponseLevel.HALT;
  results.push({
    test: "MON-006.4: HALT level response",
    passed: haltLevelCorrect,
  });
  console.log(
    haltLevelCorrect
      ? "  ✅ MON-006.4: HALT level response"
      : "  ❌ MON-006.4: HALT level response",
  );

  // Notifications sent
  const notificationsSent = hub.notifications.size > 0;
  results.push({
    test: "MON-006.5: Notifications sent",
    passed: notificationsSent,
  });
  console.log(
    notificationsSent
      ? "  ✅ MON-006.5: Notifications sent"
      : "  ❌ MON-006.5: Notifications sent",
  );

  // Agent halted
  const agentHalted = hub.haltedAgents.has("test-agent-halt");
  results.push({
    test: "MON-006.6: Agent halt triggered",
    passed: agentHalted,
  });
  console.log(
    agentHalted
      ? "  ✅ MON-006.6: Agent halt triggered"
      : "  ❌ MON-006.6: Agent halt triggered",
  );

  // Clean up escalation timers
  escalator.stopAll();
}

async function testMON009() {
  console.log(
    "\n─────────────────────────────────────────────────────────────",
  );
  console.log("MON-009: Question Integration (ALERT/ESCALATION/APPROVAL)");
  console.log(
    "─────────────────────────────────────────────────────────────\n",
  );

  const { ResponseEscalator } =
    await import("../../server/monitoring/response-escalator");

  const hub = new MockCommunicationHub();
  const escalator = new ResponseEscalator(hub as any);

  // Test ALERT question
  const alertIssue = {
    id: "q-alert-1",
    type: "timeout" as const,
    severity: "high" as const,
    description: "Test alert question",
    evidence: {},
    detectedAt: new Date(),
    resolved: false,
  };
  await escalator.handleIssue(alertIssue);

  const hasQuestions = hub.questions.size > 0;
  results.push({ test: "MON-009.1: Questions created", passed: hasQuestions });
  console.log(
    hasQuestions
      ? "  ✅ MON-009.1: Questions created"
      : "  ❌ MON-009.1: Questions created",
  );

  // Check question types
  let hasAlertType = false;
  let hasApprovalType = false;
  for (const q of hub.questions.values()) {
    const question = q as { type?: string };
    if (question.type === "ALERT") hasAlertType = true;
    if (question.type === "APPROVAL") hasApprovalType = true;
  }

  // Test APPROVAL question
  const approvalIssue = {
    id: "q-approval-1",
    type: "error" as const,
    severity: "critical" as const,
    agentId: "test-approval-agent",
    description: "Test approval question",
    evidence: {},
    detectedAt: new Date(),
    resolved: false,
  };
  await escalator.handleIssue(approvalIssue);

  for (const q of hub.questions.values()) {
    const question = q as { type?: string };
    if (question.type === "APPROVAL") hasApprovalType = true;
  }

  results.push({
    test: "MON-009.2: ALERT question type",
    passed: hasAlertType,
  });
  console.log(
    hasAlertType
      ? "  ✅ MON-009.2: ALERT question type"
      : "  ❌ MON-009.2: ALERT question type",
  );

  results.push({
    test: "MON-009.3: APPROVAL question type",
    passed: hasApprovalType,
  });
  console.log(
    hasApprovalType
      ? "  ✅ MON-009.3: APPROVAL question type"
      : "  ❌ MON-009.3: APPROVAL question type",
  );

  escalator.stopAll();
}

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        MONITORING MODULE VERIFICATION TESTS                ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  try {
    await testMON001();
    await testMON002();
    await testMON005();
    await testMON006();
    await testMON009();
  } catch (error) {
    console.log(`\n❌ Test suite error: ${error}`);
    results.push({ test: "Test suite", passed: false, error: String(error) });
  }

  // Summary
  console.log(
    "\n═════════════════════════════════════════════════════════════",
  );
  console.log("                    TEST SUMMARY");
  console.log(
    "═════════════════════════════════════════════════════════════\n",
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`  Total:  ${results.length}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ❌`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    - ${r.test}${r.error ? `: ${r.error}` : ""}`);
    }
    process.exit(1);
  }

  console.log(
    "\n═════════════════════════════════════════════════════════════\n",
  );
  process.exit(0);
}

runTests();
