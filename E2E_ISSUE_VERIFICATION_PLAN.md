# End-to-End Issue Verification Plan

## Purpose

Comprehensive browser-based testing to verify that all 3 issues identified in GAPS_ANALYSIS.md have been properly fixed and are working in production.

---

## First Principles Analysis

### What are we actually testing?

**Issue 1: Q&A from development.md not picked up by evaluators**

- **Root Cause**: Development Q&A pairs weren't being parsed and passed to evaluators
- **Expected Fix**: Q&A pairs should be extracted, classified to criteria IDs, and included in evaluator prompts
- **Evidence of Success**: Evaluation output should reference specific Q&A content from development.md

**Issue 2: Profile context only used for Fit category**

- **Root Cause**: Profile data was only passed to Fit evaluators, not other categories
- **Expected Fix**: All specialized evaluators should receive profile context where relevant
- **Evidence of Success**: Non-Fit categories (Feasibility, Market, Risk) should reference profile skills, network, life stage

**Issue 3: No web search for verification**

- **Root Cause**: No research phase existed before evaluation
- **Expected Fix**: Research agent should conduct web searches to verify claims before evaluation
- **Evidence of Success**: Research results should be in output, or research folder should contain findings

---

## Test Prerequisites

### Environment Setup

1. Development server running on localhost:3000 (frontend) and localhost:3001 (backend)
2. Database synced with latest schema
3. At least one user profile exists (Ned)
4. Browser automation tool available (Puppeteer MCP or Claude-in-Chrome)

### Test Data Requirements

**For Issue 1 (Q&A Sync):**

- An idea with a development.md file containing specific, identifiable Q&A pairs
- Q&A should cover multiple criteria categories to verify cross-category sync

**For Issue 2 (Profile Context):**

- A user profile with rich data across all dimensions:
  - Goals (FT1) - specific goals like "income", "learning"
  - Passion (FT2) - domain interests
  - Skills (FT3) - technical skills that relate to feasibility
  - Network (FT4) - connections relevant to market entry
  - Life Stage (FT5) - time availability, risk tolerance

**For Issue 3 (Web Research):**

- An idea with verifiable claims:
  - Market size claims (e.g., "$15B market by 2027")
  - Competitor mentions (e.g., "Sense, Emporia, Neurio")
  - Technology claims that can be verified

---

## Test Execution Plan

### Phase 1: Setup & Verification (Pre-Evaluation)

#### Step 1.1: Verify Server is Running

```
Action: Navigate to http://localhost:3000
Expected: Dashboard loads successfully
Verify: Page title, navigation elements present
```

#### Step 1.2: Create Test Idea with Rich Content

```
Action: Click "New Idea" button
Action: Fill in idea form with:
  - Title: "E2E Test Idea - [timestamp]"
  - Problem: Include specific market claims
  - Solution: Include technology claims
  - Target users: Be specific
  - Competitors: Name specific competitors
Action: Submit form
Expected: Idea created, redirected to idea detail page
Verify: Idea appears in list with correct slug
```

#### Step 1.3: Add Development Q&A via File System

```
Action: Create development.md in idea folder with:
  ---
  Q: What specific technical skills do you have for this project?
  A: I have 10 years of Python experience, ML expertise with TensorFlow, and IoT hardware development background.

  Q: How large is your target market?
  A: The addressable market is approximately $5 billion, with 15% annual growth.

  Q: What's your competitive advantage?
  A: We have a patented algorithm that's 3x faster than competitors.
  ---

Expected: File created in ideas/[slug]/development.md
```

#### Step 1.4: Sync Database

```
Action: Run npm run sync (via CLI or trigger via UI if available)
Expected: Q&A pairs synced to database
Verify: Query database for idea_answers table entries
```

#### Step 1.5: Verify Profile Exists

```
Action: Navigate to Profiles page
Expected: "Ned" profile visible in list
Verify: Profile has data in all 5 dimensions (Goals, Passion, Skills, Network, Life Stage)
```

#### Step 1.6: Link Profile to Idea

```
Action: Navigate to test idea detail page
Action: Click "Link Profile" button
Action: Select "Ned" from profile selector
Action: Click confirm/link button
Expected: UI shows "Evaluating as: Ned"
```

#### Step 1.7: CRITICAL - Verify Profile Link Persisted

```
Action: Query database directly:
  SELECT ip.*, up.name
  FROM idea_profiles ip
  JOIN user_profiles up ON ip.profile_id = up.id
  JOIN ideas i ON ip.idea_id = i.id
  WHERE i.slug = '[test-idea-slug]';

Expected: Row returned with profile_id matching Ned's ID
Alternative: Refresh page, verify "Evaluating as: Ned" still shows
Alternative: Call API GET /api/ideas/[slug] and check profile field
```

### Phase 2: Trigger Evaluation

#### Step 2.1: Start Evaluation via UI

```
Action: Click "Run Evaluation" button on idea detail page
Alternative: Run via CLI: npm run evaluate [slug] --budget=25
Expected: Evaluation starts, progress indicators appear
```

#### Step 2.2: Monitor Evaluation Progress

```
Action: Watch for:
  - Research phase indicator (if enabled)
  - Initial scoring phase
  - Debate rounds counter
  - Red team challenges
Expected: All phases complete without errors
Timeout: Set reasonable timeout (10-15 minutes for full evaluation)
```

#### Step 2.3: Wait for Completion

```
Action: Poll for completion status
Expected: Evaluation status changes to "completed"
Verify: evaluation.md file exists in idea folder
```

### Phase 3: Verification of Issue Fixes

#### Step 3.1: Verify Issue 1 - Q&A Sync

```
Action: Read evaluation.md file
Search for: References to Q&A content we added
  - "10 years of Python experience"
  - "ML expertise with TensorFlow"
  - "$5 billion" market claim
  - "patented algorithm"

Expected Evidence:
  - Feasibility section should reference Python/TensorFlow skills
  - Market section should reference the $5B claim
  - Solution section should reference patented algorithm

Verification Query:
  SELECT * FROM idea_answers WHERE idea_id = '[idea-id]';
  Should return the Q&A pairs we added

Pass Criteria:
  - At least 2 Q&A items appear verbatim or paraphrased in evaluation
  - Scores reflect the specific information from Q&A
```

#### Step 3.2: Verify Issue 2 - Profile Context in All Categories

```
Action: Read evaluation.md file
Search for: Profile-specific references in non-Fit categories

Expected in FEASIBILITY section:
  - Reference to Ned's technical skills
  - Consideration of Ned's experience level
  - Skill availability score informed by profile

Expected in MARKET section:
  - Reference to Ned's network/connections
  - Consideration of Ned's industry access
  - Entry barriers score informed by network

Expected in RISK section:
  - Reference to Ned's life stage (runway, risk tolerance)
  - Consideration of Ned's time availability
  - Execution risk score informed by profile

Negative Test:
  - Fit section should NOT say "Without a user profile..."
  - Fit confidence should be > 50% (not 37%)

Pass Criteria:
  - At least 3 non-Fit categories reference profile data
  - No "without a profile" language appears
  - Fit category confidence >= 60%
```

#### Step 3.3: Verify Issue 3 - Web Research Conducted

```
Action: Check research folder
  ls ideas/[slug]/research/

Expected if research enabled:
  - One or more .md files with research findings
  - Files contain web sources, competitor data, market verification

Action: Read evaluation.md header
Search for: Research phase indicators
  - "Research completed"
  - "X searches performed"
  - Source citations

Action: Check database
  SELECT * FROM evaluation_sessions WHERE idea_id = '[idea-id]';
  Look for research_completed flag or similar

Known Limitation:
  - If using Claude CLI, research is skipped (shouldSkipResearch returns true)
  - This is a design limitation that needs separate fix

Pass Criteria (if research enabled):
  - Research folder contains findings
  - Evaluation references external sources
  - Market claims show "verified" status

Alternative Pass Criteria (if research disabled):
  - Document that research phase needs alternative implementation
  - Verify research code exists and would work with web search
```

### Phase 4: Regression Checks

#### Step 4.1: Verify Evaluation Quality

```
Action: Review overall evaluation structure
Expected:
  - All 6 categories scored (Problem, Solution, Feasibility, Fit, Market, Risk)
  - All 30 criteria have scores
  - Debate summary present
  - Recommendation provided
```

#### Step 4.2: Verify No New Bugs Introduced

```
Action: Check for errors in evaluation output
Expected:
  - No stack traces
  - No "undefined" or "null" in text
  - No incomplete sentences
  - Scores are all 1-10 range
```

---

## Browser Automation Script Structure

```typescript
// Pseudocode for automation script

async function verifyAllIssues() {
  // Setup
  const browser = await setupBrowser();
  const testSlug = `e2e-test-${Date.now()}`;

  // Phase 1: Setup
  await navigateTo("/");
  await verifyDashboardLoads();

  await createIdea(testSlug, testIdeaContent);
  await createDevelopmentFile(testSlug, testQAPairs);
  await syncDatabase();

  await navigateTo(`/ideas/${testSlug}`);
  await linkProfile("ned");
  await verifyProfileLinkPersisted(testSlug); // CRITICAL

  // Phase 2: Evaluate
  await triggerEvaluation(testSlug, { budget: 25 });
  await waitForEvaluationComplete(testSlug, { timeout: 900000 }); // 15 min

  // Phase 3: Verify
  const evaluationContent = await readEvaluationFile(testSlug);

  const issue1Result = verifyQASyncInEvaluation(evaluationContent, testQAPairs);
  const issue2Result = verifyProfileContextAllCategories(evaluationContent);
  const issue3Result = verifyResearchConducted(testSlug);

  // Report
  return {
    issue1: issue1Result,
    issue2: issue2Result,
    issue3: issue3Result,
    overallPass: issue1Result.pass && issue2Result.pass && issue3Result.pass,
  };
}
```

---

## Test Data Templates

### Test Idea Content

```markdown
# E2E Test Idea - Smart Wellness Tracker

## Problem

Health-conscious professionals waste 2-3 hours weekly tracking wellness metrics manually.
The $8.5 billion wellness tracking market is growing 12% annually.

## Solution

AI-powered wearable that automatically correlates sleep, exercise, and nutrition data.
Uses proprietary TinyML algorithms for on-device processing.

## Target Users

- Tech professionals aged 25-45
- Annual income $75k+
- Already use 2+ health apps

## Competitors

- Whoop ($30/month subscription)
- Oura Ring ($300 + subscription)
- Apple Watch (different price tier)
```

### Test Q&A Pairs (development.md)

```markdown
---
last_updated: 2025-12-27
---

## Development Q&A

Q: What specific technical skills do you have for this project?
A: I have 10 years of embedded systems experience, including 3 years with TinyML on ARM Cortex-M processors. I've shipped 2 consumer hardware products.

Q: What's your realistic timeline to MVP?
A: Based on my hardware experience, I estimate 8 months to functional prototype and 14 months to production-ready MVP.

Q: Do you have manufacturing connections?
A: Yes, I have existing relationships with 2 Shenzhen manufacturers from my previous hardware startup. They've quoted competitive pricing for runs of 5000+ units.

Q: What's your financial runway?
A: I have 18 months of personal runway saved, plus $150k in pre-seed commitments from angels.

Q: How much time can you dedicate?
A: I'm leaving my full-time job next month to work on this 60+ hours/week.
```

---

## Expected Results Matrix

| Issue                     | Test Method                 | Pass Criteria                        | Evidence Location                |
| ------------------------- | --------------------------- | ------------------------------------ | -------------------------------- |
| 1. Q&A Sync               | Search eval for Q&A content | 2+ Q&A items referenced              | evaluation.md body               |
| 2. Profile All Categories | Search non-Fit for profile  | 3+ non-Fit profile refs              | Feasibility/Market/Risk sections |
| 3. Web Research           | Check research folder       | Files exist OR documented limitation | ideas/[slug]/research/           |

---

## Failure Recovery

### If Profile Link Fails

1. Check network tab for failed API calls
2. Verify database tables exist (idea_profiles)
3. Check server logs for errors
4. Try CLI linking as fallback: `npm run profile link [idea] [profile]`

### If Evaluation Hangs

1. Check cost tracker - may have exceeded budget
2. Check for Claude API errors
3. Increase budget and retry
4. Check server logs for stack traces

### If Q&A Not Found

1. Verify development.md format matches expected schema
2. Run sync manually: `npm run sync`
3. Query database to verify Q&A ingestion
4. Check parser logs for parsing errors

---

## Automation Tool Selection

### Option A: Claude-in-Chrome MCP

- Pros: Direct browser control, screenshot verification, real user flow
- Cons: Requires Chrome extension, connection can drop

### Option B: Puppeteer MCP

- Pros: Stable, headless option, good for CI
- Cons: May miss extension-specific UI elements

### Recommendation

Use Claude-in-Chrome for interactive testing with screenshots, fall back to direct file/database verification for assertions that don't require UI.

---

## Next Steps

1. Execute Phase 1 setup steps
2. Create test idea with template content
3. Add development.md with test Q&A
4. Link profile AND VERIFY PERSISTENCE
5. Run evaluation with sufficient budget
6. Parse evaluation output for all 3 issue verifications
7. Document results with screenshots/evidence
8. Fix any failing issues found
9. Re-run verification until all pass
