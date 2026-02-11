# VIBE-P16-010: Feedback Loop Integration Tests

**Task ID:** VIBE-P16-010
**Created:** 2026-02-09
**Status:** Specification
**Category:** Testing Infrastructure - Phase 16
**Priority:** High
**Agent Type:** spec_agent
**Model:** Claude Sonnet 4.5

---

## Overview

Comprehensive integration test suite covering the complete feedback loop for the Vibe platform: user feedback submission → intake processing → triage classification → task creation → notification delivery. This test suite validates the full cycle of user feedback (bug reports, feature requests, satisfaction surveys) being automatically processed, categorized, aggregated, and converted into actionable tasks with appropriate notifications.

### Context

The Vibe platform implements a self-improvement feedback loop where:

1. **Users** submit feedback (bugs, feature requests, usability issues) via UI, API, or Telegram
2. **Intake Agent** (Sonnet) processes feedback, extracts structured data, and categorizes
3. **Triage System** classifies feedback severity, aggregates similar requests, and prioritizes
4. **Task Creation** automatically generates tasks for Planning/Build/QA agents
5. **Notification System** alerts stakeholders via Telegram, dashboard events, and email

### Problem Statement

Without comprehensive integration tests:

- Feedback submissions may get lost in the intake queue
- Critical bugs could be miscategorized as low-priority
- Similar feature requests won't be aggregated into epics
- Notification delivery failures go undetected
- Performance degradation under load isn't caught until production
- End-to-end latency (submission → task creation) isn't monitored
- System recovery from intake agent failures is untested
- Analytics data enrichment pipeline has no validation

### Solution

Create a multi-layered integration test suite that:

1. **E2E Tests**: Validate complete feedback journeys (submission → notification)
2. **Performance Tests**: Ensure system handles 100+ submissions/minute
3. **Stress Tests**: Verify graceful degradation under 10x normal load
4. **Integration Tests**: Validate component interactions (intake ↔ triage ↔ tasks)
5. **Chaos Tests**: Simulate intake agent failures and verify recovery
6. **Timing Tests**: Ensure critical feedback processed within SLA (30s for bugs, 60s for critical)
7. **Coverage Tests**: >80% code coverage for all feedback loop components

---

## Requirements

### Functional Requirements

#### FR-1: End-to-End Bug Report Flow

**Priority:** P0 (Critical)

MUST validate complete bug report workflow:

- User submits bug report via dashboard form
- Intake Agent processes within 30 seconds
- Bug categorized correctly (severity: critical/high/medium/low)
- Task created with proper metadata (type: bug, priority, assignee)
- Notification sent to Build Agent Telegram channel within 60 seconds
- Dashboard shows new task in queue
- Analytics data attached (user session, browser, logs)

**Acceptance Criteria:**

- Test completes in <45 seconds (allows 15s buffer)
- All database records created (feedback, triage_result, task, notification)
- Task has correct priority based on severity
- Notification contains actionable bug details
- Test runs 100% reliably (no flakiness)

#### FR-2: End-to-End Feature Request Aggregation

**Priority:** P0 (Critical)

MUST validate feature request aggregation workflow:

- Multiple users submit similar feature requests
- Intake Agent extracts feature descriptions
- Triage system detects similarity (>70% semantic match)
- Similar requests aggregated into single epic
- Epic created after threshold reached (3+ requests)
- Notification sent to Planning Agent with vote count
- Dashboard shows aggregated request with upvote count

**Acceptance Criteria:**

- Test submits 5 similar requests, 2 dissimilar requests
- Triage correctly groups 5 similar into 1 epic
- 2 dissimilar requests remain separate
- Epic has request_count = 5
- Epic priority calculated from aggregate severity
- Test completes in <2 minutes

#### FR-3: Critical Feedback Notification Speed

**Priority:** P0 (Critical)

MUST validate critical feedback notification SLA:

- User submits critical bug (severity: critical)
- Intake processes within 15 seconds
- Triage classifies as high-priority
- Notification sent to Telegram within 60 seconds total
- Dashboard shows real-time alert badge
- Email sent to on-call engineer

**Acceptance Criteria:**

- Submission → notification delivery in <60 seconds
- Test uses real WebSocket connection (not mocked)
- Telegram notification contains: severity, description, affected component
- Dashboard alert badge appears within 5 seconds
- Test validates timestamp gaps at each stage

#### FR-4: Load Test - 100 Submissions Per Minute

**Priority:** P1 (High)

MUST validate system handles production load:

- Simulate 100 concurrent feedback submissions
- Sustained rate of 100/minute for 5 minutes (500 total)
- Mix: 60% feature requests, 30% bugs, 10% satisfaction surveys
- All submissions processed successfully
- No backlog buildup (queue clears within 2 minutes of test end)
- Database remains responsive (<100ms query latency)
- No errors or timeouts

**Acceptance Criteria:**

- 500 submissions → 500 intake records created
- <1% failure rate (max 5 failures)
- Average intake processing time <10 seconds
- Database query p95 latency <200ms
- WebSocket connection remains stable
- Test runs in <10 minutes total

#### FR-5: Stress Test - 10x Normal Load

**Priority:** P1 (High)

MUST validate graceful degradation:

- Simulate 1000 submissions/minute (10x normal)
- Sustained for 2 minutes (2000 submissions)
- System prioritizes critical feedback
- Non-critical feedback queued for later processing
- Rate limiting activates above threshold
- Error messages are user-friendly
- No data loss (all submissions logged)

**Acceptance Criteria:**

- Critical bugs processed within 60 seconds even under load
- Non-critical feedback queued (status: pending)
- Rate limit HTTP 429 returned with retry-after header
- <5% submission failures
- No database corruption
- System recovers to normal within 5 minutes
- Test includes recovery validation phase

#### FR-6: Analytics Data Enrichment Integration

**Priority:** P1 (High)

MUST validate analytics pipeline:

- Bug report includes session data, browser info, console logs
- Intake Agent extracts structured analytics data
- Analytics service enriches with: user history, previous bugs, session replay URL
- Enriched data attached to created task
- Task has complete debugging context

**Acceptance Criteria:**

- Test submits bug with mock analytics payload
- Intake extracts: browser, OS, session_id, error_stack
- Analytics service adds: user_id, previous_bug_count, session_replay_url
- Task metadata contains all enriched fields
- Test validates data types and required fields

#### FR-7: Satisfaction Survey Trigger Integration

**Priority:** P2 (Medium)

MUST validate survey trigger logic:

- User completes task (build success, deployment, etc.)
- Survey trigger evaluates rules (time since last survey, completion count)
- Survey sent at correct intervals (e.g., every 5th completion)
- Survey submission creates feedback record
- Negative feedback (score <3) creates follow-up task

**Acceptance Criteria:**

- Test simulates 10 task completions
- Surveys sent on completions: 5, 10 (every 5th)
- Survey submission creates feedback with type: survey
- Negative feedback (score: 2) creates task type: improvement
- Test validates survey not sent too frequently

#### FR-8: Chaos Test - Intake Agent Failure Recovery

**Priority:** P1 (High)

MUST validate system resilience:

- Simulate intake agent crash (process kill)
- Feedback submissions continue during downtime
- Submissions queued in database
- Orchestrator detects agent failure
- Agent respawns automatically
- Queued feedback processed in FIFO order
- No feedback lost

**Acceptance Criteria:**

- Test kills intake agent process
- Submits 20 feedback items during downtime
- Agent respawns within 30 seconds
- All 20 items processed after recovery
- Processing order maintained (FIFO)
- Test validates retry logic and backoff

### Non-Functional Requirements

#### NFR-1: Test Execution Speed

- Full test suite completes in <30 minutes
- Individual E2E tests complete in <2 minutes each
- Load tests complete in <10 minutes
- Parallel execution of independent tests
- Test setup/teardown optimized (<5 seconds)

#### NFR-2: Test Reliability

- 0% flakiness on critical path tests (FR-1, FR-2, FR-3)
- <2% flakiness on load/stress tests (FR-4, FR-5)
- Deterministic test data (no randomness in assertions)
- Proper test isolation (no shared state)
- Automatic retry on infrastructure failures only

#### NFR-3: Test Coverage

- > 80% code coverage for feedback loop components
- 100% coverage of critical paths (bug report, critical notification)
- All error paths tested (network failures, timeouts, invalid data)
- Edge cases covered (empty submissions, malformed data, concurrent updates)

#### NFR-4: CI/CD Integration

- Tests run on every PR to main/develop
- Tests run on scheduled cron (daily)
- Test failures block PR merging
- Test reports uploaded as artifacts
- Flaky test detection and quarantine

#### NFR-5: Observability

- Test execution logged with timestamps
- Performance metrics exported (Prometheus format)
- Test failures include full context (request/response bodies, logs)
- Screenshots/traces for UI-based tests
- Database state snapshots on failure

---

## Technical Design

### Architecture

```
parent-harness/orchestrator/src/__tests__/integration/feedback-loop/
├── e2e/
│   ├── bug-report.test.ts           # FR-1: Bug report E2E
│   ├── feature-aggregation.test.ts  # FR-2: Feature request aggregation
│   ├── critical-notification.test.ts # FR-3: Critical feedback SLA
│   └── survey-trigger.test.ts       # FR-7: Survey trigger logic
├── performance/
│   ├── load-test.test.ts            # FR-4: 100/min load test
│   └── stress-test.test.ts          # FR-5: 10x stress test
├── integration/
│   ├── analytics-enrichment.test.ts # FR-6: Analytics pipeline
│   ├── intake-triage.test.ts        # Intake ↔ Triage integration
│   └── triage-task-creation.test.ts # Triage → Task integration
├── chaos/
│   └── intake-failure.test.ts       # FR-8: Agent failure recovery
├── fixtures/
│   ├── feedback-samples.ts          # Mock feedback data
│   ├── analytics-payloads.ts        # Mock analytics data
│   └── user-sessions.ts             # Mock user sessions
└── utils/
    ├── feedback-helpers.ts          # Test utilities
    ├── timing-assertions.ts         # SLA validation helpers
    └── load-generators.ts           # Load testing utilities
```

### Test Infrastructure

#### 1. Test Database Setup

Each test suite gets isolated database:

```typescript
// utils/test-db-setup.ts
import { Database } from "better-sqlite3";
import { migrate } from "../db/migrations";

export async function setupTestDatabase(): Promise<Database> {
  const db = new Database(":memory:");

  // Apply migrations
  await migrate(db);

  // Seed required reference data
  await seedReferenceData(db);

  return db;
}

export async function teardownTestDatabase(db: Database): Promise<void> {
  db.close();
}

async function seedReferenceData(db: Database): Promise<void> {
  // Seed agent metadata
  db.exec(`
    INSERT INTO agents (id, name, type, model, status)
    VALUES
      ('intake-agent', 'Intake Agent', 'intake', 'sonnet', 'active'),
      ('planning-agent', 'Planning Agent', 'planning', 'opus', 'active'),
      ('build-agent', 'Build Agent', 'build', 'opus', 'active');
  `);

  // Seed feedback categories
  db.exec(`
    INSERT INTO feedback_categories (id, name, description)
    VALUES
      ('bug', 'Bug Report', 'Software defects and errors'),
      ('feature', 'Feature Request', 'New feature suggestions'),
      ('survey', 'Satisfaction Survey', 'User satisfaction feedback');
  `);
}
```

#### 2. Mock Intake Agent

For deterministic testing, mock the Intake Agent responses:

```typescript
// fixtures/mock-intake-agent.ts
import { IntakeAgent } from "../../agents/intake";

export class MockIntakeAgent extends IntakeAgent {
  private mockDelay: number = 0;
  private shouldFail: boolean = false;

  constructor(config: { delay?: number; shouldFail?: boolean } = {}) {
    super();
    this.mockDelay = config.delay || 0;
    this.shouldFail = config.shouldFail || false;
  }

  async processFeedback(submission: FeedbackSubmission): Promise<IntakeResult> {
    // Simulate processing delay
    await sleep(this.mockDelay);

    if (this.shouldFail) {
      throw new Error("Intake agent failure simulation");
    }

    // Extract structured data from submission
    return {
      id: submission.id,
      category: this.categorize(submission.description),
      severity: this.assessSeverity(submission),
      structured_data: {
        title: this.extractTitle(submission.description),
        description: submission.description,
        affected_component: this.detectComponent(submission.description),
        reproduction_steps: this.extractSteps(submission.description),
      },
      confidence: 0.95,
      processing_time_ms: this.mockDelay,
    };
  }

  private categorize(description: string): string {
    if (/crash|error|fail|broken/i.test(description)) return "bug";
    if (/feature|add|want|wish|should/i.test(description)) return "feature";
    return "other";
  }

  private assessSeverity(submission: FeedbackSubmission): string {
    const desc = submission.description.toLowerCase();
    if (/critical|crash|data loss|security/i.test(desc)) return "critical";
    if (/urgent|high|blocker/i.test(desc)) return "high";
    if (/medium|moderate/i.test(desc)) return "medium";
    return "low";
  }
}
```

#### 3. Load Testing Utilities

```typescript
// utils/load-generators.ts
import { performance } from "perf_hooks";

export interface LoadTestConfig {
  ratePerMinute: number;
  durationMinutes: number;
  feedbackTypes: { type: string; weight: number }[];
}

export interface LoadTestResult {
  totalSubmitted: number;
  totalProcessed: number;
  failures: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughput: number; // submissions/second
}

export async function runLoadTest(
  config: LoadTestConfig,
  submitFeedback: (data: any) => Promise<any>,
): Promise<LoadTestResult> {
  const startTime = performance.now();
  const endTime = startTime + config.durationMinutes * 60 * 1000;
  const intervalMs = (60 * 1000) / config.ratePerMinute;

  const results: number[] = [];
  const failures: Error[] = [];
  let submitted = 0;
  let processed = 0;

  while (performance.now() < endTime) {
    const feedbackType = selectWeightedType(config.feedbackTypes);
    const feedback = generateFeedback(feedbackType);

    submitted++;
    const reqStart = performance.now();

    try {
      await submitFeedback(feedback);
      const latency = performance.now() - reqStart;
      results.push(latency);
      processed++;
    } catch (err) {
      failures.push(err as Error);
    }

    // Wait for next interval
    await sleep(intervalMs);
  }

  // Calculate percentiles
  results.sort((a, b) => a - b);
  const p95Index = Math.floor(results.length * 0.95);
  const p99Index = Math.floor(results.length * 0.99);

  const durationSec = (performance.now() - startTime) / 1000;

  return {
    totalSubmitted: submitted,
    totalProcessed: processed,
    failures: failures.length,
    avgLatencyMs: results.reduce((a, b) => a + b, 0) / results.length,
    p95LatencyMs: results[p95Index],
    p99LatencyMs: results[p99Index],
    throughput: processed / durationSec,
  };
}

function selectWeightedType(types: { type: string; weight: number }[]): string {
  const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  for (const type of types) {
    random -= type.weight;
    if (random <= 0) return type.type;
  }

  return types[0].type;
}

function generateFeedback(type: string): any {
  const templates = {
    bug: [
      "The build agent crashes when processing TypeScript files",
      'Tests fail with "Cannot read property of undefined" error',
      "Dashboard not loading, shows blank screen",
    ],
    feature: [
      "Add dark mode to dashboard",
      "Support exporting tasks to CSV",
      "Add keyboard shortcuts for navigation",
    ],
    survey: ["Rate your experience with the platform"],
  };

  const descriptions = templates[type] || templates.bug;
  const description =
    descriptions[Math.floor(Math.random() * descriptions.length)];

  return {
    type,
    description,
    user_id: `test-user-${Math.floor(Math.random() * 1000)}`,
    metadata: {
      browser: "Chrome 120",
      os: "macOS 14",
      session_id: `session-${Date.now()}`,
    },
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

#### 4. Timing Assertion Helpers

```typescript
// utils/timing-assertions.ts
import { expect } from "vitest";

export interface TimingAssertion {
  stage: string;
  maxDurationMs: number;
  actualDurationMs?: number;
}

export class TimingValidator {
  private stages: Map<string, number> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  markStage(name: string): void {
    const now = Date.now();
    this.stages.set(name, now - this.startTime);
  }

  assertStageDuration(stage: string, maxMs: number): void {
    const duration = this.stages.get(stage);
    expect(duration, `Stage "${stage}" exceeded time limit`).toBeLessThan(
      maxMs,
    );
  }

  assertEndToEndDuration(maxMs: number): void {
    const total = Date.now() - this.startTime;
    expect(total, "End-to-end duration exceeded limit").toBeLessThan(maxMs);
  }

  getStageDurations(): Map<string, number> {
    return new Map(this.stages);
  }

  getReport(): string {
    const lines: string[] = ["Timing Report:"];
    for (const [stage, duration] of this.stages.entries()) {
      lines.push(`  ${stage}: ${duration}ms`);
    }
    lines.push(`  Total: ${Date.now() - this.startTime}ms`);
    return lines.join("\n");
  }
}
```

### Test Implementation Examples

#### Example 1: Bug Report E2E Test

```typescript
// e2e/bug-report.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../utils/test-db-setup";
import { MockIntakeAgent } from "../fixtures/mock-intake-agent";
import { TimingValidator } from "../utils/timing-assertions";
import { submitFeedback } from "../../feedback/submission";
import { query } from "../../db";

describe("FR-1: Bug Report E2E Flow", () => {
  let db: Database;
  let intakeAgent: MockIntakeAgent;

  beforeEach(async () => {
    db = await setupTestDatabase();
    intakeAgent = new MockIntakeAgent({ delay: 2000 }); // 2s processing
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("should process bug report end-to-end within 30 seconds", async () => {
    const timing = new TimingValidator();

    // GIVEN: User submits bug report
    const bugReport = {
      type: "bug",
      description: "Dashboard crashes when clicking on task details",
      severity: "high",
      user_id: "test-user-001",
      metadata: {
        browser: "Chrome 120",
        os: "macOS 14",
        session_id: "session-12345",
        error_stack: 'TypeError: Cannot read property "id" of undefined',
      },
    };

    timing.markStage("submission_start");
    const submissionId = await submitFeedback(bugReport);
    timing.markStage("submission_complete");

    // WHEN: Intake Agent processes feedback
    const intakeResult = await intakeAgent.processFeedback({
      id: submissionId,
      ...bugReport,
    });
    timing.markStage("intake_complete");

    // THEN: Task created within 30 seconds
    const tasks = await query(
      `
      SELECT * FROM tasks
      WHERE source_feedback_id = ?
    `,
      [submissionId],
    );

    timing.markStage("task_created");

    expect(tasks).toHaveLength(1);
    const task = tasks[0];

    // Validate task fields
    expect(task.type).toBe("bug");
    expect(task.priority).toBe("high");
    expect(task.status).toBe("pending");
    expect(task.title).toContain("Dashboard crashes");

    // Validate notification sent
    const notifications = await query(
      `
      SELECT * FROM notifications
      WHERE entity_id = ? AND entity_type = 'task'
    `,
      [task.id],
    );

    timing.markStage("notification_sent");

    expect(notifications).toHaveLength(1);
    expect(notifications[0].channel).toBe("telegram");
    expect(notifications[0].recipient).toBe("build-agent");
    expect(notifications[0].status).toBe("sent");

    // Assert timing constraints
    timing.assertStageDuration("submission_complete", 5000); // <5s for submission
    timing.assertStageDuration("intake_complete", 10000); // <10s total for intake
    timing.assertStageDuration("task_created", 25000); // <25s total for task creation
    timing.assertStageDuration("notification_sent", 30000); // <30s total for notification

    console.log(timing.getReport());
  });

  it("should attach analytics data to created task", async () => {
    // GIVEN: Bug report with analytics payload
    const bugReport = {
      type: "bug",
      description: "Build fails with TypeScript error",
      severity: "medium",
      user_id: "test-user-002",
      metadata: {
        browser: "Firefox 121",
        os: "Ubuntu 22.04",
        session_id: "session-67890",
        console_logs: [
          'ERROR: Type "string" is not assignable to type "number"',
        ],
        session_replay_url: "https://replay.service/session-67890",
      },
    };

    // WHEN: Feedback processed
    const submissionId = await submitFeedback(bugReport);
    const intakeResult = await intakeAgent.processFeedback({
      id: submissionId,
      ...bugReport,
    });

    // THEN: Task has enriched analytics data
    const tasks = await query(
      "SELECT * FROM tasks WHERE source_feedback_id = ?",
      [submissionId],
    );
    const task = tasks[0];

    const metadata = JSON.parse(task.metadata);

    expect(metadata.analytics).toBeDefined();
    expect(metadata.analytics.browser).toBe("Firefox 121");
    expect(metadata.analytics.os).toBe("Ubuntu 22.04");
    expect(metadata.analytics.session_id).toBe("session-67890");
    expect(metadata.analytics.console_logs).toHaveLength(1);
    expect(metadata.analytics.session_replay_url).toBe(
      "https://replay.service/session-67890",
    );
  });
});
```

#### Example 2: Load Test

```typescript
// performance/load-test.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../utils/test-db-setup";
import { runLoadTest, LoadTestConfig } from "../utils/load-generators";
import { submitFeedback } from "../../feedback/submission";
import { query } from "../../db";

describe("FR-4: Load Test - 100 Submissions Per Minute", () => {
  let db: Database;

  beforeEach(async () => {
    db = await setupTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("should handle 100 submissions/minute for 5 minutes", async () => {
    // GIVEN: Load test configuration
    const config: LoadTestConfig = {
      ratePerMinute: 100,
      durationMinutes: 5,
      feedbackTypes: [
        { type: "feature", weight: 60 },
        { type: "bug", weight: 30 },
        { type: "survey", weight: 10 },
      ],
    };

    // WHEN: Load test executes
    const result = await runLoadTest(config, submitFeedback);

    // THEN: All submissions processed successfully
    expect(result.totalSubmitted).toBe(500); // 100/min * 5 min
    expect(result.totalProcessed).toBeGreaterThanOrEqual(495); // <1% failure
    expect(result.failures).toBeLessThan(5); // <1% failure rate

    // Average latency acceptable
    expect(result.avgLatencyMs).toBeLessThan(10000); // <10s average

    // P95 latency acceptable
    expect(result.p95LatencyMs).toBeLessThan(20000); // <20s P95

    // Throughput meets target
    expect(result.throughput).toBeGreaterThan(1.5); // >1.5 submissions/sec

    // Validate database state
    const feedbackRecords = await query(
      "SELECT COUNT(*) as count FROM feedback_submissions",
    );
    expect(feedbackRecords[0].count).toBeGreaterThanOrEqual(495);

    // Validate no queue buildup
    const pendingIntake = await query(`
      SELECT COUNT(*) as count FROM feedback_submissions
      WHERE status = 'pending'
    `);
    expect(pendingIntake[0].count).toBeLessThan(10); // Queue mostly cleared

    console.log("Load Test Results:", {
      submitted: result.totalSubmitted,
      processed: result.totalProcessed,
      failures: result.failures,
      avgLatency: `${result.avgLatencyMs.toFixed(0)}ms`,
      p95Latency: `${result.p95LatencyMs.toFixed(0)}ms`,
      throughput: `${result.throughput.toFixed(2)}/s`,
    });
  }, 600000); // 10 minute timeout
});
```

#### Example 3: Chaos Test

```typescript
// chaos/intake-failure.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
} from "../utils/test-db-setup";
import { submitFeedback } from "../../feedback/submission";
import { IntakeOrchestrator } from "../../orchestrator/intake-orchestrator";
import { query } from "../../db";

describe("FR-8: Chaos Test - Intake Agent Failure Recovery", () => {
  let db: Database;
  let orchestrator: IntakeOrchestrator;

  beforeEach(async () => {
    db = await setupTestDatabase();
    orchestrator = new IntakeOrchestrator({ db, respawnDelay: 5000 });
    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.stop();
    await teardownTestDatabase(db);
  });

  it("should recover from intake agent crash and process queued feedback", async () => {
    // GIVEN: Intake agent is running
    expect(orchestrator.getAgentStatus()).toBe("active");

    // Submit 10 feedback items (should process normally)
    const normalSubmissions = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        submitFeedback({
          type: "bug",
          description: `Normal bug ${i}`,
          user_id: `user-${i}`,
        }),
      ),
    );

    // Wait for processing
    await sleep(3000);

    // Verify processed
    const processedNormal = await query(`
      SELECT COUNT(*) as count FROM feedback_submissions
      WHERE status = 'processed'
    `);
    expect(processedNormal[0].count).toBe(10);

    // WHEN: Kill intake agent
    await orchestrator.killAgent();
    expect(orchestrator.getAgentStatus()).toBe("crashed");

    // Submit 20 feedback items during downtime
    const downtimeSubmissions = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        submitFeedback({
          type: "bug",
          description: `Downtime bug ${i}`,
          user_id: `user-${i + 100}`,
        }),
      ),
    );

    // Verify queued (not processed)
    const queued = await query(`
      SELECT COUNT(*) as count FROM feedback_submissions
      WHERE status = 'pending'
    `);
    expect(queued[0].count).toBe(20);

    // THEN: Orchestrator detects failure and respawns agent
    await sleep(6000); // Wait for respawn delay + startup

    expect(orchestrator.getAgentStatus()).toBe("active");

    // All queued feedback processed in FIFO order
    await sleep(10000); // Wait for processing

    const processedAfterRecovery = await query(`
      SELECT COUNT(*) as count FROM feedback_submissions
      WHERE status = 'processed'
    `);
    expect(processedAfterRecovery[0].count).toBe(30); // 10 normal + 20 downtime

    // Verify FIFO order maintained
    const processedOrder = await query(`
      SELECT id, created_at, processed_at
      FROM feedback_submissions
      WHERE status = 'processed'
      ORDER BY processed_at ASC
    `);

    // First 10 should be normal submissions
    for (let i = 0; i < 10; i++) {
      expect(normalSubmissions).toContain(processedOrder[i].id);
    }

    // Next 20 should be downtime submissions
    for (let i = 10; i < 30; i++) {
      expect(downtimeSubmissions).toContain(processedOrder[i].id);
    }

    console.log("Chaos test completed successfully");
  }, 60000); // 1 minute timeout
});
```

---

## Pass Criteria

### Critical E2E Tests (P0)

| #   | Criterion                         | Validation Method                                      | Target                             |
| --- | --------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| 1   | Bug report E2E completes in <30s  | Timing validator on FR-1 test                          | <30000ms                           |
| 2   | Feature request aggregation works | FR-2 test creates epic from 5 similar requests         | Epic created with count=5          |
| 3   | Critical notification SLA met     | FR-3 test validates <60s total                         | <60000ms submission → notification |
| 4   | All database records created      | FR-1 validates feedback → intake → task → notification | All 4 records exist                |
| 5   | Analytics data enrichment         | FR-6 test validates analytics attached to task         | Task metadata contains analytics   |
| 6   | Survey trigger logic correct      | FR-7 test validates survey sent every 5th completion   | Surveys sent on 5th, 10th          |

### Performance Tests (P1)

| #   | Criterion                    | Validation Method                    | Target                       |
| --- | ---------------------------- | ------------------------------------ | ---------------------------- |
| 7   | Load test: 100/min sustained | FR-4 test submits 500 over 5 minutes | >495 processed (<1% failure) |
| 8   | Average latency acceptable   | FR-4 measures avg processing time    | <10000ms average             |
| 9   | P95 latency acceptable       | FR-4 measures 95th percentile        | <20000ms P95                 |
| 10  | Database query performance   | FR-4 measures DB latency             | <200ms P95                   |

### Stress Tests (P1)

| #   | Criterion                     | Validation Method                           | Target                        |
| --- | ----------------------------- | ------------------------------------------- | ----------------------------- |
| 11  | Stress test: 10x load handled | FR-5 submits 1000/min for 2 minutes         | <5% failure rate              |
| 12  | Critical feedback prioritized | FR-5 validates critical bugs processed fast | <60s even under stress        |
| 13  | Graceful degradation          | FR-5 validates rate limiting activates      | HTTP 429 returned             |
| 14  | System recovery               | FR-5 validates system returns to normal     | Normal processing within 5min |

### Chaos Tests (P1)

| #   | Criterion              | Validation Method                                    | Target                             |
| --- | ---------------------- | ---------------------------------------------------- | ---------------------------------- |
| 15  | Agent failure recovery | FR-8 kills agent and validates respawn               | Agent respawns in <30s             |
| 16  | No feedback lost       | FR-8 validates all 20 downtime submissions processed | All 20 processed                   |
| 17  | FIFO order maintained  | FR-8 validates processing order                      | Queued feedback processed in order |

### Test Infrastructure (P0)

| #   | Criterion              | Validation Method                         | Target              |
| --- | ---------------------- | ----------------------------------------- | ------------------- |
| 18  | Test coverage >80%     | Coverage report for feedback loop modules | >80% line coverage  |
| 19  | CI pipeline runs tests | GitHub Actions workflow executes tests    | All tests run on PR |
| 20  | Test execution time    | Full suite duration                       | <30 minutes         |
| 21  | Test reliability       | Flakiness rate measurement                | <2% flaky tests     |

---

## Dependencies

### Upstream Dependencies (Must Exist First)

| Dependency              | Description                         | Status                                              |
| ----------------------- | ----------------------------------- | --------------------------------------------------- |
| Feedback Submission API | `/api/feedback/submit` endpoint     | ❓ Unknown                                          |
| Intake Agent            | Agent that processes feedback       | ❓ Unknown                                          |
| Triage System           | Classifies and aggregates feedback  | ❓ Unknown                                          |
| Task Creation Service   | Creates tasks from triaged feedback | ✅ Exists (`parent-harness/orchestrator/src/tasks`) |
| Notification Service    | Sends Telegram/email notifications  | ❓ Unknown                                          |
| Analytics Service       | Enriches feedback with session data | ❓ Unknown                                          |

### Downstream Dependencies (Enabled By This)

| Component             | How It Benefits                            |
| --------------------- | ------------------------------------------ |
| Production Monitoring | Test metrics guide alerting thresholds     |
| Capacity Planning     | Load test results inform scaling decisions |
| SLA Definitions       | Test SLAs become production SLAs           |
| Chaos Engineering     | Chaos tests validate disaster recovery     |

---

## Implementation Plan

### Phase 1: Test Infrastructure Setup (4 hours)

1. **Create test directory structure** (30 min)
   - Set up `__tests__/integration/feedback-loop/` directories
   - Create subdirectories: e2e, performance, integration, chaos, fixtures, utils

2. **Implement test database setup** (1 hour)
   - Create `setupTestDatabase()` with in-memory SQLite
   - Create `seedReferenceData()` for agents, categories
   - Create `teardownTestDatabase()` cleanup

3. **Create mock fixtures** (1.5 hours)
   - Implement `MockIntakeAgent` with configurable delay/failure
   - Create `feedback-samples.ts` with realistic data
   - Create `analytics-payloads.ts` with mock analytics

4. **Build test utilities** (1 hour)
   - Implement `TimingValidator` for SLA assertions
   - Create `load-generators.ts` for load testing
   - Create `feedback-helpers.ts` for common operations

### Phase 2: E2E Tests (6 hours)

5. **Bug Report E2E (FR-1)** (1.5 hours)
   - Test: submission → intake → task → notification in <30s
   - Test: analytics data attached to task
   - Validate all database records created

6. **Feature Aggregation E2E (FR-2)** (1.5 hours)
   - Test: 5 similar requests → 1 epic
   - Test: 2 dissimilar requests remain separate
   - Validate aggregation logic

7. **Critical Notification E2E (FR-3)** (1.5 hours)
   - Test: critical bug → notification in <60s
   - Test: Telegram notification contains correct data
   - Test: dashboard alert badge appears

8. **Survey Trigger E2E (FR-7)** (1.5 hours)
   - Test: survey sent every 5th completion
   - Test: negative feedback creates follow-up task
   - Validate trigger logic

### Phase 3: Performance Tests (6 hours)

9. **Load Test Implementation (FR-4)** (3 hours)
   - Implement `runLoadTest()` utility
   - Test: 100 submissions/min for 5 minutes
   - Validate: <1% failure, <10s avg latency
   - Measure: throughput, P95/P99 latency

10. **Stress Test Implementation (FR-5)** (3 hours)
    - Test: 1000 submissions/min for 2 minutes
    - Validate: critical feedback prioritized
    - Validate: rate limiting activates
    - Validate: system recovers in <5 minutes

### Phase 4: Integration Tests (4 hours)

11. **Analytics Enrichment Integration (FR-6)** (2 hours)
    - Test: analytics data extracted from submission
    - Test: analytics service enriches with user history
    - Validate: enriched data attached to task

12. **Intake ↔ Triage Integration** (1 hour)
    - Test: intake output matches triage input format
    - Test: triage classification updates feedback status
    - Validate: data flow between components

13. **Triage → Task Creation Integration** (1 hour)
    - Test: triage result creates appropriate task type
    - Test: task priority matches triage severity
    - Validate: task metadata includes triage context

### Phase 5: Chaos Tests (3 hours)

14. **Intake Agent Failure Recovery (FR-8)** (3 hours)
    - Test: agent respawns after crash
    - Test: queued feedback processed after recovery
    - Test: FIFO order maintained
    - Validate: no data loss

### Phase 6: CI/CD Integration (3 hours)

15. **GitHub Actions Workflow** (2 hours)
    - Create `.github/workflows/feedback-loop-tests.yml`
    - Configure matrix strategy for parallel tests
    - Set up test report uploads
    - Configure PR comment with results

16. **Coverage Configuration** (1 hour)
    - Configure Vitest coverage for feedback modules
    - Set coverage thresholds (>80%)
    - Generate HTML coverage reports
    - Upload coverage artifacts

### Phase 7: Documentation & Validation (2 hours)

17. **Write Test Documentation** (1 hour)
    - Document test suite structure
    - Create README for test directory
    - Document how to run tests locally
    - Document CI/CD integration

18. **Final Validation** (1 hour)
    - Run full test suite locally
    - Validate all pass criteria met
    - Run in CI environment
    - Review coverage reports

**Total Estimated Effort:** 28 hours (~3.5 days)

---

## Testing Strategy

### Test Pyramid for Feedback Loop

```
              /\
             /  \  E2E Tests (4 tests)           [20%]
            /────\  - Bug report flow
           /      \ - Feature aggregation
          /────────\  - Critical notification
         /          \ - Survey trigger
        /            \
       / Integration  \ Integration Tests (3 tests) [30%]
      /──────────────\  - Analytics enrichment
     /                \ - Intake ↔ Triage
    /──────────────────\ - Triage → Task creation
   /                    \
  / Performance + Chaos  \ Performance/Chaos (3 tests) [30%]
 /────────────────────────\ - Load test (100/min)
/                          \ - Stress test (10x)
────────────────────────────  - Chaos test (failure recovery)
        Unit Tests (not in scope) [20%]
```

### Test Data Strategy

**Approach:** Factory functions with realistic defaults

```typescript
// fixtures/feedback-samples.ts
export function createBugReport(overrides?: Partial<FeedbackSubmission>) {
  return {
    type: "bug",
    description: "Dashboard crashes when clicking task details",
    severity: "high",
    user_id: "test-user-001",
    metadata: {
      browser: "Chrome 120",
      os: "macOS 14",
      session_id: `session-${Date.now()}`,
    },
    ...overrides,
  };
}

export function createFeatureRequest(overrides?: Partial<FeedbackSubmission>) {
  return {
    type: "feature",
    description: "Add dark mode to dashboard",
    severity: "medium",
    user_id: "test-user-002",
    metadata: {},
    ...overrides,
  };
}
```

### Test Isolation Strategy

**Each test gets:**

- Fresh in-memory database
- Isolated agent instances
- Independent test data
- Clean state before/after

**No shared state:**

- No global variables
- No cross-test dependencies
- No database fixtures shared between tests

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/feedback-loop-tests.yml
name: Feedback Loop Integration Tests

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]
  schedule:
    - cron: "0 2 * * *" # Daily at 2am UTC

jobs:
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 45

    strategy:
      matrix:
        shard: [1, 2, 3, 4]
      fail-fast: false

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci
        working-directory: parent-harness/orchestrator

      - name: Run integration tests (shard ${{ matrix.shard }}/4)
        run: |
          npm run test:integration:feedback -- \
            --shard=${{ matrix.shard }}/4 \
            --reporter=json \
            --reporter=verbose
        working-directory: parent-harness/orchestrator
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.shard }}
          path: parent-harness/orchestrator/test-results/
          retention-days: 30

      - name: Upload coverage
        if: matrix.shard == 1
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: parent-harness/orchestrator/coverage/
          retention-days: 30

  merge-reports:
    name: Merge Test Reports
    needs: integration-tests
    runs-on: ubuntu-latest
    if: always()

    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          path: test-results

      - name: Merge JSON reports
        run: |
          jq -s 'reduce .[] as $item ({}; . * $item)' \
            test-results/*/results.json > merged-results.json

      - name: Upload merged report
        uses: actions/upload-artifact@v4
        with:
          name: merged-test-report
          path: merged-results.json
          retention-days: 30

  pr-comment:
    name: PR Comment with Results
    needs: merge-reports
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/download-artifact@v4
        with:
          name: merged-test-report

      - name: Parse test results
        id: results
        run: |
          TOTAL=$(jq '.numTotalTests' merged-results.json)
          PASSED=$(jq '.numPassedTests' merged-results.json)
          FAILED=$(jq '.numFailedTests' merged-results.json)
          echo "total=$TOTAL" >> $GITHUB_OUTPUT
          echo "passed=$PASSED" >> $GITHUB_OUTPUT
          echo "failed=$FAILED" >> $GITHUB_OUTPUT

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const { total, passed, failed } = ${{ toJSON(steps.results.outputs) }};
            const emoji = failed > 0 ? '❌' : '✅';
            const body = `${emoji} **Feedback Loop Integration Tests**

            - Total: ${total}
            - Passed: ${passed}
            - Failed: ${failed}

            [View full report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})`;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

---

## Success Metrics

### Operational Metrics

| Metric                 | Target      | Measurement                        |
| ---------------------- | ----------- | ---------------------------------- |
| **Test Suite Runtime** | <30 minutes | GitHub Actions workflow duration   |
| **Test Pass Rate**     | >98%        | (passed / total) × 100             |
| **Flakiness Rate**     | <2%         | Tests that fail then pass on retry |
| **Code Coverage**      | >80%        | Vitest coverage report             |
| **CI Success Rate**    | >95%        | Successful CI runs / total runs    |

### Quality Metrics

| Metric                   | Target | Measurement                             |
| ------------------------ | ------ | --------------------------------------- |
| **E2E Test Reliability** | 100%   | FR-1, FR-2, FR-3 never flaky            |
| **Load Test Throughput** | >1.5/s | Submissions processed per second        |
| **Stress Test Recovery** | <5 min | Time to return to normal after 10x load |
| **Chaos Test Success**   | 100%   | Agent recovery always succeeds          |

### Business Impact

| Metric                     | Target  | Measurement                                |
| -------------------------- | ------- | ------------------------------------------ |
| **Production Incidents**   | -50%    | Incidents prevented by tests               |
| **Bug Escape Rate**        | <5%     | Bugs found in prod vs. tests               |
| **Mean Time to Detection** | <1 hour | Time from bug introduction to test failure |
| **Developer Confidence**   | >8/10   | Survey: confidence in feedback system      |

---

## Rollback Plan

If tests cause issues:

1. **Disable flaky tests** - Mark with `test.skip()` and create issue
2. **Reduce test frequency** - Change cron from daily to weekly
3. **Disable load tests** - Comment out FR-4, FR-5 if infrastructure impact
4. **Disable chaos tests** - Comment out FR-8 if agent stability concerns
5. **Revert test infrastructure** - Remove test directory, restore previous state

---

## Future Enhancements (Out of Scope)

1. **Visual Regression Tests** - Screenshot comparison for dashboard feedback UI
2. **Accessibility Tests** - a11y validation for feedback forms
3. **Multi-Region Tests** - Validate feedback submission from different regions
4. **Fuzz Testing** - Send malformed/malicious feedback to test input validation
5. **Contract Testing** - Validate API contracts between feedback components
6. **Mutation Testing** - Validate test quality by mutating code

---

## Related Documentation

- **PHASE4-TASK-04**: Build Agent Learning from QA Failures (feedback loop pattern)
- **VIBE-P13-010**: Build Agent Integration Tests (integration test pattern reference)
- **VIBE-P14-003**: E2E Test Framework Setup (E2E testing infrastructure)
- **STRATEGIC_PLAN.md**: Phase 4-5 (Memory & Learning, Orchestrator & Execution)

---

## Conclusion

This specification defines a comprehensive integration test suite for the Vibe platform's feedback loop. The test suite validates:

✅ **E2E Flows** - Complete user journeys from submission to notification
✅ **Performance** - System handles production load (100/min sustained)
✅ **Stress Testing** - Graceful degradation under 10x load
✅ **Chaos Engineering** - Recovery from agent failures
✅ **Integration Points** - Component interactions validated
✅ **Timing SLAs** - Critical feedback processed within 60 seconds
✅ **Coverage** - >80% code coverage for feedback components

**Implementation Effort:** 28 hours (~3.5 days)
**Dependencies:** Feedback API, Intake Agent, Triage System, Notification Service
**Test Count:** 11 comprehensive integration tests
**CI Runtime:** <30 minutes with 4-shard parallelization

**Status:** Ready for implementation by Build Agent
**Next Steps:**

1. Confirm feedback loop architecture exists
2. Implement test infrastructure (Phase 1)
3. Implement E2E tests (Phase 2)
4. Implement performance/chaos tests (Phases 3-5)
5. Configure CI/CD (Phase 6)

---

**Document Version:** 1.0
**Created:** 2026-02-09
**Author:** Spec Agent (Autonomous)
**Specification Duration:** Comprehensive analysis and design
