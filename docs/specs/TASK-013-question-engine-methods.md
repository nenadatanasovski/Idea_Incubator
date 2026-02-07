# TASK-013: Implement Missing QuestionEngine Methods

## Overview

The QuestionEngine class (`server/services/task-agent/question-engine.ts`) provides question generation, answering, and tracking for task clarification workflows. This spec documents the `answerQuestion()` and `areRequiredQuestionsAnswered()` methods that were referenced in tests but initially missing from the implementation.

## Requirements

### Functional

1. **`answerQuestion(taskId, questionId, answer)`** - Records a user's answer to a previously generated question by updating the `task_questions` table row with the answer text and timestamp.

2. **`areRequiredQuestionsAnswered(taskId)`** - Checks whether all questions with `importance = 'required'` for a given task have been answered (non-NULL answer and not skipped). Returns `true` when no unanswered required questions remain.

### Non-Functional

- Both methods use the existing `task_questions` table (migration 133).
- Both methods call `saveDb()` or return immediately without side effects beyond the query.
- Both methods are async and follow the existing pattern of other QuestionEngine methods.

## Technical Design

### `answerQuestion()`

```typescript
async answerQuestion(taskId: string, questionId: string, answer: string): Promise<void>
```

- Updates `task_questions` SET `answer`, `answered_at`, `updated_at` WHERE `id = questionId AND task_id = taskId`.
- Calls `saveDb()` after the update.

### `areRequiredQuestionsAnswered()`

```typescript
async areRequiredQuestionsAnswered(taskId: string): Promise<boolean>
```

- Queries `COUNT(*)` from `task_questions` WHERE `task_id = taskId AND importance = 'required' AND answer IS NULL AND skipped = 0`.
- Returns `true` if count is 0, `false` otherwise.

### Supporting Infrastructure

- **Database table**: `task_questions` (migration `database/migrations/133_task_questions.sql`)
- **Columns used**: `id`, `task_id`, `importance`, `answer`, `answered_at`, `skipped`, `updated_at`

## Pass Criteria

1. `QuestionEngine` class has `answerQuestion()` method with signature `(taskId: string, questionId: string, answer: string) => Promise<void>` — **VERIFIED** (line 513)
2. `QuestionEngine` class has `areRequiredQuestionsAnswered()` method with signature `(taskId: string) => Promise<boolean>` — **VERIFIED** (line 561)
3. `tests/task-agent/question-engine.test.ts` compiles without TypeScript errors — **VERIFIED** (0 TS errors in question-engine files)
4. All 13 tests in `tests/task-agent/question-engine.test.ts` pass — **VERIFIED** (13/13 pass)
5. `npm run typecheck` script exists in `package.json` — **VERIFIED** (line 41: `"typecheck": "tsc --noEmit"`)

## Verification Results (2026-02-07)

```
$ npx vitest run tests/task-agent/question-engine.test.ts
 ✓ tests/task-agent/question-engine.test.ts  (13 tests) 122ms
 Test Files  1 passed (1)
      Tests  13 passed (13)

$ npm run typecheck 2>&1 | grep question-engine
(no errors found for question-engine files)
```

### Note on QA Failure Root Cause

The original QA failure reported `Missing script: "typecheck"` — this was likely caused by the verification being run from the wrong directory (e.g., `parent-harness/` instead of the project root). The `typecheck` script has been present in the root `package.json` since before this task.

## Dependencies

- `database/db.ts` — `run()`, `query()`, `saveDb()` functions
- `database/migrations/133_task_questions.sql` — table schema
- `types/task-agent.ts` — `Task` type

## Open Questions

None — both methods are straightforward CRUD operations against an existing table. Implementation was already complete when this fix task was created.
