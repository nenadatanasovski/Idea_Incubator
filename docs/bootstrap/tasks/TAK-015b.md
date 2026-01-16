# TAK-015b: SuggestionEngine Service

---

## Metadata

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| **Phase**      | 3 - Core Services                              |
| **Depends On** | TAK-008, TAK-015a                              |
| **Blocks**     | TAK-016 (TaskAgent), TAK-020 (TelegramHandler) |
| **Priority**   | P1                                             |
| **Owner**      | Build Agent                                    |

---

## Summary

Implement the SuggestionEngine class that implements the continuous suggestion loop, selecting highest priority ready tasks and detecting parallelization opportunities.

---

## Requirements

1. **SuggestionEngine class**:
   - Implement continuous suggestion loop
   - Select highest priority ready tasks
   - Detect parallelization opportunities
   - Generate context-aware suggestions
   - Respect user preferences and working hours

2. **Methods**:
   - `getSuggestions(taskListId): Promise<Suggestion[]>`
   - `getNextTask(taskListId): Promise<Task>`
   - `findParallelizable(tasks): Task[][]`
   - `generateSuggestionMessage(task): string`
   - `shouldSuggestNow(lastSuggestionTime): boolean`

3. **Suggestion Criteria**:
   - Only suggest tasks that pass validation
   - Consider user's current focus area
   - Minimum 5 minutes between suggestions
   - Respect configured working hours

---

## Pass Criteria

**PASS** when ALL of the following are true:

| #   | Criterion                | How to Verify                                                                                       |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | File exists              | `test -f server/services/task-agent/suggestion-engine.ts` returns 0                                 |
| 2   | Exports SuggestionEngine | `grep -q "export class SuggestionEngine" server/services/task-agent/suggestion-engine.ts` returns 0 |
| 3   | Has getSuggestions       | `grep -q "getSuggestions" server/services/task-agent/suggestion-engine.ts` returns 0                |
| 4   | Has getNextTask          | `grep -q "getNextTask" server/services/task-agent/suggestion-engine.ts` returns 0                   |
| 5   | Has parallelization      | `grep -q "findParallelizable\|parallel" server/services/task-agent/suggestion-engine.ts` returns 0  |
| 6   | TypeScript compiles      | `npx tsc --noEmit server/services/task-agent/suggestion-engine.ts` returns 0                        |

**FAIL** if any criterion is not met.

---

## Output Files

```
server/services/task-agent/
└── suggestion-engine.ts
```

---

## Gotchas

- Only suggest tasks that pass validation
- Consider user's current focus area
- Minimum 5-minute interval between proactive suggestions

---

## Validation

```bash
npx tsc --noEmit server/services/task-agent/suggestion-engine.ts
npm test -- --grep "suggestion-engine"
```

---

## Next Steps

After completing: Implement TaskListManager (TAK-015c).
