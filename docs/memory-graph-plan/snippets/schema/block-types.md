# Block Types Schema

Add to `schema/entities/memory-block-type.ts`:

```typescript
// Existing types (keep these):
// insight, fact, assumption, question, decision, action, requirement, option, pattern, synthesis, meta

// Add these new types:
"constraint"; // Limitations, boundaries, non-negotiables
"blocker"; // Active blockers preventing progress
"epic"; // Large body of work (task management)
"story"; // User story / feature request
"task"; // Specific work item
"bug"; // Defect or issue
"persona"; // Customer persona definition
"milestone"; // Timeline marker / deadline
"evaluation"; // Evaluation result (score, rationale)
"learning"; // SIA-extracted gotcha or pattern
```

## Verification

```bash
npx tsc --noEmit
```

## All 21 Block Types

| Type        | Use Case                      |
| ----------- | ----------------------------- |
| insight     | Observations and learnings    |
| fact        | Verified information          |
| assumption  | Unverified beliefs            |
| question    | Open questions                |
| decision    | Choices made                  |
| action      | Things to do                  |
| requirement | Must-have features            |
| option      | Alternatives considered       |
| pattern     | Repeating approaches          |
| synthesis   | Combined insights             |
| meta        | Information about information |
| constraint  | Limitations                   |
| blocker     | Active blockers               |
| epic        | Large work items              |
| story       | User stories                  |
| task        | Specific tasks                |
| bug         | Defects                       |
| persona     | Customer profiles             |
| milestone   | Timeline markers              |
| evaluation  | Assessment results            |
| learning    | Extracted knowledge           |
