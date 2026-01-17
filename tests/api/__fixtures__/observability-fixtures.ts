/**
 * Observability Test Fixtures
 *
 * Sample data for API tests
 */

// === Execution Fixtures ===

export const testExecutions = [
  {
    id: "test-exec-001",
    taskListId: "task-list-001",
    runNumber: 1,
    status: "completed",
    startedAt: "2026-01-15T10:00:00.000Z",
    completedAt: "2026-01-15T10:30:00.000Z",
    sessionId: "session-001",
  },
  {
    id: "test-exec-002",
    taskListId: "task-list-001",
    runNumber: 2,
    status: "running",
    startedAt: "2026-01-16T10:00:00.000Z",
    completedAt: null,
    sessionId: "session-002",
  },
  {
    id: "test-exec-003",
    taskListId: "task-list-002",
    runNumber: 1,
    status: "failed",
    startedAt: "2026-01-16T09:00:00.000Z",
    completedAt: "2026-01-16T09:15:00.000Z",
    sessionId: "session-003",
  },
  {
    id: "test-exec-004",
    taskListId: "task-list-002",
    runNumber: 2,
    status: "active",
    startedAt: "2026-01-17T08:00:00.000Z",
    completedAt: null,
    sessionId: null,
  },
  {
    id: "test-exec-blocked",
    taskListId: "task-list-003",
    runNumber: 1,
    status: "running",
    startedAt: "2026-01-17T07:00:00.000Z",
    completedAt: null,
    sessionId: "session-blocked",
  },
];

export const emptyExecution = {
  id: "empty-exec",
  taskListId: "task-list-empty",
  runNumber: 1,
  status: "completed",
  startedAt: "2026-01-15T10:00:00.000Z",
  completedAt: "2026-01-15T10:01:00.000Z",
  sessionId: null,
};

// === Transcript Fixtures ===

export const testTranscriptEntries = [
  {
    id: "transcript-001",
    executionId: "test-exec-001",
    sequence: 1,
    entryType: "system_init",
    category: "system",
    summary: "Execution initialized",
    taskId: null,
    instanceId: "instance-001",
    waveNumber: null,
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    id: "transcript-002",
    executionId: "test-exec-001",
    sequence: 2,
    entryType: "task_start",
    category: "execution",
    summary: "Started task T-001",
    taskId: "task-001",
    instanceId: "instance-001",
    waveNumber: 1,
    createdAt: "2026-01-15T10:00:01.000Z",
  },
  {
    id: "transcript-003",
    executionId: "test-exec-001",
    sequence: 3,
    entryType: "tool_call",
    category: "execution",
    summary: "Read file src/index.ts",
    taskId: "task-001",
    instanceId: "instance-001",
    waveNumber: 1,
    createdAt: "2026-01-15T10:00:02.000Z",
  },
  {
    id: "transcript-004",
    executionId: "test-exec-001",
    sequence: 4,
    entryType: "assistant",
    category: "output",
    summary: "Generated code implementation",
    taskId: "task-001",
    instanceId: "instance-001",
    waveNumber: 1,
    createdAt: "2026-01-15T10:00:05.000Z",
  },
  {
    id: "transcript-005",
    executionId: "test-exec-001",
    sequence: 5,
    entryType: "task_end",
    category: "execution",
    summary: "Completed task T-001",
    taskId: "task-001",
    instanceId: "instance-001",
    waveNumber: 1,
    createdAt: "2026-01-15T10:00:10.000Z",
  },
];

// === Tool Use Fixtures ===

export const testToolUses = [
  {
    id: "tool-001",
    executionId: "test-exec-001",
    taskId: "task-001",
    transcriptEntryId: "transcript-003",
    tool: "Read",
    toolCategory: "file_operation",
    inputSummary: "Reading file src/index.ts",
    resultStatus: "success",
    outputSummary: "File contents read successfully",
    isError: false,
    isBlocked: false,
    durationMs: 50,
    startTime: "2026-01-15T10:00:02.000Z",
    endTime: "2026-01-15T10:00:02.050Z",
  },
  {
    id: "tool-002",
    executionId: "test-exec-001",
    taskId: "task-001",
    transcriptEntryId: "transcript-003",
    tool: "Write",
    toolCategory: "file_operation",
    inputSummary: "Writing file src/new-file.ts",
    resultStatus: "success",
    outputSummary: "File written successfully",
    isError: false,
    isBlocked: false,
    durationMs: 100,
    startTime: "2026-01-15T10:00:03.000Z",
    endTime: "2026-01-15T10:00:03.100Z",
  },
  {
    id: "tool-003",
    executionId: "test-exec-001",
    taskId: "task-001",
    transcriptEntryId: "transcript-003",
    tool: "Bash",
    toolCategory: "shell",
    inputSummary: "Running npm test",
    resultStatus: "success",
    outputSummary: "Tests passed",
    isError: false,
    isBlocked: false,
    durationMs: 5000,
    startTime: "2026-01-15T10:00:04.000Z",
    endTime: "2026-01-15T10:00:09.000Z",
  },
  {
    id: "tool-004",
    executionId: "test-exec-blocked",
    taskId: "task-blocked",
    transcriptEntryId: "transcript-blocked",
    tool: "Bash",
    toolCategory: "shell",
    inputSummary: "Running rm -rf /",
    resultStatus: "blocked",
    outputSummary: "Command blocked",
    isError: false,
    isBlocked: true,
    blockReason: "Dangerous command blocked",
    durationMs: 0,
    startTime: "2026-01-17T07:00:01.000Z",
    endTime: "2026-01-17T07:00:01.000Z",
  },
  {
    id: "tool-005",
    executionId: "test-exec-003",
    taskId: "task-003",
    transcriptEntryId: "transcript-error",
    tool: "Bash",
    toolCategory: "shell",
    inputSummary: "Running build command",
    resultStatus: "error",
    outputSummary: "Build failed",
    isError: true,
    isBlocked: false,
    errorMessage: "Exit code 1: Build failed with errors",
    durationMs: 2000,
    startTime: "2026-01-16T09:10:00.000Z",
    endTime: "2026-01-16T09:10:02.000Z",
  },
];

// === Assertion Fixtures ===

export const testAssertions = [
  {
    id: "assertion-001",
    taskId: "task-001",
    executionId: "test-exec-001",
    category: "syntax",
    description: "File compiles without errors",
    result: "pass",
    evidence: { command: "npx tsc --noEmit", exitCode: 0 },
    chainId: "chain-001",
    chainPosition: 1,
    timestamp: "2026-01-15T10:00:08.000Z",
    durationMs: 1000,
  },
  {
    id: "assertion-002",
    taskId: "task-001",
    executionId: "test-exec-001",
    category: "unit_test",
    description: "Unit tests pass",
    result: "pass",
    evidence: { command: "npm test", passed: 10, failed: 0 },
    chainId: "chain-001",
    chainPosition: 2,
    timestamp: "2026-01-15T10:00:09.000Z",
    durationMs: 3000,
  },
  {
    id: "assertion-003",
    taskId: "task-001",
    executionId: "test-exec-001",
    category: "e2e",
    description: "E2E tests pass",
    result: "skip",
    evidence: { reason: "No E2E tests configured" },
    chainId: "chain-001",
    chainPosition: 3,
    timestamp: "2026-01-15T10:00:09.500Z",
    durationMs: 0,
  },
  {
    id: "assertion-004",
    taskId: "task-003",
    executionId: "test-exec-003",
    category: "syntax",
    description: "File compiles without errors",
    result: "fail",
    evidence: {
      command: "npx tsc --noEmit",
      exitCode: 1,
      errors: ["Type error in src/broken.ts:10"],
    },
    chainId: "chain-002",
    chainPosition: 1,
    timestamp: "2026-01-16T09:12:00.000Z",
    durationMs: 1500,
  },
];

export const testAssertionChains = [
  {
    id: "chain-001",
    executionId: "test-exec-001",
    taskId: "task-001",
    name: "Task T-001 Validation",
    overallResult: "pass",
    totalAssertions: 3,
    passedCount: 2,
    failedCount: 0,
    skippedCount: 1,
    startedAt: "2026-01-15T10:00:08.000Z",
    completedAt: "2026-01-15T10:00:09.500Z",
  },
  {
    id: "chain-002",
    executionId: "test-exec-003",
    taskId: "task-003",
    name: "Task T-003 Validation",
    overallResult: "fail",
    totalAssertions: 1,
    passedCount: 0,
    failedCount: 1,
    skippedCount: 0,
    startedAt: "2026-01-16T09:12:00.000Z",
    completedAt: "2026-01-16T09:12:01.500Z",
  },
];

// === Skill Trace Fixtures ===

export const testSkillTraces = [
  {
    id: "skill-001",
    executionId: "test-exec-001",
    taskId: "task-001",
    skillName: "code-generator",
    skillFile: "agents/build-agent/skills/code-generator.ts",
    lineNumber: 42,
    sectionTitle: "Generate TypeScript Implementation",
    inputSummary: "Generating implementation for task T-001",
    outputSummary: "Generated 50 lines of TypeScript code",
    startTime: "2026-01-15T10:00:03.000Z",
    endTime: "2026-01-15T10:00:04.000Z",
    durationMs: 1000,
    tokenEstimate: 500,
    status: "completed",
    errorMessage: null,
  },
  {
    id: "skill-002",
    executionId: "test-exec-001",
    taskId: "task-001",
    skillName: "validation-runner",
    skillFile: "agents/build-agent/skills/validation-runner.ts",
    lineNumber: 100,
    sectionTitle: "Run Syntax Validation",
    inputSummary: "Validating generated code",
    outputSummary: "Validation passed",
    startTime: "2026-01-15T10:00:08.000Z",
    endTime: "2026-01-15T10:00:09.500Z",
    durationMs: 1500,
    tokenEstimate: 200,
    status: "completed",
    errorMessage: null,
  },
];

// === Message Bus Log Fixtures ===

export const testMessageBusLogs = [
  {
    id: "log-001",
    eventId: "event-001",
    timestamp: "2026-01-15T10:00:00.000Z",
    source: "build-agent",
    eventType: "execution.started",
    correlationId: "corr-001",
    humanSummary: "Build agent started execution run #1",
    severity: "info",
    category: "execution",
    executionId: "test-exec-001",
  },
  {
    id: "log-002",
    eventId: "event-002",
    timestamp: "2026-01-15T10:00:01.000Z",
    source: "build-agent",
    eventType: "task.started",
    correlationId: "corr-001",
    humanSummary: "Started task T-001",
    severity: "info",
    category: "execution",
    taskId: "task-001",
    executionId: "test-exec-001",
  },
  {
    id: "log-003",
    eventId: "event-003",
    timestamp: "2026-01-16T09:10:02.000Z",
    source: "build-agent",
    eventType: "task.failed",
    correlationId: "corr-003",
    humanSummary: "Task T-003 failed: Build error",
    severity: "error",
    category: "execution",
    taskId: "task-003",
    executionId: "test-exec-003",
  },
  {
    id: "log-004",
    eventId: "event-004",
    timestamp: "2026-01-17T07:00:01.000Z",
    source: "security-monitor",
    eventType: "command.blocked",
    correlationId: "corr-blocked",
    humanSummary: "Dangerous command blocked: rm -rf /",
    severity: "warning",
    category: "security",
    executionId: "test-exec-blocked",
  },
];

// === Stats Fixtures ===

export const testStats = {
  healthy: {
    activeExecutions: 2,
    errorRate: "5.0",
    blockedAgents: 0,
    pendingQuestions: 0,
  },
  degraded: {
    activeExecutions: 3,
    errorRate: "15.0",
    blockedAgents: 1,
    pendingQuestions: 2,
  },
  critical: {
    activeExecutions: 0,
    errorRate: "50.0",
    blockedAgents: 5,
    pendingQuestions: 10,
  },
};

// === Health Fixtures ===

export const testHealth = {
  healthy: {
    failedRecent: 0,
    blockedAgents: 0,
    staleQuestions: 0,
  },
  degraded: {
    failedRecent: 1,
    blockedAgents: 1,
    staleQuestions: 2,
  },
  critical: {
    failedRecent: 5,
    blockedAgents: 4,
    staleQuestions: 10,
  },
};

// === Activity Fixtures ===

export const testActivityFeed = [
  {
    id: "activity-001",
    type: "execution" as const,
    title: "Run #1",
    description: "Execution completed successfully",
    timestamp: "2026-01-15T10:30:00.000Z",
    status: "completed",
    href: "/observability/executions/test-exec-001",
  },
  {
    id: "activity-002",
    type: "question" as const,
    title: "Question from build-agent",
    description: "How should I handle the deprecation warning?",
    timestamp: "2026-01-16T09:00:00.000Z",
    status: "pending",
    href: "/observability/agents",
  },
  {
    id: "activity-003",
    type: "event" as const,
    title: "task.failed",
    description: "Task T-003 failed with build error",
    timestamp: "2026-01-16T09:10:02.000Z",
    href: "/observability/events?session=session-003",
  },
];

// === Cross Reference Fixtures ===

export const testCrossReferences = {
  toolUse: {
    entityType: "tool_use",
    entityId: "tool-001",
    relatedTo: [
      { type: "execution", id: "test-exec-001" },
      { type: "transcript", id: "transcript-003" },
      { type: "task", id: "task-001" },
    ],
  },
  assertion: {
    entityType: "assertion",
    entityId: "assertion-001",
    relatedTo: [
      { type: "execution", id: "test-exec-001" },
      { type: "task", id: "task-001" },
      { type: "assertion_chain", id: "chain-001" },
    ],
  },
};

// === Search Fixtures ===

export const testSearchResults = {
  query: "failed",
  results: [
    {
      type: "execution" as const,
      id: "test-exec-003",
      title: "Run #1",
      subtitle: "Status: failed",
      timestamp: "2026-01-16T09:00:00.000Z",
      href: "/observability/executions/test-exec-003",
    },
    {
      type: "error" as const,
      id: "assertion-004",
      title: "Failed: syntax",
      subtitle: "File compiles without errors",
      timestamp: "2026-01-16T09:12:00.000Z",
      href: "/observability/executions/test-exec-003",
    },
  ],
};
