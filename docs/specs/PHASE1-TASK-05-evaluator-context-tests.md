# PHASE1-TASK-05: Tests Validating Evaluators Receive Complete Context

**Status:** 🔨 SPECIFICATION
**Created:** 2026-02-08
**Phase:** Phase 1 - Close Evaluation Data Flow Gaps
**Dependencies:** PHASE1-TASK-01, PHASE1-TASK-02, PHASE1-TASK-03, PHASE1-TASK-04

---

## Overview

This specification defines the test suite to validate that all specialized evaluators receive complete context from the three critical data sources integrated in Phase 1:

1. **Q&A answers** from development.md (PHASE1-TASK-01)
2. **User profile context** with category-relevant excerpts (PHASE1-TASK-02)
3. **Web research data** from pre-evaluation research phase (PHASE1-TASK-03)

The implementation in PHASE1-TASK-04 integrated these context sources. This task creates comprehensive tests to ensure the integration works correctly across all evaluator categories and edge cases.

### Problem Statement

Without comprehensive tests:
- No verification that context flows through the evaluation pipeline
- No assurance that category-specific formatting works correctly
- No validation of graceful fallback when context is missing
- Risk of regression when modifying evaluation code
- Difficulty debugging context-related issues in production

With comprehensive tests:
- Confidence that all evaluators receive appropriate context
- Early detection of context flow regressions
- Documentation of expected behavior through test cases
- Easier debugging with isolated test scenarios
- Quality assurance for evidence-based evaluations

---

## Requirements

### Functional Requirements

#### 1. Context Loading Tests

**Unit Tests:**
- ✅ Test `getStructuredContext()` returns Q&A answers organized by category
- ✅ Test `getEvaluationProfileContext()` returns profile with 5 dimensions
- ✅ Test `conductPreEvaluationResearch()` returns market and tech research
- ✅ Test all context loaders handle missing data gracefully (return null)
- ✅ Test Q&A coverage calculation is accurate

#### 2. Context Formatting Tests

**Unit Tests:**
- ✅ Test `formatProfileForCategory()` for each category (feasibility, market, risk, fit)
- ✅ Test `formatStructuredDataForPrompt()` includes only category-relevant Q&A
- ✅ Test `formatResearchForCategory()` for market and solution categories
- ✅ Test formatting functions handle null context gracefully
- ✅ Test field extraction from profile context (runway, tolerance, hours, etc.)

**Already Implemented:** `tests/unit/utils/profile-context.test.ts` ✅

#### 3. Context Integration Tests

**Integration Tests:**
- Test evaluator receives all 3 context sources when available
- Test evaluator receives partial context (e.g., Q&A only, no profile)
- Test evaluator receives no context (minimal idea with README only)
- Test context parameters passed through evaluation call chain
- Test evaluation confidence scores reflect context availability

#### 4. Category-Specific Context Tests

**Integration Tests:**
- Test Feasibility evaluator receives profile skills + time + Q&A
- Test Market evaluator receives profile network + research + Q&A
- Test Risk evaluator receives profile runway + tolerance + Q&A
- Test Fit evaluator receives full profile + Q&A
- Test Solution evaluator receives research tech feasibility + Q&A
- Test Problem evaluator receives Q&A only (no profile/research)

#### 5. Evidence-Based Reasoning Tests

**Integration Tests:**
- Test evaluation reasoning cites Q&A answers
- Test evaluation reasoning references profile data
- Test evaluation reasoning mentions research findings
- Test high confidence scores (>0.7) when complete context available
- Test lower confidence scores (<0.6) when context missing

#### 6. End-to-End Evaluation Tests

**E2E Tests:**
- Test complete evaluation flow with all context sources
- Test evaluation with development.md but no profile
- Test evaluation with profile but no development.md
- Test evaluation without web research (skip research mode)
- Test evaluation generates high-quality output with complete context

### Non-Functional Requirements

1. **Test Isolation:** Tests must not depend on external APIs or network calls
2. **Test Speed:** Unit tests should run in <100ms each, integration tests <2s each
3. **Test Reliability:** Tests must be deterministic (no flaky tests)
4. **Test Coverage:** Achieve >90% code coverage for context-related functions
5. **Test Maintainability:** Use factories/fixtures to reduce test boilerplate

---

## Technical Design

### Test File Structure

```
tests/
├── unit/
│   ├── utils/
│   │   └── profile-context.test.ts          ✅ (already exists)
│   ├── context/
│   │   ├── structured-context.test.ts       📝 (new)
│   │   ├── research-context.test.ts         📝 (new)
│   │   └── context-formatting.test.ts       📝 (new)
├── integration/
│   ├── evaluator-context-flow.test.ts       📝 (new)
│   ├── category-specific-context.test.ts    📝 (new)
│   └── evidence-based-reasoning.test.ts     📝 (new)
└── e2e/
    └── complete-evaluation-context.test.ts  📝 (new)
```

### Test Implementation Details

#### Test 1: Structured Q&A Context Tests

**File:** `tests/unit/context/structured-context.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getStructuredContext } from "../../../scripts/evaluate.js";
import { run, query } from "../../../database/index.js";
import { randomUUID } from "crypto";

describe("getStructuredContext", () => {
  let testIdeaId: string;

  beforeEach(async () => {
    // Create test idea
    testIdeaId = randomUUID();
    await run(
      `INSERT INTO ideas (id, slug, title, readme) VALUES (?, ?, ?, ?)`,
      [testIdeaId, "test-idea", "Test Idea", "# Test"],
    );
  });

  afterEach(async () => {
    // Clean up
    await run(`DELETE FROM idea_answers WHERE idea_id = ?`, [testIdeaId]);
    await run(`DELETE FROM ideas WHERE id = ?`, [testIdeaId]);
  });

  it("should return null when no answers exist", async () => {
    const context = await getStructuredContext(testIdeaId);
    expect(context).toBeNull();
  });

  it("should organize answers by category", async () => {
    // Insert test answers
    await run(
      `INSERT INTO idea_answers (idea_id, question_id, answer_text)
       VALUES (?, ?, ?)`,
      [testIdeaId, "P1_PROBLEM_STATEMENT", "Users struggle with time tracking"],
    );
    await run(
      `INSERT INTO idea_answers (idea_id, question_id, answer_text)
       VALUES (?, ?, ?)`,
      [testIdeaId, "S1_PROPOSED_SOLUTION", "AI-powered time tracker"],
    );

    const context = await getStructuredContext(testIdeaId);

    expect(context).not.toBeNull();
    expect(context!.answers.problem).toBeDefined();
    expect(context!.answers.solution).toBeDefined();
    expect(context!.answers.problem.p1_problem_statement).toBe(
      "Users struggle with time tracking",
    );
  });

  it("should calculate coverage percentage correctly", async () => {
    // Insert 3 answers out of ~30 total questions = ~10% coverage
    await run(
      `INSERT INTO idea_answers (idea_id, question_id, answer_text)
       VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
      [
        testIdeaId, "P1_PROBLEM_STATEMENT", "Problem",
        testIdeaId, "S1_PROPOSED_SOLUTION", "Solution",
        testIdeaId, "F1_MVP_SCOPE", "MVP scope",
      ],
    );

    const context = await getStructuredContext(testIdeaId);

    expect(context!.coverage.overall).toBeGreaterThan(0);
    expect(context!.coverage.overall).toBeLessThan(0.2); // < 20%
  });

  it("should handle answers with no matching question_id", async () => {
    await run(
      `INSERT INTO idea_answers (idea_id, question_id, answer_text)
       VALUES (?, ?, ?)`,
      [testIdeaId, "UNKNOWN_QUESTION", "Some answer"],
    );

    const context = await getStructuredContext(testIdeaId);

    // Should not crash, may return null or empty context
    expect(context).toBeDefined();
  });
});
```

**Pass Criteria:**
- ✅ All tests pass
- ✅ Returns null when no answers exist
- ✅ Correctly organizes answers by category
- ✅ Calculates coverage percentage accurately
- ✅ Handles edge cases gracefully

---

#### Test 2: Research Context Formatting Tests

**File:** `tests/unit/context/research-context.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { formatResearchForCategory } from "../../../agents/research.js";
import { type ResearchResult } from "../../../agents/research.js";

describe("formatResearchForCategory", () => {
  const mockResearch: ResearchResult = {
    marketSize: {
      verified: "$8.2B TAM",
      userClaim: "$10B TAM",
      sources: ["Gartner 2025", "Forrester"],
    },
    competitors: {
      discovered: ["Competitor A", "Competitor B"],
      userMentioned: ["Competitor A"],
    },
    trends: {
      direction: "growing",
      evidence: "25% CAGR in health tech",
    },
    geographicAnalysis: {
      region: "North America",
      marketSize: "$2.1B",
    },
    techFeasibility: {
      assessment: "Proven technology with production examples",
      examples: ["TensorFlow Lite", "Arduino Nano BLE"],
      sources: ["TensorFlow Docs", "Arduino"],
    },
    searchesPerformed: 4,
  };

  it("should return empty string when research is null", () => {
    const result = formatResearchForCategory(null, "market");
    expect(result).toBe("");
  });

  it("should return empty string when no searches performed", () => {
    const emptyResearch = { ...mockResearch, searchesPerformed: 0 };
    const result = formatResearchForCategory(emptyResearch, "market");
    expect(result).toBe("");
  });

  describe("market category", () => {
    it("should include verified market size", () => {
      const result = formatResearchForCategory(mockResearch, "market");

      expect(result).toContain("Verified Market Size");
      expect(result).toContain("$8.2B TAM");
    });

    it("should include user claim comparison", () => {
      const result = formatResearchForCategory(mockResearch, "market");

      expect(result).toContain("User claimed");
      expect(result).toContain("$10B TAM");
    });

    it("should include market trends", () => {
      const result = formatResearchForCategory(mockResearch, "market");

      expect(result).toContain("Market Trends");
      expect(result).toContain("growing");
      expect(result).toContain("25% CAGR");
    });

    it("should include discovered competitors", () => {
      const result = formatResearchForCategory(mockResearch, "market");

      expect(result).toContain("Discovered Competitors");
      expect(result).toContain("Competitor A");
      expect(result).toContain("Competitor B");
    });

    it("should include geographic analysis", () => {
      const result = formatResearchForCategory(mockResearch, "market");

      expect(result).toContain("Geographic Analysis");
      expect(result).toContain("North America");
      expect(result).toContain("$2.1B");
    });

    it("should include source attribution", () => {
      const result = formatResearchForCategory(mockResearch, "market");

      expect(result).toContain("Sources:");
      expect(result).toContain("Gartner 2025");
      expect(result).toContain("Forrester");
    });
  });

  describe("solution category", () => {
    it("should include tech feasibility assessment", () => {
      const result = formatResearchForCategory(mockResearch, "solution");

      expect(result).toContain("Technology Feasibility Research");
      expect(result).toContain("Proven technology");
    });

    it("should include production examples", () => {
      const result = formatResearchForCategory(mockResearch, "solution");

      expect(result).toContain("Production Examples");
      expect(result).toContain("TensorFlow Lite");
      expect(result).toContain("Arduino Nano BLE");
    });

    it("should include source attribution", () => {
      const result = formatResearchForCategory(mockResearch, "solution");

      expect(result).toContain("Sources:");
      expect(result).toContain("TensorFlow Docs");
    });
  });

  describe("other categories", () => {
    it("should return empty for problem category", () => {
      const result = formatResearchForCategory(mockResearch, "problem");
      expect(result).toBe("");
    });

    it("should return empty for feasibility category", () => {
      const result = formatResearchForCategory(mockResearch, "feasibility");
      expect(result).toBe("");
    });

    it("should return empty for risk category", () => {
      const result = formatResearchForCategory(mockResearch, "risk");
      expect(result).toBe("");
    });

    it("should return empty for fit category", () => {
      const result = formatResearchForCategory(mockResearch, "fit");
      expect(result).toBe("");
    });
  });
});
```

**Pass Criteria:**
- ✅ All tests pass
- ✅ Market category receives full market intelligence
- ✅ Solution category receives tech feasibility only
- ✅ Other categories receive no research context
- ✅ Source attribution included for verifiability

---

#### Test 3: Category-Specific Context Integration Tests

**File:** `tests/integration/category-specific-context.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runSpecializedEvaluator } from "../../../agents/specialized-evaluators.js";
import { CostTracker } from "../../../agents/cost-tracker.js";
import { run } from "../../../database/index.js";
import { randomUUID } from "crypto";
import type {
  ProfileContext,
  StructuredEvaluationContext,
  ResearchResult,
} from "../../../utils/schemas.js";

describe("Category-Specific Context Integration", () => {
  let testIdeaId: string;
  let costTracker: CostTracker;

  const mockProfile: ProfileContext = {
    goalsContext: "Goals: $100k ARR",
    passionContext: "Passion: Health tech",
    skillsContext: "Skills: React, Python. Gaps: Marketing",
    networkContext: "Network: 500+ LinkedIn",
    lifeStageContext: "Runway: 12 months. Hours: 20/week. Tolerance: Medium",
  };

  const mockStructuredContext: StructuredEvaluationContext = {
    answers: {
      problem: { p1_problem_statement: "Users struggle with time tracking" },
      solution: { s1_proposed_solution: "AI-powered tracker" },
      feasibility: { f1_mvp_scope: "8 months to MVP" },
      market: { m1_target_market: "Freelancers and consultants" },
      risk: { r1_biggest_risk: "User adoption" },
      fit: { ft1_alignment: "Aligns with passion for productivity" },
    },
    coverage: { overall: 0.87 },
  };

  const mockResearch: ResearchResult = {
    marketSize: { verified: "$8B TAM", userClaim: null, sources: ["Gartner"] },
    competitors: { discovered: ["Toggl", "Harvest"], userMentioned: [] },
    trends: { direction: "growing", evidence: "15% CAGR" },
    geographicAnalysis: { region: "Global", marketSize: "$8B" },
    techFeasibility: {
      assessment: "Proven",
      examples: ["GPT-4", "Claude"],
      sources: ["OpenAI"],
    },
    searchesPerformed: 4,
  };

  beforeEach(() => {
    testIdeaId = randomUUID();
    costTracker = new CostTracker();
  });

  describe("Feasibility evaluator", () => {
    it("should receive profile skills and time availability", async () => {
      const ideaContent = "# Time Tracker\n\nAI-powered time tracking app.";

      // Mock the evaluator to capture the prompt
      let capturedPrompt = "";
      const originalEvaluate = runSpecializedEvaluator;

      // Run evaluator with full context
      await runSpecializedEvaluator(
        "feasibility",
        ideaContent,
        costTracker,
        undefined,
        undefined,
        mockProfile,
        mockStructuredContext,
        null, // No research for feasibility
        null,
      );

      // Verify context was passed (implementation-dependent)
      // This is a placeholder - actual implementation will depend on
      // how we can capture the prompt in tests
      expect(true).toBe(true); // TODO: Implement prompt capture
    });

    it("should not receive research context", async () => {
      // Feasibility evaluator should not get research
      // This will be validated by checking the assembled prompt
      expect(true).toBe(true); // TODO: Implement verification
    });
  });

  describe("Market evaluator", () => {
    it("should receive profile network + research + Q&A", async () => {
      const ideaContent = "# Time Tracker\n\nAI-powered time tracking app.";

      await runSpecializedEvaluator(
        "market",
        ideaContent,
        costTracker,
        undefined,
        undefined,
        mockProfile,
        mockStructuredContext,
        mockResearch,
        null,
      );

      // Market evaluator should receive:
      // - Profile network context
      // - Research market data
      // - Q&A market answers
      expect(true).toBe(true); // TODO: Implement verification
    });
  });

  describe("Problem evaluator", () => {
    it("should receive Q&A only (no profile or research)", async () => {
      const ideaContent = "# Time Tracker\n\nAI-powered time tracking app.";

      await runSpecializedEvaluator(
        "problem",
        ideaContent,
        costTracker,
        undefined,
        undefined,
        mockProfile, // Passed but should not be included in prompt
        mockStructuredContext,
        mockResearch, // Passed but should not be included in prompt
        null,
      );

      // Problem evaluator should only use Q&A, not profile or research
      expect(true).toBe(true); // TODO: Implement verification
    });
  });
});
```

**Note:** These integration tests need to be enhanced with prompt capture mechanism to verify that the correct context is included in the evaluator prompts. This may require:
- Adding a test mode to evaluators that returns the assembled prompt
- Mocking the LLM API calls to capture request payloads
- Using a spy/stub pattern to intercept prompt assembly

**Pass Criteria:**
- ✅ All tests pass
- ✅ Each evaluator receives appropriate context for its category
- ✅ Evaluators do not receive irrelevant context
- ✅ Context parameters flow through call chain correctly

---

#### Test 4: Evidence-Based Reasoning Validation Tests

**File:** `tests/integration/evidence-based-reasoning.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { query, run } from "../../../database/index.js";
import { randomUUID } from "crypto";

/**
 * These tests validate that evaluations with complete context
 * produce high-confidence, evidence-based reasoning.
 *
 * NOTE: These are validation tests that check the database
 * results after a full evaluation has been run.
 */
describe("Evidence-Based Reasoning Validation", () => {
  let testIdeaId: string;

  beforeEach(async () => {
    testIdeaId = randomUUID();
  });

  afterEach(async () => {
    // Clean up test data
    await run(`DELETE FROM evaluations WHERE idea_id = ?`, [testIdeaId]);
    await run(`DELETE FROM idea_answers WHERE idea_id = ?`, [testIdeaId]);
    await run(`DELETE FROM ideas WHERE id = ?`, [testIdeaId]);
  });

  it("should produce high confidence when complete context available", async () => {
    // This test would require:
    // 1. Creating a test idea with full context (profile + Q&A + research)
    // 2. Running a full evaluation
    // 3. Checking the confidence scores in the database

    // For now, this is a placeholder for the test structure
    expect(true).toBe(true); // TODO: Implement full E2E test
  });

  it("should produce lower confidence when profile missing", async () => {
    // This test would require:
    // 1. Creating a test idea with Q&A but no profile
    // 2. Running evaluation
    // 3. Verifying confidence scores are lower (especially for Fit category)

    expect(true).toBe(true); // TODO: Implement test
  });

  it("should cite specific Q&A answers in reasoning", async () => {
    // This test would check that evaluation reasoning
    // contains references to specific Q&A answers

    expect(true).toBe(true); // TODO: Implement test
  });

  it("should reference profile data in reasoning", async () => {
    // This test would check that evaluation reasoning
    // mentions creator skills, runway, network, etc.

    expect(true).toBe(true); // TODO: Implement test
  });

  it("should mention research findings in reasoning", async () => {
    // This test would check that evaluation reasoning
    // references market size, competitors, trends, etc.

    expect(true).toBe(true); // TODO: Implement test
  });
});
```

**Note:** These tests are challenging because they require running full evaluations with LLM calls, which are:
- Expensive (API costs)
- Slow (10-30s per evaluation)
- Non-deterministic (LLM responses vary)

**Recommended Approach:**
1. **Option A (Snapshot Testing):** Run evaluations once, capture responses, use as fixtures
2. **Option B (Mock LLM):** Mock Claude API to return consistent test responses
3. **Option C (E2E Only):** Only test full flow in E2E tests with real LLM calls (limited runs)

**Pass Criteria:**
- ✅ Tests demonstrate that complete context improves evaluation quality
- ✅ Tests show confidence scores correlate with context availability
- ✅ Tests verify reasoning cites specific evidence from context sources

---

#### Test 5: End-to-End Evaluation Context Tests

**File:** `tests/e2e/complete-evaluation-context.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { query } from "../../../database/index.js";

/**
 * End-to-end tests for complete evaluation flow with context.
 *
 * These tests are EXPENSIVE and SLOW - they make real LLM API calls.
 * Mark as skip by default, run manually during validation.
 */
describe.skip("E2E: Complete Evaluation Context Flow", () => {
  it("should evaluate idea with complete context", async () => {
    // Use an existing test idea with full context
    const testSlug = "e2e-test-smart-wellness-tracker";

    // Run evaluation
    const output = execSync(`npm run evaluate ${testSlug}`, {
      encoding: "utf-8",
    });

    // Verify logs show all context sources loaded
    expect(output).toContain("Found user profile");
    expect(output).toContain("Found structured answers");
    expect(output).toContain("Research phase completed");

    // Query database for results
    const results = await query(
      `SELECT category, AVG(final_score) as avg_score, AVG(confidence) as avg_confidence
       FROM evaluations
       WHERE idea_id = (SELECT id FROM ideas WHERE slug = ?)
       GROUP BY category`,
      [testSlug],
    );

    // Verify all categories evaluated
    expect(results).toHaveLength(6);

    // Verify high confidence scores
    const avgConfidence =
      results.reduce((sum, r) => sum + r.avg_confidence, 0) / results.length;
    expect(avgConfidence).toBeGreaterThan(0.7);
  });

  it("should handle evaluation without profile gracefully", async () => {
    const testSlug = "test-idea-no-profile";

    const output = execSync(`npm run evaluate ${testSlug}`, {
      encoding: "utf-8",
    });

    // Should warn about missing profile
    expect(output).toContain("No user profile available");

    // Should still complete evaluation
    const results = await query(
      `SELECT COUNT(*) as count FROM evaluations
       WHERE idea_id = (SELECT id FROM ideas WHERE slug = ?)`,
      [testSlug],
    );
    expect(results[0].count).toBeGreaterThan(0);
  });

  it("should handle evaluation without Q&A gracefully", async () => {
    const testSlug = "test-idea-no-qa";

    const output = execSync(`npm run evaluate ${testSlug}`, {
      encoding: "utf-8",
    });

    // Should proceed with README only
    expect(output).not.toContain("error");

    // Should complete evaluation with lower confidence
    const results = await query(
      `SELECT AVG(confidence) as avg_confidence FROM evaluations
       WHERE idea_id = (SELECT id FROM ideas WHERE slug = ?)`,
      [testSlug],
    );
    expect(results[0].avg_confidence).toBeLessThan(0.6);
  });
});
```

**Note:** These E2E tests are expensive and slow. Recommended to:
- Mark as `.skip` by default
- Run manually during validation or pre-release
- Use CI/CD flag to run only on certain branches
- Consider using cheaper models (Haiku) for E2E tests

**Pass Criteria:**
- ✅ Full evaluation completes with all context sources
- ✅ Evaluation handles missing context gracefully
- ✅ High confidence achieved with complete context
- ✅ Lower confidence when context missing

---

## Pass Criteria

### Unit Tests ✅

1. **Context Loading:**
   - `getStructuredContext()` returns Q&A organized by category
   - `getEvaluationProfileContext()` returns profile with 5 dimensions
   - Context loaders handle missing data gracefully

2. **Context Formatting:**
   - `formatProfileForCategory()` returns category-specific excerpts ✅ (already tested)
   - `formatStructuredDataForPrompt()` includes only relevant Q&A
   - `formatResearchForCategory()` returns market/solution context
   - All formatters handle null input gracefully

3. **Coverage:**
   - 90%+ code coverage for context-related functions
   - All edge cases handled (null, empty, malformed data)

### Integration Tests ✅

1. **Context Flow:**
   - All 3 context sources passed to evaluators
   - Category-specific context filtering works correctly
   - Context parameters flow through call chain

2. **Category-Specific Context:**
   - Feasibility: receives skills + time + Q&A
   - Market: receives network + research + Q&A
   - Risk: receives runway + tolerance + Q&A
   - Fit: receives full profile + Q&A
   - Solution: receives tech feasibility + Q&A
   - Problem: receives Q&A only

3. **Evidence Quality:**
   - Evaluations cite specific Q&A answers
   - Evaluations reference profile data
   - Evaluations mention research findings
   - High confidence scores with complete context

### E2E Tests ✅

1. **Complete Flow:**
   - Full evaluation with all context completes successfully
   - Logs show all context sources loaded
   - High confidence scores achieved (>0.7 average)

2. **Partial Context:**
   - Evaluation without profile completes with warning
   - Evaluation without Q&A proceeds with README only
   - Evaluation without research skips research phase

3. **Quality Impact:**
   - Complete context produces higher confidence than partial
   - Reasoning quality improves with more context
   - Evidence citations increase with complete context

### Documentation ✅

1. **Test Documentation:**
   - Each test file has clear description
   - Complex tests include comments explaining approach
   - Pass criteria documented in test descriptions

2. **Test Coverage Report:**
   - Generate and review coverage report
   - Identify untested paths
   - Document any intentionally untested code

---

## Dependencies

### Upstream (must exist first)

- ✅ **PHASE1-TASK-01:** Q&A sync from development.md
- ✅ **PHASE1-TASK-02:** Profile context formatting
- ✅ **PHASE1-TASK-03:** Web research integration
- ✅ **PHASE1-TASK-04:** Complete evaluator context integration
- ✅ Specialized evaluators (6 category-specific agents)
- ✅ Database schema (idea_answers, user_profiles, evaluations)

### Downstream (depends on this)

- Phase 2 tasks (can proceed in parallel)
- Regression testing for future evaluation changes
- Quality assurance for production deployments

---

## Implementation Status

### Existing Tests ✅

1. **Profile Context Formatting** (`tests/unit/utils/profile-context.test.ts`)
   - ✅ Tests all 6 categories
   - ✅ Tests null handling
   - ✅ Tests field extraction
   - ✅ 100% coverage of formatProfileForCategory()

### Tests to Create 📝

1. **Structured Q&A Context** (`tests/unit/context/structured-context.test.ts`)
   - Test `getStructuredContext()` function
   - Test Q&A organization by category
   - Test coverage calculation
   - Test edge cases

2. **Research Context Formatting** (`tests/unit/context/research-context.test.ts`)
   - Test `formatResearchForCategory()` for market
   - Test `formatResearchForCategory()` for solution
   - Test null handling
   - Test source attribution

3. **Category-Specific Integration** (`tests/integration/category-specific-context.test.ts`)
   - Test context flow for each evaluator category
   - Test context filtering (correct context to correct evaluator)
   - Requires prompt capture mechanism

4. **Evidence-Based Reasoning** (`tests/integration/evidence-based-reasoning.test.ts`)
   - Test confidence scores correlate with context
   - Test reasoning cites evidence
   - May require snapshot testing or mocked LLM

5. **E2E Complete Flow** (`tests/e2e/complete-evaluation-context.test.ts`)
   - Test full evaluation with complete context
   - Test partial context scenarios
   - Expensive tests, mark as `.skip` by default

---

## Testing Strategy

### Phase 1: Unit Tests (Week 1)

**Priority: HIGH**

1. Create `structured-context.test.ts` (8-10 tests)
2. Create `research-context.test.ts` (12-15 tests)
3. Run unit tests, verify 90%+ coverage
4. Fix any issues discovered

**Time Estimate:** 1-2 days

### Phase 2: Integration Tests (Week 1)

**Priority: MEDIUM**

1. Design prompt capture mechanism for integration tests
2. Create `category-specific-context.test.ts` (6-8 tests)
3. Create `evidence-based-reasoning.test.ts` (5-6 tests)
4. Run integration tests, fix issues

**Time Estimate:** 2-3 days

**Challenges:**
- Need to capture evaluator prompts for verification
- May require adding test mode to evaluators
- Consider mocking LLM API calls for speed/cost

### Phase 3: E2E Tests (Week 2)

**Priority: LOW**

1. Create `complete-evaluation-context.test.ts` (3-4 tests)
2. Mark as `.skip` by default
3. Run manually during validation
4. Document expected results

**Time Estimate:** 1 day

**Notes:**
- These tests are expensive ($1-2 per run)
- Run only during major validations
- Consider using Haiku for cost savings

### Phase 4: Documentation & Review (Week 2)

1. Generate test coverage report
2. Document test strategy in this spec
3. Create test running guide for developers
4. Review with QA agent

**Time Estimate:** 0.5 days

---

## Test Fixtures & Helpers

### Mock Data Factories

**File:** `tests/fixtures/evaluation-context.ts`

```typescript
import type {
  ProfileContext,
  StructuredEvaluationContext,
  ResearchResult,
} from "../../utils/schemas.js";

export function createMockProfile(): ProfileContext {
  return {
    goalsContext: "Goals: $100k ARR in 2 years",
    passionContext: "Passion: Health tech from personal experience",
    skillsContext: "Skills: React, Python, ML. Experience: 5 years. Gaps: Marketing",
    networkContext: "Network: 500+ LinkedIn, Tech startup ecosystem",
    lifeStageContext: "Status: Employed. Hours: 20/week. Runway: 12 months. Tolerance: Medium",
  };
}

export function createMockStructuredContext(): StructuredEvaluationContext {
  return {
    answers: {
      problem: {
        p1_problem_statement: "Users struggle with time tracking",
        p2_target_users: "Freelancers and consultants",
      },
      solution: {
        s1_proposed_solution: "AI-powered time tracker",
        s2_key_features: "Automatic tracking, smart categorization",
      },
      feasibility: {
        f1_mvp_scope: "8 months to MVP",
        f2_technical_challenges: "ML model accuracy",
      },
      market: {
        m1_target_market: "Freelancers and consultants",
        m2_market_size: "$2B TAM",
      },
      risk: {
        r1_biggest_risk: "User adoption",
        r2_mitigation: "Free tier for initial users",
      },
      fit: {
        ft1_alignment: "Aligns with passion for productivity",
        ft2_motivation: "Personal pain point",
      },
    },
    coverage: { overall: 0.87 },
  };
}

export function createMockResearch(): ResearchResult {
  return {
    marketSize: {
      verified: "$8.2B TAM",
      userClaim: "$10B TAM",
      sources: ["Gartner 2025", "Forrester"],
    },
    competitors: {
      discovered: ["Toggl", "Harvest", "Clockify"],
      userMentioned: ["Toggl"],
    },
    trends: {
      direction: "growing",
      evidence: "25% CAGR in productivity tools",
    },
    geographicAnalysis: {
      region: "North America",
      marketSize: "$2.1B",
    },
    techFeasibility: {
      assessment: "Proven technology with production examples",
      examples: ["GPT-4", "Claude", "TensorFlow"],
      sources: ["OpenAI Docs", "Anthropic Docs"],
    },
    searchesPerformed: 4,
  };
}
```

### Database Test Helpers

**File:** `tests/helpers/evaluation-helpers.ts`

```typescript
import { run, query } from "../../database/index.js";
import { randomUUID } from "crypto";

export async function createTestIdea(options: {
  slug?: string;
  title?: string;
  readme?: string;
}): Promise<string> {
  const id = randomUUID();
  const slug = options.slug || `test-idea-${id.slice(0, 8)}`;
  const title = options.title || "Test Idea";
  const readme = options.readme || "# Test Idea\n\nTest content.";

  await run(
    `INSERT INTO ideas (id, slug, title, readme) VALUES (?, ?, ?, ?)`,
    [id, slug, title, readme],
  );

  return id;
}

export async function createTestAnswers(
  ideaId: string,
  answers: Record<string, string>,
): Promise<void> {
  for (const [questionId, answerText] of Object.entries(answers)) {
    await run(
      `INSERT INTO idea_answers (idea_id, question_id, answer_text)
       VALUES (?, ?, ?)`,
      [ideaId, questionId, answerText],
    );
  }
}

export async function cleanupTestIdea(ideaId: string): Promise<void> {
  await run(`DELETE FROM evaluations WHERE idea_id = ?`, [ideaId]);
  await run(`DELETE FROM idea_answers WHERE idea_id = ?`, [ideaId]);
  await run(`DELETE FROM ideas WHERE id = ?`, [ideaId]);
}
```

---

## Known Limitations

### 1. Integration Tests Require Prompt Capture

**Challenge:** Integration tests need to verify that the correct context is included in evaluator prompts, but prompts are not currently exposed for testing.

**Solution Options:**
- **Option A:** Add test mode to evaluators that returns assembled prompts without making LLM calls
- **Option B:** Mock LLM API to capture request payloads
- **Option C:** Use spy/stub pattern to intercept prompt assembly
- **Option D:** Skip prompt verification, only test that functions are called with correct parameters

**Recommendation:** Option A (test mode) is cleanest and most maintainable.

### 2. E2E Tests Are Expensive and Slow

**Challenge:** Full evaluations with LLM calls cost $1-2 each and take 30-60 seconds.

**Mitigation:**
- Mark E2E tests as `.skip` by default
- Run only during major validations
- Use CI/CD flag to control when they run
- Consider using Haiku for test runs (cheaper)
- Limit to 3-4 critical E2E scenarios

### 3. Evidence-Based Reasoning Tests Are Non-Deterministic

**Challenge:** LLM responses vary, making it hard to test that reasoning cites specific evidence.

**Solution Options:**
- **Option A:** Snapshot testing - run once, save responses, compare future runs
- **Option B:** Pattern matching - check for keywords/phrases rather than exact matches
- **Option C:** Mock LLM - return consistent test responses
- **Option D:** Manual validation only (no automated tests)

**Recommendation:** Option B (pattern matching) with Option A (snapshots) for critical test cases.

### 4. Test Coverage May Not Reach 100%

**Challenge:** Some paths are difficult to test (e.g., database failures, network timeouts).

**Acceptable Coverage Targets:**
- Unit tests: 90%+ (strict)
- Integration tests: 80%+ (moderate)
- E2E tests: Focus on critical paths (not coverage metric)

---

## Maintenance Notes

### Running Tests

```bash
# Run all unit tests
npm test -- tests/unit/context

# Run integration tests (may be slow)
npm test -- tests/integration

# Run E2E tests (expensive, skipped by default)
npm test -- tests/e2e/complete-evaluation-context.test.ts --run

# Generate coverage report
npm test -- --coverage
```

### Adding New Context Sources

When adding a 4th context source (e.g., competitor analysis):

1. Add unit tests for new loader function
2. Add unit tests for new formatter function
3. Add integration tests for category-specific inclusion
4. Add E2E test for complete flow with new context
5. Update this specification with new test requirements

### Debugging Test Failures

**Unit test failures:**
- Check mock data matches expected schema
- Verify database state in beforeEach/afterEach
- Check for typos in field names

**Integration test failures:**
- Verify all context sources are being loaded
- Check that context is passed through call chain
- Enable verbose logging to see prompts

**E2E test failures:**
- Check that test ideas exist in database
- Verify LLM API credentials are valid
- Check for rate limiting issues
- Review evaluation logs for errors

---

## Conclusion

This specification defines a comprehensive test suite to validate that evaluators receive complete context from Q&A answers, user profiles, and web research. The test strategy balances thoroughness with practicality:

- **Unit tests** for individual context functions (fast, cheap, high coverage)
- **Integration tests** for context flow through evaluation pipeline (moderate speed/cost)
- **E2E tests** for full evaluation quality validation (slow, expensive, critical paths only)

**Implementation Status:**
- ✅ Profile context tests already exist (1/5)
- 📝 Need to create 4 additional test files
- ⚠️ Integration tests require prompt capture mechanism
- 💰 E2E tests should be run sparingly due to cost

**Next Steps:**
1. Create unit tests for structured context and research context
2. Design prompt capture mechanism for integration tests
3. Create integration tests for category-specific context
4. Create E2E tests (marked as skip by default)
5. Validate with QA agent

**Quality Impact:**
- High confidence in context integration correctness
- Early detection of regressions
- Documentation of expected behavior
- Foundation for future evaluation improvements
