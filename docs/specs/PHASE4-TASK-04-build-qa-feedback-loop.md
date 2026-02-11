# PHASE4-TASK-04: Build Agent Learning from QA Failures

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Large
**Created:** 2026-02-08
**Model:** Sonnet 4.5 (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement a learning system where Build Agents learn from QA verification failures to avoid repeating the same mistakes. This creates a continuous improvement loop where failed builds inform future build attempts, reducing failure rates and improving autonomous implementation quality over time.

**Problem:** Build Agents currently operate without awareness of common failure patterns. When a Build Agent completes a task and QA verification fails, the agent doesn't record what went wrong or how it was eventually fixed. The next Build Agent tackling a similar task will make identical mistakes, wasting tokens and time. The existing QA service (`parent-harness/orchestrator/src/events/qa-service.ts`) captures pass/fail results but doesn't extract learnings. The knowledge base system (PHASE4-TASK-01) provides storage infrastructure but lacks Build Agent-specific failure pattern tracking.

**Solution:** Extend the knowledge base with Build Agent-specific failure analysis that:

1. Captures QA failure details (which checks failed, error messages, file changes involved)
2. Records successful fixes after QA failure → retry cycles
3. Identifies recurring failure patterns (common mistakes across tasks)
4. Injects relevant failure warnings into Build Agent context before task execution
5. Tracks failure prevention effectiveness (did the warning help?)
6. Auto-generates "common pitfalls" documentation from validated patterns

---

## Current State Analysis

### Existing Infrastructure ✅

**1. QA Service** (`parent-harness/orchestrator/src/events/qa-service.ts`)

- ✅ Event-driven verification queue
- ✅ Pass/fail detection with `verifyTask(taskId)`
- ✅ Failure summary in transition: `transitionTask(taskId, 'failed', { error, failures })`
- ✅ Emits `task:qa_passed` and `task:qa_failed` events
- ✅ Check details available in `result.checks.filter(c => !c.passed)`
- ❌ **Gap:** No failure pattern extraction or learning capture
- ❌ **Gap:** No connection between QA failure and Build Agent knowledge

**2. Knowledge Base System** (PHASE4-TASK-01 spec)

- ✅ `knowledge_entries` table for gotchas, patterns, decisions
- ✅ `error_recovery_strategies` table for fix tracking
- ✅ Confidence scoring with boost/decay mechanics
- ✅ Duplicate detection using Jaccard similarity
- ✅ Task signature matching for similar task lookup
- ✅ Cross-agent knowledge sharing
- ⚠️ **Partial:** Generic error recovery but not QA-specific failure tracking
- ❌ **Gap:** No `qa_failure_patterns` table
- ❌ **Gap:** No "test failure → fix → success" workflow tracking

**3. Build Agent Orchestrator** (`server/services/task-agent/build-agent-orchestrator.ts`)

- ✅ Task execution with error handling
- ✅ SIA escalation for stuck tasks (`checkSIAEscalation()`)
- ✅ Error message capture in `build_agent_instances.error_message`
- ✅ Retry logic with exponential backoff
- ❌ **Gap:** No QA failure awareness
- ❌ **Gap:** No learning injection before task start
- ❌ **Gap:** No post-QA-failure analysis

**4. QA Verification Module** (`parent-harness/orchestrator/src/qa/index.ts`)

- ✅ Executes verification checks (tests, linting, builds)
- ✅ Returns structured results: `{ passed, summary, checks[] }`
- ✅ Per-check pass/fail status
- ❌ **Gap:** No failure categorization (syntax error vs. logic error vs. missing file)
- ❌ **Gap:** No comparison of "what changed" vs. "what broke"

**5. Agent Memory System** (`parent-harness/orchestrator/src/memory/index.ts`)

- ✅ Short-term memory with types: error_pattern, success_pattern
- ✅ `learnError()` and `learnSuccess()` functions
- ✅ Task context with 24h expiration
- ❌ **Gap:** No long-term QA failure storage
- ❌ **Gap:** No cross-session pattern aggregation

### Gaps Summary

| Gap                               | Impact                       | Solution                                              |
| --------------------------------- | ---------------------------- | ----------------------------------------------------- |
| No QA failure pattern extraction  | Same mistakes repeated       | Analyze failed checks → extract patterns              |
| No fix tracking                   | Unknown which solutions work | Record "QA fail → fix → QA pass" sequences            |
| No failure categorization         | Can't prioritize learning    | Classify: test failure, build error, lint error, etc. |
| No Build Agent learning injection | Agents start blind           | Inject "watch out for X" warnings pre-execution       |
| No effectiveness tracking         | Can't measure impact         | Track: warning shown → mistake avoided?               |
| No common pitfall documentation   | Manual knowledge transfer    | Auto-generate CLAUDE.md entries from patterns         |

---

## Requirements

### Functional Requirements

**FR-1: QA Failure Pattern Capture**

- MUST capture QA verification failures with full context:
  - Task ID, Build Agent session ID, execution ID
  - Failed check names and error messages
  - Files modified in the failing build
  - Diff of changes that caused failure
  - Failure category: test_failure, build_error, lint_error, type_error, runtime_error
- MUST extract specific error patterns from failure messages:
  - Import errors ("Cannot find module X")
  - Type errors ("Type A is not assignable to type B")
  - Test assertion failures ("Expected X but got Y")
  - Runtime errors ("Cannot read property of undefined")
- MUST deduplicate similar failures (>85% message similarity)
- MUST link failures to task signatures for pattern matching
- SHOULD auto-categorize failures using regex patterns

**FR-2: Fix Workflow Tracking**

- MUST record "QA fail → fix → QA pass" sequences:
  - Initial failure: task ID, failed checks, error details
  - Fix attempt: what files changed, what approach was used
  - Outcome: did QA pass after fix? How many attempts?
- MUST calculate fix effectiveness: success_rate = fixes_that_worked / total_fix_attempts
- MUST identify high-value fixes (solved problem in 1-2 attempts)
- MUST record fix strategies as gotchas in knowledge base:
  - Problem: "Tests fail with 'module not found'"
  - Solution: "Run npm install before running tests"
  - Confidence: based on fix success rate
- MUST support multi-step fixes (attempt 1 failed, attempt 2 succeeded)
- SHOULD correlate fix strategies with failure categories

**FR-3: Recurring Failure Pattern Detection**

- MUST identify patterns that occur across multiple tasks:
  - Same error message in 3+ different tasks
  - Same file pattern repeatedly causes failures (e.g., "tests/\*.test.ts")
  - Same failure category dominates (e.g., 70% are import errors)
- MUST calculate pattern frequency and recency
- MUST boost confidence of patterns that recur frequently
- MUST detect "this always breaks" patterns (100% failure rate for certain actions)
- MUST generate pattern summaries: "Common pitfall: Forgetting to update imports when moving files"
- SHOULD cluster similar failures using semantic similarity

**FR-4: Build Agent Learning Injection**

- MUST inject relevant failure warnings into Build Agent context before execution:
  - Retrieve warnings based on task signature similarity
  - Retrieve warnings based on files being modified
  - Retrieve warnings based on task category (test writing, refactoring, new feature)
- MUST format warnings as actionable guidance:
  - "⚠️ Common pitfall: 70% of tasks modifying database/\* fail due to missing migrations. Remember to run schema:generate."
  - "⚠️ Past failure: When updating types/\*, imports in 5+ files broke. Use global search to find all usages."
- MUST limit warnings to top 5 most relevant (avoid overwhelming agent)
- MUST rank warnings by: relevance score × confidence × failure frequency
- MUST track which warnings were shown to which Build Agent sessions
- SHOULD support warning acknowledgment ("Build Agent read this warning")

**FR-5: Failure Prevention Effectiveness Tracking**

- MUST track whether warnings prevented failures:
  - Warning shown → task completed without QA failure = prevention success
  - Warning shown → task failed with same issue = prevention failure
  - No warning shown → task failed = missed opportunity
- MUST calculate prevention effectiveness: prevented_failures / (prevented + not_prevented)
- MUST boost confidence of effective warnings (+0.1 per prevention)
- MUST decay confidence of ineffective warnings (-0.05 per failure despite warning)
- MUST identify warnings that are ignored (shown but agent makes same mistake)
- SHOULD A/B test: some agents get warnings, some don't (measure impact)

**FR-6: Common Pitfall Documentation**

- MUST identify promotion candidates for CLAUDE.md:
  - Failure pattern with ≥80% prevention effectiveness
  - Occurred in ≥5 different tasks
  - Confidence ≥ 0.8
- MUST generate markdown proposals:
  - Title: Pattern name ("Missing Database Migrations")
  - Context: When this occurs ("When modifying schema/entities/\*.ts")
  - Problem: What goes wrong ("QA fails with 'table does not exist'")
  - Solution: How to avoid ("Always run `npm run schema:generate && npm run schema:migrate`")
  - Frequency: How common (e.g., "Affects 12% of schema tasks")
- MUST support review workflow: pending → approved → appended to CLAUDE.md
- MUST track promotion history (which patterns were promoted when)
- SHOULD support rollback (remove promoted entry if causes issues)

**FR-7: Failure Analysis Dashboard**

- MUST display QA failure metrics:
  - Failure rate over time (% of tasks failing QA)
  - Top 10 failure patterns (most frequent)
  - Failure categories distribution (pie chart: test 40%, build 30%, lint 20%, type 10%)
  - Mean time to fix (average attempts before QA pass)
  - Prevention effectiveness (% of failures avoided by warnings)
- MUST show per-pattern details:
  - Occurrences, fix success rate, prevention effectiveness
  - Example failures with task links
  - Suggested fixes from knowledge base
- MUST support filtering: by date range, by failure category, by Build Agent
- SHOULD visualize trends: "Import errors decreasing as agents learn"

### Non-Functional Requirements

**NFR-1: Performance**

- Failure capture MUST NOT block QA service (<50ms overhead per failure)
- Pattern detection MUST run async (not in critical path)
- Learning injection MUST complete in <300ms (retrieve + format warnings)
- Dashboard queries MUST complete in <2 seconds (100+ failures)
- Deduplication check MUST complete in <200ms

**NFR-2: Data Integrity**

- QA failure records MUST be immutable (append-only log)
- Fix workflow sequences MUST preserve order (attempt 1 → 2 → 3)
- Pattern confidence updates MUST be atomic
- Database writes MUST be transactional (failure + pattern creation together)
- MUST validate failure category enum

**NFR-3: Usability**

- Failure capture MUST be automatic (no Build Agent code changes)
- Warnings MUST be clear and actionable (no vague "be careful")
- Dashboard MUST use visual severity indicators (red for high-frequency failures)
- Promotion proposals MUST include concrete examples
- MUST log all learning injections for debugging

**NFR-4: Extensibility**

- Failure categories MUST be extensible (add new types without schema change)
- Pattern detectors MUST be pluggable (register new detectors)
- Fix strategies MUST support custom templates
- Warning formatters MUST be customizable per agent type

---

## Technical Design

### Database Schema Extensions

**New tables for Parent Harness** (`parent-harness/database/schema.sql`):

```sql
-- ============================================
-- BUILD AGENT QA FAILURE LEARNING
-- ============================================

-- QA Failure Records (detailed failure capture)
CREATE TABLE IF NOT EXISTS qa_failures (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    session_id TEXT,
    execution_id TEXT,

    -- Failure context
    failed_checks TEXT NOT NULL,              -- JSON array: ["test:unit", "lint:typescript"]
    failure_category TEXT NOT NULL CHECK(failure_category IN (
        'test_failure', 'build_error', 'lint_error', 'type_error',
        'runtime_error', 'missing_dependency', 'config_error', 'other'
    )),
    error_messages TEXT NOT NULL,            -- JSON array of error strings

    -- Code context
    files_modified TEXT,                     -- JSON array of file paths
    diff_summary TEXT,                       -- High-level summary of changes
    task_signature_hash TEXT,                -- Link to task_signatures table

    -- Resolution tracking
    resolved INTEGER DEFAULT 0,              -- 1 if eventually fixed
    resolved_at TEXT,
    fix_attempts INTEGER DEFAULT 0,          -- How many attempts before success

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_qa_failures_task ON qa_failures(task_id);
CREATE INDEX idx_qa_failures_category ON qa_failures(failure_category);
CREATE INDEX idx_qa_failures_signature ON qa_failures(task_signature_hash);
CREATE INDEX idx_qa_failures_resolved ON qa_failures(resolved);

-- QA Failure Patterns (recurring mistakes)
CREATE TABLE IF NOT EXISTS qa_failure_patterns (
    id TEXT PRIMARY KEY,
    pattern_name TEXT NOT NULL UNIQUE,

    -- Pattern definition
    failure_category TEXT NOT NULL,
    error_pattern TEXT NOT NULL,             -- Regex or substring to match errors
    file_pattern TEXT,                       -- Glob pattern for affected files (e.g., "tests/*.test.ts")

    -- Pattern description
    description TEXT NOT NULL,               -- Human-readable explanation
    common_cause TEXT NOT NULL,              -- Why this happens
    recommended_fix TEXT NOT NULL,           -- How to avoid

    -- Effectiveness tracking
    occurrences INTEGER DEFAULT 1,           -- How many times seen
    prevention_successes INTEGER DEFAULT 0,  -- Warnings prevented failure
    prevention_failures INTEGER DEFAULT 0,   -- Warnings shown but failure occurred anyway
    prevention_effectiveness REAL GENERATED ALWAYS AS (
        CASE
            WHEN (prevention_successes + prevention_failures) = 0 THEN 0.5
            ELSE CAST(prevention_successes AS REAL) / (prevention_successes + prevention_failures)
        END
    ) STORED,

    -- Knowledge base integration
    knowledge_entry_id TEXT REFERENCES knowledge_entries(id),

    -- Metadata
    confidence REAL DEFAULT 0.5 CHECK(confidence >= 0.0 AND confidence <= 1.0),
    first_seen_at TEXT DEFAULT (datetime('now')),
    last_seen_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_qa_patterns_category ON qa_failure_patterns(failure_category);
CREATE INDEX idx_qa_patterns_confidence ON qa_failure_patterns(confidence);
CREATE INDEX idx_qa_patterns_effectiveness ON qa_failure_patterns(prevention_effectiveness);

-- Pattern Occurrences (links failures to patterns)
CREATE TABLE IF NOT EXISTS qa_pattern_occurrences (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL REFERENCES qa_failure_patterns(id),
    failure_id TEXT NOT NULL REFERENCES qa_failures(id),

    -- Match details
    matched_error TEXT NOT NULL,             -- The specific error that matched
    matched_files TEXT,                      -- Files involved in this occurrence

    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(pattern_id, failure_id)
);

CREATE INDEX idx_pattern_occurrences_pattern ON qa_pattern_occurrences(pattern_id);
CREATE INDEX idx_pattern_occurrences_failure ON qa_pattern_occurrences(failure_id);

-- Fix Workflows (fail → fix → success sequences)
CREATE TABLE IF NOT EXISTS qa_fix_workflows (
    id TEXT PRIMARY KEY,
    initial_failure_id TEXT NOT NULL REFERENCES qa_failures(id),
    task_id TEXT NOT NULL REFERENCES tasks(id),

    -- Fix tracking
    fix_approach TEXT NOT NULL,              -- Description of what was tried
    fix_attempt_number INTEGER NOT NULL,     -- 1, 2, 3...
    files_changed TEXT,                      -- JSON array of files in fix
    changes_summary TEXT,                    -- What was changed

    -- Outcome
    outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failure', 'partial')),
    qa_result TEXT,                          -- Result of QA after fix

    -- Learning extraction
    extracted_gotcha_id TEXT REFERENCES knowledge_entries(id),

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_fix_workflows_failure ON qa_fix_workflows(initial_failure_id);
CREATE INDEX idx_fix_workflows_task ON qa_fix_workflows(task_id);
CREATE INDEX idx_fix_workflows_outcome ON qa_fix_workflows(outcome);

-- Build Agent Warning Deliveries (tracking what warnings were shown)
CREATE TABLE IF NOT EXISTS qa_warning_deliveries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    pattern_id TEXT NOT NULL REFERENCES qa_failure_patterns(id),

    -- Delivery details
    warning_text TEXT NOT NULL,
    relevance_score REAL NOT NULL,           -- 0-1, how relevant to this task
    shown_at TEXT DEFAULT (datetime('now')),

    -- Effectiveness tracking
    outcome TEXT CHECK(outcome IN ('prevented', 'failed_anyway', 'task_incomplete')),
    outcome_recorded_at TEXT,

    UNIQUE(session_id, pattern_id)
);

CREATE INDEX idx_warning_deliveries_session ON qa_warning_deliveries(session_id);
CREATE INDEX idx_warning_deliveries_pattern ON qa_warning_deliveries(pattern_id);
CREATE INDEX idx_warning_deliveries_outcome ON qa_warning_deliveries(outcome);
```

### Core Modules

#### 1. QA Failure Analyzer (`parent-harness/orchestrator/src/qa/failure-analyzer.ts`)

```typescript
import { v4 as uuid } from "uuid";
import { run, getOne, query } from "../db/index.js";
import { generateTaskSignature } from "../knowledge/task-matcher.js";

export interface QAFailure {
  id: string;
  taskId: string;
  sessionId?: string;
  executionId?: string;
  failedChecks: string[];
  failureCategory: FailureCategory;
  errorMessages: string[];
  filesModified: string[];
  diffSummary?: string;
  taskSignatureHash?: string;
  resolved: boolean;
  resolvedAt?: string;
  fixAttempts: number;
  createdAt: string;
}

export type FailureCategory =
  | "test_failure"
  | "build_error"
  | "lint_error"
  | "type_error"
  | "runtime_error"
  | "missing_dependency"
  | "config_error"
  | "other";

/**
 * Capture a QA failure for learning
 */
export async function captureQAFailure(params: {
  taskId: string;
  sessionId?: string;
  executionId?: string;
  failedChecks: string[];
  errorMessages: string[];
  filesModified?: string[];
  diffSummary?: string;
}): Promise<QAFailure> {
  const id = uuid();
  const now = new Date().toISOString();

  // Categorize the failure
  const category = categorizeFailure(params.failedChecks, params.errorMessages);

  // Get task signature for pattern matching
  const task = await getOne<{ title: string; category: string }>(
    "SELECT title, category FROM tasks WHERE id = ?",
    [params.taskId],
  );

  let signatureHash: string | undefined;
  if (task) {
    const signature = generateTaskSignature({
      id: params.taskId,
      title: task.title,
      category: task.category,
      file_patterns: params.filesModified,
    });
    signatureHash = signature.signature_hash;
  }

  // Store failure record
  await run(
    `
    INSERT INTO qa_failures
    (id, task_id, session_id, execution_id, failed_checks, failure_category,
     error_messages, files_modified, diff_summary, task_signature_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      params.taskId,
      params.sessionId,
      params.executionId,
      JSON.stringify(params.failedChecks),
      category,
      JSON.stringify(params.errorMessages),
      JSON.stringify(params.filesModified || []),
      params.diffSummary,
      signatureHash,
      now,
    ],
  );

  // Async: Detect and record patterns
  detectFailurePatterns(
    id,
    category,
    params.errorMessages,
    params.filesModified || [],
  ).catch((err) =>
    console.error("[QAFailureAnalyzer] Pattern detection failed:", err),
  );

  return {
    id,
    taskId: params.taskId,
    sessionId: params.sessionId,
    executionId: params.executionId,
    failedChecks: params.failedChecks,
    failureCategory: category,
    errorMessages: params.errorMessages,
    filesModified: params.filesModified || [],
    diffSummary: params.diffSummary,
    taskSignatureHash: signatureHash,
    resolved: false,
    fixAttempts: 0,
    createdAt: now,
  };
}

/**
 * Categorize failure based on checks and errors
 */
function categorizeFailure(
  checks: string[],
  errors: string[],
): FailureCategory {
  const checksStr = checks.join(" ").toLowerCase();
  const errorsStr = errors.join(" ").toLowerCase();

  // Test failures
  if (checksStr.includes("test") || errorsStr.includes("test failed")) {
    return "test_failure";
  }

  // Build errors
  if (checksStr.includes("build") || errorsStr.includes("compilation failed")) {
    return "build_error";
  }

  // Lint errors
  if (checksStr.includes("lint") || errorsStr.includes("eslint")) {
    return "lint_error";
  }

  // Type errors
  if (errorsStr.includes("type") && errorsStr.includes("not assignable")) {
    return "type_error";
  }

  // Missing dependencies
  if (
    errorsStr.includes("cannot find module") ||
    errorsStr.includes("enoent")
  ) {
    return "missing_dependency";
  }

  // Runtime errors
  if (
    errorsStr.includes("cannot read property") ||
    errorsStr.includes("undefined is not")
  ) {
    return "runtime_error";
  }

  // Config errors
  if (errorsStr.includes("config") || errorsStr.includes("tsconfig")) {
    return "config_error";
  }

  return "other";
}

/**
 * Detect patterns in this failure and link to existing patterns or create new
 */
async function detectFailurePatterns(
  failureId: string,
  category: FailureCategory,
  errors: string[],
  files: string[],
): Promise<void> {
  // Get all patterns for this category
  const patterns = await query<{
    id: string;
    error_pattern: string;
    file_pattern: string | null;
  }>(
    `
    SELECT id, error_pattern, file_pattern
    FROM qa_failure_patterns
    WHERE failure_category = ?
  `,
    [category],
  );

  let matched = false;

  for (const pattern of patterns) {
    // Check if error matches pattern
    const errorMatch = errors.some((err) => {
      const regex = new RegExp(pattern.error_pattern, "i");
      return regex.test(err);
    });

    // Check if files match pattern
    const fileMatch =
      !pattern.file_pattern ||
      files.some((file) => {
        const regex = new RegExp(
          pattern.file_pattern.replace(/\*/g, ".*"),
          "i",
        );
        return regex.test(file);
      });

    if (errorMatch && fileMatch) {
      // Record occurrence
      await run(
        `
        INSERT INTO qa_pattern_occurrences (id, pattern_id, failure_id, matched_error, matched_files)
        VALUES (?, ?, ?, ?, ?)
      `,
        [uuid(), pattern.id, failureId, errors[0], JSON.stringify(files)],
      );

      // Update pattern stats
      await run(
        `
        UPDATE qa_failure_patterns
        SET occurrences = occurrences + 1,
            last_seen_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `,
        [pattern.id],
      );

      matched = true;
      console.log(`[QAFailureAnalyzer] Matched pattern: ${pattern.id}`);
    }
  }

  // If no match, consider creating new pattern
  if (!matched && errors.length > 0) {
    await considerNewPattern(failureId, category, errors, files);
  }
}

/**
 * Consider creating a new failure pattern if this is novel
 */
async function considerNewPattern(
  failureId: string,
  category: FailureCategory,
  errors: string[],
  files: string[],
): Promise<void> {
  // Extract error pattern (first 100 chars, simplified)
  const errorPattern = errors[0].substring(0, 100).replace(/[0-9]/g, "\\d+");

  // Extract file pattern (common prefix or extension)
  const filePattern =
    files.length > 0
      ? `*${files[0].substring(files[0].lastIndexOf("."))}`
      : null;

  // Only create pattern if error is somewhat generic (not too specific)
  if (errorPattern.length < 20) return;

  console.log(
    `[QAFailureAnalyzer] New pattern candidate: ${category} - ${errorPattern.substring(0, 50)}...`,
  );

  // This would be reviewed by human or validated by recurrence before promotion
  // For now, just log it
}

/**
 * Record a fix attempt for a QA failure
 */
export async function recordFixAttempt(params: {
  failureId: string;
  taskId: string;
  fixApproach: string;
  attemptNumber: number;
  filesChanged: string[];
  changesSummary: string;
  outcome: "success" | "failure" | "partial";
  qaResult?: string;
}): Promise<void> {
  const id = uuid();

  await run(
    `
    INSERT INTO qa_fix_workflows
    (id, initial_failure_id, task_id, fix_approach, fix_attempt_number,
     files_changed, changes_summary, outcome, qa_result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `,
    [
      id,
      params.failureId,
      params.taskId,
      params.fixApproach,
      params.attemptNumber,
      JSON.stringify(params.filesChanged),
      params.changesSummary,
      params.outcome,
      params.qaResult,
    ],
  );

  // If successful, mark failure as resolved
  if (params.outcome === "success") {
    await run(
      `
      UPDATE qa_failures
      SET resolved = 1, resolved_at = datetime('now'), fix_attempts = ?
      WHERE id = ?
    `,
      [params.attemptNumber, params.failureId],
    );

    // Extract gotcha for knowledge base
    await extractGotchaFromFix(params);
  }
}

/**
 * Extract a gotcha from a successful fix workflow
 */
async function extractGotchaFromFix(params: {
  failureId: string;
  fixApproach: string;
  filesChanged: string[];
}): Promise<void> {
  // This would integrate with knowledge-base/writer.ts
  // For now, placeholder
  console.log(
    `[QAFailureAnalyzer] Extracting gotcha from fix: ${params.fixApproach}`,
  );
}
```

#### 2. Learning Injector (`parent-harness/orchestrator/src/qa/learning-injector.ts`)

```typescript
import { query } from "../db/index.js";
import { v4 as uuid } from "uuid";

export interface QAWarning {
  patternId: string;
  patternName: string;
  warningText: string;
  relevanceScore: number;
  occurrences: number;
  preventionEffectiveness: number;
}

/**
 * Get QA failure warnings relevant to a task
 */
export async function getRelevantQAWarnings(params: {
  taskId: string;
  filesInvolved?: string[];
  taskCategory?: string;
  limit?: number;
}): Promise<QAWarning[]> {
  const limit = params.limit || 5;

  // Get task signature
  const task = await query<{ title: string; category: string }>(
    "SELECT title, category FROM tasks WHERE id = ?",
    [params.taskId],
  );

  if (task.length === 0) return [];

  // Find patterns matching files or category
  const patterns = await query<{
    id: string;
    pattern_name: string;
    description: string;
    common_cause: string;
    recommended_fix: string;
    occurrences: number;
    prevention_effectiveness: number;
    confidence: number;
    file_pattern: string | null;
  }>(
    `
    SELECT
      id, pattern_name, description, common_cause, recommended_fix,
      occurrences, prevention_effectiveness, confidence, file_pattern
    FROM qa_failure_patterns
    WHERE confidence >= 0.6
      AND occurrences >= 2
    ORDER BY
      prevention_effectiveness DESC,
      confidence DESC,
      occurrences DESC
    LIMIT ?
  `,
    [limit * 2],
  ); // Get extra for filtering

  // Score and rank patterns
  const warnings: QAWarning[] = [];

  for (const pattern of patterns) {
    let relevanceScore = pattern.confidence;

    // Boost if files match pattern
    if (pattern.file_pattern && params.filesInvolved) {
      const regex = new RegExp(pattern.file_pattern.replace(/\*/g, ".*"), "i");
      const hasMatch = params.filesInvolved.some((f) => regex.test(f));
      if (hasMatch) {
        relevanceScore += 0.3;
      }
    }

    // Boost if high prevention effectiveness
    if (pattern.prevention_effectiveness > 0.7) {
      relevanceScore += 0.2;
    }

    const warningText = formatWarning(
      pattern.pattern_name,
      pattern.description,
      pattern.common_cause,
      pattern.recommended_fix,
      pattern.occurrences,
      pattern.prevention_effectiveness,
    );

    warnings.push({
      patternId: pattern.id,
      patternName: pattern.pattern_name,
      warningText,
      relevanceScore: Math.min(1.0, relevanceScore),
      occurrences: pattern.occurrences,
      preventionEffectiveness: pattern.prevention_effectiveness,
    });
  }

  // Sort by relevance and return top N
  warnings.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return warnings.slice(0, limit);
}

/**
 * Format a warning for Build Agent consumption
 */
function formatWarning(
  name: string,
  description: string,
  cause: string,
  fix: string,
  occurrences: number,
  effectiveness: number,
): string {
  const effectivenessPercent = Math.round(effectiveness * 100);

  return `⚠️ **Common Pitfall: ${name}**
- **What happens:** ${description}
- **Why:** ${cause}
- **How to avoid:** ${fix}
- **Frequency:** Seen in ${occurrences} task${occurrences > 1 ? "s" : ""} (${effectivenessPercent}% prevention rate when warning shown)`;
}

/**
 * Record that warnings were delivered to a Build Agent session
 */
export async function recordWarningDelivery(params: {
  sessionId: string;
  taskId: string;
  warnings: QAWarning[];
}): Promise<void> {
  for (const warning of params.warnings) {
    await query(
      `
      INSERT INTO qa_warning_deliveries
      (id, session_id, task_id, pattern_id, warning_text, relevance_score, shown_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `,
      [
        uuid(),
        params.sessionId,
        params.taskId,
        warning.patternId,
        warning.warningText,
        warning.relevanceScore,
      ],
    );
  }

  console.log(
    `[LearningInjector] Delivered ${params.warnings.length} warnings to session ${params.sessionId}`,
  );
}

/**
 * Update warning effectiveness based on task outcome
 */
export async function recordWarningOutcome(params: {
  sessionId: string;
  taskId: string;
  outcome: "prevented" | "failed_anyway";
}): Promise<void> {
  // Get all warnings for this session
  const deliveries = await query<{ id: string; pattern_id: string }>(
    "SELECT id, pattern_id FROM qa_warning_deliveries WHERE session_id = ? AND task_id = ?",
    [params.sessionId, params.taskId],
  );

  for (const delivery of deliveries) {
    // Update delivery outcome
    await query(
      `
      UPDATE qa_warning_deliveries
      SET outcome = ?, outcome_recorded_at = datetime('now')
      WHERE id = ?
    `,
      [params.outcome, delivery.id],
    );

    // Update pattern effectiveness
    if (params.outcome === "prevented") {
      await query(
        `
        UPDATE qa_failure_patterns
        SET prevention_successes = prevention_successes + 1,
            confidence = MIN(0.95, confidence + 0.05),
            updated_at = datetime('now')
        WHERE id = ?
      `,
        [delivery.pattern_id],
      );
    } else {
      await query(
        `
        UPDATE qa_failure_patterns
        SET prevention_failures = prevention_failures + 1,
            confidence = MAX(0.1, confidence - 0.03),
            updated_at = datetime('now')
        WHERE id = ?
      `,
        [delivery.pattern_id],
      );
    }
  }

  console.log(
    `[LearningInjector] Recorded ${params.outcome} for ${deliveries.length} warnings`,
  );
}
```

### Integration Points

#### 1. QA Service Integration

```typescript
// In parent-harness/orchestrator/src/events/qa-service.ts
import { captureQAFailure } from '../qa/failure-analyzer.js';
import { recordWarningOutcome } from '../qa/learning-injector.js';

// Inside verifyTask() method after QA result
if (!result.passed) {
  // Capture failure for learning
  await captureQAFailure({
    taskId: task.id,
    sessionId: /* get from task */,
    executionId: /* get from session */,
    failedChecks: result.checks.filter(c => !c.passed).map(c => c.name),
    errorMessages: result.checks.filter(c => !c.passed).map(c => c.error || 'No error message'),
    filesModified: /* get from git diff */,
  });

  // Record that warnings didn't prevent failure
  await recordWarningOutcome({
    sessionId: /* session ID */,
    taskId: task.id,
    outcome: 'failed_anyway',
  });
} else {
  // Record that warnings helped prevent failure
  await recordWarningOutcome({
    sessionId: /* session ID */,
    taskId: task.id,
    outcome: 'prevented',
  });
}
```

#### 2. Build Agent Spawner Integration

```typescript
// In parent-harness/orchestrator/src/spawner/index.ts
import { getRelevantQAWarnings, recordWarningDelivery } from '../qa/learning-injector.js';

export async function spawnBuildAgent(taskId: string): Promise<void> {
  // Get QA warnings for this task
  const warnings = await getRelevantQAWarnings({
    taskId,
    filesInvolved: /* extract from task description */,
    limit: 5,
  });

  // Inject warnings into agent context
  const warningSection = warnings.length > 0
    ? '\n\n## QA Failure Warnings\n\n' + warnings.map(w => w.warningText).join('\n\n')
    : '';

  const prompt = buildAgentPrompt(task) + warningSection;

  // Record delivery
  const sessionId = await spawnAgent({ prompt, taskId });

  if (warnings.length > 0) {
    await recordWarningDelivery({ sessionId, taskId, warnings });
  }
}
```

#### 3. Knowledge Base API Extension

```typescript
// In parent-harness/orchestrator/src/api/qa.ts
export const qaRouter = Router();

/**
 * GET /api/qa/failures/dashboard
 */
qaRouter.get("/failures/dashboard", async (req, res) => {
  const stats = {
    total_failures: await getOne("SELECT COUNT(*) as count FROM qa_failures"),
    by_category: await query(`
      SELECT failure_category, COUNT(*) as count
      FROM qa_failures
      GROUP BY failure_category
      ORDER BY count DESC
    `),
    resolution_rate: await getOne(`
      SELECT
        CAST(SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as rate
      FROM qa_failures
    `),
    top_patterns: await query(`
      SELECT
        pattern_name, occurrences, prevention_effectiveness, confidence
      FROM qa_failure_patterns
      ORDER BY occurrences DESC
      LIMIT 10
    `),
  };

  res.json(stats);
});

/**
 * GET /api/qa/failures/patterns
 */
qaRouter.get("/failures/patterns", async (req, res) => {
  const patterns = await query(`
    SELECT * FROM qa_failure_patterns
    ORDER BY confidence DESC, occurrences DESC
  `);

  res.json({ patterns, count: patterns.length });
});
```

---

## Pass Criteria

### Database Schema

1. ✅ **Tables created** - qa_failures, qa_failure_patterns, qa_pattern_occurrences, qa_fix_workflows, qa_warning_deliveries
2. ✅ **Indexes created** - All performance-critical indexes present
3. ✅ **Constraints valid** - CHECK constraints, foreign keys, GENERATED columns
4. ✅ **Migration tested** - Schema applies cleanly to harness.db

### Failure Capture

5. ✅ **QA failure capture** - `captureQAFailure()` creates records with all fields
6. ✅ **Failure categorization** - 7 categories correctly detected from check names + errors
7. ✅ **Pattern detection** - Existing patterns matched, new patterns identified
8. ✅ **Fix workflow recording** - `recordFixAttempt()` tracks attempt sequences
9. ✅ **Resolution tracking** - Failures marked resolved when fix succeeds

### Learning Injection

10. ✅ **Warning retrieval** - `getRelevantQAWarnings()` returns top 5 warnings ranked by relevance
11. ✅ **Warning formatting** - Warnings are actionable with context, cause, solution
12. ✅ **Warning delivery tracking** - qa_warning_deliveries records what was shown
13. ✅ **Spawner integration** - Build Agents receive warnings in prompt before execution
14. ✅ **Outcome tracking** - Prevention effectiveness calculated from outcomes

### Pattern Management

15. ✅ **Pattern occurrence tracking** - qa_pattern_occurrences links failures to patterns
16. ✅ **Confidence updates** - Patterns boosted on prevention, decayed on failure
17. ✅ **Effectiveness calculation** - prevention_effectiveness = successes / (successes + failures)
18. ✅ **Pattern deduplication** - Similar error patterns merged

### API & Dashboard

19. ✅ **GET /api/qa/failures/dashboard** - Returns aggregate stats, top patterns
20. ✅ **GET /api/qa/failures/patterns** - Returns all patterns with metrics
21. ✅ **Response time** - Endpoints respond in <2 seconds

### Integration

22. ✅ **QA service integration** - Failures captured on QA fail events
23. ✅ **Spawner integration** - Warnings injected before Build Agent execution
24. ✅ **Outcome recording** - Success/failure recorded after QA verification
25. ✅ **No Build Agent changes** - Integration is passive (no agent code changes)

### Testing

26. ✅ **Unit tests** - All modules tested in isolation
27. ✅ **Integration test** - Complete flow: QA fail → capture → pattern → warning → prevention
28. ✅ **Effectiveness test** - Verify prevention rate calculation accuracy

---

## Dependencies

**Upstream (Must Complete First):**

- ✅ PHASE4-TASK-01: Knowledge Base System (provides storage foundation)
- ✅ PHASE3-TASK-01: Task queue persistence (task signatures)
- ✅ QA Service (exists: `parent-harness/orchestrator/src/events/qa-service.ts`)

**Downstream (Depends on This):**

- PHASE5-TASK-01: Self-improvement loop (uses failure patterns for meta-learning)
- PHASE6-TASK-01: Auto-promotion of validated patterns to CLAUDE.md

**Parallel Work (Can Develop Concurrently):**

- PHASE4-TASK-03: Spec Agent learning (similar feedback loop, different agent)
- PHASE3-TASK-05: Dashboard widgets (can add failure dashboard separately)

---

## Implementation Plan

### Phase 1: Database & Failure Capture (5 hours)

1. Create migration: `004_qa_failure_learning.sql`
2. Implement failure analyzer (`qa/failure-analyzer.ts`)
3. Implement failure categorization logic
4. Add pattern detection and occurrence tracking
5. Unit test failure capture

### Phase 2: Learning Injection (4 hours)

6. Implement learning injector (`qa/learning-injector.ts`)
7. Implement warning retrieval and ranking
8. Implement warning formatting
9. Implement delivery tracking
10. Test warning generation for sample tasks

### Phase 3: Integration (4 hours)

11. Integrate with QA service (capture on failure)
12. Integrate with spawner (inject warnings)
13. Implement outcome recording
14. Test end-to-end flow

### Phase 4: Fix Workflow Tracking (3 hours)

15. Implement fix attempt recording
16. Link fixes to failures
17. Extract gotchas from successful fixes
18. Test fix workflow sequences

### Phase 5: API & Dashboard (3 hours)

19. Add dashboard endpoints
20. Add pattern management endpoints
21. Test API performance
22. Create sample dashboard queries

### Phase 6: Testing & Validation (3 hours)

23. Write integration test suite
24. Test prevention effectiveness calculation
25. Validate pattern confidence updates
26. Document API and usage

**Total Estimated Effort:** 22 hours (~3 days)

---

## Testing Strategy

### Unit Tests

```typescript
// qa/failure-analyzer.test.ts
describe("QA Failure Analyzer", () => {
  test("captures failure with all context", async () => {
    const failure = await captureQAFailure({
      taskId: "task-001",
      sessionId: "session-001",
      failedChecks: ["test:unit", "lint:typescript"],
      errorMessages: ["Test failed: Expected 5 but got 3"],
      filesModified: ["src/utils/calculator.ts"],
    });

    expect(failure.id).toBeDefined();
    expect(failure.failureCategory).toBe("test_failure");
    expect(failure.failedChecks).toContain("test:unit");
  });

  test("categorizes failures correctly", () => {
    expect(categorizeFailure(["test:unit"], ["Jest test failed"])).toBe(
      "test_failure",
    );
    expect(categorizeFailure(["build"], ["tsc compilation failed"])).toBe(
      "build_error",
    );
    expect(categorizeFailure(["lint"], ["ESLint error"])).toBe("lint_error");
  });

  test("detects patterns and links occurrences", async () => {
    // Create a pattern
    await createPattern(
      "import_error",
      "Cannot find module",
      "missing_dependency",
    );

    // Capture failure matching pattern
    const failure = await captureQAFailure({
      taskId: "task-002",
      failedChecks: ["build"],
      errorMessages: ['Cannot find module "foo"'],
    });

    // Verify occurrence created
    const occurrences = await query(
      "SELECT * FROM qa_pattern_occurrences WHERE failure_id = ?",
      [failure.id],
    );

    expect(occurrences).toHaveLength(1);
  });
});

// qa/learning-injector.test.ts
describe("Learning Injector", () => {
  test("retrieves relevant warnings", async () => {
    // Create pattern
    await createPattern(
      "database_migration",
      "missing migration",
      "build_error",
      {
        file_pattern: "schema/*",
        occurrences: 5,
        confidence: 0.8,
        prevention_effectiveness: 0.75,
      },
    );

    // Get warnings for task modifying schema
    const warnings = await getRelevantQAWarnings({
      taskId: "task-003",
      filesInvolved: ["schema/entities/user.ts"],
      limit: 5,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].patternName).toBe("database_migration");
    expect(warnings[0].relevanceScore).toBeGreaterThan(0.8); // Boosted for file match
  });

  test("formats warnings correctly", () => {
    const text = formatWarning(
      "Missing Imports",
      "Build fails with module not found",
      "Forgot to add import statement",
      "Always check imports after moving files",
      10,
      0.85,
    );

    expect(text).toContain("⚠️");
    expect(text).toContain("Missing Imports");
    expect(text).toContain("85% prevention rate");
  });

  test("records warning outcomes and updates effectiveness", async () => {
    const patternId = await createPattern(
      "test_pattern",
      "error",
      "test_failure",
    );

    // Deliver warning
    await recordWarningDelivery({
      sessionId: "session-001",
      taskId: "task-001",
      warnings: [{ patternId /* ... */ }],
    });

    // Record prevention success
    await recordWarningOutcome({
      sessionId: "session-001",
      taskId: "task-001",
      outcome: "prevented",
    });

    // Verify pattern stats updated
    const pattern = await getOne(
      "SELECT prevention_successes, confidence FROM qa_failure_patterns WHERE id = ?",
      [patternId],
    );

    expect(pattern.prevention_successes).toBe(1);
    expect(pattern.confidence).toBeGreaterThan(0.5); // Boosted
  });
});
```

### Integration Tests

```typescript
// integration/qa-learning-loop.test.ts
describe('QA Learning Loop Integration', () => {
  test('complete flow: fail → capture → warn → prevent', async () => {
    // 1. Task fails QA
    const task1 = await createTask({ title: 'Add user validation' });
    await executeTask(task1.id); // Implementation with bug
    const qaResult1 = await verifyTask(task1.id);

    expect(qaResult1.passed).toBe(false);

    // 2. Failure captured
    const failures = await query(
      'SELECT * FROM qa_failures WHERE task_id = ?',
      [task1.id]
    );
    expect(failures).toHaveLength(1);

    // 3. Pattern detected
    const patterns = await query(
      'SELECT * FROM qa_pattern_occurrences WHERE failure_id = ?',
      [failures[0].id]
    );
    expect(patterns.length).toBeGreaterThan(0);

    // 4. Fix applied, task succeeds
    await recordFixAttempt({
      failureId: failures[0].id,
      taskId: task1.id,
      fixApproach: 'Added null check',
      attemptNumber: 1,
      filesChanged: ['src/validation.ts'],
      changesSummary: 'Added validation.length > 0 check',
      outcome: 'success',
    });

    // 5. New similar task spawned
    const task2 = await createTask({ title: 'Add email validation' });
    const warnings = await getRelevantQAWarnings({
      taskId: task2.id,
      filesInvolved: ['src/validation.ts'],
    });

    // 6. Warning delivered
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].warningText).toContain('null check');

    // 7. Task completes without QA failure (warning prevented it)
    await executeTask(task2.id); // Implementation using warning
    const qaResult2 = await verifyTask(task2.id);

    expect(qaResult2.passed).toBe(true);

    // 8. Prevention recorded
    await recordWarningOutcome({
      sessionId: /* session ID */,
      taskId: task2.id,
      outcome: 'prevented',
    });

    // 9. Pattern effectiveness increased
    const updatedPattern = await getOne(
      'SELECT prevention_effectiveness FROM qa_failure_patterns WHERE id = ?',
      [patterns[0].pattern_id]
    );
    expect(updatedPattern.prevention_effectiveness).toBeGreaterThan(0.5);
  });
});
```

---

## Success Metrics

**Operational:**

- 100+ QA failures captured in first month
- 80%+ of failures automatically categorized correctly
- 10+ recurring patterns identified (≥3 occurrences each)
- Warning delivery latency <300ms

**Agent Performance:**

- QA failure rate decreases by 25% after 50+ failures captured
- Mean attempts to pass QA decreases from 2.5 to 1.5
- 40%+ of warnings lead to prevention (prevented / (prevented + failed_anyway))
- Build Agents with warnings have 30%+ higher first-time pass rate

**Quality:**

- 90%+ of pattern detections validated as correct by manual review
- Prevention effectiveness correlates with confidence (Pearson r > 0.6)
- High-effectiveness warnings (>70%) promoted to CLAUDE.md within 30 days

---

## Rollback Plan

If learning system causes issues:

1. **Disable warning injection:**
   - Set config: `ENABLE_QA_WARNINGS=false`
   - Build Agents spawn without warnings
   - Failure capture continues

2. **Disable failure capture:**
   - Set config: `ENABLE_QA_LEARNING=false`
   - QA service works without learning overhead

3. **Revert database:**
   - Run: `004_qa_failure_learning_rollback.sql`
   - Drops all 5 learning tables

---

## Future Enhancements (Out of Scope)

1. **ML-based failure prediction** - Predict likely failures before QA
2. **Auto-fix suggestions** - Generate code patches from fix workflows
3. **Cross-project pattern sharing** - Share learnings across Vibe instances
4. **Visual failure heatmap** - Show which files/patterns cause most failures
5. **A/B testing framework** - Scientifically measure warning impact
6. **Collaborative pattern validation** - Multiple agents vote on pattern validity

---

## References

- `parent-harness/orchestrator/src/events/qa-service.ts`: QA verification service
- `docs/specs/PHASE4-TASK-01-knowledge-base-system.md`: Knowledge base foundation
- `agents/knowledge-base/queries.ts`: Knowledge retrieval patterns
- `STRATEGIC_PLAN.md`: Phase 4 learning objectives

---

**Generated by:** spec_agent
**Model:** Claude Sonnet 4.5
**Date:** 2026-02-08
**Specification Duration:** Comprehensive analysis and design
