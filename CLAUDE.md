# Idea Incubator - Claude Code Instructions

## Project Overview

This is an idea incubation system that uses AI agents to evaluate and red-team ideas. It captures ideas via markdown files, evaluates them through parallel Claude agents, and provides comprehensive visualization and analysis.

## Skills Available

- `/idea-capture` - Create a new idea folder with template
- `/idea-develop` - Flesh out an idea with questions
- `/idea-evaluate` - Score against 30 criteria
- `/idea-redteam` - Challenge assumptions
- `/idea-organize` - Help with file organization

## Behavior Guidelines

1. **Always confirm idea context** - If discussing an idea, confirm which one before making changes
2. **Reference taxonomy** - Use lifecycle stages and criteria from `taxonomy/` folder
3. **Proactive questioning** - After capturing an idea, ask 3 clarifying questions
4. **Update database** - Remind user to run `npm run sync` after file changes
5. **Cost awareness** - Warn user before running expensive evaluations
6. **NEVER stop servers** - Never stop a running server unless explicitly asked to do so
7. **ALWAYS use python3** - Never use `python`, always use `python3` for all Python commands

## File Locations

| Content Type | Location |
|--------------|----------|
| Ideas | `ideas/[slug]/README.md` |
| Evaluations | `ideas/[slug]/evaluation.md` |
| Development notes | `ideas/[slug]/development.md` |
| Red team challenges | `ideas/[slug]/redteam.md` |
| Research | `ideas/[slug]/research/*.md` |
| User profiles | `profiles/[slug].md` (exported) |
| Database | `database/ideas.db` |
| Templates | `templates/*.md` |
| Taxonomy | `taxonomy/*.md` |

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

depends_on: ["T-000"]  # Task dependencies
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

| Type | Description | Example |
|------|-------------|---------|
| `gotcha` | Mistake to avoid | "Use TEXT for dates in SQLite" |
| `pattern` | Reusable approach | "API route registration pattern" |
| `decision` | Architecture choice | "Use sql.js not better-sqlite3" |

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

| Component | Location | Purpose |
|-----------|----------|---------|
| Message Bus | `shared/message_bus.py` | Inter-agent events, file locking |
| Verification Gate | `shared/verification_gate.py` | Validate agent claims |
| Knowledge Base | `shared/knowledge_base.py` | Cross-agent learning |
| Resource Registry | `shared/resource_registry.py` | File ownership |
| Git Manager | `shared/git_manager.py` | Branch management |
| Checkpoint Manager | `shared/checkpoint_manager.py` | Rollback support |

### Running Loops
```bash
# Always use python3
python3 coding-loops/loop-1-critical-path/run_loop.py
python3 coding-loops/loop-2-infrastructure/run_loop.py
python3 coding-loops/loop-3-polish/run_loop.py
```
