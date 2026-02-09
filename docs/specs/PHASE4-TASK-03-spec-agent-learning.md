# PHASE4-TASK-03: Spec Agent Learning from Build Agent Feedback

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Large
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Enable the Spec Agent to learn from Build Agent feedback, improving specification quality over time by analyzing which specs lead to successful implementations vs. those that require multiple clarifications, retries, or Build Agent interventions. This creates a feedback loop where specifications become progressively more accurate, complete, and actionable.

**Problem:** The Spec Agent currently operates in a "write-once" mode with no mechanism to learn from Build Agent execution outcomes. When a Build Agent encounters ambiguous requirements, missing technical details, or unrealistic pass criteria, this valuable feedback is lost. The Spec Agent repeats the same mistakes, producing specs that consistently miss critical implementation details, leading to wasted Build Agent iterations and human intervention.

**Solution:** Implement a bi-directional feedback system where:
1. Build Agents log spec quality issues during execution (missing details, ambiguous requirements, incorrect assumptions)
2. Spec Agent queries this feedback when creating new specifications
3. Common spec deficiencies are captured as learnings in the knowledge base
4. Spec templates and patterns evolve based on validated successful approaches
5. Spec Agent proactively avoids known pitfalls from previous tasks

**Value Proposition:**
- **Reduces Build Iterations:** Better specs → fewer clarification loops → faster delivery
- **Improves Spec Quality:** Specs become more complete and actionable over time
- **Enables Self-Improvement:** System learns from mistakes without human intervention
- **Captures Institutional Knowledge:** Best practices codified in knowledge base
- **Accelerates Onboarding:** New task categories benefit from past learnings

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Spec Agent v0.1** (`agents/specification/`)
   - ✅ Core specification generation
   - ✅ Codebase exploration
   - ✅ Task decomposition
   - ✅ Pass criteria definition
   - ❌ **Gap:** No feedback collection mechanism
   - ❌ **Gap:** No learning storage
   - ❌ **Gap:** No pattern refinement

2. **Build Agent Feedback** (Hypothetical)
   - ❌ **Gap:** Build Agent doesn't log spec quality issues
   - ❌ **Gap:** No spec evaluation during execution
   - ❌ **Gap:** No spec improvement suggestions captured

3. **Knowledge Base System** (`PHASE4-TASK-01`)
   - ✅ Knowledge entries (gotchas, patterns, decisions)
   - ✅ Confidence tracking
   - ✅ Duplicate detection
   - ❌ **Gap:** No spec-specific learnings
   - ❌ **Gap:** No "spec template effectiveness" tracking

4. **Agent Memory System** (`parent-harness/orchestrator/src/memory/index.ts`)
   - ✅ Short-term context
   - ✅ Error pattern learning
   - ✅ Success pattern learning
   - ❌ **Gap:** No cross-task spec quality metrics

5. **SIA Knowledge Writer** (`agents/sia/knowledge-writer.ts`)
   - ✅ Writes gotchas, patterns, decisions
   - ✅ Confidence scoring
   - ✅ Duplicate detection with Jaccard similarity
   - ✅ Memory graph integration
   - ✅ Occurrence counting
   - ❌ **Gap:** Focused on code-level learnings, not spec quality

### Gaps Identified

1. **No Spec Feedback Loop** - Build Agent outcomes not linked to spec quality
2. **No Spec Quality Metrics** - No tracking of which specs lead to success
3. **No Template Evolution** - Spec templates remain static despite learnings
4. **No Requirement Pattern Library** - Common requirements not reused
5. **No Pass Criteria Validation** - No feedback on which criteria are testable
6. **No Ambiguity Detection** - No learning about which phrasings cause confusion
7. **Manual Knowledge Transfer** - Spec improvements require human intervention

---

## Requirements

### Functional Requirements

**FR-1: Build Agent Feedback Collection**
- MUST capture spec quality feedback during Build Agent execution
- MUST record feedback types:
  - **Missing Details**: Required information absent from spec
  - **Ambiguous Requirements**: Multiple valid interpretations
  - **Incorrect Assumptions**: Spec assumes non-existent infrastructure
  - **Unrealistic Pass Criteria**: Criteria not actually testable
  - **Incomplete Dependencies**: Missing upstream/downstream tasks
  - **Poor Decomposition**: Task breakdown too granular or coarse
- MUST link feedback to specific spec sections (Requirements, Technical Design, Pass Criteria)
- MUST track Build Agent clarification requests and their resolutions
- MUST capture successful spec patterns (smooth implementations with no issues)
- SHOULD record time spent on spec-related clarifications

**FR-2: Spec Quality Metrics**
- MUST calculate spec effectiveness score: `success_rate = (successful_builds / total_builds)`
- MUST track metrics per spec:
  - Build attempts required (1 = perfect spec, >3 = poor spec)
  - Clarification requests count
  - Build Agent intervention count (manual fixes)
  - Pass criteria validation rate (% criteria actually testable)
  - Time to completion vs. estimated
- MUST aggregate metrics by spec category (feature, bug, refactor, test)
- MUST identify low-performing spec patterns (effectiveness <50%)
- MUST identify high-performing spec patterns (effectiveness >85%)
- SHOULD track improvement trends over time

**FR-3: Spec Knowledge Base**
- MUST store spec-specific learnings:
  - **Requirement Templates**: Validated requirement patterns by task category
  - **Technical Design Patterns**: Proven architecture descriptions
  - **Pass Criteria Examples**: Testable criteria that worked
  - **Common Pitfalls**: Frequently missed details by category
  - **Decomposition Heuristics**: Rules for breaking down complex tasks
- MUST support query filters: category, file patterns, task complexity
- MUST rank learnings by confidence and occurrences
- MUST deduplicate similar learnings using Jaccard similarity (>0.8)
- SHOULD support promotion to spec templates (high confidence + occurrences)

**FR-4: Feedback Integration in Spec Generation**
- MUST query spec knowledge base before generating new specifications
- MUST retrieve relevant learnings based on:
  - Task category (feature, bug, refactor, test)
  - File patterns (similar modules/components)
  - Complexity (simple vs complex tasks)
  - Keywords in task title/description
- MUST inject relevant learnings into spec sections:
  - "Common Pitfalls" section with category-specific gotchas
  - "Reference Patterns" section with proven approaches
  - Enhanced pass criteria using validated examples
- MUST avoid known spec deficiencies (e.g., "always include auth context for API specs")
- SHOULD suggest similar past specs as references

**FR-5: Template Evolution**
- MUST identify promotion candidates: confidence ≥0.85 AND occurrences ≥5
- MUST generate template update proposals:
  - New requirement sections for common patterns
  - Enhanced technical design templates
  - Improved pass criteria examples
- MUST support approval workflow (pending → approved → rejected)
- MUST update spec templates with approved improvements
- MUST track template version history
- SHOULD support A/B testing (old vs new template effectiveness)

**FR-6: Clarification Loop Integration**
- MUST capture Build Agent clarification requests
- MUST link clarifications to spec sections that triggered them
- MUST record clarification resolutions (answers provided)
- MUST create spec improvement tasks based on clarifications
- MUST prevent recurring clarifications for same issue type
- SHOULD auto-update specs with clarification resolutions

**FR-7: Success Pattern Recognition**
- MUST identify specs that led to first-attempt Build Agent success
- MUST extract common characteristics from successful specs:
  - Requirement phrasing patterns
  - Technical design depth (detail level)
  - Pass criteria specificity
  - Dependency completeness
- MUST boost confidence of patterns from successful specs
- MUST create reusable spec patterns for similar future tasks
- SHOULD recommend spec patterns when similar tasks detected

**FR-8: Integration with Build Agent**
- MUST provide Build Agent with feedback API endpoints:
  - `POST /api/spec-feedback/issue` - Report spec quality issue
  - `POST /api/spec-feedback/clarification` - Request clarification
  - `POST /api/spec-feedback/success` - Report smooth implementation
- MUST emit events when feedback received: `spec:feedback:received`
- MUST update spec quality metrics in real-time
- MUST trigger Spec Agent review for low-quality specs (effectiveness <40%)
- SHOULD notify Spec Agent when recurring issues detected

### Non-Functional Requirements

**NFR-1: Performance**
- Feedback collection MUST NOT block Build Agent execution (async)
- Spec knowledge query MUST complete in <200ms for typical queries
- Spec quality metrics calculation MUST complete in <500ms
- Template evolution analysis MUST run offline (background job)
- Feedback API endpoints MUST respond in <100ms

**NFR-2: Data Integrity**
- Feedback entries MUST be immutable (append-only)
- Spec quality metrics MUST recalculate on new feedback
- Knowledge entries MUST link to source feedback
- Template versions MUST be tracked with checksums
- Confidence updates MUST be atomic

**NFR-3: Observability**
- MUST log all feedback submissions with spec_id, build_id, issue_type
- MUST track spec improvement metrics (effectiveness over time)
- MUST expose metrics endpoint: `/api/spec-metrics`
- MUST emit events: `spec:feedback:*`, `spec:improved`, `template:updated`
- SHOULD track token savings from reusing spec patterns

**NFR-4: Maintainability**
- Feedback types MUST be extensible (easy to add new types)
- Spec templates MUST support version rollback
- Knowledge base MUST support schema migrations
- Confidence formulas MUST be configurable
- MUST support manual feedback overrides

---

## Technical Design

### Architecture

```
Build Agent encounters spec issue
    ↓
POST /api/spec-feedback/issue
    {
      spec_id: "TASK-042",
      section: "Requirements",
      issue_type: "missing_details",
      description: "Auth context not specified for API endpoints",
      severity: "high"
    }
    ↓
Feedback stored in spec_feedback table
    ↓
Spec quality metrics recalculated
    ↓
Low effectiveness detected (<50%)
    ↓
Event emitted: spec:quality:low
    ↓
Spec Agent analyzes feedback patterns
    ↓
Knowledge entry created:
    {
      type: "spec_pitfall",
      category: "feature",
      content: "Always specify auth requirements for API endpoints",
      file_patterns: ["server/routes/*.ts"],
      confidence: 0.7,
      occurrences: 1
    }
    ↓
Future spec generation queries knowledge base
    ↓
Spec Agent includes "Auth Requirements" section proactively
    ↓
Build Agent succeeds on first attempt
    ↓
POST /api/spec-feedback/success
    ↓
Confidence boosted to 0.85
    ↓
After 5 occurrences, promoted to spec template
```

### Database Schema Extensions

**New tables for Parent Harness** (`parent-harness/database/schema.sql`):

```sql
-- ============================================
-- SPEC AGENT LEARNING SYSTEM
-- ============================================

-- Spec Feedback (from Build Agent)
CREATE TABLE IF NOT EXISTS spec_feedback (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL, -- TASK-042
    spec_file_path TEXT NOT NULL,
    build_session_id TEXT, -- Link to Build Agent session
    task_id TEXT REFERENCES tasks(id),
    feedback_type TEXT NOT NULL CHECK(feedback_type IN (
        'missing_details',
        'ambiguous_requirements',
        'incorrect_assumptions',
        'unrealistic_pass_criteria',
        'incomplete_dependencies',
        'poor_decomposition',
        'success'
    )),
    section TEXT, -- "Requirements", "Technical Design", "Pass Criteria"
    description TEXT NOT NULL,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
    resolution TEXT, -- How issue was resolved
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_spec_feedback_spec ON spec_feedback(spec_id);
CREATE INDEX idx_spec_feedback_type ON spec_feedback(feedback_type);
CREATE INDEX idx_spec_feedback_session ON spec_feedback(build_session_id);

-- Spec Quality Metrics
CREATE TABLE IF NOT EXISTS spec_quality_metrics (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL UNIQUE,
    spec_file_path TEXT NOT NULL,
    task_id TEXT REFERENCES tasks(id),
    category TEXT NOT NULL, -- feature, bug, refactor, test

    -- Build outcomes
    build_attempts INTEGER DEFAULT 0,
    successful_builds INTEGER DEFAULT 0,
    failed_builds INTEGER DEFAULT 0,

    -- Feedback counts
    clarification_requests INTEGER DEFAULT 0,
    missing_details_count INTEGER DEFAULT 0,
    ambiguous_requirements_count INTEGER DEFAULT 0,
    incorrect_assumptions_count INTEGER DEFAULT 0,
    unrealistic_criteria_count INTEGER DEFAULT 0,

    -- Calculated metrics
    effectiveness REAL GENERATED ALWAYS AS (
        CASE
            WHEN build_attempts = 0 THEN 0.5
            ELSE CAST(successful_builds AS REAL) / build_attempts
        END
    ) STORED,

    avg_time_to_complete INTEGER, -- seconds
    estimated_time INTEGER, -- seconds (from spec)

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_spec_metrics_effectiveness ON spec_quality_metrics(effectiveness);
CREATE INDEX idx_spec_metrics_category ON spec_quality_metrics(category);

-- Spec Knowledge Entries (spec-specific learnings)
CREATE TABLE IF NOT EXISTS spec_knowledge (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('requirement_template', 'design_pattern', 'pass_criteria_example', 'pitfall', 'decomposition_rule')),
    category TEXT NOT NULL, -- feature, bug, refactor, test
    content TEXT NOT NULL,
    file_patterns TEXT, -- JSON array: ["server/routes/*.ts"]
    task_keywords TEXT, -- JSON array: ["auth", "API", "endpoint"]
    confidence REAL NOT NULL DEFAULT 0.5 CHECK(confidence >= 0.0 AND confidence <= 1.0),
    occurrences INTEGER DEFAULT 1,
    source_feedback_ids TEXT, -- JSON array of feedback IDs
    example_spec_ids TEXT, -- JSON array of successful spec IDs
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT
);

CREATE INDEX idx_spec_knowledge_type ON spec_knowledge(type);
CREATE INDEX idx_spec_knowledge_category ON spec_knowledge(category);
CREATE INDEX idx_spec_knowledge_confidence ON spec_knowledge(confidence);

-- Spec Template Versions
CREATE TABLE IF NOT EXISTS spec_template_versions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL, -- feature, bug, refactor, test
    version INTEGER NOT NULL,
    template_content TEXT NOT NULL,
    improvements TEXT, -- JSON array of improvement descriptions
    based_on_knowledge_ids TEXT, -- JSON array of spec_knowledge IDs
    effectiveness REAL, -- A/B test results
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'deprecated')),
    created_at TEXT DEFAULT (datetime('now')),
    deprecated_at TEXT,
    UNIQUE(category, version)
);

CREATE INDEX idx_template_versions_category ON spec_template_versions(category);
CREATE INDEX idx_template_versions_status ON spec_template_versions(status);

-- Clarification Requests (Build Agent → Spec Agent)
CREATE TABLE IF NOT EXISTS spec_clarifications (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    build_session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    spec_section TEXT, -- Which section triggered clarification
    answer TEXT,
    answered_by TEXT, -- 'spec_agent', 'human', 'clarification_agent'
    answered_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_spec_clarifications_spec ON spec_clarifications(spec_id);
CREATE INDEX idx_spec_clarifications_session ON spec_clarifications(build_session_id);
```

### Core Modules

#### 1. Spec Feedback Collector (`parent-harness/orchestrator/src/spec-learning/feedback-collector.ts`)

```typescript
import { query, run, getOne } from '../db/index.js';
import { v4 as uuid } from 'uuid';

export interface SpecFeedback {
  id: string;
  spec_id: string;
  spec_file_path: string;
  build_session_id?: string;
  task_id?: string;
  feedback_type: 'missing_details' | 'ambiguous_requirements' | 'incorrect_assumptions'
    | 'unrealistic_pass_criteria' | 'incomplete_dependencies' | 'poor_decomposition' | 'success';
  section?: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  resolution?: string;
  resolved_at?: string;
  created_at: string;
}

/**
 * Record spec quality issue from Build Agent
 */
export function recordSpecIssue(params: {
  specId: string;
  specFilePath: string;
  buildSessionId?: string;
  taskId?: string;
  feedbackType: SpecFeedback['feedback_type'];
  section?: string;
  description: string;
  severity?: SpecFeedback['severity'];
}): SpecFeedback {
  const id = uuid();
  const now = new Date().toISOString();

  const feedback: SpecFeedback = {
    id,
    spec_id: params.specId,
    spec_file_path: params.specFilePath,
    build_session_id: params.buildSessionId,
    task_id: params.taskId,
    feedback_type: params.feedbackType,
    section: params.section,
    description: params.description,
    severity: params.severity || 'medium',
    created_at: now,
  };

  run(`
    INSERT INTO spec_feedback
    (id, spec_id, spec_file_path, build_session_id, task_id, feedback_type, section, description, severity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    feedback.id,
    feedback.spec_id,
    feedback.spec_file_path,
    feedback.build_session_id,
    feedback.task_id,
    feedback.feedback_type,
    feedback.section,
    feedback.description,
    feedback.severity,
    feedback.created_at,
  ]);

  // Update spec quality metrics
  updateSpecMetrics(params.specId, params.feedbackType);

  // Emit event
  emitEvent('spec:feedback:received', feedback);

  console.log(`[SpecFeedback] Recorded ${params.feedbackType} for ${params.specId}`);

  return feedback;
}

/**
 * Record successful spec execution
 */
export function recordSpecSuccess(params: {
  specId: string;
  specFilePath: string;
  buildSessionId: string;
  taskId: string;
  timeToComplete: number;
}): void {
  recordSpecIssue({
    specId: params.specId,
    specFilePath: params.specFilePath,
    buildSessionId: params.buildSessionId,
    taskId: params.taskId,
    feedbackType: 'success',
    description: `Build completed successfully in ${params.timeToComplete}s`,
    severity: 'low',
  });
}

/**
 * Record clarification request
 */
export function recordClarificationRequest(params: {
  specId: string;
  buildSessionId: string;
  question: string;
  specSection?: string;
}): string {
  const id = uuid();
  const now = new Date().toISOString();

  run(`
    INSERT INTO spec_clarifications
    (id, spec_id, build_session_id, question, spec_section, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, params.specId, params.buildSessionId, params.question, params.specSection, now]);

  // Also record as feedback
  recordSpecIssue({
    specId: params.specId,
    specFilePath: '', // Build Agent should provide
    buildSessionId: params.buildSessionId,
    feedbackType: 'ambiguous_requirements',
    section: params.specSection,
    description: `Clarification needed: ${params.question}`,
    severity: 'medium',
  });

  return id;
}

/**
 * Resolve clarification with answer
 */
export function resolveClarification(
  clarificationId: string,
  answer: string,
  answeredBy: string
): void {
  const now = new Date().toISOString();

  run(`
    UPDATE spec_clarifications
    SET answer = ?, answered_by = ?, answered_at = ?
    WHERE id = ?
  `, [answer, answeredBy, now, clarificationId]);
}

/**
 * Update spec quality metrics based on feedback
 */
function updateSpecMetrics(specId: string, feedbackType: SpecFeedback['feedback_type']): void {
  // Ensure metrics record exists
  const existing = getOne(`SELECT * FROM spec_quality_metrics WHERE spec_id = ?`, [specId]);

  if (!existing) {
    // Create initial metrics record
    run(`
      INSERT INTO spec_quality_metrics
      (id, spec_id, spec_file_path, task_id, category, created_at, updated_at)
      SELECT ?, spec_id, spec_file_path, task_id, 'feature', datetime('now'), datetime('now')
      FROM spec_feedback WHERE spec_id = ? LIMIT 1
    `, [uuid(), specId]);
  }

  // Increment appropriate counter
  const fieldMap: Record<string, string> = {
    missing_details: 'missing_details_count',
    ambiguous_requirements: 'ambiguous_requirements_count',
    incorrect_assumptions: 'incorrect_assumptions_count',
    unrealistic_pass_criteria: 'unrealistic_criteria_count',
    success: 'successful_builds',
  };

  const field = fieldMap[feedbackType];
  if (field) {
    run(`
      UPDATE spec_quality_metrics
      SET ${field} = ${field} + 1,
          build_attempts = build_attempts + 1,
          updated_at = datetime('now')
      WHERE spec_id = ?
    `, [specId]);
  }

  // Check if effectiveness is low and emit event
  const metrics = getOne<{ effectiveness: number }>(`
    SELECT effectiveness FROM spec_quality_metrics WHERE spec_id = ?
  `, [specId]);

  if (metrics && metrics.effectiveness < 0.4) {
    emitEvent('spec:quality:low', { spec_id: specId, effectiveness: metrics.effectiveness });
  }
}

function emitEvent(type: string, data: any): void {
  // WebSocket broadcast logic (integrate with existing WebSocket system)
  console.log(`[Event] ${type}`, data);
}
```

#### 2. Spec Knowledge Analyzer (`parent-harness/orchestrator/src/spec-learning/knowledge-analyzer.ts`)

```typescript
import { query, run, getOne } from '../db/index.js';
import { v4 as uuid } from 'uuid';

export interface SpecKnowledge {
  id: string;
  type: 'requirement_template' | 'design_pattern' | 'pass_criteria_example' | 'pitfall' | 'decomposition_rule';
  category: string;
  content: string;
  file_patterns: string[];
  task_keywords: string[];
  confidence: number;
  occurrences: number;
  source_feedback_ids: string[];
  example_spec_ids: string[];
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

/**
 * Analyze feedback patterns and extract learnings
 */
export function analyzeSpecFeedback(): void {
  console.log('[SpecKnowledgeAnalyzer] Analyzing spec feedback patterns...');

  // Find recurring issues (same feedback_type, similar description, ≥3 occurrences)
  const recurringIssues = query<{
    feedback_type: string;
    section: string;
    count: number;
    example_descriptions: string;
  }>(`
    SELECT
      feedback_type,
      section,
      COUNT(*) as count,
      GROUP_CONCAT(description, ' | ') as example_descriptions
    FROM spec_feedback
    WHERE feedback_type != 'success'
    GROUP BY feedback_type, section
    HAVING count >= 3
    ORDER BY count DESC
  `);

  for (const issue of recurringIssues) {
    createPitfallKnowledge(issue);
  }

  // Find successful spec patterns (effectiveness ≥0.85, ≥3 builds)
  const successfulSpecs = query<{
    spec_id: string;
    spec_file_path: string;
    category: string;
    effectiveness: number;
    build_attempts: number;
  }>(`
    SELECT * FROM spec_quality_metrics
    WHERE effectiveness >= 0.85 AND build_attempts >= 3
    ORDER BY effectiveness DESC, build_attempts DESC
  `);

  for (const spec of successfulSpecs) {
    extractSuccessPatterns(spec);
  }

  console.log('[SpecKnowledgeAnalyzer] Analysis complete.');
}

/**
 * Create pitfall knowledge from recurring issue
 */
function createPitfallKnowledge(issue: {
  feedback_type: string;
  section: string;
  count: number;
  example_descriptions: string;
}): void {
  const content = `Common pitfall in ${issue.section}: ${issue.feedback_type.replace(/_/g, ' ')}. Examples: ${issue.example_descriptions}`;

  // Check for duplicate
  const existing = query<SpecKnowledge>(`
    SELECT * FROM spec_knowledge
    WHERE type = 'pitfall' AND content LIKE ?
  `, [`%${issue.feedback_type}%${issue.section}%`]);

  if (existing.length > 0) {
    // Update confidence and occurrences
    const entry = existing[0];
    const newConfidence = Math.min(0.95, entry.confidence + 0.05);
    const newOccurrences = entry.occurrences + issue.count;

    run(`
      UPDATE spec_knowledge
      SET confidence = ?, occurrences = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [newConfidence, newOccurrences, entry.id]);

    console.log(`[SpecKnowledge] Updated pitfall: ${entry.id} (conf=${newConfidence})`);
  } else {
    // Create new entry
    const id = uuid();
    run(`
      INSERT INTO spec_knowledge
      (id, type, category, content, confidence, occurrences, created_at, updated_at)
      VALUES (?, 'pitfall', 'general', ?, 0.6, ?, datetime('now'), datetime('now'))
    `, [id, content, issue.count]);

    console.log(`[SpecKnowledge] Created pitfall: ${id}`);
  }
}

/**
 * Extract success patterns from high-performing spec
 */
function extractSuccessPatterns(spec: {
  spec_id: string;
  spec_file_path: string;
  category: string;
  effectiveness: number;
}): void {
  // TODO: Read spec file, extract patterns using LLM
  // For now, just record as example
  console.log(`[SpecKnowledge] Successful spec pattern: ${spec.spec_id} (${spec.effectiveness})`);
}

/**
 * Get relevant knowledge for new spec generation
 */
export function getRelevantSpecKnowledge(params: {
  category: string;
  filePatterns?: string[];
  keywords?: string[];
}): SpecKnowledge[] {
  let sql = `
    SELECT * FROM spec_knowledge
    WHERE category = ? AND confidence >= 0.5
  `;
  const args: any[] = [params.category];

  // Filter by file patterns if provided
  if (params.filePatterns && params.filePatterns.length > 0) {
    sql += ` AND (`;
    const fileConditions = params.filePatterns.map(() => `file_patterns LIKE ?`).join(' OR ');
    sql += fileConditions + `)`;
    params.filePatterns.forEach(pattern => args.push(`%${pattern}%`));
  }

  sql += ` ORDER BY confidence DESC, occurrences DESC LIMIT 10`;

  return query<SpecKnowledge>(sql, args);
}
```

#### 3. Spec Template Evolver (`parent-harness/orchestrator/src/spec-learning/template-evolver.ts`)

```typescript
import { query, run } from '../db/index.js';
import { v4 as uuid } from 'uuid';

/**
 * Identify template promotion candidates
 */
export function identifyPromotionCandidates(): void {
  const candidates = query<{
    id: string;
    type: string;
    category: string;
    content: string;
    confidence: number;
    occurrences: number;
  }>(`
    SELECT * FROM spec_knowledge
    WHERE confidence >= 0.85 AND occurrences >= 5
    ORDER BY confidence DESC, occurrences DESC
  `);

  console.log(`[TemplateEvolver] Found ${candidates.length} promotion candidates`);

  for (const candidate of candidates) {
    proposeTemplateUpdate(candidate);
  }
}

/**
 * Propose template update based on knowledge
 */
function proposeTemplateUpdate(knowledge: {
  id: string;
  type: string;
  category: string;
  content: string;
  confidence: number;
  occurrences: number;
}): void {
  // Get current template version
  const currentTemplate = query<{ version: number; template_content: string }>(`
    SELECT * FROM spec_template_versions
    WHERE category = ? AND status = 'active'
    ORDER BY version DESC LIMIT 1
  `, [knowledge.category]);

  const nextVersion = currentTemplate.length > 0 ? currentTemplate[0].version + 1 : 1;

  // Generate improved template (simplified - in reality, use LLM)
  const improvedTemplate = currentTemplate.length > 0
    ? currentTemplate[0].template_content + `\n\n## Common Pitfalls\n${knowledge.content}`
    : `## Overview\n...\n\n## Common Pitfalls\n${knowledge.content}`;

  // Create new template version
  const id = uuid();
  run(`
    INSERT INTO spec_template_versions
    (id, category, version, template_content, improvements, based_on_knowledge_ids, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', datetime('now'))
  `, [
    id,
    knowledge.category,
    nextVersion,
    improvedTemplate,
    JSON.stringify([`Added pitfall: ${knowledge.content}`]),
    JSON.stringify([knowledge.id]),
  ]);

  console.log(`[TemplateEvolver] Proposed v${nextVersion} for ${knowledge.category}`);
}

/**
 * Approve template update
 */
export function approveTemplateUpdate(templateId: string): void {
  // Deprecate old active template
  const template = query<{ category: string }>(`SELECT category FROM spec_template_versions WHERE id = ?`, [templateId])[0];

  run(`
    UPDATE spec_template_versions
    SET status = 'deprecated', deprecated_at = datetime('now')
    WHERE category = ? AND status = 'active'
  `, [template.category]);

  // Activate new template
  run(`
    UPDATE spec_template_versions
    SET status = 'active'
    WHERE id = ?
  `, [templateId]);

  console.log(`[TemplateEvolver] Approved template: ${templateId}`);
}
```

#### 4. API Endpoints (`parent-harness/orchestrator/src/api/spec-feedback.ts`)

```typescript
import { Router } from 'express';
import { recordSpecIssue, recordSpecSuccess, recordClarificationRequest, resolveClarification } from '../spec-learning/feedback-collector.js';
import { getRelevantSpecKnowledge } from '../spec-learning/knowledge-analyzer.js';

export const specFeedbackRouter = Router();

/**
 * POST /api/spec-feedback/issue - Report spec quality issue
 */
specFeedbackRouter.post('/issue', (req, res) => {
  const { specId, specFilePath, buildSessionId, taskId, feedbackType, section, description, severity } = req.body;

  const feedback = recordSpecIssue({
    specId,
    specFilePath,
    buildSessionId,
    taskId,
    feedbackType,
    section,
    description,
    severity,
  });

  res.json(feedback);
});

/**
 * POST /api/spec-feedback/success - Report successful implementation
 */
specFeedbackRouter.post('/success', (req, res) => {
  const { specId, specFilePath, buildSessionId, taskId, timeToComplete } = req.body;

  recordSpecSuccess({
    specId,
    specFilePath,
    buildSessionId,
    taskId,
    timeToComplete,
  });

  res.json({ message: 'Success recorded' });
});

/**
 * POST /api/spec-feedback/clarification - Request clarification
 */
specFeedbackRouter.post('/clarification', (req, res) => {
  const { specId, buildSessionId, question, specSection } = req.body;

  const clarificationId = recordClarificationRequest({
    specId,
    buildSessionId,
    question,
    specSection,
  });

  res.json({ clarification_id: clarificationId });
});

/**
 * GET /api/spec-knowledge/relevant - Get relevant knowledge for spec
 */
specFeedbackRouter.get('/knowledge/relevant', (req, res) => {
  const { category, filePatterns, keywords } = req.query;

  const knowledge = getRelevantSpecKnowledge({
    category: category as string,
    filePatterns: filePatterns ? (filePatterns as string).split(',') : undefined,
    keywords: keywords ? (keywords as string).split(',') : undefined,
  });

  res.json({ knowledge, count: knowledge.length });
});
```

### Integration Points

#### 1. Spec Agent Integration

When generating new specs, Spec Agent queries knowledge base:

```typescript
// In agents/specification/core.ts
import { getRelevantSpecKnowledge } from '../spec-learning/knowledge-analyzer.js';

export async function generateSpecification(task: Task): Promise<void> {
  // Get relevant learnings
  const knowledge = getRelevantSpecKnowledge({
    category: task.category,
    filePatterns: extractFilePatterns(task),
    keywords: extractKeywords(task.title + ' ' + task.description),
  });

  // Inject learnings into spec generation context
  const specContext = {
    task,
    relevant_pitfalls: knowledge.filter(k => k.type === 'pitfall'),
    requirement_templates: knowledge.filter(k => k.type === 'requirement_template'),
    pass_criteria_examples: knowledge.filter(k => k.type === 'pass_criteria_example'),
  };

  // Generate spec with enriched context
  const spec = await generateSpecWithContext(specContext);

  // Write spec to file
  await writeSpec(spec);
}
```

#### 2. Build Agent Integration

Build Agent reports feedback during execution:

```typescript
// In Build Agent execution loop
if (specSectionAmbiguous) {
  await fetch('http://localhost:3333/api/spec-feedback/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      specId: task.display_id,
      specFilePath: task.spec_file_path,
      buildSessionId: session.id,
      taskId: task.id,
      feedbackType: 'ambiguous_requirements',
      section: 'Requirements',
      description: 'Auth context not specified for API endpoints',
      severity: 'high',
    }),
  });
}
```

#### 3. Orchestrator Cron Job

Periodic analysis of feedback patterns:

```typescript
// In parent-harness/orchestrator/src/orchestrator/index.ts
setInterval(() => {
  analyzeSpecFeedback(); // Extract learnings
  identifyPromotionCandidates(); // Find template updates
}, 60 * 60 * 1000); // Every hour
```

---

## Pass Criteria

### Database & Schema
1. ✅ **Tables created** - spec_feedback, spec_quality_metrics, spec_knowledge, spec_template_versions, spec_clarifications
2. ✅ **Indexes created** - All performance-critical indexes present
3. ✅ **Constraints valid** - CHECK constraints, foreign keys, computed columns
4. ✅ **Migration tested** - Schema applies cleanly

### Feedback Collection
5. ✅ **Issue recording works** - `POST /api/spec-feedback/issue` creates entries
6. ✅ **Success recording works** - `POST /api/spec-feedback/success` updates metrics
7. ✅ **Clarification requests work** - `POST /api/spec-feedback/clarification` creates entries
8. ✅ **Metrics calculation** - spec_quality_metrics.effectiveness computed correctly

### Knowledge Extraction
9. ✅ **Pattern analysis works** - Recurring issues detected (≥3 occurrences)
10. ✅ **Pitfall knowledge created** - spec_knowledge entries created from feedback
11. ✅ **Success patterns extracted** - High-performing specs analyzed
12. ✅ **Duplicate prevention** - Similar learnings merged, not duplicated

### Spec Generation Integration
13. ✅ **Knowledge query works** - `GET /api/spec-knowledge/relevant` returns learnings
14. ✅ **Spec Agent uses knowledge** - Relevant pitfalls injected into new specs
15. ✅ **Template evolution** - Promotion candidates identified (conf≥0.85, occ≥5)
16. ✅ **Template updates** - New versions created and approved

### End-to-End Flow
17. ✅ **Feedback → Learning** - Issue reported → pattern detected → knowledge created
18. ✅ **Learning → Improvement** - Knowledge → injected into spec → better outcome
19. ✅ **Metrics tracking** - Effectiveness improves over time (measurable trend)
20. ✅ **Event emission** - `spec:feedback:received`, `spec:quality:low` events broadcast

### Performance
21. ✅ **Feedback API <100ms** - POST endpoints respond quickly
22. ✅ **Knowledge query <200ms** - Relevant knowledge retrieved fast
23. ✅ **Metrics update <500ms** - Recalculation doesn't block
24. ✅ **No blocking** - Feedback collection is async, doesn't block Build Agent

### Testing
25. ✅ **Unit tests pass** - All modules tested in isolation
26. ✅ **Integration test** - Full flow: issue → analysis → knowledge → reuse
27. ✅ **Load test** - System handles 100+ feedback entries

---

## Dependencies

**Upstream (Must Complete First):**
- ✅ PHASE4-TASK-01: Knowledge Base System (provides infrastructure)
- ✅ PHASE2-TASK-01: Spec Agent v0.1 (must exist to improve)
- ⚠️ Build Agent v0.1 (must generate feedback - hypothetical)

**Downstream (Depends on This):**
- PHASE6-TASK-01: Self-improvement loop (uses spec learnings)
- PHASE8-TASK-02: Spec approval workflow (enhanced with quality metrics)

**Parallel Work:**
- PHASE4-TASK-02: Planning Agent (uses different learning system)
- PHASE5-TASK-03: QA Agent validation (can validate spec quality)

---

## Implementation Plan

### Phase 1: Database Schema & Feedback Collection (4 hours)
1. Create migration: `003_spec_learning.sql`
2. Define all 5 tables with indexes
3. Implement feedback-collector.ts
4. Create API endpoints for feedback
5. Test feedback recording

### Phase 2: Knowledge Analysis (5 hours)
6. Implement knowledge-analyzer.ts
7. Implement recurring pattern detection
8. Implement success pattern extraction
9. Add knowledge deduplication
10. Test analysis logic

### Phase 3: Spec Agent Integration (4 hours)
11. Add knowledge query to Spec Agent workflow
12. Inject pitfalls into spec generation
13. Add requirement template reuse
14. Add pass criteria examples
15. Test improved spec quality

### Phase 4: Template Evolution (3 hours)
16. Implement template-evolver.ts
17. Add promotion candidate detection
18. Create template version management
19. Implement approval workflow
20. Test template updates

### Phase 5: Build Agent Integration (3 hours)
21. Add feedback reporting to Build Agent (hypothetical)
22. Implement clarification request flow
23. Test feedback → knowledge → improvement cycle
24. Validate metrics tracking

### Phase 6: Testing & Metrics (3 hours)
25. Write unit tests
26. Write integration tests
27. Load test with 100+ feedback entries
28. Document API endpoints
29. Set up monitoring dashboards

**Total Estimated Effort:** 22 hours (~3 days)

---

## Testing Strategy

### Unit Tests

```typescript
// spec-learning/feedback-collector.test.ts
describe('Spec Feedback Collector', () => {
  test('records spec issue', () => {
    const feedback = recordSpecIssue({
      specId: 'TASK-042',
      specFilePath: 'docs/specs/TASK-042.md',
      feedbackType: 'missing_details',
      section: 'Requirements',
      description: 'Auth context not specified',
      severity: 'high',
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.feedback_type).toBe('missing_details');
  });

  test('updates spec metrics on feedback', () => {
    recordSpecIssue({ specId: 'TASK-042', ... });

    const metrics = query(`SELECT * FROM spec_quality_metrics WHERE spec_id = 'TASK-042'`);
    expect(metrics[0].missing_details_count).toBe(1);
    expect(metrics[0].build_attempts).toBe(1);
  });
});

// spec-learning/knowledge-analyzer.test.ts
describe('Spec Knowledge Analyzer', () => {
  test('detects recurring issues', () => {
    // Create 3+ similar feedback entries
    recordSpecIssue({ feedbackType: 'missing_details', section: 'Requirements', ... });
    recordSpecIssue({ feedbackType: 'missing_details', section: 'Requirements', ... });
    recordSpecIssue({ feedbackType: 'missing_details', section: 'Requirements', ... });

    analyzeSpecFeedback();

    const knowledge = query(`SELECT * FROM spec_knowledge WHERE type = 'pitfall'`);
    expect(knowledge.length).toBeGreaterThan(0);
    expect(knowledge[0].occurrences).toBeGreaterThanOrEqual(3);
  });

  test('extracts success patterns', () => {
    // Create high-performing spec metrics
    run(`INSERT INTO spec_quality_metrics (spec_id, effectiveness, build_attempts) VALUES ('TASK-001', 0.9, 5)`);

    analyzeSpecFeedback();

    // Verify pattern extracted (implementation-specific)
  });
});
```

### Integration Tests

```typescript
// integration/spec-learning-flow.test.ts
describe('Spec Learning Integration', () => {
  test('complete feedback → learning → improvement cycle', async () => {
    // 1. Build Agent reports issue
    const feedback = recordSpecIssue({
      specId: 'TASK-042',
      feedbackType: 'missing_details',
      section: 'Requirements',
      description: 'Auth context not specified for API endpoints',
    });

    // 2. Feedback triggers analysis
    analyzeSpecFeedback();

    // 3. Knowledge created
    const knowledge = getRelevantSpecKnowledge({ category: 'feature' });
    expect(knowledge).toContainEqual(expect.objectContaining({
      type: 'pitfall',
      content: expect.stringContaining('Auth context'),
    }));

    // 4. Next spec generation uses knowledge
    const newTask = { title: 'Create new API endpoint', category: 'feature' };
    const spec = await generateSpecification(newTask);
    expect(spec).toContain('Auth Requirements');
    expect(spec).toContain('Auth context');

    // 5. Build Agent succeeds without issue
    recordSpecSuccess({ specId: 'TASK-043', ... });

    // 6. Knowledge confidence boosted
    const updated = query(`SELECT confidence FROM spec_knowledge WHERE content LIKE '%Auth context%'`)[0];
    expect(updated.confidence).toBeGreaterThan(0.7);
  });
});
```

### Manual Testing

1. **Feedback Collection:**
   - Manually POST issue → verify database entry
   - Check metrics updated correctly
   - Verify WebSocket event emitted

2. **Knowledge Extraction:**
   - Create 5 similar issues → run analysis → verify knowledge created
   - Create high-performing spec → verify success pattern extracted

3. **Spec Generation:**
   - Create new task → verify relevant knowledge retrieved
   - Check spec includes pitfalls section
   - Verify spec quality improves

4. **Template Evolution:**
   - Get knowledge to confidence≥0.85, occurrences≥5 → verify promotion candidate
   - Approve template → verify new version active

---

## Success Metrics

**Operational:**
- Spec knowledge base contains 20+ learnings after 50 specs
- 90%+ of recurring issues captured as pitfalls
- Spec effectiveness improves 20% over 3 months
- Template updates approved every 2 weeks

**Quality:**
- Build Agent clarification requests reduce by 40%
- First-attempt build success rate increases from 40% → 65%
- Spec generation includes relevant learnings 80%+ of time
- Template evolution accuracy: 80%+ of promoted patterns useful

**Performance:**
- Feedback API latency <100ms (p99)
- Knowledge query latency <200ms (p99)
- Analysis job completes in <5 minutes (100+ specs)

---

## Open Questions

1. **Manual vs Automatic Template Approval?**
   - Auto-approve low-risk updates (pitfall additions)?
   - Manual review for major template changes?
   - **Recommendation:** Manual approval initially, auto-approve after validation period

2. **Feedback Severity Thresholds?**
   - Should low-severity issues trigger knowledge creation?
   - **Recommendation:** Only high/critical for immediate action, all severity for analysis

3. **Knowledge Pruning Strategy?**
   - Archive low-confidence, unused learnings?
   - **Recommendation:** Deprecate if confidence <0.3 after 6 months

---

## References

- `PHASE4-TASK-01-knowledge-base-system.md`: Core knowledge infrastructure
- `PHASE2-TASK-01-spec-agent-v0.1.md`: Spec Agent architecture
- `agents/sia/knowledge-writer.ts`: Existing knowledge writer patterns
- `STRATEGIC_PLAN.md`: Phase 4 learning system requirements

---

TASK_COMPLETE: Specification written to docs/specs/PHASE4-TASK-03-spec-agent-learning.md
