# Graph Dimensions Schema

Add to `schema/entities/memory-graph-membership.ts`:

```typescript
// Existing dimensions (keep these):
// problem, solution, market, risk, fit, business, spec, distribution, marketing, manufacturing

// Add these new dimensions:
"user"; // Founder/builder profile (skills, constraints, preferences)
"competition"; // Competitive landscape analysis
"validation"; // Experiments, tests, proof points
"tasks"; // Task management (epics, stories, bugs)
"timeline"; // Phases, milestones, deadlines
"customer"; // Target customer profiles/personas
"product"; // Current product state (live, not pending changes)
```

## Verification

```bash
npx tsc --noEmit
```

## All 17 Dimensions

| Dimension     | Purpose                       |
| ------------- | ----------------------------- |
| problem       | Problem space definition      |
| solution      | Solution approach             |
| market        | Market analysis               |
| risk          | Risk identification           |
| fit           | Product-market fit            |
| business      | Business model                |
| spec          | Future state (what should be) |
| product       | Current state (what is)       |
| distribution  | Distribution strategy         |
| marketing     | Marketing strategy            |
| manufacturing | Operations                    |
| user          | Founder/builder profile       |
| competition   | Competitive landscape         |
| validation    | Tests and experiments         |
| tasks         | Task management               |
| timeline      | Milestones and deadlines      |
| customer      | Target customer personas      |
