# TAK-015c: TaskListManager Service

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | 3 - Core Services |
| **Depends On** | TAK-006a, TAK-006b, TAK-007 |
| **Blocks** | TAK-016 (TaskAgent), TAK-019 (TelegramHandler) |
| **Priority** | P1 |
| **Owner** | Build Agent |

---

## Summary

Implement the TaskListManager class that creates and manages task lists, links them to Telegram chats (one-to-one mapping), and tracks execution progress.

---

## Requirements

1. **TaskListManager class**:
   - Create and manage task lists
   - Link task lists to Telegram chats (one chat per list)
   - Track list execution progress
   - Support sequential, parallel, and priority execution modes
   - Handle list completion and archiving

2. **Methods**:
   - `create(name, projectId, ideaSlug): Promise<TaskList>`
   - `addTask(listId, taskId, position): Promise<void>`
   - `removeTask(listId, taskId): Promise<void>`
   - `linkTelegram(listId, chatId): Promise<void>`
   - `updateProgress(listId): Promise<void>`
   - `complete(listId): Promise<void>`
   - `archive(listId): Promise<void>`

3. **Execution Modes**:
   - `sequential`: Execute tasks in position order
   - `parallel`: Execute all ready tasks simultaneously
   - `priority`: Execute highest priority ready tasks

---

## Pass Criteria

**PASS** when ALL of the following are true:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | File exists | `test -f server/services/task-agent/task-list-manager.ts` returns 0 |
| 2 | Exports TaskListManager | `grep -q "export class TaskListManager" server/services/task-agent/task-list-manager.ts` returns 0 |
| 3 | Has create method | `grep -q "async create" server/services/task-agent/task-list-manager.ts` returns 0 |
| 4 | Has linkTelegram | `grep -q "linkTelegram" server/services/task-agent/task-list-manager.ts` returns 0 |
| 5 | Has updateProgress | `grep -q "updateProgress" server/services/task-agent/task-list-manager.ts` returns 0 |
| 6 | TypeScript compiles | `npx tsc --noEmit server/services/task-agent/task-list-manager.ts` returns 0 |

**FAIL** if any criterion is not met.

---

## Output Files

```
server/services/task-agent/
└── task-list-manager.ts
```

---

## Gotchas

- Enforce one-to-one Telegram chat mapping (UNIQUE constraint)
- Update progress counters on task completion events
- Archive completed lists to reduce noise

---

## Validation

```bash
npx tsc --noEmit server/services/task-agent/task-list-manager.ts
npm test -- --grep "task-list-manager"
```

---

## Next Steps

After completing: Implement TaskAgent main class (TAK-016).
