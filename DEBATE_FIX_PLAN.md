# Comprehensive Debate System Fix Plan

## ✅ STATUS: CRITICAL FIXES APPLIED

The following changes have been made:

| File | Change | Status |
|------|--------|--------|
| `utils/broadcast.ts:6` | Port 3000 → 3001 | ✅ Done |
| `frontend/src/hooks/useDebateStream.ts:65` | Port 3000 → 3001 | ✅ Done |
| `server/websocket.ts:8-22` | Added new event types | ✅ Done |
| Frontend build | Verified compiles | ✅ Done |

### ⚠️ IMPORTANT: You must restart the API server for changes to take effect!

```bash
# Kill any running server and restart:
pkill -f "node.*server" || true
npm run server
```

---

## Executive Summary

The live debate viewer displays incorrectly because of **three critical issues**:

1. **Port Mismatch** - Three different components use different ports
2. **Missing Event Types** - Server-side `websocket.ts` doesn't know about new event types
3. **Stale Code** - Backend wasn't restarted after code changes

---

## Root Cause Analysis

### Issue 1: Port Mismatch (CRITICAL)

The system has THREE different port configurations that don't match:

| Component | File | Port Used |
|-----------|------|-----------|
| API Server | `server/api.ts:9` | `3001` (via `API_PORT`) |
| Broadcast Client | `utils/broadcast.ts:6` | `3000` (hardcoded fallback) |
| Frontend WebSocket | `frontend/src/hooks/useDebateStream.ts:65` | `3000` (hardcoded) |

**What happens:**
1. API server starts on port `3001`
2. Evaluation script tries to POST events to `http://localhost:3000`
3. Events never reach the API server
4. Frontend connects to `ws://localhost:3000` - wrong port
5. Frontend receives NO events

### Issue 2: Incomplete Event Type Definitions

The server's `websocket.ts` doesn't include the new event types:

```typescript
// server/websocket.ts lines 8-18 - OUTDATED
export type DebateEventType =
  | 'debate:started'
  | 'debate:round:started'
  | 'evaluator:speaking'         // OLD - no new types
  | 'redteam:challenge'
  | 'arbiter:verdict'
  | 'debate:round:complete'
  | 'debate:complete'
  | 'synthesis:started'
  | 'synthesis:complete'
  | 'error';

// MISSING:
// - 'debate:criterion:start'
// - 'evaluator:initial'
// - 'evaluator:defense'
// - 'debate:criterion:complete'
```

**What happens:**
1. TypeScript compilation may fail or emit warnings
2. Type checking doesn't validate new event types
3. Code relies on runtime behavior that may be inconsistent

### Issue 3: Event Flow Architecture Problems

Current flow has multiple handoff points that can fail silently:

```
┌─────────────────┐     POST /api/internal/broadcast     ┌───────────────┐
│ evaluate.ts     │ ─────────────────────────────────────▶│ api.ts        │
│ (broadcasts)    │       (to port 3000 - WRONG)         │ (port 3001)   │
└─────────────────┘                                       └───────┬───────┘
                                                                  │
                                                                  ▼
                                                          ┌───────────────┐
┌─────────────────┐     WebSocket ws://localhost:3000     │ websocket.ts  │
│ Frontend        │◀─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ (port 3001)   │
│ (WRONG PORT)    │            (NEVER CONNECTS)           └───────────────┘
└─────────────────┘
```

---

## Implementation Plan

### Phase 1: Fix Port Configuration (5 files)

#### 1.1 Update `utils/broadcast.ts`
```typescript
// Line 6 - Change from 3000 to 3001
const API_URL = process.env.API_URL || 'http://localhost:3001';
```

#### 1.2 Update `frontend/src/hooks/useDebateStream.ts`
```typescript
// Lines 64-66 - Change port from 3000 to 3001
if (import.meta.env.DEV) {
  return 'ws://localhost:3001';
}
```

#### 1.3 Update `server/websocket.ts` - Add new event types
```typescript
// Replace lines 8-18 with:
export type DebateEventType =
  | 'debate:started'
  | 'debate:criterion:start'     // NEW
  | 'debate:round:started'
  | 'evaluator:initial'          // NEW
  | 'evaluator:speaking'         // DEPRECATED but keep for backwards compat
  | 'evaluator:defense'          // NEW
  | 'redteam:challenge'
  | 'arbiter:verdict'
  | 'debate:round:complete'
  | 'debate:criterion:complete'  // NEW
  | 'debate:complete'
  | 'synthesis:started'
  | 'synthesis:complete'
  | 'error';
```

#### 1.4 Create Environment Configuration (Optional but Recommended)
Create `.env` file to centralize port configuration:
```env
API_PORT=3001
API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Phase 2: Verify Event Emission Chain

The event flow should be:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EVALUATION SCRIPT (scripts/evaluate.ts)                                      │
│                                                                              │
│  1. Runs specialized evaluators in parallel                                  │
│  2. Calls broadcaster.evaluatorInitial() for each criterion                 │
│  3. Starts debate phase                                                      │
│  4. Calls broadcaster.criterionStart() at debate beginning                  │
│  5. For each round:                                                          │
│     - broadcaster.roundStarted()                                             │
│     - broadcaster.redteamChallenge() for each challenge                     │
│     - broadcaster.evaluatorDefense() for each defense                       │
│     - broadcaster.arbiterVerdict() for each verdict                         │
│  6. Calls broadcaster.criterionComplete() at debate end                     │
│  7. Calls broadcaster.complete() when all done                              │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP POST to /api/internal/broadcast
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API SERVER (server/api.ts + server/websocket.ts)                             │
│                                                                              │
│  1. Receives POST at /api/internal/broadcast                                │
│  2. Calls emitDebateEvent(type, ideaSlug, runId, data)                      │
│  3. Broadcasts to all WebSocket clients watching that ideaSlug              │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           │ WebSocket message
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (useDebateStream.ts + DebateViewer.tsx)                             │
│                                                                              │
│  1. Receives WebSocket message                                               │
│  2. Parses event and adds to events array                                   │
│  3. groupEventsByCriterion() organizes events by criterion                  │
│  4. DebateCard renders each criterion's debate                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 3: Frontend Display Logic

The `groupEventsByCriterion` function (already updated) should handle events as follows:

| Event Type | Action |
|------------|--------|
| `evaluator:initial` | Set `evaluatorAssessment` with initial score |
| `debate:criterion:start` | Set `evaluatorAssessment` with score and start time |
| `debate:round:started` | Create new round in `rounds` array |
| `redteam:challenge` | Add to current round's `challenges` array |
| `evaluator:defense` | Add to current round's `defenses` array |
| `arbiter:verdict` | Add to current round's `arbiterVerdicts` array |
| `debate:criterion:complete` | Set `finalScore` and `isComplete` |

### Phase 4: Testing Verification

After fixes, verify:

1. **Port connectivity:**
   ```bash
   # Terminal 1: Start API server
   npm run server
   # Should show: API server running on http://localhost:3001

   # Terminal 2: Check WebSocket
   curl -i http://localhost:3001/api/debate/active
   # Should return JSON
   ```

2. **Event emission:**
   ```bash
   # Terminal 3: Run evaluation
   npm run evaluate test-idea --budget=5

   # Watch server console for:
   # [Evaluate stdout] Broadcasting evaluator:initial for criterion...
   ```

3. **Frontend reception:**
   - Open browser devtools → Network → WS
   - Connect to ws://localhost:3001/ws?idea=test-idea
   - Run evaluation
   - Should see events appearing in WebSocket frames

---

## Files to Modify

| File | Change |
|------|--------|
| `utils/broadcast.ts:6` | Port 3000 → 3001 |
| `frontend/src/hooks/useDebateStream.ts:65` | Port 3000 → 3001 |
| `server/websocket.ts:8-18` | Add new event types |
| `.env` (create) | Add port configuration |

---

## Verification Checklist

After making changes:

- [ ] Restart API server (`npm run server` or `npm run dev`)
- [ ] Rebuild frontend (`npm run frontend:build`)
- [ ] Verify WebSocket connects to port 3001
- [ ] Verify broadcast.ts posts to port 3001
- [ ] Run a test evaluation
- [ ] Check frontend displays:
  - [ ] Initial evaluator assessments (blue, left side)
  - [ ] Red team challenges (red, right side)
  - [ ] Evaluator defenses (blue, left side, marked "defends" or "concedes")
  - [ ] Arbiter verdicts (purple, center)
  - [ ] Per-criterion grouping
  - [ ] Round numbers

---

## Expected UI Layout After Fix

```
┌─────────────────────────────────────────────────────────────────┐
│ Problem Clarity (problem)                              ✓ 7.5/10 │
├─────────────────────────────────────────────────────────────────┤
│ [Evaluator Avatar]                                              │
│ Evaluator                                   Initial Score: 8/10 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ The problem is clearly articulated with specific examples...│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ─────────────────── Round 1 ─────────────────────               │
│                                                                  │
│                                     [Red Team Avatar]            │
│                                            The Skeptic           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ While the problem seems clear, have you validated this     ││
│  │ with actual users? The pain points mentioned are assumed...││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│ [Evaluator Avatar]                                              │
│ Evaluator (defends)                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ The idea mentions 3 specific user interviews that validate │ │
│ │ the core pain points...                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                    [Arbiter Avatar]                              │
│                    Arbiter              [Red Team wins] -0.5 pts │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ The skeptic raises a valid point. While interviews are     ││
│  │ mentioned, the sample size is too small for confidence...  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│                    Debate Complete: 7.5/10                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scorecard Component (Phase 5)

After debate display is working, add a Scorecard component that shows:

1. **Overall Score** - Weighted average of all criteria
2. **Category Breakdown** - 6 categories with original → final scores
3. **Per-Criterion Detail** - Expandable rows showing debate results
4. **Key Insights** - Summarized from arbiter verdicts
5. **Cost Summary** - Tokens used and estimated cost

This should be accessible from:
- `/ideas/:slug/scorecard` route
- A "View Scorecard" button on the DebateViewer when complete

---

## Timeline

1. **Immediate (5 min)**: Fix port mismatches
2. **Short-term (10 min)**: Update websocket.ts event types
3. **Verification (10 min)**: Run test evaluation and verify flow
4. **Enhancement (30 min)**: Add Scorecard component
