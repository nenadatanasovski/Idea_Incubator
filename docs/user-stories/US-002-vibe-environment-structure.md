# US-002: Vibe Environment Structure

## Problem Statement

When a project enters the Vibe Environment (Vibe's managed GitHub space), there is no defined structure for:

- Where agent context lives within the project repo
- Where agent-generated artifacts go
- How agents discover the project's current state
- What files Vibe adds vs what files belong to the user

Without a standard structure, agents can't reliably find or update project state, and there's no clear separation between user code and Vibe infrastructure.

---

## User Stories

### US-002.1: As Vibe, I need a standard folder structure to manage agent context

**As the** Vibe Platform
**I want to** create a standard `.vibe/` folder in every project repo
**So that** all agents know exactly where to find and store project context

**Acceptance Criteria:**

- Every project in Vibe Environment has a `.vibe/` folder
- Folder structure is consistent across all projects
- Contents are version controlled with the project
- Structure is documented and stable

---

### US-002.2: As an agent, I need predictable file locations

**As a** Build Agent or any Vibe agent
**I want to** find project context in predictable locations
**So that** I don't have to search or guess where things are

**Acceptance Criteria:**

- Tech stack info is always at `.vibe/context.yaml`
- Runtime commands are always at `.vibe/runtime.yaml`
- Database schema is always at `.vibe/schema.md`
- Build history is always at `.vibe/history.yaml`
- Agent can rely on these paths without configuration

---

### US-002.3: As a user, I want to understand what Vibe adds to my repo

**As a** user with a project in Vibe Environment
**I want to** clearly see what Vibe has added to my repo
**So that** I understand the difference between my code and Vibe's infrastructure

**Acceptance Criteria:**

- All Vibe files are contained in `.vibe/` folder
- `.vibe/` folder has a README explaining its purpose
- User can safely ignore `.vibe/` without breaking their app
- Vibe never modifies files outside `.vibe/` without explicit task instructions

---

### US-002.4: As a user, I want to take my project out of Vibe

**As a** user who wants to stop using Vibe for a project
**I want to** remove Vibe's additions without affecting my code
**So that** I'm not locked into Vibe

**Acceptance Criteria:**

- Deleting `.vibe/` folder removes all Vibe infrastructure
- App still runs normally without `.vibe/`
- No Vibe dependencies injected into package.json, requirements.txt, etc.
- Export process clearly documented

---

## End-to-End Flows

### Flow 1: New Project Created (No Existing Repo)

```
1. Idea passes evaluation, user creates project
2. Vibe creates new repo in Vibe's GitHub org
3. Vibe initializes repo with:
   ├── .vibe/
   │   ├── README.md        (explains what this folder is)
   │   ├── context.yaml     (empty/template, to be filled by Spec Agent)
   │   ├── runtime.yaml     (empty/template)
   │   ├── schema.md        (empty, to be filled when DB is designed)
   │   ├── history.yaml     (empty)
   │   └── agent-logs/      (empty folder)
   ├── .gitignore           (includes .vibe/agent-logs/)
   └── README.md            (project readme)
4. Spec Agent runs, fills in context.yaml based on idea requirements
5. As tasks complete, history.yaml is updated
6. User's code is added to root alongside .vibe/
```

### Flow 2: Existing Repo Linked

```
1. User links GitHub repo to project
2. Vibe forks/clones repo to Vibe's GitHub org
3. Vibe runs ProjectAnalyzer on repo
4. Vibe creates .vibe/ folder with detected values:
   ├── .vibe/
   │   ├── README.md        (explains what this folder is)
   │   ├── context.yaml     (populated from analysis)
   │   ├── runtime.yaml     (populated from package.json scripts, etc.)
   │   ├── schema.md        (parsed from ORM files)
   │   ├── history.yaml     (empty - user can backfill)
   │   └── agent-logs/      (empty folder)
5. Vibe commits .vibe/ folder to repo
6. User reviews detected context, can edit if needed
7. Project ready for task execution
```

### Flow 3: Agent Reads Context

```
1. Build Agent starts task
2. Agent looks up project's repo path
3. Agent reads .vibe/context.yaml for:
   - Project name and description
   - Tech stack (language, frameworks, database)
   - Key directories
4. Agent reads .vibe/runtime.yaml for:
   - Install command
   - Dev server command
   - Test command
   - Build command
5. Agent reads .vibe/schema.md for:
   - Database tables and columns
   - Relationships
6. Agent reads .vibe/history.yaml for:
   - Previously completed features
   - Known issues
7. Agent executes task with full context
```

### Flow 4: Agent Updates Context After Task

```
1. Build Agent completes task "Add user authentication"
2. Agent appends to .vibe/history.yaml:
   - Feature name and description
   - Files created/modified
   - Date completed
3. If task changed database schema:
   - Agent updates .vibe/schema.md
4. Agent commits changes to .vibe/ files
5. Context is now current for next agent
```

---

## Proposed `.vibe/` Folder Structure

```
.vibe/
├── README.md                 # Explains what this folder is for
├── context.yaml              # Project identity and metadata
├── runtime.yaml              # How to run, test, build
├── schema.md                 # Database schema (human + agent readable)
├── conventions.md            # Code patterns, file naming, architecture
├── history.yaml              # Completed features, changes over time
├── known-issues.yaml         # Bugs, tech debt, limitations
├── agent-logs/               # Execution logs from agent runs (gitignored)
│   ├── 2024-01-20-task-123.log
│   └── ...
└── prompts/                  # Custom prompts for this project (optional)
    ├── code-style.md         # "Always use functional components"
    └── architecture.md       # "We use repository pattern"
```

---

## Current System State

### What Exists Today

| Component                                   | Status             |
| ------------------------------------------- | ------------------ |
| Standard folder structure for user projects | **Does not exist** |
| `.vibe/` folder convention                  | **Does not exist** |
| Context files (context.yaml, runtime.yaml)  | **Does not exist** |
| Agent logic to read from `.vibe/`           | **Does not exist** |
| Agent logic to update `.vibe/` after tasks  | **Does not exist** |

### Related Existing Structures

| Structure                | Purpose                             | Applicable?                                             |
| ------------------------ | ----------------------------------- | ------------------------------------------------------- |
| `ideas/{slug}/`          | Ideation artifacts for an idea      | No - this is ideation, not execution                    |
| `ideas/{slug}/build/`    | Build artifacts (spec.md, tasks.md) | Partially - but lives in ideas folder, not project repo |
| `CLAUDE.md` in repo root | Agent context for this repo         | Yes - but only for Vibe platform itself                 |

---

## Suggested Solution

### Phase 1: Define `.vibe/` Specification

Create formal specification for:

- Required files (context.yaml, runtime.yaml, schema.md)
- Optional files (conventions.md, prompts/)
- File formats (YAML vs Markdown vs JSON)
- Versioning (how to handle spec changes)

### Phase 2: Create Vibe Folder Initializer

New service at `server/services/vibe-folder-initializer.ts`:

- `initializeVibeFolder(repoPath, analysis?)` - Create .vibe/ structure
- `validateVibeFolder(repoPath)` - Check if .vibe/ is valid
- `upgradeVibeFolder(repoPath)` - Upgrade old versions to new spec

### Phase 3: Integrate with Project Creation

Modify project creation flow:

- When new project created: initialize empty .vibe/
- When repo linked: analyze + initialize populated .vibe/
- When project cloned from template: copy template .vibe/

### Phase 4: Agent Context Reading

Modify agent spawn logic:

- Load context from .vibe/ folder
- Fallback to database if .vibe/ missing
- Validate context before passing to agent

### Phase 5: Agent Context Writing

Modify task completion logic:

- Agent updates .vibe/history.yaml on success
- Agent updates .vibe/schema.md if DB changes
- Changes are committed to repo

---

## Critical Questions

### Design Questions

1. **Should `.vibe/` be the source of truth or a cache?**
   - Option A: `.vibe/` is canonical, DB is derived
   - Option B: DB is canonical, `.vibe/` is generated
   - Option C: Both are canonical, sync required
   - **Risk**: Choosing wrong creates sync nightmares

2. **What format for context files?**
   - YAML: Human-readable, good for config
   - Markdown: Good for schema.md, human-editable
   - JSON: Easier to parse, harder to edit
   - **Risk**: Wrong format makes files hard to maintain

3. **Who commits `.vibe/` changes?**
   - Agents commit directly to repo?
   - Vibe platform commits on behalf of agents?
   - **Risk**: Commit history gets noisy with agent commits

4. **What goes in `.vibe/` vs stays in database?**
   - Principle: `.vibe/` = what agents need, DB = what platform needs?
   - Task history in both places?
   - **Risk**: Duplication leads to inconsistency

### Technical Questions

5. **How do agents running in containers access `.vibe/`?**
   - Mount repo into container?
   - Copy `.vibe/` into container at spawn?
   - **Risk**: File system access complexity

6. **How do we handle merge conflicts in `.vibe/`?**
   - Multiple agents updating history.yaml simultaneously?
   - User editing context.yaml while agent running?
   - **Risk**: Concurrent updates corrupt files

7. **What about projects that already have `.vibe/` folder?**
   - User might have their own `.vibe/` for something else
   - **Risk**: Name collision, overwrite user data

### Process Questions

8. **When does `.vibe/` get updated?**
   - After every task?
   - After every wave of tasks?
   - Manually triggered?
   - **Risk**: Stale context if updates too rare

9. **How do we version the `.vibe/` spec?**
   - What happens when we add new required files?
   - Backward compatibility?
   - **Risk**: Old projects break with new agents

---

## Gaps Analysis

### Gap 1: No Folder Convention Exists

**Current State:** User projects have no Vibe-specific folder
**Required State:** Every project has `.vibe/` folder
**Impact:** Agents have no predictable place to find/store context
**Solution:** Define and implement `.vibe/` specification

### Gap 2: No Context File Formats Defined

**Current State:** No specification for context.yaml, runtime.yaml, etc.
**Required State:** Formal specification with schemas
**Impact:** Can't build parsers/writers without spec
**Solution:** Create formal specification documents

### Gap 3: No Initialization Logic

**Current State:** Project creation doesn't add any folders to repo
**Required State:** Automatic `.vibe/` initialization
**Impact:** New projects start without context infrastructure
**Solution:** Create VibeFolderInitializer service

### Gap 4: Agents Don't Write Context

**Current State:** Agents execute tasks but don't update context
**Required State:** Agents update history.yaml, schema.md after tasks
**Impact:** Context becomes stale, agents lack history
**Solution:** Add post-task context update logic

### Gap 5: No Context Versioning

**Current State:** No way to version context format
**Required State:** Version field in context files, migration support
**Impact:** Can't evolve format without breaking old projects
**Solution:** Add version field, create migration tooling

---

## Other Considerations

### Git Hygiene

- `.vibe/agent-logs/` should be gitignored
- Commits to `.vibe/` should have consistent message format
- Consider squashing agent commits to reduce noise

### Security

- `.vibe/` may contain sensitive info (schema, patterns)
- Should not contain secrets
- Access controlled at repo level

### Portability

- `.vibe/` format should be documented publicly
- Other tools could potentially consume `.vibe/`
- Not vendor-locked to Vibe

### Discovery

- How do agents find the `.vibe/` folder?
- What if repo is mounted at different paths?
- Need consistent repo root detection
