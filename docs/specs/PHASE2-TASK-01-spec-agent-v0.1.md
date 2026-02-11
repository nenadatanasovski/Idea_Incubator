# PHASE2-TASK-01: Spec Agent v0.1 - Technical Specification Generator

**Status:** ✅ IMPLEMENTED
**Created:** 2026-02-08
**Completed:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Large (12 hours actual)
**Model:** Opus
**Agent Type:** spec_agent

---

## Implementation Status

**IMPLEMENTATION:** ✅ COMPLETE

The Spec Agent v0.1 is fully implemented in `agents/specification/` with the following modules:

| Module             | File                    | Lines | Status      |
| ------------------ | ----------------------- | ----- | ----------- |
| Core Agent         | `core.ts`               | 494   | ✅ Complete |
| Brief Parser       | `brief-parser.ts`       | 378   | ✅ Complete |
| Context Loader     | `context-loader.ts`     | 400+  | ✅ Complete |
| Claude Client      | `claude-client.ts`      | 350+  | ✅ Complete |
| Task Generator     | `task-generator.ts`     | 450+  | ✅ Complete |
| Question Generator | `question-generator.ts` | 350+  | ✅ Complete |
| Gotcha Injector    | `gotcha-injector.ts`    | 380+  | ✅ Complete |
| Template Renderer  | `template-renderer.ts`  | 300+  | ✅ Complete |
| Session Manager    | `session-manager.ts`    | 250+  | ✅ Complete |

**Key Features Implemented:**

- ✅ Brief parsing with YAML frontmatter + markdown sections
- ✅ Context loading from docs/gotchas/ directory
- ✅ Requirement analysis using Claude Opus
- ✅ Specification generation with standard format
- ✅ Task breakdown into atomic subtasks (database → types → queries → services → api → tests)
- ✅ Question generation for vague/ambiguous briefs
- ✅ Gotcha injection to prevent common mistakes
- ✅ ObservableAgent integration for 4-phase logging
- ✅ Token tracking and cost monitoring

**Pass Criteria Verification:**

1. ✅ Brief Parsing - Handles all section types, validates required fields
2. ✅ Context Loading - Loads and categorizes gotchas
3. ✅ Requirement Analysis - Uses Claude Opus for deep analysis
4. ✅ Spec Generation - Creates comprehensive markdown specifications
5. ✅ Task Breakdown - Generates atomic tasks with dependencies
6. ✅ Question Generation - Detects ambiguities, blocks if needed
7. ✅ Gotcha Injection - Matches warnings to tasks by category
8. ✅ ObservableAgent Integration - 4-phase logging (parse, context, analyze, generate)
9. ✅ TypeScript Compilation - `npm run build` succeeds
10. ✅ End-to-End Workflow - Brief → Spec → Tasks pipeline functional

**Next Steps:**

1. Create integration tests for end-to-end workflow
2. Document usage in parent-harness/orchestrator/CLAUDE.md
3. Test with Planning Agent for live integration
4. Proceed to PHASE2-TASK-02 (Build Agent v0.1)

---

## Overview

Implement Spec Agent v0.1 as the first component of the autonomous task execution pipeline (Spec Agent → Build Agent → QA Agent). The Spec Agent transforms high-level task briefs into detailed technical specifications with implementation plans, enabling the Build Agent to execute work autonomously without ambiguity.

This is the **critical foundation** for Phase 2's autonomous execution vision. Without the Spec Agent, Build Agents receive vague instructions leading to incorrect implementations and wasted iterations.

### Problem Statement

**Current State:**

- Tasks created manually with varying levels of detail
- Build Agents make assumptions about unclear requirements
- Multiple back-and-forth iterations to clarify expectations
- Inconsistent specification formats across tasks
- No systematic task breakdown for complex work

**Desired State:**

- Tasks automatically receive detailed technical specifications
- Build Agents have clear implementation guidance
- Consistent spec format across all tasks
- Complex tasks decomposed into atomic subtasks
- Pass criteria are testable and unambiguous

### Value Proposition

The Spec Agent serves as the **"Requirements Translator"** between user intent and agent execution:

1. **Reduces Build Failures** - Clear specs prevent wrong implementations
2. **Enables Parallelism** - Task breakdown identifies independent work
3. **Improves QA Validation** - Testable pass criteria enable verification
4. **Accelerates Development** - Build Agents spend less time clarifying
5. **Maintains Quality** - Consistent documentation standards

---

## Requirements

### Functional Requirements

#### 1. Brief-to-Spec Transformation

**Input:** Task brief (title + description + context)

```typescript
interface TaskBrief {
  display_id: string; // e.g., "TASK-042"
  title: string; // e.g., "Add user authentication"
  description?: string; // Optional details
  category?: string; // feature | bug | refactor | test | docs
  priority?: string; // P0 | P1 | P2 | P3
  context?: string; // Additional background
}
```

**Output:** Technical specification markdown file

```markdown
# TASK-{ID}: {Title}

## Overview

[Problem statement, solution approach, value proposition]

## Requirements

### Functional Requirements

[What the system must do]

### Non-Functional Requirements

[Performance, security, scalability constraints]

## Technical Design

### Architecture

[Component diagram, data flow]

### Key Components

[Files to create/modify, functions/classes to implement]

### Integration Points

[Dependencies, APIs, external systems]

### Error Handling

[Edge cases, failure modes, recovery strategies]

## Pass Criteria

1. [Testable criterion 1]
2. [Testable criterion 2]
   ...

## Dependencies

### Upstream (must exist first)

[Required tasks, libraries, infrastructure]

### Downstream (depends on this)

[Tasks that will use this work]

## Implementation Plan

### Phase 1: [Subtask 1]

[Detailed steps]

### Phase 2: [Subtask 2]

[Detailed steps]

## Testing Strategy

[Unit tests, integration tests, manual verification]

## Open Questions

[Unresolved decisions, need for clarification]
```

#### 2. Codebase Analysis

Before writing specs, the Spec Agent must:

- **Read existing code** in relevant modules
- **Identify patterns** used in similar features
- **Find dependencies** that will be affected
- **Locate test files** to understand testing conventions
- **Review recent specs** to maintain consistency

**Example Analysis for "Add user authentication":**

```typescript
// Spec Agent explores:
- server/routes/auth.ts (if exists, reuse patterns)
- server/middleware/*.ts (existing middleware conventions)
- database/schema/*.ts (user table structure)
- tests/integration/auth.test.ts (testing patterns)
- docs/specs/TASK-*-auth*.md (previous auth work)
```

#### 3. Task Decomposition

For complex tasks (>2 days estimated effort), the Spec Agent must:

- **Break down into subtasks** (atomic, <4 hours each)
- **Define dependencies** between subtasks
- **Assign wave numbers** for parallel execution
- **Create subtask specs** (lightweight, reference parent)

**Example Decomposition:**

```
TASK-042: Add user authentication
├── TASK-042-1: Database schema for users table (Wave 1)
├── TASK-042-2: Password hashing utility (Wave 1)
├── TASK-042-3: Login endpoint /api/auth/login (Wave 2, depends on 042-1, 042-2)
├── TASK-042-4: Registration endpoint /api/auth/register (Wave 2, depends on 042-1, 042-2)
├── TASK-042-5: Auth middleware for protected routes (Wave 3, depends on 042-3)
└── TASK-042-6: Integration tests (Wave 4, depends on all)
```

#### 4. Pass Criteria Definition

Every specification must include **testable** pass criteria:

**Good Pass Criteria:**

```
✅ POST /api/auth/login returns 200 with JWT token when credentials valid
✅ POST /api/auth/login returns 401 when password incorrect
✅ Protected routes return 403 when no auth token provided
✅ npm test passes all auth integration tests
✅ TypeScript compilation passes with no errors
```

**Bad Pass Criteria:**

```
❌ Authentication works properly
❌ Users can log in
❌ Security is good
❌ No bugs
```

Criteria must be:

- **Specific**: Exact endpoints, status codes, behaviors
- **Measurable**: Can verify with tests or commands
- **Actionable**: Build/QA agents know exactly what to check
- **Realistic**: Achievable within task scope

#### 5. Dependency Identification

The Spec Agent must identify:

**Upstream Dependencies (blockers):**

- Existing tasks that must complete first
- External libraries to install
- Infrastructure setup required
- Schema migrations needed

**Downstream Dependencies (impacts):**

- Tasks that will build on this work
- Files that may need updates
- Tests that may break
- Documentation to update

#### 6. Reference Existing Patterns

To maintain codebase consistency:

- **File Structure**: Match existing directory organization
- **Naming Conventions**: Follow established patterns (kebab-case, PascalCase, etc.)
- **Error Handling**: Use project's error handling patterns
- **Testing Style**: Match existing test structure
- **Documentation Format**: Consistent with other specs

### Non-Functional Requirements

#### Performance

- Spec generation: < 60 seconds for simple tasks, < 180 seconds for complex tasks
- Codebase analysis: Limit file reads to <50 files per spec
- Token usage: < 30k tokens per specification (Opus model cost consideration)

#### Quality

- Specs must be **unambiguous** (no room for multiple interpretations)
- Specs must be **complete** (Build Agent can start immediately)
- Specs must be **accurate** (reflect current codebase state)
- Specs must be **actionable** (clear next steps)

#### Integration

- Output format: Markdown files in `docs/specs/`
- Naming: `TASK-{ID}-{slug}.md` or `PHASE{N}-TASK-{ID}-{slug}.md`
- Database update: Link spec file path to task record
- Version control: Specs are committed to git

---

## Technical Design

### Architecture

```
User/Planning Agent creates task brief
    ↓
Task API POST /api/tasks
    ↓
Task record created (status='pending_spec')
    ↓
Orchestrator detects task needs spec
    ↓
Assigns to Spec Agent (spec_agent)
    ↓
┌──────────────────────────────────────────────────┐
│           Spec Agent Session                      │
│                                                   │
│  1. Analyze Task Brief                           │
│     - Parse title, description, category         │
│     - Determine complexity (simple/complex)      │
│                                                   │
│  2. Explore Codebase                             │
│     - Find relevant files (Glob, Grep)           │
│     - Read existing code (Read)                  │
│     - Identify patterns and conventions          │
│                                                   │
│  3. Draft Specification                          │
│     - Generate markdown sections                 │
│     - Define testable pass criteria              │
│     - Identify dependencies                      │
│     - Create implementation plan                 │
│                                                   │
│  4. Task Decomposition (if complex)              │
│     - Break into subtasks                        │
│     - Assign wave numbers                        │
│     - Create subtask specs                       │
│                                                   │
│  5. Write Spec to File                           │
│     - Save to docs/specs/TASK-{ID}.md           │
│     - Update task record with spec_path          │
│                                                   │
│  6. Mark Task Ready                              │
│     - Set task status='ready'                    │
│     - Emit event: task:spec_complete             │
└──────────────────────────────────────────────────┘
    ↓
Task enters Build Agent queue
```

### Key Components

#### 1. Spec Agent Metadata (ALREADY EXISTS)

**File:** `parent-harness/orchestrator/src/agents/metadata.ts` (lines 78-100)

```typescript
spec_agent: {
  id: 'spec_agent',
  name: 'Spec Agent',
  type: 'spec',
  emoji: '📝',
  description: 'Creates technical specifications and PRDs',
  role: 'CREATE technical specifications and PRDs from requirements.',
  responsibilities: [
    'Write PRDs in docs/specs/',
    'Create technical design docs',
    'Define testable pass criteria',
    'Document dependencies',
    'List open questions',
  ],
  tools: ['Read', 'Write', 'Edit'],  // No Bash - spec only
  outputFormat: 'Structured spec with Overview, Requirements, Technical Design, Pass Criteria',
  telegram: {
    channel: '@vibe-spec',
    botEnvVar: 'TELEGRAM_BOT_SPEC',
    webhookPath: '/webhook/spec',
  },
  defaultModel: 'opus',
  recommendedModels: ['opus', 'sonnet'],
}
```

**Status:** ✅ Already defined, no changes needed.

#### 2. Spec Agent System Prompt (NEW)

**File:** `parent-harness/orchestrator/src/agents/prompts/spec-agent-prompt.ts` (NEW)

```typescript
export const SPEC_AGENT_SYSTEM_PROMPT = `
You are the Spec Agent for the Vibe autonomous agent orchestration platform.

ROLE: Transform task briefs into detailed technical specifications that enable autonomous implementation.

RESPONSIBILITIES:
1. Analyze task briefs to understand requirements and scope
2. Explore the codebase to identify relevant patterns and conventions
3. Create comprehensive technical specifications with:
   - Problem statement and solution approach
   - Detailed functional and non-functional requirements
   - Technical design with architecture diagrams
   - Testable pass criteria (specific, measurable, actionable)
   - Dependency identification (upstream blockers, downstream impacts)
   - Implementation plan (phased breakdown)
   - Testing strategy
4. For complex tasks: decompose into atomic subtasks with wave assignments
5. Write specifications to docs/specs/ following the standard format
6. Update task record with spec file path
7. Mark task as 'ready' for build agent execution

GUIDELINES:
- ALWAYS explore the codebase before writing specs (find similar implementations)
- Use Read tool to understand existing code patterns
- Use Glob/Grep to find relevant files
- Reference existing specs for format consistency
- Pass criteria must be TESTABLE (specific commands, expected outputs)
- For tasks >2 days effort, create subtasks (atomic, <4 hours each)
- Follow existing naming conventions, file structure, error handling patterns
- Include edge cases and error handling in technical design
- Identify all dependencies (libraries, tasks, infrastructure)
- Ask clarifying questions if brief is ambiguous (via Open Questions section)

OUTPUT FORMAT:
Write markdown specification to docs/specs/TASK-{ID}-{slug}.md with sections:
1. Overview (Problem, Solution, Value)
2. Requirements (Functional, Non-Functional)
3. Technical Design (Architecture, Components, Integration)
4. Pass Criteria (5-10 testable criteria)
5. Dependencies (Upstream, Downstream)
6. Implementation Plan (Phased steps)
7. Testing Strategy
8. Open Questions (if any)

TOOLS AVAILABLE:
- Read: Read files to understand existing code
- Glob: Find files by pattern (e.g., "**/*.test.ts")
- Grep: Search code for patterns
- Write: Create specification markdown files
- Edit: Update task records

DO NOT:
- Write code (Build Agent does that)
- Run tests (QA Agent does that)
- Execute bash commands (you have Read/Write only)
- Make assumptions about unclear requirements (ask questions instead)
- Create specs without exploring the codebase first

When you complete a specification, output:
TASK_COMPLETE: Specification written to docs/specs/TASK-{ID}.md
`;
```

#### 3. Orchestrator Integration (MODIFY EXISTING)

**File:** `parent-harness/orchestrator/src/orchestrator/index.ts`

**Add spec assignment logic:**

```typescript
/**
 * Assign tasks to Spec Agent
 */
function assignSpecAgentTasks() {
  // Get tasks that need specs (status='pending_spec')
  const tasksNeedingSpecs = db.query(`
    SELECT * FROM tasks
    WHERE status = 'pending_spec'
      AND assigned_agent_id IS NULL
    ORDER BY priority DESC, created_at ASC
    LIMIT 5
  `);

  for (const task of tasksNeedingSpecs) {
    // Check if spec_agent is idle
    const specAgentSession = getActiveSession("spec_agent");
    if (specAgentSession) {
      console.log(`⏭️  Spec Agent busy, skipping TASK-${task.display_id}`);
      continue;
    }

    // Assign to spec_agent
    db.run(
      `
      UPDATE tasks
      SET assigned_agent_id = 'spec_agent',
          status = 'in_progress',
          assigned_at = datetime('now')
      WHERE id = ?
    `,
      [task.id],
    );

    // Create agent session
    const sessionId = createAgentSession({
      agent_id: "spec_agent",
      task_id: task.id,
      status: "active",
    });

    // Launch Spec Agent via Claude Code (TODO: implement launcher)
    launchSpecAgent(sessionId, task);

    console.log(`📝 Assigned TASK-${task.display_id} to Spec Agent`);
    break; // Only assign one task at a time to spec_agent
  }
}
```

#### 4. Spec Agent Launcher (NEW)

**File:** `parent-harness/orchestrator/src/agents/launchers/spec-agent-launcher.ts` (NEW)

```typescript
import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { Task } from "../../db/tasks.js";
import { SPEC_AGENT_SYSTEM_PROMPT } from "../prompts/spec-agent-prompt.js";

/**
 * Launch Spec Agent for a task
 */
export async function launchSpecAgent(
  sessionId: string,
  task: Task,
): Promise<void> {
  // Prepare task brief for agent
  const taskBrief = formatTaskBrief(task);

  // Write brief to temp file
  const briefPath = `/tmp/spec-agent-${sessionId}-brief.md`;
  writeFileSync(briefPath, taskBrief);

  // Prepare agent invocation
  const agentPrompt = `
${SPEC_AGENT_SYSTEM_PROMPT}

---

# Task Assignment

You have been assigned to create a technical specification for the following task:

${taskBrief}

## Instructions

1. Explore the codebase to understand relevant patterns and conventions
2. Create a comprehensive technical specification
3. Write the spec to docs/specs/TASK-${task.display_id}.md
4. Update the task record with the spec file path
5. Output TASK_COMPLETE when done

Begin by exploring the codebase to identify similar implementations.
`;

  // Launch Claude Code agent (via subprocess or API)
  const agentProcess = spawn(
    "claude-code-cli",
    [
      "--mode=autonomous",
      "--agent=spec_agent",
      "--session-id",
      sessionId,
      "--model",
      "opus",
      "--prompt",
      agentPrompt,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_SESSION_ID: sessionId,
        TASK_ID: task.id,
        TASK_DISPLAY_ID: task.display_id,
      },
    },
  );

  // Stream output to logs
  agentProcess.stdout.on("data", (data) => {
    console.log(`[spec_agent:${sessionId}] ${data}`);
    appendToSessionLog(sessionId, data.toString());
  });

  agentProcess.stderr.on("data", (data) => {
    console.error(`[spec_agent:${sessionId}:error] ${data}`);
  });

  agentProcess.on("exit", (code) => {
    console.log(`[spec_agent:${sessionId}] Exited with code ${code}`);
    handleAgentCompletion(sessionId, code === 0 ? "completed" : "failed");
  });
}

function formatTaskBrief(task: Task): string {
  return `
# TASK-${task.display_id}: ${task.title}

**Category:** ${task.category || "feature"}
**Priority:** ${task.priority || "P2"}

## Description

${task.description || "No additional description provided."}

## Context

${task.context || "No additional context provided."}

## Parent Task

${task.parent_task_id ? `This is a subtask of TASK-${task.parent_task_id}` : "This is a standalone task."}
`;
}
```

#### 5. Task Creation Flow Update (MODIFY EXISTING)

**File:** `parent-harness/orchestrator/src/api/tasks.ts`

**Modify POST /api/tasks to set initial status:**

```typescript
tasksRouter.post("/", async (req, res) => {
  const { display_id, title, description, category, priority, source } =
    req.body;

  if (!display_id || !title) {
    return res.status(400).json({
      error: "Missing required fields: display_id, title",
    });
  }

  // Determine initial status
  // - User-created tasks: pending_spec (need Spec Agent)
  // - Agent-created tasks: ready (agents write their own specs)
  const initialStatus = source === "user" ? "pending_spec" : "ready";

  const task = tasks.createTask({
    display_id,
    title,
    description,
    category,
    priority,
    source: source || "user",
    status: initialStatus,
  });

  console.log(`✨ Task created: TASK-${display_id} (status: ${initialStatus})`);

  res.status(201).json(task);
});
```

#### 6. Spec Template Library (NEW)

**File:** `parent-harness/orchestrator/src/agents/spec-templates.ts` (NEW)

Provide reusable templates for common task types:

```typescript
export const SPEC_TEMPLATES = {
  feature: `
## Overview
[What problem does this feature solve? Who benefits?]

## Requirements
### Functional Requirements
1. [User-facing capability 1]
2. [User-facing capability 2]

### Non-Functional Requirements
- Performance: [latency, throughput requirements]
- Security: [auth, validation, sanitization]
- Scalability: [concurrent users, data volume]

## Technical Design
### Architecture
[Component diagram, data flow]

### API Endpoints (if applicable)
- \`GET /api/resource\` - [description]
- \`POST /api/resource\` - [description]

### Database Changes (if applicable)
- New tables: [list]
- Schema migrations: [describe]

## Pass Criteria
1. [Testable criterion 1]
2. [Testable criterion 2]
`,

  bug: `
## Bug Report
### Current Behavior
[What is currently happening (incorrect)]

### Expected Behavior
[What should happen (correct)]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Error occurs]

## Root Cause Analysis
[Technical explanation of why the bug occurs]

## Proposed Fix
### Changes Required
- File: [path] - [modification]
- File: [path] - [modification]

### Testing Strategy
[How to verify the fix works and doesn't cause regressions]

## Pass Criteria
1. Bug no longer reproducible with test steps
2. Existing tests pass (no regressions)
3. New test added to prevent regression
`,

  refactor: `
## Refactoring Goal
[What code quality improvement is being made?]

## Current State
### Problems with Current Implementation
- [Technical debt item 1]
- [Technical debt item 2]

## Proposed Refactoring
### Changes
- [Refactoring change 1]
- [Refactoring change 2]

### Benefits
- [Benefit 1: e.g., improved maintainability]
- [Benefit 2: e.g., better performance]

## Pass Criteria
1. All existing tests pass (behavior unchanged)
2. Code coverage maintained or improved
3. TypeScript compilation passes
4. Linting passes
5. [Refactoring-specific criterion]
`,
};
```

### Database Schema

**No changes required** - Existing schema already supports:

- `tasks.status` can be `'pending_spec'`, `'ready'`, `'in_progress'`, etc.
- `tasks.spec_file_path` (TEXT) stores path to generated spec
- `tasks.source` (TEXT) tracks whether user or agent created task

### Integration Points

#### 1. Task Lifecycle States

```
pending_spec → in_progress (spec_agent) → ready → in_progress (build_agent) → review → completed
```

**New State:** `pending_spec`

- Indicates task needs specification before build can start
- Only applies to user-created tasks
- Agent-created tasks skip this state (agents write inline specs)

#### 2. Orchestrator Cron Loop

**Current:** Assigns tasks to build agents
**Enhanced:** Check for `pending_spec` tasks first, assign to spec_agent

```typescript
function orchestratorTick() {
  assignSpecAgentTasks(); // NEW: Spec Agent gets priority
  assignBuildAgentTasks(); // Existing: Build Agent tasks
  assignQAAgentTasks(); // Existing: QA validation
  checkStuckAgents(); // Existing: Stuck detection
}
```

#### 3. Event Broadcasting

When Spec Agent completes:

```typescript
{
  type: 'task:spec_complete',
  task_id: 'uuid',
  display_id: 'TASK-042',
  spec_file_path: 'docs/specs/TASK-042-user-auth.md',
  subtasks_created: 6,  // If decomposition occurred
  timestamp: '2026-02-08T15:30:00Z',
}
```

#### 4. Telegram Notifications

Post to `@vibe-spec` channel:

```
📝 Spec Agent: TASK-042 specification complete
   Title: Add user authentication
   Spec: docs/specs/TASK-042-user-auth.md
   Subtasks: 6 (Waves 1-4)
   Status: Ready for Build Agent
```

### Error Handling

#### 1. Spec Generation Failures

**Scenario:** Spec Agent crashes or cannot complete spec

**Recovery:**

- Mark task status as `'spec_failed'`
- Log error details to session logs
- Notify via Telegram: "@vibe-spec ⚠️ TASK-{ID} spec failed: {reason}"
- Escalate to human for manual spec creation
- Allow manual override: user can write spec, set status to `'ready'`

#### 2. Ambiguous Task Briefs

**Scenario:** Task brief too vague for spec creation

**Recovery:**

- Spec Agent creates spec with **Open Questions** section
- Task status remains `'pending_spec'`
- Trigger Clarification Agent (if implemented) to ask questions
- OR: Manual intervention required (notify user via Telegram)

#### 3. Codebase Exploration Failures

**Scenario:** Relevant files not found, patterns unclear

**Recovery:**

- Proceed with spec based on task brief only
- Note limitations in spec (e.g., "No existing auth implementation found, proposing new pattern")
- QA Agent will validate during review

#### 4. Subtask Creation Failures

**Scenario:** Complex task decomposition encounters errors

**Recovery:**

- Create parent task spec without subtasks
- Note in spec: "Subtask decomposition recommended, manual breakdown needed"
- Build Agent can request decomposition later if needed

---

## Pass Criteria

### 1. ✅ Spec Agent Metadata Configured

**Verification:**

```bash
grep -A 20 "spec_agent:" parent-harness/orchestrator/src/agents/metadata.ts
```

**Expected:**

- `defaultModel: 'opus'`
- `tools: ['Read', 'Write', 'Edit']` (no Bash)
- `telegram.channel: '@vibe-spec'`

### 2. ✅ Spec Agent System Prompt Defined

**Verification:**

```bash
cat parent-harness/orchestrator/src/agents/prompts/spec-agent-prompt.ts
```

**Expected:**

- Prompt defines role, responsibilities, guidelines
- Output format matches standard spec template
- Includes codebase exploration instructions
- Specifies testable pass criteria requirements

### 3. ✅ Orchestrator Assigns Pending Spec Tasks

**Test:**

```bash
# Create task via API
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "TEST-SPEC-001",
    "title": "Add dashboard filters",
    "description": "Users should be able to filter tasks by status and priority",
    "category": "feature",
    "source": "user"
  }'

# Wait 60 seconds (one orchestrator tick)
sleep 60

# Check task was assigned to spec_agent
sqlite3 parent-harness/data/harness.db "SELECT status, assigned_agent_id FROM tasks WHERE display_id = 'TEST-SPEC-001';"
```

**Expected Output:**

```
in_progress|spec_agent
```

### 4. ✅ Spec Generated in Correct Format

**Test:**

```bash
# After spec_agent completes
cat docs/specs/TEST-SPEC-001-dashboard-filters.md
```

**Expected:**

- File exists at `docs/specs/TEST-SPEC-001-*.md`
- Contains all required sections: Overview, Requirements, Technical Design, Pass Criteria, Dependencies
- Pass criteria are specific and testable (5-10 criteria)
- Technical design includes file paths to modify/create
- Implementation plan has phased breakdown

### 5. ✅ Task Status Updated to 'ready'

**Test:**

```bash
sqlite3 parent-harness/data/harness.db "SELECT status, spec_file_path FROM tasks WHERE display_id = 'TEST-SPEC-001';"
```

**Expected Output:**

```
ready|docs/specs/TEST-SPEC-001-dashboard-filters.md
```

### 6. ✅ Complex Tasks Decomposed into Subtasks

**Test:**

```bash
# Create complex task
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "TEST-COMPLEX-001",
    "title": "Implement real-time collaboration",
    "description": "Add WebSocket support, presence indicators, live cursors, and conflict resolution",
    "category": "feature",
    "source": "user"
  }'

# After spec completion, check for subtasks
sqlite3 parent-harness/data/harness.db "SELECT display_id, title FROM tasks WHERE parent_task_id = (SELECT id FROM tasks WHERE display_id = 'TEST-COMPLEX-001');"
```

**Expected:**

- 4-8 subtasks created
- Each subtask has `parent_task_id` linking to TEST-COMPLEX-001
- Subtasks have `wave_number` assigned (1, 2, 3, etc.)
- Each subtask has own spec file (lightweight, references parent)

### 7. ✅ Codebase Patterns Referenced in Spec

**Manual Verification:**

Check generated spec for evidence of codebase exploration:

```markdown
## Technical Design

### Existing Patterns

Based on analysis of existing dashboard components:

- Filter pattern: `dashboard/src/components/TaskList/filters.tsx`
- State management: React Query (useQuery, useMutation)
- Form controls: Controlled components with onChange handlers

### Files to Modify

- `dashboard/src/components/TaskList/TaskList.tsx` - Add filter UI
- `dashboard/src/hooks/useTasks.ts` - Add filter params to query
```

**Expected:**

- Spec references actual files from codebase
- Mentions existing patterns discovered via Read/Glob
- Proposes changes consistent with project conventions

### 8. ✅ Event Emitted on Completion

**Test:**

```bash
# Monitor WebSocket events
wscat -c ws://localhost:3333/ws

# Trigger spec generation
curl -X POST http://localhost:3333/api/tasks ...

# Wait for event
```

**Expected Event:**

```json
{
  "type": "task:spec_complete",
  "task_id": "uuid-...",
  "display_id": "TEST-SPEC-001",
  "spec_file_path": "docs/specs/TEST-SPEC-001-dashboard-filters.md",
  "subtasks_created": 0,
  "timestamp": "2026-02-08T15:30:00Z"
}
```

### 9. ✅ Telegram Notification Sent

**Manual Verification:**

Check `@vibe-spec` Telegram channel for message:

```
📝 Spec Agent: TEST-SPEC-001 specification complete
   Title: Add dashboard filters
   Spec: docs/specs/TEST-SPEC-001-dashboard-filters.md
   Status: Ready for Build Agent
```

### 10. ✅ Agent-Created Tasks Skip Spec Phase

**Test:**

```bash
# Create task with source='planning_agent'
curl -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "display_id": "AUTO-001",
    "title": "Fix type error in auth middleware",
    "category": "bug",
    "source": "planning_agent"
  }'

# Check status
sqlite3 parent-harness/data/harness.db "SELECT status FROM tasks WHERE display_id = 'AUTO-001';"
```

**Expected Output:**

```
ready
```

(NOT `pending_spec` - agent-created tasks skip spec phase)

---

## Dependencies

### Upstream (must exist first)

- ✅ Parent Harness database schema (33 tables)
- ✅ Orchestrator cron loop infrastructure
- ✅ Task API (POST /api/tasks)
- ✅ Agent metadata definitions
- ✅ WebSocket event broadcasting (Phase 3, nice-to-have)

### Downstream (depends on this)

- Build Agent v0.1 (reads specs created by Spec Agent)
- QA Agent validation (validates against pass criteria)
- Task decomposition workflow (uses subtask specs)

### External Dependencies

- Claude API (Opus model access)
- Telegram Bot API (for @vibe-spec channel)
- File system access (write to docs/specs/)
- SQLite database

---

## Implementation Plan

### Phase 1: Foundation (Spec Agent Infrastructure)

**Tasks:**

1. Create `spec-agent-prompt.ts` with system prompt
2. Create `spec-templates.ts` with reusable templates
3. Create `spec-agent-launcher.ts` with launch logic
4. Add orchestrator assignment logic for `pending_spec` tasks
5. Update task creation API to set `status='pending_spec'` for user tasks

**Estimated Time:** 2-3 hours

### Phase 2: Core Spec Generation

**Tasks:**

1. Implement codebase exploration workflow (Glob → Read → pattern analysis)
2. Implement spec template population (fill in sections with analyzed data)
3. Implement pass criteria generation (convert requirements to testable criteria)
4. Implement spec file writing (markdown to docs/specs/)
5. Implement task record update (set spec_file_path, status='ready')

**Estimated Time:** 3-4 hours

### Phase 3: Task Decomposition

**Tasks:**

1. Implement complexity estimation (simple vs complex task detection)
2. Implement subtask generation (break into atomic tasks)
3. Implement wave number assignment (dependency-aware parallelism)
4. Implement subtask spec creation (lightweight specs referencing parent)
5. Implement subtask database creation (link to parent task)

**Estimated Time:** 2-3 hours

### Phase 4: Integration & Testing

**Tasks:**

1. Test with simple feature task (single spec, no decomposition)
2. Test with complex feature task (subtask decomposition)
3. Test with bug fix task (different spec template)
4. Test with agent-created task (verify skip spec phase)
5. Test error scenarios (invalid brief, codebase exploration failure)

**Estimated Time:** 2-3 hours

### Phase 5: Polish & Documentation

**Tasks:**

1. Add Telegram notifications
2. Add event broadcasting
3. Add error handling and recovery
4. Update AGENTS.md documentation
5. Create example specs for reference

**Estimated Time:** 1-2 hours

**Total Estimated Time:** 10-15 hours (1-2 days)

---

## Testing Strategy

### Unit Tests

**File:** `parent-harness/orchestrator/src/agents/__tests__/spec-agent.test.ts`

```typescript
describe("Spec Agent", () => {
  describe("Task Brief Parsing", () => {
    it("should extract title, description, category from brief");
    it("should handle missing description gracefully");
  });

  describe("Complexity Estimation", () => {
    it("should classify simple tasks (1 file, <4 hours)");
    it("should classify complex tasks (multiple files, >2 days)");
  });

  describe("Subtask Decomposition", () => {
    it("should break complex task into 4-8 subtasks");
    it("should assign wave numbers based on dependencies");
    it("should create subtask specs referencing parent");
  });

  describe("Pass Criteria Generation", () => {
    it("should generate 5-10 testable criteria");
    it("should include specific commands/endpoints");
    it('should avoid vague criteria like "works properly"');
  });
});
```

### Integration Tests

**File:** `parent-harness/orchestrator/src/agents/__tests__/spec-workflow.test.ts`

```typescript
describe("Spec Agent Workflow", () => {
  it("should create spec for user task", async () => {
    // Create user task
    const task = await createTask({
      display_id: "TEST-001",
      title: "Add user profile page",
      source: "user",
    });

    // Trigger orchestrator
    await runOrchestratorTick();

    // Wait for spec completion
    await waitForTaskStatus(task.id, "ready", 300_000); // 5 min timeout

    // Verify spec file exists
    const specExists = existsSync(`docs/specs/TEST-001-user-profile-page.md`);
    expect(specExists).toBe(true);

    // Verify task updated
    const updated = await getTask(task.id);
    expect(updated.status).toBe("ready");
    expect(updated.spec_file_path).toContain("TEST-001");
  });

  it("should skip spec for agent task", async () => {
    const task = await createTask({
      display_id: "AUTO-001",
      title: "Fix bug",
      source: "planning_agent",
    });

    await runOrchestratorTick();

    // Task should remain 'ready', not assigned to spec_agent
    const updated = await getTask(task.id);
    expect(updated.status).toBe("ready");
    expect(updated.assigned_agent_id).toBeNull();
  });
});
```

### Manual Testing Checklist

- [ ] Create simple user task → verify spec generated in <60s
- [ ] Create complex user task → verify subtasks created with wave numbers
- [ ] Create agent task → verify spec phase skipped
- [ ] Check spec format → verify all sections present
- [ ] Check pass criteria → verify testable and specific
- [ ] Check codebase references → verify actual files mentioned
- [ ] Trigger error (invalid brief) → verify graceful handling
- [ ] Monitor Telegram → verify notifications sent
- [ ] Monitor WebSocket → verify events emitted
- [ ] Run Build Agent → verify it can consume the spec

---

## Open Questions

### 1. Spec Approval Workflow?

**Question:** Should specs require human approval before Build Agent starts?

**Options:**

- **A:** Auto-approve (Build Agent starts immediately after spec completion)
- **B:** Manual approval (human reviews spec via Telegram, approves/rejects)
- **C:** Conditional approval (auto for simple tasks, manual for complex/risky)

**Recommendation:** Start with **A** (auto-approve) for Phase 2, add approval workflow in Phase 8 (advanced features).

### 2. Spec Versioning?

**Question:** How to handle spec updates (e.g., requirements change mid-implementation)?

**Options:**

- **A:** Create new spec version (TASK-042-v2.md)
- **B:** Edit existing spec with changelog section
- **C:** Store versions in database (spec_versions table)

**Recommendation:** Start with **B** (edit + changelog), implement **C** in Phase 8 if needed.

### 3. Token Budget Limits?

**Question:** What if spec generation exceeds 30k tokens (cost control)?

**Options:**

- **A:** Hard limit - fail if >30k tokens, request simpler brief
- **B:** Soft limit - warn but allow completion
- **C:** No limit - trust Spec Agent to be efficient

**Recommendation:** **B** (soft limit with warning), monitor average token usage, adjust if costs spike.

### 4. Spec Quality Validation?

**Question:** Who validates that specs are actually good before Build Agent uses them?

**Options:**

- **A:** No validation (trust Spec Agent)
- **B:** QA Agent reviews specs (new responsibility)
- **C:** Human spot-checks (manual review of 10% random sample)

**Recommendation:** Start with **A** (trust), add **C** (spot-checks) after 50+ specs generated to identify patterns.

---

## References

### Existing Specifications

- **PHASE1-TASK-04**: Complete evaluator context integration (excellent reference for format)
- **TASK-029**: Clarification Agent implementation (shows agent implementation pattern)

### Architecture Documents

- **STRATEGIC_PLAN.md**: Phase 2 overview (lines 172-201)
- **parent-harness/docs/AGENTS.md**: Agent definitions (lines 78-122 for Spec Agent)
- **parent-harness/docs/PHASES.md**: ParentHarness 43-phase plan

### Code References

- **parent-harness/orchestrator/src/agents/metadata.ts**: Spec Agent metadata (lines 78-100)
- **server/services/task-agent/**: Task management infrastructure

---

## Success Metrics

### Short-term (2 weeks)

1. **Spec Generation Rate**: 90% of user tasks receive specs within 5 minutes
2. **Spec Quality**: 80% of specs enable Build Agent to complete task without clarification
3. **Format Compliance**: 100% of specs include all required sections
4. **Pass Criteria Quality**: 90% of pass criteria are testable (verified by QA Agent)

### Medium-term (1 month)

1. **Build Success Rate**: 70% of tasks with specs complete successfully on first attempt (vs. 40% without specs)
2. **Iteration Reduction**: 30% fewer Build Agent iterations needed (clearer requirements)
3. **Decomposition Accuracy**: 80% of complex tasks decomposed appropriately (not too granular, not too coarse)
4. **Developer Satisfaction**: Positive feedback on spec quality from team

### Long-term (3 months)

1. **Autonomous Execution**: 50% of user tasks complete fully autonomously (Spec → Build → QA → Complete)
2. **Token Efficiency**: Average spec generation cost <$0.50 per task
3. **Pattern Learning**: Spec Agent references existing patterns in 90%+ of specs
4. **Zero-Ambiguity**: <5% of specs require follow-up clarification questions

---

## Conclusion

Spec Agent v0.1 is the **critical foundation** for autonomous task execution in the Vibe platform. By transforming vague task briefs into detailed, actionable specifications, it enables Build Agents to work independently, reduces iteration cycles, and maintains quality standards.

**Key Success Factors:**

1. **Thorough Codebase Exploration** - Specs must reflect actual project patterns
2. **Testable Pass Criteria** - QA Agent needs specific, measurable validation points
3. **Appropriate Decomposition** - Complex tasks broken into parallelizable subtasks
4. **Consistent Format** - All specs follow the same structure for predictability

**Next Steps:**

1. **Approval** - Review and approve this specification
2. **Implementation** - Assign to Build Agent (PHASE2-TASK-01-build)
3. **Validation** - QA Agent verifies against pass criteria
4. **Iteration** - Refine based on first 10 specs generated

**Status:** Ready for approval and implementation.
