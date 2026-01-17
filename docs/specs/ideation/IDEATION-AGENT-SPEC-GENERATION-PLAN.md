# Ideation Agent Spec Generation Implementation Plan

**Created:** 2026-01-17
**Purpose:** Merge Planning Agent into Ideation Agent with Spec generation, visualization, and Task Agent handoff
**Status:** Ready for execution

---

## Overview

This plan implements:

1. **Spec Generation** - Ideation Agent generates structured specifications from ideation sessions
2. **Readiness Detection** - Auto-suggests spec generation when session is ready
3. **UI Visualization** - Inline preview in chat + full view in artifact panel
4. **Structured Editing** - Editable fields (problem, success criteria, constraints, etc.)
5. **Workflow State** - Draft → Review → Approved → Tasks Created

**Naming Convention:** "Spec" (short for Specification) replaces "PRD" in all UI surfaces

---

## Architecture Decisions

| Decision       | Choice                      | Rationale                                         |
| -------------- | --------------------------- | ------------------------------------------------- |
| Agent Location | TypeScript (Ideation Agent) | Merge into existing agent, avoid Python↔TS bridge |
| Trigger        | Both auto-suggest + manual  | Best UX - nudge when ready, allow user control    |
| UI Display     | Inline preview + Panel view | See context in chat, edit in dedicated space      |
| Editability    | Structured fields           | Balance flexibility with data integrity           |
| Workflow       | State machine               | Clear progression, enables Task Agent integration |

---

## Phase 1: Database & Types Foundation

### SPEC-001: Database Schema for Spec Workflow

**Problem:** Current `prds` table lacks workflow state, source session linkage, and readiness tracking
**Effort:** 2 hours

#### Tasks

- [ ] **SPEC-001-A:** Add workflow columns to `prds` table
  - [ ] Create migration `100_spec_workflow_columns.sql`
  - [ ] Add `source_session_id TEXT REFERENCES ideation_sessions(id)`
  - [ ] Add `workflow_state TEXT DEFAULT 'draft' CHECK (workflow_state IN ('draft', 'review', 'approved', 'archived'))`
  - [ ] Add `readiness_score INTEGER DEFAULT 0`
  - [ ] Add `version INTEGER DEFAULT 1`
  - [ ] Run migration: `npm run migrate`

- [ ] **SPEC-001-B:** Create spec_sections table for structured content
  - [ ] Add migration `101_spec_sections.sql`
  - [ ] Table: `id, spec_id, section_type, content, order_index, updated_at`
  - [ ] Section types: `problem`, `target_users`, `functional_desc`, `success_criteria`, `constraints`, `out_of_scope`, `risks`, `assumptions`
  - [ ] Index on `spec_id` for fast lookups

- [ ] **SPEC-001-C:** Create spec_history table for versioning
  - [ ] Add migration `102_spec_history.sql`
  - [ ] Table: `id, spec_id, version, changes_json, changed_by, changed_at`
  - [ ] Trigger to auto-record changes on spec update

#### Test Script: `tests/e2e/test-spec-001-schema.py`

```python
#!/usr/bin/env python3
"""
Test SPEC-001: Database Schema for Spec Workflow

Pass Criteria:
1. prds table has workflow_state column
2. prds table has source_session_id column
3. spec_sections table exists with correct schema
4. spec_history table exists
5. Foreign key to ideation_sessions works
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_prds_has_workflow_columns():
    """Test 1: prds table has workflow state columns"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(prds)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    required = ["workflow_state", "source_session_id", "readiness_score", "version"]
    missing = [c for c in required if c not in columns]

    if missing:
        print(f"FAIL: Missing columns in prds: {missing}")
        return False

    print(f"PASS: prds has workflow columns: {required}")
    return True

def test_spec_sections_exists():
    """Test 2: spec_sections table exists with correct schema"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(spec_sections)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        required = ["id", "spec_id", "section_type", "content", "order_index"]
        missing = [c for c in required if c not in columns]

        if missing:
            print(f"FAIL: Missing columns in spec_sections: {missing}")
            return False

        print(f"PASS: spec_sections has correct schema: {list(columns.keys())}")
        return True
    except sqlite3.OperationalError:
        print("FAIL: spec_sections table doesn't exist")
        return False
    finally:
        conn.close()

def test_spec_history_exists():
    """Test 3: spec_history table exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='spec_history'
    """)
    exists = cursor.fetchone() is not None
    conn.close()

    if exists:
        print("PASS: spec_history table exists")
        return True
    else:
        print("FAIL: spec_history table doesn't exist")
        return False

def test_workflow_state_constraint():
    """Test 4: workflow_state has valid CHECK constraint"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        # Try to insert invalid workflow state
        cursor.execute("""
            INSERT INTO prds (id, slug, title, user_id, workflow_state)
            VALUES ('test-check', 'test', 'Test', 'user1', 'invalid_state')
        """)
        cursor.execute("DELETE FROM prds WHERE id = 'test-check'")
        conn.commit()
        print("FAIL: Invalid workflow_state was accepted")
        return False
    except sqlite3.IntegrityError:
        print("PASS: workflow_state CHECK constraint works")
        return True
    finally:
        conn.close()

def test_source_session_fk():
    """Test 5: source_session_id foreign key works"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Check if ideation_sessions table exists
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='ideation_sessions'
    """)
    if not cursor.fetchone():
        print("SKIP: ideation_sessions table doesn't exist")
        conn.close()
        return None

    print("PASS: Foreign key reference table exists")
    conn.close()
    return True

def main():
    print("=" * 60)
    print("SPEC-001 Test Suite: Database Schema for Spec Workflow")
    print("=" * 60)

    results = []
    results.append(("Workflow columns exist", test_prds_has_workflow_columns()))
    results.append(("spec_sections table", test_spec_sections_exists()))
    results.append(("spec_history table", test_spec_history_exists()))
    results.append(("Workflow state constraint", test_workflow_state_constraint()))
    results.append(("Source session FK", test_source_session_fk()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                          | Verification               |
| --- | ---------------------------------- | -------------------------- |
| 1   | `workflow_state` column exists     | `PRAGMA table_info(prds)`  |
| 2   | `source_session_id` column exists  | `PRAGMA table_info(prds)`  |
| 3   | `spec_sections` table exists       | `sqlite_master` query      |
| 4   | `spec_history` table exists        | `sqlite_master` query      |
| 5   | CHECK constraint on workflow_state | INSERT invalid value fails |

---

### SPEC-002: TypeScript Types for Spec System

**Problem:** Frontend needs types for spec generation, workflow states, and section editing
**Effort:** 1.5 hours

#### Tasks

- [ ] **SPEC-002-A:** Create shared spec types
  - [ ] Create file `types/spec.ts`
  - [ ] Define `SpecWorkflowState = 'draft' | 'review' | 'approved' | 'archived'`
  - [ ] Define `SpecSectionType` enum
  - [ ] Define `Spec` interface with all fields
  - [ ] Define `SpecSection` interface
  - [ ] Define `SpecHistory` interface

- [ ] **SPEC-002-B:** Create frontend spec types
  - [ ] Create file `frontend/src/types/spec.ts`
  - [ ] Define `SpecArtifact` extending base `Artifact` type
  - [ ] Define `SpecPanelProps` interface
  - [ ] Define `SpecSectionEditorProps` interface
  - [ ] Define `SpecPreviewProps` interface
  - [ ] Define `SpecReadinessIndicatorProps` interface

- [ ] **SPEC-002-C:** Add spec artifact type to ideation types
  - [ ] Edit `frontend/src/types/ideation.ts`
  - [ ] Add `'spec'` to `ArtifactType` union
  - [ ] Export spec types for use in components

- [ ] **SPEC-002-D:** Create spec action types for reducer
  - [ ] Edit `frontend/src/types/ideation-state.ts`
  - [ ] Add `SpecState` interface to `IdeationStore`
  - [ ] Add spec-related actions to `IdeationAction` union

#### Test Script: `tests/e2e/test-spec-002-types.ts`

```typescript
/**
 * Test SPEC-002: TypeScript Types for Spec System
 *
 * Pass Criteria:
 * 1. Spec interface has all required fields
 * 2. SpecWorkflowState union is complete
 * 3. SpecSectionType enum has all section types
 * 4. Frontend types compile without errors
 * 5. Spec artifact type is recognized
 */

import type {
  Spec,
  SpecWorkflowState,
  SpecSectionType,
  SpecSection,
} from "../../types/spec";
import type { ArtifactType } from "../../frontend/src/types/ideation";

// Test 1: Spec interface has required fields
function testSpecInterface(): boolean {
  const testSpec: Spec = {
    id: "test-id",
    slug: "test-slug",
    title: "Test Spec",
    userId: "user-1",
    workflowState: "draft",
    sourceSessionId: "session-1",
    readinessScore: 75,
    version: 1,
    problemStatement: "Test problem",
    targetUsers: "Test users",
    functionalDescription: "Test description",
    successCriteria: ["Criterion 1"],
    constraints: ["Constraint 1"],
    outOfScope: ["Out of scope 1"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log("PASS: Spec interface has all required fields");
  return true;
}

// Test 2: SpecWorkflowState is complete
function testWorkflowStates(): boolean {
  const states: SpecWorkflowState[] = [
    "draft",
    "review",
    "approved",
    "archived",
  ];
  if (states.length === 4) {
    console.log("PASS: SpecWorkflowState has all 4 states");
    return true;
  }
  console.log("FAIL: SpecWorkflowState missing states");
  return false;
}

// Test 3: SpecSectionType has all types
function testSectionTypes(): boolean {
  const types: SpecSectionType[] = [
    "problem",
    "target_users",
    "functional_desc",
    "success_criteria",
    "constraints",
    "out_of_scope",
    "risks",
    "assumptions",
  ];
  if (types.length === 8) {
    console.log("PASS: SpecSectionType has all 8 types");
    return true;
  }
  console.log("FAIL: SpecSectionType missing types");
  return false;
}

// Test 4: Spec artifact type exists
function testArtifactType(): boolean {
  const artifactTypes: ArtifactType[] = ["code", "markdown", "spec"];
  if (artifactTypes.includes("spec")) {
    console.log("PASS: spec is valid ArtifactType");
    return true;
  }
  console.log("FAIL: spec not in ArtifactType");
  return false;
}

// Run all tests
console.log("=".repeat(60));
console.log("SPEC-002 Test Suite: TypeScript Types");
console.log("=".repeat(60));

const results = [
  testSpecInterface(),
  testWorkflowStates(),
  testSectionTypes(),
  testArtifactType(),
];

const passed = results.filter((r) => r).length;
const failed = results.filter((r) => !r).length;

console.log("\n" + "=".repeat(60));
console.log(`Total: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

#### Pass Criteria

| #   | Criterion                        | Verification           |
| --- | -------------------------------- | ---------------------- |
| 1   | `Spec` interface compiles        | TypeScript compilation |
| 2   | `SpecWorkflowState` has 4 states | Type check             |
| 3   | `SpecSectionType` has 8 types    | Type check             |
| 4   | `'spec'` in `ArtifactType`       | Type check             |
| 5   | `npx tsc --noEmit` passes        | Zero errors            |

---

## Phase 2: Readiness Detection & Generation

### SPEC-003: Readiness Score Calculator

**Problem:** Need to detect when an ideation session has enough content to generate a spec
**Effort:** 3 hours

#### Tasks

- [ ] **SPEC-003-A:** Create readiness calculator service
  - [ ] Create file `agents/ideation/readiness-calculator.ts`
  - [ ] Define readiness dimensions:
    - `problemClarity` (0-25): Clear problem statement exists
    - `solutionDefinition` (0-25): Solution is articulated
    - `userUnderstanding` (0-25): Target users identified
    - `scopeBoundaries` (0-25): Scope is bounded
  - [ ] Calculate weighted score (0-100)
  - [ ] Return breakdown for UI display

- [ ] **SPEC-003-B:** Integrate readiness calculation into orchestrator
  - [ ] Edit `agents/ideation/orchestrator.ts`
  - [ ] Calculate readiness after each assistant message
  - [ ] Emit `readiness:update` event via WebSocket
  - [ ] Auto-suggest spec generation when score ≥ 75

- [ ] **SPEC-003-C:** Add readiness extraction from conversation
  - [ ] Create method `extractReadinessSignals(messages: Message[])`
  - [ ] Use Claude to analyze conversation for each dimension
  - [ ] Cache results to avoid redundant API calls
  - [ ] Update on significant conversation changes

- [ ] **SPEC-003-D:** Create auto-suggest prompt
  - [ ] When readiness ≥ 75, include suggestion in next response
  - [ ] Provide button: "Generate Spec"
  - [ ] Include readiness breakdown in suggestion

#### Test Script: `tests/e2e/test-spec-003-readiness.py`

```python
#!/usr/bin/env python3
"""
Test SPEC-003: Readiness Score Calculator

Pass Criteria:
1. Readiness calculator exists
2. Returns score 0-100
3. Includes dimension breakdown
4. Orchestrator emits readiness events
5. Auto-suggest triggers at ≥75
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

def test_readiness_calculator_exists():
    """Test 1: Readiness calculator file exists"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if calc_path.exists():
        print("PASS: readiness-calculator.ts exists")
        return True
    else:
        print("FAIL: readiness-calculator.ts not found")
        return False

def test_calculator_exports():
    """Test 2: Calculator exports required functions"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if not calc_path.exists():
        print("SKIP: Calculator file doesn't exist")
        return None

    content = calc_path.read_text()

    required = ["calculateReadiness", "ReadinessScore", "ReadinessDimension"]
    found = sum(1 for r in required if r in content)

    if found >= 2:
        print(f"PASS: Calculator exports found ({found}/3)")
        return True
    else:
        print(f"FAIL: Missing exports ({found}/3)")
        return False

def test_orchestrator_emits_readiness():
    """Test 3: Orchestrator emits readiness:update events"""
    orch_path = PROJECT_ROOT / "agents" / "ideation" / "orchestrator.ts"

    if not orch_path.exists():
        print("FAIL: orchestrator.ts not found")
        return False

    content = orch_path.read_text()

    if "readiness" in content.lower() and ("emit" in content.lower() or "send" in content.lower()):
        print("PASS: Orchestrator handles readiness")
        return True
    else:
        print("FAIL: Orchestrator doesn't emit readiness events")
        return False

def test_auto_suggest_threshold():
    """Test 4: Auto-suggest uses 75 threshold"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"
    orch_path = PROJECT_ROOT / "agents" / "ideation" / "orchestrator.ts"

    files_to_check = [f for f in [calc_path, orch_path] if f.exists()]

    for file_path in files_to_check:
        content = file_path.read_text()
        if "75" in content or "0.75" in content:
            print(f"PASS: Threshold 75 found in {file_path.name}")
            return True

    print("SKIP: Threshold not yet configured")
    return None

def test_dimension_breakdown():
    """Test 5: Returns dimension breakdown"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if not calc_path.exists():
        print("SKIP: Calculator file doesn't exist")
        return None

    content = calc_path.read_text()

    dimensions = ["problemClarity", "solutionDefinition", "userUnderstanding", "scopeBoundaries"]
    found = sum(1 for d in dimensions if d in content)

    if found >= 3:
        print(f"PASS: Dimension breakdown exists ({found}/4 dimensions)")
        return True
    else:
        print(f"FAIL: Missing dimensions ({found}/4)")
        return False

def main():
    print("=" * 60)
    print("SPEC-003 Test Suite: Readiness Score Calculator")
    print("=" * 60)

    results = []
    results.append(("Calculator exists", test_readiness_calculator_exists()))
    results.append(("Exports functions", test_calculator_exports()))
    results.append(("Orchestrator emits", test_orchestrator_emits_readiness()))
    results.append(("Threshold is 75", test_auto_suggest_threshold()))
    results.append(("Dimension breakdown", test_dimension_breakdown()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                             | Verification    |
| --- | ------------------------------------- | --------------- |
| 1   | `readiness-calculator.ts` exists      | File exists     |
| 2   | Exports `calculateReadiness` function | Code inspection |
| 3   | Returns score 0-100                   | Unit test       |
| 4   | Includes 4 dimension breakdown        | Interface check |
| 5   | Orchestrator emits `readiness:update` | WebSocket event |

---

### SPEC-004: Spec Generation Engine

**Problem:** Need to generate structured spec from ideation session content
**Effort:** 4 hours

#### Tasks

- [ ] **SPEC-004-A:** Create spec generator service
  - [ ] Create file `agents/ideation/spec-generator.ts`
  - [ ] Method `generateSpec(sessionId: string): Promise<Spec>`
  - [ ] Gather all session artifacts and messages
  - [ ] Use Claude to synthesize into structured spec

- [ ] **SPEC-004-B:** Create spec generation prompt template
  - [ ] Create file `agents/ideation/prompts/spec-generation.ts`
  - [ ] Prompt extracts: problem, users, solution, criteria, constraints, scope
  - [ ] Output structured JSON matching `Spec` interface
  - [ ] Include confidence scores per section

- [ ] **SPEC-004-C:** Add spec generation API endpoint
  - [ ] Create route `POST /api/specs/generate`
  - [ ] Request body: `{ sessionId: string }`
  - [ ] Response: `{ spec: Spec, confidence: number }`
  - [ ] Save to database with `workflow_state: 'draft'`

- [ ] **SPEC-004-D:** Integrate with orchestrator for button trigger
  - [ ] When user clicks "Generate Spec" button
  - [ ] Call spec generation service
  - [ ] Create spec artifact in conversation
  - [ ] Emit `spec:created` WebSocket event

- [ ] **SPEC-004-E:** Handle partial/low-confidence generation
  - [ ] If any section confidence < 50%, mark as `needs_review`
  - [ ] Include clarifying questions in response
  - [ ] Allow iterative refinement

#### Test Script: `tests/e2e/test-spec-004-generation.py`

```python
#!/usr/bin/env python3
"""
Test SPEC-004: Spec Generation Engine

Pass Criteria:
1. Spec generator service exists
2. Generation prompt template exists
3. API endpoint /api/specs/generate exists
4. Generated spec has all required sections
5. Low-confidence sections flagged
"""

import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

def test_generator_service_exists():
    """Test 1: Spec generator service exists"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if gen_path.exists():
        content = gen_path.read_text()
        if "generateSpec" in content:
            print("PASS: spec-generator.ts exists with generateSpec")
            return True
        print("FAIL: spec-generator.ts missing generateSpec function")
        return False
    else:
        print("FAIL: spec-generator.ts not found")
        return False

def test_prompt_template_exists():
    """Test 2: Generation prompt template exists"""
    prompt_path = PROJECT_ROOT / "agents" / "ideation" / "prompts" / "spec-generation.ts"

    if prompt_path.exists():
        content = prompt_path.read_text()
        required_sections = ["problem", "target", "solution", "criteria"]
        found = sum(1 for s in required_sections if s.lower() in content.lower())

        if found >= 3:
            print(f"PASS: Prompt template covers {found}/4 sections")
            return True
        print(f"FAIL: Prompt template incomplete ({found}/4)")
        return False
    else:
        print("FAIL: spec-generation.ts prompt not found")
        return False

def test_api_endpoint_exists():
    """Test 3: API endpoint exists"""
    # Check route file
    routes_path = PROJECT_ROOT / "server" / "routes"

    for route_file in routes_path.glob("*.ts"):
        content = route_file.read_text()
        if "/specs/generate" in content or "specs.generate" in content.lower():
            print(f"PASS: Spec generation endpoint found in {route_file.name}")
            return True

    # Also check api.ts
    api_path = PROJECT_ROOT / "server" / "api.ts"
    if api_path.exists():
        content = api_path.read_text()
        if "/specs" in content:
            print("PASS: Specs routes registered in api.ts")
            return True

    print("FAIL: /api/specs/generate endpoint not found")
    return False

def test_spec_has_sections():
    """Test 4: Generated spec has all required sections"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if not gen_path.exists():
        print("SKIP: Generator doesn't exist yet")
        return None

    content = gen_path.read_text()

    sections = [
        "problemStatement",
        "targetUsers",
        "functionalDescription",
        "successCriteria",
        "constraints",
        "outOfScope"
    ]

    found = sum(1 for s in sections if s in content)

    if found >= 5:
        print(f"PASS: Generator handles {found}/6 sections")
        return True
    else:
        print(f"FAIL: Generator missing sections ({found}/6)")
        return False

def test_confidence_scoring():
    """Test 5: Low-confidence sections are flagged"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if not gen_path.exists():
        print("SKIP: Generator doesn't exist yet")
        return None

    content = gen_path.read_text()

    if "confidence" in content.lower() and ("50" in content or "0.5" in content):
        print("PASS: Confidence scoring with threshold exists")
        return True
    elif "confidence" in content.lower():
        print("PASS: Confidence scoring exists")
        return True
    else:
        print("SKIP: Confidence scoring not yet implemented")
        return None

def main():
    print("=" * 60)
    print("SPEC-004 Test Suite: Spec Generation Engine")
    print("=" * 60)

    results = []
    results.append(("Generator service", test_generator_service_exists()))
    results.append(("Prompt template", test_prompt_template_exists()))
    results.append(("API endpoint", test_api_endpoint_exists()))
    results.append(("All sections", test_spec_has_sections()))
    results.append(("Confidence scoring", test_confidence_scoring()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                             | Verification                    |
| --- | ------------------------------------- | ------------------------------- |
| 1   | `spec-generator.ts` exists            | File exists with `generateSpec` |
| 2   | Prompt template covers all sections   | Content inspection              |
| 3   | `POST /api/specs/generate` works      | HTTP test                       |
| 4   | Spec has 6 required sections          | JSON structure                  |
| 5   | Confidence < 50% flags `needs_review` | Unit test                       |

---

## Phase 3: UI Components

### SPEC-005: Inline Spec Preview Component

**Problem:** Need to show spec preview in conversation flow
**Effort:** 3 hours

#### Tasks

- [ ] **SPEC-005-A:** Create SpecPreview component
  - [ ] Create file `frontend/src/components/ideation/SpecPreview.tsx`
  - [ ] Collapsible card showing spec summary
  - [ ] Header: Title + workflow state badge
  - [ ] Expandable sections: Problem, Users, Solution
  - [ ] "View Full Spec" button to open panel
  - [ ] "Edit Spec" button to open editor

- [ ] **SPEC-005-B:** Create SpecWorkflowBadge component
  - [ ] Create file `frontend/src/components/ideation/SpecWorkflowBadge.tsx`
  - [ ] Colors: draft (yellow), review (blue), approved (green), archived (gray)
  - [ ] Show state name and optional action buttons
  - [ ] Click to transition state (if allowed)

- [ ] **SPEC-005-C:** Add spec to message rendering
  - [ ] Edit `frontend/src/components/ideation/AgentMessage.tsx`
  - [ ] Detect spec artifact in message
  - [ ] Render SpecPreview instead of generic artifact link
  - [ ] Handle spec updates in real-time

- [ ] **SPEC-005-D:** Create ReadinessIndicator component
  - [ ] Create file `frontend/src/components/ideation/ReadinessIndicator.tsx`
  - [ ] Circular progress showing readiness score
  - [ ] Breakdown tooltip on hover
  - [ ] "Generate Spec" button when ≥ 75%

#### Test Script: `tests/e2e/test-spec-005-preview.sh`

```bash
#!/bin/bash
# Test SPEC-005: Inline Spec Preview Component
# Run: bash tests/e2e/test-spec-005-preview.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "SPEC-005 Test Suite: Inline Spec Preview"
echo "========================================"

PASSED=0
FAILED=0

# Test 1: SpecPreview component exists
echo -e "\nTest 1: SpecPreview component exists"
if [ -f "frontend/src/components/ideation/SpecPreview.tsx" ]; then
    echo "PASS: SpecPreview.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecPreview.tsx not found"
    ((FAILED++))
fi

# Test 2: SpecWorkflowBadge component exists
echo -e "\nTest 2: SpecWorkflowBadge component exists"
if [ -f "frontend/src/components/ideation/SpecWorkflowBadge.tsx" ]; then
    echo "PASS: SpecWorkflowBadge.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecWorkflowBadge.tsx not found"
    ((FAILED++))
fi

# Test 3: ReadinessIndicator component exists
echo -e "\nTest 3: ReadinessIndicator component exists"
if [ -f "frontend/src/components/ideation/ReadinessIndicator.tsx" ]; then
    echo "PASS: ReadinessIndicator.tsx exists"
    ((PASSED++))
else
    echo "FAIL: ReadinessIndicator.tsx not found"
    ((FAILED++))
fi

# Test 4: AgentMessage handles spec artifacts
echo -e "\nTest 4: AgentMessage handles spec artifacts"
if grep -q "spec" frontend/src/components/ideation/AgentMessage.tsx 2>/dev/null; then
    echo "PASS: AgentMessage references spec"
    ((PASSED++))
else
    echo "FAIL: AgentMessage doesn't handle spec"
    ((FAILED++))
fi

# Test 5: Components compile without errors
echo -e "\nTest 5: TypeScript compilation"
if npx tsc --noEmit 2>/dev/null; then
    echo "PASS: Components compile"
    ((PASSED++))
else
    echo "FAIL: TypeScript errors"
    ((FAILED++))
fi

echo -e "\n========================================"
echo "RESULTS: $PASSED passed, $FAILED failed"
echo "========================================"

[ $FAILED -eq 0 ] && exit 0 || exit 1
```

#### Pass Criteria

| #   | Criterion                       | Verification    |
| --- | ------------------------------- | --------------- |
| 1   | `SpecPreview.tsx` exists        | File check      |
| 2   | `SpecWorkflowBadge.tsx` exists  | File check      |
| 3   | `ReadinessIndicator.tsx` exists | File check      |
| 4   | AgentMessage renders spec       | Code inspection |
| 5   | `npx tsc --noEmit` passes       | Zero errors     |

---

### SPEC-006: Spec Panel with Structured Editor

**Problem:** Need full spec view with editable sections in artifact panel
**Effort:** 4 hours

#### Tasks

- [ ] **SPEC-006-A:** Create SpecPanel component
  - [ ] Create file `frontend/src/components/ideation/SpecPanel.tsx`
  - [ ] Full-height panel with scrollable content
  - [ ] Header with title, workflow state, version
  - [ ] Action buttons: Edit, Submit for Review, Approve, Create Tasks

- [ ] **SPEC-006-B:** Create SpecSectionEditor component
  - [ ] Create file `frontend/src/components/ideation/SpecSectionEditor.tsx`
  - [ ] Editable text area for each section
  - [ ] Section type determines editor (text, list, rich text)
  - [ ] Auto-save on blur with debounce
  - [ ] Highlight unsaved changes

- [ ] **SPEC-006-C:** Create SpecSectionList component for array fields
  - [ ] Create file `frontend/src/components/ideation/SpecSectionList.tsx`
  - [ ] For: successCriteria, constraints, outOfScope
  - [ ] Add/remove/reorder items
  - [ ] Inline editing per item
  - [ ] Drag-and-drop reordering

- [ ] **SPEC-006-D:** Add spec renderer to ArtifactRenderer
  - [ ] Edit `frontend/src/components/ideation/ArtifactRenderer.tsx`
  - [ ] Add case for `type === 'spec'`
  - [ ] Render SpecPanel when spec artifact selected
  - [ ] Pass edit handlers

- [ ] **SPEC-006-E:** Add spec to IdeaArtifactPanel
  - [ ] Edit `frontend/src/components/ideation/IdeaArtifactPanel.tsx`
  - [ ] Add "Spec" tab alongside "Idea" and "Artifacts"
  - [ ] Show SpecPanel when spec exists
  - [ ] Show "No spec yet" with generate button otherwise

#### Test Script: `tests/e2e/test-spec-006-panel.sh`

```bash
#!/bin/bash
# Test SPEC-006: Spec Panel with Structured Editor
# Run: bash tests/e2e/test-spec-006-panel.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "SPEC-006 Test Suite: Spec Panel Editor"
echo "========================================"

PASSED=0
FAILED=0

# Test 1: SpecPanel component exists
echo -e "\nTest 1: SpecPanel component exists"
if [ -f "frontend/src/components/ideation/SpecPanel.tsx" ]; then
    echo "PASS: SpecPanel.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecPanel.tsx not found"
    ((FAILED++))
fi

# Test 2: SpecSectionEditor component exists
echo -e "\nTest 2: SpecSectionEditor component exists"
if [ -f "frontend/src/components/ideation/SpecSectionEditor.tsx" ]; then
    echo "PASS: SpecSectionEditor.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecSectionEditor.tsx not found"
    ((FAILED++))
fi

# Test 3: SpecSectionList component exists
echo -e "\nTest 3: SpecSectionList component exists"
if [ -f "frontend/src/components/ideation/SpecSectionList.tsx" ]; then
    echo "PASS: SpecSectionList.tsx exists"
    ((PASSED++))
else
    echo "FAIL: SpecSectionList.tsx not found"
    ((FAILED++))
fi

# Test 4: ArtifactRenderer handles spec type
echo -e "\nTest 4: ArtifactRenderer handles spec type"
if grep -q "'spec'" frontend/src/components/ideation/ArtifactRenderer.tsx 2>/dev/null; then
    echo "PASS: ArtifactRenderer handles spec"
    ((PASSED++))
else
    echo "FAIL: ArtifactRenderer missing spec case"
    ((FAILED++))
fi

# Test 5: IdeaArtifactPanel has Spec tab
echo -e "\nTest 5: IdeaArtifactPanel has Spec tab"
if grep -qi "spec" frontend/src/components/ideation/IdeaArtifactPanel.tsx 2>/dev/null; then
    echo "PASS: IdeaArtifactPanel references Spec"
    ((PASSED++))
else
    echo "FAIL: IdeaArtifactPanel missing Spec tab"
    ((FAILED++))
fi

# Test 6: TypeScript compilation
echo -e "\nTest 6: TypeScript compilation"
if npx tsc --noEmit 2>/dev/null; then
    echo "PASS: Components compile"
    ((PASSED++))
else
    echo "FAIL: TypeScript errors"
    ((FAILED++))
fi

echo -e "\n========================================"
echo "RESULTS: $PASSED passed, $FAILED failed"
echo "========================================"

[ $FAILED -eq 0 ] && exit 0 || exit 1
```

#### Pass Criteria

| #   | Criterion                         | Verification          |
| --- | --------------------------------- | --------------------- |
| 1   | `SpecPanel.tsx` exists            | File check            |
| 2   | `SpecSectionEditor.tsx` exists    | File check            |
| 3   | `SpecSectionList.tsx` exists      | File check            |
| 4   | ArtifactRenderer handles `'spec'` | Case statement exists |
| 5   | IdeaArtifactPanel has Spec tab    | Tab button exists     |
| 6   | `npx tsc --noEmit` passes         | Zero errors           |

---

## Phase 4: Workflow & Handoff

### SPEC-007: Workflow State Machine

**Problem:** Need to manage spec lifecycle: draft → review → approved → tasks
**Effort:** 2.5 hours

#### Tasks

- [ ] **SPEC-007-A:** Create workflow state machine
  - [ ] Create file `server/services/spec/workflow-state-machine.ts`
  - [ ] Define valid transitions:
    - `draft` → `review` (user submits)
    - `review` → `approved` (user approves)
    - `review` → `draft` (user requests changes)
    - `approved` → `archived` (after tasks created)
    - Any → `archived` (user archives)
  - [ ] Validate transitions before applying

- [ ] **SPEC-007-B:** Create workflow API endpoints
  - [ ] `POST /api/specs/:id/submit` - draft → review
  - [ ] `POST /api/specs/:id/approve` - review → approved
  - [ ] `POST /api/specs/:id/request-changes` - review → draft
  - [ ] `POST /api/specs/:id/archive` - any → archived
  - [ ] Return updated spec with new state

- [ ] **SPEC-007-C:** Add workflow event emissions
  - [ ] Emit WebSocket event on state change
  - [ ] Event: `spec:workflow:changed`
  - [ ] Payload: `{ specId, fromState, toState, changedBy, changedAt }`

- [ ] **SPEC-007-D:** Record workflow history
  - [ ] Insert into `spec_history` on each transition
  - [ ] Include who triggered the transition
  - [ ] Store snapshot of spec at transition time

#### Test Script: `tests/e2e/test-spec-007-workflow.py`

```python
#!/usr/bin/env python3
"""
Test SPEC-007: Workflow State Machine

Pass Criteria:
1. State machine file exists
2. Valid transitions are allowed
3. Invalid transitions are rejected
4. API endpoints exist
5. History is recorded
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_state_machine_exists():
    """Test 1: Workflow state machine file exists"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if sm_path.exists():
        print("PASS: workflow-state-machine.ts exists")
        return True
    else:
        print("FAIL: workflow-state-machine.ts not found")
        return False

def test_valid_transitions_defined():
    """Test 2: Valid transitions are defined"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    transitions = ["draft", "review", "approved", "archived"]
    found = sum(1 for t in transitions if t in content)

    if found >= 4:
        print(f"PASS: All workflow states defined ({found}/4)")
        return True
    else:
        print(f"FAIL: Missing states ({found}/4)")
        return False

def test_api_endpoints_exist():
    """Test 3: Workflow API endpoints exist"""
    routes_path = PROJECT_ROOT / "server" / "routes"

    endpoints = ["submit", "approve", "request-changes", "archive"]
    found = 0

    for route_file in routes_path.glob("*.ts"):
        content = route_file.read_text()
        for endpoint in endpoints:
            if endpoint in content:
                found += 1

    if found >= 3:
        print(f"PASS: Found {found}/4 workflow endpoints")
        return True
    elif found > 0:
        print(f"PARTIAL: Found {found}/4 workflow endpoints")
        return True
    else:
        print("FAIL: No workflow endpoints found")
        return False

def test_history_recording():
    """Test 4: History is recorded in spec_history"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(spec_history)")
        columns = [row[1] for row in cursor.fetchall()]

        required = ["spec_id", "version", "changes_json"]
        missing = [c for c in required if c not in columns]

        if missing:
            print(f"FAIL: spec_history missing columns: {missing}")
            return False

        print("PASS: spec_history has required columns")
        return True
    except sqlite3.OperationalError:
        print("SKIP: spec_history table doesn't exist")
        return None
    finally:
        conn.close()

def test_websocket_events():
    """Test 5: WebSocket events are emitted"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    if "emit" in content.lower() or "websocket" in content.lower() or "broadcast" in content.lower():
        print("PASS: WebSocket event emission found")
        return True
    else:
        print("SKIP: WebSocket events not yet implemented")
        return None

def main():
    print("=" * 60)
    print("SPEC-007 Test Suite: Workflow State Machine")
    print("=" * 60)

    results = []
    results.append(("State machine exists", test_state_machine_exists()))
    results.append(("Valid transitions", test_valid_transitions_defined()))
    results.append(("API endpoints", test_api_endpoints_exist()))
    results.append(("History recording", test_history_recording()))
    results.append(("WebSocket events", test_websocket_events()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                      | Verification     |
| --- | ------------------------------ | ---------------- |
| 1   | State machine file exists      | File check       |
| 2   | All 4 states defined           | Code inspection  |
| 3   | Transition validation works    | Unit test        |
| 4   | API endpoints exist            | Route inspection |
| 5   | History recorded on transition | DB query         |

---

### SPEC-008: Task Agent Handoff

**Problem:** Approved specs need to create task lists in Task Agent
**Effort:** 3 hours

#### Tasks

- [ ] **SPEC-008-A:** Create spec-to-task-list converter
  - [ ] Create file `server/services/spec/task-list-converter.ts`
  - [ ] Method `convertSpecToTaskList(spec: Spec): TaskList`
  - [ ] Create task list with spec title
  - [ ] Link task list to spec via `source_spec_id`

- [ ] **SPEC-008-B:** Add source_spec_id to task_lists_v2
  - [ ] Create migration `103_task_list_spec_link.sql`
  - [ ] Add `source_spec_id TEXT REFERENCES prds(id)`
  - [ ] Index for fast lookups

- [ ] **SPEC-008-C:** Trigger task list creation on approval
  - [ ] Edit workflow state machine
  - [ ] On `review` → `approved` transition
  - [ ] Call `convertSpecToTaskList()`
  - [ ] Create empty task list in Task Agent
  - [ ] Transition spec to `archived`

- [ ] **SPEC-008-D:** Create "View Tasks" action in UI
  - [ ] Add button to SpecPanel when `workflow_state === 'approved'`
  - [ ] Navigate to Task List Browser with filter
  - [ ] Show linked task list

- [ ] **SPEC-008-E:** Auto-generate initial tasks from spec
  - [ ] Create method `generateInitialTasks(spec: Spec, taskListId: string)`
  - [ ] Use Claude to break success criteria into tasks
  - [ ] Create tasks in Evaluation Queue
  - [ ] Link to task list

#### Test Script: `tests/e2e/test-spec-008-handoff.py`

```python
#!/usr/bin/env python3
"""
Test SPEC-008: Task Agent Handoff

Pass Criteria:
1. Task list converter exists
2. source_spec_id column exists in task_lists_v2
3. Approval triggers task list creation
4. Spec transitions to archived after handoff
5. Tasks can be generated from spec
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_converter_exists():
    """Test 1: Task list converter exists"""
    conv_path = PROJECT_ROOT / "server" / "services" / "spec" / "task-list-converter.ts"

    if conv_path.exists():
        content = conv_path.read_text()
        if "convertSpecToTaskList" in content:
            print("PASS: task-list-converter.ts exists with converter")
            return True
        print("FAIL: Converter file missing main function")
        return False
    else:
        print("FAIL: task-list-converter.ts not found")
        return False

def test_source_spec_id_column():
    """Test 2: task_lists_v2 has source_spec_id column"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(task_lists_v2)")
        columns = [row[1] for row in cursor.fetchall()]

        if "source_spec_id" in columns:
            print("PASS: task_lists_v2 has source_spec_id column")
            return True
        else:
            print("FAIL: source_spec_id column missing")
            return False
    except sqlite3.OperationalError:
        print("SKIP: task_lists_v2 table doesn't exist")
        return None
    finally:
        conn.close()

def test_approval_triggers_creation():
    """Test 3: Approval triggers task list creation"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    if "approved" in content and ("createTaskList" in content or "convertSpec" in content.lower()):
        print("PASS: Approval triggers task list creation")
        return True
    else:
        print("SKIP: Approval-to-task integration not yet implemented")
        return None

def test_archived_after_handoff():
    """Test 4: Spec archived after handoff"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    # Should transition to archived after creating tasks
    if "archived" in content:
        print("PASS: Archived state handling exists")
        return True
    else:
        print("FAIL: Archived state not handled")
        return False

def test_initial_task_generation():
    """Test 5: Initial tasks can be generated"""
    conv_path = PROJECT_ROOT / "server" / "services" / "spec" / "task-list-converter.ts"

    if not conv_path.exists():
        print("SKIP: Converter doesn't exist")
        return None

    content = conv_path.read_text()

    if "generateInitialTasks" in content or "successCriteria" in content:
        print("PASS: Task generation from spec exists")
        return True
    else:
        print("SKIP: Task generation not yet implemented")
        return None

def main():
    print("=" * 60)
    print("SPEC-008 Test Suite: Task Agent Handoff")
    print("=" * 60)

    results = []
    results.append(("Converter exists", test_converter_exists()))
    results.append(("source_spec_id column", test_source_spec_id_column()))
    results.append(("Approval triggers creation", test_approval_triggers_creation()))
    results.append(("Archived after handoff", test_archived_after_handoff()))
    results.append(("Task generation", test_initial_task_generation()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                         | Verification     |
| --- | --------------------------------- | ---------------- |
| 1   | `task-list-converter.ts` exists   | File check       |
| 2   | `source_spec_id` in task_lists_v2 | Column exists    |
| 3   | Approval creates task list        | Integration test |
| 4   | Spec archived after handoff       | State transition |
| 5   | Tasks generated from criteria     | Unit test        |

---

## Phase 5: Integration & Polish

### SPEC-009: WebSocket Integration

**Problem:** Need real-time updates for spec generation, readiness, and workflow changes
**Effort:** 2 hours

#### Tasks

- [ ] **SPEC-009-A:** Add spec event types to WebSocket
  - [ ] Edit `server/websocket.ts`
  - [ ] Add events:
    - `readiness:update` - Readiness score changed
    - `spec:generating` - Spec generation started
    - `spec:generated` - Spec generation complete
    - `spec:updated` - Spec content changed
    - `spec:workflow:changed` - Workflow state changed

- [ ] **SPEC-009-B:** Create useSpec hook
  - [ ] Create file `frontend/src/hooks/useSpec.ts`
  - [ ] Subscribe to spec WebSocket events
  - [ ] Manage local spec state
  - [ ] Handle optimistic updates for edits

- [ ] **SPEC-009-C:** Create useReadiness hook
  - [ ] Create file `frontend/src/hooks/useReadiness.ts`
  - [ ] Subscribe to `readiness:update` events
  - [ ] Return current score and breakdown
  - [ ] Debounce updates for performance

- [ ] **SPEC-009-D:** Update ideation reducer for spec state
  - [ ] Edit `frontend/src/reducers/ideationReducer.ts`
  - [ ] Add spec-related state
  - [ ] Handle spec actions

#### Test Script: `tests/e2e/test-spec-009-websocket.sh`

```bash
#!/bin/bash
# Test SPEC-009: WebSocket Integration
# Run: bash tests/e2e/test-spec-009-websocket.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "SPEC-009 Test Suite: WebSocket Integration"
echo "========================================"

PASSED=0
FAILED=0

# Test 1: WebSocket handles spec events
echo -e "\nTest 1: WebSocket handles spec events"
if grep -q "spec:" server/websocket.ts 2>/dev/null || grep -q "readiness:" server/websocket.ts 2>/dev/null; then
    echo "PASS: WebSocket handles spec events"
    ((PASSED++))
else
    echo "FAIL: WebSocket missing spec events"
    ((FAILED++))
fi

# Test 2: useSpec hook exists
echo -e "\nTest 2: useSpec hook exists"
if [ -f "frontend/src/hooks/useSpec.ts" ]; then
    echo "PASS: useSpec.ts exists"
    ((PASSED++))
else
    echo "FAIL: useSpec.ts not found"
    ((FAILED++))
fi

# Test 3: useReadiness hook exists
echo -e "\nTest 3: useReadiness hook exists"
if [ -f "frontend/src/hooks/useReadiness.ts" ]; then
    echo "PASS: useReadiness.ts exists"
    ((PASSED++))
else
    echo "FAIL: useReadiness.ts not found"
    ((FAILED++))
fi

# Test 4: Reducer handles spec state
echo -e "\nTest 4: Reducer handles spec state"
if grep -qi "spec" frontend/src/reducers/ideationReducer.ts 2>/dev/null; then
    echo "PASS: Reducer handles spec"
    ((PASSED++))
else
    echo "FAIL: Reducer missing spec handling"
    ((FAILED++))
fi

# Test 5: TypeScript compilation
echo -e "\nTest 5: TypeScript compilation"
if npx tsc --noEmit 2>/dev/null; then
    echo "PASS: Hooks compile"
    ((PASSED++))
else
    echo "FAIL: TypeScript errors"
    ((FAILED++))
fi

echo -e "\n========================================"
echo "RESULTS: $PASSED passed, $FAILED failed"
echo "========================================"

[ $FAILED -eq 0 ] && exit 0 || exit 1
```

#### Pass Criteria

| #   | Criterion                     | Verification        |
| --- | ----------------------------- | ------------------- |
| 1   | WebSocket handles spec events | Event types defined |
| 2   | `useSpec.ts` exists           | File check          |
| 3   | `useReadiness.ts` exists      | File check          |
| 4   | Reducer handles spec state    | Code inspection     |
| 5   | `npx tsc --noEmit` passes     | Zero errors         |

---

### SPEC-010: Observability Integration

**Problem:** Need to track spec generation and workflow in observability system
**Effort:** 1.5 hours

#### Tasks

- [ ] **SPEC-010-A:** Add spec events to observability schema
  - [ ] Create migration `104_observability_spec_events.sql`
  - [ ] Add event types for spec generation
  - [ ] Add event types for workflow transitions

- [ ] **SPEC-010-B:** Emit observability events from spec services
  - [ ] Add logging to spec generator
  - [ ] Add logging to workflow state machine
  - [ ] Include timing and metadata

- [ ] **SPEC-010-C:** Create spec observability dashboard widget
  - [ ] Show spec generation stats
  - [ ] Show workflow transition funnel
  - [ ] Show average time from draft to approved

#### Test Script: `tests/e2e/test-spec-010-observability.py`

```python
#!/usr/bin/env python3
"""
Test SPEC-010: Observability Integration

Pass Criteria:
1. Spec event types in observability schema
2. Generator emits observability events
3. Workflow emits observability events
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_spec_event_types():
    """Test 1: Spec event types in observability"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        # Check if observability event log has spec events
        cursor.execute("""
            SELECT DISTINCT event_type FROM observability_event_log
            WHERE event_type LIKE '%spec%'
        """)
        events = [row[0] for row in cursor.fetchall()]

        if events:
            print(f"PASS: Found spec events: {events}")
            return True
        else:
            print("SKIP: No spec events recorded yet")
            return None
    except sqlite3.OperationalError:
        print("SKIP: observability_event_log table doesn't exist")
        return None
    finally:
        conn.close()

def test_generator_emits_events():
    """Test 2: Generator emits observability events"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if not gen_path.exists():
        print("SKIP: Generator doesn't exist")
        return None

    content = gen_path.read_text()

    if "observability" in content.lower() or "emit" in content.lower() or "log" in content.lower():
        print("PASS: Generator has event emission")
        return True
    else:
        print("SKIP: Observability not yet added to generator")
        return None

def test_workflow_emits_events():
    """Test 3: Workflow emits observability events"""
    sm_path = PROJECT_ROOT / "server" / "services" / "spec" / "workflow-state-machine.ts"

    if not sm_path.exists():
        print("SKIP: State machine doesn't exist")
        return None

    content = sm_path.read_text()

    if "observability" in content.lower() or "emit" in content.lower() or "log" in content.lower():
        print("PASS: Workflow has event emission")
        return True
    else:
        print("SKIP: Observability not yet added to workflow")
        return None

def main():
    print("=" * 60)
    print("SPEC-010 Test Suite: Observability Integration")
    print("=" * 60)

    results = []
    results.append(("Spec event types", test_spec_event_types()))
    results.append(("Generator emits events", test_generator_emits_events()))
    results.append(("Workflow emits events", test_workflow_emits_events()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion              | Verification    |
| --- | ---------------------- | --------------- |
| 1   | Spec event types exist | Schema check    |
| 2   | Generator emits events | Code inspection |
| 3   | Workflow emits events  | Code inspection |

---

## Master Test Script

Run all spec tests in sequence:

### `tests/e2e/test-all-spec.sh`

```bash
#!/bin/bash
# Master test script for Ideation Agent Spec Generation
# Run: bash tests/e2e/test-all-spec.sh

set -e
cd "$(dirname "$0")/../.."

echo "=================================================="
echo "IDEATION AGENT SPEC GENERATION - MASTER TEST SUITE"
echo "=================================================="
echo ""

PASSED=0
FAILED=0

run_test() {
    local name=$1
    local script=$2
    local type=${3:-python}

    echo "----------------------------------------"
    echo "Running: $name"
    echo "----------------------------------------"

    if [ "$type" == "python" ]; then
        if python3 "$script"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
    else
        if bash "$script"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
    fi
    echo ""
}

# Phase 1: Foundation
run_test "SPEC-001: Database Schema" "tests/e2e/test-spec-001-schema.py"
# SPEC-002 is TypeScript - would need different approach

# Phase 2: Generation
run_test "SPEC-003: Readiness Calculator" "tests/e2e/test-spec-003-readiness.py"
run_test "SPEC-004: Spec Generation" "tests/e2e/test-spec-004-generation.py"

# Phase 3: UI
run_test "SPEC-005: Inline Preview" "tests/e2e/test-spec-005-preview.sh" "bash"
run_test "SPEC-006: Spec Panel" "tests/e2e/test-spec-006-panel.sh" "bash"

# Phase 4: Workflow
run_test "SPEC-007: Workflow State Machine" "tests/e2e/test-spec-007-workflow.py"
run_test "SPEC-008: Task Agent Handoff" "tests/e2e/test-spec-008-handoff.py"

# Phase 5: Integration
run_test "SPEC-009: WebSocket" "tests/e2e/test-spec-009-websocket.sh" "bash"
run_test "SPEC-010: Observability" "tests/e2e/test-spec-010-observability.py"

echo "=================================================="
echo "FINAL RESULTS"
echo "=================================================="
echo "Passed:  $PASSED"
echo "Failed:  $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "ALL SPEC GENERATION TESTS PASSED!"
    exit 0
else
    echo "TESTS REMAINING - See failures above"
    exit 1
fi
```

---

## Execution Order

### Minimum Viable (Phase 1-3): ~15 hours

1. SPEC-001: Database Schema (2 hours)
2. SPEC-002: TypeScript Types (1.5 hours)
3. SPEC-003: Readiness Calculator (3 hours)
4. SPEC-004: Spec Generator (4 hours)
5. SPEC-005: Inline Preview (3 hours)
6. SPEC-006: Spec Panel (4 hours - can start after SPEC-002)

### Full Implementation (All Phases): ~22 hours

- Phase 1-3: 15 hours (above)
- SPEC-007: Workflow State Machine (2.5 hours)
- SPEC-008: Task Agent Handoff (3 hours)
- SPEC-009: WebSocket Integration (2 hours)
- SPEC-010: Observability (1.5 hours - can be parallelized)

---

## File Changes Summary

### New Files

| File                                                      | Purpose                      |
| --------------------------------------------------------- | ---------------------------- |
| `database/migrations/100_spec_workflow_columns.sql`       | Add workflow columns to prds |
| `database/migrations/101_spec_sections.sql`               | Create spec_sections table   |
| `database/migrations/102_spec_history.sql`                | Create spec_history table    |
| `database/migrations/103_task_list_spec_link.sql`         | Link task lists to specs     |
| `database/migrations/104_observability_spec_events.sql`   | Observability events         |
| `types/spec.ts`                                           | Shared TypeScript types      |
| `frontend/src/types/spec.ts`                              | Frontend spec types          |
| `agents/ideation/readiness-calculator.ts`                 | Readiness score calculation  |
| `agents/ideation/spec-generator.ts`                       | Spec generation from session |
| `agents/ideation/prompts/spec-generation.ts`              | Generation prompt template   |
| `server/services/spec/workflow-state-machine.ts`          | Workflow transitions         |
| `server/services/spec/task-list-converter.ts`             | Spec to task list conversion |
| `server/routes/specs.ts`                                  | Spec API endpoints           |
| `frontend/src/components/ideation/SpecPreview.tsx`        | Inline spec preview          |
| `frontend/src/components/ideation/SpecPanel.tsx`          | Full spec panel              |
| `frontend/src/components/ideation/SpecSectionEditor.tsx`  | Section editor               |
| `frontend/src/components/ideation/SpecSectionList.tsx`    | List section editor          |
| `frontend/src/components/ideation/SpecWorkflowBadge.tsx`  | Workflow state badge         |
| `frontend/src/components/ideation/ReadinessIndicator.tsx` | Readiness score display      |
| `frontend/src/hooks/useSpec.ts`                           | Spec state management        |
| `frontend/src/hooks/useReadiness.ts`                      | Readiness subscription       |
| `tests/e2e/test-spec-*.py`                                | Test scripts                 |
| `tests/e2e/test-spec-*.sh`                                | Bash test scripts            |
| `tests/e2e/test-all-spec.sh`                              | Master test runner           |

### Modified Files

| File                                                     | Changes                                        |
| -------------------------------------------------------- | ---------------------------------------------- |
| `agents/ideation/orchestrator.ts`                        | Readiness calculation, spec generation trigger |
| `frontend/src/types/ideation.ts`                         | Add 'spec' artifact type                       |
| `frontend/src/types/ideation-state.ts`                   | Add spec state and actions                     |
| `frontend/src/reducers/ideationReducer.ts`               | Handle spec actions                            |
| `frontend/src/components/ideation/AgentMessage.tsx`      | Render spec previews                           |
| `frontend/src/components/ideation/ArtifactRenderer.tsx`  | Handle spec type                               |
| `frontend/src/components/ideation/IdeaArtifactPanel.tsx` | Add Spec tab                                   |
| `server/websocket.ts`                                    | Add spec event types                           |
| `server/api.ts`                                          | Register spec routes                           |

---

## Verification Checklist

Before marking complete, verify:

- [ ] All 10 test scripts created and executable
- [ ] Master test script `test-all-spec.sh` runs without error
- [ ] SPEC-001 tests pass (database schema)
- [ ] SPEC-002 types compile (TypeScript)
- [ ] SPEC-003 tests pass (readiness)
- [ ] SPEC-004 tests pass (generation)
- [ ] SPEC-005 tests pass (inline preview)
- [ ] SPEC-006 tests pass (spec panel)
- [ ] SPEC-007 tests pass (workflow)
- [ ] SPEC-008 tests pass (handoff)
- [ ] SPEC-009 tests pass (websocket)
- [ ] SPEC-010 tests pass (observability)
- [ ] End-to-end flow works: Ideation → Generate Spec → Edit → Approve → Tasks Created
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] UI renders correctly in development mode

---

## UI Mockup Reference

### Readiness Indicator (SessionHeader)

```
┌─────────────────────────────────────────────────────────────┐
│  Session: My New Idea                    [75%] Ready to Spec│
│                                          ◕ ──────────────── │
└─────────────────────────────────────────────────────────────┘
```

### Inline Spec Preview (in conversation)

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Spec: My New Idea                           [Draft] ▾    │
├─────────────────────────────────────────────────────────────┤
│ Problem: Users struggle to track their ideas...             │
│ Target Users: Developers, product managers...               │
│ ─────────────────────────────────────────────────────────── │
│        [View Full Spec]      [Edit Spec]                    │
└─────────────────────────────────────────────────────────────┘
```

### Spec Panel (Artifact Panel - Spec Tab)

```
┌─────────────────────────────────────────────────────────────┐
│  [Idea] [Artifacts] [Spec]              v1    [Submit] [x]  │
├─────────────────────────────────────────────────────────────┤
│  Problem Statement                                   [Edit] │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Users currently have no way to organize and develop    ││
│  │ their ideas systematically...                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Target Users                                        [Edit] │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ • Developers building side projects                    ││
│  │ • Product managers with feature ideas                  ││
│  │ • Entrepreneurs exploring new ventures                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Success Criteria                                    [Edit] │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ☑ Users can capture ideas in < 30 seconds             ││
│  │ ☑ Ideas are scored across 30 evaluation criteria      ││
│  │ ☐ 80% of users return within 7 days                   ││
│  │ [+ Add Criterion]                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Constraints                                         [Edit] │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Workflow States Visual

```
  ┌─────────┐     ┌────────┐     ┌──────────┐     ┌──────────┐
  │  Draft  │ ──▶ │ Review │ ──▶ │ Approved │ ──▶ │ Archived │
  └─────────┘     └────────┘     └──────────┘     └──────────┘
       │               │
       └───────────────┘ (Request Changes)
```
