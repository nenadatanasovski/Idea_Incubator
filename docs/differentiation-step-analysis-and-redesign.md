# Differentiation Step: Critical Analysis and Redesign Proposal

## Executive Summary

The current Differentiate step suffers from **fragmentation**, **shallow analysis**, and **poor user guidance**. While it generates four types of data (opportunities, strategies, risks, timing), it presents them as isolated islands with no explicit connections, leaving users to manually synthesize relationships. The step feels like a data dump rather than strategic decision support.

This document applies first-principles reasoning to identify root causes and proposes a cohesive redesign that transforms the Differentiate step from passive information display to active decision facilitation.

---

## Part 1: Critical Analysis of Current Implementation

### 1.1 The Fragmentation Problem

**Current State:**
The DifferentiationView renders four collapsible sections as independent accordion panels:
- Market Opportunities (Target segments with fit levels)
- Differentiation Strategies (Approaches with 5W+H details)
- Competitive Risks (Threats with severity)
- Market Timing (Window analysis)

**Why This Is Broken:**

From first principles, differentiation analysis exists to answer one question: *"How should this idea position itself to win in the market?"*

The answer requires **relational reasoning**:
- A strategy should ADDRESS specific opportunities
- A strategy should MITIGATE specific risks
- Timing should INFORM which strategies are viable now vs. later
- Opportunities should BE VALIDATED against competitive landscape

The current implementation breaks these relationships by presenting each data type in isolation. The user sees:
```
[Opportunity A] [Opportunity B] [Opportunity C]
[Strategy 1] [Strategy 2] [Strategy 3]
[Risk X] [Risk Y] [Risk Z]
```

But never:
```
Strategy 1 → targets Opportunity A → mitigates Risk X → viable in current timing window
```

**Impact:** Users cannot make informed decisions because they're given puzzle pieces without the picture on the box.

### 1.2 The Shallowness Problem

**Current State:**
- Opportunities show: segment, description, fit level, confidence, reasons
- Strategies show: approach, description, aligned with, risks, 5W+H (hidden)
- Risks show: competitor, threat, severity, mitigation
- Timing shows: window, urgency, trends, recommendation

**Why This Is Shallow:**

1. **No Comparative Analysis**: Users cannot compare strategies side-by-side. Each strategy card exists in isolation, requiring mental gymnastics to evaluate trade-offs.

2. **5W+H Is Hidden**: The most actionable part of each strategy (the detailed 5W+H breakdown) is collapsed by default. Users see surface-level descriptions but miss implementation guidance.

3. **Fit Scores Are Opaque**: Strategies show "Fit: 7/10" but don't explain WHY. Which profile attributes drove this score? What could improve it?

4. **No Prioritization Logic**: Three strategies with scores 8, 7, 6 are presented equally. There's no "recommended first" or "quick win vs. long-term bet" categorization.

5. **Missing Validation Status**: Strategies and opportunities are presented as facts, but many are hypotheses. No indication of what's validated vs. assumed.

### 1.3 The UX Problems

**Problem 1: Accordion Anti-Pattern**
Only one section can be expanded at a time. This prevents:
- Comparing opportunities while looking at strategies
- Checking risks while evaluating a strategy
- Cross-referencing timing with opportunities

**Problem 2: Passive Strategy Selection**
The "Select Strategy" button:
- Doesn't explain what selection means
- Doesn't persist after leaving the page
- Doesn't influence the Update phase
- Allows selecting multiple strategies with no guidance on combining them

**Problem 3: No Decision Framework**
Users aren't guided through a decision process:
- No "start here" indicator
- No recommended sequence
- No decision tree or checklist
- No summary of "what you've decided"

**Problem 4: Summary Is Just Text**
The summary field is unstructured prose. It should be:
- Key insights (bulleted)
- Recommended primary strategy (highlighted)
- Critical risks to address (flagged)
- Next steps (actionable)

### 1.4 The Disconnection from Adjacent Phases

**No Connection to Clarify:**
- Q&A answers from Clarify inform the analysis but aren't referenced
- User can't see HOW their answers shaped the opportunities/strategies
- No feedback loop: "Your answer about X led to Opportunity Y"

**Weak Connection to Update:**
- Selected strategies should directly inform Update phase suggestions
- Currently, Update phase runs independently with no awareness of strategy selection
- No continuity: "Since you selected Strategy 1, here's how to refine your idea..."

**No Connection to User Profile:**
- Profile data is used in fitWithProfile calculation but not displayed
- Users can't see: "This strategy scored high because your skills include X"
- No gap analysis: "This strategy would score higher if you addressed skill gap Y"

---

## Part 2: First Principles Redesign

### 2.1 Core Principle: Decision Support, Not Data Display

The Differentiate step should answer: **"Which positioning strategy should I pursue, and why?"**

This requires:
1. **Comparative framework** - See all options at once
2. **Relationship visibility** - Understand connections
3. **Recommendation engine** - Get guided suggestions
4. **Decision capture** - Record and act on choices

### 2.2 Proposed Information Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DIFFERENTIATION ANALYSIS                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  STRATEGIC SUMMARY (always visible)                         │ │
│  │  • Recommended Strategy: [Strategy Name]                    │ │
│  │  • Key Opportunity: [Segment Name]                          │ │
│  │  • Critical Risk to Address: [Risk Name]                    │ │
│  │  • Market Window: [Timing Assessment]                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  STRATEGY COMPARISON MATRIX                                 │ │
│  │  ┌─────────────┬─────────┬─────────┬─────────┐             │ │
│  │  │             │ Strat 1 │ Strat 2 │ Strat 3 │             │ │
│  │  ├─────────────┼─────────┼─────────┼─────────┤             │ │
│  │  │ Profile Fit │ 8/10    │ 6/10    │ 7/10    │             │ │
│  │  │ Opportunity │ High    │ Med     │ High    │             │ │
│  │  │ Risk Level  │ Med     │ Low     │ High    │             │ │
│  │  │ Time to Win │ 3-6 mo  │ 6-12 mo │ 1-3 mo  │             │ │
│  │  │ Resource $  │ $$      │ $       │ $$$     │             │ │
│  │  └─────────────┴─────────┴─────────┴─────────┘             │ │
│  │  [Quick Win] [Best Fit] [Highest Upside] ← Filter chips    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  SELECTED: Strategy 1 - "Premium Positioning"                │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  WHAT                                                    │ │ │
│  │  │  Build a curated coworking discovery platform...         │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  WHY (Strategic Rationale)                               │ │ │
│  │  │  • Addresses Opportunity: "Premium Professionals"        │ │ │
│  │  │  • Mitigates Risk: "Incumbent Aggregators"               │ │ │
│  │  │  • Aligns with Timing: "Remote work normalization"       │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  │  [Similar pattern for HOW, WHEN, WHERE, HOW MUCH]           │ │
│  │                                                              │ │
│  │  PROFILE FIT BREAKDOWN:                                      │ │
│  │  ✓ Your tech skills match implementation needs               │ │
│  │  ✓ Your network includes target users                        │ │
│  │  ⚠ Gap: Marketing expertise needed                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  RELATIONSHIP MAP (Visual)                                   │ │
│  │                                                              │ │
│  │  [Opp A]───────┐                                            │ │
│  │                ├──▶[Strategy 1]──▶ mitigates ─▶[Risk X]     │ │
│  │  [Opp B]───────┘                                            │ │
│  │                                                              │ │
│  │  [Opp C]─────────▶[Strategy 2]──▶ mitigates ─▶[Risk Y]      │ │
│  │                                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  YOUR DECISIONS                                              │ │
│  │  ☑ Primary Strategy: Premium Positioning                    │ │
│  │  ☐ Secondary Strategy: (optional)                           │ │
│  │  ☑ Key Risks Acknowledged: Incumbent response, Niche size   │ │
│  │  ☑ Timing: Proceed now (window favorable)                   │ │
│  │                                                              │ │
│  │  [Continue to Update Phase] ← Uses these decisions          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Key Design Changes

#### Change 1: Strategic Summary Always Visible
Instead of hiding the summary in a text block, create a structured "recommendation card" at the top that synthesizes:
- **Recommended strategy** (the highest-fit option)
- **Why it's recommended** (key factors)
- **What to watch out for** (primary risk)
- **When to act** (timing urgency)

#### Change 2: Strategy Comparison Matrix
Replace isolated strategy cards with a comparison table that allows side-by-side evaluation. Include:
- Profile fit score with breakdown
- Addressed opportunities (linked)
- Mitigated risks (linked)
- Resource requirements (normalized)
- Time to first milestone
- Reversibility/pivot potential

#### Change 3: 5W+H as Primary View, Not Hidden
When a strategy is selected, show its full 5W+H breakdown as the main content, not behind an expand button. This is the actionable detail users need.

#### Change 4: Visual Relationship Map
Add a simple graph/diagram showing:
- Which opportunities each strategy addresses
- Which risks each strategy mitigates
- Timing alignment

This can be a simple node-link diagram or even a structured list with visual connectors.

#### Change 5: Explicit Decision Capture
Add a "Your Decisions" section that:
- Records which strategy the user selected as primary
- Optionally records a secondary strategy
- Acknowledges key risks
- Confirms timing decision

This decision object flows to the Update phase.

#### Change 6: Profile Fit Transparency
Show WHY a strategy scored high/low on profile fit:
- Which skills matched
- Which network connections are relevant
- Which constraints apply
- Which gaps could be addressed

---

## Part 3: Implementation Roadmap

### Phase 1: Information Architecture (Backend)

**Goal:** Restructure the differentiation agent output to include relationships.

**Changes to `agents/differentiation.ts`:**

1. Add relationship fields to the prompt and response schema:
```typescript
interface EnrichedStrategy {
  // Existing fields...
  addressesOpportunities: string[];  // IDs of opportunities this targets
  mitigatesRisks: string[];          // IDs of risks this helps with
  timingAlignment: 'favorable' | 'neutral' | 'challenging';
  profileFitBreakdown: {
    strengths: string[];    // Profile attributes that help
    gaps: string[];         // Profile attributes missing
    suggestions: string[];  // How to address gaps
  };
}
```

2. Modify prompt to generate these relationships:
```
For each strategy, explicitly state:
- Which market opportunities (by ID) this strategy addresses
- Which competitive risks (by ID) this strategy mitigates
- How well the timing aligns with this strategy
- Which user profile attributes support this strategy
```

3. Add a structured summary object:
```typescript
interface StrategicSummary {
  recommendedStrategy: {
    id: string;
    name: string;
    reason: string;
  };
  primaryOpportunity: {
    id: string;
    segment: string;
  };
  criticalRisk: {
    id: string;
    description: string;
  };
  timingAssessment: {
    urgency: string;
    recommendation: string;
  };
}
```

**Effort:** Medium (agent prompt + response schema changes)

### Phase 2: UI Component Restructure (Frontend)

**Goal:** Rebuild DifferentiationView with new information architecture.

**New Components:**

1. **StrategicSummaryCard** - Always visible at top
   - Displays recommended strategy, opportunity, risk, timing
   - Uses visual hierarchy (icons, colors) to communicate urgency
   - Links to detailed sections

2. **StrategyComparisonMatrix** - Replaces accordion
   - Table view with sortable columns
   - Filter chips for "Quick Win", "Best Fit", "Highest Upside"
   - Click row to select strategy

3. **StrategyDetailPanel** - Shows selected strategy
   - Full 5W+H visible by default
   - Profile fit breakdown with strengths/gaps
   - Related opportunities and risks as tags/links

4. **RelationshipDiagram** (optional but high impact)
   - Simple SVG or canvas-based diagram
   - Shows strategy → opportunity → risk connections
   - Could use a library like react-flow or visx

5. **DecisionCapture** - Bottom section
   - Checkbox-style selection for primary strategy
   - Acknowledgment of risks
   - Confirmation of timing decision
   - Persists to database for Update phase

**Effort:** High (significant component restructure)

### Phase 3: State Management and Persistence

**Goal:** Ensure decisions flow to Update phase and persist across sessions.

**Changes:**

1. **Database Schema:**
```sql
CREATE TABLE differentiation_decisions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  primary_strategy_id TEXT,
  secondary_strategy_id TEXT,
  acknowledged_risks TEXT,  -- JSON array of risk IDs
  timing_decision TEXT,     -- 'proceed' | 'wait' | 'urgent'
  created_at DATETIME,
  FOREIGN KEY (idea_id) REFERENCES ideas(id)
);
```

2. **API Endpoints:**
   - `POST /api/ideas/:slug/differentiation/decision` - Save decision
   - `GET /api/ideas/:slug/differentiation/decision` - Load decision

3. **Update Phase Integration:**
   - Modify `agents/update-generator.ts` to accept decision context
   - Include selected strategy, target opportunity in prompt
   - Generate update suggestions aligned with chosen positioning

**Effort:** Medium (database + API + integration)

### Phase 4: Polish and Refinement

**Goal:** Enhance visual design and interaction.

1. **Visual Hierarchy:**
   - Recommended strategy highlighted with accent color/badge
   - Risk severity shown with graduated colors
   - Timing urgency shown with icons/motion

2. **Micro-interactions:**
   - Strategy selection animates to show it's "chosen"
   - Relationship lines highlight on hover
   - Decision section shows confirmation animation

3. **Help and Guidance:**
   - Tooltips explaining what each metric means
   - "What is profile fit?" explanatory modal
   - "How to use this analysis" tutorial overlay (first time)

4. **Accessibility:**
   - Keyboard navigation for comparison matrix
   - Screen reader labels for all icons
   - High contrast mode support

**Effort:** Low-Medium (iterative polish)

---

## Part 4: Detailed Component Specifications

### 4.1 StrategicSummaryCard

**Purpose:** Provide at-a-glance strategic guidance.

**Props:**
```typescript
interface StrategicSummaryCardProps {
  recommendedStrategy: {
    id: string;
    name: string;
    fitScore: number;
    reason: string;
  };
  primaryOpportunity: {
    segment: string;
    fit: 'high' | 'medium' | 'low';
  };
  criticalRisk: {
    description: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
  };
  timingAssessment: {
    urgency: 'high' | 'medium' | 'low';
    window: string;
  };
  overallConfidence: number;
}
```

**Visual Design:**
- Card with 4 quadrants or horizontal sections
- Each section: Icon + Label + Value + Brief reason
- Confidence shown as progress bar or percentage badge
- "View Details" links to scroll to relevant sections

### 4.2 StrategyComparisonMatrix

**Purpose:** Enable side-by-side strategy evaluation.

**Props:**
```typescript
interface StrategyComparisonMatrixProps {
  strategies: Array<{
    id: string;
    name: string;
    profileFit: number;
    opportunityAlignment: 'high' | 'medium' | 'low';
    riskLevel: 'high' | 'medium' | 'low';
    timeToValue: string;  // e.g., "1-3 months"
    resourceNeed: 'low' | 'medium' | 'high';
    isRecommended: boolean;
  }>;
  selectedStrategyId: string | null;
  onSelectStrategy: (id: string) => void;
  activeFilter: 'all' | 'quick-win' | 'best-fit' | 'high-upside' | null;
  onFilterChange: (filter: string) => void;
}
```

**Visual Design:**
- Table with strategies as rows, metrics as columns
- Color-coded cells (green/amber/red) for quick scanning
- Selected row highlighted with border/background
- Recommended strategy has star badge
- Filter chips above table for quick filtering

### 4.3 StrategyDetailPanel

**Purpose:** Show full context for selected strategy.

**Props:**
```typescript
interface StrategyDetailPanelProps {
  strategy: {
    id: string;
    name: string;
    description: string;
    fiveWH: {
      what: string;
      why: string;
      how: string;
      when: string;
      where: string;
      howMuch: string;
    };
    addressesOpportunities: Array<{
      id: string;
      segment: string;
      fit: 'high' | 'medium' | 'low';
    }>;
    mitigatesRisks: Array<{
      id: string;
      description: string;
      severity: 'high' | 'medium' | 'low';
    }>;
    profileFitBreakdown: {
      score: number;
      strengths: string[];
      gaps: string[];
      suggestions: string[];
    };
  };
  onClose?: () => void;
}
```

**Visual Design:**
- 5W+H as tab strip or stacked sections (all visible, no accordion)
- Each 5W+H section: Icon + Title + Content
- Right sidebar or bottom section for related opportunities/risks
- Profile fit as expandable breakdown with bullet points

### 4.4 DecisionCapture

**Purpose:** Record user's strategic choices for downstream use.

**Props:**
```typescript
interface DecisionCaptureProps {
  strategies: Array<{ id: string; name: string }>;
  risks: Array<{ id: string; description: string }>;
  timingUrgency: 'high' | 'medium' | 'low';

  selectedPrimary: string | null;
  selectedSecondary: string | null;
  acknowledgedRisks: string[];
  timingDecision: 'proceed' | 'wait' | null;

  onPrimaryChange: (id: string) => void;
  onSecondaryChange: (id: string | null) => void;
  onRiskAcknowledge: (id: string) => void;
  onTimingDecision: (decision: 'proceed' | 'wait') => void;
  onContinue: () => void;

  canContinue: boolean;
}
```

**Visual Design:**
- "Your Decisions" header with checklist icon
- Strategy selection as radio buttons (primary) + optional checkbox (secondary)
- Risk acknowledgment as checkboxes with severity colors
- Timing as two-button toggle (Proceed Now / Wait)
- Continue button enabled only when primary strategy selected

---

## Part 5: Success Metrics

### User Behavior Metrics
1. **Time to decision:** Reduce from X minutes to Y minutes
2. **Decision confidence:** Post-decision survey score increase
3. **Strategy utilization:** % of users who proceed to Update with selected strategy

### Quality Metrics
1. **Strategy-Update alignment:** % of Update suggestions that reference selected strategy
2. **Decision completeness:** % of users who acknowledge risks before proceeding
3. **Return rate:** % of users who return to Differentiate to change decisions

### Technical Metrics
1. **Component render time:** Target < 200ms for comparison matrix
2. **API response time:** Target < 3s for differentiation analysis
3. **Decision persistence:** 100% of decisions saved successfully

---

## Part 6: Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent output doesn't match new schema | Medium | High | Extensive prompt testing, fallback parsing |
| Relationship diagram performance on large datasets | Low | Medium | Limit to top 5 strategies, lazy render |
| State management complexity with optimistic updates | Medium | Medium | Use React Query mutation patterns |

### UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Comparison matrix overwhelming for non-technical users | Medium | High | Progressive disclosure, tooltips, tutorial |
| Users skip reading 5W+H details | High | Medium | Visual hierarchy that draws attention |
| Decision capture feels like homework | Low | Medium | Frame as "confirming your direction" |

### Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Analysis accuracy reduces with structured output | Low | High | A/B test output quality before/after |
| Users game the system by selecting "easy" strategies | Low | Low | Show tradeoffs clearly, no gaming benefit |

---

## Part 7: Critical Missing Dimensions (Financial & Decision Viability)

### 7.1 The Economic Blind Spot

**The Fundamental Question We're Not Answering:**

> "Can this strategy realistically achieve my financial goals, given my constraints?"

The current implementation treats all strategies as equally valid if they have good "profile fit" scores. But profile fit currently measures skill/network alignment—not economic viability. A strategy can score 9/10 on profile fit while being incapable of generating the user's target income.

**Example of the Problem:**

```
User Profile:
- Primary Goal: income
- Success Definition: "Replace my $150k salary within 2 years"
- Runway: 8 months
- Hours available: 20/week (side project initially)

Strategy Analysis Output:
- Strategy A: "Artisanal local marketplace" - Fit Score: 8/10
  → Realistically caps at $40k/year in Year 3
  → User will fail their goal while "succeeding" at strategy

- Strategy B: "B2B SaaS tool" - Fit Score: 6/10
  → Could reach $200k ARR in Year 2
  → User would succeed despite lower "fit"
```

The current system would recommend Strategy A. This is a fundamental failure.

### 7.2 Missing Financial Data Points

#### In User Profile (Schema Gaps)

The profile schema (`utils/schemas.ts`) has `financialRunwayMonths` but is missing:

| Missing Field | Why Critical | Example |
|---------------|--------------|---------|
| `targetAnnualIncome` | Can't evaluate if strategy meets goals | $150,000 |
| `currentAnnualIncome` | Baseline for "replacement" goals | $120,000 |
| `investmentCapacity` | Can they fund strategy requirements? | $25,000 |
| `monthlyBurnRate` | Runway is meaningless without burn | $8,000/mo |
| `revenueTimelineExpectation` | Patience for returns | "12 months" |
| `incomeRequirementType` | Full replace vs. supplement | "supplement" |

#### In Strategy Analysis (Output Gaps)

The differentiation agent generates strategies but doesn't estimate:

| Missing Output | Why Critical | Should Include |
|----------------|--------------|----------------|
| `estimatedRevenueYear1` | Compare vs income goals | $0-50k range |
| `estimatedRevenueYear3` | Long-term viability | $100-200k range |
| `customersNeededForTarget` | Reality check on scale | "500 @ $300/mo" |
| `monthsToFirstRevenue` | Compare vs runway | 4-6 months |
| `upfrontInvestmentRequired` | Compare vs capacity | $5,000-15,000 |
| `monthlyOperatingCost` | Ongoing sustainability | $200-500/mo |
| `unitEconomics` | Is business viable? | CAC, LTV, margin |

### 7.3 The Niche Trap

**Problem:** Without revenue estimation, the system can enthusiastically recommend strategies targeting markets too small to matter.

**Current Behavior:**
```
Market Opportunity: "Vegan sourdough enthusiasts in Brisbane"
- Fit: HIGH (user is passionate about this)
- Feasibility: HIGH (user knows the domain)
- Competition: LOW (nobody doing this)
→ System: "Great opportunity!"
→ Reality: 500 potential customers, $15 average order
→ Max revenue: ~$50k/year with 100% market capture
```

**What Should Happen:**
```
Market Opportunity: "Vegan sourdough enthusiasts in Brisbane"
- Fit: HIGH
- Feasibility: HIGH
- Competition: LOW
- ⚠️ VIABILITY WARNING:
  - Estimated addressable market: ~500 customers
  - At typical basket size ($15): ~$7,500/year if you capture 100%
  - Your income goal: $100,000/year
  - Gap: Strategy cannot achieve your goals
  → Consider: Expand geography? Broader product range? B2B pivot?
```

### 7.4 Missing Decision Support Frameworks

#### 7.4.1 Revenue-to-Goal Alignment Matrix

**Every strategy should show:**

```
┌─────────────────────────────────────────────────────────────────┐
│  FINANCIAL VIABILITY ASSESSMENT                                 │
│                                                                 │
│  Your Goal: $150,000/year by Month 24                          │
│  Your Runway: 8 months ($64,000 buffer)                        │
│                                                                 │
│  ┌─────────────────┬───────────┬───────────┬───────────┐       │
│  │ Strategy        │ Year 1 Rev│ Year 3 Rev│ Meets Goal│       │
│  ├─────────────────┼───────────┼───────────┼───────────┤       │
│  │ Premium B2B     │ $40-80k   │ $150-250k │ ✓ YES     │       │
│  │ Marketplace     │ $10-30k   │ $80-120k  │ ⚠ MAYBE   │       │
│  │ Local Artisan   │ $5-15k    │ $30-50k   │ ✗ NO      │       │
│  └─────────────────┴───────────┴───────────┴───────────┘       │
│                                                                 │
│  ⚠ "Local Artisan" cannot achieve your income goal.            │
│     Consider only if income is not primary motivation.         │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.4.2 Runway vs. Time-to-Revenue Analysis

**Critical for survival:**

```
┌─────────────────────────────────────────────────────────────────┐
│  RUNWAY SURVIVAL CHECK                                          │
│                                                                 │
│  Your Runway: 8 months                                         │
│                                                                 │
│  Strategy: "Premium B2B Platform"                              │
│  ├── MVP Development: 3-4 months                               │
│  ├── First Customer: Month 5-6                                 │
│  ├── Break-even: Month 10-12                                   │
│  │                                                              │
│  │   ▓▓▓▓▓▓▓▓░░░░░░░░░░ Your Runway                            │
│  │   ░░░░▓▓▓▓▓▓░░░░░░░░ Time to Revenue                        │
│  │            ▲                                                 │
│  │         DANGER ZONE                                          │
│  │                                                              │
│  └── ⚠️ HIGH RISK: You'll run out before break-even            │
│      Options:                                                   │
│      • Extend runway (reduce burn, raise capital)              │
│      • Accelerate timeline (simpler MVP)                       │
│      • Choose faster strategy                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.4.3 Investment Capacity Check

```
┌─────────────────────────────────────────────────────────────────┐
│  INVESTMENT REQUIREMENT                                         │
│                                                                 │
│  Your Capacity: $25,000                                        │
│                                                                 │
│  Strategy Requirements:                                         │
│  ├── Development/tools: $8,000                                 │
│  ├── Initial marketing: $5,000                                 │
│  ├── 6-month buffer: $12,000                                   │
│  └── Total needed: $25,000                                     │
│                                                                 │
│  Status: ✓ FEASIBLE (tight margin)                             │
│  Risk: No buffer for unexpected costs                          │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 Other Critically Missing Elements

#### 7.5.1 Validation Evidence Requirements

Before committing to a strategy, users need to know:

```
┌─────────────────────────────────────────────────────────────────┐
│  VALIDATION ROADMAP                                             │
│                                                                 │
│  Before committing to "Premium B2B Platform":                  │
│                                                                 │
│  1. Customer Discovery (2-3 weeks, $0)                         │
│     → Talk to 10 potential customers                           │
│     → Validate: Would they pay? How much?                      │
│                                                                 │
│  2. Pricing Validation (1 week, $200)                          │
│     → Landing page with pricing                                │
│     → Validate: Conversion at target price point               │
│                                                                 │
│  3. MVP Test (4 weeks, $2,000)                                 │
│     → Minimal working version                                  │
│     → Validate: Will customers actually use it?                │
│                                                                 │
│  Total validation cost: $2,200 + 7 weeks                       │
│  Kill criteria: <5% conversion, <3 paying customers            │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.5.2 Pivot Paths and Reversibility

**Users need to know what happens if a strategy fails:**

```
┌─────────────────────────────────────────────────────────────────┐
│  REVERSIBILITY ASSESSMENT                                       │
│                                                                 │
│  Strategy: "Premium B2B Platform"                              │
│                                                                 │
│  If this doesn't work, you can:                                │
│  ├── Pivot to SMB market (Medium effort)                       │
│  ├── Pivot to agency/service model (Low effort)                │
│  └── Salvage: Codebase, customer learnings, brand              │
│                                                                 │
│  Sunk cost if abandoned at Month 6: ~$15,000 + time            │
│  Transferable assets: 60% of development work                  │
│                                                                 │
│  Reversibility Score: 7/10 (Good escape paths)                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.5.3 Competitive Response Modeling

**What happens when you succeed?**

```
┌─────────────────────────────────────────────────────────────────┐
│  COMPETITIVE RESPONSE SCENARIOS                                 │
│                                                                 │
│  If you capture 5% of the market:                              │
│                                                                 │
│  Likely responses:                                              │
│  ├── [Incumbent A] Copy your differentiation: 6-12 months      │
│  ├── [Incumbent B] Price war to squeeze you out: 3-6 months    │
│  ├── [Startup C] Direct competitor emerges: 12-18 months       │
│                                                                 │
│  Your sustainable advantage window: 12-18 months               │
│                                                                 │
│  Recommendation: Build switching costs before window closes    │
│  ├── Lock in contracts                                         │
│  ├── Create data/network effects                               │
│  └── Build brand loyalty                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.5.4 Success/Failure Criteria (Kill Switch)

**When to persist vs. pivot:**

```
┌─────────────────────────────────────────────────────────────────┐
│  DECISION CHECKPOINTS                                           │
│                                                                 │
│  Month 3 Check:                                                │
│  ├── CONTINUE if: 5+ customer conversations, 2+ expressed      │
│  │   willingness to pay                                        │
│  └── PIVOT if: Can't find interested prospects                 │
│                                                                 │
│  Month 6 Check:                                                │
│  ├── CONTINUE if: 1+ paying customer, CAC < $500               │
│  └── PIVOT if: No revenue, CAC > $1000                         │
│                                                                 │
│  Month 12 Check:                                               │
│  ├── CONTINUE if: 10+ customers, MRR > $2000, growing          │
│  └── PAUSE/ABANDON if: <5 customers, MRR < $500, flat          │
└─────────────────────────────────────────────────────────────────┘
```

#### 7.5.5 Execution Complexity Score

**Not all strategies are equally hard to execute:**

```
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTION COMPLEXITY                                           │
│                                                                 │
│  Strategy: "Two-sided Marketplace"                             │
│                                                                 │
│  Complexity factors:                                            │
│  ├── Chicken-egg problem: Need buyers AND sellers      HIGH    │
│  ├── Multi-stakeholder coordination                    HIGH    │
│  ├── Trust/safety requirements                         MEDIUM  │
│  ├── Technical complexity                              MEDIUM  │
│  ├── Regulatory requirements                           LOW     │
│                                                                 │
│  Solo-founder feasibility: 3/10 (CHALLENGING)                  │
│  Recommended team size: 2-3 people                             │
│                                                                 │
│  ⚠️ Warning: Marketplaces have high failure rates for solo     │
│     founders due to chicken-egg bootstrapping difficulty.      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.6 Required Profile Schema Extensions

```typescript
// New fields needed in UserProfileSchema
export const ExtendedFinancialContextSchema = z.object({
  // Income Goals
  targetAnnualIncome: z.number().optional(),        // e.g., 150000
  currentAnnualIncome: z.number().optional(),       // Baseline
  incomeGoalType: z.enum([
    'full_replacement',    // Replace current job
    'supplement',          // Add to existing income
    'side_project',        // Modest extra income
    'wealth_building'      // Long-term equity play
  ]).optional(),
  incomeTimelineMonths: z.number().optional(),      // When to hit target

  // Investment Capacity
  availableInvestment: z.number().optional(),       // Upfront capital
  monthlyInvestmentCapacity: z.number().optional(), // Ongoing
  willingnessToRaiseFunding: z.boolean().optional(),
  debtTolerance: z.enum(['none', 'low', 'moderate', 'high']).optional(),

  // Burn Rate Reality
  monthlyBurnRate: z.number().optional(),           // Living expenses
  minimumMonthlyIncome: z.number().optional(),      // Floor needed
  hasAlternativeIncome: z.boolean().optional(),     // Spouse, savings, etc.

  // Time Preferences
  maxTimeToFirstRevenue: z.number().optional(),     // Months willing to wait
  preferredExitTimeline: z.number().optional(),     // For exit-focused goals
});
```

### 7.7 Required Strategy Output Extensions

```typescript
// New fields in differentiation strategy output
export interface FinanciallyAwareStrategy extends Strategy {
  // Revenue Projections
  revenueEstimates: {
    year1: { low: number; mid: number; high: number };
    year3: { low: number; mid: number; high: number };
    assumptions: string[];  // What these estimates assume
  };

  // Unit Economics
  unitEconomics: {
    estimatedCAC: { low: number; high: number };
    estimatedLTV: { low: number; high: number };
    estimatedMargin: number;  // Percentage
    breakEvenCustomers: number;
  };

  // Investment Requirements
  investmentRequired: {
    upfront: { low: number; high: number };
    monthly: { low: number; high: number };
    timeToBreakEven: { low: number; high: number };  // Months
  };

  // Goal Alignment
  goalAlignment: {
    meetsIncomeTarget: boolean;
    gapToTarget: number | null;  // If doesn't meet
    timelineAlignment: 'faster' | 'aligned' | 'slower' | 'unlikely';
    runwaySufficient: boolean;
    investmentFeasible: boolean;
  };

  // Validation Path
  validationPlan: {
    steps: Array<{
      name: string;
      duration: string;
      cost: number;
      successCriteria: string;
      killCriteria: string;
    }>;
    totalCost: number;
    totalDuration: string;
  };

  // Reversibility
  reversibility: {
    score: number;  // 1-10
    pivotOptions: string[];
    sunkCostAtMonth6: number;
    transferableAssets: string[];
  };

  // Execution
  executionComplexity: {
    score: number;  // 1-10
    soloFounderFeasibility: number;  // 1-10
    criticalDependencies: string[];
    teamSizeRecommendation: string;
  };
}
```

---

## Part 9: Beyond Differentiation - The Strategic Approach Framework

### 9.1 The Fundamental Reframe

**Current Assumption:** The phase is called "Differentiate" - implying differentiation is THE strategy.

**First Principles Question:** What is the user actually trying to decide?

> "How should I approach this market to achieve MY goals?"

Differentiation is ONE valid answer. But it's often not the BEST answer, especially for:
- Bootstrapped founders (need revenue fast)
- Risk-averse users (proven > novel)
- Income-replacement goals (predictable > moonshot)
- Limited runway (can't afford market education)

### 9.2 Strategic Approach Taxonomy

| Approach | Description | Best For | Risk | Time to Revenue |
|----------|-------------|----------|------|-----------------|
| **Create** | Build something genuinely new | VC-backed, long runway, high risk tolerance | High | 12-24+ months |
| **Copy & Improve** | Take proven model, execute better | Bootstrapped, income goals, proven demand | Low | 3-6 months |
| **Combine** | Merge two validated concepts | Unique insight at intersection | Medium | 6-12 months |
| **Localize** | Proven model, new geography/segment | Local market knowledge | Low | 3-6 months |
| **Specialize** | Narrow general solution to niche | Deep domain expertise | Low-Medium | 4-8 months |
| **Time** | Retry failed concept, market now ready | Timing insight, patience | High | Variable |

### 9.3 Why This Matters for the System

**Different approaches need different analysis:**

```
┌─────────────────────────────────────────────────────────────────┐
│  APPROACH: "Create" (Differentiation)                           │
│  Analysis Needed:                                               │
│  ├── Market whitespace identification                          │
│  ├── Competitive gaps                                          │
│  ├── Category creation cost estimation                         │
│  ├── First-mover advantage assessment                          │
│  └── Market education requirements                             │
├─────────────────────────────────────────────────────────────────┤
│  APPROACH: "Copy & Improve"                                     │
│  Analysis Needed:                                               │
│  ├── Who to copy (successful models in space)                  │
│  ├── What to improve (their weaknesses)                        │
│  ├── Execution playbook (how they did it)                      │
│  ├── Their unit economics (as benchmark)                       │
│  └── Defensibility without novelty                             │
├─────────────────────────────────────────────────────────────────┤
│  APPROACH: "Combine"                                            │
│  Analysis Needed:                                               │
│  ├── Concept A validation status                               │
│  ├── Concept B validation status                               │
│  ├── Customer overlap between A and B                          │
│  ├── Integration complexity                                     │
│  └── Combined value proposition clarity                        │
├─────────────────────────────────────────────────────────────────┤
│  APPROACH: "Localize"                                           │
│  Analysis Needed:                                               │
│  ├── Source model success metrics                              │
│  ├── Local market differences                                  │
│  ├── Adaptation requirements                                   │
│  ├── Local competition landscape                               │
│  └── Regulatory/cultural barriers                              │
├─────────────────────────────────────────────────────────────────┤
│  APPROACH: "Specialize"                                         │
│  Analysis Needed:                                               │
│  ├── General solution landscape                                │
│  ├── Vertical-specific pain points                             │
│  ├── Depth vs. breadth tradeoffs                               │
│  ├── Vertical switching costs                                  │
│  └── Expansion path from niche                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 Approach Selection Logic

The system should RECOMMEND an approach based on user profile + idea context:

```typescript
function recommendApproach(profile: UserProfile, idea: Idea, allocation: IdeaAllocation): ApproachRecommendation {
  // High runway + high risk tolerance + wealth-building goal → Create
  if (allocation.runwayMonths >= 18 &&
      profile.riskTolerance === 'high' &&
      profile.primaryGoals.includes('exit')) {
    return { primary: 'create', reasoning: '...' };
  }

  // Short runway + income goal → Copy or Localize
  if (allocation.runwayMonths <= 8 &&
      profile.primaryGoals.includes('income')) {
    return {
      primary: 'copy_improve',
      secondary: 'localize',
      reasoning: 'Your runway and income goals favor proven models...'
    };
  }

  // Domain expertise + general solution exists → Specialize
  if (profile.domainExpertise.length > 0 &&
      idea.hasGeneralSolutions) {
    return { primary: 'specialize', reasoning: '...' };
  }

  // ... more logic
}
```

### 9.5 Phase Rename: "Differentiate" → "Position"

The phase should be renamed to **Position** and include:

1. **Strategic Approach Selection** (new)
2. **Idea Financial Allocation** (new - see Part 10)
3. **Context-Appropriate Analysis** (revised)
4. **Strategy Comparison** (revised with financial viability)
5. **Decision Capture** (revised)

---

## Part 10: Financial Data Model - User vs. Idea Separation

### 10.1 First Principles: Why Separation?

**The Problem:**
A user with $100k capacity might want to run 3 ideas in parallel, allocating:
- Idea A: $50k (high conviction)
- Idea B: $20k (exploration)
- Idea C: $10k (quick test)
- Reserve: $20k (future opportunities)

If we only store financial data at the User level, we can't:
- Track allocation per idea
- Compare strategy viability against ALLOCATED (not total) resources
- Support portfolio thinking
- Handle ideas with different risk/reward profiles

### 10.2 Data Model Design

```
┌─────────────────────────────────────────────────────────────────┐
│  USER PROFILE (Static / Slowly Changing)                        │
│  Financial context that doesn't change per idea                 │
├─────────────────────────────────────────────────────────────────┤
│  Identity & Baseline                                            │
│  ├── currentAnnualIncome: number         // Baseline income     │
│  ├── monthlyBurnRate: number             // Living expenses     │
│  ├── hasAlternativeIncome: boolean       // Spouse, etc.        │
│  └── employmentStatus: enum              // Employed, etc.      │
│                                                                 │
│  Total Capacity (Portfolio Level)                               │
│  ├── totalInvestmentCapacity: number     // Total available     │
│  ├── totalWeeklyHours: number            // Total time          │
│  └── financialRunwayMonths: number       // How long can survive│
│                                                                 │
│  Preferences & Constraints (Personality)                        │
│  ├── baseRiskTolerance: enum             // Default risk level  │
│  ├── debtTolerance: enum                 // Willing to borrow?  │
│  ├── willingnessToRaiseFunding: boolean  // VC/angel interest   │
│  └── lifestyleIncomeTarget: number       // Long-term goal      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:many
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  IDEA FINANCIAL ALLOCATION (Dynamic / Per-Idea)                 │
│  User's commitment to THIS specific idea                        │
├─────────────────────────────────────────────────────────────────┤
│  Resource Allocation                                            │
│  ├── allocatedBudget: number             // $ for this idea     │
│  ├── allocatedWeeklyHours: number        // Hours for this idea │
│  ├── allocatedRunwayMonths: number       // Funding timeline    │
│  └── allocationPriority: enum            // Primary/secondary   │
│                                                                 │
│  Idea-Specific Goals                                            │
│  ├── targetIncomeFromIdea: number        // Revenue goal        │
│  ├── incomeTimeline: number              // Months to target    │
│  ├── incomeType: enum                    // Replace/supplement  │
│  └── exitIntent: boolean                 // Build to sell?      │
│                                                                 │
│  Idea-Specific Risk Tolerance                                   │
│  ├── ideaRiskTolerance: enum             // May differ from base│
│  ├── maxAcceptableLoss: number           // Walk-away point     │
│  └── pivotWillingness: enum              // How flexible?       │
│                                                                 │
│  Validation Budget                                              │
│  ├── validationBudget: number            // Pre-commit spend    │
│  ├── maxTimeToValidate: number           // Months              │
│  └── killCriteria: string                // When to stop        │
│                                                                 │
│  Metadata                                                       │
│  ├── ideaId: string                      // FK to idea          │
│  ├── createdAt: datetime                                        │
│  └── updatedAt: datetime                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 10.3 Schema Definition

```typescript
// User Profile - Financial Fields (extends existing UserProfileSchema)
export const UserFinancialProfileSchema = z.object({
  // Baseline (rarely changes)
  currentAnnualIncome: z.number().optional(),
  monthlyBurnRate: z.number().optional(),
  hasAlternativeIncome: z.boolean().optional(),

  // Total Capacity (portfolio level)
  totalInvestmentCapacity: z.number().optional(),
  totalWeeklyHoursAvailable: z.number().min(0).max(80).optional(),
  financialRunwayMonths: z.number().min(0).optional(),

  // Preferences (personality)
  baseRiskTolerance: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  debtTolerance: z.enum(['none', 'low', 'moderate', 'high']).optional(),
  willingnessToRaiseFunding: z.boolean().optional(),
  lifestyleIncomeTarget: z.number().optional(),
});

// Idea Financial Allocation (per-idea, dynamic)
export const IdeaFinancialAllocationSchema = z.object({
  id: z.string().uuid(),
  ideaId: z.string().uuid(),

  // Resource Allocation
  allocatedBudget: z.number().min(0),
  allocatedWeeklyHours: z.number().min(0).max(80),
  allocatedRunwayMonths: z.number().min(0),
  allocationPriority: z.enum(['primary', 'secondary', 'exploration', 'parked']),

  // Idea-Specific Goals
  targetIncomeFromIdea: z.number().optional(),
  incomeTimelineMonths: z.number().optional(),
  incomeType: z.enum([
    'full_replacement',   // This idea replaces job
    'partial_replacement', // This idea + other income = target
    'supplement',         // Extra income on top
    'wealth_building',    // Equity play, income later
    'learning',           // Not income focused
  ]),
  exitIntent: z.boolean().default(false),

  // Idea-Specific Risk
  ideaRiskTolerance: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  maxAcceptableLoss: z.number().optional(),
  pivotWillingness: z.enum(['rigid', 'moderate', 'flexible', 'very_flexible']),

  // Validation Budget
  validationBudget: z.number().min(0).default(0),
  maxTimeToValidateMonths: z.number().min(0).optional(),
  killCriteria: z.string().optional(),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type IdeaFinancialAllocation = z.infer<typeof IdeaFinancialAllocationSchema>;
```

### 10.4 Database Schema

```sql
-- New table for idea-level financial allocation
CREATE TABLE idea_financial_allocations (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL UNIQUE,  -- One allocation per idea

  -- Resource Allocation
  allocated_budget REAL DEFAULT 0,
  allocated_weekly_hours REAL DEFAULT 0,
  allocated_runway_months INTEGER DEFAULT 0,
  allocation_priority TEXT DEFAULT 'exploration'
    CHECK (allocation_priority IN ('primary', 'secondary', 'exploration', 'parked')),

  -- Idea-Specific Goals
  target_income_from_idea REAL,
  income_timeline_months INTEGER,
  income_type TEXT DEFAULT 'supplement'
    CHECK (income_type IN ('full_replacement', 'partial_replacement', 'supplement', 'wealth_building', 'learning')),
  exit_intent INTEGER DEFAULT 0,

  -- Idea-Specific Risk
  idea_risk_tolerance TEXT
    CHECK (idea_risk_tolerance IN ('low', 'medium', 'high', 'very_high')),
  max_acceptable_loss REAL,
  pivot_willingness TEXT DEFAULT 'moderate'
    CHECK (pivot_willingness IN ('rigid', 'moderate', 'flexible', 'very_flexible')),

  -- Validation Budget
  validation_budget REAL DEFAULT 0,
  max_time_to_validate_months INTEGER,
  kill_criteria TEXT,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- Index for quick lookup
CREATE INDEX idx_idea_allocations_idea_id ON idea_financial_allocations(idea_id);
```

### 10.5 How This Changes Strategy Evaluation

**Before (broken):**
```
User has $100k capacity
Strategy requires $50k
→ System says: "Feasible!" ✓
→ Reality: User only allocated $20k to this idea
→ User can't actually execute
```

**After (correct):**
```
User Profile: $100k total capacity
Idea Allocation: $20k for this idea
Strategy requires: $50k

→ System says: "NOT feasible with current allocation"
→ Options presented:
   1. Increase allocation (if capacity allows)
   2. Choose lower-cost strategy
   3. Modify strategy to reduce cost
   4. Seek external funding
```

### 10.6 UI Flow for Financial Allocation

**When entering Position phase, BEFORE analysis:**

```
┌─────────────────────────────────────────────────────────────────┐
│  RESOURCE ALLOCATION FOR: "Sydney Coworking Finder"             │
│                                                                 │
│  Your Total Capacity:                                           │
│  ├── Investment: $100,000 available                            │
│  ├── Time: 30 hours/week available                             │
│  └── Runway: 12 months                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  How much do you want to allocate to THIS idea?                │
│                                                                 │
│  Budget:     [$20,000    ] (max: $100,000)                     │
│  Hours/week: [15         ] (max: 30)                           │
│  Runway:     [6 months   ] (max: 12)                           │
│                                                                 │
│  Priority:   ○ Primary (main focus)                            │
│              ● Secondary (active but not main)                 │
│              ○ Exploration (testing viability)                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  What's your income goal from THIS idea?                       │
│                                                                 │
│  Target:     [$50,000/year]                                    │
│  Timeline:   [12 months  ] to reach target                     │
│  Type:       ○ Full replacement (quit job)                     │
│              ● Supplement (extra income)                       │
│              ○ Wealth building (equity play)                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Risk tolerance for THIS idea:                                 │
│  (Your baseline: Medium)                                        │
│                                                                 │
│              ○ Lower than usual (play it safe)                 │
│              ● Same as usual                                   │
│              ○ Higher than usual (willing to bet big)          │
│                                                                 │
│  Max acceptable loss: [$15,000]                                │
│                                                                 │
│                          [Continue to Analysis →]               │
└─────────────────────────────────────────────────────────────────┘
```

### 10.7 Strategy Output Uses ALLOCATED Resources

```typescript
interface StrategyWithAllocationCheck extends FinanciallyAwareStrategy {
  allocationFeasibility: {
    budgetSufficient: boolean;
    budgetGap: number | null;        // How much more needed
    timeSufficient: boolean;
    timeGap: number | null;          // Hours/week needed
    runwaySufficient: boolean;
    runwayGap: number | null;        // Months needed

    overallFeasible: boolean;

    // If not feasible, what would make it work
    adjustmentOptions: Array<{
      type: 'increase_allocation' | 'reduce_scope' | 'extend_timeline' | 'seek_funding';
      description: string;
      newRequirement: number;
    }>;
  };

  // Compare against ALLOCATED income target, not total capacity
  meetsAllocatedIncomeTarget: boolean;
  allocatedIncomeGap: number | null;
}
```

---

## Part 11: Cohesive System Design

### 11.1 Revised Phase Flow

```
CAPTURE → CLARIFY → POSITION → UPDATE → EVALUATE → ITERATE
                       │
                       ├── 1. Financial Allocation (per-idea)
                       ├── 2. Strategic Approach Selection
                       ├── 3. Context-Appropriate Analysis
                       ├── 4. Financial Viability Check
                       ├── 5. Strategy Comparison Matrix
                       └── 6. Decision Capture
```

### 11.2 Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│ User Profile│     │    Idea     │     │ Idea Allocation     │
│ (static)    │     │ (content)   │     │ (per-idea finances) │
└──────┬──────┘     └──────┬──────┘     └──────────┬──────────┘
       │                   │                       │
       └───────────────────┼───────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Approach Recommendation │
              │ (based on all inputs)   │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ Context-Appropriate     │
              │ Analysis Agent          │
              │ (different prompts per  │
              │  strategic approach)    │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ Strategies with:        │
              │ - Revenue estimates     │
              │ - Allocation feasibility│
              │ - Goal alignment        │
              │ - Validation roadmap    │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ Decision Capture        │
              │ (selected strategy +    │
              │  acknowledged risks)    │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ UPDATE Phase            │
              │ (receives decision      │
              │  context for refinement)│
              └────────────────────────┘
```

### 11.3 Key Integration Points

**1. Approach → Analysis Agent**
```typescript
// The analysis agent receives approach as context
async function runPositioningAnalysis(
  ideaContent: string,
  approach: StrategicApproach,
  profile: UserProfile,
  allocation: IdeaFinancialAllocation,
  gapAnalysis: GapAnalysis
): Promise<PositioningAnalysis> {

  const systemPrompt = APPROACH_PROMPTS[approach.type];
  // Different prompts for create/copy/combine/localize/specialize/time

  // Always includes financial context
  const financialContext = `
    Allocated Budget: $${allocation.allocatedBudget}
    Allocated Time: ${allocation.allocatedWeeklyHours} hours/week
    Allocated Runway: ${allocation.allocatedRunwayMonths} months
    Target Income: $${allocation.targetIncomeFromIdea}/year
    Income Timeline: ${allocation.incomeTimelineMonths} months
    Max Acceptable Loss: $${allocation.maxAcceptableLoss}
  `;

  // ...
}
```

**2. Allocation → Strategy Filtering**
```typescript
// Filter strategies that can't work with allocation
function filterViableStrategies(
  strategies: Strategy[],
  allocation: IdeaFinancialAllocation
): Strategy[] {
  return strategies.filter(s => {
    // Hard filters
    if (s.investmentRequired.upfront.low > allocation.allocatedBudget) {
      return false; // Can't afford even minimum
    }
    if (s.monthsToFirstRevenue > allocation.allocatedRunwayMonths) {
      return false; // Won't survive to revenue
    }
    return true;
  });
}
```

**3. Decision → Update Phase**
```typescript
// Update phase receives decision context
interface UpdatePhaseContext {
  selectedStrategy: Strategy;
  selectedApproach: StrategicApproach;
  acknowledgedRisks: Risk[];
  allocation: IdeaFinancialAllocation;

  // What should the update focus on?
  focusAreas: Array<{
    area: string;
    reason: string;
  }>;
}
```

---

## Part 12: Final Implementation Roadmap

### Phase 0: Data Model Foundation

**Goal:** Establish the data structures that everything else depends on.

**Changes:**

1. **User Profile Financial Extension**
   - Add static financial fields to `UserProfileSchema`
   - Fields: `currentAnnualIncome`, `monthlyBurnRate`, `totalInvestmentCapacity`, `totalWeeklyHoursAvailable`, `financialRunwayMonths`, `baseRiskTolerance`, `lifestyleIncomeTarget`
   - Update profile creation UI to capture these

2. **Idea Financial Allocation Table**
   - Create `idea_financial_allocations` table
   - Fields: `allocatedBudget`, `allocatedWeeklyHours`, `allocatedRunwayMonths`, `allocationPriority`, `targetIncomeFromIdea`, `incomeType`, `ideaRiskTolerance`, `maxAcceptableLoss`, `validationBudget`, `killCriteria`
   - API endpoints for CRUD operations

3. **Strategic Approach Type**
   - Add `strategic_approach` enum: `create`, `copy_improve`, `combine`, `localize`, `specialize`, `time`
   - Store selected approach per idea

**Files to modify:**
- `utils/schemas.ts` - Add schemas
- `database/migrations/011_financial_allocation.sql` - New migration
- `server/api.ts` - New endpoints
- `frontend/src/api/client.ts` - Client functions

**Effort:** Medium

---

### Phase 1: Position Phase UI Shell

**Goal:** Rename phase and create the new UI flow structure.

**Changes:**

1. **Phase Rename**
   - Rename `differentiate` → `position` throughout codebase
   - Update `IncubationPhaseSchema`, `incubationPhases` array
   - Update stepper labels and descriptions

2. **Position Phase Sub-steps**
   - Step 1: Financial Allocation form (new component)
   - Step 2: Strategic Approach selector (new component)
   - Step 3: Analysis results (refactored DifferentiationView)
   - Step 4: Decision capture (enhanced)

3. **New Components**
   - `FinancialAllocationForm.tsx` - Captures per-idea allocation
   - `StrategicApproachSelector.tsx` - Recommends and lets user select approach
   - `PositionPhaseContainer.tsx` - Orchestrates sub-steps

**Files to modify:**
- `frontend/src/components/IncubationStepper.tsx`
- `frontend/src/pages/IdeaDetailPhased.tsx`
- `types/incubation.ts`
- New: `frontend/src/components/FinancialAllocationForm.tsx`
- New: `frontend/src/components/StrategicApproachSelector.tsx`
- New: `frontend/src/components/PositionPhaseContainer.tsx`

**Effort:** High

---

### Phase 2: Agent Refactoring

**Goal:** Make analysis agents approach-aware and financially-informed.

**Changes:**

1. **Approach-Specific Prompts**
   - Create `APPROACH_PROMPTS` map with different system prompts per approach
   - "Create" approach: market whitespace, category creation cost
   - "Copy & Improve" approach: who to copy, execution playbook
   - "Combine" approach: concept validation, integration complexity
   - "Localize" approach: source model metrics, local adaptation
   - "Specialize" approach: vertical pain points, expansion path

2. **Financial Context Injection**
   - Pass `IdeaFinancialAllocation` to all analysis agents
   - Request revenue estimates in strategy output
   - Request investment requirements in strategy output
   - Include goal alignment assessment

3. **Strategy Output Schema Extension**
   - Add `revenueEstimates`, `unitEconomics`, `investmentRequired`
   - Add `goalAlignment`, `validationPlan`, `reversibility`, `executionComplexity`
   - Add `allocationFeasibility` check

**Files to modify:**
- `agents/differentiation.ts` → rename to `agents/positioning.ts`
- New: `agents/approach-prompts.ts` - Prompt templates per approach
- `types/incubation.ts` - Extended strategy types

**Effort:** High

---

### Phase 3: Financial Viability UI

**Goal:** Surface financial analysis prominently in the UI.

**New Components:**

1. **FinancialViabilityCard**
   - Shows goal alignment for each strategy
   - Visual indicator: ✓ YES / ⚠ MAYBE / ✗ NO
   - Explains gaps and adjustment options

2. **RunwaySurvivalChart**
   - Timeline visualization: runway vs. time-to-revenue
   - Highlights danger zones
   - Shows break-even point

3. **AllocationFeasibilityCheck**
   - Compares strategy requirements vs. allocated resources
   - Shows specific gaps (budget, time, runway)
   - Suggests adjustment options

4. **NicheTrapWarning**
   - Alert when market size < income target
   - Shows the math clearly
   - Suggests expansion options

**Files to create:**
- `frontend/src/components/FinancialViabilityCard.tsx`
- `frontend/src/components/RunwaySurvivalChart.tsx`
- `frontend/src/components/AllocationFeasibilityCheck.tsx`
- `frontend/src/components/NicheTrapWarning.tsx`

**Effort:** High

---

### Phase 4: Strategy Comparison Redesign

**Goal:** Replace accordion with comparison matrix.

**Changes:**

1. **StrategyComparisonMatrix Component**
   - Table view with strategies as rows
   - Columns: Profile Fit, Revenue Potential, Investment, Time to Revenue, Risk, Feasibility
   - Color-coded cells for quick scanning
   - Sortable columns
   - Filter chips: "Quick Win", "Best Fit", "Highest Upside", "Lowest Risk"

2. **StrategyDetailPanel Component**
   - Full 5W+H visible by default (not hidden)
   - Profile fit breakdown with strengths/gaps
   - Related opportunities and risks as linked tags
   - Validation roadmap section

3. **RelationshipIndicators**
   - Show which opportunities each strategy addresses
   - Show which risks each strategy mitigates
   - Visual connectors or tag-based linking

**Files to modify:**
- `frontend/src/components/DifferentiationView.tsx` → refactor significantly
- New: `frontend/src/components/StrategyComparisonMatrix.tsx`
- New: `frontend/src/components/StrategyDetailPanel.tsx`

**Effort:** High

---

### Phase 5: Decision Capture & Integration

**Goal:** Persist decisions and flow to Update phase.

**Changes:**

1. **Decision Capture Component**
   - Primary strategy selection (required)
   - Secondary strategy selection (optional)
   - Risk acknowledgment checkboxes
   - Timing decision (proceed now / wait)
   - Notes field

2. **Database Persistence**
   - Create `positioning_decisions` table
   - Store selected strategy, approach, acknowledged risks, timing

3. **Update Phase Integration**
   - Pass decision context to update-generator agent
   - Update suggestions aligned with chosen positioning
   - Reference selected strategy in prompt

**Files to modify:**
- New: `frontend/src/components/DecisionCapture.tsx`
- `database/migrations/012_positioning_decisions.sql`
- `agents/update-generator.ts` - Accept decision context
- `frontend/src/components/UpdatePhaseContent.tsx` - Show decision context

**Effort:** Medium

---

### Phase 6: Polish & Validation

**Goal:** Refine UX and ensure system coherence.

**Changes:**

1. **Visual Polish**
   - Consistent color coding for viability indicators
   - Micro-interactions for selection states
   - Help tooltips explaining metrics
   - First-time tutorial overlay

2. **Edge Case Handling**
   - No profile linked: prompt to create/link
   - No allocation set: show defaults with prompt to customize
   - No strategies feasible: clear messaging with options

3. **Testing & Validation**
   - Unit tests for allocation feasibility logic
   - Integration tests for phase flow
   - User testing for comprehension

**Effort:** Medium

---

## Summary: Implementation Priority

| Phase | Focus | Dependencies | Effort | Value |
|-------|-------|--------------|--------|-------|
| 0 | Data Model | None | Medium | Foundation |
| 1 | UI Shell | Phase 0 | High | Structure |
| 2 | Agent Refactoring | Phase 0 | High | Core capability |
| 3 | Financial Viability UI | Phase 0, 2 | High | **Highest user value** |
| 4 | Comparison Matrix | Phase 2 | High | Usability |
| 5 | Decision Integration | Phase 3, 4 | Medium | Flow completion |
| 6 | Polish | All | Medium | Quality |

**Critical Path:** Phase 0 → Phase 2 → Phase 3

**Total Estimated Effort:** 5-6 sprints

---

## Conclusion

The current "Differentiate" step fails on multiple levels:

1. **Conceptual:** Assumes differentiation is the only valid strategy
2. **Financial:** Ignores revenue potential vs. user goals
3. **Practical:** Doesn't account for per-idea resource allocation
4. **UX:** Presents fragmented data without decision support

The redesigned **"Position"** phase addresses all of these:

| Problem | Solution |
|---------|----------|
| Differentiation bias | Strategic Approach taxonomy (6 options) |
| No financial analysis | Revenue estimates, goal alignment, viability checks |
| User-level finances only | Idea-level allocation model |
| Fragmented sections | Integrated comparison matrix with relationships |
| Hidden actionable content | 5W+H visible by default |
| Passive data display | Active decision capture with downstream integration |
| No validation guidance | Validation roadmaps with kill criteria |

**The fundamental reframe:**

> From: "How is this idea different?"
> To: "How should I approach this market to achieve MY goals, with the resources I'm willing to commit?"

This question acknowledges that:
- Differentiation is optional
- Resources are finite and allocated per-idea
- Goals vary (income vs. equity vs. learning)
- Risk tolerance varies per-idea
- Financial viability trumps strategic elegance

**The most critical additions are:**
1. **Strategic approach selection** - because differentiation isn't always the answer
2. **Idea-level financial allocation** - because users run portfolios, not single ideas
3. **Revenue-to-goal alignment** - because strategies must meet user's actual needs
4. **Validation roadmaps with kill criteria** - because knowing when to stop is as important as knowing how to start

Without these, the system can enthusiastically recommend strategies that are strategically interesting but economically impossible, strategically sound but wrong for the user's situation, or financially viable but misaligned with the user's actual approach preferences.
