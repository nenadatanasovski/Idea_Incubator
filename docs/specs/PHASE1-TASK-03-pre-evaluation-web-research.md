# PHASE1-TASK-03: Pre-Evaluation Web Research Phase

**Status:** ✅ COMPLETED (Documentation of existing implementation)
**Created:** 2026-02-08
**Agent:** Spec Agent
**Priority:** P0 (Phase 1 Critical Path)
**Estimated Effort:** N/A (Already Implemented)
**Phase:** Phase 1 - Idea Incubator Finalization

---

## Executive Summary

PHASE1-TASK-03 delivers a **pre-evaluation web research phase** that runs before specialized evaluators analyze ideas. This ensures Market and Solution evaluators receive external market intelligence, competitor data, technology feasibility assessments, and geographic market analysis—preventing evaluations from relying solely on user-provided claims.

**Implementation Status:** ✅ FULLY IMPLEMENTED

The research agent (`agents/research.ts`) uses Claude's native WebSearch tool to verify market size claims, discover competitors, assess technology feasibility, and perform local vs. global market analysis. Research results are formatted and injected into Market and Solution evaluator prompts via `formatResearchForCategory()`.

**Key Achievement:** Evaluations now include evidence-based external validation instead of accepting user claims at face value.

---

## Overview

### Problem Statement

**Before This Feature:**

- Evaluators relied entirely on user-provided claims with no external verification
- Market size claims went unchallenged (e.g., user claims "$10B TAM" with no validation)
- Competitor analysis missed major players not mentioned by the user
- Technology feasibility assessments were speculative without production examples
- No consideration for geographic context (local vs. global market differences)

**Risk:** Evaluations produced inflated scores based on unverified assumptions, leading to false confidence in weak ideas.

### Solution Overview

The pre-evaluation research phase runs **before** specialized evaluators execute, conducting web searches to:

1. **Verify Market Claims** - Validate user-provided market size with current industry data
2. **Discover Competitors** - Find additional competitors beyond those mentioned by user
3. **Assess Market Trends** - Determine if market is growing, stable, or declining
4. **Evaluate Tech Feasibility** - Confirm if proposed technology has production examples
5. **Analyze Geographic Context** - Compare local (creator's region) vs. global market opportunities

Research results are then formatted and injected into the appropriate evaluator prompts:

- **Market Evaluator** receives: market size verification, competitor lists, trends, geographic analysis
- **Solution Evaluator** receives: technology feasibility assessment with production examples

---

## Requirements

### Functional Requirements

**FR1: Claims Extraction from Idea Content** ✅ IMPLEMENTED

- Extract verifiable claims from idea README.md content
- Identify: domain, technology stack, competitors mentioned, market size claims, target market
- Use LLM-based extraction (Haiku) with manual fallback for CLI mode
- **Implementation:** `utils/claims-extractor.ts` - `extractClaimsFromContent()`

**FR2: Search Query Generation** ✅ IMPLEMENTED

- Build targeted search queries based on extracted claims
- Generate queries for: market size, competitors, trends, technology feasibility
- Include geographic-specific queries when creator location is known
- **Implementation:** `utils/claims-extractor.ts` - `buildSearchQueries()`

**FR3: Web Search Execution via Claude Native Tool** ✅ IMPLEMENTED

- Use Claude Code's native WebSearch tool (not external APIs)
- Execute searches via `runClaudeCliWithPrompt()` with Opus 4.6 model
- Support both local (creator's region) and global market research
- Track cost via `CostTracker` for research operations
- **Implementation:** `agents/research.ts` - `conductResearchViaCli()`

**FR4: Geographic Market Analysis** ✅ IMPLEMENTED

- Extract creator location from user profile (country + optional city)
- Conduct separate research for LOCAL market vs. GLOBAL market
- Compare TAM/SAM/SOM, competitors, entry barriers, timing between regions
- Provide strategic guidance on "start local vs. go global"
- **Implementation:** `agents/research.ts` - `GeographicMarketData` interface + geographic analysis logic

**FR5: Structured Research Result Storage** ✅ IMPLEMENTED

- Return typed `ResearchResult` with market, competitor, trend, tech feasibility data
- Include geographic breakdown (`localMarket`, `globalMarket`, `creatorLocation`)
- Preserve source URLs for all findings to enable evaluator verification
- **Implementation:** `agents/research.ts` - `ResearchResult` interface

**FR6: Category-Specific Research Formatting** ✅ IMPLEMENTED

- Format research results differently for Market vs. Solution evaluators
- Market: Include full geographic analysis, competitor intensity, entry barriers
- Solution: Include only technology feasibility with production examples
- Other categories: Receive empty string (research not relevant)
- **Implementation:** `agents/research.ts` - `formatResearchForCategory()`

**FR7: Integration with Evaluation Pipeline** ✅ IMPLEMENTED

- Run research phase after profile context loading, before evaluator execution
- Pass research results to `runAllSpecializedEvaluators()` for distribution
- Log research findings (market size, competitors discovered, tech feasibility)
- Handle research failures gracefully (proceed with evaluation using null research)
- **Implementation:** `scripts/evaluate.ts` lines 295-362

**FR8: Research Phase Skipping Logic** ✅ IMPLEMENTED

- Check if research should be skipped (now always returns `false`)
- Support both API and CLI modes (research works in both)
- **Implementation:** `agents/research.ts` - `shouldSkipResearch()`

### Non-Functional Requirements

**NFR1: Cost Management** ✅ IMPLEMENTED

- Research phase costs ~$0.50-1.50 per evaluation (Opus 4.6 for web search)
- Budget increased from $10 to $15 to accommodate research phase
- Track research costs separately via `CostTracker` with operation name `research-websearch-cli`

**NFR2: Performance** ✅ IMPLEMENTED

- Research completes in 30-60 seconds (depends on query count)
- Log search progress: "Research phase completed (N searches)"
- Non-blocking: research failure does not block evaluation

**NFR3: Reliability** ✅ IMPLEMENTED

- Graceful degradation: if research fails, proceed with null research
- JSON parsing with fallback to empty result
- Error logging via `logWarning()` for debugging

**NFR4: Source Attribution** ✅ IMPLEMENTED

- All research findings include source URLs
- Evaluators instructed to cite sources in reasoning
- Traceability for market size claims and competitor discoveries

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Evaluation Pipeline                       │
│                   (scripts/evaluate.ts)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─ 1. Load Idea Content
                            │    └─ README.md + development.md
                            │
                            ├─ 2. Load Profile Context
                            │    └─ getEvaluationProfileContext()
                            │
                            ├─ 3. Extract Claims
                            │    └─ extractClaimsFromContent()
                            │       (domain, tech, competitors, market size)
                            │
                            ├─ 4. PRE-EVALUATION RESEARCH PHASE
                            │    └─ conductPreEvaluationResearch()
                            │       ├─ buildSearchQueries(claims)
                            │       ├─ conductResearchViaCli()
                            │       │   ├─ WebSearch for local market
                            │       │   ├─ WebSearch for global market
                            │       │   ├─ WebSearch for competitors
                            │       │   └─ WebSearch for tech feasibility
                            │       └─ return ResearchResult
                            │
                            ├─ 5. Load Positioning Context
                            │
                            └─ 6. Run Specialized Evaluators
                                 └─ runAllSpecializedEvaluators(
                                      ideaContent,
                                      structuredContext,
                                      profileContext,
                                      research ← INJECTED HERE
                                    )
                                    ├─ Problem Evaluator (no research)
                                    ├─ Solution Evaluator (tech feasibility)
                                    ├─ Market Evaluator (full geographic analysis)
                                    ├─ Feasibility Evaluator (no research)
                                    ├─ Risk Evaluator (no research)
                                    └─ Fit Evaluator (no research)
```

### Key Components

#### 1. Claims Extractor (`utils/claims-extractor.ts`)

**Purpose:** Extract verifiable claims from idea content for research targeting

**Interfaces:**

```typescript
export interface ExtractedClaims {
  domain: string; // "plant care", "fintech", "healthcare SaaS"
  technology: string[]; // ["AI", "React Native", "computer vision"]
  competitors: string[]; // Competitors mentioned by user
  marketSize: string | null; // "$50B TAM" or null
  targetMarket: string; // "small business owners", "home gardeners"
  keyAssumptions: string[]; // ["users willing to pay $10/mo"]
}
```

**Functions:**

- `extractClaimsFromContent(content, costTracker)` - LLM-based extraction (Haiku 3.5)
- `extractClaimsManually(content)` - Pattern-matching fallback for CLI mode
- `buildSearchQueries(claims)` - Generate targeted search queries

**Implementation Notes:**

- Uses Haiku 3.5 for cost efficiency ($0.10 per extraction)
- Falls back to manual extraction in CLI mode to avoid unexpected costs
- Manual extraction uses regex patterns for common tech terms, market size formats

#### 2. Research Agent (`agents/research.ts`)

**Purpose:** Conduct pre-evaluation web research using Claude's native WebSearch tool

**Core Function:**

```typescript
export async function conductPreEvaluationResearch(
  _ideaContent: string, // Reserved for future use
  claims: ExtractedClaims,
  costTracker: CostTracker,
  creatorLocation?: CreatorLocation, // Optional geographic context
): Promise<ResearchResult>;
```

**Research Process:**

1. Build search queries from claims
2. Check if research should be skipped (always false now)
3. Execute `conductResearchViaCli()`:
   - Build multi-query prompt with local + global sections
   - Call `runClaudeCliWithPrompt()` with WebSearch tool enabled
   - Use Opus 4.6 model (best web search capabilities)
   - Request structured JSON response
4. Parse JSON response (market size, competitors, trends, tech, geographic data)
5. Return `ResearchResult` with source attribution

**Geographic Analysis:**

- If creator location provided:
  - Research LOCAL market: TAM/SAM/SOM, competitors, barriers, timing
  - Research GLOBAL market: Same metrics worldwide
  - Compare and contrast in formatted output
- If no location:
  - Focus on global market data only

**Key Interfaces:**

- `GeographicMarketData` - Local/global market breakdown
- `ResearchResult` - Complete research findings with sources
- `CreatorLocation` - Country + optional city

#### 3. Research Formatting (`agents/research.ts`)

**Function:**

```typescript
export function formatResearchForCategory(
  research: ResearchResult | null,
  category: string,
): string;
```

**Output by Category:**

- **Market:** Full geographic analysis, competitor discovery, market trends
- **Solution:** Technology feasibility with production examples
- **Other categories:** Empty string (not relevant)

#### 4. Evaluation Script Integration (`scripts/evaluate.ts`)

**Integration Point:** Lines 295-362

Research phase runs after profile context loading but before evaluators execute. Results passed to `runAllSpecializedEvaluators()` and distributed to category-specific evaluators.

---

## Pass Criteria

### Primary Success Criteria

**PC1: Research Phase Executes Before Evaluators** ✅ PASS

- Research phase runs after profile context loading, before evaluator execution
- Logged as: "--- Starting Research Phase ---"
- Test: `npm run evaluate <slug>` shows research phase logs

**PC2: Claims Extraction Works** ✅ PASS

- Claims extracted from README.md content
- Domain, technology, competitors, market size, target market identified
- Test: Logs show "Extracted claims: domain=\"X\", N competitors, tech: Y"

**PC3: Web Search Executes via Claude Native Tool** ✅ PASS

- Uses `runClaudeCliWithPrompt()` with WebSearch tool enabled
- Opus 4.6 model for best search quality
- Test: Search completes within 60 seconds

**PC4: Research Results Structured Correctly** ✅ PASS

- Returns `ResearchResult` with all required fields
- Includes source URLs for all findings
- Geographic analysis present when creator location provided

**PC5: Market Evaluator Receives Full Research Context** ✅ PASS

- Market evaluator prompt includes market size verification
- Competitor discoveries listed
- Geographic analysis with local vs. global breakdown

**PC6: Solution Evaluator Receives Tech Feasibility** ✅ PASS

- Solution evaluator prompt includes tech feasibility assessment
- Production examples listed

**PC7: Geographic Analysis When Location Available** ✅ PASS

- If creator location in profile, both local and global markets researched
- TAM/SAM/SOM for local market
- Competitor intensity comparison
- Entry barriers specific to region

**PC8: Graceful Degradation on Research Failure** ✅ PASS

- If research fails, evaluation proceeds with `research = null`
- Warning logged but evaluation continues

**PC9: Cost Tracking for Research** ✅ PASS

- Research costs tracked separately via `CostTracker`
- Operation name: `research-websearch-cli`
- Budget increased from $10 to $15 to accommodate research

**PC10: Research Phase Logged and Visible** ✅ PASS

- Research findings logged for user visibility
- Shows: competitors found, market size verified, tech feasibility, local/global TAM

---

## Dependencies

### Internal Dependencies

1. **Claims Extractor** (`utils/claims-extractor.ts`) ✅
2. **Anthropic Client** (`utils/anthropic-client.ts`) ✅
3. **Cost Tracker** (`utils/cost-tracker.ts`) ✅
4. **Specialized Evaluators** (`agents/specialized-evaluators.ts`) ✅
5. **Profile Context** (`scripts/profile.ts`) ✅
6. **Evaluation Script** (`scripts/evaluate.ts`) ✅

### External Dependencies

1. **Claude Code WebSearch Tool** ✅ Available
2. **Opus 4.6 Model** ✅ Available

---

## Testing Strategy

### Unit Tests

**UT1: Web Search Service** ✅ EXISTS

- Test file: `tests/ideation/web-search.test.ts`
- Coverage: Search strategy, query building, result parsing, analysis

### Integration Tests

**IT1: End-to-End Evaluation with Research** ✅ EXISTS (Manual)

- Command: `npm run evaluate e2e-test-smart-wellness-tracker`
- Validates: Research phase executes and results appear in evaluator reasoning

**IT2: Geographic Analysis with Profile** ✅ EXISTS (Manual)

- Setup: Link profile with country to idea
- Validates: Local and global market data both appear

**IT3: Research Failure Graceful Degradation** ✅ EXISTS (Manual)

- Validates: Evaluation completes with warning when research fails

---

## Implementation Notes

### Design Decisions

**Decision 1: Use Claude's Native WebSearch Instead of External APIs**

- **Rationale:** Reliable, well-maintained, no API key management needed
- **Trade-offs:** Tied to Claude Code environment, but worth it for simplicity

**Decision 2: Always Run Research Phase (No Skipping)**

- **Rationale:** Research improves evaluation quality; cost is acceptable
- **Trade-offs:** Slightly higher cost, but significantly better accuracy

**Decision 3: Use Opus 4.6 for Research**

- **Rationale:** Best web search quality and synthesis capabilities
- **Trade-offs:** Higher cost but worth it for accuracy

**Decision 4: Geographic Analysis Optional**

- **Rationale:** Only perform when creator location is available
- **Trade-offs:** Richer analysis when available, but works globally without it

**Decision 5: Research Failure Does Not Block Evaluation**

- **Rationale:** Evaluations should proceed even if external data unavailable
- **Trade-offs:** May be lower quality without research, but still useful

---

## Related Work

### Completed Dependencies

1. **PHASE1-TASK-01: Markdown→Database Sync for Q&A** ✅
   - Ensures evaluators receive Q&A answers from development.md

2. **PHASE1-TASK-02: Profile Context Formatting** ✅
   - Ensures evaluators receive category-relevant profile excerpts
   - Works alongside research (profile = internal, research = external)

### Future Enhancements

1. **Research Result Caching** - Cache for 7 days to avoid re-searching
2. **Expansion Market Suggestions** - Suggest 3-5 expansion markets
3. **Competitor Deep Dive** - Fetch funding, team size, features per competitor
4. **Historical Market Data** - Track market size over time, calculate real CAGR

---

## Conclusion

PHASE1-TASK-03 is **fully implemented and operational**. The pre-evaluation research phase successfully:

✅ Extracts claims from idea content
✅ Conducts web searches via Claude's native WebSearch tool
✅ Verifies market size claims with current data
✅ Discovers competitors not mentioned by user
✅ Assesses technology feasibility with production examples
✅ Performs local vs. global market analysis when creator location available
✅ Formats research for category-specific evaluator prompts
✅ Integrates seamlessly into evaluation pipeline
✅ Tracks costs and handles failures gracefully

**Impact:** Evaluations now include evidence-based external validation, preventing inflated scores from unverified user claims. Market and Solution evaluators reference research findings in their reasoning, citing sources for transparency.

**Strategic Plan Status:** Marked as ✅ completed in `STRATEGIC_PLAN.md` line 152.

**Next Steps:** This feature is complete. Focus shifts to Phase 2-3 deliverables (ParentHarness frontend + WebSocket + Clarification Agent).
