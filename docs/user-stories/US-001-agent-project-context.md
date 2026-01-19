# US-001: Agents Need Project Context

## Problem Statement

When Vibe's agents (Build Agent, Spec Agent, Validation Agent) work on tasks for a user project, they lack context about:

- What code already exists in the project
- How to run, test, and build the project
- What the project's database schema looks like
- What conventions the project uses
- What has already been built vs what's left to do

This results in agents making incorrect assumptions, generating incompatible code, or failing tasks unnecessarily.

---

## User Stories

### US-001.1: As a Build Agent, I need project context to execute tasks correctly

**As a** Build Agent starting a task
**I want to** receive complete context about the project I'm working on
**So that** I can generate code that fits the existing codebase and conventions

**Acceptance Criteria:**

- Agent receives tech stack information (language, framework, database)
- Agent receives runtime commands (how to install, run, test, build)
- Agent receives database schema (tables, relationships, types)
- Agent receives file structure (where components live, API routes, etc.)
- Agent receives list of completed features (to avoid conflicts)

---

### US-001.2: As a user, I want my linked repo to be analyzed automatically

**As a** user who links a GitHub repo to Vibe
**I want** Vibe to automatically analyze my repo and extract context
**So that** I don't have to manually specify every detail about my project

**Acceptance Criteria:**

- Vibe detects tech stack from package.json, requirements.txt, go.mod, etc.
- Vibe extracts runtime commands from scripts/Makefile
- Vibe detects and parses ORM schema files (Drizzle, Prisma, SQLAlchemy)
- Vibe identifies key directories (src/, components/, routes/)
- Analysis results are stored and can be reviewed/edited by user

---

### US-001.3: As a user, I want to see and edit my project's context

**As a** user
**I want to** view and modify the auto-detected project context
**So that** I can correct any mistakes and add missing information

**Acceptance Criteria:**

- UI shows detected tech stack, runtime commands, schema
- User can edit any auto-detected values
- User can add custom context (conventions, patterns)
- Changes are saved and used by agents

---

## End-to-End Flows

### Flow 1: User Links Existing GitHub Repo

```
1. User navigates to Projects page
2. User clicks "Link GitHub Repo"
3. User pastes GitHub URL
4. Vibe clones repo to Vibe Environment (Vibe's GitHub space)
5. Vibe runs ProjectAnalyzer service on cloned repo
6. ProjectAnalyzer detects:
   - Tech stack from config files
   - Runtime commands from scripts
   - Database schema from ORM files
   - Directory structure
7. Vibe stores analysis in projects table
8. Vibe creates .vibe/ folder in cloned repo with context files
9. User sees analysis results, can edit if needed
10. Project is ready for task execution
```

### Flow 2: Project Created from Ideation (No Existing Repo)

```
1. Idea passes evaluation threshold
2. User clicks "Create Project" on idea
3. Vibe creates new empty repo in Vibe's GitHub space
4. Vibe initializes repo with template based on idea's tech preferences
5. Vibe creates .vibe/ folder with empty context (to be filled by Spec Agent)
6. Spec Agent generates initial spec.md with tech stack recommendations
7. User reviews and approves spec
8. Project context is populated from spec
9. Project is ready for task execution
```

### Flow 3: Build Agent Starts Task

```
1. Task is assigned to Build Agent
2. Build Agent Orchestrator calls ProjectContextLoader
3. ProjectContextLoader:
   a. Queries projects table for project record
   b. Loads cached context from projects.cached_context
   c. If stale, re-reads from .vibe/ folder in repo
   d. Returns complete ProjectContext object
4. Orchestrator injects context into agent's system prompt
5. Agent now knows:
   - Where the repo lives
   - Tech stack and conventions
   - Database schema
   - What's already built
6. Agent executes task with full context
7. On completion, agent updates .vibe/history.yaml with what was built
```

---

## Current System State

### What Exists Today

| Component                 | Location                                                 | Status                                           |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Projects table            | `schema/entities/project.ts`                             | Exists but minimal fields                        |
| Build Agent Orchestrator  | `server/services/task-agent/build-agent-orchestrator.ts` | Spawns agents but doesn't inject project context |
| Python Build Agent Worker | `coding-loops/agents/build_agent_worker.py`              | Receives task_id, not project context            |
| RelationshipMapper        | `server/services/observability/relationship-mapper.ts`   | Works for Vibe's schema, not user projects       |

### Fields in Current `projects` Table

| Field                 | Purpose           | Context Relevant? |
| --------------------- | ----------------- | ----------------- |
| id                    | Primary key       | No                |
| slug                  | URL identifier    | No                |
| code                  | Display ID prefix | No                |
| name                  | Human name        | Partial           |
| description           | Text description  | Partial           |
| ideaId                | Link to idea      | No                |
| ownerId               | Owner             | No                |
| status                | active/paused/etc | No                |
| createdAt/updatedAt   | Timestamps        | No                |
| startedAt/completedAt | Lifecycle         | No                |

**Missing Fields for Agent Context:**

- `github_url` - Where the repo lives
- `local_path` - Local clone path (in Vibe Environment)
- `tech_stack` - JSON array of technologies
- `runtime_commands` - JSON with install/dev/test/build
- `detected_schema` - Parsed database schema
- `entry_points` - Key directories
- `cached_context` - Full context snapshot
- `context_hash` - For cache invalidation
- `last_analyzed_at` - When context was last updated

---

## Suggested Solution

### Phase 1: Extend Projects Schema

Add fields to `schema/entities/project.ts`:

- `githubUrl` - The repo URL in Vibe's GitHub space
- `localPath` - Path where repo is cloned
- `techStack` - JSON text field
- `runtimeCommands` - JSON text field
- `detectedSchema` - JSON text field
- `entryPoints` - JSON text field
- `cachedContext` - JSON text field (full context snapshot)
- `contextHash` - Text for cache validation
- `lastAnalyzedAt` - Timestamp

### Phase 2: Create ProjectAnalyzer Service

New service at `server/services/project-analyzer.ts`:

- `analyzeRepo(repoPath)` - Analyze a cloned repo
- `detectTechStack(repoPath)` - Detect from config files
- `extractRuntimeCommands(repoPath)` - From package.json, Makefile
- `parseSchema(repoPath)` - From ORM files
- `identifyEntryPoints(repoPath)` - Key directories

### Phase 3: Create ProjectContextLoader Service

New service at `server/services/project-context-loader.ts`:

- `loadContext(projectId)` - Load full context for a project
- `refreshContext(projectId)` - Re-analyze repo and update cache
- `validateCache(projectId)` - Check if cache is stale

### Phase 4: Modify Build Agent Orchestrator

Update `spawnBuildAgent()` in `build-agent-orchestrator.ts`:

- Load project context before spawning
- Inject context into agent's environment/system prompt
- Pass context to Python worker

---

## Critical Questions

### Architecture Questions

1. **Where should project context live canonically?**
   - Option A: In the database (projects table)
   - Option B: In the repo (.vibe/ folder)
   - Option C: Both (repo is source of truth, DB is cache)
   - **Risk**: If we choose wrong, we get sync issues or stale data

2. **How do we handle context updates during development?**
   - When agent adds new feature, who updates history.yaml?
   - When schema changes, who updates schema.md?
   - **Risk**: Context drifts from reality if not kept in sync

3. **What's the minimum viable context for an agent to function?**
   - Can an agent work with just tech stack + runtime commands?
   - Do we need full schema for every task?
   - **Risk**: Over-engineering context when simpler approach works

### Technical Questions

4. **How do we parse different ORM schemas?**
   - Drizzle, Prisma, TypeORM, SQLAlchemy, Django ORM
   - Each has different file formats
   - **Risk**: Incomplete parsing leads to incorrect schema context

5. **How do we keep runtime commands accurate?**
   - package.json scripts can change
   - Custom scripts may exist outside package.json
   - **Risk**: Agent runs wrong command, task fails

6. **How do we handle monorepos?**
   - What if user's repo has multiple apps?
   - Which one does the project refer to?
   - **Risk**: Agent modifies wrong part of repo

### Integration Questions

7. **How does this integrate with the current task system?**
   - Tasks have `project_id` but no way to load project context
   - File impacts reference files but not project root
   - **Risk**: Task execution breaks if paths don't resolve

8. **How do agents running in Python access context stored in TypeScript/DB?**
   - Current workers get task_id only
   - Context would need to be passed as JSON or read from API
   - **Risk**: Serialization/deserialization overhead, type mismatches

---

## Gaps Analysis

### Gap 1: No Repo Reference in Projects

**Current State:** Projects table has no `github_url` or `local_path`
**Required State:** Must know where the code lives
**Impact:** Agents can't find the codebase to modify
**Solution:** Add fields to schema

### Gap 2: No Context Loading in Agent Spawn

**Current State:** `spawnBuildAgent()` passes only task_id and task_list_id
**Required State:** Must pass or load complete project context
**Impact:** Agents start tasks without knowing what they're working on
**Solution:** Modify orchestrator to load and inject context

### Gap 3: No Analysis Infrastructure

**Current State:** No service to analyze a repo and extract context
**Required State:** Need ProjectAnalyzer service
**Impact:** Can't auto-detect project properties
**Solution:** Build new service with parsers for each tech stack

### Gap 4: Python Worker Can't Access TypeScript Services

**Current State:** Python worker runs independently, only gets env vars
**Required State:** Worker needs full project context
**Impact:** Context must be passed at spawn time, not looked up
**Solution:** Either pass context as JSON, or expose context API for Python

### Gap 5: No .vibe/ Folder Convention

**Current State:** No standard structure in user repos
**Required State:** Standard folder for agent context
**Impact:** No place to store/read context in repo
**Solution:** Define and implement .vibe/ convention

---

## Other Considerations

### Security

- Vibe clones repos into its own GitHub space - need proper access controls
- Context may contain sensitive info (DB schemas, file paths)
- Agents must not leak context to unauthorized users

### Performance

- Loading full context for every task may be expensive
- Need caching strategy with invalidation
- Schema parsing can be slow for large projects

### Multi-Project

- User may have multiple projects active
- Each project needs isolated context
- Agents must not confuse contexts across projects

### Versioning

- Context should be versioned
- When schema changes, old tasks may need old context
- Need migration path for context format changes
