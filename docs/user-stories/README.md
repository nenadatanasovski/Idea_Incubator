# User Stories: Agent Context and Project Structure

This folder contains user stories addressing the fundamental architectural challenge of providing agents with project context and establishing clear separation between the Vibe Platform, Ideas, and Projects.

## Background

The core problem was identified as:

> "Currently the agents don't have context of the projects that contain the app functionality and descriptions so they lack knowing what's been done or how to run the app when needed."

This led to a structural analysis revealing that:

1. **Agents lack project context** - When a Build Agent starts a task, it doesn't know what code exists, how to run the app, or what the database schema looks like.

2. **No standard project structure** - There's no defined `.vibe/` folder convention for agent context in user projects.

3. **Platform schema not injected** - Agents working on Vibe itself don't automatically receive the platform's database schema.

4. **Vibe conflates three identities** - Vibe is simultaneously the Platform, an Idea, and a Project, creating confusion and circular dependencies.

5. **Project lifecycle unclear** - The transition from Idea to Project to Repo is not well-defined.

---

## User Stories Overview

| ID                                                     | Title                            | Problem Area                                           |
| ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------ |
| [US-001](./US-001-agent-project-context.md)            | Agent Project Context            | Agents need project context to execute tasks correctly |
| [US-002](./US-002-vibe-environment-structure.md)       | Vibe Environment Structure       | Standard `.vibe/` folder convention for all projects   |
| [US-003](./US-003-platform-schema-context.md)          | Platform Schema Context          | Platform schema injection for agents working on Vibe   |
| [US-004](./US-004-platform-idea-project-separation.md) | Platform/Idea/Project Separation | Untangling Vibe's three identities                     |
| [US-005](./US-005-project-lifecycle.md)                | Project Lifecycle                | Idea to Project to Repo transition and management      |

---

## Key Concepts

### Vibe Environment

The "Vibe Environment" is Vibe's managed GitHub space where user projects live:

- All project repos are owned by Vibe (copied/forked from user's original)
- Users link repos, Vibe creates a copy and works on that copy
- Original user repo is never modified
- Users can export projects when done

### `.vibe/` Folder Convention

Every project in the Vibe Environment has a `.vibe/` folder:

```
.vibe/
├── context.yaml     # Project identity and metadata
├── runtime.yaml     # How to run, test, build
├── schema.md        # Database schema
├── history.yaml     # Completed features
└── conventions.md   # Code patterns
```

### Platform vs User Projects

| Aspect             | Vibe Platform      | User Project      |
| ------------------ | ------------------ | ----------------- |
| Location           | This repo          | Vibe Environment  |
| Schema source      | RelationshipMapper | `.vibe/schema.md` |
| Protected paths    | Yes                | No (by default)   |
| `is_platform` flag | true               | false             |

---

## Cross-Cutting Concerns

These questions and gaps appear across multiple user stories:

### Questions That Need Answers

1. **Source of truth**: Should `.vibe/` folder or database be canonical?
2. **Token economics**: Full schema context may cost 5000+ tokens per task
3. **GitHub integration**: Organization account, rate limits, private repos
4. **Stage transitions**: Who triggers them, can they go backward?
5. **Protected paths**: Who approves modifications, what happens if blocked?

### Gaps in Current System

| Gap                           | Impact                           | Stories        |
| ----------------------------- | -------------------------------- | -------------- |
| No `github_url` on projects   | Agents can't find repos          | US-001, US-005 |
| No `.vibe/` folder convention | No standard context location     | US-002         |
| No schema injection at spawn  | Agents lack data model knowledge | US-001, US-003 |
| No `is_platform` flag         | Can't identify platform tasks    | US-003, US-004 |
| No `stage` field on projects  | Can't track lifecycle            | US-005         |
| No GitHub API integration     | Can't create/clone repos         | US-005         |

---

## Suggested Implementation Order

Based on dependencies between stories:

### Phase 1: Schema Foundation

1. Add new fields to `projects` table (from US-001, US-004, US-005)
2. Add `is_platform` flag and create Vibe Platform project (from US-004)

### Phase 2: Context Infrastructure

3. Define `.vibe/` folder specification (from US-002)
4. Create ProjectAnalyzer service (from US-001)
5. Create VibeFolderInitializer service (from US-002)

### Phase 3: Agent Context Injection

6. Create ProjectContextLoader service (from US-001)
7. Create SchemaFormatter for agents (from US-003)
8. Modify Build Agent Orchestrator to inject context (from US-001, US-003)

### Phase 4: Lifecycle and Repos

9. Create repo-manager service (from US-005)
10. Implement GitHub integration (from US-005)
11. Add project lifecycle stages (from US-005)
12. Build UI for project creation flow (from US-005)

### Phase 5: Safety and Polish

13. Implement protected path checking (from US-004)
14. Add context update logic after task completion (from US-002)
15. Documentation and testing

---

## How to Use These Documents

Each user story contains:

1. **Problem Statement** - What's broken and why it matters
2. **User Stories** - As a [role], I want [goal], so that [benefit]
3. **End-to-End Flows** - Step-by-step scenarios
4. **Current System State** - What exists today
5. **Suggested Solution** - Phased implementation approach
6. **Critical Questions** - Things that need decisions
7. **Gaps Analysis** - Specific gaps to close
8. **Other Considerations** - Security, performance, edge cases

Use the **Critical Questions** sections to drive decision-making before implementation. Use the **Gaps Analysis** sections to create implementation tickets.

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Platform conventions and agent instructions
- [Projects API](../api/) - API documentation
- [Task Agent Architecture](../architecture/task-agent-arch.md) - Agent system design
- [Build Agent Orchestrator](../../server/services/task-agent/build-agent-orchestrator.ts) - Current implementation
