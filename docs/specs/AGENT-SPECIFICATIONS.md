# Agent Specifications

**Created:** 2026-01-10
**Purpose:** Definitive reference for agent internals - triggers, context, decisions, skills
**Status:** Implementation Guide

---

## Table of Contents

1. [Agent Overview](#1-agent-overview)
2. [Routing & Orchestration](#2-routing--orchestration)
3. [Ideation Agent](#3-ideation-agent)
4. [Specification Agent](#4-specification-agent)
5. [Build Agent](#5-build-agent)
6. [Self-Improvement Agent (SIA)](#6-self-improvement-agent-sia)
7. [Monitor Agent](#7-monitor-agent)
8. [PM Agent](#8-pm-agent)
9. [Context Loading Strategies](#9-context-loading-strategies)
10. [Knowledge Base Integration](#10-knowledge-base-integration)
11. [Proactive Questioning](#11-proactive-questioning)

---

## 1. Agent Overview

### 1.1 Agent Registry

| Agent | Location | Language | Trigger Type | Primary Role |
|-------|----------|----------|--------------|--------------|
| **Ideation Agent** | `agents/ideation/` | TypeScript | User message | Explore & develop ideas |
| **Specification Agent** | `agents/specification/` | TypeScript | Event / API | Generate specs from ideas |
| **Build Agent** | `coding-loops/agents/` | Python | Event | Execute code tasks |
| **SIA** | `coding-loops/agents/` | Python | Event | Learn from outcomes |
| **Monitor Agent** | `coding-loops/agents/` | Python | Timer | Watch system health |
| **PM Agent** | `coding-loops/agents/` | Python | Event | Coordinate & resolve |

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
│              ▼                               ▼                              │
│  ┌─────────────────────┐        ┌─────────────────────────────────┐        │
│  │ Check session state │        │ Is this an EVENT from MessageBus?│        │
│  │ - Has active idea?  │        └─────────────────────────────────┘        │
│  │ - Which phase?      │                     │                              │
│  └──────────┬──────────┘        ┌────────────┴────────────┐                 │
│             │                   ▼                         ▼                 │
│             ▼                  YES                        NO                │
│  ┌─────────────────────┐        │                         │                 │
│  │  IDEATION AGENT     │        ▼                         ▼                 │
│  │  (always for chat)  │   Route by event_type:      (Timer/Cron)          │
│  └─────────────────────┘        │                         │                 │
│                                 ├─ spec.approved         ▼                 │
│                                 │  → BUILD AGENT    MONITOR AGENT          │
│                                 │                                           │
│                                 ├─ build.completed                          │
│                                 │  → SIA                                    │
│                                 │                                           │
│                                 ├─ alert.*                                  │
│                                 │  → PM AGENT                               │
│                                 │                                           │
│                                 └─ ideation.completed                       │
│                                    → (wait for user action)                 │
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
        "ideation.completed",      # Can auto-trigger spec generation
        "spec.revision_requested"  # User requested changes
    ],

    "build-agent": [
        "spec.approved",           # Start building
        "build.resume",            # Resume interrupted build
        "task.retry"               # Retry failed task
    ],

    "sia-agent": [
        "build.completed",         # Review build outcome
        "ideation.completed",      # Review ideation session
        "spec.generated",          # Review spec quality
        "task.failed"              # Immediate gotcha extraction
    ],

    "monitor-agent": [
        # Timer-based, not event-based
        # Polls every 2 minutes
    ],

    "pm-agent": [
        "alert.stuck_task",        # Task timeout
        "alert.deadlock",          # Circular wait detected
        "alert.build_failed",      # Build failure
        "conflict.detected",       # File ownership conflict
        "decision.requested"       # Human decision needed
    ]
}
```

### 2.3 Handoff Conditions

| From Agent | To Agent | Condition | Mechanism |
|------------|----------|-----------|-----------|
| Ideation → Spec | All 4 phases complete | `ideation.completed` event + user action |
| Spec → Build | User approves spec | `spec.approved` event |
| Build → SIA | Build completes (success or fail) | `build.completed` event |
| Monitor → PM | Alert threshold exceeded | `alert.*` event |
| PM → Build | Work reassigned | `work.assigned` event |
| Any → Human | Decision needed | Telegram notification |

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
    limit: 20,           // Last 20 messages
    includeSignals: true // Include extracted signals
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
      session.ideaSlug
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
    phasePrompt
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

      case 'EXPLORING':
        // TRANSITION WHEN: Basic idea shape is clear
        const hasTargetUser = signals.artifacts.some(a => a.type === 'target-user');
        const hasProblem = signals.artifacts.some(a => a.type === 'problem');
        const hasSolutionConcept = signals.artifacts.some(a => a.type === 'solution-concept');

        if (hasTargetUser && hasProblem && hasSolutionConcept) {
          return { shouldTransition: true, nextPhase: 'NARROWING' };
        }
        break;

      case 'NARROWING':
        // TRANSITION WHEN: Scope is defined
        const hasMVPFeatures = signals.artifacts.some(a => a.type === 'mvp-features');
        const hasDifferentiator = signals.artifacts.some(a => a.type === 'differentiator');
        const avgConfidence = this.calculateAverageConfidence(signals);

        if (hasMVPFeatures && hasDifferentiator && avgConfidence > 0.6) {
          return { shouldTransition: true, nextPhase: 'VALIDATING' };
        }
        break;

      case 'VALIDATING':
        // TRANSITION WHEN: Key assumptions validated
        const validatedAssumptions = signals.decisions.filter(d => d.type === 'validation');
        const hasMarketValidation = validatedAssumptions.length >= 3;
        const risksIdentified = signals.risks.length > 0;

        if (hasMarketValidation && risksIdentified) {
          return { shouldTransition: true, nextPhase: 'REFINING' };
        }
        break;

      case 'REFINING':
        // TRANSITION WHEN: Idea is ready for specification
        const overallConfidence = signals.confidence;
        const hasBrief = signals.artifacts.some(a => a.type === 'brief');

        if (overallConfidence > 0.75 || hasBrief) {
          return { shouldTransition: true, nextPhase: 'COMPLETE' };
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
    contextRequired: ["memory", "signals", "phasePrompt"]
  },

  // SIGNAL EXTRACTION
  extractSignals: {
    description: "Parse Claude response for artifacts, decisions, risks",
    uses: ["Regex patterns", "Claude for complex extraction"],
    triggers: "After every Claude response"
  },

  // ARTIFACT MANAGEMENT
  saveArtifact: {
    description: "Save extracted content to idea folder",
    uses: ["File system", "UnifiedArtifactStore"],
    triggers: "When high-confidence artifact detected"
  },

  // WEB SEARCH (optional)
  webSearch: {
    description: "Search web for market/competitive data",
    uses: ["WebSearchService", "Tavily API"],
    triggers: "User asks about market, competitors, or validation"
  },

  // HANDOFF
  generateBrief: {
    description: "Create handoff brief for Specification Agent",
    uses: ["HandoffGenerator", "File system"],
    triggers: "Phase = COMPLETE"
  },

  // CANDIDATE MANAGEMENT
  createCandidate: {
    description: "Create idea candidate record",
    uses: ["CandidateManager", "Database"],
    triggers: "First artifact saved"
  }
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
      ${context.signals.artifacts.map(a => `- ${a.type}: ${a.summary}`).join('\n')}
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
      Goals: ${context.userProfile.goals.join(', ')}
      Skills: ${context.userProfile.skills.join(', ')}
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

  return sections.join('\n\n');
}
```

---

## 4. Specification Agent

### 4.1 Trigger

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

async function loadSpecContext(ideaSlug: string, userSlug: string): Promise<SpecContext> {

  const ideaPath = `users/${userSlug}/ideas/${ideaSlug}`;

  // 1. REQUIRED DOCUMENTS (must exist)
  const required = {
    readme: await readFile(`${ideaPath}/README.md`),
    brief: await readFile(`${ideaPath}/planning/brief.md`),
  };

  if (!required.readme || !required.brief) {
    throw new Error('Missing required documents for spec generation');
  }

  // 2. OPTIONAL DOCUMENTS (enhance spec quality)
  const optional = {
    targetUsers: await readFileIfExists(`${ideaPath}/target-users.md`),
    problemSolution: await readFileIfExists(`${ideaPath}/problem-solution.md`),
    development: await readFileIfExists(`${ideaPath}/development.md`),
    marketResearch: await readFileIfExists(`${ideaPath}/research/market.md`),
    competitiveResearch: await readFileIfExists(`${ideaPath}/research/competitive.md`),
    technicalResearch: await readFileIfExists(`${ideaPath}/research/technical.md`),
    mvpScope: await readFileIfExists(`${ideaPath}/planning/mvp-scope.md`),
  };

  // 3. PROJECT CONVENTIONS (from CLAUDE.md)
  const conventions = await loadClaudeMdSections([
    'Database Conventions',
    'API Conventions',
    'File Locations',
    'Atomic Task Conventions'
  ]);

  // 4. KNOWLEDGE BASE QUERIES
  const gotchas = await KnowledgeBase.query({
    itemType: 'gotcha',
    filePatterns: ['*.sql', 'server/routes/*', 'types/*'],
    minConfidence: 0.7
  });

  const patterns = await KnowledgeBase.query({
    itemType: 'pattern',
    topics: extractTopics(required.readme), // e.g., ['habits', 'tracking', 'mobile']
    minConfidence: 0.7
  });

  // 5. EXISTING CODEBASE ANALYSIS
  const existingFiles = await analyzeCodebase({
    patterns: ['server/routes/*.ts', 'types/*.ts', 'database/migrations/*.sql'],
    purpose: 'understand existing patterns'
  });

  return {
    required,
    optional,
    conventions,
    gotchas,
    patterns,
    existingFiles
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
          owner: 'build-agent'
        });
      }

      // Types needed?
      if (feature.hasEntities) {
        newFiles.push({
          path: `types/${feature.slug}.ts`,
          purpose: `Types for ${feature.name}`,
          owner: 'build-agent'
        });
      }

      // API routes needed?
      if (feature.hasAPI) {
        newFiles.push({
          path: `server/routes/${feature.slug}.ts`,
          purpose: `API endpoints for ${feature.name}`,
          owner: 'build-agent'
        });
      }

      // Tests needed?
      newFiles.push({
        path: `tests/${feature.slug}.test.ts`,
        purpose: `Tests for ${feature.name}`,
        owner: 'build-agent'
      });
    }

    return newFiles;
  }

  // DECISION: What files need to be modified?
  async identifyModifiedFiles(context: SpecContext, newFiles: FileSpec[]): Promise<FileModification[]> {

    const modifications: FileModification[] = [];

    // api.ts needs to import new routes
    const newRoutes = newFiles.filter(f => f.path.includes('server/routes/'));
    if (newRoutes.length > 0) {
      modifications.push({
        path: 'server/api.ts',
        changes: `Import and mount: ${newRoutes.map(r => r.path).join(', ')}`,
        owner: await ResourceRegistry.getOwner('server/api.ts')
      });
    }

    // types/index.ts needs to export new types
    const newTypes = newFiles.filter(f => f.path.includes('types/'));
    if (newTypes.length > 0) {
      modifications.push({
        path: 'types/index.ts',
        changes: `Export: ${newTypes.map(t => t.path).join(', ')}`,
        owner: await ResourceRegistry.getOwner('types/index.ts')
      });
    }

    return modifications;
  }

  // DECISION: What gotchas apply to each task?
  async assignGotchas(tasks: AtomicTask[], gotchas: Gotcha[]): Promise<void> {

    for (const task of tasks) {
      // Match by file pattern
      const fileGotchas = gotchas.filter(g =>
        this.matchPattern(task.file, g.filePattern)
      );

      // Match by action type
      const actionGotchas = gotchas.filter(g =>
        g.actionType === task.action
      );

      // Combine and deduplicate
      task.gotchas = [...new Set([...fileGotchas, ...actionGotchas])]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5); // Max 5 gotchas per task
    }
  }

  // DECISION: What order should tasks execute?
  determineTaskOrder(tasks: AtomicTask[]): AtomicTask[] {

    // Phase order priority
    const phaseOrder = ['database', 'types', 'queries', 'api', 'ui', 'tests'];

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
    inputs: ["README.md", "brief.md", "development.md"]
  },

  // REQUIREMENT EXTRACTION
  extractRequirements: {
    description: "Convert natural language to formal requirements",
    uses: ["Claude API"],
    outputs: ["Functional requirements", "Non-functional requirements"]
  },

  // ARCHITECTURE DESIGN
  designArchitecture: {
    description: "Determine files, APIs, data models",
    uses: ["Claude API", "Codebase analysis"],
    outputs: ["New files list", "Modified files list", "Data models"]
  },

  // TASK GENERATION
  generateTasks: {
    description: "Break down into atomic tasks",
    uses: ["Claude API", "Task templates"],
    outputs: ["tasks.md with YAML task blocks"]
  },

  // GOTCHA INJECTION
  injectGotchas: {
    description: "Add relevant gotchas to each task",
    uses: ["Knowledge Base queries"],
    triggers: "During task generation"
  },

  // VALIDATION
  validateSpec: {
    description: "Check spec completeness and consistency",
    uses: ["Schema validation", "Dependency checking"],
    outputs: ["Validation report", "Missing inputs list"]
  },

  // OUTPUT GENERATION
  renderSpec: {
    description: "Generate spec.md and tasks.md files",
    uses: ["Template rendering", "File system"],
    outputs: ["build/spec.md", "build/tasks.md"]
  }
};
```

---

## 5. Build Agent

### 5.1 Trigger

```
TRIGGER: Event "spec.approved"
         OR: Event "build.resume" (for interrupted builds)
         OR: Event "task.retry" (for failed task retry)

REQUIRED INPUT (from event payload):
  - spec_id: string
  - idea_slug: string
  - user_slug: string
```

### 5.2 Context Loading

```python
# coding-loops/agents/build_agent.py

class BuildAgent:

    async def prime(self, spec_id: str) -> PrimeResult:
        """Load all context needed for build execution."""

        # 1. LOAD SPEC METADATA
        spec = await db.query(
            "SELECT * FROM specifications WHERE id = ?",
            [spec_id]
        )

        # 2. LOAD ATOMIC TASKS
        tasks = await db.query(
            "SELECT * FROM atomic_tasks WHERE spec_id = ? ORDER BY task_number",
            [spec_id]
        )

        # 3. LOAD SPEC.MD FILE
        spec_content = await read_file(
            f"users/{spec.user_slug}/ideas/{spec.idea_slug}/build/spec.md"
        )

        # 4. LOAD TASKS.MD FILE
        tasks_content = await read_file(
            f"users/{spec.user_slug}/ideas/{spec.idea_slug}/build/tasks.md"
        )

        # 5. LOAD CLAUDE.MD (project conventions)
        claude_md = await read_file("CLAUDE.md")
        # Extract relevant sections:
        conventions = extract_sections(claude_md, [
            "Database Conventions",
            "API Conventions",
            "Build Agent Workflow"
        ])

        # 6. LOAD IDEA CONTEXT (for understanding)
        idea_context = {
            'readme': await read_file(f"users/.../README.md"),
            'problem_solution': await read_file(f"users/.../problem-solution.md"),
            'target_users': await read_file(f"users/.../target-users.md"),
        }

        # 7. QUERY KNOWLEDGE BASE FOR GOTCHAS
        # Get gotchas for each unique file pattern in tasks
        file_patterns = set(task.file for task in tasks)
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
            owner = await self.resource_registry.get_owner(task.file)
            ownership[task.file] = owner

            if owner and owner != self.loop_id:
                # File owned by another loop - need to coordinate
                task.requires_coordination = True

        # 9. CREATE EXECUTION RECORD
        execution_id = await db.insert("build_executions", {
            'spec_id': spec_id,
            'loop_id': self.loop_id,
            'branch_name': f"build/{spec.idea_slug}",
            'status': 'priming',
            'tasks_total': len(tasks)
        })

        return PrimeResult(
            spec=spec,
            tasks=tasks,
            spec_content=spec_content,
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

---

## 6. Self-Improvement Agent (SIA)

### 6.1 Trigger

```
TRIGGER: Event "build.completed" (primary)
         Event "ideation.completed" (secondary)
         Event "task.failed" (immediate gotcha extraction)
```

### 6.2 Context Loading

```python
# coding-loops/agents/sia_agent.py

class SIAAgent:

    async def load_review_context(self, execution_id: str) -> ReviewContext:

        # 1. LOAD EXECUTION RECORD
        execution = await db.query(
            "SELECT * FROM build_executions WHERE id = ?",
            [execution_id]
        )

        # 2. LOAD ALL TASK RESULTS
        tasks = await db.query(
            "SELECT * FROM atomic_tasks WHERE execution_id = ?",
            [execution_id]
        )

        # 3. LOAD SPEC (what was planned)
        spec = await db.query(
            "SELECT * FROM specifications WHERE id = ?",
            [execution.spec_id]
        )
        spec_content = await read_file(spec.spec_path)
        tasks_content = await read_file(spec.tasks_path)

        # 4. LOAD GIT DIFF (what actually changed)
        git_diff = await self.git.diff(
            from_ref=execution.git_commits[0] + "^",  # Before first commit
            to_ref=execution.git_commits[-1]          # After last commit
        )

        # 5. LOAD TEST RESULTS
        test_results = json.loads(execution.final_validation)

        # 6. LOAD PREVIOUS SIMILAR REVIEWS (for pattern matching)
        similar_reviews = await db.query("""
            SELECT * FROM system_reviews
            WHERE agent_type = 'build'
            AND outcome = ?
            ORDER BY reviewed_at DESC
            LIMIT 10
        """, [execution.status])

        return ReviewContext(
            execution=execution,
            tasks=tasks,
            spec_content=spec_content,
            tasks_content=tasks_content,
            git_diff=git_diff,
            test_results=test_results,
            similar_reviews=similar_reviews
        )
```

### 6.3 Decision Logic

```python
# coding-loops/agents/sia_agent.py

class SIAAgent:

    # DECISION: What type of divergence is this?
    def classify_divergence(self, divergence: Divergence) -> str:
        """
        GOOD divergences (keep):
        - Enhancement: Added something beneficial not in spec
        - Optimization: Made code more efficient
        - Best practice: Applied known good pattern

        BAD divergences (learn from):
        - Shortcut: Skipped required step
        - Mistake: Introduced bug
        - Deviation: Strayed from spec without reason
        """

        if divergence.type == 'addition':
            # Added something not in spec
            if self.is_beneficial(divergence):
                return 'GOOD:enhancement'
            else:
                return 'BAD:scope_creep'

        elif divergence.type == 'omission':
            # Skipped something in spec
            if divergence.was_intentional:
                return 'NEUTRAL:intentional_skip'
            else:
                return 'BAD:missed_requirement'

        elif divergence.type == 'modification':
            # Changed approach from spec
            if self.is_improvement(divergence):
                return 'GOOD:optimization'
            else:
                return 'BAD:deviation'

        return 'UNKNOWN'

    # DECISION: Should we record this as a gotcha?
    def should_record_gotcha(self, failure: TaskFailure) -> bool:

        # Yes if: Task failed and we learned something
        if failure.was_self_corrected:
            return True

        # Yes if: Same mistake was made before
        if self.seen_similar_failure(failure):
            return True

        # No if: One-off environmental issue
        if failure.error_type in ['NETWORK', 'TIMEOUT', 'RESOURCE']:
            return False

        return failure.is_reproducible

    # DECISION: Should we update CLAUDE.md?
    def should_update_claude_md(self, pattern: Pattern) -> bool:

        # Threshold for CLAUDE.md inclusion
        return (
            pattern.confidence >= 0.9 and
            pattern.occurrences >= 3 and
            pattern.is_universal and  # Applies across ideas, not just one
            not self.already_in_claude_md(pattern)
        )

    # DECISION: What metrics to track?
    def extract_metrics(self, context: ReviewContext) -> List[Metric]:

        metrics = []

        # First-pass success rate
        total_tasks = len(context.tasks)
        first_pass = sum(1 for t in context.tasks if t.attempts == 1 and t.status == 'complete')
        metrics.append(Metric(
            type='first_pass_success',
            value=first_pass / total_tasks if total_tasks > 0 else 0
        ))

        # Gotcha effectiveness
        tasks_with_gotchas = [t for t in context.tasks if t.gotchas]
        gotcha_helped = sum(1 for t in tasks_with_gotchas if t.status == 'complete' and t.attempts == 1)
        metrics.append(Metric(
            type='gotcha_effectiveness',
            value=gotcha_helped / len(tasks_with_gotchas) if tasks_with_gotchas else 0
        ))

        # Duration
        metrics.append(Metric(
            type='build_duration_minutes',
            value=(context.execution.completed_at - context.execution.started_at).total_seconds() / 60
        ))

        return metrics
```

### 6.4 Skills & Tools

```python
SIA_SKILLS = {

    'capture': {
        'description': 'Gather all session data for review',
        'uses': ['Database', 'Git', 'File system'],
        'inputs': ['execution_id']
    },

    'analyze': {
        'description': 'Compare planned vs actual',
        'uses': ['Diff analysis', 'Claude for interpretation'],
        'outputs': ['divergences', 'classifications']
    },

    'extract_patterns': {
        'description': 'Identify reusable patterns from success',
        'uses': ['Claude API'],
        'outputs': ['patterns with confidence scores']
    },

    'extract_gotchas': {
        'description': 'Identify mistakes to avoid from failures',
        'uses': ['Claude API'],
        'outputs': ['gotchas with file patterns']
    },

    'update_knowledge_base': {
        'description': 'Record patterns and gotchas',
        'uses': ['Knowledge Base'],
        'triggers': 'After extraction'
    },

    'update_claude_md': {
        'description': 'Add universal patterns to CLAUDE.md',
        'uses': ['File system', 'Git'],
        'triggers': 'High-confidence universal pattern',
        'requires': 'Pattern seen 3+ times'
    },

    'update_templates': {
        'description': 'Improve spec/tasks templates',
        'uses': ['File system'],
        'triggers': 'Structural improvement identified'
    },

    'track_metrics': {
        'description': 'Record improvement metrics',
        'uses': ['Database'],
        'outputs': ['improvement_metrics records']
    }
}
```

---

## 7. Monitor Agent

### 7.1 Trigger

```
TRIGGER: Timer-based (every 2 minutes)

NOT event-driven - continuously polls system state
```

### 7.2 Context Loading

```python
# coding-loops/agents/monitor_agent.py

class MonitorAgent:

    async def load_monitoring_context(self) -> MonitorContext:

        # 1. ACTIVE LOOPS
        loops = await db.query("""
            SELECT * FROM loops WHERE status = 'running'
        """)

        # 2. IN-PROGRESS TASKS
        active_tasks = await db.query("""
            SELECT t.*, l.name as loop_name
            FROM atomic_tasks t
            JOIN build_executions e ON t.execution_id = e.id
            JOIN loops l ON e.loop_id = l.id
            WHERE t.status = 'in_progress'
        """)

        # 3. COMPONENT HEALTH
        health = await db.query("""
            SELECT * FROM component_health
            WHERE last_heartbeat > datetime('now', '-5 minutes')
        """)

        # 4. CURRENT LOCKS
        locks = await db.query("""
            SELECT * FROM file_locks
            WHERE expires_at > datetime('now')
        """)

        # 5. WAIT GRAPH (for deadlock detection)
        waits = await db.query("""
            SELECT * FROM wait_graph
        """)

        # 6. RECENT ALERTS (to avoid duplicates)
        recent_alerts = await db.query("""
            SELECT * FROM alerts
            WHERE created_at > datetime('now', '-30 minutes')
            AND acknowledged = 0
        """)

        return MonitorContext(
            loops=loops,
            active_tasks=active_tasks,
            health=health,
            locks=locks,
            waits=waits,
            recent_alerts=recent_alerts
        )
```

### 7.3 Decision Logic

```python
# coding-loops/agents/monitor_agent.py

class MonitorAgent:

    # CHECK: Is any loop stuck?
    async def check_stuck_tasks(self, context: MonitorContext) -> List[Alert]:

        alerts = []
        now = datetime.now(timezone.utc)

        for task in context.active_tasks:
            duration = now - task.started_at

            # Different thresholds by task type
            if task.phase == 'database':
                threshold = timedelta(minutes=5)
            elif task.phase == 'tests':
                threshold = timedelta(minutes=15)
            else:
                threshold = timedelta(minutes=10)

            if duration > threshold:
                # Check if we already alerted
                existing = self.find_alert(context.recent_alerts, task.id)
                if not existing:
                    alerts.append(Alert(
                        type='stuck_task',
                        severity='warning',
                        source=task.loop_name,
                        message=f"Task {task.id} stuck for {duration.minutes} min",
                        context={'task_id': task.id, 'duration': duration}
                    ))

        return alerts

    # CHECK: Is there a deadlock?
    async def check_deadlocks(self, context: MonitorContext) -> List[Alert]:

        # Build wait graph
        graph = {}
        for wait in context.waits:
            if wait.waiter not in graph:
                graph[wait.waiter] = []
            graph[wait.waiter].append(wait.waiting_for)

        # Detect cycles using DFS
        cycles = self.find_cycles(graph)

        alerts = []
        for cycle in cycles:
            alerts.append(Alert(
                type='deadlock',
                severity='critical',
                source='monitor',
                message=f"Deadlock detected: {' -> '.join(cycle)}",
                context={'cycle': cycle}
            ))

        return alerts

    # CHECK: Is any component unhealthy?
    async def check_component_health(self, context: MonitorContext) -> List[Alert]:

        alerts = []
        expected_components = ['loop-1', 'loop-2', 'loop-3', 'pm-agent']

        healthy_components = {h.component for h in context.health}

        for component in expected_components:
            if component not in healthy_components:
                alerts.append(Alert(
                    type='component_down',
                    severity='error',
                    source='monitor',
                    message=f"Component {component} not responding"
                ))

        return alerts
```

---

## 8. PM Agent

### 8.1 Trigger

```
TRIGGER: Event "alert.*" (any alert from Monitor)
         Event "conflict.detected"
         Event "decision.requested"
```

### 8.2 Decision Logic

```python
# coding-loops/agents/pm_agent.py

class PMAgent:

    # DECISION: How to handle stuck task?
    async def handle_stuck_task(self, alert: Alert) -> PMDecision:

        task_id = alert.context['task_id']
        duration = alert.context['duration']

        # Get more context
        task = await self.get_task(task_id)
        loop = await self.get_loop(task.loop_id)

        if duration > timedelta(minutes=30):
            # Too long - interrupt
            return PMDecision(
                action='INTERRUPT',
                target=loop.id,
                reason='Task exceeded 30 minute timeout',
                follow_up='SKIP_AND_CONTINUE'
            )

        elif duration > timedelta(minutes=20):
            # Getting long - escalate to human
            return PMDecision(
                action='ESCALATE',
                target='human',
                message=f"Task {task_id} stuck for {duration.minutes} min. Skip or wait?",
                options=['wait', 'skip', 'retry']
            )

        else:
            # Monitor but don't act yet
            return PMDecision(
                action='WATCH',
                check_again_in=timedelta(minutes=5)
            )

    # DECISION: How to resolve conflict?
    async def handle_conflict(self, conflict: Conflict) -> PMDecision:

        # Who owns the file?
        owner = await self.resource_registry.get_owner(conflict.file)
        requestor = conflict.requesting_loop

        if owner is None:
            # Unowned file - first requestor gets it
            return PMDecision(
                action='GRANT',
                target=requestor,
                reason='File unowned - granting to first requestor'
            )

        elif self.is_higher_priority(requestor, owner):
            # Higher priority work needs the file
            return PMDecision(
                action='PREEMPT',
                target=owner,
                message=f'{requestor} needs {conflict.file} for higher priority work',
                follow_up='PAUSE_AND_YIELD'
            )

        else:
            # Owner keeps it
            return PMDecision(
                action='DENY',
                target=requestor,
                reason=f'File owned by {owner}',
                suggestion='Wait or request change'
            )

    # DECISION: How to redistribute work?
    async def redistribute_work(self, failed_loop: str) -> List[WorkAssignment]:

        # Get pending tasks for failed loop
        pending_tasks = await db.query("""
            SELECT * FROM atomic_tasks
            WHERE assigned_to = ? AND status IN ('pending', 'in_progress')
        """, [failed_loop])

        # Get available loops
        available_loops = await db.query("""
            SELECT * FROM loops
            WHERE status = 'running' AND id != ?
            ORDER BY current_load ASC
        """, [failed_loop])

        assignments = []
        for task in pending_tasks:
            # Find least loaded loop
            target_loop = available_loops[0] if available_loops else None

            if target_loop:
                assignments.append(WorkAssignment(
                    task_id=task.id,
                    from_loop=failed_loop,
                    to_loop=target_loop.id
                ))

        return assignments
```

---

## 9. Context Loading Strategies

### 9.1 Lazy Loading vs Eager Loading

```python
# When to use each strategy

CONTEXT_LOADING_STRATEGIES = {

    'ideation_agent': {
        'strategy': 'LAZY',
        'reason': 'Context grows during conversation',
        'approach': '''
            - Load session state immediately
            - Load memory on-demand (last N messages)
            - Load idea artifacts only when candidate created
            - Web search results loaded only when requested
        '''
    },

    'specification_agent': {
        'strategy': 'EAGER',
        'reason': 'Need full context for complete spec',
        'approach': '''
            - Load ALL idea documents upfront
            - Query Knowledge Base for ALL relevant gotchas
            - Analyze entire codebase for patterns
            - Cache for duration of spec generation
        '''
    },

    'build_agent': {
        'strategy': 'PHASED',
        'reason': 'Balance between completeness and efficiency',
        'approach': '''
            - PRIME phase: Load spec, tasks, conventions
            - PER-TASK: Load task-specific gotchas
            - ON-DEMAND: Load referenced files only when needed
        '''
    },

    'sia_agent': {
        'strategy': 'EAGER',
        'reason': 'Need complete picture for accurate analysis',
        'approach': '''
            - Load full execution history
            - Load complete git diff
            - Load all task results
            - Load similar past reviews for comparison
        '''
    }
}
```

### 9.2 Context Prioritization

```python
# When context exceeds budget, what to keep?

def prioritize_context(context: dict, budget: int) -> dict:
    """
    Priority order (highest first):
    1. Current task definition
    2. Relevant gotchas
    3. Code template
    4. Conventions (from CLAUDE.md)
    5. Recent memory (last 5 messages)
    6. Idea summary (README)
    7. Full memory (older messages)
    8. Research documents
    """

    priority_order = [
        ('task', context.get('task'), 1.0),           # Always include
        ('gotchas', context.get('gotchas'), 0.95),    # Almost always
        ('template', context.get('template'), 0.90),   # Very important
        ('conventions', context.get('conventions'), 0.85),
        ('recent_memory', context.get('memory')[-5:], 0.80),
        ('readme', context.get('readme'), 0.70),
        ('full_memory', context.get('memory'), 0.50),
        ('research', context.get('research'), 0.30),
    ]

    result = {}
    current_size = 0

    for key, value, priority in priority_order:
        if value is None:
            continue

        value_size = estimate_tokens(value)

        if current_size + value_size <= budget:
            result[key] = value
            current_size += value_size
        elif priority > 0.8:
            # High priority - truncate to fit
            truncated = truncate_to_fit(value, budget - current_size)
            result[key] = truncated
            break

    return result
```

---

## 10. Knowledge Base Integration

### 10.1 How Agents Query Knowledge Base

```python
# Unified Knowledge Base interface

class KnowledgeBase:

    # SPEC AGENT uses this to inject gotchas
    async def get_gotchas_for_task(
        self,
        file_path: str,
        action: str
    ) -> List[Gotcha]:
        """
        Query logic:
        1. Match by file pattern (*.sql, server/routes/*, etc.)
        2. Match by action type (CREATE, UPDATE, etc.)
        3. Sort by confidence descending
        4. Return top 5
        """

        pattern = self.get_file_pattern(file_path)
        # "database/migrations/001.sql" -> "*.sql"

        return await self.db.query("""
            SELECT * FROM knowledge
            WHERE item_type = 'gotcha'
              AND superseded_by IS NULL
              AND (file_pattern = ? OR file_pattern IS NULL)
              AND (action_type = ? OR action_type IS NULL)
              AND confidence >= 0.6
            ORDER BY
              CASE WHEN file_pattern = ? THEN 1 ELSE 2 END,
              confidence DESC
            LIMIT 5
        """, [pattern, action, pattern])

    # BUILD AGENT uses this to record discoveries
    async def record_gotcha(
        self,
        content: str,
        file_path: str,
        action: str,
        confidence: float,
        discovered_by: str
    ) -> str:
        """
        Recording logic:
        1. Check for duplicates
        2. If similar exists with lower confidence, supersede it
        3. If similar exists with higher confidence, don't record
        4. Otherwise, create new entry
        """

        # Check for similar
        similar = await self.find_similar(content)

        if similar and similar.confidence >= confidence:
            return None  # Don't record - we have better

        if similar:
            # Supersede the old one
            await self.supersede(similar.id, new_id)

        return await self.db.insert('knowledge', {
            'id': generate_id(),
            'item_type': 'gotcha',
            'content': content,
            'file_pattern': self.get_file_pattern(file_path),
            'action_type': action,
            'confidence': confidence,
            'discovered_by': discovered_by
        })

    # SIA uses this to find patterns
    async def get_patterns_for_domain(
        self,
        topics: List[str]
    ) -> List[Pattern]:
        """
        Query for reusable patterns by topic.
        Used when generating new specs to apply learned approaches.
        """

        return await self.db.query("""
            SELECT * FROM knowledge
            WHERE item_type = 'pattern'
              AND superseded_by IS NULL
              AND topic IN (?)
              AND confidence >= 0.7
            ORDER BY confidence DESC
        """, [topics])
```

### 10.2 Knowledge Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE LIFECYCLE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. DISCOVERY (Build Agent)                                                  │
│     Task fails → Agent self-corrects → Records gotcha with confidence 0.7   │
│                                                                              │
│  2. VALIDATION (SIA)                                                         │
│     Reviews discovery → Confirms or adjusts confidence                       │
│     If seen 2+ times → Boost confidence to 0.85                              │
│                                                                              │
│  3. USAGE (Spec Agent)                                                       │
│     Queries for relevant gotchas → Injects into task definitions            │
│                                                                              │
│  4. REINFORCEMENT                                                            │
│     If injected gotcha prevents failure → Boost confidence to 0.95          │
│     If injected gotcha didn't help → Lower confidence                        │
│                                                                              │
│  5. PROMOTION (SIA)                                                          │
│     Confidence >= 0.9 AND seen 3+ times → Add to CLAUDE.md                  │
│     Now universal knowledge, not just in database                           │
│                                                                              │
│  6. DEPRECATION                                                              │
│     If pattern no longer relevant (e.g., library updated)                    │
│     → Mark as superseded, won't appear in queries                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Agent Decision Matrix

| Scenario | Ideation | Spec | Build | SIA | Monitor | PM |
|----------|----------|------|-------|-----|---------|-----|
| User sends message | ✓ Process | | | | | |
| Ideation complete | | Can trigger | | Reviews | | |
| Generate spec | | ✓ Execute | | | | |
| Spec approved | | | ✓ Execute | | | |
| Task starts | | | ✓ Execute | | Watches | |
| Task fails | | | Retry/skip | Extracts gotcha | | |
| Task stuck | | | | | ✓ Detects | Resolves |
| Build complete | | | | ✓ Reviews | | |
| Conflict detected | | | Waits | | | ✓ Resolves |
| Deadlock detected | | | | | ✓ Detects | ✓ Resolves |
| Component down | | | | | ✓ Alerts | Restarts |

---

## 11. Proactive Questioning

> **See Also:** `ENGAGEMENT-AND-ORCHESTRATION-UI.md` for full UI/UX specifications

### 11.1 Why Agents Ask Questions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      QUESTIONING PHILOSOPHY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   GOAL: Keep users engaged, excited, and thinking ahead while              │
│         ensuring alignment and preventing wasted work.                       │
│                                                                              │
│   QUESTION TYPES:                                                           │
│   ┌─────────────┬────────────────────────────────────────────────────┐     │
│   │ BLOCKING    │ Cannot proceed without answer                       │     │
│   │ CLARIFYING  │ Would improve quality (but has safe default)        │     │
│   │ CONFIRMING  │ Validates agent's assumption before proceeding      │     │
│   │ EDUCATIONAL │ Helps user think ahead (optional to answer)         │     │
│   │ CELEBRATORY │ Marks progress and builds excitement                │     │
│   │ PREFERENCE  │ Learns user style for future interactions           │     │
│   └─────────────┴────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Question Interface

```typescript
interface AgentQuestion {
  id: string;
  type: 'blocking' | 'clarifying' | 'confirming' | 'educational' | 'celebratory' | 'preference';
  agent: string;
  phase: string;

  // Content
  text: string;
  context: string;  // Why we're asking

  // Options
  options: Array<{
    label: string;
    description?: string;
    recommended?: boolean;
    implications?: string;
  }>;
  allowFreeText: boolean;
  defaultOption?: string;

  // Behavior
  blocking: boolean;
  expiresAfter?: Duration;
  reminderAfter?: Duration;

  // Metadata
  ideaId: string;
  sessionId: string;
  tags: string[];  // For pattern matching
}
```

### 11.3 Ideation Agent Questions

```yaml
# agents/ideation/questions.yaml

triggers:
  - event: "idea_created"
    questions:
      - type: blocking
        text: "Who is the ideal first user for this idea?"
        context: "Knowing your target user helps me ask better questions and evaluate market fit accurately."
        options:
          - label: "Myself / indie developers"
            description: "Building for people like you"
          - label: "Small business owners"
            description: "SMBs with limited resources"
          - label: "Enterprise teams"
            description: "Large organizations"
        allowFreeText: true

  - event: "problem_statement_vague"
    condition: "problem_description.length < 50"
    questions:
      - type: blocking
        text: |
          I want to make sure I understand the core problem.

          You mentioned: "{problem_snippet}"

          Could you tell me more about:
          • Who experiences this problem most acutely?
          • What happens when they can't solve it?
          • How are they solving it today?
        context: "Clear problem definition is the foundation of a strong idea."
        allowFreeText: true

  - event: "phase_complete"
    phase: "EXPLORING"
    questions:
      - type: celebratory
        text: |
          Great progress! You've now defined:
          ✓ A clear problem
          ✓ A specific target user
          ✓ An initial solution approach

          Ready to dive deeper into scoping and validation?
        options:
          - label: "Yes, let's continue!"
            recommended: true
          - label: "Actually, I want to refine something"
          - label: "Save progress, continue later"

  - event: "idea_complexity_high"
    condition: "complexity_score > 7"
    questions:
      - type: educational
        text: |
          This idea has a lot of moving parts!

          Before we go further, have you thought about which part
          you'd build first to validate the core assumption?

          I'm asking because starting with an MVP helps test
          whether the fundamental problem-solution fit exists.
        options:
          - label: "Yes, I'd start with..."
            description: "Tell me your MVP focus"
          - label: "Help me think through this"
          - label: "I want to build the full thing"

  - event: "before_research"
    questions:
      - type: confirming
        text: |
          I'm about to research these areas for your idea:

          1. Market size and trends
          2. Existing solutions and competitors
          3. Technical feasibility considerations

          Is there anything specific you want me to dig into?
        options:
          - label: "Those areas look good"
            recommended: true
          - label: "Also look into..."
            description: "Add specific focus areas"
          - label: "Skip research, I know the market"
```

### 11.4 Specification Agent Questions

```yaml
# agents/specification/questions.yaml

triggers:
  - event: "requirement_ambiguous"
    questions:
      - type: blocking
        text: |
          I need to clarify a requirement before writing the spec.

          You mentioned: "{requirement}"

          What does "{ambiguous_term}" mean specifically?
        options:
          - label: "< 100ms response time"
          - label: "< 1 second response time"
          - label: "Faster than current solution"
        allowFreeText: true
        context: "Precise requirements lead to better specifications."

  - event: "multiple_architectures"
    questions:
      - type: blocking
        text: |
          I see two good approaches for {feature}:

          **Option A: {approach_a}**
          • Pros: {pros_a}
          • Cons: {cons_a}
          • Effort: {effort_a}

          **Option B: {approach_b}**
          • Pros: {pros_b}
          • Cons: {cons_b}
          • Effort: {effort_b}

          Which direction feels right?
        options:
          - label: "Option A"
            implications: "You'll get {pros_a} but deal with {cons_a}"
          - label: "Option B"
            implications: "You'll get {pros_b} but deal with {cons_b}"
          - label: "Tell me more about trade-offs"
          - label: "I have a different approach"
        allowFreeText: true
        context: "This decision affects the entire implementation."

  - event: "before_finalize_spec"
    questions:
      - type: confirming
        text: |
          Here's the scope I've captured for this feature:

          **In Scope:**
          {in_scope_list}

          **Explicitly Out of Scope:**
          {out_scope_list}

          Does this match your expectations?
        options:
          - label: "Yes, proceed with spec"
            recommended: true
          - label: "Add to scope..."
          - label: "Remove from scope..."
          - label: "Let's discuss"
        context: "Confirming scope prevents rework later."

  - event: "external_dependencies"
    questions:
      - type: educational
        text: |
          This feature depends on:
          {dependency_list}

          Have you verified these are available/compatible?

          I'm flagging this because dependency issues are
          a common source of project delays.
        options:
          - label: "Yes, I've verified"
          - label: "Help me check"
          - label: "Let's design around them"
        blocking: false

  - event: "spec_complete"
    questions:
      - type: celebratory
        text: |
          Specification complete!

          📋 {task_count} atomic tasks identified
          ⏱️ Estimated complexity: {complexity}
          🎯 Key risk areas: {risks}

          Ready for me to hand this to the Build Agent?
        options:
          - label: "Yes, start building!"
            recommended: true
          - label: "Let me review the spec first"
          - label: "I have questions..."
```

### 11.5 Build Agent Questions

```yaml
# agents/build/questions.yaml

triggers:
  - event: "multiple_implementations"
    questions:
      - type: clarifying
        text: |
          Working on task: {task_id}

          I can implement this using:

          1. **{approach_1}** - {description_1}
          2. **{approach_2}** - {description_2}

          Based on your codebase patterns, I'd recommend #{recommendation}.
          Should I proceed with that?
        options:
          - label: "Yes, use your recommendation"
            recommended: true
          - label: "Use approach 1"
          - label: "Use approach 2"
          - label: "Let me think about it"
        default: "Yes, use your recommendation"
        blocking: false

  - event: "missing_context"
    questions:
      - type: blocking
        text: |
          I'm stuck on task: {task_id}

          I need to know: {missing_info}

          This isn't in the spec or existing codebase.
          Can you help me understand?
        options:
          - label: "Here's the answer..."
            description: "Provide the missing information"
          - label: "Check this file..."
            description: "Point me to an existing reference"
          - label: "Skip this task for now"
          - label: "Let's redesign this part"
        allowFreeText: true

  - event: "task_complexity_exceeded"
    condition: "actual_time > estimated_time * 3"
    questions:
      - type: educational
        text: |
          Task {task_id} is more complex than expected.

          **Original estimate:** {estimate}
          **Actual so far:** {actual}
          **Remaining work:** {remaining}

          This often happens when {common_reason}.

          Should I continue, or do you want to reconsider the approach?
        options:
          - label: "Continue, it's worth it"
          - label: "Simplify the approach"
          - label: "Pause and let's discuss"
          - label: "Skip for now"
        blocking: false

  - event: "milestone_reached"
    condition: "completed_tasks >= total_tasks * 0.5"
    questions:
      - type: celebratory
        text: |
          Milestone reached! 🎉

          **Completed:** {completed_count} / {total_count} tasks
          **Time elapsed:** {time}
          **Tests passing:** {test_status}

          {encouragement_message}

          Ready to continue?
        options:
          - label: "Keep going!"
            recommended: true
          - label: "Show me what's done so far"
          - label: "Take a break, save progress"

  - event: "task_failed_repeatedly"
    condition: "attempts >= 3"
    questions:
      - type: blocking
        text: |
          I've tried 3 times and can't complete task: {task_id}

          **Error:** {error_message}

          **What I've tried:**
          {attempts_list}

          I need your input to proceed.
        options:
          - label: "Try this..."
            description: "Give me guidance"
          - label: "Skip this task"
          - label: "Rethink the approach with me"
          - label: "I'll fix this manually"
        allowFreeText: true
```

### 11.6 Validation Agent Questions

```yaml
# agents/validation/questions.yaml

triggers:
  - event: "validation_level_needed"
    questions:
      - type: clarifying
        text: |
          How thoroughly should I validate this build?

          • **Quick** (30s): Syntax, types, lint
          • **Standard** (2m): + Unit tests
          • **Thorough** (10m): + Integration, edge cases
          • **Comprehensive** (30m): + Performance, security
          • **Release** (2h): Full regression

          Based on the changes, I'd suggest: {recommendation}
        options:
          - label: "Quick"
          - label: "Standard"
          - label: "Thorough"
          - label: "Comprehensive"
          - label: "Release"
        default: "{recommendation}"

  - event: "multiple_failures"
    questions:
      - type: blocking
        text: |
          Found {count} issues during validation:

          **Critical ({critical_count}):**
          {critical_list}

          **Warning ({warning_count}):**
          {warning_list}

          How should I prioritize fixes?
        options:
          - label: "Fix all critical first, then warnings"
            recommended: true
          - label: "Fix all before proceeding"
          - label: "Show me each one to decide"
          - label: "Skip warnings, fix critical only"

  - event: "security_vulnerability"
    questions:
      - type: blocking
        text: |
          ⚠️ Security issue detected!

          **Type:** {vuln_type}
          **Severity:** {severity}
          **Location:** {file}:{line}
          **Details:** {description}

          This needs immediate attention.
        options:
          - label: "Fix it now"
            recommended: true
          - label: "Show me more details"
          - label: "I'll handle manually"
          - label: "Accept the risk (not recommended)"
            implications: "This could expose your application to {risk_description}"

  - event: "coverage_below_threshold"
    questions:
      - type: educational
        text: |
          Test coverage is {coverage}%, below the {threshold}% target.

          **Uncovered areas:**
          {uncovered_list}

          Should I generate additional tests for these areas?

          Note: Higher coverage helps catch regressions but adds maintenance.
        options:
          - label: "Yes, generate more tests"
          - label: "Coverage is acceptable"
          - label: "Let's discuss which areas matter"
        blocking: false

  - event: "validation_passed"
    questions:
      - type: celebratory
        text: |
          ✅ Validation complete!

          **Results:**
          • Tests: {test_count} passing
          • Coverage: {coverage}%
          • Lint: {lint_status}
          • Security: {security_status}

          Ready to approve for deployment?
        options:
          - label: "Approved! Deploy it"
            recommended: true
          - label: "Run one more check on..."
          - label: "Show me the details first"
```

### 11.7 UX Agent Questions

```yaml
# agents/ux/questions.yaml

triggers:
  - event: "before_ux_testing"
    questions:
      - type: clarifying
        text: |
          Who should I simulate for UX testing?

          I can test as:
          • **First-time user**: Never seen the app before
          • **Power user**: Knows shortcuts, efficient workflows
          • **Accessibility user**: Uses screen reader, keyboard-only
          • **Mobile user**: Touch-first, limited screen

          Or describe a specific persona.
        options:
          - label: "First-time user"
            recommended: true
          - label: "Power user"
          - label: "Accessibility user"
          - label: "Mobile user"
        allowFreeText: true
        default: "First-time user"

  - event: "usability_concern"
    condition: "task_time > expected_time * 2"
    questions:
      - type: educational
        text: |
          I noticed this interaction took longer than expected:

          **Action:** {action}
          **Expected:** {expected_time}
          **Actual:** {actual_time}

          **Friction points:**
          {friction_list}

          Should I log this as a UX issue?
        options:
          - label: "Yes, log as issue"
          - label: "It's acceptable for now"
          - label: "Tell me more about the friction"
          - label: "Create a spec to fix it"
        blocking: false

  - event: "accessibility_violation"
    questions:
      - type: blocking
        text: |
          Accessibility issue detected:

          **Violation:** {violation}
          **WCAG Level:** {level}
          **Impact:** {impact}
          **Element:** {element}

          This affects users with: {affected_users}

          How should we handle this?
        options:
          - label: "Fix immediately"
            recommended: true
          - label: "Add to backlog"
          - label: "Show me the element"
          - label: "I'll review manually"

  - event: "ux_testing_complete"
    questions:
      - type: celebratory
        text: |
          UX Testing Complete!

          **Overall Score:** {score}/100

          **Highlights:**
          • {highlight_1}
          • {highlight_2}

          **Areas for Improvement:**
          • {improvement_1}
          • {improvement_2}

          Would you like me to create improvement specs?
        options:
          - label: "Yes, spec the improvements"
          - label: "Good enough for now"
          - label: "Let's discuss the results"
```

### 11.8 SIA Agent Questions

```yaml
# agents/sia/questions.yaml

triggers:
  - event: "pattern_detected"
    condition: "pattern.confidence > 0.8"
    questions:
      - type: confirming
        text: |
          I noticed a pattern across recent builds:

          **Pattern:** {pattern_description}
          **Occurrences:** {count} times
          **Context:** {contexts}

          Should I add this to the Knowledge Base?
        options:
          - label: "Yes, add it"
            recommended: true
          - label: "Not a real pattern"
          - label: "Refine it first..."
          - label: "Show me examples"
        allowFreeText: true

  - event: "gotcha_candidate"
    questions:
      - type: confirming
        text: |
          I want to capture this gotcha to prevent future issues:

          **Gotcha:** {gotcha}
          **Context:** {context}
          **Why it matters:** {impact}

          Agree to add it?
        options:
          - label: "Yes, add to Knowledge Base"
            recommended: true
          - label: "It's project-specific, don't generalize"
          - label: "Reword it..."
        allowFreeText: true

  - event: "claude_md_promotion"
    condition: "pattern.confidence >= 0.9 AND pattern.occurrences >= 3"
    questions:
      - type: blocking
        text: |
          This pattern has been useful across {count} builds:

          **Pattern:** {pattern}
          **Current location:** Knowledge Base
          **Proposed CLAUDE.md addition:**

          ```
          {proposed_addition}
          ```

          Should I add this to CLAUDE.md?
        options:
          - label: "Yes, promote it"
          - label: "Not yet, needs more validation"
          - label: "Modify it..."
          - label: "Keep it in Knowledge Base only"
        allowFreeText: true

  - event: "weekly_summary"
    questions:
      - type: celebratory
        text: |
          📚 Weekly Knowledge Growth

          **New patterns:** {pattern_count}
          **New gotchas:** {gotcha_count}
          **Knowledge Base entries:** {total_entries}
          **CLAUDE.md updates:** {claude_updates}

          Top learning: {top_learning}

          Would you like to review any of these?
        options:
          - label: "Show me the new patterns"
          - label: "Review gotchas"
          - label: "Looks good, continue"
```

### 11.9 System Prompt Addition for All Agents

Every agent's system prompt should include this questioning module:

```typescript
// Shared questioning system prompt (added to all agents)

const QUESTIONING_SYSTEM_PROMPT = `
## Proactive Questioning

You are expected to ask questions proactively throughout your work. This keeps the user engaged, ensures alignment, and prevents wasted work.

### When to Ask Questions

| Type | When | Blocking? |
|------|------|-----------|
| BLOCKING | Cannot proceed without answer | Yes |
| CLARIFYING | Would improve quality (has safe default) | No |
| CONFIRMING | Validating assumption before proceeding | No |
| EDUCATIONAL | Helping user think ahead | No |
| CELEBRATORY | Marking progress, building excitement | No |
| PREFERENCE | Learning user style for future | No |

### Question Format

Structure questions as JSON in your response:

\`\`\`json
{
  "question": {
    "type": "blocking|clarifying|confirming|educational|celebratory|preference",
    "text": "Clear, specific question",
    "context": "Why you're asking (1-2 sentences)",
    "options": [
      { "label": "Option A", "description": "What this means", "recommended": true },
      { "label": "Option B", "description": "What this means" }
    ],
    "default": "Safe default if no answer (for non-blocking)",
    "allowFreeText": true
  }
}
\`\`\`

### When NOT to Ask

- Answer is already in context (CLAUDE.md, idea files)
- Question is trivial (can safely default)
- Same question asked recently (check session history)
- User explicitly said "just do it" / "use your judgment"

### Engagement Principles

1. **Curiosity Over Assumption** - Ask rather than assume
2. **Forward Thinking** - Help users anticipate issues
3. **Ownership Building** - User decides, you advise
4. **Excitement Maintenance** - Celebrate progress
5. **Transparent Reasoning** - Explain why you're asking
`;
```

### 11.10 Question Flow in Orchestration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      QUESTION FLOW IN ORCHESTRATION                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agent generates question                                                   │
│       │                                                                      │
│       ▼                                                                      │
│  Question Service receives                                                  │
│       │                                                                      │
│       ├─ Is BLOCKING?                                                       │
│       │      │                                                               │
│       │      ├─ YES → Pause agent, show prominently in UI                   │
│       │      │        Push notification to user                             │
│       │      │        Wait for answer (no timeout)                          │
│       │      │                                                               │
│       │      └─ NO  → Add to question queue                                 │
│       │               Continue agent work                                    │
│       │               Apply default after timeout                           │
│       │                                                                      │
│       ▼                                                                      │
│  User answers (or timeout applies default)                                  │
│       │                                                                      │
│       ▼                                                                      │
│  Answer recorded in session                                                 │
│       │                                                                      │
│       ├─ Learn from answer? (if preference or repeated)                     │
│       │      └─ Store pattern for future auto-answers                       │
│       │                                                                      │
│       ▼                                                                      │
│  Resume agent with answer context                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*This document is the definitive reference for understanding agent internals. For E2E flows, see E2E-SCENARIOS.md. For implementation, see IMPLEMENTATION-PLAN.md. For UI/UX of questioning and orchestration, see ENGAGEMENT-AND-ORCHESTRATION-UI.md.*
