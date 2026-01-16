# Position Phase Implementation Guide

> **For Developers** | Reference: [differentiation-step-analysis-and-redesign.md](./differentiation-step-analysis-and-redesign.md)

## Overview

This guide provides step-by-step implementation instructions for transforming the "Differentiate" phase into the new "Position" phase. Each section includes checklists with explicit pass criteria.

### Key Changes Summary

| Current                              | New                                              |
| ------------------------------------ | ------------------------------------------------ |
| Phase name: "Differentiate"          | Phase name: "Position"                           |
| Single strategic approach assumed    | 6 strategic approaches to choose from            |
| User-level finances only             | User + Idea-level financial allocation           |
| Accordion UI (one section at a time) | Comparison matrix + detail panels                |
| Hidden 5W+H details                  | 5W+H visible by default                          |
| No financial viability checks        | Revenue estimates, goal alignment, runway checks |
| No decision persistence              | Decision capture flows to Update phase           |

---

## Phase 0: Data Model Foundation

**Objective:** Establish database tables, schemas, and API endpoints that all subsequent phases depend on.

**Dependencies:** None

**Estimated Effort:** 3-5 days

---

### 0.1 User Profile Financial Extension

**File:** `utils/schemas.ts`

Add to existing `UserProfileSchema`:

```typescript
// Add these fields to UserProfileSchema
// Located after existing FT5 fields

// Financial Baseline (static, rarely changes)
currentAnnualIncome: z.number().min(0).optional(),
monthlyBurnRate: z.number().min(0).optional(),
hasAlternativeIncome: z.boolean().optional(),

// Total Capacity (portfolio level)
totalInvestmentCapacity: z.number().min(0).optional(),
totalWeeklyHoursAvailable: z.number().min(0).max(80).optional(),
// Note: financialRunwayMonths already exists

// Preferences
baseRiskTolerance: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
debtTolerance: z.enum(['none', 'low', 'moderate', 'high']).optional(),
willingnessToRaiseFunding: z.boolean().optional(),
lifestyleIncomeTarget: z.number().min(0).optional(),
```

#### Checklist 0.1

| #     | Item                                        | Pass Criteria                                                   |
| ----- | ------------------------------------------- | --------------------------------------------------------------- |
| 0.1.1 | Add financial fields to `UserProfileSchema` | Schema validates with new fields; existing profiles still parse |
| 0.1.2 | Update `ProfileInputSchema` with new fields | New profiles can be created with financial data                 |
| 0.1.3 | Add database columns to `profiles` table    | Migration runs; columns exist with correct types                |
| 0.1.4 | Update profile sync in `scripts/sync.ts`    | Profiles with new fields sync correctly                         |
| 0.1.5 | Test backward compatibility                 | Existing profiles without new fields load without errors        |

---

### 0.2 Idea Financial Allocation Table

**File:** `database/migrations/011_idea_financial_allocations.sql`

```sql
-- Idea-level financial allocation
-- Stores per-idea resource commitments separate from user profile

CREATE TABLE IF NOT EXISTS idea_financial_allocations (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL UNIQUE,

  -- Resource Allocation
  allocated_budget REAL DEFAULT 0 CHECK (allocated_budget >= 0),
  allocated_weekly_hours REAL DEFAULT 0 CHECK (allocated_weekly_hours >= 0 AND allocated_weekly_hours <= 80),
  allocated_runway_months INTEGER DEFAULT 0 CHECK (allocated_runway_months >= 0),
  allocation_priority TEXT DEFAULT 'exploration'
    CHECK (allocation_priority IN ('primary', 'secondary', 'exploration', 'parked')),

  -- Idea-Specific Goals
  target_income_from_idea REAL CHECK (target_income_from_idea IS NULL OR target_income_from_idea >= 0),
  income_timeline_months INTEGER CHECK (income_timeline_months IS NULL OR income_timeline_months > 0),
  income_type TEXT DEFAULT 'supplement'
    CHECK (income_type IN ('full_replacement', 'partial_replacement', 'supplement', 'wealth_building', 'learning')),
  exit_intent INTEGER DEFAULT 0 CHECK (exit_intent IN (0, 1)),

  -- Idea-Specific Risk
  idea_risk_tolerance TEXT
    CHECK (idea_risk_tolerance IS NULL OR idea_risk_tolerance IN ('low', 'medium', 'high', 'very_high')),
  max_acceptable_loss REAL CHECK (max_acceptable_loss IS NULL OR max_acceptable_loss >= 0),
  pivot_willingness TEXT DEFAULT 'moderate'
    CHECK (pivot_willingness IN ('rigid', 'moderate', 'flexible', 'very_flexible')),

  -- Validation Budget (subset of allocated_budget for pre-commit validation)
  validation_budget REAL DEFAULT 0 CHECK (validation_budget >= 0),
  max_time_to_validate_months INTEGER CHECK (max_time_to_validate_months IS NULL OR max_time_to_validate_months > 0),
  kill_criteria TEXT,

  -- Strategic Approach
  strategic_approach TEXT
    CHECK (strategic_approach IS NULL OR strategic_approach IN ('create', 'copy_improve', 'combine', 'localize', 'specialize', 'time')),

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_idea_allocations_idea_id ON idea_financial_allocations(idea_id);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS update_idea_allocation_timestamp
  AFTER UPDATE ON idea_financial_allocations
  BEGIN
    UPDATE idea_financial_allocations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
```

#### Checklist 0.2

| #     | Item                       | Pass Criteria                                                                         |
| ----- | -------------------------- | ------------------------------------------------------------------------------------- |
| 0.2.1 | Create migration file      | File exists at correct path                                                           |
| 0.2.2 | Run migration successfully | `npm run migrate` completes without errors                                            |
| 0.2.3 | Verify table created       | `sqlite3 database/ideas.db ".schema idea_financial_allocations"` shows correct schema |
| 0.2.4 | Verify constraints work    | Insert with invalid `allocation_priority` fails; insert with valid data succeeds      |
| 0.2.5 | Verify cascade delete      | Deleting idea removes associated allocation                                           |
| 0.2.6 | Verify updated_at trigger  | Update triggers timestamp change                                                      |

---

### 0.3 TypeScript Schema for Allocation

**File:** `types/incubation.ts`

Add after existing types:

```typescript
// Strategic Approach Types
export const StrategicApproachSchema = z.enum([
  "create", // Build something genuinely new (differentiation)
  "copy_improve", // Take proven model, execute better
  "combine", // Merge two validated concepts
  "localize", // Proven model, new geography/segment
  "specialize", // Narrow general solution to niche
  "time", // Retry failed concept, market now ready
]);
export type StrategicApproach = z.infer<typeof StrategicApproachSchema>;

// Allocation Priority
export const AllocationPrioritySchema = z.enum([
  "primary", // Main focus, most resources
  "secondary", // Active but not main
  "exploration", // Testing viability
  "parked", // On hold
]);
export type AllocationPriority = z.infer<typeof AllocationPrioritySchema>;

// Income Type for this idea
export const IdeaIncomeTypeSchema = z.enum([
  "full_replacement", // This idea replaces job income
  "partial_replacement", // This idea + other sources = target
  "supplement", // Extra income on top of existing
  "wealth_building", // Equity play, income later
  "learning", // Not income focused
]);
export type IdeaIncomeType = z.infer<typeof IdeaIncomeTypeSchema>;

// Pivot Willingness
export const PivotWillingnessSchema = z.enum([
  "rigid", // Committed to this exact approach
  "moderate", // Open to adjustments
  "flexible", // Will pivot if needed
  "very_flexible", // Exploring, will follow data
]);
export type PivotWillingness = z.infer<typeof PivotWillingnessSchema>;

// Complete Idea Financial Allocation
export interface IdeaFinancialAllocation {
  id: string;
  ideaId: string;

  // Resource Allocation
  allocatedBudget: number;
  allocatedWeeklyHours: number;
  allocatedRunwayMonths: number;
  allocationPriority: AllocationPriority;

  // Idea-Specific Goals
  targetIncomeFromIdea: number | null;
  incomeTimelineMonths: number | null;
  incomeType: IdeaIncomeType;
  exitIntent: boolean;

  // Idea-Specific Risk
  ideaRiskTolerance: "low" | "medium" | "high" | "very_high" | null;
  maxAcceptableLoss: number | null;
  pivotWillingness: PivotWillingness;

  // Validation Budget
  validationBudget: number;
  maxTimeToValidateMonths: number | null;
  killCriteria: string | null;

  // Strategic Approach
  strategicApproach: StrategicApproach | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Zod schema for validation
export const IdeaFinancialAllocationSchema = z.object({
  id: z.string().uuid(),
  ideaId: z.string().uuid(),

  allocatedBudget: z.number().min(0).default(0),
  allocatedWeeklyHours: z.number().min(0).max(80).default(0),
  allocatedRunwayMonths: z.number().min(0).default(0),
  allocationPriority: AllocationPrioritySchema.default("exploration"),

  targetIncomeFromIdea: z.number().min(0).nullable().default(null),
  incomeTimelineMonths: z.number().min(1).nullable().default(null),
  incomeType: IdeaIncomeTypeSchema.default("supplement"),
  exitIntent: z.boolean().default(false),

  ideaRiskTolerance: z
    .enum(["low", "medium", "high", "very_high"])
    .nullable()
    .default(null),
  maxAcceptableLoss: z.number().min(0).nullable().default(null),
  pivotWillingness: PivotWillingnessSchema.default("moderate"),

  validationBudget: z.number().min(0).default(0),
  maxTimeToValidateMonths: z.number().min(1).nullable().default(null),
  killCriteria: z.string().nullable().default(null),

  strategicApproach: StrategicApproachSchema.nullable().default(null),

  createdAt: z.date(),
  updatedAt: z.date(),
});
```

#### Checklist 0.3

| #     | Item                                    | Pass Criteria                                   |
| ----- | --------------------------------------- | ----------------------------------------------- |
| 0.3.1 | Add all enum schemas                    | TypeScript compiles without errors              |
| 0.3.2 | Add `IdeaFinancialAllocation` interface | Interface exported and usable                   |
| 0.3.3 | Add Zod validation schema               | Schema validates correct data, rejects invalid  |
| 0.3.4 | Export all types                        | All types importable from `types/incubation.ts` |

---

### 0.4 API Endpoints for Allocation

**File:** `server/api.ts`

Add new endpoints:

```typescript
// GET /api/ideas/:slug/allocation
// Returns the financial allocation for an idea, or null if none exists

// POST /api/ideas/:slug/allocation
// Creates or updates the financial allocation for an idea
// Body: Partial<IdeaFinancialAllocation> (without id, ideaId, timestamps)

// DELETE /api/ideas/:slug/allocation
// Removes the financial allocation (resets to defaults)
```

**Implementation notes:**

- On GET, if no allocation exists, return `null` (not 404)
- On POST, upsert (create if not exists, update if exists)
- Generate UUID for `id` if creating new
- Set `ideaId` from the idea looked up by slug

#### Checklist 0.4

| #     | Item                             | Pass Criteria                                                |
| ----- | -------------------------------- | ------------------------------------------------------------ |
| 0.4.1 | Implement GET endpoint           | Returns allocation object or null; 404 only for invalid slug |
| 0.4.2 | Implement POST endpoint (create) | Creates new allocation; returns created object with id       |
| 0.4.3 | Implement POST endpoint (update) | Updates existing allocation; returns updated object          |
| 0.4.4 | Implement DELETE endpoint        | Removes allocation; subsequent GET returns null              |
| 0.4.5 | Add input validation             | Invalid data returns 400 with clear error message            |
| 0.4.6 | Test with curl/httpie            | All endpoints respond correctly via CLI testing              |

---

### 0.5 Frontend API Client

**File:** `frontend/src/api/client.ts`

Add functions:

```typescript
export interface IdeaFinancialAllocation {
  // ... (match types/incubation.ts interface)
}

export async function getIdeaAllocation(
  slug: string,
): Promise<IdeaFinancialAllocation | null> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/allocation`);
  if (!response.ok) throw new Error("Failed to fetch allocation");
  return response.json();
}

export async function saveIdeaAllocation(
  slug: string,
  allocation: Partial<IdeaFinancialAllocation>,
): Promise<IdeaFinancialAllocation> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/allocation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(allocation),
  });
  if (!response.ok) throw new Error("Failed to save allocation");
  return response.json();
}

export async function deleteIdeaAllocation(slug: string): Promise<void> {
  const response = await fetch(`${API_BASE}/ideas/${slug}/allocation`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete allocation");
}
```

#### Checklist 0.5

| #     | Item                             | Pass Criteria                                |
| ----- | -------------------------------- | -------------------------------------------- |
| 0.5.1 | Add TypeScript interface         | Interface matches backend schema             |
| 0.5.2 | Implement `getIdeaAllocation`    | Returns data or null; handles errors         |
| 0.5.3 | Implement `saveIdeaAllocation`   | Creates/updates; returns saved object        |
| 0.5.4 | Implement `deleteIdeaAllocation` | Deletes without error                        |
| 0.5.5 | Test from browser console        | `await getIdeaAllocation('test-idea')` works |

---

### 0.6 React Hook for Allocation

**File:** `frontend/src/hooks/useAllocation.ts` (new file)

```typescript
import { useState, useEffect, useCallback } from "react";
import {
  getIdeaAllocation,
  saveIdeaAllocation,
  deleteIdeaAllocation,
  type IdeaFinancialAllocation,
} from "../api/client";

export function useIdeaAllocation(slug: string | undefined) {
  const [allocation, setAllocation] = useState<IdeaFinancialAllocation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    getIdeaAllocation(slug)
      .then(setAllocation)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [slug]);

  const save = useCallback(
    async (data: Partial<IdeaFinancialAllocation>) => {
      if (!slug) return;

      setSaving(true);
      try {
        const saved = await saveIdeaAllocation(slug, data);
        setAllocation(saved);
        return saved;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [slug],
  );

  const reset = useCallback(async () => {
    if (!slug) return;

    setSaving(true);
    try {
      await deleteIdeaAllocation(slug);
      setAllocation(null);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [slug]);

  return { allocation, loading, error, saving, save, reset };
}
```

#### Checklist 0.6

| #     | Item                 | Pass Criteria                                  |
| ----- | -------------------- | ---------------------------------------------- |
| 0.6.1 | Create hook file     | File exists, exports hook                      |
| 0.6.2 | Loading state works  | `loading` is true initially, false after fetch |
| 0.6.3 | Save function works  | Calling `save({...})` updates allocation       |
| 0.6.4 | Reset function works | Calling `reset()` sets allocation to null      |
| 0.6.5 | Error handling works | Network errors set `error` state               |

---

### Phase 0 Definition of Done

| Criterion                          | Verification Method                  |
| ---------------------------------- | ------------------------------------ |
| All migrations run successfully    | `npm run migrate` exits 0            |
| All schemas compile                | `npx tsc --noEmit` exits 0           |
| API endpoints respond correctly    | Manual curl testing of all endpoints |
| Frontend can fetch/save allocation | Browser console testing              |
| Existing functionality unbroken    | Run existing test suite              |

---

## Phase 1: Position Phase UI Shell

**Objective:** Rename the phase and create the structural components for the new flow.

**Dependencies:** Phase 0 complete

**Estimated Effort:** 4-6 days

---

### 1.1 Phase Rename

**Files to modify:**

- `types/incubation.ts`
- `frontend/src/components/IncubationStepper.tsx`
- `frontend/src/pages/IdeaDetailPhased.tsx`
- `server/api.ts` (any phase references)
- `agents/` (any phase references)

**Changes:**

1. In `types/incubation.ts`, update `IncubationPhaseSchema`:

```typescript
export const IncubationPhaseSchema = z.enum([
  "capture",
  "clarify",
  "position", // Changed from 'differentiation'
  "update",
  "evaluate",
  "iterate",
]);
```

2. In `IncubationStepper.tsx`, update `incubationPhases` array:

```typescript
export const incubationPhases: PhaseConfig[] = [
  // ...
  {
    id: "position", // Changed from 'differentiate'
    label: "Position",
    description: "Choose your strategic approach and allocate resources",
    icon: Target, // Or appropriate icon
  },
  // ...
];
```

3. Update all `'differentiate'` and `'differentiation'` string literals throughout codebase.

#### Checklist 1.1

| #     | Item                                         | Pass Criteria                                                  |
| ----- | -------------------------------------------- | -------------------------------------------------------------- |
| 1.1.1 | Update `IncubationPhaseSchema`               | TypeScript compiles; enum has 'position'                       |
| 1.1.2 | Update `incubationPhases` array              | Stepper shows "Position" label                                 |
| 1.1.3 | Update `IdeaDetailPhased.tsx` phase handling | Phase navigation works with new name                           |
| 1.1.4 | Update `mapDbPhaseToUi` function             | Maps 'differentiation' → 'position' for backward compatibility |
| 1.1.5 | Search codebase for 'differentiat'           | No remaining references except comments/docs                   |
| 1.1.6 | Test phase navigation                        | Can navigate to/from Position phase                            |

---

### 1.2 Financial Allocation Form Component

**File:** `frontend/src/components/FinancialAllocationForm.tsx` (new)

This form collects per-idea resource allocation before analysis runs.

**Props:**

```typescript
interface FinancialAllocationFormProps {
  ideaSlug: string;
  ideaTitle: string;
  userProfile: UserProfile | null; // For showing total capacity
  existingAllocation: IdeaFinancialAllocation | null;
  onSave: (allocation: Partial<IdeaFinancialAllocation>) => Promise<void>;
  onContinue: () => void;
  loading?: boolean;
}
```

**UI Requirements:**

- Show user's total capacity (from profile) as context
- Input fields for: allocatedBudget, allocatedWeeklyHours, allocatedRunwayMonths
- Radio buttons for: allocationPriority
- Input fields for: targetIncomeFromIdea, incomeTimelineMonths
- Radio buttons for: incomeType
- Radio buttons for: ideaRiskTolerance (relative to base)
- Input field for: maxAcceptableLoss
- "Continue to Approach Selection" button

**Validation:**

- allocatedBudget <= totalInvestmentCapacity (if profile exists)
- allocatedWeeklyHours <= totalWeeklyHoursAvailable (if profile exists)
- allocatedRunwayMonths <= financialRunwayMonths (if profile exists)
- Show warnings (not errors) if exceeding profile limits

#### Checklist 1.2

| #     | Item                         | Pass Criteria                                    |
| ----- | ---------------------------- | ------------------------------------------------ |
| 1.2.1 | Create component file        | File exists, exports component                   |
| 1.2.2 | Render all input fields      | All allocation fields visible                    |
| 1.2.3 | Show user capacity context   | Profile limits displayed when profile exists     |
| 1.2.4 | Validate against capacity    | Warnings shown when exceeding limits             |
| 1.2.5 | Save on continue             | `onSave` called with form data                   |
| 1.2.6 | Pre-fill existing allocation | Existing values shown when editing               |
| 1.2.7 | Handle no profile            | Works without profile (no capacity limits shown) |

---

### 1.3 Strategic Approach Selector Component

**File:** `frontend/src/components/StrategicApproachSelector.tsx` (new)

This component recommends and lets user select their strategic approach.

**Props:**

```typescript
interface StrategicApproachSelectorProps {
  ideaSlug: string;
  allocation: IdeaFinancialAllocation;
  userProfile: UserProfile | null;
  recommendedApproach: StrategicApproach | null; // From recommendation logic
  selectedApproach: StrategicApproach | null;
  onSelect: (approach: StrategicApproach) => void;
  onContinue: () => void;
}
```

**UI Requirements:**

- Card for each of 6 approaches with:
  - Name and icon
  - Brief description
  - Best for (audience)
  - Risk level indicator
  - Time to revenue estimate
- Recommended approach highlighted with badge
- Selected approach has visual selection state
- "Why this recommendation?" expandable explanation
- "Continue to Analysis" button (disabled until selection)

**Approach Descriptions:**

| Approach       | Description                        | Best For                                     |
| -------------- | ---------------------------------- | -------------------------------------------- |
| Create         | Build something genuinely new      | Long runway, high risk tolerance, exit goals |
| Copy & Improve | Take proven model, execute better  | Short runway, income goals, lower risk       |
| Combine        | Merge two validated concepts       | Unique insight at intersection               |
| Localize       | Proven model, new geography        | Local market knowledge                       |
| Specialize     | Narrow general solution to niche   | Deep domain expertise                        |
| Time           | Retry failed concept, market ready | Timing insight, patience                     |

#### Checklist 1.3

| #     | Item                        | Pass Criteria                           |
| ----- | --------------------------- | --------------------------------------- |
| 1.3.1 | Create component file       | File exists, exports component          |
| 1.3.2 | Render all 6 approaches     | All approaches visible as cards         |
| 1.3.3 | Show recommended approach   | Recommended has visual badge            |
| 1.3.4 | Selection state works       | Clicking card updates selectedApproach  |
| 1.3.5 | Continue requires selection | Button disabled until approach selected |
| 1.3.6 | Explanation expandable      | "Why?" section expands/collapses        |

---

### 1.4 Approach Recommendation Logic

**File:** `utils/approach-recommendation.ts` (new)

Recommends a strategic approach based on profile + allocation:

```typescript
import {
  StrategicApproach,
  IdeaFinancialAllocation,
} from "../types/incubation";
import { UserProfile } from "./schemas";

export interface ApproachRecommendation {
  primary: StrategicApproach;
  secondary?: StrategicApproach;
  reasoning: string;
  confidenceFactors: string[];
}

export function recommendApproach(
  profile: UserProfile | null,
  allocation: IdeaFinancialAllocation,
): ApproachRecommendation {
  const confidenceFactors: string[] = [];

  // Default if no profile
  if (!profile) {
    return {
      primary: "create",
      reasoning:
        "No profile linked. Defaulting to differentiation approach. Link a profile for personalized recommendations.",
      confidenceFactors: ["No profile data available"],
    };
  }

  const runway = allocation.allocatedRunwayMonths;
  const incomeType = allocation.incomeType;
  const riskTolerance =
    allocation.ideaRiskTolerance || profile.riskTolerance || "medium";
  const goals = profile.primaryGoals || [];
  const hasDomainExpertise = (profile.domainExpertise?.length || 0) > 0;

  // Rule 1: Long runway + high risk + exit goal → Create
  if (
    runway >= 18 &&
    (riskTolerance === "high" || riskTolerance === "very_high") &&
    goals.includes("exit")
  ) {
    confidenceFactors.push(
      "18+ months runway",
      "High risk tolerance",
      "Exit goal",
    );
    return {
      primary: "create",
      reasoning:
        "Your long runway, high risk tolerance, and exit goals make differentiation viable. You can afford market education time.",
      confidenceFactors,
    };
  }

  // Rule 2: Short runway + income goal → Copy & Improve or Localize
  if (
    runway <= 8 &&
    (incomeType === "full_replacement" ||
      incomeType === "partial_replacement" ||
      goals.includes("income"))
  ) {
    confidenceFactors.push("≤8 months runway", "Income-focused goal");

    // Prefer localize if they have local market knowledge
    if (profile.city || profile.country) {
      confidenceFactors.push("Local market context available");
      return {
        primary: "localize",
        secondary: "copy_improve",
        reasoning:
          "Your short runway and income goals favor proven models. Your local presence gives localization an edge.",
        confidenceFactors,
      };
    }

    return {
      primary: "copy_improve",
      secondary: "localize",
      reasoning:
        "Your short runway and income goals favor proven models with faster time-to-revenue.",
      confidenceFactors,
    };
  }

  // Rule 3: Domain expertise → Specialize
  if (hasDomainExpertise) {
    confidenceFactors.push("Domain expertise present");
    return {
      primary: "specialize",
      secondary: "create",
      reasoning:
        "Your domain expertise enables vertical specialization. You understand niche pain points others miss.",
      confidenceFactors,
    };
  }

  // Rule 4: Learning goal → Combine or Create (more experimental)
  if (incomeType === "learning" || goals.includes("learning")) {
    confidenceFactors.push("Learning-focused goal");
    return {
      primary: "combine",
      secondary: "create",
      reasoning:
        "Learning goals allow more experimentation. Combining concepts builds diverse skills.",
      confidenceFactors,
    };
  }

  // Rule 5: Medium runway + balanced goals → Specialize or Combine
  if (runway >= 9 && runway <= 17) {
    confidenceFactors.push("Medium runway (9-17 months)");
    return {
      primary: "specialize",
      secondary: "combine",
      reasoning:
        "Your moderate runway supports focused execution. Specialization balances speed with differentiation.",
      confidenceFactors,
    };
  }

  // Default fallback
  return {
    primary: "create",
    reasoning:
      "Based on available data, differentiation through innovation is recommended. Consider linking more profile data for refined suggestions.",
    confidenceFactors: ["Default recommendation"],
  };
}
```

#### Checklist 1.4

| #     | Item                                | Pass Criteria                                     |
| ----- | ----------------------------------- | ------------------------------------------------- |
| 1.4.1 | Create recommendation file          | File exists at `utils/approach-recommendation.ts` |
| 1.4.2 | Export `recommendApproach` function | Function is importable                            |
| 1.4.3 | Handles no profile                  | Returns default with explanation                  |
| 1.4.4 | Short runway → Copy/Localize        | ≤8 months runway recommends proven models         |
| 1.4.5 | Long runway + exit → Create         | ≥18 months with exit goal recommends innovation   |
| 1.4.6 | Domain expertise → Specialize       | Expertise presence recommends specialization      |
| 1.4.7 | Returns reasoning                   | Every recommendation includes explanation         |
| 1.4.8 | Returns confidence factors          | Lists data points used for recommendation         |

---

### 1.5 Position Phase Container

**File:** `frontend/src/components/PositionPhaseContainer.tsx` (new)

Orchestrates the sub-steps within the Position phase.

**Sub-steps:**

1. Financial Allocation (FinancialAllocationForm)
2. Strategic Approach (StrategicApproachSelector)
3. Analysis Results (refactored from DifferentiationView)
4. Decision Capture (new, Phase 5)

**State Management:**

```typescript
type PositionSubStep = "allocation" | "approach" | "analysis" | "decision";

const [currentSubStep, setCurrentSubStep] =
  useState<PositionSubStep>("allocation");
const [allocation, setAllocation] = useState<IdeaFinancialAllocation | null>(
  null,
);
const [approach, setApproach] = useState<StrategicApproach | null>(null);
```

**Flow Logic:**

- Start at 'allocation' if no allocation exists
- Start at 'approach' if allocation exists but no approach
- Start at 'analysis' if both exist
- Can navigate back to previous sub-steps

#### Checklist 1.5

| #     | Item                          | Pass Criteria                                      |
| ----- | ----------------------------- | -------------------------------------------------- |
| 1.5.1 | Create component file         | File exists, exports component                     |
| 1.5.2 | Render correct sub-step       | Shows allocation form first                        |
| 1.5.3 | Advance to approach           | After saving allocation, shows approach selector   |
| 1.5.4 | Advance to analysis           | After selecting approach, shows analysis           |
| 1.5.5 | Back navigation works         | Can return to previous sub-steps                   |
| 1.5.6 | State persists                | Refreshing page resumes at correct sub-step        |
| 1.5.7 | Integrate in IdeaDetailPhased | Position phase uses this container                 |
| 1.5.8 | Uses recommendation logic     | Calls `recommendApproach()` and passes to selector |

---

### 1.6 Update IdeaDetailPhased Integration

**File:** `frontend/src/pages/IdeaDetailPhased.tsx`

Replace the `currentPhase === 'differentiate'` block with `PositionPhaseContainer`.

```typescript
{currentPhase === 'position' && (
  <PositionPhaseContainer
    ideaSlug={slug!}
    ideaTitle={idea.title}
    userProfile={profile}
    onComplete={handleAdvancePhase}
  />
)}
```

#### Checklist 1.6

| #     | Item                           | Pass Criteria                                  |
| ----- | ------------------------------ | ---------------------------------------------- |
| 1.6.1 | Remove old differentiate block | No 'differentiate' case in phase switch        |
| 1.6.2 | Add position block             | 'position' case renders PositionPhaseContainer |
| 1.6.3 | Pass required props            | All props available and passed                 |
| 1.6.4 | Phase advancement works        | Completing position advances to update         |
| 1.6.5 | End-to-end flow works          | Can go Clarify → Position → Update             |

---

### Phase 1 Definition of Done

| Criterion                           | Verification Method                                                 |
| ----------------------------------- | ------------------------------------------------------------------- |
| Phase renamed throughout            | Search for 'differentiat' finds no code references                  |
| Financial allocation form works     | Can fill form, save, and see saved values                           |
| Approach recommendation logic works | Function returns appropriate approach based on profile + allocation |
| Approach selector works             | Can select approach, see recommendation with reasoning              |
| Sub-step navigation works           | Can move forward and back within Position                           |
| Integration with main flow works    | Full Clarify → Position → Update navigation                         |

---

## Phase 2: Agent Refactoring

**Objective:** Make the analysis agent approach-aware and financially-informed.

**Dependencies:** Phase 0 complete (Phase 1 helpful but not blocking)

**Estimated Effort:** 5-7 days

---

### 2.1 Approach-Specific Prompts

**File:** `agents/approach-prompts.ts` (new)

Create prompt templates for each strategic approach:

```typescript
export const APPROACH_PROMPTS: Record<StrategicApproach, string> = {
  create: `You are analyzing a market positioning for a CREATE strategy.
The user wants to build something genuinely new and differentiate in the market.

Focus your analysis on:
1. Market whitespace - where are the gaps?
2. Category creation cost - how much to educate the market?
3. First-mover advantages and disadvantages
4. Competitive response timeline
5. Market education requirements

Be realistic about the challenges of creating new categories.`,

  copy_improve: `You are analyzing a market positioning for a COPY & IMPROVE strategy.
The user wants to take a proven model and execute it better.

Focus your analysis on:
1. Who to copy - identify successful models in this space
2. What to improve - their specific weaknesses
3. Execution playbook - how did they grow?
4. Their unit economics - as benchmarks for planning
5. Defensibility without novelty - how to win without being first

Provide concrete examples of companies to study.`,

  combine: `You are analyzing a market positioning for a COMBINE strategy.
The user wants to merge two or more validated concepts.

Focus your analysis on:
1. Concept validation status - are both concepts proven?
2. Customer overlap - do the same people want both?
3. Integration complexity - technical and business model
4. Combined value proposition - is whole > sum of parts?
5. Competitive landscape - who else is combining these?

Be specific about what concepts are being combined.`,

  localize: `You are analyzing a market positioning for a LOCALIZE strategy.
The user wants to bring a proven model to a new geography or segment.

Focus your analysis on:
1. Source model success metrics - proof it works elsewhere
2. Local market differences - what's different here?
3. Adaptation requirements - what must change?
4. Local competition - who's already here?
5. Regulatory/cultural barriers - what could block success?

Reference specific successful localizations as examples.`,

  specialize: `You are analyzing a market positioning for a SPECIALIZE strategy.
The user wants to narrow a general solution to a specific niche.

Focus your analysis on:
1. General solution landscape - what exists today?
2. Vertical-specific pain points - what's unique to this niche?
3. Depth vs. breadth tradeoffs - what do you gain/lose?
4. Switching costs - why would niche users switch?
5. Expansion path - how to grow beyond initial niche?

Identify specific verticals that could be targeted.`,

  time: `You are analyzing a market positioning for a TIMING strategy.
The user wants to retry a concept that failed before because the market is now ready.

Focus your analysis on:
1. Previous attempts - why did they fail?
2. What changed - technology, market, regulation, behavior?
3. Timing signals - evidence the market is ready now
4. Remaining risks - what could still go wrong?
5. Speed to market - how to move before window closes?

Be specific about what has changed since previous failures.`,
};
```

#### Checklist 2.1

| #     | Item                          | Pass Criteria                              |
| ----- | ----------------------------- | ------------------------------------------ |
| 2.1.1 | Create prompts file           | File exists, exports `APPROACH_PROMPTS`    |
| 2.1.2 | All 6 approaches have prompts | No undefined approaches                    |
| 2.1.3 | Prompts are approach-specific | Each prompt focuses on different analysis  |
| 2.1.4 | Prompts are actionable        | Prompts request specific, concrete outputs |

---

### 2.2 Competitive Response Schema

**File:** `types/incubation.ts`

Add competitive response modeling types:

```typescript
// Competitive response when you succeed
export interface CompetitorResponse {
  competitorName: string;
  responseType: "copy" | "price_war" | "acquire" | "partner" | "ignore";
  timeframeMonths: { low: number; high: number };
  threatLevel: "low" | "medium" | "high";
  yourDefense: string;
}

export interface CompetitiveResponseAnalysis {
  sustainableAdvantageWindowMonths: number;
  likelyResponses: CompetitorResponse[];
  defensibilityScore: number; // 1-10
  recommendations: string[];
  switchingCostOpportunities: string[];
}
```

#### Checklist 2.2

| #     | Item                                        | Pass Criteria        |
| ----- | ------------------------------------------- | -------------------- |
| 2.2.1 | Add `CompetitorResponse` interface          | TypeScript compiles  |
| 2.2.2 | Add `CompetitiveResponseAnalysis` interface | TypeScript compiles  |
| 2.2.3 | Export all types                            | All types importable |

---

### 2.3 Extended Strategy Output Schema

**File:** `types/incubation.ts`

Add enhanced strategy interface:

```typescript
// Revenue estimate range
export interface RevenueEstimate {
  low: number;
  mid: number;
  high: number;
}

// Unit economics estimate
export interface UnitEconomics {
  estimatedCAC: { low: number; high: number };
  estimatedLTV: { low: number; high: number };
  estimatedMargin: number; // 0-1
  breakEvenCustomers: number;
}

// Investment requirements
export interface InvestmentRequirement {
  upfront: { low: number; high: number };
  monthly: { low: number; high: number };
  timeToBreakEvenMonths: { low: number; high: number };
}

// Goal alignment assessment
export interface GoalAlignment {
  meetsIncomeTarget: boolean;
  incomeGap: number | null; // Negative if shortfall
  timelineAlignment: "faster" | "aligned" | "slower" | "unlikely";
  runwaySufficient: boolean;
  runwayGap: number | null; // Months short
  investmentFeasible: boolean;
  investmentGap: number | null; // Dollars short
}

// Validation step
export interface ValidationStep {
  name: string;
  description: string;
  durationWeeks: number;
  cost: number;
  successCriteria: string;
  killCriteria: string;
}

// Validation plan
export interface ValidationPlan {
  steps: ValidationStep[];
  totalCost: number;
  totalDurationWeeks: number;
}

// Reversibility assessment
export interface Reversibility {
  score: number; // 1-10
  pivotOptions: string[];
  sunkCostAtMonth6: number;
  transferableAssets: string[];
}

// Execution complexity
export interface ExecutionComplexity {
  score: number; // 1-10, lower is easier
  soloFounderFeasibility: number; // 1-10, higher is more feasible
  requiredWeeklyHours: number; // Estimated hours/week needed
  criticalDependencies: string[];
  teamSizeRecommendation: string;
  complexityFactors: Array<{
    factor: string;
    level: "low" | "medium" | "high";
  }>;
}

// Enhanced strategy with financial awareness
export interface FinanciallyAwareStrategy extends Strategy {
  // Revenue Projections
  revenueEstimates: {
    year1: RevenueEstimate;
    year3: RevenueEstimate;
    assumptions: string[];
  };

  // Unit Economics
  unitEconomics: UnitEconomics;

  // Investment Requirements
  investmentRequired: InvestmentRequirement;

  // Goal Alignment (computed against allocation)
  goalAlignment: GoalAlignment;

  // Validation Path
  validationPlan: ValidationPlan;

  // Reversibility
  reversibility: Reversibility;

  // Execution
  executionComplexity: ExecutionComplexity;

  // Which opportunities this addresses (IDs)
  addressesOpportunities: string[];

  // Which risks this mitigates (IDs)
  mitigatesRisks: string[];

  // Competitive response analysis
  competitiveResponse: CompetitiveResponseAnalysis;
}
```

#### Checklist 2.3

| #     | Item                                          | Pass Criteria                         |
| ----- | --------------------------------------------- | ------------------------------------- |
| 2.3.1 | Add all interfaces                            | TypeScript compiles                   |
| 2.3.2 | `FinanciallyAwareStrategy` extends `Strategy` | Existing strategy fields preserved    |
| 2.3.3 | All nested types defined                      | No `any` types or missing definitions |
| 2.3.4 | Include `competitiveResponse` field           | Field present in strategy output      |
| 2.3.5 | Export all types                              | All types importable                  |

---

### 2.4 Refactor Positioning Agent

**File:** `agents/differentiation.ts` → rename to `agents/positioning.ts`

**Key Changes:**

1. Import approach prompts
2. Accept `IdeaFinancialAllocation` as parameter
3. Include financial context in prompt
4. Request enhanced output format
5. Compute goal alignment post-processing

```typescript
import { APPROACH_PROMPTS } from "./approach-prompts.js";

export async function runPositioningAnalysis(
  ideaContent: string,
  approach: StrategicApproach,
  gapAnalysis: GapAnalysis,
  answers: Record<string, string>,
  profile: ProfileContext,
  allocation: IdeaFinancialAllocation,
  costTracker: CostTracker,
): Promise<PositioningAnalysis> {
  const approachPrompt = APPROACH_PROMPTS[approach];

  const financialContext = `
FINANCIAL CONTEXT FOR THIS IDEA:
- Allocated Budget: $${allocation.allocatedBudget.toLocaleString()}
- Allocated Time: ${allocation.allocatedWeeklyHours} hours/week
- Allocated Runway: ${allocation.allocatedRunwayMonths} months
- Target Income: ${allocation.targetIncomeFromIdea ? `$${allocation.targetIncomeFromIdea.toLocaleString()}/year` : "Not specified"}
- Income Timeline: ${allocation.incomeTimelineMonths ? `${allocation.incomeTimelineMonths} months` : "Not specified"}
- Income Type: ${allocation.incomeType}
- Max Acceptable Loss: ${allocation.maxAcceptableLoss ? `$${allocation.maxAcceptableLoss.toLocaleString()}` : "Not specified"}
- Risk Tolerance: ${allocation.ideaRiskTolerance || "Default"}
- Pivot Willingness: ${allocation.pivotWillingness}

IMPORTANT: All strategies must be evaluated against these ALLOCATED resources, not the user's total capacity.
Strategies requiring more than allocated budget or runway should be flagged as NOT FEASIBLE.
`;

  // Build full prompt with approach-specific instructions + financial context
  // Request JSON output matching FinanciallyAwareStrategy schema
  // ...
}
```

**Output JSON Schema for Agent:**

```json
{
  "strategies": [
    {
      "name": "string",
      "description": "string",
      "differentiators": ["string"],
      "tradeoffs": ["string"],
      "fitWithProfile": 1-10,
      "fiveWH": {
        "what": "string",
        "why": "string",
        "how": "string",
        "when": "string",
        "where": "string",
        "howMuch": "string"
      },
      "revenueEstimates": {
        "year1": { "low": 0, "mid": 0, "high": 0 },
        "year3": { "low": 0, "mid": 0, "high": 0 },
        "assumptions": ["string"]
      },
      "unitEconomics": {
        "estimatedCAC": { "low": 0, "high": 0 },
        "estimatedLTV": { "low": 0, "high": 0 },
        "estimatedMargin": 0.0-1.0,
        "breakEvenCustomers": 0
      },
      "investmentRequired": {
        "upfront": { "low": 0, "high": 0 },
        "monthly": { "low": 0, "high": 0 },
        "timeToBreakEvenMonths": { "low": 0, "high": 0 }
      },
      "validationPlan": {
        "steps": [
          {
            "name": "string",
            "description": "string",
            "durationWeeks": 0,
            "cost": 0,
            "successCriteria": "string",
            "killCriteria": "string"
          }
        ],
        "totalCost": 0,
        "totalDurationWeeks": 0
      },
      "reversibility": {
        "score": 1-10,
        "pivotOptions": ["string"],
        "sunkCostAtMonth6": 0,
        "transferableAssets": ["string"]
      },
      "executionComplexity": {
        "score": 1-10,
        "soloFounderFeasibility": 1-10,
        "criticalDependencies": ["string"],
        "teamSizeRecommendation": "string",
        "complexityFactors": [
          { "factor": "string", "level": "low|medium|high" }
        ]
      },
      "addressesOpportunities": ["opportunity-id"],
      "mitigatesRisks": ["risk-id"]
    }
  ],
  "marketOpportunities": [...],
  "competitiveRisks": [...],
  "marketTiming": {...},
  "summary": "string"
}
```

#### Checklist 2.4

| #     | Item                                  | Pass Criteria                         |
| ----- | ------------------------------------- | ------------------------------------- |
| 2.4.1 | Rename file to `positioning.ts`       | File exists at new path               |
| 2.4.2 | Update imports throughout codebase    | No broken imports                     |
| 2.4.3 | Accept `allocation` parameter         | Function signature updated            |
| 2.4.4 | Include financial context in prompt   | Financial data in agent prompt        |
| 2.4.5 | Request enhanced JSON output          | Prompt requests all new fields        |
| 2.4.6 | Request competitive response analysis | Agent outputs `competitiveResponse`   |
| 2.4.7 | Parse enhanced response               | Response parsing handles new schema   |
| 2.4.8 | Test with each approach               | All 6 approaches produce valid output |

---

### 2.5 Goal Alignment Computation

**File:** `agents/positioning.ts` or new `utils/goal-alignment.ts`

Post-processing function to compute goal alignment:

```typescript
// Extended GoalAlignment interface with time check
export interface GoalAlignment {
  meetsIncomeTarget: boolean;
  incomeGap: number | null;
  timelineAlignment: "faster" | "aligned" | "slower" | "unlikely";
  runwaySufficient: boolean;
  runwayGap: number | null;
  investmentFeasible: boolean;
  investmentGap: number | null;
  // NEW: Time/hours sufficiency
  timeSufficient: boolean;
  timeGap: number | null; // Hours/week shortfall
}

export function computeGoalAlignment(
  strategy: FinanciallyAwareStrategy,
  allocation: IdeaFinancialAllocation,
): GoalAlignment {
  const targetIncome = allocation.targetIncomeFromIdea;
  const targetTimeline = allocation.incomeTimelineMonths;
  const allocatedBudget = allocation.allocatedBudget;
  const allocatedRunway = allocation.allocatedRunwayMonths;
  const allocatedHours = allocation.allocatedWeeklyHours;

  // Income assessment
  let meetsIncomeTarget = true;
  let incomeGap: number | null = null;

  if (targetIncome !== null) {
    const midYear1 = strategy.revenueEstimates.year1.mid;
    const midYear3 = strategy.revenueEstimates.year3.mid;

    // Check if timeline <= 12 months, compare against year1
    // If timeline > 12 months, interpolate or use year3
    const relevantRevenue =
      targetTimeline && targetTimeline <= 12 ? midYear1 : midYear3;

    meetsIncomeTarget = relevantRevenue >= targetIncome;
    incomeGap = meetsIncomeTarget ? null : relevantRevenue - targetIncome;
  }

  // Timeline assessment
  const monthsToFirstRevenue =
    strategy.investmentRequired.timeToBreakEvenMonths.mid;
  let timelineAlignment: GoalAlignment["timelineAlignment"];

  if (!targetTimeline) {
    timelineAlignment = "aligned";
  } else if (monthsToFirstRevenue <= targetTimeline * 0.75) {
    timelineAlignment = "faster";
  } else if (monthsToFirstRevenue <= targetTimeline * 1.25) {
    timelineAlignment = "aligned";
  } else if (monthsToFirstRevenue <= targetTimeline * 2) {
    timelineAlignment = "slower";
  } else {
    timelineAlignment = "unlikely";
  }

  // Runway assessment
  const runwaySufficient = allocatedRunway >= monthsToFirstRevenue;
  const runwayGap = runwaySufficient
    ? null
    : monthsToFirstRevenue - allocatedRunway;

  // Investment assessment
  const upfrontNeeded = strategy.investmentRequired.upfront.mid;
  const investmentFeasible = allocatedBudget >= upfrontNeeded;
  const investmentGap = investmentFeasible
    ? null
    : upfrontNeeded - allocatedBudget;

  // Time/hours assessment (NEW)
  // Strategy should specify requiredWeeklyHours in executionComplexity
  const requiredHours = strategy.executionComplexity.requiredWeeklyHours || 0;
  const timeSufficient = allocatedHours >= requiredHours;
  const timeGap = timeSufficient ? null : requiredHours - allocatedHours;

  return {
    meetsIncomeTarget,
    incomeGap,
    timelineAlignment,
    runwaySufficient,
    runwayGap,
    investmentFeasible,
    investmentGap,
    timeSufficient,
    timeGap,
  };
}
```

#### Checklist 2.5

| #     | Item                           | Pass Criteria                                  |
| ----- | ------------------------------ | ---------------------------------------------- |
| 2.5.1 | Create goal alignment function | Function exists and is exported                |
| 2.5.2 | Income assessment works        | Correctly flags strategies below income target |
| 2.5.3 | Timeline assessment works      | Correctly categorizes timeline alignment       |
| 2.5.4 | Runway assessment works        | Correctly flags insufficient runway            |
| 2.5.5 | Investment assessment works    | Correctly flags insufficient budget            |
| 2.5.6 | Time/hours assessment works    | Correctly flags insufficient hours allocation  |
| 2.5.7 | Gap calculations correct       | Gaps are negative when shortfall exists        |
| 2.5.8 | Handles null targets           | Works when targets not specified               |

---

### 2.6 API Endpoint Update

**File:** `server/api.ts`

Update the differentiation analysis endpoint:

```typescript
// POST /api/ideas/:slug/positioning/analyze
// Changed from /api/ideas/:slug/differentiation/analyze

// Request body now requires:
{
  approach: StrategicApproach; // Required
  // allocation is fetched from DB, not passed in body
}

// Response includes enhanced strategies with goal alignment
```

#### Checklist 2.6

| #     | Item                         | Pass Criteria                                             |
| ----- | ---------------------------- | --------------------------------------------------------- |
| 2.6.1 | Rename endpoint              | New path works, old path returns 404 or redirect          |
| 2.6.2 | Require approach in body     | 400 error if approach missing                             |
| 2.6.3 | Fetch allocation from DB     | Uses saved allocation, not request body                   |
| 2.6.4 | Return enhanced strategies   | Response includes all new fields                          |
| 2.6.5 | Include competitive response | Response includes `competitiveResponse` for each strategy |
| 2.6.6 | Update frontend client       | Client uses new endpoint                                  |

---

### Phase 2 Definition of Done

| Criterion                     | Verification Method                                              |
| ----------------------------- | ---------------------------------------------------------------- |
| All 6 approach prompts work   | Run analysis with each approach, verify different outputs        |
| Financial context included    | Check agent prompts include allocation data                      |
| Enhanced output schema works  | Response includes revenue estimates, validation plan, etc.       |
| Goal alignment computed       | Strategies include feasibility assessments                       |
| Time sufficiency checked      | Goal alignment includes `timeSufficient` and `timeGap`           |
| Competitive response included | Each strategy has `competitiveResponse` analysis                 |
| Backward compatibility        | Existing saved results still load (with defaults for new fields) |

---

## Phase 3: Financial Viability UI

**Objective:** Surface financial analysis prominently so users can make informed decisions.

**Dependencies:** Phase 2 complete

**Estimated Effort:** 5-7 days

---

### 3.1 Financial Viability Card

**File:** `frontend/src/components/FinancialViabilityCard.tsx` (new)

Displays goal alignment for a strategy.

**Props:**

```typescript
interface FinancialViabilityCardProps {
  strategy: FinanciallyAwareStrategy;
  allocation: IdeaFinancialAllocation;
  className?: string;
}
```

**UI Requirements:**

- Header showing strategy name
- Three status indicators with icons:
  - Income Target: ✓ YES / ⚠ MAYBE / ✗ NO
  - Runway Sufficient: ✓ YES / ✗ NO (with gap if NO)
  - Investment Feasible: ✓ YES / ✗ NO (with gap if NO)
- Revenue estimates: Year 1 range, Year 3 range
- Time to break-even estimate
- If not feasible, show adjustment options

**Color Coding:**

- Green: All checks pass
- Amber: Income target marginal (MAYBE)
- Red: Any check fails

#### Checklist 3.1

| #     | Item                      | Pass Criteria                          |
| ----- | ------------------------- | -------------------------------------- |
| 3.1.1 | Create component file     | File exists, exports component         |
| 3.1.2 | Show income target status | Status with correct icon and color     |
| 3.1.3 | Show runway status        | Status with gap amount if insufficient |
| 3.1.4 | Show investment status    | Status with gap amount if insufficient |
| 3.1.5 | Show revenue estimates    | Year 1 and Year 3 ranges displayed     |
| 3.1.6 | Color coding works        | Card color reflects worst status       |
| 3.1.7 | Adjustment options shown  | When not feasible, options displayed   |

---

### 3.2 Runway Survival Chart

**File:** `frontend/src/components/RunwaySurvivalChart.tsx` (new)

Visual timeline showing runway vs. time-to-revenue.

**Props:**

```typescript
interface RunwaySurvivalChartProps {
  runwayMonths: number;
  timeToFirstRevenue: { low: number; mid: number; high: number };
  timeToBreakEven: { low: number; mid: number; high: number };
  className?: string;
}
```

**UI Requirements:**

- Horizontal bar chart showing timeline (0 to max of runway or break-even)
- Runway bar (solid)
- Time to first revenue bar (patterned)
- Time to break-even bar (different pattern)
- Danger zone highlighted where revenue > runway
- Legend explaining each bar

#### Checklist 3.2

| #     | Item                    | Pass Criteria                  |
| ----- | ----------------------- | ------------------------------ |
| 3.2.1 | Create component file   | File exists, exports component |
| 3.2.2 | Render runway bar       | Runway shown as solid bar      |
| 3.2.3 | Render revenue bar      | Time to revenue shown          |
| 3.2.4 | Render break-even bar   | Time to break-even shown       |
| 3.2.5 | Danger zone highlighted | Overlap area styled as warning |
| 3.2.6 | Responsive sizing       | Works at different widths      |
| 3.2.7 | Legend included         | All bars explained             |

---

### 3.3 Niche Trap Warning

**File:** `frontend/src/components/NicheTrapWarning.tsx` (new)

Alert when market opportunity is too small for income goals.

**Props:**

```typescript
interface NicheTrapWarningProps {
  opportunityDescription: string;
  estimatedMarketSize: number; // In dollars
  targetIncome: number;
  captureRateAssumption: number; // e.g., 0.05 for 5%
  suggestions: string[];
  className?: string;
}
```

**UI Requirements:**

- Warning icon and header
- Show the math:
  - Market size: $X
  - Realistic capture: Y%
  - Max revenue: $X \* Y = $Z
  - Your target: $W
  - Gap: $W - $Z
- Expansion suggestions as bullet points

#### Checklist 3.3

| #     | Item                     | Pass Criteria                  |
| ----- | ------------------------ | ------------------------------ |
| 3.3.1 | Create component file    | File exists, exports component |
| 3.3.2 | Show market math         | All calculations displayed     |
| 3.3.3 | Show gap clearly         | Gap highlighted with color     |
| 3.3.4 | Show suggestions         | Expansion options listed       |
| 3.3.5 | Only shows when relevant | Hidden when market >= target   |

---

### 3.4 Validation Roadmap Display

**File:** `frontend/src/components/ValidationRoadmap.tsx` (new)

Shows the validation plan for a strategy.

**Props:**

```typescript
interface ValidationRoadmapProps {
  validationPlan: ValidationPlan;
  className?: string;
}
```

**UI Requirements:**

- Steps as numbered list or timeline
- Each step shows: name, duration, cost, success criteria, kill criteria
- Total cost and duration at bottom
- Kill criteria highlighted in red/warning color

#### Checklist 3.4

| #     | Item                    | Pass Criteria                    |
| ----- | ----------------------- | -------------------------------- |
| 3.4.1 | Create component file   | File exists, exports component   |
| 3.4.2 | Show all steps          | Each validation step displayed   |
| 3.4.3 | Show step details       | Duration, cost, criteria visible |
| 3.4.4 | Show totals             | Total cost and time at bottom    |
| 3.4.5 | Kill criteria prominent | Kill criteria visually distinct  |

---

### 3.5 Execution Complexity Display

**File:** `frontend/src/components/ExecutionComplexity.tsx` (new)

Shows execution complexity assessment.

**Props:**

```typescript
interface ExecutionComplexityProps {
  complexity: ExecutionComplexity;
  className?: string;
}
```

**UI Requirements:**

- Overall complexity score with visual indicator (1-10)
- Solo founder feasibility score with indicator
- List of complexity factors with level badges
- Critical dependencies list
- Team size recommendation

#### Checklist 3.5

| #     | Item                     | Pass Criteria                       |
| ----- | ------------------------ | ----------------------------------- |
| 3.5.1 | Create component file    | File exists, exports component      |
| 3.5.2 | Show complexity score    | Score displayed with visual scale   |
| 3.5.3 | Show solo feasibility    | Score displayed with interpretation |
| 3.5.4 | Show factors             | Each factor with level badge        |
| 3.5.5 | Show dependencies        | Critical dependencies listed        |
| 3.5.6 | Show team recommendation | Team size displayed                 |
| 3.5.7 | Show required hours      | Required weekly hours displayed     |

---

### 3.6 Competitive Response Card

**File:** `frontend/src/components/CompetitiveResponseCard.tsx` (new)

Shows what happens when you succeed - how competitors will respond.

**Props:**

```typescript
interface CompetitiveResponseCardProps {
  competitiveResponse: CompetitiveResponseAnalysis;
  className?: string;
}
```

**UI Requirements:**

- Header: "When You Succeed"
- Sustainable advantage window (months) with visual indicator
- List of competitor responses with:
  - Competitor name
  - Response type (copy, price war, acquire, partner, ignore)
  - Timeframe range
  - Threat level badge
  - Your defense strategy
- Defensibility score (1-10) with visual
- Recommendations as action items
- Switching cost opportunities as callout

**Visual Design:**

- Timeline view showing when each competitor response occurs
- Color-coded threat levels (green=low, amber=medium, red=high)
- Advantage window as highlighted zone

#### Checklist 3.6

| #     | Item                              | Pass Criteria                          |
| ----- | --------------------------------- | -------------------------------------- |
| 3.6.1 | Create component file             | File exists, exports component         |
| 3.6.2 | Show advantage window             | Months displayed with visual indicator |
| 3.6.3 | Show competitor responses         | Each response with all fields          |
| 3.6.4 | Show threat levels                | Color-coded badges per response        |
| 3.6.5 | Show defensibility score          | Score with visual (1-10)               |
| 3.6.6 | Show recommendations              | Action items listed                    |
| 3.6.7 | Show switching cost opportunities | Callout section visible                |

---

### 3.7 Allocation Feasibility Check

**File:** `frontend/src/components/AllocationFeasibilityCheck.tsx` (new)

Compares strategy requirements against allocated resources (not total capacity).

**Props:**

```typescript
interface AllocationFeasibilityCheckProps {
  strategy: FinanciallyAwareStrategy;
  allocation: IdeaFinancialAllocation;
  className?: string;
}
```

**UI Requirements:**

- Header: "Resource Feasibility Check"
- Three resource comparisons:
  - Budget: Allocated vs. Required (with gap if any)
  - Hours/week: Allocated vs. Required (with gap if any)
  - Runway: Allocated vs. Required (with gap if any)
- Overall feasibility status: ✓ FEASIBLE / ⚠ TIGHT / ✗ INFEASIBLE
- If not feasible, show adjustment options:
  - "Increase allocation" (if capacity allows)
  - "Choose lower-cost strategy"
  - "Modify strategy to reduce cost"
  - "Seek external funding"

**Visual Design:**

- Progress bars showing allocated vs. required
- Gap highlighted in red when insufficient
- Adjustment options as clickable cards or buttons

#### Checklist 3.7

| #     | Item                            | Pass Criteria                             |
| ----- | ------------------------------- | ----------------------------------------- |
| 3.7.1 | Create component file           | File exists, exports component            |
| 3.7.2 | Show budget comparison          | Allocated vs. required with visual        |
| 3.7.3 | Show hours comparison           | Allocated vs. required with visual        |
| 3.7.4 | Show runway comparison          | Allocated vs. required with visual        |
| 3.7.5 | Show overall status             | Feasibility indicator visible             |
| 3.7.6 | Show gaps                       | Gap amounts displayed when insufficient   |
| 3.7.7 | Show adjustment options         | Options displayed when infeasible         |
| 3.7.8 | Distinguish from total capacity | Uses ALLOCATED values, not profile totals |

---

### 3.8 Profile Fit Breakdown

**File:** `frontend/src/components/ProfileFitBreakdown.tsx` (new)

Shows WHY a strategy scored high or low on profile fit.

**Props:**

```typescript
interface ProfileFitBreakdownProps {
  fitScore: number; // 1-10
  strengths: string[]; // Profile attributes that help
  gaps: string[]; // Profile attributes missing or weak
  suggestions: string[]; // How to address gaps
  relevantSkills?: string[]; // User's skills that apply
  relevantNetwork?: string[]; // User's network that applies
  className?: string;
}
```

**UI Requirements:**

- Header: "Profile Fit Analysis" with score badge
- Strengths section (green):
  - List of profile attributes that support this strategy
  - ✓ checkmarks for each
- Gaps section (amber/red):
  - List of profile attributes missing or weak
  - ⚠ warnings for each
  - Severity indicator (minor gap vs. critical gap)
- Suggestions section:
  - Actionable ways to address gaps
  - Priority ranking
- Relevant skills (if any):
  - User's skills that directly apply
- Relevant network (if any):
  - User's connections that could help

**Visual Design:**

- Two-column layout: Strengths | Gaps
- Score as circular progress indicator
- Suggestions as numbered action items

#### Checklist 3.8

| #     | Item                   | Pass Criteria                         |
| ----- | ---------------------- | ------------------------------------- |
| 3.8.1 | Create component file  | File exists, exports component        |
| 3.8.2 | Show fit score         | Score with visual indicator           |
| 3.8.3 | Show strengths         | List with checkmarks, green styling   |
| 3.8.4 | Show gaps              | List with warnings, amber/red styling |
| 3.8.5 | Show suggestions       | Actionable items listed               |
| 3.8.6 | Show relevant skills   | Skills displayed when present         |
| 3.8.7 | Show relevant network  | Network displayed when present        |
| 3.8.8 | Gap severity indicated | Critical vs. minor gaps distinguished |

---

### Phase 3 Definition of Done

| Criterion                          | Verification Method                              |
| ---------------------------------- | ------------------------------------------------ |
| All financial components render    | Visual inspection with test data                 |
| Color coding correct               | Green/amber/red based on status                  |
| Data displays correctly            | Numbers formatted, labels clear                  |
| Components responsive              | Work on mobile and desktop widths                |
| Integration with strategy display  | Components used in strategy cards                |
| Competitive response shown         | Card displays when analysis has competitor data  |
| Allocation feasibility check works | Shows ALLOCATED vs. required, not total capacity |
| Profile fit breakdown works        | Shows strengths, gaps, and suggestions           |

---

## Phase 4: Strategy Comparison Matrix

**Objective:** Replace accordion with side-by-side comparison.

**Dependencies:** Phase 2, 3 complete

**Estimated Effort:** 4-6 days

---

### 4.1 Strategic Summary Card

**File:** `frontend/src/components/StrategicSummaryCard.tsx` (new)

Always-visible card at top showing synthesized strategic guidance.

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
    fit: "high" | "medium" | "low";
  };
  criticalRisk: {
    description: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  };
  timingAssessment: {
    urgency: "high" | "medium" | "low";
    window: string;
  };
  overallConfidence: number; // 0-1
  className?: string;
}
```

**UI Requirements:**

- Always visible at top of Position phase (not collapsible)
- Four quadrants or horizontal sections:
  1. **Recommended Strategy**: Name, fit score, brief reason
  2. **Key Opportunity**: Segment name, fit level
  3. **Critical Risk**: Description, severity badge, mitigation hint
  4. **Timing**: Window description, urgency indicator
- Overall confidence as progress bar or percentage badge
- "View Details" links scroll to relevant sections below

**Visual Design:**

- Card with prominent styling (slightly elevated)
- Color-coded urgency/severity indicators
- Strategy name as primary heading
- Compact but informative layout

#### Checklist 4.1

| #     | Item                      | Pass Criteria                            |
| ----- | ------------------------- | ---------------------------------------- |
| 4.1.1 | Create component file     | File exists, exports component           |
| 4.1.2 | Show recommended strategy | Name, score, and reason displayed        |
| 4.1.3 | Show primary opportunity  | Segment with fit level badge             |
| 4.1.4 | Show critical risk        | Description with severity and mitigation |
| 4.1.5 | Show timing assessment    | Window and urgency indicator             |
| 4.1.6 | Show confidence           | Overall confidence with visual           |
| 4.1.7 | Links work                | "View Details" scrolls to sections       |
| 4.1.8 | Always visible            | No collapse/expand behavior              |

---

### 4.2 Strategy Comparison Matrix

**File:** `frontend/src/components/StrategyComparisonMatrix.tsx` (new)

Table view for comparing strategies.

**Props:**

```typescript
interface StrategyComparisonMatrixProps {
  strategies: FinanciallyAwareStrategy[];
  selectedStrategyId: string | null;
  onSelectStrategy: (id: string) => void;
  allocation: IdeaFinancialAllocation;
  className?: string;
}
```

**Columns:**

1. Strategy Name (with recommended badge)
2. Profile Fit (1-10 with color)
3. Revenue Potential (Year 1 mid estimate)
4. Investment Required (upfront mid estimate)
5. Time to Revenue (months)
6. Risk Level (based on execution complexity)
7. Feasibility (goal alignment summary)

**Features:**

- Sortable columns
- Filter chips: "Quick Win", "Best Fit", "Highest Upside", "Lowest Risk"
- Row click selects strategy
- Selected row highlighted

#### Checklist 4.2

| #     | Item                     | Pass Criteria                       |
| ----- | ------------------------ | ----------------------------------- |
| 4.2.1 | Create component file    | File exists, exports component      |
| 4.2.2 | Render all columns       | All 7 columns visible               |
| 4.2.3 | Render all strategies    | Each strategy is a row              |
| 4.2.4 | Sort by column           | Clicking header sorts               |
| 4.2.5 | Filter chips work        | Clicking chip filters rows          |
| 4.2.6 | Row selection works      | Clicking row calls onSelectStrategy |
| 4.2.7 | Selected row highlighted | Visual distinction for selected     |
| 4.2.8 | Color coding in cells    | Values colored by goodness          |

---

### 4.3 Strategy Detail Panel

**File:** `frontend/src/components/StrategyDetailPanel.tsx` (new)

Full details for selected strategy.

**Props:**

```typescript
interface StrategyDetailPanelProps {
  strategy: FinanciallyAwareStrategy;
  allocation: IdeaFinancialAllocation;
  opportunities: Opportunity[]; // To show which are addressed
  risks: Risk[]; // To show which are mitigated
  onClose?: () => void;
  className?: string;
}
```

**Sections (all visible, not collapsible):**

1. Header with name and fit score
2. 5W+H breakdown (all 6 items)
3. Financial Viability Card
4. Validation Roadmap
5. Execution Complexity
6. Reversibility assessment
7. Related opportunities (linked by ID)
8. Mitigated risks (linked by ID)

#### Checklist 4.3

| #      | Item                            | Pass Criteria                  |
| ------ | ------------------------------- | ------------------------------ |
| 4.3.1  | Create component file           | File exists, exports component |
| 4.3.2  | Show 5W+H                       | All 6 items visible by default |
| 4.3.3  | Include FinancialViabilityCard  | Card rendered                  |
| 4.3.4  | Include ValidationRoadmap       | Roadmap rendered               |
| 4.3.5  | Include ExecutionComplexity     | Complexity rendered            |
| 4.3.6  | Include CompetitiveResponseCard | Card rendered                  |
| 4.3.7  | Include ProfileFitBreakdown     | Breakdown rendered             |
| 4.3.8  | Show reversibility              | Score and pivot options shown  |
| 4.3.9  | Show linked opportunities       | Addressed opportunities listed |
| 4.3.10 | Show linked risks               | Mitigated risks listed         |

---

### 4.4 Relationship Diagram

**File:** `frontend/src/components/RelationshipDiagram.tsx` (new)

Visual diagram showing connections between strategies, opportunities, and risks.

**Props:**

```typescript
interface RelationshipDiagramProps {
  strategies: Array<{
    id: string;
    name: string;
    addressesOpportunities: string[];
    mitigatesRisks: string[];
  }>;
  opportunities: Array<{
    id: string;
    segment: string;
    fit: "high" | "medium" | "low";
  }>;
  risks: Array<{
    id: string;
    description: string;
    severity: "high" | "medium" | "low";
  }>;
  selectedStrategyId?: string;
  onStrategyClick?: (id: string) => void;
  className?: string;
}
```

**UI Requirements:**

- Three columns layout:
  - Left: Opportunities (nodes)
  - Center: Strategies (nodes)
  - Right: Risks (nodes)
- Lines connecting:
  - Opportunity → Strategy (when strategy addresses opportunity)
  - Strategy → Risk (when strategy mitigates risk)
- Color coding:
  - Opportunities by fit level
  - Risks by severity
  - Lines by relationship strength
- Selected strategy highlights its connections
- Hover reveals relationship details

**Visual Design:**

- Can use simple SVG/CSS or library like react-flow/visx
- Nodes as rounded rectangles
- Lines as bezier curves
- Animation on selection

**Alternative (Simpler):**

- Tag-based display without diagram
- Each strategy shows linked opportunity/risk tags
- Tags are clickable to filter

#### Checklist 4.4

| #     | Item                             | Pass Criteria                          |
| ----- | -------------------------------- | -------------------------------------- |
| 4.4.1 | Create component file            | File exists, exports component         |
| 4.4.2 | Show all strategies              | Strategy nodes visible                 |
| 4.4.3 | Show all opportunities           | Opportunity nodes visible              |
| 4.4.4 | Show all risks                   | Risk nodes visible                     |
| 4.4.5 | Show connections                 | Lines/connections visible              |
| 4.4.6 | Selection highlights connections | Selected strategy dims unrelated items |
| 4.4.7 | Color coding works               | Fit and severity reflected in colors   |
| 4.4.8 | Interactive                      | Clicking/hovering works                |

---

### 4.5 Refactor DifferentiationView

**File:** `frontend/src/components/DifferentiationView.tsx`

Replace accordion with new components.

**New Structure:**

```tsx
<div className="space-y-6">
  {/* Summary Card - always visible */}
  <StrategicSummaryCard
    recommendedStrategy={...}
    overallConfidence={...}
    summary={...}
  />

  {/* Comparison Matrix */}
  <StrategyComparisonMatrix
    strategies={strategies}
    selectedStrategyId={selectedId}
    onSelectStrategy={setSelectedId}
    allocation={allocation}
  />

  {/* Detail Panel for Selected */}
  {selectedStrategy && (
    <StrategyDetailPanel
      strategy={selectedStrategy}
      allocation={allocation}
      opportunities={opportunities}
      risks={risks}
    />
  )}

  {/* Continue button */}
  <div className="flex justify-end">
    <button
      onClick={onContinue}
      disabled={!selectedId}
      className="btn btn-primary"
    >
      Continue with Selected Strategy
    </button>
  </div>
</div>
```

#### Checklist 4.5

| #     | Item                         | Pass Criteria                              |
| ----- | ---------------------------- | ------------------------------------------ |
| 4.5.1 | Remove accordion pattern     | No collapsible sections for main content   |
| 4.5.2 | Add StrategicSummaryCard     | Summary always visible at top              |
| 4.5.3 | Add StrategyComparisonMatrix | Matrix renders                             |
| 4.5.4 | Add StrategyDetailPanel      | Panel renders when strategy selected       |
| 4.5.5 | Add RelationshipDiagram      | Diagram renders (or tag-based alternative) |
| 4.5.6 | Selection state managed      | Selecting in matrix updates detail panel   |
| 4.5.7 | Continue requires selection  | Button disabled without selection          |
| 4.5.8 | Old props still work         | Loading/error states still function        |

---

### Phase 4 Definition of Done

| Criterion                        | Verification Method                                      |
| -------------------------------- | -------------------------------------------------------- |
| Strategic summary always visible | Card at top never collapses                              |
| Matrix displays all strategies   | Visual inspection                                        |
| Sorting works                    | Click each column header                                 |
| Filtering works                  | Click each filter chip                                   |
| Selection works                  | Click row, see detail panel                              |
| Detail panel comprehensive       | All sections visible (5W+H, financial, complexity, etc.) |
| Relationship diagram works       | Connections between strategy/opportunity/risk visible    |
| No accordion pattern             | Verify no collapse/expand for main content               |

---

## Phase 5: Decision Capture & Integration

**Objective:** Persist decisions and flow them to the Update phase.

**Dependencies:** Phase 4 complete

**Estimated Effort:** 3-5 days

---

### 5.1 Decision Capture Component

**File:** `frontend/src/components/DecisionCapture.tsx` (new)

Captures user's strategic decisions.

**Props:**

```typescript
interface DecisionCaptureProps {
  strategies: FinanciallyAwareStrategy[];
  risks: Risk[];
  selectedPrimaryId: string | null;
  selectedSecondaryId: string | null;
  acknowledgedRiskIds: string[];
  timingDecision: "proceed" | "wait" | null;
  notes: string;
  onPrimaryChange: (id: string) => void;
  onSecondaryChange: (id: string | null) => void;
  onRiskAcknowledge: (id: string, acknowledged: boolean) => void;
  onTimingChange: (decision: "proceed" | "wait") => void;
  onNotesChange: (notes: string) => void;
  onSave: () => Promise<void>;
  canSave: boolean;
  saving: boolean;
}
```

**UI Requirements:**

- Primary strategy: Radio buttons
- Secondary strategy: Checkboxes (optional, max 1)
- Risk acknowledgment: Checkboxes for high/critical risks
- Timing decision: Two-button toggle
- Notes: Textarea
- Save button

#### Checklist 5.1

| #     | Item                      | Pass Criteria                  |
| ----- | ------------------------- | ------------------------------ |
| 5.1.1 | Create component file     | File exists, exports component |
| 5.1.2 | Primary selection works   | Radio buttons, one selected    |
| 5.1.3 | Secondary selection works | Checkbox, optional             |
| 5.1.4 | Risk acknowledgment works | Checkboxes for each risk       |
| 5.1.5 | Timing toggle works       | Two-button toggle              |
| 5.1.6 | Notes input works         | Textarea captures text         |
| 5.1.7 | Save button works         | Calls onSave when enabled      |
| 5.1.8 | Disable states work       | Save disabled when invalid     |

---

### 5.2 Positioning Decisions Table

**File:** `database/migrations/012_positioning_decisions.sql`

```sql
CREATE TABLE IF NOT EXISTS positioning_decisions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL UNIQUE,

  -- Strategy Selection
  primary_strategy_id TEXT NOT NULL,
  primary_strategy_name TEXT NOT NULL,
  secondary_strategy_id TEXT,
  secondary_strategy_name TEXT,

  -- Approach Used
  strategic_approach TEXT NOT NULL,

  -- Risk Acknowledgment
  acknowledged_risk_ids TEXT,  -- JSON array of risk IDs
  acknowledged_risk_count INTEGER DEFAULT 0,

  -- Timing
  timing_decision TEXT NOT NULL CHECK (timing_decision IN ('proceed', 'wait')),

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_positioning_decisions_idea_id ON positioning_decisions(idea_id);
```

#### Checklist 5.2

| #     | Item                  | Pass Criteria              |
| ----- | --------------------- | -------------------------- |
| 5.2.1 | Create migration file | File exists                |
| 5.2.2 | Run migration         | `npm run migrate` succeeds |
| 5.2.3 | Table created         | Schema visible in database |
| 5.2.4 | Constraints work      | Invalid data rejected      |

---

### 5.3 API Endpoints for Decisions

**File:** `server/api.ts`

```typescript
// GET /api/ideas/:slug/positioning/decision
// Returns saved decision or null

// POST /api/ideas/:slug/positioning/decision
// Creates or updates decision

// DELETE /api/ideas/:slug/positioning/decision
// Removes decision
```

#### Checklist 5.3

| #     | Item                      | Pass Criteria            |
| ----- | ------------------------- | ------------------------ |
| 5.3.1 | Implement GET endpoint    | Returns decision or null |
| 5.3.2 | Implement POST endpoint   | Creates/updates decision |
| 5.3.3 | Implement DELETE endpoint | Removes decision         |
| 5.3.4 | Validation works          | Invalid data returns 400 |

---

### 5.4 Update Phase Integration

**File:** `agents/update-generator.ts`

Modify to accept and use positioning decision context.

```typescript
interface UpdateGeneratorContext {
  // Existing fields...

  // New: Positioning decision
  positioningDecision?: {
    primaryStrategy: {
      name: string;
      approach: string;
      fiveWH: FiveWH;
    };
    secondaryStrategy?: {
      name: string;
    };
    acknowledgedRisks: string[];
    timingDecision: "proceed" | "wait";
    notes?: string;
  };
}
```

Update prompt to include:

```
POSITIONING CONTEXT:
The user has selected the following strategic approach and positioning:

Primary Strategy: ${decision.primaryStrategy.name}
Strategic Approach: ${decision.primaryStrategy.approach}

Strategy Details:
- WHAT: ${decision.primaryStrategy.fiveWH.what}
- WHY: ${decision.primaryStrategy.fiveWH.why}
- HOW: ${decision.primaryStrategy.fiveWH.how}

User Notes: ${decision.notes || 'None'}

Please generate update suggestions that align with this chosen positioning.
Focus on refining the idea to better execute this strategy.
```

#### Checklist 5.4

| #     | Item                        | Pass Criteria                         |
| ----- | --------------------------- | ------------------------------------- |
| 5.4.1 | Accept decision context     | Function signature updated            |
| 5.4.2 | Include in prompt           | Decision details in agent prompt      |
| 5.4.3 | Output aligns with strategy | Suggestions reference chosen strategy |
| 5.4.4 | Works without decision      | Falls back gracefully if no decision  |

---

### 5.5 Update UpdatePhaseContent

**File:** `frontend/src/components/UpdatePhaseContent.tsx`

Show positioning context at top of update phase.

```tsx
{
  positioningDecision && (
    <div className="card mb-6 bg-purple-50 border-purple-200">
      <h4 className="text-sm font-medium text-purple-700 mb-2">
        Positioning Context
      </h4>
      <p className="text-sm text-gray-700">
        Updating idea based on:{" "}
        <strong>{positioningDecision.primaryStrategyName}</strong>
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Approach: {positioningDecision.strategicApproach}
      </p>
    </div>
  );
}
```

#### Checklist 5.5

| #     | Item                       | Pass Criteria                  |
| ----- | -------------------------- | ------------------------------ |
| 5.5.1 | Fetch positioning decision | Decision loaded on mount       |
| 5.5.2 | Show context card          | Card displays strategy name    |
| 5.5.3 | Pass to generator API      | Decision sent when generating  |
| 5.5.4 | Works without decision     | No error if no decision exists |

---

### Phase 5 Definition of Done

| Criterion                   | Verification Method                      |
| --------------------------- | ---------------------------------------- |
| Decision capture UI works   | Fill form, save, reload - values persist |
| Decision stored in database | Check database directly                  |
| Update phase shows context  | Navigate to update, see strategy name    |
| Update suggestions align    | Generated suggestions reference strategy |
| End-to-end flow works       | Clarify → Position → Update with context |

---

## Phase 6: Polish & Validation

**Objective:** Refine UX and ensure system coherence.

**Dependencies:** Phases 1-5 complete

**Estimated Effort:** 3-4 days

---

### 6.1 Visual Polish

**Checklist:**

| #     | Item                    | Pass Criteria                                 |
| ----- | ----------------------- | --------------------------------------------- |
| 6.1.1 | Consistent color coding | Green=good, Amber=warning, Red=bad everywhere |
| 6.1.2 | Loading states          | All async operations show loading indicators  |
| 6.1.3 | Error states            | All errors shown with clear messages          |
| 6.1.4 | Empty states            | Helpful messages when no data                 |
| 6.1.5 | Tooltips for metrics    | Hover explanations for scores/metrics         |
| 6.1.6 | Responsive design       | Works on mobile (375px) to desktop (1440px)   |

---

### 6.2 Edge Case Handling

**Checklist:**

| #     | Item                   | Pass Criteria                           |
| ----- | ---------------------- | --------------------------------------- |
| 6.2.1 | No profile linked      | Position phase prompts to link profile  |
| 6.2.2 | No allocation set      | Defaults shown with prompt to customize |
| 6.2.3 | No strategies feasible | Clear message with adjustment options   |
| 6.2.4 | Analysis fails         | Error message with retry option         |
| 6.2.5 | Incomplete profile     | Works with partial financial data       |
| 6.2.6 | Zero allocation values | Handles $0 budget, 0 hours gracefully   |

---

### 6.3 Testing

**Checklist:**

| #     | Item                                 | Pass Criteria                             |
| ----- | ------------------------------------ | ----------------------------------------- |
| 6.3.1 | Unit tests for goal alignment        | All edge cases covered                    |
| 6.3.2 | Unit tests for allocation validation | Constraint violations caught              |
| 6.3.3 | Integration test: full flow          | Clarify → Position → Update automated     |
| 6.3.4 | Manual test: each approach           | All 6 approaches tested manually          |
| 6.3.5 | Manual test: financial edge cases    | Test with various allocation combinations |

---

### 6.4 Documentation

**Checklist:**

| #     | Item                     | Pass Criteria                        |
| ----- | ------------------------ | ------------------------------------ |
| 6.4.1 | Update CLAUDE.md         | Reflect new phase name and features  |
| 6.4.2 | Update skills            | `/idea-position` skill if applicable |
| 6.4.3 | Add inline code comments | Complex logic documented             |

---

## Final Definition of Done

The Position phase redesign is complete when:

| #   | Criterion                                        | Verification                                                      |
| --- | ------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Phase renamed from "Differentiate" to "Position" | UI shows "Position"                                               |
| 2   | Per-idea financial allocation works              | Can set and save allocation                                       |
| 3   | All 6 strategic approaches selectable            | Can select each, get different analysis                           |
| 4   | Approach recommendation works                    | System recommends approach based on profile + allocation          |
| 5   | Revenue estimates included                       | Strategies show Year 1/Year 3 projections                         |
| 6   | Goal alignment computed (incl. time)             | Strategies show income, runway, investment, AND hours feasibility |
| 7   | Competitive response analysis included           | Each strategy shows competitor response scenarios                 |
| 8   | Strategic summary always visible                 | Card at top shows recommended strategy, opportunity, risk, timing |
| 9   | Comparison matrix replaces accordion             | Side-by-side view with sorting and filtering                      |
| 10  | Relationship diagram works                       | Strategy/opportunity/risk connections visible                     |
| 11  | 5W+H visible by default                          | No expand required                                                |
| 12  | Profile fit breakdown shown                      | Shows why strategy fits or doesn't fit profile                    |
| 13  | Allocation feasibility shown                     | Shows allocated vs. required resources                            |
| 14  | Validation roadmaps shown                        | Steps, costs, kill criteria visible                               |
| 15  | Decisions persist                                | Selected strategy saved to database                               |
| 16  | Update phase receives context                    | Strategy name shown, suggestions aligned                          |
| 17  | All tests pass                                   | `npm test` exits 0                                                |
| 18  | No TypeScript errors                             | `npx tsc --noEmit` exits 0                                        |
| 19  | Manual QA passed                                 | Full flow tested by non-developer                                 |

---

## Appendix: File Index

**New Files:**

_Database Migrations:_

- `database/migrations/011_idea_financial_allocations.sql`
- `database/migrations/012_positioning_decisions.sql`

_Backend/Agents:_

- `agents/approach-prompts.ts` - Prompts for each strategic approach
- `agents/positioning.ts` - Renamed from differentiation.ts

_Utilities:_

- `utils/approach-recommendation.ts` - Recommendation logic for strategic approach
- `utils/goal-alignment.ts` - Goal alignment computation (optional, can be in positioning.ts)

_Frontend Hooks:_

- `frontend/src/hooks/useAllocation.ts` - Hook for idea allocation CRUD

_Frontend Components - Phase 1 (UI Shell):_

- `frontend/src/components/FinancialAllocationForm.tsx` - Per-idea resource allocation form
- `frontend/src/components/StrategicApproachSelector.tsx` - 6 approach cards with recommendation
- `frontend/src/components/PositionPhaseContainer.tsx` - Orchestrates sub-steps

_Frontend Components - Phase 3 (Financial Viability):_

- `frontend/src/components/FinancialViabilityCard.tsx` - Goal alignment display
- `frontend/src/components/RunwaySurvivalChart.tsx` - Timeline visualization
- `frontend/src/components/NicheTrapWarning.tsx` - Market size warning
- `frontend/src/components/ValidationRoadmap.tsx` - Validation steps display
- `frontend/src/components/ExecutionComplexity.tsx` - Complexity assessment display
- `frontend/src/components/CompetitiveResponseCard.tsx` - Competitor response analysis
- `frontend/src/components/AllocationFeasibilityCheck.tsx` - Resource feasibility display
- `frontend/src/components/ProfileFitBreakdown.tsx` - Profile fit explanation

_Frontend Components - Phase 4 (Comparison):_

- `frontend/src/components/StrategicSummaryCard.tsx` - Always-visible summary at top
- `frontend/src/components/StrategyComparisonMatrix.tsx` - Side-by-side table
- `frontend/src/components/StrategyDetailPanel.tsx` - Full strategy details
- `frontend/src/components/RelationshipDiagram.tsx` - Strategy/opportunity/risk connections

_Frontend Components - Phase 5 (Decision):_

- `frontend/src/components/DecisionCapture.tsx` - Capture user decisions

**Modified Files:**

- `utils/schemas.ts` - Add user profile financial fields
- `types/incubation.ts` - Add all new type definitions (StrategicApproach, IdeaFinancialAllocation, CompetitiveResponseAnalysis, GoalAlignment, etc.)
- `server/api.ts` - New endpoints for allocation and decisions
- `frontend/src/api/client.ts` - Client functions for new endpoints
- `frontend/src/components/IncubationStepper.tsx` - Rename phase to "Position"
- `frontend/src/components/DifferentiationView.tsx` (major refactor) - Integrate new components
- `frontend/src/components/UpdatePhaseContent.tsx` - Show positioning context
- `frontend/src/pages/IdeaDetailPhased.tsx` - Use PositionPhaseContainer
- `agents/update-generator.ts` - Accept positioning decision context

**Renamed Files:**

- `agents/differentiation.ts` → `agents/positioning.ts`

**Deleted/Deprecated Files:**

- None (backward compatibility maintained)

**Total New Files: 21**
**Total Modified Files: 10**
