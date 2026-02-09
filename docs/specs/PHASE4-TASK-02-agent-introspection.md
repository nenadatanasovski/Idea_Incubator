# PHASE4-TASK-02: Agent Introspection Capability

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Medium (7 hours / 1 day)
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Enable agents to review their own past sessions to learn from previous work, avoid repeating mistakes, and improve decision-making through historical context. This task implements the agent-facing integration layer on top of the existing 100% complete infrastructure (sessions API, memory system, self-improvement system).

**Problem:** The parent harness has comprehensive session tracking (`agent_sessions`, `iteration_logs` tables) and memory systems (`agent_memory` table), but agents cannot practically access this data. There's no agent-optimized API for querying past sessions, no automatic injection of relevant history into prompts, and no documentation for agents on introspection capabilities. Agents operate without awareness of their own past experiences.

**Solution:** Create an introspection API layer that:
1. Provides agent-friendly endpoints for querying past sessions
2. Automatically injects relevant session history into agent prompts
3. Scores session relevance based on task similarity
4. Documents introspection capabilities for agent consumption
5. Bridges existing infrastructure with agent workflows

**Key Insight:** This is NOT about building new infrastructure—it's about making existing session/memory data accessible and useful to agents through a thoughtful integration layer.

---

## Current State Analysis

### Existing Infrastructure ✅ (100% Complete)

1. **Sessions Database** (`parent-harness/orchestrator/src/db/sessions.ts`)
   - ✅ `agent_sessions` table: agent_id, task_id, status, timestamps, metadata, output
   - ✅ `iteration_logs` table: detailed iteration history, tool calls, errors
   - ✅ Functions: `getSessions()`, `getSession()`, `getSessionWithIterations()`
   - ✅ Filters: agentId, taskId, status, limit, offset
   - ✅ Session lifecycle: create, update status, log iterations

2. **Sessions API** (`parent-harness/orchestrator/src/api/sessions.ts`)
   - ✅ `GET /api/sessions` - List sessions with filters
   - ✅ `GET /api/sessions/:id` - Get single session with iterations
   - ✅ `GET /api/sessions/:id/iterations` - Get iteration logs
   - ✅ `POST /api/sessions` - Create session
   - ✅ `PATCH /api/sessions/:id` - Update session status
   - ✅ `POST /api/sessions/:id/terminate` - Terminate session

3. **Agent Memory System** (`parent-harness/orchestrator/src/memory/index.ts`)
   - ✅ `agent_memory` table: per-agent persistent memory
   - ✅ Types: context, learning, preference, error_pattern, success_pattern
   - ✅ Functions: `remember()`, `recall()`, `recallAll()`, `learnSuccess()`, `learnError()`
   - ✅ Access tracking, importance scoring, TTL support

4. **Self-Improvement System** (`parent-harness/orchestrator/src/self-improvement/index.ts`)
   - ✅ `task_retry_attempts` table: retry history tracking
   - ✅ Error pattern analysis (TypeScript, test, build, timeout errors)
   - ✅ Fix approach generation based on error type + previous attempts
   - ✅ Functions: `recordRetry()`, `analyzeFailure()`, `getRetryHistory()`

### Gaps Identified ❌ (30% Complete)

1. **Introspection API Endpoint**
   - ❌ No `/api/introspection/:agentId/sessions` endpoint
   - ❌ No session relevance scoring for task similarity
   - ❌ No agent-optimized response format (too much raw data)
   - ❌ No filtering by "similar tasks" (only exact agentId match)

2. **Prompt Integration**
   - ❌ No `buildAgentPrompt()` function (specified in MEMORY_SYSTEM.md but not implemented)
   - ❌ No automatic injection of relevant sessions into spawner
   - ❌ Memory system exists but not wired to agent spawn process

3. **Agent Documentation**
   - ❌ No CLAUDE.md guidance for agents on introspection usage
   - ❌ No examples of API queries or response formats
   - ❌ Agents unaware of introspection capability

---

## Requirements

### Functional Requirements

**FR-1: Introspection API Endpoint**
- MUST provide `GET /api/introspection/:agentId` endpoint
- MUST return sessions filtered by agent ID with relevance scoring
- MUST support query parameters:
  - `taskSignature` (string): Hash of task characteristics for similarity matching
  - `limit` (number, default: 10): Max sessions to return
  - `minRelevance` (number, 0.0-1.0, default: 0.5): Minimum relevance threshold
  - `includeIterations` (boolean, default: false): Include iteration logs
- MUST rank sessions by relevance to current task
- MUST return agent-friendly format (see Response Format section)
- MUST filter out sessions with status 'failed' or 'terminated' by default (unless explicitly requested)

**FR-2: Session Relevance Scoring**
- MUST calculate relevance score (0.0-1.0) based on:
  - Task signature match (0.5 weight): hash-based similarity
  - Recency (0.3 weight): recent sessions score higher
  - Success rate (0.2 weight): completed sessions score higher
- MUST normalize scores to 0.0-1.0 range
- SHOULD handle missing task signatures gracefully (use recency + success only)

**FR-3: Prompt Integration**
- MUST implement `buildAgentPrompt()` function in new module `memory/prompt-builder.ts`
- MUST inject top 5 relevant sessions into agent system prompt
- MUST format sessions as concise summaries (not full iteration logs)
- MUST integrate with spawner to automatically enhance prompts when task is provided
- SHOULD include memory entries (error patterns, success patterns) alongside sessions

**FR-4: Agent Documentation**
- MUST create `parent-harness/orchestrator/src/agents/CLAUDE.md`
- MUST document introspection API with examples
- MUST explain when to use introspection (similar tasks, error recovery)
- MUST show response format with sample data

**FR-5: Task Signature Generation**
- MUST generate task signature from: title (normalized) + category + file patterns
- MUST use SHA-256 hash for deterministic matching
- MUST store task signature in `tasks` table metadata or new `task_signatures` column
- SHOULD handle missing task metadata gracefully (generate from title only)

### Non-Functional Requirements

**NFR-1: Performance**
- Introspection API MUST respond in <200ms for typical queries (10-50 sessions)
- Relevance scoring MUST complete in <100ms per session
- Prompt building MUST NOT block agent spawn (async)
- MUST support 100+ historical sessions per agent without degradation

**NFR-2: Data Privacy**
- Agents MUST only access their own sessions (enforce agent_id filter)
- MUST NOT expose sessions from other agents (security boundary)
- MUST NOT include sensitive data in prompts (filter credentials, API keys)

**NFR-3: Observability**
- MUST log introspection queries with agent_id, task_signature, results_count
- SHOULD emit event: `introspection:query` with query metadata
- SHOULD track metrics: queries per agent, average relevance scores

**NFR-4: Backward Compatibility**
- MUST NOT modify existing `/api/sessions` endpoints
- MUST NOT change `agent_sessions` or `iteration_logs` table schemas
- New introspection API is additive only

---

## Technical Design

### 1. Introspection API Module

**File:** `parent-harness/orchestrator/src/api/introspection.ts`

```typescript
import { Router } from 'express';
import * as sessions from '../db/sessions.js';
import { calculateRelevance, TaskSignature } from '../introspection/relevance.js';

export const introspectionRouter = Router();

/**
 * GET /api/introspection/:agentId
 * Get relevant past sessions for an agent
 */
introspectionRouter.get('/:agentId', (req, res) => {
  const { agentId } = req.params;
  const {
    taskSignature,
    limit = 10,
    minRelevance = 0.5,
    includeIterations = false,
    includeFailures = false,
  } = req.query;

  // Get all sessions for this agent
  const allSessions = sessions.getSessions({
    agentId,
    limit: 100, // Pre-filter to reduce scoring overhead
  });

  // Filter by status (exclude failures unless requested)
  let filtered = allSessions;
  if (!includeFailures) {
    filtered = allSessions.filter(s => s.status === 'completed');
  }

  // Calculate relevance scores
  const scored = filtered.map(session => {
    const relevance = calculateRelevance(session, {
      taskSignature: taskSignature as string | undefined,
      currentTime: Date.now(),
    });
    return { session, relevance };
  });

  // Filter by minimum relevance
  const relevant = scored.filter(s => s.relevance >= parseFloat(minRelevance as string));

  // Sort by relevance (highest first)
  relevant.sort((a, b) => b.relevance - a.relevance);

  // Limit results
  const top = relevant.slice(0, parseInt(limit as string, 10));

  // Format response
  const results = top.map(({ session, relevance }) => ({
    session_id: session.id,
    task_id: session.task_id,
    status: session.status,
    started_at: session.started_at,
    completed_at: session.completed_at,
    relevance_score: relevance,
    summary: extractSummary(session),
    iterations: includeIterations === 'true'
      ? sessions.getSessionIterations(session.id)
      : undefined,
  }));

  res.json({
    agent_id: agentId,
    query: { taskSignature, limit, minRelevance },
    count: results.length,
    sessions: results,
  });
});

/**
 * Extract concise summary from session
 */
function extractSummary(session: sessions.AgentSession): string {
  // Parse output from metadata
  let output = session.output || '';

  // Try to extract from metadata if output is empty
  if (!output && session.metadata) {
    try {
      const meta = JSON.parse(session.metadata);
      output = meta.output || meta.result || '';
    } catch {}
  }

  // Truncate to first 200 chars
  if (output.length > 200) {
    return output.substring(0, 197) + '...';
  }
  return output;
}
```

### 2. Relevance Scoring Module

**File:** `parent-harness/orchestrator/src/introspection/relevance.ts`

```typescript
import crypto from 'crypto';
import * as sessions from '../db/sessions.js';

export interface TaskSignature {
  hash: string;
  title: string;
  category?: string;
  filePatterns?: string[];
}

/**
 * Generate task signature hash
 */
export function generateTaskSignature(task: {
  title: string;
  category?: string;
  filePatterns?: string[];
}): TaskSignature {
  const titleNorm = task.title.toLowerCase().trim();
  const category = task.category || 'general';
  const patterns = (task.filePatterns || []).sort().join(',');

  const hashInput = `${titleNorm}|${category}|${patterns}`;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  return { hash, title: titleNorm, category, filePatterns: task.filePatterns };
}

/**
 * Calculate relevance score (0.0-1.0) for a session
 */
export function calculateRelevance(
  session: sessions.AgentSession,
  context: {
    taskSignature?: string;
    currentTime: number;
  }
): number {
  let score = 0.0;

  // 1. Task signature match (0.5 weight)
  if (context.taskSignature && session.metadata) {
    try {
      const metadata = JSON.parse(session.metadata);
      const sessionSignature = metadata.task_signature;

      if (sessionSignature === context.taskSignature) {
        score += 0.5; // Exact match
      } else if (sessionSignature && taskSignaturesSimilar(sessionSignature, context.taskSignature)) {
        score += 0.3; // Partial match
      }
    } catch {}
  }

  // 2. Recency (0.3 weight)
  const sessionTime = new Date(session.started_at).getTime();
  const ageMs = context.currentTime - sessionTime;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Exponential decay: score = 0.3 * e^(-0.1 * days)
  const recencyScore = 0.3 * Math.exp(-0.1 * ageDays);
  score += recencyScore;

  // 3. Success rate (0.2 weight)
  if (session.status === 'completed') {
    score += 0.2;
  } else if (session.status === 'failed') {
    score += 0.0; // No points for failures
  } else {
    score += 0.1; // Partial credit for running/paused
  }

  // Normalize to 0.0-1.0
  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Check if two task signatures are similar (first 8 chars match)
 */
function taskSignaturesSimilar(sig1: string, sig2: string): boolean {
  return sig1.substring(0, 8) === sig2.substring(0, 8);
}
```

### 3. Prompt Builder Module

**File:** `parent-harness/orchestrator/src/memory/prompt-builder.ts`

```typescript
import * as sessions from '../db/sessions.js';
import * as memory from './index.js';
import { calculateRelevance } from '../introspection/relevance.js';

export interface Task {
  id: string;
  title: string;
  category?: string;
  metadata?: string;
}

/**
 * Build enhanced prompt with agent's relevant history
 */
export async function buildAgentPrompt(agentId: string, task?: Task): Promise<string> {
  const sections: string[] = [];

  // Base section: Agent role
  sections.push(`You are ${agentId}, an autonomous agent in the Vibe platform.`);

  // If task provided, inject relevant context
  if (task) {
    const taskSignature = extractTaskSignature(task);

    // 1. Relevant past sessions (top 5)
    const allSessions = sessions.getSessions({ agentId, limit: 50 });
    const scored = allSessions
      .map(session => ({
        session,
        relevance: calculateRelevance(session, {
          taskSignature,
          currentTime: Date.now(),
        }),
      }))
      .filter(s => s.relevance >= 0.5)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);

    if (scored.length > 0) {
      sections.push('\n## Relevant Past Sessions\n');
      sections.push('You have worked on similar tasks before. Here are your most relevant past sessions:\n');

      for (const { session, relevance } of scored) {
        const summary = extractSessionSummary(session);
        sections.push(`- **Session ${session.id.substring(0, 8)}** (relevance: ${(relevance * 100).toFixed(0)}%)`);
        sections.push(`  - Status: ${session.status}`);
        sections.push(`  - Summary: ${summary}`);
        sections.push('');
      }
    }

    // 2. Error patterns (from memory)
    const errorPatterns = memory.recallAll(agentId, 'error_pattern');
    if (errorPatterns.length > 0) {
      sections.push('\n## Known Error Patterns\n');
      sections.push('Based on your experience, watch out for these common errors:\n');

      for (const pattern of errorPatterns.slice(0, 3)) {
        try {
          const details = JSON.parse(pattern.value);
          sections.push(`- **${pattern.key}**: ${details.description || 'No description'}`);
        } catch {}
      }
      sections.push('');
    }

    // 3. Success patterns (from memory)
    const successPatterns = memory.recallAll(agentId, 'success_pattern');
    if (successPatterns.length > 0) {
      sections.push('\n## Successful Approaches\n');
      sections.push('These techniques have worked well for you in the past:\n');

      for (const pattern of successPatterns.slice(0, 3)) {
        try {
          const details = JSON.parse(pattern.value);
          sections.push(`- **${pattern.key}**: ${details.description || 'No description'}`);
        } catch {}
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Extract task signature from task metadata
 */
function extractTaskSignature(task: Task): string | undefined {
  if (!task.metadata) return undefined;

  try {
    const meta = JSON.parse(task.metadata);
    return meta.task_signature;
  } catch {
    return undefined;
  }
}

/**
 * Extract concise summary from session
 */
function extractSessionSummary(session: sessions.AgentSession): string {
  let output = session.output || '';

  if (!output && session.metadata) {
    try {
      const meta = JSON.parse(session.metadata);
      output = meta.output || '';
    } catch {}
  }

  // Extract first sentence or 100 chars
  const firstSentence = output.match(/^[^.!?]+[.!?]/)?.[0] || output.substring(0, 100);
  return firstSentence;
}
```

### 4. Spawner Integration

**File:** `parent-harness/orchestrator/src/spawner/index.ts` (modification)

```typescript
// Add import at top
import { buildAgentPrompt } from '../memory/prompt-builder.js';

// Modify spawnAgent function
export async function spawnAgent(params: {
  agentType: string;
  taskId?: string;
  basePrompt?: string;
}): Promise<void> {
  const { agentType, taskId, basePrompt } = params;

  // Get task if taskId provided
  let task = undefined;
  if (taskId) {
    task = getTask(taskId); // Assume getTask exists
  }

  // Build enhanced prompt with historical context
  let prompt = basePrompt || `You are ${agentType}.`;

  if (task) {
    const enhancedPrompt = await buildAgentPrompt(agentType, task);
    prompt = enhancedPrompt;
  }

  // Continue with existing spawn logic
  // ... (spawn agent with enhanced prompt)
}
```

### 5. Agent Documentation

**File:** `parent-harness/orchestrator/src/agents/CLAUDE.md`

```markdown
# Agent Introspection Capability

As an autonomous agent in the Vibe platform, you have the ability to review your own past sessions to learn from previous work and avoid repeating mistakes.

## Introspection API

Query your past sessions using the introspection API:

### Endpoint

```
GET /api/introspection/:agentId?taskSignature=<hash>&limit=10&minRelevance=0.5
```

### Parameters

- `taskSignature` (optional): Hash of task characteristics for similarity matching
- `limit` (optional, default: 10): Maximum sessions to return
- `minRelevance` (optional, default: 0.5): Minimum relevance score (0.0-1.0)
- `includeIterations` (optional, default: false): Include detailed iteration logs
- `includeFailures` (optional, default: false): Include failed sessions

### Example Request

```bash
curl http://localhost:3333/api/introspection/build_agent?limit=5&minRelevance=0.7
```

### Example Response

```json
{
  "agent_id": "build_agent",
  "query": { "taskSignature": null, "limit": 5, "minRelevance": 0.7 },
  "count": 3,
  "sessions": [
    {
      "session_id": "71b696ae-c79b-4f4b-a6d3-36f03d5f7913",
      "task_id": "5dfac93e-1a57-4f73-a319-9df56e50bed5",
      "status": "completed",
      "started_at": "2026-02-08 06:06:04",
      "completed_at": "2026-02-08 06:08:47",
      "relevance_score": 0.85,
      "summary": "Successfully implemented feature X using approach Y..."
    },
    {
      "session_id": "a3f2d891-e4b5-4c1f-9a2e-7d8c3e5f6a1b",
      "task_id": "d2c1a890-f3e2-4d1c-8b9a-6e7f5d4c3b2a",
      "status": "completed",
      "started_at": "2026-02-07 14:32:15",
      "completed_at": "2026-02-07 14:58:33",
      "relevance_score": 0.72,
      "summary": "Fixed bug in module Z by applying pattern W..."
    }
  ]
}
```

## When to Use Introspection

Use introspection when:
1. **Starting a similar task** - Check if you've done something similar before
2. **Encountering an error** - See if you've solved this error previously
3. **Making architectural decisions** - Review past decisions and their outcomes
4. **Stuck on a problem** - Look for patterns in how you've solved similar problems

## Automatic Context

When you are spawned with a task, relevant historical context is **automatically injected** into your system prompt. This includes:
- Top 5 most relevant past sessions
- Known error patterns from your memory
- Successful approaches you've used before

You don't need to query the introspection API manually unless you need more detailed information during task execution.

## Memory Integration

Your introspection capability is integrated with the agent memory system:
- Error patterns are stored when you encounter and solve errors
- Success patterns are stored when you complete tasks successfully
- These patterns automatically appear in future prompts for similar tasks

## Privacy

You can ONLY access your own sessions. Attempting to query other agents' sessions will fail with a 403 Forbidden error.
```

---

## Pass Criteria

### API Functionality

1. ✅ **Introspection endpoint exists** - `GET /api/introspection/:agentId` responds with 200
2. ✅ **Agent filtering works** - Only returns sessions for specified agent_id
3. ✅ **Relevance scoring works** - Sessions have relevance_score between 0.0-1.0
4. ✅ **Limit parameter works** - Returns max N sessions as specified
5. ✅ **MinRelevance filtering works** - Only returns sessions above threshold
6. ✅ **IncludeIterations works** - Optionally includes iteration logs
7. ✅ **Response format correct** - Matches specification (agent_id, count, sessions array)

### Relevance Scoring

8. ✅ **Task signature matching works** - Exact match gives 0.5 score component
9. ✅ **Recency scoring works** - Recent sessions score higher than old
10. ✅ **Success scoring works** - Completed sessions score higher than failed
11. ✅ **Score normalization works** - All scores between 0.0-1.0
12. ✅ **Handles missing signatures** - Falls back to recency + success scoring

### Prompt Integration

13. ✅ **buildAgentPrompt exists** - Function defined in prompt-builder.ts
14. ✅ **Injects relevant sessions** - Top 5 sessions appear in prompt
15. ✅ **Injects error patterns** - Memory error patterns appear in prompt
16. ✅ **Injects success patterns** - Memory success patterns appear in prompt
17. ✅ **Spawner integration works** - Enhanced prompts used when spawning with task

### Documentation

18. ✅ **CLAUDE.md exists** - File created at parent-harness/orchestrator/src/agents/CLAUDE.md
19. ✅ **API documented** - Endpoint, parameters, examples included
20. ✅ **Usage guidance provided** - When to use introspection explained
21. ✅ **Response format shown** - Example JSON response included

### Testing

22. ✅ **Unit tests pass** - All new modules tested (relevance, prompt-builder, introspection API)
23. ✅ **Integration test passes** - Complete flow: spawn → query history → enhanced prompt
24. ✅ **Performance validated** - API responds in <200ms, scoring in <100ms per session

### Observability

25. ✅ **Logging implemented** - Introspection queries logged with agent_id, results_count
26. ✅ **Events emitted** - `introspection:query` event fired on API calls

---

## Dependencies

**Upstream (Must Exist - Already Complete ✅):**
- ✅ PHASE3-TASK-03: Agent session tracking
- ✅ PHASE2-TASK-01: Database schema foundation
- ✅ Agent memory system (`parent-harness/orchestrator/src/memory/index.ts`)
- ✅ Sessions API (`parent-harness/orchestrator/src/api/sessions.ts`)

**Downstream (Depends on This):**
- PHASE4-TASK-03: Spec Agent learning from Build Agent feedback (uses introspection)
- PHASE6-TASK-01: Self-improvement loop (uses introspection for pattern detection)

**Parallel Work (Can Develop Concurrently):**
- PHASE4-TASK-01: Knowledge Base system (complementary to introspection)

---

## Implementation Plan

### Phase 1: Relevance Scoring Module (1.5 hours)
1. Create `introspection/relevance.ts`
2. Implement `generateTaskSignature()` with SHA-256 hashing
3. Implement `calculateRelevance()` with 3-component scoring
4. Unit test scoring with edge cases (missing signatures, old sessions)

### Phase 2: Introspection API (2 hours)
5. Create `api/introspection.ts`
6. Implement `GET /api/introspection/:agentId` endpoint
7. Integrate relevance scoring
8. Implement query parameters (limit, minRelevance, includeIterations)
9. Add response formatting (session summaries)
10. Add error handling (invalid agent IDs, missing sessions)

### Phase 3: Prompt Builder (2 hours)
11. Create `memory/prompt-builder.ts`
12. Implement `buildAgentPrompt()` with session injection
13. Add error pattern injection from agent_memory
14. Add success pattern injection from agent_memory
15. Format prompts for readability (markdown sections)

### Phase 4: Spawner Integration (1 hour)
16. Modify `spawner/index.ts` to import prompt-builder
17. Wire `buildAgentPrompt()` into spawn flow
18. Test with sample task (verify enhanced prompts generated)

### Phase 5: Documentation (0.5 hours)
19. Create `parent-harness/orchestrator/src/agents/CLAUDE.md`
20. Document introspection API with examples
21. Add usage guidance and privacy notes

### Phase 6: Testing & Observability (2 hours)
22. Write unit tests for relevance scoring
23. Write unit tests for prompt builder
24. Write integration test: spawn → query introspection → enhanced prompt
25. Add logging to introspection API
26. Add `introspection:query` event emission
27. Performance test with 100+ sessions

**Total Estimated Effort:** 7 hours (1 day)

---

## Testing Strategy

### Unit Tests

**File:** `tests/introspection-relevance.test.ts`

```typescript
import { generateTaskSignature, calculateRelevance } from '../src/introspection/relevance.js';

describe('Task Signature Generation', () => {
  test('generates deterministic hash', () => {
    const sig1 = generateTaskSignature({ title: 'Test Task', category: 'feature' });
    const sig2 = generateTaskSignature({ title: 'Test Task', category: 'feature' });
    expect(sig1.hash).toBe(sig2.hash);
  });

  test('normalizes title', () => {
    const sig1 = generateTaskSignature({ title: 'Test Task' });
    const sig2 = generateTaskSignature({ title: '  TEST TASK  ' });
    expect(sig1.hash).toBe(sig2.hash);
  });
});

describe('Relevance Scoring', () => {
  test('exact task signature match gives 0.5 score', () => {
    const session = {
      id: 'test-session',
      agent_id: 'build_agent',
      status: 'completed',
      started_at: new Date().toISOString(),
      metadata: JSON.stringify({ task_signature: 'abc123' }),
    };

    const score = calculateRelevance(session, {
      taskSignature: 'abc123',
      currentTime: Date.now(),
    });

    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  test('recent sessions score higher', () => {
    const recent = {
      id: 'recent',
      agent_id: 'build_agent',
      status: 'completed',
      started_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    };

    const old = {
      id: 'old',
      agent_id: 'build_agent',
      status: 'completed',
      started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days ago
    };

    const recentScore = calculateRelevance(recent, { currentTime: Date.now() });
    const oldScore = calculateRelevance(old, { currentTime: Date.now() });

    expect(recentScore).toBeGreaterThan(oldScore);
  });

  test('completed sessions score higher than failed', () => {
    const completed = {
      id: 'completed',
      agent_id: 'build_agent',
      status: 'completed',
      started_at: new Date().toISOString(),
    };

    const failed = {
      id: 'failed',
      agent_id: 'build_agent',
      status: 'failed',
      started_at: new Date().toISOString(),
    };

    const completedScore = calculateRelevance(completed, { currentTime: Date.now() });
    const failedScore = calculateRelevance(failed, { currentTime: Date.now() });

    expect(completedScore).toBeGreaterThan(failedScore);
  });
});
```

**File:** `tests/introspection-prompt.test.ts`

```typescript
import { buildAgentPrompt } from '../src/memory/prompt-builder.js';
import * as memory from '../src/memory/index.js';

describe('Prompt Builder', () => {
  test('includes agent role in prompt', async () => {
    const prompt = await buildAgentPrompt('build_agent');
    expect(prompt).toContain('build_agent');
  });

  test('includes relevant sessions when task provided', async () => {
    // Setup: Create test sessions
    const task = {
      id: 'test-task',
      title: 'Test Task',
      category: 'feature',
    };

    const prompt = await buildAgentPrompt('build_agent', task);

    // Should contain sessions section (if sessions exist)
    if (prompt.includes('Relevant Past Sessions')) {
      expect(prompt).toContain('relevance');
    }
  });

  test('includes error patterns from memory', async () => {
    // Setup: Store error pattern
    memory.learnError('build_agent', 'test_error', {
      description: 'Always check null before accessing properties',
    });

    const prompt = await buildAgentPrompt('build_agent', {
      id: 'test-task',
      title: 'Test',
    });

    expect(prompt).toContain('Known Error Patterns');
  });
});
```

### Integration Tests

**File:** `tests/introspection-integration.test.ts`

```typescript
import request from 'supertest';
import { app } from '../src/server.js';
import * as sessions from '../src/db/sessions.js';

describe('Introspection Integration', () => {
  test('complete flow: create session → query introspection → get relevant history', async () => {
    // 1. Create test session
    const session = sessions.createSession('build_agent', 'test-task-1');
    sessions.updateSessionStatus(session.id, 'completed', 'Successfully completed test task');

    // 2. Query introspection API
    const response = await request(app)
      .get('/api/introspection/build_agent?limit=10&minRelevance=0.5')
      .expect(200);

    // 3. Verify response format
    expect(response.body).toHaveProperty('agent_id', 'build_agent');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('sessions');
    expect(Array.isArray(response.body.sessions)).toBe(true);

    // 4. Verify session included
    const found = response.body.sessions.find((s: any) => s.session_id === session.id);
    expect(found).toBeDefined();
    expect(found.relevance_score).toBeGreaterThan(0);
  });

  test('agent can only access own sessions', async () => {
    // Create sessions for two agents
    sessions.createSession('build_agent', 'task-1');
    sessions.createSession('qa_agent', 'task-2');

    // Query as build_agent
    const response = await request(app)
      .get('/api/introspection/build_agent')
      .expect(200);

    // Should only see build_agent sessions
    const hasQaSession = response.body.sessions.some((s: any) => s.agent_id === 'qa_agent');
    expect(hasQaSession).toBe(false);
  });
});
```

### Manual Testing

1. **Query Introspection API:**
   ```bash
   # Start orchestrator
   cd parent-harness/orchestrator
   npm start

   # Query introspection (assuming build_agent has history)
   curl http://localhost:3333/api/introspection/build_agent?limit=5&minRelevance=0.7
   ```

2. **Verify Enhanced Prompts:**
   - Spawn agent with task
   - Check spawner logs for "Building enhanced prompt for agent X"
   - Verify prompt includes "Relevant Past Sessions" section

3. **Test Relevance Scoring:**
   - Create multiple sessions with similar tasks
   - Query introspection with task signature
   - Verify sessions ranked by relevance (highest first)

---

## Success Metrics

**Operational:**
- Introspection API responds in <200ms for 10-50 session queries
- 90%+ of relevance scores are between 0.0-1.0 (no calculation errors)
- Enhanced prompts generated for 100% of agent spawns with tasks

**Agent Behavior:**
- Agents reference past sessions in 20%+ of similar tasks
- Time to solve known errors reduces by 30% with introspection
- Agent failure rate decreases by 15% after 50+ historical sessions

**Quality:**
- Relevance scores correlate with actual task similarity (manual review)
- Enhanced prompts contain relevant context (no hallucinations)
- No cross-agent data leakage (privacy violations)

---

## Rollback Plan

If introspection causes performance issues or agent confusion:

1. **Disable prompt enhancement:**
   - Set config flag: `ENABLE_INTROSPECTION=false`
   - Agents spawn without historical context
   - Introspection API remains available for manual queries

2. **Remove introspection API:**
   - Comment out introspection router in `server.ts`
   - Session query functionality via `/api/sessions` remains

3. **Revert spawner changes:**
   - Remove `buildAgentPrompt()` call from spawner
   - Return to base prompts only

**No database changes required** - all changes are code-only, tables remain unchanged.

---

## Future Enhancements (Out of Scope)

1. **Semantic similarity** - Use embeddings instead of hash-based matching
2. **Cross-agent learning** - Agents learn from other agents' successes
3. **Session recommendations** - "Agents who solved X also solved Y"
4. **Interactive introspection** - Agents query specific session details mid-task
5. **Confidence scoring** - Track which historical references were actually helpful
6. **Automatic summarization** - Use LLM to generate better session summaries

---

## References

- **Existing Infrastructure:**
  - `parent-harness/orchestrator/src/db/sessions.ts` - Session database module
  - `parent-harness/orchestrator/src/api/sessions.ts` - Sessions REST API
  - `parent-harness/orchestrator/src/memory/index.ts` - Agent memory system
  - `parent-harness/orchestrator/src/self-improvement/index.ts` - Retry system

- **Specifications:**
  - `parent-harness/docs/MEMORY_SYSTEM.md` - Memory system specification (buildAgentPrompt concept)
  - `docs/specs/PHASE4-TASK-02-VERIFICATION.md` - QA verification report
  - `STRATEGIC_PLAN.md` - Phase 4: Agent Memory & Learning System

- **Related Tasks:**
  - PHASE4-TASK-01: Knowledge Base system (complementary)
  - PHASE4-TASK-03: Spec Agent learning (downstream consumer)

---

**Specification Sign-off:**
This specification is ready for implementation. All dependencies are satisfied (infrastructure 100% complete), design is detailed with code examples, and pass criteria are testable.

**Next Steps:**
1. Assign to build_agent for implementation
2. Estimated delivery: 7 hours (1 day)
3. Verification by qa_agent after implementation
4. Mark PHASE4-TASK-02 as COMPLETE after QA validation
