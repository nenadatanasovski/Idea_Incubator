# Idea Incubator - Claude Code Instructions

## Project Overview

This is an idea incubation system that uses AI agents to evaluate and red-team ideas. It captures ideas via markdown files, evaluates them through parallel Claude agents, and provides comprehensive visualization and analysis.

## Skills Available

### Ideation Skills

- `/idea-capture` - Create a new idea folder with template
- `/idea-develop` - Flesh out an idea with questions
- `/idea-evaluate` - Score against 30 criteria
- `/idea-redteam` - Challenge assumptions
- `/idea-organize` - Help with file organization

### Schema Management Skills

- `/schema-add-entity` - Add a new entity to the data model
- `/schema-modify-entity` - Modify an existing entity (add/remove/change fields)
- `/schema-add-enum` - Add a new enum type
- `/schema-add-relationship` - Add relationships between entities
- `/schema-validate` - Validate schema consistency and integrity

## Behavior Guidelines

1. **Always confirm idea context** - If discussing an idea, confirm which one before making changes
2. **Reference taxonomy** - Use lifecycle stages and criteria from `taxonomy/` folder
3. **Proactive questioning** - After capturing an idea, ask 3 clarifying questions
4. **Update database** - Remind user to run `npm run sync` after file changes
5. **Cost awareness** - Warn user before running expensive evaluations
6. **NEVER stop servers** - Never stop a running server unless explicitly asked to do so
7. **ALWAYS use python3** - Never use `python`, always use `python3` for all Python commands

## File Locations

| Content Type        | Location                        |
| ------------------- | ------------------------------- |
| Ideas               | `ideas/[slug]/README.md`        |
| Evaluations         | `ideas/[slug]/evaluation.md`    |
| Development notes   | `ideas/[slug]/development.md`   |
| Red team challenges | `ideas/[slug]/redteam.md`       |
| Research            | `ideas/[slug]/research/*.md`    |
| User profiles       | `profiles/[slug].md` (exported) |
| Database            | `database/ideas.db`             |
| Templates           | `templates/*.md`                |
| Taxonomy            | `taxonomy/*.md`                 |
| Schema definitions  | `schema/entities/*.ts`          |
| Schema registry     | `schema/registry.ts`            |

## Data Model Discovery

The canonical data model is defined in `schema/entities/*.ts` using Drizzle ORM.

### For Agents (Programmatic Access)

```bash
# List all entities and endpoints
curl http://localhost:3001/api/schema

# Get specific entity schema (JSON Schema format)
curl http://localhost:3001/api/schema/entities/{entityName}

# Get all enums
curl http://localhost:3001/api/schema/enums

# Get relationship graph
curl http://localhost:3001/api/schema/relationships

# Get full schema dump
curl http://localhost:3001/api/schema/full
```

### For Code (Type-Safe Import)

```typescript
// Import types
import { Task, NewTask } from "@/schema";

// Import validation schemas
import { insertTaskSchema, selectTaskSchema } from "@/schema";

// Validate input
const result = insertTaskSchema.safeParse(userInput);
```

### Data Model Change Rules

1. **NEVER** define types outside `schema/` directory
2. All database tables **MUST** have a corresponding schema entity
3. When modifying data model, update `schema/entities/*.ts` **ONLY**
4. Use skills: `/schema-add-entity`, `/schema-modify-entity`, `/schema-add-relationship`
5. Always run `/schema-validate` before deploying schema changes

### Schema Commands

```bash
npm run schema:generate     # Generate migration from schema changes
npm run schema:migrate      # Apply migrations to database
npm run schema:validate     # Validate schema consistency
npm run schema:studio       # Open Drizzle Studio (visual editor)
```

## Common Commands

```bash
# Idea management
npm run cli capture         # Capture new idea
npm run cli list            # List all ideas
npm run cli show <slug>     # Show idea details

# User profiles (for Personal Fit evaluation)
npm run profile create      # Create a new user profile interactively
npm run profile list        # List all profiles
npm run profile show <slug> # Show profile details
npm run profile link <idea-slug> <profile-slug>  # Link profile to idea

# Database
npm run sync                # Sync markdown to database
npm run migrate             # Run database migrations

# Evaluation
npm run evaluate <slug>     # Run AI evaluation
npm run evaluate <slug> --budget=15  # With custom budget

# Testing
npm test                    # Run all tests
npm test:run                # Run tests once

# Ralph Loops (always use python3)
python3 tests/e2e/ralph_loop.py                      # Main E2E test loop
python3 tests/e2e/unified-fs-ralph-loop.py           # Unified File System implementation
python3 tests/e2e/unified-fs-ralph-loop.py --max-iterations 5  # With limit
```

## User Profiles (Personal Fit)

User profiles provide context for accurate Personal Fit (FT1-FT5) evaluation. Without a profile, Fit scores default to 5/10 with low confidence.

**Profile captures:**

- **Goals (FT1)**: income, impact, learning, portfolio, lifestyle, exit, passion, legacy
- **Passion (FT2)**: interests, motivations, domain connection
- **Skills (FT3)**: technical skills, experience, expertise, known gaps
- **Network (FT4)**: industry connections, professional network, communities
- **Life Stage (FT5)**: employment status, hours available, runway, risk tolerance

**Usage:**

1. Create profile once: `npm run profile create`
2. Link to each idea: `npm run profile link my-idea my-profile`
3. Run evaluation: `npm run evaluate my-idea` (profile auto-loaded)

## Lifecycle Stages

Ideas progress through these stages:
SPARK → CLARIFY → RESEARCH → IDEATE → EVALUATE → VALIDATE →
DESIGN → PROTOTYPE → TEST → REFINE → BUILD → LAUNCH →
GROW → MAINTAIN → PIVOT → PAUSE → SUNSET → ARCHIVE → ABANDONED

## Evaluation Criteria

30 criteria across 6 categories:

- **Problem** (5): Clarity, Severity, Target User, Validation, Uniqueness
- **Solution** (5): Clarity, Feasibility, Uniqueness, Scalability, Defensibility
- **Feasibility** (5): Technical, Resources, Skills, Time to Value, Dependencies
- **Fit** (5): Personal, Passion, Skills, Network, Life Stage
- **Market** (5): Size, Growth, Competition, Entry Barriers, Timing
- **Risk** (5): Execution, Market, Technical, Financial, Regulatory

## Budget Guidelines

Default evaluation budget: $10

- Initial evaluation: ~$2
- Red team challenges: ~$4
- Debate rounds: ~$3
- Synthesis: ~$1

## Agent Types

### Ideation & Evaluation Agents (Existing)

1. **Orchestrator** - Routes inputs, manages flow
2. **Classifier** - Auto-tags and detects relationships
3. **Evaluator** - Scores against 30 criteria
4. **Red Team** - Challenges assumptions (Skeptic, Realist, First Principles)
5. **Arbiter** - Judges debate rounds
6. **Synthesizer** - Creates final evaluation documents
7. **Development** - Asks clarifying questions

### Build Pipeline Agents (New)

8. **Specification Agent** - Transforms ideation artifacts into executable specs
9. **Build Agent** - Executes atomic tasks from specs
10. **Self-Improvement Agent (SIA)** - Learns from failures, improves system

---

## Unified File System

Ideas are stored in a structured folder hierarchy:

```
users/{user-slug}/ideas/{idea-slug}/
├── README.md                    # Core idea overview
├── development.md               # Q&A from development sessions
├── target-users.md              # User personas
├── problem-solution.md          # Problem/solution framing
├── research/
│   ├── market.md                # Market research
│   ├── competitive.md           # Competitive analysis
│   └── technical.md             # Technical feasibility
├── planning/
│   ├── brief.md                 # Handoff brief (Ideation → Spec)
│   ├── mvp-scope.md             # MVP definition
│   └── architecture.md          # High-level architecture
├── build/
│   ├── spec.md                  # Technical specification
│   ├── tasks.md                 # Atomic task breakdown
│   └── decisions.md             # Architecture decisions
└── analysis/
    ├── redteam.md               # Red team challenges
    └── risk-mitigation.md       # Risk responses
```

---

## Specification Conventions

When generating `build/spec.md`:

1. **Always include context references** - List all documents the spec is derived from
2. **Requirements must be testable** - Each FR should have acceptance criteria
3. **Identify file ownership** - Note which files are owned by other agents/loops
4. **Inject gotchas from Knowledge Base** - Query relevant gotchas by file pattern
5. **Include validation commands** - How to verify the spec is implemented correctly

---

## Atomic Task Conventions

When generating `build/tasks.md`:

### Task Structure (PIV-style)

```yaml
id: T-001
phase: database | types | api | ui | tests
action: CREATE | UPDATE | ADD | DELETE | VERIFY
file: "path/to/file.ts"
status: pending | in_progress | complete | failed | blocked

requirements:
  - "Clear, actionable requirement"
  - "Another requirement"

gotchas:
  - "Mistake to avoid (from Knowledge Base)"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Template code to guide implementation

depends_on: ["T-000"] # Task dependencies
```

### Phase Order

1. **database** - Migrations first (other phases depend on schema)
2. **types** - TypeScript interfaces before implementation
3. **api** - Server routes and endpoints
4. **ui** - Frontend components
5. **tests** - Unit and integration tests

### Gotcha Sources

- Knowledge Base entries tagged with file pattern
- Previous failures for similar tasks
- Common mistakes for the action type (CREATE, UPDATE, etc.)

---

## Build Agent Workflow

The Build Agent follows the PIV Loop pattern:

1. **Prime** - Load context (spec.md, tasks.md, CLAUDE.md, gotchas)
2. **Execute** - For each task:
   - Check file ownership (ResourceRegistry)
   - Acquire file lock
   - Create checkpoint
   - Execute task
   - Run validation command
   - Record discoveries
3. **Validate** - Run full verification suite
4. **Report** - Generate execution summary, publish events

---

## Knowledge Base

Cross-agent learning through shared knowledge:

| Type       | Description         | Example                          |
| ---------- | ------------------- | -------------------------------- |
| `gotcha`   | Mistake to avoid    | "Use TEXT for dates in SQLite"   |
| `pattern`  | Reusable approach   | "API route registration pattern" |
| `decision` | Architecture choice | "Use sql.js not better-sqlite3"  |

### Recording Discoveries

When Build Agent discovers a new gotcha or pattern:

1. Record in Knowledge Base with confidence score
2. Tag with file pattern (e.g., `*.sql`, `server/routes/*`)
3. Tag with action type (CREATE, UPDATE, etc.)
4. SIA reviews and propagates to CLAUDE.md if universal

---

## Database Conventions

### SQLite Best Practices

- Use `TEXT` for dates, not `DATETIME`
- Always include `IF NOT EXISTS`
- Foreign keys require `PRAGMA foreign_keys = ON`
- Use `datetime('now')` for timestamps

### TypeScript Types for DB

- IDs are always `string` (UUIDs)
- Dates are ISO strings (`createdAt: string`)
- Boolean fields stored as `INTEGER` (0/1) in SQLite

---

## API Conventions

### Route Patterns

```typescript
// Routes live in server/routes/{feature}.ts
import { Router } from 'express';
const router = Router();

// GET /api/{feature}
router.get('/', async (req, res) => { ... });

// POST /api/{feature}
router.post('/', async (req, res) => { ... });

export default router;
```

### Error Handling

- Return appropriate status codes (404, 400, 500)
- Always validate input before database calls
- Use `try/catch` with error logging

---

## Coding Loops Infrastructure

The multi-agent coordination system lives in `coding-loops/`:

| Component          | Location                       | Purpose                          |
| ------------------ | ------------------------------ | -------------------------------- |
| Message Bus        | `shared/message_bus.py`        | Inter-agent events, file locking |
| Verification Gate  | `shared/verification_gate.py`  | Validate agent claims            |
| Knowledge Base     | `shared/knowledge_base.py`     | Cross-agent learning             |
| Resource Registry  | `shared/resource_registry.py`  | File ownership                   |
| Git Manager        | `shared/git_manager.py`        | Branch management                |
| Checkpoint Manager | `shared/checkpoint_manager.py` | Rollback support                 |

### Running Loops

```bash
# Always use python3
python3 coding-loops/loop-1-critical-path/run_loop.py
python3 coding-loops/loop-2-infrastructure/run_loop.py
python3 coding-loops/loop-3-polish/run_loop.py
```

---

## Agent Monitoring Dashboard

The Agent Dashboard at `/agents` provides real-time monitoring:

| Feature                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| Agent Status Cards     | Shows all 6 agents with status, metrics, current task |
| Question Queue         | Priority-sorted blocking questions requiring answers  |
| Activity Timeline      | Recent agent activities (tasks, questions)            |
| Task Executor Controls | Start/stop/pause task execution                       |

### Agent Types in Dashboard

- `spec-agent` - Specification generation
- `build-agent` - Task execution
- `validation-agent` - Quality validation
- `sia` - Self-Improvement Agent
- `ux-agent` - UX optimization
- `monitoring-agent` - System health

---

## Task Execution System

### Task Lists

Task lists are markdown files with YAML frontmatter containing executable tasks.

```bash
# Browse available task lists
# Frontend: /task-lists

# Execute tasks via API
POST /api/executor/start { taskListPath: "path/to/tasks.md" }
POST /api/executor/pause
POST /api/executor/resume
POST /api/executor/stop
```

### Kanban Board

Available at `/kanban` - shows tasks by status (pending, in_progress, complete, failed, blocked).

---

## WebSocket Connections

All WebSocket connections use automatic reconnection with exponential backoff.

```typescript
// Connection URL patterns
ws://localhost:3001/ws?executor=tasks  // Task executor events
ws://localhost:3001/ws?session={id}    // Ideation session
ws://localhost:3001/ws?idea={slug}     // Debate stream
ws://localhost:3001/ws?monitor=agents  // Agent monitoring
```

### Event Types

- `task:started`, `task:completed`, `task:failed`, `task:skipped`
- `executor:started`, `executor:paused`, `executor:resumed`, `executor:stopped`
- `question:new`, `question:answered`, `question:expired`
- `agent:registered`, `agent:blocked`, `agent:unblocked`, `agent:error`

---

## Question Queue System

Blocking questions halt agent execution until answered.

| Priority | Type       | Description             |
| -------- | ---------- | ----------------------- |
| 100      | BLOCKING   | Must answer to continue |
| 80       | APPROVAL   | Needs user sign-off     |
| 60       | ESCALATION | Agent needs human help  |
| 40       | DECISION   | Multiple valid choices  |

### API Endpoints

```bash
GET  /api/questions/pending          # Get pending questions
POST /api/questions/:id/answer       # Submit answer
POST /api/questions/:id/skip         # Skip with reason
```

---

## Monitoring Agent (System Soul)

The Monitoring Agent tracks system health with configurable thresholds:

```typescript
alertThresholds: {
  pendingQuestions: 10,    // Alert if > 10 pending
  blockedAgents: 3,        // Alert if > 3 blocked
  errorRate: 10,           // Alert if > 10% errors
  responseTimeMs: 60000,   // Alert if avg > 1 min
}
```

Issues detected: `timeout`, `error`, `drift`, `anomaly`, `threshold`

---

## New API Routes

| Route                       | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `/api/agents`               | Agent status and metrics                 |
| `/api/agents/:id/heartbeat` | Record agent heartbeat                   |
| `/api/executor/*`           | Task execution control                   |
| `/api/task-lists`           | Browse/manage task lists                 |
| `/api/questions/*`          | Question queue management                |
| `/api/notifications/*`      | Notification system                      |
| `/api/knowledge/*`          | Knowledge base queries                   |
| `/api/task-agent/*`         | Task Agent (parallel execution) routes   |
| `/api/projects/*`           | Project management (idea-to-task bridge) |

---

## Projects

Projects bridge the gap between **Ideas** (ideation phase) and **Tasks** (execution phase). They provide the organizational container for continuous development, linking an idea's journey from conception through implementation.

### Project Entity

| Field        | Type | Description                            |
| ------------ | ---- | -------------------------------------- |
| id           | TEXT | UUID primary key                       |
| slug         | TEXT | URL-safe identifier (unique)           |
| code         | TEXT | 2-4 char code for display IDs (unique) |
| name         | TEXT | Human-readable name                    |
| description  | TEXT | Optional description                   |
| idea_id      | TEXT | Link to originating idea (1:1, unique) |
| owner_id     | TEXT | Owner user ID                          |
| status       | TEXT | active, paused, completed, archived    |
| started_at   | TEXT | When first task started                |
| completed_at | TEXT | When all tasks completed               |

### Idea to Project Transition

When an idea is ready for execution:

1. **Create project**: `POST /api/projects/from-idea { ideaId: "..." }`
2. Project inherits name from idea title
3. Project code auto-generated (e.g., "VIBE" from "Vibe Check App")
4. Tasks created with project reference use the code in display IDs

### Project API Routes

| Route                           | Method | Description                      |
| ------------------------------- | ------ | -------------------------------- |
| `/api/projects`                 | GET    | List all projects (with filters) |
| `/api/projects`                 | POST   | Create new project               |
| `/api/projects/:ref`            | GET    | Get by ID, code, or slug         |
| `/api/projects/:id`             | PUT    | Update project                   |
| `/api/projects/:id`             | DELETE | Delete project                   |
| `/api/projects/:id/link-idea`   | POST   | Link idea to project             |
| `/api/projects/:id/unlink-idea` | POST   | Unlink idea from project         |
| `/api/projects/from-idea`       | POST   | Create project from idea         |
| `/api/projects/by-idea/:slug`   | GET    | Get project by idea slug         |
| `/api/projects/:id/start`       | POST   | Mark project as started          |
| `/api/projects/:id/complete`    | POST   | Mark project as completed        |

### Project Views

| View                        | Purpose                          |
| --------------------------- | -------------------------------- |
| `project_stats_view`        | Project with task/PRD statistics |
| `idea_project_view`         | Ideas mapped to their projects   |
| `active_projects_view`      | Active projects with quick stats |
| `project_task_list_summary` | Task lists grouped by project    |

---

## Parallel Task Execution System

The Task Agent manages parallel task execution with these key features:

### Core Concepts

| Concept              | Description                                                                |
| -------------------- | -------------------------------------------------------------------------- |
| **Evaluation Queue** | Staging area for listless tasks awaiting analysis and grouping             |
| **Display ID**       | Human-readable task ID format: `TU-PROJ-CAT-###` (e.g., `TU-IDEA-FEA-042`) |
| **Execution Waves**  | Groups of tasks that can run in parallel without conflicts                 |
| **Build Agent**      | 1 agent = 1 task, spawned dynamically based on parallelism                 |

### Task Lifecycle

```
Task Creation → Evaluation Queue → Analysis → Auto-Grouping → Task List → Parallel Execution
```

### Task ID Format

```
TU-{PROJECT_CODE}-{CATEGORY_CODE}-{SEQUENCE}
Examples:
  TU-IDEA-FEA-042  - Feature task for IDEA project
  TU-INCU-BUG-007  - Bug fix for INCU project
  TU-TASK-REF-003  - Refactor task
```

**PROJECT_CODE** is derived from the `projects` table:

- If project exists: Uses `projects.code` (2-4 uppercase chars)
- Legacy fallback: Extracts from `project_id` string
- Default: "GEN" (General project)

### Category Codes

| Code | Category       |
| ---- | -------------- |
| FEA  | Feature        |
| BUG  | Bug Fix        |
| ENH  | Enhancement    |
| REF  | Refactor       |
| DOC  | Documentation  |
| TST  | Test           |
| INF  | Infrastructure |
| RES  | Research       |
| SEC  | Security       |
| PRF  | Performance    |

### Task Agent API Routes

| Route                                             | Method | Description                       |
| ------------------------------------------------- | ------ | --------------------------------- |
| `/api/task-agent/tasks`                           | POST   | Create task (listless or in list) |
| `/api/task-agent/evaluation-queue`                | GET    | Get tasks in Evaluation Queue     |
| `/api/task-agent/evaluation-queue/stats`          | GET    | Get queue statistics              |
| `/api/task-agent/tasks/:id/move`                  | POST   | Move task to task list            |
| `/api/task-agent/grouping-suggestions`            | GET    | Get auto-grouping suggestions     |
| `/api/task-agent/grouping-suggestions/:id/accept` | POST   | Accept suggestion                 |
| `/api/task-agent/grouping-suggestions/:id/reject` | POST   | Reject suggestion                 |
| `/api/task-agent/task-lists/:id/parallelism`      | GET    | Get parallelism analysis          |
| `/api/task-agent/task-lists/:id/execute`          | POST   | Start parallel execution          |
| `/api/task-agent/agents`                          | GET    | Get active Build Agents           |
| `/api/task-agent/dependencies/check-cycle`        | POST   | Check for circular dependencies   |

### File Conflict Matrix

Tasks cannot run in parallel if they have conflicting file operations:

| Task A | Task B | Conflict? | Reason                            |
| ------ | ------ | --------- | --------------------------------- |
| CREATE | CREATE | YES       | Same file cannot be created twice |
| UPDATE | UPDATE | YES       | Concurrent modification           |
| UPDATE | DELETE | YES       | File may not exist                |
| DELETE | DELETE | YES       | Double delete                     |
| DELETE | READ   | YES       | File may not exist                |
| READ   | READ   | NO        | Safe                              |

### Telegram Commands

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `/newtask <desc>` | Create task in Evaluation Queue |
| `/queue`          | Show Evaluation Queue status    |
| `/suggest`        | Get grouping suggestions        |
| `/parallel [id]`  | Show parallelism status         |
| `/agents`         | Show active Build Agents        |

### Service Locations

| Service                  | Path                                                           |
| ------------------------ | -------------------------------------------------------------- |
| Evaluation Queue Manager | `server/services/task-agent/evaluation-queue-manager.ts`       |
| Task Creation Service    | `server/services/task-agent/task-creation-service.ts`          |
| File Impact Analyzer     | `server/services/task-agent/file-impact-analyzer.ts`           |
| Parallelism Calculator   | `server/services/task-agent/parallelism-calculator.ts`         |
| Build Agent Orchestrator | `server/services/task-agent/build-agent-orchestrator.ts`       |
| Auto-Grouping Engine     | `server/services/task-agent/auto-grouping-engine.ts`           |
| Circular Dep Prevention  | `server/services/task-agent/circular-dependency-prevention.ts` |

### Database Tables

| Table                         | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `tasks`                       | Task records with display_id and queue        |
| `task_lists_v2`               | Task list containers                          |
| `task_relationships`          | Dependencies between tasks                    |
| `task_file_impacts`           | Predicted file operations                     |
| `parallelism_analysis`        | Task pair analysis cache                      |
| `parallel_execution_waves`    | Execution wave tracking                       |
| `build_agent_instances`       | Active Build Agents                           |
| `grouping_suggestions`        | Auto-grouping suggestions                     |
| `task_test_results`           | Test execution results (syntax, unit, e2e)    |
| `task_appendices`             | Attachable context (acceptance criteria, etc) |
| `acceptance_criteria_results` | Persisted AC verification status              |

---

## Task Testing System

### Test Levels

Tests are organized by execution phase (when they run):

| Level | Name   | Description            | Default Command                 |
| ----- | ------ | ---------------------- | ------------------------------- |
| 1     | Syntax | Type checking, linting | `npx tsc --noEmit`              |
| 2     | Unit   | Unit tests             | `npm test -- --passWithNoTests` |
| 3     | E2E    | Integration/E2E tests  | `npm run test:e2e`              |

### Test Scopes

Tests are categorized by system component (what they test):

| Scope         | Description                            |
| ------------- | -------------------------------------- |
| `codebase`    | File existence, compilation, structure |
| `database`    | Schema validation, migrations          |
| `api`         | Endpoint tests, contract validation    |
| `ui`          | Component tests, rendering             |
| `integration` | Cross-system tests, E2E flows          |

### Acceptance Criteria

Acceptance criteria are stored in `task_appendices` with `appendix_type = 'acceptance_criteria'`.

- Criteria can be scoped via `metadata.scope` (JSON column)
- Verification status is persisted in `acceptance_criteria_results`
- Users can manually verify criteria via checkboxes in the UI
- Verification includes: `met` (boolean), `verified_by` (user/agent/system), `verified_at` (timestamp)

### Test API Routes

| Route                                                              | Method | Description                     |
| ------------------------------------------------------------------ | ------ | ------------------------------- |
| `/api/pipeline/tasks/:taskId/acceptance-criteria`                  | GET    | Get AC with verification status |
| `/api/pipeline/tasks/:taskId/acceptance-criteria/:appendixId/:idx` | PUT    | Update single criterion         |
| `/api/pipeline/tasks/:taskId/acceptance-criteria`                  | PUT    | Bulk update criteria            |
| `/api/pipeline/tasks/:taskId/acceptance-criteria?mode=reset`       | DELETE | Reset all AC to unverified      |
| `/api/pipeline/tasks/:taskId/acceptance-criteria?mode=delete`      | DELETE | Delete all AC results           |
