# Idea Incubator: Comprehensive Architecture & Bug Fixes

## Executive Summary

The system has **three orphaned subsystems** that don't properly communicate:

1. **Questions/Readiness System** - Tracks 60+ development Q&A
2. **Evaluator System** - Scores against 30 criteria
3. **Synthesis System** - Creates final output

**Core Problem**: Users answer 60 questions with 100% coverage, but:
- Synthesis shows "0% evaluation readiness"
- Only ~25% of answers are passed to evaluators
- Generic "unresolved questions" displayed instead of actual gaps

---

## Part 1: Critical Bugs

### BUG #1: Synthesis Never Receives Structured Answers

**Location**: `agents/synthesis.ts` and `scripts/evaluate.ts`

**Problem**: The synthesis function only receives debate results, NOT the structured answers from questions:

```typescript
// scripts/evaluate.ts line 238-245
if (debateResult) {
  await saveFinalSynthesis(
    ideaData.id,
    sessionId,
    debateResult,        // ✓ Passed
    finalScore,          // ✓ Passed
    interpretation.recommendation
    // ❌ MISSING: structuredContext (all the Q&A data!)
  );
}
```

**Impact**: All 60 answered questions are invisible to synthesis generation.

---

### BUG #2: Only 15 of 60+ Question IDs Are Mapped

**Location**: `scripts/evaluate.ts` lines 321-386 (`getStructuredContext()`)

**Problem**: Hardcoded mapping only handles 15 question IDs:

```typescript
// Currently mapped (15):
P1_CORE, P2_PAIN, P3_WHO, P4_EVIDENCE, P5_EXISTING
S1_WHAT, S3_DIFF, F1_MVP
M1_TAM, M3_COMPETITORS, M5_WHY_NOW
R_BIGGEST, R_MITIGATION
BM_MODEL, BM_PRICE

// MISSING (~45+ questions):
F2_COST, F2_TEAM, F3_GAP, F4_FIRST_VALUE, F5_DEPS
M2_TREND, M4_BARRIERS
R_MARKET, R_TECHNICAL, R_FINANCIAL, R_REGULATORY
BM_CAC, BM_LTV, BM_GTM, BM_REVENUE
... and more
```

**Impact**: User answers 60 questions, evaluator sees ~15. 75% of data is lost.

---

### BUG #3: Unresolved Questions Are Hardcoded

**Location**: `questions/preliminary-analysis.ts` line 359

```typescript
unresolvedQuestions: unresolvedQuestions.length > 0
  ? unresolvedQuestions
  : ['What problem does this solve?', 'Who is the target user?', 'How will this be built?']
```

And in `scripts/evaluate.ts` line 612:
```typescript
JSON.stringify([]), // unresolved questions - ALWAYS EMPTY!
```

**Impact**: Shows generic questions even when user has answered everything.

---

### BUG #4: F1_MVP Stored in Wrong Category

**Location**: `scripts/evaluate.ts` lines 353-355

```typescript
} else if (qid === 'F1_MVP') {
  structuredAnswers.solution = structuredAnswers.solution || {};
  structuredAnswers.solution.mvp = answer.answer;  // ❌ Should be feasibility!
}
```

**Impact**: MVP data unavailable for feasibility evaluation.

---

### BUG #5: No Fit Category Questions Exist

**Location**: Missing `questions/fit.yaml`

**Problem**: Fit readiness is binary based on profile link only:
```typescript
// questions/readiness.ts line 305
fit: await hasLinkedProfile(ideaId) ? 1.0 : 0,
```

**Impact**: Cannot improve FT1-FT5 coverage by answering questions.

---

### BUG #6: Feasibility Has No Structured Data Support

**Location**: `agents/evaluator.ts` lines 242-246

```typescript
case 'feasibility':
  if (answers.solution?.mvp) {
    structuredSection += `**MVP Approach:** ${answers.solution.mvp}\n\n`;
  }
  break;  // ❌ That's ALL the data for feasibility!
```

**Impact**: Evaluator has no cost, team, timeline, dependency data.

---

### BUG #7: N+1 Query Problem in Answer Retrieval

**Location**: `scripts/evaluate.ts` lines 322-324

```typescript
for (const answer of answers) {
  const question = await getQuestionById(answer.questionId);  // ❌ Query per answer!
```

**Impact**: With 30 answers = 31+ database queries. Slow evaluation startup.

---

### BUG #8: Business Model Criterion IDs Mismatched

**Location**: `questions/business_model.yaml`

```yaml
- id: BM_MODEL
  criterion: S1          # ❌ Should be BM1
  category: business_model
```

**Impact**: Coverage attribution broken for business model category.

---

## Part 2: Frontend/UX Gaps

### UX #1: No Evaluation Readiness on Overview Tab

**Location**: `frontend/src/pages/IdeaDetail.tsx` lines 374-384

**Problem**: Users must navigate to "Develop" tab to see readiness status.

---

### UX #2: "Run Evaluation" Button Disabled Without Explanation

**Location**: `frontend/src/components/ReadinessMeter.tsx` line 166

```typescript
disabled={!readiness.readyForEvaluation}
title="Answer more questions to enable evaluation"  // ❌ Generic message
```

**Impact**: Users don't know WHAT questions to answer.

---

### UX #3: Triple-Fetching on Wizard Open

**Location**: `frontend/src/components/DevelopmentWizard.tsx` lines 45-83

```typescript
const sessionRes = await fetch(`/develop`, ...)     // Returns questions
const answersRes = await fetch(`/answers`)          // Separate fetch
const readinessRes = await fetch(`/questions`)      // Returns questions AGAIN
```

**Impact**: 3 API calls when 1-2 would suffice.

---

### UX #4: Missing Pre-Evaluation Summary

**Problem**: Backend has `/api/ideas/:slug/structured-data` endpoint that shows what evaluators will see. Frontend never calls it.

**Impact**: Users can't preview evaluation data before running expensive evaluation.

---

### UX #5: Silent Failures on Answer Submission

**Location**: `DevelopmentWizard.tsx` lines 133-135

```typescript
} catch (err) {
  console.error('Error saving answer:', err);  // ❌ Only console log
}
```

**Impact**: Users don't know if answer saved to database.

---

## Part 3: Implementation Plan

### Phase 1: Fix Data Flow (Critical)

#### 1.1 Complete Question ID Mapping

**File**: `scripts/evaluate.ts`

```typescript
// Add ALL missing question IDs to getStructuredContext()

// Feasibility questions
} else if (qid === 'F1_MVP') {
  structuredAnswers.feasibility = structuredAnswers.feasibility || {};
  structuredAnswers.feasibility.mvp = answer.answer;
} else if (qid === 'F2_COST' || qid === 'F2_TEAM') {
  structuredAnswers.feasibility = structuredAnswers.feasibility || {};
  structuredAnswers.feasibility.resources = answer.answer;
} else if (qid === 'F3_GAP') {
  structuredAnswers.feasibility = structuredAnswers.feasibility || {};
  structuredAnswers.feasibility.skill_gaps = answer.answer;
} else if (qid === 'F4_FIRST_VALUE') {
  structuredAnswers.feasibility = structuredAnswers.feasibility || {};
  structuredAnswers.feasibility.time_to_value = answer.answer;
} else if (qid === 'F5_DEPS') {
  structuredAnswers.feasibility = structuredAnswers.feasibility || {};
  structuredAnswers.feasibility.dependencies = answer.answer;

// Market questions
} else if (qid === 'M2_TREND') {
  structuredAnswers.market = structuredAnswers.market || {};
  structuredAnswers.market.trends = answer.answer;
} else if (qid === 'M4_BARRIERS') {
  structuredAnswers.market = structuredAnswers.market || {};
  structuredAnswers.market.barriers = answer.answer;

// Risk variants
} else if (qid === 'R_MARKET') {
  structuredAnswers.risk = structuredAnswers.risk || {};
  structuredAnswers.risk.market_risk = answer.answer;
} else if (qid === 'R_TECHNICAL') {
  structuredAnswers.risk = structuredAnswers.risk || {};
  structuredAnswers.risk.technical_risk = answer.answer;
} else if (qid === 'R_FINANCIAL') {
  structuredAnswers.risk = structuredAnswers.risk || {};
  structuredAnswers.risk.financial_risk = answer.answer;
} else if (qid === 'R_REGULATORY') {
  structuredAnswers.risk = structuredAnswers.risk || {};
  structuredAnswers.risk.regulatory_risk = answer.answer;

// Business model
} else if (qid === 'BM_CAC') {
  structuredAnswers.business_model = structuredAnswers.business_model || {};
  structuredAnswers.business_model.cac = answer.answer;
} else if (qid === 'BM_LTV') {
  structuredAnswers.business_model = structuredAnswers.business_model || {};
  structuredAnswers.business_model.ltv = answer.answer;
} else if (qid === 'BM_GTM') {
  structuredAnswers.business_model = structuredAnswers.business_model || {};
  structuredAnswers.business_model.gtm = answer.answer;
```

#### 1.2 Update StructuredAnswerData Interface

**File**: `agents/evaluator.ts`

```typescript
export interface StructuredAnswerData {
  problem?: {
    core_problem?: string;
    target_user?: string;
    pain_severity?: string;
    validation?: string;
    existing_solutions?: string;
  };
  solution?: {
    description?: string;
    differentiation?: string;
    mvp?: string;  // Remove - move to feasibility
  };
  feasibility?: {  // NEW
    mvp?: string;
    resources?: string;
    skill_gaps?: string;
    time_to_value?: string;
    dependencies?: string;
  };
  market?: {
    tam?: string;
    competitors?: string;
    timing?: string;
    trends?: string;      // NEW
    barriers?: string;    // NEW
  };
  risk?: {
    biggest_risk?: string;
    mitigation?: string;
    market_risk?: string;     // NEW
    technical_risk?: string;  // NEW
    financial_risk?: string;  // NEW
    regulatory_risk?: string; // NEW
  };
  business_model?: {  // NEW
    model?: string;
    pricing?: string;
    cac?: string;
    ltv?: string;
    gtm?: string;
  };
}
```

#### 1.3 Update formatStructuredDataForPrompt

**File**: `agents/evaluator.ts`

Add handling for feasibility structured data:

```typescript
case 'feasibility':
  if (answers.feasibility) {
    const f = answers.feasibility;
    if (f.mvp) structuredSection += `**MVP Approach:** ${f.mvp}\n\n`;
    if (f.resources) structuredSection += `**Resources Required:** ${f.resources}\n\n`;
    if (f.skill_gaps) structuredSection += `**Skill Gaps:** ${f.skill_gaps}\n\n`;
    if (f.time_to_value) structuredSection += `**Time to First Value:** ${f.time_to_value}\n\n`;
    if (f.dependencies) structuredSection += `**External Dependencies:** ${f.dependencies}\n\n`;
  }
  break;
```

---

### Phase 2: Fix Synthesis Integration

#### 2.1 Pass Structured Context to Synthesis

**File**: `scripts/evaluate.ts`

```typescript
// Update saveFinalSynthesis call (around line 238)
if (debateResult) {
  await saveFinalSynthesis(
    ideaData.id,
    sessionId,
    debateResult,
    finalScore,
    interpretation.recommendation,
    structuredContext  // ADD THIS PARAMETER
  );
}
```

#### 2.2 Update saveFinalSynthesis Function

**File**: `scripts/evaluate.ts`

```typescript
async function saveFinalSynthesis(
  ideaId: string,
  sessionId: string,
  debateResult: FullDebateResult,
  finalScore: number,
  recommendation: string,
  structuredContext?: StructuredEvaluationContext | null  // ADD PARAMETER
): Promise<void> {
  // Calculate actual readiness from structured context
  const readinessPercent = structuredContext?.coverage.overall ?? 0;

  // Extract actual unanswered questions
  const unresolvedQuestions = getActualUnresolvedQuestions(structuredContext);

  // ... rest of function
}

function getActualUnresolvedQuestions(
  structuredContext?: StructuredEvaluationContext | null
): string[] {
  if (!structuredContext) {
    return ['Complete the development questions to get specific feedback'];
  }

  const gaps: string[] = [];
  const coverage = structuredContext.coverage.byCategory;

  if ((coverage.problem ?? 0) < 0.5) {
    gaps.push('Problem definition needs more detail');
  }
  if ((coverage.solution ?? 0) < 0.5) {
    gaps.push('Solution approach needs clarification');
  }
  if ((coverage.market ?? 0) < 0.5) {
    gaps.push('Market analysis is incomplete');
  }
  if ((coverage.feasibility ?? 0) < 0.5) {
    gaps.push('Feasibility assessment needs more information');
  }
  if ((coverage.risk ?? 0) < 0.5) {
    gaps.push('Risk identification is incomplete');
  }

  return gaps.length > 0 ? gaps : [];
}
```

#### 2.3 Fix Confidence Calculation

**File**: `scripts/evaluate.ts`

```typescript
// Replace hardcoded confidence
const confidenceFromData = structuredContext
  ? Math.min(0.9, 0.5 + (structuredContext.coverage.overall * 0.4))
  : 0.5;
```

---

### Phase 3: Create Fit Questions

#### 3.1 Create fit.yaml

**File**: `questions/fit.yaml`

```yaml
category: fit
questions:
  - id: FT1_GOALS
    criterion: FT1
    category: fit
    text: "How does this idea align with your personal/business goals?"
    priority: critical
    question_type: open

  - id: FT2_PASSION
    criterion: FT2
    category: fit
    text: "What's your personal connection or passion for this problem space?"
    priority: high
    question_type: open

  - id: FT3_SKILLS
    criterion: FT3
    category: fit
    text: "What relevant skills and experience do you bring to this idea?"
    priority: high
    question_type: open

  - id: FT4_NETWORK
    criterion: FT4
    category: fit
    text: "What connections or relationships can help you execute this?"
    priority: medium
    question_type: open

  - id: FT5_TIMING
    criterion: FT5
    category: fit
    text: "Why is this the right time in your life to pursue this?"
    priority: medium
    question_type: open
```

#### 3.2 Update Readiness Calculation

**File**: `questions/readiness.ts`

```typescript
// Replace line 305
fit: await calculateFitCoverage(ideaId),  // Instead of binary profile check

async function calculateFitCoverage(ideaId: string): Promise<number> {
  const profileLinked = await hasLinkedProfile(ideaId);
  const fitAnswers = await getAnswersForCategory(ideaId, 'fit');

  // Profile worth 50%, questions worth 50%
  const profileScore = profileLinked ? 0.5 : 0;
  const questionScore = (fitAnswers.length / 5) * 0.5;

  return profileScore + questionScore;
}
```

---

### Phase 4: Fix N+1 Query Problem

#### 4.1 Batch Load Questions

**File**: `scripts/evaluate.ts`

```typescript
async function getStructuredContext(ideaId: string): Promise<StructuredEvaluationContext | null> {
  const answers = await getAnswersForIdea(ideaId);
  if (!answers || answers.length === 0) return null;

  // Batch load ALL questions at once
  const questionIds = answers.map(a => a.questionId);
  const questions = await getQuestionsByIds(questionIds);  // NEW FUNCTION
  const questionMap = new Map(questions.map(q => [q.id, q]));

  // Now iterate without additional queries
  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) continue;
    // ... rest of mapping logic
  }
}
```

#### 4.2 Add Batch Query Function

**File**: `questions/loader.ts`

```typescript
export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const rows = await query<DBQuestion>(
    `SELECT * FROM question_bank WHERE id IN (${placeholders})`,
    ids
  );

  return rows.map(rowToQuestion);
}
```

---

### Phase 5: Frontend Fixes

#### 5.1 Add Readiness to Overview Tab

**File**: `frontend/src/pages/IdeaDetail.tsx`

```tsx
// Add ReadinessMeter to overview tab (around line 380)
{activeTab === 'overview' && (
  <div className="space-y-6">
    {/* Add mini readiness indicator */}
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-500 mb-2">Evaluation Readiness</h3>
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-500 h-2 rounded-full"
            style={{ width: `${readiness?.readinessPercent ?? 0}%` }}
          />
        </div>
        <span className="text-sm font-medium">
          {Math.round(readiness?.readinessPercent ?? 0)}%
        </span>
        {!readiness?.readyForEvaluation && (
          <button
            onClick={() => setActiveTab('develop')}
            className="text-sm text-primary-600 hover:underline"
          >
            Develop idea
          </button>
        )}
      </div>
    </div>
    {/* ... rest of overview */}
  </div>
)}
```

#### 5.2 Add Pre-Evaluation Summary

**File**: `frontend/src/pages/IdeaDetail.tsx`

```tsx
// Before triggering evaluation, show what data will be used
const [showEvalPreview, setShowEvalPreview] = useState(false);
const [structuredData, setStructuredData] = useState(null);

const handleEvaluateClick = async () => {
  // Fetch structured data preview
  const res = await fetch(`/api/ideas/${idea.slug}/structured-data`);
  const data = await res.json();
  setStructuredData(data.data);
  setShowEvalPreview(true);
};

// Modal showing what evaluators will see
{showEvalPreview && (
  <EvaluationPreviewModal
    structuredData={structuredData}
    profile={linkedProfile}
    onConfirm={triggerEvaluation}
    onCancel={() => setShowEvalPreview(false)}
  />
)}
```

#### 5.3 Fix Answer Submission Error Handling

**File**: `frontend/src/components/DevelopmentWizard.tsx`

```tsx
const [submitError, setSubmitError] = useState<string | null>(null);

try {
  const response = await fetch(...);
  if (!response.ok) {
    throw new Error(`Failed to save: ${response.statusText}`);
  }
  setSubmitError(null);
} catch (err) {
  setSubmitError('Failed to save answer. Please try again.');
  // Don't increment totalAnswered on failure
  return;
}

// Show error in UI
{submitError && (
  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
    {submitError}
  </div>
)}
```

#### 5.4 Reduce API Calls on Wizard Open

**File**: `frontend/src/components/DevelopmentWizard.tsx`

```tsx
// Consolidate to single fetch
useEffect(() => {
  const loadData = async () => {
    // Single endpoint that returns everything
    const res = await fetch(`/api/ideas/${ideaSlug}/develop/init`);
    const data = await res.json();

    setQuestions(data.questions);
    setAnswers(new Map(data.answers.map(a => [a.questionId, a])));
    setReadiness(data.readiness);
    setTotalQuestions(data.totalQuestions);
    setTotalAnswered(data.answeredCount);
  };
  loadData();
}, [ideaSlug]);
```

---

### Phase 6: Fix Business Model Criterion IDs

**File**: `questions/business_model.yaml`

```yaml
# Change criterion values to match category
- id: BM_MODEL
  criterion: BM1    # Was S1
  category: business_model

- id: BM_CAC
  criterion: BM2    # Was M1
  category: business_model
```

---

## Implementation Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| P0 | Complete question ID mapping | 2 hours | Critical - fixes 75% data loss |
| P0 | Pass structuredContext to synthesis | 1 hour | Critical - fixes synthesis disconnect |
| P1 | Update StructuredAnswerData interface | 1 hour | High - enables new data |
| P1 | Update formatStructuredDataForPrompt | 2 hours | High - evaluators get all data |
| P1 | Fix unresolved questions extraction | 1 hour | High - accurate synthesis |
| P2 | Create fit.yaml questions | 1 hour | Medium - improves fit evaluation |
| P2 | Fix N+1 query problem | 2 hours | Medium - performance |
| P2 | Add readiness to overview tab | 1 hour | Medium - UX improvement |
| P3 | Add pre-evaluation preview | 3 hours | Medium - UX improvement |
| P3 | Fix answer submission errors | 1 hour | Low - error handling |
| P3 | Reduce wizard API calls | 2 hours | Low - performance |

---

## Testing Checklist

After implementation:

- [ ] Answer 10 questions across different categories
- [ ] Run evaluation and verify structured context includes all answers
- [ ] Check synthesis shows actual coverage percentage (not 0%)
- [ ] Verify unresolved questions reflect actual gaps
- [ ] Confirm feasibility evaluation includes resource/timeline data
- [ ] Test fit questions appear and affect readiness
- [ ] Verify evaluation startup time improved (no N+1)
- [ ] Check frontend shows readiness on overview tab
- [ ] Test answer submission error handling

---

## Files to Modify

1. `scripts/evaluate.ts` - Question mapping, synthesis integration
2. `agents/evaluator.ts` - StructuredAnswerData interface, formatStructuredDataForPrompt
3. `agents/specialized-evaluators.ts` - Already fixed in previous session
4. `questions/readiness.ts` - Fit coverage calculation
5. `questions/loader.ts` - Batch query function
6. `questions/fit.yaml` - NEW FILE
7. `questions/business_model.yaml` - Fix criterion IDs
8. `frontend/src/pages/IdeaDetail.tsx` - Readiness display, preview modal
9. `frontend/src/components/DevelopmentWizard.tsx` - Error handling, API consolidation
10. `frontend/src/components/ReadinessMeter.tsx` - Better explanations
