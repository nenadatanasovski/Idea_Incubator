# Circular Dependency Resolution v2 — AI-Assisted Approach

## Philosophy

**The user is the domain expert. The AI is the graph expert.**

When a circular dependency occurs, it's usually because the AI lacked context. The solution isn't clicking buttons — it's providing that missing context so the AI can intelligently restructure the relationships.

### Core Principles

1. **Context-First Resolution** — User provides natural language explanation, AI proposes structural changes
2. **Preview Before Apply** — Always show what will change before making changes
3. **Atomic Transactions** — Multiple changes (merge, create, delete) happen together or not at all
4. **Learning Loop** — Resolution patterns inform future relationship inference
5. **Flexible Intents** — Support many resolution strategies, not just "break edge"

---

## Resolution Strategies

| Strategy                | User Says                                         | AI Does                                              |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| **Merge Nodes**         | "These are the same concept"                      | Combine nodes, redirect all edges, archive originals |
| **Add Abstraction**     | "Both depend on X which isn't captured"           | Create new node, rewire dependencies                 |
| **Correct Direction**   | "The dependency goes the other way"               | Reverse edge direction                               |
| **Change Relationship** | "It's not a hard dependency, more of a reference" | Change edge type to non-blocking                     |
| **Split Node**          | "This node is trying to be two things"            | Create two nodes from one, distribute edges          |
| **Remove Relationship** | "This relationship is wrong"                      | Delete edge with explanation                         |
| **Acknowledge**         | "This mutual dependency is intentional"           | Mark as acknowledged, suppress warning               |
| **Auto-Resolve**        | "Help me figure this out"                         | AI analyzes and proposes best resolution             |

---

## User Journey

### Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CYCLE DISCOVERY                                    │
│  User sees warning → Expands to view cycles → Selects cycle to resolve      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESOLUTION MODE                                      │
│  Cycle focused on canvas → Node group highlighted → Context panel opens     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT INPUT                                        │
│  User explains in natural language → Optionally selects intent → Submits    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI ANALYSIS                                          │
│  AI reads context → Analyzes cycle → Proposes resolution with explanation   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROPOSAL REVIEW                                      │
│  User sees proposed changes → Previews before/after → Accepts or refines    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                     [Approve]           [Refine]
                          │                   │
                          ▼                   ▼
┌─────────────────────────────────┐   ┌─────────────────────────────┐
│     APPLY CHANGES               │   │   ITERATE                   │
│  Atomic transaction applied     │   │   Add more context          │
│  Undo available for 30 seconds  │   │   Adjust proposal           │
│  Canvas updates in real-time    │   │   Re-analyze                │
└─────────────────────────────────┘   └─────────────────────────────┘
```

### Detailed Scenarios

#### Scenario A: "These are the same thing"

```
User sees: "MVP" → requires → "Prototype" → requires → "MVP"

User thinks: "MVP and Prototype are basically the same concept in this context"

User action: Opens resolution panel, types:
  "MVP and Prototype are the same thing in this project.
   Prototype is just an earlier name we used. Merge them."

AI proposes:
  ✓ Create merged node "MVP (Prototype)" combining both contents
  ✓ Redirect 5 incoming edges to new node
  ✓ Redirect 3 outgoing edges from new node
  ✓ Archive "MVP" and "Prototype" nodes

User: Reviews merged content, approves

Result: Single node, no cycle, richer content
```

#### Scenario B: "There's a missing concept"

```
User sees: "Auth System" → requires → "User Model" → requires → "Auth System"

User thinks: "They both need an 'Identity' concept that we haven't articulated"

User action: Types:
  "Both Auth System and User Model depend on a concept of 'Identity' -
   the core attributes that identify a user (ID, email, credentials).
   This should be its own node that both depend on."

AI proposes:
  ✓ Create new node "Identity Core" with content:
    - User identifier (UUID)
    - Primary email
    - Credential reference
    - Created/updated timestamps
  ✓ Change "Auth System requires User Model" → "Auth System requires Identity Core"
  ✓ Change "User Model requires Auth System" → "User Model requires Identity Core"
  ✓ Add "Auth System elaborates Identity Core"
  ✓ Add "User Model elaborates Identity Core"

User: Reviews new node, edits content slightly, approves

Result: New abstraction created, cycle resolved, graph more accurate
```

#### Scenario C: "The direction is wrong"

```
User sees: "API Endpoint" → requires → "Database Schema"
          "Database Schema" → requires → "API Endpoint"

User thinks: "Database doesn't require the API, it's the other way around"

User action: Types:
  "The database schema doesn't depend on the API endpoint.
   The API is built on top of the schema. Remove the schema→API dependency."

AI proposes:
  ✓ Remove edge "Database Schema requires API Endpoint"
  ✓ Optionally add "API Endpoint derived_from Database Schema" (inverse relationship)

User: Approves

Result: Correct dependency direction, cycle resolved
```

#### Scenario D: "Auto-resolve"

```
User sees: Complex 4-node cycle, not sure what's wrong

User action: Clicks "Help me resolve this", optionally adds:
  "I'm not sure what's causing this cycle. The general intent is that
   features should depend on infrastructure, not the other way around."

AI analyzes:
  - Examines node types (Feature vs Infrastructure)
  - Looks at edge confidence scores
  - Identifies lowest-confidence edge
  - Considers relationship semantics

AI proposes:
  "Based on your intent that features depend on infrastructure:

   The edge 'Cache Layer requires Feature Flag' (confidence: 0.4)
   appears to be incorrect. Cache Layer is infrastructure and shouldn't
   depend on Feature Flag which is a feature-level concern.

   Proposed: Remove this edge. The relationship might actually be
   'Feature Flag uses Cache Layer' (reversed)."

   ✓ Remove "Cache Layer requires Feature Flag"
   ✓ Add "Feature Flag uses Cache Layer"

User: "Actually, keep analyzing - there might be more issues"

AI continues analysis...
```

---

## UI Design

### 1. Entry Points

The user can enter resolution mode from multiple places:

```
┌─────────────────────────────────────────────────────────────────┐
│ Entry Point 1: Cycle Indicator Panel                            │
│                                                                 │
│  ⚠ 3 Circular Dependencies                              [−]    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ● 2 nodes [blocking]                                  ▼   │ │
│  │   MVP → Stack: GPT-4 → ⟳                                  │ │
│  │                                                           │ │
│  │   [Resolve with AI]  [Quick Actions ▾]                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ● 3 nodes [reinforcing]                               ▼   │ │
│  │   ...                                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Entry Point 2: Node Inspector (when node is in a cycle)

┌─────────────────────────────────────────────────────────────────┐
│ Node: MVP Implementation                                        │
│ Type: Feature                                                   │
│                                                                 │
│ ⚠ Part of circular dependency                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ This node is in a blocking cycle with "Stack: GPT-4"      │  │
│ │                                                           │  │
│ │ Path: MVP → GPT-4 → MVP                                   │  │
│ │                                                           │  │
│ │ [Resolve this cycle]                                      │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ Relationships                                                   │
│ ...                                                             │
└─────────────────────────────────────────────────────────────────┘

Entry Point 3: Canvas Context Menu (right-click on cycle edge)

┌─────────────────────┐
│ Edit relationship   │
│ ─────────────────── │
│ Resolve cycle...    │  ← Opens resolution panel for this cycle
│ ─────────────────── │
│ Delete edge         │
└─────────────────────┘
```

### 2. Resolution Panel (Main UI)

When user clicks "Resolve with AI", this panel opens:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESOLVE CIRCULAR DEPENDENCY                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CYCLE VISUALIZATION                                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │         ┌─────────────────┐                                          │  │
│  │         │ MVP uses static │                                          │  │
│  │         │ images for UI   │                                          │  │
│  │         └────────┬────────┘                                          │  │
│  │                  │ requires                                          │  │
│  │                  ▼                                                   │  │
│  │         ┌─────────────────┐                                          │  │
│  │         │ Stack: GPT-4 or │◄────────────────┐                        │  │
│  │         │ Claude for...   │                 │                        │  │
│  │         └────────┬────────┘                 │ requires               │  │
│  │                  │                          │                        │  │
│  │                  └──────────────────────────┘                        │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WHAT'S WRONG WITH THIS CYCLE?                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Explain in your own words what's incorrect or provide context...     │  │
│  │                                                                       │  │
│  │ Example: "MVP doesn't actually require GPT-4, it just references     │  │
│  │ it as a potential technology choice. The relationship should be      │  │
│  │ softer - more like 'considers' than 'requires'."                     │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  RESOLUTION HINT (optional)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ○ Let AI decide                                                     │    │
│  │ ○ Merge these nodes (they're the same concept)                      │    │
│  │ ○ Change relationship type (soften the dependency)                  │    │
│  │ ○ Reverse direction (dependency goes the other way)                 │    │
│  │ ○ Add missing concept (both depend on something not captured)       │    │
│  │ ○ Remove relationship (it's incorrect)                              │    │
│  │ ○ Acknowledge (this is intentional)                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                                           [Cancel]  [Analyze & Propose]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Proposal Review Panel

After AI analyzes, the panel transforms to show the proposal:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESOLVE CIRCULAR DEPENDENCY                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AI ANALYSIS                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Based on your explanation that MVP "references" rather than          │  │
│  │ "requires" GPT-4, I recommend changing the relationship type.        │  │
│  │                                                                       │  │
│  │ The current "requires" relationship implies MVP cannot function      │  │
│  │ without GPT-4, but your context suggests it's one of several         │  │
│  │ technology options being considered.                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PROPOSED CHANGES                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  1. ✏️  MODIFY EDGE                                                   │  │
│  │     From: "MVP uses static images" ──requires──▶ "Stack: GPT-4"      │  │
│  │     To:   "MVP uses static images" ──references──▶ "Stack: GPT-4"    │  │
│  │                                                                       │  │
│  │     Reason: Changes hard dependency to soft reference                 │  │
│  │     [Edit] [Remove from proposal]                                     │  │
│  │                                                                       │  │
│  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │
│  │                                                                       │  │
│  │  RESULT: Cycle will be resolved                                       │  │
│  │  • "references" is not a blocking relationship type                   │  │
│  │  • Both nodes remain connected but without circular block             │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  PREVIEW                                                                    │
│  ┌────────────────────────────┐  ┌────────────────────────────┐             │
│  │ BEFORE                     │  │ AFTER                      │             │
│  │                            │  │                            │             │
│  │   [MVP] ═══requires═══▶    │  │   [MVP] ───references───▶  │             │
│  │     ▲                      │  │                            │             │
│  │     ║                      │  │   [GPT-4] ═══requires═══▶  │             │
│  │   [GPT-4] ═══requires═══   │  │     │                      │             │
│  │                            │  │     ▼                      │             │
│  │   ⚠ Blocking cycle        │  │   [MVP]                    │             │
│  │                            │  │                            │             │
│  │                            │  │   ✓ No cycles              │             │
│  └────────────────────────────┘  └────────────────────────────┘             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  NOT QUITE RIGHT?                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Add more context or corrections...                                   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  [Re-analyze with new context]                                              │
│                                                                             │
│                              [Cancel]  [Apply Changes]                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Complex Proposal (Multiple Changes)

For merge/abstraction operations:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPOSED CHANGES                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  1. ➕ CREATE NODE                                                    │  │
│  │     Title: "Identity Core"                                            │  │
│  │     Type: Concept                                                     │  │
│  │     Content: [Click to preview/edit]                                  │  │
│  │     ┌─────────────────────────────────────────────────────────────┐   │  │
│  │     │ Core identity attributes shared by Auth and User systems:  │   │  │
│  │     │ • User identifier (UUID)                                   │   │  │
│  │     │ • Primary email address                                    │   │  │
│  │     │ • Credential reference (hashed)                            │   │  │
│  │     │ • Account status                                           │   │  │
│  │     └─────────────────────────────────────────────────────────────┘   │  │
│  │     [Edit content] [Remove from proposal]                             │  │
│  │                                                                       │  │
│  │  2. ✏️  MODIFY EDGE                                                   │  │
│  │     From: "Auth System" ──requires──▶ "User Model"                    │  │
│  │     To:   "Auth System" ──requires──▶ "Identity Core"                 │  │
│  │     [Edit] [Remove]                                                   │  │
│  │                                                                       │  │
│  │  3. ✏️  MODIFY EDGE                                                   │  │
│  │     From: "User Model" ──requires──▶ "Auth System"                    │  │
│  │     To:   "User Model" ──requires──▶ "Identity Core"                  │  │
│  │     [Edit] [Remove]                                                   │  │
│  │                                                                       │  │
│  │  4. ➕ CREATE EDGE                                                    │  │
│  │     "Auth System" ──elaborates──▶ "Identity Core"                     │  │
│  │     Reason: Auth system implements identity verification              │  │
│  │     [Edit] [Remove]                                                   │  │
│  │                                                                       │  │
│  │  5. ➕ CREATE EDGE                                                    │  │
│  │     "User Model" ──elaborates──▶ "Identity Core"                      │  │
│  │     Reason: User model extends identity with profile data             │  │
│  │     [Edit] [Remove]                                                   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  SUMMARY: 1 node created, 2 edges modified, 2 edges created                 │
│  Cycle resolved: Auth ↔ User becomes Auth → Identity ← User                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Success State & Undo

After applying changes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ✓ CYCLE RESOLVED                                                          │
│                                                                             │
│  Applied 3 changes to resolve the circular dependency.                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Changes applied:                                                      │  │
│  │ • Modified: MVP → GPT-4 relationship (requires → references)          │  │
│  │                                                                       │  │
│  │ The cycle between MVP and GPT-4 has been resolved.                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                    [Undo (28s remaining)]  [Done]                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Quick Actions (For Power Users)

Alongside AI resolution, keep quick manual actions for users who know exactly what they want:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ● 2 nodes [blocking]                                                  ▼  │
│   MVP uses static images → Stack: GPT-4 → ⟳                              │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │ ● MVP uses static images                                        │    │
│   │   ↓ requires                                                    │    │
│   │   [Change type ▾] [Reverse] [Remove]                            │    │
│   │                                                                 │    │
│   │ ● Stack: GPT-4 or Claude                                        │    │
│   │   ↓ requires                                                    │    │
│   │   [Change type ▾] [Reverse] [Remove]                            │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   [Resolve with AI...]  [Acknowledge cycle]                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Resolution Session

```typescript
interface ResolutionSession {
  id: string;
  sessionId: string; // Parent ideation session
  cycleId: string; // Cycle being resolved
  nodeIds: string[]; // Nodes in the cycle
  edgeIds: string[]; // Edges in the cycle

  // User input
  userContext: string; // Natural language explanation
  selectedIntent?: ResolutionIntent;

  // AI output
  proposal?: ResolutionProposal;

  // State
  status:
    | "input"
    | "analyzing"
    | "proposed"
    | "refining"
    | "applying"
    | "applied"
    | "cancelled";

  // History
  iterations: ResolutionIteration[]; // For refinement tracking

  createdAt: string;
  updatedAt: string;
}

interface ResolutionIteration {
  userContext: string;
  proposal: ResolutionProposal;
  feedback?: string; // User's refinement feedback
  timestamp: string;
}

type ResolutionIntent =
  | "auto" // Let AI decide
  | "merge_nodes" // Combine nodes
  | "add_abstraction" // Create unifying concept
  | "change_type" // Soften relationship
  | "reverse_direction" // Flip edge
  | "remove_relationship" // Delete edge
  | "split_node" // Divide node into parts
  | "acknowledge"; // Accept as intentional
```

### Resolution Proposal

```typescript
interface ResolutionProposal {
  id: string;

  // AI reasoning
  analysis: string; // Explanation of what's wrong
  approach: string; // Why this solution
  confidence: number; // 0-1 confidence score

  // Proposed changes
  actions: ResolutionAction[];

  // Outcome prediction
  cycleResolved: boolean;
  sideEffects: string[]; // Other impacts

  // Alternatives
  alternatives?: ResolutionProposal[];
}

type ResolutionAction =
  | CreateNodeAction
  | UpdateNodeAction
  | ArchiveNodeAction
  | MergeNodesAction
  | CreateEdgeAction
  | UpdateEdgeAction
  | DeleteEdgeAction;

interface CreateNodeAction {
  type: "create_node";
  tempId: string; // Temporary ID for referencing in other actions
  node: {
    type: BlockType;
    title: string;
    content: string;
    properties?: Record<string, unknown>;
  };
  reason: string;
}

interface MergeNodesAction {
  type: "merge_nodes";
  sourceNodeIds: string[]; // Nodes to merge
  resultNode: {
    title: string;
    content: string; // Combined content
    type: BlockType;
  };
  edgeStrategy: "redirect" | "union"; // How to handle edges
  reason: string;
}

interface UpdateEdgeAction {
  type: "update_edge";
  edgeId: string;
  changes: {
    linkType?: LinkType;
    source?: string; // For redirecting
    target?: string; // For redirecting
    degree?: LinkDegree;
    confidence?: number;
    reason?: string;
  };
  reason: string;
}

// ... other action types
```

### Applied Resolution (for undo)

```typescript
interface AppliedResolution {
  id: string;
  sessionId: string;
  resolutionSessionId: string;

  // Snapshot for undo
  originalNodes: GraphNode[];
  originalEdges: GraphEdge[];

  // What was done
  actionsApplied: ResolutionAction[];

  // Undo window
  appliedAt: string;
  undoExpiresAt: string; // 30 seconds after appliedAt
  undone: boolean;
}
```

---

## API Design

### Endpoints

```typescript
// Start a resolution session
POST /api/session/:sessionId/resolutions
Body: {
  cycleId: string;
  nodeIds: string[];
  edgeIds: string[];
}
Response: ResolutionSession

// Submit context and get proposal
POST /api/session/:sessionId/resolutions/:resolutionId/analyze
Body: {
  userContext: string;
  intent?: ResolutionIntent;
}
Response: ResolutionProposal

// Refine proposal with additional context
POST /api/session/:sessionId/resolutions/:resolutionId/refine
Body: {
  feedback: string;
  keepActions?: string[];      // Action IDs to keep
  removeActions?: string[];    // Action IDs to remove
}
Response: ResolutionProposal

// Edit a specific action in the proposal
PATCH /api/session/:sessionId/resolutions/:resolutionId/actions/:actionId
Body: Partial<ResolutionAction>
Response: ResolutionProposal  // Updated proposal

// Apply the proposal
POST /api/session/:sessionId/resolutions/:resolutionId/apply
Response: {
  success: boolean;
  appliedResolutionId: string;
  undoExpiresAt: string;
}

// Undo applied resolution
POST /api/session/:sessionId/resolutions/:appliedResolutionId/undo
Response: { success: boolean }

// Get resolution history
GET /api/session/:sessionId/resolutions
Response: ResolutionSession[]
```

### WebSocket Events

```typescript
// Resolution analysis started
{
  type: 'resolution_analyzing',
  payload: {
    resolutionId: string;
    cycleId: string;
  }
}

// Resolution proposal ready
{
  type: 'resolution_proposed',
  payload: {
    resolutionId: string;
    proposal: ResolutionProposal;
  }
}

// Resolution applied
{
  type: 'resolution_applied',
  payload: {
    resolutionId: string;
    actions: ResolutionAction[];
    undoExpiresAt: string;
  }
}

// Resolution undone
{
  type: 'resolution_undone',
  payload: {
    resolutionId: string;
  }
}
```

---

## AI Resolution Service

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESOLUTION SERVICE                                   │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ Context Builder │───▶│  LLM Analyzer   │───▶│ Action Planner  │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│          │                      │                      │                    │
│          ▼                      ▼                      ▼                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ • Node contents │    │ • Understand    │    │ • Generate      │         │
│  │ • Edge details  │    │   user intent   │    │   actions       │         │
│  │ • User context  │    │ • Analyze cycle │    │ • Validate      │         │
│  │ • Session hist. │    │ • Identify root │    │   consistency   │         │
│  │ • Similar cases │    │   cause         │    │ • Preview       │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Prompt Template

```typescript
const RESOLUTION_PROMPT = `
You are an expert at analyzing knowledge graphs and resolving circular dependencies.

## Current Cycle

Nodes involved:
{{#each nodes}}
- **{{this.title}}** ({{this.type}})
  Content: {{this.content}}
{{/each}}

Edges forming the cycle:
{{#each edges}}
- "{{this.sourceName}}" ──{{this.linkType}}──▶ "{{this.targetName}}"
  {{#if this.reason}}Reason: {{this.reason}}{{/if}}
  {{#if this.confidence}}Confidence: {{this.confidence}}{{/if}}
{{/each}}

## User Context

The user says: "{{userContext}}"

{{#if intent}}
User's intended resolution approach: {{intent}}
{{/if}}

## Your Task

1. **Analyze** why this cycle exists and what's incorrect
2. **Propose** specific changes to resolve it
3. **Explain** your reasoning

## Response Format

Return a JSON object:
{
  "analysis": "Explanation of what's wrong with this cycle",
  "approach": "Why this solution is appropriate",
  "confidence": 0.0-1.0,
  "actions": [
    // Array of action objects
  ],
  "cycleResolved": true/false,
  "sideEffects": ["Any other impacts of these changes"]
}

## Action Types

- create_node: { type: "create_node", tempId: "new_1", node: { type, title, content }, reason }
- update_node: { type: "update_node", nodeId: "...", changes: { title?, content? }, reason }
- archive_node: { type: "archive_node", nodeId: "...", reason }
- merge_nodes: { type: "merge_nodes", sourceNodeIds: [...], resultNode: { title, content, type }, edgeStrategy: "redirect"|"union", reason }
- create_edge: { type: "create_edge", source: "...", target: "...", linkType: "...", reason }
- update_edge: { type: "update_edge", edgeId: "...", changes: { linkType?, source?, target? }, reason }
- delete_edge: { type: "delete_edge", edgeId: "...", reason }

Be conservative - propose the minimum changes necessary to resolve the cycle while preserving the user's intent.
`;
```

### Service Implementation

```typescript
// server/services/graph/resolution-service.ts

import Anthropic from "@anthropic-ai/sdk";

interface AnalyzeResolutionParams {
  session: IdeationSession;
  cycle: DetectedCycle;
  nodes: MemoryBlock[];
  edges: MemoryLink[];
  userContext: string;
  intent?: ResolutionIntent;
  previousIterations?: ResolutionIteration[];
}

export async function analyzeAndProposeResolution(
  params: AnalyzeResolutionParams,
): Promise<ResolutionProposal> {
  const {
    session,
    cycle,
    nodes,
    edges,
    userContext,
    intent,
    previousIterations,
  } = params;

  // Build context for LLM
  const prompt = buildResolutionPrompt({
    nodes,
    edges,
    userContext,
    intent,
    previousIterations,
  });

  // Call LLM
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  // Parse response
  const proposal = parseProposalResponse(response);

  // Validate proposed actions
  validateProposal(proposal, nodes, edges);

  // Check if cycle would actually be resolved
  proposal.cycleResolved = simulateCycleResolution(edges, proposal.actions);

  return proposal;
}

export async function applyResolution(
  sessionId: string,
  proposal: ResolutionProposal,
): Promise<AppliedResolution> {
  // Snapshot current state for undo
  const snapshot = await snapshotAffectedNodes(sessionId, proposal);

  // Apply actions in transaction
  const db = getDatabase();
  await db.transaction(async (tx) => {
    for (const action of proposal.actions) {
      await applyAction(tx, sessionId, action);
    }
  });

  // Broadcast changes via WebSocket
  broadcastResolutionApplied(sessionId, proposal);

  // Create undo record
  const applied = await createAppliedResolution(sessionId, proposal, snapshot);

  // Schedule undo expiry
  scheduleUndoExpiry(applied.id, 30000);

  return applied;
}

async function applyAction(
  tx: Transaction,
  sessionId: string,
  action: ResolutionAction,
): Promise<void> {
  switch (action.type) {
    case "create_node":
      await tx.insert("memory_blocks", {
        id: generateId(),
        session_id: sessionId,
        type: action.node.type,
        title: action.node.title,
        content: action.node.content,
        status: "active",
        created_at: new Date().toISOString(),
      });
      break;

    case "update_edge":
      await tx.update("memory_links").where({ id: action.edgeId }).set({
        link_type: action.changes.linkType,
        source_block_id: action.changes.source,
        target_block_id: action.changes.target,
        updated_at: new Date().toISOString(),
      });
      break;

    case "merge_nodes":
      // Create merged node
      const mergedId = generateId();
      await tx.insert("memory_blocks", {
        id: mergedId,
        session_id: sessionId,
        type: action.resultNode.type,
        title: action.resultNode.title,
        content: action.resultNode.content,
        status: "active",
      });

      // Redirect edges
      if (action.edgeStrategy === "redirect") {
        for (const sourceId of action.sourceNodeIds) {
          // Incoming edges → point to merged node
          await tx
            .update("memory_links")
            .where({ target_block_id: sourceId })
            .set({ target_block_id: mergedId });

          // Outgoing edges → originate from merged node
          await tx
            .update("memory_links")
            .where({ source_block_id: sourceId })
            .set({ source_block_id: mergedId });
        }
      }

      // Archive original nodes
      for (const sourceId of action.sourceNodeIds) {
        await tx
          .update("memory_blocks")
          .where({ id: sourceId })
          .set({ status: "archived" });
      }
      break;

    // ... other action types
  }
}
```

---

## Implementation Tasks

### Phase 1: Data Model & API Foundation

#### Task 1.1: Create Resolution Session Schema

- [ ] Create migration `122_resolution_sessions.sql`
- [ ] Add schema entity `schema/entities/resolution-session.ts`
- [ ] Add schema entity `schema/entities/resolution-action.ts`
- [ ] Add schema entity `schema/entities/applied-resolution.ts`

**Migration File**: `database/migrations/122_resolution_sessions.sql`

```sql
CREATE TABLE resolution_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL,
  node_ids TEXT NOT NULL,      -- JSON array
  edge_ids TEXT NOT NULL,      -- JSON array
  user_context TEXT,
  selected_intent TEXT,
  proposal TEXT,               -- JSON ResolutionProposal
  status TEXT NOT NULL DEFAULT 'input',
  iterations TEXT,             -- JSON array of iterations
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applied_resolutions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  resolution_session_id TEXT NOT NULL REFERENCES resolution_sessions(id),
  original_nodes TEXT NOT NULL,  -- JSON snapshot
  original_edges TEXT NOT NULL,  -- JSON snapshot
  actions_applied TEXT NOT NULL, -- JSON array
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
  undo_expires_at TEXT NOT NULL,
  undone INTEGER DEFAULT 0
);

CREATE INDEX idx_resolution_sessions_session ON resolution_sessions(session_id);
CREATE INDEX idx_applied_resolutions_session ON applied_resolutions(session_id);
CREATE INDEX idx_applied_resolutions_undo ON applied_resolutions(undo_expires_at) WHERE undone = 0;
```

**Pass Criteria**:

- [ ] Migration runs without errors
- [ ] Tables created with correct indexes
- [ ] Can insert and query resolution sessions

---

#### Task 1.2: Create Resolution API Endpoints

- [ ] `POST /session/:sessionId/resolutions` - Start resolution session
- [ ] `POST /session/:sessionId/resolutions/:id/analyze` - Get AI proposal
- [ ] `POST /session/:sessionId/resolutions/:id/refine` - Refine proposal
- [ ] `PATCH /session/:sessionId/resolutions/:id/actions/:actionId` - Edit action
- [ ] `POST /session/:sessionId/resolutions/:id/apply` - Apply changes
- [ ] `POST /session/:sessionId/applied-resolutions/:id/undo` - Undo changes
- [ ] `GET /session/:sessionId/resolutions` - List history

**File**: `server/routes/ideation/resolution-routes.ts`

**Test Script**:

```bash
# Start resolution session
curl -X POST "http://localhost:3000/api/session/TEST/resolutions" \
  -H "Content-Type: application/json" \
  -d '{"cycleId": "cycle1", "nodeIds": ["n1", "n2"], "edgeIds": ["e1", "e2"]}'

# Analyze
curl -X POST "http://localhost:3000/api/session/TEST/resolutions/RES_ID/analyze" \
  -H "Content-Type: application/json" \
  -d '{"userContext": "These nodes are the same concept", "intent": "merge_nodes"}'

# Apply
curl -X POST "http://localhost:3000/api/session/TEST/resolutions/RES_ID/apply"

# Undo
curl -X POST "http://localhost:3000/api/session/TEST/applied-resolutions/APPLIED_ID/undo"
```

**Pass Criteria**:

- [ ] All endpoints return correct status codes
- [ ] Validation errors return 400 with details
- [ ] Concurrent requests handled correctly
- [ ] Undo works within time window
- [ ] Undo fails after time window expires

---

#### Task 1.3: Create WebSocket Events for Resolution

- [ ] Add `emitResolutionAnalyzing` function
- [ ] Add `emitResolutionProposed` function
- [ ] Add `emitResolutionApplied` function
- [ ] Add `emitResolutionUndone` function

**File**: `server/websocket.ts`

**Pass Criteria**:

- [ ] All clients receive events
- [ ] Events contain correct payload structure
- [ ] Events fire at appropriate times

---

### Phase 2: AI Resolution Service

#### Task 2.1: Create Resolution Service

- [ ] Create `server/services/graph/resolution-service.ts`
- [ ] Implement `analyzeAndProposeResolution` function
- [ ] Implement `applyResolution` function
- [ ] Implement `undoResolution` function
- [ ] Add action validation logic

**File**: `server/services/graph/resolution-service.ts`

**Test Script**:

```typescript
// tests/unit/services/resolution-service.test.ts
describe("ResolutionService", () => {
  describe("analyzeAndProposeResolution", () => {
    it("proposes edge type change for simple cycles", async () => {
      const result = await analyzeAndProposeResolution({
        nodes: [nodeA, nodeB],
        edges: [edgeAB, edgeBA],
        userContext: "A does not actually require B, it just references it",
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("update_edge");
      expect(result.cycleResolved).toBe(true);
    });

    it("proposes merge for identical concepts", async () => {
      const result = await analyzeAndProposeResolution({
        nodes: [nodeA, nodeB],
        edges: [edgeAB, edgeBA],
        userContext: "These are the same concept, just named differently",
        intent: "merge_nodes",
      });

      expect(result.actions.some((a) => a.type === "merge_nodes")).toBe(true);
    });

    it("proposes abstraction when appropriate", async () => {
      const result = await analyzeAndProposeResolution({
        nodes: [authNode, userNode],
        edges: [authRequiresUser, userRequiresAuth],
        userContext:
          "Both depend on a concept of Identity that is not captured",
        intent: "add_abstraction",
      });

      expect(result.actions.some((a) => a.type === "create_node")).toBe(true);
    });
  });

  describe("applyResolution", () => {
    it("applies all actions atomically", async () => {
      // ...
    });

    it("creates undo record", async () => {
      // ...
    });

    it("rolls back on error", async () => {
      // ...
    });
  });

  describe("undoResolution", () => {
    it("restores original state", async () => {
      // ...
    });

    it("fails after undo window expires", async () => {
      // ...
    });
  });
});
```

**Pass Criteria**:

- [ ] LLM calls return valid proposals
- [ ] Proposals are validated before returning
- [ ] Apply creates correct database changes
- [ ] Undo restores exact original state
- [ ] Transactions roll back on error

---

#### Task 2.2: Implement Action Validators

- [ ] Validate create_node actions (required fields, valid types)
- [ ] Validate update_edge actions (edge exists, valid changes)
- [ ] Validate merge_nodes actions (nodes exist, no orphaned edges)
- [ ] Validate delete_edge actions (edge exists)
- [ ] Simulate cycle resolution before applying

**File**: `server/services/graph/resolution-validators.ts`

```typescript
export function validateProposal(
  proposal: ResolutionProposal,
  nodes: MemoryBlock[],
  edges: MemoryLink[],
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const action of proposal.actions) {
    switch (action.type) {
      case "update_edge":
        if (!edges.find((e) => e.id === action.edgeId)) {
          errors.push({ action, message: "Edge not found" });
        }
        break;

      case "merge_nodes":
        for (const nodeId of action.sourceNodeIds) {
          if (!nodes.find((n) => n.id === nodeId)) {
            errors.push({ action, message: `Node ${nodeId} not found` });
          }
        }
        break;

      // ... other validations
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function simulateCycleResolution(
  edges: MemoryLink[],
  actions: ResolutionAction[],
): boolean {
  // Clone edges
  let simulatedEdges = [...edges];

  // Apply each action
  for (const action of actions) {
    switch (action.type) {
      case "delete_edge":
        simulatedEdges = simulatedEdges.filter((e) => e.id !== action.edgeId);
        break;

      case "update_edge":
        simulatedEdges = simulatedEdges.map((e) =>
          e.id === action.edgeId ? { ...e, ...action.changes } : e,
        );
        break;

      // ... other action simulations
    }
  }

  // Check for cycles in blocking edges
  const blockingTypes = ["requires", "blocks", "constrained_by", "depends_on"];
  const blockingEdges = simulatedEdges.filter(
    (e) => e.status === "active" && blockingTypes.includes(e.linkType),
  );

  return !hasCycles(blockingEdges);
}
```

**Pass Criteria**:

- [ ] Invalid actions caught before apply
- [ ] Clear error messages for each validation failure
- [ ] Simulation correctly predicts cycle resolution
- [ ] Edge cases handled (empty proposal, circular references in actions)

---

### Phase 3: Frontend Components

#### Task 3.1: Create Resolution Panel Component

- [ ] Create `frontend/src/components/graph/ResolutionPanel.tsx`
- [ ] Implement cycle visualization section
- [ ] Implement context input area
- [ ] Implement intent selector
- [ ] Handle analyze/refine flow

**File**: `frontend/src/components/graph/ResolutionPanel.tsx`

**Component Structure**:

```typescript
interface ResolutionPanelProps {
  cycle: DetectedCycle;
  nodes: GraphNode[];
  edges: GraphEdge[];
  sessionId: string;
  onClose: () => void;
  onResolved: () => void;
}

export function ResolutionPanel({
  cycle,
  nodes,
  edges,
  sessionId,
  onClose,
  onResolved,
}: ResolutionPanelProps) {
  const [phase, setPhase] = useState<
    "input" | "analyzing" | "review" | "applying" | "done"
  >("input");
  const [userContext, setUserContext] = useState("");
  const [intent, setIntent] = useState<ResolutionIntent>("auto");
  const [proposal, setProposal] = useState<ResolutionProposal | null>(null);
  const [refinement, setRefinement] = useState("");

  // ... implementation
}
```

**Pass Criteria**:

- [ ] Panel opens when cycle selected
- [ ] Context input accepts multi-line text
- [ ] Intent selector shows all options
- [ ] Analyze button triggers API call
- [ ] Loading state shown during analysis
- [ ] Error state shown if analysis fails

---

#### Task 3.2: Create Proposal Review Component

- [ ] Create `frontend/src/components/graph/ProposalReview.tsx`
- [ ] Display AI analysis explanation
- [ ] List proposed actions with edit/remove buttons
- [ ] Show before/after graph preview
- [ ] Handle action editing inline

**File**: `frontend/src/components/graph/ProposalReview.tsx`

**Component Structure**:

```typescript
interface ProposalReviewProps {
  proposal: ResolutionProposal;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onEditAction: (actionId: string, changes: Partial<ResolutionAction>) => void;
  onRemoveAction: (actionId: string) => void;
  onRefine: (feedback: string) => void;
  onApply: () => void;
  onCancel: () => void;
}
```

**Pass Criteria**:

- [ ] Shows AI reasoning clearly
- [ ] Each action has edit/remove buttons
- [ ] Before/after preview accurate
- [ ] Refinement input available
- [ ] Apply button disabled if proposal invalid

---

#### Task 3.3: Create Action Editor Components

- [ ] Create `frontend/src/components/graph/resolution/ActionCard.tsx`
- [ ] Create edit dialogs for each action type
- [ ] Support inline editing where possible
- [ ] Validate edits before saving

**Files**:

- `frontend/src/components/graph/resolution/ActionCard.tsx`
- `frontend/src/components/graph/resolution/EditEdgeDialog.tsx`
- `frontend/src/components/graph/resolution/EditNodeDialog.tsx`
- `frontend/src/components/graph/resolution/MergePreview.tsx`

**Pass Criteria**:

- [ ] Action cards show clear description
- [ ] Edit dialog opens on click
- [ ] Changes validated before saving
- [ ] Cancel discards changes
- [ ] Save updates proposal state

---

#### Task 3.4: Create Graph Preview Component

- [ ] Create `frontend/src/components/graph/resolution/GraphPreview.tsx`
- [ ] Show mini graph of affected nodes
- [ ] Visualize before state
- [ ] Visualize after state (with simulated changes)
- [ ] Highlight differences

**File**: `frontend/src/components/graph/resolution/GraphPreview.tsx`

```typescript
interface GraphPreviewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  actions: ResolutionAction[];
  mode: "before" | "after" | "diff";
}
```

**Pass Criteria**:

- [ ] Before shows current state accurately
- [ ] After shows simulated post-apply state
- [ ] Diff highlights changes (added=green, removed=red, modified=yellow)
- [ ] Layout readable for 2-6 nodes

---

#### Task 3.5: Create Resolution Hook

- [ ] Create `frontend/src/components/graph/hooks/useResolution.ts`
- [ ] Manage resolution session state
- [ ] Handle API calls (analyze, refine, apply, undo)
- [ ] Integrate with WebSocket for real-time updates

**File**: `frontend/src/components/graph/hooks/useResolution.ts`

```typescript
interface UseResolutionOptions {
  sessionId: string;
  cycleId: string;
  nodeIds: string[];
  edgeIds: string[];
}

interface UseResolutionReturn {
  // State
  session: ResolutionSession | null;
  proposal: ResolutionProposal | null;
  phase: ResolutionPhase;
  isLoading: boolean;
  error: string | null;

  // Actions
  startSession: () => Promise<void>;
  analyze: (context: string, intent?: ResolutionIntent) => Promise<void>;
  refine: (feedback: string) => Promise<void>;
  editAction: (actionId: string, changes: Partial<ResolutionAction>) => void;
  removeAction: (actionId: string) => void;
  apply: () => Promise<void>;
  undo: () => Promise<void>;
  cancel: () => void;

  // Undo state
  canUndo: boolean;
  undoTimeRemaining: number | null;
}

export function useResolution(
  options: UseResolutionOptions,
): UseResolutionReturn {
  // ... implementation
}
```

**Pass Criteria**:

- [ ] Session created on mount
- [ ] Analyze updates proposal state
- [ ] Refine sends feedback and gets new proposal
- [ ] Apply triggers API and updates graph
- [ ] Undo works within time window
- [ ] WebSocket events update state in real-time

---

#### Task 3.6: Integrate Resolution Panel into UI

- [ ] Add "Resolve with AI" button to CycleIndicator
- [ ] Open ResolutionPanel as side panel or modal
- [ ] Add entry point from NodeInspector (for nodes in cycles)
- [ ] Add entry point from edge context menu

**Files to Update**:

- `frontend/src/components/graph/CycleIndicator.tsx`
- `frontend/src/components/graph/NodeInspector.tsx`
- `frontend/src/components/ideation/GraphTabPanel.tsx`

**Pass Criteria**:

- [ ] Button visible in cycle indicator
- [ ] Panel opens with correct cycle data
- [ ] Multiple entry points all work
- [ ] Panel closes cleanly
- [ ] Graph updates after resolution

---

### Phase 4: Success State & Undo UX

#### Task 4.1: Create Undo Toast Component

- [ ] Create `frontend/src/components/graph/resolution/UndoToast.tsx`
- [ ] Show countdown timer
- [ ] Undo button prominent
- [ ] Auto-dismiss after expiry

**File**: `frontend/src/components/graph/resolution/UndoToast.tsx`

```typescript
interface UndoToastProps {
  message: string;
  undoExpiresAt: string;
  onUndo: () => void;
  onDismiss: () => void;
}
```

**Pass Criteria**:

- [ ] Toast appears after apply
- [ ] Countdown updates every second
- [ ] Undo button works
- [ ] Toast dismisses after expiry
- [ ] Multiple toasts stack correctly

---

#### Task 4.2: Create Resolution History View

- [ ] Add "Resolution History" section to graph panel
- [ ] Show past resolutions with outcomes
- [ ] Allow viewing details of past resolutions

**Pass Criteria**:

- [ ] History loads on panel open
- [ ] Shows resolution summary
- [ ] Can expand to see details
- [ ] Sorted by date descending

---

### Phase 5: Testing

#### Task 5.1: Unit Tests

- [ ] Resolution service tests
- [ ] Action validator tests
- [ ] useResolution hook tests
- [ ] Component tests

**Test Files**:

- `tests/unit/services/resolution-service.test.ts`
- `tests/unit/services/resolution-validators.test.ts`
- `tests/unit/graph/useResolution.test.ts`
- `tests/unit/graph/ResolutionPanel.test.tsx`

**Pass Criteria**:

- [ ] > 80% coverage on new code
- [ ] All happy paths covered
- [ ] All error paths covered
- [ ] Edge cases documented and tested

---

#### Task 5.2: Integration Tests

- [ ] Full resolution flow (input → analyze → review → apply → verify)
- [ ] Refinement flow (analyze → refine → new proposal)
- [ ] Undo flow (apply → undo → verify restored)
- [ ] Multi-client sync via WebSocket

**Test File**: `tests/integration/resolution-flow.test.ts`

```typescript
describe("Resolution Flow Integration", () => {
  it("resolves cycle with edge type change", async () => {
    // Setup: Create cycle
    const session = await createTestSession();
    const nodeA = await createBlock(session.id, { title: "Node A" });
    const nodeB = await createBlock(session.id, { title: "Node B" });
    await createLink(session.id, nodeA.id, nodeB.id, "requires");
    await createLink(session.id, nodeB.id, nodeA.id, "requires");

    // Verify cycle exists
    const cyclesBefore = detectCycles(await getEdges(session.id));
    expect(cyclesBefore.length).toBe(1);

    // Start resolution
    const resolution = await startResolution(session.id, {
      cycleId: cyclesBefore[0].id,
      nodeIds: [nodeA.id, nodeB.id],
    });

    // Analyze
    const proposal = await analyzeResolution(session.id, resolution.id, {
      userContext: "A references B but does not require it",
      intent: "change_type",
    });

    expect(proposal.actions.length).toBeGreaterThan(0);
    expect(proposal.cycleResolved).toBe(true);

    // Apply
    await applyResolution(session.id, resolution.id);

    // Verify cycle resolved
    const cyclesAfter = detectCycles(await getEdges(session.id));
    expect(cyclesAfter.filter((c) => c.type === "blocking").length).toBe(0);
  });

  it("undoes resolution within time window", async () => {
    // ... setup and apply resolution

    // Undo
    const result = await undoResolution(session.id, appliedId);
    expect(result.success).toBe(true);

    // Verify restored
    const cyclesAfterUndo = detectCycles(await getEdges(session.id));
    expect(cyclesAfterUndo.length).toBe(1);
  });

  it("handles merge nodes correctly", async () => {
    // ... test merge flow
  });

  it("handles add abstraction correctly", async () => {
    // ... test abstraction flow
  });
});
```

**Pass Criteria**:

- [ ] All flows pass
- [ ] Tests run in < 60 seconds
- [ ] No flaky tests

---

#### Task 5.3: E2E Tests

- [ ] User can complete full resolution flow in UI
- [ ] Undo toast appears and works
- [ ] Graph canvas updates correctly

**Test File**: `tests/e2e/resolution.spec.ts` (Playwright)

```typescript
test("user resolves cycle with AI assistance", async ({ page }) => {
  // Navigate to session with cycle
  await page.goto("/ideation/test-session");

  // Open cycle indicator
  await page.click('[data-testid="cycle-indicator"]');

  // Click resolve with AI
  await page.click("text=Resolve with AI");

  // Enter context
  await page.fill(
    '[data-testid="resolution-context"]',
    "These nodes reference each other but there is no hard dependency",
  );

  // Click analyze
  await page.click("text=Analyze & Propose");

  // Wait for proposal
  await expect(page.locator('[data-testid="proposal-review"]')).toBeVisible();

  // Verify proposal shows actions
  await expect(page.locator('[data-testid="action-card"]')).toHaveCount({
    min: 1,
  });

  // Apply
  await page.click("text=Apply Changes");

  // Verify undo toast
  await expect(page.locator('[data-testid="undo-toast"]')).toBeVisible();

  // Verify cycle resolved
  await expect(page.locator('[data-testid="cycle-indicator"]')).toContainText(
    "0 Circular",
  );
});
```

**Pass Criteria**:

- [ ] E2E passes consistently
- [ ] Works in Chrome and Firefox
- [ ] Handles slow network

---

## Summary Checklist

### Phase 1: Data Model & API (Foundation)

- [ ] 1.1 Resolution session schema
- [ ] 1.2 Resolution API endpoints
- [ ] 1.3 WebSocket events

### Phase 2: AI Resolution Service (Core Logic)

- [ ] 2.1 Resolution service implementation
- [ ] 2.2 Action validators

### Phase 3: Frontend Components (UI)

- [ ] 3.1 Resolution panel component
- [ ] 3.2 Proposal review component
- [ ] 3.3 Action editor components
- [ ] 3.4 Graph preview component
- [ ] 3.5 useResolution hook
- [ ] 3.6 UI integration

### Phase 4: UX Polish

- [ ] 4.1 Undo toast component
- [ ] 4.2 Resolution history view

### Phase 5: Testing

- [ ] 5.1 Unit tests
- [ ] 5.2 Integration tests
- [ ] 5.3 E2E tests

---

## Definition of Done

- [ ] All tasks completed
- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] UI matches designs
- [ ] Resolution flow works end-to-end
- [ ] Undo works correctly
- [ ] Multiple clients stay in sync
- [ ] Performance acceptable (analyze < 10s, apply < 2s)
- [ ] Code reviewed
- [ ] Documentation updated

---

## Open Questions

1. **LLM Model Choice**: Should we use Claude Sonnet for speed or Claude Opus for quality?
   - Recommendation: Sonnet for initial analysis, with option to "analyze deeper" using Opus

2. **Undo Window Duration**: 30 seconds enough? Too long?
   - Recommendation: 30 seconds default, configurable per user

3. **Multi-User Conflicts**: What if two users try to resolve the same cycle?
   - Recommendation: Lock cycle during active resolution session, show "being resolved by X"

4. **Learning from Resolutions**: Should we train a model on resolution patterns?
   - Recommendation: Log resolutions for analysis, but defer ML until v2
