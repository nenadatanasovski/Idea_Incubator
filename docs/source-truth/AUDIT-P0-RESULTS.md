# P0 Code Audit Results

> Audit of components blocking Phase 1 (Neo4j migration)
>
> **Date:** 2026-02-05
> **Auditor:** Kai (AI Agent)

---

## Executive Summary

| Component           | Status   | Blocker Issues                          | Effort |
| ------------------- | -------- | --------------------------------------- | ------ |
| Memory Block Schema | 🔴 Major | Uses 15 old types, not 9 new            | Medium |
| Memory Link Schema  | ✅ OK    | Matches Neo4j schema                    | None   |
| Block Extractor     | 🔴 Major | Uses 11 different types, SQLite queries | High   |
| Graph State Loader  | 🟡 Minor | SQLite patterns, but abstracted         | Medium |

**Bottom line:** Block types are inconsistent across codebase. Three different type systems in use. Must unify before migration.

---

## 1. Memory Block Schema

**Location:** `schema/entities/memory-block.ts`

### Current State

Uses **15 block types** (old organic growth):

```typescript
export const blockTypes = [
  "content",
  "link",
  "meta",
  "synthesis",
  "pattern",
  "decision",
  "option",
  "derived",
  "assumption",
  "cycle",
  "placeholder",
  "stakeholder_view",
  "topic",
  "external",
  "action",
] as const;
```

### ARCH Alignment

| Decision           | Status  | Notes                   |
| ------------------ | ------- | ----------------------- |
| ARCH-001 (9 types) | ❌ Fail | Uses 15 types, need 9   |
| Deterministic      | ✅ OK   | Schema is deterministic |
| Observability      | N/A     | Schema doesn't trace    |

### Issues

1. **Type mismatch** - 🔴 Blocker
   - Schema has 15 types
   - ARCH-001 requires 9: knowledge, decision, assumption, question, requirement, task, proposal, artifact, evidence
   - Missing: knowledge, question, requirement, proposal, artifact, evidence
   - Extra: content, link, meta, synthesis, pattern, option, derived, cycle, placeholder, stakeholder_view, topic, external, action

2. **Migration needed** - 🔴 Blocker
   - All existing data uses old types
   - Migration script must map old → new

### Type Mapping (for migration)

| Old Type         | New Type   | Notes                                      |
| ---------------- | ---------- | ------------------------------------------ |
| content          | knowledge  | General content → knowledge                |
| synthesis        | knowledge  | Synthesized info → knowledge               |
| pattern          | knowledge  | Patterns are knowledge                     |
| decision         | decision   | Direct map                                 |
| option           | decision   | Options are decisions (status: considered) |
| assumption       | assumption | Direct map                                 |
| action           | task       | Actions are tasks                          |
| external         | evidence   | External data is evidence                  |
| derived          | knowledge  | Derived info → knowledge                   |
| cycle            | knowledge  | Cycle info → knowledge                     |
| stakeholder_view | knowledge  | Views are knowledge                        |
| link             | —          | Remove, use graph edges                    |
| meta             | —          | Remove, use block properties               |
| topic            | —          | Remove, use dimension tags                 |
| placeholder      | question   | Placeholders become questions              |

### Fix Required

```typescript
// New schema (ARCH-001 compliant)
export const blockTypes = [
  "knowledge",
  "decision",
  "assumption",
  "question",
  "requirement",
  "task",
  "proposal",
  "artifact",
  "evidence",
] as const;
```

**Effort:** 2-4 hours (schema change + migration script)

---

## 2. Memory Link Schema

**Location:** `schema/entities/memory-link.ts`

### Current State

Uses **21 link types**:

```typescript
export const linkTypes = [
  "addresses",
  "creates",
  "requires",
  "conflicts",
  "supports",
  "depends_on",
  "enables",
  "suggests",
  "supersedes",
  "validates",
  "invalidates",
  "references",
  "evidence_for",
  "elaborates",
  "refines",
  "specializes",
  "alternative_to",
  "instance_of",
  "constrained_by",
  "derived_from",
  "measured_by",
] as const;
```

### ARCH Alignment

| Decision      | Status | Notes                         |
| ------------- | ------ | ----------------------------- |
| ARCH-001      | ✅ OK  | Link types match Neo4j schema |
| Deterministic | ✅ OK  | Schema is deterministic       |

### Issues

None. Link types already match `02-NEO4J-SCHEMA.md`.

**Effort:** None

---

## 3. Block Extractor

**Location:** `agents/ideation/block-extractor.ts`

### Current State

Uses **11 "canonical" block types** in extraction prompt:

```
1. insight, 2. fact, 3. assumption, 4. question, 5. decision,
6. action, 7. requirement, 8. option, 9. pattern, 10. synthesis, 11. meta
```

This is a **third type system** that matches neither:

- Not the schema's 15 types
- Not ARCH-001's 9 types

### ARCH Alignment

| Decision              | Status     | Notes                    |
| --------------------- | ---------- | ------------------------ |
| ARCH-001 (9 types)    | ❌ Fail    | Uses 11 different types  |
| Deterministic routing | ✅ OK      | Routing is code          |
| AI for extraction     | ✅ OK      | Correctly uses Haiku     |
| Observability         | 🟡 Partial | Logs errors, no Langfuse |

### Issues

1. **Type system mismatch** - 🔴 Blocker
   - Extraction prompt uses 11 types
   - Schema expects 15 types
   - ARCH-001 requires 9 types
   - Results in data inconsistency

2. **SQLite-specific queries** - 🔴 Blocker
   - Direct SQL: `INSERT INTO memory_blocks...`
   - `await run(...)`, `await query(...)`
   - Must change to Neo4j Cypher

3. **Validation remapping is fragile** - 🟡 Major
   - `validateBlockTypes()` tries to remap
   - Complex logic, easy to break
   - Should be simple with correct types

4. **Graph membership logic mixed in** - 🟡 Major
   - Extraction handles both blocks AND graph memberships
   - Should be separate concerns

### Code Samples Needing Change

```typescript
// Current: Direct SQLite
await run(
  `INSERT INTO memory_blocks (id, session_id, type, ...) VALUES (?, ?, ?, ...)`,
  [block.id, block.sessionId, block.type, ...]
);

// Needed: Neo4j Cypher
await session.run(`
  CREATE (b:Block:${blockType} {
    id: $id,
    sessionId: $sessionId,
    ...
  })
`, params);
```

### Fix Required

1. Update extraction prompt to use 9 ARCH-001 types
2. Remove remapping complexity (not needed if types match)
3. Replace SQLite queries with Neo4j
4. Add Langfuse tracing

**Effort:** 6-8 hours

---

## 4. Graph State Loader

**Location:** `agents/ideation/graph-state-loader.ts`

### Current State

Uses `graphQueryService` which abstracts database access:

```typescript
const [userBlocks, marketBlocks, ...] = await Promise.all([
  graphQueryService.getUserProfile(ideaId),
  graphQueryService.getMarketContext(ideaId),
  graphQueryService.query({ ideaId, graphMemberships: [...] }),
]);
```

### ARCH Alignment

| Decision           | Status     | Notes                         |
| ------------------ | ---------- | ----------------------------- |
| ARCH-001 (9 types) | 🟡 Partial | References old types in logic |
| Deterministic      | ✅ OK      | Query logic is deterministic  |
| Observability      | 🟡 Partial | No explicit tracing           |

### Issues

1. **Old type references in logic** - 🟡 Major
   - `b.blockTypes.includes("insight")` — not in new 9
   - `b.blockTypes.includes("fact")` — not in new 9
   - `b.blockTypes.includes("constraint")` — not in new 9

2. **Abstraction helps** - ✅ Good
   - Uses `graphQueryService`, not direct SQL
   - Service can be swapped to Neo4j
   - State reconstruction logic is reusable

3. **Graph membership concepts** - ✅ Good
   - Uses `graphMemberships: ["market", "competition"]`
   - This maps to Neo4j `topic` property
   - Pattern is compatible with new schema

### Fix Required

1. Update type references to use new 9 types
2. Replace `graphQueryService` implementation with Neo4j
3. Add Langfuse tracing

**Effort:** 3-4 hours

---

## Dependency Graph

```
Block Extractor ──creates──▶ Memory Blocks ──uses schema──▶ Memory Block Schema
       │                           │
       │                           ▼
       │                    Memory Links ──uses schema──▶ Memory Link Schema
       │                           │
       ▼                           ▼
Graph State Loader ◀──queries── graphQueryService
```

**Fix order:**

1. Memory Block Schema (define correct types)
2. Block Extractor (use correct types, Neo4j writes)
3. graphQueryService (swap to Neo4j)
4. Graph State Loader (update type references)

---

## Summary of Required Changes

### Phase 1a: Type Unification

| Task                        | File                    | Change                   |
| --------------------------- | ----------------------- | ------------------------ |
| Update schema               | `memory-block.ts`       | 15 types → 9 types       |
| Update extractor prompt     | `block-extractor.ts`    | 11 types → 9 types       |
| Update extractor validation | `block-extractor.ts`    | Remove complex remapping |
| Update loader references    | `graph-state-loader.ts` | insight/fact → knowledge |

### Phase 1b: Storage Migration

| Task             | File                        | Change             |
| ---------------- | --------------------------- | ------------------ |
| Neo4j write      | `block-extractor.ts`        | SQLite → Cypher    |
| Neo4j query      | `graphQueryService`         | SQLite → Cypher    |
| Migration script | `scripts/migrate-blocks.ts` | Move existing data |

### Total Effort Estimate

| Component           | Hours           |
| ------------------- | --------------- |
| Memory Block Schema | 2-4             |
| Block Extractor     | 6-8             |
| Graph State Loader  | 3-4             |
| Migration Script    | 4-6             |
| Testing             | 4-6             |
| **Total**           | **19-28 hours** |

---

## Recommendations

1. **Do type unification FIRST** — Before any Neo4j work, get types consistent
2. **Create mapping table** — Document exactly how each old type maps to new
3. **Update extraction prompt early** — It's the source of new data
4. **Keep SQLite working** — Don't break existing until Neo4j is validated
5. **Test with real data** — Run migration on copy of production data

---

## Next Steps

1. [ ] Create `ARCH-001-TYPE-MAPPING.md` with exact mapping rules
2. [ ] Update `memory-block.ts` schema to 9 types
3. [ ] Update Block Extractor prompt and validation
4. [ ] Write migration script
5. [ ] Test migration on data copy
6. [ ] Proceed to Neo4j setup

---

_Audit complete. Ready for review._
