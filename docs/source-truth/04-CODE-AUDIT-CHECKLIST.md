# Code Audit Checklist

> **Source of Truth** for reviewing existing code against ARCH decisions.
>
> Related: `00-ARCHITECTURE-OVERVIEW.md`, `03-CONSOLIDATED-PLAN.md`

---

## Purpose

Existing code was built organically before the 32 ARCH decisions were locked. This checklist ensures each component is reviewed for alignment.

**Key principle:** Audit blocking components first. Don't audit everything before starting.

---

## Priority Tiers

| Tier  | Meaning               | When to Audit             |
| ----- | --------------------- | ------------------------- |
| 🔴 P0 | Blocks Phase 1        | Before Phase 1 completes  |
| 🟡 P1 | Blocks specific phase | Before that phase starts  |
| 🟢 P2 | Non-blocking          | Incrementally, as touched |

---

## P0 Components (Must Audit First)

These block the Neo4j migration. Audit before anything else.

### 1. Memory Block Schema

**Location:** `schema/entities/memory-block.ts`

**Check:**

- [ ] Uses which of the old 15 types?
- [ ] Maps cleanly to new 9 types?
- [ ] What fields need migration?

**Acceptance:** Document type mapping, identify breaking changes.

---

### 2. Block Extractor

**Location:** `agents/ideation/block-extractor.ts`

**Check:**

- [ ] What block types does it create?
- [ ] How does it assign types?
- [ ] Does it use hardcoded type strings?

**Acceptance:** List all type references, plan refactor to 9 types.

---

### 3. Graph State Loader

**Location:** `agents/ideation/graph-state-loader.ts`

**Check:**

- [ ] What queries does it run?
- [ ] SQLite-specific syntax?
- [ ] Can queries translate to Cypher?

**Acceptance:** Document all queries, draft Cypher equivalents.

---

## P1 Components (Audit Before Phase)

### Phase 2 Blockers

#### Gap Analysis Agent

**Location:** `agents/gap-analysis.ts`

**Check:**

- [ ] What inputs does it need?
- [ ] Does it query the graph?
- [ ] Output format matches Proposal structure?

**Acceptance:** Confirm integration points with Neo4j and Proposal flow.

---

### Phase 3 Blockers

#### Message Bus

**Location:** `coding-loops/shared/message_bus.py`

**Check:**

- [ ] Publish/subscribe works?
- [ ] File locking tested under load?
- [ ] Event delivery latency?

**Acceptance:** Run stress test (100 events, 3 subscribers), measure latency.

---

## P2 Components (Audit Incrementally)

| Component         | Location                                    | Audit When                 |
| ----------------- | ------------------------------------------- | -------------------------- |
| Ideation Agent    | `agents/ideation/orchestrator.ts`           | When modifying             |
| Intent Classifier | `agents/ideation/intent-classifier.ts`      | When modifying             |
| SIA               | `agents/sia/`                               | When integrating with loop |
| Build Agent       | `coding-loops/agents/build_agent_worker.py` | When modifying             |
| Debate Agent      | `agents/debate.ts`                          | Phase 4                    |
| Research Agent    | `agents/research.ts`                        | When needed                |

---

## ARCH Decision Checklist

For each component, verify:

### Data Model (ARCH-001)

- [ ] Uses only 9 block types
- [ ] No references to old types (content, synthesis, pattern, option, action, external, etc.)
- [ ] Dimensions as JSON property, not type

### Deterministic vs AI

- [ ] Routing is code, not AI
- [ ] Context assembly is graph query, not AI
- [ ] Validation is type checks, not AI
- [ ] AI only for: intent, gap analysis, proposal generation, code generation

### Observability (ARCH-007)

- [ ] Extends ObservableAgent (Python) or equivalent
- [ ] Actions traced to Langfuse
- [ ] Errors logged with context

---

## Audit Report Template

```markdown
## Audit: [Component Name]

**Location:** `path/to/files`
**Auditor:** [name]
**Date:** [date]

### Summary

[1-2 sentences: what it does, overall status]

### ARCH Alignment

| Decision              | Status   | Notes |
| --------------------- | -------- | ----- |
| ARCH-001 (9 types)    | ✅/🟡/❌ |       |
| Deterministic routing | ✅/🟡/❌ |       |
| Observability         | ✅/🟡/❌ |       |

### Issues Found

1. **[Issue]** - [Severity: Blocker/Major/Minor]
   - Location: `file:line`
   - Fix: [what to do]

### Effort Estimate

[Hours to fix issues]

### Recommendation

[Keep / Refactor / Rewrite]
```

---

## Audit Progress Tracker

| Component           | Priority | Auditor | Status  | Issues                                |
| ------------------- | -------- | ------- | ------- | ------------------------------------- |
| Memory Block Schema | 🔴 P0    | Kai     | ✅ Done | 0 - Already aligned                   |
| Block Extractor     | 🔴 P0    | Kai     | ✅ Done | 2 - Fixed (prompt text, example type) |
| Graph State Loader  | 🔴 P0    | Kai     | ✅ Done | 5 - Fixed (old type references)       |
| Gap Analysis Agent  | 🟡 P1    | —       | 🔲      | —                                     |
| Message Bus         | 🟡 P1    | —       | 🔲      | —                                     |

---

## P0 Audit Reports

### Memory Block Schema

**Location:** `schema/entities/memory-block.ts`
**Auditor:** Kai | **Date:** 2026-02-05

**Summary:** Already fully aligned with ARCH-001. Uses exactly 9 canonical types with migration comments.

| Decision              | Status | Notes                              |
| --------------------- | ------ | ---------------------------------- |
| ARCH-001 (9 types)    | ✅     | Uses `blockTypes` array with all 9 |
| Deterministic routing | ✅     | N/A - schema only                  |
| Observability         | ✅     | N/A - schema only                  |

**Issues Found:** None
**Recommendation:** Keep as-is

---

### Block Extractor

**Location:** `agents/ideation/block-extractor.ts`
**Auditor:** Kai | **Date:** 2026-02-05

**Summary:** Good type mapping logic exists. Fixed minor prompt inconsistencies.

| Decision              | Status | Notes                             |
| --------------------- | ------ | --------------------------------- |
| ARCH-001 (9 types)    | ✅     | Has correct mapping, prompt fixed |
| Deterministic routing | ✅     | Validation is code-based          |
| Observability         | 🟡     | Could add Langfuse tracing        |

**Issues Found:**

1. **Minor** - Prompt said "11 types" → Fixed to "9 types"
2. **Minor** - Example JSON used `"types": ["fact"]` → Fixed to `"knowledge"`

**Effort:** 5 minutes
**Recommendation:** Keep - issues fixed

---

### Graph State Loader

**Location:** `agents/ideation/graph-state-loader.ts`
**Auditor:** Kai | **Date:** 2026-02-05

**Summary:** Multiple hardcoded references to old block types. All fixed.

| Decision              | Status | Notes                                   |
| --------------------- | ------ | --------------------------------------- |
| ARCH-001 (9 types)    | ✅     | Fixed - all references updated          |
| Deterministic routing | ✅     | Graph queries are deterministic         |
| Observability         | 🟡     | Has console logging, could add Langfuse |

**Issues Found:**

1. **Major** - `extractSelfDiscovery` used "insight" → Fixed to "knowledge"
2. **Major** - `extractSelfDiscovery` used "fact" → Fixed to "knowledge"
3. **Major** - `extractSelfDiscovery` used "constraint" → Fixed to "requirement"
4. **Major** - `extractMarketDiscovery` used "insight", "option", "learning" → Fixed
5. **Minor** - `blockTypeDescriptions` listed old types → Fixed to 9 canonical

**Effort:** 15 minutes
**Recommendation:** Keep - issues fixed

---

## Revision History

| Date       | Change                                               | Author         |
| ---------- | ---------------------------------------------------- | -------------- |
| 2026-02-05 | Initial creation                                     | AI Agent (Kai) |
| 2026-02-05 | Added priority tiers, focused on blocking components | AI Agent (Kai) |

---

_This is a source-truth document. Changes require founder review._
