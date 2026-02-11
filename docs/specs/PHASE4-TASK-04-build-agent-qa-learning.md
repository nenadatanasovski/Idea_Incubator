# PHASE4-TASK-04: Build Agent Learning from QA Failures

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Medium
**Created:** 2026-02-08
**Model:** Sonnet 4.5 (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement a learning system where the Build Agent learns from QA Agent failures to improve future implementations and avoid repeating common pitfalls. This creates a self-improving development loop where QA failures become learning opportunities that are systematically captured, analyzed, and applied to prevent similar issues in future tasks.

**Problem:** Currently, when the QA Agent validates a task and finds failures (TypeScript compilation errors, test failures, build failures), the Build Agent receives feedback but doesn't systematically learn from these mistakes. The same types of errors recur across different tasks because there's no mechanism to capture, categorize, and reuse QA failure patterns. Each Build Agent instance starts fresh without benefiting from past QA failures experienced by previous builds.

**Solution:** Create a bidirectional learning loop between Build Agent and QA Agent that:

1. Captures QA failure patterns with error classification and context
2. Associates failures with specific implementation techniques that caused them
3. Enables Build Agent to query past QA failures before implementing
4. Provides proactive warnings about known pitfalls for similar tasks
5. Tracks technique effectiveness (which approaches pass QA vs. fail)
6. Learns from both failures and successes to identify best practices
7. Integrates with existing Knowledge Base (PHASE4-TASK-01) for unified learning

---

## Current State Analysis

### Existing Infrastructure ✅

**1. QA Agent Verification System** (`parent-harness/orchestrator/src/qa/index.ts`)

- ✅ Runs TypeScript compilation checks
- ✅ Runs build verification (`npm run build`)
- ✅ Runs test suite (`npm test`)
- ✅ Validates pass criteria from task definitions
- ✅ Returns structured QAResult with checks array
- ✅ Captures stdout/stderr output for failures
- ✅ Creates fix tasks for failures
- ✅ Updates task status based on verification
- ❌ **Gap:** No systematic failure pattern capture
- ❌ **Gap:** No learning feedback to Build Agent
- ❌ **Gap:** No failure categorization or root cause analysis

**2. QA Service Event System** (`parent-harness/orchestrator/src/events/qa-service.ts`)

- ✅ Event-driven QA queue processing
- ✅ Listens for `task:ready_for_qa` events
- ✅ Emits `task:qa_passed` and `task:qa_failed` events
- ✅ Concurrency control (one QA at a time)
- ✅ Retry logic for transient failures
- ✅ System event integration (CPU monitoring)
- ❌ **Gap:** No failure detail emission in events
- ❌ **Gap:** No learning event emission (`qa:learning_captured`)

**3. Knowledge Base System** (PHASE4-TASK-01 - VERIFIED COMPLETE)

- ✅ Database tables: `knowledge_entries`, `claude_md_proposals`, `gotcha_applications`
- ✅ Types: gotcha, pattern, decision
- ✅ Confidence tracking with boost/decay logic
- ✅ Duplicate detection using similarity matching
- ✅ File pattern and action type associations
- ✅ SIA integration for knowledge writing
- ✅ 31 passing tests, 0 TypeScript errors
- ⚠️ **Partial:** No QA-specific failure entry type
- ⚠️ **Partial:** No technique effectiveness tracking

**4. Build Agent Orchestrator** (`server/services/task-agent/build-agent-orchestrator.ts`)

- ✅ Spawns Build Agents for tasks
- ✅ Tracks execution status and errors
- ✅ Error handling integration (GAP-002)
- ✅ SIA escalation for stuck tasks
- ✅ Failure classification system
- ✅ Consecutive failure tracking
- ❌ **Gap:** No pre-task learning injection
- ❌ **Gap:** No post-QA learning capture

**5. Parent Harness Memory System** (`parent-harness/data/harness.db` - agent_memory table)

- ✅ Per-agent key-value memory storage
- ✅ Memory types: context, learning, preference, error_pattern, success_pattern
- ✅ Access tracking and importance scoring
- ✅ Expiration and retention logic
- ✅ REST API for memory operations
- ❌ **Gap:** No QA-specific learning memory type
- ❌ **Gap:** No cross-agent learning (Build → QA → Build)

### Gaps Summary

| Gap                                 | Impact                        | Solution                                         |
| ----------------------------------- | ----------------------------- | ------------------------------------------------ |
| No QA failure pattern capture       | Same errors repeated          | Add `qa_failures` table with categorization      |
| No technique effectiveness tracking | Unknown which approaches work | Track technique → QA outcome mapping             |
| No Build Agent learning injection   | Agents ignore past failures   | Inject relevant failures into Build Agent prompt |
| No failure root cause analysis      | Surface symptoms, not causes  | Add error pattern extraction from QA output      |
| No success pattern tracking         | Only learn from failures      | Track successful techniques that pass QA         |
| No pitfall warnings                 | Preventable errors occur      | Proactive warning system for known pitfalls      |

---

## Requirements

### Functional Requirements

**FR-1: QA Failure Pattern Capture**

- MUST capture detailed QA failure information:
  - **Failure type**: compilation_error, test_failure, build_failure, criteria_unmet
  - **Error pattern**: Normalized error message (e.g., "TypeError: Cannot read property")
  - **Failure context**: Task ID, file affected, line number if available
  - **Root cause category**: syntax, logic, missing_dependency, type_mismatch, etc.
  - **QA output**: Full stdout/stderr (truncated to 10KB)
  - **Implementation technique**: What the Build Agent tried (extracted from task logs)
- MUST link failures to specific tasks and Build Agent sessions
- MUST track failure frequency (how many times this pattern occurs)
- MUST support manual override of categorization
- SHOULD auto-extract error patterns from QA output using regex

**FR-2: Technique Effectiveness Tracking**

- MUST record which implementation techniques lead to QA success vs. failure
- MUST track technique metadata:
  - **Technique description**: "Use TypeScript interfaces for API contracts"
  - **Category**: architectural, syntax, testing, dependency, etc.
  - **File patterns**: Where applicable (e.g., `*.ts`, `server/routes/*`)
  - **Success count**: How many times passed QA
  - **Failure count**: How many times failed QA
  - **Effectiveness rate**: success / (success + failure)
- MUST support technique tagging (e.g., "async-patterns", "error-handling")
- MUST link techniques to specific knowledge entries
- MUST track technique evolution (v1 → v2 based on learnings)
- SHOULD recommend best techniques for specific task categories

**FR-3: Build Agent Learning Injection**

- MUST inject relevant QA failure learnings before Build Agent starts implementation
- MUST retrieve learnings by:
  - **Task similarity**: Similar titles, file patterns, dependencies
  - **Error pattern match**: Known error types for this task category
  - **Recent failures**: Last 30 days of QA failures
  - **High-impact failures**: Critical errors that blocked multiple tasks
- MUST format learnings for Build Agent system prompt:
  - "Past QA Failures to Avoid"
  - "Known Pitfalls for [task category]"
  - "Recommended Techniques (80%+ QA pass rate)"
- MUST track which learnings were injected into which sessions
- MUST measure learning impact (QA pass rate with vs. without learnings)
- SHOULD support learning priority (critical > high > medium > low)

**FR-4: Pitfall Warning System**

- MUST proactively warn Build Agent about known pitfalls before implementation
- MUST detect warning triggers:
  - **File pattern match**: Task affects files known to have issues
  - **Dependency match**: Task involves dependencies with known gotchas
  - **Task category match**: Task type has historical QA failures
  - **Error pattern match**: Task description contains phrases that caused errors before
- MUST format warnings with actionable guidance:
  - "⚠️ Warning: 5 past tasks touching [file] failed QA due to [issue]"
  - "✅ Recommendation: [specific technique that works]"
- MUST support warning suppression (if Build Agent acknowledges)
- SHOULD track warning effectiveness (prevented errors vs. ignored warnings)

**FR-5: Success Pattern Recognition**

- MUST capture successful implementation patterns from QA-passing tasks
- MUST extract success indicators:
  - **Clean first-pass**: Task passed QA on first attempt
  - **Fast completion**: Task completed faster than average
  - **Zero critical failures**: No TypeScript/build errors
  - **High test coverage**: Tests passed with good assertions
- MUST promote high-confidence success patterns to knowledge base
- MUST link success patterns to specific techniques
- MUST track pattern reuse (how many times applied successfully)
- SHOULD identify "golden patterns" (100% QA pass rate, 5+ uses)

**FR-6: Failure Root Cause Analysis**

- MUST categorize QA failures by root cause:
  - **Syntax errors**: Missing semicolons, typos, invalid syntax
  - **Type mismatches**: TypeScript type errors, interface violations
  - **Logic errors**: Test failures, incorrect behavior
  - **Missing dependencies**: Import errors, package not installed
  - **Configuration errors**: Build config, tsconfig issues
  - **Incomplete implementation**: Missing required functions/files
- MUST extract root cause from QA output using pattern matching
- MUST support manual root cause override
- MUST track root cause frequency distribution
- MUST recommend fixes for each root cause category
- SHOULD learn new root cause patterns from repeated failures

**FR-7: Learning Feedback Loop**

- MUST create event-driven feedback flow:
  1. Build Agent completes task → `task:ready_for_qa`
  2. QA Agent validates → `task:qa_failed` (with failure details)
  3. Learning system captures failure → `qa:learning_captured`
  4. Knowledge base updated → `knowledge:qa_failure_added`
  5. Next Build Agent spawns → learnings injected into prompt
- MUST track complete learning lifecycle in database
- MUST measure learning system effectiveness (metrics over time)
- MUST support learning feedback approval workflow (human-in-loop)
- SHOULD emit learning events for observability

### Non-Functional Requirements

**NFR-1: Performance**

- Failure capture MUST NOT delay QA verification (<100ms overhead)
- Learning retrieval MUST complete in <300ms for Build Agent spawn
- Technique effectiveness calculation MUST be real-time (not batch)
- Root cause analysis MUST complete in <500ms
- System MUST handle 100+ failures per day without degradation

**NFR-2: Data Integrity**

- QA failures MUST be immutable (append-only log)
- Technique statistics MUST be atomic (no race conditions)
- Learning injections MUST be auditable (track what was used)
- Duplicate failures MUST be detected and merged (>85% similarity)
- Failure data MUST survive system restarts (persistent storage)

**NFR-3: Usability**

- Failure capture MUST be automatic (no Build/QA Agent code changes)
- Learning format MUST be human-readable (for debugging)
- Warnings MUST be concise (3-5 sentences max)
- Metrics MUST be visualizable (dashboard integration ready)
- Learning system MUST be configurable (enable/disable, thresholds)

**NFR-4: Observability**

- MUST log all failure captures with task ID, timestamp
- MUST emit events for learning lifecycle stages
- MUST expose metrics endpoint: `/api/learning/metrics`
- MUST track learning reuse statistics
- MUST support export to JSON for analysis

**NFR-5: Integration**

- MUST integrate with existing Knowledge Base (PHASE4-TASK-01)
- MUST integrate with QA Service event system
- MUST integrate with Build Agent spawner
- MUST integrate with agent memory system
- MUST NOT require schema changes to existing tables (extend only)

---

## Technical Design

### Database Schema Extensions

**Extend existing Knowledge Base** (`database/ideas.db`):

```sql
-- ============================================
-- BUILD AGENT QA LEARNING SYSTEM
-- ============================================

-- QA Failures (detailed failure records)
CREATE TABLE IF NOT EXISTS qa_failures (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    session_id TEXT,                          -- Build Agent session

    -- Failure classification
    failure_type TEXT NOT NULL CHECK(failure_type IN (
        'compilation_error', 'test_failure', 'build_failure', 'criteria_unmet'
    )),
    error_pattern TEXT NOT NULL,              -- Normalized error message
    root_cause TEXT CHECK(root_cause IN (
        'syntax', 'type_mismatch', 'logic', 'missing_dependency',
        'configuration', 'incomplete_implementation', 'other'
    )),

    -- Context
    file_affected TEXT,                       -- File path where error occurred
    line_number INTEGER,
    technique_attempted TEXT,                 -- What the Build Agent tried

    -- Output
    qa_output TEXT,                           -- Full QA stdout/stderr (truncated 10KB)
    error_details TEXT,                       -- Extracted error details

    -- Lifecycle
    captured_at TEXT DEFAULT (datetime('now')),
    reviewed INTEGER DEFAULT 0,               -- 0 = pending, 1 = reviewed
    learning_created TEXT,                    -- ID of knowledge entry created from this

    FOREIGN KEY (learning_created) REFERENCES knowledge_entries(id)
);

CREATE INDEX idx_qa_failures_task ON qa_failures(task_id);
CREATE INDEX idx_qa_failures_type ON qa_failures(failure_type);
CREATE INDEX idx_qa_failures_pattern ON qa_failures(error_pattern);
CREATE INDEX idx_qa_failures_root_cause ON qa_failures(root_cause);
CREATE INDEX idx_qa_failures_captured ON qa_failures(captured_at);

-- Technique Effectiveness (track what works)
CREATE TABLE IF NOT EXISTS technique_effectiveness (
    id TEXT PRIMARY KEY,
    technique_name TEXT NOT NULL UNIQUE,
    technique_description TEXT NOT NULL,
    category TEXT NOT NULL,                   -- architectural, syntax, testing, etc.

    -- Applicability
    file_patterns_json TEXT DEFAULT '[]',     -- ["*.ts", "server/*"]
    task_categories TEXT,                     -- JSON array
    tags TEXT,                                -- JSON array for filtering

    -- Statistics
    qa_success_count INTEGER DEFAULT 0,
    qa_failure_count INTEGER DEFAULT 0,
    effectiveness_rate REAL GENERATED ALWAYS AS (
        CASE
            WHEN (qa_success_count + qa_failure_count) = 0 THEN 0.5
            ELSE CAST(qa_success_count AS REAL) / (qa_success_count + qa_failure_count)
        END
    ) STORED,

    -- Linkage
    knowledge_entry_id TEXT REFERENCES knowledge_entries(id),

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_technique_effectiveness ON technique_effectiveness(effectiveness_rate);
CREATE INDEX idx_technique_category ON technique_effectiveness(category);

-- Technique Applications (track usage)
CREATE TABLE IF NOT EXISTS technique_applications (
    id TEXT PRIMARY KEY,
    technique_id TEXT NOT NULL REFERENCES technique_effectiveness(id),
    task_id TEXT NOT NULL,
    session_id TEXT,

    -- Outcome
    qa_result TEXT NOT NULL CHECK(qa_result IN ('passed', 'failed', 'not_tested')),
    applied_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_tech_apps_technique ON technique_applications(technique_id);
CREATE INDEX idx_tech_apps_task ON technique_applications(task_id);

-- Learning Injections (track what was injected into Build Agent)
CREATE TABLE IF NOT EXISTS learning_injections (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,                 -- Build Agent session
    task_id TEXT NOT NULL,

    -- Injected content
    failure_learnings_json TEXT,              -- JSON array of qa_failures.id
    technique_recommendations_json TEXT,      -- JSON array of technique_effectiveness.id
    pitfall_warnings_json TEXT,               -- JSON array of warning messages

    -- Impact tracking
    qa_result TEXT CHECK(qa_result IN ('passed', 'failed', 'pending')),
    prevented_known_errors INTEGER DEFAULT 0, -- Count of errors that didn't occur

    injected_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE INDEX idx_injections_session ON learning_injections(session_id);
CREATE INDEX idx_injections_task ON learning_injections(task_id);

-- Pitfall Warnings (proactive warning system)
CREATE TABLE IF NOT EXISTS pitfall_warnings (
    id TEXT PRIMARY KEY,
    warning_name TEXT NOT NULL UNIQUE,
    warning_message TEXT NOT NULL,

    -- Trigger conditions
    file_pattern TEXT,                        -- Triggers for specific files
    task_category TEXT,                       -- Triggers for task types
    error_pattern TEXT,                       -- Triggers for known error patterns

    -- Guidance
    recommendation TEXT NOT NULL,             -- What to do instead
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- Statistics
    times_triggered INTEGER DEFAULT 0,
    times_prevented_error INTEGER DEFAULT 0,  -- Warning heeded and error avoided
    times_ignored INTEGER DEFAULT 0,          -- Warning shown but error occurred
    effectiveness_rate REAL,

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_warnings_file ON pitfall_warnings(file_pattern);
CREATE INDEX idx_warnings_category ON pitfall_warnings(task_category);

-- Success Patterns (learn from QA passes)
CREATE TABLE IF NOT EXISTS success_patterns (
    id TEXT PRIMARY KEY,
    pattern_name TEXT NOT NULL,
    pattern_description TEXT NOT NULL,

    -- Success indicators
    clean_first_pass INTEGER DEFAULT 0,       -- Passed QA on first try
    avg_completion_time_ms INTEGER,
    technique_used TEXT,                      -- Technique that led to success

    -- Context
    file_patterns_json TEXT DEFAULT '[]',
    task_category TEXT,

    -- Statistics
    times_applied INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 1.0,

    -- Linkage
    knowledge_entry_id TEXT REFERENCES knowledge_entries(id),

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_success_patterns_rate ON success_patterns(success_rate);
```

**Seed data for common pitfalls:**

```sql
-- Insert common pitfall warnings
INSERT INTO pitfall_warnings (id, warning_name, warning_message, file_pattern, recommendation, severity) VALUES
('pw_001', 'typescript_any_type', 'TypeScript files often fail QA due to implicit "any" types', '%.ts', 'Always add explicit type annotations. Use interfaces for complex objects. Avoid "any" unless absolutely necessary.', 'high'),
('pw_002', 'missing_error_handling', 'API routes without error handling frequently fail tests', 'server/routes/%.ts', 'Wrap async operations in try-catch. Return proper error responses (400/500). Log errors with context.', 'critical'),
('pw_003', 'unhandled_promise_rejection', 'Async functions without await often cause test failures', '%.ts', 'Always await async functions. Use Promise.all for parallel operations. Handle rejections with .catch().', 'high'),
('pw_004', 'missing_test_coverage', 'New features without tests fail QA verification', NULL, 'Write unit tests for new functions. Add integration tests for API endpoints. Aim for 80%+ coverage.', 'medium'),
('pw_005', 'hardcoded_paths', 'Hardcoded file paths break builds on different systems', '%.ts', 'Use path.join() for cross-platform paths. Use environment variables for configurable paths. Avoid absolute paths.', 'high');
```

### Core Modules

#### 1. QA Failure Capture Service (`parent-harness/orchestrator/src/learning/qa-failure-capture.ts`)

```typescript
import { v4 as uuid } from "uuid";
import { run, getOne, query } from "../db/index.js";
import type { QAResult, QACheck } from "../qa/index.js";

export interface QAFailure {
  id: string;
  taskId: string;
  sessionId?: string;
  failureType:
    | "compilation_error"
    | "test_failure"
    | "build_failure"
    | "criteria_unmet";
  errorPattern: string;
  rootCause?: string;
  fileAffected?: string;
  lineNumber?: number;
  techniqueAttempted?: string;
  qaOutput: string;
  errorDetails: string;
  capturedAt: string;
}

/**
 * Capture QA failure for learning
 */
export async function captureQAFailure(
  taskId: string,
  qaResult: QAResult,
  sessionId?: string,
): Promise<QAFailure[]> {
  const failures: QAFailure[] = [];

  // Process each failed check
  for (const check of qaResult.checks.filter((c) => !c.passed)) {
    const failure = await processFailedCheck(taskId, check, sessionId);
    if (failure) {
      failures.push(failure);
    }
  }

  console.log(
    `📚 Learning: Captured ${failures.length} QA failures for task ${taskId}`,
  );

  return failures;
}

/**
 * Process a single failed check
 */
async function processFailedCheck(
  taskId: string,
  check: QACheck,
  sessionId?: string,
): Promise<QAFailure | null> {
  // Determine failure type
  const failureType = classifyCheckFailure(check.name);

  // Extract error pattern
  const errorPattern = extractErrorPattern(check.error || "");

  // Check for duplicate (same pattern in last 7 days)
  const existing = await findSimilarFailure(taskId, errorPattern);
  if (existing) {
    console.log(
      `📚 Learning: Duplicate failure pattern detected (${errorPattern.substring(0, 50)}...)`,
    );
    return existing;
  }

  // Analyze root cause
  const rootCause = analyzeRootCause(check.error || "", check.output || "");

  // Extract file and line info
  const { file, line } = extractFileLocation(check.error || "");

  // Create failure record
  const id = uuid();
  const qaOutput = truncate(
    (check.output || "") + "\n" + (check.error || ""),
    10000,
  );
  const errorDetails = extractErrorDetails(check.error || "");

  const failure: QAFailure = {
    id,
    taskId,
    sessionId,
    failureType,
    errorPattern,
    rootCause,
    fileAffected: file,
    lineNumber: line,
    qaOutput,
    errorDetails,
    capturedAt: new Date().toISOString(),
  };

  await run(
    `
    INSERT INTO qa_failures
    (id, task_id, session_id, failure_type, error_pattern, root_cause,
     file_affected, line_number, qa_output, error_details, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      taskId,
      sessionId,
      failureType,
      errorPattern,
      rootCause,
      file,
      line,
      qaOutput,
      errorDetails,
      failure.capturedAt,
    ],
  );

  return failure;
}

/**
 * Classify check failure type
 */
function classifyCheckFailure(checkName: string): QAFailure["failureType"] {
  if (checkName.includes("TypeScript")) return "compilation_error";
  if (checkName.includes("Build")) return "build_failure";
  if (checkName.includes("Tests")) return "test_failure";
  if (checkName.includes("Criterion")) return "criteria_unmet";
  return "compilation_error";
}

/**
 * Extract normalized error pattern
 */
function extractErrorPattern(errorText: string): string {
  // Remove file paths
  let pattern = errorText.replace(/\/[^\s:]+\//g, "[PATH]/");

  // Remove line numbers
  pattern = pattern.replace(/:\d+:\d+/g, ":L:C");

  // Remove specific variable names
  pattern = pattern.replace(/\b([a-z_][a-zA-Z0-9_]*)\b/g, "[VAR]");

  // Normalize whitespace
  pattern = pattern.replace(/\s+/g, " ").trim();

  // Take first 100 chars
  return pattern.substring(0, 100);
}

/**
 * Analyze root cause from error output
 */
function analyzeRootCause(
  error: string,
  output: string,
): QAFailure["rootCause"] {
  const combined = (error + " " + output).toLowerCase();

  if (/cannot find (module|name|namespace)/i.test(combined))
    return "missing_dependency";
  if (/type '.*' is not assignable/i.test(combined)) return "type_mismatch";
  if (/unexpected token|syntax error/i.test(combined)) return "syntax";
  if (/expected.*but got/i.test(combined)) return "logic";
  if (/cannot read property|undefined is not/i.test(combined)) return "logic";
  if (/module not found|cannot resolve/i.test(combined))
    return "missing_dependency";
  if (/no such file|enoent/i.test(combined)) return "configuration";

  return "other";
}

/**
 * Extract file location from error message
 */
function extractFileLocation(error: string): { file?: string; line?: number } {
  // Match patterns like: "path/to/file.ts:123:45"
  const match = error.match(/([^\s:]+\.ts):(\d+):\d+/);
  if (match) {
    return { file: match[1], line: parseInt(match[2], 10) };
  }

  // Match patterns like: "at path/to/file.ts (line 123)"
  const altMatch = error.match(/at ([^\s]+\.ts)[^\d]*(\d+)/);
  if (altMatch) {
    return { file: altMatch[1], line: parseInt(altMatch[2], 10) };
  }

  return {};
}

/**
 * Extract detailed error information
 */
function extractErrorDetails(error: string): string {
  // Extract just the error message, remove stack traces
  const lines = error.split("\n");
  const errorLines = lines.filter(
    (line) => !line.trim().startsWith("at ") && !line.includes("node_modules"),
  );
  return errorLines.slice(0, 10).join("\n").substring(0, 1000);
}

/**
 * Find similar failure in recent history
 */
async function findSimilarFailure(
  taskId: string,
  errorPattern: string,
): Promise<QAFailure | null> {
  const recent = await query<any>(`
    SELECT * FROM qa_failures
    WHERE captured_at > datetime('now', '-7 days')
    ORDER BY captured_at DESC
    LIMIT 50
  `);

  for (const existing of recent) {
    const similarity = calculateSimilarity(
      errorPattern,
      existing.error_pattern,
    );
    if (similarity > 0.85) {
      return {
        id: existing.id,
        taskId: existing.task_id,
        sessionId: existing.session_id,
        failureType: existing.failure_type,
        errorPattern: existing.error_pattern,
        rootCause: existing.root_cause,
        fileAffected: existing.file_affected,
        lineNumber: existing.line_number,
        qaOutput: existing.qa_output,
        errorDetails: existing.error_details,
        capturedAt: existing.captured_at,
      };
    }
  }

  return null;
}

/**
 * Calculate string similarity (Jaccard)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
}
```

#### 2. Learning Injector (`parent-harness/orchestrator/src/learning/learning-injector.ts`)

```typescript
import { query } from "../db/index.js";

export interface LearningContext {
  qaFailures: QAFailureSummary[];
  techniques: TechniqueRecommendation[];
  warnings: PitfallWarning[];
}

export interface QAFailureSummary {
  errorPattern: string;
  rootCause: string;
  occurrences: number;
  lastSeen: string;
  recommendation: string;
}

export interface TechniqueRecommendation {
  name: string;
  description: string;
  effectivenessRate: number;
  successCount: number;
}

export interface PitfallWarning {
  message: string;
  severity: string;
  recommendation: string;
}

/**
 * Get relevant learnings for Build Agent before task execution
 */
export async function getLearningsForTask(params: {
  taskId: string;
  filePatterns?: string[];
  taskCategory?: string;
}): Promise<LearningContext> {
  // Get recent QA failures for similar tasks
  const qaFailures = await getRelevantQAFailures(params);

  // Get technique recommendations
  const techniques = await getRecommendedTechniques(params);

  // Get pitfall warnings
  const warnings = await getPitfallWarnings(params);

  return { qaFailures, techniques, warnings };
}

/**
 * Get relevant QA failures
 */
async function getRelevantQAFailures(params: any): Promise<QAFailureSummary[]> {
  const failures = await query<any>(`
    SELECT
      error_pattern,
      root_cause,
      COUNT(*) as occurrences,
      MAX(captured_at) as last_seen
    FROM qa_failures
    WHERE captured_at > datetime('now', '-30 days')
      AND root_cause IS NOT NULL
    GROUP BY error_pattern, root_cause
    HAVING occurrences >= 2
    ORDER BY occurrences DESC, last_seen DESC
    LIMIT 5
  `);

  return failures.map((f) => ({
    errorPattern: f.error_pattern,
    rootCause: f.root_cause,
    occurrences: f.occurrences,
    lastSeen: f.last_seen,
    recommendation: getRootCauseRecommendation(f.root_cause),
  }));
}

/**
 * Get recommended techniques
 */
async function getRecommendedTechniques(
  params: any,
): Promise<TechniqueRecommendation[]> {
  const techniques = await query<any>(`
    SELECT
      technique_name,
      technique_description,
      effectiveness_rate,
      qa_success_count
    FROM technique_effectiveness
    WHERE effectiveness_rate >= 0.75
      AND (qa_success_count + qa_failure_count) >= 3
    ORDER BY effectiveness_rate DESC, qa_success_count DESC
    LIMIT 5
  `);

  return techniques.map((t) => ({
    name: t.technique_name,
    description: t.technique_description,
    effectivenessRate: t.effectiveness_rate,
    successCount: t.qa_success_count,
  }));
}

/**
 * Get pitfall warnings for task
 */
async function getPitfallWarnings(params: any): Promise<PitfallWarning[]> {
  const warnings: PitfallWarning[] = [];

  // Get warnings that match file patterns or task category
  const matched = await query<any>(`
    SELECT warning_message, severity, recommendation
    FROM pitfall_warnings
    WHERE severity IN ('critical', 'high')
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        ELSE 3
      END,
      times_prevented_error DESC
    LIMIT 3
  `);

  return matched.map((w) => ({
    message: w.warning_message,
    severity: w.severity,
    recommendation: w.recommendation,
  }));
}

/**
 * Get recommendation for root cause
 */
function getRootCauseRecommendation(rootCause: string): string {
  const recommendations: Record<string, string> = {
    syntax:
      "Review TypeScript syntax. Use ESLint for syntax checking before QA.",
    type_mismatch:
      "Add explicit type annotations. Use interfaces for complex types.",
    logic:
      "Write unit tests before implementation. Review logic flow carefully.",
    missing_dependency:
      "Check imports and package.json. Run npm install before building.",
    configuration: "Review tsconfig.json and build configuration files.",
    incomplete_implementation:
      "Ensure all required functions are implemented. Check pass criteria.",
    other: "Review QA output carefully for specific error details.",
  };

  return recommendations[rootCause] || recommendations.other;
}

/**
 * Format learnings for Build Agent system prompt
 */
export function formatLearningsForPrompt(learnings: LearningContext): string {
  const sections: string[] = [];

  if (learnings.warnings.length > 0) {
    sections.push("## ⚠️ Known Pitfalls to Avoid\n");
    for (const warning of learnings.warnings) {
      sections.push(
        `**[${warning.severity.toUpperCase()}]** ${warning.message}`,
      );
      sections.push(`→ ${warning.recommendation}\n`);
    }
  }

  if (learnings.qaFailures.length > 0) {
    sections.push("## 📚 Recent QA Failures to Learn From\n");
    for (const failure of learnings.qaFailures) {
      sections.push(
        `**${failure.rootCause}** (${failure.occurrences}× in last 30 days)`,
      );
      sections.push(`→ ${failure.recommendation}\n`);
    }
  }

  if (learnings.techniques.length > 0) {
    sections.push("## ✅ Recommended Techniques (High QA Pass Rate)\n");
    for (const tech of learnings.techniques) {
      const passRate = (tech.effectivenessRate * 100).toFixed(0);
      sections.push(
        `**${tech.name}** (${passRate}% pass rate, ${tech.successCount} successes)`,
      );
      sections.push(`${tech.description}\n`);
    }
  }

  return sections.join("\n");
}
```

#### 3. Integration with QA Service (`parent-harness/orchestrator/src/events/qa-service.ts`)

Add failure capture after QA verification:

```typescript
// In verifyTask() method, after getting QA result:

import { captureQAFailure } from '../learning/qa-failure-capture.js';
import { bus } from './bus.js';

private async verifyTask(queued: QueuedTask): Promise<void> {
  const { task } = queued;

  try {
    const result = await qa.verifyTask(task.id);

    if (result.passed) {
      transitionTask(task.id, 'completed', {});

      // NEW: Capture success pattern
      bus.emit('qa:success', { task, result });
    } else {
      // NEW: Capture QA failures for learning
      const failures = await captureQAFailure(task.id, result);

      transitionTask(task.id, 'failed', {
        error: result.summary,
        failures: result.checks.filter(c => !c.passed).map(c => c.name),
      });

      // Emit learning event
      bus.emit('qa:learning_captured', { task, failures });

      console.log(`✅ QA Service: ${task.display_id} FAILED - Captured ${failures.length} learnings`);
    }
  } finally {
    // Reset QA agent...
  }
}
```

---

## Pass Criteria

### Database Schema

1. ✅ **Tables created** - qa_failures, technique_effectiveness, technique_applications, learning_injections, pitfall_warnings, success_patterns
2. ✅ **Indexes created** - All performance-critical indexes present
3. ✅ **Seed data** - 5 common pitfall warnings inserted
4. ✅ **Migration tested** - Schema applies cleanly to ideas.db

### QA Failure Capture

5. ✅ **Failure capture works** - `captureQAFailure()` creates entries for all failed checks
6. ✅ **Error pattern extraction** - Patterns normalized (paths/vars removed)
7. ✅ **Root cause analysis** - 6 root cause categories correctly identified
8. ✅ **File location extraction** - File paths and line numbers extracted from errors
9. ✅ **Duplicate detection** - Similar failures (>85%) merged, not duplicated
10. ✅ **Event emission** - `qa:learning_captured` event emitted after capture

### Learning Injection

11. ✅ **Learning retrieval** - `getLearningsForTask()` returns failures + techniques + warnings
12. ✅ **Prompt formatting** - `formatLearningsForPrompt()` generates readable guidance
13. ✅ **Relevance filtering** - Only recent (30 days), frequent (2+) failures returned
14. ✅ **Technique recommendations** - High-effectiveness (75%+) techniques recommended

### Technique Effectiveness

15. ✅ **Technique tracking** - Success/failure counts update correctly
16. ✅ **Effectiveness calculation** - effectiveness_rate = success / (success + failure)
17. ✅ **Technique application** - technique_applications records created on usage

### Pitfall Warnings

18. ✅ **Warning triggers** - Warnings matched by file pattern, category, severity
19. ✅ **Warning formatting** - Concise message + actionable recommendation
20. ✅ **Warning statistics** - times_triggered, times_prevented_error tracked

### Integration

21. ✅ **QA Service integration** - Failure capture called after QA verification
22. ✅ **Build Agent integration** - Learnings injected into spawner context
23. ✅ **Event bus integration** - Learning events emitted and handled
24. ✅ **Knowledge Base integration** - QA failures linkable to knowledge entries

### Testing

25. ✅ **Unit tests** - All modules tested in isolation
26. ✅ **Integration test** - Complete flow: Build → QA fail → capture → next Build uses learning
27. ✅ **Performance test** - Capture <100ms, retrieval <300ms

---

## Dependencies

**Upstream (Must Complete First):**

- ✅ PHASE4-TASK-01: Knowledge Base System (VERIFICATION COMPLETE)
- ✅ QA Agent verification system (EXISTS: `parent-harness/orchestrator/src/qa/index.ts`)
- ✅ QA Service event system (EXISTS: `parent-harness/orchestrator/src/events/qa-service.ts`)

**Downstream (Depends on This):**

- PHASE5-TASK-01: Self-improvement loop (uses learning metrics for improvement suggestions)
- PHASE6-TASK-01: Auto-promotion of validated techniques to CLAUDE.md

**Parallel Work (Can Develop Concurrently):**

- PHASE4-TASK-02: Agent introspection (complementary learning mechanism)
- PHASE4-TASK-03: Spec-Build feedback loop (learns from different failure types)

---

## Implementation Plan

### Phase 1: Database Schema & Seed Data (2 hours)

1. Create migration: `004_qa_learning.sql`
2. Define all 6 tables with indexes
3. Insert seed pitfall warnings
4. Test migration on dev database
5. Verify constraints and foreign keys

### Phase 2: QA Failure Capture (4 hours)

6. Implement `qa-failure-capture.ts`: captureQAFailure, processFailedCheck
7. Implement error pattern extraction and normalization
8. Implement root cause analysis with pattern matching
9. Implement file location extraction
10. Unit test all functions with sample QA outputs

### Phase 3: Learning Injection (3 hours)

11. Implement `learning-injector.ts`: getLearningsForTask
12. Implement prompt formatting for Build Agent
13. Implement relevance filtering and ranking
14. Test learning retrieval with various task types

### Phase 4: Technique Effectiveness (3 hours)

15. Implement technique tracking on QA success/failure
16. Implement effectiveness calculation
17. Implement technique recommendation logic
18. Test with simulated QA results

### Phase 5: QA Service Integration (2 hours)

19. Integrate failure capture into QA service
20. Add event emission for learning lifecycle
21. Test event flow end-to-end

### Phase 6: Build Agent Integration (3 hours)

22. Integrate learning injection into Build Agent spawner
23. Add learning injection tracking
24. Test learning impact on QA pass rate

### Phase 7: Testing & Documentation (3 hours)

25. Write integration test suite
26. Write performance tests
27. Document API and data flow
28. Create usage guide

**Total Estimated Effort:** 20 hours (~2.5 days)

---

## Testing Strategy

### Unit Tests

```typescript
// learning/qa-failure-capture.test.ts
describe("QA Failure Capture", () => {
  test("captures compilation errors correctly", async () => {
    const qaResult = {
      taskId: "task-001",
      passed: false,
      checks: [
        {
          name: "TypeScript Compilation",
          passed: false,
          error:
            'src/app.ts:42:15 - error TS2339: Property "name" does not exist',
        },
      ],
      summary: "TypeScript errors",
    };

    const failures = await captureQAFailure("task-001", qaResult);

    expect(failures).toHaveLength(1);
    expect(failures[0].failureType).toBe("compilation_error");
    expect(failures[0].rootCause).toBe("type_mismatch");
    expect(failures[0].fileAffected).toBe("src/app.ts");
    expect(failures[0].lineNumber).toBe(42);
  });

  test("normalizes error patterns", () => {
    const error1 =
      '/home/user/project/src/file.ts:10:5 - error TS2339: Property "foo"';
    const error2 =
      '/different/path/src/other.ts:20:10 - error TS2339: Property "bar"';

    const pattern1 = extractErrorPattern(error1);
    const pattern2 = extractErrorPattern(error2);

    // Should be similar (same error type, different details)
    expect(calculateSimilarity(pattern1, pattern2)).toBeGreaterThan(0.7);
  });
});

// learning/learning-injector.test.ts
describe("Learning Injector", () => {
  test("retrieves relevant QA failures", async () => {
    // Create test failures
    await captureQAFailure("task-001", {
      /* compilation error */
    });
    await captureQAFailure("task-002", {
      /* same pattern */
    });

    const learnings = await getLearningsForTask({ taskId: "task-003" });

    expect(learnings.qaFailures.length).toBeGreaterThan(0);
    expect(learnings.qaFailures[0].occurrences).toBeGreaterThanOrEqual(2);
  });

  test("formats learnings for prompt", () => {
    const learnings = {
      qaFailures: [
        {
          errorPattern: "type error",
          rootCause: "type_mismatch",
          occurrences: 3,
          recommendation: "Add explicit types",
        },
      ],
      techniques: [],
      warnings: [],
    };

    const formatted = formatLearningsForPrompt(learnings);

    expect(formatted).toContain("QA Failures");
    expect(formatted).toContain("type_mismatch");
    expect(formatted).toContain("3×");
  });
});
```

### Integration Tests

```typescript
// integration/qa-learning-loop.test.ts
describe("QA Learning Loop", () => {
  test("complete flow: Build → QA fail → capture → next Build learns", async () => {
    // 1. Build Agent completes task with type error
    const taskId1 = await createTask({ title: "Add user API" });
    await executeTask(taskId1); // Introduces type error

    // 2. QA verification fails
    const qaResult1 = await qa.verifyTask(taskId1);
    expect(qaResult1.passed).toBe(false);

    // 3. Failure captured
    const failures = await captureQAFailure(taskId1, qaResult1);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].rootCause).toBe("type_mismatch");

    // 4. Next Build Agent spawns for similar task
    const taskId2 = await createTask({ title: "Add product API" });
    const learnings = await getLearningsForTask({ taskId: taskId2 });

    // 5. Learnings include past failure
    expect(learnings.qaFailures).toContainEqual(
      expect.objectContaining({ rootCause: "type_mismatch" }),
    );

    // 6. Inject learnings and verify improved outcome
    const prompt = formatLearningsForPrompt(learnings);
    expect(prompt).toContain("type_mismatch");

    // 7. Second task should benefit from learning
    // (In real test, would spawn Build Agent with learnings and verify QA pass)
  });
});
```

---

## Success Metrics

**Operational:**

- 100+ QA failures captured in first month
- 90%+ root cause categorization accuracy
- Learning retrieval completes in <300ms (95th percentile)
- Zero data loss or corruption

**Agent Performance:**

- QA first-pass rate improves by 15% after 50+ learnings
- Repeated error patterns decrease by 40%
- Build Agent completion time reduces by 10% (fewer retries)
- Critical failures (compilation/build) decrease by 25%

**Learning Quality:**

- 80%+ of captured failures are unique (not duplicates)
- Technique effectiveness correlates with QA success (r > 0.7)
- Pitfall warnings prevent 50%+ of matching errors
- High-effectiveness techniques (>80%) have 10+ uses

**System Health:**

- Failure capture adds <100ms to QA verification
- Learning injection adds <300ms to Build Agent spawn
- Database size grows <1MB per 100 failures
- No performance degradation with 1000+ failures

---

## Rollback Plan

If learning system causes issues:

1. **Disable learning injection:**
   - Set config: `ENABLE_QA_LEARNING_INJECTION=false`
   - Build Agents spawn without learnings
   - Capture continues (no data loss)

2. **Disable failure capture:**
   - Set config: `ENABLE_QA_LEARNING_CAPTURE=false`
   - QA verification proceeds normally
   - No new learnings captured

3. **Revert database:**
   - Run: `004_qa_learning_rollback.sql`
   - Drops all 6 learning tables
   - Knowledge Base and QA systems remain intact

---

## Future Enhancements (Out of Scope)

1. **ML-based error prediction** - Train model to predict likely QA failures before implementation
2. **Auto-fix suggestions** - Generate code patches for common QA failures
3. **Cross-agent learning** - Share learnings across multiple Vibe instances
4. **Visual learning dashboard** - Heatmap of failure hotspots, technique effectiveness over time
5. **Interactive learning approval** - Human-in-loop for learning validation
6. **Semantic error matching** - Use embeddings for better similarity detection
7. **Root cause drilldown** - Multi-level root cause analysis (surface → deep)

---

## References

- `parent-harness/orchestrator/src/qa/index.ts`: QA verification implementation
- `parent-harness/orchestrator/src/events/qa-service.ts`: Event-driven QA service
- `docs/specs/PHASE4-TASK-01-knowledge-base-system.md`: Knowledge Base foundation
- `docs/specs/PHASE4-TASK-01-VERIFICATION-COMPLETE.md`: Verified implementation
- `STRATEGIC_PLAN.md`: Phase 4 objectives

---

**Generated by:** spec_agent
**Model:** Claude Sonnet 4.5
**Date:** 2026-02-08
**Specification Duration:** Comprehensive analysis of QA and learning infrastructure
