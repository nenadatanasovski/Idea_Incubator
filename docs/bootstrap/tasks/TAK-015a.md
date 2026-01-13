# TAK-015a: PriorityCalculator Service

---

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | 3 - Core Services |
| **Depends On** | TAK-007, TAK-013 |
| **Blocks** | TAK-015b (SuggestionEngine), TAK-016 (TaskAgent) |
| **Priority** | P1 |
| **Owner** | Build Agent |

---

## Summary

Implement the PriorityCalculator class that calculates task priority using the formula: BlockedCount × 20 + QuickWinBonus + DeadlineBonus + TaskAgentAdvice.

---

## Context

### Priority Formula

```
priority = (blockedCount × 20)      // How many tasks this unblocks
         + (isQuickWin ? 10 : 0)    // <30 min estimated
         + deadlineBonus            // 15 if ≤1 day, 10 if ≤3 days, 5 if ≤7 days
         + strategicBonus           // From Task Agent recommendations
```

### Example Calculations

| Task | BlockedCount | QuickWin | Deadline | Strategic | Total |
|------|--------------|----------|----------|-----------|-------|
| A | 5 | Yes | 1 day | +5 | 5×20 + 10 + 15 + 5 = 130 |
| B | 0 | Yes | None | 0 | 0 + 10 + 0 + 0 = 10 |
| C | 2 | No | 3 days | +10 | 2×20 + 0 + 10 + 10 = 60 |

---

## Requirements

1. **PriorityCalculator class**:
   - Calculate priority using formula
   - Quick win bonus for tasks with effort < 30 minutes
   - Deadline bonus based on proximity
   - Strategic bonus from Task Agent advice
   - Recalculate on dependency changes

2. **Methods**:
   - `calculate(task: Task): Promise<number>`
   - `getBlockedCount(taskId): Promise<number>`
   - `isQuickWin(task): boolean`
   - `getDeadlineBonus(task): number`
   - `getStrategicBonus(taskId): Promise<number>`
   - `recalculateAll(taskListId): Promise<void>`

---

## Pass Criteria

**PASS** when ALL of the following are true:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | File exists | `test -f server/services/task-agent/priority-calculator.ts` returns 0 |
| 2 | Exports PriorityCalculator | `grep -q "export class PriorityCalculator" server/services/task-agent/priority-calculator.ts` returns 0 |
| 3 | Has calculate method | `grep -q "async calculate" server/services/task-agent/priority-calculator.ts` returns 0 |
| 4 | Has blockedCount | `grep -q "getBlockedCount\|blockedCount" server/services/task-agent/priority-calculator.ts` returns 0 |
| 5 | Has quickWin | `grep -q "isQuickWin\|quickWin" server/services/task-agent/priority-calculator.ts` returns 0 |
| 6 | TypeScript compiles | `npx tsc --noEmit server/services/task-agent/priority-calculator.ts` returns 0 |

**FAIL** if any criterion is not met.

---

## Output Files

```
server/services/task-agent/
└── priority-calculator.ts
```

---

## Gotchas

- BlockedCount is the number of tasks that depend on this one (not vice versa)
- QuickWin applies to tasks with effort < 30 minutes
- Recalculate priorities when dependencies change

---

## Validation

```bash
npx tsc --noEmit server/services/task-agent/priority-calculator.ts
npm test -- --grep "priority-calculator"
```

---

## Next Steps

After completing: Implement SuggestionEngine (TAK-015b).
