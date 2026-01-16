# Unified File System - Developer Specs

This folder contains developer specifications for implementing the Unified Artifact & File System feature. Each spec is designed to be executed by the Ralph loop automated testing and code-fixing system.

## Overview

The implementation unifies the artifact system (session-scoped, database-stored) with the file system (idea folders) so that artifacts ARE files. It includes:

- **User-scoped folder structure**: `users/[user]/ideas/[slug]/`
- **Idea type classification**: business, feature, service, pivot, integration
- **Relationship graph**: parent/child relationships between ideas
- **Phase-based document management**: required vs recommended docs per lifecycle stage
- **AI-driven context loading**: layered context with token budget allocation
- **Redesigned UI**: table + preview layout with classification badges

## Specs

| Spec                                                                   | Tests                      | Description                                                  |
| ---------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------ |
| [01-folder-structure-idea-types.md](01-folder-structure-idea-types.md) | TEST-FS-001 to TEST-FS-015 | Database migrations, folder utilities, templates, idea types |
| [02-unified-artifact-store.md](02-unified-artifact-store.md)           | TEST-AS-001 to TEST-AS-015 | Filesystem-based artifact storage, cache management          |
| [03-session-context-management.md](03-session-context-management.md)   | TEST-SC-001 to TEST-SC-015 | Session linking, context loading, priority management        |
| [04-phase-transitions-handoffs.md](04-phase-transitions-handoffs.md)   | TEST-PH-001 to TEST-PH-015 | Classification rules, phase management, handoff briefs       |
| [05-ui-components.md](05-ui-components.md)                             | TEST-UI-001 to TEST-UI-015 | State management, artifact panel, idea selector              |

## Total Tests: 75

- 15 tests per spec
- Sequential dependencies within each spec
- Cross-spec dependencies (e.g., TEST-AS-001 depends on TEST-FS-015)

## Running the Ralph Loop

This feature has its own dedicated Ralph loop that runs independently from the main E2E tests.

### Run

```bash
# Start the Unified File System Ralph loop
python3 tests/e2e/unified-fs-ralph-loop.py

# With iteration limit
python3 tests/e2e/unified-fs-ralph-loop.py --max-iterations 10

# With different model
python3 tests/e2e/unified-fs-ralph-loop.py --model claude-sonnet-4-20250514
```

The loop will:

1. Read `docs/specs/unified-file-system/test-state.json` for pending tests
2. Find the next test with met dependencies
3. Load the corresponding spec file
4. Send the test to Claude to implement
5. Update test state on pass/block
6. Auto-continue to the next test

### Concurrent Execution

This Ralph loop is independent and can run concurrently with other Ralph loops:

```bash
# Terminal 1: Run main E2E tests
python3 tests/e2e/ralph_loop.py

# Terminal 2: Run Unified File System implementation
python3 tests/e2e/unified-fs-ralph-loop.py
```

### Check Status

View current progress:

```bash
cat docs/specs/unified-file-system/test-state.json | jq '.summary'
```

### Reset Progress

To start fresh:

```bash
# Reset all tests to pending
jq '.tests |= map(.status = "pending" | .attempts = 0 | .lastResult = null) | .summary.passed = 0 | .summary.blocked = 0 | .summary.pending = 75' \
  docs/specs/unified-file-system/test-state.json > tmp.json && mv tmp.json docs/specs/unified-file-system/test-state.json
```

## Test State Schema

Each test has the following properties:

```json
{
  "id": "TEST-XX-NNN",
  "status": "pending | pass | fail | blocked",
  "attempts": 0,
  "dependsOn": "TEST-XX-NNN | null",
  "spec": "NN-spec-name.md"
}
```

- `pending`: Not yet attempted
- `pass`: Test passed
- `fail`: Test failed (will retry up to 3 times)
- `blocked`: Dependency failed or max attempts reached

## Dependency Graph

```
TEST-FS-001 ──┬── TEST-FS-002 ── TEST-FS-003 ── TEST-FS-004 ── TEST-FS-009 ── ... ── TEST-FS-012
              │
              └── TEST-FS-005 ── TEST-FS-006 ── TEST-FS-007 ── TEST-FS-008
                                                                      │
                                                                      v
TEST-FS-012 ── TEST-FS-013 ── TEST-FS-014 ── TEST-FS-015 ── TEST-AS-001 ── ... ── TEST-AS-015
                                                                                        │
                                                                                        v
TEST-AS-015 ── TEST-SC-001 ── ... ── TEST-SC-015 ── TEST-PH-001 ── ... ── TEST-PH-015
                                                                                   │
                                                                                   v
TEST-PH-015 ── TEST-UI-001 ── ... ── TEST-UI-015
```

## Files Created by Implementation

### New Files

| Path                                                   | Purpose                           |
| ------------------------------------------------------ | --------------------------------- |
| `utils/folder-structure.ts`                            | User/idea folder utilities        |
| `agents/ideation/unified-artifact-store.ts`            | Filesystem-based artifact storage |
| `agents/ideation/idea-context-builder.ts`              | Layered context builder           |
| `agents/ideation/priority-manager.ts`                  | Document priority management      |
| `agents/ideation/classification-rules.ts`              | Phase-document rules              |
| `agents/ideation/document-classifier.ts`               | Document classification engine    |
| `agents/ideation/phase-manager.ts`                     | Phase transition management       |
| `agents/ideation/handoff-generator.ts`                 | Handoff brief generation          |
| `scripts/migrate-artifacts-to-files.ts`                | Migration script                  |
| `templates/unified/*`                                  | All guided templates              |
| `frontend/src/selectors/ideationSelectors.ts`          | State selectors                   |
| `frontend/src/components/ideation/ArtifactTable.tsx`   | Table component                   |
| `frontend/src/components/ideation/ArtifactPreview.tsx` | Preview component                 |
| `frontend/src/components/ideation/SessionsView.tsx`    | Sessions view                     |
| `frontend/src/components/ideation/IdeaSelector.tsx`    | Idea dropdown                     |
| `frontend/src/components/ideation/IdeaTypeModal.tsx`   | New idea flow                     |

### Modified Files

| Path                                                     | Changes                         |
| -------------------------------------------------------- | ------------------------------- |
| `database/migrations/*`                                  | New tables and columns          |
| `agents/ideation/artifact-store.ts`                      | Deprecated, wraps new store     |
| `agents/ideation/system-prompt.ts`                       | Add IDEA_CONTEXT placeholder    |
| `agents/ideation/orchestrator.ts`                        | Idea type flow, context loading |
| `server/routes/ideation.ts`                              | New endpoints                   |
| `frontend/src/reducers/ideationReducer.ts`               | New state fields                |
| `frontend/src/components/ideation/IdeaArtifactPanel.tsx` | Redesigned layout               |
| `frontend/src/components/ideation/SessionHeader.tsx`     | Idea selector                   |

## Implementation Order

1. **Spec 01**: Folder Structure & Idea Types (database + filesystem foundation)
2. **Spec 02**: Unified Artifact Store (artifact CRUD operations)
3. **Spec 03**: Session & Context Management (linking + context loading)
4. **Spec 04**: Phase Transitions & Handoffs (classification + handoffs)
5. **Spec 05**: UI Components (frontend redesign)

Each spec builds on the previous one. Tests are designed to be atomic and independently verifiable.

## Pass/Fail Criteria

Each test has explicit pass criteria (checkboxes) and fail criteria. The Ralph loop will:

1. Read the test spec
2. Implement the required code
3. Run verification commands/code
4. Check all pass criteria
5. Mark test as pass/fail
6. If fail, attempt fix (up to 3 times)
7. If blocked after 3 attempts, mark as blocked and continue to next independent test

## Reference Documents

- [Implementation Plan](../../unified-artifact-file-system-implementation.md) - Full implementation plan with architecture details
- [Features Overview](../../feature-wish-list/features-overview.md) - Original feature requirements
