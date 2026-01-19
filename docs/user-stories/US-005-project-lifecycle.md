# US-005: Project Lifecycle and Repo Management

## Problem Statement

The lifecycle from Idea to Project to Repo is not well-defined:

- When does an idea become a project?
- What triggers repo creation in the Vibe Environment?
- How does the project get its initial structure?
- What happens when a user links an existing repo?

Additionally, the Vibe Environment (Vibe's managed GitHub space) needs clear rules:

- Vibe copies/forks user repos into its own space
- Vibe creates new repos for fresh projects
- User's original repo is unlinked (Vibe owns the copy)

Without clear lifecycle management, the system can't reliably transition ideas into executable projects.

---

## User Stories

### US-005.1: As a user, I want to transition my idea into a project

**As a** user with a successfully evaluated idea
**I want to** create a project from that idea
**So that** I can start building it with Vibe's agents

**Acceptance Criteria:**

- Button to "Create Project" appears when idea reaches threshold
- Project inherits name and context from idea
- Project is created in Vibe Environment (Vibe's GitHub space)
- User can see clear connection between idea and project

---

### US-005.2: As a user, I want to link my existing repo to a project

**As a** user with an existing GitHub repo
**I want to** link it to a Vibe project
**So that** Vibe's agents can work on my existing code

**Acceptance Criteria:**

- User provides GitHub URL
- Vibe clones/forks repo into Vibe's GitHub space
- Original repo is NOT modified
- User is informed their original is unlinked
- Vibe's copy becomes the working repo

---

### US-005.3: As a user, I want to start fresh without a repo

**As a** user with a new idea and no existing code
**I want** Vibe to create a repo for me
**So that** I can start from scratch

**Acceptance Criteria:**

- Project creation offers "Start Fresh" option
- Vibe creates new empty repo in Vibe's GitHub space
- Repo is initialized with template structure
- `.vibe/` folder is created automatically

---

### US-005.4: As a user, I want to track my project's progress through stages

**As a** user
**I want to** see where my project is in its lifecycle
**So that** I know what's been done and what's next

**Acceptance Criteria:**

- Project shows current stage (e.g., "Specification", "Building", "Testing")
- User can see history of stage transitions
- Each stage has clear entry/exit criteria
- Progress is visible in UI

---

### US-005.5: As the system, I need to manage repos in Vibe Environment

**As the** Vibe Platform
**I want to** manage all project repos in my own GitHub space
**So that** I have full control for agent access and operations

**Acceptance Criteria:**

- All project repos live in Vibe's GitHub org/account
- Agents have write access to these repos
- User repos are copied, not linked
- Original user repo remains untouched

---

## End-to-End Flows

### Flow 1: Create Project from Evaluated Idea

```
1. User completes ideation for "My SaaS App"
2. Idea is evaluated, scores 7.5/10 (above threshold)
3. UI shows "Ready to Build" status on idea
4. User clicks "Create Project"
5. System prompts:
   - Option A: "Start Fresh" (new empty repo)
   - Option B: "Link Existing Repo" (clone user's repo)
6. User chooses "Start Fresh"
7. Vibe creates:
   a. New repo in Vibe's GitHub space: github.com/vibe-projects/my-saas-app
   b. Project record in database with:
      - name: "My SaaS App"
      - ideaId: <idea's id>
      - githubUrl: github.com/vibe-projects/my-saas-app
      - stage: "initialized"
8. Vibe initializes repo:
   a. README.md from idea description
   b. .vibe/ folder with templates
9. User redirected to project page
10. Project ready for specification
```

### Flow 2: Link Existing Repo to Project

```
1. User has existing repo: github.com/user/my-app
2. User creates idea for "My App v2"
3. Idea evaluated, ready to build
4. User clicks "Create Project"
5. User chooses "Link Existing Repo"
6. User pastes: github.com/user/my-app
7. System shows warning:
   "Vibe will create a copy in its own space.
    Your original repo will not be modified.
    The Vibe copy becomes the working project."
8. User confirms
9. Vibe:
   a. Forks/clones github.com/user/my-app
   b. Creates: github.com/vibe-projects/my-app-copy
   c. Runs ProjectAnalyzer on cloned repo
   d. Creates .vibe/ folder with detected context
   e. Creates project record
10. User sees project with analyzed context
11. User can review/edit detected settings
12. Project ready for specification
```

### Flow 3: Project Stage Progression

```
Stage: INITIALIZED
  - Project and repo created
  - Exit: Spec Agent starts

Stage: SPECIFICATION
  - Spec Agent analyzing requirements
  - spec.md being generated
  - Exit: User approves spec

Stage: TASK_PLANNING
  - Tasks being generated from spec
  - Dependencies being calculated
  - Exit: Tasks ready for execution

Stage: BUILDING
  - Build Agents executing tasks
  - Code being generated
  - Exit: All tasks complete

Stage: TESTING
  - Validation Agent running tests
  - E2E tests executing
  - Exit: All tests pass

Stage: COMPLETE
  - Project fully built
  - Ready for deployment
  - User takes ownership
```

### Flow 4: Project Export (Leaving Vibe)

```
1. User decides to take project out of Vibe
2. User clicks "Export Project"
3. System offers options:
   a. Transfer repo to user's GitHub account
   b. Download as zip
   c. Push to user's existing repo
4. User chooses transfer
5. Vibe:
   a. Initiates GitHub repo transfer
   b. Updates project record: exported = true
   c. Retains history in database
6. User now owns repo outside Vibe
7. Vibe no longer has write access
```

---

## Project Stages

| Stage           | Description                  | Entry Criteria         | Exit Criteria            |
| --------------- | ---------------------------- | ---------------------- | ------------------------ |
| `initialized`   | Project created, repo exists | Project record created | Spec Agent assigned      |
| `specification` | Spec being generated         | Spec Agent starts      | User approves spec       |
| `task_planning` | Tasks being generated        | Spec approved          | All tasks created        |
| `ready`         | Ready for execution          | Tasks created          | Execution starts         |
| `building`      | Agents executing tasks       | Execution started      | All tasks complete       |
| `testing`       | Validation in progress       | Build complete         | Tests pass               |
| `complete`      | Project finished             | Tests pass             | User exports or archives |
| `paused`        | Temporarily stopped          | User pauses            | User resumes             |
| `archived`      | No longer active             | User archives          | N/A                      |

---

## Current System State

### What Exists Today

| Component            | Status                        |
| -------------------- | ----------------------------- |
| Ideas in database    | **Exists**                    |
| Projects table       | **Exists** but minimal        |
| Idea-to-Project link | **Exists** via `ideaId` field |
| GitHub integration   | **Does not exist**            |
| Repo creation        | **Does not exist**            |
| Repo cloning         | **Does not exist**            |
| Project stages       | **Does not exist**            |
| Stage transitions    | **Does not exist**            |

### Fields Missing from Projects

| Field               | Purpose                         |
| ------------------- | ------------------------------- |
| `github_url`        | The repo URL in Vibe's space    |
| `source_github_url` | Original user repo (if linked)  |
| `stage`             | Current lifecycle stage         |
| `stage_history`     | JSON array of stage transitions |
| `exported_at`       | When project was exported       |

---

## Suggested Solution

### Phase 1: Add Lifecycle Fields to Projects

Add to `schema/entities/project.ts`:

- `github_url` - Vibe's copy of the repo
- `source_github_url` - Original repo if linked
- `stage` - Current lifecycle stage (enum)
- `stage_changed_at` - When stage last changed

### Phase 2: Create Repo Management Service

New service at `server/services/repo-manager.ts`:

- `createRepo(projectSlug)` - Create new empty repo
- `cloneRepo(sourceUrl, projectSlug)` - Clone existing repo
- `initializeVibeFolder(repoPath)` - Add .vibe/ structure
- `transferRepo(projectId, targetUser)` - Transfer ownership

### Phase 3: GitHub Integration

Implement GitHub API integration:

- Authenticate as Vibe app/org
- Create repos in Vibe's space
- Clone/fork user repos
- Manage repo access

### Phase 4: Stage Transition Logic

Create `server/services/project-lifecycle.ts`:

- `transitionTo(projectId, stage)` - Change stage
- `validateTransition(from, to)` - Check if transition allowed
- `getStageHistory(projectId)` - Get all transitions
- `canTransition(projectId, targetStage)` - Check requirements

### Phase 5: UI for Project Creation

Add UI components:

- "Create Project" button on idea page
- Repo source selection modal
- GitHub URL input for linking
- Warning about Vibe's copy
- Stage progress indicator

---

## Critical Questions

### GitHub Integration Questions

1. **Who owns the Vibe GitHub space?**
   - Personal account?
   - Organization account?
   - **Risk**: Account limits, permissions, billing

2. **How do we handle GitHub API rate limits?**
   - Authenticated requests: 5000/hour
   - Multiple projects being cloned simultaneously
   - **Risk**: Rate limit exhaustion

3. **What if user's repo is private?**
   - Vibe needs access to clone
   - OAuth flow? Deploy keys?
   - **Risk**: Permission complexity

4. **How do we handle large repos?**
   - Git LFS?
   - Repo size limits?
   - **Risk**: Storage costs, clone time

### Lifecycle Questions

5. **Can projects move backward in stages?**
   - "Building" back to "Specification"?
   - If spec changes, restart from spec?
   - **Risk**: Lost work, state confusion

6. **What happens to tasks when stage changes?**
   - Stage goes to "paused" - tasks stop?
   - Stage goes to "specification" - tasks deleted?
   - **Risk**: Orphaned tasks, data loss

7. **Who can trigger stage transitions?**
   - Automatic based on criteria?
   - Manual user action?
   - Agent-triggered?
   - **Risk**: Wrong transitions at wrong time

### Ownership Questions

8. **What happens to Vibe's copy after export?**
   - Delete it?
   - Keep as archive?
   - Transfer to user's account?
   - **Risk**: Storage waste, data lingering

9. **Can user sync changes from original repo?**
   - Pull from user's original?
   - Merge conflicts?
   - **Risk**: Sync complexity

10. **What if user wants to push Vibe changes back?**
    - PR to original?
    - Direct push?
    - **Risk**: Breaking user's repo

---

## Gaps Analysis

### Gap 1: No GitHub Integration

**Current State:** No ability to create/clone repos
**Required State:** Full GitHub API integration
**Impact:** Can't create repos in Vibe Environment
**Solution:** Implement repo-manager service with GitHub API

### Gap 2: No Lifecycle Stages

**Current State:** Projects have `status` (active/paused/completed)
**Required State:** Projects have `stage` for lifecycle tracking
**Impact:** Can't track where project is in development
**Solution:** Add stage field and transition logic

### Gap 3: No Repo URLs on Projects

**Current State:** Projects don't know where their code lives
**Required State:** `github_url` field on projects
**Impact:** Agents can't find project repos
**Solution:** Add field, populate on project creation

### Gap 4: No Project Creation Flow

**Current State:** Projects created manually via API
**Required State:** Guided flow from idea to project
**Impact:** Users can't easily create projects from ideas
**Solution:** Build UI flow with options

### Gap 5: No Export Capability

**Current State:** Projects stuck in Vibe
**Required State:** User can take project and leave
**Impact:** Vendor lock-in perception
**Solution:** Implement export/transfer flow

---

## Other Considerations

### Vibe's GitHub Space

- Needs organization account for unlimited private repos
- Billing for storage and actions
- Access management for agents

### Concurrency

- Multiple projects being created simultaneously
- GitHub API rate limits
- Queue for repo operations?

### Rollback

- What if repo creation fails?
- Partial state cleanup
- Transaction-like behavior

### Monitoring

- Track repo sizes
- Track storage costs
- Alert on large repos

### Security

- Don't expose Vibe's GitHub token
- Validate URLs before cloning
- Scan for malicious content?

### User Communication

- Clear messaging about repo ownership
- User understands Vibe's copy is separate
- Expectation setting about sync
