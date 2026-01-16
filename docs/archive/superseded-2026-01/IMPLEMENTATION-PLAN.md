# Idea Incubator: Implementation Plan

> **Prerequisites**: ARCHITECTURE.md reviewed and approved

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Finalized Design Decisions](#2-finalized-design-decisions)
3. [Implementation Phases](#3-implementation-phases)
4. [Phase 0: Technical Validation & Test Infrastructure](#4-phase-0-technical-validation--test-infrastructure)
5. [Phase 1: Core Infrastructure](#5-phase-1-core-infrastructure)
6. [Phase 2: Idea Capture & Storage](#6-phase-2-idea-capture--storage)
7. [Phase 3: Single-Agent Evaluation](#7-phase-3-single-agent-evaluation)
8. [Phase 4: Multi-Agent Debate System](#8-phase-4-multi-agent-debate-system)
9. [Phase 5: Finite Synthesis Protocol](#9-phase-5-finite-synthesis-protocol)
10. [Phase 6: Frontend & Visualization](#10-phase-6-frontend--visualization)
11. [Phase 7: Enhancements & Scale](#11-phase-7-enhancements--scale)
12. [Execution Model](#12-execution-model)
13. [File Specifications](#13-file-specifications)
14. [Risk Register](#14-risk-register)
15. [Success Criteria](#15-success-criteria)

---

## 1. Executive Summary

### What We're Building

A single-user idea incubation system that:

- Captures ideas via markdown files from any device
- Evaluates ideas through parallel Claude Opus 4.5 agents
- Red-teams ideas with adversarial agent personas
- Synthesizes debates into immutable final evaluations
- Stores data in markdown (source of truth) + SQLite (query layer)
- Visualizes ideas on a leaderboard and relationship graph
- Supports both CLI and Claude Code skills for user interaction

### Core Philosophy

1. **Agents propose, user confirms** - Hybrid evaluation with human override
2. **Debate produces winners, not compromises** - Synthesis Agent resolves conflicts decisively
3. **First principles or penalty** - Weak reasoning gets penalized
4. **Finite termination guaranteed** - Convergence criteria + hard limits prevent infinite loops
5. **CLI first, GUI second** - Validate logic before building interface
6. **Test-driven development** - Tests before implementation

### Tech Stack

| Layer               | Technology                                   |
| ------------------- | -------------------------------------------- |
| Agent Orchestration | Claude Agent SDK (TypeScript)                |
| Model               | Claude Opus 4.5 (`claude-opus-4-5-20251101`) |
| Database            | SQLite via better-sqlite3                    |
| Backend             | Node.js + TypeScript                         |
| Frontend            | Vite + React + TypeScript + Tailwind         |
| Real-time           | WebSocket (ws package)                       |
| File Format         | Markdown + YAML frontmatter                  |
| Version Control     | Git                                          |
| Testing             | Vitest + Testing Library                     |
| Validation          | Zod                                          |

---

## 2. Finalized Design Decisions

These 10 decisions were deliberated and finalized. They are now **locked** for prototype implementation.

### Decision 1: Evaluation Trigger Mode

**Question**: Should evaluation run automatically when an idea is created, or only when explicitly triggered?

**Answer**: **Explicit command trigger**

```
User runs: evaluate [idea-slug] --depth=standard
```

**Rationale**:

- Prevents accidental cost from unfinished ideas
- User controls when idea is "ready" for scrutiny
- Aligns with hybrid philosophy (user confirms)

**Implementation**: CLI command `evaluate` in `scripts/cli.ts`

---

### Decision 2: Idea Matching for Relationships

**Question**: How should the system present potentially related ideas during capture?

**Answer**: **Top 3 matches + "New idea" option**

```
Related ideas found:
1. [85% match] solar-powered-drone - "Autonomous solar drone for agriculture"
2. [72% match] farm-automation - "IoT sensors for crop monitoring"
3. [68% match] renewable-energy-storage - "Battery tech for rural areas"
4. [New idea] Create as standalone idea

Select (1-4):
```

**Rationale**:

- Prevents decision paralysis (not 10+ options)
- Always allows "new idea" escape hatch
- Similarity % gives confidence signal

**Implementation**: `agents/classifier.ts` with keyword/tag matching (embeddings deferred to v2)

---

### Decision 3: Default Debate Depth

**Question**: What should the default debate configuration be?

**Answer**: **Standard depth**

| Parameter           | Value            |
| ------------------- | ---------------- |
| Red Team Challenges | 5 per criterion  |
| Debate Rounds       | 3 per challenge  |
| Evaluator Agents    | 1 (generalist)   |
| Red Team Personas   | 3 core (6 in v2) |

**Rationale**:

- Balances thoroughness with cost
- 5 challenges × 3 rounds = 15 exchanges per criterion
- Single evaluator simplifies v1

**Implementation**: Default config in `config/default.ts`

---

### Decision 4: Real-time Transcript Streaming

**Question**: Should debate transcripts stream in real-time or batch at end?

**Answer**: **Sync with streaming**

```typescript
// User sees live updates:
[Evaluator] Market size is $50B annually based on...
[Red Team: Skeptic] That $50B figure includes adjacent markets. The addressable...
[Evaluator] Fair point. Adjusting to TAM of $12B, which still...
[Arbiter] POINT TO RED TEAM. Evaluator's initial claim was overstated.
```

**Rationale**:

- Transparency builds trust in the system
- User can abort early if debate goes off-track
- Educational: user learns how agents reason

**Implementation**: WebSocket in Phase 6, console.log in earlier phases

---

### Decision 5: Evaluation Approval Flow

**Question**: How should the user confirm/override agent evaluations?

**Answer**: **Post-evaluation review**

```
Evaluation complete. Review results:

| Criterion | Agent Score | Your Score | Notes |
|-----------|-------------|------------|-------|
| Problem Clarity | 8 | [8] | |
| Market Size | 6 | [_] | Override? |
| Technical Risk | 7 | [7] | |

Press Enter to accept, or type score to override:
```

**Rationale**:

- User sees agent reasoning before deciding
- Override is optional, not required
- Maintains agent-as-advisor relationship

**Implementation**: Interactive CLI in `scripts/review.ts`

---

### Decision 6: Evaluator Agent Count (v1)

**Question**: Should v1 use specialized evaluators (one per category) or a single generalist?

**Answer**: **Single generalist evaluator** (v1), **6 specialized** (v2)

```typescript
const evaluatorAgent = new Agent({
  name: "evaluator-generalist",
  model: "claude-opus-4-5-20251101",
  systemPrompt: `You evaluate ideas across all 30 criteria in 6 categories...`,
});
```

**Rationale**:

- Simpler to implement and debug
- Lower cost (1 agent vs 6)
- Can parallelize categories in v2

**Implementation**: `agents/evaluator.ts` (single file for v1)

---

### Decision 7: Budget Hard Limit

**Question**: What should the default cost ceiling be per evaluation?

**Answer**: **$10 per evaluation**

| Component                             | Estimated Cost |
| ------------------------------------- | -------------- |
| Initial evaluation (30 criteria)      | ~$2            |
| Red team (5 challenges × 30 criteria) | ~$4            |
| Debate rounds (3 per challenge)       | ~$3            |
| Synthesis                             | ~$1            |
| **Total**                             | **~$10**       |

**Rationale**:

- Generous enough for thorough evaluation
- Hard stop prevents runaway costs
- User can override with `--budget=20` flag

**Implementation**: `utils/cost-tracker.ts` with enforcement in config

---

### Decision 8: Red Team Persona Count (v1)

**Question**: How many Red Team personas should v1 include?

**Answer**: **3 core personas** (v1), **6 personas** (v2)

**v1 Personas:**
| Persona | Role |
|---------|------|
| **Skeptic** | Questions assumptions, demands evidence |
| **Realist** | Identifies practical obstacles, execution gaps |
| **First Principles Purist** | Attacks logical foundations, rewards rigor |

**v2 Additions (deferred):**
| Persona | Role |
|---------|------|
| **Competitor** | Competitive threat analysis |
| **Contrarian** | Inverts core assumptions |
| **Edge-Case Finder** | Finds failure modes |

**Implementation**: `agents/redteam.ts` with persona selection

---

### Decision 9: Interface Priority

**Question**: Should we build CLI first or jump to frontend?

**Answer**: **CLI first, frontend Phase 6**

Phase Order:

1. Test infrastructure + Core infrastructure
2. Idea capture (CLI + basic skills)
3. Single-agent evaluation (CLI)
4. Multi-agent debate (CLI with console output)
5. Finite synthesis (CLI)
6. Frontend (React + Vite)
7. Enhancements (6 evaluators, 6 personas, advanced views)

**Rationale**:

- Validates agent logic before building UI
- CLI is faster to iterate
- Frontend can be built by someone else in parallel later

**Implementation**: All `scripts/*.ts` files before `frontend/`

---

### Decision 10: Real-time Update Mechanism

**Question**: What mechanism should power real-time debate updates?

**Answer**: **Console logs for prototype, WebSocket for production**

```typescript
// Phase 1-5: Console
console.log(`[${agent}] ${message}`);

// Phase 6: WebSocket
wss.clients.forEach((client) => {
  client.send(JSON.stringify({ agent, message, timestamp }));
});
```

**Implementation**: `utils/logger.ts` with pluggable transports

---

### Decision 11: Frontend Data Access

**Question**: How should the Vite frontend access data from SQLite?

**Answer**: **Local Express API**

```typescript
// server/index.ts
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

// REST endpoints
app.get("/api/ideas", getIdeas);
app.get("/api/ideas/:slug", getIdea);
app.get("/api/evaluations/:ideaId", getEvaluations);

// WebSocket for real-time debate streaming
const wss = new WebSocketServer({ server });
```

**Rationale**:

- Enables WebSocket for real-time debate updates
- Server handles complex SQL queries
- Frontend stays lightweight
- More flexible than sql.js in browser

**Implementation**: `server/index.ts`, `server/routes/*.ts`, `server/websocket.ts`

---

### Decision 12: Mobile Capture Approach

**Question**: How will you capture ideas from your phone?

**Answer**: **Notes app + manual import**

```
Workflow:
1. Capture idea in Apple Notes / Google Keep / any notes app
2. On desktop, copy text
3. Run: npm run cli capture
4. Paste idea content when prompted
5. Idea folder created, synced to database
```

**Rationale**:

- Simplest approach for v1
- No hosting, authentication, or PWA complexity
- Works offline by default
- Can upgrade to PWA in v2 if needed

**Implementation**: No additional code needed - existing CLI capture handles pasted content

---

### Decision 13: Evaluation Mode

**Question**: Should evaluation support a "quick mode" with fewer criteria?

**Answer**: **Full 30 criteria only**

```bash
# Single evaluation mode
npm run evaluate <slug>       # Always runs full 30 criteria
npm run evaluate <slug> --budget=20  # Override budget if needed
```

**Rationale**:

- Consistent evaluation results
- Simpler implementation (no mode switching)
- Cost is acceptable (~$10 per evaluation)
- Quick mode adds complexity without clear benefit for single-user system

**Implementation**: No `--quick` or `--mode` flags needed in `scripts/evaluate.ts`

---

### Decision 14: Index Maintenance

**Question**: How should the ideas index be maintained?

**Answer**: **Auto-generated via sync script**

```bash
npm run sync
# Regenerates ideas/_index.md automatically
```

```markdown
<!-- ideas/_index.md (auto-generated) -->

# Idea Index

Last updated: 2025-12-21T15:30:00Z

| Idea                                       | Stage    | Score | Last Evaluated |
| ------------------------------------------ | -------- | ----- | -------------- |
| [Solar Charger](./solar-charger/README.md) | EVALUATE | 7.2   | 2025-12-20     |
| [Plant Tracker](./plant-tracker/README.md) | SPARK    | -     | -              |
```

**Rationale**:

- Reliable, consistent output
- No manual effort required
- No AI hallucination risk
- Single source of truth synced from database

**Implementation**: Index generation in `scripts/sync.ts`

---

### Decision 15: Re-evaluation Triggers

**Question**: When should the system suggest re-evaluating an idea?

**Answer**: **Hash-based staleness detection with user control**

```bash
$ npm run sync

Syncing ideas...
  [!] solar-charger: Modified since last evaluation (Dec 15)
  [!] plant-tracker: Modified since last evaluation (Dec 10)

2 ideas have stale evaluations. Run `npm run evaluate <slug>` to update.
```

**Detection Mechanism**:

- Store `content_hash` (MD5 of README.md) with each evaluation
- On sync, compare current hash to last evaluation's hash
- If different, mark idea as `evaluation_stale: true`

**Triggers**:
| Trigger | Detection | Action |
|---------|-----------|--------|
| Content changed | Hash mismatch | Mark stale, notify user |
| Time elapsed | >30 days | Suggest refresh |
| Stage changed | SPARK → CLARIFY | Suggest with new info |
| User request | `--force` flag | Immediate re-evaluation |

**Implementation**: `scripts/sync.ts` calculates hash, `scripts/evaluate.ts` shows warnings

---

### Decision 16: Idea Identity & Pivots

**Question**: When does a modified idea become a new idea?

**Answer**: **Problem + Target User defines identity; system suggests, user decides**

```
Identity = hash(problem_statement + target_user)
```

**Pivot Classification**:
| Change Type | Example | Recommendation |
|-------------|---------|----------------|
| ITERATION | Minor text edits | Continue with current idea |
| PIVOT | Solution changed, same problem | Continue, log pivot reason |
| NEW_IDEA | Problem or target user changed | Create new idea, link as `inspired_by` |

**User Interaction**:

```bash
$ npm run sync

Analyzing changes to: solar-charger

Significant changes detected:
  - Problem statement: CHANGED
  - Target user: CHANGED

This appears to be a NEW IDEA, not a pivot.

Options:
  1. Create new idea (linked as inspired_by)
  2. Continue with current idea
  3. Revert changes

Select (1-3): 1
```

**Implementation**: Pivot detection in `scripts/sync.ts`, relationship creation in `agents/classifier.ts`

---

### Decision 17: Evaluation Flow Details

**Question**: What is the exact flow when a user runs an evaluation?

**Answer**: **5-step flow with pre-flight checks, cost estimate, progress, results, and review**

```
Step 1: Pre-flight Checks
├── Does idea exist?
├── Is idea in valid stage?
├── Has previous evaluation? → Show last scores
└── Is --force flag set? → Skip confirmations

Step 2: Cost Estimate
├── Show breakdown by phase
├── Display budget limit
└── Confirm to proceed

Step 3: Execution with Progress
├── Show phase progress bars
├── Display running cost
└── Allow Ctrl+C abort (saves partial)

Step 4: Results Display
├── Overall score and confidence
├── Category breakdown with bars
└── Challenge survival rate

Step 5: Review/Override (see Decision 18)
```

**CLI Example**:

```bash
$ npm run evaluate solar-charger --budget=15

Last evaluation: 2025-12-15 (Score: 7.2)
Re-evaluate? (y/n): y

Estimated cost: $8-12
Budget limit: $15
Proceed? (y/n): y

Phase 1: Initial Evaluation
[████████████████████] 30/30 criteria | $2.14

Phase 2: Red Team Challenges
[████████░░░░░░░░░░░░] 45/150 | $4.82

...

COMPLETE | Duration: 4m 32s | Cost: $9.47
Overall Score: 7.8 (Confidence: 85%)
```

**Implementation**: Full flow in `scripts/evaluate.ts`

---

### Decision 18: Hybrid Review Flow

**Question**: How does the user review and override agent scores?

**Answer**: **Interactive category-by-category review with override justification**

```
┌────────────────────────────────────────────────────────────────┐
│ REVIEW MODE: PROBLEM (Category Average: 7.2)                   │
├────┬──────────────────┬───────┬────────┬──────────────────────┤
│ #  │ Criterion        │ Score │ Conf.  │ Key Reasoning        │
├────┼──────────────────┼───────┼────────┼──────────────────────┤
│ 1  │ Problem Clarity  │ 8     │ 85%    │ Well-defined...      │
│ 2  │ Problem Severity │ 6     │ 70%    │ Moderate pain...     │
│ 3  │ Target User      │ 7     │ 80%    │ Clear persona...     │
│ 4  │ Validation       │ 5     │ 60%    │ No user research...  │
│ 5  │ Uniqueness       │ 8     │ 75%    │ Novel approach...    │
└────┴──────────────────┴───────┴────────┴──────────────────────┘

Commands: [number] override | [d]etail | [n]ext | [done]
> 2

Criterion: Problem Severity
Agent Score: 6 | Confidence: 70%

Agent Reasoning:
"The problem causes moderate inconvenience but users have
 workarounds. Survey shows 40% find it 'annoying'..."

Your Score (1-10, Enter to keep): 8
Reason for override: Recent interviews show 70% would pay

Override saved: 6 → 8
```

**Database Storage**:

```sql
-- Each criterion stores both scores
agent_score,      -- Original (always preserved)
user_score,       -- Override (NULL if not overridden)
final_score,      -- user_score ?? agent_score
override_reason   -- Why user changed it
```

**Implementation**: `scripts/review.ts` with interactive prompts

---

## 3. Implementation Phases

```
Phase 0: Test Infrastructure & Technical Validation
    │
    ▼
Phase 1: Core Infrastructure
    ├── Database schema
    ├── File sync mechanism
    ├── CLI skeleton
    ├── CLAUDE.md + Skills (basic)
    └── Taxonomy files
    │
    ▼
Phase 2: Idea Capture & Storage
    ├── Markdown templates
    ├── Folder creation
    ├── Tag/relationship capture
    ├── Development Agent
    └── Index generation
    │
    ▼
Phase 3: Single-Agent Evaluation
    ├── Generalist evaluator
    ├── 30-criteria scoring
    ├── Orchestrator Agent
    ├── Classification Agent
    └── User review/override
    │
    ▼
Phase 4: Multi-Agent Debate
    ├── 3 Red Team personas
    ├── Arbiter agent
    ├── Debate protocol (5 challenges × 3 rounds)
    └── Cost tracking enforcement
    │
    ▼
Phase 5: Finite Synthesis
    ├── Convergence detection
    ├── Synthesis agent
    ├── Final document generation
    └── Re-evaluation logic
    │
    ▼
Phase 6: Frontend & Visualization
    ├── All 7 views (Dashboard, Detail, Matrix, Pipeline, Graph, Gap, Debate)
    ├── WebSocket integration
    └── Relationship graph
    │
    ▼
Phase 7: Enhancements & Scale
    ├── 6 specialized evaluators
    ├── 6 Red Team personas
    ├── Comparison view
    └── Advanced features
```

---

## 4. Phase 0: Technical Validation & Test Infrastructure

**CRITICAL**: This phase establishes testing infrastructure BEFORE any implementation.

### Files to Create

| File                       | Purpose                               |
| -------------------------- | ------------------------------------- |
| `package.json`             | Dependencies including test framework |
| `tsconfig.json`            | TypeScript configuration              |
| `vitest.config.ts`         | Test framework configuration          |
| `tests/mocks/anthropic.ts` | Mock Anthropic client                 |
| `tests/fixtures/`          | Test data                             |
| `utils/schemas.ts`         | Zod validation schemas                |
| `utils/errors.ts`          | Custom error classes                  |

### package.json (Updated)

```json
{
  "name": "idea-incubator",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "cli": "tsx scripts/cli.ts",
    "sync": "tsx scripts/sync.ts",
    "evaluate": "tsx scripts/evaluate.ts",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "spike:sdk": "tsx spikes/spike-0.1-agent-sdk.ts",
    "spike:parallel": "tsx spikes/spike-0.2-parallel.ts",
    "spike:sqlite": "tsx spikes/spike-0.3-sqlite.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0",
    "gray-matter": "^4.0.3",
    "glob": "^10.0.0",
    "chalk": "^5.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  }
}
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["tests/**", "spikes/**"],
    },
    setupFiles: ["tests/setup.ts"],
  },
});
```

### tests/mocks/anthropic.ts

```typescript
import { vi } from "vitest";

export interface MockMessage {
  content: Array<{ type: "text"; text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export function createMockAnthropicClient() {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "{}" }],
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    },
  };
}

export function mockEvaluationResponse(scores: Record<string, number>) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          evaluations: Object.entries(scores).map(([criterion, score]) => ({
            criterion,
            category: "test",
            score,
            confidence: 0.8,
            reasoning: "Test reasoning",
          })),
        }),
      },
    ],
    usage: { input_tokens: 500, output_tokens: 1000 },
  };
}

export function mockArbiterResponse(
  verdict: "EVALUATOR" | "RED_TEAM" | "DRAW",
) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          verdict,
          reasoning: "Test verdict reasoning",
          firstPrinciplesBonus: false,
          scoreAdjustment: verdict === "RED_TEAM" ? -1 : 0,
        }),
      },
    ],
    usage: { input_tokens: 200, output_tokens: 300 },
  };
}
```

### utils/schemas.ts

```typescript
import { z } from "zod";

// Idea frontmatter schema
export const IdeaFrontmatterSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: z.enum(["business", "creative", "technical", "personal", "research"]),
  stage: z.enum([
    "SPARK",
    "CLARIFY",
    "RESEARCH",
    "IDEATE",
    "EVALUATE",
    "VALIDATE",
    "DESIGN",
    "PROTOTYPE",
    "TEST",
    "REFINE",
    "BUILD",
    "LAUNCH",
    "GROW",
    "MAINTAIN",
    "PIVOT",
    "PAUSE",
    "SUNSET",
    "ARCHIVE",
    "ABANDONED",
  ]),
  created: z.string(),
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
});

export type IdeaFrontmatter = z.infer<typeof IdeaFrontmatterSchema>;

// Single criterion evaluation
export const CriterionEvaluationSchema = z.object({
  criterion: z.string(),
  category: z.enum([
    "problem",
    "solution",
    "feasibility",
    "fit",
    "market",
    "risk",
  ]),
  score: z.number().min(1).max(10),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;

// Full evaluation response from agent
export const EvaluationResponseSchema = z.object({
  evaluations: z.array(CriterionEvaluationSchema),
});

export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;

// Arbiter verdict
export const ArbiterVerdictSchema = z.object({
  verdict: z.enum(["EVALUATOR", "RED_TEAM", "DRAW"]),
  reasoning: z.string(),
  firstPrinciplesBonus: z.boolean(),
  scoreAdjustment: z.number().min(-3).max(3),
});

export type ArbiterVerdict = z.infer<typeof ArbiterVerdictSchema>;

// Red team challenge
export const ChallengeSchema = z.object({
  persona: z.enum([
    "skeptic",
    "realist",
    "first-principles",
    "competitor",
    "contrarian",
    "edge-case",
  ]),
  criterion: z.string(),
  challenge: z.string(),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

// Synthesis output
export const SynthesisOutputSchema = z.object({
  executiveSummary: z.string(),
  keyStrengths: z.array(z.string()),
  keyWeaknesses: z.array(z.string()),
  criticalAssumptions: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
  recommendation: z.enum(["PURSUE", "REFINE", "PAUSE", "ABANDON"]),
  recommendationReasoning: z.string(),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// Convergence state
export const ConvergenceStateSchema = z.object({
  round: z.number(),
  hasConverged: z.boolean(),
  reason: z
    .enum(["SCORE_STABILITY", "MAX_ROUNDS", "TIMEOUT", "BUDGET_EXCEEDED"])
    .optional(),
});

export type ConvergenceState = z.infer<typeof ConvergenceStateSchema>;

// Helper to safely parse JSON responses
export function parseAgentResponse<T>(
  text: string,
  schema: z.ZodType<T>,
  context: string,
): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError(
      `Could not extract JSON from ${context} response`,
    );
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EvaluationParseError(
        `Invalid ${context} response: ${error.errors.map((e) => e.message).join(", ")}`,
      );
    }
    throw error;
  }
}
```

### utils/errors.ts

```typescript
export class IdeaIncubatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdeaIncubatorError";
  }
}

export class IdeaNotFoundError extends IdeaIncubatorError {
  constructor(slug: string) {
    super(`Idea not found: ${slug}`);
    this.name = "IdeaNotFoundError";
  }
}

export class EvaluationParseError extends IdeaIncubatorError {
  constructor(message: string) {
    super(`Failed to parse evaluation: ${message}`);
    this.name = "EvaluationParseError";
  }
}

export class APIRateLimitError extends IdeaIncubatorError {
  constructor(retryAfter?: number) {
    super(`Rate limited. Retry after ${retryAfter || "unknown"} seconds`);
    this.name = "APIRateLimitError";
  }
}

export class BudgetExceededError extends IdeaIncubatorError {
  constructor(spent: number, budget: number) {
    super(
      `Budget exceeded: $${spent.toFixed(2)} spent of $${budget.toFixed(2)} limit`,
    );
    this.name = "BudgetExceededError";
  }
}

export class ConvergenceTimeoutError extends IdeaIncubatorError {
  constructor(rounds: number, maxRounds: number) {
    super(`Convergence timeout: ${rounds} rounds reached max ${maxRounds}`);
    this.name = "ConvergenceTimeoutError";
  }
}

export class ValidationError extends IdeaIncubatorError {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = "ValidationError";
  }
}
```

### utils/cost-tracker.ts

```typescript
import { BudgetExceededError } from "./errors.js";

// Claude Opus 4.5 pricing (as of 2025)
const PRICING = {
  inputPerMillion: 15.0, // $15 per 1M input tokens
  outputPerMillion: 75.0, // $75 per 1M output tokens
};

export interface CostReport {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  budgetRemaining: number;
  apiCalls: number;
}

export class CostTracker {
  private inputTokens = 0;
  private outputTokens = 0;
  private budget: number;
  private apiCalls = 0;

  constructor(budgetDollars: number = 10.0) {
    this.budget = budgetDollars;
  }

  track(usage: { input_tokens: number; output_tokens: number }): void {
    this.inputTokens += usage.input_tokens;
    this.outputTokens += usage.output_tokens;
    this.apiCalls++;
  }

  getEstimatedCost(): number {
    const inputCost = (this.inputTokens / 1_000_000) * PRICING.inputPerMillion;
    const outputCost =
      (this.outputTokens / 1_000_000) * PRICING.outputPerMillion;
    return inputCost + outputCost;
  }

  checkBudget(): void {
    const cost = this.getEstimatedCost();
    if (cost >= this.budget) {
      throw new BudgetExceededError(cost, this.budget);
    }
  }

  getBudgetRemaining(): number {
    return Math.max(0, this.budget - this.getEstimatedCost());
  }

  getReport(): CostReport {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      estimatedCost: this.getEstimatedCost(),
      budgetRemaining: this.getBudgetRemaining(),
      apiCalls: this.apiCalls,
    };
  }

  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.apiCalls = 0;
  }
}
```

### Spike Tests (Convert to Actual Tests)

**tests/integration/anthropic-client.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockAnthropicClient,
  mockEvaluationResponse,
} from "../mocks/anthropic.js";

describe("Anthropic Client Integration", () => {
  let mockClient: ReturnType<typeof createMockAnthropicClient>;

  beforeEach(() => {
    mockClient = createMockAnthropicClient();
  });

  it("should create a message with system prompt", async () => {
    mockClient.messages.create.mockResolvedValueOnce(
      mockEvaluationResponse({ "Problem Clarity": 8 }),
    );

    const response = await mockClient.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 1024,
      system: "You are an evaluator.",
      messages: [{ role: "user", content: "Evaluate this idea" }],
    });

    expect(response.content[0].type).toBe("text");
    expect(response.usage.input_tokens).toBeGreaterThan(0);
  });

  it("should parse JSON from response", () => {
    const response = mockEvaluationResponse({ "Problem Clarity": 8 });
    const text = response.content[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.evaluations).toBeDefined();
    expect(parsed.evaluations[0].score).toBe(8);
  });
});
```

**tests/integration/parallel-execution.test.ts**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createMockAnthropicClient } from "../mocks/anthropic.js";

describe("Parallel Execution", () => {
  it("should execute multiple requests in parallel", async () => {
    const mockClient = createMockAnthropicClient();
    const startTime = Date.now();

    // Simulate 3 parallel requests
    const personas = ["Skeptic", "Realist", "First Principles"];

    const challenges = await Promise.all(
      personas.map((persona) =>
        mockClient.messages.create({
          model: "claude-opus-4-5-20251101",
          max_tokens: 512,
          system: `You are the ${persona}.`,
          messages: [{ role: "user", content: "Challenge this claim" }],
        }),
      ),
    );

    const duration = Date.now() - startTime;

    expect(challenges).toHaveLength(3);
    // In real scenario, parallel should be faster than sequential
    // With mocks, just verify all completed
    challenges.forEach((c) => {
      expect(c.content[0].type).toBe("text");
    });
  });
});
```

**tests/integration/database.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";

describe("SQLite Database", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE ideas (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        score REAL
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("should create table and insert data", () => {
    db.prepare("INSERT INTO ideas VALUES (?, ?, ?, ?)").run(
      "idea-1",
      "solar-charger",
      "Solar Charger",
      7.5,
    );

    const row = db.prepare("SELECT * FROM ideas WHERE id = ?").get("idea-1");

    expect(row).toBeDefined();
    expect(row.title).toBe("Solar Charger");
    expect(row.score).toBe(7.5);
  });

  it("should enforce unique slug constraint", () => {
    db.prepare("INSERT INTO ideas VALUES (?, ?, ?, ?)").run(
      "idea-1",
      "solar-charger",
      "Solar Charger",
      7.5,
    );

    expect(() => {
      db.prepare("INSERT INTO ideas VALUES (?, ?, ?, ?)").run(
        "idea-2",
        "solar-charger",
        "Another Solar Charger",
        8.0,
      );
    }).toThrow();
  });
});
```

---

## 5. Phase 1: Core Infrastructure

### Files to Create

| File                                         | Purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| `CLAUDE.md`                                  | Project-wide Claude Code instructions       |
| `config/default.ts`                          | Default configuration                       |
| `config/index.ts`                            | Config loader                               |
| `database/schema.sql`                        | Full SQLite schema (for reference)          |
| `database/db.ts`                             | Database connection and helpers             |
| `database/migrate.ts`                        | Migration runner                            |
| `database/migrations/001_initial_schema.sql` | Initial schema migration                    |
| `scripts/cli.ts`                             | Main CLI entry point                        |
| `scripts/sync.ts`                            | Markdown ↔ SQLite sync with hash comparison |
| `utils/logger.ts`                            | Logging with levels and transports          |
| `utils/parser.ts`                            | Markdown/YAML frontmatter parsing           |
| `taxonomy/evaluation-criteria.md`            | **Single source of truth for criteria**     |
| `taxonomy/lifecycle-stages.md`               | All 19 lifecycle stages                     |
| `taxonomy/idea-types.md`                     | Domain categories                           |
| `taxonomy/tags.md`                           | Controlled vocabulary                       |
| `.claude/skills/idea-capture/SKILL.md`       | Basic capture skill                         |

### Database Migrations

```
database/
├── migrations/
│   ├── 001_initial_schema.sql    # Core tables
│   ├── 002_add_cost_log.sql      # Cost tracking
│   └── 003_add_content_hash.sql  # Staleness detection
├── schema.sql                     # Full schema reference
├── db.ts                          # Connection helper
└── migrate.ts                     # Migration runner
```

**Migration Runner**:

```typescript
// database/migrate.ts
export async function runMigrations(): Promise<void> {
  const db = getDb();

  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get applied migrations
  const applied = db
    .prepare("SELECT name FROM _migrations")
    .all()
    .map((r: any) => r.name);

  // Get migration files
  const files = glob.sync("database/migrations/*.sql").sort();

  // Apply pending migrations
  for (const file of files) {
    const name = path.basename(file);
    if (applied.includes(name)) continue;

    console.log(`Applying migration: ${name}`);
    const sql = fs.readFileSync(file, "utf-8");
    db.exec(sql);

    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(name);
  }

  console.log("Migrations complete.");
}
```

**CLI Command**:

```bash
npm run migrate        # Apply pending migrations
npm run migrate:status # Show migration status
```

### CLAUDE.md (Root Project File)

````markdown
# Idea Incubator - Claude Code Instructions

## Project Overview

This is an idea incubation system that uses AI agents to evaluate and red-team ideas.

## Skills Available

- `/idea-capture` - Create a new idea folder with template
- `/idea-develop` - Flesh out an idea with questions
- `/idea-evaluate` - Score against 30 criteria
- `/idea-redteam` - Challenge assumptions
- `/idea-organize` - Help with file organization

## Behavior Guidelines

1. **Always confirm idea context** - If discussing an idea, confirm which one before making changes
2. **Reference taxonomy** - Use lifecycle stages and criteria from `taxonomy/` folder
3. **Proactive questioning** - After capturing an idea, ask 3 clarifying questions
4. **Update database** - Remind user to run `npm run sync` after file changes

## File Locations

- Ideas: `ideas/[slug]/README.md`
- Evaluations: `ideas/[slug]/evaluation.md`
- Database: `database/ideas.db`

## Common Commands

```bash
npm run cli capture    # Capture new idea
npm run sync           # Sync markdown to database
npm run evaluate <slug>  # Run AI evaluation
```
````

````

### config/default.ts

```typescript
export const config = {
  // Model settings
  model: 'claude-opus-4-5-20251101',
  maxTokens: 4096,

  // Budget
  budget: {
    default: 10.00,
    max: 50.00
  },

  // Debate configuration
  debate: {
    challengesPerCriterion: 5,
    roundsPerChallenge: 3,
    maxRounds: 5,
    maxDuration: 300000 // 5 minutes
  },

  // Convergence criteria
  convergence: {
    scoreStability: {
      maxDelta: 0.5,
      consecutiveRounds: 2
    },
    confidenceThreshold: {
      minimum: 0.7,
      critical: 0.8
    }
  },

  // Score aggregation weights
  categoryWeights: {
    problem: 0.20,
    solution: 0.20,
    feasibility: 0.15,
    fit: 0.15,
    market: 0.15,
    risk: 0.15
  },

  // Logging
  logging: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    transport: 'console' // 'console' | 'websocket'
  },

  // Paths
  paths: {
    ideas: './ideas',
    database: './database/ideas.db',
    templates: './templates'
  }
};

export type Config = typeof config;
````

### taxonomy/evaluation-criteria.md (SINGLE SOURCE OF TRUTH)

```markdown
# Evaluation Criteria

> **AUTHORITATIVE**: This file is the single source of truth for all 30 evaluation criteria.
> All code must import criteria definitions from this file or its parsed equivalent.

## Categories

### Problem/Opportunity Quality (5 criteria)

| ID  | Criterion           | Question                               | Score Guide                           |
| --- | ------------------- | -------------------------------------- | ------------------------------------- |
| P1  | Problem Clarity     | Is the problem well-defined?           | 10=Crystal clear, 1=Vague             |
| P2  | Problem Severity    | How painful is the problem?            | 10=Unbearable, 1=Trivial              |
| P3  | Target User Clarity | Who specifically is affected?          | 10=Precise persona, 1=Everyone        |
| P4  | Problem Validation  | Has it been validated with real users? | 10=Extensive validation, 1=Assumption |
| P5  | Problem Uniqueness  | Is this a novel problem?               | 10=Unaddressed, 1=Saturated solutions |

### Solution Quality (5 criteria)

| ID  | Criterion              | Question                               | Score Guide                       |
| --- | ---------------------- | -------------------------------------- | --------------------------------- |
| S1  | Solution Clarity       | Is the solution well-articulated?      | 10=Detailed spec, 1=Vague concept |
| S2  | Solution Feasibility   | Can it actually be built?              | 10=Proven tech, 1=Sci-fi          |
| S3  | Solution Uniqueness    | How differentiated from alternatives?  | 10=First of kind, 1=Me-too        |
| S4  | Solution Scalability   | Can it grow without proportional cost? | 10=Infinite scale, 1=Linear cost  |
| S5  | Solution Defensibility | Can it be protected?                   | 10=Strong moat, 1=Easily copied   |

### Feasibility (5 criteria)

| ID  | Criterion             | Question                      | Score Guide                 |
| --- | --------------------- | ----------------------------- | --------------------------- |
| F1  | Technical Complexity  | How hard to build?            | 10=Trivial, 1=Impossible    |
| F2  | Resource Requirements | Cost in time/money/people     | 10=Minimal, 1=Massive       |
| F3  | Skill Availability    | Do I have needed skills?      | 10=Expert, 1=No clue        |
| F4  | Time to Value         | How long until first results? | 10=Days, 1=Years            |
| F5  | Dependency Risk       | Reliance on external factors  | 10=Independent, 1=Dependent |

### Strategic Fit (5 criteria)

| ID  | Criterion         | Question              | Score Guide                         |
| --- | ----------------- | --------------------- | ----------------------------------- |
| FT1 | Personal Fit      | Fits with goals?      | 10=Perfect alignment, 1=Conflict    |
| FT2 | Passion Alignment | How excited am I?     | 10=Obsessed, 1=Indifferent          |
| FT3 | Skill Match       | Leverages my skills?  | 10=Core strength, 1=Weakness        |
| FT4 | Network Leverage  | Can I use my network? | 10=Strong connections, 1=Cold start |
| FT5 | Life Stage Fit    | Right moment?         | 10=Perfect timing, 1=Wrong phase    |

### Market/External Factors (5 criteria)

| ID  | Criterion             | Question                 | Score Guide                         |
| --- | --------------------- | ------------------------ | ----------------------------------- |
| M1  | Market Size           | Total addressable market | 10=Huge TAM, 1=Tiny niche           |
| M2  | Market Growth         | Is the market expanding? | 10=Explosive, 1=Declining           |
| M3  | Competition Intensity | How crowded?             | 10=Blue ocean, 1=Red ocean          |
| M4  | Entry Barriers        | Barriers to entry        | 10=Easy entry, 1=Fortress           |
| M5  | Timing                | Is the market ready?     | 10=Perfect moment, 1=Too early/late |

### Risk Assessment (5 criteria)

| ID  | Criterion       | Question                     | Score Guide                      |
| --- | --------------- | ---------------------------- | -------------------------------- |
| R1  | Execution Risk  | Risk of failing to build     | 10=Low risk, 1=High risk         |
| R2  | Market Risk     | Risk of no market            | 10=Proven demand, 1=Unproven     |
| R3  | Technical Risk  | Risk of technical failure    | 10=Proven tech, 1=Bleeding edge  |
| R4  | Financial Risk  | Risk of running out of money | 10=Self-funded, 1=Burn rate      |
| R5  | Regulatory Risk | Legal/compliance concerns    | 10=Clear path, 1=Legal minefield |

## Composite Score Calculation
```

Overall Score = (
Problem Score × 0.20 +
Solution Score × 0.20 +
Feasibility Score × 0.15 +
Fit Score × 0.15 +
Market Score × 0.15 +
Risk Score × 0.15
)

```

## Confidence Calculation

```

Confidence = (
(challenges_defended / total_challenges) × 0.4 +
(first_principles_bonuses / total_exchanges) × 0.2 +
(1 - score_volatility) × 0.2 +
information_completeness × 0.2
)

```

```

### .claude/skills/idea-capture/SKILL.md

```yaml
---
name: idea-capture
description: Creates structured folders for new ideas. Use when user says "I have an idea", "new idea", "what if we", "concept for", describes an opportunity, or wants to capture a thought.
---

# Idea Capture Skill

## When to Activate

This skill activates when the user:
- Says "I have an idea for..."
- Says "What if we..."
- Describes a new concept or opportunity
- Wants to capture a thought before it's lost

## Instructions

1. **Extract idea essence**
   - Identify the core concept from user's message
   - Generate a kebab-case slug from the title

2. **Create folder structure**
```

ideas/[slug]/
├── README.md
├── research/
├── notes/
└── assets/

```

3. **Populate README.md**
- Use template from `templates/idea.md`
- Fill in frontmatter with extracted info
- Set lifecycle stage to `SPARK`

4. **Ask 3 clarifying questions**
After creation, ask:
- "Who specifically would benefit from this?"
- "What's the core problem this solves?"
- "What's the simplest version that would be useful?"

5. **Remind about sync**
- Tell user: "Run `npm run sync` to update the database"

## Template Location

Use `templates/idea.md` for the README template.

## Example

User: "I have an idea for an app that helps people track their houseplants"

Response:
1. Create `ideas/houseplant-tracker/`
2. Populate README with:
- title: "Houseplant Tracker"
- type: "technical" (it's an app)
- stage: "SPARK"
3. Ask clarifying questions
```

### database/schema.sql (Updated)

```sql
-- Core ideas table
CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    idea_type TEXT CHECK(idea_type IN ('business', 'creative', 'technical', 'personal', 'research')),
    lifecycle_stage TEXT DEFAULT 'SPARK',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    folder_path TEXT NOT NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT
);

CREATE TABLE IF NOT EXISTS idea_tags (
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);

-- Relationships between ideas
CREATE TABLE IF NOT EXISTS idea_relationships (
    source_idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    target_idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    relationship_type TEXT CHECK(relationship_type IN
        ('parent', 'child', 'related', 'combines', 'conflicts', 'inspired_by')),
    strength TEXT CHECK(strength IN ('strong', 'medium', 'weak')),
    notes TEXT,
    PRIMARY KEY (source_idea_id, target_idea_id, relationship_type)
);

-- Individual criterion evaluations
CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT NOT NULL,
    criterion TEXT NOT NULL,
    category TEXT NOT NULL,
    agent_score INTEGER CHECK(agent_score >= 1 AND agent_score <= 10),
    user_score INTEGER CHECK(user_score >= 1 AND user_score <= 10),
    final_score INTEGER CHECK(final_score >= 1 AND final_score <= 10),
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
    reasoning TEXT,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Debate transcripts
CREATE TABLE IF NOT EXISTS debate_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    criterion TEXT NOT NULL,
    challenge_number INTEGER NOT NULL,
    evaluator_claim TEXT,
    redteam_persona TEXT,
    redteam_challenge TEXT,
    evaluator_defense TEXT,
    arbiter_verdict TEXT CHECK(arbiter_verdict IN ('EVALUATOR', 'RED_TEAM', 'DRAW')),
    first_principles_bonus BOOLEAN DEFAULT FALSE,
    score_adjustment INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Red team log (persistent history)
CREATE TABLE IF NOT EXISTS redteam_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT,
    persona TEXT NOT NULL,
    challenge TEXT NOT NULL,
    response TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'ADDRESSED')),
    verdict TEXT CHECK(verdict IN ('EVALUATOR', 'RED_TEAM', 'DRAW')),
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Development log (Q&A history)
CREATE TABLE IF NOT EXISTS development_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL,
    question TEXT,
    answer TEXT,
    source TEXT CHECK(source IN ('user', 'ai', 'research')),
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Final synthesis documents (immutable after creation)
CREATE TABLE IF NOT EXISTS final_syntheses (
    id TEXT PRIMARY KEY,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_rounds INTEGER NOT NULL,
    overall_score REAL NOT NULL,
    overall_confidence REAL NOT NULL,
    redteam_survival_rate REAL NOT NULL,
    recommendation TEXT CHECK(recommendation IN ('PURSUE', 'REFINE', 'PAUSE', 'ABANDON')),
    recommendation_reasoning TEXT,
    executive_summary TEXT,
    key_strengths TEXT, -- JSON array
    key_weaknesses TEXT, -- JSON array
    critical_assumptions TEXT, -- JSON array
    unresolved_questions TEXT, -- JSON array
    full_document TEXT, -- JSON blob of complete FinalSynthesisDocument
    lock_reason TEXT CHECK(lock_reason IN ('CONVERGENCE', 'MAX_ROUNDS', 'USER_APPROVED', 'TIMEOUT', 'BUDGET_EXCEEDED')),
    locked BOOLEAN DEFAULT TRUE
);

-- Cost tracking
CREATE TABLE IF NOT EXISTS cost_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_run_id TEXT NOT NULL,
    idea_id TEXT REFERENCES ideas(id),
    operation TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    estimated_cost REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ideas_lifecycle ON ideas(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_ideas_type ON ideas(idea_type);
CREATE INDEX IF NOT EXISTS idx_evaluations_idea ON evaluations(idea_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_run ON evaluations(evaluation_run_id);
CREATE INDEX IF NOT EXISTS idx_debate_idea ON debate_rounds(idea_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_idea ON final_syntheses(idea_id);
CREATE INDEX IF NOT EXISTS idx_cost_run ON cost_log(evaluation_run_id);

-- Composite score view
CREATE VIEW IF NOT EXISTS idea_scores AS
SELECT
    i.id,
    i.slug,
    i.title,
    i.lifecycle_stage,
    AVG(e.final_score) as avg_score,
    AVG(e.confidence) as avg_confidence,
    COUNT(DISTINCT e.evaluation_run_id) as evaluation_count,
    MAX(e.evaluated_at) as last_evaluated
FROM ideas i
LEFT JOIN evaluations e ON i.id = e.idea_id
GROUP BY i.id;

-- Category score view
CREATE VIEW IF NOT EXISTS idea_category_scores AS
SELECT
    e.idea_id,
    e.evaluation_run_id,
    e.category,
    AVG(e.final_score) as category_score,
    AVG(e.confidence) as category_confidence
FROM evaluations e
GROUP BY e.idea_id, e.evaluation_run_id, e.category;
```

### utils/logger.ts (Updated with Levels)

```typescript
import chalk from "chalk";

type LogLevel = "debug" | "info" | "warn" | "error";
type Transport = "console" | "websocket";

interface LoggerConfig {
  level: LogLevel;
  transport: Transport;
  websocketUrl?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const config: LoggerConfig = {
  level: "info",
  transport: "console",
};

export function setLogLevel(level: LogLevel): void {
  config.level = level;
}

export function setTransport(
  transport: Transport,
  options?: { websocketUrl?: string },
): void {
  config.transport = transport;
  if (options?.websocketUrl) {
    config.websocketUrl = options.websocketUrl;
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

export function logDebug(message: string, context?: object): void {
  if (!shouldLog("debug")) return;
  console.log(
    chalk.gray(`[DEBUG]`),
    message,
    context ? JSON.stringify(context) : "",
  );
}

export function logInfo(message: string): void {
  if (!shouldLog("info")) return;
  console.log(chalk.blue(`[INFO]`), message);
}

export function logSuccess(message: string): void {
  if (!shouldLog("info")) return;
  console.log(chalk.green(`[SUCCESS]`), message);
}

export function logWarning(message: string): void {
  if (!shouldLog("warn")) return;
  console.warn(chalk.yellow(`[WARN]`), message);
}

export function logError(message: string, error?: Error): void {
  if (!shouldLog("error")) return;
  console.error(chalk.red(`[ERROR]`), message);
  if (error && config.level === "debug") {
    console.error(error.stack);
  }
}

export function logDebate(
  agent: string,
  message: string,
  type: "claim" | "challenge" | "defense" | "verdict",
): void {
  if (!shouldLog("info")) return;

  const timestamp = new Date().toISOString();
  const colors = {
    claim: chalk.blue,
    challenge: chalk.red,
    defense: chalk.green,
    verdict: chalk.yellow,
  };

  if (config.transport === "console") {
    console.log(colors[type](`[${agent}]`), message);
  }

  // WebSocket transport for Phase 6
  if (config.transport === "websocket" && config.websocketUrl) {
    // TODO: Implement WebSocket broadcast
  }
}

export function logCost(report: {
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  remaining: number;
}): void {
  if (!shouldLog("info")) return;
  console.log(
    chalk.magenta(`[COST]`),
    `${report.operation}: ${report.inputTokens}in/${report.outputTokens}out`,
    `$${report.cost.toFixed(4)} (remaining: $${report.remaining.toFixed(2)})`,
  );
}
```

---

## 6. Phase 2: Idea Capture & Storage

### Files to Create

| File                                   | Purpose                                    |
| -------------------------------------- | ------------------------------------------ |
| `templates/idea.md`                    | Default idea template                      |
| `templates/evaluation.md`              | Evaluation results template                |
| `scripts/capture.ts`                   | Idea capture CLI command                   |
| `scripts/sync.ts`                      | Markdown ↔ SQLite synchronization          |
| `agents/development.ts`                | Development agent for clarifying questions |
| `ideas/_index.md`                      | Auto-generated master index                |
| `.claude/skills/idea-develop/SKILL.md` | Development skill                          |

### agents/development.ts

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { CostTracker } from "../utils/cost-tracker.js";
import { logDebate, logDebug } from "../utils/logger.js";

const client = new Anthropic();

const DEVELOPMENT_SYSTEM_PROMPT = `You are a Development Agent for idea incubation.

Your job is to ask probing questions that help flesh out raw ideas. You should:

1. Identify gaps in the idea description
2. Ask about target users, problems, and solutions
3. Probe assumptions
4. Suggest areas that need more research

Ask 3-5 focused questions at a time. Don't overwhelm the user.

After the user answers, record insights and identify next gaps.`;

export interface DevelopmentQuestion {
  category: "user" | "problem" | "solution" | "market" | "execution";
  question: string;
  priority: "critical" | "important" | "nice-to-have";
}

export interface DevelopmentResult {
  questions: DevelopmentQuestion[];
  gaps: string[];
  suggestions: string[];
}

export async function analyzeIdeaGaps(
  ideaContent: string,
  costTracker: CostTracker,
): Promise<DevelopmentResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 1024,
    system: DEVELOPMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this idea and identify gaps that need clarification:

${ideaContent}

Respond in JSON:
{
  "questions": [
    {"category": "user|problem|solution|market|execution", "question": "...", "priority": "critical|important|nice-to-have"}
  ],
  "gaps": ["List of missing information"],
  "suggestions": ["Suggestions for strengthening the idea"]
}`,
      },
    ],
  });

  costTracker.track(response.usage);

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse development JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function generateFollowUpQuestions(
  ideaContent: string,
  previousQA: Array<{ question: string; answer: string }>,
  costTracker: CostTracker,
): Promise<DevelopmentQuestion[]> {
  const qaHistory = previousQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 512,
    system: DEVELOPMENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Idea:
${ideaContent}

Previous Q&A:
${qaHistory}

Based on the answers so far, what are the next 3 most important questions to ask?

Respond in JSON:
{
  "questions": [
    {"category": "...", "question": "...", "priority": "..."}
  ]
}`,
      },
    ],
  });

  costTracker.track(response.usage);

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse follow-up JSON");
  }

  return JSON.parse(jsonMatch[0]).questions;
}
```

---

## 7. Phase 3: Single-Agent Evaluation

### Files to Create

| File                     | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `agents/config.ts`       | Criteria definitions (imports from taxonomy) |
| `agents/evaluator.ts`    | Generalist evaluator agent                   |
| `agents/orchestrator.ts` | Routes inputs, manages flow                  |
| `agents/classifier.ts`   | Auto-tags and detects relationships          |
| `scripts/evaluate.ts`    | Evaluation CLI command                       |
| `scripts/review.ts`      | User review/override CLI                     |

### agents/config.ts (Imports from Taxonomy)

```typescript
// Criteria definitions - MUST match taxonomy/evaluation-criteria.md
export const EVALUATION_CRITERIA = {
  problem: [
    "Problem Clarity",
    "Problem Severity",
    "Target User Clarity",
    "Problem Validation",
    "Problem Uniqueness",
  ],
  solution: [
    "Solution Clarity",
    "Solution Feasibility",
    "Solution Uniqueness",
    "Solution Scalability",
    "Solution Defensibility",
  ],
  feasibility: [
    "Technical Complexity",
    "Resource Requirements",
    "Skill Availability",
    "Time to Value",
    "Dependency Risk",
  ],
  fit: [
    "Personal Fit",
    "Passion Alignment",
    "Skill Match",
    "Network Leverage",
    "Life Stage Fit",
  ],
  market: [
    "Market Size",
    "Market Growth",
    "Competition Intensity",
    "Entry Barriers",
    "Timing",
  ],
  risk: [
    "Execution Risk",
    "Market Risk",
    "Technical Risk",
    "Financial Risk",
    "Regulatory Risk",
  ],
} as const;

export const ALL_CRITERIA = Object.values(EVALUATION_CRITERIA).flat();

// Verify we have exactly 30 criteria
if (ALL_CRITERIA.length !== 30) {
  throw new Error(`Expected 30 criteria, got ${ALL_CRITERIA.length}`);
}

export const LIFECYCLE_STAGES = [
  "SPARK",
  "CLARIFY",
  "RESEARCH",
  "IDEATE",
  "EVALUATE",
  "VALIDATE",
  "DESIGN",
  "PROTOTYPE",
  "TEST",
  "REFINE",
  "BUILD",
  "LAUNCH",
  "GROW",
  "MAINTAIN",
  "PIVOT",
  "PAUSE",
  "SUNSET",
  "ARCHIVE",
  "ABANDONED",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
export type Category = keyof typeof EVALUATION_CRITERIA;
```

### agents/orchestrator.ts

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../database/db.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logInfo, logDebug } from "../utils/logger.js";

const client = new Anthropic();

export type IdeaClassification = "NEW" | "EXISTING" | "AMBIGUOUS";

export interface ClassificationResult {
  type: IdeaClassification;
  matchedSlug?: string;
  candidates?: Array<{ slug: string; title: string; similarity: number }>;
  reasoning: string;
}

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the Idea Incubator orchestrator.

Your job is to determine if user input is:
1. A NEW idea (never seen before)
2. Related to an EXISTING idea (should be linked or merged)
3. AMBIGUOUS (could be either - need to ask user)

You have access to the list of existing ideas. Compare the user's input against them.

Respond in JSON:
{
  "type": "NEW" | "EXISTING" | "AMBIGUOUS",
  "matchedSlug": "slug-if-existing",
  "candidates": [{"slug": "...", "title": "...", "similarity": 0.0-1.0}],
  "reasoning": "Why this classification"
}`;

export async function classifyInput(
  userInput: string,
  costTracker: CostTracker,
): Promise<ClassificationResult> {
  // Get existing ideas
  const db = getDb();
  const existingIdeas = db
    .prepare("SELECT slug, title, summary FROM ideas")
    .all();

  const existingList = existingIdeas
    .map((i: any) => `- ${i.slug}: "${i.title}" - ${i.summary || "No summary"}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 512,
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `User input: "${userInput}"

Existing ideas:
${existingList || "(none)"}

Classify this input.`,
      },
    ],
  });

  costTracker.track(response.usage);

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse orchestrator JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export async function routeToWorkflow(
  classification: ClassificationResult,
  userInput: string,
): Promise<{ action: string; ideaSlug?: string }> {
  switch (classification.type) {
    case "NEW":
      logInfo("Creating new idea...");
      return { action: "CREATE_NEW" };

    case "EXISTING":
      logInfo(`Linking to existing idea: ${classification.matchedSlug}`);
      return { action: "LINK_EXISTING", ideaSlug: classification.matchedSlug };

    case "AMBIGUOUS":
      logInfo("Need user clarification...");
      return { action: "ASK_USER" };

    default:
      throw new Error(`Unknown classification type: ${classification.type}`);
  }
}
```

### agents/classifier.ts

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../database/db.js";
import { CostTracker } from "../utils/cost-tracker.js";

const client = new Anthropic();

export interface ClassificationTags {
  domain: "business" | "creative" | "technical" | "personal" | "research";
  tags: string[];
  relationships: Array<{
    targetSlug: string;
    type:
      | "parent"
      | "child"
      | "related"
      | "combines"
      | "conflicts"
      | "inspired_by";
    strength: "strong" | "medium" | "weak";
    reasoning: string;
  }>;
}

const CLASSIFIER_SYSTEM_PROMPT = `You classify ideas for organization and discovery.

Assign:
1. Primary domain: business, creative, technical, personal, research
2. Tags: 3-7 relevant keywords
3. Relationships to other ideas (if any exist)

Respond in JSON:
{
  "domain": "...",
  "tags": ["tag1", "tag2"],
  "relationships": [
    {"targetSlug": "...", "type": "related|parent|child|combines|conflicts|inspired_by", "strength": "strong|medium|weak", "reasoning": "..."}
  ]
}`;

export async function classifyIdea(
  ideaContent: string,
  ideaSlug: string,
  costTracker: CostTracker,
): Promise<ClassificationTags> {
  // Get existing ideas for relationship detection
  const db = getDb();
  const existingIdeas = db
    .prepare("SELECT slug, title, summary FROM ideas WHERE slug != ?")
    .all(ideaSlug);

  const existingList = existingIdeas
    .map((i: any) => `- ${i.slug}: "${i.title}"`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-5-20251101",
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Classify this idea:

${ideaContent}

Existing ideas for relationship detection:
${existingList || "(none)"}

The current idea's slug is: ${ideaSlug}`,
      },
    ],
  });

  costTracker.track(response.usage);

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse classifier JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

export function saveClassification(
  ideaId: string,
  classification: ClassificationTags,
): void {
  const db = getDb();

  // Update idea type
  db.prepare("UPDATE ideas SET idea_type = ? WHERE id = ?").run(
    classification.domain,
    ideaId,
  );

  // Add tags
  for (const tagName of classification.tags) {
    // Insert tag if not exists
    db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(tagName);

    // Get tag id
    const tag = db
      .prepare("SELECT id FROM tags WHERE name = ?")
      .get(tagName) as any;

    // Link to idea
    db.prepare(
      "INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)",
    ).run(ideaId, tag.id);
  }

  // Add relationships
  for (const rel of classification.relationships) {
    const targetIdea = db
      .prepare("SELECT id FROM ideas WHERE slug = ?")
      .get(rel.targetSlug) as any;

    if (targetIdea) {
      db.prepare(
        `
        INSERT OR REPLACE INTO idea_relationships
        (source_idea_id, target_idea_id, relationship_type, strength, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(ideaId, targetIdea.id, rel.type, rel.strength, rel.reasoning);
    }
  }
}
```

---

## 8. Phase 4: Multi-Agent Debate System

### Files to Create

| File                | Purpose                      |
| ------------------- | ---------------------------- |
| `agents/redteam.ts` | Red Team personas (3 for v1) |
| `agents/arbiter.ts` | Debate arbiter               |
| `agents/debate.ts`  | Debate orchestration         |
| `scripts/debate.ts` | Debate CLI command           |

### Key Updates from Gap Analysis

1. **Cost tracking integrated** - Every API call tracked
2. **Zod validation** - All responses validated
3. **Error handling** - Retry logic and graceful degradation
4. **3 personas for v1** - Skeptic, Realist, First Principles Purist

(See IMPLEMENTATION-PLAN.md original content for full implementations, updated with Zod schemas and cost tracking)

---

## 9. Phase 5: Finite Synthesis Protocol

### Files to Create

| File                           | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `agents/synthesis.ts`          | Synthesis agent                          |
| `agents/convergence.ts`        | Convergence detection with full criteria |
| `scripts/synthesize.ts`        | Synthesis CLI command                    |
| `templates/final-synthesis.md` | Output template                          |

### agents/convergence.ts (Complete Implementation)

```typescript
import { config } from "../config/default.js";

export interface ConvergenceState {
  round: number;
  scores: Map<string, number[]>; // criterion -> history of scores
  confidence: Map<string, number[]>; // criterion -> history of confidence
  challengeStats: {
    total: number;
    defended: number;
    critical: number;
    criticalResolved: number;
  };
  insights: string[];
  hasConverged: boolean;
  reason?: "SCORE_STABILITY" | "MAX_ROUNDS" | "TIMEOUT" | "BUDGET_EXCEEDED";
}

export interface ConvergenceResult {
  converged: boolean;
  reason?: string;
  blockers: string[];
  metrics: {
    scoreStability: boolean;
    confidenceMet: boolean;
    challengesResolved: boolean;
    informationSaturated: boolean;
  };
}

export function initConvergenceState(): ConvergenceState {
  return {
    round: 0,
    scores: new Map(),
    confidence: new Map(),
    challengeStats: {
      total: 0,
      defended: 0,
      critical: 0,
      criticalResolved: 0,
    },
    insights: [],
    hasConverged: false,
  };
}

export function checkConvergence(state: ConvergenceState): ConvergenceResult {
  const criteria = config.convergence;
  const blockers: string[] = [];

  // 1. Check score stability
  let scoreStable = true;
  for (const [criterion, history] of state.scores) {
    if (history.length >= criteria.scoreStability.consecutiveRounds) {
      const recent = history.slice(-criteria.scoreStability.consecutiveRounds);
      const delta = Math.max(...recent) - Math.min(...recent);
      if (delta > criteria.scoreStability.maxDelta) {
        scoreStable = false;
        blockers.push(
          `Score for "${criterion}" still volatile (Δ=${delta.toFixed(2)})`,
        );
      }
    } else {
      scoreStable = false;
    }
  }

  // 2. Check confidence threshold
  let confidenceMet = true;
  for (const [criterion, history] of state.confidence) {
    const latest = history[history.length - 1];
    if (latest < criteria.confidenceThreshold.minimum) {
      confidenceMet = false;
      blockers.push(
        `Confidence for "${criterion}" below threshold (${(latest * 100).toFixed(0)}%)`,
      );
    }
  }

  // 3. Check challenge resolution
  const challengesResolved =
    state.challengeStats.criticalResolved >= state.challengeStats.critical &&
    state.challengeStats.defended / Math.max(1, state.challengeStats.total) >=
      0.8;

  if (!challengesResolved) {
    const survivalRate =
      state.challengeStats.defended / Math.max(1, state.challengeStats.total);
    blockers.push(
      `Challenge survival rate ${(survivalRate * 100).toFixed(0)}% (need 80%)`,
    );
  }

  // 4. Check information saturation
  const recentInsights = state.insights.slice(-5);
  const uniqueInsights = new Set(recentInsights).size;
  const informationSaturated = uniqueInsights < 2;

  // 5. Check hard limits
  const maxRoundsReached = state.round >= config.debate.maxRounds;

  const converged =
    (scoreStable && confidenceMet && challengesResolved) ||
    maxRoundsReached ||
    informationSaturated;

  let reason: string | undefined;
  if (converged) {
    if (maxRoundsReached) reason = "MAX_ROUNDS";
    else if (scoreStable && confidenceMet && challengesResolved)
      reason = "CONVERGENCE";
    else if (informationSaturated) reason = "INFORMATION_SATURATED";
  }

  return {
    converged,
    reason,
    blockers,
    metrics: {
      scoreStability: scoreStable,
      confidenceMet,
      challengesResolved,
      informationSaturated,
    },
  };
}

export function updateConvergenceState(
  state: ConvergenceState,
  updates: {
    scores?: Map<string, number>;
    confidence?: Map<string, number>;
    challengeResult?: { defended: boolean; critical: boolean };
    insight?: string;
  },
): ConvergenceState {
  const newState = { ...state };

  if (updates.scores) {
    for (const [criterion, score] of updates.scores) {
      const history = newState.scores.get(criterion) || [];
      history.push(score);
      newState.scores.set(criterion, history);
    }
  }

  if (updates.confidence) {
    for (const [criterion, conf] of updates.confidence) {
      const history = newState.confidence.get(criterion) || [];
      history.push(conf);
      newState.confidence.set(criterion, history);
    }
  }

  if (updates.challengeResult) {
    newState.challengeStats.total++;
    if (updates.challengeResult.defended) {
      newState.challengeStats.defended++;
    }
    if (updates.challengeResult.critical) {
      newState.challengeStats.critical++;
      if (updates.challengeResult.defended) {
        newState.challengeStats.criticalResolved++;
      }
    }
  }

  if (updates.insight) {
    newState.insights.push(updates.insight);
  }

  return newState;
}

// Calculate confidence from debate outcomes
export function calculateConfidence(
  challengesDefended: number,
  totalChallenges: number,
  firstPrinciplesBonuses: number,
  totalExchanges: number,
  scoreVolatility: number, // 0-1, lower is better
  informationCompleteness: number, // 0-1
): number {
  if (totalChallenges === 0) return 0.5;

  const survivalComponent = (challengesDefended / totalChallenges) * 0.4;
  const rigorComponent =
    (firstPrinciplesBonuses / Math.max(1, totalExchanges)) * 0.2;
  const stabilityComponent = (1 - scoreVolatility) * 0.2;
  const completenessComponent = informationCompleteness * 0.2;

  return Math.min(
    1,
    Math.max(
      0,
      survivalComponent +
        rigorComponent +
        stabilityComponent +
        completenessComponent,
    ),
  );
}
```

### Evaluation History & Reopening

Synthesis documents are **immutable** after creation. To "reopen" an evaluation means creating a **new evaluation run** that references the previous one.

**Evaluation History Model**:

```
Idea: solar-charger
│
├── evaluation_run_001 (2025-12-01)
│   ├── Score: 6.5
│   ├── Status: SUPERSEDED
│   └── Superseded by: evaluation_run_002
│
├── evaluation_run_002 (2025-12-15)  ← Current
│   ├── Score: 7.2
│   ├── Status: CURRENT
│   └── Previous: evaluation_run_001
│
└── [Future evaluation would reference 002]
```

**Database Schema for History**:

```sql
-- Link evaluations in a chain
ALTER TABLE final_syntheses ADD COLUMN previous_run_id TEXT;
ALTER TABLE final_syntheses ADD COLUMN superseded_by TEXT;
ALTER TABLE final_syntheses ADD COLUMN status TEXT
  CHECK(status IN ('CURRENT', 'SUPERSEDED')) DEFAULT 'CURRENT';
```

**Reopening Flow**:

```bash
$ npm run evaluate solar-charger

This idea has an existing evaluation:
  Run: eval-2025-12-15-001
  Score: 7.2 (Confidence: 82%)
  Age: 6 days

Options:
  1. Create new evaluation (keeps history)
  2. View existing evaluation
  3. Cancel

Select (1-3): 1

Creating new evaluation run...
Previous evaluation will be marked as superseded.
```

**Synthesis Header with History**:

```markdown
---
evaluation_run_id: eval-2025-12-21-001
previous_evaluation: eval-2025-12-15-001
status: CURRENT
---

# Final Synthesis: Solar Charger

> Previous score: 7.2 → Current score: 7.8
```

---

## 10. Phase 6: Frontend & Visualization

### Files to Create

| File                                       | Purpose                           |
| ------------------------------------------ | --------------------------------- |
| `frontend/src/views/Dashboard.tsx`         | Overview with key metrics         |
| `frontend/src/views/IdeaDetail.tsx`        | Full single idea view             |
| `frontend/src/views/EvaluationMatrix.tsx`  | Heatmap of ideas vs criteria      |
| `frontend/src/views/LifecyclePipeline.tsx` | Kanban by lifecycle stage         |
| `frontend/src/views/RelationshipGraph.tsx` | Network visualization             |
| `frontend/src/views/GapAnalysis.tsx`       | Missing evaluations/questions     |
| `frontend/src/views/DebateViewer.tsx`      | Real-time debate viewer           |
| `frontend/src/views/Comparison.tsx`        | Side-by-side comparison (Phase 7) |
| `server/websocket.ts`                      | WebSocket server                  |

### Frontend View Specifications

**Dashboard.tsx**

- Total ideas count
- Ideas by lifecycle stage (pie chart)
- Top 5 ideas by score
- Recent evaluations
- Pending items (unevaluated ideas, unresolved challenges)

**IdeaDetail.tsx**

- Full idea content
- All 30 criteria scores with visual bars
- Debate history
- Red team challenges and responses
- Related ideas
- Development Q&A log

**EvaluationMatrix.tsx**

- Rows: Ideas
- Columns: 30 criteria grouped by category
- Cells: Color-coded scores (red-yellow-green)
- Filter by lifecycle, domain, score range

**LifecyclePipeline.tsx**

- Kanban columns for each lifecycle stage
- Drag-drop to change stage
- Quick score preview on cards

**RelationshipGraph.tsx**

- Force-directed graph
- Nodes: Ideas (sized by score)
- Edges: Relationships (colored by type)
- Click to view idea details

**GapAnalysis.tsx**

- Ideas without evaluations
- Criteria with low confidence
- Unresolved critical challenges
- Unanswered development questions

**DebateViewer.tsx**

- Real-time streaming transcript
- Evaluator vs Red Team panels
- Live score adjustments
- Arbiter verdicts

---

## 11. Phase 7: Enhancements & Scale

### Deferred Items

| Item                     | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| 6 Specialized Evaluators | Parallel Problem, Solution, Feasibility, Fit, Market, Risk agents |
| 6 Red Team Personas      | Add Competitor, Contrarian, Edge-Case Finder                      |
| Comparison View          | Side-by-side idea comparison                                      |
| Embeddings               | Semantic similarity for relationship detection                    |
| Mobile PWA               | Progressive web app for phone capture                             |
| Export/Import            | Backup and restore functionality                                  |

---

## 12. Execution Model

This section clarifies what runs in parallel vs sequential during evaluation.

### Phase 3: Initial Evaluation

**v1 (Single Generalist)**: Sequential

```
Evaluator Agent → Criterion 1 → Criterion 2 → ... → Criterion 30
```

**v2 (Six Specialists)**: Parallel

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Problem (5) │ │ Solution(5) │ │Feasibility5 │  PARALLEL
└─────────────┘ └─────────────┘ └─────────────┘
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Fit (5)     │ │ Market (5)  │ │ Risk (5)    │  PARALLEL
└─────────────┘ └─────────────┘ └─────────────┘
```

### Phase 4: Red Team & Debate

**Challenge Generation**: PARALLEL (across personas)

```
For each criterion:
┌───────────┐ ┌───────────┐ ┌─────────────────┐
│  Skeptic  │ │  Realist  │ │ First Principles│  ← PARALLEL
└───────────┘ └───────────┘ └─────────────────┘
```

**Debate Rounds**: SEQUENTIAL (within each challenge)

```
Challenge 1: Round 1 → Round 2 → Round 3  ─┐
Challenge 2: Round 1 → Round 2 → Round 3  ─┼─→ PARALLEL
Challenge 3: Round 1 → Round 2 → Round 3  ─┘
```

Each round is sequential (Challenge → Defense → Verdict), but multiple challenges can be debated in parallel since they're independent.

### Phase 5: Synthesis

**Strictly Sequential**: Must wait for all debates to complete

```
Wait for ALL debates → Convergence Check → Synthesis Agent → Lock & Save
```

### Implementation Pattern

```typescript
// Parallel challenge generation
const challenges = await Promise.all(
  PERSONAS.map((persona) => generateChallenge(persona, criterion, claim)),
);

// Parallel debate execution across challenges
const debateResults = await Promise.all(
  challenges.map(
    (challenge) => runDebateSequence(challenge), // Each debate is internally sequential
  ),
);

// Sequential synthesis (must wait for all debates)
await waitForAllDebates();
const synthesis = await runSynthesis(allDebateResults);
```

### Performance Implications

| Approach            | Wall Time | API Calls | Cost |
| ------------------- | --------- | --------- | ---- |
| Fully Sequential    | ~15 min   | Same      | Same |
| Parallel Challenges | ~5 min    | Same      | Same |

Parallelism reduces **time**, not **cost** (same total tokens).

---

## 13. File Specifications

### Complete File Tree

```
idea_incubator/
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── CLAUDE.md                       # Project-wide Claude instructions
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── IMPLEMENTATION-PLAN.md
│
├── config/
│   ├── default.ts                  # Default configuration
│   └── index.ts                    # Config loader
│
├── taxonomy/                       # Single source of truth
│   ├── evaluation-criteria.md
│   ├── lifecycle-stages.md
│   ├── idea-types.md
│   └── tags.md
│
├── tests/
│   ├── setup.ts
│   ├── unit/
│   │   ├── agents/
│   │   │   ├── evaluator.test.ts
│   │   │   ├── redteam.test.ts
│   │   │   ├── arbiter.test.ts
│   │   │   ├── synthesis.test.ts
│   │   │   └── convergence.test.ts
│   │   ├── database/
│   │   │   └── db.test.ts
│   │   └── utils/
│   │       ├── parser.test.ts
│   │       ├── schemas.test.ts
│   │       └── cost-tracker.test.ts
│   ├── integration/
│   │   ├── anthropic-client.test.ts
│   │   ├── parallel-execution.test.ts
│   │   ├── database.test.ts
│   │   ├── capture-flow.test.ts
│   │   └── evaluate-flow.test.ts
│   ├── mocks/
│   │   └── anthropic.ts
│   └── fixtures/
│       ├── ideas/
│       └── responses/
│
├── spikes/
│   ├── spike-0.1-agent-sdk.ts
│   ├── spike-0.2-parallel.ts
│   └── spike-0.3-sqlite.ts
│
├── database/
│   ├── schema.sql                  # Full schema reference
│   ├── db.ts                       # Connection helper
│   ├── migrate.ts                  # Migration runner
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_cost_log.sql
│   │   └── 003_add_content_hash.sql
│   └── ideas.db                    # SQLite file (gitignored)
│
├── agents/
│   ├── config.ts                   # Criteria definitions
│   ├── orchestrator.ts             # Input routing
│   ├── development.ts              # Development questions
│   ├── evaluator.ts                # Generalist evaluator
│   ├── classifier.ts               # Auto-tagging
│   ├── redteam.ts                  # Red team personas
│   ├── arbiter.ts                  # Debate arbiter
│   ├── debate.ts                   # Debate orchestration
│   ├── synthesis.ts                # Synthesis agent
│   └── convergence.ts              # Convergence detection
│
├── scripts/
│   ├── cli.ts                      # Main CLI entry
│   ├── capture.ts                  # Idea capture
│   ├── sync.ts                     # Markdown ↔ DB sync
│   ├── evaluate.ts                 # Run evaluation
│   ├── debate.ts                   # Run debate
│   ├── synthesize.ts               # Run synthesis
│   └── review.ts                   # User review/override
│
├── utils/
│   ├── logger.ts                   # Logging with levels
│   ├── parser.ts                   # Markdown parsing
│   ├── schemas.ts                  # Zod validation
│   ├── errors.ts                   # Custom errors
│   └── cost-tracker.ts             # Cost tracking
│
├── templates/
│   ├── idea.md
│   ├── evaluation.md
│   └── final-synthesis.md
│
├── ideas/
│   ├── _index.md                   # Auto-generated index
│   └── .gitkeep
│
├── .claude/
│   └── skills/
│       ├── idea-capture/
│       │   └── SKILL.md
│       ├── idea-develop/
│       │   ├── SKILL.md
│       │   └── question-bank.md
│       ├── idea-evaluate/
│       │   ├── SKILL.md
│       │   └── criteria-guide.md
│       ├── idea-redteam/
│       │   ├── SKILL.md
│       │   └── challenge-patterns.md
│       └── idea-organize/
│           └── SKILL.md
│
├── server/
│   ├── index.ts                   # Express server entry
│   ├── websocket.ts               # WebSocket for real-time debates
│   └── routes/
│       ├── ideas.ts               # GET/POST /api/ideas
│       ├── evaluations.ts         # GET /api/evaluations/:id
│       └── debates.ts             # GET /api/debates/:id (+ WebSocket)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── views/
        │   ├── Dashboard.tsx
        │   ├── IdeaDetail.tsx
        │   ├── EvaluationMatrix.tsx
        │   ├── LifecyclePipeline.tsx
        │   ├── RelationshipGraph.tsx
        │   ├── GapAnalysis.tsx
        │   ├── DebateViewer.tsx
        │   └── Comparison.tsx
        ├── components/
        ├── hooks/
        ├── api/
        └── types/
```

### File Count by Phase (Updated)

| Phase                   | New Files | Cumulative |
| ----------------------- | --------- | ---------- |
| 0 - Test Infrastructure | 10        | 10         |
| 1 - Infrastructure      | 15        | 25         |
| 2 - Capture             | 6         | 31         |
| 3 - Evaluation          | 6         | 37         |
| 4 - Debate              | 4         | 41         |
| 5 - Synthesis           | 4         | 45         |
| 6 - Frontend + Server   | ~25       | 70         |
| **Total**               | **~70**   |            |

_Phase 6 includes Express server (5 files) + React frontend (~20 files)_

---

## 14. Risk Register

| Risk                            | Impact   | Mitigation                                        | Status    |
| ------------------------------- | -------- | ------------------------------------------------- | --------- |
| **API costs exceed budget**     | High     | Cost tracker with enforcement, abort on threshold | Addressed |
| **Agent responses unparseable** | Medium   | Zod schemas, retry logic, fallback prompts        | Addressed |
| **Debates don't converge**      | Medium   | Hard round limits, timeout, forced synthesis      | Addressed |
| **SQLite concurrency issues**   | Low      | Single-user design, WAL mode, transactions        | Addressed |
| **Agent hallucinations**        | Medium   | First principles enforcement, Arbiter scrutiny    | Addressed |
| **Scope creep**                 | High     | Strict phase gates, v2 deferred items             | Addressed |
| **No tests**                    | Critical | Vitest setup in Phase 0                           | Addressed |
| **Criteria mismatch**           | High     | Single source of truth in taxonomy/               | Addressed |
| **Stale evaluations**           | Medium   | Hash-based detection, user notification           | Addressed |
| **Pivot confusion**             | Low      | Identity rules, user confirmation                 | Addressed |

---

## 15. Success Criteria

### Phase 0 Complete When:

- [x] Vitest configured and running
- [x] Mock Anthropic client working
- [x] Zod schemas defined
- [x] Error classes defined
- [x] Cost tracker implemented
- [ ] All spike tests pass

### Phase 1 Complete When:

- [ ] CLAUDE.md created
- [ ] Config system working
- [ ] Taxonomy files created
- [ ] Database initializes with full schema
- [ ] Basic idea-capture skill works
- [ ] Logger with levels working
- [ ] All unit tests pass

### Phase 2 Complete When:

- [ ] `npm run cli capture` creates idea folder
- [ ] Development agent asks follow-up questions
- [ ] Index auto-generates
- [ ] Classifier assigns tags
- [ ] Database syncs from markdown
- [ ] All integration tests pass

### Phase 3 Complete When:

- [ ] Orchestrator routes inputs correctly
- [ ] `npm run evaluate <slug>` returns scores
- [ ] All 30 criteria evaluated
- [ ] Scores validated with Zod
- [ ] Cost tracked per evaluation
- [ ] All tests pass

### Phase 4 Complete When:

- [ ] 3 Red Team personas generate challenges
- [ ] Evaluator defends claims
- [ ] Arbiter judges exchanges
- [ ] Scores adjust based on debate
- [ ] Budget enforcement works
- [ ] All tests pass

### Phase 5 Complete When:

- [ ] Convergence detected correctly
- [ ] Synthesis document generated
- [ ] Confidence calculated correctly
- [ ] Final document locked
- [ ] Re-evaluation triggers work
- [ ] All tests pass

### Phase 6 Complete When:

- [ ] All 7 views implemented
- [ ] WebSocket streaming works
- [ ] Leaderboard displays ideas
- [ ] Graph shows relationships
- [ ] Gap analysis highlights issues
- [ ] Debate streams in real-time

---

## Appendix: Quick Reference

### CLI Commands

```bash
# Phase 0
npm test                   # Run all tests
npm run test:coverage      # Run with coverage

# Phase 1
npm run cli                # Start CLI

# Phase 2
npm run cli capture        # Capture new idea
npm run sync               # Sync markdown ↔ DB

# Phase 3
npm run evaluate <slug>    # Evaluate idea

# Phase 4
npm run debate <slug>      # Run debate

# Phase 5
npm run synthesize <slug>  # Generate final synthesis

# Phase 6
npm run dev                # Start frontend
```

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...   # Required
IDEA_INCUBATOR_DB=./database/ideas.db
IDEA_INCUBATOR_LOG_LEVEL=info  # debug|info|warn|error
IDEA_INCUBATOR_BUDGET=10       # Default budget in dollars
```

---

**Document Status**: Updated with all gap remediations, agent orchestration framework, content hash mechanism, and TDD contract specifications. Ready for implementation.

---

## Appendix B: Agent Orchestration Framework Implementation

> **Reference**: See ARCHITECTURE.md Appendix G for full design details.

### B.1 New Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0"
  }
}
```

**Note**: The architecture references a fictional `@anthropic-ai/agent-sdk`. This does not exist. We build our own agent framework using the raw `@anthropic-ai/sdk`.

### B.2 Files to Create (Phase 0)

| File                                       | Purpose                     |
| ------------------------------------------ | --------------------------- |
| `lib/agent-framework/index.ts`             | Public exports              |
| `lib/agent-framework/types.ts`             | Core interfaces             |
| `lib/agent-framework/base-agent.ts`        | BaseAgent with retry logic  |
| `lib/agent-framework/parallel-executor.ts` | Parallel task execution     |
| `lib/agent-framework/state-machine.ts`     | Evaluation state management |

### B.3 Error Classes Addition

Add to `utils/errors.ts`:

```typescript
export class AgentResponseParseError extends IdeaIncubatorError {
  constructor(message: string) {
    super(`Agent response parse failed: ${message}`);
    this.name = "AgentResponseParseError";
  }
}

export class AgentAPIError extends IdeaIncubatorError {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "AgentAPIError";
    this.cause = cause;
  }
}

export class StateTransitionError extends IdeaIncubatorError {
  constructor(from: string, to: string, validTransitions: string[]) {
    super(
      `Invalid state transition: ${from} → ${to}. Valid: ${validTransitions.join(", ")}`,
    );
    this.name = "StateTransitionError";
  }
}
```

---

## Appendix C: Content Hash Migration

### C.1 Migration File: 003_add_content_hash.sql

```sql
-- 003_add_content_hash.sql
-- Purpose: Enable staleness detection for evaluations

-- Add content hash tracking to ideas table
ALTER TABLE ideas ADD COLUMN content_hash TEXT;
ALTER TABLE ideas ADD COLUMN content_hash_updated_at DATETIME;

-- Add the hash that was current when evaluation was performed
ALTER TABLE final_syntheses ADD COLUMN content_hash_at_evaluation TEXT NOT NULL DEFAULT '';

-- Index for staleness queries
CREATE INDEX idx_ideas_content_hash ON ideas(content_hash);
CREATE INDEX idx_syntheses_content_hash ON final_syntheses(content_hash_at_evaluation);
```

### C.2 New Utility File: utils/content-hash.ts

```typescript
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

export interface ContentHashResult {
  hash: string;
  files: string[];
  calculatedAt: Date;
}

/**
 * Calculate SHA-256 hash of idea content files.
 * Includes: README.md, development.md, research/*.md
 * Excludes: evaluation.md, redteam.md, notes/, assets/
 */
export async function calculateIdeaContentHash(
  ideaPath: string,
): Promise<ContentHashResult> {
  const filesToHash = [
    path.join(ideaPath, "README.md"),
    path.join(ideaPath, "development.md"),
    ...(await glob(path.join(ideaPath, "research", "*.md"))),
  ];

  const existingFiles = filesToHash.filter((f) => fs.existsSync(f));
  existingFiles.sort(); // Deterministic ordering

  const hasher = crypto.createHash("sha256");

  for (const file of existingFiles) {
    const content = fs.readFileSync(file, "utf-8");
    hasher.update(`${path.basename(file)}:${content}`);
  }

  return {
    hash: hasher.digest("hex"),
    files: existingFiles,
    calculatedAt: new Date(),
  };
}

export function isEvaluationStale(
  currentHash: string,
  evaluationHash: string,
): boolean {
  return currentHash !== evaluationHash;
}
```

---

## Appendix D: TDD Contract Test Specifications

> **CRITICAL**: These test files must be created BEFORE implementing the corresponding components. Tests should initially FAIL, then pass as implementation progresses.

### D.1 Test File Structure

```
tests/
├── setup.ts                           # Test setup and mocks
├── contracts/                         # Behavioral contracts (WRITE FIRST)
│   ├── evaluator.contract.test.ts
│   ├── redteam.contract.test.ts
│   ├── arbiter.contract.test.ts
│   ├── synthesis.contract.test.ts
│   ├── convergence.contract.test.ts
│   ├── state-machine.contract.test.ts
│   ├── cost-tracker.contract.test.ts
│   └── content-hash.contract.test.ts
├── boundaries/                        # Edge case tests
│   ├── score-validation.test.ts
│   ├── budget-limits.test.ts
│   └── round-limits.test.ts
├── state-machine/                     # State transition tests
│   └── evaluation-states.test.ts
├── e2e/                              # Full workflow tests
│   └── full-lifecycle.test.ts
├── unit/                             # Unit tests (existing)
│   └── ...
├── integration/                      # Integration tests (existing)
│   └── ...
├── mocks/
│   └── anthropic.ts
└── fixtures/
    ├── ideas/
    │   └── test-idea/
    │       └── README.md
    └── responses/
        ├── evaluation-valid.json
        ├── evaluation-invalid.json
        ├── challenge-valid.json
        └── verdict-valid.json
```

### D.2 Contract Test: Evaluator Agent

```typescript
// tests/contracts/evaluator.contract.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EvaluatorAgent } from "../../lib/agent-framework/agents/evaluator-agent.js";
import { CostTracker } from "../../utils/cost-tracker.js";
import { ALL_CRITERIA } from "../../agents/config.js";
import { EvaluationResponseSchema } from "../../utils/schemas.js";
import {
  createMockAnthropicClient,
  mockEvaluationResponse,
} from "../mocks/anthropic.js";

describe("Evaluator Agent Contract", () => {
  let agent: EvaluatorAgent;
  let costTracker: CostTracker;
  let mockClient: ReturnType<typeof createMockAnthropicClient>;

  beforeEach(() => {
    mockClient = createMockAnthropicClient();
    costTracker = new CostTracker(10.0);
    // Agent will be injected with mock client
  });

  describe("Response Structure Requirements", () => {
    it("MUST return exactly 30 criterion evaluations", async () => {
      // Setup mock to return valid response
      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse(
          Object.fromEntries(ALL_CRITERIA.map((c) => [c, 5])),
        ),
      );

      const result = await agent.evaluate("Test idea content");

      expect(result.evaluations).toHaveLength(30);
    });

    it("MUST include all criteria from taxonomy", async () => {
      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse(
          Object.fromEntries(ALL_CRITERIA.map((c) => [c, 5])),
        ),
      );

      const result = await agent.evaluate("Test idea content");
      const returnedCriteria = result.evaluations.map((e) => e.criterion);

      for (const criterion of ALL_CRITERIA) {
        expect(returnedCriteria).toContain(criterion);
      }
    });

    it("MUST return scores in range 1-10 for each criterion", async () => {
      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse(
          Object.fromEntries(ALL_CRITERIA.map((c) => [c, 5])),
        ),
      );

      const result = await agent.evaluate("Test idea content");

      for (const evaluation of result.evaluations) {
        expect(evaluation.score).toBeGreaterThanOrEqual(1);
        expect(evaluation.score).toBeLessThanOrEqual(10);
        expect(Number.isInteger(evaluation.score)).toBe(true);
      }
    });

    it("MUST return confidence in range 0-1 for each criterion", async () => {
      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse(
          Object.fromEntries(ALL_CRITERIA.map((c) => [c, 5])),
        ),
      );

      const result = await agent.evaluate("Test idea content");

      for (const evaluation of result.evaluations) {
        expect(evaluation.confidence).toBeGreaterThanOrEqual(0);
        expect(evaluation.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("MUST provide non-empty reasoning for each score", async () => {
      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse(
          Object.fromEntries(ALL_CRITERIA.map((c) => [c, 5])),
        ),
      );

      const result = await agent.evaluate("Test idea content");

      for (const evaluation of result.evaluations) {
        expect(evaluation.reasoning).toBeDefined();
        expect(evaluation.reasoning.length).toBeGreaterThan(0);
      }
    });

    it("MUST pass Zod schema validation", async () => {
      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse(
          Object.fromEntries(ALL_CRITERIA.map((c) => [c, 5])),
        ),
      );

      const result = await agent.evaluate("Test idea content");

      expect(() => EvaluationResponseSchema.parse(result)).not.toThrow();
    });
  });

  describe("Error Handling Requirements", () => {
    it("MUST throw AgentResponseParseError for malformed JSON", async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Not valid JSON at all" }],
        usage: { input_tokens: 100, output_tokens: 100 },
      });

      await expect(agent.evaluate("Test")).rejects.toThrow(
        "AgentResponseParseError",
      );
    });

    it("MUST throw BudgetExceededError when budget is exhausted", async () => {
      costTracker = new CostTracker(0.0); // Zero budget

      await expect(agent.evaluate("Test")).rejects.toThrow(
        "BudgetExceededError",
      );
    });

    it("MUST retry on rate limit errors up to 3 times", async () => {
      const rateLimitError = new Error("Rate limited");
      rateLimitError.name = "RateLimitError";

      mockClient.messages.create
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(
          mockEvaluationResponse({ "Problem Clarity": 5 }),
        );

      // Should succeed after retries
      await expect(agent.evaluate("Test")).resolves.toBeDefined();
      expect(mockClient.messages.create).toHaveBeenCalledTimes(3);
    });
  });

  describe("Cost Tracking Requirements", () => {
    it("MUST track token usage for each API call", async () => {
      const trackSpy = vi.spyOn(costTracker, "track");

      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse({ "Problem Clarity": 5 }),
      );

      await agent.evaluate("Test");

      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input_tokens: expect.any(Number),
          output_tokens: expect.any(Number),
        }),
      );
    });

    it("MUST check budget after tracking", async () => {
      const checkSpy = vi.spyOn(costTracker, "checkBudget");

      mockClient.messages.create.mockResolvedValueOnce(
        mockEvaluationResponse({ "Problem Clarity": 5 }),
      );

      await agent.evaluate("Test");

      expect(checkSpy).toHaveBeenCalled();
    });
  });
});
```

### D.3 Contract Test: State Machine

```typescript
// tests/contracts/state-machine.contract.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import {
  EvaluationStateMachine,
  EvaluationPhase,
} from "../../lib/agent-framework/state-machine.js";

describe("Evaluation State Machine Contract", () => {
  let machine: EvaluationStateMachine;

  beforeEach(() => {
    machine = new EvaluationStateMachine("run-001", "idea-001", 10.0);
  });

  describe("Initial State", () => {
    it("MUST start in PENDING phase", () => {
      expect(machine.getState().phase).toBe("PENDING");
    });

    it("MUST have zero completed criteria", () => {
      expect(machine.getState().completedCriteria).toHaveLength(0);
    });

    it("MUST not be terminal", () => {
      expect(machine.isTerminal()).toBe(false);
    });
  });

  describe("Valid Transitions", () => {
    const validTransitions: [EvaluationPhase, EvaluationPhase][] = [
      ["PENDING", "EVALUATING"],
      ["PENDING", "FAILED"],
      ["EVALUATING", "DEBATING"],
      ["EVALUATING", "FAILED"],
      ["DEBATING", "SYNTHESIZING"],
      ["DEBATING", "EVALUATING"], // Re-evaluation loop
      ["DEBATING", "FAILED"],
      ["SYNTHESIZING", "REVIEWING"],
      ["SYNTHESIZING", "FAILED"],
      ["REVIEWING", "LOCKED"],
      ["REVIEWING", "DEBATING"], // User dispute
      ["REVIEWING", "FAILED"],
      ["FAILED", "PENDING"], // Retry
    ];

    it.each(validTransitions)("MUST allow %s → %s", (from, to) => {
      // Set up initial state
      if (from !== "PENDING") {
        // Navigate to 'from' state via valid path
        const path = getPathTo(from);
        for (const step of path) {
          machine.transition(step);
        }
      }

      expect(() => machine.transition(to)).not.toThrow();
      expect(machine.getState().phase).toBe(to);
    });
  });

  describe("Invalid Transitions", () => {
    it("MUST reject PENDING → LOCKED", () => {
      expect(() => machine.transition("LOCKED")).toThrow();
    });

    it("MUST reject LOCKED → any state", () => {
      // Navigate to LOCKED
      machine.transition("EVALUATING");
      machine.transition("DEBATING");
      machine.transition("SYNTHESIZING");
      machine.transition("REVIEWING");
      machine.transition("LOCKED");

      const phases: EvaluationPhase[] = [
        "PENDING",
        "EVALUATING",
        "DEBATING",
        "SYNTHESIZING",
        "REVIEWING",
        "FAILED",
      ];

      for (const phase of phases) {
        expect(() => machine.transition(phase)).toThrow();
      }
    });

    it("MUST reject EVALUATING → REVIEWING (skipping debate)", () => {
      machine.transition("EVALUATING");
      expect(() => machine.transition("REVIEWING")).toThrow();
    });
  });

  describe("Checkpoint/Restore", () => {
    it("MUST create checkpoint with current state", () => {
      machine.transition("EVALUATING");
      machine.checkpoint();

      const state = machine.getState();
      expect(state.checkpoint).not.toBeNull();
      expect(state.checkpoint?.phase).toBe("EVALUATING");
    });

    it("MUST restore state from checkpoint", () => {
      machine.transition("EVALUATING");
      machine.checkpoint();

      machine.transition("DEBATING");
      expect(machine.getState().phase).toBe("DEBATING");

      machine.restore(machine.getState().checkpoint!);
      expect(machine.getState().phase).toBe("EVALUATING");
    });
  });

  describe("Terminal States", () => {
    it("MUST be terminal when LOCKED", () => {
      machine.transition("EVALUATING");
      machine.transition("DEBATING");
      machine.transition("SYNTHESIZING");
      machine.transition("REVIEWING");
      machine.transition("LOCKED");

      expect(machine.isTerminal()).toBe(true);
    });

    it("MUST be terminal when FAILED", () => {
      machine.transition("FAILED");
      expect(machine.isTerminal()).toBe(true);
    });
  });
});

function getPathTo(phase: EvaluationPhase): EvaluationPhase[] {
  const paths: Record<EvaluationPhase, EvaluationPhase[]> = {
    PENDING: [],
    EVALUATING: ["EVALUATING"],
    DEBATING: ["EVALUATING", "DEBATING"],
    SYNTHESIZING: ["EVALUATING", "DEBATING", "SYNTHESIZING"],
    REVIEWING: ["EVALUATING", "DEBATING", "SYNTHESIZING", "REVIEWING"],
    LOCKED: ["EVALUATING", "DEBATING", "SYNTHESIZING", "REVIEWING", "LOCKED"],
    FAILED: ["FAILED"],
  };
  return paths[phase];
}
```

### D.4 Contract Test: Content Hash

```typescript
// tests/contracts/content-hash.contract.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  calculateIdeaContentHash,
  isEvaluationStale,
} from "../../utils/content-hash.js";

describe("Content Hash Contract", () => {
  const testDir = path.join(__dirname, "../fixtures/ideas/hash-test");

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, "research"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Hash Calculation", () => {
    it("MUST include README.md in hash", async () => {
      fs.writeFileSync(path.join(testDir, "README.md"), "Content A");
      const hash1 = await calculateIdeaContentHash(testDir);

      fs.writeFileSync(path.join(testDir, "README.md"), "Content B");
      const hash2 = await calculateIdeaContentHash(testDir);

      expect(hash1.hash).not.toBe(hash2.hash);
    });

    it("MUST include development.md in hash", async () => {
      fs.writeFileSync(path.join(testDir, "README.md"), "Content");
      const hash1 = await calculateIdeaContentHash(testDir);

      fs.writeFileSync(path.join(testDir, "development.md"), "Dev content");
      const hash2 = await calculateIdeaContentHash(testDir);

      expect(hash1.hash).not.toBe(hash2.hash);
    });

    it("MUST include research/*.md in hash", async () => {
      fs.writeFileSync(path.join(testDir, "README.md"), "Content");
      const hash1 = await calculateIdeaContentHash(testDir);

      fs.writeFileSync(path.join(testDir, "research", "study.md"), "Research");
      const hash2 = await calculateIdeaContentHash(testDir);

      expect(hash1.hash).not.toBe(hash2.hash);
    });

    it("MUST NOT include evaluation.md in hash", async () => {
      fs.writeFileSync(path.join(testDir, "README.md"), "Content");
      const hash1 = await calculateIdeaContentHash(testDir);

      fs.writeFileSync(path.join(testDir, "evaluation.md"), "Evaluation");
      const hash2 = await calculateIdeaContentHash(testDir);

      expect(hash1.hash).toBe(hash2.hash);
    });

    it("MUST be deterministic (same content = same hash)", async () => {
      fs.writeFileSync(path.join(testDir, "README.md"), "Content");

      const hash1 = await calculateIdeaContentHash(testDir);
      const hash2 = await calculateIdeaContentHash(testDir);

      expect(hash1.hash).toBe(hash2.hash);
    });

    it("MUST return list of files included in hash", async () => {
      fs.writeFileSync(path.join(testDir, "README.md"), "Content");
      fs.writeFileSync(path.join(testDir, "development.md"), "Dev");

      const result = await calculateIdeaContentHash(testDir);

      expect(result.files).toContain(path.join(testDir, "README.md"));
      expect(result.files).toContain(path.join(testDir, "development.md"));
    });
  });

  describe("Staleness Detection", () => {
    it("MUST return false when hashes match", () => {
      expect(isEvaluationStale("abc123", "abc123")).toBe(false);
    });

    it("MUST return true when hashes differ", () => {
      expect(isEvaluationStale("abc123", "xyz789")).toBe(true);
    });
  });
});
```

---

## Appendix E: Updated File Tree

The complete file tree including the agent framework:

```
idea_incubator/
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── CLAUDE.md
│
├── docs/
│   ├── ARCHITECTURE.md
│   └── IMPLEMENTATION-PLAN.md
│
├── lib/                                # NEW: Agent framework
│   └── agent-framework/
│       ├── index.ts
│       ├── types.ts
│       ├── base-agent.ts
│       ├── parallel-executor.ts
│       ├── state-machine.ts
│       └── agents/
│           ├── evaluator-agent.ts
│           ├── redteam-agent.ts
│           ├── arbiter-agent.ts
│           ├── synthesis-agent.ts
│           ├── orchestrator-agent.ts
│           ├── classifier-agent.ts
│           └── development-agent.ts
│
├── config/
│   ├── default.ts
│   └── index.ts
│
├── taxonomy/
│   ├── evaluation-criteria.md
│   ├── lifecycle-stages.md
│   ├── idea-types.md
│   └── tags.md
│
├── tests/
│   ├── setup.ts
│   ├── contracts/                      # NEW: TDD contract tests
│   │   ├── evaluator.contract.test.ts
│   │   ├── redteam.contract.test.ts
│   │   ├── arbiter.contract.test.ts
│   │   ├── synthesis.contract.test.ts
│   │   ├── convergence.contract.test.ts
│   │   ├── state-machine.contract.test.ts
│   │   ├── cost-tracker.contract.test.ts
│   │   └── content-hash.contract.test.ts
│   ├── boundaries/                     # NEW: Boundary tests
│   │   ├── score-validation.test.ts
│   │   ├── budget-limits.test.ts
│   │   └── round-limits.test.ts
│   ├── state-machine/                  # NEW: State tests
│   │   └── evaluation-states.test.ts
│   ├── e2e/                           # NEW: End-to-end tests
│   │   └── full-lifecycle.test.ts
│   ├── unit/
│   │   ├── agents/
│   │   ├── database/
│   │   └── utils/
│   ├── integration/
│   ├── mocks/
│   │   └── anthropic.ts
│   └── fixtures/
│       ├── ideas/
│       └── responses/
│
├── database/
│   ├── schema.sql
│   ├── db.ts
│   ├── migrate.ts
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_add_cost_log.sql
│       └── 003_add_content_hash.sql    # NEW
│
├── agents/
│   ├── config.ts
│   ├── orchestrator.ts
│   ├── development.ts
│   ├── evaluator.ts
│   ├── classifier.ts
│   ├── redteam.ts
│   ├── arbiter.ts
│   ├── debate.ts
│   ├── synthesis.ts
│   └── convergence.ts
│
├── scripts/
│   ├── cli.ts
│   ├── capture.ts
│   ├── sync.ts
│   ├── evaluate.ts
│   ├── debate.ts
│   ├── synthesize.ts
│   └── review.ts
│
├── utils/
│   ├── logger.ts
│   ├── parser.ts
│   ├── schemas.ts
│   ├── errors.ts
│   ├── cost-tracker.ts
│   └── content-hash.ts                 # NEW
│
├── templates/
│   ├── idea.md
│   ├── evaluation.md
│   └── final-synthesis.md
│
├── ideas/
│   ├── _index.md
│   └── .gitkeep
│
├── .claude/
│   └── skills/
│       └── ...
│
├── server/
│   └── ...
│
└── frontend/
    └── ...
```

---

## Appendix F: Updated Success Criteria

### Phase 0 Complete When:

- [ ] Vitest configured and running
- [ ] Mock Anthropic client working
- [ ] Zod schemas defined
- [ ] Error classes defined (including new AgentAPIError, StateTransitionError)
- [ ] Cost tracker implemented
- [ ] **Agent framework implemented** (BaseAgent, ParallelExecutor, StateMachine)
- [ ] **Content hash utility implemented**
- [ ] **All contract tests written** (will fail until Phase 1-3 implement agents)
- [ ] All spike tests pass

### Phase 0 TDD Checklist:

1. [ ] Write `evaluator.contract.test.ts` → Should FAIL
2. [ ] Write `redteam.contract.test.ts` → Should FAIL
3. [ ] Write `arbiter.contract.test.ts` → Should FAIL
4. [ ] Write `synthesis.contract.test.ts` → Should FAIL
5. [ ] Write `state-machine.contract.test.ts` → Should PASS (implement with tests)
6. [ ] Write `cost-tracker.contract.test.ts` → Should PASS (implement with tests)
7. [ ] Write `content-hash.contract.test.ts` → Should PASS (implement with tests)
8. [ ] Implement `BaseAgent` → Unit tests should pass
9. [ ] Implement `ParallelExecutor` → Unit tests should pass
10. [ ] Implement `EvaluationStateMachine` → Contract tests should pass

---

## Appendix G: Gap Remediation - Missing Systems & Mechanisms

> **CRITICAL**: This appendix addresses gaps identified during architecture review. These specifications MUST be implemented for a production-ready prototype.

### G.1 Error Recovery & Retry Strategy

**Problem**: No defined behavior when API calls fail mid-evaluation.

**Specification**:

| Component            | Requirement                                                    |
| -------------------- | -------------------------------------------------------------- |
| Retry Count          | Maximum 3 retries per API call                                 |
| Backoff Strategy     | Exponential: 1s → 2s → 4s                                      |
| Retryable Errors     | `rate_limit`, `timeout`, `server_error`, `overloaded`          |
| Non-Retryable Errors | `invalid_api_key`, `content_filter`, `context_length_exceeded` |
| Failure Behavior     | Throw after max retries; checkpoint current state first        |

**File to Create**: `utils/retry.ts`

**Interface**:

```
RetryConfig:
  - maxRetries: number (default: 3)
  - backoffMs: number[] (default: [1000, 2000, 4000])
  - retryableErrors: string[]
  - onRetry: (attempt: number, error: Error) => void

withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>
  - Executes fn with retry logic
  - Logs each retry attempt
  - Throws after max retries with aggregated error info
```

**Test Specification**:

- MUST retry on rate_limit error up to 3 times
- MUST NOT retry on invalid_api_key error
- MUST wait exponentially between retries (verify with fake timers)
- MUST throw aggregated error after max retries
- MUST call onRetry callback for each retry

---

### G.2 Checkpoint & Resume Mechanism

**Problem**: Long evaluations (5 rounds × 30 criteria) have no recovery if interrupted.

**Specification**:

| Checkpoint Type | Saved After            | Data Captured                                    |
| --------------- | ---------------------- | ------------------------------------------------ |
| Evaluation      | Each criterion scored  | Criterion scores so far, current criterion index |
| Debate          | Each round             | Round number, all exchanges, current scores      |
| Synthesis       | Each conflict resolved | Resolved conflicts, remaining conflicts          |

**Storage Location**: `database/checkpoints` table

**Schema Addition** (migration 004):

```
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  idea_id TEXT REFERENCES ideas(id),
  evaluation_run_id TEXT NOT NULL,
  checkpoint_type TEXT CHECK(type IN ('evaluation', 'debate', 'synthesis')),
  state_json TEXT NOT NULL,  -- Full serialized state
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,  -- 24 hours from creation
  UNIQUE(idea_id, evaluation_run_id, checkpoint_type)
);
```

**File to Create**: `utils/checkpoint.ts`

**Interface**:

```
saveCheckpoint(ideaId, runId, type, state): Promise<void>
loadCheckpoint(ideaId, runId, type): Promise<State | null>
clearCheckpoint(ideaId, runId, type): Promise<void>
isCheckpointStale(checkpoint): boolean  -- >24 hours old
```

**Resume Behavior**:

1. On evaluation start, check for existing checkpoint
2. If checkpoint exists and <24h old, prompt user: "Resume from round X?"
3. If user confirms, restore state and continue
4. If checkpoint >24h old, warn and offer restart

**Test Specification**:

- MUST save checkpoint after each debate round
- MUST restore state correctly when resuming
- MUST detect stale checkpoints (>24h)
- MUST clear checkpoint after successful completion

---

### G.3 Rate Limiting

**Problem**: Parallel API calls may exceed Anthropic rate limits.

**Specification**:

| Limit Type          | Value               | Implementation              |
| ------------------- | ------------------- | --------------------------- |
| Concurrent Requests | Max 10 simultaneous | p-limit or custom semaphore |
| Requests Per Minute | ~4000 (Opus)        | Token bucket rate limiter   |
| Cooldown on 429     | 60s minimum         | Exponential backoff         |

**File to Create**: `utils/rate-limiter.ts`

**Interface**:

```
RateLimiter:
  - constructor(options: { maxConcurrent: number, requestsPerMinute?: number })
  - acquire(): Promise<void>  -- Wait for available slot
  - release(): void  -- Release slot after completion
  - schedule<T>(fn: () => Promise<T>): Promise<T>  -- Wrap function with rate limiting
```

**Integration Point**: Wrap all Anthropic API calls in `BaseAgent.callAPI()`

**Test Specification**:

- MUST limit concurrent requests to maxConcurrent
- MUST queue requests beyond limit
- MUST release slot on completion (even on error)
- MUST respect per-minute rate limit

---

### G.4 Concurrency Control

**Problem**: No protection against concurrent operations on same idea.

**Specification**:

| Scenario                     | Behavior                                |
| ---------------------------- | --------------------------------------- |
| Two evaluations on same idea | Second waits or rejects                 |
| Sync during evaluation       | Sync waits for evaluation to checkpoint |
| Evaluation during sync       | Evaluation waits for sync completion    |

**Implementation**: File-based advisory locks

**File to Create**: `utils/lock.ts`

**Schema Addition** (migration 004):

```
CREATE TABLE locks (
  resource_id TEXT PRIMARY KEY,  -- e.g., "idea:solar-charger:evaluate"
  holder_id TEXT NOT NULL,        -- UUID of process holding lock
  acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL    -- Auto-release after 10 minutes
);
```

**Interface**:

```
acquireLock(resourceId: string, timeout?: number): Promise<Lock>
  - Throws LockTimeoutError if cannot acquire within timeout
  - Returns Lock object with release() method

releaseLock(lock: Lock): Promise<void>

withLock<T>(resourceId: string, fn: () => Promise<T>): Promise<T>
  - Acquires lock, executes fn, releases lock
  - Releases lock even on error
```

**Test Specification**:

- MUST prevent concurrent evaluation of same idea
- MUST allow concurrent evaluation of different ideas
- MUST auto-release lock after expiry (10 min)
- MUST throw LockTimeoutError if cannot acquire

---

### G.5 Observability

**Problem**: No structured logging, metrics, or tracing for debugging.

**Specification**:

| Component       | Requirement                               |
| --------------- | ----------------------------------------- |
| Logging Format  | JSON structured logs                      |
| Log Levels      | debug, info, warn, error                  |
| Request Tracing | Unique runId per evaluation               |
| Metrics         | Latency, cost, success rate per operation |

**File Updates**: `utils/logger.ts`

**Log Structure**:

```
{
  "timestamp": "ISO-8601",
  "level": "info",
  "runId": "uuid",
  "ideaSlug": "string",
  "operation": "evaluate|debate|synthesize",
  "phase": "nucleation|perturbation|annealing|...",
  "message": "string",
  "data": { ... },  // Optional structured data
  "duration_ms": number,  // For timed operations
  "cost_usd": number  // For API operations
}
```

**File to Create**: `utils/metrics.ts`

**Interface**:

```
MetricsCollector:
  - recordLatency(operation: string, durationMs: number): void
  - recordCost(operation: string, costUsd: number): void
  - recordSuccess(operation: string): void
  - recordFailure(operation: string, error: Error): void
  - getReport(): MetricsReport
```

**Integration Points**:

1. BaseAgent.callAPI() - log each API call with cost/latency
2. Debate orchestrator - log round start/end
3. Synthesis - log conflict resolution
4. CLI commands - log command start/end with total duration

**Test Specification**:

- MUST output valid JSON for each log entry
- MUST include runId in all logs within a run
- MUST record accurate latency measurements
- MUST track cumulative cost per run

---

### G.6 Synthesis Markdown Template

**Problem**: Final synthesis only in database; breaks "markdown is source of truth" principle.

**Specification**: Create `ideas/[slug]/synthesis.md` after crystallization.

**File to Create**: `templates/synthesis.md`

**Template Content**:

```markdown
---
evaluation_run_id: { { runId } }
previous_evaluation: { { previousRunId } }
status: CURRENT
completed_at: { { timestamp } }
overall_score: { { overallScore } }
overall_confidence: { { confidence } }
recommendation: { { recommendation } }
lock_reason: { { lockReason } }
---

# Final Synthesis: {{ideaTitle}}

> Evaluated on {{date}} | Score: {{overallScore}}/10 | Confidence: {{confidence}}%

## Executive Summary

{{executiveSummary}}

## Recommendation: {{recommendation}}

{{recommendationReasoning}}

## Key Strengths

{{#each keyStrengths}}

- {{this}}
  {{/each}}

## Key Weaknesses

{{#each keyWeaknesses}}

- {{this}}
  {{/each}}

## Critical Assumptions

{{#each criticalAssumptions}}

1. {{this}}
   {{/each}}

## Unresolved Questions

{{#each unresolvedQuestions}}

- [ ] {{this}}
      {{/each}}

## Score Summary

| Category    | Score                  | Confidence                  | Survival Rate             |
| ----------- | ---------------------- | --------------------------- | ------------------------- |
| Problem     | {{scores.problem}}     | {{confidence.problem}}%     | {{survival.problem}}%     |
| Solution    | {{scores.solution}}    | {{confidence.solution}}%    | {{survival.solution}}%    |
| Feasibility | {{scores.feasibility}} | {{confidence.feasibility}}% | {{survival.feasibility}}% |
| Fit         | {{scores.fit}}         | {{confidence.fit}}%         | {{survival.fit}}%         |
| Market      | {{scores.market}}      | {{confidence.market}}%      | {{survival.market}}%      |
| Risk        | {{scores.risk}}        | {{confidence.risk}}%        | {{survival.risk}}%        |

## Debate Summary

- **Total Rounds**: {{debate.totalRounds}}
- **Challenges Faced**: {{debate.totalChallenges}}
- **Challenges Defended**: {{debate.defended}}
- **First Principles Bonuses**: {{debate.fpBonuses}}

## Change History

| Date | Score | Confidence | Reason |
| ---- | ----- | ---------- | ------ |

{{#each history}}
| {{this.date}} | {{this.score}} | {{this.confidence}}% | {{this.reason}} |
{{/each}}

---

_This document is immutable. To update, run a new evaluation which will supersede this one._
```

**Generation**: synthesis.ts must write this file in addition to database record.

---

### G.7 End-to-End Test Specification

**Problem**: No integration test verifying complete flow.

**Test File**: `tests/e2e/full-lifecycle.test.ts`

**Test Cases** (behavioral descriptions):

| Test Case                     | Given                          | When                              | Then                                                                              |
| ----------------------------- | ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------- |
| Happy path complete           | New idea input                 | Run full pipeline                 | Creates README.md, evaluation.md, synthesis.md; database synced; synthesis locked |
| Budget enforcement            | Budget=$1, expensive responses | Run evaluation                    | Stops mid-evaluation; checkpoint saved; BudgetExceededError thrown                |
| API failure recovery          | API fails twice then succeeds  | Run with retry                    | Retries automatically; completes successfully                                     |
| Concurrent evaluation blocked | Evaluation running on idea-A   | Start second evaluation on idea-A | Second throws LockError; first continues                                          |
| Resume from checkpoint        | Checkpoint exists at round 2   | Resume debate                     | Starts from round 3; preserves round 1-2 scores                                   |
| Stale checkpoint warning      | Checkpoint 25h old             | Attempt resume                    | Warns user; offers restart or continue                                            |
| Malformed response handling   | Claude returns invalid JSON    | Parse response                    | Throws ParseError with helpful message; checkpoint saved                          |
| Convergence detection         | Scores stable for 2 rounds     | Check convergence                 | Detects convergence; enters crystallization                                       |
| Max rounds termination        | 5 rounds without convergence   | Check convergence                 | Forces crystallization with MAX_ROUNDS reason                                     |
| Reopening locked synthesis    | Locked synthesis exists        | Run evaluate with --force         | Creates new run; marks previous as SUPERSEDED                                     |

---

## Appendix H: Schema Reconciliation

> **Problem**: Architecture and Implementation have different schema definitions.

### H.1 Authoritative Schema Location

**Decision**: `utils/schemas.ts` (Zod schemas) is the authoritative source. Architecture diagrams are illustrative.

### H.2 Missing Fields to Add to Zod Schemas

Add to `SynthesisOutputSchema`:

```
defenseRecord: z.object({
  challenged: z.number(),
  defended: z.number(),
  survivalRate: z.number().min(0).max(1)
})

auditTrail: z.object({
  roundSummaries: z.array(RoundSummarySchema),
  majorConflicts: z.array(ConflictResolutionSchema),
  scoreTrajectory: z.array(ScorePointSchema)
})

lockReason: z.enum(['CONVERGENCE', 'MAX_ROUNDS', 'USER_APPROVED', 'TIMEOUT', 'BUDGET_EXCEEDED'])
```

Add new schemas:

```
RoundSummarySchema: z.object({
  round: z.number(),
  exchangeCount: z.number(),
  evaluatorPoints: z.number(),
  redTeamPoints: z.number(),
  scoreDeltas: z.record(z.string(), z.number())
})

ConflictResolutionSchema: z.object({
  criterion: z.string(),
  positionA: z.string(),
  positionB: z.string(),
  winner: z.enum(['A', 'B', 'NEITHER']),
  reasoning: z.string()
})

ScorePointSchema: z.object({
  round: z.number(),
  criterion: z.string(),
  score: z.number(),
  confidence: z.number()
})
```

### H.3 Confidence Calculation Reconciliation

**Problem**: Architecture defines confidence differently than implementation calculates it.

**Resolution**: Use implementation formula (in convergence.ts) as authoritative:

```
confidence = (
  survivalComponent * 0.4 +    // challenges defended / total
  rigorComponent * 0.2 +       // first principles bonuses / exchanges
  stabilityComponent * 0.2 +   // (1 - score volatility)
  completenessComponent * 0.2  // information completeness
)
```

Update Architecture 12A.4 to reference this formula.

---

## Appendix I: Phase Reconciliation

> **Problem**: Architecture Section 14 and Implementation Section 3 have different phase structures.

### I.1 Authoritative Phase Structure

**Decision**: Implementation Plan Section 3 is authoritative. Architecture Section 14 is historical/deprecated.

**Canonical Phases**:
| Phase | Name | Key Deliverables |
|-------|------|-----------------|
| 0 | Technical Validation & Test Infrastructure | Vitest, mocks, Zod schemas, error classes, agent framework |
| 1 | Core Infrastructure | CLAUDE.md, config, taxonomy, database, sync script, skills |
| 2 | Idea Capture & Storage | Templates, capture CLI, development agent, classifier |
| 3 | Single-Agent Evaluation | Orchestrator, generalist evaluator, 30-criteria scoring |
| 4 | Multi-Agent Debate | 3 red team personas, arbiter, debate orchestration |
| 5 | Finite Synthesis | Convergence detection, synthesis agent, crystallization |
| 6 | Frontend & Visualization | Express server, WebSocket, 7 React views |
| 7 | Enhancements & Scale | 6 evaluators, 6 personas, comparison view, PWA |

### I.2 Update Architecture Section 14

Mark Architecture Section 14 with:

```
> **DEPRECATED**: This phase structure is superseded by IMPLEMENTATION-PLAN.md Section 3.
> See Implementation Plan for authoritative phase definitions.
```

---

## Appendix J: Contradictions Removed

### J.1 Frontend Data Access

**Removed from Architecture 6.3**: Reference to "sql.js (browser)" option.

**Authoritative**: Local Express API with better-sqlite3 on server.

**Reason**: Decision made in Appendix A.4 to use Express API for WebSocket support.

### J.2 Red Team Persona Count

**Clarified**:

- v1 (Phases 0-6): 3 personas (Skeptic, Realist, First Principles Purist)
- v2 (Phase 7): 6 personas (add Competitor, Contrarian, Edge-Case Finder)

**Update Architecture 12.3**: Mark personas 4-6 as "(v2 only)"

---

## Appendix K: Missing Test Files to Create

These files must exist with behavioral test specifications BEFORE implementation:

| File                                            | Tests What                           | Create In Phase |
| ----------------------------------------------- | ------------------------------------ | --------------- |
| `tests/e2e/full-lifecycle.test.ts`              | Complete capture→synthesis flow      | 0               |
| `tests/e2e/budget-enforcement.test.ts`          | Cost tracking and budget limits      | 0               |
| `tests/e2e/error-recovery.test.ts`              | Retry logic and graceful degradation | 0               |
| `tests/e2e/concurrency.test.ts`                 | Lock acquisition and release         | 0               |
| `tests/e2e/checkpoint-resume.test.ts`           | Checkpoint save/restore              | 0               |
| `tests/contracts/orchestrator.contract.test.ts` | Orchestrator routing logic           | 0               |
| `tests/contracts/development.contract.test.ts`  | Development agent questions          | 0               |
| `tests/contracts/classifier.contract.test.ts`   | Auto-tagging behavior                | 0               |
| `tests/boundaries/reopening.test.ts`            | Locked evaluation reopening          | 0               |

---

**Document Status**: Updated with gap remediation specifications. All identified gaps now have explicit specifications. Ready for TDD implementation.
