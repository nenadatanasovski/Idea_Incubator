# Consolidated Implementation Plan

> **Source of Truth** for Vibe platform implementation roadmap.
> 
> Related: `00-ARCHITECTURE-OVERVIEW.md` (32 ARCH decisions), `02-NEO4J-SCHEMA.md`

---

## Executive Summary

Vibe is a self-evolving platform that transforms ideas into AI-managed SaaS products. This plan defines how to get from the current state (~50% built organically) to a production-ready self-evolving system.

**Key insight:** Existing code was built before the 32 ARCH decisions were locked. Each component needs audit and alignment before building new features.

---

## Current State Assessment

### What Exists (Needs Audit)

| Component | Location | Audit Priority | Blocks Phase |
|-----------|----------|----------------|--------------|
| Block Extractor | `agents/ideation/block-extractor.ts` | 🔴 P0 | Phase 1 |
| Memory Block Schema | `schema/entities/memory-block.ts` | 🔴 P0 | Phase 1 |
| Graph State Loader | `agents/ideation/graph-state-loader.ts` | 🔴 P0 | Phase 1 |
| Gap Analysis Agent | `agents/gap-analysis.ts` | 🟡 P1 | Phase 2 |
| Message Bus | `coding-loops/shared/message_bus.py` | 🟡 P1 | Phase 3 |
| Ideation Agent | `agents/ideation/` | 🟢 P2 | — |
| Intent Classifier | `agents/ideation/intent-classifier.ts` | 🟢 P2 | — |
| SIA | `agents/sia/` | 🟢 P2 | — |
| Build Agent | `coding-loops/agents/build_agent_worker.py` | 🟢 P2 | — |

**P0 = Must audit before Phase 1 completes. P1 = Must audit before that phase. P2 = Audit incrementally.**

### What's Missing

| Component | Priority | Dependency |
|-----------|----------|------------|
| Neo4j graph storage | P0 | Foundation for everything |
| Prisma operational layer | P0 | Replace Drizzle |
| FastAPI coordination layer | P0 | Fast agent-to-agent communication |
| North Star storage | P1 | Required for gap analysis |
| Proactive Loop scheduler | P1 | Triggers gap analysis |
| Proposal entity + flow | P1 | Gap → Proposal → Approval |

---

## Tech Stack (Locked)

| Layer | Technology | Decision | Why |
|-------|------------|----------|-----|
| Graph DB | Neo4j | ARCH-002 | Complex traversals, relationship-first |
| Operational DB | Postgres + Prisma | ARCH-006, ARCH-031 | Nested relations, visual tooling |
| User-facing API | TypeScript | Existing | Web/chat interface |
| Agent coordination | FastAPI (Python) | ARCH-032 | Faster, async-native, better for AI agents |
| Message Bus | SQLite-backed | Existing | Async event pub/sub |
| LLM (reasoning) | Claude Opus | — | Complex tasks, code generation |
| LLM (classification) | Claude Haiku | — | Fast, cheap classification |
| Observability | Langfuse | ARCH-007 | Trace all agent actions |
| Agent framework | Pydantic AI | ARCH-008 | Typed outputs, structured tools |

### External Dependencies

| Service | Used For | Fallback |
|---------|----------|----------|
| Anthropic API | All LLM calls | Queue requests, retry with backoff |
| Telegram API | Notifications, approvals | Log to console, queue for later |
| Neo4j | Graph queries | None (critical) |
| Postgres | Operational state | None (critical) |

---

## Implementation Phases

### Phase 1: Foundation

**Goal:** Solid storage layer, critical code audited.

**Branch:** `foundation/neo4j-prisma`

| Task | Acceptance Criteria |
|------|---------------------|
| Neo4j setup | 100 test blocks created, queries return in <50ms |
| Prisma setup | Schema generated FROM existing Drizzle, all existing queries ported |
| FastAPI scaffold | Health endpoint returns in <10ms, job trigger queues work |
| P0 Code audit | Block Extractor, Memory Block Schema, Graph State Loader reviewed, issues documented |
| Migration scripts | All blocks migrated, count matches, spot-check 10 random blocks manually |

**Vertical Slice (build first):**
1. Create 1 hardcoded Knowledge block in Neo4j
2. Query it back
3. Store related Task in Prisma
4. Trigger via FastAPI endpoint
5. End-to-end works ugly before making it pretty

---

### Phase 2: North Star + Proactive Loop

**Goal:** System can analyze itself and propose improvements.

**Branch:** `feature/proactive-loop`

| Task | Acceptance Criteria |
|------|---------------------|
| North Star schema | Vision, capabilities, constraints stored as blocks in Neo4j |
| Seed Vibe vision | At least 10 North Star blocks defining what Vibe should become |
| Proactive scheduler | Triggers gap analysis on events + daily fallback |
| Gap Analysis trigger | Finds "decisions lacking evidence" (ARCH-027 MVP) |
| Proposal entity | Proposals stored with status lifecycle |
| Notification flow | Telegram message sent, human can reply |
| Human escalation | Questions sent when stuck, answers flow back |

**Vertical Slice (build first):**
1. Hardcode 1 gap: "Decision X has no evidence"
2. Generate 1 proposal: "Research evidence for X"
3. Log to console (not Telegram yet)
4. Hardcode approval
5. Mark proposal executed
6. Then add Telegram, real gap analysis, etc.

**Error Handling:**
| Failure | Recovery |
|---------|----------|
| Gap Analysis fails | Log error, retry next cycle, alert if 3 failures |
| Telegram notification fails | Queue message, retry with backoff, log to console |
| Human doesn't respond (24h) | Re-notify with escalation flag |
| Debate agents disagree (3 rounds) | Escalate to human with both positions |

---

### Phase 3: Coordination + Parallelism

**Goal:** Multiple loops running in parallel, coordinated.

**Branch:** `feature/parallel-coordination`

**Pre-requisite:** Validate existing parallelism works.

| Task | Acceptance Criteria |
|------|---------------------|
| Parallelism stress test | Run 3 loops simultaneously for 1 hour, no deadlocks, no file conflicts |
| Message Bus integration | All agents publish/subscribe, events delivered in <100ms |
| FastAPI endpoints | Job trigger, status query, health check all working |
| Loop coordination | File locking prevents conflicts, PM Agent resolves priorities |
| Monitor Agent | Detects stuck loop within 5 minutes, alerts |
| Git strategy | Each loop has branch, merges don't conflict |

**Error Handling:**
| Failure | Recovery |
|---------|----------|
| Loop stuck >15min | Monitor kills loop, restarts from last checkpoint |
| File lock timeout | Release lock, retry, escalate if 3 failures |
| Git merge conflict | PM Agent pauses conflicting loop, human resolves |

---

### Phase 4: Verification + Safety

**Goal:** Production-ready safety and human interface.

**Branch:** `feature/verification-gate`

| Task | Acceptance Criteria |
|------|---------------------|
| Verification Gate | All code changes pass TypeScript compile + tests before merge |
| Auto-debate | Proposals debated, >70% pass rate (weak proposals filtered) |
| Evidence system | 3-tier confidence tracked, auto-upgrades when evidence added |
| CLI interface | Can view status, pause loops, resume, approve/reject proposals |
| Rejection learning | Rejected proposals stored with reason, similar proposals avoided |
| Autonomy tiers | Knowledge auto-approved, code requires human approval |

---

## Outcome Metrics (Not Output Metrics)

| Metric | Target | Why |
|--------|--------|-----|
| Proposal acceptance rate | >50% | System proposes useful things |
| Time from gap to resolution | <48h for P1 gaps | System moves fast |
| Human intervention frequency | Decreasing trend | System learns |
| Loop stuck rate | <5% of cycles | System is reliable |
| False positive gaps | <20% | Gap analysis is accurate |

---

## Cost Budget

| Operation | Estimated Cost | Cap |
|-----------|----------------|-----|
| Gap Analysis (Opus) | ~$0.10/run | $5/day |
| Proposal Generation (Opus) | ~$0.15/proposal | $10/day |
| Intent Classification (Haiku) | ~$0.001/call | $1/day |
| Debate (Opus x2) | ~$0.30/debate | $15/day |
| **Total** | — | **$30/day max** |

If approaching cap: reduce debate frequency, batch gap analysis, skip low-priority proposals.

---

## The Bidirectional Loop

```
┌─────────┐                      ┌─────────┐
│  AGENT  │ ──── proposals ────▶ │  HUMAN  │
│         │ ◀─── approvals ───── │         │
│         │                      │         │
│         │ ──── questions ────▶ │         │
│         │ ◀─── answers ─────── │         │
└─────────┘                      └─────────┘
```

### Escalation SLA

| Stuck Duration | Action |
|----------------|--------|
| 5 minutes | Log to debug |
| 15 minutes | Publish to message bus |
| 30 minutes | Send Telegram question |
| 2 hours | Re-send with URGENT flag |
| 8 hours | Pause loop, await human |

### Question Format

```
❓ *[AGENT_NAME] needs help*

**Task:** [task title]
**Stuck on:** [specific blocker]

**Question:**
[Clear, specific question]

**Options (if applicable):**
A) [option 1]
B) [option 2]

**Context:** [link to relevant blocks]

Reply with your answer or A/B.
```

---

## Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | Individual functions | Vitest for TS, pytest for Python |
| Integration | Agent + DB interactions | Test containers (Neo4j, Postgres) |
| E2E Loop | Full cycle gap→proposal→execute | Scripted scenario, mock Telegram |
| Stress | Parallel loops under load | 3 loops, 100 tasks, 1 hour |

**Coverage targets:**
- Unit: 70% line coverage on new code
- Integration: All happy paths + top 3 error paths
- E2E: 1 full cycle test per phase

---

## Document Dependencies

```
00-ARCHITECTURE-OVERVIEW.md (32 ARCH decisions)
         │
         ├── 01-CODE-FRAMEWORK-MAP.md (what exists)
         │
         ├── 02-NEO4J-SCHEMA.md (graph schema)
         │
         ├── 07-NORTH-STAR-SCHEMA.md (vision structure) ← NEW
         │
         └── 03-CONSOLIDATED-PLAN.md (this doc)
                  │
                  ├── 04-CODE-AUDIT-CHECKLIST.md
                  │
                  ├── 05-PHASE1-FOUNDATION.md
                  │
                  └── 06-PROACTIVE-LOOP-SPEC.md
```

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |
| 2026-02-05 | Added: acceptance criteria, error handling, cost budget, testing strategy, escalation SLA, outcome metrics, external deps | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
