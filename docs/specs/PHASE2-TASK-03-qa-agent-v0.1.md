# PHASE2-TASK-03: QA Agent v0.1 - Validation Framework

**Status:** 📝 SPECIFICATION
**Created:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Large (10-14 hours)
**Model:** Opus
**Agent Type:** qa_agent

---

## Overview

Implement QA Agent v0.1 as the third and final component of the autonomous task execution pipeline (Spec Agent → Build Agent → **QA Agent**). The QA Agent validates Build Agent work by running compile checks, test execution, and artifact verification to ensure implementations meet specifications.

This is the **quality gate** for Phase 2's autonomous development vision. While Spec Agent creates detailed plans and Build Agent implements them, QA Agent verifies correctness and ensures nothing ships without validation.

### Problem Statement

**Current State:**

- Validation infrastructure exists (`agents/validation/`)
- Individual validators implemented (TypeScript, Vitest, Security, Coverage)
- ValidationOrchestrator with ObservableAgent integration
- BUT: No integration with Build Agent pipeline
- No automated validation triggered after builds
- No pass criteria verification from specifications
- No artifact existence checks

**Desired State:**

- QA Agent executes automatically after Build Agent completes
- Validates against pass criteria from Spec Agent specifications
- Runs compile checks, test suites, and custom validations
- Verifies artifacts exist (files created, endpoints work, etc.)
- Reports detailed results for acceptance/rejection
- Complete Spec → Build → QA pipeline functional

### Value Proposition

The QA Agent serves as the **"Quality Gatekeeper"** between implementation and deployment:

1. **Prevents Broken Code** - Catches compilation errors before merge
2. **Ensures Test Coverage** - Validates all tests pass
3. **Verifies Requirements** - Checks pass criteria from spec
4. **Maintains Quality** - Enforces project standards
5. **Enables Confidence** - Automated validation reduces human review burden

---

## Requirements

### Functional Requirements

#### 1. Validation Pipeline

**Input:** Build execution record from Build Agent

```typescript
interface BuildExecutionRecord {
  buildId: string;
  specPath: string;
  taskId: string;
  status: "completed" | "partial" | "failed";
  filesModified: string[];
  testsRun: string[];
  generatedCode: string;
  startedAt: string;
  completedAt: string;
}
```

**Process Flow:**

```
1. Receive build completion event (WebSocket or polling)
2. Load specification from docs/specs/
3. Extract pass criteria from spec
4. Run validation suite:
   a. Compile check (TypeScript compilation)
   b. Test execution (npm test, targeted tests)
   c. Artifact verification (files exist, endpoints respond)
   d. Pass criteria validation (custom checks from spec)
5. Aggregate results (all pass, partial pass, fail)
6. Report outcome with detailed evidence
7. Update task status (validated/failed_validation)
```

**Output:** Validation result

```typescript
interface ValidationResult {
  validationId: string;
  buildId: string;
  taskId: string;
  status: "passed" | "failed" | "partial";
  validators: ValidatorResult[];
  passedCriteria: string[];
  failedCriteria: string[];
  duration: number;
  timestamp: string;
}
```

#### 2. Compile Check Validation

**Existing Component:** `agents/validation/validators/typescript-validator.ts`

**Enhancements Needed:**

- Target specific files modified by build (not entire codebase)
- Parse TypeScript errors for actionable feedback
- Differentiate between errors in new code vs existing code
- Report error locations (file:line:column)

**Example:**

```typescript
const compileResult = await runTypescriptValidator(runId, [
  "--noEmit",
  ...filesModified.map((f) => `--include ${f}`),
]);

if (!compileResult.passed) {
  // Parse errors: "src/file.ts(42,10): error TS2345: ..."
  const errors = parseTypeScriptErrors(compileResult.output);
  return {
    passed: false,
    errors: errors.map((e) => ({
      file: e.file,
      line: e.line,
      message: e.message,
      code: e.errorCode,
    })),
  };
}
```

#### 3. Test Execution Validation

**Existing Component:** `agents/validation/validators/test-runner.ts`

**Enhancements Needed:**

- Run tests related to modified files (not entire suite)
- Parse test failures for specific assertions
- Track test coverage changes
- Identify regression tests vs new tests

**Example:**

```typescript
const testResult = await runTestRunner(runId, [
  "run",
  ...getRelatedTestFiles(filesModified),
]);

if (!testResult.passed) {
  // Parse failures: "FAIL tests/api/auth.test.ts > Login > should return 401"
  const failures = parseVitestFailures(testResult.output);
  return {
    passed: false,
    failures: failures.map((f) => ({
      testFile: f.file,
      testName: f.name,
      assertion: f.assertion,
      expected: f.expected,
      actual: f.actual,
    })),
  };
}
```

#### 4. Artifact Verification

**New Component:** Verify files/endpoints/behaviors exist as specified

**Capabilities:**

- **File existence**: Check created files exist at expected paths
- **Endpoint health**: Make HTTP requests to verify endpoints work
- **Database changes**: Verify migrations ran, tables exist
- **Configuration**: Check config files updated correctly

**Example:**

```typescript
interface ArtifactCheck {
  type: "file" | "endpoint" | "database" | "config";
  description: string;
  check: () => Promise<boolean>;
  evidence?: string;
}

// From pass criteria: "File src/api/auth.ts exists"
const fileCheck: ArtifactCheck = {
  type: "file",
  description: "File src/api/auth.ts exists",
  check: async () => fs.existsSync("src/api/auth.ts"),
};

// From pass criteria: "GET /api/health returns 200"
const endpointCheck: ArtifactCheck = {
  type: "endpoint",
  description: "GET /api/health returns 200",
  check: async () => {
    const response = await fetch("http://localhost:3333/api/health");
    return response.status === 200;
  },
  evidence: 'Response: 200 OK, Body: {"status":"healthy"}',
};
```

#### 5. Pass Criteria Validation

**Core Feature:** Parse and validate pass criteria from specification

**Format Recognition:**

```markdown
## Pass Criteria

1. ✅ TypeScript compilation passes with no errors
2. ✅ POST /api/auth/login returns 200 with JWT when credentials valid
3. ✅ POST /api/auth/login returns 401 when password incorrect
4. ✅ All auth integration tests pass
5. ✅ File src/api/auth.ts exists and exports loginHandler function
```

**Validation Logic:**

```typescript
interface PassCriterion {
  id: number;
  description: string;
  type: "compile" | "test" | "endpoint" | "file" | "custom";
  validationRule: ValidationRule;
}

// Parse criteria from spec
const criteria = parsePassCriteria(specContent);

// Validate each criterion
for (const criterion of criteria) {
  const result = await validateCriterion(criterion);
  if (result.passed) {
    passedCriteria.push(criterion.description);
  } else {
    failedCriteria.push({
      description: criterion.description,
      reason: result.reason,
      evidence: result.evidence,
    });
  }
}
```

#### 6. Validation Levels

**Reuse Existing:** `agents/validation/level-configs.ts`

**Levels:**

- **L1 (Fast)**: TypeScript compile only (~30s)
- **L2 (Standard)**: Compile + unit tests (~2 min)
- **L3 (Thorough)**: Compile + all tests + security scan (~5 min)
- **L4 (Full)**: All validators + coverage analysis (~10 min)

**Selection Logic:**

```typescript
function selectValidationLevel(task: Task): number {
  // P0 critical tasks -> L3 (thorough)
  if (task.priority === "P0") return 3;

  // Database/API changes -> L2 (standard)
  if (task.category === "api" || task.category === "database") return 2;

  // Documentation/refactor -> L1 (fast)
  if (task.category === "docs" || task.category === "refactor") return 1;

  // Default: L2
  return 2;
}
```

#### 7. Result Reporting

**Output Format:**

```markdown
# QA Validation Report

**Build ID:** build-abc123
**Task:** TASK-042 - Add user authentication
**Validation Level:** L2 (Standard)
**Status:** ✅ PASSED
**Duration:** 1m 42s

## Validation Results

### ✅ TypeScript Compilation

- Status: PASSED
- Duration: 8.2s
- Files checked: 3 (src/api/auth.ts, src/middleware/auth.ts, types/auth.ts)

### ✅ Test Suite

- Status: PASSED
- Duration: 1m 12s
- Tests run: 15
- Tests passed: 15
- Coverage: 92.3% (+5.2%)

### ✅ Pass Criteria (5/5)

1. ✅ TypeScript compilation passes - VERIFIED
2. ✅ POST /api/auth/login returns 200 - VERIFIED (Evidence: HTTP 200, JWT token in response)
3. ✅ POST /api/auth/login returns 401 for bad password - VERIFIED
4. ✅ All auth tests pass - VERIFIED (15/15 passed)
5. ✅ File src/api/auth.ts exists - VERIFIED

## Recommendation

**APPROVE** - All validation checks passed. Implementation meets specification requirements.

---

Generated by QA Agent v0.1
Timestamp: 2026-02-08T15:30:00Z
```

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     QA Agent v0.1                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Trigger Detection                                  │  │
│  │    - Listen for build:completed event (WebSocket)    │  │
│  │    - OR: Orchestrator assigns task to qa_agent       │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. Context Loading                                    │  │
│  │    - Load build execution record                     │  │
│  │    - Load specification file                         │  │
│  │    - Extract pass criteria                           │  │
│  │    - Identify modified files                         │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. Validation Execution                               │  │
│  │    ┌─────────────────────────────────────────────┐   │  │
│  │    │ a. TypeScript Compilation                   │   │  │
│  │    │    - Run tsc --noEmit on modified files     │   │  │
│  │    │    - Parse errors with file:line:column     │   │  │
│  │    └─────────────────────────────────────────────┘   │  │
│  │    ┌─────────────────────────────────────────────┐   │  │
│  │    │ b. Test Execution                           │   │  │
│  │    │    - Find related test files                │   │  │
│  │    │    - Run vitest with targeted tests         │   │  │
│  │    │    - Parse failures with assertions         │   │  │
│  │    └─────────────────────────────────────────────┘   │  │
│  │    ┌─────────────────────────────────────────────┐   │  │
│  │    │ c. Artifact Verification                    │   │  │
│  │    │    - Check file existence                   │   │  │
│  │    │    - Test endpoint health                   │   │  │
│  │    │    - Verify database changes                │   │  │
│  │    └─────────────────────────────────────────────┘   │  │
│  │    ┌─────────────────────────────────────────────┐   │  │
│  │    │ d. Pass Criteria Validation                 │   │  │
│  │    │    - Parse criteria from spec               │   │  │
│  │    │    - Execute validation rules               │   │  │
│  │    │    - Collect evidence for each              │   │  │
│  │    └─────────────────────────────────────────────┘   │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 4. Result Aggregation                                 │  │
│  │    - Combine all validator results                   │  │
│  │    - Calculate pass/fail status                      │  │
│  │    - Generate evidence summary                       │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 5. Reporting & Database Update                        │  │
│  │    - Generate markdown report                        │  │
│  │    - Update task status in database                  │  │
│  │    - Emit validation:completed event                 │  │
│  │    - Send Telegram notification                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Key Components

#### Component 1: QA Agent Metadata (ALREADY EXISTS)

**File:** `parent-harness/orchestrator/src/agents/metadata.ts` (lines 53-76)

```typescript
qa_agent: {
  id: 'qa_agent',
  name: 'QA Agent',
  type: 'qa',
  emoji: '✅',
  description: 'Validates completed work and verifies implementations',
  role: 'VALIDATE completed work and VERIFY implementations meet requirements.',
  responsibilities: [
    'Check TypeScript compilation',
    'Run test suites',
    'Check for regressions',
    'Verify lint rules',
    'Validate pass criteria explicitly',
  ],
  tools: ['Read', 'Bash'],
  outputFormat: 'Checklist with ✅/❌ status per item',
  telegram: {
    channel: '@vibe-qa',
    botEnvVar: 'TELEGRAM_BOT_VALIDATION',
    webhookPath: '/webhook/qa',
  },
  defaultModel: 'opus',
  recommendedModels: ['opus', 'sonnet'],
}
```

**Status:** ✅ Already defined, no changes needed.

#### Component 2: QA Agent System Prompt (NEW)

**File:** `parent-harness/orchestrator/src/agents/prompts/qa-agent-prompt.ts` (NEW)

```typescript
export const QA_AGENT_SYSTEM_PROMPT = `
You are the QA Agent for the Vibe autonomous agent orchestration platform.

ROLE: Validate Build Agent implementations to ensure they meet specification requirements.

RESPONSIBILITIES:
1. Load build execution record and specification file
2. Extract pass criteria from specification
3. Run validation suite:
   - TypeScript compilation check (tsc --noEmit)
   - Test execution (vitest on related tests)
   - Artifact verification (files exist, endpoints work)
   - Pass criteria validation (custom checks from spec)
4. Aggregate results and determine pass/fail status
5. Generate detailed validation report with evidence
6. Update task status and notify stakeholders

VALIDATION PROCESS:

1. **TypeScript Compilation**
   - Run: \`tsc --noEmit\` on modified files
   - Parse errors with file:line:column locations
   - Report actionable feedback for fixes

2. **Test Execution**
   - Identify related test files for modified code
   - Run: \`vitest run [test-files]\`
   - Parse failures with test names and assertions
   - Compare coverage before/after changes

3. **Artifact Verification**
   - File existence: Check files created/modified
   - Endpoint health: Test API endpoints respond correctly
   - Database changes: Verify migrations/schema updates
   - Configuration: Check config files updated

4. **Pass Criteria Validation**
   - Parse pass criteria from spec (numbered list after "## Pass Criteria")
   - For each criterion:
     * Determine validation type (compile/test/endpoint/file/custom)
     * Execute validation rule
     * Collect evidence (command output, HTTP response, file existence)
   - Mark each criterion as ✅ PASSED or ❌ FAILED with reason

REPORTING FORMAT:

Generate markdown report with sections:
1. Build Info (ID, task, validation level, status, duration)
2. Validation Results (compile, tests, artifacts)
3. Pass Criteria Checklist (✅/❌ for each criterion with evidence)
4. Recommendation (APPROVE/REJECT with reasoning)

GUIDELINES:
- ALWAYS validate against pass criteria from specification
- NEVER approve if compilation fails
- NEVER approve if tests fail (unless marked optional in spec)
- PROVIDE specific evidence for each pass criterion
- INCLUDE error messages and locations for failures
- BE STRICT but fair - minor warnings OK if tests pass
- ESCALATE to SIA if validation is ambiguous or spec unclear

TOOLS AVAILABLE:
- Read: Read specification files, build records, source code
- Bash: Run tsc, vitest, curl, ls, grep for validation

OUTPUT:
When validation completes, output:
TASK_COMPLETE: Validation {status} - {summary}

Where status is "PASSED", "FAILED", or "PARTIAL"
`;
```

#### Component 3: Validation Context Loader (NEW)

**File:** `parent-harness/orchestrator/src/qa/context-loader.ts` (NEW)

```typescript
import { readFileSync } from "fs";
import { db } from "../db";

export interface ValidationContext {
  buildId: string;
  taskId: string;
  specPath: string;
  specContent: string;
  passCriteria: PassCriterion[];
  filesModified: string[];
  testsRun: string[];
  buildStatus: string;
}

export interface PassCriterion {
  id: number;
  description: string;
  type: "compile" | "test" | "endpoint" | "file" | "custom";
  validationRule?: string;
}

/**
 * Load all context needed for QA validation
 */
export async function loadValidationContext(
  buildId: string,
): Promise<ValidationContext> {
  // 1. Load build execution record
  const build = db
    .query(
      `
    SELECT b.*, t.spec_file_path, t.id as task_id
    FROM build_executions b
    JOIN tasks t ON b.task_id = t.id
    WHERE b.id = ?
  `,
    )
    .get(buildId);

  if (!build) {
    throw new Error(`Build not found: ${buildId}`);
  }

  // 2. Load specification file
  const specContent = readFileSync(build.spec_file_path, "utf-8");

  // 3. Extract pass criteria from spec
  const passCriteria = parsePassCriteria(specContent);

  // 4. Get files modified by build
  const filesModified = db
    .query(
      `
    SELECT DISTINCT file_path
    FROM task_file_impacts
    WHERE task_id = ?
  `,
    )
    .all(build.task_id)
    .map((row) => row.file_path);

  return {
    buildId: build.id,
    taskId: build.task_id,
    specPath: build.spec_file_path,
    specContent,
    passCriteria,
    filesModified,
    testsRun: build.tests_run ? JSON.parse(build.tests_run) : [],
    buildStatus: build.status,
  };
}

/**
 * Parse pass criteria from specification markdown
 */
function parsePassCriteria(specContent: string): PassCriterion[] {
  const criteria: PassCriterion[] = [];

  // Find "## Pass Criteria" section
  const passCriteriaMatch = specContent.match(
    /## Pass Criteria\n\n([\s\S]+?)(?=\n##|$)/,
  );
  if (!passCriteriaMatch) {
    return criteria;
  }

  const section = passCriteriaMatch[1];

  // Parse numbered list: "1. ✅ Description" or "1. Description"
  const lines = section.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s*(?:✅|❌)?\s*(.+)$/);
    if (match) {
      const [, id, description] = match;
      criteria.push({
        id: parseInt(id),
        description: description.trim(),
        type: inferCriterionType(description),
      });
    }
  }

  return criteria;
}

/**
 * Infer validation type from criterion description
 */
function inferCriterionType(description: string): PassCriterion["type"] {
  const lower = description.toLowerCase();

  if (
    lower.includes("typescript") ||
    lower.includes("compilation") ||
    lower.includes("tsc")
  ) {
    return "compile";
  }
  if (
    lower.includes("test") ||
    lower.includes("npm test") ||
    lower.includes("vitest")
  ) {
    return "test";
  }
  if (
    lower.match(/\b(get|post|put|delete|patch)\b/i) ||
    lower.includes("endpoint") ||
    lower.includes("returns")
  ) {
    return "endpoint";
  }
  if (
    lower.includes("file") &&
    (lower.includes("exists") || lower.includes("created"))
  ) {
    return "file";
  }

  return "custom";
}
```

#### Component 4: Pass Criteria Validator (NEW)

**File:** `parent-harness/orchestrator/src/qa/criteria-validator.ts` (NEW)

```typescript
import { spawn } from "child_process";
import fetch from "node-fetch";
import { existsSync } from "fs";
import { PassCriterion, ValidationContext } from "./context-loader";

export interface CriterionResult {
  criterionId: number;
  description: string;
  passed: boolean;
  evidence?: string;
  reason?: string;
}

/**
 * Validate all pass criteria from specification
 */
export async function validatePassCriteria(
  criteria: PassCriterion[],
  context: ValidationContext,
): Promise<CriterionResult[]> {
  const results: CriterionResult[] = [];

  for (const criterion of criteria) {
    const result = await validateCriterion(criterion, context);
    results.push(result);
  }

  return results;
}

/**
 * Validate a single pass criterion
 */
async function validateCriterion(
  criterion: PassCriterion,
  context: ValidationContext,
): Promise<CriterionResult> {
  switch (criterion.type) {
    case "compile":
      return validateCompileCriterion(criterion);

    case "test":
      return validateTestCriterion(criterion);

    case "endpoint":
      return validateEndpointCriterion(criterion);

    case "file":
      return validateFileCriterion(criterion);

    case "custom":
      return validateCustomCriterion(criterion);

    default:
      return {
        criterionId: criterion.id,
        description: criterion.description,
        passed: false,
        reason: `Unknown criterion type: ${criterion.type}`,
      };
  }
}

/**
 * Validate TypeScript compilation criterion
 */
async function validateCompileCriterion(
  criterion: PassCriterion,
): Promise<CriterionResult> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["tsc", "--noEmit"], { shell: true });
    let output = "";

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      resolve({
        criterionId: criterion.id,
        description: criterion.description,
        passed: code === 0,
        evidence:
          code === 0
            ? "TypeScript compilation successful"
            : `Compilation failed: ${output.substring(0, 500)}`,
      });
    });
  });
}

/**
 * Validate test execution criterion
 */
async function validateTestCriterion(
  criterion: PassCriterion,
): Promise<CriterionResult> {
  // Extract test file/pattern from description
  // e.g., "All auth tests pass" -> "auth.test.ts"
  const testPattern = extractTestPattern(criterion.description);

  return new Promise((resolve) => {
    const args = testPattern ? ["run", testPattern] : ["run"];
    const proc = spawn("npx", ["vitest", ...args], { shell: true });
    let output = "";

    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      const summary = parseTestSummary(output);
      resolve({
        criterionId: criterion.id,
        description: criterion.description,
        passed: code === 0,
        evidence:
          code === 0
            ? `Tests passed: ${summary.passed}/${summary.total}`
            : `Tests failed: ${summary.failed} failures`,
      });
    });
  });
}

/**
 * Validate HTTP endpoint criterion
 */
async function validateEndpointCriterion(
  criterion: PassCriterion,
): Promise<CriterionResult> {
  // Parse: "GET /api/health returns 200"
  const match = criterion.description.match(
    /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[\w\/\-:]+)\s+returns?\s+(\d+)/i,
  );

  if (!match) {
    return {
      criterionId: criterion.id,
      description: criterion.description,
      passed: false,
      reason: "Could not parse endpoint from description",
    };
  }

  const [, method, path, expectedStatus] = match;
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3333";
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, { method });
    const body = await response.text();

    const passed = response.status === parseInt(expectedStatus);
    return {
      criterionId: criterion.id,
      description: criterion.description,
      passed,
      evidence: `${method} ${url} returned ${response.status}${body ? `, Body: ${body.substring(0, 100)}` : ""}`,
    };
  } catch (error) {
    return {
      criterionId: criterion.id,
      description: criterion.description,
      passed: false,
      reason: `Request failed: ${error.message}`,
    };
  }
}

/**
 * Validate file existence criterion
 */
async function validateFileCriterion(
  criterion: PassCriterion,
): Promise<CriterionResult> {
  // Parse: "File src/api/auth.ts exists"
  const match = criterion.description.match(/[Ff]ile\s+([\w\/\-\.]+)\s+exists/);

  if (!match) {
    return {
      criterionId: criterion.id,
      description: criterion.description,
      passed: false,
      reason: "Could not parse file path from description",
    };
  }

  const [, filePath] = match;
  const exists = existsSync(filePath);

  return {
    criterionId: criterion.id,
    description: criterion.description,
    passed: exists,
    evidence: exists
      ? `File exists at ${filePath}`
      : `File not found: ${filePath}`,
  };
}

/**
 * Validate custom criterion (manual check required)
 */
async function validateCustomCriterion(
  criterion: PassCriterion,
): Promise<CriterionResult> {
  // Custom criteria require manual verification or specific parsing
  // For now, mark as requiring manual check
  return {
    criterionId: criterion.id,
    description: criterion.description,
    passed: false,
    reason: "Custom criterion requires manual verification",
  };
}

/**
 * Helper: Extract test pattern from description
 */
function extractTestPattern(description: string): string | null {
  const patterns = [
    /(\w+)\.test\.ts/, // "auth.test.ts"
    /(\w+)\s+tests?/i, // "auth tests"
    /tests?\s+for\s+(\w+)/i, // "tests for auth"
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Helper: Parse test summary from vitest output
 */
function parseTestSummary(output: string): {
  total: number;
  passed: number;
  failed: number;
} {
  const passMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);

  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;

  return {
    total: passed + failed,
    passed,
    failed,
  };
}
```

#### Component 5: Report Generator (NEW)

**File:** `parent-harness/orchestrator/src/qa/report-generator.ts` (NEW)

```typescript
import { ValidationContext } from "./context-loader";
import { CriterionResult } from "./criteria-validator";
import { ValidatorResult } from "../../types/validation";

export interface ValidationReport {
  buildId: string;
  taskId: string;
  status: "passed" | "failed" | "partial";
  markdown: string;
  timestamp: string;
}

/**
 * Generate QA validation report in markdown format
 */
export function generateValidationReport(
  context: ValidationContext,
  compileResult: ValidatorResult,
  testResult: ValidatorResult,
  criteriaResults: CriterionResult[],
): ValidationReport {
  const passedCriteria = criteriaResults.filter((r) => r.passed);
  const failedCriteria = criteriaResults.filter((r) => !r.passed);

  // Determine overall status
  let status: "passed" | "failed" | "partial";
  if (
    compileResult.passed &&
    testResult.passed &&
    failedCriteria.length === 0
  ) {
    status = "passed";
  } else if (
    !compileResult.passed ||
    failedCriteria.length === criteriaResults.length
  ) {
    status = "failed";
  } else {
    status = "partial";
  }

  const statusEmoji =
    status === "passed" ? "✅" : status === "failed" ? "❌" : "⚠️";
  const totalDuration = compileResult.durationMs + testResult.durationMs;

  const markdown = `# QA Validation Report

**Build ID:** ${context.buildId}
**Task:** ${context.taskId}
**Validation Level:** L2 (Standard)
**Status:** ${statusEmoji} ${status.toUpperCase()}
**Duration:** ${formatDuration(totalDuration)}

## Validation Results

### ${compileResult.passed ? "✅" : "❌"} TypeScript Compilation
- Status: ${compileResult.passed ? "PASSED" : "FAILED"}
- Duration: ${formatDuration(compileResult.durationMs)}
- Files checked: ${context.filesModified.length}

${!compileResult.passed ? `\`\`\`\n${compileResult.output?.substring(0, 1000)}\n\`\`\`` : ""}

### ${testResult.passed ? "✅" : "❌"} Test Suite
- Status: ${testResult.passed ? "PASSED" : "FAILED"}
- Duration: ${formatDuration(testResult.durationMs)}
${testResult.output ? `- Output: ${testResult.output.substring(0, 200)}` : ""}

${!testResult.passed ? `\`\`\`\n${testResult.output?.substring(0, 1000)}\n\`\`\`` : ""}

### ${statusEmoji} Pass Criteria (${passedCriteria.length}/${criteriaResults.length})

${criteriaResults.map((r) => formatCriterionResult(r)).join("\n")}

## Recommendation

**${status === "passed" ? "APPROVE" : status === "failed" ? "REJECT" : "REVIEW"}** - ${getRecommendationReason(status, compileResult, testResult, failedCriteria)}

---
Generated by QA Agent v0.1
Timestamp: ${new Date().toISOString()}
`;

  return {
    buildId: context.buildId,
    taskId: context.taskId,
    status,
    markdown,
    timestamp: new Date().toISOString(),
  };
}

function formatCriterionResult(result: CriterionResult): string {
  const icon = result.passed ? "✅" : "❌";
  const evidenceText = result.evidence ? ` - ${result.evidence}` : "";
  const reasonText = result.reason ? ` (${result.reason})` : "";
  return `${result.criterionId}. ${icon} ${result.description}${evidenceText}${reasonText}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function getRecommendationReason(
  status: string,
  compileResult: ValidatorResult,
  testResult: ValidatorResult,
  failedCriteria: CriterionResult[],
): string {
  if (status === "passed") {
    return "All validation checks passed. Implementation meets specification requirements.";
  }

  const reasons: string[] = [];
  if (!compileResult.passed) reasons.push("TypeScript compilation failed");
  if (!testResult.passed) reasons.push("Test suite failed");
  if (failedCriteria.length > 0) {
    reasons.push(`${failedCriteria.length} pass criteria failed`);
  }

  return reasons.join(", ") + ". Build Agent must fix issues before approval.";
}
```

### Integration Points

#### 1. Build Agent → QA Agent Handoff

**Trigger:** Build Agent completes task

**Event:**

```typescript
{
  type: 'build:completed',
  buildId: 'uuid',
  taskId: 'uuid',
  status: 'completed',
  filesModified: ['src/api/auth.ts', 'tests/api/auth.test.ts'],
  timestamp: '2026-02-08T15:30:00Z'
}
```

**QA Agent Response:**

1. Receive event via WebSocket or orchestrator assignment
2. Load build context and specification
3. Run validation suite
4. Report results

#### 2. Orchestrator Integration

**File:** `parent-harness/orchestrator/src/orchestrator/index.ts`

**Add QA assignment logic:**

```typescript
/**
 * Assign completed builds to QA Agent for validation
 */
function assignQAValidationTasks() {
  // Get builds that need validation
  const buildsNeedingQA = db.query(`
    SELECT b.*, t.spec_file_path
    FROM build_executions b
    JOIN tasks t ON b.task_id = t.id
    WHERE b.status = 'completed'
      AND b.validation_status IS NULL
    ORDER BY b.completed_at DESC
    LIMIT 5
  `);

  for (const build of buildsNeedingQA) {
    // Check if qa_agent is idle
    const qaSession = getActiveSession("qa_agent");
    if (qaSession) {
      console.log(`⏭️  QA Agent busy, skipping build ${build.id}`);
      continue;
    }

    // Launch QA Agent for validation
    launchQAAgent(build.id);

    console.log(`✅ Assigned build ${build.id} to QA Agent`);
    break; // Only assign one at a time
  }
}
```

#### 3. Database Schema

**Tables Used:**

- `build_executions` - Track build status and validation results
- `tasks` - Link to specifications
- `validation_runs` - QA validation execution records
- `validator_results` - Individual validator outcomes

**New Fields:**

```sql
-- Add to build_executions table
ALTER TABLE build_executions ADD COLUMN validation_status TEXT; -- 'passed', 'failed', 'partial'
ALTER TABLE build_executions ADD COLUMN validation_report TEXT; -- Markdown report
ALTER TABLE build_executions ADD COLUMN validated_at TEXT; -- ISO timestamp
```

### Error Handling

#### 1. Specification Missing

**Scenario:** Build completed but spec file not found

**Handling:**

```typescript
try {
  const specContent = readFileSync(context.specPath, "utf-8");
} catch (error) {
  return {
    status: "failed",
    reason: `Specification file not found: ${context.specPath}`,
    recommendation: "ESCALATE - Cannot validate without specification",
  };
}
```

#### 2. Pass Criteria Ambiguous

**Scenario:** Criterion cannot be parsed or validated

**Handling:**

```typescript
if (criterion.type === "custom" || !canValidate(criterion)) {
  // Mark as requiring manual verification
  return {
    passed: false,
    reason: "Criterion requires manual verification - escalate to human QA",
    escalate: true,
  };
}
```

#### 3. Validation Timeout

**Scenario:** Test suite takes too long (>5 minutes)

**Handling:**

```typescript
const timeout = setTimeout(() => {
  proc.kill("SIGTERM");
  resolve({
    passed: false,
    reason: "Validation timeout after 5 minutes",
    recommendation: "Investigate test performance or increase timeout",
  });
}, 300_000); // 5 min
```

#### 4. Service Not Running

**Scenario:** API endpoint check fails because service not started

**Handling:**

```typescript
try {
  const response = await fetch(url, { method, timeout: 5000 });
} catch (error) {
  if (error.code === "ECONNREFUSED") {
    return {
      passed: false,
      reason: "Service not running - start API server before validation",
      recommendation: "Ensure npm run dev is running",
    };
  }
  throw error;
}
```

---

## Pass Criteria

### 1. ✅ Context Loading

- [ ] Load build execution record from database
- [ ] Load specification file from docs/specs/
- [ ] Parse pass criteria from specification
- [ ] Extract modified files from build record

**Test:**

```typescript
const context = await loadValidationContext(buildId);
expect(context.passCriteria).toHaveLength(5);
expect(context.filesModified).toContain("src/api/auth.ts");
```

### 2. ✅ TypeScript Compilation Validation

- [ ] Run tsc --noEmit on modified files
- [ ] Parse compilation errors with file:line:column
- [ ] Return pass/fail with actionable feedback

**Test:**

```typescript
const result = await runTypescriptValidator(runId, ["--noEmit"]);
expect(result.validatorName).toBe("typescript");
expect(result.status).toBe("completed");
```

### 3. ✅ Test Execution Validation

- [ ] Identify related test files for modified code
- [ ] Run vitest with targeted tests
- [ ] Parse test failures with assertions
- [ ] Return pass/fail with test summary

**Test:**

```typescript
const result = await runTestRunner(runId, ["run", "auth.test.ts"]);
expect(result.passed).toBe(true);
expect(result.output).toContain("15 passed");
```

### 4. ✅ File Artifact Verification

- [ ] Check file existence from pass criteria
- [ ] Verify files at expected paths
- [ ] Return pass/fail with evidence

**Test:**

```typescript
const criterion = {
  id: 1,
  description: "File src/api/auth.ts exists",
  type: "file",
};
const result = await validateFileCriterion(criterion);
expect(result.passed).toBe(true);
expect(result.evidence).toContain("File exists");
```

### 5. ✅ Endpoint Health Verification

- [ ] Parse HTTP method and path from criterion
- [ ] Make request to endpoint
- [ ] Verify status code matches expected
- [ ] Return evidence with response details

**Test:**

```typescript
const criterion = {
  id: 2,
  description: "GET /api/health returns 200",
  type: "endpoint",
};
const result = await validateEndpointCriterion(criterion);
expect(result.passed).toBe(true);
expect(result.evidence).toContain("returned 200");
```

### 6. ✅ Pass Criteria Parsing

- [ ] Extract pass criteria section from spec markdown
- [ ] Parse numbered list with descriptions
- [ ] Infer validation type (compile/test/endpoint/file/custom)
- [ ] Return structured criteria array

**Test:**

```typescript
const criteria = parsePassCriteria(specContent);
expect(criteria).toHaveLength(5);
expect(criteria[0].type).toBe("compile");
expect(criteria[1].type).toBe("endpoint");
```

### 7. ✅ Pass Criteria Validation

- [ ] Validate each criterion based on type
- [ ] Collect evidence for passed criteria
- [ ] Collect reasons for failed criteria
- [ ] Return array of results with pass/fail status

**Test:**

```typescript
const results = await validatePassCriteria(criteria, context);
expect(results).toHaveLength(5);
expect(results.filter((r) => r.passed)).toHaveLength(5); // All pass
```

### 8. ✅ Report Generation

- [ ] Aggregate validator results and criteria results
- [ ] Determine overall status (passed/failed/partial)
- [ ] Generate markdown report with all sections
- [ ] Include recommendation (APPROVE/REJECT/REVIEW)

**Test:**

```typescript
const report = generateValidationReport(
  context,
  compileResult,
  testResult,
  criteriaResults,
);
expect(report.status).toBe("passed");
expect(report.markdown).toContain("✅ PASSED");
expect(report.markdown).toContain("## Recommendation");
```

### 9. ✅ Database Integration

- [ ] Update build_executions with validation_status
- [ ] Store validation_report markdown
- [ ] Record validated_at timestamp
- [ ] Create validation_runs record

**Test:**

```typescript
await updateBuildValidation(buildId, report);
const build = await getBuildExecution(buildId);
expect(build.validation_status).toBe("passed");
expect(build.validation_report).toContain("QA Validation Report");
```

### 10. ✅ End-to-End Validation

- [ ] Receive build completion event
- [ ] Load context and spec
- [ ] Run all validators
- [ ] Validate pass criteria
- [ ] Generate and store report
- [ ] Emit validation:completed event

**Integration Test:**

```typescript
// Trigger validation after build
const buildId = await simulateBuildCompletion();

// QA Agent processes validation
const result = await runQAValidation(buildId);

// Verify all steps completed
expect(result.status).toBe("passed");
expect(result.compilePassed).toBe(true);
expect(result.testsPassed).toBe(true);
expect(result.criteriaPassedCount).toBe(5);
expect(result.reportGenerated).toBe(true);
```

---

## Dependencies

### Upstream Dependencies (must exist first)

1. **PHASE2-TASK-01: Spec Agent v0.1** ✅ COMPLETE
   - Provides specifications with pass criteria
   - Pass criteria format must be parseable

2. **PHASE2-TASK-02: Build Agent v0.1** (IN PROGRESS)
   - Provides build execution records
   - Triggers QA validation on completion
   - Records files modified and tests run

3. **Validation Infrastructure** ✅ EXISTS
   - `agents/validation/orchestrator.ts` - ValidationOrchestrator
   - `agents/validation/validators/` - Individual validators
   - `types/validation.ts` - Type definitions

### Downstream Dependencies (blocked until this completes)

1. **PHASE3-TASK-01: Task Queue Persistence**
   - Needs QA validation results for task completion

2. **PHASE5-TASK-02: Planning Agent**
   - Uses QA reports for task success metrics

3. **Self-Improvement Loop**
   - Analyzes QA failures to improve Build Agent

### External Dependencies

1. **Node.js & npm**
   - TypeScript compiler (tsc)
   - Vitest test runner
   - Express API server (for endpoint checks)

2. **Database**
   - SQLite with build_executions table
   - Validation schema tables

---

## Implementation Plan

### Phase 1: Context Loading & Parsing (2-3 hours)

1. Create `context-loader.ts` with loadValidationContext()
2. Implement parsePassCriteria() for spec parsing
3. Implement inferCriterionType() for type detection
4. Unit tests for parsing logic

### Phase 2: Validator Integration (2-3 hours)

1. Enhance TypeScript validator with targeted file checking
2. Enhance test runner with targeted test execution
3. Create pass criteria validator with criterion-specific logic
4. Unit tests for each validator

### Phase 3: Artifact Verification (2-3 hours)

1. Implement file existence checks
2. Implement endpoint health checks
3. Implement database verification (schema exists)
4. Unit tests for artifact verification

### Phase 4: Report Generation (1-2 hours)

1. Create report-generator.ts with markdown formatting
2. Implement status aggregation logic
3. Implement recommendation generator
4. Unit tests for report formatting

### Phase 5: Orchestrator Integration (2-3 hours)

1. Create qa-agent-prompt.ts with system prompt
2. Add QA assignment logic to orchestrator
3. Create QA agent launcher
4. Database schema updates (validation_status fields)

### Phase 6: Testing & Polish (2-3 hours)

1. Integration tests for full pipeline
2. E2E test with real Build Agent output
3. Error handling and edge cases
4. Telegram notifications
5. WebSocket event broadcasting

**Total Estimated Time:** 10-14 hours

---

## Testing Strategy

### Unit Tests

**File:** `tests/qa-agent/context-loader.test.ts`

```typescript
describe("Context Loader", () => {
  it("should load build context from database");
  it("should parse pass criteria from spec");
  it("should infer criterion types correctly");
  it("should handle missing spec gracefully");
});
```

**File:** `tests/qa-agent/criteria-validator.test.ts`

```typescript
describe("Criteria Validator", () => {
  it("should validate compile criteria");
  it("should validate test criteria");
  it("should validate endpoint criteria");
  it("should validate file criteria");
  it("should handle custom criteria");
});
```

### Integration Tests

**File:** `tests/qa-agent/validation-workflow.test.ts`

```typescript
describe("QA Validation Workflow", () => {
  it("should validate successful build", async () => {
    const buildId = await createMockBuild({ status: "completed" });
    const result = await runQAValidation(buildId);

    expect(result.status).toBe("passed");
    expect(result.report).toContain("✅ PASSED");
  });

  it("should detect compilation failures", async () => {
    const buildId = await createMockBuild({
      status: "completed",
      hasCompileErrors: true,
    });
    const result = await runQAValidation(buildId);

    expect(result.status).toBe("failed");
    expect(result.report).toContain("TypeScript compilation failed");
  });
});
```

### E2E Tests

**File:** `tests/e2e/spec-build-qa-pipeline.test.ts`

```typescript
describe("Spec → Build → QA Pipeline", () => {
  it("should complete full autonomous execution", async () => {
    // 1. Create task
    const task = await createTask({
      title: "Add health endpoint",
      priority: "P0",
    });

    // 2. Spec Agent generates spec
    await runSpecAgent(task.id);
    const spec = await getTaskSpec(task.id);
    expect(spec).toBeDefined();

    // 3. Build Agent implements
    await runBuildAgent(task.id);
    const build = await getBuildRecord(task.id);
    expect(build.status).toBe("completed");

    // 4. QA Agent validates
    await runQAAgent(build.id);
    const validation = await getValidationRecord(build.id);
    expect(validation.status).toBe("passed");

    // 5. Task marked complete
    const updatedTask = await getTask(task.id);
    expect(updatedTask.status).toBe("validated");
  });
});
```

---

## Success Metrics

### Quantitative Metrics

1. **Validation Accuracy**
   - Target: >95% of passing builds correctly marked as passed
   - Measure: `correctPassedValidations / totalPassedBuilds`

2. **False Positive Rate**
   - Target: <5% of failed builds incorrectly marked as passed
   - Measure: `falsePositives / totalValidations`

3. **Validation Speed**
   - Target: <3 minutes for L2 validation
   - Measure: Average validation duration

4. **Criterion Coverage**
   - Target: >90% of pass criteria automatically validated
   - Measure: `automatedCriteria / totalCriteria`

### Qualitative Metrics

1. **Report Clarity**
   - Reports include actionable feedback
   - Evidence provided for each criterion
   - Clear APPROVE/REJECT recommendation

2. **Integration Reliability**
   - Pipeline runs autonomously without intervention
   - Errors handled gracefully with clear messages
   - Events broadcast correctly to dashboard

---

## Open Questions

### 1. Validation Timeout Limits?

**Question:** What are acceptable timeout limits for each validator?

**Options:**

- **A:** Fixed limits (TypeScript: 30s, Tests: 2min, Endpoints: 5s)
- **B:** Dynamic based on task size
- **C:** Configurable per-task in spec

**Recommendation:** **A** (fixed limits) for Phase 2, add **C** (configurable) in Phase 4.

### 2. Partial Approval?

**Question:** Should QA Agent allow partial approvals (some criteria pass, others fail)?

**Options:**

- **A:** Binary (all pass = approved, any fail = rejected)
- **B:** Allow partial with human review
- **C:** Weight criteria (critical vs optional)

**Recommendation:** **A** (binary) for Phase 2, add **C** (weighted criteria) in Phase 6.

### 3. Re-validation After Fixes?

**Question:** How does QA Agent handle re-validation after Build Agent fixes issues?

**Options:**

- **A:** Full re-validation from scratch
- **B:** Incremental (only re-run failed validators)
- **C:** Smart diff (only validate changed files)

**Recommendation:** **A** (full) for Phase 2, optimize with **B** in Phase 5.

---

## References

### Existing Code

- `agents/validation/orchestrator.ts` - Validation framework
- `agents/validation/validators/typescript-validator.ts` - TS compilation
- `agents/validation/validators/test-runner.ts` - Test execution
- `parent-harness/orchestrator/src/agents/metadata.ts` - QA Agent metadata

### Specifications

- `PHASE2-TASK-01-spec-agent-v0.1.md` - Spec Agent reference
- `PHASE2-TASK-02-build-agent-v0.1.md` - Build Agent integration
- `STRATEGIC_PLAN.md` - Phase 2 overview

---

**End of Specification**
