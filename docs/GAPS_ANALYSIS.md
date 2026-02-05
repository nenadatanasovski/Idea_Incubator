# Idea Incubator: Gaps, Inconsistencies, and Issues Analysis

> **Document Purpose**: Critical, honest assessment of the three issues raised and related gaps discovered during deep-dive analysis.
> **Date**: 2025-12-27

---

## Executive Summary

The Idea Incubator has three architectural gaps that significantly undermine evaluation quality:

| Issue                  | Severity     | Status       | Root Cause / Resolution                      |
| ---------------------- | ------------ | ------------ | -------------------------------------------- |
| Q&A not picked up      | **Critical** | ✅ FIXED     | evaluate.ts now loads development.md         |
| Profile not considered | **High**     | ✅ FIXED     | formatProfileForCategory() in profile-context.ts |
| No web search          | **Medium**   | ✅ FIXED     | research.ts with conductPreEvaluationResearch |

These issues compound: without Q&A data, evaluators rely on sparse README content; without profiles, Fit scores are guesses; without web search, Market/Competition claims are unverifiable.

---

## Issue 1: Questions & Answers Not Being Picked Up

### The Problem

The `/idea-develop` skill and the evaluation pipeline use **completely separate data stores** that never synchronize:

```
DEVELOPMENT FLOW:
/idea-develop skill → writes to → development.md (markdown file)
                                        ↓
                               Never read by anything

EVALUATION FLOW:
npm run evaluate → getStructuredContext() → queries idea_answers table → EMPTY
                                                        ↓
                                               Evaluator gets no context
```

### Evidence

**Skill instruction** (`.claude/skills/idea-develop/SKILL.md:38`):

```markdown
4. **Record answers**
   - Save Q&A to `ideas/[slug]/development.md`
```

**Evaluation code** (`scripts/evaluate.ts:310`):

```typescript
const answers = await getAnswersForIdea(ideaId);
if (answers.length === 0) {
  return null; // Always null because idea_answers is never populated
}
```

### Impact

- Evaluators receive empty `structuredContext` despite users having answered dozens of development questions
- All the rich detail captured via `/idea-develop` is invisible to the AI evaluation
- Readiness scores are meaningless (always 0% coverage)
- Users are misled into thinking development work will improve evaluations

### Why This Happened

Two development paths were designed in parallel without integration:

1. **Skills system** (Claude Code) - uses markdown for human-readable persistence
2. **Question bank system** (database) - designed for structured machine-readable storage

The YAML question bank (`questions/*.yaml`) and `idea_answers` table were built for a frontend Q&A flow that was never completed. The skill-based flow took over but kept writing to markdown.

### Complexity Assessment

**Fix Difficulty**: Medium

- Need to either:
  - A) Add markdown→database sync (parse `development.md` into `idea_answers`)
  - B) Modify skill to dual-write (markdown + database)
  - C) Modify evaluator to also read markdown files

Option B is cleanest but requires updating Claude Code skill behavior.

---

## Issue 2: Profile Not Considered Beyond Fit Category

### The Problem

User profile data is **explicitly excluded** from all non-Fit evaluators:

```typescript
// specialized-evaluators.ts:306-309
const profileSection =
  category === "fit"
    ? formatProfileContextForFitEvaluator(profileContext ?? null)
    : ""; // ← Empty for ALL other categories!
```

### What Profile Contains vs. Where It's Used

| Profile Data               | Relevant To                   | Currently Used? |
| -------------------------- | ----------------------------- | --------------- |
| Primary Goals (FT1)        | Fit only                      | ✅ Yes          |
| Passion/Interests (FT2)    | Fit only                      | ✅ Yes          |
| Technical Skills (FT3)     | Fit, **Feasibility**          | ❌ Fit only     |
| Professional Experience    | **Feasibility**, **Risk**     | ❌ Fit only     |
| Industry Connections (FT4) | Fit, **Market**               | ❌ Fit only     |
| Professional Network       | **Market** (GTM/distribution) | ❌ Fit only     |
| Community Access           | **Market**                    | ❌ Fit only     |
| Employment Status (FT5)    | Fit, **Risk**                 | ❌ Fit only     |
| Weekly Hours Available     | Fit, **Feasibility**          | ❌ Fit only     |
| Financial Runway           | Fit, **Risk**                 | ❌ Fit only     |
| Risk Tolerance             | Fit, **Risk**                 | ❌ Fit only     |

### Impact

**Feasibility evaluator** cannot answer:

- "Do you have the skills to build this?" → Should check profile's `technicalSkills`
- "Can you dedicate enough time?" → Should check `weeklyHoursAvailable`

**Market evaluator** cannot answer:

- "Can you reach target customers?" → Should check `industryConnections`, `communityAccess`
- "Do you have distribution advantages?" → Should check `professionalNetwork`

**Risk evaluator** cannot answer:

- "What's your financial risk tolerance?" → Should check `riskTolerance`, `financialRunwayMonths`
- "Are you exposed to career risk?" → Should check `employmentStatus`

### Why This Happened

The profile system was designed specifically for "Personal Fit" (FT1-FT5 criteria). The implementation correctly routes profile data to the Fit evaluator but doesn't recognize that the same data is valuable for other categories.

The `evaluator.ts` file has a `formatProfileContextForPrompt()` function that includes brief profile summaries for non-fit categories, but the specialized evaluators (used in v2 mode) bypass this entirely.

### Complexity Assessment

**Fix Difficulty**: Low

- Create `formatProfileForCategory(profile, category)` function
- Return category-relevant excerpts (skills for Feasibility, network for Market, runway for Risk)
- Update specialized evaluators to use it

---

## Issue 3: No Web Search for Market/Tech Verification

### The Problem

Evaluators make market and technology assessments based purely on:

1. Whatever the user wrote in their README.md
2. The LLM's training data (January 2025 cutoff)

There is **no mechanism** to verify claims like:

- "The market is $50B and growing"
- "There are no direct competitors"
- "This technology is mature enough"
- "AI can now do X at Y cost"

### Evidence

No web search tools are imported or used anywhere in:

- `agents/evaluator.ts`
- `agents/specialized-evaluators.ts`
- `agents/redteam.ts`
- `agents/debate.ts`

### Impact

| Criterion             | Problem Without Web Search                            |
| --------------------- | ----------------------------------------------------- |
| M1 (Market Size)      | User's TAM/SAM/SOM claims taken at face value         |
| M2 (Market Growth)    | Trend analysis based on possibly-stale training data  |
| M3 (Competition)      | Competitor list may be incomplete or outdated         |
| M5 (Timing)           | "Why now" claims unverifiable                         |
| S2 (Tech Feasibility) | New AI/tech capabilities unknown if post-January 2025 |
| R3 (Technical Risk)   | Emerging tech risks not identified                    |

### Example Failure Mode

User claims: "No competitors in AI-powered plant care"

Reality (verifiable via web search):

- Planta: 10M+ downloads
- Greg: 2M+ downloads
- Florish: Growing AI features

Evaluator gives high "uniqueness" score based on incomplete information.

### Why This Happened

Web search adds:

- Cost (API calls)
- Latency
- Complexity (which searches to run?)
- Reliability concerns (search results vary)

The system was designed for fast, contained evaluation. Web search was likely deferred as a "nice to have."

### Complexity Assessment

**Fix Difficulty**: Medium-High

- Need to determine which criteria benefit from search
- Design search strategy (what queries, how many per criterion)
- Handle search failures gracefully
- Cache results to avoid redundant searches
- Budget impact (each search = cost)

---

## Additional Gaps Discovered

### Gap 4: Duplicate Formatting Logic

`evaluator.ts` and `specialized-evaluators.ts` both have profile formatting functions that diverge:

```typescript
// evaluator.ts - includes brief summary for non-fit categories
formatProfileContextForPrompt(profileContext, category);

// specialized-evaluators.ts - returns empty for non-fit
formatProfileContextForFitEvaluator(profileContext);
```

**Impact**: Inconsistent behavior between v1 (sequential) and v2 (parallel) evaluation modes.

### Gap 5: Structured Answer Mapping is Brittle

`evaluate.ts:323-463` has a massive manual mapping:

```typescript
const questionIdMapping: Record<string, (answer: string) => void> = {
  'P1_CORE': (a) => { ... },
  'P1_SCOPE': (a) => { ... },
  // ... 60+ more mappings
};
```

**Impact**:

- Adding/renaming questions requires code changes
- No validation that question IDs match
- Easy to miss mappings silently

### Gap 6: Readiness Calculation Ignores Profile Link

```typescript
// readiness.ts:305
fit: await hasLinkedProfile(ideaId) ? 1.0 : 0,
```

**Impact**: Fit coverage is binary (0% or 100%). No partial credit for partial profiles. A profile with just "name" filled counts as 100% Fit coverage.

### Gap 7: Development Session Tracking Unused

`readiness.ts` has full session tracking infrastructure:

- `startDevelopmentSession()`
- `completeDevelopmentSession()`
- `updateSessionProgress()`
- `getSessionHistory()`

But `development_sessions` table is never populated by the skill or CLI.

### Gap 8: Frontend Q&A Flow Incomplete

The server has endpoints for dynamic questioning:

```
GET /api/questions/{ideaId}
POST /api/answers
```

But the frontend components for this flow appear incomplete or unused.

---

## What Works Well

To be balanced, these aspects work correctly:

1. **Evaluation pipeline is robust** - JSON parsing, error recovery, cost tracking
2. **Debate system functions** - Red team challenges, arbiter verdicts, score adjustments
3. **Profile storage is complete** - Full FT1-FT5 data model, linking, context generation
4. **Question bank is well-designed** - Dependencies, priorities, filtering by idea type
5. **Synthesis produces useful output** - Strengths, weaknesses, recommendations

---

## Recommended Priority

1. **Fix Q&A integration (Issue 1)** - Most impactful, medium effort
2. **Expand profile usage (Issue 2)** - High impact, low effort
3. **Add web search (Issue 3)** - Medium impact, higher effort

Issues 1 and 2 should be addressed before adding more features. Issue 3 could be an optional enhancement.

---

## Assumptions Made in This Analysis

1. The skill-based development flow (`/idea-develop`) is the primary way users develop ideas
2. Users are linking profiles to ideas before evaluation
3. The v2 (parallel specialized) evaluation mode is the default
4. Web search capability is available via Claude's tools

---

## Open Questions for Clarification

See accompanying questions document for 10 clarifying questions that would refine this analysis and the implementation approach.
