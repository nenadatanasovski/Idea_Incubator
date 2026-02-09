# PHASE4-TASK-05: Memory Persistence in Parent Harness Database

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Medium (8 hours / 1 day)
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Enhance the existing Parent Harness agent memory system with persistent database storage, lifecycle management, and long-term knowledge retention. This task builds upon the existing in-memory `agent_memory` table to create a comprehensive memory persistence layer that enables agents to learn from past attempts, retain knowledge across sessions, and improve autonomous decision-making over time.

**Problem:** The current agent memory system (`parent-harness/orchestrator/src/memory/index.ts`) provides basic in-memory storage with an SQLite-backed `agent_memory` table. However, it lacks:
1. **Migration-based schema management** - Memory table created via runtime SQL, not versioned migrations
2. **Memory lifecycle management** - No expiration cleanup, archival, or pruning mechanisms
3. **Cross-session persistence** - Memories expire but don't migrate to long-term storage
4. **Importance decay** - No automatic decay of relevance over time
5. **Memory promotion** - No path from short-term memory to knowledge base
6. **Analytics & observability** - No metrics on memory usage, access patterns, retention

**Solution:** Create a robust memory persistence infrastructure that:
1. Migrates existing `agent_memory` table to versioned schema
2. Implements memory lifecycle (creation → active → archived → purged)
3. Adds automatic importance decay based on access patterns
4. Provides memory analytics and cleanup services
5. Bridges agent memory with knowledge base (PHASE4-TASK-01)
6. Supports memory export/import for backup and migration

**Key Insight:** This is NOT about replacing the existing memory system—it's about adding production-grade persistence, lifecycle management, and observability to make the memory system scalable and maintainable long-term.

---

## Current State Analysis

### Existing Infrastructure ✅ (80% Complete)

1. **Agent Memory Module** (`parent-harness/orchestrator/src/memory/index.ts`)
   - ✅ `agent_memory` table with runtime creation
   - ✅ Core functions: `remember()`, `recall()`, `recallAll()`, `forget()`
   - ✅ Memory types: context, learning, preference, error_pattern, success_pattern
   - ✅ Access tracking (access_count, last_accessed)
   - ✅ Importance scoring (1-10 scale)
   - ✅ TTL support (expires_at column)
   - ✅ Convenience functions: `rememberTaskContext()`, `learnSuccess()`, `learnError()`
   - ❌ **Gap:** No expiration cleanup cron
   - ❌ **Gap:** No importance decay over time
   - ❌ **Gap:** No migration-based schema
   - ❌ **Gap:** No memory archival before deletion
   - ❌ **Gap:** No memory analytics/metrics

2. **Database Schema** (`parent-harness/database/schema.sql`)
   - ✅ `agent_memory` table definition exists
   - ✅ Indexes on agent_id, type
   - ❌ **Gap:** Not in migration system (created at runtime instead)
   - ❌ **Gap:** No `archived_memories` table
   - ❌ **Gap:** No `memory_analytics` table

3. **Migration System** (`parent-harness/orchestrator/database/migrations/`)
   - ✅ Migration 001: Task state history, executions, activities
   - ❌ **Gap:** No migration for agent_memory table
   - ❌ **Gap:** No migration for memory lifecycle tables

4. **Knowledge Base System** (PHASE4-TASK-01 - Specified)
   - ✅ Specification exists for knowledge_entries, error_recovery_strategies
   - ❌ **Gap:** Not yet implemented
   - ❌ **Gap:** No bridge from agent_memory to knowledge_entries

### Gaps Identified ❌ (20% Missing)

1. **Schema Migration** - agent_memory not in versioned migration system
2. **Lifecycle Management** - No expiration cleanup, no archival, no purging
3. **Importance Decay** - Static importance scores don't reflect relevance over time
4. **Memory Promotion** - No automatic promotion to knowledge base
5. **Analytics** - No visibility into memory usage, retention, access patterns
6. **Backup/Export** - No export mechanism for memory backups
7. **Memory Pruning** - No automatic cleanup of low-value memories

---

## Requirements

### Functional Requirements

**FR-1: Migration-Based Schema Management**
- MUST create migration `002_memory_persistence.sql` with:
  - `agent_memory` table (migrate from runtime creation)
  - `archived_memories` table for retention
  - `memory_analytics` table for metrics
- MUST support rollback (down migration)
- MUST preserve existing memory data during migration
- MUST add new columns: `archived_at`, `importance_decay_rate`, `last_decay_at`

**FR-2: Memory Lifecycle Management**
- MUST implement expiration cleanup service (runs every 15 minutes)
  - Find memories where `expires_at < NOW()`
  - Archive to `archived_memories` table
  - Delete from `agent_memory` table
- MUST implement importance decay service (runs every 24 hours)
  - Decay importance by `decay_rate` per day (default: 0.1/day)
  - Never decay below importance threshold (default: 1)
  - Skip decay for memories accessed recently (< 7 days)
- MUST implement memory pruning service (runs weekly)
  - Delete archived memories older than retention period (default: 90 days)
  - Keep high-importance archived memories indefinitely (importance >= 8)
- MUST log all lifecycle actions (archived, decayed, pruned)

**FR-3: Memory Archival**
- MUST archive memories before deletion (audit trail)
- MUST preserve all memory fields in archive:
  - Original memory data (id, agent_id, type, key, value, metadata)
  - Lifecycle metadata (created_at, expires_at, access_count, importance)
  - Archival metadata (archived_at, archived_reason)
- MUST support querying archived memories for forensics
- MUST support restoring archived memories to active state

**FR-4: Importance Decay**
- MUST calculate decay based on access patterns:
  - No access for 30 days: decay rate = 0.2/day
  - No access for 7 days: decay rate = 0.1/day
  - Accessed recently: decay rate = 0.0 (no decay)
- MUST boost importance on access:
  - Each access: +0.1 importance (max 10)
- MUST support per-memory custom decay rates (metadata override)
- MUST record last decay timestamp for auditing

**FR-5: Memory Analytics**
- MUST track daily metrics:
  - Total memories per agent (by type)
  - Average importance per agent
  - Access rate (accesses per day)
  - Expiration rate (expired per day)
  - Archive rate (archived per day)
  - Storage size (bytes)
- MUST expose metrics via `/api/memory/metrics` endpoint
- MUST record metrics snapshot daily to `memory_analytics` table
- SHOULD generate weekly memory health reports

**FR-6: Memory Promotion to Knowledge Base**
- MUST identify promotion candidates:
  - importance >= 8
  - access_count >= 5
  - type IN ('error_pattern', 'success_pattern', 'learning')
  - age >= 14 days (validated over time)
- MUST promote validated memories to knowledge base (when PHASE4-TASK-01 complete)
- MUST mark promoted memories with `promoted_at` timestamp
- MUST keep promoted memories in agent_memory (don't delete)
- SHOULD emit event: `memory:promoted` with memory ID

**FR-7: Memory Export/Import**
- MUST support exporting agent memories to JSON
  - Include all active + archived memories
  - Include metadata, importance, access stats
- MUST support importing memories from JSON (restore from backup)
- MUST validate imported data (schema, types, constraints)
- MUST handle conflicts (existing memories with same key)

**FR-8: API Enhancements**
- MUST add `GET /api/memory/:agentId/archived` - Query archived memories
- MUST add `POST /api/memory/:agentId/restore/:memoryId` - Restore from archive
- MUST add `GET /api/memory/metrics` - Memory analytics
- MUST add `POST /api/memory/export/:agentId` - Export memories to JSON
- MUST add `POST /api/memory/import/:agentId` - Import memories from JSON
- MUST add `POST /api/memory/prune` - Manual pruning trigger

### Non-Functional Requirements

**NFR-1: Performance**
- Expiration cleanup MUST complete in <5 seconds for 1000+ memories
- Importance decay MUST process 10,000+ memories in <30 seconds
- Memory queries MUST respond in <50ms (indexed lookups)
- Analytics calculation MUST complete in <10 seconds
- MUST NOT block agent operations during cleanup/decay

**NFR-2: Data Integrity**
- Memory lifecycle operations MUST be atomic (transaction-based)
- Archival MUST preserve all original data (no data loss)
- Importance decay MUST never go below minimum threshold
- MUST validate memory types against allowed enum
- MUST enforce agent_id isolation (agents can't access others' memories)

**NFR-3: Observability**
- MUST log all lifecycle events (archived, decayed, pruned) with counts
- MUST emit events: `memory:expired`, `memory:archived`, `memory:pruned`, `memory:promoted`
- MUST track service execution times (cleanup, decay, prune)
- SHOULD alert if cleanup fails 3+ times consecutively
- SHOULD alert if memory growth exceeds threshold (10,000+ per agent)

**NFR-4: Backward Compatibility**
- MUST NOT change existing memory API signatures
- MUST preserve all existing memory data during migration
- New lifecycle features MUST be opt-in (configurable)
- Default configuration MUST match current behavior (no breaking changes)

**NFR-5: Scalability**
- MUST support 100,000+ total memories across all agents
- MUST support 10,000+ memories per agent
- MUST handle 1000+ daily memory operations
- Archived memories MUST be queryable without performance degradation

---

## Pass Criteria

### Database Schema

1. ✅ **Migration created** - `002_memory_persistence.sql` exists with all tables
2. ✅ **Migration applies cleanly** - No errors when running migration
3. ✅ **Rollback works** - Down migration restores previous state
4. ✅ **Data preserved** - Existing memories migrate without loss

### Lifecycle Management

5. ✅ **Expiration cleanup works** - Expired memories archived and deleted
6. ✅ **Importance decay works** - Importance decreases based on access patterns
7. ✅ **Memory archival works** - Archived memories preserve all data
8. ✅ **Memory pruning works** - Old archived memories deleted (except high-importance)
9. ✅ **Services start/stop** - Lifecycle services can be started and stopped cleanly

### Analytics

10. ✅ **Daily metrics recorded** - `memory_analytics` populated daily
11. ✅ **Metrics endpoint works** - `GET /api/memory/metrics` returns data
12. ✅ **Per-agent metrics work** - Metrics calculated for each agent
13. ✅ **System-wide metrics work** - Aggregated metrics calculated

### API Enhancements

14. ✅ **Archived endpoint works** - `GET /api/memory/:agentId/archived` returns archived memories
15. ✅ **Restore endpoint works** - `POST /api/memory/:agentId/restore/:memoryId` restores memory
16. ✅ **Export works** - `POST /api/memory/export/:agentId` returns JSON
17. ✅ **Import works** - `POST /api/memory/import/:agentId` imports JSON
18. ✅ **Prune endpoint works** - `POST /api/memory/prune` triggers manual pruning

### Integration

19. ✅ **Server integration** - Lifecycle services start with server
20. ✅ **Event emission works** - Events emitted for lifecycle actions
21. ✅ **Logging works** - All lifecycle actions logged

### Performance

22. ✅ **Cleanup performance** - Processes 1000+ memories in <5s
23. ✅ **Decay performance** - Processes 10,000+ memories in <30s
24. ✅ **Query performance** - API endpoints respond in <50ms

### Testing

25. ✅ **Unit tests pass** - All lifecycle, analytics functions tested
26. ✅ **Integration tests pass** - End-to-end memory lifecycle tested
27. ✅ **Load test passes** - System handles 100,000+ total memories

---

## Dependencies

**Upstream (Must Complete First):**
- ✅ PHASE2-TASK-01: Database schema foundation (COMPLETE)
- ✅ PHASE3-TASK-01: Task queue persistence (COMPLETE)
- ✅ Agent memory system exists (`parent-harness/orchestrator/src/memory/index.ts`)

**Downstream (Depends on This):**
- PHASE4-TASK-01: Knowledge Base system (memory promotion integration)
- PHASE6-TASK-01: Self-improvement loop (uses memory analytics)

**Parallel Work (Can Develop Concurrently):**
- PHASE4-TASK-02: Agent introspection (complementary, uses memory data)

---

## Implementation Plan

### Phase 1: Database Migration (1.5 hours)
1. Create `002_memory_persistence.sql` migration
2. Add rollback script `002_memory_persistence_down.sql`
3. Test migration on dev database
4. Verify data preservation from existing runtime-created table

### Phase 2: Lifecycle Service (3 hours)
5. Create `memory/lifecycle.ts`
6. Implement `cleanupExpiredMemories()`
7. Implement `decayMemoryImportance()`
8. Implement `pruneArchivedMemories()`
9. Implement `archiveMemory()`, `restoreMemory()`
10. Add lifecycle logging
11. Unit test all lifecycle functions

### Phase 3: Analytics Service (2 hours)
12. Create `memory/analytics.ts`
13. Implement `calculateMetrics()`
14. Implement `recordDailyMetrics()`
15. Implement `getMetrics()`
16. Test metrics calculation accuracy

### Phase 4: API Enhancements (1.5 hours)
17. Extend `api/memory.ts` with new endpoints
18. Add archived query endpoint
19. Add restore endpoint
20. Add export/import endpoints
21. Add manual prune trigger

### Phase 5: Integration (1 hour)
22. Modify `server.ts` to start lifecycle services
23. Wire daily metrics recording
24. Add event emission for lifecycle actions
25. Test server startup/shutdown

### Phase 6: Testing & Documentation (2 hours)
26. Write unit tests for lifecycle functions
27. Write unit tests for analytics
28. Write integration test: expire → archive → prune flow
29. Load test with 100,000+ memories
30. Update README with lifecycle configuration

**Total Estimated Effort:** 11 hours (~1.5 days)

---

## Success Metrics

**Operational:**
- Cleanup service runs every 15 minutes without errors
- Decay service processes 10,000+ memories in <30s
- Pruning service removes old archives weekly
- Daily metrics recorded at midnight every day

**Data Quality:**
- 100% of expired memories archived before deletion
- Importance decay follows configured rates
- High-importance archived memories (>=8) never pruned
- Lifecycle log captures all state transitions

**Performance:**
- Memory queries respond in <50ms
- Lifecycle operations don't block agent spawns
- Analytics calculation completes in <10s
- System handles 100,000+ memories without degradation

---

## Rollback Plan

If memory persistence causes issues:

1. **Disable lifecycle services:**
   - Comment out `startLifecycleServices()` in `server.ts`
   - Memory system reverts to original runtime behavior

2. **Rollback database migration:**
   - Run `002_memory_persistence_down.sql`
   - Existing runtime memory creation continues working

3. **Remove API endpoints:**
   - Comment out new routes in `api/memory.ts`
   - Existing memory API remains functional

**No data loss** - Archived memories preserved in backup before rollback.

---

## References

- **Existing Infrastructure:**
  - `parent-harness/orchestrator/src/memory/index.ts` - Current memory system
  - `parent-harness/database/schema.sql` - Database schema
  - `parent-harness/orchestrator/database/migrations/001_vibe_patterns.sql` - Migration example

- **Related Specifications:**
  - `docs/specs/PHASE4-TASK-01-knowledge-base-system.md` - Knowledge base (downstream)
  - `docs/specs/PHASE4-TASK-02-agent-introspection.md` - Introspection (parallel)
  - `STRATEGIC_PLAN.md` - Phase 4: Agent Memory & Learning System

- **Strategic Context:**
  - Phase 4 Goal: Build knowledge base systems allowing agents to learn from past attempts
  - Deliverable: Memory persistence in Parent Harness database
  - Duration: 4-6 days (this task: 1.5 days)

---

**Specification Sign-off:**
This specification is ready for implementation. All dependencies are satisfied (memory system exists, migration framework exists), design is detailed with implementation guidance, and pass criteria are testable.

**Next Steps:**
1. Assign to build_agent for implementation
2. Estimated delivery: 11 hours (1.5 days)
3. Verification by qa_agent after implementation
4. Mark PHASE4-TASK-05 as COMPLETE after QA validation
