# Agentic Loop Framework for Vibe

## Design Principle

**Deterministic by default. AI only where logic cannot.**

The system should be predictable, auditable, and debuggable. AI handles reasoning and synthesis; everything else is code.

---

## Part 1: Why Each Component

Before listing tools, the question is: what problems actually need solving?

| Problem                              | Why It Exists                               | What Solves It                                           |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------- |
| Store relationships between concepts | Decisions link to requirements link to code | Graph storage (Neo4j or well-designed relational schema) |
| Store operational state              | Tasks, sessions, audit logs need ACID       | Relational database (Postgres)                           |
| Agent execution                      | Need to call LLMs with typed outputs        | Agent framework (Pydantic AI)                            |
| Multi-step workflows                 | Some tasks have multiple stages with state  | State machine (LangGraph or custom)                      |
| Debugging                            | Need to see what agents did and why         | Observability (Langfuse)                                 |

**The honest question:** Do we need both Neo4j AND Postgres?

If graph traversal is simple (2-3 hops, known patterns), Postgres with good schema design works. Neo4j adds value only when:

- Traversal patterns are complex and variable
- You need to discover relationships you didn't anticipate
- Performance on deep traversal matters

**Decision for now:** Start with Postgres only. Add Neo4j if traversal becomes a bottleneck. This reduces complexity.

**Simplified stack:**

- Postgres (all data)
- Pydantic AI (agents)
- Langfuse (observability)

Everything else is optional until proven necessary.

---

## Part 2: The Missing Piece - Chat as Entry Point

The previous version showed "events" triggering the loop but didn't show where events come from. The primary entry point is a conversation.

### How a Chat Becomes an Action

```
User sends message
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                    INTENT AGENT (AI)                    │
│                                                         │
│  "What is the user trying to do?"                       │
│                                                         │
│  Possible intents:                                      │
│  - Request: "Build X" → Create task                     │
│  - Question: "How does Y work?" → Query graph           │
│  - Feedback: "This is slow" → Create improvement ticket │
│  - Exploration: "What if we..." → Start reasoning chain │
│  - Approval: "Yes, do it" → Approve pending proposal    │
│  - Rejection: "No, not that" → Reject pending proposal  │
│                                                         │
│  Output: Structured intent with parameters              │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                 INTENT ROUTER (DETERMINISTIC)           │
│                                                         │
│  intent.type == "request" → TaskCreator                 │
│  intent.type == "question" → GraphQuery                 │
│  intent.type == "feedback" → FeedbackProcessor          │
│  intent.type == "exploration" → ReasoningChain          │
│  intent.type == "approval" → ApprovalHandler            │
│  intent.type == "rejection" → RejectionHandler          │
│                                                         │
│  Pure lookup. No AI needed.                             │
└─────────────────────────────────────────────────────────┘
       │
       ▼
   [Deterministic processing continues...]
```

**The key insight:** The ONLY AI step at the entry point is intent detection. Once we know the intent, everything else is deterministic routing and data operations.

### What the Intent Agent Outputs

The intent agent doesn't just classify. It extracts structured parameters that the deterministic system needs.

For a request intent:

- What is being requested (description)
- Related existing concepts (IDs if mentioned, or search terms to find them)
- Urgency signals
- Constraints mentioned

For a question intent:

- What is being asked about (topic)
- What type of answer is expected (explanation, list, status)
- Related context from the conversation

For feedback intent:

- What is the feedback about (component, feature, behavior)
- Sentiment (positive, negative, neutral)
- Whether it implies action needed

This structured output feeds directly into deterministic handlers.

---

## Part 3: The Self-Evolving System

The previous version described a system that responds to events. But you want a system that **proactively improves itself**. This requires:

1. A north star (what are we building toward?)
2. Gap detection (where are we vs where we should be?)
3. Proposal generation (what should we do about the gaps?)
4. Human approval (do we actually do it?)
5. Execution (do the approved work)
6. Learning (get better at proposing)

### The North Star

The system needs a reference point to know what "better" means. Without it, it's just reacting to problems, not progressing toward a goal.

**What a north star contains:**

- Vision: What does success look like?
- Current capabilities: What can the system do now?
- Target capabilities: What should it be able to do?
- Constraints: What must always be true (security, performance, etc.)?
- Priorities: When capabilities conflict, which wins?

**Where the north star lives:**

- Stored in the knowledge graph as first-class nodes
- Linked to requirements, decisions, and current state
- Updated when vision changes (user edits, not agent)
- Read-only for agents (they propose changes, don't make them)

### The Proactive Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         THE PROACTIVE IMPROVEMENT LOOP                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SCHEDULED ANALYSIS (Daily/Weekly)                │   │
│  │                                                                      │   │
│  │  Triggers: Cron schedule, significant state change, user request    │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONTEXT ASSEMBLY (DETERMINISTIC)                 │   │
│  │                                                                      │   │
│  │  Load:                                                               │   │
│  │  - North star (vision, targets, constraints, priorities)            │   │
│  │  - Current state (what exists, what works, what doesn't)            │   │
│  │  - Recent activity (what changed, what was attempted)               │   │
│  │  - Previous proposals (what was approved, rejected, and why)        │   │
│  │  - Drift alerts (inconsistencies detected)                          │   │
│  │                                                                      │   │
│  │  All by ID lookup. No AI.                                           │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     GAP ANALYSIS AGENT (AI)                          │   │
│  │                                                                      │   │
│  │  Given north star and current state:                                 │   │
│  │  - What capabilities are missing?                                    │   │
│  │  - What existing capabilities are broken or degraded?                │   │
│  │  - What is no longer needed (should be decommissioned)?              │   │
│  │  - What could be improved (performance, UX, maintainability)?        │   │
│  │                                                                      │   │
│  │  Output: Ranked list of gaps with rationale                          │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PROPOSAL GENERATOR AGENT (AI)                    │   │
│  │                                                                      │   │
│  │  For each significant gap:                                           │   │
│  │  - What type of change addresses it? (feature, fix, improvement,    │   │
│  │    decommission)                                                     │   │
│  │  - What is the proposed change?                                      │   │
│  │  - What is the expected impact?                                      │   │
│  │  - What are the risks?                                               │   │
│  │  - What dependencies exist?                                          │   │
│  │  - What is the estimated scope? (small, medium, large)               │   │
│  │                                                                      │   │
│  │  Output: Structured proposals with rationale                         │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PROPOSAL STORAGE (DETERMINISTIC)                 │   │
│  │                                                                      │   │
│  │  Store proposals with status "pending_review"                        │   │
│  │  Link to relevant north star items, current state, gaps              │   │
│  │  Queue for human review                                              │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     HUMAN NOTIFICATION (DETERMINISTIC)               │   │
│  │                                                                      │   │
│  │  Notify user: "I have N proposals for your review"                   │   │
│  │  Present proposals in priority order                                 │   │
│  │  Wait for approval/rejection/modification                            │   │
│  │                                                                      │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                          │
│                                 ▼                                          │
│           [User reviews via chat - loops back to Part 2]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Happens After Approval

When a user approves a proposal (via chat, which goes through intent detection):

```
Approval received
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              TASK CREATION (DETERMINISTIC)              │
│                                                         │
│  - Create task from approved proposal                   │
│  - Link task to proposal, gap, north star items         │
│  - Set status to "ready"                                │
│  - Add to execution queue                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              CONTEXT ASSEMBLY (DETERMINISTIC)           │
│                                                         │
│  For this task, load:                                   │
│  - The proposal and its rationale                       │
│  - Related requirements from north star                 │
│  - Related existing code/docs/tests                     │
│  - Relevant decisions and constraints                   │
│  - Similar past tasks and their outcomes                │
│                                                         │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              EXECUTION AGENT (AI)                       │
│                                                         │
│  Given context and task:                                │
│  - Plan the work                                        │
│  - Execute (write code, update docs, etc.)              │
│  - Verify (run tests, check constraints)                │
│  - Report results                                       │
│                                                         │
│  Output: Artifacts + decisions + links                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              OUTPUT VALIDATION (DETERMINISTIC)          │
│                                                         │
│  - Validate output schema                               │
│  - Verify referenced IDs exist                          │
│  - Run automated checks (lint, test, build)             │
│  - Reject if validation fails                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              STATE PERSISTENCE (DETERMINISTIC)          │
│                                                         │
│  - Write artifacts to disk                              │
│  - Update knowledge graph with new nodes and links      │
│  - Update task status                                   │
│  - Record decisions made during execution               │
│  - Update current state (for next analysis cycle)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              LEARNING (DETERMINISTIC + OPTIONAL AI)     │
│                                                         │
│  Record:                                                │
│  - What was proposed                                    │
│  - Whether it was approved/rejected                     │
│  - If executed, whether it succeeded                    │
│  - User feedback if provided                            │
│                                                         │
│  This data improves future proposals:                   │
│  - "User rejected all scope=large proposals last month" │
│  - "Performance improvements get approved more often"   │
│  - "Decommission proposals need more justification"     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Part 4: The North Star Structure

The north star isn't just a document. It's a structured set of nodes that the system can reason about.

### Components of the North Star

**Vision**

- A statement of what the system should ultimately be
- Changes rarely, only by explicit user decision
- Example: "A platform where founders can develop ideas with AI assistance, keeping all context synchronized across docs, tasks, and code"

**Target Capabilities**

- Specific things the system should be able to do
- Linked to vision (which part of vision does this enable?)
- Has status: not_started, in_progress, complete, blocked
- Example: "System can detect when documentation contradicts code"

**Constraints**

- Things that must always be true
- Non-negotiable (proposals violating constraints are auto-rejected)
- Example: "All user data must be encrypted at rest"

**Priorities**

- When capabilities or constraints conflict, which wins?
- Ordered list that guides tradeoff decisions
- Example: "Security > Correctness > Performance > UX"

**Current State**

- What capabilities exist now (linked to code that implements them)
- What constraints are met (linked to how)
- What's broken or degraded
- Updated automatically as work completes

### How the North Star Enables Self-Evolution

Without north star:

- Agent sees: "Code X is slow"
- Agent proposes: "Optimize code X"
- Why? Just because it's slow

With north star:

- Agent sees: "Code X is slow"
- Agent checks: "Is performance a priority? What capabilities depend on X?"
- Agent proposes: "Optimize code X because it blocks capability Y which is needed for vision Z, and performance is priority 3"
- Proposal has context for human to evaluate

The north star makes proposals **purposeful**, not just reactive.

---

## Part 5: Types of Proactive Proposals

The system should generate four types of proposals:

### Feature Proposals

- Gap: North star requires capability X, which doesn't exist
- Proposal: Build capability X
- Includes: What it should do, why it matters, dependencies, risks

### Bug Fix Proposals

- Gap: Capability X exists but doesn't work correctly
- Evidence: Test failures, drift detection, user feedback
- Proposal: Fix the specific issue
- Includes: What's broken, why it matters, proposed approach

### Improvement Proposals

- Gap: Capability X exists and works but could be better
- Better means: Faster, cleaner, more maintainable, better UX
- Proposal: Improve X in specific way
- Includes: Current state, proposed state, expected benefit, effort estimate

### Decommission Proposals

- Gap: Component X exists but is no longer needed
- Evidence: Not linked to any active capability, no recent usage, superseded by something else
- Proposal: Remove X
- Includes: What to remove, why it's safe, what depends on it (should be nothing)

---

## Part 6: The Complete Flow

Putting it all together:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                              ENTRY POINTS                                   │
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │   User Chat  │    │   Schedule   │    │  File Change │                 │
│   │              │    │   (Cron)     │    │  (Git Hook)  │                 │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │
│          │                   │                   │                          │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │Intent Agent  │    │Proactive Loop│    │Drift Detector│                 │
│   │    (AI)      │    │    (AI)      │    │(Deterministic)│                │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │
│          │                   │                   │                          │
│          └───────────────────┴───────────────────┘                          │
│                              │                                              │
│                              ▼                                              │
│                   ┌──────────────────────┐                                  │
│                   │   Action Queue       │                                  │
│                   │   (Tasks, Proposals, │                                  │
│                   │    Alerts)           │                                  │
│                   └──────────┬───────────┘                                  │
│                              │                                              │
│                              ▼                                              │
│                   ┌──────────────────────┐                                  │
│                   │  Human Review        │                                  │
│                   │  (via Chat)          │                                  │
│                   └──────────┬───────────┘                                  │
│                              │                                              │
│                   ┌──────────┴───────────┐                                  │
│                   │                      │                                  │
│                   ▼                      ▼                                  │
│            ┌────────────┐         ┌────────────┐                            │
│            │  Approved  │         │  Rejected  │                            │
│            └─────┬──────┘         └─────┬──────┘                            │
│                  │                      │                                   │
│                  ▼                      ▼                                   │
│            ┌────────────┐         ┌────────────┐                            │
│            │  Execute   │         │  Record    │                            │
│            │  (AI)      │         │  Feedback  │                            │
│            └─────┬──────┘         └────────────┘                            │
│                  │                                                          │
│                  ▼                                                          │
│            ┌────────────┐                                                   │
│            │  Validate  │                                                   │
│            │(Determin.) │                                                   │
│            └─────┬──────┘                                                   │
│                  │                                                          │
│                  ▼                                                          │
│            ┌────────────┐                                                   │
│            │  Persist   │                                                   │
│            │(Determin.) │                                                   │
│            └─────┬──────┘                                                   │
│                  │                                                          │
│                  ▼                                                          │
│            ┌────────────┐                                                   │
│            │Update State│───────────┐                                       │
│            └────────────┘           │                                       │
│                                     │                                       │
│                                     ▼                                       │
│                          ┌──────────────────┐                               │
│                          │   North Star     │                               │
│                          │   Current State  │                               │
│                          │   Knowledge Graph│                               │
│                          └──────────────────┘                               │
│                                     │                                       │
│                                     │ (feeds back into next cycle)          │
│                                     │                                       │
│                                     └───────────────────────────────────────┤
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 7: AI vs Deterministic - Final Classification

| Step                                             | Type          | Why                                                  |
| ------------------------------------------------ | ------------- | ---------------------------------------------------- |
| Receive user message                             | DETERMINISTIC | Just I/O                                             |
| Detect intent from message                       | AI            | Requires understanding natural language              |
| Route intent to handler                          | DETERMINISTIC | Intent type → handler is a lookup                    |
| Run proactive analysis (scheduled)               | -             | Entry point, not a step                              |
| Assemble context for analysis                    | DETERMINISTIC | Load by ID from database                             |
| Detect gaps between north star and current state | AI            | Requires reasoning about what's missing              |
| Generate proposals from gaps                     | AI            | Requires creativity and judgment                     |
| Store proposals                                  | DETERMINISTIC | Just database writes                                 |
| Notify user of proposals                         | DETERMINISTIC | Just I/O                                             |
| Receive user approval/rejection                  | DETERMINISTIC | Just I/O                                             |
| Detect approval intent                           | AI            | Requires understanding "yes do it" vs "not that one" |
| Create task from approved proposal               | DETERMINISTIC | Proposal already has all needed info                 |
| Assemble context for task execution              | DETERMINISTIC | Load by ID from database                             |
| Execute task (plan, code, test, document)        | AI            | Requires synthesis                                   |
| Validate execution output                        | DETERMINISTIC | Schema validation, ID checks, automated tests        |
| Persist results                                  | DETERMINISTIC | Just database and file writes                        |
| Update state                                     | DETERMINISTIC | Just database writes                                 |
| Detect drift                                     | DETERMINISTIC | Compare hashes, check existence, run tests           |
| Generate alerts from drift                       | DETERMINISTIC | Drift type → alert template                          |

**Count:**

- DETERMINISTIC: 13 steps
- AI: 5 steps (intent detection, gap analysis, proposal generation, approval detection, task execution)

The system is 72% deterministic by step count. AI is used only for understanding, reasoning, and synthesis.

---

## Part 8: What Makes This Self-Evolving

The system improves itself because:

1. **It has a goal (north star)** - Not just reacting to problems, but working toward a vision

2. **It detects gaps proactively** - Doesn't wait for you to notice something is missing

3. **It proposes, doesn't just execute** - You stay in control but don't have to think of everything

4. **It learns from feedback** - Proposals that get rejected inform future proposals

5. **State updates feed the next cycle** - Every execution changes current state, which changes what gaps exist

6. **Drift detection catches regressions** - Even after work is done, the system monitors for degradation

The key is the loop: North Star → Gap Analysis → Proposals → Approval → Execution → State Update → (back to Gap Analysis)

This isn't a system that waits for instructions. It's a system that continuously asks "what should we do next to get closer to the goal?" and presents options for you to approve.

---

## Part 9: What's Still Missing

This framework describes the **what** and **how** but not the **details**. Still needed:

**North Star Definition**

- How do you initially populate the north star?
- What's the format for vision, capabilities, constraints, priorities?
- How do capabilities link to requirements and code?

**Proposal Quality**

- How do you ensure proposals are good, not just frequent?
- How do you prevent the system from proposing the same thing repeatedly after rejection?
- How do you balance proposal volume (too many is overwhelming, too few misses opportunities)?

**Approval UX**

- How are proposals presented for review?
- Can you approve with modifications?
- Can you defer without rejecting?

**Execution Boundaries**

- What can agents do without approval? (Maybe small bug fixes are auto-approved?)
- What always requires approval? (Any new feature, any deletion, any change to north star)

**Drift Detection Specifics**

- What exactly is compared?
- How are false positives handled?
- How does drift feed back into proposals?

These are design decisions that shape the system's behavior. The framework provides the structure; these details determine whether it feels helpful or annoying.

---

_Document updated: 2025-02-05_
_Purpose: Agentic loop framework with self-evolution for Vibe platform_
