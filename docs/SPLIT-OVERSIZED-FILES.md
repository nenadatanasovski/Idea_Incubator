# Implementation Plan: Split Oversized Files

## Files to Split

### 1. server/api.ts (4739 lines) - CRITICAL

Split into route modules:

| Route Module     | Endpoints                                                                                                                                                                   | New File                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Ideas CRUD       | `/api/ideas/*` (basic CRUD)                                                                                                                                                 | `server/routes/ideas.ts`            |
| Ideas Evaluation | `/api/ideas/:slug/evaluate*`, `/api/ideas/:slug/evaluations`                                                                                                                | `server/routes/ideas-evaluation.ts` |
| Ideas Questions  | `/api/ideas/:slug/questions*`, `/api/ideas/:slug/answers*`, `/api/ideas/:slug/readiness*`, `/api/ideas/:slug/develop*`                                                      | `server/routes/ideas-questions.ts`  |
| Ideas Lifecycle  | `/api/ideas/:slug/versions*`, `/api/ideas/:slug/status*`, `/api/ideas/:slug/lineage*`, `/api/ideas/:slug/iterations*`, `/api/ideas/:slug/gates*`, `/api/ideas/:slug/phase*` | `server/routes/ideas-lifecycle.ts`  |
| Ideas Analysis   | `/api/ideas/:slug/differentiate*`, `/api/ideas/:slug/positioning*`, `/api/ideas/:slug/generate-update*`                                                                     | `server/routes/ideas-analysis.ts`   |
| Ideas Financial  | `/api/ideas/:slug/allocation*`                                                                                                                                              | `server/routes/ideas-financial.ts`  |
| Export/Import    | `/api/export/*`, `/api/import/*`                                                                                                                                            | `server/routes/export-import.ts`    |
| Debates          | `/api/debate/*`, `/api/debates/*`                                                                                                                                           | `server/routes/debates.ts`          |
| Profiles         | `/api/profiles/*`                                                                                                                                                           | `server/routes/profiles.ts`         |
| Questions        | `/api/questions/*`                                                                                                                                                          | `server/routes/questions.ts`        |
| Stats/DB         | `/api/stats`, `/api/db/*`                                                                                                                                                   | `server/routes/system.ts`           |

### 2. server/routes/ideation.ts (2730 lines)

Already partially split in `server/routes/ideation/index.ts`. May need further review.

## Implementation Steps

1. Create shared utilities:
   - Extract `asyncHandler` and `respond` helpers
   - Extract common types (Idea, ApiResponse)

2. Create each route module following the pattern in existing routes (builds.ts, stats.ts)

3. Update api.ts to import and mount all route modules

4. Test all endpoints work after split

## Shared Code

Create `server/routes/shared.ts`:

```typescript
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function respond<T>(res: Response, data: T): void {
  res.json({ success: true, data });
}
```

## Status

- [ ] Create shared utilities
- [ ] Create ideas.ts (CRUD)
- [ ] Create ideas-evaluation.ts
- [ ] Create ideas-questions.ts
- [ ] Create ideas-lifecycle.ts
- [ ] Create ideas-analysis.ts
- [ ] Create ideas-financial.ts
- [ ] Create export-import.ts
- [ ] Create debates.ts
- [ ] Create profiles.ts
- [ ] Create questions.ts
- [ ] Create system.ts
- [ ] Update api.ts
- [ ] Test all endpoints
