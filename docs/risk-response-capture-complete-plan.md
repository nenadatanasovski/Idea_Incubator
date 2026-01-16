# Risk Response Capture - Complete Implementation Plan

## First Principles Analysis: What's Missing?

### Question 1: What is the complete data lifecycle?

```
Risk Generation → Display → User Response → Storage → Downstream Usage → Visibility
       ↑                                                                      ↓
       └──────────────────── Feedback Loop ←──────────────────────────────────┘
```

**Current plan gaps:**

- No feedback loop (user disagreements don't improve future risk generation)
- No visibility of responses in later phases
- No connection to Evaluate phase risks (R1-R5)

### Question 2: What makes a risk "valid" in the first place?

The AI generates risks based on:

- Market analysis
- Competitive landscape
- Strategic approach chosen

**But the AI doesn't know:**

- User's insider knowledge
- Specific market conditions user has observed
- Relationships/partnerships user has
- Unique advantages not captured in the idea

**Gap:** When user disagrees, we should capture WHY - this is valuable signal.

### Question 3: What should happen when user disagrees?

Current plan says: "Record their reasoning"

But first principles says we should:

1. Capture structured disagreement reason (not just freetext)
2. Flag for potential AI learning/improvement
3. Adjust confidence in related evaluations
4. Show in Update phase as "disputed risk"

### Question 4: What about the two-risk-system problem?

**Position Phase:** Competitive/market risks (AI-generated)
**Evaluate Phase:** R1-R5 criteria risks (scored separately)

These are disconnected. User's risk responses in Position should influence:

- R2 (Market Risk) confidence
- R3 (Technical Risk) if user has technical expertise
- Overall evaluation context

**Gap:** No bridge between Position risk responses and Evaluate phase.

### Question 5: What visual feedback does user need?

- Progress indicator: "3 of 5 risks addressed" (optional, not blocking)
- Quick-response mode for low-severity risks
- Expand/collapse for risk details
- Visual distinction between response types

---

## Complete Implementation Plan

### Phase 1: Core Types & Data Model

**File:** `frontend/src/types/index.ts`

```typescript
// Risk response options
export type RiskResponseType =
  | "mitigate"
  | "accept"
  | "monitor"
  | "disagree"
  | "skip";

// Structured disagreement reasons
export type DisagreeReason =
  | "not_applicable" // This doesn't apply to my situation
  | "already_addressed" // Already handling this
  | "low_likelihood" // AI overestimated the likelihood
  | "insider_knowledge" // I have info the AI doesn't
  | "other"; // Custom reason

export interface RiskResponse {
  riskId: string;
  riskDescription: string; // Store for context
  riskSeverity: "high" | "medium" | "low";
  response: RiskResponseType;
  disagreeReason?: DisagreeReason;
  reasoning?: string; // Freetext explanation
  mitigationPlan?: string; // For mitigate/monitor
  respondedAt: string; // ISO timestamp
}

// Update PositioningDecision
export interface PositioningDecision {
  // ... existing fields
  acknowledgedRiskIds: string[]; // DEPRECATED but keep for compat
  riskResponses: RiskResponse[]; // New structured responses
  riskResponseStats: {
    total: number;
    responded: number;
    mitigate: number;
    accept: number;
    monitor: number;
    disagree: number;
    skipped: number;
  };
}
```

### Phase 2: Database Schema

**File:** `database/migrations/012_risk_responses.sql`

```sql
-- Add risk_responses column to positioning_decisions
ALTER TABLE positioning_decisions
ADD COLUMN risk_responses TEXT DEFAULT '[]';

-- Add risk_response_stats for quick lookups
ALTER TABLE positioning_decisions
ADD COLUMN risk_response_stats TEXT DEFAULT NULL;

-- Create risk_response_log for analytics/learning
CREATE TABLE IF NOT EXISTS risk_response_log (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    risk_id TEXT NOT NULL,
    risk_description TEXT NOT NULL,
    risk_severity TEXT NOT NULL,
    response_type TEXT NOT NULL,
    disagree_reason TEXT,
    reasoning TEXT,
    strategic_approach TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES ideas(id)
);

-- Index for analyzing disagreement patterns
CREATE INDEX idx_risk_response_log_disagree
ON risk_response_log(response_type, disagree_reason);
```

### Phase 3: DecisionCapture Component Redesign

**File:** `frontend/src/components/DecisionCapture.tsx`

**Key UI Changes:**

1. **Section Header:**

```
Risk Assessment (Optional)
Review the identified risks and share your perspective.
Your responses will help refine the Update phase suggestions.
[3 of 5 responded] ← progress indicator, not blocking
```

2. **Risk Card Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ [HIGH] Competitor X may copy your unique pricing model      │
│ ─────────────────────────────────────────────────────────── │
│ AI Suggested Mitigation: Build brand loyalty before...      │
│                                                             │
│ Your Response:                                              │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ 🛡️  │ │ ✓   │ │ 👁️  │ │ ✗   │ │ ⏭️  │                    │
│ │Miti-│ │Acce-│ │Moni-│ │Disa-│ │Skip │                    │
│ │gate │ │pt   │ │tor  │ │gree │ │     │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                             │
│ [Expand: Add your plan/reasoning...]                        │
└─────────────────────────────────────────────────────────────┘
```

3. **Disagree Flow:**

```
When "Disagree" selected:
┌─────────────────────────────────────────────────────────────┐
│ Why do you disagree?                                        │
│ ○ Not applicable to my situation                            │
│ ○ I'm already addressing this                               │
│ ○ AI overestimated the likelihood                           │
│ ○ I have insider knowledge (explain below)                  │
│ ○ Other reason                                              │
│                                                             │
│ [Optional: Explain your reasoning...]                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

4. **Remove blocking validation:**

```typescript
// OLD (remove)
if (!allCriticalRisksAcknowledged) {
  setError("Please acknowledge all critical risks");
  return;
}

// NEW
// No validation - user can proceed with any number of responses
// Show gentle encouragement if 0 responses:
if (riskResponses.length === 0 && risks.length > 0) {
  // Show toast: "Tip: Responding to risks helps generate better Update suggestions"
}
```

### Phase 4: API Changes

**File:** `server/api.ts`

```typescript
// Update savePositioningDecision endpoint
app.post("/api/ideas/:slug/positioning-decision", async (req, res) => {
  const { slug } = req.params;
  const decision = req.body;

  // Calculate stats
  const stats = {
    total: decision.riskResponses?.length || 0,
    responded:
      decision.riskResponses?.filter((r) => r.response !== "skip").length || 0,
    mitigate:
      decision.riskResponses?.filter((r) => r.response === "mitigate").length ||
      0,
    accept:
      decision.riskResponses?.filter((r) => r.response === "accept").length ||
      0,
    monitor:
      decision.riskResponses?.filter((r) => r.response === "monitor").length ||
      0,
    disagree:
      decision.riskResponses?.filter((r) => r.response === "disagree").length ||
      0,
    skipped:
      decision.riskResponses?.filter((r) => r.response === "skip").length || 0,
  };

  // Log to risk_response_log for analytics
  if (decision.riskResponses?.length > 0) {
    for (const response of decision.riskResponses) {
      await db.run(
        `
        INSERT INTO risk_response_log (id, idea_id, risk_id, risk_description,
          risk_severity, response_type, disagree_reason, reasoning, strategic_approach)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          uuid(),
          ideaId,
          response.riskId,
          response.riskDescription,
          response.riskSeverity,
          response.response,
          response.disagreeReason,
          response.reasoning,
          decision.selectedApproach,
        ],
      );
    }
  }

  // Save decision with responses
  await db.run(
    `
    INSERT OR REPLACE INTO positioning_decisions
    (id, idea_id, ..., risk_responses, risk_response_stats)
    VALUES (?, ?, ..., ?, ?)
  `,
    [...values, JSON.stringify(decision.riskResponses), JSON.stringify(stats)],
  );
});
```

### Phase 5: Update Phase Integration

**File:** `agents/update-generator.ts`

```typescript
// Include risk responses in context for update generation
const riskContext = riskResponses
  ?.map((r) => {
    switch (r.response) {
      case "mitigate":
        return `USER WILL MITIGATE: "${r.riskDescription}"
        Plan: ${r.mitigationPlan || "Not specified"}
        → Suggest content that supports this mitigation strategy`;

      case "disagree":
        return `USER DISAGREES WITH RISK: "${r.riskDescription}"
        Reason: ${r.disagreeReason}
        Explanation: ${r.reasoning || "None provided"}
        → Do NOT emphasize this risk in updates. User has context we don't.`;

      case "monitor":
        return `USER WILL MONITOR: "${r.riskDescription}"
        → Include monitoring checkpoints in suggested timeline`;

      case "accept":
        return `USER ACCEPTS RISK: "${r.riskDescription}"
        → Acknowledge but don't over-emphasize`;

      default:
        return null;
    }
  })
  .filter(Boolean)
  .join("\n\n");

// Add to update generator prompt
const prompt = `
...existing context...

## User's Risk Assessment
The user has reviewed the competitive risks and provided their perspective:

${riskContext}

Use this context to tailor your update suggestions. Respect user's insider
knowledge when they disagree with AI-identified risks.
`;
```

### Phase 6: Evaluate Phase Bridge (Optional Enhancement)

**File:** `agents/evaluator.ts`

```typescript
// When evaluating R2 (Market Risk), consider Position phase risk responses
const positioningContext =
  positioningDecision?.riskResponses?.length > 0
    ? `
    Note: User has already assessed ${positioningDecision.riskResponses.length}
    competitive risks in the Position phase:
    - ${positioningDecision.riskResponseStats.disagree} risks disputed by user
    - ${positioningDecision.riskResponseStats.mitigate} risks with mitigation plans

    User disagreements suggest they may have insider knowledge. Consider adjusting
    confidence levels accordingly.
  `
    : "";
```

### Phase 7: Display in Later Phases

**Add to IdeaDetail or relevant components:**

```typescript
// Show risk response summary in Evaluate/Iterate phases
{positioningDecision?.riskResponses?.length > 0 && (
  <div className="bg-gray-50 rounded-lg p-4 mb-4">
    <h4 className="text-sm font-medium text-gray-700 mb-2">
      Your Risk Assessment (from Position phase)
    </h4>
    <div className="flex gap-4 text-sm">
      <span className="text-green-600">
        {stats.mitigate} mitigating
      </span>
      <span className="text-blue-600">
        {stats.accept} accepted
      </span>
      <span className="text-yellow-600">
        {stats.monitor} monitoring
      </span>
      <span className="text-red-600">
        {stats.disagree} disputed
      </span>
    </div>
  </div>
)}
```

---

## Files to Modify (Complete List)

| File                                          | Changes                                | Priority |
| --------------------------------------------- | -------------------------------------- | -------- |
| `frontend/src/types/index.ts`                 | Add RiskResponse, DisagreeReason types | P0       |
| `frontend/src/components/DecisionCapture.tsx` | Complete UI redesign                   | P0       |
| `database/migrations/012_risk_responses.sql`  | Schema changes + log table             | P0       |
| `server/api.ts`                               | Handle new response format, logging    | P0       |
| `frontend/src/api/client.ts`                  | Update type signatures                 | P1       |
| `agents/update-generator.ts`                  | Use risk responses in prompts          | P1       |
| `agents/evaluator.ts`                         | Consider risk responses in R2          | P2       |
| `frontend/src/pages/IdeaDetail.tsx`           | Show risk response summary             | P2       |

---

## What the Original Plan Was Missing

1. **Structured disagreement reasons** - Not just freetext, but categorized reasons we can learn from

2. **Analytics/logging table** - `risk_response_log` captures patterns to improve AI risk generation over time

3. **Stats calculation** - Quick access to response breakdown without parsing JSON

4. **Skip option** - Explicit "I'll skip this" vs just not responding

5. **Downstream visibility** - Show responses in Evaluate/Iterate phases

6. **Evaluate phase bridge** - Connect Position risks to R1-R5 scoring context

7. **Timestamp tracking** - Know when responses were made

8. **UI details** - Progress indicators, expand/collapse, disagree flow

9. **Feedback loop design** - How disagreements could improve future risk generation

10. **Gentle encouragement vs blocking** - UX for encouraging responses without forcing them
