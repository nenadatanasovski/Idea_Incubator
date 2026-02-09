# PHASE1-TASK-04: Complete Context Delivery to All Evaluators

**Status:** Specification
**Created:** 2026-02-08
**Priority:** P0 (Critical - Phase 1 Completion)
**Agent:** QA Agent (Validation & Verification)
**Estimated Effort:** Small (2-3 hours)
**Dependencies:** PHASE1-TASK-01 (Q&A sync), PHASE1-TASK-02 (Profile context), PHASE1-TASK-03 (Web research)

---

## Overview

**Goal:** Verify that all context sources (Q&A answers, user profiles, web research) flow correctly through the evaluation pipeline to all specialized evaluators, ensuring complete context delivery for informed decision-making.

**Context:** Phase 1 has implemented three critical fixes:
1. **TASK-01**: Markdown→Database sync for development.md Q&A answers
2. **TASK-02**: Category-relevant profile excerpts for all evaluators
3. **TASK-03**: Pre-evaluation web research phase for Market/Solution verification

This task validates that all three context sources are properly integrated into the evaluation workflow and accessible to evaluators when making assessments.

---

## Current State Analysis

### Context Flow Architecture

The evaluation pipeline (`scripts/evaluate.ts`) orchestrates context collection and delivery:

```typescript
// Context Collection (lines 221-362)
1. Load idea content from README.md
2. Append development.md Q&A if exists (lines 223-231) ✅
3. Fetch user profile context (lines 236-250) ✅
4. Fetch structured answers from database (lines 252-263) ✅
5. Conduct pre-evaluation research (lines 295-362) ✅

// Context Delivery (lines 564-595)
Parallel Evaluators (v2 mode):
  runAllSpecializedEvaluators(
    slug, ideaId, ideaContent,
    costTracker, broadcaster,
    profileContext,      // User profile ✅
    structuredContext,   // Q&A answers ✅
    research,            // Web research ✅
    strategicContext     // Positioning data ✅
  )
```

### Specialized Evaluator Context Processing

Each evaluator (`agents/specialized-evaluators.ts`) receives and formats context:

```typescript
// Line 325-369: runSpecializedEvaluator function signature includes:
async function runSpecializedEvaluator(
  category: Category,
  ideaContent: string,              // ✅ Includes development.md
  costTracker: CostTracker,
  broadcaster?: Broadcaster,
  _roundNumber?: number,
  profileContext?: ProfileContext,   // ✅ Passed
  structuredContext?: StructuredEvaluationContext, // ✅ Passed
  research?: ResearchResult,         // ✅ Passed
  strategicContext?: StrategicPositioningContext  // ✅ Passed
)

// Context Formatting (lines 350-369):
const profileSection = formatProfileForCategory(profileContext, category);
const structuredSection = formatStructuredDataForPrompt(structuredContext, category);
const researchSection = formatResearchForCategory(research, category);
const strategicSection = formatStrategicContextForPrompt(strategicContext, category);

// Prompt Assembly (lines 396-411):
userContent = `
${researchSection}        // Web research (if applicable)
${structuredSection}       // Q&A answers (if exist)
${strategicSection}        // Strategic positioning
## Idea Content
${ideaContent}            // README.md + development.md
${profileSection}          // User profile excerpt
## Criteria to Evaluate
${criteriaPrompt}
`
```

### Context Filtering by Category

Each formatter applies category-specific filtering:

| Context Type | Formatter | Categories Served | Implementation |
|--------------|-----------|-------------------|----------------|
| **Profile** | `formatProfileForCategory` | Feasibility, Market, Risk, Fit | `utils/profile-context.ts:28-95` |
| **Q&A Answers** | `formatStructuredDataForPrompt` | All 6 categories | `agents/evaluator.ts:265-460` |
| **Web Research** | `formatResearchForCategory` | Market, Solution | `agents/research.ts:483-600` |
| **Strategic** | `formatStrategicContextForPrompt` | Solution, Market, Risk, Feasibility | `agents/specialized-evaluators.ts:262-320` |

### Context Coverage by Evaluator

| Evaluator | Profile Context | Q&A Answers | Web Research | Strategic Context |
|-----------|----------------|-------------|--------------|-------------------|
| **Problem** | ❌ (not relevant) | ✅ Problem answers | ❌ (not relevant) | ❌ (not relevant) |
| **Solution** | ❌ (not relevant) | ✅ Solution answers | ✅ Tech feasibility, competitors | ✅ Strategic approach |
| **Feasibility** | ✅ Skills, time, gaps | ✅ Feasibility answers | ❌ (not relevant) | ✅ Resource allocation |
| **Fit** | ✅ Full profile (5 sections) | ✅ Fit answers | ❌ (not relevant) | ❌ (not relevant) |
| **Market** | ✅ Network, connections | ✅ Market answers | ✅ Market size, trends, competitors | ✅ Timing, differentiation |
| **Risk** | ✅ Runway, tolerance | ✅ Risk answers | ❌ (not relevant) | ✅ Risk responses |

---

## Requirements

### Functional Requirements

**FR-1: Q&A Context Delivery**
- Q&A answers from `development.md` MUST be loaded into database via sync process
- Structured context MUST be fetched from database and passed to evaluators
- Category-specific Q&A sections MUST appear in evaluator prompts
- Evaluators MUST reference Q&A data in their reasoning when available

**FR-2: Profile Context Delivery**
- User profile MUST be fetched if linked to idea
- Profile excerpts MUST be filtered per category (Feasibility, Market, Risk, Fit)
- Full profile MUST be provided to Fit evaluator
- Evaluators MUST adjust confidence based on profile availability

**FR-3: Web Research Context Delivery**
- Research phase MUST run before evaluation (unless web search unavailable)
- Research results MUST be formatted for Market and Solution categories
- Geographic analysis MUST be included when creator location is available
- Evaluators MUST cite research sources in their assessments

**FR-4: Strategic Context Delivery**
- Strategic positioning MUST be loaded from database if Position phase was completed
- Strategic context MUST be provided to Solution, Market, Risk, and Feasibility evaluators
- Evaluators MUST consider strategic decisions when scoring criteria

### Non-Functional Requirements

**NFR-1: Performance**
- Context collection MUST complete within 30 seconds
- Research phase MUST respect budget constraints
- Database queries MUST use batch loading (no N+1 queries)

**NFR-2: Reliability**
- Missing context MUST NOT cause evaluation failure
- Graceful degradation: evaluators continue with reduced confidence if context is partial
- Error handling for failed research or profile lookups

**NFR-3: Observability**
- Log context loading success/failure for each source
- Track which evaluators received which context types
- Record confidence adjustments due to missing context

---

## Technical Design

### Validation Approach

This is a **verification task** - no code changes required. Validate existing implementation through:

1. **Code Review**: Confirm context flows through call chain
2. **Test Execution**: Run evaluation and verify context appears in prompts
3. **Log Analysis**: Parse evaluation logs for context delivery confirmations
4. **Database Inspection**: Verify Q&A data persists and loads correctly

### Validation Test Plan

#### Test 1: Q&A Context Flow

**Setup:**
```bash
# Create test idea with development.md
cd ideas/test-qa-flow
cat > development.md <<EOF
## Problem

### What problem does this solve?
Users waste 3+ hours per week manually reconciling data across 5 different tools.

### Who experiences this problem?
Small business owners (10-50 employees) managing operations, finance, and sales.

## Solution

### How does your solution work?
Automated data pipeline with bi-directional sync and conflict resolution.
EOF

# Sync to database
npm run sync

# Evaluate
npm run evaluate test-qa-flow -- --verbose
```

**Expected Result:**
- Sync log shows: "Loaded development.md - Q&A context included in evaluation"
- Problem evaluator receives: "**Core Problem:** Users waste 3+ hours per week..."
- Solution evaluator receives: "**Solution Description:** Automated data pipeline..."
- All Q&A fields appear in structured context sections

**Pass Criteria:**
✅ `getStructuredContext()` returns non-null with Q&A answers
✅ Evaluator logs show "Structured Answers (High Confidence Data)"
✅ Evaluation reasoning cites specific Q&A content
✅ Coverage percentage > 0% for categories with answered questions

---

#### Test 2: Profile Context Flow

**Setup:**
```bash
# Create test profile
npm run profile create test-user
# ... answer profile questions ...

# Link profile to idea
npm run profile link test-qa-flow test-user

# Evaluate
npm run evaluate test-qa-flow -- --verbose
```

**Expected Result:**
- Evaluation log shows: "Found user profile - Personal Fit criteria will be evaluated with full context"
- Feasibility evaluator receives: "## Creator Capabilities (for Feasibility Assessment)"
- Market evaluator receives: "## Creator Network (for Market Assessment)"
- Risk evaluator receives: "## Creator Risk Profile (for Risk Assessment)"
- Fit evaluator receives: "## Creator Profile (REQUIRED for Personal Fit Evaluation)"
- Problem/Solution evaluators do NOT receive profile context

**Pass Criteria:**
✅ `getEvaluationProfileContext()` returns non-null ProfileContext
✅ Feasibility evaluator shows skills/time context
✅ Market evaluator shows network context
✅ Risk evaluator shows runway/tolerance context
✅ Fit evaluator shows all 5 profile sections
✅ Evaluators cite profile data in reasoning

---

#### Test 3: Web Research Flow

**Setup:**
```bash
# Create test idea with verifiable claims
cd ideas/test-research-flow
cat > README.md <<EOF
# AI-Powered Code Review Tool

## Problem
Developers spend 30% of their time in code reviews, slowing down delivery.

## Solution
Automated code review using GPT-4 to catch bugs, style issues, and security vulnerabilities.

## Market
- TAM: $5B code quality tools market
- Competitors: GitHub Copilot, SonarQube, CodeClimate
- Tech: OpenAI GPT-4 API, AST parsing
EOF

# Evaluate (research phase will run)
npm run evaluate test-research-flow -- --verbose
```

**Expected Result:**
- Log shows: "--- Starting Research Phase ---"
- Log shows: "Extracted claims: domain=\"code review\", 3 competitors, tech: OpenAI GPT-4 API, AST parsing"
- Log shows: "Research found X additional competitors"
- Log shows: "Market size verified: ..."
- Market evaluator receives: "## External Research Findings (Web-Verified Data)"
- Solution evaluator receives: "## Technology Feasibility (Web-Verified)"
- Evaluation reasoning cites research sources

**Pass Criteria:**
✅ `conductPreEvaluationResearch()` executes and returns ResearchResult
✅ Market evaluator shows market size, competitors, trends
✅ Solution evaluator shows tech feasibility examples
✅ Research sources appear as URLs in formatted context
✅ Evaluators cite research findings in reasoning

---

#### Test 4: Complete Context Integration

**Setup:**
```bash
# Use idea with ALL context sources
npm run evaluate fully-developed-idea -- --verbose
# (Idea must have: development.md + linked profile + verifiable claims)
```

**Expected Result:**
- All 4 context sources load successfully
- Each evaluator receives category-appropriate context
- Evaluation scores are confident (avg confidence > 0.7)
- Reasoning cites multiple context sources

**Pass Criteria:**
✅ Logs confirm: Q&A loaded, profile linked, research completed, strategic context loaded
✅ Evaluators show multiple context sections in prompts
✅ Reasoning references Q&A answers, profile data, and research findings
✅ Confidence scores reflect data completeness (0.7-0.9 range)
✅ No "missing information" gaps in well-covered categories

---

#### Test 5: Graceful Degradation

**Setup:**
```bash
# Evaluate idea with minimal context
cd ideas/minimal-idea
cat > README.md <<EOF
# Simple Idea
A tool for managing tasks.
EOF

npm run evaluate minimal-idea -- --verbose
```

**Expected Result:**
- Evaluation proceeds despite missing Q&A, profile, and limited research
- Logs show: "No structured answers available", "No user profile linked"
- Evaluators note missing information in gaps
- Confidence scores are lower (0.4-0.6 range)
- No crashes or evaluation failures

**Pass Criteria:**
✅ Evaluation completes successfully
✅ Evaluators note "low confidence" due to missing context
✅ Gaps identified: "Missing Q&A answers", "No profile linked"
✅ Recommendations suggest: "Develop the idea with /idea-develop"

---

### Database Verification Queries

```sql
-- Verify Q&A answers are stored
SELECT q.id, q.category, qa.answer, qa.confidence
FROM questions q
JOIN question_answers qa ON q.id = qa.question_id
WHERE qa.idea_id = '<test-idea-id>'
ORDER BY q.category, q.id;

-- Verify profile is linked
SELECT p.id, p.name, ip.created_at
FROM profiles p
JOIN idea_profiles ip ON p.id = ip.profile_id
WHERE ip.idea_id = '<test-idea-id>';

-- Verify research was conducted
SELECT created_at, searchesPerformed, marketSize, competitors
FROM research_results
WHERE idea_id = '<test-idea-id>'
ORDER BY created_at DESC LIMIT 1;

-- Verify strategic context exists
SELECT primary_strategy_name, timing_decision, allocated_budget
FROM positioning_decisions
WHERE idea_id = '<test-idea-id>'
ORDER BY created_at DESC LIMIT 1;
```

---

## Pass Criteria

### Critical Success Factors

**✅ PASS-1: Q&A Data Flow**
- Q&A answers from development.md are synced to database
- Structured context is fetched and passed to evaluators
- Evaluators receive category-specific Q&A sections
- Reasoning cites Q&A content when available

**✅ PASS-2: Profile Context Flow**
- User profiles are fetched when linked to ideas
- Profile excerpts are filtered per category
- Fit evaluator receives full profile (5 sections)
- Other evaluators receive category-relevant excerpts only

**✅ PASS-3: Web Research Flow**
- Research phase executes before evaluation
- Market evaluator receives market size, competitors, trends
- Solution evaluator receives tech feasibility findings
- Research sources (URLs) are attributed in context

**✅ PASS-4: Strategic Context Flow**
- Strategic positioning is loaded from database
- Solution/Market/Risk/Feasibility evaluators receive strategic context
- Evaluators consider strategic decisions in scoring

**✅ PASS-5: Complete Integration**
- All 5 validation tests pass
- Evaluation logs confirm context delivery for all sources
- Evaluators reference multiple context types in reasoning
- Confidence scores reflect data completeness

**✅ PASS-6: Graceful Degradation**
- Evaluations complete even with missing context
- Evaluators note missing information in gaps
- Confidence scores adjust downward appropriately
- No crashes or failures due to absent context

### Quality Metrics

- **Context Delivery Rate**: 100% (all available context sources reach evaluators)
- **Citation Rate**: 80%+ of evaluations cite specific context sources
- **Confidence Delta**: Ideas with full context score 0.3-0.4 higher confidence than minimal ideas
- **Error Rate**: 0% evaluation failures due to context loading issues

---

## Validation Execution Plan

### Phase 1: Code Review (30 min)
1. Trace context flow from evaluate.ts → specialized-evaluators.ts
2. Verify all formatters are called correctly
3. Check prompt assembly includes all context sections
4. Review error handling for missing context

### Phase 2: Test Execution (60 min)
1. Run Test 1: Q&A Context Flow
2. Run Test 2: Profile Context Flow
3. Run Test 3: Web Research Flow
4. Run Test 4: Complete Context Integration
5. Run Test 5: Graceful Degradation

### Phase 3: Log Analysis (30 min)
1. Parse evaluation logs for context delivery confirmations
2. Extract evaluator prompts to verify context presence
3. Review reasoning to confirm context citations
4. Check confidence scores vs. data completeness correlation

### Phase 4: Database Inspection (15 min)
1. Run verification queries to confirm data persistence
2. Check Q&A answers are stored correctly
3. Verify profile links are active
4. Confirm research results are saved

### Phase 5: Report Generation (15 min)
1. Document test results (pass/fail for each criterion)
2. Identify any gaps or issues found
3. Provide recommendations for improvements
4. Update STRATEGIC_PLAN.md with Phase 1 completion status

---

## Dependencies

### Prerequisites
- ✅ PHASE1-TASK-01: Q&A sync from development.md → database
- ✅ PHASE1-TASK-02: Profile context formatting for all categories
- ✅ PHASE1-TASK-03: Pre-evaluation web research phase

### Database Schema
- `question_answers` table (for Q&A storage)
- `profiles` table (for user profiles)
- `idea_profiles` table (for profile linking)
- `research_results` table (for web research)
- `positioning_decisions` table (for strategic context)

### External Services
- Anthropic Claude API (for evaluations)
- Web search API (for research phase)

---

## Success Metrics

### Before Validation
- **Context Delivery**: Unknown - no explicit validation
- **Evaluator Quality**: Suspected 2.3/10 (Phase 1 goal was 8/10)
- **Confidence**: Low - evaluators lacked data

### After Validation (Expected)
- **Context Delivery**: 100% - all sources reach appropriate evaluators
- **Evaluator Quality**: 8/10 - evidence-based assessments with citations
- **Confidence**: High - 0.7-0.9 confidence for ideas with complete context

### Long-term Impact
- **User Trust**: Higher confidence in evaluation results
- **Idea Quality**: Better insights lead to better decisions
- **System Reliability**: Validation confirms Phase 1 goals achieved

---

## Rollback Plan

**Not Applicable** - This is a validation task with no code changes. If validation fails, TASK-01/02/03 implementations need fixes, not rollback.

---

## Future Enhancements

### Post-Phase 1 Improvements
1. **Context Dashboard**: UI showing which context sources are available per idea
2. **Coverage Metrics**: Real-time tracking of Q&A completeness by category
3. **Research Quality Scoring**: Rate research findings by source credibility
4. **Context Recommendations**: Suggest specific Q&A questions to improve coverage

### Phase 2+ Features
1. **Adaptive Questioning**: Generate follow-up questions based on evaluation gaps
2. **Multi-source Research**: Combine web search with academic papers, patents
3. **Profile Evolution**: Track how profile data improves evaluation accuracy over time
4. **Context Caching**: Store formatted context to reduce redundant processing

---

## References

### Related Specifications
- `docs/specs/PHASE1-TASK-01-markdown-qa-sync.md` - Q&A sync specification
- `docs/specs/PHASE1-TASK-02-profile-context.md` - Profile context specification (if exists)
- `docs/specs/PHASE1-TASK-03-web-research-phase.md` - Web research specification

### Implementation Files
- `scripts/evaluate.ts` - Main evaluation orchestration
- `agents/specialized-evaluators.ts` - Specialized evaluator logic
- `utils/profile-context.ts` - Profile formatting
- `agents/research.ts` - Research agent and formatting
- `agents/evaluator.ts` - Structured data formatting

### Test Files
- `tests/ideation/web-search.test.ts` - Web search tests
- `tests/puppeteer/test-fixes.ts` - Context delivery tests
- `tests/e2e/ralph_loop.py` - End-to-end evaluation flow

---

## Appendix: Example Logs

### Successful Context Delivery Log

```
[INFO] Starting evaluation for: test-complete-context
[INFO] Found: "Complete Context Test" (EVALUATE)
[INFO] Loaded development.md - Q&A context included in evaluation
[INFO] Found user profile - Personal Fit criteria will be evaluated with full context
[INFO] Found structured answers - Coverage: 87%
[INFO] --- Starting Research Phase ---
[INFO] Creator location: Melbourne, Australia
[INFO] Extracted claims: domain="task management", 4 competitors, tech: React, Node.js
[INFO] Research found 2 additional competitors
[INFO] Market size verified: $4.5B global task management market
[INFO] Tech feasibility: proven
[INFO] Local market (Australia): TAM $180M
[INFO] Global market: TAM $4.5B
[INFO] Research phase completed (6 searches)
[INFO] Loaded Position phase context - Strategy: Create, Budget: $10,000

--- Starting Evaluation (Parallel Specialists) ---

[DEBUG] Running specialized evaluator: Problem Expert
[DEBUG] Problem Expert context: Q&A answers (87% coverage), 1,234 tokens
[DEBUG] Running specialized evaluator: Solution Architect
[DEBUG] Solution Architect context: Q&A answers, Web research (tech feasibility), Strategic positioning, 2,156 tokens
[DEBUG] Running specialized evaluator: Feasibility Analyst
[DEBUG] Feasibility Analyst context: Q&A answers, Profile (skills/time), Strategic positioning, 1,890 tokens
[DEBUG] Running specialized evaluator: Market Analyst
[DEBUG] Market Analyst context: Q&A answers, Profile (network), Web research (market size/competitors), Strategic positioning, 2,678 tokens
[DEBUG] Running specialized evaluator: Risk Analyst
[DEBUG] Risk Analyst context: Q&A answers, Profile (runway/tolerance), Strategic positioning, 1,654 tokens
[DEBUG] Running specialized evaluator: Strategic Fit Analyst
[DEBUG] Strategic Fit Analyst context: Q&A answers, Profile (full - 5 sections), 2,234 tokens

[INFO] Parallel evaluation complete for test-complete-context: Overall score 7.8
```

### Missing Context Log (Graceful Degradation)

```
[INFO] Starting evaluation for: minimal-idea
[INFO] Found: "Minimal Idea" (SPARK)
[WARN] No user profile linked - Personal Fit scores will have low confidence
[INFO] Link a profile with: npm run profile link minimal-idea <profile-slug>
[INFO] No structured answers available - evaluation will rely on idea content
[INFO] Develop the idea with: /idea-develop minimal-idea
[INFO] Skipping research phase (insufficient verifiable claims)

--- Starting Evaluation (Parallel Specialists) ---

[DEBUG] Running specialized evaluator: Problem Expert
[DEBUG] Problem Expert context: Idea content only (low confidence expected), 456 tokens
[WARN] Problem Expert: Low confidence (0.4) - missing Q&A answers
[DEBUG] Running specialized evaluator: Fit Analyst
[DEBUG] Fit Analyst context: Idea content only (no profile), 398 tokens
[WARN] Strategic Fit Analyst: Low confidence (0.3) - no user profile available

[INFO] Parallel evaluation complete for minimal-idea: Overall score 4.2 (low confidence)
```

---

**END OF SPECIFICATION**
