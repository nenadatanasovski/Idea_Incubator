# PHASE7-TASK-03 Quick Reference

## Status: 🟡 50% Complete - Needs Integration

---

## What Exists ✅

| Component | Status | Location |
|-----------|--------|----------|
| Rate Limiter Middleware | ✅ Working | `server/middleware/rate-limiter.ts` |
| Parent Harness Budget Tracker | ✅ Working | `parent-harness/orchestrator/src/budget/` |
| Idea Incubator Cost Tracker | ✅ Working | `utils/cost-tracker.ts` |
| Budget API Endpoints | ✅ Working | `parent-harness/orchestrator/src/api/budget.ts` |
| WebSocket Budget Broadcasts | ✅ Working | Budget updates sent to dashboard |
| Telegram Budget Alerts | ✅ Working | Notifications at 80%, 100% |

---

## What's Missing ❌

| Gap | Impact | Priority |
|-----|--------|----------|
| Predictive cost checks (before API calls) | 🔴 Critical | P0 |
| Circuit breaker (halt all ops at 100%) | 🔴 Critical | P0 |
| Unified budget (Idea Inc + Parent Harness) | 🔴 Critical | P0 |
| Anthropic API quota tracking | 🟡 High | P1 |
| Persistent rate limits (survive restarts) | 🟠 Medium | P2 |
| Cost-aware rate limiting (tokens, not requests) | 🟠 Medium | P2 |

---

## Quick Wins (2 Days)

### Phase 1: Predictive Controls
```typescript
// Before: Budget check AFTER spending money ❌
const result = await callAnthropic(prompt);
recordUsage(result.usage); // Too late!

// After: Budget check BEFORE spending money ✅
const estimatedCost = CostTracker.estimateCost(5000, 5000);
await budgetClient.checkAvailable(estimatedCost); // Throws if insufficient
const result = await callAnthropic(prompt);
await budgetClient.record(result.usage);
```

### Phase 2: Circuit Breaker
```typescript
// middleware/budget-guard.ts
export async function budgetGuard(req, res, next) {
  const status = await budgetClient.getStatus();

  if (status.daily.percentUsed >= 100) {
    return res.status(503).json({
      error: 'Daily budget exceeded',
      resetAt: status.daily.resetAt,
    });
  }

  next();
}

// Apply to expensive endpoints
app.post('/api/ideas/:slug/evaluate', budgetGuard, ...);
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      User Request                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Rate Limiter (requests/min)                    │
│  • 100/min API     • 10/min strict    • 5/min auth         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Budget Guard (circuit breaker)                 │
│  • Check if daily budget < 100%                             │
│  • Return 503 if exceeded                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Predictive Cost Check (NEW - PHASE 1)               │
│  • Estimate operation cost                                  │
│  • Check if budget remaining > estimate                     │
│  • Reserve budget for operation                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│       Anthropic Quota Check (NEW - PHASE 3)                 │
│  • Check requests/min limit (50/min for Tier 1)            │
│  • Check tokens/min limit (40K/min for Tier 1)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Call (Anthropic)                       │
│  • Execute operation                                        │
│  • Get actual token usage                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Record Actual Usage (IMPROVED)                 │
│  • Record to Parent Harness budget DB                       │
│  • Update Anthropic quota tracker                           │
│  • Commit budget reservation                                │
│  • Broadcast WebSocket update                               │
│  • Send Telegram alert if threshold crossed                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Current Limits

### Rate Limits (per IP, per minute)
- General API: **100 requests**
- Strict (evaluations): **10 requests**
- Auth endpoints: **5 requests**
- Ideation: **30 messages**
- Web search: **15 searches**

### Budget Limits
- Daily: **$50** (Parent Harness default)
- Monthly: **$500** (Parent Harness default)
- Per evaluation: **$15** (Idea Incubator default, max $50)

### Anthropic API Limits (Tier 1)
- Requests: **50/minute**
- Tokens: **40,000/minute**

---

## Test Coverage

### Existing Tests ✅
- Rate limiter: request counting, window reset, cleanup
- Budget tracker: daily/monthly tracking, per-agent breakdown
- Cost tracker: estimation, budget enforcement, API call limits

### Needed Tests ❌
- [ ] Predictive budget checks
- [ ] Budget reservations and rollbacks
- [ ] Circuit breaker open/close
- [ ] Cross-platform budget (Idea Inc + Parent Harness)
- [ ] Anthropic quota enforcement
- [ ] Persistent rate limits

---

## Configuration

### Environment Variables
```bash
# Budget limits
DAILY_BUDGET_USD=50
MONTHLY_BUDGET_USD=500
WARNING_THRESHOLD_PERCENT=80

# Anthropic API tier (1-4)
ANTHROPIC_TIER=1

# Rate limit backend
RATE_LIMIT_STORE=memory  # or: redis, database
```

### API Endpoints
```
GET  /api/budget/status          # Current usage
GET  /api/budget/daily           # Daily breakdown
GET  /api/budget/monthly         # Monthly breakdown
GET  /api/budget/agent/:id       # Per-agent usage
GET  /api/budget/config          # Get limits
PATCH /api/budget/config         # Update limits
POST /api/budget/record          # Record usage (internal)
GET  /api/budget/pricing         # Model pricing
```

---

## Implementation Checklist

### Phase 1: Predictive Controls (1 day)
- [ ] Create `BudgetClient` class
- [ ] Add pre-flight budget checks to evaluator
- [ ] Implement budget reservation system
- [ ] Add rollback on error
- [ ] Write 8 unit tests

### Phase 2: Circuit Breaker (0.5 days)
- [ ] Create `budgetGuard` middleware
- [ ] Apply to evaluation endpoints
- [ ] Integrate with Parent Harness task queue
- [ ] Add user-friendly error messages
- [ ] Write 5 unit tests

### Phase 3: Anthropic Quotas (1 day)
- [ ] Create `AnthropicQuotaTracker` class
- [ ] Add requests/min limiter
- [ ] Add tokens/min limiter
- [ ] Integrate with budget client
- [ ] Add tier configuration
- [ ] Write 6 unit tests

### Phase 4: Persistent Rate Limits (1 day)
- [ ] Add `rate_limits` table to database
- [ ] Migrate rate limiter to database storage
- [ ] Add rate limit analytics endpoint
- [ ] Implement cleanup job
- [ ] Write 7 unit tests

### Phase 5: Cost-Aware Limiting (0.5 days)
- [ ] Create token-based rate limiter
- [ ] Create hybrid limiter (requests + tokens)
- [ ] Apply to evaluation endpoints
- [ ] Write 4 unit tests

### Testing & Docs (1.5 days)
- [ ] Write integration tests (10)
- [ ] Write E2E tests (5)
- [ ] Update README.md
- [ ] Create BUDGET_SYSTEM.md
- [ ] Add dashboard budget widget

---

## Recommended Timeline

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| 1 | Phase 1 + tests | Predictive budget checks working |
| 2 | Phase 2 + tests | Circuit breaker working |
| 3 | Phase 3 + tests | Anthropic quotas enforced |
| 4 | Phase 4 + tests | Persistent rate limits |
| 5 | Phase 5 + integration | Cost-aware limiting |
| 6 | E2E tests + docs | Production-ready |

**Total: 6 days** (5.5 engineering + 0.5 buffer)

---

## Success Criteria

✅ **Task complete when:**
1. No API call exceeds remaining budget (pre-flight checks)
2. All operations halt when daily budget hits 100% (circuit breaker)
3. Idea Incubator and Parent Harness share unified budget
4. Anthropic's requests/min and tokens/min limits respected
5. Rate limit state survives server restarts
6. Dashboard shows real-time budget usage
7. 35+ tests pass (20 unit + 10 integration + 5 E2E)
8. Documentation updated (README + BUDGET_SYSTEM.md)

---

## Quick Commands

```bash
# Check budget status
curl http://localhost:3333/api/budget/status

# Update daily limit
curl -X PATCH http://localhost:3333/api/budget/config \
  -H "Content-Type: application/json" \
  -d '{"dailyLimitUsd": 100}'

# Run evaluation with custom budget
npm run evaluate my-idea --budget 20

# Check rate limit status (after Phase 4)
curl http://localhost:3333/api/admin/rate-limits

# Test circuit breaker
curl -X PATCH http://localhost:3333/api/budget/config \
  -d '{"dailyLimitUsd": 0.01}'  # Set very low limit
npm run evaluate my-idea  # Should get 503 error
```

---

**Full Spec:** [PHASE7-TASK-03-RATE-LIMITING-BUDGET-CONTROLS.md](./PHASE7-TASK-03-RATE-LIMITING-BUDGET-CONTROLS.md)

**Status:** ✅ Ready for implementation
**Assignee:** Build Agent (recommended)
**Reviewer:** QA Agent
**Timeline:** 6 days
