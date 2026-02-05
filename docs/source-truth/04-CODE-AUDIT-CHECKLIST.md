# Code Audit Checklist

> **Source of Truth** for reviewing existing code against ARCH decisions.
> 
> Related: `00-ARCHITECTURE-OVERVIEW.md`, `03-CONSOLIDATED-PLAN.md`

---

## Purpose

Existing code was built organically before the 32 ARCH decisions were locked. This checklist ensures each component is reviewed for alignment before we build on top of it.

---

## Audit Process

### For Each Component:

1. **Read the code** — Understand what it does
2. **Check ARCH alignment** — Does it follow locked decisions?
3. **Document issues** — What needs to change?
4. **Estimate effort** — How much work to align?
5. **Prioritize** — Block migration or defer?

### Issue Severity

| Severity | Meaning | Action |
|----------|---------|--------|
| 🔴 Blocker | Fundamentally incompatible | Must fix before Phase 1 complete |
| 🟡 Major | Significant misalignment | Fix during Phase 1 |
| 🟢 Minor | Small adjustments needed | Can fix incrementally |
| ⚪ OK | Aligned | No changes needed |

---

## ARCH Decision Checklist

### Data Model (ARCH-001, ARCH-021, ARCH-022)

For each file that handles data:

- [ ] Uses 9 block types only (not old 15 types)
  - knowledge, decision, assumption, question, requirement, task, proposal, artifact, evidence
- [ ] Dimensions stored as JSON property (not separate types)
- [ ] North Star queryable as graph subgraph (when implemented)

**Files to check:**
- `schema/entities/*.ts`
- `agents/ideation/block-extractor.ts`
- `types/*.ts`

### Storage Layer (ARCH-002, ARCH-003, ARCH-006, ARCH-031)

- [ ] Graph queries ready for Neo4j (not SQLite-specific)
- [ ] Operational state uses Prisma patterns (not raw SQL)
- [ ] Scale assumption: ~100K nodes

**Files to check:**
- `database/*.ts`
- `agents/*/db.ts`
- Any file with SQL queries

### Deterministic vs AI (ARCH Philosophy)

For each agent/function:

- [ ] Routing is deterministic (not AI)
- [ ] Context assembly is deterministic (graph query)
- [ ] Validation is deterministic (type checks, tests)
- [ ] AI used only for: intent, gap analysis, proposal generation, execution

**Red flag:** AI call for something that could be a graph query or lookup.

### Plugin Architecture (ARCH-009)

- [ ] Ralph loops invoked as tools by Execution Agent
- [ ] Loops don't contain agent logic (they're execution harnesses)

**Files to check:**
- `coding-loops/shared/ralph_loop_base.py`
- `coding-loops/agents/build_agent_worker.py`

### Event System (ARCH-013)

- [ ] Events published to message bus
- [ ] Subscribers don't assume ordering
- [ ] Event-driven triggers exist (not just polling)

**Files to check:**
- `coding-loops/shared/message_bus.py`
- Any file with "subscribe" or "publish"

### Approval Gates (ARCH-014, ARCH-030)

- [ ] Proposals require explicit approval
- [ ] Knowledge can auto-approve
- [ ] Code/decisions/North Star require human approval
- [ ] Chat-primary UX (Telegram)

**Files to check:**
- Any file handling approvals
- Notification code

### Observability (ARCH-007)

- [ ] Agent extends ObservableAgent
- [ ] Actions traced to Langfuse
- [ ] Errors logged with context

**Files to check:**
- All files in `agents/`
- `coding-loops/shared/observable_agent.py`

### Coordination (ARCH-015, ARCH-016, ARCH-032)

- [ ] Parallel execution safe (file locking)
- [ ] Branch-per-loop strategy
- [ ] FastAPI endpoints for coordination (when implemented)

**Files to check:**
- `coding-loops/shared/message_bus.py` (file locking)
- Git-related code

---

## Component Audit Template

Use this template for each component:

```markdown
## Component: [Name]

**Location:** `path/to/files`

**Purpose:** What does it do?

**ARCH Alignment:**
| Decision | Status | Notes |
|----------|--------|-------|
| ARCH-001 (9 types) | ⚪/🟢/🟡/🔴 | |
| ARCH-002 (Neo4j) | ⚪/🟢/🟡/🔴 | |
| ... | | |

**Issues Found:**
1. [Issue description]
2. [Issue description]

**Effort Estimate:** [Hours/Days]

**Priority:** [Blocker/Major/Minor/OK]

**Recommendation:** [Keep as-is / Refactor / Rewrite / Remove]
```

---

## Components to Audit

### Priority 1: Data Layer (Blocks Migration)

| Component | Location | Auditor | Status |
|-----------|----------|---------|--------|
| Memory Block Schema | `schema/entities/memory-block.ts` | — | 🔲 |
| Memory Link Schema | `schema/entities/memory-link.ts` | — | 🔲 |
| Block Extractor | `agents/ideation/block-extractor.ts` | — | 🔲 |
| Graph State Loader | `agents/ideation/graph-state-loader.ts` | — | 🔲 |

### Priority 2: Core Agents

| Component | Location | Auditor | Status |
|-----------|----------|---------|--------|
| Ideation Orchestrator | `agents/ideation/orchestrator.ts` | — | 🔲 |
| Intent Classifier | `agents/ideation/intent-classifier.ts` | — | 🔲 |
| Gap Analysis | `agents/gap-analysis.ts` | — | 🔲 |
| SIA | `agents/sia/` | — | 🔲 |

### Priority 3: Infrastructure

| Component | Location | Auditor | Status |
|-----------|----------|---------|--------|
| Message Bus | `coding-loops/shared/message_bus.py` | — | 🔲 |
| Ralph Loop Base | `coding-loops/shared/ralph_loop_base.py` | — | 🔲 |
| Build Agent | `coding-loops/agents/build_agent_worker.py` | — | 🔲 |
| Observable Agent | `coding-loops/shared/observable_agent.py` | — | 🔲 |

### Priority 4: Supporting Code

| Component | Location | Auditor | Status |
|-----------|----------|---------|--------|
| Knowledge Base | `agents/knowledge-base/` | — | 🔲 |
| Spec Generator | `agents/ideation/spec-generator.ts` | — | 🔲 |
| Debate Agent | `agents/debate.ts` | — | 🔲 |
| Research Agent | `agents/research.ts` | — | 🔲 |

---

## Audit Results Summary

*To be filled as audits complete:*

| Category | Total | OK | Minor | Major | Blocker |
|----------|-------|-----|-------|-------|---------|
| Data Layer | 4 | — | — | — | — |
| Core Agents | 4 | — | — | — | — |
| Infrastructure | 4 | — | — | — | — |
| Supporting | 4 | — | — | — | — |
| **Total** | 16 | — | — | — | — |

---

## Post-Audit Actions

1. **Blockers** → Create tasks, assign to Phase 1
2. **Major issues** → Document in `05-PHASE1-FOUNDATION.md`
3. **Minor issues** → Add to backlog, fix incrementally
4. **OK components** → Ready for integration

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |

---

*This is a source-truth document. Changes require founder review.*
