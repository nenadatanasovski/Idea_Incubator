# Dynamic Questioning System - Implementation Plan

> A first-principles approach to transforming raw sparks into evaluation-ready ideas through adaptive questioning.

## Executive Summary

The current idea form captures minimal structured data (title, summary, type, stage, tags, free-text content), forcing evaluators to infer information for all 30 criteria. This creates low-confidence evaluations and inconsistent scores.

This document outlines a system that progressively develops ideas through dynamic questioning until they have sufficient substance for meaningful evaluation.

---

## Part 1: First Principles Analysis

### The Fundamental Problem

**Why do ideas fail evaluation?**

Working backwards from evaluation failures:

1. **Insufficient information** → Evaluator must guess → Low confidence scores
2. **Wrong information** → Evaluator misunderstands intent → Misaligned recommendations
3. **Scattered information** → Evaluator misses context → Incomplete analysis

**Root cause**: The gap between what the user _knows_ about their idea and what they _document_ about their idea.

### What Does an Evaluator Actually Need?

For each of the 30 criteria, the evaluator needs **evidence** to score:

| Category                | What Evaluator Seeks                                                                                                   | Current Gap            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Problem (P1-P5)**     | Clear problem statement, severity evidence, target user specifics, validation data, competitive problem-space analysis | Often assumed or vague |
| **Solution (S1-S5)**    | Technical approach, differentiation, moat, scale characteristics                                                       | Usually aspirational   |
| **Feasibility (F1-F5)** | Technical plan, resource needs, skill assessment, timeline, dependencies                                               | Rarely specified       |
| **Fit (FT1-FT5)**       | Now covered by profile linking                                                                                         | **SOLVED**             |
| **Market (M1-M5)**      | TAM/SAM/SOM, growth data, competition map, barriers, timing analysis                                                   | Usually absent         |
| **Risk (R1-R5)**        | Identified risks, mitigation plans, kill conditions                                                                    | Almost never present   |

### The Insight

**An idea is "evaluation-ready" when it provides sufficient evidence for an evaluator to score each criterion with confidence > 70%.**

The question becomes: _How do we systematically elicit this evidence from the user?_

---

## Part 2: System Design

### 2.1 The Readiness Model

We define **Idea Readiness** as a function of information completeness:

```
Readiness Score = Σ (criterion_coverage × criterion_weight) / total_weight

Where:
- criterion_coverage = 0 (no info), 0.5 (partial), 1 (sufficient)
- criterion_weight = importance for that lifecycle stage
```

**Readiness Thresholds:**

- `< 30%`: SPARK - Too early for meaningful evaluation
- `30-60%`: CLARIFY - Needs more development
- `60-80%`: READY - Can evaluate with caveats
- `> 80%`: CONFIDENT - Full evaluation possible

### 2.2 Question Taxonomy

Questions are organized by:

1. **Criterion Mapping** - Which evaluation criterion(s) does this answer inform?
2. **Priority Level** - Critical / Important / Nice-to-have
3. **Question Type** - Factual / Analytical / Reflective
4. **Idea Type Relevance** - Business / Technical / Creative / Personal / Research
5. **Lifecycle Relevance** - When is this question most appropriate?

### 2.3 Dynamic Question Selection Algorithm

```
function selectNextQuestions(idea, previousAnswers, profile):
  1. Calculate current readiness scores per criterion
  2. Identify criteria with coverage < threshold
  3. Weight by:
     - Criterion importance for idea type
     - Criterion importance for lifecycle stage
     - Gap severity (lower coverage = higher priority)
     - Dependency satisfaction (some questions require prior answers)
  4. Select top 3-5 questions from highest-weighted gaps
  5. Adapt phrasing based on:
     - Idea type context
     - Previous answers (avoid repetition, build on context)
     - Profile context (technical depth, domain familiarity)
  6. Return questions with metadata for UI rendering
```

---

## Part 3: Question Bank

### 3.1 Problem Category Questions

#### P1: Problem Clarity

```yaml
questions:
  - id: P1_CORE
    text: "In one sentence, what specific problem does this solve?"
    type: factual
    priority: critical
    follow_ups:
      - "Who experiences this problem most acutely?"
      - "When/where does this problem typically occur?"

  - id: P1_SCOPE
    text: "Is this ONE problem or multiple related problems? If multiple, which is PRIMARY?"
    type: analytical
    priority: important
    depends_on: P1_CORE
```

#### P2: Problem Severity

```yaml
questions:
  - id: P2_PAIN
    text: "On a scale of 'minor annoyance' to 'business critical', how painful is this problem?"
    type: reflective
    priority: critical

  - id: P2_COST
    text: "What does this problem cost the target user? (time, money, frustration, opportunity)"
    type: factual
    priority: critical

  - id: P2_FREQUENCY
    text: "How often does the target user encounter this problem?"
    type: factual
    priority: important

  - id: P2_ALTERNATIVES
    text: "How do people currently cope with this problem? What's their workaround?"
    type: factual
    priority: important
```

#### P3: Target User Clarity

```yaml
questions:
  - id: P3_WHO
    text: "Describe your ideal customer in one sentence. Be specific (not 'everyone' or 'businesses')."
    type: factual
    priority: critical

  - id: P3_SEGMENT
    text: "What characteristics define your target user? (demographics, behaviors, circumstances)"
    type: factual
    priority: critical

  - id: P3_SIZE
    text: "Roughly how many people/businesses fit your target user description?"
    type: factual
    priority: important

  - id: P3_ACCESS
    text: "Where do these target users congregate? How would you reach them?"
    type: analytical
    priority: important
```

#### P4: Problem Validation

```yaml
questions:
  - id: P4_EVIDENCE
    text: "What evidence do you have that this problem exists and matters? (interviews, data, personal experience)"
    type: factual
    priority: critical

  - id: P4_CONVERSATIONS
    text: "Have you talked to potential users about this problem? What did they say?"
    type: factual
    priority: critical

  - id: P4_WILLINGNESS
    text: "Have potential users expressed willingness to pay for a solution? How much?"
    type: factual
    priority: important
```

#### P5: Problem Uniqueness

```yaml
questions:
  - id: P5_EXISTING
    text: "What solutions currently exist for this problem?"
    type: factual
    priority: critical

  - id: P5_GAP
    text: "Why haven't existing solutions fully solved this problem?"
    type: analytical
    priority: important

  - id: P5_ANGLE
    text: "What aspect of this problem are you addressing that others have missed?"
    type: analytical
    priority: important
```

### 3.2 Solution Category Questions

#### S1: Solution Clarity

```yaml
questions:
  - id: S1_WHAT
    text: "In one paragraph, describe what you're building and how it works."
    type: factual
    priority: critical

  - id: S1_VALUE_PROP
    text: "What's the single most important benefit users get from your solution?"
    type: analytical
    priority: critical

  - id: S1_HOW
    text: "Walk through how a user would use your solution to solve their problem."
    type: factual
    priority: important
```

#### S2: Solution Feasibility

```yaml
questions:
  - id: S2_TECH
    text: "What technology/approach would you use to build this?"
    type: factual
    priority: critical
    idea_types: [business, technical]

  - id: S2_PROVEN
    text: "Has this type of solution been built before? What's novel about your approach?"
    type: analytical
    priority: important

  - id: S2_HARD
    text: "What's the technically hardest part of building this?"
    type: analytical
    priority: important
```

#### S3: Solution Uniqueness

```yaml
questions:
  - id: S3_DIFF
    text: "How is your solution different from existing alternatives?"
    type: analytical
    priority: critical

  - id: S3_WHY_BETTER
    text: "Why would someone choose your solution over competitors?"
    type: analytical
    priority: critical

  - id: S3_SECRET
    text: "What do you know or believe that competitors don't?"
    type: reflective
    priority: important
```

#### S4: Solution Scalability

```yaml
questions:
  - id: S4_SCALE
    text: "If you had 10x more users tomorrow, what would break?"
    type: analytical
    priority: important

  - id: S4_MARGINAL
    text: "Does serving each additional customer cost you time/money, or is it nearly free?"
    type: analytical
    priority: important
```

#### S5: Solution Defensibility

```yaml
questions:
  - id: S5_MOAT
    text: "What would make it hard for competitors to copy your solution?"
    type: analytical
    priority: important

  - id: S5_PROTECTION
    text: "Do you have or could you get any IP protection? (patents, trade secrets, brand)"
    type: factual
    priority: nice-to-have

  - id: S5_NETWORK
    text: "Does your solution get better as more people use it? (network effects)"
    type: analytical
    priority: important
```

### 3.3 Feasibility Category Questions

#### F1: Technical Complexity

```yaml
questions:
  - id: F1_MVP
    text: "What's the simplest possible version that delivers value?"
    type: analytical
    priority: critical

  - id: F1_COMPONENTS
    text: "What are the main technical components you need to build?"
    type: factual
    priority: important
    idea_types: [business, technical]

  - id: F1_UNKNOWNS
    text: "What technical questions do you not yet know the answer to?"
    type: reflective
    priority: important
```

#### F2: Resource Requirements

```yaml
questions:
  - id: F2_COST
    text: "What will it cost to build an MVP? (rough estimate)"
    type: factual
    priority: important

  - id: F2_TEAM
    text: "What skills/roles would you need on a team to build this?"
    type: factual
    priority: important

  - id: F2_TOOLS
    text: "What tools, services, or infrastructure would you need?"
    type: factual
    priority: nice-to-have
```

#### F3: Skill Availability

_Note: Now largely covered by profile linking, but specific idea context matters_

```yaml
questions:
  - id: F3_GAP
    text: "What skills does this idea require that you don't currently have?"
    type: reflective
    priority: important

  - id: F3_ACQUIRE
    text: "How would you acquire the missing skills? (learn, hire, partner)"
    type: analytical
    priority: important
```

#### F4: Time to Value

```yaml
questions:
  - id: F4_FIRST_VALUE
    text: "How long until you could show this to a real user and get feedback?"
    type: factual
    priority: critical

  - id: F4_FIRST_REVENUE
    text: "How long until this could generate its first dollar of revenue?"
    type: factual
    priority: important
    idea_types: [business]
```

#### F5: Dependency Risk

```yaml
questions:
  - id: F5_DEPS
    text: "What external factors does your idea depend on? (APIs, platforms, regulations, partners)"
    type: factual
    priority: important

  - id: F5_CONTROL
    text: "Which dependencies are outside your control? What if they change?"
    type: analytical
    priority: important
```

### 3.4 Market Category Questions

#### M1: Market Size

```yaml
questions:
  - id: M1_TAM
    text: "How big is the total market for solutions like yours? (TAM)"
    type: factual
    priority: important
    idea_types: [business]

  - id: M1_SAM
    text: "What portion of that market could you realistically serve? (SAM)"
    type: analytical
    priority: important
    idea_types: [business]

  - id: M1_SOM
    text: "What market share could you capture in year 1-2? (SOM)"
    type: analytical
    priority: nice-to-have
    idea_types: [business]
```

#### M2: Market Growth

```yaml
questions:
  - id: M2_TREND
    text: "Is the market for this growing, shrinking, or stable?"
    type: factual
    priority: important

  - id: M2_DRIVERS
    text: "What's driving growth/decline in this market?"
    type: analytical
    priority: nice-to-have
```

#### M3: Competition Intensity

```yaml
questions:
  - id: M3_COMPETITORS
    text: "Who are your top 3-5 competitors? (direct and indirect)"
    type: factual
    priority: critical

  - id: M3_LANDSCAPE
    text: "Is this market crowded or relatively open? Why?"
    type: analytical
    priority: important

  - id: M3_COMP_WEAKNESS
    text: "What do existing competitors do poorly?"
    type: analytical
    priority: important
```

#### M4: Entry Barriers

```yaml
questions:
  - id: M4_BARRIERS
    text: "What barriers exist to entering this market? (capital, regulations, relationships)"
    type: factual
    priority: important

  - id: M4_OVERCOME
    text: "How would you overcome these barriers?"
    type: analytical
    priority: important
```

#### M5: Timing

```yaml
questions:
  - id: M5_WHY_NOW
    text: "Why is NOW the right time for this idea?"
    type: analytical
    priority: important

  - id: M5_CATALYST
    text: "Is there a recent event or trend that makes this more viable now?"
    type: factual
    priority: nice-to-have
```

### 3.5 Risk Category Questions

#### R1-R5: Risk Assessment

```yaml
questions:
  - id: R_BIGGEST
    text: "What's the biggest risk that could cause this idea to fail?"
    type: reflective
    priority: critical

  - id: R_EXECUTION
    text: "What could go wrong in building this?"
    type: analytical
    priority: important

  - id: R_MARKET
    text: "What could go wrong with market adoption?"
    type: analytical
    priority: important

  - id: R_TECHNICAL
    text: "What could go wrong technically?"
    type: analytical
    priority: important

  - id: R_FINANCIAL
    text: "What's your financial worst-case scenario? Can you survive it?"
    type: reflective
    priority: important

  - id: R_REGULATORY
    text: "Are there any legal, regulatory, or compliance concerns?"
    type: factual
    priority: important

  - id: R_KILL
    text: "What would cause you to abandon this idea entirely?"
    type: reflective
    priority: nice-to-have
```

### 3.6 Revenue & Business Model (for business ideas)

```yaml
questions:
  - id: BM_MODEL
    text: "How will this make money? (subscription, transaction, ads, freemium, etc.)"
    type: factual
    priority: critical
    idea_types: [business]

  - id: BM_PRICE
    text: "What would you charge? What's your pricing logic?"
    type: analytical
    priority: important
    idea_types: [business]

  - id: BM_CAC
    text: "How much would it cost to acquire a customer?"
    type: analytical
    priority: nice-to-have
    idea_types: [business]

  - id: BM_LTV
    text: "How much revenue would a customer generate over their lifetime?"
    type: analytical
    priority: nice-to-have
    idea_types: [business]
```

---

## Part 4: Data Model

### 4.1 New Database Tables

```sql
-- Question definitions (static, loaded from YAML)
CREATE TABLE question_bank (
  id TEXT PRIMARY KEY,
  criterion TEXT NOT NULL,           -- P1, P2, S1, etc.
  category TEXT NOT NULL,            -- problem, solution, feasibility, fit, market, risk
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,       -- factual, analytical, reflective
  priority TEXT NOT NULL,            -- critical, important, nice-to-have
  idea_types TEXT,                   -- JSON array: null = all types
  lifecycle_stages TEXT,             -- JSON array: null = all stages
  depends_on TEXT,                   -- JSON array of question IDs
  follow_up_ids TEXT,               -- JSON array of follow-up question IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Answers for each idea
CREATE TABLE idea_answers (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES question_bank(id),
  answer TEXT NOT NULL,
  answer_source TEXT DEFAULT 'user', -- user, ai_extracted, ai_inferred
  confidence REAL DEFAULT 1.0,       -- 0-1, for AI-extracted answers
  answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(idea_id, question_id)
);

-- Criterion coverage tracking
CREATE TABLE idea_readiness (
  idea_id TEXT PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
  overall_readiness REAL NOT NULL DEFAULT 0,
  problem_coverage REAL DEFAULT 0,
  solution_coverage REAL DEFAULT 0,
  feasibility_coverage REAL DEFAULT 0,
  fit_coverage REAL DEFAULT 0,        -- From profile linking
  market_coverage REAL DEFAULT 0,
  risk_coverage REAL DEFAULT 0,
  last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Question sessions (development conversations)
CREATE TABLE development_sessions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  questions_asked INTEGER DEFAULT 0,
  questions_answered INTEGER DEFAULT 0,
  readiness_before REAL,
  readiness_after REAL
);

-- Indexes
CREATE INDEX idx_answers_idea ON idea_answers(idea_id);
CREATE INDEX idx_answers_question ON idea_answers(question_id);
CREATE INDEX idx_sessions_idea ON development_sessions(idea_id);
```

### 4.2 Views

```sql
-- Per-criterion coverage view
CREATE VIEW idea_criterion_coverage AS
SELECT
  ia.idea_id,
  qb.criterion,
  qb.category,
  COUNT(CASE WHEN ia.answer IS NOT NULL THEN 1 END) as answered,
  COUNT(*) as total_questions,
  CAST(COUNT(CASE WHEN ia.answer IS NOT NULL THEN 1 END) AS REAL) / COUNT(*) as coverage
FROM question_bank qb
LEFT JOIN idea_answers ia ON ia.question_id = qb.id
GROUP BY ia.idea_id, qb.criterion, qb.category;

-- Idea readiness summary view
CREATE VIEW idea_readiness_summary AS
SELECT
  i.id as idea_id,
  i.slug,
  i.title,
  i.idea_type,
  i.lifecycle_stage,
  COALESCE(ir.overall_readiness, 0) as readiness,
  CASE
    WHEN COALESCE(ir.overall_readiness, 0) < 0.3 THEN 'SPARK'
    WHEN COALESCE(ir.overall_readiness, 0) < 0.6 THEN 'CLARIFY'
    WHEN COALESCE(ir.overall_readiness, 0) < 0.8 THEN 'READY'
    ELSE 'CONFIDENT'
  END as readiness_level,
  (SELECT COUNT(*) FROM idea_answers WHERE idea_id = i.id) as answers_count
FROM ideas i
LEFT JOIN idea_readiness ir ON ir.idea_id = i.id;
```

---

## Part 5: API Endpoints

### 5.1 New Endpoints

```typescript
// Get next questions for an idea
GET /api/ideas/:slug/questions
Response: {
  questions: Question[],
  readiness: ReadinessScore,
  coverage: CategoryCoverage[]
}

// Submit answer to a question
POST /api/ideas/:slug/answers
Body: { question_id: string, answer: string }
Response: {
  success: boolean,
  next_questions: Question[],
  updated_readiness: ReadinessScore
}

// Get all answers for an idea
GET /api/ideas/:slug/answers
Response: { answers: Answer[], coverage: CategoryCoverage[] }

// Get readiness assessment
GET /api/ideas/:slug/readiness
Response: {
  overall: number,
  by_category: { problem, solution, feasibility, fit, market, risk },
  by_criterion: CriterionCoverage[],
  ready_for_evaluation: boolean,
  blocking_gaps: string[]
}

// Start/continue development session
POST /api/ideas/:slug/develop
Body: { mode: 'start' | 'continue' }
Response: { session_id: string, questions: Question[] }

// AI-assisted answer extraction from content
POST /api/ideas/:slug/extract-answers
Body: { content: string }
Response: {
  extracted: { question_id: string, answer: string, confidence: number }[],
  needs_clarification: string[]
}
```

### 5.2 Modified Endpoints

```typescript
// Enhanced idea creation - parse content for answers
POST /api/ideas
Body: {
  title, summary, type, stage, content, tags,
  auto_extract_answers?: boolean  // NEW: Extract answers from content
}

// Enhanced evaluation trigger - check readiness first
POST /api/ideas/:slug/evaluate
Body: {
  budget,
  force?: boolean,  // NEW: Run even if not ready
  include_answers?: boolean  // NEW: Pass structured answers to evaluators
}
Response: {
  // If not ready and force=false:
  ready: false,
  readiness: number,
  blocking_gaps: string[],
  suggested_questions: Question[]

  // If ready or force=true:
  ready: true,
  runId: string,
  message: string
}
```

---

## Part 6: Frontend Components

### 6.1 New Components

#### DevelopmentWizard

Modal/page for guided idea development:

- Shows current readiness with visual progress
- Presents questions one at a time or in batches
- Allows free-form answers with AI-assist suggestions
- Updates readiness in real-time
- Suggests when idea is ready for evaluation

#### ReadinessMeter

Visual component showing:

- Overall readiness percentage
- Category breakdown radar chart
- Blocking gaps with question links
- "Run Evaluation" button (enabled/disabled based on readiness)

#### AnswerHistory

Panel showing all captured answers:

- Grouped by category/criterion
- Editable inline
- Shows source (user, extracted, inferred)
- Confidence indicators for AI answers

#### QuestionCard

Individual question display:

- Question text with context
- Input area (text, select, multi-select depending on type)
- "Skip" and "Don't know" options
- Follow-up indicator
- Criterion mapping badge

### 6.2 Modified Components

#### IdeaForm

Enhanced with:

- Post-save prompt: "Would you like to develop this idea further?"
- Auto-extraction option for content
- Readiness preview

#### IdeaDetail

Enhanced with:

- Readiness meter in header
- "Develop Idea" button alongside "Run Evaluation"
- Warning when evaluating underdeveloped ideas
- Answers panel/tab

#### EvaluationScorecard

Enhanced with:

- Per-criterion evidence links (from answers)
- Confidence indicator based on information completeness
- "Improve this score" → links to relevant questions

---

## Part 7: Evaluation Integration

### 7.1 Passing Structured Data to Evaluators

The key innovation: evaluators receive **structured answers** alongside free-form content.

```typescript
interface EvaluationContext {
  idea: {
    title: string;
    summary: string;
    content: string; // Original markdown
    type: IdeaType;
    stage: LifecycleStage;
  };

  // NEW: Structured answers
  structured_data: {
    problem: {
      core_problem: string; // From P1_CORE
      target_user: string; // From P3_WHO
      severity: string; // From P2_PAIN
      validation: string; // From P4_EVIDENCE
      competitors: string[]; // From P5_EXISTING
    };
    solution: {
      description: string; // From S1_WHAT
      differentiation: string; // From S3_DIFF
      mvp: string; // From F1_MVP
    };
    market: {
      size: string; // From M1_TAM
      competitors: string[]; // From M3_COMPETITORS
      timing: string; // From M5_WHY_NOW
    };
    risks: {
      biggest: string; // From R_BIGGEST
      mitigations: string[];
    };
    business_model?: {
      revenue_model: string; // From BM_MODEL
      pricing: string; // From BM_PRICE
    };
  };

  // NEW: Answer completeness
  coverage: {
    overall: number;
    by_criterion: Record<string, number>;
  };

  // Existing: Profile data
  profile?: UserProfile;
}
```

### 7.2 Modified Evaluator Prompts

Evaluators receive explicit instructions:

```
You are evaluating an idea with the following structured information:

## Structured Answers (High Confidence)
${formatStructuredData(context.structured_data)}

## Original Content (Reference)
${context.idea.content}

## Information Completeness
- Overall: ${coverage.overall}%
- This criterion (${criterion}): ${coverage.by_criterion[criterion]}%

INSTRUCTIONS:
1. Prioritize structured answers over inferred information
2. When structured data exists for a criterion, use it as primary evidence
3. When structured data is missing, note this affects confidence
4. Do NOT penalize ideas for missing information - adjust confidence instead
5. Score based on what IS known, confidence based on completeness
```

### 7.3 Confidence Calibration

```typescript
function calculateCriterionConfidence(
  criterion: string,
  coverage: CriterionCoverage,
  debateResults: DebateResults,
): number {
  // Base confidence from information completeness
  const informationConfidence = coverage.answered / coverage.total_questions;

  // Debate performance modifier
  const debateModifier = debateResults.survivalRate;

  // Combined confidence
  return informationConfidence * 0.6 + debateModifier * 0.4;
}
```

---

## Part 8: Implementation Phases

### Phase 1: Foundation (Core Data Model)

**Effort: 2-3 days**

1. Create database migrations for new tables
2. Implement question bank loader (from YAML)
3. Add basic API endpoints for answers
4. Create readiness calculation logic

**Deliverables:**

- `npm run migrate` adds new tables
- Question bank populated
- `GET /api/ideas/:slug/readiness` works

### Phase 2: Answer Capture

**Effort: 3-4 days**

1. Build QuestionCard component
2. Build basic DevelopmentWizard
3. Implement answer submission flow
4. Add answer history panel

**Deliverables:**

- Users can answer questions via UI
- Answers persist to database
- Readiness updates automatically

### Phase 3: Smart Question Selection

**Effort: 2-3 days**

1. Implement question selection algorithm
2. Add idea-type filtering
3. Add lifecycle-stage filtering
4. Implement question dependencies

**Deliverables:**

- Questions adapt to idea type
- Questions respect dependencies
- Priority ordering works

### Phase 4: Evaluation Integration

**Effort: 3-4 days**

1. Modify evaluation trigger to check readiness
2. Pass structured data to evaluators
3. Update evaluator prompts
4. Add confidence calibration

**Deliverables:**

- Evaluators receive structured answers
- Confidence reflects information completeness
- UI shows pre-eval readiness check

### Phase 5: AI Answer Extraction

**Effort: 2-3 days**

1. Build content parser agent
2. Extract answers from existing content
3. Add confidence scoring for extractions
4. UI for reviewing extracted answers

**Deliverables:**

- `POST /api/ideas/:slug/extract-answers` works
- Extracted answers marked with confidence
- User can confirm/edit extractions

### Phase 6: Polish & Integration

**Effort: 2-3 days**

1. ReadinessMeter component
2. Integrate into IdeaDetail page
3. Add "Improve Score" links in scorecard
4. Development session history

**Deliverables:**

- Full UI integration
- Seamless development → evaluation flow
- Historical session tracking

---

## Part 9: Success Metrics

### Quantitative

- **Readiness improvement**: Track average readiness before/after development sessions
- **Evaluation confidence**: Track average confidence scores pre/post implementation
- **Coverage rates**: % of criteria with structured answers
- **Time to ready**: How long from SPARK to evaluation-ready

### Qualitative

- **Evaluator feedback**: Are structured answers helpful?
- **User experience**: Is the questioning flow intuitive?
- **Score accuracy**: Do evaluations feel more accurate?

---

## Part 10: Future Enhancements

### 10.1 AI-Powered Question Generation

Instead of static question bank, AI generates contextual questions:

```
Given this idea about [topic] at [stage], and these existing answers,
generate 3 questions that would most improve evaluation confidence.
```

### 10.2 Answer Synthesis

AI synthesizes multiple answers into coherent narratives:

```
Based on answers to P1-P5, generate a "Problem Statement" section
for the idea README.
```

### 10.3 Competitive Intelligence

Auto-fetch competitive data:

```
Based on the described solution and market, identify and summarize
top 5 competitors from web search.
```

### 10.4 Validation Suggestions

Recommend validation activities:

```
Based on current answers and gaps, suggest 3 specific validation
activities the user could do to improve P4 (Problem Validation).
```

---

## Appendix A: Question Bank YAML Format

```yaml
# questions/problem.yaml
category: problem
questions:
  - id: P1_CORE
    criterion: P1
    text: "In one sentence, what specific problem does this solve?"
    type: factual
    priority: critical
    idea_types: null # all types
    lifecycle_stages: [SPARK, CLARIFY, RESEARCH]
    depends_on: null
    follow_ups: [P1_SCOPE, P1_WHEN]

  - id: P1_SCOPE
    criterion: P1
    text: "Is this ONE problem or multiple related problems?"
    type: analytical
    priority: important
    depends_on: [P1_CORE]
```

---

## Appendix B: Readiness Calculation Example

```typescript
function calculateReadiness(ideaId: string): ReadinessScore {
  const answers = getAnswers(ideaId);
  const idea = getIdea(ideaId);

  // Weight critical questions more heavily
  const priorityWeights = { critical: 3, important: 2, "nice-to-have": 1 };

  // Get relevant questions for this idea type and stage
  const relevantQuestions = getRelevantQuestions(idea.type, idea.stage);

  let totalWeight = 0;
  let answeredWeight = 0;

  for (const q of relevantQuestions) {
    const weight = priorityWeights[q.priority];
    totalWeight += weight;

    if (answers.has(q.id)) {
      answeredWeight += weight;
    }
  }

  // Calculate per-category coverage
  const categories = [
    "problem",
    "solution",
    "feasibility",
    "fit",
    "market",
    "risk",
  ];
  const byCatgeory = {};

  for (const cat of categories) {
    const catQuestions = relevantQuestions.filter((q) => q.category === cat);
    const catAnswers = catQuestions.filter((q) => answers.has(q.id));
    byCategory[cat] = catAnswers.length / catQuestions.length;
  }

  // Fit coverage comes from profile linking
  byCategory.fit = hasLinkedProfile(ideaId) ? 1.0 : 0.0;

  return {
    overall: answeredWeight / totalWeight,
    byCategory,
    readyForEvaluation: answeredWeight / totalWeight >= 0.6,
  };
}
```

---

## Conclusion

This system transforms idea development from a single free-text dump into a guided, progressive process that:

1. **Ensures completeness** - Users answer questions mapped to evaluation criteria
2. **Improves confidence** - Evaluators receive structured evidence, not guesses
3. **Respects user time** - Questions adapt based on idea type and existing answers
4. **Creates feedback loops** - Low scores link back to questions that could improve them
5. **Maintains flexibility** - Free-form content still supported, structured data enhances it

The result: higher-quality evaluations, more actionable recommendations, and a clearer path from spark to execution.
