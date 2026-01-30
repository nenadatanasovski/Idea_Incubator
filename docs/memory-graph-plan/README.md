# Memory Graph Migration - Implementation Plan

## Overview

This document provides a step-by-step implementation plan for migrating from file-based memory (`ideation_memory_files`) to a unified memory graph system. Each task includes detailed scripts, pass criteria, and expected outcomes.

**Estimated Total Tasks:** 45 tasks across 8 phases
**Target:** All agents use memory graph as single source of truth

---

## Code Snippets Reference

All code snippets are organized in the [`snippets/`](./snippets/) folder:

### Schema

- [Graph Dimensions](./snippets/schema/graph-dimensions.md) - 17 graph dimensions
- [Block Types](./snippets/schema/block-types.md) - 21 block types
- [Node Groups Migration](./snippets/schema/node-groups-migration.md) - SQL + Drizzle schema
- [Graph Query Types](./snippets/schema/graph-query-types.md) - TypeScript interfaces

### Services

- [Graph Query Service](./snippets/services/graph-query-service.md) - Core query class
- [Agent Query Methods](./snippets/services/agent-query-methods.md) - Agent-specific queries
- [Source Loader](./snippets/services/source-loader.md) - Lazy load source content
- [Readiness Checks](./snippets/services/readiness-checks.md) - Phase readiness validation

### Agents

- [Graph State Loader](./snippets/agents/graph-state-loader.md) - Replaces MemoryManager.loadState()
- [Context Manager](./snippets/agents/context-manager.md) - Replaces handoff mechanism
- [Build Agent Integration](./snippets/agents/build-agent-integration.md)
- [SIA Agent Integration](./snippets/agents/sia-agent-integration.md)

### API Routes

- [Graph Routes](./snippets/api/graph-routes.md) - Graph query endpoints
- [Ideation Routes](./snippets/api/ideation-routes.md) - Context management endpoints

### Frontend

- [Constants](./snippets/frontend/constants.md) - Dimensions, types, colors
- [Context Limit Modal](./snippets/frontend/context-limit-modal.md) - Save prompt UI
- [Readiness Dashboard](./snippets/frontend/readiness-dashboard.md) - Phase status

### Tests

- [Integration Tests](./snippets/tests/integration-tests.md) - Full migration tests

---

## Phase 1: Schema Foundation (Tasks 1-8)

### Task 1.1: Add New Graph Dimensions to Schema

**Context:** The memory graph currently has 10 dimensions. We need to add 7 new dimensions.

**Files to Modify:** `schema/entities/memory-graph-membership.ts`

**Code:** See [snippets/schema/graph-dimensions.md](./snippets/schema/graph-dimensions.md)

**Pass Criteria:**

- [ ] TypeScript compiles without errors
- [ ] All 17 dimensions are defined in the schema
- [ ] No existing code breaks due to the change

---

### Task 1.2: Add New Block Types to Schema

**Context:** We need additional block types to represent constraints, blockers, task management items, personas, milestones, evaluations, and learnings.

**Files to Modify:** `schema/entities/memory-block-type.ts`

**Code:** See [snippets/schema/block-types.md](./snippets/schema/block-types.md)

**Pass Criteria:**

- [ ] TypeScript compiles without errors
- [ ] All 21 block types are defined
- [ ] Existing block type references still work

---

### Task 1.3: Create Database Migration for New Dimensions and Types

**Context:** The schema changes need to be reflected in the database.

**Files to Create:** `database/migrations/XXX_memory_graph_expansion.sql`

**Code:** See [snippets/schema/node-groups-migration.md](./snippets/schema/node-groups-migration.md) (index section)

**Pass Criteria:**

- [ ] Migration runs without errors
- [ ] Indexes are created
- [ ] Can insert blocks with new dimensions/types

---

### Task 1.4: Create Node Groups Table

**Context:** Node groups are clusters of related blocks that share a theme. They enable "Level 1" querying.

**Files to Create:**

- `database/migrations/XXX_node_groups.sql`
- `schema/entities/memory-node-group.ts`

**Code:** See [snippets/schema/node-groups-migration.md](./snippets/schema/node-groups-migration.md)

**Pass Criteria:**

- [ ] Tables `memory_node_groups` and `memory_node_group_blocks` exist
- [ ] Can insert a node group and associate blocks with it
- [ ] TypeScript types are generated for the new entities

---

### Task 1.5: Create GraphQuery Types

**Context:** We need TypeScript types for the query interface that all agents will use.

**Files to Create:** `types/graph-query.ts`

**Code:** See [snippets/schema/graph-query-types.md](./snippets/schema/graph-query-types.md)

**Pass Criteria:**

- [ ] TypeScript compiles without errors
- [ ] Types can be imported from `types/graph-query`
- [ ] All 17 dimensions, 21 block types, and 21 link types are defined

---

### Task 1.6: Update Frontend Graph Dimension/Type Constants

**Context:** The frontend has constants for graph dimensions and block types used in filters and displays.

**Files to Modify:** `frontend/src/components/graph/constants.ts`

**Code:** See [snippets/frontend/constants.md](./snippets/frontend/constants.md)

**Pass Criteria:**

- [ ] Frontend compiles without errors
- [ ] Filter dropdowns show all 17 dimensions
- [ ] Filter dropdowns show all 21 block types

---

### Task 1.7: Add Colors/Icons for New Block Types

**Context:** Each block type should have a distinct color and optionally an icon.

**Files to Modify:** `frontend/src/components/graph/utils/nodeStyles.ts`

**Code:** See [snippets/frontend/constants.md](./snippets/frontend/constants.md) (colors section)

**Pass Criteria:**

- [ ] All 21 block types have assigned colors
- [ ] Colors are visually distinct
- [ ] Graph renders blocks with correct colors

---

### Task 1.8: Update Graph Legend and Filter Components

**Context:** The graph UI has legend and filter components that need to display the new dimensions and types.

**Files to Modify:**

- `frontend/src/components/graph/GraphFilters.tsx`
- `frontend/src/components/graph/GraphLegend.tsx`

**Code:** See [snippets/frontend/constants.md](./snippets/frontend/constants.md) (presets section)

**Pass Criteria:**

- [ ] Dimension filter shows all 17 dimensions
- [ ] Block type filter shows all 21 types
- [ ] Filter presets work correctly

---

## Phase 2: Query Infrastructure (Tasks 2.1-2.4)

### Task 2.1: Create GraphQueryService Class

**Context:** This service encapsulates all graph query logic. It will be used by all agents.

**Files to Create:** `server/services/graph/graph-query-service.ts`

**Code:** See [snippets/services/graph-query-service.md](./snippets/services/graph-query-service.md)

**Pass Criteria:**

- [ ] Service compiles without errors
- [ ] Can instantiate GraphQueryService
- [ ] Query method accepts GraphQuery interface
- [ ] Returns properly typed GraphQueryResult

---

### Task 2.2: Add Agent-Specific Query Methods

**Context:** Each agent type needs specialized query patterns.

**Files to Modify:** `server/services/graph/graph-query-service.ts`

**Code:** See [snippets/services/agent-query-methods.md](./snippets/services/agent-query-methods.md)

**Pass Criteria:**

- [ ] All agent-specific methods compile
- [ ] Methods return properly typed results
- [ ] Each method has clear documentation

---

### Task 2.3: Create API Routes for Graph Queries

**Context:** Agents and frontend need HTTP endpoints to execute graph queries.

**Files to Modify:** `server/routes/ideation/graph-routes.ts`

**Code:** See [snippets/api/graph-routes.md](./snippets/api/graph-routes.md)

**Pass Criteria:**

- [ ] All endpoints return 200 for valid requests
- [ ] Endpoints return proper error responses for invalid requests
- [ ] Query endpoint accepts full GraphQuery object

---

### Task 2.4: Create Source Content Loader

**Context:** When agents need full source content, we need to lazily load it.

**Files to Create:** `server/services/graph/source-loader.ts`

**Code:** See [snippets/services/source-loader.md](./snippets/services/source-loader.md)

**Pass Criteria:**

- [ ] SourceLoader compiles without errors
- [ ] Can load conversation message content by ID
- [ ] Can load artifact content by ID
- [ ] Returns proper metadata for each source type

---

## Phase 3: Ideation Agent Migration (Tasks 3.1-3.8)

### Task 3.1: Create Graph-Based State Loader

**Context:** Replace `memoryManager.loadState()` with a function that reconstructs state from graph queries.

**Files to Create:** `agents/ideation/graph-state-loader.ts`

**Code:** See [snippets/agents/graph-state-loader.md](./snippets/agents/graph-state-loader.md)

**Pass Criteria:**

- [ ] GraphStateLoader compiles without errors
- [ ] `loadState()` returns properly typed LoadedState
- [ ] Can extract user profile data from graph
- [ ] Can extract market discovery data from graph

---

### Task 3.2: Update Orchestrator to Use Graph State

**Context:** Replace MemoryManager calls in the orchestrator with GraphStateLoader.

**Files to Modify:** `agents/ideation/orchestrator.ts`

**Script:**

1. Replace `import { memoryManager }` with `import { graphStateLoader }`
2. Replace `memoryManager.loadState()` with `graphStateLoader.loadState()`
3. Replace `memoryManager.getAll()` with graph context builder

**Pass Criteria:**

- [ ] Orchestrator compiles without `memoryManager` import
- [ ] State loading works via graph queries
- [ ] Sub-agent context is built from graph

---

### Task 3.3: Replace Handoff with Context Limit Prompt

**Context:** Instead of preparing handoff summaries, we prompt the user to save chat insights to the graph.

**Files to Create:** `agents/ideation/context-manager.ts` (replaces `handoff.ts`)

**Code:** See [snippets/agents/context-manager.md](./snippets/agents/context-manager.md)

**Pass Criteria:**

- [ ] ContextManager compiles without errors
- [ ] Token threshold detection works
- [ ] Save prompt is generated correctly
- [ ] Conversation can be saved to graph

---

### Task 3.4: Update Ideation Routes

**Context:** Server routes need to be updated to remove memory file endpoints.

**Files to Modify:** `server/routes/ideation.ts`

**Code:** See [snippets/api/ideation-routes.md](./snippets/api/ideation-routes.md)

**Pass Criteria:**

- [ ] Routes compile without memoryManager
- [ ] Context status endpoint works
- [ ] Save to graph endpoint works
- [ ] Session context endpoint works

---

### Task 3.5: Update Frontend Ideation State

**Context:** Frontend state management needs to remove memory file references.

**Files to Modify:**

- `frontend/src/reducers/ideationReducer.ts`
- `frontend/src/hooks/useIdeationAPI.ts`
- `frontend/src/types/ideation-state.ts`

**Pass Criteria:**

- [ ] Frontend compiles without memory file types
- [ ] Context status is tracked in state
- [ ] Save to graph action works

---

### Task 3.6: Create Context Limit UI Component

**Context:** When context limit is approaching, show a modal prompting user to save or continue.

**Files to Create:** `frontend/src/components/ideation/ContextLimitModal.tsx`

**Code:** See [snippets/frontend/context-limit-modal.md](./snippets/frontend/context-limit-modal.md)

**Pass Criteria:**

- [ ] Modal renders correctly
- [ ] Progress bar shows context usage
- [ ] Save button triggers extraction
- [ ] Success/error states display correctly

---

### Task 3.7: Remove Memory Manager and Memory Files

**Context:** With graph-based state working, remove the deprecated memory file system.

**Files to Delete:** `agents/ideation/memory-manager.ts`

**Script:**

```bash
grep -r "memory-manager\|memoryManager\|MemoryManager" --include="*.ts" --include="*.tsx"
rm agents/ideation/memory-manager.ts
npm test
```

**Pass Criteria:**

- [ ] No imports of memory-manager remain
- [ ] All tests pass without memory manager
- [ ] Application runs without errors

---

### Task 3.8: Update Ideation Tests

**Context:** Tests need to be updated to use graph-based state.

**Files to Modify:** `tests/ideation/*.test.ts`

**Code:** See [snippets/tests/integration-tests.md](./snippets/tests/integration-tests.md)

**Pass Criteria:**

- [ ] All existing tests pass or are properly updated
- [ ] New graph-based tests are added
- [ ] No memory file test dependencies remain

---

## Phase 4: Other Agent Integration (Tasks 4.1-4.6)

### Task 4.1: Build Agent Graph Integration

**Context:** Build agent needs to query the memory graph for task context, requirements, and learnings.

**Files to Modify:** `agents/build/core.ts`

**Code:** See [snippets/agents/build-agent-integration.md](./snippets/agents/build-agent-integration.md)

**Pass Criteria:**

- [ ] Build agent loads context from graph
- [ ] Requirements are injected into prompts
- [ ] Learnings (gotchas) are used during build

---

### Task 4.2: Spec Agent Graph Integration

**Context:** Spec agent should read requirements from graph.

**Files to Modify:** `agents/specification/core.ts`

**Pass Criteria:**

- [ ] Spec agent loads requirements from graph
- [ ] Template selection works based on project type
- [ ] Readiness check prevents premature generation

---

### Task 4.3: SIA Agent Graph Integration

**Context:** SIA should write learnings as blocks to the memory graph.

**Files to Modify:** `agents/sia/knowledge-writer.ts`

**Code:** See [snippets/agents/sia-agent-integration.md](./snippets/agents/sia-agent-integration.md)

**Pass Criteria:**

- [ ] SIA writes learnings as graph blocks
- [ ] Duplicate detection uses graph query
- [ ] Confidence increments on repeated learnings

---

### Task 4.4: Evaluator Graph Integration

**Context:** Evaluation results should be stored as blocks in the memory graph.

**Files to Modify:** `agents/evaluator.ts`

**Pass Criteria:**

- [ ] Evaluation results saved as blocks
- [ ] Evidence links created to source blocks
- [ ] Evaluations queryable from graph

---

### Task 4.5: Add Marketing Readiness Check

**Context:** Similar to spec readiness, we need to check if the graph has enough information for marketing/launch.

**Files to Create:** `server/services/graph/readiness-checks.ts`

**Code:** See [snippets/services/readiness-checks.md](./snippets/services/readiness-checks.md)

**Pass Criteria:**

- [ ] Spec readiness check identifies missing elements
- [ ] Launch readiness check validates marketing requirements
- [ ] Build readiness check ensures spec is complete

---

### Task 4.6: Add Readiness Dashboard Component

**Context:** Frontend component to show readiness status for different phases.

**Files to Create:** `frontend/src/components/ideation/ReadinessDashboard.tsx`

**Code:** See [snippets/frontend/readiness-dashboard.md](./snippets/frontend/readiness-dashboard.md)

**Pass Criteria:**

- [ ] Dashboard shows all three readiness checks
- [ ] Progress bars reflect scores
- [ ] Missing items are listed with importance

---

## Phase 5: Cleanup and Testing (Tasks 5.1-5.4)

### Task 5.1: Remove Deprecated Code

**Context:** Clean up all deprecated memory file code.

**Script:**

```bash
# Memory files
grep -r "ideation_memory_files\|memoryFile\|MemoryFile" --include="*.ts" --include="*.tsx"

# Memory manager
grep -r "memory-manager\|memoryManager\|MemoryManager" --include="*.ts" --include="*.tsx"

# Handoff (old style)
grep -r "prepareHandoff\|createHandoffSummary" --include="*.ts" --include="*.tsx"
```

**Pass Criteria:**

- [ ] No references to memory files remain
- [ ] No references to MemoryManager remain
- [ ] All deprecated files deleted

---

### Task 5.2: Run Full Test Suite

**Script:**

```bash
npm test
npm test -- --coverage
npm test -- --grep "graph"
npm test -- --grep "ideation"
```

**Pass Criteria:**

- [ ] All tests pass
- [ ] Coverage is maintained or improved
- [ ] No test timeouts

---

### Task 5.3: Integration Testing

**Code:** See [snippets/tests/integration-tests.md](./snippets/tests/integration-tests.md)

**Pass Criteria:**

- [ ] Full ideation flow works without memory files
- [ ] Build agent gets context from graph
- [ ] Readiness checks are accurate
- [ ] Context limit flow works correctly

---

### Task 5.4: Documentation Update

**Files to Create/Update:** `docs/memory-graph-guide.md`

**Pass Criteria:**

- [ ] Documentation covers all concepts
- [ ] Query examples are correct
- [ ] Agent integration documented
- [ ] Readiness checks explained

---

## Migration Script

A migration script is available to migrate any remaining data from the deprecated `ideation_memory_files` table to the new `memory_blocks` system:

```bash
# Preview what will be migrated (dry run)
npx tsx scripts/migrate-memory-files-to-blocks.ts --dry-run

# Run the actual migration
npx tsx scripts/migrate-memory-files-to-blocks.ts
```

The script:

- Maps legacy file types to appropriate block types and graph memberships
- Preserves all content and timestamps
- Tracks migration metadata in block properties
- Skips already-migrated files
- Supports backward compatibility by keeping the legacy table intact

---

## Summary Checklist

### Phase 1: Schema Foundation

- [x] Task 1.1: Add new graph dimensions
- [x] Task 1.2: Add new block types
- [x] Task 1.3: Create database migration
- [x] Task 1.4: Create node groups table
- [x] Task 1.5: Create GraphQuery types
- [x] Task 1.6: Update frontend constants
- [x] Task 1.7: Add colors/icons for new types
- [x] Task 1.8: Update legend and filters

### Phase 2: Query Infrastructure

- [x] Task 2.1: Create GraphQueryService
- [x] Task 2.2: Add agent-specific queries
- [x] Task 2.3: Create API routes
- [x] Task 2.4: Create source loader

### Phase 3: Ideation Agent Migration

- [x] Task 3.1: Create graph state loader
- [x] Task 3.2: Update orchestrator
- [x] Task 3.3: Replace handoff with context manager
- [x] Task 3.4: Update ideation routes
- [x] Task 3.5: Update frontend state
- [x] Task 3.6: Create context limit modal
- [x] Task 3.7: Remove memory manager
- [x] Task 3.8: Update tests

### Phase 4: Other Agent Integration

- [x] Task 4.1: Build agent integration
- [x] Task 4.2: Spec agent integration
- [x] Task 4.3: SIA agent integration
- [x] Task 4.4: Evaluator integration
- [x] Task 4.5: Add readiness checks
- [x] Task 4.6: Create readiness dashboard

### Phase 5: Cleanup and Testing

- [x] Task 5.1: Remove deprecated code
- [x] Task 5.2: Run full test suite
- [x] Task 5.3: Integration testing
- [x] Task 5.4: Documentation update
