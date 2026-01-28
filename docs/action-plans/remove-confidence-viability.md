# Action Plan: Remove Confidence & Viability Metrics

## Scope

Remove the **ideation-level** confidence (0-100) and viability (0-100) metrics used to gate idea capture/display. **Preserve** graph-level confidence (0.0-1.0) on memory blocks, graph nodes/edges, evidence chains, and task file-impact analysis — these are a separate concept (extraction/link confidence) and unrelated.

## Key Decision: Capture Button Gating

Currently the "Capture Idea" button is disabled when `confidence < 50`. After removal, the capture button will be **always enabled** when a candidate exists. The candidate creation threshold (confidence >= 30) will also be removed — candidates are created whenever `candidateUpdate` is present in the AI response.

Similarly, viability < 50 triggers an "intervention" UI. This will be removed entirely.

---

## Tasks

### Task 1: Delete calculator files and their tests

**Files to delete:**

- `agents/ideation/confidence-calculator.ts`
- `agents/ideation/viability-calculator.ts`
- `tests/ideation/confidence-calculator.test.ts`
- `tests/ideation/viability-calculator.test.ts`

**Test script:**

```bash
# Verify files are gone
test ! -f agents/ideation/confidence-calculator.ts && \
test ! -f agents/ideation/viability-calculator.ts && \
test ! -f tests/ideation/confidence-calculator.test.ts && \
test ! -f tests/ideation/viability-calculator.test.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** All 4 files do not exist. `echo` prints `PASS`.
**Expected output:** `PASS`

---

### Task 2: Delete ConfidenceMeter and ViabilityMeter components

**Files to delete:**

- `frontend/src/components/ideation/ConfidenceMeter.tsx`
- `frontend/src/components/ideation/ViabilityMeter.tsx`

**Test script:**

```bash
test ! -f frontend/src/components/ideation/ConfidenceMeter.tsx && \
test ! -f frontend/src/components/ideation/ViabilityMeter.tsx && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** Both files do not exist. `echo` prints `PASS`.
**Expected output:** `PASS`

---

### Task 3: Remove confidence/viability from orchestrator

**File:** `agents/ideation/orchestrator.ts`

**Changes:**

- Remove imports of `calculateConfidence` and `calculateViability`
- Remove calls to these functions
- Remove `confidence` and `viability` from candidate create/update params
- Keep the candidate update logic but without metric values

**Test script:**

```bash
! grep -q "calculateConfidence\|calculateViability\|confidence-calculator\|viability-calculator" agents/ideation/orchestrator.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No references to confidence/viability calculators remain in the orchestrator.
**Expected output:** `PASS`

---

### Task 4: Remove confidence/viability from candidate-manager

**File:** `agents/ideation/candidate-manager.ts`

**Changes:**

- Remove `confidence` and `viability` from `getOrCreateForSession` params
- Remove the `confidence >= 50 ? "active" : "forming"` status logic — always set to `"active"`
- Remove `confidence` and `viability` from `create()` and `update()` params
- Keep the DB columns for now (Task 10 handles migration)

**Test script:**

```bash
! grep -q 'confidence >= 50' agents/ideation/candidate-manager.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No confidence-based status gating logic remains.
**Expected output:** `PASS`

---

### Task 5: Remove confidence/viability from IdeaCandidatePanel

**File:** `frontend/src/components/ideation/IdeaCandidatePanel.tsx`

**Changes:**

- Remove `confidence` and `viability` props
- Remove `ConfidenceMeter` and `ViabilityMeter` imports and usage
- Remove `disabled={confidence < 50}` from capture button — always enabled
- Remove `InterventionState` and `showIntervention` logic (viability < 50 check)
- Keep `ActiveState` but remove meters from it
- Keep `RisksList` if used independently of viability

**Test script:**

```bash
! grep -q 'ConfidenceMeter\|ViabilityMeter\|confidence < 50\|viability < 50' \
  frontend/src/components/ideation/IdeaCandidatePanel.tsx && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No references to confidence/viability meters or gating remain.
**Expected output:** `PASS`

---

### Task 6: Remove confidence/viability from SessionHeader

**File:** `frontend/src/components/ideation/SessionHeader.tsx`

**Changes:**

- Remove `confidence` prop
- Remove `disabled={confidence < 50}` from header capture button — always enabled

**Test script:**

```bash
! grep -q 'confidence < 50' frontend/src/components/ideation/SessionHeader.tsx && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No confidence gating in header.
**Expected output:** `PASS`

---

### Task 7: Remove confidence/viability from API routes

**File:** `server/routes/ideation.ts`

**Changes:**

- Remove `response.confidence >= 30` gate for candidate creation — create candidate whenever `response.candidateUpdate` exists
- Remove `response.confidence` and `response.viability` from candidate params
- Remove `confidenceAtCapture` and `viabilityAtCapture` from capture endpoint response metadata
- Remove intervention logic based on `response.viability < 25`

**Test script:**

```bash
! grep -q 'response.confidence\|response.viability\|confidenceAtCapture\|viabilityAtCapture' \
  server/routes/ideation.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No ideation-level confidence/viability references in routes.
**Expected output:** `PASS`

---

### Task 8: Remove confidence/viability from reducer and hooks

**Files:**

- `frontend/src/reducers/ideationReducer.ts`
- `frontend/src/hooks/useIdeationAPI.ts`

**Changes:**

- Remove `confidence: 0` and `viability: 100` from initial state
- Remove confidence/viability from action types and state updates
- Remove from API response types (MessageResponse, SessionResponse, SessionListResponse)

**Test script:**

```bash
! grep -q 'confidence.*viability\|viability.*confidence' \
  frontend/src/reducers/ideationReducer.ts \
  frontend/src/hooks/useIdeationAPI.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No confidence/viability state management remains.
**Expected output:** `PASS`

---

### Task 9: Remove confidence/viability from types

**File:** `types/ideation.ts`

**Changes:**

- Remove `confidence: number` and `viability: number` from `IdeaCandidate` interface
- Remove from any props interfaces (`IdeaCandidatePanelProps`, `ConfidenceMeterProps`, `ViabilityMeterProps`, `SessionHeaderProps`, etc.)
- Remove `ConfidenceMeterProps` and `ViabilityMeterProps` types entirely

**Test script:**

```bash
! grep -q 'ConfidenceMeterProps\|ViabilityMeterProps' types/ideation.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** Meter prop types are gone from the type definitions.
**Expected output:** `PASS`

---

### Task 10: Remove confidence/viability from handoff logic

**Files:**

- `agents/ideation/handoff.ts`
- `agents/ideation/handoff-generator.ts`

**Changes:**

- Remove `viability < 50` check in handoff notes
- Remove `confidence.overall >= 50` from handoff message formatting

**Test script:**

```bash
! grep -q 'viability < 50\|confidence.overall' agents/ideation/handoff.ts agents/ideation/handoff-generator.ts && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No confidence/viability gating in handoff logic.
**Expected output:** `PASS`

---

### Task 11: Remove confidence from SpecViewPanel section filtering

**File:** `frontend/src/components/ideation/SpecViewPanel.tsx`

**Changes:**

- Remove `confidenceScore >= 50` / `confidenceScore < 50` section filtering
- Show all sections regardless of confidence score
- Remove confidence-based color coding

**Test script:**

```bash
! grep -q 'confidenceScore' frontend/src/components/ideation/SpecViewPanel.tsx && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No confidenceScore filtering in spec view.
**Expected output:** `PASS`

---

### Task 12: Remove confidence/viability from IdeaArtifactPanel

**File:** `frontend/src/components/ideation/IdeaArtifactPanel.tsx`

**Changes:**

- Remove viability < 50 intervention and warning logic

**Test script:**

```bash
! grep -q 'viability < 50' frontend/src/components/ideation/IdeaArtifactPanel.tsx && \
echo "PASS" || echo "FAIL"
```

**Pass criteria:** No viability checks remain.
**Expected output:** `PASS`

---

### Task 13: Build verification

**Test script:**

```bash
cd /Users/nenadatanasovski/idea_incurator && npm run build 2>&1 | tail -5
```

**Pass criteria:** Build succeeds with no errors. Exit code 0.
**Expected output:** Build output ending with success message, no TypeScript errors.

---

### Task 14: Test suite verification

**Test script:**

```bash
cd /Users/nenadatanasovski/idea_incurator && npm test 2>&1 | tail -20
```

**Pass criteria:** All remaining tests pass. No failures related to missing confidence/viability imports or references.
**Expected output:** Test summary showing all tests passing.

---

## Out of Scope (Do NOT touch)

These use a **different** confidence concept (0.0-1.0 extraction/link confidence) and must be preserved:

- `schema/entities/memory-block.ts` — memory block confidence field
- `frontend/src/types/graph.ts` — GraphNode/GraphEdge confidence
- `frontend/src/components/graph/` — evidence chain confidence coloring
- `server/routes/ideation/graph-routes.ts` — graph node/link confidence
- `agents/ideation/block-extractor.ts` — extraction confidence
- `server/services/task-agent/file-impact-analyzer.ts` — impact confidence
- `server/services/task-agent/task-impact-service.ts` — impact confidence
- `frontend/src/components/tasks/TaskDependencyManager.tsx` — task confidence
- `frontend/src/components/graph/hooks/useGraphFilters.ts` — graph filter confidence
- `database/migrations/018_ideation_agent.sql` — `ideation_signals.confidence` column (extraction confidence)

## DB Note

The `ideation_candidates.confidence` and `ideation_candidates.viability` columns in the DB will become unused. A future migration can drop them, but for now they have `DEFAULT 0` / `DEFAULT 100` so they won't cause issues.
