# Multi-Graph Knowledge Architecture

## Overview

This document specifies a dynamic, interconnected graph system that serves as the knowledge backbone for idea development. Unlike static category-based structures, this system grows organically from user input, forms relationships automatically, and enables AI-powered cross-graph reasoning.

---

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DYNAMIC KNOWLEDGE DATABASE                        │
│                                                                      │
│  Not a static visualization of pre-defined categories               │
│  But an evolving semantic network that:                             │
│    • Grows from user input (no empty structures)                    │
│    • Forms relationships automatically + manually                   │
│    • Can be queried by AI for context                               │
│    • Provides visual clarity of complex interconnections            │
│    • Enables branch-level zoom for cognitive load management        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Principle**: The graph is essentially a relational database that uses concepts/keywords to surface information in a way that makes sense yet is complete.

---

## Graph Types

### Phase 1: Ideation Graphs

| Graph              | Root Node     | Child Nodes (grow from questions)                                               | When Created                       |
| ------------------ | ------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| **Idea Graph**     | Idea Title    | Problem, Solution, Market, Fit, Risk, Business                                  | Session start                      |
| **Problem Graph**  | Core Problem  | Pain Points, Affected Users, Current Workarounds, Severity Evidence, Validation | First problem signal               |
| **Solution Graph** | Core Solution | Features, Tech Stack, Differentiation, Must-Haves, Won't-Builds                 | First solution signal              |
| **Fit Graph**      | You (Founder) | Skills, Goals, Passion, Network, Life Stage, Constraints                        | Profile import or first fit signal |
| **Market Graph**   | Target Market | Segments, Competitors, TAM/SAM/SOM, Timing Signals, Distribution                | First market signal                |
| **Risk Graph**     | Risk Register | Execution, Technical, Market, Financial, Regulatory                             | First risk identified              |

### Phase 2: Build Graphs

| Graph                    | Root Node    | Child Nodes                                                              | When Created         |
| ------------------------ | ------------ | ------------------------------------------------------------------------ | -------------------- |
| **Product Spec Graph**   | MVP          | Core Features, Tech Stack, Database Schema, API Endpoints, Design System | Spec generation      |
| **Build Progress Graph** | Build Status | Completed Tasks, In Progress, Blocked, Failed, Pending                   | First task execution |
| **Test Coverage Graph**  | Quality      | Syntax Pass/Fail, Unit Tests, E2E Tests, Acceptance Criteria             | First test run       |

### Phase 3: Growth Graphs

| Graph             | Root Node    | Child Nodes                                  | When Created        |
| ----------------- | ------------ | -------------------------------------------- | ------------------- |
| **Launch Graph**  | Go-to-Market | Channels, Messaging, Pricing, Early Adopters | Pre-launch planning |
| **Metrics Graph** | KPIs         | Users, Revenue, Retention, NPS, Costs        | Post-launch         |

---

## Design Principles

### 1. Organic Growth

Graphs are NOT pre-populated with empty structures. They grow as the user provides input:

- Branches depend on previous answers
- Follow-up questions won't exist until initial questions are answered
- Progressive disclosure is built into the structure itself

### 2. Flexible Connections

Any node can connect to any other node:

- No type restrictions on edges
- Cross-graph connections are first-class citizens
- Relationships form naturally from context

### 3. Opportunities, Not Blockers

Gaps in knowledge are presented as exploration opportunities, never as blockers:

```
┌─ EXPLORATION OPPORTUNITIES ───────────────────────────────┐
│                                                            │
│  💡 Areas to expand (optional)                            │
│                                                            │
│  Problem Graph:                                            │
│  • "AI-Powered Search" has no technical approach yet      │
│    [Ask me about this] [Add manually] [Skip]              │
│                                                            │
│  Market Graph:                                             │
│  • No competitors linked to your differentiation          │
│    [Explore competitors] [Not relevant now]               │
│                                                            │
│  ───────────────────────────────────────────────────────  │
│  These are suggestions, not requirements.                 │
│  Continue whenever you're ready.                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

No percentages. No "weak/strong" labels. Just: "Here's what you could explore if you want."

---

## Data Model

### GraphNode

```typescript
interface GraphNode {
  id: string; // UUID
  ideaId: string; // Which idea this belongs to
  graphType: GraphType; // Which graph this node lives in

  // Content
  label: string; // Display name
  content: string; // Description/details

  // Hierarchy within graph
  parentNodeId: string | null; // Parent in this graph (null = root)
  depth: number; // 0 = root, 1 = child, etc.

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: "user" | "ai" | "system";

  // For AI context
  embedding?: number[]; // Vector for semantic search
}

type GraphType =
  // Ideation
  | "idea"
  | "problem"
  | "solution"
  | "fit"
  | "market"
  | "risk"
  | "business"
  // Build
  | "product_spec"
  | "build_progress"
  | "test_coverage"
  // Growth
  | "launch"
  | "metrics";
```

### GraphEdge

```typescript
interface GraphEdge {
  id: string;
  sourceNodeId: string; // FK to GraphNode
  targetNodeId: string; // FK to GraphNode

  // Relationship metadata
  relationshipType: EdgeRelationType;
  label?: string; // Optional custom label
  strength: number; // 0-1, for visualization

  // Tracking
  createdAt: string;
  createdBy: "user" | "ai";
  confirmed: boolean; // If AI-suggested, has user confirmed?
}

type EdgeRelationType =
  | "parent_child" // Hierarchical within graph
  | "addresses" // Solution addresses Problem
  | "requires" // Feature requires Skill
  | "conflicts" // Risk conflicts with Plan
  | "validates" // Evidence validates Assumption
  | "depends_on" // Task depends on Task
  | "similar_to" // Duplicate detection
  | "derived_from" // Spec derived from Idea
  | "tested_by" // Feature tested by Test
  | "custom"; // User-defined
```

---

## Cascade Behavior

When a node is deleted:

1. All edges TO/FROM that node are deleted (ON DELETE CASCADE)
2. Child nodes are NOT automatically deleted

**Orphan Strategy Options:**

```sql
-- Option A: Orphan children (they become root-level in their graph)
UPDATE graph_nodes
SET parent_node_id = NULL, depth = depth - 1
WHERE parent_node_id = :deleted_node_id;

-- Option B: Re-parent to grandparent
UPDATE graph_nodes
SET parent_node_id = (SELECT parent_node_id FROM graph_nodes WHERE id = :deleted_node_id)
WHERE parent_node_id = :deleted_node_id;
```

---

## AI-Assisted Graph Operations

### 1. Similarity Detection & Merge Suggestion

```
┌─ AI SUGGESTION ───────────────────────────────────────────┐
│                                                            │
│  🔍 Potential Duplicate Detected                          │
│                                                            │
│  In PROBLEM GRAPH:                                         │
│  "Slow research process" (created 2 days ago)             │
│                                                            │
│  In SOLUTION GRAPH:                                        │
│  "Research speed issue" (created today)                   │
│                                                            │
│  These appear to reference the same concept.              │
│                                                            │
│  [Merge into Problem Graph]  [Keep Separate]  [Rename]    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2. Link Suggestion

When user adds a new feature node:

```
┌─ NEW NODE: "AI-Powered Search" ───────────────────────────┐
│                                                            │
│  📍 Added to: Solution Graph > Features                   │
│                                                            │
│  🔗 Suggested Links:                                       │
│                                                            │
│  ✓ Problem Graph > Pain Points > "Manual search tedious"  │
│    Reason: This feature directly addresses this pain      │
│                                                            │
│  ✓ Fit Graph > Skills > "ML Experience: None"             │
│    Reason: AI features require ML skills you lack         │
│    ⚠️ This may create a Risk Graph node                   │
│                                                            │
│  ✓ Market Graph > Competitors > "Casetext"                │
│    Reason: Casetext has similar AI search feature         │
│                                                            │
│  [Accept All]  [Review Each]  [Skip Links]                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3. Cross-Graph Query

The power of this system is AI can query across graphs:

**User asks**: "What's blocking me from building the search feature?"

**AI traverses**:

1. Solution Graph → Features → AI Search
2. Follows link to → Fit Graph → Skills → ML: None
3. Follows link to → Risk Graph → Technical → "Need ML expertise"
4. Follows link to → Build Graph → Search Task → Status: Blocked

**AI responds**: "The AI search feature is blocked because you lack ML expertise (Fit Graph), which created a technical risk (Risk Graph). The build task is currently blocked pending this resolution. Options: 1) Learn ML basics, 2) Hire/contract ML engineer, 3) Use pre-built ML API."

---

## Graph Update Workflow

```
User edits node in Problem Graph
         │
         ▼
┌─────────────────────────────────────┐
│ 1. SAVE EDIT                        │
│    • Node content updated           │
│    • updatedAt = now()              │
│    • Change logged to history       │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 2. AI EVALUATION (async)            │
│    • Find all edges FROM this node  │
│    • Check each connected node      │
│    • Identify: conflicts, overlaps, │
│      gaps, stale references         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 3. PROMPT USER (if needed)          │
│                                     │
│  "Your change to 'Target User'      │
│   may affect these connected nodes: │
│                                     │
│   Solution Graph > Features (3)     │
│   Market Graph > Segments (2)       │
│                                     │
│   [Update all] [Review each] [Skip] │
│                                     │
│   Branch depth: [1] [2] [●3] [All]  │
└─────────────────────────────────────┘
         │
         ├── User selects "Update all" ──────────────────┐
         │                                                │
         ├── User selects "Review each" ─────┐           │
         │                                    │           │
         ▼                                    ▼           ▼
┌─────────────────────┐       ┌─────────────────────────────────┐
│ 4a. SKIP            │       │ 4b. AI UPDATES                  │
│ • No changes        │       │ • AI proposes changes per node  │
│ • Log skipped       │       │ • User approves/rejects each    │
└─────────────────────┘       │ • Approved changes applied      │
                              │ • Conflicts flagged for manual  │
                              └─────────────────────────────────┘
```

### Manual Node Selection

Users can manually select which nodes to update and specify branch depth:

```
┌─ MANUAL UPDATE SELECTION ─────────────────────────────────┐
│                                                            │
│  Select nodes to update after your changes:               │
│                                                            │
│  ☑ Solution Graph                                         │
│    ☑ AI Search Feature                                    │
│    ☐ Manual Search (no change needed)                     │
│    ☑ Pricing Model                                        │
│                                                            │
│  ☐ Market Graph (collapse - no selections)                │
│                                                            │
│  ☑ Risk Graph                                             │
│    ☑ Technical Risk                                       │
│                                                            │
│  Branch depth for updates: [1] [2] [●3] [4]               │
│  (How many levels deep should AI check for impacts?)      │
│                                                            │
│  [Update Selected (4 nodes)]  [Cancel]                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Branch Depth Control

Users can control how many branch levels are displayed to avoid information overload:

```
┌─ BRANCH DEPTH CONTROL ────────────────────────────────────┐
│                                                            │
│  Current View: Problem Graph                               │
│                                                            │
│  Depth: [1] [2] [●3] [4] [All]                            │
│                                                            │
│  At Depth 3, showing:                                      │
│  • Problem → Pain Points → Specific Pain 1, 2, 3          │
│  • Problem → Users → Persona A, B                          │
│  • Problem → Evidence → Interview 1, Survey Result         │
│                                                            │
│  Hidden (Depth 4+):                                        │
│  • Pain Point 1 → Sub-causes (3 nodes)                    │
│  • Persona A → Behaviors (5 nodes)                         │
│                                                            │
│  [+12 hidden nodes]  [Show All]                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Branch Depth Examples

```
Depth 1:  [Root] → [Child]
          AI sees root + immediate children only

Depth 2:  [Root] → [Child] → [Grandchild]
          AI sees 2 levels deep

Depth 3:  [Root] → [Child] → [Grandchild] → [Great-grandchild]
          Most common default - balances context vs cost

Depth All: Everything connected (expensive, use sparingly)
```

---

## Version Control & Undo

### One-Time Undo (Per Edit)

```typescript
interface UndoState {
  ideaId: string;
  timestamp: string;

  // What was changed
  affectedNodes: {
    nodeId: string;
    previousState: Partial<GraphNode>; // Only changed fields
  }[];

  affectedEdges: {
    edgeId: string;
    action: "created" | "deleted" | "modified";
    previousState?: Partial<GraphEdge>;
  }[];
}

// Only keep ONE undo state per idea (most recent edit)
// After undo is used OR new edit is made, previous undo state is cleared
```

### Named Versions (User-Saved Checkpoints)

```typescript
interface GraphVersion {
  id: string;
  ideaId: string;
  name: string; // User-provided name
  description?: string;
  createdAt: string;

  // Full snapshot of all graphs for this idea
  snapshot: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}
```

### Version History UI

```
┌─ VERSION HISTORY ─────────────────────────────────────────┐
│                                                            │
│  📌 Current State                                         │
│     Last edited: 2 minutes ago                            │
│     [Undo last edit]                                      │
│                                                            │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  💾 Saved Versions                                        │
│                                                            │
│  v3: "Before pivot to B2B"                               │
│      Jan 20, 2026 • 47 nodes, 82 edges                    │
│      [Restore] [Compare] [Delete]                         │
│                                                            │
│  v2: "After user interviews"                              │
│      Jan 18, 2026 • 35 nodes, 61 edges                    │
│      [Restore] [Compare] [Delete]                         │
│                                                            │
│  v1: "Initial capture"                                    │
│      Jan 15, 2026 • 12 nodes, 18 edges                    │
│      [Restore] [Compare] [Delete]                         │
│                                                            │
│  [Save Current as New Version]                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## AI Context Loading Strategy

```typescript
async function loadGraphContext(
  nodeId: string,
  branchDepth: number
): Promise<AIContext> {

  // 1. Load the target node
  const targetNode = await getNode(nodeId);

  // 2. Load ancestors (always - provides path context)
  const ancestors = await getAncestors(nodeId);

  // 3. Load descendants to specified depth
  const descendants = await getDescendants(nodeId, branchDepth);

  // 4. Load cross-graph links from these nodes
  const crossLinks = await getCrossGraphLinks([
    nodeId,
    ...descendants.map(n => n.id)
  ]);

  // 5. Summarize distant connections (don't load full content)
  const distantSummary = await summarizeDistantConnections(nodeId);

  return {
    focusNode: targetNode,
    ancestors,
    descendants,
    crossLinks,
    distantSummary,
    totalTokenEstimate: estimateTokens(...)
  };
}
```

---

## Build Progress Graph

The Build Progress Graph bridges ideation and execution:

```
                    BUILD PROGRESS GRAPH

                         [MVP v1.0]
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
      [Auth System]    [Core Feature]    [Data Layer]
           │                 │                 │
      ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
      │         │      │         │      │         │
   [Login]  [Signup]  [Search] [Display]  [Schema] [API]
      │         │      │         │         │        │
     ✅        ✅     🔄        ⏳        ✅       🔄

   Legend:
   ✅ Tests passing (green)
   🔄 In progress (amber pulse)
   ⏳ Pending (gray dashed)
   ❌ Failed (red)
   🚫 Blocked (red + dependency line shown)
```

**Key Feature**: Each node in the Build Graph can link BACK to the Idea Graph:

- `[Search]` node → links to `Solution Graph > Features > Core Search`
- `[Login]` node → links to `Product Spec Graph > Auth System`
- Failed test → links to `Risk Graph > Technical Risk > [New Risk Added]`

---

## Functional Decisions Summary

| Aspect                | Decision                                                          |
| --------------------- | ----------------------------------------------------------------- |
| **Graph Persistence** | All in unified tables with `graphType` field                      |
| **Active Graphs**     | All graphs always active; user triggers sync/merge with timestamp |
| **Search**            | Both unified search and graph-scoped search                       |
| **Sync Conflicts**    | AI suggests when similarity found; user can merge or distinguish  |
| **Loading**           | Lazy loading with configurable default branch depth               |
| **Export**            | Not supported for now                                             |
| **Progression**       | Gaps are opportunities, not blockers                              |

---

## Future Considerations

### Template Ecosystem

Different idea types need different graph sets:

- **SaaS product**: Problem, Solution, Market, Product Spec, Pricing
- **Physical product**: Add Manufacturing, Supply Chain, Logistics
- **Service business**: Add Operations, Delivery, People

This becomes a template marketplace opportunity.

### Knowledge Transfer

Graphs from one idea can seed another:

- "Import Market Graph from similar idea" - instant market research foundation
- Cross-idea learning at structural level

### AI Training Feedback Loop

User corrections to AI-suggested groupings become training data:

- System learns what belongs in which graph for your domain
- Personalized graph intelligence over time

### Integration Surface

- Product Spec Graph → direct integration with Cursor/Claude Code for implementation
- Market Graph → integration with market research APIs
- Risk Graph → integration with compliance/regulatory databases

---

## Atomic Node Structure

### Node Naming

Nodes are **AI-named initially**, with user override capability:

```
┌─ NEW NODE CREATED ─────────────────────────────────────────┐
│                                                            │
│  AI named this node: "User Authentication Flow"           │
│                                                            │
│  [Keep name]  [Rename: _______________]                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Naming Rules:**

- AI generates descriptive, concise names from context
- User can rename at any time (name is editable field)
- System tracks `originalName` for rename history

### Relationship Requirements

**First Node (Root):**

- Can be created with **zero relationships**
- Existence creates the graph it belongs to

**Subsequent Nodes:**

- New nodes related to an existing node need **at least one relationship** to be created
- This relationship can be:
  - Parent-child (hierarchical)
  - Cross-link to another graph
  - Any other edge type

**Standalone Nodes:**

- Nodes CAN exist with no relationships (orphans are allowed)
- These appear in an "Unconnected" section of graph view
- AI may suggest connections, but user decides

### Depth Limits

**No maximum depth limit.** Graphs can grow as deep as needed:

- User controls visible depth via branch depth slider
- AI context loading respects specified depth
- Performance optimization through lazy loading, not hard limits

### Orphan Handling

**Orphans are allowed.** When a node loses all connections:

- Node remains in graph
- Appears in "Unconnected Nodes" section
- AI may suggest new connections
- User can delete manually if no longer needed

---

## Node Subsections & Internal Lists

Nodes can contain **subsections and internal lists** that group related information without creating separate nodes:

### Structure

```typescript
interface GraphNode {
  // ... existing fields ...

  // Subsections that can be promoted to nodes
  subsections: NodeSubsection[];
}

interface NodeSubsection {
  id: string;
  title: string;
  content: string; // Can be markdown, including lists
  order: number;

  // Promotion tracking
  promotedToNodeId?: string; // If this became its own node
  promotionDate?: string;
}
```

### Visual Representation

```
┌─ NODE: Target Users ──────────────────────────────────────┐
│                                                            │
│  Main content about target user personas...               │
│                                                            │
│  ▼ Subsections (click to expand)                          │
│  ┌────────────────────────────────────────────────────┐   │
│  │ ▸ Demographics                                      │   │
│  │   • Age: 25-45                                     │   │
│  │   • Tech-savvy professionals                       │   │
│  │   • Urban/suburban                                  │   │
│  │                                                      │   │
│  │ ▸ Pain Points                      [→ Make Node]   │   │
│  │   • Slow research process                          │   │
│  │   • Information scattered                          │   │
│  │   • No single source of truth                      │   │
│  │                                                      │   │
│  │ ▸ Current Workarounds                              │   │
│  │   • Manual Google searches                         │   │
│  │   • Spreadsheet tracking                           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Promotion to Node

Subsections can be **promoted to their own nodes** when:

1. **Manual promotion**: User clicks "Make Node" on a subsection
2. **AI-suggested promotion**: When subsection content has connections to other nodes

```
┌─ AI SUGGESTION ───────────────────────────────────────────┐
│                                                            │
│  📊 Subsection could become its own node                  │
│                                                            │
│  "Pain Points" in [Target Users] has potential links to:  │
│                                                            │
│  • Problem Graph > Core Problem (addresses)               │
│  • Solution Graph > Features (solves)                     │
│  • Risk Graph > Market Risk (validates)                   │
│                                                            │
│  Promoting this to a node would enable cross-graph        │
│  connections and better AI context.                       │
│                                                            │
│  [Promote to Node]  [Keep as Subsection]                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Benefits of Subsections

- **Reduces node clutter**: Group related info without creating many small nodes
- **Progressive detail**: Click to expand, details hidden by default
- **Flexible structure**: Start grouped, split when connections emerge
- **Clear hierarchy**: Main content → subsections → nested lists

---

## Auto-Update from Ideation Agent

When users answer questions from the Ideation Agent (which has full graph context), the graph **automatically updates in the right panel**:

### Flow

```
┌──────────────────────────────────────┬──────────────────────────────────┐
│           CHAT PANEL                 │         GRAPH PANEL              │
│                                      │                                  │
│  Agent: "Who is your target user?"   │      [Problem Graph]             │
│                                      │           │                      │
│  You: "Small business owners who     │      [Target User]               │
│  struggle with inventory tracking"   │           │                      │
│                                      │      ┌────┴────┐                │
│  ✓ Answer recorded                   │      │         │                │
│                                      │  [SMB Owners] [NEW!]            │
│  Agent: "What pain does this         │      │                          │
│  cause them?"                        │  [Inventory ─────────→ NEW!     │
│                                      │   Tracking]                      │
│                                      │                                  │
└──────────────────────────────────────┴──────────────────────────────────┘
```

### Auto-Update Rules

| User Action           | Graph Response                              |
| --------------------- | ------------------------------------------- |
| Answers new question  | New node created if novel info              |
| Provides details      | Updates existing node OR creates subsection |
| Mentions relationship | Edge suggested/created                      |
| Contradicts existing  | Conflict flagged for resolution             |
| Confirms existing     | Node confidence increases                   |

### Implementation

```typescript
interface IdeationAgentResponse {
  // ... message content ...

  // Graph mutations triggered by this response
  graphUpdates: {
    newNodes: Partial<GraphNode>[];
    updatedNodes: { id: string; changes: Partial<GraphNode> }[];
    newEdges: Partial<GraphEdge>[];
    newSubsections: { nodeId: string; subsection: NodeSubsection }[];
    conflicts: GraphConflict[];
  };
}

// Applied automatically when agent processes user response
async function applyGraphUpdates(updates: GraphUpdates): Promise<void> {
  // 1. Create new nodes
  // 2. Update existing nodes
  // 3. Add new edges
  // 4. Add subsections to nodes
  // 5. Flag conflicts for user resolution
  // 6. Emit WebSocket event for UI update
}
```

### Visual Feedback

New/updated elements pulse briefly to draw attention:

```css
.graph-node--just-updated {
  animation: pulse-highlight 2s ease-out;
}

@keyframes pulse-highlight {
  0% {
    box-shadow: 0 0 20px var(--color-accent);
  }
  100% {
    box-shadow: none;
  }
}
```

---

## Tag-Based Contextual Groupings

Tags provide a **contextual layer** that surfaces opportunities for merging, syncing, and discovering synergies across nodes.

### Tag Structure

```typescript
interface NodeTag {
  id: string;
  name: string; // e.g., "pricing", "user-research", "mvp-critical"
  color?: string; // For visual grouping
  createdBy: "user" | "ai";
}

interface GraphNode {
  // ... existing fields ...

  tags: string[]; // Array of tag IDs
}
```

### Tag Sources

| Source               | Examples                                                  |
| -------------------- | --------------------------------------------------------- |
| **AI-inferred**      | From content analysis: "pricing", "competitor", "risk"    |
| **User-applied**     | Manual tagging: "priority", "needs-research", "v2"        |
| **System-generated** | Status tags: "stale", "recently-updated", "has-conflicts" |

### Tag-Based Views

```
┌─ TAG: "pricing" ──────────────────────────────────────────┐
│                                                            │
│  Nodes tagged with "pricing" across all graphs:           │
│                                                            │
│  Solution Graph:                                           │
│  • Pricing Model                                          │
│  • Tier Structure                                         │
│                                                            │
│  Market Graph:                                             │
│  • Competitor Pricing                                     │
│  • Price Sensitivity                                      │
│                                                            │
│  Risk Graph:                                               │
│  • Revenue Risk                                           │
│                                                            │
│  ─────────────────────────────────────────────────────── │
│                                                            │
│  💡 OPPORTUNITY DETECTED                                  │
│                                                            │
│  "Competitor Pricing" and "Tier Structure" share          │
│  significant overlap but aren't linked.                   │
│                                                            │
│  [Link these nodes]  [View side-by-side]  [Dismiss]      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Opportunity Detection

Tags enable AI to surface:

| Opportunity               | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| **Merge candidates**      | Nodes with same tags + high content similarity                              |
| **Sync candidates**       | Nodes with same tags + one recently updated                                 |
| **Synergy opportunities** | Nodes with complementary tags (e.g., "problem" + "solution") not yet linked |
| **Gap detection**         | Tags that exist in one graph but not related graphs                         |

### Tag UI

```
┌─ NODE: Pricing Model ─────────────────────────────────────┐
│                                                            │
│  Tags: [pricing] [mvp-critical] [needs-research] [+]     │
│                                                            │
│  Content...                                                │
│                                                            │
└────────────────────────────────────────────────────────────┘

Clicking [+] shows:
┌────────────────────────────────┐
│ Add tag:                       │
│ [____________] [Create]        │
│                                │
│ AI suggested:                  │
│ • revenue (from content)       │
│ • competitor-related           │
│                                │
│ Recent tags:                   │
│ • validation                   │
│ • user-research                │
└────────────────────────────────┘
```

---

## Updated Data Model

### Complete GraphNode Interface

```typescript
interface GraphNode {
  id: string;
  ideaId: string;
  graphType: GraphType;

  // Naming
  label: string; // Current name (AI or user)
  originalLabel?: string; // AI-generated original (for tracking renames)
  labelSource: "ai" | "user"; // Who named it

  // Content
  content: string;
  subsections: NodeSubsection[]; // Expandable internal lists

  // Hierarchy
  parentNodeId: string | null;
  depth: number;

  // Contextual grouping
  tags: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: "user" | "ai" | "system";

  // AI features
  embedding?: number[];
}

interface NodeSubsection {
  id: string;
  title: string;
  content: string;
  order: number;
  promotedToNodeId?: string;
  promotionDate?: string;
}
```

### Tag Table

```typescript
interface Tag {
  id: string;
  ideaId: string; // Scoped to idea
  name: string;
  color?: string;
  description?: string;
  createdBy: "user" | "ai" | "system";
  createdAt: string;
  usageCount: number; // For popularity sorting
}
```

---

## Next Steps

1. ~~Define atomic node structure and branch creation triggers~~ ✅
2. Implement graph storage schema (including subsections and tags)
3. Build basic graph visualization component
4. Add AI-powered link suggestions
5. Implement version control
6. Build Ideation Agent → Graph auto-update pipeline
7. Implement tag-based opportunity detection

---

_Document Version: 2.0_
_Last Updated: January 2026_
