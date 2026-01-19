# US-004: Separating Vibe as Platform, Idea, and Project

## Problem Statement

Vibe currently conflates three distinct identities:

1. **Vibe the Platform** - The orchestration system that manages ideas, projects, tasks, and agents (this codebase)
2. **Vibe the Idea** - "Idea Incubator" as a concept living in `ideas/` folder
3. **Vibe the Project** - Vibe being built using its own agents (bootstrapping)

This creates:

- Circular dependencies (agents modifying their own runtime)
- Confusion about what "project context" means
- No clear boundary between platform infrastructure and user project infrastructure
- Difficulty reasoning about which code is "platform" vs "application"

---

## User Stories

### US-004.1: As a developer, I need to know if I'm modifying platform or application code

**As a** developer working on Vibe
**I want to** clearly understand whether my changes affect the platform or the application being built
**So that** I can assess risk and apply appropriate review/testing

**Acceptance Criteria:**

- Clear directory structure separating platform from application
- Documentation explaining the boundary
- CI/CD knows which changes need extra scrutiny
- Agents can identify platform-critical files

---

### US-004.2: As an agent, I need safety rails when modifying platform code

**As a** Build Agent executing a task on Vibe Platform
**I want to** have guardrails preventing accidental platform breakage
**So that** I don't break the system that's running me

**Acceptance Criteria:**

- Certain paths require human approval before modification
- Schema changes require explicit approval
- Agent orchestration code is protected
- Clear escalation path when guardrail is hit

---

### US-004.3: As a user, I want to use Vibe to build Vibe safely

**As a** user using Vibe to improve Vibe itself
**I want to** be able to work on Vibe like any other project
**So that** I can benefit from Vibe's capabilities while building it

**Acceptance Criteria:**

- Vibe Platform appears as a project in the UI
- Tasks can be created against Vibe Platform
- Same task execution flow as other projects
- But with additional safety checks

---

### US-004.4: As the system, I need to treat Vibe as a special project

**As the** Vibe Platform
**I want to** recognize when tasks target myself
**So that** I can apply appropriate safeguards

**Acceptance Criteria:**

- Vibe Platform project has `is_platform: true` flag
- Protected paths are defined and enforced
- High-impact changes go to question queue
- Rollback capability for platform changes

---

## End-to-End Flows

### Flow 1: User Creates Task for Vibe Platform

```
1. User navigates to Vibe Platform project
2. User creates task "Add new API endpoint for X"
3. Task is created with project_id pointing to Vibe Platform project
4. Task goes through normal evaluation queue
5. When task assigned to Build Agent:
   a. Orchestrator detects is_platform = true
   b. Orchestrator loads protected_paths from project config
   c. Orchestrator compares task file_impacts with protected_paths
6. If touching protected paths:
   a. Task is paused
   b. Blocking question created: "This task modifies protected platform code. Approve?"
   c. User reviews and approves/rejects
7. If approved (or not touching protected paths):
   a. Agent executes task with full platform context
   b. Platform schema injected into agent
   c. CLAUDE.md context included
8. On completion, changes are validated more strictly
```

### Flow 2: Agent Accidentally Tries to Modify Critical Path

```
1. Task "Refactor error handling" assigned to Build Agent
2. Agent analyzes task, determines it needs to modify:
   - server/services/task-agent/build-agent-orchestrator.ts (protected)
3. Before writing, agent checks protected paths
4. Path is protected, agent:
   a. Does not modify file
   b. Creates blocking question: "Need to modify protected path. Approve?"
   c. Pauses and waits
5. Human reviews:
   - Sees which file agent wants to modify
   - Sees what changes agent proposes
   - Approves or provides alternative
6. If approved, agent proceeds
7. If rejected, agent tries alternative approach
```

### Flow 3: Distinguishing Ideas vs Projects

```
1. ideas/vibe/ folder contains:
   - README.md (the original idea)
   - development.md (Q&A from ideation)
   - evaluation.md (scoring against criteria)
2. This is the IDEA - the concept, evaluation, thinking
3. The PROJECT is this entire repo (idea_incurator/)
4. When user views idea: sees ideation artifacts
5. When user views project: sees code, tasks, execution
6. The idea informs the project, but they are separate
7. Idea can be "complete" while project is still active
```

---

## Current System State

### What Exists Today

| Entity             | Location                                 | Identity                  |
| ------------------ | ---------------------------------------- | ------------------------- |
| Vibe Platform Code | `server/`, `frontend/`, `schema/`        | The platform itself       |
| Vibe Idea          | `ideas/vibe/` or `ideas/idea-incubator/` | Ideation artifacts        |
| Vibe Project       | No explicit record                       | Should be a project entry |

### The Confusion

| Question                                            | Current Answer                     | Desired Answer                                 |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| "Is Vibe a project?"                                | Unclear - no project record exists | Yes, with `is_platform: true`                  |
| "Where is Vibe's code?"                             | This repo                          | This repo, but marked as platform              |
| "Can agents modify Vibe?"                           | Yes, no restrictions               | Yes, with protected paths                      |
| "What's the relationship between idea and project?" | Vague - ideaId on projects         | Idea feeds project, but project is independent |

### Protected Paths (Proposed)

| Path Pattern                   | Reason                               |
| ------------------------------ | ------------------------------------ |
| `schema/entities/*`            | Data model changes affect everything |
| `database/migrations/*`        | Migrations are irreversible          |
| `server/services/task-agent/*` | Agent orchestration is critical      |
| `server/websocket.ts`          | Real-time infrastructure             |
| `CLAUDE.md`                    | Agent instructions                   |
| `.env*`                        | Environment configuration            |

---

## Suggested Solution

### Phase 1: Create Vibe Platform Project Record

Create explicit project for Vibe:

- id: 'vibe-platform' (or generated UUID)
- slug: 'vibe-platform'
- code: 'VIBE'
- name: 'Vibe Platform'
- is_platform: true (new field)
- root_path: '.' (current directory)
- protected_paths: JSON array of patterns

### Phase 2: Add `is_platform` Flag to Projects

Modify `schema/entities/project.ts`:

- Add `is_platform: boolean` field
- Add `protected_paths: text` (JSON) field
- Default `is_platform: false` for user projects

### Phase 3: Implement Protected Path Checking

Create `server/services/protected-path-checker.ts`:

- `isProtectedPath(projectId, filePath)` - Check if path is protected
- `getProtectedPaths(projectId)` - Get all protected paths for project
- `validateTaskImpacts(task)` - Check all file impacts against protected paths

### Phase 4: Integrate with Task Execution

Modify Build Agent Orchestrator:

- Before spawning agent, check file impacts
- If any protected path, create blocking question
- Wait for approval before proceeding
- Log all protected path modifications

### Phase 5: Documentation and Boundaries

Document the separation:

- What is "platform" code
- What is "application" code (for user projects)
- How ideas relate to projects
- Safety rails and approval process

---

## Critical Questions

### Philosophical Questions

1. **Is Vibe truly building itself, or is a human building Vibe with Vibe's assistance?**
   - If agents are fully autonomous: high risk, need strong guardrails
   - If human reviews all changes: lower risk, lighter guardrails
   - **Impacts**: How strict should protected paths be?

2. **Should Vibe Platform be editable by agents at all?**
   - Option A: Platform is frozen, only humans modify
   - Option B: Platform editable with heavy approval
   - Option C: Platform editable like any project (risky)
   - **Trade-off**: Dogfooding vs stability

3. **When does an idea "become" a project?**
   - At evaluation completion?
   - When user explicitly creates project?
   - When first task is created?
   - **Impacts**: Lifecycle management, UI flow

### Technical Questions

4. **How do we seed the Vibe Platform project?**
   - Hardcoded in migration?
   - Created on first boot?
   - Created manually?
   - **Risk**: Multiple Vibe Platform projects if not careful

5. **How do we handle nested platform code?**
   - `server/` is platform, but new routes added by tasks
   - At what point does agent-added code become "platform"?
   - **Risk**: Protected paths too broad or too narrow

6. **What happens if approval is never given?**
   - Task stuck in limbo?
   - Auto-reject after timeout?
   - Escalate to higher authority?
   - **Risk**: Blocked tasks never complete

### Process Questions

7. **Who approves platform modifications?**
   - Any user?
   - Project owner only?
   - Required roles?
   - **Risk**: Wrong person approves dangerous change

8. **How do we track platform modifications?**
   - Git history?
   - Separate audit log?
   - **Risk**: Changes lost in noise

9. **Should platform have its own deployment pipeline?**
   - Separate from user project deployments?
   - Extra testing/staging?
   - **Risk**: Deployment breaks platform

---

## Gaps Analysis

### Gap 1: No Vibe Platform Project Record

**Current State:** Vibe Platform is not in projects table
**Required State:** Explicit project record with `is_platform: true`
**Impact:** Can't treat Vibe consistently as a project
**Solution:** Create and seed Vibe Platform project

### Gap 2: No `is_platform` Flag

**Current State:** All projects treated equally
**Required State:** Platform projects identified for special handling
**Impact:** Can't apply platform-specific guardrails
**Solution:** Add field to projects schema

### Gap 3: No Protected Paths

**Current State:** Agents can modify any file
**Required State:** Critical paths require approval
**Impact:** Agents could break platform accidentally
**Solution:** Define protected paths, enforce in orchestrator

### Gap 4: Idea/Project Relationship Unclear

**Current State:** `ideaId` on projects, but relationship vague
**Required State:** Clear separation - idea is concept, project is execution
**Impact:** Confusion about what belongs where
**Solution:** Document relationship, possibly restructure

### Gap 5: No Platform Modification Audit Trail

**Current State:** Git history only
**Required State:** Explicit logging of who approved what
**Impact:** Can't trace platform changes to approvers
**Solution:** Add audit table for platform modifications

---

## Other Considerations

### Bootstrapping Paradox

- Vibe uses agents to build itself
- Those agents are running ON Vibe
- If agent breaks Vibe, agents stop working
- Need rollback capability at platform level

### Multiple Environments

- Development Vibe vs Production Vibe
- Platform changes tested in dev first?
- How do agents know which environment?

### Team Access

- Multiple developers working on Vibe
- Who can approve platform changes?
- Role-based access control needed?

### Migration Path

- Existing tasks don't know about is_platform
- Need to retroactively tag or migrate
- Backward compatibility

### User Projects Similarity

- Some user projects might want similar protection
- Could `protected_paths` be a general feature?
- Platform is just the most protected project
