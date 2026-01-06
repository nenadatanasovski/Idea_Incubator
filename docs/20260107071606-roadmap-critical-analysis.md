# Vibe Development Roadmap - Critical Analysis

**Created:** 2026-01-07 07:16:06 AEDT
**Analyzed Document:** `docs/VIBE-DEVELOPMENT-ROADMAP.md`
**Purpose:** First principles critique, gap analysis, parallelization opportunities
**Status:** Review required

---

## Executive Summary

The roadmap is comprehensive but suffers from three core problems:
1. **Over-sequential phasing** - Many tasks are listed as dependent when they're not
2. **Missing table-stakes infrastructure** - Auth, analytics, error handling not planned
3. **Priority misalignment** - Revenue-critical work (credits) deprioritized to Phase 9

This analysis identifies **4-5 parallel work streams** that could cut time-to-revenue in half.

---

## First Principles Foundation

**Core question:** What does a non-technical person need to go from "I have an idea" to "I have a working business"?

| Step | Capability | Roadmap Status |
|------|------------|----------------|
| 1 | Explore and validate their idea | Ideation Agent - COMPLETE |
| 2 | Specify what to build | Specification Agent - Phase 2 |
| 3 | Build it | Build Agent - Phase 3 |
| 4 | Run it | Hosting - Phase 6 |
| 5 | Pay for it | Credits - Phase 9 |
| 6 | Grow it | Network - Phase 7 |

The roadmap covers all six steps. But critical supporting infrastructure is missing.

---

## Critical Gaps (What's Missing)

### 1. Authentication & User Management

**Severity:** CRITICAL - Blocks everything
**Current status:** Not mentioned anywhere in roadmap

Missing components:
- User signup/login flow
- Session management
- Password reset
- OAuth/SSO options
- User profiles/settings
- Multi-user data isolation

**Why it matters:** Can't have credits, can't have collaboration, can't have personalization without users.

**Recommendation:** Add to Phase 0 or Phase 1.

---

### 2. Analytics & Observability

**Severity:** HIGH - Can't measure success
**Current status:** Metrics listed in roadmap but no capture plan

The roadmap defines targets:
- DAU/MAU >30%
- Ideation completion rate >50%
- API latency P95 <500ms

But there's no plan to capture them:
- No session recording (FullStory, Hotjar)
- No funnel analytics (Mixpanel, Amplitude)
- No event tracking infrastructure
- No dashboards (Grafana, custom)
- No user behavior tracking

**Why it matters:** You won't know if users are succeeding or why they're churning. Can't optimize what you can't measure.

**Recommendation:** Add analytics infrastructure to Phase 1.

---

### 3. Content Moderation

**Severity:** MEDIUM - Required before scale
**Current status:** Not addressed

The vision document states "no harmful apps, adult content, or scams" but there's no system to detect/prevent this:
- Idea/app content classification
- Harmful content detection (during ideation and build)
- User reporting system
- Review queue for edge cases
- Automated flags for human review

**Why it matters:** One viral "bad app" built on Vibe damages reputation permanently.

**Recommendation:** Add basic moderation to Phase 2 or 3.

---

### 4. Error Recovery & Resilience

**Severity:** HIGH - Critical for user trust
**Current status:** Not addressed

No plan for:
- Claude API downtime handling (mid-ideation, mid-build)
- Build failure recovery (what if iteration 47/50 fails?)
- Session state persistence for browser crash recovery
- Graceful degradation modes
- Retry logic with exponential backoff
- Circuit breakers for external services

**Why it matters:** Users lose work = users leave forever.

**Recommendation:** Add to Technical Debt section and implement in Phase 1.

---

### 5. Mobile Experience

**Severity:** MEDIUM - Target customer constraint
**Current status:** Mentioned in README, not in roadmap

Target customer is busy corporate employee with 5-15 hours/week. They'll want to ideate during commute. PWA mentioned but not in roadmap tasks.

Missing:
- PWA configuration
- Mobile-responsive testing
- Offline capability for reading (at minimum)
- Touch-friendly interactions

**Recommendation:** Add to Phase 1.2 (Frontend) or create separate mobile track.

---

## Critique of Sequencing

### The Core Problem

**The roadmap is too sequential.** Phases are presented as a waterfall when they should be parallel streams.

### Dependency Analysis

| Phase | Listed Dependency | Actual Dependency | Can Start Now? |
|-------|-------------------|-------------------|----------------|
| 9. Credit System | "Core platform functional" | **NONE** | YES |
| 6.1 Hosting Infra | "Build Agent produces code" | **NONE** (infra setup) | YES |
| 7.1 Invite System | "Core ideation + build working" | **Auth only** | After Auth |
| 5. Orchestrator | "Multiple agents exist" | **Can build registry now** | Partially |
| 4. SIA | "Build Agent operational" | **Needs failure data** | After Build |
| 8. Testing Agent | "Apps can be deployed" | **Needs deployed apps** | After Phase 6 |

### The Dangerous Assumption

The roadmap assumes everything flows through Build Agent. But:
- Hosting infrastructure can be set up independently
- Credit tracking has zero code generation dependencies
- User auth is foundational, not dependent
- Analytics can instrument ideation before build exists

---

## Critique of Complexity

### Specification Agent: Possibly Over-Engineered

The roadmap proposes:
- Separate `agents/specification/` directory
- New database tables: `spec_sessions`, `spec_requirements`, `spec_features`
- Separate API endpoints
- Separate frontend components

**Alternative approach:** Same ideation agent with a "specification mode":
- Different system prompt, same infrastructure
- Ideation agent already extracts structured data
- Specification is just more structured questions

**Recommendation:** Start with ideation agent doing spec extraction. Only split if it becomes unwieldy. This could save 2-3 weeks.

---

### SIA: Premature Optimization

The Self-Improvement Agent is architecturally sophisticated, but:
- Requires hundreds of failure->success loops to learn patterns
- You don't have this data yet
- Pattern recognition needs training data that doesn't exist
- Manual improvement is faster until you have 100+ logged failures

**Recommendation:** Build a "failure log" system first:
1. Log all build failures with context
2. Human reviews and categorizes failures weekly
3. Improve prompts manually based on patterns
4. Automate (SIA) when you have 100+ categorized failures

---

### Orchestrator: Premature Abstraction

With only 2-3 agents initially, a full orchestrator with:
- Dynamic registry
- Capability matching
- Pipeline generation
- Load balancing

...is overkill.

**Recommendation:** Simple if/else routing initially:
```typescript
if (phase === 'ideation') return ideationAgent
if (phase === 'spec') return specAgent  // or ideationAgent in spec mode
if (phase === 'build') return buildAgent
```

Build the Orchestrator when you have 5+ agents with complex routing needs.

---

## Parallel Work Streams

### Stream Allocation (4 Coding Loops)

#### Phase 1: Foundation (All can start NOW)

| Loop | Focus | Duration | Why Now |
|------|-------|----------|---------|
| **Loop 1** | Unified File System (current) | 2-3 weeks | Critical path for ideation completion |
| **Loop 2** | Auth + User Management | 1-2 weeks | Everything else blocked without users |
| **Loop 3** | Credit System + Stripe | 2-3 weeks | This is REVENUE - not "medium" priority |
| **Loop 4** | Hosting Infrastructure Setup | 2-3 weeks | Infra work enables build agent later |

#### Phase 2: Core Product (After Phase 1)

| Loop | Focus | Duration | Depends On |
|------|-------|----------|------------|
| **Loop 1** | Specification Mode + Build Agent | 4-6 weeks | UFS complete |
| **Loop 2** | Analytics + Observability | 1-2 weeks | Auth complete |
| **Loop 3** | Collaboration/Invite System | 2-3 weeks | Auth complete |
| **Loop 4** | E2E Testing + Mobile PWA | 2-3 weeks | UFS complete |

#### Phase 3: Scale & Polish (After Phase 2)

| Loop | Focus | Duration | Depends On |
|------|-------|----------|------------|
| **Loop 1** | SIA (if failure data exists) | 4-6 weeks | Build Agent + 100 logged failures |
| **Loop 2** | Content Moderation | 2-3 weeks | Build Agent |
| **Loop 3** | Network Features | 4-6 weeks | Collaboration complete |
| **Loop 4** | Testing Agent | 4-6 weeks | Hosting + deployed apps |

---

## Priority Realignment

### Current vs Recommended Priority

| Phase | Current Priority | Recommended Priority | Rationale |
|-------|------------------|---------------------|-----------|
| 9. Credit System | Medium | **CRITICAL** | This is revenue. No credits = no business. |
| 6. Hosting | High | **CRITICAL** | Required for any build output to matter |
| 4. SIA | High | **Low** | Premature without failure data |
| 5. Orchestrator | High | **Low** | Premature with 2-3 agents |
| Auth (missing) | Not listed | **CRITICAL** | Blocks everything |
| Analytics (missing) | Not listed | **HIGH** | Can't optimize blind |

---

## Documentation Analysis

### Obsolete Files (Should Archive)

| File | Size | Date | Why Obsolete | Superseded By |
|------|------|------|--------------|---------------|
| `docs/ARCHITECTURE.md` | 155KB | Dec 21 | Old "Idea Incubator" design | `ideas/vibe/technical-architecture.md` |
| `docs/ideation-agent-technical-spec.md` | 154KB | Dec 30 | Monolithic spec | `docs/specs/ideation-agent/*` |
| `docs/IMPLEMENTATION-PLAN.md` | 124KB | Dec 27 | Old phases | `docs/VIBE-DEVELOPMENT-ROADMAP.md` |
| `docs/guided-ideation-agent-design.md` | 56KB | Dec 30 | Design doc | `docs/specs/ideation-agent/*` |

**Total obsolete: ~490KB (4 files)**

### Unclear Status (Need Review)

| File | Size | Date | Question |
|------|------|------|----------|
| `docs/IMPLEMENTATION_PLAN.md` | 30KB | Dec 27 | Were Q&A sync, profiles, web search fixes implemented? |
| `docs/differentiation-step-analysis-and-redesign.md` | 81KB | Dec 29 | Was differentiation feature implemented? |
| `docs/position-phase-implementation-guide.md` | 80KB | Dec 29 | Was position phase implemented? |
| `docs/GEOGRAPHIC_MARKET_ANALYSIS_IMPLEMENTATION_PLAN.md` | 34KB | Dec 28 | Was geographic analysis implemented? |

### Duplicate Files

Two implementation plan files exist with confusing naming:
- `IMPLEMENTATION-PLAN.md` (hyphen, 124KB) - OLD system phases
- `IMPLEMENTATION_PLAN.md` (underscore, 30KB) - specific fixes

**Recommendation:** Archive hyphen version, review underscore version.

### Large Spec Files (Borderline)

These specs are readable but pushing token limits:

| Spec File | Size | Est. Tokens |
|-----------|------|-------------|
| `04-session-management.md` | 74KB | ~18,000 |
| `05-signal-extraction.md` | 72KB | ~18,000 |
| `09-frontend-state-hooks.md` | 71KB | ~17,000 |

Consider splitting test cases into separate files if these grow further.

---

## Recommended Roadmap Revision

### Phase 0: Foundation (Missing - Add Now)

**Duration:** 1-2 weeks
**Priority:** CRITICAL
**Parallel streams:** 2

- [ ] **AUTH-001**: User authentication system (signup, login, logout)
- [ ] **AUTH-002**: Session management
- [ ] **AUTH-003**: Password reset flow
- [ ] **AUTH-004**: OAuth/SSO foundation (Google, GitHub)
- [ ] **ANALYTICS-001**: Event tracking infrastructure
- [ ] **ANALYTICS-002**: Basic funnel analytics
- [ ] **ANALYTICS-003**: Error monitoring (Sentry or similar)

### Phase 1: Core Completion (Current - Parallelize)

**Duration:** 2-3 weeks
**Priority:** CRITICAL
**Parallel streams:** 4

Stream 1 (current):
- [ ] E2E Testing (1.1)
- [ ] Unified File System (1.2)

Stream 2 (move from Phase 9):
- [ ] Credit tracking per user
- [ ] Credit consumption per action
- [ ] Stripe integration
- [ ] Free tier limits

Stream 3 (move from Phase 6):
- [ ] Choose hosting provider
- [ ] Set up multi-tenant infrastructure
- [ ] Database provisioning
- [ ] Deployment pipeline foundation

Stream 4 (new):
- [ ] Mobile PWA configuration
- [ ] Error recovery for sessions
- [ ] Graceful degradation modes

### Phase 2: Specification + Build (Combine)

**Duration:** 4-6 weeks
**Priority:** CRITICAL
**Depends on:** Phase 1

- [ ] Unified agent with "spec mode" and "build mode"
- [ ] Ralph loop implementation
- [ ] Connect to hosting infrastructure from Phase 1
- [ ] Basic content moderation hooks

### Phase 3: Polish & Growth

**Duration:** 4-6 weeks
**Priority:** HIGH
**Depends on:** Phase 2

- [ ] Collaboration/Invites
- [ ] Network features (basic)
- [ ] SIA (only after 100+ logged failures)
- [ ] Testing Agent (after apps deployed)

---

## Hard Truths (First Principles)

1. **Credit System is Phase 0, not Phase 9.**
   Every week without credits is a week without a monetization path. You can't validate willingness-to-pay without the ability to pay.

2. **The "15-20 hours/week" constraint demands ruthless prioritization.**
   SIA and Testing Agent are architecturally elegant but you need paying users first. Cut scope, not quality.

3. **Orchestrator and SIA are "nice to have" until you have paying users.**
   Don't build infrastructure for scale you don't have. Simple routing beats elegant routing that delays launch.

4. **Authentication is invisible but blocking.**
   It's not glamorous, it won't impress anyone, but without it nothing else works. Do it first.

5. **The "same agent, different mode" pattern could collapse Phases 2-5 significantly.**
   Ideation -> Spec -> Build could be the same agent with mode switches, not 3 separate agent systems with 3 separate databases.

6. **You can run 4 parallel coding loops.**
   The roadmap's sequential presentation is hiding 50%+ time savings.

---

## Action Items

### Immediate (This Week)

1. [ ] Archive obsolete documentation files
2. [ ] Review "unclear status" files and determine if implemented
3. [ ] Add Auth + User Management to Phase 0
4. [ ] Move Credit System from Phase 9 to Phase 1
5. [ ] Move Hosting Infrastructure setup to Phase 1 (parallel with E2E)

### Short-term (Next 2 Weeks)

1. [ ] Set up 4 parallel coding loop infrastructure
2. [ ] Begin Auth implementation
3. [ ] Begin Credit System implementation
4. [ ] Begin Hosting Infrastructure setup

### Medium-term (Next Month)

1. [ ] Review whether Specification Agent needs to be separate from Ideation Agent
2. [ ] Define "failure log" system before committing to SIA
3. [ ] Determine orchestrator scope (simple routing vs full system)

---

## Conclusion

The vision is sound. The architecture is sophisticated. The sequencing is wrong.

By parallelizing work streams and reordering priorities, you can:
- Cut time-to-revenue by 40-50%
- Have paying users before building SIA/Orchestrator
- Validate the business model before over-engineering the platform

The roadmap as written would take 12-18 months calendar time with 15-20 hours/week. With proper parallelization and priority realignment, the same scope could be achieved in 6-9 months.

---

## Self-Scrutiny: Challenging My Own Recommendations

### 1. Auth: Is It REALLY Blocking?

**My claim:** Auth is CRITICAL and missing.

**Counter-argument:** The system has `users/` folder structure and `user_slug` columns. For SOLO DEVELOPMENT with the founder as the only user, you don't need OAuth.

**First principles test:** What's the minimum to validate the core proposition?
- Core value: Ideation → Validated Idea → Working App
- Can you validate this with just the founder? YES
- Auth is needed for EXTERNAL BETA, not internal development

**Revised verdict:** Auth should be ready before external beta (month 2-3), not before internal validation (month 1). **My urgency was overblown for Phase 0.** Move to Phase 1 (before external users).

---

### 2. Credit System: Is It REALLY Phase 1?

**My claim:** Credits should be Phase 1, not Phase 9 - it's REVENUE.

**Counter-argument:** You can't charge users who don't exist yet. Credits need:
- Users (auth)
- A product worth paying for (build agent working)
- A way to consume credits (ideation + build working)

**First principles test:** What validates willingness-to-pay?
- Free users completing the journey proves value
- Then you add credits and measure conversion

**Revised verdict:** Credits should be ready BEFORE LAUNCH but not blocking DEVELOPMENT. **My Phase 1 was too aggressive.** Credits belong in late Phase 1 or Phase 2, after auth and before external launch.

---

### 3. Hosting Infrastructure: Can It REALLY Be Parallel?

**My claim:** Hosting infra can be set up in parallel with build agent.

**Counter-argument:** Hosting configuration depends on:
- What the build agent outputs (file structure, frameworks)
- How apps are structured (monorepo? per-user repo?)
- Database per user vs shared database

**First principles test:** What's the dependency chain?
- Basic infra (Vercel account, Railway setup) = hours, no dependency
- App deployment configuration = needs build output format
- Multi-tenant isolation = needs architecture decision

**Revised verdict:** **Partially parallel.** Basic infra setup (1-2 days) can be parallel. Configuration (1-2 weeks) needs build agent output format defined. Split into:
- Phase 1: Basic infra setup (parallel)
- Phase 2: Full configuration (after build agent design)

---

### 4. Specification Agent: Is Separation Over-Engineered?

**My claim:** Same ideation agent with "spec mode" could save 2-3 weeks.

**Counter-argument:**
- Current orchestrator.ts is 61KB (2000+ lines)
- Adding spec mode would push to 80-100KB - too large
- Spec extraction is fundamentally different from passion exploration:
  - Different prompts (requirements vs feelings)
  - Different data structures (features vs signals)
  - Different validation (completeness vs authenticity)

**First principles test:** What problem does separation solve?
- Cognitive load for developers
- Clear boundaries for testing
- Independent evolution

**Revised verdict:** **I was wrong.** Separation is justified. But the question is: same DATABASE infrastructure with different AGENT code? That's the right middle ground:
- Shared: `ideation_sessions`, `ideation_artifacts`
- Separate: `agents/specification/` with its own prompts
- This is likely what the roadmap intended

---

### 5. SIA: Still Premature?

**My claim:** SIA is premature optimization - log and improve manually first.

**First principles test:** What does SIA need to work?
- Patterns of failure (need 100+ categorized failures)
- A way to validate improvements (deterministic tests)
- Context from previous attempts

**Reality check:** Build agent will fail A LOT. Code generation has ~60-70% first-attempt success rate. You'll have 100+ failures within the first month of build agent operation.

**Revised verdict:** **My recommendation stands** but with nuance:
- Phase 1: Build failure logging infrastructure
- Phase 2: Manual pattern identification (founder reviews weekly)
- Phase 3: SIA automation when patterns are clear

SIA shouldn't block build agent launch, but its INFRASTRUCTURE (logging) should be built alongside build agent.

---

### 6. Four Parallel Loops: Is This Realistic?

**My claim:** You can run 4 parallel coding loops and cut time in half.

**Counter-argument:**
- 15-20 hours/week founder time
- Each loop needs review, decisions, unblocking
- Context switching between 4 active streams is expensive

**First principles test:** What's the bottleneck?
- NOT the coding (Claude Code handles that)
- The bottleneck is DECISION MAKING and REVIEW
- 4 loops = 4x the decisions per day

**Reality check:** With Ralph loops (Claude Code doing autonomous work):
- 2 loops might be sustainable (review morning, review evening)
- 4 loops means some work goes un-reviewed for days
- That's OK for low-risk work, dangerous for critical path

**Revised verdict:** **Reduce to 2-3 loops:**
- Loop 1: Critical path (UFS → Spec → Build)
- Loop 2: Infrastructure (Auth → Credits → Hosting)
- Loop 3 (optional): Polish (Analytics, Mobile, Tests)

---

### 7. Analytics: Is It REALLY Missing?

**My claim:** No analytics infrastructure exists.

**Verification:** Searched for mixpanel, amplitude, posthog, sentry. Found nothing.

**Revised verdict:** **Confirmed missing.** This is a genuine gap. But priority is:
- Phase 1: Error monitoring (Sentry) - need this for any production use
- Phase 2: Basic funnel analytics - need before external launch
- Phase 3: Full analytics suite - need for optimization

---

## Updated Recommendations (Post-Scrutiny)

### What Changed

| Original Claim | Revised Position | Why |
|----------------|------------------|-----|
| Auth is Phase 0 CRITICAL | Auth is Phase 1, before external beta | Solo dev doesn't need auth |
| Credits is Phase 1 CRITICAL | Credits is late Phase 1, before launch | Can't monetize non-existent users |
| Hosting fully parallel | Basic setup parallel, config needs build agent | Dependency exists |
| Spec Agent over-engineered | Separation justified, shared infrastructure | File size concerns valid |
| 4 parallel loops | 2-3 realistic with 15-20 hrs/week | Decision bottleneck |

### Revised Parallel Work Allocation

**2-3 loops realistic, not 4**

| Loop | Focus | Hours/Week | Review Frequency |
|------|-------|------------|------------------|
| **Loop 1** | Critical Path: UFS → Spec → Build | 8-10 | Daily |
| **Loop 2** | Infrastructure: Auth → Credits → Hosting | 5-7 | Every 2-3 days |
| **Loop 3** | Polish: Analytics, Mobile, E2E Tests | 3-5 | Weekly |

### Revised Phase 0/1 Split

**Phase 0 (Week 1-2): Foundation - SOLO development only**
- Complete UFS implementation
- Basic error monitoring (Sentry)
- Failure logging infrastructure

**Phase 1a (Week 2-4): Auth + Spec Mode**
- User authentication (before external users)
- Specification mode for ideation agent
- OR separate spec agent with shared DB

**Phase 1b (Week 2-4): Parallel Infrastructure**
- Basic hosting infra setup
- Credit system design (not implementation)

**Phase 2 (Week 4-8): Build Agent + Launch Prep**
- Build agent implementation
- Credit system implementation
- Hosting configuration
- External beta preparation

---

## Final Honest Assessment

### What I Got Right

1. **Sequencing is too linear** - Many phases CAN be parallel
2. **SIA is premature** - Log first, automate later
3. **Orchestrator is premature** - Simple routing first
4. **Analytics is missing** - Genuine gap
5. **Documentation is bloated** - Archiving was correct

### What I Got Wrong

1. **Auth urgency** - Overblown for solo development phase
2. **Credit urgency** - Can't monetize before product exists
3. **4 parallel loops** - Unrealistic with 15-20 hrs/week
4. **Spec agent over-engineering** - Separation is justified

### The Honest Truth

The roadmap isn't as broken as my initial analysis suggested. The sequencing DOES make sense for the "15-20 hours/week" constraint - you can only effectively manage 1-2 active workstreams.

What's genuinely missing:
- Auth (before external beta, not before internal validation)
- Analytics (error monitoring first, funnel analytics later)
- Failure logging (for eventual SIA)

What's genuinely misordered:
- Credits should move from Phase 9 to Phase 2 (before launch)
- Hosting setup should start earlier (parallel, not dependent)

**Bottom line: The roadmap needs tuning, not rewriting.**

---

---

## Appendix A: Large Spec File Analysis

### Current State

The modular specs in `docs/specs/ideation-agent/` are large but coherent:

| Spec File | Lines | Est. Tokens | Recommendation |
|-----------|-------|-------------|----------------|
| `09-frontend-state-hooks.md` | 2,497 | ~18,000 | **Consider splitting** - separate test cases |
| `04-session-management.md` | 2,388 | ~17,000 | **Consider splitting** - separate test cases |
| `05-signal-extraction.md` | 2,305 | ~16,000 | **Consider splitting** - separate test cases |
| `06-agent-orchestration.md` | 1,956 | ~14,000 | OK for now |
| `07-api-endpoints.md` | 1,947 | ~14,000 | OK for now |
| `08-frontend-components.md` | 1,835 | ~13,000 | OK for now |
| `02-core-calculators.md` | 1,789 | ~13,000 | OK for now |
| `E2E-TEST-PLAN.md` | 1,478 | ~11,000 | OK |
| `01-database-data-models.md` | 1,260 | ~9,000 | OK |
| `03-core-utilities.md` | 999 | ~7,000 | OK |
| `00-IMPLEMENTATION-GUIDE.md` | 751 | ~5,000 | OK |

### Recommendation: Split Test Cases

For the 3 largest specs (09, 04, 05), consider extracting test cases:

```
docs/specs/ideation-agent/
├── 04-session-management.md          # Core spec only (~1,200 lines)
├── 04-session-management.tests.md    # Test cases (~1,200 lines)
├── 05-signal-extraction.md           # Core spec only
├── 05-signal-extraction.tests.md     # Test cases
├── 09-frontend-state-hooks.md        # Core spec only
└── 09-frontend-state-hooks.tests.md  # Test cases
```

**Priority:** LOW - Only do this if specs grow further or token limits become problematic.

---

## Appendix B: Archived Files Summary

Moved to `docs/archive/superseded-2026-01/`:

| File | Size | Original Date | Why Archived |
|------|------|---------------|--------------|
| `ARCHITECTURE.md` | 155KB | Dec 21 | Old "Idea Incubator" design, superseded by `ideas/vibe/technical-architecture.md` |
| `ideation-agent-technical-spec.md` | 154KB | Dec 30 | Monolithic spec, superseded by `docs/specs/ideation-agent/*` |
| `IMPLEMENTATION-PLAN.md` | 124KB | Dec 27 | Old phases, superseded by `VIBE-DEVELOPMENT-ROADMAP.md` |
| `guided-ideation-agent-design.md` | 56KB | Dec 30 | Design doc, superseded by specs |
| `differentiation-step-analysis-and-redesign.md` | 81KB | Dec 29 | Feature implemented in `agents/differentiation.ts` |
| `position-phase-implementation-guide.md` | 80KB | Dec 29 | Feature implemented in `agents/positioning.ts` |
| `GEOGRAPHIC_MARKET_ANALYSIS_IMPLEMENTATION_PLAN.md` | 34KB | Dec 28 | Feature implemented |
| `IMPLEMENTATION_PLAN.md` | 30KB | Dec 27 | Fixes implemented (web search, profiles, Q&A sync) |

**Total archived:** 714KB (8 files)

These files are preserved for historical reference but should not be used for current development.

---

## Appendix C: Verified Implementations

Features from "unclear status" docs that ARE implemented:

| Feature | Implementation | Verified |
|---------|----------------|----------|
| Differentiation Analysis | `agents/differentiation.ts` (324 lines) | ✓ |
| Position Phase | `agents/positioning.ts` (400 lines) | ✓ |
| Web Search | `agents/ideation/web-search-service.ts` (305 lines) | ✓ |
| Profile Context | `utils/profile-context.ts` (120 lines) | ✓ |
| User Profiles | `database/migrations/005_user_profiles.sql` | ✓ |

---

*Analysis by Claude Code*
*Created: 2026-01-07 07:16:06 AEDT*
*Self-Scrutiny Added: 2026-01-07 07:22 AEDT*
*Appendices Added: 2026-01-07 07:25 AEDT*
