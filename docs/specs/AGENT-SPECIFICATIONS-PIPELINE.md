# Agent Specifications: Pipeline Agents

> 📍 **Navigation:** [Documentation Index](./DOCUMENTATION-INDEX.md) → Pipeline Agents

**Created:** 2026-01-10
**Updated:** 2026-01-12
**Purpose:** Definitive reference for core pipeline agents - Ideation → Task → Build
**Status:** Implementation Guide

---

## Table of Contents

1. [Agent Overview](#1-agent-overview)
2. [Routing & Orchestration](#2-routing--orchestration)
3. [Ideation Agent](#3-ideation-agent)
4. [Specification Agent (Deprecated)](#4-specification-agent)
5. [Build Agent](#5-build-agent)
6. [Task Agent](#6-task-agent)

**See Also:** [AGENT-SPECIFICATIONS-INFRASTRUCTURE.md](./AGENT-SPECIFICATIONS-INFRASTRUCTURE.md) for SIA, Monitor, PM agents and cross-cutting concerns.

---

## 1. Agent Overview

### 1.1 Agent Registry

| Agent                   | Location                      | Language   | Trigger Type      | Primary Role               | Status        |
| ----------------------- | ----------------------------- | ---------- | ----------------- | -------------------------- | ------------- |
| **Ideation Agent**      | `agents/ideation/`            | TypeScript | User message      | Explore & develop ideas    | Active        |
| **Specification Agent** | `agents/specification/`       | TypeScript | Event / API       | Generate specs from ideas  | ⚠️ DEPRECATED |
| **Build Agent**         | `coding-loops/agents/`        | Python     | Event             | Execute code tasks         | Active        |
| **Task Agent**          | `server/services/task-agent/` | TypeScript | Always-on + Event | Orchestrate task execution | Active        |
| **SIA**                 | `coding-loops/agents/`        | Python     | Event             | Learn from outcomes        | Active        |
| **Monitor Agent**       | `coding-loops/agents/`        | Python     | Timer             | Watch system health        | Active        |
| **PM Agent**            | `coding-loops/agents/`        | Python     | Event             | Coordinate & resolve       | Active        |
| **Validation Agent**    | `coding-loops/agents/`        | Python     | Event             | Validate build output      | 📋 Planned    |
| **UX Agent**            | `coding-loops/agents/`        | Python     | Event             | Test user experience       | 📋 Planned    |

> **Note on Specification Agent Deprecation (2026-01-12):**
> The Specification Agent's functionality has been merged into Task Agent Phase 1. The Spec Agent
> code remains for backwards compatibility during transition, but all new implementations should
> use Task Agent for spec generation. See Section 6 for Task Agent spec generation workflow.

### 1.2 Agent Lifecycle States

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  IDLE   │────▶│ LOADING │────▶│ ACTIVE  │────▶│COMPLETE │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     ▲               │               │               │
     │               │               ▼               │
     │               │          ┌─────────┐          │
     │               └─────────▶│  ERROR  │          │
     │                          └─────────┘          │
     └───────────────────────────────────────────────┘
```

### 1.3 Key Terminology

| Term               | Definition                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| **Task**           | A single atomic unit of work with file, action, requirements, and validation |
| **Task List**      | A grouped collection of tasks for a specific idea/feature, managed together  |
| **Task List Item** | Linking record that associates a task with a task list (position-ordered)    |
| **Execution**      | A single run of the Build Agent processing a task list                       |
| **Loop**           | A Build Agent instance (e.g., loop-1-critical-path, loop-2-infrastructure)   |
| **Phase 1**        | Task Agent's spec generation phase (triggered by `ideation.completed`)       |
| **Phase 2**        | Task Agent's ongoing orchestration phase (always-on)                         |

> **Note on Table Naming:** The data model uses `tasks`, `task_lists`, and `task_list_items` tables.
> Legacy documentation may reference `atomic_tasks` which is deprecated in favor of `tasks`.

---

## 2. Routing & Orchestration

### 2.1 How the System Knows Which Agent to Invoke

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROUTING DECISION TREE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT RECEIVED                                                              │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Is this a USER MESSAGE via chat interface?                          │    │
│  └───────────────────────────┬─────────────────────────────────────────┘    │
│                              │                                               │
│              ┌───────────────┴───────────────┐                              │
│              ▼                               ▼                              │
│           YES                               NO                              │
│              │                               │                              │
│              ├─ Web UI chat                  ▼                              │
│              │  → IDEATION AGENT    ┌───────────────────────────────┐      │
│              │                      │ Is this an EVENT from MessageBus? │   │
│              └─ Telegram message    └───────────────────────────────┘      │
│                 → TASK AGENT                 │                              │
│                                   ┌──────────┴──────────┐                   │
│                                   ▼                     ▼                   │
│                                  YES                   NO                   │
│                                   │                     │                   │
│                                   ▼                     ▼                   │
│                          Route by event_type:     (Timer/Cron)              │
│                                   │                     │                   │
│                                   │                     ├─ Every 2 min      │
│   ┌───────────────────────────────┤                     │  → MONITOR AGENT  │
│   │                               │                     │                   │
│   │  ├─ ideation.completed        │                     └─ Every 6 hours    │
│   │  │  → TASK AGENT (Phase 1)    │                        → TASK AGENT     │
│   │  │                            │                          (stale check)  │
│   │  ├─ tasklist.ready            │                                         │
│   │  │  → BUILD AGENT             │                                         │
│   │  │                            │                                         │
│   │  ├─ tasklist.completed/failed │                                         │
│   │  │  → TASK AGENT              │                                         │
│   │  │                            │                                         │
│   │  ├─ build.completed           │                                         │
│   │  │  → SIA (learning mode)     │                                         │
│   │  │                            │                                         │
│   │  ├─ alert.*                   │                                         │
│   │  │  → PM AGENT                │                                         │
│   │  │                            │                                         │
│   │  └─ session.ended             │                                         │
│   │     → TASK AGENT              │                                         │
│   │                               │                                         │
│   └───────────────────────────────┘                                         │
│                                                                              │
│  ALWAYS-ON SERVICES:                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ TASK AGENT: Continuously monitors task_lists, suggests via Telegram  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Event Subscriptions

Each agent subscribes to specific events:

```python
# Agent Event Subscriptions

AGENT_SUBSCRIPTIONS = {
    "ideation-agent": [
        # No event subscriptions - triggered by user messages only
    ],

    "specification-agent": [
        # ⚠️ DEPRECATED - Merged into Task Agent (2026-01-12)
        # Retained for backwards compatibility during transition
        "ideation.completed",      # Now handled by Task Agent Phase 1
        "spec.revision_requested"  # Now handled by Task Agent Phase 1
    ],

    "build-agent": [
        "tasklist.ready",          # Task Agent approved list for execution
        "tasklist.retry",          # Retry after failure analysis
        "build.resume"             # Resume interrupted build
    ],

    "task-agent": [
        # Always-on service + event subscriptions
        "ideation.completed",      # Trigger Phase 1 (spec generation)
        "task.created",            # New task available
        "task.completed",          # Update progress
        "task.failed",             # Handle failure, possibly spawn SIA
        "tasklist.completed",      # Build Agent finished list
        "tasklist.failed",         # Build Agent failed list
        "session.ended",           # Build Agent session ended (PM interrupt or timeout)
        "question.answered",       # User answered Telegram question
        "stale.check"              # Timer: check for stale tasks (every 6 hours)
    ],

    "sia-agent": [
        # MODE 1: Background Learning (event-driven)
        "build.completed",         # Learn from successful/failed builds
        "ideation.completed",      # Learn from ideation patterns

        # MODE 2: Failure Analysis (on-demand spawn by Task Agent)
        # NOT event-driven - Task Agent spawns SIA directly when:
        #   - Task has 3+ failed attempts AND
        #   - No progress detected between attempts
        # See Section 6 for spawn protocol
    ],

    "monitor-agent": [
        # Timer-based, not event-based
        # Polls every 2 minutes for:
        #   - Stuck Build Agent processes (5-30 min threshold)
        #   - Component health (heartbeat timeouts)
        #   - Deadlock detection (circular waits)
    ],

    "pm-agent": [
        "alert.stuck_task",        # Monitor detected stuck Build Agent
        "alert.deadlock",          # Circular wait detected
        "alert.component_down",    # Component not responding
        "conflict.detected",       # File ownership conflict
        "decision.requested"       # Human decision needed
    ]
}
```

### 2.3 Handoff Conditions

| From Agent      | To Agent                         | Condition                                      | Mechanism |
| --------------- | -------------------------------- | ---------------------------------------------- | --------- |
| Ideation → Task | All 4 phases complete            | `ideation.completed` event                     |
| Task → Build    | Task list validated and approved | `tasklist.ready` event                         |
| Build → Task    | List completed or failed         | `tasklist.completed` / `tasklist.failed` event |
| Build → SIA     | Build completes (for learning)   | `build.completed` event                        |
| Task → SIA      | 3+ failures with no progress     | Direct spawn (not event)                       |
| SIA → Task      | Analysis complete                | Returns fix proposal to spawning Task Agent    |
| Monitor → PM    | Alert threshold exceeded         | `alert.*` event                                |
| PM → Task       | Build Agent interrupted          | `session.ended` event                          |
| Any → Human     | Decision needed                  | Telegram notification                          |

### 2.4 Agent Responsibility Levels (Failure Handling)

```
LEVEL 1: INFRASTRUCTURE (Monitor Agent)
├─ Detects: Process stuck, component down, deadlocks
├─ Time scale: 5-30 minutes (real-time health)
└─ Output: alert.* events to PM Agent

LEVEL 2: AGENT COORDINATION (PM Agent)
├─ Handles: stuck_task alerts, conflicts, work redistribution
├─ Decides: WATCH → ESCALATE → INTERRUPT
└─ Output: session.ended to Task Agent, work.assigned

LEVEL 3: TASK ORCHESTRATION (Task Agent)
├─ Handles: Task lifecycle (stale, failed, ready states)
├─ Time scale: 7+ days (stale), 3+ attempts (failures)
├─ Spawns: SIA for failure analysis
└─ Output: tasklist.ready to Build Agent, follow-up tasks

LEVEL 4: LEARNING (SIA Agent)
├─ Mode 1: Event-driven learning from build.completed
├─ Mode 2: On-demand failure analysis (spawned by Task Agent)
└─ Output: Gotchas to knowledge base, fix proposals to Task Agent
```

### 2.5 Terminology Glossary

| Term        | Definition                           | Owner        | Time Scale     |
| ----------- | ------------------------------------ | ------------ | -------------- |
| **Stuck**   | Build Agent PROCESS running too long | Monitor → PM | 5-30 min       |
| **Failed**  | Task execution completed with error  | Task Agent   | Per attempt    |
| **Stale**   | Task has no activity                 | Task Agent   | 7+ days        |
| **Blocked** | Task waiting on dependency           | Task Agent   | Until resolved |

---

## 3. Ideation Agent

### 3.1 Trigger

```
TRIGGER: User sends message via /api/ideation/sessions/:id/messages
         OR: User starts new session via /api/ideation/sessions
```

### 3.2 Context Loading

```typescript
// agents/ideation/orchestrator.ts

async function loadContext(sessionId: string): Promise<IdeationContext> {
  // 1. LOAD SESSION STATE
  const session = await SessionManager.getSession(sessionId);
  // Returns: { phase, userId, ideaSlug, status, createdAt }

  // 2. LOAD CONVERSATION MEMORY
  const memory = await MemoryManager.getRecentMessages(sessionId, {
    limit: 20, // Last 20 messages
    includeSignals: true, // Include extracted signals
  });
  // Returns: [{ role, content, signals, timestamp }]

  // 3. LOAD EXTRACTED SIGNALS (from previous messages)
  const signals = await SignalExtractor.getSessionSignals(sessionId);
  // Returns: {
  //   artifacts: [...],    // Extracted documents
  //   decisions: [...],    // User decisions
  //   risks: [...],        // Identified risks
  //   confidence: 0.72     // Overall confidence
  // }

  // 4. LOAD IDEA ARTIFACTS (if idea exists)
  let ideaContext = null;
  if (session.ideaSlug) {
    ideaContext = await IdeaContextBuilder.build(
      session.userId,
      session.ideaSlug,
    );
    // Returns: {
    //   readme: "...",
    //   targetUsers: "...",
    //   problemSolution: "...",
    //   research: { market: "...", competitive: "..." }
    // }
  }

  // 5. LOAD USER PROFILE (for Fit scoring)
  const userProfile = await ProfileManager.getProfile(session.userId);
  // Returns: { goals, skills, network, lifeStage }

  // 6. LOAD PHASE-SPECIFIC INSTRUCTIONS
  const phasePrompt = PHASE_PROMPTS[session.phase];
  // Different prompts for EXPLORING, NARROWING, VALIDATING, REFINING

  return {
    session,
    memory,
    signals,
    ideaContext,
    userProfile,
    phasePrompt,
  };
}
```

### 3.3 Decision Logic

```typescript
// agents/ideation/phase-manager.ts

class PhaseManager {
  // DECISION: Should we transition to next phase?
  async evaluateTransition(sessionId: string): Promise<TransitionDecision> {
    const signals = await SignalExtractor.getSessionSignals(sessionId);
    const currentPhase = await SessionManager.getPhase(sessionId);

    switch (currentPhase) {
      case "EXPLORING":
        // TRANSITION WHEN: Basic idea shape is clear
        const hasTargetUser = signals.artifacts.some(
          (a) => a.type === "target-user",
        );
        const hasProblem = signals.artifacts.some((a) => a.type === "problem");
        const hasSolutionConcept = signals.artifacts.some(
          (a) => a.type === "solution-concept",
        );

        if (hasTargetUser && hasProblem && hasSolutionConcept) {
          return { shouldTransition: true, nextPhase: "NARROWING" };
        }
        break;

      case "NARROWING":
        // TRANSITION WHEN: Scope is defined
        const hasMVPFeatures = signals.artifacts.some(
          (a) => a.type === "mvp-features",
        );
        const hasDifferentiator = signals.artifacts.some(
          (a) => a.type === "differentiator",
        );
        const avgConfidence = this.calculateAverageConfidence(signals);

        if (hasMVPFeatures && hasDifferentiator && avgConfidence > 0.6) {
          return { shouldTransition: true, nextPhase: "VALIDATING" };
        }
        break;

      case "VALIDATING":
        // TRANSITION WHEN: Key assumptions validated
        const validatedAssumptions = signals.decisions.filter(
          (d) => d.type === "validation",
        );
        const hasMarketValidation = validatedAssumptions.length >= 3;
        const risksIdentified = signals.risks.length > 0;

        if (hasMarketValidation && risksIdentified) {
          return { shouldTransition: true, nextPhase: "REFINING" };
        }
        break;

      case "REFINING":
        // TRANSITION WHEN: Idea is ready for specification
        const overallConfidence = signals.confidence;
        const hasBrief = signals.artifacts.some((a) => a.type === "brief");

        if (overallConfidence > 0.75 || hasBrief) {
          return { shouldTransition: true, nextPhase: "COMPLETE" };
        }
        break;
    }

    return { shouldTransition: false };
  }
}
```

### 3.4 Skills & Tools

```typescript
// Ideation Agent Skills

const IDEATION_SKILLS = {
  // CORE CONVERSATION
  chat: {
    description: "Respond to user messages with context-aware dialogue",
    uses: ["Claude API"],
    contextRequired: ["memory", "signals", "phasePrompt"],
  },

  // SIGNAL EXTRACTION
  extractSignals: {
    description: "Parse Claude response for artifacts, decisions, risks",
    uses: ["Regex patterns", "Claude for complex extraction"],
    triggers: "After every Claude response",
  },

  // ARTIFACT MANAGEMENT
  saveArtifact: {
    description: "Save extracted content to idea folder",
    uses: ["File system", "UnifiedArtifactStore"],
    triggers: "When high-confidence artifact detected",
  },

  // WEB SEARCH (optional)
  webSearch: {
    description: "Search web for market/competitive data",
    uses: ["WebSearchService", "Tavily API"],
    triggers: "User asks about market, competitors, or validation",
  },

  // HANDOFF
  generateBrief: {
    description: "Create handoff brief for Specification Agent",
    uses: ["HandoffGenerator", "File system"],
    triggers: "Phase = COMPLETE",
  },

  // CANDIDATE MANAGEMENT
  createCandidate: {
    description: "Create idea candidate record",
    uses: ["CandidateManager", "Database"],
    triggers: "First artifact saved",
  },
};
```

### 3.5 System Prompt Construction

```typescript
// agents/ideation/system-prompt.ts

function buildSystemPrompt(context: IdeationContext): string {
  const sections = [];

  // 1. BASE ROLE
  sections.push(`
    You are an idea incubation assistant helping users develop and validate
    business ideas. You guide them through discovery with thoughtful questions.
  `);

  // 2. PHASE-SPECIFIC INSTRUCTIONS
  sections.push(PHASE_INSTRUCTIONS[context.session.phase]);
  // EXPLORING: "Ask open-ended questions. Don't narrow too quickly."
  // NARROWING: "Help define scope. Suggest MVP features."
  // VALIDATING: "Challenge assumptions. Ask for evidence."
  // REFINING: "Polish the concept. Identify gaps."

  // 3. CURRENT SIGNALS (what we know so far)
  if (context.signals.artifacts.length > 0) {
    sections.push(`
      ## What We Know So Far
      ${context.signals.artifacts.map((a) => `- ${a.type}: ${a.summary}`).join("\n")}
    `);
  }

  // 4. IDEA CONTEXT (if exists)
  if (context.ideaContext) {
    sections.push(`
      ## Idea Context
      ${context.ideaContext.readme}

      Target Users: ${context.ideaContext.targetUsers}
    `);
  }

  // 5. USER PROFILE (for personalization)
  if (context.userProfile) {
    sections.push(`
      ## About This User
      Goals: ${context.userProfile.goals.join(", ")}
      Skills: ${context.userProfile.skills.join(", ")}
    `);
  }

  // 6. RESPONSE FORMAT INSTRUCTIONS
  sections.push(`
    ## Response Guidelines
    - Ask 2-3 focused questions per response
    - Summarize key insights when you learn something important
    - Use **bold** for key concepts you want to capture
    - Current confidence: ${Math.round(context.signals.confidence * 100)}%
  `);

  return sections.join("\n\n");
}
```

---

## 4. Specification Agent

> **⚠️ MERGED INTO TASK AGENT (2026-01-12)**
>
> The Specification Agent has been merged into the Task Agent as "Phase 1: Specification".
> This eliminates the unclear handoff between Spec Agent and Task Agent.
> See Section 6 (Task Agent) for the merged design.
>
> The code below is retained for reference but the Spec Agent no longer exists as a
> standalone agent. Its responsibilities are now handled by Task Agent Phase 1.

### 4.1 Trigger (DEPRECATED - See Task Agent)

```
TRIGGER: POST /api/specifications/generate
         OR: Event "ideation.completed" (if auto-generate enabled)

REQUIRED INPUT:
  - ideaSlug: string
  - userSlug: string
  - options: { targetComplexity: 'mvp' | 'full' }
```

### 4.2 Context Loading

```typescript
// agents/specification/context-loader.ts

async function loadSpecContext(
  ideaSlug: string,
  userSlug: string,
): Promise<SpecContext> {
  const ideaPath = `users/${userSlug}/ideas/${ideaSlug}`;

  // 1. REQUIRED DOCUMENTS (must exist)
  const required = {
    readme: await readFile(`${ideaPath}/README.md`),
    brief: await readFile(`${ideaPath}/planning/brief.md`),
  };

  if (!required.readme || !required.brief) {
    throw new Error("Missing required documents for spec generation");
  }

  // 2. OPTIONAL DOCUMENTS (enhance spec quality)
  const optional = {
    targetUsers: await readFileIfExists(`${ideaPath}/target-users.md`),
    problemSolution: await readFileIfExists(`${ideaPath}/problem-solution.md`),
    development: await readFileIfExists(`${ideaPath}/development.md`),
    marketResearch: await readFileIfExists(`${ideaPath}/research/market.md`),
    competitiveResearch: await readFileIfExists(
      `${ideaPath}/research/competitive.md`,
    ),
    technicalResearch: await readFileIfExists(
      `${ideaPath}/research/technical.md`,
    ),
    mvpScope: await readFileIfExists(`${ideaPath}/planning/mvp-scope.md`),
  };

  // 3. PROJECT CONVENTIONS (from CLAUDE.md)
  const conventions = await loadClaudeMdSections([
    "Database Conventions",
    "API Conventions",
    "File Locations",
    "Atomic Task Conventions",
  ]);

  // 4. KNOWLEDGE BASE QUERIES
  const gotchas = await KnowledgeBase.query({
    itemType: "gotcha",
    filePatterns: ["*.sql", "server/routes/*", "types/*"],
    minConfidence: 0.7,
  });

  const patterns = await KnowledgeBase.query({
    itemType: "pattern",
    topics: extractTopics(required.readme), // e.g., ['habits', 'tracking', 'mobile']
    minConfidence: 0.7,
  });

  // 5. EXISTING CODEBASE ANALYSIS
  const existingFiles = await analyzeCodebase({
    patterns: ["server/routes/*.ts", "types/*.ts", "database/migrations/*.sql"],
    purpose: "understand existing patterns",
  });

  return {
    required,
    optional,
    conventions,
    gotchas,
    patterns,
    existingFiles,
  };
}
```

### 4.3 Decision Logic

```typescript
// agents/specification/decisions.ts

class SpecificationDecisions {
  // DECISION: What files need to be created?
  async identifyNewFiles(context: SpecContext): Promise<FileSpec[]> {
    const features = this.extractFeatures(context.required.brief);
    const newFiles: FileSpec[] = [];

    for (const feature of features) {
      // Database migration needed?
      if (feature.requiresData) {
        const migrationNumber = await MigrationAllocator.getNextNumber();
        newFiles.push({
          path: `database/migrations/${migrationNumber}_${feature.slug}.sql`,
          purpose: `Create ${feature.name} table`,
          owner: "build-agent",
        });
      }

      // Types needed?
      if (feature.hasEntities) {
        newFiles.push({
          path: `types/${feature.slug}.ts`,
          purpose: `Types for ${feature.name}`,
          owner: "build-agent",
        });
      }

      // API routes needed?
      if (feature.hasAPI) {
        newFiles.push({
          path: `server/routes/${feature.slug}.ts`,
          purpose: `API endpoints for ${feature.name}`,
          owner: "build-agent",
        });
      }

      // Tests needed?
      newFiles.push({
        path: `tests/${feature.slug}.test.ts`,
        purpose: `Tests for ${feature.name}`,
        owner: "build-agent",
      });
    }

    return newFiles;
  }

  // DECISION: What files need to be modified?
  async identifyModifiedFiles(
    context: SpecContext,
    newFiles: FileSpec[],
  ): Promise<FileModification[]> {
    const modifications: FileModification[] = [];

    // api.ts needs to import new routes
    const newRoutes = newFiles.filter((f) => f.path.includes("server/routes/"));
    if (newRoutes.length > 0) {
      modifications.push({
        path: "server/api.ts",
        changes: `Import and mount: ${newRoutes.map((r) => r.path).join(", ")}`,
        owner: await ResourceRegistry.getOwner("server/api.ts"),
      });
    }

    // types/index.ts needs to export new types
    const newTypes = newFiles.filter((f) => f.path.includes("types/"));
    if (newTypes.length > 0) {
      modifications.push({
        path: "types/index.ts",
        changes: `Export: ${newTypes.map((t) => t.path).join(", ")}`,
        owner: await ResourceRegistry.getOwner("types/index.ts"),
      });
    }

    return modifications;
  }

  // DECISION: What gotchas apply to each task?
  async assignGotchas(tasks: AtomicTask[], gotchas: Gotcha[]): Promise<void> {
    for (const task of tasks) {
      // Match by file pattern
      const fileGotchas = gotchas.filter((g) =>
        this.matchPattern(task.file, g.filePattern),
      );

      // Match by action type
      const actionGotchas = gotchas.filter((g) => g.actionType === task.action);

      // Combine and deduplicate
      task.gotchas = [...new Set([...fileGotchas, ...actionGotchas])]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5); // Max 5 gotchas per task
    }
  }

  // DECISION: What order should tasks execute?
  determineTaskOrder(tasks: AtomicTask[]): AtomicTask[] {
    // Phase order priority
    const phaseOrder = ["database", "types", "queries", "api", "ui", "tests"];

    return tasks.sort((a, b) => {
      const phaseA = phaseOrder.indexOf(a.phase);
      const phaseB = phaseOrder.indexOf(b.phase);

      if (phaseA !== phaseB) return phaseA - phaseB;

      // Within same phase, respect dependencies
      if (a.dependsOn.includes(b.id)) return 1;
      if (b.dependsOn.includes(a.id)) return -1;

      return 0;
    });
  }
}
```

### 4.4 Skills & Tools

```typescript
const SPECIFICATION_SKILLS = {
  // DOCUMENT PARSING
  parseIdeationArtifacts: {
    description: "Extract requirements from ideation documents",
    uses: ["File system", "Claude for interpretation"],
    inputs: ["README.md", "brief.md", "development.md"],
  },

  // REQUIREMENT EXTRACTION
  extractRequirements: {
    description: "Convert natural language to formal requirements",
    uses: ["Claude API"],
    outputs: ["Functional requirements", "Non-functional requirements"],
  },

  // ARCHITECTURE DESIGN
  designArchitecture: {
    description: "Determine files, APIs, data models",
    uses: ["Claude API", "Codebase analysis"],
    outputs: ["New files list", "Modified files list", "Data models"],
  },

  // TASK GENERATION
  generateTasks: {
    description: "Break down into atomic tasks",
    uses: ["Claude API", "Task templates"],
    outputs: ["tasks.md with YAML task blocks"],
  },

  // GOTCHA INJECTION
  injectGotchas: {
    description: "Add relevant gotchas to each task",
    uses: ["Knowledge Base queries"],
    triggers: "During task generation",
  },

  // VALIDATION
  validateSpec: {
    description: "Check spec completeness and consistency",
    uses: ["Schema validation", "Dependency checking"],
    outputs: ["Validation report", "Missing inputs list"],
  },

  // OUTPUT GENERATION
  renderSpec: {
    description: "Generate spec.md and tasks.md files",
    uses: ["Template rendering", "File system"],
    outputs: ["build/spec.md", "build/tasks.md"],
  },
};
```

---

## 5. Build Agent

### 5.1 Trigger

```
TRIGGER: Event "tasklist.ready"          (Task Agent approved list for execution)
         OR: Event "tasklist.retry"      (retry after failure analysis)
         OR: Event "build.resume"        (for interrupted builds)

REQUIRED INPUT (from event payload):
  - task_list_id: string               # ID of the task list to execute
  - idea_slug: string
  - user_slug: string

NOTE: Build Agent executes TASK LISTS, not individual tasks or specs.
      Task Agent orchestrates which lists are ready and when.
```

### 5.2 Context Loading

```python
# coding-loops/agents/build_agent.py

class BuildAgent:

    async def prime(self, task_list_id: str) -> PrimeResult:
        """Load all context needed for build execution.

        NOTE: Build Agent receives task_list_id from Task Agent via tasklist.ready event.
        Task lists contain references to tasks which may or may not have spec associations.
        """

        # 1. LOAD TASK LIST METADATA
        task_list = await db.query(
            "SELECT * FROM task_lists WHERE id = ?",
            [task_list_id]
        )

        # 2. LOAD TASKS FROM LIST (in execution order)
        tasks = await db.query("""
            SELECT t.* FROM tasks t
            JOIN task_list_items tli ON t.id = tli.task_id
            WHERE tli.task_list_id = ?
            ORDER BY tli.position, t.priority DESC
        """, [task_list_id])

        # 3. LOAD SPEC.MD FILE (if exists)
        spec_path = f"users/{task_list.user_slug}/ideas/{task_list.idea_slug}/build/spec.md"
        spec_content = await read_file(spec_path) if await file_exists(spec_path) else None

        # 4. LOAD TASKS.MD FILE (if exists)
        tasks_path = f"users/{task_list.user_slug}/ideas/{task_list.idea_slug}/build/tasks.md"
        tasks_content = await read_file(tasks_path) if await file_exists(tasks_path) else None

        # 5. LOAD CLAUDE.MD (project conventions)
        claude_md = await read_file("CLAUDE.md")
        # Extract relevant sections:
        conventions = extract_sections(claude_md, [
            "Database Conventions",
            "API Conventions",
            "Build Agent Workflow"
        ])

        # 6. LOAD IDEA CONTEXT (for understanding)
        base_path = f"users/{task_list.user_slug}/ideas/{task_list.idea_slug}"
        idea_context = {
            'readme': await read_file(f"{base_path}/README.md"),
            'problem_solution': await read_file(f"{base_path}/problem-solution.md"),
            'target_users': await read_file(f"{base_path}/target-users.md"),
        }

        # 7. QUERY KNOWLEDGE BASE FOR GOTCHAS
        # Get gotchas for each unique file pattern in tasks
        file_patterns = set(task.file for task in tasks if task.file)
        gotchas = {}

        for pattern in file_patterns:
            gotchas[pattern] = await self.knowledge_base.query(
                item_type='gotcha',
                file_pattern=self.get_pattern(pattern),  # "*.sql" from "migrations/001.sql"
                min_confidence=0.6
            )

        # 8. CHECK RESOURCE OWNERSHIP
        ownership = {}
        for task in tasks:
            if not task.file:
                continue
            owner = await self.resource_registry.get_owner(task.file)
            ownership[task.file] = owner

            if owner and owner != self.loop_id:
                # File owned by another loop - need to coordinate
                task.requires_coordination = True

        # 9. CREATE EXECUTION RECORD
        execution_id = await db.insert("build_executions", {
            'task_list_id': task_list_id,       # Link to task list, not spec
            'idea_slug': task_list.idea_slug,
            'user_slug': task_list.user_slug,
            'loop_id': self.loop_id,
            'branch_name': f"build/{task_list.idea_slug}",
            'status': 'priming',
            'tasks_total': len(tasks)
        })

        return PrimeResult(
            task_list=task_list,
            tasks=tasks,
            spec_content=spec_content,
            tasks_content=tasks_content,
            conventions=conventions,
            idea_context=idea_context,
            gotchas=gotchas,
            ownership=ownership,
            execution_id=execution_id
        )
```

### 5.3 Decision Logic

```python
# coding-loops/agents/build_agent.py

class BuildAgent:

    # DECISION: Can we execute this task?
    async def can_execute_task(self, task: AtomicTask) -> tuple[bool, str]:

        # Check 1: Dependencies complete?
        for dep_id in task.depends_on:
            dep_task = await self.get_task(dep_id)
            if dep_task.status != 'complete':
                return False, f"Blocked by {dep_id}"

        # Check 2: File ownership allowed?
        owner = await self.resource_registry.get_owner(task.file)
        if owner and owner != self.loop_id:
            # Request permission or skip
            return False, f"Owned by {owner}"

        # Check 3: File not locked by another agent?
        lock = await self.message_bus.check_lock(task.file)
        if lock and lock.locked_by != self.loop_id:
            return False, f"Locked by {lock.locked_by}"

        return True, "Ready"

    # DECISION: How to handle task failure?
    async def handle_task_failure(
        self,
        task: AtomicTask,
        error: Exception
    ) -> FailureDecision:

        # Classify error
        error_type = self.classify_error(error)

        if error_type == 'SYNTAX_ERROR':
            # Self-correctable - retry with error context
            if task.attempts < 3:
                return FailureDecision(
                    action='RETRY',
                    reason='Syntax error - will retry with correction'
                )

        elif error_type == 'MISSING_DEPENDENCY':
            # Need to install something
            return FailureDecision(
                action='INSTALL_AND_RETRY',
                package=self.extract_package(error)
            )

        elif error_type == 'CONFLICT':
            # File was modified by another agent
            return FailureDecision(
                action='REBASE_AND_RETRY',
                reason='Merge conflict detected'
            )

        elif error_type == 'VALIDATION_FAILED':
            # Code doesn't pass validation
            if task.attempts < 2:
                return FailureDecision(
                    action='RETRY',
                    reason='Validation failed - will fix'
                )
            else:
                return FailureDecision(
                    action='SKIP',
                    reason='Validation failed after 2 attempts'
                )

        # Unknown error - escalate
        return FailureDecision(
            action='ESCALATE',
            reason=f'Unknown error: {str(error)}'
        )

    # DECISION: Should we continue or stop?
    async def should_continue(self) -> tuple[bool, str]:

        # Check 1: Too many failures?
        failed_tasks = [t for t in self.tasks if t.status == 'failed']
        if len(failed_tasks) > 3:
            return False, "Too many failures (>3)"

        # Check 2: Critical task failed?
        critical_failed = any(
            t.phase == 'database' and t.status == 'failed'
            for t in self.tasks
        )
        if critical_failed:
            return False, "Critical database task failed"

        # Check 3: Time limit exceeded?
        if self.execution_time > timedelta(hours=2):
            return False, "Time limit exceeded (2 hours)"

        # Check 4: Received stop signal?
        if await self.message_bus.has_event('build.stop', self.execution_id):
            return False, "Stop signal received"

        return True, "Continue"
```

### 5.4 Skills & Tools

```python
BUILD_AGENT_SKILLS = {

    # CONTEXT LOADING
    'prime': {
        'description': 'Load all context for build execution',
        'uses': ['Database', 'File system', 'Knowledge Base'],
        'triggers': 'Start of build'
    },

    # CODE GENERATION
    'generate_code': {
        'description': 'Generate code for a task using Claude',
        'uses': ['Claude API'],
        'inputs': ['task definition', 'code template', 'gotchas', 'conventions'],
        'outputs': ['generated code']
    },

    # FILE OPERATIONS
    'write_file': {
        'description': 'Write generated code to file',
        'uses': ['File system', 'Git'],
        'requires': ['File lock']
    },

    # VALIDATION
    'run_validation': {
        'description': 'Execute task validation command',
        'uses': ['Shell execution'],
        'commands': ['npx tsc', 'npm test', 'sqlite3']
    },

    # GIT OPERATIONS
    'git_commit': {
        'description': 'Commit task changes',
        'uses': ['GitManager'],
        'triggers': 'After successful validation'
    },

    # CHECKPOINT
    'create_checkpoint': {
        'description': 'Create rollback point before task',
        'uses': ['CheckpointManager', 'Git'],
        'triggers': 'Before each task'
    },

    'rollback': {
        'description': 'Restore to checkpoint on failure',
        'uses': ['CheckpointManager', 'Git'],
        'triggers': 'On task failure'
    },

    # KNOWLEDGE
    'record_discovery': {
        'description': 'Record new pattern or gotcha',
        'uses': ['Knowledge Base'],
        'triggers': 'When learning something new'
    },

    # LOCKING
    'acquire_lock': {
        'description': 'Get exclusive file lock',
        'uses': ['MessageBus'],
        'blocks_if': 'File already locked'
    },

    'release_lock': {
        'description': 'Release file lock',
        'uses': ['MessageBus'],
        'triggers': 'After task complete or failure'
    }
}
```

### 5.5 Claude Prompt Construction

```python
# coding-loops/agents/build_agent.py

def build_task_prompt(
    self,
    task: AtomicTask,
    context: PrimeResult
) -> str:

    prompt = f"""
# BUILD TASK: {task.id}

## Action
{task.action} file: {task.file}

## Requirements
{chr(10).join(f'- {r}' for r in task.requirements)}

## Gotchas (AVOID THESE MISTAKES)
{chr(10).join(f'- {g.content}' for g in task.gotchas)}

## Project Conventions (from CLAUDE.md)
{context.conventions}

## Code Template (use as starting point)
```

{task.code_template}

```

## Context: What This Idea Is About
{context.idea_context['readme'][:500]}

## Validation
After generating the code, it will be validated with:
```

{task.validation_command}

```
Expected result: {task.expected_validation}

## Instructions
1. Generate ONLY the file content
2. Follow all gotchas strictly
3. Use the code template as guidance
4. Ensure the validation command will pass
"""

    return prompt
```

### 5.6 Execution Isolation (Parallel Builds)

When multiple Build Agents run in parallel, each operates in an isolated execution lane:

```python
# coding-loops/agents/build_agent.py

class ExecutionIsolation:
    """
    EXECUTION LANE ISOLATION

    Each Build Agent session is isolated by execution_id. This enables:
    1. Parallel builds without interference
    2. Clean rollback per execution
    3. Accurate attribution in logs
    4. Session-specific context loading
    """

    def __init__(self, execution_id: str, loop_id: str):
        self.execution_id = execution_id
        self.loop_id = loop_id

    # CONTEXT LOADING: Only load tasks for THIS execution
    async def load_tasks_for_execution(self, task_list_id: str) -> list[Task]:
        """Load tasks scoped to this execution lane."""
        return await db.query("""
            SELECT t.* FROM tasks t
            JOIN task_list_items tli ON t.id = tli.task_id
            WHERE tli.task_list_id = ?
            AND (t.assigned_execution_id IS NULL
                 OR t.assigned_execution_id = ?)
            ORDER BY tli.position
        """, [task_list_id, self.execution_id])

    # LOGGING: Tag all logs with execution_id
    async def log_task_attempt(self, task_id: str, result: TaskResult):
        """Log attempt to execution-specific lane."""
        await db.insert("task_execution_log", {
            'task_id': task_id,
            'execution_id': self.execution_id,  # Lane isolation
            'loop_id': self.loop_id,
            'started_at': result.started_at,
            'completed_at': result.completed_at,
            'status': result.status,
            'error_message': result.error,
            'git_commit': result.commit_sha
        })

    # HANDOFF CONTEXT: Provide last 500 lines from THIS execution
    async def get_handoff_context(self) -> str:
        """Get execution log for SIA or retry context."""
        logs = await db.query("""
            SELECT tel.*, t.title, t.file_path
            FROM task_execution_log tel
            JOIN tasks t ON tel.task_id = t.id
            WHERE tel.execution_id = ?
            ORDER BY tel.started_at DESC
            LIMIT 500
        """, [self.execution_id])

        return format_execution_log(logs)

    # ROLLBACK: Only affect THIS execution's changes
    async def rollback_execution(self, checkpoint_id: str):
        """Rollback only changes made in this execution lane."""
        checkpoint = await db.query(
            "SELECT * FROM checkpoints WHERE id = ? AND execution_id = ?",
            [checkpoint_id, self.execution_id]
        )

        if not checkpoint:
            raise ValueError(f"Checkpoint not in execution lane: {checkpoint_id}")

        await self.git.reset_to(checkpoint.git_ref)
        await self.update_tasks_after_rollback(checkpoint.task_id)
```

**Lane Isolation Rules:**

| Scenario                     | Isolation Behavior                                      |
| ---------------------------- | ------------------------------------------------------- |
| Parallel builds on same idea | Each gets unique execution_id, separate logs            |
| Task failure                 | Only affects current execution lane                     |
| SIA analysis                 | Receives only current execution's logs (last 500 lines) |
| Rollback                     | Only reverts changes from current execution             |
| Context loading              | Tasks filtered by execution_id assignment               |

**Why Lane Isolation Matters:**

1. **Clean Attribution**: Each build's successes/failures tracked separately
2. **Parallel Safety**: Multiple loops can work on related tasks without cross-contamination
3. **Accurate SIA Analysis**: SIA sees only relevant failure context
4. **Surgical Rollback**: Revert one build without affecting another

---

## 6. Task Agent

The Task Agent is the always-on orchestrator that manages task lists, suggests next actions via Telegram, and coordinates with the Build Agent for execution.

> **Task Agent operates in two phases:**
>
> - **Phase 1: Specification Generation** - Triggered by `ideation.completed`, generates spec.md and tasks.md using the logic documented in Section 4 (deprecated Spec Agent). This phase replaces the standalone Specification Agent.
> - **Phase 2: Task Orchestration** - Always-on service that manages task execution, suggestions, and Build Agent coordination.

### 6.1 Trigger

```
TRIGGER: Always-on service with continuous suggestion loop
         Event "ideation.completed" (triggers Phase 1: spec generation)
         Event "task.created" (new task available)
         Event "task.completed" (progress update)
         Event "task.failed" (handle failure)
         Telegram commands from user
         Timer: Stale check every 6 hours
```

### 6.2 Core Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TASK AGENT RESPONSIBILITIES                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. VALIDATION GATE                                                          │
│     └─ Ensures tasks have required fields before execution                   │
│                                                                              │
│  2. CONTINUOUS SUGGESTION                                                    │
│     └─ Suggests next best task/list to user via Telegram                    │
│                                                                              │
│  3. TASK LIST MANAGEMENT                                                     │
│     └─ Groups tasks, tracks progress, one Telegram chat per list            │
│                                                                              │
│  4. DEPENDENCY RESOLUTION                                                    │
│     └─ Tracks 11 relationship types, auto-unblocks on completion            │
│                                                                              │
│  5. PRIORITY CALCULATION                                                     │
│     └─ BlockedCount × 20 + QuickWinBonus + DeadlineBonus + Advice           │
│                                                                              │
│  6. DUPLICATE DETECTION                                                      │
│     └─ Finds similar tasks, suggests merge                                   │
│                                                                              │
│  7. BUILD AGENT COORDINATION                                                 │
│     └─ Sends approved task lists to Build Agent for execution               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Context Loading

```typescript
// server/services/task-agent/task-agent.ts

class TaskAgent {
  async loadContext(taskListId?: string): Promise<TaskAgentContext> {
    // 1. LOAD ACTIVE TASK LISTS
    const activeLists = await db.query(`
      SELECT * FROM task_lists
      WHERE status IN ('active', 'paused')
      ORDER BY updated_at DESC
    `);

    // 2. LOAD READY TASKS (pass validation, no blockers)
    const readyTasks = await db.query(`
      SELECT t.*, tl.telegram_chat_id
      FROM tasks t
      LEFT JOIN task_list_items tli ON t.id = tli.task_id
      LEFT JOIN task_lists tl ON tli.task_list_id = tl.id
      WHERE t.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM task_relationships tr
          WHERE tr.source_task_id = t.id
            AND tr.relationship_type = 'depends_on'
            AND EXISTS (
              SELECT 1 FROM tasks dep
              WHERE dep.id = tr.target_task_id
                AND dep.status NOT IN ('completed', 'skipped')
            )
        )
      ORDER BY t.priority DESC
    `);

    // 3. LOAD BLOCKED TASKS (for dependency tracking)
    const blockedTasks = await db.query(`
      SELECT t.*, tr.target_task_id as blocked_by
      FROM tasks t
      JOIN task_relationships tr ON t.id = tr.source_task_id
      WHERE t.status = 'blocked'
        AND tr.relationship_type = 'depends_on'
    `);

    // 4. LOAD PENDING QUESTIONS
    const questions = await db.query(`
      SELECT * FROM questions
      WHERE status = 'pending'
      ORDER BY priority DESC, created_at ASC
    `);

    // 5. LOAD TELEGRAM CHATS (for notifications)
    const telegramChats = await db.query(`
      SELECT DISTINCT telegram_chat_id, name
      FROM task_lists
      WHERE telegram_chat_id IS NOT NULL
    `);

    // 6. CALCULATE PRIORITIES
    const prioritizedTasks =
      await this.priorityCalculator.calculate(readyTasks);

    return {
      activeLists,
      readyTasks: prioritizedTasks,
      blockedTasks,
      questions,
      telegramChats,
    };
  }
}
```

### 6.4 Decision Logic

```typescript
// server/services/task-agent/suggestion-engine.ts

class SuggestionEngine {
  // DECISION: What to suggest next?
  async getNextSuggestion(
    context: TaskAgentContext,
  ): Promise<Suggestion | null> {
    // 1. Check for blocking questions first
    if (context.questions.length > 0) {
      const topQuestion = context.questions[0];
      return {
        type: "question",
        content: topQuestion,
        priority: 100,
        reason: "Blocking question needs answer",
      };
    }

    // 2. Check for ready task lists
    const readyLists = context.activeLists.filter(
      (list) =>
        list.status === "active" &&
        this.hasReadyTasks(list, context.readyTasks),
    );

    if (readyLists.length > 0) {
      const topList = this.selectBestList(readyLists, context);
      return {
        type: "task_list",
        content: topList,
        priority: topList.priority,
        reason: this.explainWhyThisList(topList),
      };
    }

    // 3. Check for individual high-priority tasks
    if (context.readyTasks.length > 0) {
      const topTask = context.readyTasks[0]; // Already sorted by priority
      return {
        type: "task",
        content: topTask,
        priority: topTask.priority,
        reason: this.explainWhyThisTask(topTask),
      };
    }

    // 4. Nothing ready - check for parallelization opportunities
    const parallelOpportunities = this.findParallelOpportunities(context);
    if (parallelOpportunities.length > 0) {
      return {
        type: "parallel_opportunity",
        content: parallelOpportunities,
        priority: 50,
        reason: "These tasks can run in parallel",
      };
    }

    // 5. Nothing to suggest
    return null;
  }

  // DECISION: Should we send a notification?
  shouldNotify(suggestion: Suggestion, lastNotification: Date): boolean {
    const timeSinceLast = Date.now() - lastNotification.getTime();
    const MIN_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // Always notify for blocking questions
    if (suggestion.type === "question") {
      return true;
    }

    // Respect minimum interval for task suggestions
    if (timeSinceLast < MIN_INTERVAL) {
      return false;
    }

    // Notify for high priority tasks
    if (suggestion.priority > 80) {
      return true;
    }

    // Don't spam with low priority suggestions
    return false;
  }
}

// server/services/task-agent/priority-calculator.ts

class PriorityCalculator {
  // Priority Formula: BlockedCount × 20 + QuickWinBonus + DeadlineBonus + TaskAgentAdvice
  async calculate(tasks: Task[]): Promise<Task[]> {
    for (const task of tasks) {
      let priority = 0;

      // 1. Blocked count bonus (how many tasks depend on this)
      const blockedCount = await this.getBlockedCount(task.id);
      priority += blockedCount * 20;

      // 2. Quick win bonus (small tasks get priority)
      if (task.effort === "small" || task.estimated_minutes < 30) {
        priority += 10;
      }

      // 3. Deadline bonus
      if (task.deadline) {
        const daysUntil = this.daysUntilDeadline(task.deadline);
        if (daysUntil <= 1) priority += 15;
        else if (daysUntil <= 3) priority += 10;
        else if (daysUntil <= 7) priority += 5;
      }

      // 4. Task Agent advice (strategic recommendations)
      priority += await this.getStrategicBonus(task);

      task.priority = priority;
    }

    return tasks.sort((a, b) => b.priority - a.priority);
  }

  private async getBlockedCount(taskId: string): Promise<number> {
    const result = await db.query(
      `
      SELECT COUNT(*) as count
      FROM task_relationships
      WHERE target_task_id = ? AND relationship_type = 'depends_on'
    `,
      [taskId],
    );
    return result[0].count;
  }
}
```

### 6.5 Telegram Integration

```typescript
// server/services/task-agent/telegram-handler.ts

class TelegramHandler {
  // One chat per task list
  async sendSuggestion(suggestion: Suggestion, chatId: string): Promise<void> {
    let message: string;
    let buttons: InlineKeyboard;

    switch (suggestion.type) {
      case "task_list":
        message = this.formatTaskListSuggestion(suggestion.content);
        buttons = [
          [
            {
              text: "✅ Execute Now",
              callback_data: `execute:${suggestion.content.id}`,
            },
          ],
          [
            {
              text: "⏸️ Later",
              callback_data: `later:${suggestion.content.id}`,
            },
          ],
          [
            {
              text: "📄 Details",
              callback_data: `details:${suggestion.content.id}`,
            },
          ],
        ];
        break;

      case "task":
        message = this.formatTaskSuggestion(suggestion.content);
        buttons = [
          [
            {
              text: "▶️ Execute",
              callback_data: `execute_task:${suggestion.content.id}`,
            },
          ],
          [{ text: "❌ Skip", callback_data: `skip:${suggestion.content.id}` }],
        ];
        break;

      case "question":
        message = this.formatQuestion(suggestion.content);
        buttons = suggestion.content.options.map((opt) => [
          {
            text: opt.label,
            callback_data: `answer:${suggestion.content.id}:${opt.value}`,
          },
        ]);
        break;
    }

    await this.telegram.sendMessage(chatId, message, {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "Markdown",
    });
  }

  private formatTaskListSuggestion(list: TaskList): string {
    return `📋 *SUGGESTED NEXT ACTION*

I recommend executing task list: *${list.name}*

📊 *Why:* ${this.getRecommendationReason(list)}
⚠️ *Risk:* ${list.risk_level}
⏱️ *Tasks:* ${list.tasks_total}

${list.description || ""}`;
  }

  // Handle Telegram commands
  async handleCommand(
    command: string,
    args: string[],
    chatId: string,
  ): Promise<void> {
    switch (command) {
      case "/start":
        await this.handleStart(chatId);
        break;
      case "/status":
        await this.sendStatus(chatId);
        break;
      case "/lists":
        await this.sendActiveLists(chatId);
        break;
      case "/list":
        await this.sendListDetails(args[0], chatId);
        break;
      case "/suggest":
        await this.sendNextSuggestion(chatId);
        break;
      case "/execute":
        await this.executeTaskList(args[0], chatId);
        break;
      case "/pause":
        await this.pauseExecution(args[0], chatId);
        break;
      case "/resume":
        await this.resumeExecution(args[0], chatId);
        break;
      case "/questions":
        await this.sendPendingQuestions(chatId);
        break;
      case "/answer":
        await this.handleAnswer(args[0], args.slice(1).join(" "), chatId);
        break;
      case "/parallel":
        await this.sendParallelOpportunities(chatId);
        break;
      case "/duplicates":
        await this.sendDuplicates(chatId);
        break;
      case "/help":
        await this.sendHelp(chatId);
        break;
    }
  }
}
```

### 6.6 Skills & Tools

```typescript
const TASK_AGENT_SKILLS = {
  // VALIDATION
  validateTask: {
    description: "Check task has required fields and passes rules",
    uses: ["ValidationService", "Database"],
    outputs: ["validation result", "blocking issues"],
  },

  // PRIORITY
  calculatePriority: {
    description: "Calculate task priority using formula",
    uses: ["PriorityCalculator", "Database"],
    outputs: ["priority score", "explanation"],
  },

  // SUGGESTION
  generateSuggestion: {
    description: "Determine next best action for user",
    uses: ["SuggestionEngine", "Context"],
    outputs: ["suggestion with reasoning"],
  },

  // DEPENDENCY MANAGEMENT
  resolveDependencies: {
    description: "Auto-unblock tasks when dependencies complete",
    uses: ["Database", "MessageBus"],
    triggers: "On task.completed event",
  },

  // DUPLICATE DETECTION
  findDuplicates: {
    description: "Find similar tasks and suggest merge",
    uses: ["DuplicateDetector", "Similarity scoring"],
    outputs: ["duplicate pairs with scores"],
  },

  // TASK LIST MANAGEMENT
  manageTaskList: {
    description: "Create, update, track task lists",
    uses: ["TaskListManager", "Database"],
    outputs: ["task list state changes"],
  },

  // TELEGRAM COMMUNICATION
  notifyUser: {
    description: "Send messages and suggestions via Telegram",
    uses: ["TelegramHandler", "MessageFormatting"],
    triggers: "On suggestion ready or event",
  },

  // BUILD AGENT COORDINATION
  dispatchToBuild: {
    description: "Send approved task list to Build Agent",
    uses: ["MessageBus", "Event publishing"],
    triggers: "On user approval via Telegram",
  },

  // STALE DETECTION
  checkStale: {
    description: "Find tasks inactive for 7+ days",
    uses: ["Database query", "Timer"],
    triggers: "Every 6 hours",
  },
};
```

### 6.7 Event Subscriptions

```typescript
// Task Agent event subscriptions

const TASK_AGENT_SUBSCRIPTIONS = [
  "task.created", // New task available
  "task.updated", // Task modified
  "task.completed", // Task finished - trigger unblock
  "task.failed", // Task failed - handle escalation
  "task_list.approved", // User approved list - dispatch to Build
  "task_list.paused", // User paused execution
  "task_list.resumed", // User resumed execution
  "question.answered", // User answered question
  "build.completed", // Build Agent finished
  "build.failed", // Build Agent failed
  "stale.check", // Timer event for stale detection
];
```

### 6.8 Relationship Types

The Task Agent tracks 11 relationship types between tasks:

| Type             | Direction | Description                        |
| ---------------- | --------- | ---------------------------------- |
| `depends_on`     | A → B     | A cannot start until B completes   |
| `blocks`         | A → B     | A blocks B (inverse of depends_on) |
| `related_to`     | A ↔ B     | Thematic connection                |
| `duplicate_of`   | A → B     | A is duplicate of B                |
| `subtask_of`     | A → B     | A is part of B                     |
| `supersedes`     | A → B     | A replaces B                       |
| `implements`     | A → B     | A implements spec/requirement B    |
| `conflicts_with` | A ↔ B     | Cannot run simultaneously          |
| `enables`        | A → B     | A enables/unlocks B                |
| `inspired_by`    | A → B     | A was inspired by B                |
| `tests`          | A → B     | A tests/validates B                |

---

---

_This document covers pipeline agents. For SIA, Monitor, PM agents and cross-cutting concerns, see [AGENT-SPECIFICATIONS-INFRASTRUCTURE.md](./AGENT-SPECIFICATIONS-INFRASTRUCTURE.md)._
