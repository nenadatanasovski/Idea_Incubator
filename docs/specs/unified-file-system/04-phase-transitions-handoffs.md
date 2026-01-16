# Developer Spec 04: Phase Transitions & Handoffs

**Feature**: Unified File System - Phase 4
**Version**: 1.0
**Ralph Loop Compatible**: Yes
**Depends On**: Spec 03 (TEST-SC-001 through TEST-SC-015)

---

## Overview

Implement phase-document mapping, AI-driven document classification, and auto-generated handoff briefs at phase transitions. The system determines required vs recommended documents based on lifecycle stage and conversation context.

---

## Test State Schema

Add to `tests/e2e/test-state.json`:

```json
{
  "tests": [
    {
      "id": "TEST-PH-001",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-SC-015"
    },
    {
      "id": "TEST-PH-002",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-001"
    },
    {
      "id": "TEST-PH-003",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-002"
    },
    {
      "id": "TEST-PH-004",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-003"
    },
    {
      "id": "TEST-PH-005",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-004"
    },
    {
      "id": "TEST-PH-006",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-005"
    },
    {
      "id": "TEST-PH-007",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-006"
    },
    {
      "id": "TEST-PH-008",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-007"
    },
    {
      "id": "TEST-PH-009",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-008"
    },
    {
      "id": "TEST-PH-010",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-009"
    },
    {
      "id": "TEST-PH-011",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-010"
    },
    {
      "id": "TEST-PH-012",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-011"
    },
    {
      "id": "TEST-PH-013",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-012"
    },
    {
      "id": "TEST-PH-014",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-013"
    },
    {
      "id": "TEST-PH-015",
      "status": "pending",
      "attempts": 0,
      "dependsOn": "TEST-PH-014"
    }
  ]
}
```

---

## Task 1: Classification Rules

### TEST-PH-001: Define Classification Rules Schema

**Preconditions:**

- Spec 03 tests passed (TEST-SC-015)

**Implementation Steps:**

1. Create file: `agents/ideation/classification-rules.ts`
2. Define `ClassificationRule` interface
3. Define `PHASE_REQUIREMENTS` constant with all phases
4. Export types and rules

**Pass Criteria:**

- [ ] File `agents/ideation/classification-rules.ts` exists
- [ ] `ClassificationRule` interface exported:
  ```typescript
  interface ClassificationRule {
    document: string;
    classification: "required" | "recommended" | "optional";
    conditions?: Condition[];
  }
  ```
- [ ] `PHASE_REQUIREMENTS` constant exported with structure:
  ```typescript
  const PHASE_REQUIREMENTS: Record<LifecycleStage, PhaseRequirements> = {
    SPARK: { required: ["README.md"], recommended: [] },
    CLARIFY: {
      required: ["README.md", "development.md"],
      recommended: ["target-users.md"],
    },
    // ... all 18 stages
  };
  ```
- [ ] All 18 lifecycle stages have requirements defined
- [ ] No duplicate documents in required/recommended for same stage

**Fail Criteria:**

- Missing lifecycle stages
- TypeScript errors
- Duplicate entries

**Verification Command:**

```bash
npx tsc --noEmit agents/ideation/classification-rules.ts && echo "PASS"
```

---

### TEST-PH-002: Define Content-Based Rules

**Preconditions:**

- TEST-PH-001 passed

**Implementation Steps:**

1. Add `CONTENT_INFERENCE_RULES` constant
2. Define keyword triggers that affect classification
3. Include: competitor mentions, B2B/B2C signals, funding mentions, technical complexity

**Pass Criteria:**

- [ ] `CONTENT_INFERENCE_RULES` constant exported
- [ ] Rules structure:
  ```typescript
  const CONTENT_INFERENCE_RULES: ContentRule[] = [
    {
      trigger: { keywords: ["competitor", "competition", "alternative"] },
      effect: {
        document: "research/competitive.md",
        classification: "recommended",
      },
    },
    {
      trigger: { keywords: ["B2B", "enterprise", "business customer"] },
      effect: {
        document: "target-users.md",
        requirement: "needs company segments section",
      },
    },
    // ...
  ];
  ```
- [ ] At least 10 content inference rules defined
- [ ] Rules cover: competitors, B2B, funding, technical, legal/regulatory, marketing

**Fail Criteria:**

- No content rules
- Rules don't compile
- Missing common triggers

**Verification Code:**

```typescript
import { CONTENT_INFERENCE_RULES } from "./agents/ideation/classification-rules";
assert(CONTENT_INFERENCE_RULES.length >= 10);
assert(
  CONTENT_INFERENCE_RULES.some((r) =>
    r.trigger.keywords.includes("competitor"),
  ),
);
```

---

## Task 2: Document Classifier

### TEST-PH-003: Create Document Classifier

**Preconditions:**

- TEST-PH-002 passed

**Implementation Steps:**

1. Create file: `agents/ideation/document-classifier.ts`
2. Add function: `classifyDocument(ideaSlug: string, filePath: string, phase: LifecycleStage): Promise<Classification>`
3. Check phase requirements first
4. Return classification: required | recommended | optional

**Pass Criteria:**

- [ ] File `agents/ideation/document-classifier.ts` exists
- [ ] Function `classifyDocument` is exported
- [ ] Returns 'required' for docs in phase's required list
- [ ] Returns 'recommended' for docs in phase's recommended list
- [ ] Returns 'optional' for all other docs
- [ ] Classification type: `'required' | 'recommended' | 'optional'`

**Fail Criteria:**

- Wrong classification returned
- TypeScript errors
- Missing function

**Verification Code:**

```typescript
import { classifyDocument } from "./agents/ideation/document-classifier";

const classification = await classifyDocument(
  "test-idea",
  "research/market.md",
  "RESEARCH",
);
assert(classification === "required"); // market.md required in RESEARCH phase
```

---

### TEST-PH-004: Classify with Content Inference

**Preconditions:**

- TEST-PH-003 passed

**Implementation Steps:**

1. Add function: `classifyWithContentInference(ideaSlug: string, filePath: string, phase: LifecycleStage, conversationContext: string): Promise<Classification>`
2. First apply phase rules
3. Then check content inference rules against conversation context
4. Upgrade classification if content triggers apply (optional → recommended → required)

**Pass Criteria:**

- [ ] Function `classifyWithContentInference` is exported
- [ ] Phase rules take baseline precedence
- [ ] Content triggers can upgrade classification (but never downgrade)
- [ ] If conversation mentions "competitor", competitive.md upgrades to recommended
- [ ] If conversation mentions "funding" or "investor", investor-pitch.md upgrades to recommended
- [ ] Returns highest classification when multiple rules match

**Fail Criteria:**

- Classification downgraded
- Content triggers ignored
- Phase rules bypassed

**Verification Code:**

```typescript
import { classifyWithContentInference } from "./agents/ideation/document-classifier";

// Without competitor mention
const c1 = await classifyWithContentInference(
  "test-idea",
  "research/competitive.md",
  "SPARK",
  "I have an idea for an app",
);
// With competitor mention
const c2 = await classifyWithContentInference(
  "test-idea",
  "research/competitive.md",
  "SPARK",
  "There are 3 competitors in this space",
);

assert(c1 === "optional");
assert(c2 === "recommended");
```

---

### TEST-PH-005: Bulk Classify All Documents

**Preconditions:**

- TEST-PH-004 passed

**Implementation Steps:**

1. Add function: `classifyAllDocuments(userSlug: string, ideaSlug: string, phase: LifecycleStage, conversationContext?: string): Promise<DocumentClassification[]>`
2. List all documents in idea folder
3. Classify each document
4. Return array with path and classification

**Pass Criteria:**

- [ ] Function `classifyAllDocuments` is exported
- [ ] Returns array of `{ path: string, classification: Classification, reason?: string }`
- [ ] All .md files in idea folder included
- [ ] Reason explains why classification was assigned
- [ ] Sorted by classification (required first, then recommended, then optional)

**Fail Criteria:**

- Missing documents
- Wrong classifications
- No reason provided

**Verification Code:**

```typescript
import { classifyAllDocuments } from "./agents/ideation/document-classifier";

const classifications = await classifyAllDocuments(
  "test-user",
  "test-idea",
  "RESEARCH",
);
assert(Array.isArray(classifications));
assert(
  classifications.every((c) =>
    ["required", "recommended", "optional"].includes(c.classification),
  ),
);

// Check sorting
const requiredIndex = classifications.findIndex(
  (c) => c.classification === "required",
);
const optionalIndex = classifications.findIndex(
  (c) => c.classification === "optional",
);
if (requiredIndex !== -1 && optionalIndex !== -1) {
  assert(requiredIndex < optionalIndex);
}
```

---

### TEST-PH-006: Save Classifications to Cache

**Preconditions:**

- TEST-PH-005 passed

**Implementation Steps:**

1. Add function: `saveClassifications(userSlug: string, ideaSlug: string, classifications: DocumentClassification[]): Promise<void>`
2. Write to `.metadata/classifications.json`
3. Include timestamp for cache invalidation

**Pass Criteria:**

- [ ] Function `saveClassifications` is exported
- [ ] Creates `.metadata/classifications.json` if missing
- [ ] File structure:
  ```json
  {
    "timestamp": "2025-01-06T12:00:00Z",
    "phase": "RESEARCH",
    "documents": [
      {
        "path": "README.md",
        "classification": "required",
        "reason": "Phase requirement"
      }
    ]
  }
  ```
- [ ] Overwrites existing cache
- [ ] Valid JSON output

**Fail Criteria:**

- File not created
- Invalid JSON
- Missing timestamp

**Verification Command:**

```bash
cat users/test-user/ideas/test-idea/.metadata/classifications.json | jq .
```

---

## Task 3: Phase Manager

### TEST-PH-007: Create Phase Manager

**Preconditions:**

- TEST-PH-006 passed

**Implementation Steps:**

1. Create file: `agents/ideation/phase-manager.ts`
2. Add function: `getCurrentPhase(userSlug: string, ideaSlug: string): Promise<LifecycleStage>`
3. Read from README.md frontmatter
4. Return current lifecycle stage

**Pass Criteria:**

- [ ] File `agents/ideation/phase-manager.ts` exists
- [ ] Function `getCurrentPhase` is exported
- [ ] Returns `LifecycleStage` from README.md frontmatter
- [ ] Returns 'SPARK' if no phase set
- [ ] Handles missing frontmatter gracefully

**Fail Criteria:**

- Wrong phase returned
- Crashes on missing file
- Invalid stage returned

**Verification Code:**

```typescript
import { getCurrentPhase } from "./agents/ideation/phase-manager";

const phase = await getCurrentPhase("test-user", "test-idea");
assert(typeof phase === "string");
assert(["SPARK", "CLARIFY", "RESEARCH" /* ... */].includes(phase));
```

---

### TEST-PH-008: Update Phase

**Preconditions:**

- TEST-PH-007 passed

**Implementation Steps:**

1. Add function: `updatePhase(userSlug: string, ideaSlug: string, newPhase: LifecycleStage): Promise<void>`
2. Update README.md frontmatter
3. Update `.metadata/timeline.json`
4. Log phase change

**Pass Criteria:**

- [ ] Function `updatePhase` is exported
- [ ] Updates lifecycle_stage in README.md frontmatter
- [ ] Updates current_phase in timeline.json
- [ ] Sets phase_started to current timestamp in timeline.json
- [ ] Preserves other frontmatter fields
- [ ] Validates newPhase is valid lifecycle stage

**Fail Criteria:**

- Frontmatter corrupted
- Timeline not updated
- Invalid phase accepted

**Verification Code:**

```typescript
import { updatePhase, getCurrentPhase } from "./agents/ideation/phase-manager";

await updatePhase("test-user", "test-idea", "CLARIFY");
const phase = await getCurrentPhase("test-user", "test-idea");
assert(phase === "CLARIFY");
```

---

### TEST-PH-009: Check Phase Transition Readiness

**Preconditions:**

- TEST-PH-008 passed

**Implementation Steps:**

1. Add function: `canTransitionTo(userSlug: string, ideaSlug: string, targetPhase: LifecycleStage): Promise<TransitionCheck>`
2. Check if required documents for current phase are complete
3. Return readiness status and blockers

**Pass Criteria:**

- [ ] Function `canTransitionTo` is exported
- [ ] Returns `TransitionCheck`:
  ```typescript
  interface TransitionCheck {
    canTransition: boolean;
    currentPhase: LifecycleStage;
    targetPhase: LifecycleStage;
    completionPercent: number;
    missingRequired: string[];
    warnings: string[];
  }
  ```
- [ ] `canTransition` is false if required docs incomplete
- [ ] `missingRequired` lists incomplete required documents
- [ ] `warnings` lists recommended docs that are incomplete
- [ ] Validates target phase is valid transition from current

**Fail Criteria:**

- Allows transition with missing required
- Wrong completion calculation
- Invalid transitions allowed

**Verification Code:**

```typescript
import { canTransitionTo } from "./agents/ideation/phase-manager";

const check = await canTransitionTo("test-user", "test-idea", "EVALUATE");
assert(typeof check.canTransition === "boolean");
assert(Array.isArray(check.missingRequired));
```

---

### TEST-PH-010: Execute Phase Transition

**Preconditions:**

- TEST-PH-009 passed

**Implementation Steps:**

1. Add function: `transitionPhase(userSlug: string, ideaSlug: string, targetPhase: LifecycleStage, force?: boolean): Promise<TransitionResult>`
2. If not force, check readiness first
3. Update phase
4. Trigger handoff brief generation
5. Return result with handoff brief

**Pass Criteria:**

- [ ] Function `transitionPhase` is exported
- [ ] Blocks transition if not ready (unless force=true)
- [ ] Updates phase on success
- [ ] Generates handoff brief on success
- [ ] Returns `TransitionResult`:
  ```typescript
  interface TransitionResult {
    success: boolean;
    previousPhase: LifecycleStage;
    newPhase: LifecycleStage;
    handoffBrief?: string;
    error?: string;
  }
  ```
- [ ] Force=true allows transition even with missing docs

**Fail Criteria:**

- Transition succeeds when not ready
- Phase not updated on success
- No handoff brief generated

**Verification Code:**

```typescript
import {
  transitionPhase,
  getCurrentPhase,
} from "./agents/ideation/phase-manager";

const result = await transitionPhase("test-user", "test-idea", "CLARIFY");
if (result.success) {
  assert(result.newPhase === "CLARIFY");
  assert(result.handoffBrief);
}
```

---

## Task 4: Handoff Brief Generator

### TEST-PH-011: Create Handoff Generator

**Preconditions:**

- TEST-PH-010 passed

**Implementation Steps:**

1. Create file: `agents/ideation/handoff-generator.ts`
2. Add function: `generateHandoffBrief(userSlug: string, ideaSlug: string, fromPhase: LifecycleStage, toPhase: LifecycleStage): Promise<string>`
3. Generate structured markdown summary

**Pass Criteria:**

- [ ] File `agents/ideation/handoff-generator.ts` exists
- [ ] Function `generateHandoffBrief` is exported
- [ ] Returns markdown string with sections:
  - Header with phases and date
  - What's Complete (with key data points)
  - What's Incomplete
  - Key Insights for Next Phase
  - AI Recommendation with confidence score
  - Decision checkboxes
- [ ] Key data points extracted from completed docs
- [ ] Confidence calculated from completion %

**Fail Criteria:**

- Missing sections
- Wrong phase info
- No data extraction

**Verification Code:**

```typescript
import { generateHandoffBrief } from "./agents/ideation/handoff-generator";

const brief = await generateHandoffBrief(
  "test-user",
  "test-idea",
  "RESEARCH",
  "EVALUATE",
);
assert(typeof brief === "string");
assert(brief.includes("# Handoff Brief"));
assert(brief.includes("RESEARCH"));
assert(brief.includes("EVALUATE"));
assert(brief.includes("What's Complete"));
```

---

### TEST-PH-012: Extract Key Insights

**Preconditions:**

- TEST-PH-011 passed

**Implementation Steps:**

1. Add function: `extractKeyInsights(userSlug: string, ideaSlug: string): Promise<Insight[]>`
2. Scan completed documents for key data
3. Extract: market size, competitors, target users, risks
4. Return structured insights

**Pass Criteria:**

- [ ] Function `extractKeyInsights` is exported
- [ ] Returns array of `Insight`:
  ```typescript
  interface Insight {
    category:
      | "market"
      | "competition"
      | "users"
      | "risk"
      | "technical"
      | "other";
    summary: string;
    source: string; // file path
    confidence: "high" | "medium" | "low";
  }
  ```
- [ ] Extracts market size from market.md (if present)
- [ ] Extracts competitor count from competitive.md (if present)
- [ ] Extracts user segments from target-users.md (if present)
- [ ] Returns empty array if no insights found

**Fail Criteria:**

- Crashes on empty docs
- Wrong category assignment
- Missing insights

**Verification Code:**

```typescript
import { extractKeyInsights } from "./agents/ideation/handoff-generator";

const insights = await extractKeyInsights("test-user", "test-idea");
assert(Array.isArray(insights));
insights.forEach((i) => {
  assert(
    ["market", "competition", "users", "risk", "technical", "other"].includes(
      i.category,
    ),
  );
  assert(i.summary.length > 0);
});
```

---

### TEST-PH-013: Calculate Confidence Score

**Preconditions:**

- TEST-PH-012 passed

**Implementation Steps:**

1. Add function: `calculateConfidence(userSlug: string, ideaSlug: string, targetPhase: LifecycleStage): Promise<ConfidenceScore>`
2. Weight completion of different doc types
3. Factor in quality indicators (section fill rate, token count)
4. Return confidence percentage and breakdown

**Pass Criteria:**

- [ ] Function `calculateConfidence` is exported
- [ ] Returns `ConfidenceScore`:
  ```typescript
  interface ConfidenceScore {
    overall: number; // 0-100
    breakdown: {
      documentCompleteness: number;
      dataQuality: number;
      validationStatus: number;
    };
    affectedCriteria: string[]; // Which evaluation criteria may be impacted
  }
  ```
- [ ] Overall is weighted average of breakdown
- [ ] `affectedCriteria` lists criteria lacking supporting data
- [ ] 0% if no docs complete, 100% if all required+recommended complete

**Fail Criteria:**

- Confidence > 100 or < 0
- Missing breakdown
- Wrong criteria mapping

**Verification Code:**

```typescript
import { calculateConfidence } from "./agents/ideation/handoff-generator";

const confidence = await calculateConfidence(
  "test-user",
  "test-idea",
  "EVALUATE",
);
assert(confidence.overall >= 0 && confidence.overall <= 100);
assert(confidence.breakdown.documentCompleteness !== undefined);
```

---

### TEST-PH-014: Save Handoff Brief

**Preconditions:**

- TEST-PH-013 passed

**Implementation Steps:**

1. Add function: `saveHandoffBrief(userSlug: string, ideaSlug: string, brief: string): Promise<string>`
2. Save to `planning/brief.md`
3. Add frontmatter with generation metadata
4. Return file path

**Pass Criteria:**

- [ ] Function `saveHandoffBrief` is exported
- [ ] Saves to `users/[user]/ideas/[idea]/planning/brief.md`
- [ ] Frontmatter includes:
  - id
  - title: "Handoff Brief"
  - generated_at timestamp
  - from_phase
  - to_phase
- [ ] Creates planning/ directory if needed
- [ ] Overwrites existing brief
- [ ] Returns file path

**Fail Criteria:**

- Wrong file path
- Missing frontmatter
- Directory not created

**Verification Code:**

```typescript
import {
  saveHandoffBrief,
  generateHandoffBrief,
} from "./agents/ideation/handoff-generator";
import * as fs from "fs";

const brief = await generateHandoffBrief(
  "test-user",
  "test-idea",
  "RESEARCH",
  "EVALUATE",
);
const path = await saveHandoffBrief("test-user", "test-idea", brief);
assert(fs.existsSync(`users/test-user/ideas/test-idea/${path}`));
```

---

## Task 5: Agent Announcements

### TEST-PH-015: Classification Change Announcements

**Preconditions:**

- TEST-PH-014 passed

**Implementation Steps:**

1. Add function: `generateClassificationAnnouncement(changes: ClassificationChange[]): string`
2. Format changes as natural language
3. Include action suggestions

**Pass Criteria:**

- [ ] Function `generateClassificationAnnouncement` is exported
- [ ] Input: array of `{ document: string, oldClassification: Classification, newClassification: Classification, reason: string }`
- [ ] Output: natural language announcement, e.g.:
  ```
  "Based on our discussion, I've marked 'Market Analysis' as required -
  you'll need this for a solid evaluation. Should I help create it?"
  ```
- [ ] Handles multiple changes in one announcement
- [ ] Includes reason for change
- [ ] Suggests next action

**Fail Criteria:**

- Awkward language
- Missing reason
- No action suggestion

**Verification Code:**

```typescript
import { generateClassificationAnnouncement } from "./agents/ideation/document-classifier";

const announcement = generateClassificationAnnouncement([
  {
    document: "research/competitive.md",
    oldClassification: "optional",
    newClassification: "recommended",
    reason: "You mentioned competitors in the conversation",
  },
]);

assert(announcement.includes("competitive"));
assert(announcement.includes("recommend"));
```

---

## Summary

| Test ID     | Description                         | Dependencies |
| ----------- | ----------------------------------- | ------------ |
| TEST-PH-001 | Define classification rules schema  | TEST-SC-015  |
| TEST-PH-002 | Define content-based rules          | TEST-PH-001  |
| TEST-PH-003 | Create document classifier          | TEST-PH-002  |
| TEST-PH-004 | Classify with content inference     | TEST-PH-003  |
| TEST-PH-005 | Bulk classify all documents         | TEST-PH-004  |
| TEST-PH-006 | Save classifications to cache       | TEST-PH-005  |
| TEST-PH-007 | Create phase manager                | TEST-PH-006  |
| TEST-PH-008 | Update phase                        | TEST-PH-007  |
| TEST-PH-009 | Check phase transition readiness    | TEST-PH-008  |
| TEST-PH-010 | Execute phase transition            | TEST-PH-009  |
| TEST-PH-011 | Create handoff generator            | TEST-PH-010  |
| TEST-PH-012 | Extract key insights                | TEST-PH-011  |
| TEST-PH-013 | Calculate confidence score          | TEST-PH-012  |
| TEST-PH-014 | Save handoff brief                  | TEST-PH-013  |
| TEST-PH-015 | Classification change announcements | TEST-PH-014  |

---

## Files to Create

| File                                      | Purpose                     |
| ----------------------------------------- | --------------------------- |
| `agents/ideation/classification-rules.ts` | Rule definitions            |
| `agents/ideation/document-classifier.ts`  | Classification engine       |
| `agents/ideation/phase-manager.ts`        | Phase transition management |
| `agents/ideation/handoff-generator.ts`    | Generate handoff briefs     |

---

## Execution Command

```bash
# Run the Ralph loop for this spec
python tests/e2e/ralph_loop.py --test-filter "TEST-PH-*"
```
