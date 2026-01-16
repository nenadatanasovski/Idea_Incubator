# Build Agent Appendix A: TypeScript Types

> **Parent Document:** [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md)

---

## A.1 Build Agent Instance Types

```typescript
// types/build-agent.ts

export type BuildAgentStatus =
  | "initializing"
  | "running"
  | "idle"
  | "completed"
  | "failed"
  | "stuck";

export interface BuildAgentConfig {
  maxRetries: number;
  heartbeatIntervalMs: number;
  taskTimeoutMs: number;
  validationTimeoutMs: number;
}

export interface BuildAgentInstance {
  instanceId: string;
  executionId: string;
  agentType: "build-agent";
  currentTaskId: string | null;
  waveNumber: number;
  status: BuildAgentStatus;
  spawnedAt: string;
  completedAt: string | null;
  lastHeartbeat: string | null;
  config: BuildAgentConfig;
  errorContext: BuildAgentError | null;
}

export interface BuildAgentError {
  code: string;
  message: string;
  taskId?: string;
  stackTrace?: string;
  timestamp: string;
}

export interface BuildAgentHeartbeat {
  instanceId: string;
  timestamp: string;
  status: BuildAgentStatus;
  currentTaskId: string | null;
  progressPercent: number | null;
  memoryUsageMb: number;
  cpuPercent: number;
}
```

---

## A.2 Execution Context Types

```typescript
// types/execution.ts

export interface TaskExecutionContext {
  task: Task;
  spec: SpecificationDocument;
  gotchas: Gotcha[];
  conventions: Convention[];
  previousAttempts: TaskAttempt[];
}

export interface TaskAttempt {
  attemptNumber: number;
  startedAt: string;
  completedAt: string | null;
  status: "success" | "failed" | "timeout";
  validationOutput: string | null;
  errorMessage: string | null;
}

export interface Discovery {
  type: "gotcha" | "pattern" | "decision";
  content: string;
  filePattern: string;
  actionType: string;
  confidence: number;
  sourceTaskId: string;
}

export interface ExecutionLogEntry {
  id: number;
  executionId: string;
  taskId: string | null;
  instanceId: string | null;
  timestamp: string;
  eventType: ExecutionEventType;
  message: string;
  context: Record<string, unknown> | null;
}

export type ExecutionEventType =
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_skipped"
  | "checkpoint_created"
  | "checkpoint_restored"
  | "discovery_recorded"
  | "validation_run"
  | "error"
  | "warning"
  | "info";
```

---

## A.3 Prime Phase Context Types

```typescript
// types/prime-context.ts

export interface PrimePhaseContext {
  spec: SpecificationDocument;
  tasks: Task[];
  conventions: Convention[];
  executionLog: ExecutionLogEntry[]; // Last 500 lines for resumption
  previousState?: ResumptionState;
}

export interface ResumptionState {
  lastCompletedTaskId: string;
  knownIssues: Issue[];
  consecutiveFailures: number;
}

export interface SpecificationDocument {
  id: string;
  ideaSlug: string;
  userSlug: string;
  specPath: string;
  tasksPath: string;
  status: "draft" | "approved" | "in_progress" | "completed";
  createdAt: string;
  approvedAt?: string;
}

export interface Convention {
  section: string;
  content: string;
  source: "CLAUDE.md" | "project" | "knowledge_base";
}

export interface Issue {
  taskId: string;
  errorType: string;
  message: string;
  attempts: number;
}
```

---

## A.4 Validation Types

```typescript
// types/validation.ts

export type ValidationLevel = "codebase" | "api" | "ui";

export interface ValidationResult {
  level: ValidationLevel;
  passed: boolean;
  output: string;
  failedTests?: string[];
  duration: number;
}

export interface ValidationCommand {
  command: string;
  expected: string;
  timeout: number;
  level: ValidationLevel;
}

export interface TaskValidation {
  command: string;
  expected: string;
  timeout?: number;
}
```

---

## A.5 Failure Handling Types

```typescript
// types/failure.ts

export type ErrorType =
  | "SYNTAX_ERROR"
  | "TYPE_ERROR"
  | "VALIDATION_FAILED"
  | "MISSING_DEPENDENCY"
  | "FILE_LOCK_CONFLICT"
  | "PERMISSION_DENIED"
  | "CONFLICT"
  | "TIMEOUT"
  | "TRANSIENT_ERROR"
  | "UNKNOWN";

export type FailureAction =
  | "RETRY"
  | "INSTALL_AND_RETRY"
  | "REBASE_AND_RETRY"
  | "SKIP"
  | "ESCALATE";

export interface FailureDecision {
  action: FailureAction;
  reason: string;
  package?: string; // For INSTALL_AND_RETRY
  retryDelay?: number;
}

export interface RetryStrategy {
  maxRetries: number;
  backoffMs: number[]; // e.g., [1000, 5000, 15000]
  retryableErrors: ErrorType[];
  nonRetryableErrors: ErrorType[];
}

// Default retry strategy
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 3,
  backoffMs: [1000, 5000, 15000],
  retryableErrors: [
    "VALIDATION_TIMEOUT",
    "FILE_LOCK_CONFLICT",
    "TRANSIENT_ERROR",
  ],
  nonRetryableErrors: ["SYNTAX_ERROR", "TYPE_ERROR", "PERMISSION_DENIED"],
};
```

---

## A.6 Event Payload Types

```typescript
// types/events.ts

// Published by Build Agent
export interface AgentSpawnedEvent {
  instanceId: string;
  executionId: string;
  waveNumber: number;
  taskListId: string;
}

export interface AgentHeartbeatEvent {
  instanceId: string;
  status: BuildAgentStatus;
  currentTaskId: string | null;
  progressPercent?: number;
}

export interface TaskStartedEvent {
  taskId: string;
  instanceId: string;
  executionId: string;
  timestamp: string;
}

export interface TaskCompletedEvent {
  taskId: string;
  instanceId: string;
  executionId: string;
  discoveries: Discovery[];
  validationOutput: string;
  timestamp: string;
}

export interface TaskFailedEvent {
  taskId: string;
  instanceId: string;
  executionId: string;
  error: BuildAgentError;
  attemptNumber: number;
  timestamp: string;
}

export interface DiscoveryRecordedEvent {
  type: "gotcha" | "pattern" | "decision";
  content: string;
  filePattern: string;
  confidence: number;
  sourceTaskId: string;
  instanceId: string;
}

export interface BuildStuckEvent {
  instanceId: string;
  executionId: string;
  consecutiveFailures: number;
  lastTaskId: string;
  failureContext: FailureContext;
}

export interface WaveCompletedEvent {
  executionId: string;
  waveNumber: number;
  completedTasks: number;
  failedTasks: number;
  nextWaveReady: boolean;
}

// Received by Build Agent
export interface BuildCancelEvent {
  executionId: string;
  reason: string;
}

export interface BuildPauseEvent {
  executionId: string;
}

export interface BuildResumeEvent {
  executionId: string;
  fromTaskId?: string;
}

export interface FailureContext {
  taskId: string;
  errorHistory: Array<{
    timestamp: string;
    errorType: ErrorType;
    message: string;
  }>;
  executionLogTail: string; // Last 500 lines
}
```

---

## A.7 Orchestrator Types

```typescript
// types/orchestrator.ts

export interface WaveTaskAssignment {
  taskId: string;
  waveNumber: number;
  assignedAt?: string;
  instanceId?: string;
}

export interface ExecutionWave {
  waveId: string;
  executionId: string;
  waveNumber: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}

export interface HealthStatus {
  healthy: boolean;
  lastHeartbeat: string | null;
  missedHeartbeats: number;
  status: BuildAgentStatus;
}

export interface OrchestrationConfig {
  maxConcurrentAgents: number;
  heartbeatTimeoutMs: number;
  waveTimeoutMs: number;
  autoRetryOnFailure: boolean;
}
```

---

## A.8 Knowledge Base Integration Types

```typescript
// types/knowledge.ts

export interface Gotcha {
  id: string;
  content: string;
  filePattern: string;
  actionType?: string;
  confidence: number;
  occurrences: number;
  lastSeenAt: string;
  sourceTaskId?: string;
}

export interface Pattern {
  id: string;
  content: string;
  topic: string;
  confidence: number;
  isUniversal: boolean;
  occurrences: number;
}

export interface KnowledgeQuery {
  type: "gotcha" | "pattern";
  filePattern?: string;
  actionType?: string;
  topic?: string;
  minConfidence?: number;
  limit?: number;
}

export interface KnowledgeRecord {
  type: "gotcha" | "pattern" | "decision";
  content: string;
  filePattern?: string;
  actionType?: string;
  topic?: string;
  confidence: number;
  sourceTaskId: string;
  isUniversal?: boolean;
}
```
