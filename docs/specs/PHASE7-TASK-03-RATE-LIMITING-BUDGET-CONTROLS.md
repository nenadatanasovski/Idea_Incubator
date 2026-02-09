# PHASE7-TASK-03: Rate Limiting and Budget Controls

**Task:** PHASE7-TASK-03
**Title:** Rate limiting and budget controls (evaluation costs, API quotas)
**Agent:** SIA (Strategic Ideation and Arbitration)
**Date:** February 8, 2026
**Status:** 🟡 PARTIALLY IMPLEMENTED - Needs Integration & Enhancement

---

## Executive Summary

Rate limiting and budget control infrastructure **already exists** but is **not fully integrated** across the platform. The system has sophisticated rate limiting middleware, comprehensive budget tracking in Parent Harness, and per-evaluation cost tracking in Idea Incubator. However, these systems operate in silos without unified enforcement, cross-platform quotas, or predictive cost controls.

**Recommendation:** Implement a unified budget control layer that bridges Idea Incubator evaluations and Parent Harness agent operations with shared quotas, predictive cost estimation, and automatic throttling.

---

## Current State Analysis

### ✅ What Already Exists

#### 1. **Rate Limiting Infrastructure** (`server/middleware/rate-limiter.ts`)

**Capabilities:**
- In-memory rate limiting with configurable windows (default: 60s)
- Per-IP tracking with X-Forwarded-For support
- Named limiters with isolated counters
- Standard HTTP rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- Automatic cleanup of expired entries

**Pre-configured Limiters:**
- `apiRateLimiter`: 100 req/min (general API)
- `strictRateLimiter`: 10 req/min (expensive operations)
- `authRateLimiter`: 5 req/min (authentication)
- `ideationRateLimiter`: 30 req/min (ideation sessions)
- `searchRateLimiter`: 15 req/min (web search)

**Current Usage:**
```typescript
// Applied to API routes in server/api.ts
import { apiRateLimiter, strictRateLimiter } from './middleware/rate-limiter.js';

// General protection
app.use(apiRateLimiter);

// Evaluation endpoint uses strictRateLimiter
app.post('/api/ideas/:slug/evaluate', strictRateLimiter, ...);
```

#### 2. **Parent Harness Budget System** (`parent-harness/orchestrator/src/budget/index.ts`)

**Capabilities:**
- Token usage tracking per agent, session, task
- Daily and monthly cost limits ($50/day, $500/month defaults)
- Real-time cost calculation with model-specific pricing
- Warning thresholds (50%, 80%, 100%)
- SQLite persistence (`token_usage` table)
- WebSocket broadcasts for budget updates
- Telegram notifications on threshold breaches

**Model Pricing (Per 1M Tokens):**
| Model | Input | Output |
|-------|-------|--------|
| Claude Opus 4.5 | $15 | $75 |
| Claude Sonnet 4.5 | $3 | $15 |
| Claude Haiku 3.5 | $0.25 | $1.25 |

**API Endpoints:**
- `GET /api/budget/status` - Current daily/monthly usage
- `GET /api/budget/daily` - Daily usage breakdown
- `GET /api/budget/monthly` - Monthly usage breakdown
- `GET /api/budget/agent/:agentId` - Per-agent usage
- `PATCH /api/budget/config` - Update limits
- `POST /api/budget/record` - Record token usage

**Budget Enforcement:**
```typescript
// Automatically checks after each recordUsage() call
export function recordUsage(agentId, model, inputTokens, outputTokens) {
  // ... record to database ...
  checkBudgetWarnings(); // Alert on 50%, 80%, 100%
  ws.budgetUpdated(...); // Broadcast via WebSocket
}
```

#### 3. **Idea Incubator Cost Tracking** (`utils/cost-tracker.ts`)

**Capabilities:**
- Per-evaluation budget enforcement
- Token usage tracking (input/output separate)
- Cost estimation before evaluation runs
- Detailed operation logging with timestamps
- API call counting and limits
- Unlimited mode for critical operations

**Usage in Evaluation:**
```typescript
// scripts/evaluate.ts
const costTracker = new CostTracker(budget, unlimited, undefined, config.model);

// Before evaluation
const costEstimate = estimateEvaluationCost();
if (costEstimate.total > budget && !force) {
  logInfo("Use --force to proceed anyway, or increase --budget");
  return;
}

// After evaluation
const costReport = costTracker.getReport();
console.log(`Estimated Cost: $${costReport.estimatedCost.toFixed(4)}`);
console.log(`Budget Remaining: $${costReport.budgetRemaining.toFixed(2)}`);
```

**Default Budget:**
- Per-evaluation: $15 (configurable via `--budget` flag)
- Max budget cap: $50 (config/default.ts)

#### 4. **Configuration System** (`config/default.ts`)

**Budget Settings:**
```typescript
budget: {
  default: 15.0,  // Per-evaluation default
  max: 50.0,      // Maximum allowed per evaluation
}
```

### ❌ What's Missing

#### 1. **Unified Budget Enforcement**

**Problem:** Three separate budget systems don't talk to each other:
- Parent Harness tracks agent operations
- Idea Incubator tracks evaluation operations
- No shared daily/monthly quotas

**Impact:** User could trigger:
- $40 in Parent Harness agent tasks
- $30 in Idea Incubator evaluations
- Total: $70 (exceeds any reasonable daily limit)

#### 2. **Predictive Cost Controls**

**Problem:** Budget checks happen **after** API calls, not before.

**Current Flow:**
```
API Call → Record Tokens → Check Budget → (Too late, money spent)
```

**Needed Flow:**
```
Request → Estimate Cost → Check Budget → Block if Exceeded → API Call
```

**Impact:** Budget can be exceeded by the cost of a single large operation (e.g., $5-10 debate session).

#### 3. **Cross-Platform Quotas**

**Problem:** Rate limiters are per-API-endpoint, not per-user or per-project.

**Gaps:**
- No global "evaluations per day" limit
- No "agent operations per hour" limit
- No user-specific quotas (multi-tenant support)
- No project-level budget allocation

#### 4. **Cost-Aware Rate Limiting**

**Problem:** Rate limiters count requests, not token cost.

**Example:**
```
User A: 10 requests × 1K tokens each = 10K tokens ($0.03)
User B: 10 requests × 100K tokens each = 1M tokens ($3.00)
```

Both hit the same rate limit, but User B costs 100× more.

#### 5. **Quota Persistence and Recovery**

**Problem:** Rate limiter uses in-memory storage.

**Impact:**
- Server restart → all rate limits reset
- No audit trail of rate limit violations
- Can't analyze abuse patterns

#### 6. **Anthropic API Quotas**

**Problem:** No tracking of Anthropic's API rate limits.

**Anthropic Limits (Claude API):**
- Tier 1: 50 req/min, 40K tokens/min
- Tier 2: 1000 req/min, 80K tokens/min
- Tier 3: 2000 req/min, 160K tokens/min
- Tier 4: 4000 req/min, 400K tokens/min

**Risk:** Exceeding Anthropic's limits → 429 errors → failed evaluations

#### 7. **Emergency Budget Circuit Breaker**

**Problem:** No way to instantly halt all operations when budget exceeded.

**Needed:** Global "circuit breaker" that:
- Stops accepting new evaluation requests
- Pauses Parent Harness task queue
- Shows user-friendly "budget exceeded" message
- Requires manual reset or daily rollover

---

## Strategic Analysis

### Option 1: Integrate Existing Systems (Recommended)

**Approach:** Connect Parent Harness budget system to Idea Incubator, add predictive controls.

**Pros:**
- ✅ Leverages existing infrastructure
- ✅ Minimal code changes
- ✅ Maintains separation of concerns
- ✅ Fast to implement (2-3 days)

**Cons:**
- ⚠️ Still two separate databases (ideas.db vs harness.db)
- ⚠️ Requires IPC or HTTP between systems

**Implementation:**
1. Create `BudgetClient` in Idea Incubator that calls Parent Harness API
2. Before evaluation: `GET /api/budget/status` → check remaining budget
3. After evaluation: `POST /api/budget/record` → record actual cost
4. Add predictive cost estimation before API calls
5. Implement circuit breaker check in rate limiter middleware

**Complexity:** Low-Medium
**Risk:** Low
**Timeline:** 2-3 days

---

### Option 2: Unified Budget Service

**Approach:** Create standalone budget service that both systems use.

**Pros:**
- ✅ Single source of truth
- ✅ Easy to add multi-tenant support later
- ✅ Clean architecture
- ✅ Scalable to multiple projects

**Cons:**
- ❌ Requires significant refactoring
- ❌ Another service to manage
- ❌ Complex deployment
- ❌ 1-2 weeks implementation time

**Implementation:**
1. Extract budget logic to `/budget-service/`
2. Create REST API for budget operations
3. Update Parent Harness to call service
4. Update Idea Incubator to call service
5. Add Redis for distributed rate limiting
6. Implement service discovery

**Complexity:** High
**Risk:** Medium
**Timeline:** 1-2 weeks

---

### Option 3: Hybrid Approach with Shared Database

**Approach:** Migrate Parent Harness budget tables into main ideas.db.

**Pros:**
- ✅ Single database = simpler queries
- ✅ Transaction safety
- ✅ No IPC/HTTP overhead

**Cons:**
- ❌ Couples Idea Incubator and Parent Harness
- ❌ Breaks Parent Harness modularity
- ❌ Migration risk

**Implementation:**
1. Move budget tables to `database/schema.sql`
2. Import budget module into server/api.ts
3. Update evaluation script to use same database
4. Add predictive controls

**Complexity:** Medium
**Risk:** Medium-High
**Timeline:** 3-5 days

---

## Recommendation: Option 1 (Integrate Existing Systems)

**Rationale:**
1. **Speed:** Can implement in 2-3 days vs 1-2 weeks for Option 2
2. **Low Risk:** No major refactoring, builds on proven code
3. **Good Enough:** Handles single-user, single-project use case (current need)
4. **Future-Proof:** Can migrate to Option 2 later if multi-tenant needed

**Critical Path:**
1. Add predictive cost estimation (before API calls)
2. Connect Idea Incubator to Parent Harness budget API
3. Implement circuit breaker for budget exceeded
4. Add Anthropic API quota tracking
5. Persist rate limiter data to database

---

## Implementation Plan

### Phase 1: Predictive Cost Controls (Priority: P0)

**Goal:** Never exceed budget, even by one API call.

**Tasks:**
1. **Pre-flight Budget Checks**
   ```typescript
   // In agents/evaluator.ts, before each API call
   async function callAnthropicWithBudgetCheck(prompt, estimatedTokens) {
     const estimatedCost = CostTracker.estimateCost(estimatedTokens, estimatedTokens);
     const budgetStatus = await fetch('http://localhost:3333/api/budget/status');
     const { daily } = await budgetStatus.json();

     if (daily.percentUsed >= 100) {
       throw new BudgetExceededError('Daily budget exhausted');
     }

     if (daily.totalCostUsd + estimatedCost > daily.config.dailyLimitUsd) {
       throw new BudgetExceededError('Insufficient budget for operation');
     }

     // Proceed with API call
     const result = await callAnthropic(prompt);

     // Record actual usage
     await fetch('http://localhost:3333/api/budget/record', {
       method: 'POST',
       body: JSON.stringify({
         agentId: 'evaluator',
         model: 'claude-sonnet-4-5',
         inputTokens: result.usage.input_tokens,
         outputTokens: result.usage.output_tokens,
       }),
     });

     return result;
   }
   ```

2. **Evaluation-Level Budget Reservation**
   ```typescript
   // In scripts/evaluate.ts, before evaluation starts
   const costEstimate = estimateEvaluationCost();
   const reservation = await reserveBudget(costEstimate.total);

   try {
     // Run evaluation
     await runEvaluation();
     await reservation.commit(); // Record actual usage
   } catch (err) {
     await reservation.rollback(); // Release reserved budget
     throw err;
   }
   ```

3. **Create Budget Client Module**
   ```typescript
   // utils/budget-client.ts
   export class BudgetClient {
     private baseUrl = 'http://localhost:3333/api/budget';

     async checkAvailable(estimatedCostUsd: number): Promise<boolean>;
     async reserve(estimatedCostUsd: number): Promise<BudgetReservation>;
     async record(usage: TokenUsage): Promise<void>;
     async getStatus(): Promise<BudgetStatus>;
   }
   ```

**Timeline:** 1 day
**Test Cases:** 8 (budget checks, reservations, rollbacks, edge cases)

---

### Phase 2: Circuit Breaker Implementation (Priority: P0)

**Goal:** Instantly halt all operations when budget exceeded.

**Tasks:**
1. **Budget Circuit Breaker Middleware**
   ```typescript
   // server/middleware/budget-guard.ts
   import { budgetClient } from '../utils/budget-client.js';

   export async function budgetGuard(req, res, next) {
     const status = await budgetClient.getStatus();

     if (status.daily.percentUsed >= 100) {
       return res.status(503).json({
         error: 'Daily budget exceeded',
         message: 'API operations are paused until tomorrow',
         resetAt: status.daily.resetAt,
         status: 'budget_exceeded',
       });
     }

     if (status.daily.percentUsed >= 90) {
       res.setHeader('X-Budget-Warning', 'true');
       res.setHeader('X-Budget-Remaining', status.daily.remaining);
     }

     next();
   }
   ```

2. **Apply to Critical Endpoints**
   ```typescript
   // server/api.ts
   import { budgetGuard } from './middleware/budget-guard.js';

   // Protect expensive operations
   app.post('/api/ideas/:slug/evaluate', budgetGuard, strictRateLimiter, ...);
   app.post('/api/ideation/continue', budgetGuard, ideationRateLimiter, ...);
   ```

3. **Parent Harness Task Queue Integration**
   ```typescript
   // parent-harness/orchestrator/src/orchestrator/index.ts
   async function processTasks() {
     const budgetStatus = await budget.isWithinBudget();

     if (!budgetStatus.daily) {
       events.orchestratorPaused('budget_exceeded');
       console.warn('⏸️ Task queue paused: daily budget exceeded');
       return; // Skip this tick
     }

     // Continue processing tasks
   }
   ```

**Timeline:** 0.5 days
**Test Cases:** 5 (circuit open/close, partial budget, reset)

---

### Phase 3: Anthropic API Quota Tracking (Priority: P1)

**Goal:** Stay within Anthropic's rate limits, not just budget limits.

**Tasks:**
1. **Anthropic Quota Tracker**
   ```typescript
   // parent-harness/orchestrator/src/budget/anthropic-quotas.ts
   export class AnthropicQuotaTracker {
     private requestsPerMinute: RateLimiter; // 50/min for Tier 1
     private tokensPerMinute: TokenBucket; // 40K/min for Tier 1

     async checkQuota(estimatedTokens: number): Promise<void> {
       if (!this.requestsPerMinute.tryAcquire()) {
         throw new QuotaExceededError('Anthropic requests/min limit');
       }

       if (!this.tokensPerMinute.tryAcquire(estimatedTokens)) {
         throw new QuotaExceededError('Anthropic tokens/min limit');
       }
     }

     recordUsage(actualTokens: number): void {
       // Track actual usage for next window
     }
   }
   ```

2. **Add Quota Config**
   ```typescript
   // config/default.ts
   anthropic: {
     tier: 1, // User's Anthropic tier
     quotas: {
       requestsPerMinute: 50,
       tokensPerMinute: 40000,
     },
   }
   ```

3. **Integrate with Budget Client**
   ```typescript
   // Before each Anthropic API call
   await anthropicQuotas.checkQuota(estimatedTokens);
   const result = await callAnthropic(prompt);
   anthropicQuotas.recordUsage(result.usage.input_tokens + result.usage.output_tokens);
   ```

**Timeline:** 1 day
**Test Cases:** 6 (rate limits, token limits, tier configs)

---

### Phase 4: Persistent Rate Limiting (Priority: P2)

**Goal:** Survive server restarts, provide audit trail.

**Tasks:**
1. **Migrate Rate Limiter to Database**
   ```typescript
   // parent-harness/orchestrator/src/db/rate-limits.ts
   CREATE TABLE rate_limits (
     id TEXT PRIMARY KEY,
     key TEXT NOT NULL, -- e.g., "api:192.168.1.1"
     limiter_name TEXT NOT NULL,
     count INTEGER NOT NULL,
     reset_at TEXT NOT NULL,
     created_at TEXT DEFAULT (datetime('now')),
     UNIQUE(limiter_name, key)
   );

   CREATE INDEX idx_rate_limits_reset ON rate_limits(reset_at);
   ```

2. **Update Rate Limiter Implementation**
   ```typescript
   // server/middleware/rate-limiter.ts
   export function createRateLimiter(config) {
     return async (req, res, next) => {
       const key = keyGenerator(req);
       const entry = await getRateLimitEntry(config.name, key);

       if (!entry || entry.reset_at < Date.now()) {
         await createRateLimitEntry(config.name, key, config.windowMs);
         return next();
       }

       await incrementRateLimitEntry(entry.id);

       if (entry.count >= config.maxRequests) {
         return res.status(429).json({ error: 'Rate limit exceeded' });
       }

       next();
     };
   }
   ```

3. **Add Rate Limit Analytics**
   ```typescript
   // New endpoint: GET /api/admin/rate-limits
   // Shows top violators, patterns, etc.
   ```

**Timeline:** 1 day
**Test Cases:** 7 (persistence, cleanup, analytics)

---

### Phase 5: Cost-Aware Rate Limiting (Priority: P2)

**Goal:** Limit by token cost, not just request count.

**Tasks:**
1. **Token Budget Rate Limiter**
   ```typescript
   // New limiter type
   export const tokenBudgetLimiter = createTokenRateLimiter({
     name: 'token-budget',
     windowMs: 60 * 1000, // 1 minute
     maxTokens: 50000, // 50K tokens/min
     model: 'claude-sonnet-4-5',
   });
   ```

2. **Hybrid Limiter (Requests + Tokens)**
   ```typescript
   export function createHybridRateLimiter(config) {
     const requestLimiter = createRateLimiter({ maxRequests: config.maxRequests });
     const tokenLimiter = createTokenRateLimiter({ maxTokens: config.maxTokens });

     return async (req, res, next) => {
       await requestLimiter(req, res, async () => {
         await tokenLimiter(req, res, next);
       });
     };
   }
   ```

3. **Apply to Evaluation Endpoint**
   ```typescript
   app.post('/api/ideas/:slug/evaluate',
     hybridRateLimiter({ maxRequests: 5, maxTokens: 100000 }),
     budgetGuard,
     ...
   );
   ```

**Timeline:** 0.5 days
**Test Cases:** 4 (token limits, hybrid, edge cases)

---

## Success Criteria

### Functional Requirements

- [ ] **Pre-flight Budget Check**: No API call if estimated cost exceeds remaining budget
- [ ] **Circuit Breaker**: All operations halt when daily budget at 100%
- [ ] **Unified Tracking**: Idea Incubator evaluations and Parent Harness agents share budget
- [ ] **Anthropic Quotas**: System respects Anthropic's requests/min and tokens/min limits
- [ ] **Persistent Rate Limits**: Rate limit state survives server restarts
- [ ] **Cost-Aware Limiting**: High-token operations count more than low-token ones
- [ ] **Real-time Alerts**: Telegram/WebSocket notifications at 80%, 90%, 100% thresholds
- [ ] **Grace Period**: Operations in progress complete even if budget hit during execution
- [ ] **User Feedback**: Clear error messages explaining why operation was blocked

### Non-Functional Requirements

- [ ] **Performance**: Budget checks add <50ms latency to API calls
- [ ] **Reliability**: System handles database locks, race conditions gracefully
- [ ] **Observability**: Dashboard shows real-time budget usage by agent/operation
- [ ] **Configurability**: Admins can adjust limits without code changes
- [ ] **Auditability**: All budget events logged to database

---

## Testing Strategy

### Unit Tests (20 tests)

```typescript
describe('BudgetClient', () => {
  it('checks available budget before operation');
  it('reserves budget for long operations');
  it('rolls back reservation on error');
  it('records actual usage after completion');
});

describe('BudgetGuard', () => {
  it('allows request when budget available');
  it('blocks request when daily budget exceeded');
  it('adds warning headers at 90% budget');
  it('checks budget on each request');
});

describe('AnthropicQuotaTracker', () => {
  it('respects requests per minute limit');
  it('respects tokens per minute limit');
  it('resets window after 60 seconds');
  it('throws error when quota exceeded');
});

describe('CostAwareRateLimiter', () => {
  it('limits by token count not request count');
  it('charges different costs for different models');
  it('combines request and token limits');
});
```

### Integration Tests (10 tests)

```typescript
describe('Budget Integration', () => {
  it('evaluation respects Parent Harness budget');
  it('agent operation records to shared budget');
  it('circuit breaker stops both systems');
  it('budget resets at midnight UTC');
});

describe('Multi-System Flow', () => {
  it('runs 5 evaluations + 10 agent tasks within $50 budget');
  it('blocks 6th evaluation when budget exceeded');
  it('resumes operations after budget reset');
});
```

### E2E Tests (5 tests)

```bash
# Test: Budget exhaustion scenario
1. Set daily budget to $5
2. Start 3 parallel evaluations (estimated $2 each)
3. First 2 complete, 3rd blocked
4. Verify circuit breaker activated
5. Reset budget, verify operations resume
```

---

## Risks and Mitigations

### Risk 1: Budget Estimation Inaccuracy

**Problem:** Estimated cost != actual cost → budget exceeded anyway

**Mitigation:**
- Add 20% safety buffer to estimates
- Track estimation accuracy, adjust multiplier
- Reserve budget = estimate × 1.2

### Risk 2: IPC Latency (Idea Incubator ↔ Parent Harness)

**Problem:** HTTP calls to budget API add latency

**Mitigation:**
- Cache budget status for 10 seconds
- Use fast-path for "plenty of budget" case
- Async budget recording (don't block)

### Risk 3: Database Lock Contention

**Problem:** Many agents recording usage simultaneously → locks

**Mitigation:**
- Batch budget records (write every 5 seconds)
- Use WAL mode for SQLite (already enabled)
- Connection pool with retry logic

### Risk 4: Anthropic Quota Mismatch

**Problem:** User upgrades to Tier 2, but config still says Tier 1

**Mitigation:**
- Add `/api/budget/config` endpoint to update tier
- Detect 429 errors from Anthropic, adjust tier automatically
- Document tier configuration in README

---

## Documentation Updates

### User-Facing

**README.md Section: Budget and Rate Limiting**
```markdown
## Budget Controls

The Idea Incubator includes comprehensive budget controls to prevent unexpected costs:

### Daily Budget
- Default: $50/day
- Configure: `PATCH /api/budget/config` or env var `DAILY_BUDGET_USD`
- Resets: Midnight UTC

### Per-Evaluation Budget
- Default: $15/evaluation
- Override: `npm run evaluate <slug> --budget 20`
- Max: $50 (prevents runaway costs)

### Rate Limits
- General API: 100 requests/minute
- Evaluations: 10/minute
- Web Search: 15/minute

### Budget Exceeded
When daily budget is exhausted:
- New evaluations blocked with 503 error
- In-progress operations complete
- Dashboard shows "Budget Exceeded" banner
- Automatic reset at midnight UTC
```

### Developer Documentation

**docs/BUDGET_SYSTEM.md**
```markdown
# Budget System Architecture

## Components
1. Budget Client (utils/budget-client.ts) - HTTP client for budget API
2. Budget Guard (middleware/budget-guard.ts) - Circuit breaker middleware
3. Parent Harness Budget Service - Centralized tracking
4. Anthropic Quota Tracker - API rate limit enforcement

## Flow Diagrams
[Predictive Budget Check Flow]
[Cross-Platform Budget Tracking]
[Circuit Breaker State Machine]

## Integration Guide
[How to add budget checks to new endpoints]
[How to record token usage]
[How to test budget controls]
```

---

## Timeline and Effort

| Phase | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| 1. Predictive Controls | Budget client, pre-flight checks, reservations | 1 day | P0 |
| 2. Circuit Breaker | Middleware, task queue integration | 0.5 days | P0 |
| 3. Anthropic Quotas | Quota tracker, config | 1 day | P1 |
| 4. Persistent Rate Limits | Database migration, analytics | 1 day | P2 |
| 5. Cost-Aware Limiting | Token-based limiter | 0.5 days | P2 |
| **Testing** | Unit, integration, E2E | 1 day | P0 |
| **Documentation** | User guide, dev docs | 0.5 days | P1 |
| **TOTAL** | | **5.5 days** | |

**Dependencies:**
- None (all infrastructure exists)

**Risks:**
- Low (building on proven code)

---

## Success Metrics

### Before Implementation
- ❌ Budget can be exceeded by cost of final operation
- ❌ Idea Incubator and Parent Harness track separately
- ❌ Rate limits reset on server restart
- ❌ No Anthropic API quota enforcement
- ⚠️ Budget checks happen after API call

### After Implementation
- ✅ Budget never exceeded (pre-flight checks)
- ✅ Unified budget across all operations
- ✅ Rate limits persist across restarts
- ✅ Anthropic quotas respected
- ✅ Circuit breaker halts operations at 100%
- ✅ Real-time budget visibility in dashboard
- ✅ Cost-aware rate limiting

---

## Action Items

### Immediate (P0 - Complete Before Production)
1. ✅ Review and approve this specification
2. ⏳ Implement Phase 1: Predictive Controls
3. ⏳ Implement Phase 2: Circuit Breaker
4. ⏳ Write test suite (20 unit + 10 integration tests)
5. ⏳ Update documentation

### Short-Term (P1 - Complete Within 1 Week)
6. ⏳ Implement Phase 3: Anthropic Quotas
7. ⏳ Add budget dashboard widget
8. ⏳ Configure production budget limits

### Medium-Term (P2 - Complete Within 2 Weeks)
9. ⏳ Implement Phase 4: Persistent Rate Limits
10. ⏳ Implement Phase 5: Cost-Aware Limiting
11. ⏳ Add budget analytics and reporting

---

## Conclusion

**Current Status:** 🟡 50% Complete
- ✅ Rate limiting infrastructure exists
- ✅ Budget tracking in Parent Harness works
- ✅ Per-evaluation cost tracking works
- ❌ Systems not integrated
- ❌ No predictive controls
- ❌ No circuit breaker

**Recommended Path:** Option 1 (Integrate Existing Systems)
- **Timeline:** 5.5 days
- **Risk:** Low
- **Impact:** High (prevents cost overruns)

**Next Steps:**
1. Get stakeholder approval for Option 1
2. Assign to Build Agent for Phase 1-2 implementation
3. QA Agent validates after each phase
4. Deploy to production with conservative limits

**Validation:** Once complete, run `/validate-implementation` against this spec to verify all requirements met.

---

**Prepared by:** SIA Agent
**Date:** February 8, 2026
**Status:** ✅ SPECIFICATION COMPLETE - Ready for Implementation
