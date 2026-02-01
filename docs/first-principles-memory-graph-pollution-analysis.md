# Memory Graph Integration: Planning Agent Design

## Concepts Summary

This document captures the complete design for the Planning Agent and Memory Graph integration. Below is every concept discussed, organized by category.

### Core Architecture

| Concept                 | Definition                                                                                        | Key Details                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Planning Agent**      | Renamed from Ideation Agent. Guides the entire product lifecycle, not just idea formation.        | Phases: Planning → Build → Testing → Launch → Distribution → Marketing. Reverse-engineers from each phase to determine what questions to ask now. |
| **Idea Node**           | A single, unique node per idea that serves as the gravitational center of the graph.              | Starts with title "Incubating" until formed. All other nodes must connect to it (directly or transitively). Used for scope drift detection.       |
| **Planning Graph Type** | New graph type (added to existing 17 dimensions). Houses the Idea node and initial questions.     | The ONLY graph type that contains the Idea node. Starting point for all ideas.                                                                    |
| **Graph Query AI**      | Read-only AI interface for querying and managing the graph. Already exists as button in top-left. | Separate from Planning Agent. Does not write to graph. Does not pollute.                                                                          |

### Block & Link System

| Concept                | Definition                                                | Key Details                                                                                                                 |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Block Types**        | 11 canonical types for storing knowledge.                 | `insight`, `decision`, `question`, `fact`, `constraint`, `assumption`, `risk`, `requirement`, `goal`, `metric`, `reference` |
| **Link Types**         | 21 relationship types connecting blocks.                  | Including `constrained_by`, `requires`, `depends_on`, `validates`, `contradicts`, etc.                                      |
| **`anchors` Link**     | Implicit relationship establishing relevance to the Idea. | NOT a new explicit link type. Determined by graph traversal — if a node can reach the Idea through any path, it's anchored. |
| **Question Lifecycle** | Question blocks track their state.                        | When answered, question node remains with `answered` status. Does not transform or disappear.                               |

### Pollution Prevention

| Concept                     | Definition                                                                               | Key Details                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Creation-Time Filtering** | Block extraction filters out irrelevant content before nodes enter the graph. No queue.  | Uses LLM classification (Haiku) to detect: meta-conversation, queries about the tool, comments not related to the idea. Filtered content never enters the graph. |
| **Scope Drift Detection**   | Centered on Idea node. If a proposed node can't path to the Idea, it's flagged as drift. | Algorithm: 1) New block proposed, 2) Traverse toward Idea, 3) No path = reject or ask user for clarification.                                                    |
| **Path-to-Idea Check**      | Validation that all nodes relate to the Idea.                                            | Uses existing link traversal. No new link type needed. Orphaned nodes = irrelevant content.                                                                      |

### Agent Behaviors

| Concept                     | Definition                                                      | Key Details                                                                                                              |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Lifecycle Awareness**     | Agent knows what each phase (build, test, launch) needs.        | Can ask questions that span multiple phases. Knows dependencies between phases.                                          |
| **Question Prioritization** | Agent determines which questions to ask first.                  | Based on: dependency analysis, downstream impact, reverse engineering from build goals, current graph gaps.              |
| **Question Generation**     | Agent creates new questions proactively.                        | Generates questions user hasn't thought of. Based on what's needed for each lifecycle phase.                             |
| **Scope Definition**        | Agent forces scope decisions early.                             | Before feature questions, asks scope questions. Prevents wasted effort on wrong direction.                               |
| **Drift Warning**           | Agent detects when user steers away from established decisions. | Shows impact analysis: how many blocks affected, what changes required. Offers: Continue, Keep original, Start new idea. |
| **Pivot Proposal**          | When changes are too large, agent suggests fresh start.         | Fork flow with option to copy relevant blocks. Preview shows orphaned links.                                             |

### Existing Code Behaviors (From Analysis)

| Concept                 | Location                                             | How It Works                                                                                                                      |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Candidate Creation**  | `orchestrator.ts`, `candidate-manager.ts`            | Agent autonomously creates candidate when it includes `candidateUpdate.title` in response. No threshold in code — Claude decides. |
| **Candidate Lifecycle** | `candidate-manager.ts`                               | `Creating → active → [captured / saved / discarded]`. Only `active` or `forming` appear in UI.                                    |
| **Scope Storage**       | `memory-block-type.ts`, `graph-analysis-subagent.ts` | Stored as `decision`/`constraint` blocks with `validated` status. Confidence 0.6+ = established.                                  |
| **Drift Detection**     | `graph-analysis-subagent.ts`                         | Uses `contradiction-scan`, `cascade-detection`, `stale-detection`.                                                                |

### UI Decisions

| Concept                  | Decision                                                                   | Rationale                                     |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------- |
| **Layout**               | Chat + graph side by side from start. No transition.                       | Graph always visible. No separate states.     |
| **Graph Distribution**   | Part of existing filter panel. Just `%` next to checkboxes. No bars.       | Unified UI. Not a separate bottom section.    |
| **Starting Screen**      | Idea node with "Incubating" title + first question node in Planning graph. | Immediate visual feedback.                    |
| **User Agency**          | Dismissable suggestions.                                                   | Balance guidance with control.                |
| **Fork Handling**        | Preview with orphan highlighting (red).                                    | Transparency before copying.                  |
| **Return After Absence** | Recap message after 7+ days.                                               | Context restoration.                          |
| **Mobile**               | Chat-first with tabs for graph.                                            | Matches mobile model.                         |
| **Accessibility**        | WCAG 2.1 AA compliance.                                                    | Keyboard nav, screen reader, colorblind-safe. |

### Open Decisions

| Area                       | Options Considered                                       | Recommendation                       | Status      |
| -------------------------- | -------------------------------------------------------- | ------------------------------------ | ----------- |
| **`anchors` as link type** | A) Explicit new link, B) Implicit via traversal, C) Both | **B: Implicit** — see analysis below | Recommended |

---

## The Idea Node: Central Anchor

### Definition

The **Idea** is a singular, unique node that serves as the gravitational center of the entire memory graph. Every idea can only have ONE Idea node.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   THE IDEA NODE                                                                 │
│   ─────────────                                                                 │
│                                                                                 │
│   An Idea is NOT:                          An Idea IS:                          │
│   ──────────────                           ──────────                           │
│                                                                                 │
│   • A node group (too broad)               • A single, unique node              │
│   • A collection (too vague)               • The gravitational center           │
│   • A category (too organizational)        • The scope anchor                   │
│   • A container (too structural)           • The drift detector                 │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │                           ┌───────────┐                                 │   │
│   │                           │           │                                 │   │
│   │        problem ●──────────│   IDEA    │──────────● solution             │   │
│   │                  \        │  (ONE)    │        /                        │   │
│   │        market ●───────────│           │───────────● user                │   │
│   │                      \    └───────────┘    /                            │   │
│   │        spec ●─────────────────│   │───────────────● validation          │   │
│   │                               │   │                                     │   │
│   │        business ●─────────────┘   └───────────────● distribution        │   │
│   │                                                                         │   │
│   │   ALL nodes connect to the Idea (directly or transitively)              │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Idea Node Properties

| Property            | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Uniqueness**      | Exactly 1 per idea — enforced at schema level                          |
| **Required fields** | `title`, `one_liner` (the elevator pitch)                              |
| **Initial state**   | Title = "Incubating" until agent forms the idea                        |
| **Formed when**     | Agent includes `candidateUpdate.title` with actual name                |
| **Connection type** | Implicit `anchors` via graph traversal (not explicit link)             |
| **Traversal**       | All paths in graph should terminate at Idea node (validates relevance) |

### The `anchors` Relationship (Analysis)

How should we determine if a node is "anchored" to the Idea?

| Option                        | How It Works                                                                              | Pros                                                          | Cons                                                                                    | Long-term                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| **A: Explicit new link type** | Add `anchors` as 22nd link type. Every node gets explicit link to Idea.                   | Clear, queryable, easy validation                             | Every node needs this link (redundant), visual clutter (star graph), maintenance burden | Poor — creates noise           |
| **B: Implicit via traversal** | Infer anchoring by traversing existing links. If any path reaches Idea, node is anchored. | No additional links, uses natural relationships, less clutter | More expensive to compute, harder to query directly                                     | Good — matches graph semantics |
| **C: Both**                   | Explicit for direct connections, implicit for transitive.                                 | Flexibility                                                   | Inconsistency, confusing mental model, complexity                                       | Poor — worst of both           |

**Recommendation: B (Implicit via traversal)**

Reasoning:

- The purpose of "anchors" is scope drift detection, not visualization
- Graph traversal is a background computation, not user-facing
- Existing links already show how nodes relate semantically
- Adding explicit anchors creates a star graph (everything pointing to center) — visual noise
- Orphan detection via traversal is cleaner: "can this node reach the Idea through any path?"

---

### Scope Drift Detection (Centered on Idea)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   SCOPE DRIFT = CAN'T REACH THE IDEA                                            │
│   ──────────────────────────────────                                            │
│                                                                                 │
│   When new content is proposed, the system asks:                                │
│   "Can this node reach the Idea through any path?"                              │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │       ● problem ──────┐                                                 │   │
│   │                       │                                                 │   │
│   │       ● solution ─────┼────── ◉ IDEA ← Everything reaches here          │   │
│   │                       │                                                 │   │
│   │       ● market ───────┘                                                 │   │
│   │                                                                         │   │
│   │                                                                         │   │
│   │       ● "How does Claude work?" ─────── ✗ NO PATH TO IDEA              │   │
│   │         (meta-conversation)               ↓                             │   │
│   │                                      FILTERED OUT                       │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   Detection algorithm (at block creation time):                                 │
│   1. New block proposed from conversation/artifact                              │
│   2. LLM classifies: idea-relevant vs meta-conversation                         │
│   3. Check if block can path to Idea (via proposed links)                       │
│   4. If no path AND classified as meta → reject silently                        │
│   5. If no path BUT seems idea-relevant → ask user for clarification            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pollution Prevention (Creation-Time Filtering)

### The Approach

Instead of a queue where users accept/reject proposed nodes, we filter at creation time. Irrelevant content never enters the graph.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   CREATION-TIME FILTERING                                                       │
│   ───────────────────────                                                       │
│                                                                                 │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│   │                 │     │                 │     │                 │          │
│   │  Conversation   │────▶│  Block          │────▶│  Filter         │──┬──▶ Graph
│   │  or Artifact    │     │  Extraction     │     │  (Haiku + Path) │  │       │
│   │                 │     │                 │     │                 │  │       │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘  │       │
│                                                                        │       │
│                                                            ┌───────────┘       │
│                                                            ▼                   │
│                                                   ┌─────────────────┐          │
│                                                   │   Rejected      │          │
│                                                   │   (discarded)   │          │
│                                                   └─────────────────┘          │
│                                                                                 │
│   Filter criteria:                                                              │
│   ──────────────────                                                            │
│   REJECT if ANY of:                                                             │
│   • LLM classifies as meta-conversation (about the tool, not the idea)          │
│   • LLM classifies as generic query/question not producing insight              │
│   • Proposed block has no path to Idea (can't establish relevance)              │
│   • Content is a comment/reaction without substantive insight                   │
│                                                                                 │
│   ACCEPT if ALL of:                                                             │
│   • LLM classifies as idea-relevant                                             │
│   • Block can path to Idea (directly or through proposed links)                 │
│   • Content produces actionable insight, decision, fact, etc.                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Planning Graph Type

A new graph type (18th dimension) that houses the initial planning questions and the Idea node.

### Planning Graph Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   PLANNING GRAPH TYPE                                                           │
│   ───────────────────                                                           │
│                                                                                 │
│   Purpose: Starting point for all ideas                                         │
│                                                                                 │
│   Contains:                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                         │   │
│   │   ◉ IDEA NODE (the one and only)                                        │   │
│   │     │                                                                   │   │
│   │     └── Initial questions (block type: question)                        │   │
│   │           • "What problem are you most passionate about solving?"       │   │
│   │           • "Who experiences this problem most acutely?"                │   │
│   │           • "What does success look like in 6 months?"                  │   │
│   │                                                                         │   │
│   │   The Planning graph is the ONLY graph type that contains the Idea      │   │
│   │                                                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   Relationship to other graphs:                                                 │
│                                                                                 │
│   ┌──────────┐                                                                  │
│   │ PLANNING │──┬──▶ Problem                                                    │
│   │   ◉ IDEA │  ├──▶ Solution                                                   │
│   │          │  ├──▶ Market                                                     │
│   └──────────┘  ├──▶ User                                                       │
│                 ├──▶ Spec                                                       │
│                 └──▶ etc...                                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## The Planning Agent

The Planning Agent guides the **entire product lifecycle** — from idea formation through build, launch, and beyond.

### Evolution from Ideation Agent

```
OLD IDEATION AGENT                    PLANNING AGENT
──────────────────                    ───────────────────────

Focus: Idea formation                 Focus: Entire lifecycle
       ↓                                     ↓
┌─────────────────┐                   ┌─────────────────────────────────────┐
│                 │                   │                                     │
│  • What's the   │                   │  PLANNING    → What's the idea?     │
│    problem?     │                   │  BUILD       → What's the spec?     │
│  • Who's the    │                   │  TESTING     → How do we validate?  │
│    customer?    │                   │  LAUNCH      → How do we ship?      │
│  • What's the   │                   │  DISTRIBUTION→ How do we reach?     │
│    solution?    │                   │  MARKETING   → How do we position?  │
│                 │                   │                                     │
│  [Done when     │                   │  [Guides entire journey, knows what │
│   idea formed]  │                   │   each phase needs from previous]   │
│                 │                   │                                     │
└─────────────────┘                   └─────────────────────────────────────┘
```

### Core Behaviors

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   REVERSE ENGINEERING ACROSS THE FULL LIFECYCLE                                 │
│   ─────────────────────────────────────────────                                 │
│                                                                                 │
│   The agent thinks backwards from each phase:                                   │
│                                                                                 │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│   │ PLANNING │→│  BUILD   │→│ TESTING  │→│  LAUNCH  │→│  DISTRO  │→│MARKETING│ │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│        │            │            │            │            │            │      │
│        ▼            ▼            ▼            ▼            ▼            ▼      │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐  │
│   │problem  │  │spec     │  │validation│  │product  │  │distribu-│  │market- │  │
│   │solution │  │tasks    │  │fit      │  │business │  │tion     │  │ing     │  │
│   │market   │  │         │  │         │  │         │  │         │  │        │  │
│   │user     │  │         │  │         │  │         │  │         │  │        │  │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └────────┘  │
│        ↑            ↑            ↑            ↑            ↑            ↑      │
│        └────────────┴────────────┴────────────┴────────────┴────────────┘      │
│                                                                                 │
│                         GRAPH TYPES (dimensions)                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### What The Planning Agent Does

| Capability                    | How It Works                                                  |
| ----------------------------- | ------------------------------------------------------------- |
| **Lifecycle awareness**       | Knows what each phase (build, test, launch, etc.) needs       |
| **Graph-type aware**          | Knows which dimensions need filling for each phase            |
| **Determines priority**       | Identifies which questions block downstream decisions         |
| **Creates new questions**     | Generates questions the user hasn't thought of yet            |
| **Proactively defines scope** | Forces scope decisions EARLY before wasted effort             |
| **Warns on drift**            | Detects when user is steering away from established decisions |
| **Proposes pivots**           | When changes are too large, suggests fresh start              |

---

## UI Design

### Starting Screen (New Conversation)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Idea Incubator                              Select an idea...  ▼    Context 0% │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌────────────────────┐ ┌──────────────────────────────────────┐ ┌────────────┐ │
│ │ CHAT               │ │         MEMORY GRAPH                 │ │ ARTIFACTS ▶│ │
│ │                    │ │                                      │ │            │ │
│ │ 🤖 What problem    │ │ ┌────────────────────────────────┐   │ │            │ │
│ │ are you most       │ │ │ 🔍 Query               [Filters]│   │ │            │ │
│ │ passionate about   │ │ └────────────────────────────────┘   │ │            │ │
│ │ solving?           │ │                                      │ │            │ │
│ │                    │ │                                      │ │            │ │
│ │                    │ │      ┌─────────────────────┐         │ │            │ │
│ │                    │ │      │                     │         │ │            │ │
│ │                    │ │      │  ◉ "Incubating"     │         │ │            │ │
│ │                    │ │      │     (Idea node)     │         │ │            │ │
│ │                    │ │      │                     │         │ │            │ │
│ │                    │ │      └──────────┬──────────┘         │ │            │ │
│ │                    │ │                 │                    │ │            │ │
│ │                    │ │      ┌──────────┴──────────┐         │ │            │ │
│ │                    │ │      │                     │         │ │            │ │
│ │                    │ │      │  ❓ "What problem   │         │ │            │ │
│ │                    │ │      │  are you most       │         │ │            │ │
│ │                    │ │      │  passionate about   │         │ │            │ │
│ │                    │ │      │  solving?"          │         │ │            │ │
│ │                    │ │      │                     │         │ │            │ │
│ │                    │ │      └─────────────────────┘         │ │            │ │
│ │                    │ │                                      │ │            │ │
│ │ ┌────────────────┐ │ │                                      │ │            │ │
│ │ │ [Input...]     │ │ │                                      │ │            │ │
│ │ └────────────────┘ │ │                                      │ │            │ │
│ └────────────────────┘ └──────────────────────────────────────┘ └────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### After Idea Forms (Graph Populated)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  BFRB Companion App                                             Context 34%     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌────────────────────┐ ┌──────────────────────────────────────┐ ┌────────────┐ │
│ │ ◀ CHAT             │ │         MEMORY GRAPH                 │ │ ARTIFACTS ▶│ │
│ │                    │ │                                      │ │            │ │
│ │ ┌────────────────┐ │ │ ┌────────────────────────────────┐   │ │            │ │
│ │ │ 🤖 Before we   │ │ │ │ 🔍 Query               [Filters]│   │ │            │ │
│ │ │ dive into      │ │ │ └────────────────────────────────┘   │ │            │ │
│ │ │ features, we   │ │ │                                      │ │            │ │
│ │ │ need to nail   │ │ │       ●═══════●                      │ │            │ │
│ │ │ down scope.    │ │ │      ╱ Problem ╲                     │ │            │ │
│ │ │                │ │ │     ●    Gap    ●───●                │ │            │ │
│ │ │ ⚠️ SCOPE       │ │ │     │           │   │                │ │            │ │
│ │ │ QUESTION:      │ │ │     ●───●───────●   ●                │ │            │ │
│ │ │                │ │ │      Solution     Market             │ │            │ │
│ │ │ Are we         │ │ │                                      │ │            │ │
│ │ │ building for:  │ │ │                                      │ │            │ │
│ │ │                │ │ │                                      │ │            │ │
│ │ │ [Self-guided]  │ │ │                                      │ │            │ │
│ │ │ [Therapist-    │ │ │                                      │ │            │ │
│ │ │  supported]    │ │ │                                      │ │            │ │
│ │ │ [Both]         │ │ │                                      │ │            │ │
│ │ │                │ │ │                                      │ │            │ │
│ │ └────────────────┘ │ │                                      │ │            │ │
│ │                    │ │                                      │ │            │ │
│ │ ┌────────────────┐ │ │                                      │ │            │ │
│ │ │ [Input...]     │ │ │                                      │ │            │ │
│ │ └────────────────┘ │ │                                      │ │            │ │
│ └────────────────────┘ └──────────────────────────────────────┘ └────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Graph Distribution in Filters (Expanded)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FILTERS                                                                    │
│ ────────────────────────────────────────────────────────────────────────── │
│                                                                            │
│ GRAPH TYPE                                BLOCK TYPE                       │
│ ──────────                                ──────────                       │
│ ☑ Planning     15%                        ☑ insight     40%                │
│ ☑ Problem      25%                        ☑ decision    20%                │
│ ☑ Solution     20%                        ☑ question    15%                │
│ ☑ Market       15%                        ☑ fact        10%                │
│ ☑ User         10%                        ☑ constraint   8%                │
│ ☐ Spec          5%                        ☑ assumption   5%                │
│ ☐ Validation    5%                        ☐ risk         2%                │
│ ☐ Business      5%                                                         │
│                                                                            │
│ STATUS                                    CONFIDENCE                       │
│ ──────                                    ──────────                       │
│ ☑ Active                                  ○ All                            │
│ ☑ Validated                               ○ High (0.8+)                    │
│ ☐ Stale                                   ● Medium+ (0.6+)                 │
│ ☐ Archived                                ○ Any                            │
│                                                                            │
│                                      [Reset]  [Apply]                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Drift Detection & Pivot Warning

When user says something that conflicts with established scope:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  LEFT PANEL CHAT                                                               │
│  ───────────────                                                               │
│                                                                                │
│  👤 Actually, I think we should also support therapists managing               │
│     multiple patients...                                                       │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠️  SCOPE SHIFT DETECTED                                                 │  │
│  │                                                                          │  │
│  │ You previously decided: "Self-guided app for individual users"           │  │
│  │                                                                          │  │
│  │ Adding therapist management would require:                               │  │
│  │                                                                          │  │
│  │   • Multi-user architecture (affects 12 spec blocks)                     │  │
│  │   • HIPAA compliance considerations (new risk dimension)                 │  │
│  │   • B2B sales strategy (changes distribution blocks)                     │  │
│  │   • Different MVP scope (delays launch significantly)                    │  │
│  │                                                                          │  │
│  │ ┌────────────────────────────────────────────────────────────────────┐   │  │
│  │ │  [Continue with change]  [Keep original scope]  [Start new idea]  │   │  │
│  │ └────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### "Start New Idea" Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│                         START NEW IDEA                                         │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                          │  │
│  │  Your current idea: "BFRB Companion App"                                 │  │
│  │  Will be saved and preserved.                                            │  │
│  │                                                                          │  │
│  │  New idea name:                                                          │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐    │  │
│  │  │ BFRB Therapist Platform                                          │    │  │
│  │  └──────────────────────────────────────────────────────────────────┘    │  │
│  │                                                                          │  │
│  │  ○ Start fresh (empty graph)                                             │  │
│  │  ● Fork from current (copy relevant blocks)                              │  │
│  │                                                                          │  │
│  │  Blocks to copy:                                                         │  │
│  │  ☑ Problem insights (8 blocks)                                           │  │
│  │  ☑ Market research (5 blocks)                                            │  │
│  │  ☐ Solution decisions (would conflict)                                   │  │
│  │  ☐ Spec requirements (would conflict)                                    │  │
│  │                                                                          │  │
│  │                              [Cancel]  [Create New Idea →]               │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Question Surfacing In Chat

The Planning Agent surfaces questions directly in the conversation:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  LEFT PANEL CHAT                                                               │
│  ───────────────                                                               │
│                                                                                │
│  🤖 Based on what you've described, here's what I need to understand           │
│     before we can move forward:                                                │
│                                                                                │
│     ┌────────────────────────────────────────────────────────────────────┐     │
│     │ 📋 PRIORITY QUESTIONS                              [Why these? ↗]  │     │
│     │ ─────────────────────────────────────────────────────────────────  │     │
│     │                                                                    │     │
│     │ 1. SCOPE (blocks everything else)                                  │     │
│     │    Who is the primary user: individual or therapist?               │     │
│     │                                                                    │     │
│     │ 2. VALIDATION (affects feasibility)                                │     │
│     │    How severe is the problem for your target user?                 │     │
│     │                                                                    │     │
│     │ 3. DIFFERENTIATION (affects positioning)                           │     │
│     │    What makes in-the-moment intervention 10x better than tracking? │     │
│     │                                                                    │     │
│     └────────────────────────────────────────────────────────────────────┘     │
│                                                                                │
│     Let's start with #1. Are we building for individuals managing their        │
│     own condition, or for therapists helping patients?                         │
│                                                                                │
│     [For individuals]  [For therapists]  [Both - explain trade-offs]           │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Summary

### Left Panel: Planning Agent

```
┌────────────────────┐
│ ◀ CHAT             │
├────────────────────┤
│                    │
│  Conversation      │
│  history           │
│                    │
│  ─────────────     │
│                    │
│  🤖 Planning Agent │  ← Guides full lifecycle
│  prompts with      │  ← Surfaces priority questions
│  strategic         │  ← Warns on scope drift
│  questions         │  ← Creates new questions
│                    │  ← Knows what each phase needs
│  [Buttons/options] │
│                    │
├────────────────────┤
│ [Input area]       │
└────────────────────┘
```

### Center Panel: Memory Graph

```
┌────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────┐ │
│ │ 🔍 Query: "find assumptions"         [Filters] │ │  ← Graph Query AI (read-only)
│ └────────────────────────────────────────────────┘ │    ← Distribution % in filters
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │                                                │ │
│ │            INTERACTIVE GRAPH                   │ │  ← reagraph canvas
│ │                                                │ │
│ │     Nodes, edges, clusters, zoom, pan          │ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Two AI Interfaces Summary

| Feature               | Planning Agent (Left)                              | Graph Query AI (Center)              |
| --------------------- | -------------------------------------------------- | ------------------------------------ |
| **Purpose**           | Full lifecycle guidance: planning → build → launch | Graph navigation, search, management |
| **Graph access**      | Writes (extracts)                                  | Reads only                           |
| **Lifecycle aware**   | Yes - knows what each phase needs                  | No                                   |
| **Creates questions** | Yes - proactively, for all phases                  | No                                   |
| **Warns on drift**    | Yes - with impact analysis                         | No                                   |
| **Can propose pivot** | Yes - new idea flow                                | No                                   |
| **Pollution risk**    | Mitigated (filtered at creation time)              | None                                 |

---

## Planning Agent Intelligence

### How It Prioritizes

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   QUESTION PRIORITIZATION LOGIC                                                 │
│   ─────────────────────────────                                                 │
│                                                                                 │
│   1. DEPENDENCY ANALYSIS                                                        │
│      Which questions block other questions?                                     │
│      → Scope questions come before feature questions                            │
│      → Customer questions come before pricing questions                         │
│                                                                                 │
│   2. DOWNSTREAM IMPACT                                                          │
│      How many graph nodes would change if this answer changes?                  │
│      → High impact = ask early                                                  │
│      → Low impact = can defer                                                   │
│                                                                                 │
│   3. REVERSE ENGINEERING                                                        │
│      What does the build agent need to know?                                    │
│      What does the spec agent need to know?                                     │
│      → Work backwards from "ship" to "now"                                      │
│                                                                                 │
│   4. CURRENT GAPS                                                               │
│      Which graph dimensions are underpopulated?                                 │
│      → If 0% spec blocks, don't ask spec questions yet                          │
│      → If 0% problem blocks, start there                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## How Existing Systems Work (From Code Analysis)

### Candidate Creation (How "Idea Forms")

**Location**: `agents/ideation/orchestrator.ts`, `agents/ideation/candidate-manager.ts`

The agent autonomously creates a candidate when it includes `candidateUpdate.title` in its response. No threshold enforced by code — Claude decides based on conversation quality.

**Candidate Status Lifecycle**:

```
Creating → active → [captured | saved | discarded]
```

Only `active` or `forming` candidates appear in UI.

---

### Scope Storage (How Drift Is Detected)

**Location**: `schema/entities/memory-block-type.ts`, `agents/ideation/graph-analysis-subagent.ts`

Scope is stored as:

- **Block type**: `decision` or `constraint`
- **Block status**: `validated` = established scope, `active` = working scope
- **Links**: `constrained_by`, `requires`, `depends_on` create boundaries
- **Confidence**: 0.6+ threshold for "established" decisions

**Drift detection** uses:

- `contradiction-scan`: Claude finds contradictions between blocks
- `cascade-detection`: When a decision changes, finds all dependent blocks
- `stale-detection`: Identifies derived blocks whose source changed

---

## Solutions with Pros/Cons

### 1. Graph Distribution Bar — Making It Actionable

| Option                  | How It Works                                  | Pros                | Cons                | Long-term       |
| ----------------------- | --------------------------------------------- | ------------------- | ------------------- | --------------- |
| **A: Keep percentages** | Just show %                                   | Simple              | Not actionable      | Dead UI element |
| **B: Click to filter**  | Click dimension → filter graph                | Interactive         | Adds clicks         | Medium value    |
| **C: Click to ask**     | Click dimension → agent asks related question | Directly actionable | Couples UI to agent | High value      |
| **D: Show gaps**        | "Missing: first customer, pricing model"      | Highly actionable   | More complex        | Highest value   |

**Recommendation**: **D (show gaps)**. Percentages are vanity; gaps are actionable.

---

### 2. User Agency — Guided vs Open Mode

| Option               | How It Works                               | Pros        | Cons                   | Long-term          |
| -------------------- | ------------------------------------------ | ----------- | ---------------------- | ------------------ |
| **A: Always guided** | Agent always drives                        | Consistent  | Constrains power users | May lose users     |
| **B: Mode toggle**   | User chooses mode                          | Flexibility | Complexity             | Maintenance burden |
| **C: Adaptive**      | Starts guided, opens as user takes control | Natural     | Harder to implement    | Best UX            |
| **D: Dismissable**   | Agent suggests, all dismissable            | Balanced    | May feel naggy         | Good middle ground |

**Recommendation**: **D (dismissable)** short-term, **C (adaptive)** long-term.

---

### 3. Fork/New Idea — Handling Orphaned Links

| Option                     | How It Works                         | Pros         | Cons          | Long-term             |
| -------------------------- | ------------------------------------ | ------------ | ------------- | --------------------- |
| **A: Auto-include linked** | If copying A, include linked B       | No orphans   | Loses control | May copy too much     |
| **B: Drop orphans**        | Silent removal                       | Simple       | Data lost     | Integrity risk        |
| **C: Preview**             | Show forked graph, highlight orphans | Transparency | More UI       | Best for decisions    |
| **D: Ask per orphan**      | "Copy B too?"                        | Explicit     | Tedious       | Good for small graphs |

**Recommendation**: **C (preview)** with orphans in red.

---

### 4. Return After Long Absence

| Option                     | How It Works                           | Pros            | Cons          | Long-term             |
| -------------------------- | -------------------------------------- | --------------- | ------------- | --------------------- |
| **A: No handling**         | Resume as-is                           | Simple          | User lost     | Poor experience       |
| **B: Recap message**       | Agent summarizes: decisions, questions | Helpful         | Adds latency  | Good default          |
| **C: Recap + stale check** | B + flag stale decisions               | Proactive       | May overwhelm | Best for active ideas |
| **D: Timeline view**       | Visual history                         | Full visibility | Major UI      | Premium feature       |

**Recommendation**: **B (recap)** after 7+ days absence.

---

### 5. Mobile/Responsive Layout

| Option                   | How It Works               | Pros                 | Cons              | Long-term         |
| ------------------------ | -------------------------- | -------------------- | ----------------- | ----------------- |
| **A: Not supported**     | Desktop only               | No effort            | Limits audience   | Dead end          |
| **B: Tab navigation**    | One panel at a time        | Familiar             | Context switching | Acceptable        |
| **C: Chat-first**        | Chat primary, graph in tab | Matches mobile model | Graph secondary   | Good              |
| **D: Responsive panels** | Panels stack/collapse      | Fluid                | Complex           | Best if done well |

**Recommendation**: **C (chat-first)** with **B (tabs)** for graph.

---

### 6. Accessibility

| Requirement            | Priority | Implementation                            |
| ---------------------- | -------- | ----------------------------------------- |
| Keyboard nav for graph | High     | Arrow keys between nodes, Enter to select |
| Screen reader          | High     | ARIA labels, announce changes             |
| Colorblind-safe        | High     | Shapes + colors, not color alone          |
| High contrast          | Medium   | Respect system prefs                      |
| Reduced motion         | Medium   | Honor prefers-reduced-motion              |

**Target**: WCAG 2.1 AA compliance.

---

## Final Decisions

| Area                     | Decision                                            | Rationale                            |
| ------------------------ | --------------------------------------------------- | ------------------------------------ |
| **Idea node**            | Single unique node per idea, starts as "Incubating" | Scope anchor, drift detection center |
| **Anchors relationship** | Implicit via graph traversal (not explicit link)    | Avoids visual clutter, natural       |
| **Scope drift**          | Path-to-Idea traversal check                        | If can't reach Idea = drift          |
| **Pollution prevention** | Creation-time filtering (Haiku + path check)        | No queue, clean graph                |
| **Graph distribution**   | Part of filters, just % next to checkboxes          | Unified UI, no bars                  |
| **Starting state**       | Planning graph with Idea ("Incubating") + question  | Immediate visual feedback            |
| **Planning graph type**  | New graph type housing Idea + initial questions     | Central anchor location              |
| **Question lifecycle**   | Answered questions remain with `answered` status    | Preserve history                     |
| **Start state**          | Chat + graph side by side, no transition            | Always visible                       |
| **User agency**          | Dismissable suggestions                             | Balance guidance with control        |
| **Fork handling**        | Preview with orphan highlighting                    | Transparency                         |
| **Return after absence** | Recap after 7+ days                                 | Context restoration                  |
| **Mobile**               | Chat-first with tabs                                | Matches mobile model                 |
| **Accessibility**        | WCAG 2.1 AA                                         | Inclusive design                     |

---

_Design ready for implementation._
