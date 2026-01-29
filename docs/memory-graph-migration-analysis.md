# Memory Graph Migration Analysis

## Executive Summary

This document analyzes the migration from file-based memory (`ideation_memory_files`) to a unified memory graph system that serves all agents in the Idea Incubator platform.

**Key Decision:** Eliminate `ideation_memory_files` table entirely. All structured knowledge will be represented as memory graph blocks and links, queryable by all agents.

---

## 1. Current State Architecture

### 1.1 Memory Files System (TO BE DEPRECATED)

**Database Table:** `ideation_memory_files`

- 7 file types per session: `self_discovery`, `market_discovery`, `narrowing_state`, `idea_candidate`, `viability_assessment`, `conversation_summary`, `handoff_notes`
- Markdown content with embedded JSON state
- Used for agent handoffs and state persistence

**Manager:** `agents/ideation/memory-manager.ts` (708 lines)

- `generateContent()` - converts state to markdown
- `updateAll()` - bulk update all files
- `loadState()` - reconstructs state from JSON
- `createHandoffSummary()` - generates handoff context

**Usage Points:**

- `orchestrator.ts:347` - updates after each agent response
- `handoff.ts:49` - updates before handoff
- `server/routes/ideation.ts:741,1170,1479` - context for sub-agents

### 1.2 Memory Graph System (SOURCE OF TRUTH)

**Database Tables:**

- `memory_blocks` - graph nodes (id, session_id, idea_id, type, title, content, properties, status, confidence, abstraction_level)
- `memory_links` - graph edges (source_block_id, target_block_id, link_type, degree, confidence, reason, status)
- `memory_graph_memberships` - block to graph dimension mapping
- `memory_block_types` - block to canonical type mapping (many-to-many)
- `memory_block_sources` - block to source mapping (conversation, artifact, external)
- `memory_graph_changes` - audit log
- `graph_snapshots` - version control

**Current Block Types (11):**
`insight`, `fact`, `assumption`, `question`, `decision`, `action`, `requirement`, `option`, `pattern`, `synthesis`, `meta`

**Current Graph Dimensions (10):**
`problem`, `solution`, `market`, `risk`, `fit`, `business`, `spec`, `distribution`, `marketing`, `manufacturing`

**Current Link Types (21):**
`addresses`, `creates`, `requires`, `conflicts`, `supports`, `depends_on`, `enables`, `suggests`, `supersedes`, `validates`, `invalidates`, `references`, `evidence_for`, `elaborates`, `refines`, `specializes`, `alternative_to`, `instance_of`, `constrained_by`, `derived_from`, `measured_by`

### 1.3 Current Agent Memory Usage

| Agent      | Memory Files     | Memory Graph     | Notes                   |
| ---------- | ---------------- | ---------------- | ----------------------- |
| Ideation   | Yes (primary)    | Yes (extraction) | Uses both               |
| Build      | No (checkpoints) | No               | File-based checkpoints  |
| Spec       | No (filesystem)  | No               | Writes to spec.md       |
| Validation | No               | No               | Stateless               |
| UX         | No               | No               | Database only           |
| SIA        | No               | No               | knowledge_entries table |
| Evaluators | No               | No               | Stateless               |

---

## 2. Target State Architecture

### 2.1 Design Principles

1. **Memory graph is the single source of truth** for all structured knowledge
2. **Idea-scoped and version-scoped** - graph is specific to one idea version
3. **All agents query the graph** - dedicated query patterns per agent type
4. **Smart querying** - agents query relevant subsets, not entire graph
5. **Three-level querying** - node group, node, and source levels
6. **No handoffs needed** - graph persistence eliminates context loss

### 2.2 Scope Boundaries

```
Memory Graph Scope:
├── Idea ID (required)
├── Version (required - current version only)
├── Session ID (optional - for tracing extraction source)
└── Blocks scoped to above
```

### 2.3 Agent Integration Pattern

```
Agent Request
    │
    ▼
┌─────────────────────┐
│  Query Planner      │ ← Agent-specific query templates
│  (per agent type)   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Graph Query API    │ ← Smart filtering, pagination
│  (shared)           │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Memory Graph DB    │
│  (blocks/links)     │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Source Retrieval   │ ← Full source content on demand
│  (lazy loading)     │
└─────────────────────┘
```

---

## 3. Data Model Changes

### 3.1 New Graph Dimensions (16 total)

**Existing (10):**

- `problem` - Problem space definition
- `solution` - Solution approach
- `market` - Market analysis
- `risk` - Risk identification
- `fit` - Product-market fit
- `business` - Business model
- `spec` - Future state specification (what should be)
- `distribution` - Distribution strategy
- `marketing` - Marketing strategy
- `manufacturing` - Manufacturing/operations

**New Dimensions (6):**

- `user` - User profile (skills, constraints, preferences of the founder/builder)
- `competition` - Competitive landscape analysis
- `validation` - Experiments, tests, proof points
- `tasks` - Task management (epics, stories, bugs)
- `timeline` - Phases, milestones, deadlines
- `customer` - Customer profiles/personas (target users, not the builder)
- `product` - Current product state (vs spec which is future)

**Dimension Clarification:**

- `spec` = What the product SHOULD be (future state, pending changes)
- `product` = What the product IS (current state, live)
- `user` = The founder/builder's profile
- `customer` = The target customer/user personas

### 3.2 New Block Types (17+ total)

**Existing (11):**
`insight`, `fact`, `assumption`, `question`, `decision`, `action`, `requirement`, `option`, `pattern`, `synthesis`, `meta`

**New Types (6+):**

- `constraint` - Limitations, boundaries, non-negotiables
- `blocker` - Active blockers preventing progress
- `epic` - Large body of work (task management)
- `story` - User story / feature request
- `task` - Specific work item
- `bug` - Defect or issue
- `persona` - Customer persona definition
- `milestone` - Timeline marker / deadline
- `evaluation` - Evaluation result (score, rationale, criteria)
- `learning` - SIA-extracted gotcha or pattern

### 3.3 User Profile Block Structure

User profile data currently in `self_discovery` should become individual blocks:

```typescript
// Example: Skill block
{
  type: "fact",
  blockTypes: ["skill"],
  graphMemberships: ["user"],
  title: "Python expertise",
  content: "Expert-level Python with 8 years experience",
  properties: {
    skill_name: "Python",
    proficiency: "expert",
    years: 8,
    evidence: "Built 3 production systems"
  }
}

// Example: Constraint block
{
  type: "constraint",
  graphMemberships: ["user"],
  title: "10 hours/week availability",
  content: "Can only dedicate 10 hours per week to this project",
  properties: {
    constraint_type: "time",
    value: 10,
    unit: "hours_per_week",
    flexibility: "low"
  }
}

// Example: Frustration block
{
  type: "insight",
  blockTypes: ["pain_point"],
  graphMemberships: ["user", "problem"],
  title: "Frustrated with manual data entry",
  content: "Spends 4 hours/week on repetitive data entry tasks",
  properties: {
    severity: "high",
    frequency: "daily",
    time_wasted: "4 hours/week"
  }
}
```

### 3.4 Evaluation Block Structure

```typescript
{
  type: "evaluation",
  graphMemberships: ["validation"],
  title: "Market Timing Score: 7/10",
  content: "Strong market timing due to regulatory changes...",
  properties: {
    score: 7,
    max_score: 10,
    criteria: "market_timing",
    evaluator: "market_evaluator_v2",
    confidence: 0.85,
    evidence_block_ids: ["block_123", "block_456"]
  }
}
```

### 3.5 Task Management Block Structure

```typescript
// Epic
{
  type: "epic",
  graphMemberships: ["tasks"],
  title: "User Authentication System",
  content: "Implement complete auth system with OAuth",
  properties: {
    status: "in_progress",
    priority: "high",
    story_count: 5,
    completion_pct: 40
  }
}

// Story
{
  type: "story",
  graphMemberships: ["tasks"],
  title: "As a user, I want to login with Google",
  content: "OAuth2 integration with Google provider",
  properties: {
    status: "todo",
    priority: "medium",
    story_points: 5,
    acceptance_criteria: ["...", "..."]
  }
}

// Bug
{
  type: "bug",
  graphMemberships: ["tasks", "product"],
  title: "Login fails on Safari",
  content: "OAuth redirect not working on Safari 16+",
  properties: {
    severity: "high",
    status: "open",
    reproduced: true,
    environment: "Safari 16+, macOS"
  }
}
```

---

## 4. Agent Query Patterns

### 4.1 Query Architecture

Each agent has dedicated query templates that fetch relevant subgraphs:

```typescript
interface GraphQuery {
  ideaId: string;
  version: number;

  // Filtering
  graphMemberships?: string[]; // e.g., ["problem", "solution"]
  blockTypes?: string[]; // e.g., ["requirement", "constraint"]
  statuses?: string[]; // e.g., ["active", "validated"]
  abstractionLevels?: string[]; // e.g., ["strategy", "tactic"]

  // Confidence filtering
  minConfidence?: number; // e.g., 0.7

  // Relationship traversal
  includeLinkedBlocks?: boolean; // Include blocks linked to matches
  linkTypes?: string[]; // Filter which link types to traverse
  maxDepth?: number; // How deep to traverse

  // Source loading
  includeSources?: boolean; // Load full source content
  sourceTypes?: string[]; // Filter source types

  // Pagination
  limit?: number;
  offset?: number;

  // Grouping
  groupBy?: "graphMembership" | "blockType" | "abstraction";
}
```

### 4.2 Ideation Agent Queries

```typescript
// Get user profile for personalization
const userProfileQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["user"],
  blockTypes: ["skill", "constraint", "insight"],
  statuses: ["active"],
};

// Get current problem/solution understanding
const problemSolutionQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["problem", "solution"],
  includeLinkedBlocks: true,
  linkTypes: ["addresses", "creates", "requires"],
};

// Get market context
const marketContextQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["market", "competition"],
  blockTypes: ["fact", "insight", "assumption"],
  minConfidence: 0.6,
};
```

### 4.3 Spec Agent Queries

```typescript
// Get all requirements and constraints
const specInputQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["spec"],
  blockTypes: ["requirement", "constraint", "decision"],
  statuses: ["active", "validated"],
  includeLinkedBlocks: true,
  linkTypes: ["requires", "constrained_by", "depends_on"],
};

// Get validation evidence
const validationEvidenceQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["validation"],
  blockTypes: ["fact", "evaluation"],
  includeSources: true,
};
```

### 4.4 Build Agent Queries

```typescript
// Get task context
const taskContextQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["tasks"],
  blockTypes: ["epic", "story", "task", "bug"],
  statuses: ["todo", "in_progress"],
};

// Get relevant requirements for current task
const taskRequirementsQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["spec"],
  blockTypes: ["requirement"],
  // Would also filter by task relationship
};

// Get gotchas/patterns from SIA
const learningsQuery: GraphQuery = {
  ideaId,
  version,
  blockTypes: ["learning", "pattern"],
  minConfidence: 0.8,
};
```

### 4.5 SIA Agent Queries

```typescript
// Get execution context for learning extraction
const executionContextQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["tasks", "spec"],
  blockTypes: ["task", "bug", "decision"],
  includeSources: true, // Need full execution logs
};

// Check for duplicate learnings
const existingLearningsQuery: GraphQuery = {
  ideaId,
  version,
  blockTypes: ["learning", "pattern"],
  // Will compare against new extraction
};
```

### 4.6 Marketing Agent Queries

```typescript
// Get positioning context
const positioningQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["marketing", "competition", "customer"],
  blockTypes: ["insight", "fact", "persona", "decision"],
};

// Get distribution strategy
const distributionQuery: GraphQuery = {
  ideaId,
  version,
  graphMemberships: ["distribution", "marketing"],
  blockTypes: ["decision", "option", "action"],
};
```

---

## 5. Three-Level Query System

### 5.1 Level 1: Node Groups

Node groups are connected components or semantic clusters in the graph.

```typescript
interface NodeGroup {
  id: string;
  name: string; // AI-generated name
  summary: string; // AI-generated summary
  theme: string; // Primary theme
  blockIds: string[]; // Blocks in this group
  blockCount: number;
  primaryGraphMembership: string; // Dominant dimension

  // Cached aggregates
  avgConfidence: number;
  dominantBlockTypes: string[];
  keyInsights: string[]; // Top 3 insights
}
```

**Query at Group Level:**

```typescript
// "What are the main areas of this idea?"
const groupSummaryQuery = {
  ideaId,
  version,
  level: "group",
  includeStats: true,
};
// Returns: [{name: "Core Problem", summary: "...", blockCount: 12}, ...]
```

### 5.2 Level 2: Individual Nodes

```typescript
interface Node {
  id: string;
  type: string;
  blockTypes: string[];
  graphMemberships: string[];
  title: string;
  content: string;
  confidence: number;
  abstractionLevel: string;
  status: string;

  // Relationships
  incomingLinks: LinkSummary[];
  outgoingLinks: LinkSummary[];

  // Source reference (not full content)
  sourceCount: number;
  primarySourceType: string;
}
```

**Query at Node Level:**

```typescript
// "What requirements exist for the auth system?"
const nodeQuery: GraphQuery = {
  ideaId,
  version,
  level: "node",
  blockTypes: ["requirement"],
  searchText: "auth",
};
// Returns: [{title: "OAuth required", content: "...", confidence: 0.9}, ...]
```

### 5.3 Level 3: Sources

Sources are the original content that nodes were extracted from.

```typescript
interface NodeSource {
  id: string;
  blockId: string;
  sourceType:
    | "conversation"
    | "artifact"
    | "memory_file"
    | "external"
    | "user_created";
  sourceId: string; // Reference to original content
  relevanceScore: number;
  mappingReason: string;

  // Full content (loaded on demand)
  content?: string;
  metadata?: {
    messageRole?: string;
    artifactType?: string;
    externalUrl?: string;
    timestamp?: string;
  };
}
```

**Query at Source Level:**

```typescript
// "Why do we think OAuth is required?"
const sourceQuery = {
  blockId: "requirement_123",
  level: "source",
  includeFullContent: true,
};
// Returns: [{sourceType: "conversation", content: "User said: We need Google login...", relevanceScore: 0.95}, ...]
```

---

## 6. Handoff Elimination

### 6.1 Current Handoff Problem

When context window fills up:

1. `prepareHandoff()` saves state to memory files
2. New agent instance loads from memory files
3. Context is compressed/summarized, detail is lost

### 6.2 New Approach: Graph-Based Continuity

Since memory graph persists all knowledge:

1. Session runs out of context
2. User prompted: "Insert chat insights into memory graph?"
3. If yes: Block extraction runs on remaining messages
4. New session starts fresh but queries same graph
5. No information loss - all knowledge is in graph

**User Prompt Flow:**

```
┌─────────────────────────────────────────────────────┐
│  Context limit approaching (90% used)               │
│                                                     │
│  Would you like to save your conversation insights  │
│  to the memory graph before continuing?             │
│                                                     │
│  [Save & Continue]  [Continue Without Saving]       │
└─────────────────────────────────────────────────────┘
```

### 6.3 Session Continuity Query

When new session starts, agent queries for context:

```typescript
const sessionStartQuery: GraphQuery = {
  ideaId,
  version,

  // Get recent high-confidence insights
  statuses: ["active"],
  minConfidence: 0.7,

  // Prioritize recent additions
  orderBy: "updated_at",
  order: "desc",
  limit: 50,

  // Include key relationships
  includeLinkedBlocks: true,
  maxDepth: 1,
};
```

---

## 7. Migration Approach

### 7.1 Phase 1: Schema Updates

1. Add new graph dimensions to `memory_graph_memberships`:
   - `user`, `competition`, `validation`, `tasks`, `timeline`, `customer`, `product`

2. Add new block types to `memory_block_types`:
   - `constraint`, `blocker`, `epic`, `story`, `task`, `bug`, `persona`, `milestone`, `evaluation`, `learning`

3. Add node group table (if not exists):

   ```sql
   CREATE TABLE memory_node_groups (
     id TEXT PRIMARY KEY,
     idea_id TEXT NOT NULL,
     version INTEGER NOT NULL,
     name TEXT NOT NULL,
     summary TEXT,
     theme TEXT,
     block_count INTEGER,
     avg_confidence REAL,
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );

   CREATE TABLE memory_node_group_blocks (
     group_id TEXT REFERENCES memory_node_groups(id),
     block_id TEXT REFERENCES memory_blocks(id),
     PRIMARY KEY (group_id, block_id)
   );
   ```

### 7.2 Phase 2: Query Infrastructure

1. Create `GraphQueryService` with typed query methods
2. Implement agent-specific query templates
3. Add source content lazy loading
4. Add node group computation (connected components + AI naming)

### 7.3 Phase 3: Agent Integration

1. **Ideation Agent:**
   - Replace `memoryManager.loadState()` with graph queries
   - Replace `memoryManager.updateAll()` with block extraction
   - Remove handoff logic, add context-limit prompt

2. **Build Agent:**
   - Add graph query client
   - Query task blocks for context
   - Write decision/learning blocks

3. **Spec Agent:**
   - Query requirement/constraint blocks
   - Use templates based on project type
   - Write spec blocks back to graph

4. **SIA Agent:**
   - Write learning blocks to graph
   - Query for duplicate detection
   - Link learnings to source executions

5. **Evaluators:**
   - Write evaluation blocks
   - Link to evidence blocks

### 7.4 Phase 4: Cleanup

1. Remove `ideation_memory_files` table
2. Remove `MemoryManager` class
3. Remove handoff-related code
4. Update tests

---

## 8. Files to Modify

### 8.1 Schema Files

| File                                                 | Change               |
| ---------------------------------------------------- | -------------------- |
| `schema/entities/memory-graph-membership.ts`         | Add new dimensions   |
| `schema/entities/memory-block-type.ts`               | Add new block types  |
| `database/migrations/XXX_memory_graph_expansion.sql` | New dimensions/types |
| `database/migrations/XXX_node_groups.sql`            | Node group tables    |

### 8.2 Agent Files

| File                                | Change                                          |
| ----------------------------------- | ----------------------------------------------- |
| `agents/ideation/memory-manager.ts` | **DELETE**                                      |
| `agents/ideation/orchestrator.ts`   | Replace memory manager calls with graph queries |
| `agents/ideation/handoff.ts`        | Replace with context-limit prompt               |
| `agents/build/core.ts`              | Add graph query integration                     |
| `agents/specification/core.ts`      | Add graph query integration                     |
| `agents/sia/index.ts`               | Write learnings to graph                        |

### 8.3 Route Files

| File                                     | Change                              |
| ---------------------------------------- | ----------------------------------- |
| `server/routes/ideation.ts`              | Remove memory file context building |
| `server/routes/ideation/graph-routes.ts` | Add agent query endpoints           |

### 8.4 Type Files

| File                   | Change                          |
| ---------------------- | ------------------------------- |
| `types/ideation.ts`    | Remove MemoryFile types         |
| `types/graph.ts` (new) | Add GraphQuery, NodeGroup types |

### 8.5 Frontend Files

| File                                                 | Change                      |
| ---------------------------------------------------- | --------------------------- |
| `frontend/src/components/ideation/SessionHeader.tsx` | Remove memory file display  |
| `frontend/src/hooks/useIdeationAPI.ts`               | Remove memory file fetching |
| `frontend/src/reducers/ideationReducer.ts`           | Remove memory file state    |

---

## 9. Open Questions

### 9.1 Addressed by User

- [x] Scope: Idea + version scoped
- [x] Backwards compatibility: Clean migration
- [x] Handoff: Eliminated via graph persistence
- [x] All agents use graph: Yes
- [x] User profile as blocks: Yes
- [x] Evaluations as blocks: Yes
- [x] SIA learnings as blocks: Yes
- [x] Superseded node handling: Turn off + relationship

### 9.2 To Be Determined

1. **Spec Templates:** Where should spec templates (web app, mobile, etc.) be stored? Filesystem or database?

2. **Graph Version Lifecycle:** When does a new version get created? Manual trigger or automatic?

3. **Cross-Idea Learning:** Should SIA learnings ever be shared across ideas? (User said no for now, but may change)

4. **Real-time vs Batch Extraction:** Keep current real-time approach per user preference

5. **Conflict Resolution:** To be tackled separately per user

---

## 10. Appendix: Current Memory File Content Mapping

### What Currently Stored → Where It Goes in Graph

| Memory File          | Content          | Target Graph Dimension | Target Block Types              |
| -------------------- | ---------------- | ---------------------- | ------------------------------- |
| self_discovery       | Impact vision    | user                   | insight, decision               |
| self_discovery       | Frustrations     | user, problem          | insight (pain_point)            |
| self_discovery       | Expertise        | user                   | fact (skill)                    |
| self_discovery       | Interests        | user                   | insight                         |
| self_discovery       | Skills           | user                   | fact (skill)                    |
| self_discovery       | Constraints      | user                   | constraint                      |
| market_discovery     | Competitors      | competition            | fact, insight                   |
| market_discovery     | Market gaps      | market                 | insight, option                 |
| market_discovery     | Timing signals   | market, validation     | fact, insight                   |
| market_discovery     | Failed attempts  | validation             | fact (learning)                 |
| market_discovery     | Location context | user, market           | fact, constraint                |
| narrowing_state      | Dimensions       | problem, solution      | decision                        |
| narrowing_state      | Hypotheses       | validation             | assumption                      |
| narrowing_state      | Questions        | validation             | question                        |
| idea_candidate       | Candidate        | solution               | synthesis                       |
| viability_assessment | Risks            | risk                   | insight, blocker                |
| conversation_summary | JSON state       | N/A                    | Eliminated - graph IS the state |
| handoff_notes        | Summary          | N/A                    | Eliminated - no handoffs        |

---

## 11. Success Criteria

### 11.1 Functional

- [ ] All agents can query memory graph for context
- [ ] User profile data stored as blocks
- [ ] Evaluations stored as blocks
- [ ] SIA learnings stored as blocks
- [ ] No information loss compared to memory files
- [ ] Context continuity without handoffs

### 11.2 Performance

- [ ] Agent queries return in <500ms for typical graphs (<1000 blocks)
- [ ] Source loading is lazy and on-demand
- [ ] Graph operations don't block user interaction

### 11.3 UX

- [ ] Users prompted before context limit reached
- [ ] Clear visibility into what's stored in graph
- [ ] Easy navigation between node groups, nodes, sources
