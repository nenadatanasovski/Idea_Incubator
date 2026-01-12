# End-to-End Scenarios: Core Flows

> 📍 **Navigation:** [Documentation Index](./DOCUMENTATION-INDEX.md) → E2E Core

**Created:** 2026-01-10
**Updated:** 2026-01-12
**Purpose:** Core system flows showing exactly how the primary pipeline works
**Status:** Reference Documentation

---

## Table of Contents

1. [Scenario 1: Idea → Working App](#scenario-1-idea--working-app)
2. [Scenario 2: Bug Fix Flow](#scenario-2-bug-fix-flow)
3. [Scenario 3: Stuck Agent Recovery](#scenario-3-stuck-agent-recovery)

**See Also:** [E2E-SCENARIOS-ADVANCED.md](./E2E-SCENARIOS-ADVANCED.md) for advanced scenarios (Parallel Agents, Decommission, Knowledge Propagation)

---

# Scenario 1: Idea → Working App

**Example:** User wants to build a "habit tracking app"

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IDEA → APP PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │  User   │───▶│Ideation │───▶│  Task   │───▶│  Build  │───▶│Working  │   │
│  │  Idea   │    │  Agent  │    │  Agent  │    │  Agent  │    │   App   │   │
│  └─────────┘    └────┬────┘    └────┬────┘    └────┬────┘    └─────────┘   │
│                      │              │              │                        │
│                      ▼              ▼              ▼                        │
│                 4 Phases       Phase 1:       Executed                      │
│                 ~30 mins      spec + tasks      Code                        │
│                                                                              │
│                      │              │              │                        │
│                      ▼              ▼              ▼                        │
│                 ┌─────────────────────────────────────────────────┐        │
│                 │                    SIA                           │        │
│                 │        Extracts learnings after each phase       │        │
│                 └─────────────────────────────────────────────────┘        │
│                                                                              │
│  NOTE: Task Agent (Phase 1) replaces the deprecated Specification Agent.   │
│        Task Agent generates spec.md + tasks.md, then triggers Build Agent  │
│        via "tasklist.ready" event when ready.                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Ideation (EXPLORING → REFINING)

### Step 1.1: User Starts Session

**User Action:** Opens Vibe, says "I want to build a habit tracking app"

**System Response (Micro-Level):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1.1: Session Creation                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. API receives POST /api/ideation/sessions                                 │
│    Body: { userId: "user-123", message: "I want to build a habit..." }      │
│                                                                              │
│ 2. SessionManager.createSession()                                            │
│    ├─ Generate session ID: "sess-abc123"                                    │
│    ├─ Initialize phase: "EXPLORING"                                         │
│    └─ Create memory context (empty)                                         │
│                                                                              │
│ 3. DATABASE WRITES:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: ideation_sessions                                            │   │
│    │ INSERT: {                                                           │   │
│    │   id: "sess-abc123",                                                │   │
│    │   user_id: "user-123",                                              │   │
│    │   phase: "EXPLORING",                                               │   │
│    │   status: "active",                                                 │   │
│    │   created_at: "2026-01-10T10:00:00Z"                               │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. Orchestrator.processMessage()                                            │
│    ├─ Load system prompt for EXPLORING phase                                │
│    ├─ No existing context (new session)                                     │
│    └─ Call Claude API                                                       │
│                                                                              │
│ 5. CLAUDE API CALL:                                                          │
│    System: "You are helping explore a new idea. Ask open-ended questions    │
│            to understand the user's vision. Phase: EXPLORING."              │
│    User: "I want to build a habit tracking app"                             │
│                                                                              │
│ 6. CLAUDE RESPONSE (streamed):                                              │
│    "Interesting! A habit tracker could take many forms. Let me understand   │
│     your vision better:                                                     │
│     1. What habits are YOU struggling with that inspired this?              │
│     2. Who do you imagine using this - just you, or others?                 │
│     3. What's broken about existing habit trackers you've tried?"          │
│                                                                              │
│ 7. SignalExtractor.extract(response)                                        │
│    ├─ Detected: 3 questions (no artifacts yet)                              │
│    ├─ No buttons/forms extracted                                            │
│    └─ Confidence: 0.0 (just started)                                        │
│                                                                              │
│ 8. MemoryManager.updateMemory()                                             │
│    ├─ Store user message                                                    │
│    └─ Store assistant response                                              │
│                                                                              │
│ 9. DATABASE WRITES:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: ideation_messages                                            │   │
│    │ INSERT: [                                                           │   │
│    │   { session_id: "sess-abc123", role: "user", content: "I want..." }│   │
│    │   { session_id: "sess-abc123", role: "assistant", content: "..." } │   │
│    │ ]                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1.2: User Answers Questions (Multiple Exchanges)

**User says:** "I struggle with morning routines. It's for people like me - busy professionals. Other apps are too gamified and feel childish."

**System Response (Micro-Level):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1.2: Conversation Development                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. Orchestrator builds context:                                              │
│    ├─ Load previous 2 messages from memory                                  │
│    ├─ Phase still EXPLORING                                                 │
│    └─ No artifacts yet                                                      │
│                                                                              │
│ 2. CLAUDE API CALL (with context):                                          │
│    System: [EXPLORING phase prompt]                                         │
│    History: [previous exchange]                                             │
│    User: "I struggle with morning routines..."                              │
│                                                                              │
│ 3. CLAUDE RESPONSE:                                                         │
│    "I'm picking up on something important - you want sophistication, not    │
│     gamification. Let me capture what I'm hearing:                          │
│                                                                              │
│     **Target User**: Busy professionals who find existing apps childish     │
│     **Core Problem**: Morning routine consistency                            │
│     **Differentiator**: Mature, non-gamified approach                       │
│                                                                              │
│     A few more questions:                                                   │
│     - What does 'success' look like? A streak? A feeling?                   │
│     - Would you pay for this? How much?                                     │
│     - Mobile app, web app, or both?"                                        │
│                                                                              │
│ 4. SignalExtractor.extract(response)                                        │
│    ├─ Detected ARTIFACT: target-user summary                                │
│    ├─ Detected ARTIFACT: problem statement                                  │
│    ├─ Detected ARTIFACT: differentiator                                     │
│    └─ 3 new questions detected                                              │
│                                                                              │
│ 5. ArtifactStore.save() - for each detected artifact:                       │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: ideation_artifacts                                           │   │
│    │ INSERT: {                                                           │   │
│    │   id: "art-001",                                                    │   │
│    │   session_id: "sess-abc123",                                        │   │
│    │   type: "target-user",                                              │   │
│    │   content: "Busy professionals who find existing apps childish",   │   │
│    │   confidence: 0.7,                                                  │   │
│    │   source_message_id: "msg-005"                                      │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 6. PhaseManager.evaluateTransition()                                        │
│    ├─ Check: Do we have enough to move to NARROWING?                        │
│    ├─ Required: target user (✓), problem (✓), basic solution concept (✗)   │
│    └─ Decision: Stay in EXPLORING                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1.3: Phase Transition (EXPLORING → NARROWING)

After ~5-8 exchanges, enough context is gathered.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1.3: Phase Transition                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. PhaseManager.evaluateTransition()                                        │
│    ├─ Artifacts collected:                                                  │
│    │   - target-user: ✓ (confidence 0.85)                                   │
│    │   - problem: ✓ (confidence 0.80)                                       │
│    │   - solution-concept: ✓ (confidence 0.70)                              │
│    │   - differentiator: ✓ (confidence 0.75)                                │
│    ├─ Threshold for NARROWING: 4 artifacts with avg confidence > 0.7       │
│    └─ Decision: TRANSITION TO NARROWING                                     │
│                                                                              │
│ 2. DATABASE UPDATE:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: ideation_sessions                                            │   │
│    │ UPDATE: SET phase = "NARROWING" WHERE id = "sess-abc123"           │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. System prompt changes for NARROWING phase:                               │
│    - Now focuses on validating assumptions                                  │
│    - Asks more specific questions                                           │
│    - Starts suggesting concrete features                                    │
│                                                                              │
│ 4. CLAUDE RESPONSE (in new phase):                                          │
│    "Great, I have a clearer picture now. Let's narrow down the concept:    │
│                                                                              │
│     **Core MVP Features I'm thinking:**                                     │
│     1. Simple habit creation (no complex goals)                             │
│     2. Morning-focused check-in                                             │
│     3. Weekly reflection (not daily streaks)                                │
│     4. Clean, minimal UI                                                    │
│                                                                              │
│     Do these resonate? What would you add or remove?"                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1.4: Candidate Creation

User confirms direction, system creates an idea candidate.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1.4: Idea Candidate Creation                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. User confirms: "Yes, those features are exactly what I'm thinking"      │
│                                                                              │
│ 2. CandidateManager.createCandidate()                                       │
│    ├─ Generate idea slug: "minimalist-habit-tracker"                        │
│    ├─ Compile artifacts into structured idea                                │
│    └─ Calculate initial viability score                                     │
│                                                                              │
│ 3. DATABASE WRITES:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: idea_candidates                                              │   │
│    │ INSERT: {                                                           │   │
│    │   id: "cand-001",                                                   │   │
│    │   session_id: "sess-abc123",                                        │   │
│    │   slug: "minimalist-habit-tracker",                                 │   │
│    │   title: "Minimalist Habit Tracker",                                │   │
│    │   status: "developing",                                             │   │
│    │   viability_score: 0.72,                                            │   │
│    │   created_at: "2026-01-10T10:25:00Z"                               │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. FILE SYSTEM WRITES (Unified FS):                                         │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ CREATE: users/user-123/ideas/minimalist-habit-tracker/             │   │
│    │                                                                     │   │
│    │ WRITE: README.md                                                    │   │
│    │ ---                                                                 │   │
│    │ title: Minimalist Habit Tracker                                    │   │
│    │ stage: CLARIFY                                                      │   │
│    │ created: 2026-01-10                                                │   │
│    │ ---                                                                 │   │
│    │ # Minimalist Habit Tracker                                         │   │
│    │                                                                     │   │
│    │ A habit tracking app for busy professionals who want               │   │
│    │ a mature, non-gamified approach to building morning routines.      │   │
│    │ ...                                                                 │   │
│    │                                                                     │   │
│    │ WRITE: target-users.md                                             │   │
│    │ WRITE: problem-solution.md                                         │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1.5: Phases Complete → Handoff Brief Generated

After VALIDATING and REFINING phases complete (~20-30 min total):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1.5: Handoff Brief Generation                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. PhaseManager detects: All 4 phases complete                              │
│    - EXPLORING ✓                                                            │
│    - NARROWING ✓                                                            │
│    - VALIDATING ✓                                                           │
│    - REFINING ✓                                                             │
│                                                                              │
│ 2. HandoffGenerator.generateBrief()                                         │
│    ├─ Extract all artifacts from session                                    │
│    ├─ Calculate confidence scores                                           │
│    └─ Generate structured brief                                             │
│                                                                              │
│ 3. FILE SYSTEM WRITE:                                                        │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ WRITE: users/user-123/ideas/minimalist-habit-tracker/              │   │
│    │        planning/brief.md                                            │   │
│    │                                                                     │   │
│    │ ---                                                                 │   │
│    │ id: brief-1704884400000                                            │   │
│    │ from_phase: REFINING                                               │   │
│    │ to_phase: SPECIFICATION                                            │   │
│    │ confidence: 82                                                      │   │
│    │ ---                                                                 │   │
│    │                                                                     │   │
│    │ # Handoff Brief: Minimalist Habit Tracker                          │   │
│    │                                                                     │   │
│    │ ## What's Complete                                                  │   │
│    │ - ✓ Target user defined (busy professionals)                       │   │
│    │ - ✓ Problem validated (morning routine consistency)                │   │
│    │ - ✓ MVP scope defined (4 core features)                            │   │
│    │ - ✓ Differentiator clear (non-gamified, mature)                    │   │
│    │                                                                     │   │
│    │ ## Key Insights                                                     │   │
│    │ - Users willing to pay $5-10/month                                 │   │
│    │ - Mobile-first, web secondary                                      │   │
│    │ - Competition: Habitica (too gamified), Streaks (too simple)       │   │
│    │                                                                     │   │
│    │ ## Recommended Next Steps                                           │   │
│    │ 1. Generate technical specification                                 │   │
│    │ 2. Break down into atomic tasks                                     │   │
│    │ 3. Begin implementation                                             │   │
│    │                                                                     │   │
│    │ ## AI Recommendation                                                │   │
│    │ Confidence: 82% - Ready for specification                          │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. DATABASE UPDATE:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: ideation_sessions                                            │   │
│    │ UPDATE: SET status = "completed",                                   │   │
│    │             completed_at = "2026-01-10T10:35:00Z"                  │   │
│    │ WHERE id = "sess-abc123"                                           │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 5. EVENT PUBLISHED:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ MessageBus.publish({                                                │   │
│    │   event_type: "ideation.completed",                                │   │
│    │   source: "ideation-agent",                                        │   │
│    │   payload: {                                                        │   │
│    │     session_id: "sess-abc123",                                     │   │
│    │     idea_slug: "minimalist-habit-tracker",                         │   │
│    │     user_slug: "user-123",                                         │   │
│    │     brief_path: "planning/brief.md",                               │   │
│    │     confidence: 82,                                                 │   │
│    │     ready_for_spec: true                                           │   │
│    │   }                                                                 │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Task Agent (Spec Generation)

> **Note:** This phase was previously handled by the Specification Agent, which is now deprecated.
> Task Agent Phase 1 now handles spec and task generation.

### Step 2.1: Spec Generation Triggered

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2.1: Task Agent Phase 1 - Specification Generation                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ TRIGGER: Event "ideation.completed" (Task Agent subscribed)                 │
│          OR: User clicks "Generate Specification" button                    │
│          OR: Auto-triggered if confidence > 80%                             │
│                                                                              │
│ 1. API receives POST /api/specifications/generate                           │
│    Body: {                                                                   │
│      ideaSlug: "minimalist-habit-tracker",                                  │
│      userSlug: "user-123",                                                  │
│      options: { targetComplexity: "mvp" }                                   │
│    }                                                                         │
│                                                                              │
│ 2. SpecExtractor.loadContext()                                              │
│    ├─ READ: README.md → idea overview                                       │
│    ├─ READ: target-users.md → user personas                                 │
│    ├─ READ: problem-solution.md → problem framing                           │
│    ├─ READ: planning/brief.md → handoff brief                               │
│    ├─ READ: development.md → Q&A insights                                   │
│    └─ READ: research/*.md → market/competitive data                         │
│                                                                              │
│ 3. GotchaInjector.queryKnowledgeBase()                                      │
│    ├─ Query: gotchas for "*.sql" (database tasks)                           │
│    ├─ Query: gotchas for "server/routes/*" (API tasks)                      │
│    └─ Query: patterns for "habit" domain                                    │
│                                                                              │
│    DATABASE READ:                                                            │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: knowledge (in coding-loops DB)                              │   │
│    │ SELECT * FROM knowledge                                             │   │
│    │ WHERE item_type = 'gotcha'                                          │   │
│    │   AND (file_pattern LIKE '%.sql' OR file_pattern LIKE 'server/%')  │   │
│    │                                                                     │   │
│    │ RETURNS:                                                            │   │
│    │ [                                                                   │   │
│    │   { content: "Use TEXT for dates in SQLite", confidence: 0.95 },  │   │
│    │   { content: "Always include IF NOT EXISTS", confidence: 0.90 },  │   │
│    │   { content: "Validate input before DB calls", confidence: 0.85 } │   │
│    │ ]                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. CLAUDE API CALL (Spec Generation):                                       │
│    System: "You are a Specification Agent. Given the following context     │
│            about an idea, generate a technical specification..."           │
│    Context: [all loaded documents]                                          │
│    Gotchas: [injected from Knowledge Base]                                  │
│                                                                              │
│ 5. CLAUDE RESPONSE: Structured spec.md content                              │
│                                                                              │
│ 6. FILE SYSTEM WRITE:                                                        │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ WRITE: users/user-123/ideas/minimalist-habit-tracker/              │   │
│    │        build/spec.md                                                │   │
│    │                                                                     │   │
│    │ ---                                                                 │   │
│    │ id: spec-001                                                        │   │
│    │ status: draft                                                       │   │
│    │ complexity: medium                                                  │   │
│    │ ---                                                                 │   │
│    │                                                                     │   │
│    │ # Technical Specification: Minimalist Habit Tracker                │   │
│    │                                                                     │   │
│    │ ## Context References                                               │   │
│    │ - README.md ✓                                                       │   │
│    │ - target-users.md ✓                                                 │   │
│    │ - planning/brief.md ✓                                               │   │
│    │                                                                     │   │
│    │ ## Functional Requirements                                          │   │
│    │ | ID | Requirement | Priority |                                    │   │
│    │ | FR-001 | Create habit with name, frequency | Must |              │   │
│    │ | FR-002 | Mark habit complete for today | Must |                  │   │
│    │ | FR-003 | View weekly summary | Must |                            │   │
│    │ | FR-004 | Morning check-in notification | Should |                │   │
│    │                                                                     │   │
│    │ ## Data Models                                                      │   │
│    │ ```sql                                                              │   │
│    │ CREATE TABLE habits (                                               │   │
│    │   id TEXT PRIMARY KEY,                                              │   │
│    │   user_id TEXT NOT NULL,                                            │   │
│    │   name TEXT NOT NULL,                                               │   │
│    │   frequency TEXT NOT NULL, -- daily, weekdays, custom              │   │
│    │   created_at TEXT DEFAULT (datetime('now'))                        │   │
│    │ );                                                                  │   │
│    │ ```                                                                 │   │
│    │                                                                     │   │
│    │ ## Known Gotchas                                                    │   │
│    │ | ID | Gotcha | Source |                                           │   │
│    │ | G-001 | Use TEXT for dates in SQLite | Knowledge Base |          │   │
│    │ | G-002 | Always include IF NOT EXISTS | Knowledge Base |          │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 2.2: Task Generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2.2: Atomic Task Generation                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. TaskGenerator.generateTasks(spec)                                        │
│    ├─ Parse spec.md for requirements                                        │
│    ├─ Identify files to create/modify                                       │
│    ├─ Order by phase (database → types → api → ui → tests)                 │
│    └─ Inject gotchas for each file type                                     │
│                                                                              │
│ 2. CLAUDE API CALL (Task Generation):                                       │
│    System: "Break down this specification into atomic tasks..."             │
│    Input: spec.md content                                                    │
│                                                                              │
│ 3. FILE SYSTEM WRITE:                                                        │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ WRITE: users/user-123/ideas/minimalist-habit-tracker/              │   │
│    │        build/tasks.md                                               │   │
│    │                                                                     │   │
│    │ # Build Tasks: Minimalist Habit Tracker                            │   │
│    │                                                                     │   │
│    │ ## Phase 1: Database                                                │   │
│    │                                                                     │   │
│    │ ### Task 1                                                          │   │
│    │ ```yaml                                                             │   │
│    │ id: T-001                                                           │   │
│    │ phase: database                                                     │   │
│    │ action: CREATE                                                      │   │
│    │ file: "database/migrations/001_habits.sql"                         │   │
│    │ status: pending                                                     │   │
│    │                                                                     │   │
│    │ requirements:                                                       │   │
│    │   - "Create habits table with id, user_id, name, frequency"        │   │
│    │   - "Add created_at timestamp"                                     │   │
│    │   - "Create index on user_id for fast lookups"                     │   │
│    │                                                                     │   │
│    │ gotchas:                                                            │   │
│    │   - "Use TEXT for dates in SQLite, not DATETIME"                   │   │
│    │   - "Always include IF NOT EXISTS"                                 │   │
│    │                                                                     │   │
│    │ validation:                                                         │   │
│    │   command: "sqlite3 :memory: < database/migrations/001_habits.sql" │   │
│    │   expected: "exit code 0"                                          │   │
│    │                                                                     │   │
│    │ code_template: |                                                    │   │
│    │   CREATE TABLE IF NOT EXISTS habits (                              │   │
│    │       id TEXT PRIMARY KEY,                                          │   │
│    │       user_id TEXT NOT NULL,                                        │   │
│    │       name TEXT NOT NULL,                                           │   │
│    │       frequency TEXT NOT NULL,                                      │   │
│    │       created_at TEXT DEFAULT (datetime('now'))                    │   │
│    │   );                                                                │   │
│    │   CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);   │   │
│    │                                                                     │   │
│    │ depends_on: []                                                      │   │
│    │ ```                                                                 │   │
│    │                                                                     │   │
│    │ ### Task 2                                                          │   │
│    │ ```yaml                                                             │   │
│    │ id: T-002                                                           │   │
│    │ phase: database                                                     │   │
│    │ action: CREATE                                                      │   │
│    │ file: "database/migrations/002_completions.sql"                    │   │
│    │ ...                                                                 │   │
│    │ depends_on: ["T-001"]                                               │   │
│    │ ```                                                                 │   │
│    │                                                                     │   │
│    │ ## Phase 2: Types                                                   │   │
│    │ ### Task 3                                                          │   │
│    │ ```yaml                                                             │   │
│    │ id: T-003                                                           │   │
│    │ phase: types                                                        │   │
│    │ action: CREATE                                                      │   │
│    │ file: "types/habits.ts"                                            │   │
│    │ ...                                                                 │   │
│    │ depends_on: ["T-001"]                                               │   │
│    │ ```                                                                 │   │
│    │                                                                     │   │
│    │ [... 12 total tasks ...]                                           │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. DATABASE WRITES:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: specifications (in coding-loops DB)                         │   │
│    │ INSERT: {                                                           │   │
│    │   id: "spec-001",                                                   │   │
│    │   idea_slug: "minimalist-habit-tracker",                           │   │
│    │   user_slug: "user-123",                                           │   │
│    │   spec_path: "build/spec.md",                                      │   │
│    │   tasks_path: "build/tasks.md",                                    │   │
│    │   task_count: 12,                                                   │   │
│    │   status: "draft"                                                   │   │
│    │ }                                                                   │   │
│    │                                                                     │   │
│    │ TABLE: tasks                                                 │   │
│    │ INSERT: [12 task records with all fields]                          │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 5. EVENT PUBLISHED:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ MessageBus.publish({                                                │   │
│    │   event_type: "tasklist.generated",                                    │   │
│    │   source: "task-agent",                                            │   │
│    │   payload: {                                                        │   │
│    │     task_list_id: "tl-001",                                        │   │
│    │     idea_slug: "minimalist-habit-tracker",                         │   │
│    │     task_count: 12,                                                 │   │
│    │     estimated_complexity: "medium"                                 │   │
│    │   }                                                                 │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 2.3: User Approves Task List → Build Triggered

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2.3: Task List Approval & Build Trigger                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. User reviews spec.md and tasks.md in UI                                  │
│                                                                              │
│ 2. User clicks "Approve & Start Build"                                      │
│                                                                              │
│ 3. API receives POST /api/task-lists/tl-001/approve                         │
│                                                                              │
│ 4. DATABASE UPDATE:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: task_lists                                                   │   │
│    │ UPDATE: SET status = "approved",                                    │   │
│    │             approved_at = "2026-01-10T11:00:00Z",                  │   │
│    │             approved_by = "user-123"                                │   │
│    │ WHERE id = "tl-001"                                                 │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 5. TASK AGENT PUBLISHES tasklist.ready:                                      │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ MessageBus.publish({                                                │   │
│    │   event_type: "tasklist.ready",                                    │   │
│    │   source: "task-agent",                                            │   │
│    │   payload: {                                                        │   │
│    │     task_list_id: "tl-001",                                        │   │
│    │     idea_slug: "minimalist-habit-tracker",                         │   │
│    │     user_slug: "user-123",                                         │   │
│    │     approved_by: "user-123"                                        │   │
│    │   }                                                                 │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 6. Build Agent receives event (subscribed to "tasklist.ready")              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Build Agent Execution

### Step 3.1: Prime (Context Loading)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3.1: Build Agent - Prime Phase                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. BuildAgent receives tasklist.ready event                                 │
│                                                                              │
│ 2. BuildAgent.prime(task_list_id="tl-001")                                  │
│                                                                              │
│ 3. DATABASE READS:                                                           │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ SELECT * FROM task_lists WHERE id = "tl-001"                       │   │
│    │ → Returns task list metadata including idea_slug, user_slug         │   │
│    │                                                                     │   │
│    │ SELECT t.* FROM tasks t                                            │   │
│    │ JOIN task_list_items tli ON t.id = tli.task_id                    │   │
│    │ WHERE tli.task_list_id = "tl-001"                                  │   │
│    │ ORDER BY tli.position                                               │   │
│    │ → Returns 12 tasks in execution order                               │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. FILE SYSTEM READS:                                                        │
│    ├─ READ: users/user-123/ideas/minimalist-habit-tracker/build/spec.md    │
│    ├─ READ: users/user-123/ideas/minimalist-habit-tracker/build/tasks.md   │
│    ├─ READ: CLAUDE.md (project conventions)                                 │
│    └─ READ: users/user-123/ideas/minimalist-habit-tracker/README.md        │
│                                                                              │
│ 5. KnowledgeBase.getGotchasForTasks(tasks)                                  │
│    ├─ For each unique file pattern in tasks                                 │
│    ├─ Query gotchas                                                         │
│    └─ Merge with task-level gotchas                                         │
│                                                                              │
│ 6. GitManager.createBranch("build/minimalist-habit-tracker")                │
│    ├─ git checkout -b build/minimalist-habit-tracker                        │
│    └─ Verify on new branch                                                  │
│                                                                              │
│ 7. DATABASE WRITE:                                                           │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: build_executions                                             │   │
│    │ INSERT: {                                                           │   │
│    │   id: "exec-001",                                                   │   │
│    │   task_list_id: "tl-001",                                          │   │
│    │   idea_slug: "minimalist-habit-tracker",                           │   │
│    │   user_slug: "user-123",                                           │   │
│    │   loop_id: "loop-1-critical-path",                                 │   │
│    │   branch_name: "build/minimalist-habit-tracker",                   │   │
│    │   status: "priming",                                                │   │
│    │   tasks_total: 12,                                                  │   │
│    │   started_at: "2026-01-10T11:00:30Z"                               │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 8. BuildAgent context now contains:                                         │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ {                                                                   │   │
│    │   spec: { ... full spec content ... },                             │   │
│    │   tasks: [ ... 12 task objects ... ],                              │   │
│    │   claude_md: { ... project conventions ... },                      │   │
│    │   idea_context: { ... README, problem-solution ... },              │   │
│    │   gotchas: { ... merged gotchas by file pattern ... },             │   │
│    │   branch: "build/minimalist-habit-tracker",                        │   │
│    │   execution_id: "exec-001"                                         │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 9. DATABASE UPDATE:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ UPDATE build_executions                                             │   │
│    │ SET status = "running", primed_at = "2026-01-10T11:00:45Z"        │   │
│    │ WHERE id = "exec-001"                                               │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 10. EVENT PUBLISHED:                                                         │
│     MessageBus.publish({                                                     │
│       event_type: "build.started",                                          │
│       payload: { execution_id: "exec-001", task_count: 12 }                 │
│     })                                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 3.2: Execute (Task-by-Task)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3.2: Build Agent - Execute Task T-001                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ TASK: T-001 - Create database/migrations/001_habits.sql                     │
│                                                                              │
│ 1. Check dependencies: depends_on = [] → No blockers                        │
│                                                                              │
│ 2. ResourceRegistry.checkOwnership("database/migrations/001_habits.sql")    │
│    ├─ File doesn't exist yet                                                │
│    ├─ Register as owner: loop-1-critical-path                               │
│    └─ Result: ALLOWED                                                        │
│                                                                              │
│    DATABASE WRITE:                                                           │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: resources                                                    │   │
│    │ INSERT: {                                                           │   │
│    │   path: "database/migrations/001_habits.sql",                      │   │
│    │   owner_loop: "loop-1-critical-path",                              │   │
│    │   resource_type: "file"                                             │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. MessageBus.lockFile("database/migrations/001_habits.sql")                │
│    ├─ Acquire exclusive lock                                                │
│    └─ Lock expires in 30 minutes                                            │
│                                                                              │
│    DATABASE WRITE:                                                           │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: file_locks                                                   │   │
│    │ INSERT: {                                                           │   │
│    │   file_path: "database/migrations/001_habits.sql",                 │   │
│    │   locked_by: "loop-1-critical-path",                               │   │
│    │   expires_at: "2026-01-10T11:31:00Z"                               │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. CheckpointManager.createCheckpoint("T-001-before")                       │
│    ├─ git stash (if needed)                                                 │
│    ├─ git rev-parse HEAD → "abc123"                                         │
│    └─ Store checkpoint reference                                            │
│                                                                              │
│    DATABASE WRITE:                                                           │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TABLE: checkpoints                                                  │   │
│    │ INSERT: {                                                           │   │
│    │   id: "chk-001",                                                    │   │
│    │   loop_id: "loop-1-critical-path",                                 │   │
│    │   test_id: "T-001",                                                 │   │
│    │   git_ref: "abc123",                                                │   │
│    │   checkpoint_type: "before_task"                                    │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 5. DATABASE UPDATE (task status):                                            │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ UPDATE tasks                                                 │   │
│    │ SET status = "in_progress",                                         │   │
│    │     started_at = "2026-01-10T11:01:00Z",                           │   │
│    │     assigned_to = "loop-1-critical-path"                            │   │
│    │ WHERE id = "T-001"                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 6. EVENT PUBLISHED:                                                          │
│    MessageBus.publish({                                                      │
│      event_type: "task.started",                                            │
│      payload: { task_id: "T-001", file: "database/migrations/..." }         │
│    })                                                                        │
│                                                                              │
│ 7. CLAUDE API CALL (Code Generation):                                       │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ System: "You are a Build Agent executing task T-001.               │   │
│    │         Follow CLAUDE.md conventions.                               │   │
│    │         Use the code template as guidance.                          │   │
│    │         Avoid these gotchas: [list]"                                │   │
│    │                                                                     │   │
│    │ Task:                                                               │   │
│    │   action: CREATE                                                    │   │
│    │   file: database/migrations/001_habits.sql                         │   │
│    │   requirements:                                                     │   │
│    │     - Create habits table with id, user_id, name, frequency        │   │
│    │     - Add created_at timestamp                                     │   │
│    │     - Create index on user_id                                      │   │
│    │   gotchas:                                                          │   │
│    │     - Use TEXT for dates                                            │   │
│    │     - Always IF NOT EXISTS                                          │   │
│    │   code_template: [provided]                                         │   │
│    │                                                                     │   │
│    │ Generate the file content.                                          │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 8. CLAUDE RESPONSE:                                                          │
│    ```sql                                                                    │
│    -- Migration 001: Create habits table                                    │
│    -- Created: 2026-01-10                                                   │
│                                                                              │
│    CREATE TABLE IF NOT EXISTS habits (                                      │
│        id TEXT PRIMARY KEY,                                                  │
│        user_id TEXT NOT NULL,                                               │
│        name TEXT NOT NULL,                                                   │
│        frequency TEXT NOT NULL CHECK (frequency IN                          │
│          ('daily', 'weekdays', 'weekends', 'custom')),                      │
│        created_at TEXT DEFAULT (datetime('now')),                           │
│        updated_at TEXT DEFAULT (datetime('now'))                            │
│    );                                                                        │
│                                                                              │
│    CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);           │
│    ```                                                                       │
│                                                                              │
│ 9. FILE SYSTEM WRITE:                                                        │
│    WRITE: database/migrations/001_habits.sql                                │
│                                                                              │
│ 10. Run validation command:                                                  │
│     $ sqlite3 :memory: < database/migrations/001_habits.sql                 │
│     → Exit code: 0 ✓                                                        │
│                                                                              │
│ 11. VerificationGate.verify()                                               │
│     ├─ SQL syntax valid ✓                                                   │
│     └─ No regressions ✓                                                     │
│                                                                              │
│ 12. Git commit:                                                              │
│     $ git add database/migrations/001_habits.sql                            │
│     $ git commit -m "T-001: Create habits table migration"                  │
│     → Commit SHA: "def456"                                                  │
│                                                                              │
│ 13. MessageBus.unlockFile("database/migrations/001_habits.sql")             │
│                                                                              │
│ 14. DATABASE UPDATES:                                                        │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ UPDATE tasks                                                 │  │
│     │ SET status = "complete",                                            │  │
│     │     completed_at = "2026-01-10T11:02:30Z",                         │  │
│     │     actual_diff = "[git diff content]"                              │  │
│     │ WHERE id = "T-001"                                                  │  │
│     │                                                                     │  │
│     │ UPDATE build_executions                                             │  │
│     │ SET tasks_completed = tasks_completed + 1,                          │  │
│     │     current_task_id = "T-002"                                       │  │
│     │ WHERE id = "exec-001"                                               │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ 15. EVENT PUBLISHED:                                                         │
│     MessageBus.publish({                                                     │
│       event_type: "task.completed",                                         │
│       payload: {                                                             │
│         task_id: "T-001",                                                   │
│         duration_seconds: 90,                                               │
│         commit_sha: "def456"                                                │
│       }                                                                      │
│     })                                                                       │
│                                                                              │
│ 16. DISCOVERY RECORDED (if any):                                            │
│     If Build Agent learns something new:                                    │
│     ┌────────────────────────────────────────────────────────────────────┐  │
│     │ KnowledgeBase.recordGotcha({                                        │  │
│     │   content: "CHECK constraint validates enum values in SQLite",     │  │
│     │   file_pattern: "*.sql",                                            │  │
│     │   action_type: "CREATE",                                            │  │
│     │   confidence: 0.7,                                                  │  │
│     │   discovered_by: "loop-1-critical-path"                             │  │
│     │ })                                                                  │  │
│     └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ 17. FILE SYSTEM UPDATE (tasks.md):                                          │
│     Update status in tasks.md file:                                         │
│     status: pending → status: complete                                      │
│     completed_at: "2026-01-10T11:02:30Z"                                    │
│                                                                              │
│ 18. PROCEED TO NEXT TASK: T-002                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 3.3: All Tasks Complete → Validate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3.3: Build Agent - Validation Phase                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ After T-001 through T-012 complete (~45 minutes total)                      │
│                                                                              │
│ 1. BuildAgent.validate()                                                    │
│                                                                              │
│ 2. VerificationGate.runFullSuite():                                         │
│                                                                              │
│    a) TypeScript Check:                                                      │
│       $ npx tsc --noEmit                                                    │
│       → Exit code: 0 ✓                                                      │
│       → No type errors                                                      │
│                                                                              │
│    b) Test Suite:                                                            │
│       $ npm test                                                             │
│       → 24 tests passed ✓                                                   │
│       → 0 tests failed                                                      │
│       → Coverage: 85%                                                       │
│                                                                              │
│    c) Lint Check:                                                            │
│       $ npm run lint                                                         │
│       → Exit code: 0 ✓                                                      │
│       → No lint errors                                                      │
│                                                                              │
│    d) Regression Check:                                                      │
│       $ npm test -- --grep "existing"                                       │
│       → All existing tests still pass ✓                                     │
│                                                                              │
│ 3. DATABASE UPDATE:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ UPDATE build_executions                                             │   │
│    │ SET status = "validating",                                          │   │
│    │     final_validation = '{                                           │   │
│    │       "tsc": {"passed": true},                                      │   │
│    │       "tests": {"passed": 24, "failed": 0},                        │   │
│    │       "lint": {"passed": true},                                     │   │
│    │       "regressions": {"count": 0}                                   │   │
│    │     }'                                                              │   │
│    │ WHERE id = "exec-001"                                               │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. All validations pass → Mark execution complete                           │
│                                                                              │
│ 5. DATABASE UPDATES:                                                         │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ UPDATE build_executions                                             │   │
│    │ SET status = "completed",                                           │   │
│    │     completed_at = "2026-01-10T11:50:00Z",                         │   │
│    │     git_commits = '["def456", "ghi789", ...]'                      │   │
│    │ WHERE id = "exec-001"                                               │   │
│    │                                                                     │   │
│    │ UPDATE task_lists                                                    │   │
│    │ SET status = "complete",                                            │   │
│    │     completed_at = "2026-01-10T11:50:00Z"                          │   │
│    │ WHERE id = "tl-001"                                                 │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 6. EVENT PUBLISHED:                                                          │
│    MessageBus.publish({                                                      │
│      event_type: "build.completed",                                         │
│      source: "build-agent",                                                 │
│      payload: {                                                              │
│        execution_id: "exec-001",                                            │
│        task_list_id: "tl-001",                                              │
│        idea_slug: "minimalist-habit-tracker",                               │
│        user_slug: "user-123",                                               │
│        tasks_completed: 12,                                                 │
│        duration_minutes: 50,                                                │
│        branch: "build/minimalist-habit-tracker",                            │
│        commits: ["def456", "ghi789", ...]                                   │
│      }                                                                       │
│    })                                                                        │
│                                                                              │
│ 7. FILE SYSTEM UPDATE:                                                       │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ UPDATE: users/user-123/ideas/minimalist-habit-tracker/             │   │
│    │         build/tasks.md                                              │   │
│    │                                                                     │   │
│    │ ## Completion Checklist                                             │   │
│    │ - [x] All tasks completed                                           │   │
│    │ - [x] All validation commands pass                                  │   │
│    │ - [x] No TypeScript errors                                          │   │
│    │ - [x] No lint errors                                                │   │
│    │ - [x] Tests passing                                                 │   │
│    │                                                                     │   │
│    │ ## Sign-off                                                         │   │
│    │ Completed By: Build Agent (loop-1-critical-path)                   │   │
│    │ Completed At: 2026-01-10T11:50:00Z                                 │   │
│    │ Final Status: SUCCESS                                               │   │
│    │ Commits: def456, ghi789, ...                                       │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Self-Improvement Agent Review

### Step 4.1: SIA Triggered

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4.1: SIA - Session Review                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. SIA receives build.completed event (subscribed)                          │
│                                                                              │
│ 2. SIA.review(execution_id="exec-001")                                      │
│                                                                              │
│ 3. SIA.capture():                                                            │
│    ├─ Load execution record from DB                                         │
│    ├─ Load all task results                                                 │
│    ├─ Load spec.md (what was planned)                                       │
│    ├─ Load git diff (what actually changed)                                 │
│    └─ Load test results                                                     │
│                                                                              │
│ 4. SIA.analyze():                                                            │
│    ├─ Compare planned files vs actual files                                 │
│    ├─ Identify divergences                                                  │
│    └─ Classify each divergence                                              │
│                                                                              │
│    ANALYSIS RESULT:                                                          │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ {                                                                   │   │
│    │   "outcome": "success",                                             │   │
│    │   "divergences": [                                                  │   │
│    │     {                                                               │   │
│    │       "type": "enhancement",                                        │   │
│    │       "description": "Added CHECK constraint for frequency enum",  │   │
│    │       "classification": "good",                                     │   │
│    │       "file": "database/migrations/001_habits.sql"                 │   │
│    │     },                                                              │   │
│    │     {                                                               │   │
│    │       "type": "addition",                                           │   │
│    │       "description": "Added updated_at column not in spec",        │   │
│    │       "classification": "good",                                     │   │
│    │       "file": "database/migrations/001_habits.sql"                 │   │
│    │     }                                                               │   │
│    │   ]                                                                 │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 5. SIA.extract():                                                            │
│    ├─ Pattern: "Always add updated_at alongside created_at"                 │
│    ├─ Pattern: "Use CHECK constraints for enum columns"                     │
│    └─ No gotchas (no failures)                                              │
│                                                                              │
│ 6. SIA.propagate():                                                          │
│                                                                              │
│    a) Record patterns in Knowledge Base:                                    │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ INSERT INTO knowledge:                                              │   │
│    │ {                                                                   │   │
│    │   id: "kb-pat-001",                                                 │   │
│    │   item_type: "pattern",                                             │   │
│    │   content: "Always add updated_at alongside created_at",           │   │
│    │   topic: "database",                                                │   │
│    │   file_pattern: "*.sql",                                            │   │
│    │   action_type: "CREATE",                                            │   │
│    │   confidence: 0.75,                                                 │   │
│    │   discovered_by: "sia-agent"                                        │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    b) Check if pattern is universal enough for CLAUDE.md:                   │
│       - Confidence > 0.9? No                                                │
│       - Seen in 3+ different builds? No                                     │
│       → Don't update CLAUDE.md yet (needs more evidence)                    │
│                                                                              │
│ 7. SIA.track():                                                              │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ INSERT INTO system_reviews:                                         │   │
│    │ {                                                                   │   │
│    │   id: "rev-001",                                                    │   │
│    │   agent_type: "build",                                              │   │
│    │   session_id: "exec-001",                                           │   │
│    │   idea_slug: "minimalist-habit-tracker",                           │   │
│    │   outcome: "success",                                               │   │
│    │   divergences: [2 items],                                           │   │
│    │   patterns_found: [2 items],                                        │   │
│    │   gotchas_found: [],                                                │   │
│    │   kb_entries_created: ["kb-pat-001", "kb-pat-002"]                 │   │
│    │ }                                                                   │   │
│    │                                                                     │   │
│    │ INSERT INTO improvement_metrics:                                    │   │
│    │ {                                                                   │   │
│    │   metric_type: "first_pass_success",                               │   │
│    │   value: 1.0,                                                       │   │
│    │   agent_type: "build",                                              │   │
│    │   idea_slug: "minimalist-habit-tracker"                            │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 8. EVENT PUBLISHED:                                                          │
│    MessageBus.publish({                                                      │
│      event_type: "review.completed",                                        │
│      payload: {                                                              │
│        review_id: "rev-001",                                                │
│        patterns_found: 2,                                                   │
│        gotchas_found: 0,                                                    │
│        improvements_made: ["kb-pat-001", "kb-pat-002"]                      │
│      }                                                                       │
│    })                                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Final State

After the complete Idea → App pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FINAL STATE                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ FILE SYSTEM:                                                                 │
│ ├─ users/user-123/ideas/minimalist-habit-tracker/                           │
│ │   ├─ README.md                          (Ideation Agent)                  │
│ │   ├─ development.md                     (Ideation Agent)                  │
│ │   ├─ target-users.md                    (Ideation Agent)                  │
│ │   ├─ problem-solution.md                (Ideation Agent)                  │
│ │   ├─ planning/brief.md                  (Ideation Agent)                  │
│ │   ├─ build/spec.md                      (Task Agent - Phase 1)            │
│ │   ├─ build/tasks.md                     (Task Agent + Build Agent)        │
│ │   └─ build/decisions.md                 (Task Agent - Phase 1)            │
│ │                                                                            │
│ └─ Source code:                                                              │
│     ├─ database/migrations/001_habits.sql (Build Agent)                     │
│     ├─ database/migrations/002_completions.sql                              │
│     ├─ types/habits.ts                                                       │
│     ├─ server/routes/habits.ts                                              │
│     └─ tests/habits.test.ts                                                  │
│                                                                              │
│ GIT:                                                                         │
│ ├─ Branch: build/minimalist-habit-tracker                                   │
│ ├─ Commits: 12 (one per task)                                               │
│ └─ Ready for: PR to main                                                    │
│                                                                              │
│ DATABASE (coding-loops):                                                     │
│ ├─ task_lists: 1 record (status: complete)                                  │
│ ├─ tasks: 12 records (all status: complete)                                 │
│ ├─ task_list_items: 12 records (linking tasks to list)                      │
│ ├─ build_executions: 1 record (status: completed)                           │
│ ├─ knowledge: 2 new patterns                                                │
│ ├─ system_reviews: 1 record                                                 │
│ └─ improvement_metrics: 1 record                                            │
│                                                                              │
│ DATABASE (Vibe):                                                             │
│ ├─ ideation_sessions: 1 record (status: completed)                          │
│ ├─ ideation_messages: ~20 records                                           │
│ ├─ ideation_artifacts: ~10 records                                          │
│ └─ idea_candidates: 1 record (status: built)                                │
│                                                                              │
│ TOTAL TIME: ~75 minutes                                                      │
│ ├─ Ideation: ~30 minutes                                                    │
│ ├─ Task Agent (spec gen): ~5 minutes                                        │
│ ├─ Build: ~40 minutes                                                       │
│ └─ SIA Review: ~1 minute                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Scenario 2: Bug Fix Flow

**Example:** User reports "Habit completion not saving on weekends"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ BUG FIX FLOW                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. BUG REPORT RECEIVED                                                       │
│    ├─ Source: User feedback, error log, or test failure                     │
│    └─ Creates issue in tracking system                                      │
│                                                                              │
│ 2. TASK AGENT (quick spec via Phase 1)                                      │
│    ├─ Analyzes bug report                                                   │
│    ├─ Locates relevant code                                                 │
│    ├─ Generates minimal spec:                                               │
│    │   ┌──────────────────────────────────────────────────────────────┐    │
│    │   │ build/spec-bugfix-001.md                                     │    │
│    │   │                                                               │    │
│    │   │ ## Bug: Completion not saving on weekends                    │    │
│    │   │ ## Root Cause: frequency check excludes 'weekends'           │    │
│    │   │ ## Fix: Update isActiveToday() in habits.ts                  │    │
│    │   │ ## Test: Add weekend completion test                         │    │
│    │   └──────────────────────────────────────────────────────────────┘    │
│    └─ Generates task list (2 tasks), publishes tasklist.ready:              │
│        T-001: Fix isActiveToday() function                                  │
│        T-002: Add regression test                                           │
│                                                                              │
│ 3. BUILD AGENT (quick execution)                                            │
│    ├─ Prime: Load bug context + existing code                               │
│    ├─ Execute T-001: Fix the bug                                            │
│    │   - Acquire lock on habits.ts                                          │
│    │   - Create checkpoint                                                  │
│    │   - Edit isActiveToday()                                               │
│    │   - Run validation                                                     │
│    ├─ Execute T-002: Add test                                               │
│    │   - Create test case                                                   │
│    │   - Verify test catches the bug (fails on old code)                    │
│    │   - Verify test passes on fixed code                                   │
│    └─ Validate: Full test suite                                             │
│                                                                              │
│ 4. SIA REVIEW                                                                │
│    ├─ Capture: Bug report + fix diff                                        │
│    ├─ Extract gotcha:                                                       │
│    │   "frequency check must include 'weekends' for weekend habits"         │
│    └─ Propagate: Record in Knowledge Base                                   │
│                                                                              │
│ 5. KNOWLEDGE PROPAGATION                                                     │
│    ├─ Next time Spec Agent generates habit-related tasks                    │
│    ├─ Knowledge Base query returns this gotcha                              │
│    └─ Gotcha injected into task definition → prevents recurrence            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Scenario 3: Stuck Agent Recovery

**Example:** Build Agent stuck on task T-005 for 15 minutes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STUCK AGENT RECOVERY                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. MONITOR AGENT DETECTS STUCK                                              │
│    ├─ Polling interval: every 2 minutes                                     │
│    ├─ Query: SELECT * FROM tasks WHERE status = 'in_progress'        │
│    │         AND started_at < datetime('now', '-10 minutes')                │
│    ├─ Result: T-005 started 15 minutes ago, still in_progress               │
│    └─ Threshold exceeded (10 min default)                                   │
│                                                                              │
│ 2. MONITOR PUBLISHES ALERT                                                   │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ MessageBus.publish({                                                │   │
│    │   event_type: "alert.stuck_task",                                  │   │
│    │   priority: 1,  // High priority                                    │   │
│    │   payload: {                                                        │   │
│    │     task_id: "T-005",                                               │   │
│    │     loop_id: "loop-1-critical-path",                               │   │
│    │     duration_minutes: 15,                                           │   │
│    │     execution_id: "exec-001"                                       │   │
│    │   }                                                                 │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. PM AGENT RECEIVES ALERT                                                   │
│    ├─ Subscribed to: alert.*                                                │
│    └─ Triggers investigation                                                │
│                                                                              │
│ 4. PM AGENT INVESTIGATION                                                    │
│    ├─ Check loop health: Is loop-1 still responsive?                        │
│    │   Query: SELECT * FROM component_health                                │
│    │          WHERE component = 'loop-1-critical-path'                      │
│    │   Result: Last heartbeat 5 seconds ago → Loop is alive                 │
│    │                                                                         │
│    ├─ Check for deadlock:                                                   │
│    │   Query: SELECT * FROM file_locks WHERE locked_by = 'loop-1-...'       │
│    │   Query: SELECT * FROM wait_graph WHERE waiter = 'loop-1-...'          │
│    │   Result: No circular dependencies → Not a deadlock                    │
│    │                                                                         │
│    └─ Conclusion: Loop is stuck on complex task, not blocked                │
│                                                                              │
│ 5. PM AGENT DECISION                                                         │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ Decision options:                                                   │   │
│    │ a) Wait longer (task is complex)                                   │   │
│    │ b) Interrupt and retry                                             │   │
│    │ c) Skip and mark blocked                                           │   │
│    │ d) Escalate to human                                               │   │
│    │                                                                     │   │
│    │ Auto-decision logic:                                                │   │
│    │ - Duration > 30 min? → Interrupt                                   │   │
│    │ - Duration > 20 min? → Escalate                                    │   │
│    │ - Duration 10-20 min? → Wait (current state)                       │   │
│    │                                                                     │   │
│    │ Result: Duration is 15 min → Wait, but alert human                 │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 6. TELEGRAM NOTIFICATION                                                     │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ TelegramNotifier.sendAlert({                                        │   │
│    │   severity: "warning",                                              │   │
│    │   message: "Task T-005 stuck for 15 minutes\n"                     │   │
│    │            "Loop: loop-1-critical-path\n"                          │   │
│    │            "File: server/routes/habits.ts\n"                       │   │
│    │            "Action: Monitoring, will auto-interrupt at 30 min\n"   │   │
│    │            "Reply 'skip' to skip, 'retry' to retry now"            │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 7. POSSIBLE OUTCOMES:                                                        │
│                                                                              │
│    OUTCOME A: Task completes naturally                                       │
│    ├─ Monitor detects task.completed event                                  │
│    ├─ Alert auto-cleared                                                    │
│    └─ Telegram: "Task T-005 completed (took 18 min)"                        │
│                                                                              │
│    OUTCOME B: Human replies "skip"                                           │
│    ├─ PM Agent receives skip command                                        │
│    ├─ Build Agent receives interrupt signal                                 │
│    ├─ Task marked as "skipped"                                              │
│    ├─ Checkpoint restored                                                   │
│    ├─ Next task (T-006) starts                                              │
│    └─ Skipped task added to manual queue                                    │
│                                                                              │
│    OUTCOME C: 30 minutes elapsed, auto-interrupt                            │
│    ├─ PM Agent sends interrupt to Build Agent                               │
│    ├─ Build Agent:                                                          │
│    │   - Saves partial work (if any)                                        │
│    │   - Creates checkpoint                                                 │
│    │   - Marks task as "blocked"                                            │
│    │   - Records failure reason                                             │
│    ├─ SIA records gotcha: "This task pattern causes timeouts"               │
│    └─ Telegram: "Task T-005 auto-skipped after 30 min timeout"             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- [E2E-SCENARIOS-ADVANCED.md](./E2E-SCENARIOS-ADVANCED.md) - Advanced scenarios (Parallel Agents, Decommission, Knowledge Propagation)
- `AGENT-ARCHITECTURE.md` - Implementation details
- `IMPLEMENTATION-PLAN.md` - Development roadmap

---

*This document provides concrete examples of how the core data flows through the system.*
