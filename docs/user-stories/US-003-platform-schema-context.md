# US-003: Platform Schema Context for Agents

## Problem Statement

Agents working on the Vibe Platform itself need to understand Vibe's database schema (the data model in `ideas.db`). While the RelationshipMapper service exists and provides schema introspection, agents don't automatically receive this context when they start tasks.

This results in agents:

- Not knowing what tables exist
- Not understanding relationships between entities
- Making incorrect assumptions about data types
- Creating code that doesn't fit the existing data model

---

## User Stories

### US-003.1: As an agent working on Vibe Platform, I need schema context

**As a** Build Agent working on a Vibe Platform task
**I want to** receive the complete database schema at task start
**So that** I understand the data model and can write correct code

**Acceptance Criteria:**

- Agent receives list of all tables
- Agent receives column definitions (name, type, constraints)
- Agent receives foreign key relationships
- Agent receives existing indexes
- Context is automatically injected, not manually requested

---

### US-003.2: As a developer, I want schema context to be current

**As a** developer using Vibe to build Vibe
**I want** agents to always have the latest schema
**So that** they don't generate code for outdated tables

**Acceptance Criteria:**

- Schema context reflects current database state
- Migrations are reflected within reasonable time
- No manual refresh required after schema changes
- Clear indication of schema version/timestamp

---

### US-003.3: As an agent, I need schema in usable format

**As a** Build Agent
**I want** schema in a format I can reason about
**So that** I can make correct decisions about data operations

**Acceptance Criteria:**

- Schema includes human-readable descriptions where available
- Relationships are clearly marked (1:1, 1:N, N:M)
- Primary and foreign keys are highlighted
- Nullable vs non-nullable is clear

---

## End-to-End Flows

### Flow 1: Agent Gets Schema at Task Start (Platform Tasks)

```
1. Task created for Vibe Platform (project.is_platform = true)
2. Task assigned to Build Agent
3. Build Agent Orchestrator detects this is a platform task
4. Orchestrator calls RelationshipMapper.getFullGraph()
5. RelationshipMapper:
   a. Queries sqlite_master for all tables
   b. Queries PRAGMA table_info for each table
   c. Queries PRAGMA foreign_key_list for relationships
   d. Builds complete schema graph
   e. Caches for 60 seconds
6. Orchestrator formats schema as markdown
7. Orchestrator injects schema into agent's system prompt
8. Agent now knows all tables, columns, relationships
9. Agent executes task with full schema context
```

### Flow 2: Schema Changes During Session

```
1. Agent completes task that includes database migration
2. Migration adds new table or modifies existing
3. Agent triggers schema cache invalidation
4. Next agent task starts
5. RelationshipMapper re-queries schema (cache expired)
6. New agent receives updated schema
7. Context stays current
```

### Flow 3: User Queries Schema via UI

```
1. User navigates to Observability > Database
2. Frontend fetches /api/objects/tables
3. API uses same RelationshipMapper service
4. User sees ERD diagram with all relationships
5. User clicks table to see column details
6. Same schema data is shown to users and agents
```

---

## Current System State

### What Exists Today

| Component          | Location                                                 | Status                                |
| ------------------ | -------------------------------------------------------- | ------------------------------------- |
| RelationshipMapper | `server/services/observability/relationship-mapper.ts`   | **Works** - Full schema introspection |
| Objects API        | `server/routes/objects.ts`                               | **Works** - Exposes schema via REST   |
| TableERD           | `frontend/src/components/observability/TableERD.tsx`     | **Works** - Visualizes relationships  |
| FullERDModal       | `frontend/src/components/observability/FullERDModal.tsx` | **Works** - Full ERD view             |

### What's Missing

| Component                           | Status             |
| ----------------------------------- | ------------------ |
| Schema injection into agents        | **Does not exist** |
| Platform task detection             | **Does not exist** |
| Schema formatting for agents        | **Does not exist** |
| Cache invalidation after migrations | **Does not exist** |

### RelationshipMapper Capabilities

The service already provides:

- `getFullGraph()` - All tables with columns and relationships
- `getDirectRelationships(tableName)` - Incoming/outgoing for one table
- `getRelationshipCluster(tableName)` - Transitively connected tables
- `getAllClusters()` - All relationship clusters
- `canRunParallel(table1, table2)` - Conflict detection

---

## Suggested Solution

### Phase 1: Add Platform Task Detection

Modify task/project model to identify platform tasks:

- Add `is_platform` flag to projects table
- Create "Vibe Platform" project record with `is_platform = true`
- Task inherits platform flag from project

### Phase 2: Create Schema Formatter for Agents

New utility at `server/services/schema-formatter.ts`:

- `formatSchemaForAgent(graph)` - Convert RelationshipMapper output to markdown
- Include table descriptions from comments
- Highlight PKs, FKs, indexes
- Format relationships clearly

### Phase 3: Inject Schema at Agent Spawn

Modify `spawnBuildAgent()` in orchestrator:

- Check if task.project.is_platform
- If yes, call RelationshipMapper.getFullGraph()
- Format schema to markdown
- Include in agent's system prompt

### Phase 4: Cache Invalidation

Add cache invalidation trigger:

- After migration runs, clear RelationshipMapper cache
- After task modifies schema/, trigger refresh
- Expose manual refresh endpoint

---

## Critical Questions

### Architecture Questions

1. **Should all agents get schema, or only DB-related tasks?**
   - Option A: All platform tasks get full schema
   - Option B: Only tasks touching database/ or schema/ get schema
   - Option C: Agent requests schema if needed
   - **Trade-off**: Token cost vs completeness

2. **How much schema is too much?**
   - Vibe has ~50+ tables
   - Full schema could be 5000+ tokens
   - **Risk**: Context window bloat, cost increase

3. **Should we summarize or give full detail?**
   - Option A: Full columns, all indexes, all constraints
   - Option B: Summary with on-demand detail
   - Option C: Only relevant tables based on task file impacts
   - **Risk**: Summarization loses important details

### Technical Questions

4. **How do we match task to relevant tables?**
   - File impacts might reference routes/users.ts
   - How do we know that touches `users` table?
   - **Risk**: Wrong tables included, right tables excluded

5. **When should cache expire?**
   - Current: 60 seconds
   - After migration: immediately
   - **Risk**: Stale schema if cache not invalidated properly

6. **How do we test schema injection?**
   - Mock RelationshipMapper?
   - Use test database?
   - **Risk**: Tests pass but production fails

### Integration Questions

7. **How does this differ from user project schema?**
   - Platform uses RelationshipMapper (SQLite introspection)
   - User projects use .vibe/schema.md
   - Same agent code, different schema sources
   - **Risk**: Inconsistent schema format confuses agents

8. **What about non-SQLite databases in user projects?**
   - RelationshipMapper only works for SQLite
   - User projects might use PostgreSQL, MySQL
   - **Risk**: Schema introspection doesn't generalize

---

## Gaps Analysis

### Gap 1: No Platform Task Detection

**Current State:** All tasks treated the same, no `is_platform` flag
**Required State:** Platform tasks identified for special handling
**Impact:** Can't conditionally inject platform schema
**Solution:** Add `is_platform` to projects, detect at task spawn

### Gap 2: Schema Not Injected into Agents

**Current State:** Agents start without schema knowledge
**Required State:** Platform agents receive schema in system prompt
**Impact:** Agents make incorrect data model assumptions
**Solution:** Call RelationshipMapper at spawn, inject result

### Gap 3: No Schema Formatter

**Current State:** RelationshipMapper returns JSON, agents need text
**Required State:** Schema formatted as readable markdown
**Impact:** Can't inject schema in useful format
**Solution:** Create formatSchemaForAgent utility

### Gap 4: Cache Not Invalidated After Migrations

**Current State:** RelationshipMapper caches for 60s
**Required State:** Cache cleared after schema changes
**Impact:** Agents may see stale schema right after migration
**Solution:** Add invalidation hooks after migration commands

### Gap 5: No Relevant Table Filtering

**Current State:** Would inject entire schema
**Required State:** Filter to relevant tables based on task
**Impact:** Token waste, potential confusion
**Solution:** Map file impacts to tables, include only related

---

## Other Considerations

### Performance

- Schema introspection is fast (~50ms for full graph)
- Caching prevents repeated queries
- Markdown formatting is CPU-bound, cache result

### Token Economics

- Full schema: ~5000 tokens
- Per-table: ~100 tokens
- Consider "schema summary" mode for large projects

### Consistency

- Platform schema and user project schema should have same format
- Agents should process both the same way
- Shared SchemaFormatter utility

### Documentation

- Schema.md format should be documented
- Agents should know how to read it
- Consider including reading instructions in prompt

### Edge Cases

- What if RelationshipMapper fails?
- What if schema is empty (new project)?
- What about views, triggers, other DB objects?
