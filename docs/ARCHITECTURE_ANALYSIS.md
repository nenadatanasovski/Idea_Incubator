# Idea Incubator - Architecture Analysis

## Executive Summary

Three critical data flow issues prevent the evaluation system from producing accurate, well-informed assessments:

1. **Questions/Answers Disconnected**: Development Q&A stored in markdown files is never loaded into the evaluation context
2. **Profile Context Siloed**: User profile data is only passed to the Fit evaluator, ignoring its relevance to Feasibility, Market, and Risk
3. **No External Intelligence**: Evaluators work in isolation without web search capabilities to verify claims or research markets

This document traces each issue to its root cause using first principles analysis, then provides concrete solutions.

---

## Issue 1: Questions & Answers Not Picked Up

### Symptom
When evaluating an idea, structured answers from `/idea-develop` sessions are not considered by the evaluators.

### Data Flow Analysis

```
CURRENT FLOW (BROKEN):

/idea-develop skill
    ↓
SKILL.md instructions say:
"Save Q&A to ideas/[slug]/development.md"
    ↓
Answers written to MARKDOWN FILE
    ↓
    × DEAD END - Never read by evaluation

npm run evaluate <slug>
    ↓
getStructuredContext(ideaId)
    ↓
getAnswersForIdea(ideaId)
    ↓
Queries idea_answers TABLE (empty!)
    ↓
Returns empty array
    ↓
Evaluators have no structured context
```

### Root Cause

**Two parallel Q&A systems exist that don't talk to each other:**

| System | Storage | Used By | Status |
|--------|---------|---------|--------|
| Skill-based (`/idea-develop`) | `development.md` files | Claude Code skills | Active, used |
| Database-based (`questions/*.yaml`) | `idea_answers` table | Evaluation pipeline | Infrastructure exists, not populated |

The skill was designed to write human-readable markdown, while the evaluation pipeline was designed to read structured database records. **No bridge connects them.**

### Evidence

**SKILL.md (lines 37-41):**
```markdown
4. **Record answers**
   - Save Q&A to `ideas/[slug]/development.md`
   - Update README.md with new insights
```

**evaluate.ts (lines 307-311):**
```typescript
async function getStructuredContext(ideaId: string): Promise<...> {
  const answers = await getAnswersForIdea(ideaId);
  if (answers.length === 0) {
    return null;  // Returns null because no DB records exist
  }
```

**readiness.ts (lines 62-78):**
```typescript
export async function getAnswersForIdea(ideaId: string): Promise<Answer[]> {
  const rows = await query<DBAnswer>(
    'SELECT * FROM idea_answers WHERE idea_id = ?',
    [ideaId]
  );
  // Returns empty - table was never populated
}
```

### Solution: Markdown→Database Sync Command

**Decision**: Add `development.md` parsing to the existing `npm run sync` command.

**Rationale**:
- Follows existing patterns (`npm run sync` already syncs README.md → ideas table)
- Skills remain stateless and simple (no database dependencies)
- Explicit user control over when sync occurs
- Can auto-trigger at evaluation start for convenience

**Implementation**:
```typescript
// sync.ts - Add development.md parsing
async function syncDevelopmentAnswers(ideaId: string, folderPath: string): Promise<void> {
  const devPath = path.join(folderPath, 'development.md');
  if (!fs.existsSync(devPath)) return;

  const content = fs.readFileSync(devPath, 'utf-8');
  const answers = parseQAFromMarkdown(content);

  for (const { question, answer } of answers) {
    const questionId = classifyQuestionToId(question); // Map to YAML question ID
    if (questionId) {
      await saveAnswer(ideaId, questionId, answer, 'user', 0.9);
    }
  }
}

// Flexible parser with LLM fallback for edge cases
function parseQAFromMarkdown(content: string): Array<{question: string, answer: string}> {
  const results: Array<{question: string, answer: string}> = [];

  // Try structured format first: **Q:** / **A:** patterns
  const qaPattern = /\*\*Q:\s*(.+?)\*\*\s*\n\s*(?:A:|Answer:)?\s*(.+?)(?=\n\*\*Q:|\n##|$)/gs;
  let match;
  while ((match = qaPattern.exec(content)) !== null) {
    results.push({ question: match[1].trim(), answer: match[2].trim() });
  }

  // If low yield, could use LLM extraction as fallback
  return results;
}
```

**Staleness Integration**:
- Include `development.md` in content hash calculation
- Development changes invalidate previous evaluation (triggers re-eval prompt)

---

## Issue 2: Profile Not Considered in Evaluation

### Symptom
User profiles linked to ideas are only used for the Fit category (FT1-FT5), not for Feasibility, Market, or Risk assessments.

### Data Flow Analysis

```
CURRENT FLOW:

npm run evaluate <slug>
    ↓
getEvaluationProfileContext(ideaId)
    ↓
Returns ProfileContext with:
  - goalsContext (FT1)
  - passionContext (FT2)
  - skillsContext (FT3)
  - networkContext (FT4)
  - lifeStageContext (FT5)
    ↓
Passed to runAllSpecializedEvaluators()
    ↓
runSpecializedEvaluator() for each category
    ↓
specialized-evaluators.ts lines 306-309:

const profileSection = category === 'fit'
  ? formatProfileContextForFitEvaluator(profileContext ?? null)
  : '';  // ← EMPTY STRING for all other categories!
```

### Root Cause

**Explicit conditional that ignores profile for non-fit categories.**

The code has a hard-coded check that only adds profile context for the 'fit' category. Other categories receive an empty string.

### Why This Matters

Profile data is directly relevant to multiple criteria:

| Category | Criterion | Why Profile Matters |
|----------|-----------|---------------------|
| Feasibility | F3 (Skill Availability) | User's `technicalSkills` and `professionalExperience` determine what's buildable |
| Feasibility | F2 (Resource Requirements) | User's `weeklyHoursAvailable` affects time assessment |
| Market | M4 (Entry Barriers) | User's `industryConnections` and `professionalNetwork` can overcome barriers |
| Risk | R1 (Execution Risk) | User's `professionalExperience` directly impacts execution risk |
| Risk | R4 (Financial Risk) | User's `financialRunwayMonths` and `riskTolerance` are critical |

### Evidence

**specialized-evaluators.ts (lines 306-309):**
```typescript
// Add profile context for fit category
const profileSection = category === 'fit'
  ? formatProfileContextForFitEvaluator(profileContext ?? null)
  : '';
```

**Compare with evaluator.ts (lines 221-235)** which has proper logic:
```typescript
function formatProfileContextForPrompt(profileContext: ProfileContext | null, category: Category): string {
  // For non-fit categories, include brief profile summary
  if (category !== 'fit') {
    return `## Creator Profile Summary
The creator has provided their profile for context. Key points:
- Goals: ${profileContext.goalsContext}
- Skills: ${profileContext.skillsContext.split('\n')[0]}

Use this context when relevant to your assessment.`;
  }
  // ... full context for fit category
}
```

This function exists in `evaluator.ts` but is never used by the specialized evaluators in v2 mode.

### Solution: Category-Relevant Profile Excerpts

**Decision**: Create `formatProfileForCategory()` that returns focused, category-relevant excerpts.

**Rationale**:
- Token efficient (full profile is 500+ tokens; multiplied by 6 evaluators = waste)
- Better signal-to-noise ratio (Feasibility doesn't need "passion for houseplants")
- Sharper evaluator reasoning with focused context

**Implementation**:
```typescript
// specialized-evaluators.ts - Replace empty string with category-relevant context
function formatProfileForCategory(profile: ProfileContext | null, category: Category): string {
  if (!profile) {
    return `## Creator Context\nNo profile available. Assess with lower confidence where creator capabilities matter.`;
  }

  switch (category) {
    case 'feasibility':
      return `## Creator Capabilities (for Feasibility Assessment)
**Technical Skills:** ${profile.skillsContext}
**Time Available:** ${profile.lifeStageContext.match(/Hours Available:.*/)?.[0] || 'Not specified'}
**Known Gaps:** ${profile.skillsContext.match(/Gaps:.*/)?.[0] || 'Not specified'}

Use this to assess whether the creator can realistically build this.`;

    case 'market':
      return `## Creator Network (for Market Assessment)
**Industry Connections:** ${profile.networkContext}
**Community Access:** ${profile.networkContext.match(/Community:.*/)?.[0] || 'Not specified'}

Use this to assess go-to-market feasibility and barrier-crossing ability.`;

    case 'risk':
      return `## Creator Risk Profile (for Risk Assessment)
**Financial Runway:** ${profile.lifeStageContext.match(/Runway:.*/)?.[0] || 'Not specified'}
**Risk Tolerance:** ${profile.lifeStageContext.match(/Tolerance:.*/)?.[0] || 'Not specified'}
**Employment Status:** ${profile.lifeStageContext.match(/Status:.*/)?.[0] || 'Not specified'}
**Experience:** ${profile.skillsContext.match(/Experience:.*/)?.[0] || 'Not specified'}

Use this to assess execution, financial, and career risk exposure.`;

    case 'fit':
      return formatProfileContextForFitEvaluator(profile); // Full context

    default:
      return ''; // Problem and Solution don't need profile
  }
}
```

**Update specialized-evaluators.ts**:
```typescript
// Replace line 306-309 with:
const profileSection = formatProfileForCategory(profileContext ?? null, category);
```

---

## Issue 3: No Web Search for Viability Assessment

### Symptom
Market size claims, competitor analysis, technology feasibility, and timing assessments are purely speculative because evaluators have no access to current external information.

### Data Flow Analysis

```
CURRENT FLOW:

Evaluator receives:
  1. ideaContent (from README.md)
  2. structuredContext (from idea_answers - often empty)
  3. profileContext (for fit category only)
    ↓
Evaluator must assess:
  - M1: Market Size → Claims "TAM of $50B" - unverified
  - M2: Market Growth → "Growing 20% annually" - unverified
  - M3: Competition → "Main competitor is X" - can't check
  - M5: Timing → "Perfect timing because..." - can't verify
  - S2: Solution Feasibility → "Uses proven technology" - can't verify
    ↓
Evaluator produces SPECULATION, not ANALYSIS
```

### Root Cause

**No web search capability exists in the architecture.**

The system was designed as a closed-loop evaluator that processes only user-provided information. There's no integration with external search or research capabilities.

### Why This Matters

| Criterion | What Evaluator Says | What It Should Know |
|-----------|---------------------|---------------------|
| M1 (Market Size) | "User claims TAM of $50B" | "According to recent reports, this market is actually $30B" |
| M3 (Competition) | "User mentions 3 competitors" | "There are actually 15 active competitors, including well-funded ones" |
| M5 (Timing) | "User says timing is right" | "Recent regulatory changes support/contradict this claim" |
| S2 (Feasibility) | "Uses standard tech stack" | "This technology has been proven viable by X, Y, Z" |

### Solution: Web Research Phase for Market + Solution Categories

**Decision**: Add web search for Market (M1-M5) and Solution technical feasibility (S2), using Claude's built-in WebSearch tool.

**Rationale**:
- Market and Solution categories benefit most from external verification
- 7-15 searches per evaluation (balanced cost vs. thoroughness)
- Claude WebSearch is already available (no new dependencies)
- Both verify user claims AND discover blind spots

**Scope**:
| Category | Criteria Affected | Search Purpose |
|----------|-------------------|----------------|
| Market | M1 (Size), M2 (Growth), M3 (Competition), M4 (Barriers), M5 (Timing) | Verify claims, discover competitors, validate trends |
| Solution | S2 (Technical Feasibility) | Verify technology maturity, find similar implementations |

**Implementation**:
```typescript
// agents/research.ts - New pre-evaluation research phase
interface ResearchResult {
  marketSize: { claim: string; verification: string; sources: string[] };
  competitors: { known: string[]; discovered: string[]; sources: string[] };
  trends: { direction: string; evidence: string; sources: string[] };
  techFeasibility: { assessment: string; examples: string[]; sources: string[] };
}

async function conductPreEvaluationResearch(
  ideaContent: string,
  userClaims: ExtractedClaims
): Promise<ResearchResult> {
  const searches = [
    // Market verification
    `${userClaims.domain} market size ${new Date().getFullYear()}`,
    `${userClaims.domain} industry growth trends`,
    `${userClaims.competitors.join(' ')} competitors alternatives`,

    // Discovery (find what user missed)
    `${userClaims.domain} startups companies ${new Date().getFullYear()}`,
    `${userClaims.domain} market analysis report`,

    // Technical feasibility
    `${userClaims.technology} implementation examples`,
    `${userClaims.technology} production deployment case study`,
  ];

  const results = await Promise.all(
    searches.map(query => webSearch(query))
  );

  return synthesizeResearchResults(results, userClaims);
}
```

**Integration with Evaluation**:
```typescript
// evaluate.ts - Add research phase before evaluation
async function runEvaluation(slug: string, options: EvalOptions) {
  // ... existing setup ...

  // NEW: Pre-evaluation research phase
  const userClaims = extractClaimsFromContent(ideaContent);
  const research = await conductPreEvaluationResearch(ideaContent, userClaims);

  // Pass research to evaluators
  const result = await runAllSpecializedEvaluators(
    slug, ideaId, ideaContent, costTracker, broadcaster,
    profileContext, structuredContext,
    research  // NEW: research context
  );
}
```

**Budget Adjustment**:
- Default budget increased from $10 to $15 to accommodate research phase
- Estimated research cost: ~$3-5 (7-15 searches + synthesis)

---

## First Principles Analysis

### Principle 1: Data Should Flow, Not Pool

**Current State**: Data pools in three disconnected locations:
1. Markdown files (development.md)
2. Database tables (idea_answers)
3. Profile context (user_profiles)

**Solution**: Single sync point that unifies markdown → database, then database → evaluators.

### Principle 2: Context Should Be Complete

**Current State**: Evaluators receive partial context:
- Fit evaluator: Full profile
- Other evaluators: No profile
- All evaluators: No structured answers (unless database populated)

**Solution**: All evaluators receive category-relevant profile excerpts and all structured answers.

### Principle 3: Claims Should Be Verifiable

**Current State**: Evaluators trust user claims about market size, competition, technology.

**Solution**: Web research phase verifies AND enriches claims before evaluation begins.

---

## Impact Assessment

### Current Quality Score

| Dimension | Score | Reason |
|-----------|-------|--------|
| Data Completeness | 2/10 | Q&A never reaches evaluators |
| Context Utilization | 4/10 | Profile only used for Fit |
| Claim Verification | 1/10 | No external research capability |
| **Overall** | **2.3/10** | System produces unreliable evaluations |

### Expected Quality After Fixes

| Dimension | Score | Improvement |
|-----------|-------|-------------|
| Data Completeness | 8/10 | Q&A flows to evaluators via sync |
| Context Utilization | 9/10 | Profile informs all relevant criteria |
| Claim Verification | 7/10 | Web search verifies market + tech claims |
| **Overall** | **8/10** | Evaluations become trustworthy |

---

## Architecture Diagram: Current vs. Target

### Current Architecture (Broken)

```
┌─────────────────┐     ┌─────────────────┐
│  /idea-develop  │     │   User Profile  │
│     Skill       │     │                 │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ development.md  │     │  user_profiles  │
│    (files)      │     │    (table)      │
└─────────────────┘     └────────┬────────┘
         ×                       │
         │ NOT READ              │ ONLY FIT
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│            EVALUATORS                   │
│  ┌───────┐ ┌───────┐ ┌───────┐         │
│  │Problem│ │Market │ │  Fit  │ ← Profile│
│  └───────┘ └───────┘ └───────┘         │
│  No context  No context  Full context   │
└─────────────────────────────────────────┘
                  │
                  ▼
         ┌─────────────┐
         │ Speculation │
         │   Results   │
         └─────────────┘
```

### Target Architecture (Fixed)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  /idea-develop  │     │   User Profile  │     │   WebSearch     │
│     Skill       │     │                 │     │     (Claude)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       │                       │
┌─────────────────┐              │                       │
│ development.md  │              │                       │
└────────┬────────┘              │                       │
         │                       │                       │
         ▼ npm run sync          │                       │
┌─────────────────┐     ┌────────┴────────┐              │
│  idea_answers   │     │  user_profiles  │              │
│    (table)      │     │    (table)      │              │
└────────┬────────┘     └────────┬────────┘              │
         │                       │                       │
         └───────────┬───────────┘                       │
                     ▼                                   │
         ┌───────────────────────┐                       │
         │   Context Assembler   │◀──────────────────────┘
         │   (all data merged)   │
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │  ALL EVALUATORS GET:  │
         │  • Structured answers │
         │  • Profile excerpts   │
         │  • Web research       │
         └───────────────────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │ Evidence-Based      │
         │ Evaluations         │
         └─────────────────────┘
```

---

## Summary of Changes

| Issue | Solution | Files Affected |
|-------|----------|----------------|
| Q&A Not Picked Up | Add `development.md` parsing to `npm run sync` | `scripts/sync.ts`, `questions/parser.ts` (new) |
| Profile Siloed | Create `formatProfileForCategory()` function | `agents/specialized-evaluators.ts` |
| No Web Search | Add pre-evaluation research phase | `agents/research.ts` (new), `scripts/evaluate.ts` |
| Budget | Increase default from $10 to $15 | `config/default.ts` |
| Staleness | Include `development.md` in content hash | `scripts/sync.ts` |

---

## Design Decisions Summary

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Q&A sync approach | Sync command (extend `npm run sync`) | Follows existing patterns; skills stay simple |
| 2 | Profile granularity | Category-relevant excerpts | Token efficient; focused context |
| 3 | Web search scope | Market + Solution (S2) | Highest ROI; 7-15 searches |
| 4 | Search purpose | Both verify + enrich | Users have blind spots |
| 5 | Question bank authority | YAML is authoritative | Database requires stable IDs |
| 6 | No-profile behavior | Neutral scores + low confidence | Non-blocking; confidence signals |
| 7 | Markdown parsing | Flexible + LLM fallback | Users are inconsistent |
| 8 | Development staleness | Include in hash | Development should improve eval |
| 9 | Search tool | Claude WebSearch | Already available; no new deps |
| 10 | Default budget | $15 | Accommodates research phase |

See `IMPLEMENTATION-PLAN.md` for detailed implementation steps.
