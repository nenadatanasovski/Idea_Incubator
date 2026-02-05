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

| Component | Location | Status |
|-----------|----------|--------|
| Ideation Agent | `agents/ideation/` | Functional, needs ARCH alignment |
| Intent Classifier | `agents/ideation/intent-classifier.ts` | Functional |
| SIA (Self-Improvement) | `agents/sia/` | Functional, needs integration |
| Gap Analysis Agent | `agents/gap-analysis.ts` | Exists, needs proactive trigger |
| Message Bus | `coding-loops/shared/message_bus.py` | Built, SQLite-backed |
| Ralph Loop Base | `coding-loops/shared/ralph_loop_base.py` | Built |
| Build Agent | `coding-loops/agents/build_agent_worker.py` | 98KB, needs review |
| Block Extractor | `agents/ideation/block-extractor.ts` | Functional |
| Observable Agent | `coding-loops/shared/observable_agent.py` | Base class ready |

### What's Missing

| Component | Priority | Dependency |
|-----------|----------|------------|
| Neo4j graph storage | P0 | Foundation for everything |
| Prisma operational layer | P0 | Replace Drizzle |
| FastAPI coordination layer | P1 | Agent-to-agent communication |
| North Star storage | P1 | Required for gap analysis |
| Proactive Loop scheduler | P1 | Triggers gap analysis |
| Proposal entity + flow | P1 | Gap → Proposal → Approval |

---

## Tech Stack (Locked)

| Layer | Technology | Decision |
|-------|------------|----------|
| Graph DB | Neo4j | ARCH-002 |
| Operational DB | Postgres + Prisma | ARCH-006, ARCH-031 |
| User-facing API | TypeScript | Existing |
| Agent coordination | FastAPI (Python) | ARCH-032 |
| Message Bus | SQLite-backed | Existing |
| LLM (reasoning) | Claude Opus | — |
| LLM (classification) | Claude Haiku | — |
| Observability | Langfuse | ARCH-007 |
| Agent framework | Pydantic AI | ARCH-008 |

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

**Goal:** Solid storage layer, audited codebase.

**Branch:** `foundation/neo4j-prisma`

| Task | Details | Doc Reference |
|------|---------|---------------|
| Neo4j setup | Docker, schema, indexes | `02-NEO4J-SCHEMA.md` |
| Prisma setup | Schema, migrations, client | `05-PHASE1-FOUNDATION.md` |
| Code audit | Review all agents against ARCH | `04-CODE-AUDIT-CHECKLIST.md` |
| Migration scripts | SQLite → Neo4j, Drizzle → Prisma | `05-PHASE1-FOUNDATION.md` |
| FastAPI scaffold | Basic coordination endpoints | `05-PHASE1-FOUNDATION.md` |

**Exit Criteria:**
- [ ] Neo4j running with 9 block type schema
- [ ] Prisma client generated, basic ops working
- [ ] FastAPI health endpoint responding
- [ ] All agents audited, issues documented
- [ ] Migration scripts tested on copy of prod data

---

### Phase 2: North Star + Proactive Loop (Weeks 4-6)

**Goal:** System can analyze itself and propose improvements.

**Branch:** `feature/proactive-loop`

| Task | Details | Doc Reference |
|------|---------|---------------|
| North Star schema | Vision, capabilities, constraints in Neo4j | `07-NORTH-STAR-SCHEMA.md` |
| Seed Vibe vision | Vibe as "idea #0" | — |
| Proactive scheduler | Event-driven + daily cron fallback | ARCH-013 |
| Gap Analysis trigger | Connect existing agent to scheduler | — |
| Proposal entity | Schema, storage, lifecycle | `06-PROACTIVE-LOOP-SPEC.md` |
| Notification flow | Telegram-primary | ARCH-020 |
| Human escalation | Questions when agents stuck | `06-PROACTIVE-LOOP-SPEC.md` |

**Exit Criteria:**
- [ ] North Star seeded with Vibe vision
- [ ] Scheduler triggers gap analysis daily
- [ ] Proposals stored in Neo4j
- [ ] Notifications sent to Telegram
- [ ] Human can approve/reject via chat
- [ ] System asks questions when stuck

---

### Phase 3: Coordination + Parallelism (Weeks 7-9)

**Goal:** Multiple loops running in parallel, coordinated.

**Branch:** `feature/parallel-coordination`

| Task | Details | Doc Reference |
|------|---------|---------------|
| Message Bus integration | Connect all agents to bus | Existing code |
| FastAPI endpoints | Job triggers, status, health | — |
| Loop coordination | Parallel execution, conflict prevention | ARCH-015 |
| Monitor Agent | Health checks, stuck detection | — |
| PM Agent | Conflict resolution, priorities | — |
| Git strategy | Branch-per-loop, task checkpoints | ARCH-016 |

**Exit Criteria:**
- [ ] 3 loops running in parallel
- [ ] No file conflicts (locking works)
- [ ] Monitor detects stuck loops
- [ ] PM resolves conflicts
- [ ] Git branches auto-managed

---

### Phase 4: Verification + Safety (Weeks 10-12)

**Goal:** Production-ready safety and human interface.

**Branch:** `feature/verification-gate`

| Task | Details | Doc Reference |
|------|---------|---------------|
| Verification Gate | Independent validation of outputs | — |
| Auto-debate | Red team vets proposals | ARCH-023 |
| Evidence system | 3-tier confidence | ARCH-024 |
| CLI interface | Status, pause, resume, decide | — |
| Rejection learning | Track why, adapt future | ARCH-029 |
| Autonomy tiers | Auto-approve knowledge only | ARCH-030 |

**Exit Criteria:**
- [ ] All code changes pass verification
- [ ] Proposals debated before human sees
- [ ] Evidence confidence tracked
- [ ] CLI can control system
- [ ] Rejections inform future proposals

---

## Parallel Workstreams

The coding-loops system already supports parallelism:

```
┌─────────────────────────────────────────────────────────────┐
│                    PARALLEL EXECUTION                        │
├─────────────────────────────────────────────────────────────┤
│  Loop 1: Critical Path    │  UFS → Spec → Build             │
│  Loop 2: Infrastructure   │  Auth → Credits → Hosting       │
│  Loop 3: Polish           │  Monitoring → E2E → PWA         │
├─────────────────────────────────────────────────────────────┤
│                    COORDINATION LAYER                        │
│  Message Bus  │  File Locking  │  PM Agent  │  Monitor      │
└─────────────────────────────────────────────────────────────┘
```

Each phase of this plan should leverage parallel execution where possible.

---

## The Bidirectional Loop

The proactive loop is not one-way. It handles:

### System → Human
- Proposals for improvements
- Decisions needing approval
- Status updates

### Human → System (via questions)
- Architecture clarifications when stuck
- Coding decisions when blocked
- Priority guidance

```
┌─────────┐                      ┌─────────┐
│  AGENT  │ ──── proposals ────▶ │  HUMAN  │
│         │ ◀─── approvals ───── │         │
│         │                      │         │
│         │ ──── questions ────▶ │         │
│         │ ◀─── answers ─────── │         │
└─────────┘                      └─────────┘
```

This ensures the system never stays stuck silently.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Migration breaks existing functionality | Branch strategy, extensive testing on data copy |
| Code audit reveals major issues | Document issues, prioritize by impact |
| Neo4j learning curve | Start with simple queries, expand gradually |
| Parallel loops conflict | Message bus + file locking already built |
| Scope creep | Strict phase gates, defer nice-to-haves |

---

## Success Metrics

### Phase 1 Complete
- [ ] Storage layer fully migrated
- [ ] Zero data loss
- [ ] All existing tests pass

### Phase 2 Complete
- [ ] System proposes at least 1 improvement per day
- [ ] Human can approve/reject via Telegram
- [ ] System asks for help when stuck

### Phase 3 Complete
- [ ] 3 loops running concurrently
- [ ] No deadlocks for 1 week

### Phase 4 Complete
- [ ] MVP loop "decisions lacking evidence" running (ARCH-027)
- [ ] Full cycle: gap → proposal → debate → approve → execute → verify

---

## Document Dependencies

```
00-ARCHITECTURE-OVERVIEW.md (32 ARCH decisions)
         │
         ├── 01-CODE-FRAMEWORK-MAP.md (what exists)
         │
         ├── 02-NEO4J-SCHEMA.md (graph schema)
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

---

*This is a source-truth document. Changes require founder review.*
