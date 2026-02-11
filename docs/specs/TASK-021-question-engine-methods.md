# TASK-021: QuestionEngine Missing Methods - Technical Specification

## Status: ALREADY COMPLETE ✅

**Date**: 2026-02-08
**Author**: Spec Agent
**Component**: QuestionEngine Service
**Location**: `server/services/task-agent/question-engine.ts`

---

## Overview

This specification documents the **already implemented** methods in the QuestionEngine service that were allegedly missing according to TASK-021. Analysis reveals that all required functionality exists and is fully operational:

1. ✅ `answerQuestion()` method (lines 513-526)
2. ✅ `areRequiredQuestionsAnswered()` method (lines 561-568)
3. ✅ `getQuestions()` method (lines 531-556)
4. ✅ `Question.importance` property (line 38)

All TypeScript compilation succeeds, and all 13 unit tests pass successfully.

---

## Requirements

### Functional Requirements

| Req ID | Requirement                                  | Status      | Implementation                                 |
| ------ | -------------------------------------------- | ----------- | ---------------------------------------------- |
| FR-1   | Store answers to questions in database       | ✅ Complete | `answerQuestion()` lines 513-526               |
| FR-2   | Check if all required questions are answered | ✅ Complete | `areRequiredQuestionsAnswered()` lines 561-568 |
| FR-3   | Retrieve questions for a task                | ✅ Complete | `getQuestions()` lines 531-556                 |
| FR-4   | Support question importance levels           | ✅ Complete | `Question.importance` line 38                  |

### Non-Functional Requirements

| Req ID | Requirement            | Status      | Evidence                    |
| ------ | ---------------------- | ----------- | --------------------------- |
| NFR-1  | TypeScript type safety | ✅ Complete | No TS2339 errors            |
| NFR-2  | Database persistence   | ✅ Complete | Uses `task_questions` table |
| NFR-3  | Test coverage          | ✅ Complete | 13/13 tests passing         |

---

## Technical Design

### 1. answerQuestion() Method

**Location**: `server/services/task-agent/question-engine.ts:513-526`

**Signature**:

```typescript
async answerQuestion(
  taskId: string,
  questionId: string,
  answer: string,
): Promise<void>
```

**Implementation**:

```typescript
async answerQuestion(
  taskId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  const now = new Date().toISOString();

  await run(
    `UPDATE task_questions SET answer = ?, answered_at = ?, updated_at = ? WHERE id = ? AND task_id = ?`,
    [answer, now, now, questionId, taskId],
  );

  await saveDb();
}
```

**Behavior**:

- Updates the `task_questions` table with the provided answer
- Sets `answer`, `answered_at`, and `updated_at` fields
- Uses both `questionId` and `taskId` for safety (prevents cross-task updates)
- Persists changes to database immediately

**Test Coverage**: Lines 224-246 in `tests/task-agent/question-engine.test.ts`

---

### 2. areRequiredQuestionsAnswered() Method

**Location**: `server/services/task-agent/question-engine.ts:561-568`

**Signature**:

```typescript
async areRequiredQuestionsAnswered(taskId: string): Promise<boolean>
```

**Implementation**:

```typescript
async areRequiredQuestionsAnswered(taskId: string): Promise<boolean> {
  const unansweredRequired = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM task_questions WHERE task_id = ? AND importance = 'required' AND answer IS NULL AND skipped = 0`,
    [taskId],
  );

  return unansweredRequired[0]?.count === 0;
}
```

**Behavior**:

- Queries `task_questions` table for unanswered required questions
- Filters by: `taskId`, `importance='required'`, `answer IS NULL`, `skipped=0`
- Returns `true` if no unanswered required questions exist
- Returns `false` if any required questions remain unanswered

**Test Coverage**: Lines 304-336 in `tests/task-agent/question-engine.test.ts`

---

### 3. getQuestions() Method

**Location**: `server/services/task-agent/question-engine.ts:531-556`

**Signature**:

```typescript
async getQuestions(taskId: string): Promise<Question[]>
```

**Implementation**:

```typescript
async getQuestions(taskId: string): Promise<Question[]> {
  const rows = await query<{
    id: string;
    category: QuestionCategory;
    text: string;
    priority: number;
    importance: string;
    target_field: string | null;
    answer: string | null;
    answered_at: string | null;
  }>(
    `SELECT id, category, text, priority, importance, target_field, answer, answered_at FROM task_questions WHERE task_id = ? AND skipped = 0`,
    [taskId],
  );

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    text: row.text,
    priority: row.priority,
    importance: (row.importance || importanceFromPriority(row.priority)) as QuestionImportance,
    targetField: row.target_field || undefined,
    answer: row.answer || undefined,
    answeredAt: row.answered_at || undefined,
  }));
}
```

**Behavior**:

- Retrieves all non-skipped questions for a task
- Maps database rows to `Question` objects
- Handles optional fields (targetField, answer, answeredAt)
- Falls back to derived importance if not stored in database

**Test Coverage**: Used throughout test file, particularly lines 239-245

---

### 4. Question.importance Property

**Location**: `server/services/task-agent/question-engine.ts:38`

**Type Definition**:

```typescript
export interface Question {
  id: string;
  category: QuestionCategory;
  text: string;
  priority: number; // 1-10, higher = more important
  importance: QuestionImportance; // derived from priority
  targetField?: string;
  answer?: string;
  answeredAt?: string;
}

export type QuestionImportance = "required" | "important" | "optional";
```

**Derivation Logic** (lines 97-101):

```typescript
function importanceFromPriority(priority: number): QuestionImportance {
  if (priority >= 8) return "required";
  if (priority >= 6) return "important";
  return "optional";
}
```

**Usage**:

- `importance` property is part of the `Question` interface
- Derived from `priority` value (1-10 scale)
- Used throughout tests to filter required vs optional questions

---

## Database Schema

**Table**: `task_questions`

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
)
```

**Indexes**:

- `idx_task_questions_task` on `task_id`
- `idx_task_questions_task_status` on `(task_id, skipped)`

---

## Pass Criteria

| #   | Criteria                                                      | Status  | Evidence            |
| --- | ------------------------------------------------------------- | ------- | ------------------- |
| 1   | answerQuestion(taskId, questionId, answer) method implemented | ✅ Pass | Lines 513-526       |
| 2   | areRequiredQuestionsAnswered(taskId) method implemented       | ✅ Pass | Lines 561-568       |
| 3   | getQuestions(taskId) method implemented                       | ✅ Pass | Lines 531-556       |
| 4   | Question interface includes importance property               | ✅ Pass | Line 38             |
| 5   | TypeScript compilation succeeds without TS2339 errors         | ✅ Pass | Build succeeds      |
| 6   | Unit tests pass                                               | ✅ Pass | 13/13 tests passing |

---

## Test Results

**Test Execution**: 2026-02-08 22:07:28

```
✓ tests/task-agent/question-engine.test.ts  (13 tests) 251ms

Test Files  1 passed (1)
     Tests  13 passed (13)
```

**Test Coverage**:

- ✅ generateQuestions (3 tests)
- ✅ question categories (4 tests)
- ✅ answerQuestion (1 test)
- ✅ skipQuestion (1 test)
- ✅ getCompletionStatus (2 tests)
- ✅ areRequiredQuestionsAnswered (2 tests)

---

## Dependencies

### Internal Dependencies

- `database/db.js` - Database query/run operations
- `types/task-agent.js` - Task type definitions
- `uuid` - Question ID generation

### Database Tables

- `tasks` - Task entities
- `task_questions` - Question storage
- `task_relationships` - Task dependencies (used in gap analysis)
- `task_appendices` - Additional task context (used in gap analysis)
- `task_impacts` - File impacts (updated by answer processing)

---

## Conclusion

**TASK-021 is already complete**. All methods and properties mentioned in the task description are fully implemented, tested, and operational:

1. ✅ `answerQuestion()` - Stores answers to database with timestamps
2. ✅ `areRequiredQuestionsAnswered()` - Returns boolean based on required question completion
3. ✅ `getQuestions()` - Retrieves all non-skipped questions for a task
4. ✅ `Question.importance` - Property exists and is derived from priority

**No code changes are required**. The task description appears to be based on outdated information or a misunderstanding of the current implementation state.

### Recommendation

Mark TASK-021 as **COMPLETE** with no implementation work needed. The QuestionEngine service is fully functional and meets all stated requirements.
