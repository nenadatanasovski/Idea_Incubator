# PHASE2-TASK-03: QA Agent Validation Framework

**Status:** Specification
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Large (10-12 hours)
**Model:** Sonnet
**Agent Type:** qa_agent
**Created:** 2026-02-08

---

## Overview

Implement a comprehensive QA Agent validation framework as the final component of the autonomous task execution pipeline (Spec Agent → Build Agent → QA Agent). The QA Agent independently verifies task completion claims through compile checks, test execution, and artifact verification, ensuring quality standards are met before tasks transition to completed status.

This is the **quality gate** for Phase 2's autonomous execution vision. Without the QA Agent, Build Agents can claim completion without independent verification, leading to untested code, broken builds, and accumulated technical debt.

### Problem Statement

**Current State:**

- QA Agent basic implementation exists (`parent-harness/orchestrator/src/qa/index.ts`)
- Simple checks: TypeScript compilation, build, tests
- Event-driven processing via `qa-service.ts`
- Basic fix task creation on failures
- Limited artifact verification
- No comprehensive validation framework
- No validation level configuration
- Missing spec-based pass criteria verification

**Desired State:**

- Comprehensive validation framework with configurable validation levels
- Artifact verification (files created, APIs working, database migrations applied)
- Spec-based pass criteria checking (not just generic compile/test)
- Structured validation reports with actionable feedback
- Integration with task state machine for proper state transitions
- Performance budgets and timeout handling
- Comprehensive test coverage for QA workflows

### Value Proposition

The QA Agent serves as the **"Quality Gate"** between task execution and completion:

1. **Prevents Broken Builds** - Catches compilation errors before merging
2. **Ensures Test Coverage** - Verifies tests pass and new functionality is tested
3. **Validates Artifacts** - Confirms files exist, APIs respond, migrations work
4. **Enables Autonomy** - Build Agents get objective feedback without human review
5. **Creates Fix Tasks** - Automatically generates fix tasks with failure context
6. **Maintains Standards** - Enforces consistent quality bar across all tasks

---

## Current State Analysis

### Existing Infrastructure ✅

1. **QA Validation Module** (`parent-harness/orchestrator/src/qa/index.ts`)
   - ✅ Basic check execution: TypeScript, build, tests
   - ✅ Task verification workflow: `verifyTask(taskId)`
   - ✅ QA cycle runner: `runQACycle()` for batch processing
   - ✅ Custom command verification: `verifyCommand(command, cwd)`
   - ✅ Fix task creation with unique ID generation
   - ✅ Pass criteria parsing from task JSON
   - ✅ Agent status integration
   - ❌ **Gap:** No artifact verification
   - ❌ **Gap:** No spec-based pass criteria validation
   - ❌ **Gap:** No validation levels (quick/standard/thorough)
   - ❌ **Gap:** Limited structured reporting

2. **QA Service** (`parent-harness/orchestrator/src/events/qa-service.ts`)
   - ✅ Event-driven architecture: subscribes to `task:ready_for_qa`
   - ✅ Queue management with retry logic (max 3 attempts)
   - ✅ Concurrency control (maxConcurrent = 1)
   - ✅ Backpressure handling (CPU high/normal events)
   - ✅ Agent status updates during verification
   - ✅ State machine integration via `transitionTask()`
   - ✅ Error handling with re-queue on transient failures
   - ❌ **Gap:** No validation level support
   - ❌ **Gap:** No performance budgets

3. **Validation Runner** (`agents/build/validation-runner.ts`)
   - ✅ Command execution with timeout (60s default)
   - ✅ Output capture (stdout + stderr)
   - ✅ Exit code checking
   - ✅ Expected output matching (exact, contains, exit code)
   - ✅ Multiple validation sequencing
   - ✅ Fail-fast on first failure
   - ✅ Working directory and environment configuration
   - ❌ **Gap:** Not used by QA agent (parallel implementation)
   - ❌ **Gap:** No artifact verification capabilities

4. **Validation Types** (`types/validation.ts`)
   - ✅ Validation levels: QUICK, STANDARD, THOROUGH, RELEASE
   - ✅ Validation status: pending, running, completed, failed, cancelled
   - ✅ Validator status: pending, running, completed, failed, skipped
   - ✅ Validation run tracking with timestamps
   - ✅ Validator result structure
   - ✅ Level config with time budgets
   - ✅ Validation run request options (failFast, changedFilesOnly)
   - ❌ **Gap:** Not integrated with QA agent workflow

5. **Validation Orchestrator** (`agents/validation/orchestrator.ts`)
   - ✅ Observable agent integration for logging
   - ✅ Level-based validator execution
   - ✅ Validator registry (typescript, vitest, security, coverage)
   - ✅ Result aggregation
   - ✅ Fail-fast support
   - ✅ Assertion chain tracking
   - ❌ **Gap:** Separate system from QA agent

6. **QA API Routes** (`parent-harness/orchestrator/src/api/qa.ts`)
   - ✅ POST `/api/qa/verify/:taskId` - verify single task
   - ✅ POST `/api/qa/run` - run full QA cycle
   - ✅ POST `/api/qa/check` - run custom command
   - ✅ GET `/api/qa/stats` - QA statistics
   - ✅ Error handling with proper status codes
   - ❌ **Gap:** No validation level endpoints
   - ❌ **Gap:** No detailed report retrieval

### Architecture Gaps to Address

1. **Unified Validation System** - Merge ValidationRunner + Validation Orchestrator patterns into QA Agent
2. **Spec-Based Validation** - Parse task spec files to extract and verify pass criteria
3. **Artifact Verification** - Check file existence, API endpoints, database state
4. **Validation Levels** - Quick (compile only), Standard (+ tests), Thorough (+ coverage/security)
5. **Structured Reports** - JSON reports with check results, timing, artifacts verified
6. **Performance Budgets** - Time limits per validation level with timeout handling

---

## Requirements

### Functional Requirements

#### FR-1: Validation Level Support

**Validation Levels:**

- **QUICK** (< 2 min): TypeScript compilation check only
  - Use case: Fast feedback during development iterations
  - Checks: `tsc --noEmit` or `npm run typecheck`

- **STANDARD** (< 5 min): Compilation + tests + artifact existence
  - Use case: Default QA validation for most tasks
  - Checks: TypeScript + `npm test` + file existence checks

- **THOROUGH** (< 15 min): Full validation suite
  - Use case: Pre-merge validation, critical features
  - Checks: All STANDARD + build + coverage analysis + security scan

- **RELEASE** (< 30 min): Production-ready validation
  - Use case: Release candidates, deployment readiness
  - Checks: All THOROUGH + E2E tests + performance tests + artifact verification

**Configuration:**

```typescript
interface ValidationLevelConfig {
  level: "QUICK" | "STANDARD" | "THOROUGH" | "RELEASE";
  timeBudgetMs: number;
  checks: ValidationCheck[];
  required: boolean; // Fail if check fails
  failFast: boolean; // Stop on first failure
}

interface ValidationCheck {
  name: string;
  type: "compile" | "test" | "build" | "artifact" | "api" | "database";
  command?: string;
  expectedOutput?: string;
  timeout: number;
  required: boolean;
  validator?: (context: TaskContext) => Promise<CheckResult>;
}
```

**Task-Level Override:**
Tasks can specify validation level in metadata:

```typescript
task.metadata = {
  validationLevel: "THOROUGH",
  requiredChecks: ["TypeScript", "Tests", "API Health"],
};
```

#### FR-2: Spec-Based Pass Criteria Validation

**Spec File Parsing:**

- Locate spec file: `docs/specs/{TASK_DISPLAY_ID}*.md`
- Parse "Pass Criteria" section
- Extract numbered criteria list
- Map criteria to validation checks

**Criteria Types:**

```typescript
interface PassCriterion {
  index: number;
  description: string;
  type: "compile" | "test" | "file" | "api" | "manual";
  autoVerifiable: boolean;
  checkName?: string;
  validator?: ValidationCheck;
}
```

**Auto-Verification Mapping:**

- "TypeScript compiles" → TypeScript compilation check
- "All tests pass" → Test execution check
- "File X exists" → File existence check
- "API endpoint /api/Y responds" → API health check
- "Database migration applied" → Database state check

**Manual Review Criteria:**

- Criteria that can't be auto-verified are marked as "requires manual review"
- QA report includes manual review checklist
- Manual criteria don't block completion (logged as warnings)

#### FR-3: Artifact Verification

**File Existence Checks:**

```typescript
interface FileArtifact {
  path: string;
  required: boolean;
  minSize?: number; // Bytes
  pattern?: string; // Content must match regex
}

// Example: Verify spec created file
await verifyFileExists("agents/qa/validator.ts");
await verifyFileContains("agents/qa/validator.ts", /export class.*Validator/);
```

**API Endpoint Checks:**

```typescript
interface APIArtifact {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  expectedStatus: number;
  expectedResponse?: object;
  timeout: number;
}

// Example: Verify new API route works
await verifyAPIEndpoint({
  method: "GET",
  endpoint: "http://localhost:3333/api/qa/stats",
  expectedStatus: 200,
  timeout: 5000,
});
```

**Database State Checks:**

```typescript
interface DatabaseArtifact {
  type: "table" | "column" | "record";
  query: string;
  expectedResult?: any;
}

// Example: Verify migration created table
await verifyDatabaseState({
  type: "table",
  query:
    "SELECT name FROM sqlite_master WHERE type='table' AND name='qa_reports'",
  expectedResult: [{ name: "qa_reports" }],
});
```

#### FR-4: Structured Validation Reports

**Report Schema:**

```typescript
interface QAValidationReport {
  id: string; // UUID
  taskId: string;
  taskDisplayId: string;
  validationLevel: string;
  status: "passed" | "failed" | "partial";
  startedAt: string;
  completedAt: string;
  durationMs: number;

  checks: CheckResult[];
  passCriteria: PassCriterionResult[];
  artifacts: ArtifactResult[];

  summary: {
    checksRun: number;
    checksPassed: number;
    checksFailed: number;
    criteriaVerified: number;
    criteriaManual: number;
    artifactsVerified: number;
  };

  failures: FailureDetail[];
  recommendations: string[];
}

interface CheckResult {
  name: string;
  type: string;
  status: "passed" | "failed" | "skipped";
  required: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  exitCode?: number;
}

interface PassCriterionResult {
  index: number;
  description: string;
  verified: boolean;
  autoVerifiable: boolean;
  checkName?: string;
  status: "passed" | "failed" | "manual";
}

interface ArtifactResult {
  type: "file" | "api" | "database";
  name: string;
  verified: boolean;
  details?: string;
  error?: string;
}

interface FailureDetail {
  checkName: string;
  category: "compile" | "test" | "artifact" | "criteria";
  severity: "critical" | "warning";
  message: string;
  suggestion?: string;
}
```

**Report Storage:**

- Save to `parent-harness/data/qa-reports/{taskDisplayId}-{timestamp}.json`
- Store summary in database: `qa_validation_runs` table
- Include report ID in fix task description

#### FR-5: Enhanced Fix Task Creation

**Fix Task Enhancements:**

```typescript
interface FixTaskSpec {
  originalTaskId: string;
  displayId: string; // FIX-{ORIGINAL}-{TIMESTAMP}
  title: string;
  description: string; // Include structured failure info
  category: "bug";
  priority: number; // Inherit from original
  validationReportId: string;
  failedChecks: string[];
  recommendations: string[];
  passCriteria: string[]; // Must fix all failed checks
}
```

**Fix Task Description Template:**

```markdown
# QA Validation Failed: {ORIGINAL_TASK_DISPLAY_ID}

## Original Task

**Title:** {original.title}
**Display ID:** {original.display_id}
**Validation Level:** {level}

## Validation Report

**Report ID:** {report.id}
**Timestamp:** {report.completedAt}
**Duration:** {report.durationMs}ms

## Failed Checks ({failureCount})

{for each failure:}

- **{check.name}** ({check.type})
  - Status: ❌ FAILED
  - Error: {check.error}
  - Suggestion: {recommendation}

## Pass Criteria Verification

{for each criterion:}

- [{status}] {criterion.description}

## Recommendations

{for each recommendation:}

- {recommendation}

## Validation Report

Full report: `parent-harness/data/qa-reports/{report.id}.json`

## Pass Criteria for Fix

1. All failed checks must pass
2. All auto-verifiable pass criteria must verify
3. Validation level: {level}
```

#### FR-6: Task State Machine Integration

**State Transitions:**

```typescript
// When Build Agent completes task
task.status = "pending_verification";
emit("task:ready_for_qa", { task });

// QA Agent processes
task.status = "in_progress"; // During verification
emit("task:verification_started", { task });

// On success
task.status = "completed";
emit("task:qa_passed", { task, report });

// On failure
task.status = "failed";
emit("task:qa_failed", { task, report, fixTaskId });

// Fix task created
emit("task:fix_created", { originalTask, fixTask, report });
```

**Event Payloads:**

```typescript
interface TaskVerificationStartedEvent {
  taskId: string;
  taskDisplayId: string;
  agentId: "qa_agent";
  validationLevel: string;
  timestamp: string;
}

interface TaskQAPassedEvent {
  taskId: string;
  taskDisplayId: string;
  reportId: string;
  durationMs: number;
  checksRun: number;
  timestamp: string;
}

interface TaskQAFailedEvent {
  taskId: string;
  taskDisplayId: string;
  reportId: string;
  failedChecks: string[];
  fixTaskId?: string;
  timestamp: string;
}
```

#### FR-7: Performance Budgets and Timeout Handling

**Timeout Handling:**

- Each validation level has maximum duration
- Individual checks have configurable timeouts
- Graceful timeout handling with partial results
- Timeout failures are categorized as "timeout" errors

**Budget Enforcement:**

```typescript
interface ValidationBudget {
  level: ValidationLevel;
  totalBudgetMs: number;
  perCheckBudgetMs: number;
  timeoutAction: "fail" | "skip" | "partial";
}

// Example budgets
const BUDGETS = {
  QUICK: { total: 120000, perCheck: 60000, action: "fail" },
  STANDARD: { total: 300000, perCheck: 120000, action: "partial" },
  THOROUGH: { total: 900000, perCheck: 300000, action: "partial" },
  RELEASE: { total: 1800000, perCheck: 600000, action: "fail" },
};
```

**Timeout Recovery:**

- Save partial results before timeout
- Mark timed-out checks as 'skipped'
- Include timeout info in QA report
- Create fix task if required checks timed out

### Non-Functional Requirements

**NFR-1: Performance**

- Quick validation: < 2 minutes
- Standard validation: < 5 minutes
- Thorough validation: < 15 minutes
- Release validation: < 30 minutes
- Report generation: < 1 second
- Database queries: < 100ms

**NFR-2: Reliability**

- Graceful handling of command failures
- Partial results on timeout
- Retry transient failures (network, temp files)
- Don't crash on malformed spec files
- Idempotent validation (same task → same result)

**NFR-3: Maintainability**

- Modular check implementations (easy to add new checks)
- Clear separation: coordination vs execution
- Well-typed interfaces for all components
- Comprehensive error messages with context
- Logging at INFO level for progress, DEBUG for details

**NFR-4: Testability**

- Mock-friendly architecture
- Test fixtures for common scenarios
- Integration tests with real commands
- Unit tests for parsers and validators
- E2E tests for full QA workflow

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      QA Agent System                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────────────────┐      │
│  │  QA Service  │────────▶│  QA Validation Engine    │      │
│  │  (Event Bus) │         │  (Core Orchestrator)     │      │
│  └──────────────┘         └──────────────────────────┘      │
│         │                           │                         │
│         │ task:ready_for_qa         │                         │
│         ▼                           ▼                         │
│  ┌──────────────┐         ┌──────────────────────────┐      │
│  │ Task Queue   │         │  Validation Pipeline     │      │
│  │ (Concurrent) │         │  - Level Config Loader   │      │
│  └──────────────┘         │  - Spec Parser           │      │
│                            │  - Check Executor        │      │
│                            │  - Artifact Verifier     │      │
│                            │  - Report Generator      │      │
│                            └──────────────────────────┘      │
│                                      │                        │
│                                      ▼                        │
│                            ┌──────────────────────────┐      │
│                            │   Check Runners          │      │
│                            ├──────────────────────────┤      │
│                            │  - CompileChecker        │      │
│                            │  - TestRunner            │      │
│                            │  - BuildVerifier         │      │
│                            │  - ArtifactChecker       │      │
│                            │  - APIHealthChecker      │      │
│                            │  - DatabaseVerifier      │      │
│                            └──────────────────────────┘      │
│                                      │                        │
│                                      ▼                        │
│                            ┌──────────────────────────┐      │
│                            │  Report Storage          │      │
│                            ├──────────────────────────┤      │
│                            │  - JSON Reports (FS)     │      │
│                            │  - Summary (Database)    │      │
│                            │  - Fix Task Creator      │      │
│                            └──────────────────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. QA Validation Engine (`parent-harness/orchestrator/src/qa/validation-engine.ts`)

**Purpose:** Core orchestrator for QA validation workflow

**Responsibilities:**

- Load validation level configuration
- Parse task spec file for pass criteria
- Execute validation checks in sequence
- Collect and aggregate results
- Generate structured report
- Create fix tasks on failure

**Interface:**

```typescript
export class QAValidationEngine {
  constructor(
    private specParser: SpecParser,
    private checkExecutor: CheckExecutor,
    private artifactVerifier: ArtifactVerifier,
    private reportGenerator: ReportGenerator,
  ) {}

  async validateTask(
    taskId: string,
    options?: ValidationOptions,
  ): Promise<QAValidationReport> {
    const task = getTask(taskId);
    const level = options?.level || this.getTaskValidationLevel(task);
    const config = this.loadLevelConfig(level);

    const report: QAValidationReport = {
      id: uuid(),
      taskId,
      taskDisplayId: task.display_id,
      validationLevel: level,
      status: "passed",
      startedAt: new Date().toISOString(),
      checks: [],
      passCriteria: [],
      artifacts: [],
      failures: [],
      recommendations: [],
    };

    try {
      // 1. Parse spec file
      const spec = await this.specParser.parseSpecFile(task.display_id);
      report.passCriteria = spec.passCriteria;

      // 2. Execute checks
      for (const check of config.checks) {
        const result = await this.checkExecutor.runCheck(check, task);
        report.checks.push(result);

        if (!result.status === "passed" && check.required && config.failFast) {
          break;
        }
      }

      // 3. Verify artifacts (if spec defines them)
      if (spec.artifacts) {
        for (const artifact of spec.artifacts) {
          const result = await this.artifactVerifier.verify(artifact);
          report.artifacts.push(result);
        }
      }

      // 4. Verify pass criteria
      for (const criterion of report.passCriteria) {
        const verified = await this.verifyPassCriterion(
          criterion,
          report.checks,
        );
        criterion.verified = verified;
      }

      // 5. Determine overall status
      report.status = this.determineStatus(report);
      report.completedAt = new Date().toISOString();
      report.durationMs = Date.now() - new Date(report.startedAt).getTime();

      // 6. Generate recommendations
      if (report.status === "failed") {
        report.recommendations = this.generateRecommendations(report);
      }

      // 7. Save report
      await this.reportGenerator.saveReport(report);

      return report;
    } catch (error) {
      report.status = "failed";
      report.failures.push({
        checkName: "validation-engine",
        category: "system",
        severity: "critical",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private getTaskValidationLevel(task: Task): ValidationLevel {
    // Check task metadata for override
    if (task.metadata?.validationLevel) {
      return task.metadata.validationLevel;
    }

    // Default by task category
    if (task.category === "feature") return "STANDARD";
    if (task.category === "bug") return "THOROUGH";
    if (task.category === "refactor") return "THOROUGH";

    return "STANDARD";
  }

  private loadLevelConfig(level: ValidationLevel): ValidationLevelConfig {
    // Import from validation-configs.ts
    return VALIDATION_CONFIGS[level];
  }

  private async verifyPassCriterion(
    criterion: PassCriterion,
    checks: CheckResult[],
  ): Promise<boolean> {
    // Auto-verification logic
    if (!criterion.autoVerifiable) return false;

    const matchingCheck = checks.find((c) => c.name === criterion.checkName);
    if (!matchingCheck) return false;

    return matchingCheck.status === "passed";
  }

  private determineStatus(
    report: QAValidationReport,
  ): "passed" | "failed" | "partial" {
    const criticalFailures = report.checks.filter(
      (c) => c.status === "failed" && c.required,
    );

    if (criticalFailures.length > 0) return "failed";

    const hasFailures = report.checks.some((c) => c.status === "failed");
    if (hasFailures) return "partial";

    return "passed";
  }

  private generateRecommendations(report: QAValidationReport): string[] {
    const recommendations: string[] = [];

    for (const check of report.checks) {
      if (check.status === "failed") {
        if (check.type === "compile") {
          recommendations.push(
            "Fix TypeScript compilation errors before retrying",
          );
        } else if (check.type === "test") {
          recommendations.push(
            "Review test failures and fix failing assertions",
          );
        } else if (check.type === "artifact") {
          recommendations.push(
            `Ensure artifact ${check.name} is created correctly`,
          );
        }
      }
    }

    return recommendations;
  }
}
```

#### 2. Spec Parser (`parent-harness/orchestrator/src/qa/spec-parser.ts`)

**Purpose:** Parse task specification files to extract pass criteria and artifact definitions

**Responsibilities:**

- Locate spec file by task display ID
- Parse markdown structure
- Extract "Pass Criteria" section
- Map criteria to validation checks
- Extract artifact definitions

**Interface:**

```typescript
export class SpecParser {
  private specDir = "docs/specs";

  async parseSpecFile(taskDisplayId: string): Promise<ParsedSpec> {
    const specPath = await this.findSpecFile(taskDisplayId);
    if (!specPath) {
      return { passCriteria: [], artifacts: [] };
    }

    const content = await fs.readFile(specPath, "utf-8");
    return this.parseContent(content);
  }

  private async findSpecFile(taskDisplayId: string): Promise<string | null> {
    const pattern = `${this.specDir}/${taskDisplayId}*.md`;
    const files = glob.sync(pattern);
    return files[0] || null;
  }

  private parseContent(content: string): ParsedSpec {
    const passCriteria = this.extractPassCriteria(content);
    const artifacts = this.extractArtifacts(content);
    return { passCriteria, artifacts };
  }

  private extractPassCriteria(content: string): PassCriterion[] {
    const criteriaSection = this.extractSection(content, "Pass Criteria");
    if (!criteriaSection) return [];

    const lines = criteriaSection.split("\n");
    const criteria: PassCriterion[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(\d+)\.\s+(.+)$/);
      if (match) {
        const [, index, description] = match;
        criteria.push({
          index: parseInt(index, 10),
          description,
          type: this.inferCriterionType(description),
          autoVerifiable: this.isAutoVerifiable(description),
          checkName: this.mapToCheckName(description),
        });
      }
    }

    return criteria;
  }

  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(
      `##\\s+${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`,
      "i",
    );
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  private inferCriterionType(description: string): PassCriterion["type"] {
    if (/typeScript|compil|build/i.test(description)) return "compile";
    if (/test|spec|assertion/i.test(description)) return "test";
    if (/file.*exist|creat.*file/i.test(description)) return "file";
    if (/api|endpoint|route/i.test(description)) return "api";
    return "manual";
  }

  private isAutoVerifiable(description: string): boolean {
    const autoPatterns = [
      /typeScript compiles/i,
      /all tests pass/i,
      /build succeeds/i,
      /file.*exists/i,
      /api.*responds/i,
      /database.*created/i,
    ];
    return autoPatterns.some((pattern) => pattern.test(description));
  }

  private mapToCheckName(description: string): string | undefined {
    if (/typeScript compiles/i.test(description))
      return "TypeScript Compilation";
    if (/all tests pass/i.test(description)) return "Tests";
    if (/build succeeds/i.test(description)) return "Build";
    return undefined;
  }

  private extractArtifacts(content: string): ArtifactDefinition[] {
    // Parse "Artifacts" or "Deliverables" section for file/api/db artifacts
    const artifactsSection =
      this.extractSection(content, "Artifacts") ||
      this.extractSection(content, "Deliverables");
    if (!artifactsSection) return [];

    // Simple heuristic: look for file paths, API endpoints
    const artifacts: ArtifactDefinition[] = [];
    const fileMatches = artifactsSection.matchAll(
      /`([^`]+\.ts|[^`]+\.tsx|[^`]+\.js)`/g,
    );
    for (const match of fileMatches) {
      artifacts.push({ type: "file", path: match[1], required: true });
    }

    return artifacts;
  }
}

interface ParsedSpec {
  passCriteria: PassCriterion[];
  artifacts: ArtifactDefinition[];
}

interface ArtifactDefinition {
  type: "file" | "api" | "database";
  path?: string;
  endpoint?: string;
  query?: string;
  required: boolean;
}
```

#### 3. Check Executor (`parent-harness/orchestrator/src/qa/check-executor.ts`)

**Purpose:** Execute individual validation checks (compile, test, build, etc.)

**Responsibilities:**

- Run commands with timeout handling
- Capture output and exit codes
- Parse output for structured errors
- Handle transient failures with retry

**Interface:**

```typescript
export class CheckExecutor {
  private codebaseRoot =
    "/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator";

  async runCheck(check: ValidationCheck, task: Task): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeCommand(
        check.command || this.getDefaultCommand(check.type),
        check.timeout,
      );

      const passed = this.evaluateResult(result, check.expectedOutput);

      return {
        name: check.name,
        type: check.type,
        status: passed ? "passed" : "failed",
        required: check.required,
        output: result.stdout?.slice(0, 5000),
        error: passed ? undefined : result.stderr?.slice(0, 2500),
        durationMs: Date.now() - startTime,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        name: check.name,
        type: check.type,
        status: "failed",
        required: check.required,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async executeCommand(
    command: string,
    timeout: number,
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      exec(
        command,
        {
          cwd: this.codebaseRoot,
          timeout,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error && error.code === "ETIMEDOUT") {
            reject(new Error(`Command timed out after ${timeout}ms`));
          } else {
            resolve({
              stdout,
              stderr,
              exitCode: error?.code || 0,
            });
          }
        },
      );
    });
  }

  private getDefaultCommand(type: ValidationCheck["type"]): string {
    switch (type) {
      case "compile":
        return "npm run typecheck || npx tsc --noEmit";
      case "test":
        return "npm test -- --pool=forks --poolOptions.forks.maxForks=1 --run";
      case "build":
        return "npm run build";
      default:
        throw new Error(`No default command for check type: ${type}`);
    }
  }

  private evaluateResult(result: CommandResult, expected?: string): boolean {
    if (result.exitCode !== 0) return false;
    if (!expected) return true;

    const output = (result.stdout + result.stderr).toLowerCase();
    return output.includes(expected.toLowerCase());
  }
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

#### 4. Artifact Verifier (`parent-harness/orchestrator/src/qa/artifact-verifier.ts`)

**Purpose:** Verify artifacts (files, APIs, database state) exist and are correct

**Interface:**

```typescript
export class ArtifactVerifier {
  async verify(artifact: ArtifactDefinition): Promise<ArtifactResult> {
    switch (artifact.type) {
      case "file":
        return this.verifyFile(artifact);
      case "api":
        return this.verifyAPI(artifact);
      case "database":
        return this.verifyDatabase(artifact);
      default:
        throw new Error(`Unknown artifact type: ${artifact.type}`);
    }
  }

  private async verifyFile(
    artifact: ArtifactDefinition,
  ): Promise<ArtifactResult> {
    try {
      const stats = await fs.stat(artifact.path!);
      return {
        type: "file",
        name: artifact.path!,
        verified: true,
        details: `File exists (${stats.size} bytes)`,
      };
    } catch (error) {
      return {
        type: "file",
        name: artifact.path!,
        verified: false,
        error: "File does not exist",
      };
    }
  }

  private async verifyAPI(
    artifact: ArtifactDefinition,
  ): Promise<ArtifactResult> {
    try {
      const response = await fetch(artifact.endpoint!, {
        method: "GET",
        timeout: 5000,
      });

      return {
        type: "api",
        name: artifact.endpoint!,
        verified: response.ok,
        details: `Status: ${response.status}`,
      };
    } catch (error) {
      return {
        type: "api",
        name: artifact.endpoint!,
        verified: false,
        error: error instanceof Error ? error.message : "API check failed",
      };
    }
  }

  private async verifyDatabase(
    artifact: ArtifactDefinition,
  ): Promise<ArtifactResult> {
    try {
      const result = query(artifact.query!);
      return {
        type: "database",
        name: artifact.query!,
        verified: result.length > 0,
        details: `Query returned ${result.length} rows`,
      };
    } catch (error) {
      return {
        type: "database",
        name: artifact.query!,
        verified: false,
        error: error instanceof Error ? error.message : "Database check failed",
      };
    }
  }
}
```

#### 5. Report Generator (`parent-harness/orchestrator/src/qa/report-generator.ts`)

**Purpose:** Generate and store structured QA validation reports

**Interface:**

```typescript
export class ReportGenerator {
  private reportDir = "parent-harness/data/qa-reports";

  async saveReport(report: QAValidationReport): Promise<void> {
    // 1. Ensure report directory exists
    await fs.mkdir(this.reportDir, { recursive: true });

    // 2. Generate filename
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const filename = `${report.taskDisplayId}-${timestamp}.json`;
    const filepath = path.join(this.reportDir, filename);

    // 3. Write JSON report
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    // 4. Store summary in database
    await this.storeSummary(report);

    console.log(`📄 QA Report saved: ${filepath}`);
  }

  private async storeSummary(report: QAValidationReport): Promise<void> {
    run(
      `
      INSERT INTO qa_validation_runs (
        id, task_id, task_display_id, validation_level,
        status, started_at, completed_at, duration_ms,
        checks_run, checks_passed, checks_failed,
        criteria_verified, criteria_manual,
        artifacts_verified, report_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        report.id,
        report.taskId,
        report.taskDisplayId,
        report.validationLevel,
        report.status,
        report.startedAt,
        report.completedAt,
        report.durationMs,
        report.summary.checksRun,
        report.summary.checksPassed,
        report.summary.checksFailed,
        report.summary.criteriaVerified,
        report.summary.criteriaManual,
        report.summary.artifactsVerified,
        `qa-reports/${report.taskDisplayId}-${report.startedAt}.json`,
      ],
    );
  }
}
```

#### 6. Validation Configs (`parent-harness/orchestrator/src/qa/validation-configs.ts`)

**Purpose:** Define validation level configurations

```typescript
export const VALIDATION_CONFIGS: Record<
  ValidationLevel,
  ValidationLevelConfig
> = {
  QUICK: {
    level: "QUICK",
    timeBudgetMs: 120000, // 2 minutes
    failFast: true,
    checks: [
      {
        name: "TypeScript Compilation",
        type: "compile",
        timeout: 60000,
        required: true,
      },
    ],
  },

  STANDARD: {
    level: "STANDARD",
    timeBudgetMs: 300000, // 5 minutes
    failFast: false,
    checks: [
      {
        name: "TypeScript Compilation",
        type: "compile",
        timeout: 60000,
        required: true,
      },
      {
        name: "Tests",
        type: "test",
        timeout: 120000,
        required: true,
      },
      {
        name: "Artifact Verification",
        type: "artifact",
        timeout: 30000,
        required: false,
      },
    ],
  },

  THOROUGH: {
    level: "THOROUGH",
    timeBudgetMs: 900000, // 15 minutes
    failFast: false,
    checks: [
      {
        name: "TypeScript Compilation",
        type: "compile",
        timeout: 60000,
        required: true,
      },
      {
        name: "Build",
        type: "build",
        timeout: 180000,
        required: true,
      },
      {
        name: "Tests",
        type: "test",
        timeout: 240000,
        required: true,
      },
      {
        name: "Artifact Verification",
        type: "artifact",
        timeout: 30000,
        required: true,
      },
      {
        name: "API Health",
        type: "api",
        timeout: 60000,
        required: false,
      },
    ],
  },

  RELEASE: {
    level: "RELEASE",
    timeBudgetMs: 1800000, // 30 minutes
    failFast: false,
    checks: [
      // All THOROUGH checks plus...
      ...VALIDATION_CONFIGS.THOROUGH.checks,
      {
        name: "E2E Tests",
        type: "test",
        command: "npm run test:e2e",
        timeout: 600000,
        required: true,
      },
      {
        name: "Database Verification",
        type: "database",
        timeout: 30000,
        required: true,
      },
    ],
  },
};
```

### Integration Points

#### With QA Service (Event-Driven)

**Current:** `qa-service.ts` subscribes to `task:ready_for_qa` and calls `qa.verifyTask()`

**Enhanced:**

```typescript
// In qa-service.ts
private async verifyTask(queued: QueuedTask): Promise<void> {
  const { task } = queued;
  const qaAgent = agents.getAgent('qa_agent');

  // Update agent status
  if (qaAgent) {
    agents.updateAgentStatus('qa_agent', 'working', task.id, null);
    bus.emit('agent:working', { agent: qaAgent, taskId: task.id });
  }

  try {
    // NEW: Use validation engine instead of simple qa.verifyTask
    const engine = new QAValidationEngine(
      new SpecParser(),
      new CheckExecutor(),
      new ArtifactVerifier(),
      new ReportGenerator()
    );

    const report = await engine.validateTask(task.id);

    if (report.status === 'passed') {
      transitionTask(task.id, 'completed', { reportId: report.id });
      console.log(`✅ QA PASSED: ${task.display_id}`);
    } else {
      transitionTask(task.id, 'failed', {
        reportId: report.id,
        failures: report.failures.map(f => f.checkName),
      });

      // Create fix task
      const fixTaskId = await this.createEnhancedFixTask(task, report);
      console.log(`❌ QA FAILED: ${task.display_id} - Fix: ${fixTaskId}`);
    }
  } finally {
    if (qaAgent) {
      agents.updateAgentStatus('qa_agent', 'idle', null, null);
      bus.emit('agent:idle', { agent: agents.getAgent('qa_agent')! });
    }
  }
}

private async createEnhancedFixTask(
  task: Task,
  report: QAValidationReport
): Promise<string> {
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  const displayId = `FIX-${task.display_id}-${timestamp}`;

  const description = this.generateFixTaskDescription(task, report);

  const fixTask = tasks.createTask({
    display_id: displayId,
    title: `Fix: ${task.title}`,
    description,
    category: 'bug',
    priority: task.priority,
    task_list_id: task.task_list_id,
    pass_criteria: [
      'All failed checks must pass',
      'All auto-verifiable pass criteria must verify',
      `Validation level: ${report.validationLevel}`,
    ],
    metadata: {
      validationReportId: report.id,
      originalTaskId: task.id,
    },
  });

  return fixTask!.id;
}
```

#### With Task State Machine

**Events to emit:**

- `task:verification_started` - QA begins
- `task:qa_passed` - All checks pass
- `task:qa_failed` - Checks failed
- `task:fix_created` - Fix task created

#### With Database

**New Tables:**

```sql
-- Store QA validation run summaries
CREATE TABLE qa_validation_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_display_id TEXT NOT NULL,
  validation_level TEXT NOT NULL,
  status TEXT NOT NULL,  -- passed, failed, partial
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  checks_run INTEGER NOT NULL,
  checks_passed INTEGER NOT NULL,
  checks_failed INTEGER NOT NULL,
  criteria_verified INTEGER NOT NULL,
  criteria_manual INTEGER NOT NULL,
  artifacts_verified INTEGER NOT NULL,
  report_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_qa_runs_task ON qa_validation_runs(task_id);
CREATE INDEX idx_qa_runs_status ON qa_validation_runs(status);
CREATE INDEX idx_qa_runs_level ON qa_validation_runs(validation_level);
```

### Error Handling

**Graceful Degradation:**

- If spec file not found → use default validation (compile + tests)
- If pass criteria parsing fails → log warning, continue with checks
- If artifact verification fails → mark as warning, don't fail validation
- If check times out → mark as skipped, continue with remaining checks

**Retry Logic:**

- Transient failures (network, file locks) → retry up to 3 times
- Permanent failures (compilation errors) → fail immediately
- Timeout → no retry (indicates fundamental issue)

**Error Categories:**

```typescript
enum ErrorCategory {
  TRANSIENT = "transient", // Retry
  PERMANENT = "permanent", // Don't retry
  TIMEOUT = "timeout", // Don't retry, mark as timeout
  SYSTEM = "system", // Internal error, retry once
}

function categorizeError(error: Error): ErrorCategory {
  if (error.message.includes("ECONNREFUSED")) return ErrorCategory.TRANSIENT;
  if (error.message.includes("ETIMEDOUT")) return ErrorCategory.TIMEOUT;
  if (error.message.includes("compilation")) return ErrorCategory.PERMANENT;
  return ErrorCategory.SYSTEM;
}
```

---

## Pass Criteria

### Functional Pass Criteria

1. **Validation Level Support**
   - ✅ QUICK validation completes in < 2 minutes
   - ✅ STANDARD validation completes in < 5 minutes
   - ✅ THOROUGH validation completes in < 15 minutes
   - ✅ Tasks can override validation level via metadata
   - ✅ Default level assigned by task category

2. **Spec-Based Pass Criteria Validation**
   - ✅ Spec file located by task display ID
   - ✅ "Pass Criteria" section parsed correctly
   - ✅ Auto-verifiable criteria mapped to checks
   - ✅ Manual review criteria flagged as warnings
   - ✅ Pass criteria verification results included in report

3. **Artifact Verification**
   - ✅ File existence checks work
   - ✅ API endpoint health checks work
   - ✅ Database state checks work
   - ✅ Missing artifacts reported with details
   - ✅ Artifact verification results in report

4. **Structured Validation Reports**
   - ✅ Reports saved as JSON to `parent-harness/data/qa-reports/`
   - ✅ Report summaries stored in database
   - ✅ Report includes all check results, pass criteria, artifacts
   - ✅ Failures include category, severity, suggestions
   - ✅ Report accessible via report ID

5. **Enhanced Fix Task Creation**
   - ✅ Fix tasks include validation report ID
   - ✅ Fix task description uses structured template
   - ✅ Failed checks listed with suggestions
   - ✅ Pass criteria for fix task includes "all checks must pass"
   - ✅ Fix task links to full JSON report

6. **Task State Machine Integration**
   - ✅ `task:verification_started` emitted on QA start
   - ✅ `task:qa_passed` emitted on success
   - ✅ `task:qa_failed` emitted on failure
   - ✅ `task:fix_created` emitted when fix task generated
   - ✅ Task status transitions correctly (pending_verification → completed/failed)

7. **Performance Budgets**
   - ✅ Validation levels enforce time budgets
   - ✅ Individual check timeouts work
   - ✅ Graceful timeout handling with partial results
   - ✅ Timeout failures categorized correctly

### Technical Pass Criteria

8. **TypeScript Compilation**
   - ✅ `npm run build` succeeds with no errors
   - ✅ All new files have proper type definitions
   - ✅ No `any` types without justification

9. **Test Coverage**
   - ✅ Unit tests for SpecParser (parse criteria, artifacts)
   - ✅ Unit tests for CheckExecutor (command execution, timeout)
   - ✅ Unit tests for ArtifactVerifier (file, API, database checks)
   - ✅ Unit tests for ReportGenerator (JSON generation, storage)
   - ✅ Integration tests for QAValidationEngine (full workflow)
   - ✅ E2E test: Complete QA validation with mock task

10. **Integration Verification**
    - ✅ QA Service uses new validation engine
    - ✅ Events emitted correctly
    - ✅ Database tables created via migration
    - ✅ API routes work with new validation system
    - ✅ Existing QA tests still pass

### Quality Criteria

11. **Code Quality**
    - ✅ Modular design (separation of concerns)
    - ✅ Clear error messages with context
    - ✅ Comprehensive logging (INFO for progress, DEBUG for details)
    - ✅ No hardcoded paths (use config)

12. **Documentation**
    - ✅ JSDoc comments on public interfaces
    - ✅ README updates explaining validation levels
    - ✅ Example QA report in documentation
    - ✅ Migration guide for existing QA checks

---

## Dependencies

### Upstream (must exist first)

1. **PHASE2-TASK-01: Spec Agent v0.1** ✅
   - Need spec file format standardized
   - Pass criteria section must exist

2. **PHASE2-TASK-02: Build Agent Task Executor** (Partial)
   - Build Agent must transition tasks to `pending_verification`
   - Task metadata structure defined

3. **Task State Machine** ✅
   - State transitions must support QA workflow
   - Event bus must be operational

4. **Database Schema** ✅
   - Tasks table must exist
   - Events table must exist

### Downstream (blocked until this completes)

1. **PHASE2-TASK-04: Task State Machine with Retry** (Enhanced)
   - Can use structured QA reports for failure analysis
   - Retry logic can target specific failed checks

2. **PHASE3-TASK-05: Dashboard Widget Updates**
   - Can display QA validation reports
   - Can show check status in real-time

3. **PHASE4-TASK-04: Build Agent QA Learning**
   - Uses QA failure patterns for learning
   - Feeds technique effectiveness tracking

### External Dependencies

- **Libraries:**
  - `better-sqlite3` - Database access ✅
  - `glob` - File pattern matching ✅
  - `node:child_process` - Command execution ✅
  - `node:fs/promises` - File operations ✅

- **Infrastructure:**
  - SQLite database ✅
  - Filesystem access for reports ✅
  - Event bus (parent-harness) ✅

---

## Testing Strategy

### Unit Tests

**File:** `parent-harness/orchestrator/tests/qa/spec-parser.test.ts`

```typescript
describe("SpecParser", () => {
  it("parses pass criteria from spec file");
  it("maps criteria to check names");
  it("extracts artifact definitions");
  it("handles missing spec file gracefully");
  it("handles malformed pass criteria");
});
```

**File:** `parent-harness/orchestrator/tests/qa/check-executor.test.ts`

```typescript
describe("CheckExecutor", () => {
  it("executes compile check successfully");
  it("executes test check successfully");
  it("handles command timeout");
  it("handles command failure");
  it("evaluates expected output correctly");
});
```

**File:** `parent-harness/orchestrator/tests/qa/artifact-verifier.test.ts`

```typescript
describe("ArtifactVerifier", () => {
  it("verifies file exists");
  it("verifies file does not exist");
  it("verifies API endpoint responds");
  it("verifies database state");
  it("handles verification errors gracefully");
});
```

**File:** `parent-harness/orchestrator/tests/qa/validation-engine.test.ts`

```typescript
describe("QAValidationEngine", () => {
  it("validates task with QUICK level");
  it("validates task with STANDARD level");
  it("validates task with THOROUGH level");
  it("parses spec and verifies pass criteria");
  it("verifies artifacts when defined");
  it("generates report with all sections");
  it("determines status correctly (passed/failed/partial)");
  it("generates recommendations on failure");
  it("handles timeout gracefully");
  it("uses task metadata for validation level override");
});
```

### Integration Tests

**File:** `parent-harness/orchestrator/tests/qa/qa-service-integration.test.ts`

```typescript
describe("QA Service Integration", () => {
  it("processes task:ready_for_qa event");
  it("transitions task to completed on pass");
  it("transitions task to failed on failure");
  it("creates fix task on failure");
  it("saves QA report to database");
  it("emits correct events during validation");
});
```

### E2E Tests

**File:** `parent-harness/orchestrator/tests/qa/qa-workflow-e2e.test.ts`

```typescript
describe("QA Workflow E2E", () => {
  it("full workflow: spec creation → build → QA validation → completion");
  it("full workflow: spec creation → build → QA failure → fix task creation");
  it("validation level override via task metadata");
  it("artifact verification with file/API/database checks");
});
```

### Manual Testing Checklist

- [ ] Create test task with spec file
- [ ] Trigger QA validation manually
- [ ] Verify QA report generated
- [ ] Verify database entry created
- [ ] Verify fix task created on failure
- [ ] Verify events emitted correctly
- [ ] Test validation level overrides
- [ ] Test timeout handling
- [ ] Test artifact verification (file, API, DB)

---

## Performance Metrics

**Benchmarks:**

- QUICK validation: target < 2 min, max 3 min
- STANDARD validation: target < 5 min, max 7 min
- THOROUGH validation: target < 15 min, max 20 min
- Spec parsing: < 500ms
- Report generation: < 1 second
- Database writes: < 100ms

**Monitoring:**

- Log validation duration per level
- Track check success rate per type
- Monitor fix task creation rate
- Alert on validation timeouts

---

## Known Limitations

1. **Spec File Format Dependency**
   - QA validation relies on consistent spec file format
   - If Spec Agent changes format, parser must be updated

2. **Limited Artifact Auto-Discovery**
   - Artifact verification requires explicit definitions
   - Can't auto-detect all artifacts from code

3. **Manual Review Criteria**
   - Some pass criteria can't be auto-verified
   - Requires human review for subjective criteria

4. **Network Dependencies**
   - API health checks require services to be running
   - Can't verify external API endpoints reliably

5. **Database State Assumptions**
   - Database checks assume specific schema
   - May break if schema changes without updating checks

6. **Single Codebase Root**
   - Assumes single codebase root directory
   - Won't work with multi-repo setups without config

---

## Future Enhancements

**Phase 3+:**

- Coverage threshold enforcement (minimum % for THOROUGH)
- Security scan integration (dependency vulnerabilities)
- Performance regression detection (execution time)
- Visual regression testing (screenshot diffs)
- Accessibility testing (WCAG compliance)

**Phase 4+:**

- Machine learning for failure categorization
- Historical trend analysis (flaky tests detection)
- Smart retry strategies based on failure patterns
- Auto-fix suggestions using LLM

**Phase 5+:**

- Distributed validation across multiple machines
- Parallel check execution within validation level
- Cloud-based validation infrastructure
- Validation as a service (external projects)

---

## Implementation Checklist

**Phase 1: Core Validation Engine**

- [ ] Create `validation-engine.ts` with main orchestrator
- [ ] Create `spec-parser.ts` with pass criteria extraction
- [ ] Create `check-executor.ts` with command execution
- [ ] Create `artifact-verifier.ts` with file/API/DB checks
- [ ] Create `report-generator.ts` with JSON report generation
- [ ] Create `validation-configs.ts` with level definitions

**Phase 2: Integration**

- [ ] Update `qa-service.ts` to use validation engine
- [ ] Add database migration for `qa_validation_runs` table
- [ ] Update `qa/index.ts` to use new components
- [ ] Add fix task enhancement with structured template
- [ ] Update API routes for validation level support

**Phase 3: Testing**

- [ ] Write unit tests for all new modules
- [ ] Write integration tests for QA service
- [ ] Write E2E test for full validation workflow
- [ ] Run manual testing checklist
- [ ] Verify all pass criteria met

**Phase 4: Documentation**

- [ ] Update CLAUDE.md with validation levels
- [ ] Add example QA report to docs
- [ ] Document validation level override process
- [ ] Create migration guide for existing checks

**Phase 5: Validation**

- [ ] Run full test suite (`npm test`)
- [ ] Verify TypeScript compilation (`npm run build`)
- [ ] Verify no regressions in existing QA workflow
- [ ] Performance benchmarks for all validation levels

---

## Conclusion

The QA Agent validation framework establishes a comprehensive quality gate for the autonomous task execution pipeline. By combining configurable validation levels, spec-based pass criteria verification, artifact checking, and structured reporting, the framework ensures that Build Agent outputs meet quality standards before tasks are marked complete.

The modular architecture allows for easy extension (new check types, artifact verifiers) while maintaining a clean separation between validation orchestration and check execution. Integration with the existing event bus and task state machine ensures seamless workflow coordination.

With this framework in place, the autonomous execution vision (Spec Agent → Build Agent → QA Agent) becomes fully operational, enabling the system to autonomously verify work quality and create fix tasks when standards are not met.

**Next Steps After Completion:**

1. PHASE2-TASK-04: Enhanced retry logic using QA failure patterns
2. PHASE2-TASK-05: Agent logging and error reporting improvements
3. PHASE3-TASK-05: Dashboard widgets for QA report visualization
