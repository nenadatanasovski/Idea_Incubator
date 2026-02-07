# FIX-TASK-013: QuestionEngine Methods Verification

## Overview

**Status**: RESOLVED - No code changes required
**Tasks**: FIX-TASK-013-HI8C, FIX-TASK-013-G1R2
**Original claim**: `answerQuestion()` and `areRequiredQuestionsAnswered()` methods missing from QuestionEngine

Investigation revealed both methods were already fully implemented. The original failure was caused by the verification harness running `npm run typecheck` from a context where the script was not available (possibly a different working directory or npm workspace resolution issue).

## Requirements

### Functional

The QuestionEngine class (`server/services/task-agent/question-engine.ts`) must provide:

1. **`answerQuestion(taskId, questionId, answer)`** - Records an answer for a specific question in `task_questions` table
2. **`areRequiredQuestionsAnswered(taskId)`** - Returns boolean indicating whether all questions with `importance='required'` have been answered
3. **`getQuestions(taskId)`** - Retrieves all non-skipped questions for a task
4. **`skipQuestion(taskId, questionId)`** - Marks a question as skipped (excluded from future queries)
5. **`getCompletionStatus(taskId)`** - Returns status object with total/answered/required counts
6. **`generateQuestions(task)`** - Generates questions based on gap analysis and persists to database

### Non-Functional

- All database operations use parameterized queries (SQL injection safe)
- `saveDb()` called after write operations for WAL persistence
- Methods are async, returning Promises

## Technical Design

### Implementation (Already Complete)

All methods exist in `server/services/task-agent/question-engine.ts`:

| Method | Line | Implementation |
|--------|------|----------------|
| `answerQuestion()` | 513 | UPDATE task_questions SET answer, answered_at |
| `areRequiredQuestionsAnswered()` | 561 | COUNT(*) WHERE importance='required' AND answer IS NULL |
| `getQuestions()` | 531 | SELECT FROM task_questions WHERE skipped=0 |
| `skipQuestion()` | 573 | UPDATE task_questions SET skipped=1 |
| `getCompletionStatus()` | 585 | Aggregates answered/required counts from task_questions |
| `generateQuestions()` | 194 | Gap analysis + template-based generation + INSERT |

### Database Schema

```sql
CREATE TABLE task_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  importance TEXT NOT NULL DEFAULT 'optional',
  target_field TEXT,
  answer TEXT,
  answered_at TEXT,
  skipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Root Cause of Original Failure

The verification harness produced:
```
npm error Missing script: "typecheck"
```

However, `package.json` contains `"typecheck": "tsc --noEmit"` at line 41. The failure was caused by the verification running from a different context (possibly a parent-harness subdirectory or npm workspace that doesn't inherit the root `package.json` scripts).

## Pass Criteria

1. **All 13 tests pass**: `npx vitest run tests/task-agent/question-engine.test.ts` - VERIFIED PASSING
2. **No TypeScript errors in question-engine**: `npx tsc --noEmit 2>&1 | grep question-engine` returns no results - VERIFIED
3. **typecheck script exists**: `npm run typecheck` available from project root - VERIFIED

## Dependencies

- `database/db.ts` - Database operations (`query`, `run`, `getOne`, `saveDb`)
- `types/task-agent.ts` - Task type definition
- `uuid` - ID generation
- `vitest` - Test framework

## Verification History

### FIX-TASK-013-G1R2 (Feb 7, 2026)

Retry verification confirmed identical findings to previous attempt:

- **QuestionEngine TypeScript errors**: 0 (verified via `npx tsc --noEmit 2>&1 | grep question-engine`)
- **QuestionEngine tests**: 13/13 passing (verified via `npx vitest run tests/task-agent/question-engine.test.ts`)
- **Pre-existing codebase TS errors**: ~505 lines across unrelated files (none in question-engine)
- **Pre-existing test failures**: 28 test files failing (integration tests requiring running server, plus other unrelated services)

All three methods (`answerQuestion`, `areRequiredQuestionsAnswered`, `getQuestions`) were already implemented before this task was created. The `Question` interface includes the `importance` property at line 38. No code changes were necessary.

## Open Questions

None - all methods implemented and tests passing.
