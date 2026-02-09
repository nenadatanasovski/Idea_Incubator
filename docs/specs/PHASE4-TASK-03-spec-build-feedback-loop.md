# PHASE4-TASK-03: Spec Agent Learning from Build Agent Feedback

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Large
**Created:** 2026-02-08
**Model:** Sonnet 4.5 (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement a feedback loop where the Spec Agent learns from Build Agent execution outcomes to iteratively improve specification quality. This creates a self-improving system where specifications become more actionable, complete, and accurate over time based on real implementation experience.

**Problem:** Currently, the Spec Agent generates specifications in isolation (see `agents/ideation/spec-generator.ts`) without learning from whether those specs lead to successful implementations. When Build Agents encounter ambiguities, missing requirements, or implementation challenges, this valuable feedback is lost. The spec-build gap persists because there's no mechanism for specs to improve based on build outcomes.

**Solution:** Create a bidirectional feedback system that:
1. Captures Build Agent feedback (blockers, clarifications needed, spec gaps)
2. Associates feedback with specific spec sections and confidence scores
3. Enables Spec Agent to query past feedback when generating new specs
4. Provides auto-improvement suggestions for low-quality spec patterns
5. Tracks spec quality metrics (implementation success rate, clarification requests)
6. Learns common spec anti-patterns and generates warnings proactively

---

## Current State Analysis

### Existing Infrastructure ✅

**1. Spec Generation System** (`agents/ideation/spec-generator.ts`)
- ✅ Generates structured specs with 8 sections (problem, target_users, functional_desc, success_criteria, constraints, out_of_scope, risks, assumptions)
- ✅ Confidence scoring per section (0-100%)
- ✅ Clarifying questions generation when confidence is low
- ✅ Database storage in `prds` and `spec_sections` tables
- ✅ Markdown file output to `users/[user]/ideas/[idea]/build/APP-SPEC.md`
- ✅ Version history tracking in `.metadata/spec-history.json`
- ❌ **Gap:** No feedback capture from implementation phase
- ❌ **Gap:** No learning from past spec quality issues

**2. Build Agent Orchestrator** (`server/services/task-agent/build-agent-orchestrator.ts`)
- ✅ Spawns Build Agents for task execution
- ✅ Tracks task outcomes (completed, failed, blocked)
- ✅ Error message capture in `build_agent_instances.error_message`
- ✅ Failure classification with `error-handling.ts` (GAP-002 integration)
- ✅ SIA escalation for stuck tasks (`checkSIAEscalation()`)
- ✅ Execution history in `task_executions` table
- ❌ **Gap:** No structured spec feedback recording
- ❌ **Gap:** No "this spec section was unclear" reporting

**3. Knowledge Base System** (PHASE4-TASK-01 - see spec)
- ✅ Stores gotchas, patterns, decisions in `knowledge_entries` table
- ✅ Confidence tracking with boost/decay logic
- ✅ Error recovery strategy tracking in `error_recovery_strategies`
- ✅ Task signature matching for similar task lookup
- ✅ Cross-agent knowledge sharing infrastructure
- ✅ REST API: `/api/knowledge/gotcha`, `/api/knowledge/pattern`
- ⚠️ **Partial:** Supports general knowledge but not spec-specific feedback
- ❌ **Gap:** No spec quality feedback type
- ❌ **Gap:** No spec-to-implementation traceability

**4. Agent Memory System** (`parent-harness/orchestrator/src/memory/index.ts`, `MEMORY_SYSTEM.md`)
- ✅ Per-agent memory storage with types: context, learning, preference, error_pattern, success_pattern
- ✅ Task context setting (`setTaskContext()`)
- ✅ Success/error learning (`learnSuccess()`, `learnError()`)
- ✅ Access tracking and importance scoring
- ✅ REST API: `/api/memory/`
- ❌ **Gap:** No spec-improvement memory type
- ❌ **Gap:** No inter-agent feedback memories (spec→build)

**5. Spec Validation** (`agents/ideation/spec-validator.ts`)
- ✅ Validates completeness of spec sections
- ✅ Checks for contradictions and ambiguities
- ✅ Quality scoring
- ❌ **Gap:** No post-implementation validation
- ❌ **Gap:** No "implementation revealed this gap" feedback

### Gaps Summary

| Gap | Impact | Solution |
|-----|--------|----------|
| No feedback capture from Build Agent | Spec quality doesn't improve | Add `spec_feedback` table |
| No spec-to-task traceability | Can't correlate failures to spec issues | Link tasks to spec sections |
| No spec improvement suggestions | Manual spec refinement only | Auto-generate improvement prompts |
| No spec quality metrics | No visibility into spec effectiveness | Track implementation success rate |
| No anti-pattern detection | Same mistakes repeated | Pattern matching on failed specs |
| No Spec Agent memory integration | Each spec starts from scratch | Inject relevant learnings into generation |

---

## Requirements

### Functional Requirements

**FR-1: Build Agent Feedback Capture**
- MUST capture three types of feedback from Build Agents:
  - **Blocker**: Spec gap prevents implementation ("Missing: API authentication method")
  - **Clarification**: Ambiguous requirement needs resolution ("Unclear: Should users be able to delete their account?")
  - **Enhancement**: Spec is complete but could be improved ("Consider: Rate limiting on API endpoints")
- MUST link feedback to specific spec sections (problem, functional_desc, etc.)
- MUST include severity: critical (blocks work), high (slows work), medium (nice-to-have)
- MUST capture context: task_id, execution_id, agent_id, timestamp
- MUST support freeform text and optional suggested resolution
- SHOULD auto-detect spec gaps from error messages (e.g., "undefined behavior for edge case X")

**FR-2: Spec-Task Traceability**
- MUST link tasks to the spec sections they implement
- MUST track which spec version was used for task generation
- MUST record implementation outcome: success, failed, blocked, partial
- MUST calculate per-section implementation success rate
- MUST identify high-risk sections (multiple failures, many clarifications)
- SHOULD support manual override of spec-task links

**FR-3: Spec Agent Learning Integration**
- MUST inject relevant feedback when Spec Agent generates new specs
- MUST retrieve feedback by similarity: similar problem domain, same agent, same user
- MUST rank feedback by relevance (recent, same category, high severity)
- MUST format feedback as guidance in system prompt (e.g., "Past specs lacked...")
- MUST track which learnings were applied to which specs
- SHOULD measure learning impact (specs with learnings vs. without)

**FR-4: Auto-Improvement Suggestions**
- MUST detect common spec anti-patterns:
  - Vague success criteria ("system should be fast")
  - Missing edge cases ("what happens if user inputs empty string?")
  - Contradictory constraints ("must be real-time" + "batch processing")
  - Incomplete functional descriptions ("user can upload files" - what types? size limits?)
- MUST generate specific improvement suggestions for each anti-pattern
- MUST prioritize suggestions by impact (critical gaps first)
- MUST support auto-apply mode (low-risk suggestions applied automatically)
- SHOULD learn new anti-patterns from repeated failures

**FR-5: Spec Quality Metrics Dashboard**
- MUST track per-spec metrics:
  - Implementation success rate (% of tasks completed without blockers)
  - Clarification request count
  - Average time-to-first-blocker
  - Section confidence score vs. actual success correlation
- MUST track per-agent metrics (which Spec Agent version performs best)
- MUST display trends over time (are specs improving?)
- MUST support filtering by: date range, agent, user, spec category
- SHOULD export metrics to CSV/JSON

**FR-6: Feedback Review Workflow**
- MUST support manual review of Build Agent feedback before incorporation
- MUST allow users to approve/reject feedback items
- MUST track feedback status: pending, approved, rejected, auto-applied
- MUST support bulk operations (approve all critical blockers)
- MUST notify Spec Agent when new approved feedback is available
- SHOULD integrate with task management (create follow-up tasks from feedback)

### Non-Functional Requirements

**NFR-1: Performance**
- Feedback capture MUST NOT block Build Agent execution (<50ms overhead)
- Spec Agent learning query MUST complete in <500ms (retrieve + rank feedback)
- Quality metrics dashboard MUST load in <2 seconds (100+ specs)
- Anti-pattern detection MUST run during spec generation (<1 second added latency)

**NFR-2: Data Integrity**
- Feedback entries MUST be immutable (append-only log)
- Spec-task links MUST be preserved even after spec/task deletion (soft delete)
- Feedback status changes MUST be audit logged
- Duplicate feedback MUST be detected and merged (95% similarity threshold)

**NFR-3: Usability**
- Feedback capture MUST be automatic (no Build Agent code changes required)
- Spec Agent learning MUST be transparent (log which feedback influenced generation)
- Quality metrics MUST use visual indicators (red/yellow/green success rates)
- Anti-pattern warnings MUST be actionable (specific examples + fixes)

**NFR-4: Extensibility**
- Feedback types MUST be extensible (add new types without schema change)
- Anti-pattern detectors MUST be pluggable (register new detectors)
- Quality metrics MUST support custom calculations
- Feedback sources MUST support non-Build-Agent input (manual, QA Agent)

---

## Technical Design

### Database Schema Extensions

**New tables for Parent Harness** (`parent-harness/database/schema.sql`):

```sql
-- ============================================
-- SPEC-BUILD FEEDBACK LOOP
-- ============================================

-- Spec Feedback from Build Agents
CREATE TABLE IF NOT EXISTS spec_feedback (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,                    -- References prd.id from Idea Incubator DB
    spec_section TEXT,                        -- problem, functional_desc, etc. (null = general)
    feedback_type TEXT NOT NULL CHECK(feedback_type IN ('blocker', 'clarification', 'enhancement')),
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- Content
    feedback_text TEXT NOT NULL,
    suggested_resolution TEXT,

    -- Context
    task_id TEXT,                             -- Task that generated feedback
    execution_id TEXT,
    agent_id TEXT NOT NULL,                   -- Usually 'build_agent'
    error_message TEXT,                       -- Associated error if any

    -- Lifecycle
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'auto_applied')),
    reviewed_by TEXT,                         -- User/agent who reviewed
    reviewed_at TEXT,
    applied_to_spec_id TEXT,                  -- If used to improve a spec

    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX idx_spec_feedback_spec ON spec_feedback(spec_id);
CREATE INDEX idx_spec_feedback_type ON spec_feedback(feedback_type);
CREATE INDEX idx_spec_feedback_severity ON spec_feedback(severity);
CREATE INDEX idx_spec_feedback_status ON spec_feedback(status);
CREATE INDEX idx_spec_feedback_section ON spec_feedback(spec_section);

-- Spec-Task Traceability
CREATE TABLE IF NOT EXISTS spec_task_links (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    spec_version INTEGER NOT NULL,            -- Which version of spec was used
    spec_section TEXT,                        -- Which section this task implements
    task_id TEXT NOT NULL UNIQUE,             -- Each task maps to one spec

    -- Outcome tracking
    implementation_status TEXT CHECK(implementation_status IN (
        'not_started', 'in_progress', 'completed', 'failed', 'blocked', 'partial'
    )),
    feedback_count INTEGER DEFAULT 0,         -- How many feedback items for this link
    blocker_count INTEGER DEFAULT 0,          -- Critical feedback count

    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,

    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_spec_task_links_spec ON spec_task_links(spec_id);
CREATE INDEX idx_spec_task_links_task ON spec_task_links(task_id);
CREATE INDEX idx_spec_task_links_status ON spec_task_links(implementation_status);

-- Spec Quality Metrics (aggregated)
CREATE TABLE IF NOT EXISTS spec_quality_metrics (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL UNIQUE,

    -- Success metrics
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    failed_tasks INTEGER DEFAULT 0,
    blocked_tasks INTEGER DEFAULT 0,
    success_rate REAL GENERATED ALWAYS AS (
        CASE
            WHEN total_tasks = 0 THEN 0.0
            ELSE CAST(completed_tasks AS REAL) / total_tasks
        END
    ) STORED,

    -- Feedback metrics
    total_feedback INTEGER DEFAULT 0,
    blocker_feedback INTEGER DEFAULT 0,
    clarification_feedback INTEGER DEFAULT 0,
    enhancement_feedback INTEGER DEFAULT 0,
    avg_severity REAL,                        -- 1.0 = critical, 0.25 = low

    -- Section quality (JSON)
    section_success_rates TEXT,               -- {"problem": 0.95, "functional_desc": 0.7, ...}

    -- Timing metrics
    avg_time_to_first_blocker_hours REAL,
    avg_implementation_duration_hours REAL,

    -- Metadata
    last_calculated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_spec_quality_success ON spec_quality_metrics(success_rate);

-- Spec Anti-Patterns (detected issues)
CREATE TABLE IF NOT EXISTS spec_anti_patterns (
    id TEXT PRIMARY KEY,
    pattern_name TEXT NOT NULL,               -- vague_success_criteria, missing_edge_cases, etc.
    description TEXT NOT NULL,
    detection_rule TEXT NOT NULL,             -- Regex or keyword pattern

    -- Guidance
    explanation TEXT NOT NULL,                -- Why this is problematic
    fix_template TEXT NOT NULL,               -- How to fix it
    severity TEXT CHECK(severity IN ('critical', 'high', 'medium', 'low')),

    -- Effectiveness tracking
    times_detected INTEGER DEFAULT 0,
    times_fixed INTEGER DEFAULT 0,
    fix_success_rate REAL,

    -- Metadata
    applies_to_sections TEXT,                 -- JSON array: ["success_criteria", "functional_desc"]
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(pattern_name)
);

CREATE INDEX idx_anti_patterns_name ON spec_anti_patterns(pattern_name);

-- Spec Anti-Pattern Detections (instances found in specs)
CREATE TABLE IF NOT EXISTS spec_anti_pattern_detections (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    spec_section TEXT NOT NULL,
    pattern_id TEXT NOT NULL REFERENCES spec_anti_patterns(id),

    -- Detection details
    matched_text TEXT NOT NULL,               -- The problematic text
    suggested_fix TEXT,                       -- Auto-generated fix

    -- Status
    status TEXT DEFAULT 'detected' CHECK(status IN ('detected', 'acknowledged', 'fixed', 'false_positive')),
    fixed_in_version INTEGER,

    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
);

CREATE INDEX idx_detections_spec ON spec_anti_pattern_detections(spec_id);
CREATE INDEX idx_detections_pattern ON spec_anti_pattern_detections(pattern_id);
CREATE INDEX idx_detections_status ON spec_anti_pattern_detections(status);

-- Spec Learning Applications (which feedback influenced which spec)
CREATE TABLE IF NOT EXISTS spec_learning_applications (
    id TEXT PRIMARY KEY,
    source_spec_id TEXT NOT NULL,             -- Spec that generated feedback
    target_spec_id TEXT NOT NULL,             -- Spec that applied the learning
    feedback_ids TEXT NOT NULL,               -- JSON array of applied feedback IDs

    -- Learning summary
    learning_type TEXT CHECK(learning_type IN ('feedback', 'anti_pattern', 'memory')),
    learning_content TEXT NOT NULL,           -- What was learned
    applied_to_sections TEXT,                 -- JSON array of affected sections

    -- Impact tracking
    impact_score REAL,                        -- 0-1, how much this improved the spec
    measured_at TEXT,                         -- When impact was calculated

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_learning_source ON spec_learning_applications(source_spec_id);
CREATE INDEX idx_learning_target ON spec_learning_applications(target_spec_id);
```

**Seed anti-patterns:**

```sql
-- Insert common spec anti-patterns
INSERT INTO spec_anti_patterns (id, pattern_name, description, detection_rule, explanation, fix_template, severity, applies_to_sections) VALUES
('ap_001', 'vague_success_criteria', 'Success criteria uses subjective language', '(fast|quick|easy|simple|user-friendly|intuitive|efficient)', 'Subjective terms cannot be tested or measured objectively', 'Replace "[VAGUE]" with measurable criteria: "Response time < 200ms" or "Task completion in ≤3 clicks"', 'high', '["success_criteria"]'),
('ap_002', 'missing_edge_cases', 'No mention of error handling or edge cases', '^(?!.*(error|exception|invalid|empty|null|edge case|boundary)).*$', 'Specs that ignore edge cases lead to incomplete implementations', 'Add edge case handling: "What happens when: input is empty, network fails, user lacks permissions?"', 'critical', '["functional_desc", "success_criteria"]'),
('ap_003', 'contradictory_constraints', 'Constraints contradict each other', '(real-time|instant|immediate).*(batch|queue|async|delayed)', 'Contradictory constraints confuse implementers', 'Clarify priority: "Primary: real-time updates. Fallback: batch processing for bulk operations"', 'high', '["constraints"]'),
('ap_004', 'incomplete_functional_desc', 'Functional description lacks key details', '(upload|create|add|update|delete|send).{0,50}(?!\s*(format|type|size|limit|validation))', 'Missing constraints on operations lead to implementation assumptions', 'Add specifics: "User uploads [file types: PDF, DOCX] [max size: 10MB] [validation: virus scan]"', 'high', '["functional_desc"]'),
('ap_005', 'no_authentication', 'No authentication/authorization specified for sensitive operations', '(delete|remove|admin|create user|modify|update).{0,100}(?!.*(auth|permission|role|access control))', 'Security requirements must be explicit', 'Add: "Requires [role: admin/user] authentication. Authorization check: [permission]"', 'critical', '["functional_desc", "constraints"]');
```

### Core Modules

#### 1. Feedback Capture Service (`parent-harness/orchestrator/src/feedback/capture.ts`)

```typescript
import { v4 as uuid } from 'uuid';
import { run, getOne } from '../db/index.js';

export interface SpecFeedback {
  id: string;
  specId: string;
  specSection?: string;
  feedbackType: 'blocker' | 'clarification' | 'enhancement';
  severity: 'critical' | 'high' | 'medium' | 'low';
  feedbackText: string;
  suggestedResolution?: string;
  taskId?: string;
  executionId?: string;
  agentId: string;
  errorMessage?: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
  createdAt: string;
}

/**
 * Capture feedback from Build Agent about spec quality
 */
export async function captureFeedback(params: {
  specId: string;
  specSection?: string;
  feedbackType: 'blocker' | 'clarification' | 'enhancement';
  severity: 'critical' | 'high' | 'medium' | 'low';
  feedbackText: string;
  suggestedResolution?: string;
  taskId?: string;
  executionId?: string;
  agentId: string;
  errorMessage?: string;
}): Promise<SpecFeedback> {
  const id = uuid();
  const now = new Date().toISOString();

  // Check for duplicate feedback (95% similarity)
  const existing = await findSimilarFeedback(params.specId, params.feedbackText);
  if (existing) {
    console.log(`[FeedbackCapture] Duplicate feedback detected, incrementing occurrence`);
    return existing;
  }

  // Auto-approve low-severity enhancements
  const status = params.feedbackType === 'enhancement' && params.severity === 'low'
    ? 'auto_applied'
    : 'pending';

  await run(`
    INSERT INTO spec_feedback
    (id, spec_id, spec_section, feedback_type, severity, feedback_text,
     suggested_resolution, task_id, execution_id, agent_id, error_message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, params.specId, params.specSection, params.feedbackType, params.severity,
    params.feedbackText, params.suggestedResolution, params.taskId, params.executionId,
    params.agentId, params.errorMessage, status, now
  ]);

  // Update spec-task link feedback counts
  if (params.taskId) {
    await run(`
      UPDATE spec_task_links
      SET feedback_count = feedback_count + 1,
          blocker_count = blocker_count + CASE WHEN ? = 'blocker' THEN 1 ELSE 0 END
      WHERE task_id = ?
    `, [params.feedbackType, params.taskId]);
  }

  return {
    id,
    specId: params.specId,
    specSection: params.specSection,
    feedbackType: params.feedbackType,
    severity: params.severity,
    feedbackText: params.feedbackText,
    suggestedResolution: params.suggestedResolution,
    taskId: params.taskId,
    executionId: params.executionId,
    agentId: params.agentId,
    errorMessage: params.errorMessage,
    status,
    createdAt: now,
  };
}

/**
 * Auto-detect spec gaps from error messages
 */
export async function detectSpecGapsFromError(
  taskId: string,
  errorMessage: string,
  agentId: string
): Promise<SpecFeedback | null> {
  // Get spec for this task
  const link = await getOne<{ spec_id: string; spec_section: string }>(
    'SELECT spec_id, spec_section FROM spec_task_links WHERE task_id = ?',
    [taskId]
  );

  if (!link) return null;

  // Pattern matching for common spec gaps
  const gapPatterns = [
    {
      pattern: /undefined (behavior|method|property|function)/i,
      section: 'functional_desc',
      feedback: 'Missing specification for behavior: The spec does not define what should happen in this case.',
    },
    {
      pattern: /missing (authentication|authorization|permission)/i,
      section: 'constraints',
      feedback: 'Missing security requirement: Authentication/authorization not specified in constraints.',
    },
    {
      pattern: /no (validation|constraint) for/i,
      section: 'functional_desc',
      feedback: 'Missing validation rules: The spec does not specify input validation requirements.',
    },
    {
      pattern: /(ambiguous|unclear) requirement/i,
      section: 'functional_desc',
      feedback: 'Ambiguous requirement: The spec description is not clear enough for implementation.',
    },
  ];

  for (const { pattern, section, feedback } of gapPatterns) {
    if (pattern.test(errorMessage)) {
      return captureFeedback({
        specId: link.spec_id,
        specSection: section,
        feedbackType: 'blocker',
        severity: 'critical',
        feedbackText: feedback,
        suggestedResolution: `Review and clarify the ${section} section to address: ${errorMessage.substring(0, 100)}`,
        taskId,
        agentId,
        errorMessage,
      });
    }
  }

  return null;
}

/**
 * Find similar feedback to avoid duplicates
 */
async function findSimilarFeedback(specId: string, feedbackText: string): Promise<SpecFeedback | null> {
  // Simple similarity: check if 80%+ of words match
  const words = new Set(feedbackText.toLowerCase().split(/\s+/));

  const existing = await getOne<SpecFeedback>(`
    SELECT * FROM spec_feedback
    WHERE spec_id = ?
      AND created_at > datetime('now', '-7 days')
    ORDER BY created_at DESC
  `, [specId]);

  if (!existing) return null;

  const existingWords = new Set(existing.feedbackText.toLowerCase().split(/\s+/));
  const intersection = new Set([...words].filter(w => existingWords.has(w)));
  const similarity = intersection.size / Math.max(words.size, existingWords.size);

  return similarity > 0.8 ? existing : null;
}
```

#### 2. Spec Learning Injector (`parent-harness/orchestrator/src/feedback/learning-injector.ts`)

```typescript
import { query } from '../db/index.js';

export interface LearningContext {
  approvedFeedback: SpecFeedback[];
  antiPatterns: AntiPattern[];
  similarSpecSuccesses: SpecQualityMetric[];
}

/**
 * Get relevant learnings to inject into Spec Agent prompt
 */
export async function getRelevantLearnings(params: {
  userId: string;
  ideaCategory?: string;
  specSections?: string[];
  limit?: number;
}): Promise<LearningContext> {
  const limit = params.limit || 10;

  // Get approved feedback from similar specs
  const approvedFeedback = await query<SpecFeedback>(`
    SELECT sf.*
    FROM spec_feedback sf
    WHERE sf.status = 'approved'
      AND sf.severity IN ('critical', 'high')
      AND sf.created_at > datetime('now', '-90 days')
    ORDER BY sf.severity DESC, sf.created_at DESC
    LIMIT ?
  `, [limit]);

  // Get anti-patterns detected in recent specs
  const antiPatterns = await query<AntiPattern>(`
    SELECT DISTINCT ap.*
    FROM spec_anti_patterns ap
    JOIN spec_anti_pattern_detections apd ON ap.id = apd.pattern_id
    WHERE apd.status = 'detected'
      AND apd.created_at > datetime('now', '-30 days')
    ORDER BY ap.severity DESC, ap.times_detected DESC
    LIMIT ?
  `, [5]);

  // Get high-performing specs for reference
  const similarSpecSuccesses = await query<SpecQualityMetric>(`
    SELECT sqm.*
    FROM spec_quality_metrics sqm
    WHERE sqm.success_rate >= 0.8
      AND sqm.total_tasks >= 3
    ORDER BY sqm.success_rate DESC, sqm.total_tasks DESC
    LIMIT ?
  `, [5]);

  return {
    approvedFeedback,
    antiPatterns,
    similarSpecSuccesses,
  };
}

/**
 * Format learnings for Spec Agent system prompt
 */
export function formatLearningsForPrompt(learnings: LearningContext): string {
  const sections: string[] = [];

  if (learnings.approvedFeedback.length > 0) {
    sections.push('## Past Spec Feedback to Avoid\n');
    for (const feedback of learnings.approvedFeedback) {
      sections.push(`- **[${feedback.severity.toUpperCase()}]** ${feedback.feedbackText}`);
      if (feedback.suggestedResolution) {
        sections.push(`  → Fix: ${feedback.suggestedResolution}`);
      }
    }
  }

  if (learnings.antiPatterns.length > 0) {
    sections.push('\n## Common Spec Anti-Patterns to Avoid\n');
    for (const pattern of learnings.antiPatterns) {
      sections.push(`- **${pattern.pattern_name}**: ${pattern.explanation}`);
      sections.push(`  → Fix: ${pattern.fix_template}`);
    }
  }

  if (learnings.similarSpecSuccesses.length > 0) {
    sections.push('\n## High-Quality Spec Examples\n');
    sections.push(`${learnings.similarSpecSuccesses.length} specs achieved ≥80% implementation success.`);
    sections.push('Key patterns: Complete edge case coverage, measurable success criteria, explicit constraints.');
  }

  return sections.join('\n');
}
```

#### 3. Anti-Pattern Detector (`parent-harness/orchestrator/src/feedback/anti-pattern-detector.ts`)

```typescript
import { query, run } from '../db/index.js';
import { v4 as uuid } from 'uuid';

export interface AntiPatternDetection {
  patternName: string;
  matchedText: string;
  suggestedFix: string;
  severity: string;
}

/**
 * Scan spec for anti-patterns
 */
export async function detectAntiPatterns(
  specId: string,
  specSections: Record<string, string>
): Promise<AntiPatternDetection[]> {
  const patterns = await query<{
    id: string;
    pattern_name: string;
    detection_rule: string;
    fix_template: string;
    severity: string;
    applies_to_sections: string;
  }>('SELECT * FROM spec_anti_patterns');

  const detections: AntiPatternDetection[] = [];

  for (const pattern of patterns) {
    const applicableSections = JSON.parse(pattern.applies_to_sections || '[]');
    const regex = new RegExp(pattern.detection_rule, 'gi');

    for (const section of applicableSections) {
      const content = specSections[section];
      if (!content) continue;

      const matches = content.match(regex);
      if (matches) {
        for (const match of matches) {
          const suggestedFix = pattern.fix_template.replace('[VAGUE]', match);

          // Record detection
          await run(`
            INSERT INTO spec_anti_pattern_detections
            (id, spec_id, spec_section, pattern_id, matched_text, suggested_fix, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'detected', datetime('now'))
          `, [uuid(), specId, section, pattern.id, match, suggestedFix]);

          // Update pattern stats
          await run(`
            UPDATE spec_anti_patterns
            SET times_detected = times_detected + 1,
                updated_at = datetime('now')
            WHERE id = ?
          `, [pattern.id]);

          detections.push({
            patternName: pattern.pattern_name,
            matchedText: match,
            suggestedFix,
            severity: pattern.severity,
          });
        }
      }
    }
  }

  return detections;
}
```

#### 4. Spec Quality Calculator (`parent-harness/orchestrator/src/feedback/quality-calculator.ts`)

```typescript
import { query, run, getOne } from '../db/index.js';

/**
 * Calculate and update spec quality metrics
 */
export async function calculateSpecQuality(specId: string): Promise<void> {
  // Get task outcomes for this spec
  const tasks = await query<{
    implementation_status: string;
    feedback_count: number;
    blocker_count: number;
  }>(`
    SELECT implementation_status, feedback_count, blocker_count
    FROM spec_task_links
    WHERE spec_id = ?
  `, [specId]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.implementation_status === 'completed').length;
  const failedTasks = tasks.filter(t => t.implementation_status === 'failed').length;
  const blockedTasks = tasks.filter(t => t.implementation_status === 'blocked').length;

  // Get feedback metrics
  const feedbackStats = await getOne<{
    total: number;
    blockers: number;
    clarifications: number;
    enhancements: number;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN feedback_type = 'blocker' THEN 1 ELSE 0 END) as blockers,
      SUM(CASE WHEN feedback_type = 'clarification' THEN 1 ELSE 0 END) as clarifications,
      SUM(CASE WHEN feedback_type = 'enhancement' THEN 1 ELSE 0 END) as enhancements
    FROM spec_feedback
    WHERE spec_id = ?
  `, [specId]);

  // Calculate average severity (critical=1.0, high=0.75, medium=0.5, low=0.25)
  const severityMap = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
  const feedbackItems = await query<{ severity: string }>(
    'SELECT severity FROM spec_feedback WHERE spec_id = ?',
    [specId]
  );
  const avgSeverity = feedbackItems.length > 0
    ? feedbackItems.reduce((sum, f) => sum + severityMap[f.severity as keyof typeof severityMap], 0) / feedbackItems.length
    : 0;

  // Upsert metrics
  await run(`
    INSERT INTO spec_quality_metrics
    (id, spec_id, total_tasks, completed_tasks, failed_tasks, blocked_tasks,
     total_feedback, blocker_feedback, clarification_feedback, enhancement_feedback, avg_severity,
     last_calculated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(spec_id) DO UPDATE SET
      total_tasks = excluded.total_tasks,
      completed_tasks = excluded.completed_tasks,
      failed_tasks = excluded.failed_tasks,
      blocked_tasks = excluded.blocked_tasks,
      total_feedback = excluded.total_feedback,
      blocker_feedback = excluded.blocker_feedback,
      clarification_feedback = excluded.clarification_feedback,
      enhancement_feedback = excluded.enhancement_feedback,
      avg_severity = excluded.avg_severity,
      last_calculated_at = datetime('now')
  `, [
    specId, specId, totalTasks, completedTasks, failedTasks, blockedTasks,
    feedbackStats?.total || 0, feedbackStats?.blockers || 0,
    feedbackStats?.clarifications || 0, feedbackStats?.enhancements || 0,
    avgSeverity
  ]);
}
```

### Integration Points

#### 1. Build Agent Error Handler Integration

```typescript
// In parent-harness/orchestrator/src/events/stuck-agent-handler.ts
import { detectSpecGapsFromError } from '../feedback/capture.js';

export async function handleStuckAgent(sessionId: string, error: any): Promise<void> {
  // Existing error handling...

  // NEW: Auto-detect spec gaps from error
  const task = await getTaskFromSession(sessionId);
  if (task) {
    const feedback = await detectSpecGapsFromError(
      task.id,
      error.message,
      'build_agent'
    );
    if (feedback) {
      console.log(`[StuckAgent] Detected spec gap: ${feedback.feedbackText}`);
    }
  }
}
```

#### 2. Spec Generator Integration

```typescript
// In agents/ideation/spec-generator.ts (Idea Incubator)
import { getRelevantLearnings, formatLearningsForPrompt } from '../../parent-harness/orchestrator/src/feedback/learning-injector.js';

export async function generateSpec(
  sessionId: string,
  userId: string,
  ideaTitle?: string
): Promise<SpecGenerationResult> {
  // Get learnings from past specs
  const learnings = await getRelevantLearnings({ userId, limit: 10 });
  const learningPrompt = formatLearningsForPrompt(learnings);

  // Build enhanced prompt with learnings
  const prompt = buildSpecGenerationPrompt(messages, ideaTitle) + '\n\n' + learningPrompt;

  // Generate spec with Claude
  const response = await anthropicClient.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse and save spec...
  const savedSpec = await saveSpec(spec, userId);

  // NEW: Run anti-pattern detection
  const antiPatterns = await detectAntiPatterns(savedSpec.id, {
    problem: spec.problemStatement,
    functional_desc: spec.functionalDescription,
    success_criteria: spec.successCriteria.join('\n'),
    constraints: spec.constraints.join('\n'),
  });

  if (antiPatterns.length > 0) {
    console.log(`[SpecGenerator] Detected ${antiPatterns.length} anti-patterns`);
  }

  return {
    spec: savedSpec,
    confidence: savedSpec.readinessScore,
    sectionConfidences,
    needsReviewSections: getNeedsReviewSections(parsed),
    clarifyingQuestions: getClarifyingQuestions(parsed),
    antiPatternWarnings: antiPatterns, // NEW
  };
}
```

#### 3. Task Creation Integration

```typescript
// In server/services/task-agent/task-creation-service.ts
import { run } from '../../../database/db.js';

export async function createTaskFromSpec(
  specId: string,
  specSection: string,
  taskDetails: any
): Promise<string> {
  const taskId = await createTask(taskDetails);

  // NEW: Link task to spec
  await run(`
    INSERT INTO spec_task_links (id, spec_id, spec_version, spec_section, task_id, implementation_status)
    VALUES (?, ?, ?, ?, ?, 'not_started')
  `, [uuid(), specId, 1, specSection, taskId]);

  return taskId;
}
```

#### 4. Quality Metrics API

```typescript
// In parent-harness/orchestrator/src/api/feedback.ts
import { Router } from 'express';
import { query } from '../db/index.js';
import { captureFeedback } from '../feedback/capture.js';
import { calculateSpecQuality } from '../feedback/quality-calculator.js';

export const feedbackRouter = Router();

/**
 * POST /api/feedback - Capture Build Agent feedback
 */
feedbackRouter.post('/', async (req, res) => {
  const feedback = await captureFeedback(req.body);
  res.json(feedback);
});

/**
 * GET /api/feedback/quality/:specId - Get spec quality metrics
 */
feedbackRouter.get('/quality/:specId', async (req, res) => {
  const { specId } = req.params;

  // Recalculate if stale
  await calculateSpecQuality(specId);

  const metrics = await getOne(
    'SELECT * FROM spec_quality_metrics WHERE spec_id = ?',
    [specId]
  );

  res.json(metrics || { message: 'No metrics yet' });
});

/**
 * GET /api/feedback/dashboard - Overall quality dashboard
 */
feedbackRouter.get('/dashboard', async (req, res) => {
  const stats = {
    total_specs: await getOne('SELECT COUNT(*) as count FROM spec_quality_metrics'),
    avg_success_rate: await getOne('SELECT AVG(success_rate) as avg FROM spec_quality_metrics'),
    specs_with_blockers: await getOne(`
      SELECT COUNT(*) as count FROM spec_quality_metrics WHERE blocker_feedback > 0
    `),
    top_anti_patterns: await query(`
      SELECT ap.pattern_name, ap.times_detected
      FROM spec_anti_patterns ap
      ORDER BY ap.times_detected DESC
      LIMIT 5
    `),
  };

  res.json(stats);
});
```

---

## Pass Criteria

### Database Schema
1. ✅ **Tables created** - spec_feedback, spec_task_links, spec_quality_metrics, spec_anti_patterns, spec_anti_pattern_detections, spec_learning_applications
2. ✅ **Indexes created** - All performance-critical indexes present
3. ✅ **Seed data** - 5 common anti-patterns inserted
4. ✅ **Migration tested** - Schema applies cleanly to harness.db

### Feedback Capture
5. ✅ **Manual feedback capture** - `captureFeedback()` creates entries with all required fields
6. ✅ **Auto-detection from errors** - `detectSpecGapsFromError()` identifies 4+ common gap patterns
7. ✅ **Duplicate prevention** - Similar feedback (>80%) is merged, not duplicated
8. ✅ **Spec-task linking** - Tasks link to spec ID + section + version
9. ✅ **Feedback counts update** - spec_task_links.feedback_count increments correctly

### Learning Integration
10. ✅ **Relevant learning retrieval** - `getRelevantLearnings()` returns approved feedback + anti-patterns
11. ✅ **Prompt formatting** - `formatLearningsForPrompt()` generates structured guidance text
12. ✅ **Spec generation with learnings** - Spec Agent receives past feedback in system prompt
13. ✅ **Learning application tracking** - spec_learning_applications records which feedback was used

### Anti-Pattern Detection
14. ✅ **Pattern detection works** - All 5 seed patterns detected in test specs
15. ✅ **Detection recording** - spec_anti_pattern_detections table populated
16. ✅ **Suggested fixes generated** - Each detection includes actionable fix template
17. ✅ **Statistics updated** - spec_anti_patterns.times_detected increments

### Quality Metrics
18. ✅ **Quality calculation** - `calculateSpecQuality()` computes all metrics correctly
19. ✅ **Success rate accuracy** - success_rate = completed_tasks / total_tasks
20. ✅ **Severity scoring** - avg_severity weights critical=1.0 down to low=0.25
21. ✅ **Section success rates** - section_success_rates JSON populated

### API Endpoints
22. ✅ **POST /api/feedback** - Creates feedback entry, returns ID
23. ✅ **GET /api/feedback/quality/:specId** - Returns metrics with recalculation
24. ✅ **GET /api/feedback/dashboard** - Returns aggregate stats
25. ✅ **Response time** - All endpoints respond in <500ms

### Integration
26. ✅ **Stuck agent handler** - Calls detectSpecGapsFromError on failures
27. ✅ **Spec generator** - Injects learnings into prompt, runs anti-pattern detection
28. ✅ **Task creation** - Creates spec_task_links entries
29. ✅ **Build agent** - No code changes required (passive integration)

### Testing
30. ✅ **Unit tests** - All modules tested in isolation
31. ✅ **Integration test** - Complete flow: spec → task → error → feedback → improved spec
32. ✅ **Quality metrics test** - Verify calculations match manual computation

---

## Dependencies

**Upstream (Must Complete First):**
- ✅ PHASE4-TASK-01: Knowledge Base System (provides pattern storage foundation)
- ⚠️ PHASE4-TASK-02: Agent Introspection (partial - uses memory API)
- ✅ Spec Generator (exists: `agents/ideation/spec-generator.ts`)
- ✅ Build Agent Orchestrator (exists: `server/services/task-agent/build-agent-orchestrator.ts`)

**Downstream (Depends on This):**
- PHASE5-TASK-01: Self-Improvement Loop (uses feedback to auto-refine specs)
- PHASE6-TASK-01: Auto-promotion of validated spec patterns to CLAUDE.md

**Parallel Work (Can Develop Concurrently):**
- PHASE3-TASK-05: Dashboard widgets (can add spec quality widget separately)
- PHASE5-TASK-02: Advanced pattern recognition (enhances anti-pattern detection)

---

## Implementation Plan

### Phase 1: Database & Core Services (6 hours)
1. Create migration: `003_spec_feedback_loop.sql`
2. Implement feedback capture service (`capture.ts`)
3. Implement spec-task linking in task creation
4. Seed anti-pattern data
5. Unit test feedback capture

### Phase 2: Anti-Pattern Detection (4 hours)
6. Implement anti-pattern detector (`anti-pattern-detector.ts`)
7. Test detection on sample specs
8. Tune regex patterns for accuracy
9. Add detection to spec generator

### Phase 3: Learning Injection (5 hours)
10. Implement learning injector (`learning-injector.ts`)
11. Implement prompt formatting
12. Integrate with spec generator
13. Test improved specs vs. baseline

### Phase 4: Quality Metrics (4 hours)
14. Implement quality calculator (`quality-calculator.ts`)
15. Add batch calculation job
16. Test metric accuracy
17. Create quality dashboard query

### Phase 5: API & Integration (3 hours)
18. Create feedback API routes
19. Integrate with stuck agent handler
20. Add feedback triggers to build agent
21. Test end-to-end flow

### Phase 6: Testing & Documentation (3 hours)
22. Write integration test suite
23. Load test with 100+ specs
24. Document API endpoints
25. Write user guide for feedback review

**Total Estimated Effort:** 25 hours (~3-4 days)

---

## Testing Strategy

### Unit Tests

```typescript
// feedback/capture.test.ts
describe('Feedback Capture', () => {
  test('creates feedback with all required fields', async () => {
    const feedback = await captureFeedback({
      specId: 'spec-001',
      specSection: 'functional_desc',
      feedbackType: 'blocker',
      severity: 'critical',
      feedbackText: 'Missing: API authentication method',
      taskId: 'task-001',
      agentId: 'build_agent',
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.status).toBe('pending');
  });

  test('auto-detects spec gap from error message', async () => {
    const feedback = await detectSpecGapsFromError(
      'task-001',
      'Error: undefined behavior for empty input',
      'build_agent'
    );

    expect(feedback).toBeDefined();
    expect(feedback?.feedbackType).toBe('blocker');
    expect(feedback?.specSection).toBe('functional_desc');
  });

  test('prevents duplicate feedback', async () => {
    const f1 = await captureFeedback({
      specId: 'spec-001',
      feedbackText: 'Missing edge case handling',
      // ...
    });

    const f2 = await captureFeedback({
      specId: 'spec-001',
      feedbackText: 'Missing edge case handling for errors',
      // ...
    });

    expect(f2.id).toBe(f1.id); // Same ID = duplicate detected
  });
});

// feedback/anti-pattern-detector.test.ts
describe('Anti-Pattern Detection', () => {
  test('detects vague success criteria', async () => {
    const detections = await detectAntiPatterns('spec-001', {
      success_criteria: 'System should be fast and user-friendly',
    });

    expect(detections).toContainEqual(
      expect.objectContaining({
        patternName: 'vague_success_criteria',
        matchedText: expect.stringContaining('fast'),
      })
    );
  });

  test('detects missing edge cases', async () => {
    const detections = await detectAntiPatterns('spec-001', {
      functional_desc: 'User can upload files to the system',
    });

    expect(detections).toContainEqual(
      expect.objectContaining({
        patternName: 'missing_edge_cases',
      })
    );
  });
});
```

### Integration Tests

```typescript
// integration/spec-feedback-loop.test.ts
describe('Spec Feedback Loop Integration', () => {
  test('complete flow: spec → task → error → feedback → improved spec', async () => {
    // 1. Generate initial spec (missing edge cases)
    const spec1 = await generateSpec('session-001', 'user-001', 'File Upload System');
    expect(spec1.spec.functionalDescription).toContain('upload files');

    // 2. Create task from spec
    const taskId = await createTaskFromSpec(spec1.spec.id, 'functional_desc', {
      title: 'Implement file upload',
    });

    // 3. Task fails with spec gap error
    await recordTaskFailure(taskId, 'Error: undefined behavior for empty file');

    // 4. Feedback auto-captured
    const feedback = await query(
      'SELECT * FROM spec_feedback WHERE task_id = ?',
      [taskId]
    );
    expect(feedback).toHaveLength(1);
    expect(feedback[0].feedback_type).toBe('blocker');

    // 5. Approve feedback
    await approveFeedback(feedback[0].id);

    // 6. Generate new spec with learnings
    const spec2 = await generateSpec('session-002', 'user-001', 'File Upload System v2');

    // 7. Verify learning applied
    expect(spec2.spec.functionalDescription).toContain('edge case');
    expect(spec2.spec.functionalDescription).toContain('empty');
  });
});
```

---

## Success Metrics

**Operational:**
- 100+ feedback entries captured in first month
- 80%+ of critical blockers detected automatically
- Anti-pattern detection catches 50%+ of spec issues before implementation
- Quality dashboard loads in <2 seconds with 100+ specs

**Agent Performance:**
- Spec success rate improves by 20% after 50+ feedback items
- Time to first blocker increases by 30% (specs are clearer)
- Clarification request count decreases by 40%
- Spec Agent generates 15%+ more edge case coverage

**Quality:**
- 90%+ of auto-detected feedback validated as correct by manual review
- Anti-pattern suggestions lead to measurable improvement in 70%+ of cases
- High-confidence (≥80%) sections correlate with high implementation success (r > 0.7)

---

## Rollback Plan

If feedback loop causes issues:

1. **Disable auto-detection:**
   - Set config: `ENABLE_AUTO_FEEDBACK=false`
   - Manual feedback capture still works

2. **Disable learning injection:**
   - Set config: `ENABLE_SPEC_LEARNING=false`
   - Spec generation works without past learnings

3. **Revert database:**
   - Run: `003_spec_feedback_loop_rollback.sql`
   - Drops all 6 feedback tables

---

## Future Enhancements (Out of Scope)

1. **ML-based gap prediction** - Train model to predict spec gaps before implementation
2. **Spec diff suggestions** - Auto-generate spec patches from feedback
3. **Cross-project learning** - Share feedback across multiple Vibe instances
4. **Visual spec quality heatmap** - Show which sections are high-risk
5. **A/B testing** - Compare spec variants for quality
6. **Collaborative feedback** - Multiple agents vote on feedback validity

---

## References

- `agents/ideation/spec-generator.ts`: Current spec generation implementation
- `server/services/task-agent/build-agent-orchestrator.ts`: Build agent error handling
- `docs/specs/PHASE4-TASK-01-knowledge-base-system.md`: Knowledge base foundation
- `parent-harness/docs/MEMORY_SYSTEM.md`: Agent memory architecture
- `STRATEGIC_PLAN.md`: Phase 4 objectives

---

**Generated by:** spec_agent
**Model:** Claude Sonnet 4.5
**Date:** 2026-02-08
**Specification Duration:** Comprehensive analysis of existing infrastructure
