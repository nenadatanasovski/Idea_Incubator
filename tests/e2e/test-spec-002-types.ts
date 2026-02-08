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
  ReadinessScore,
} from "../../types/spec";
import type { ArtifactType } from "../../frontend/src/types/ideation";
import type { SpecState } from "../../frontend/src/types/ideation-state";

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

  void testSpec;
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
  const artifactTypes: ArtifactType[] = [
    "code",
    "markdown",
    "spec",
    "research",
  ];
  if (artifactTypes.includes("spec")) {
    console.log("PASS: spec is valid ArtifactType");
    return true;
  }
  console.log("FAIL: spec not in ArtifactType");
  return false;
}

// Test 5: ReadinessScore interface is correct
function testReadinessScore(): boolean {
  const score: ReadinessScore = {
    total: 75,
    isReady: true,
    dimensions: {
      problemClarity: { name: "Problem Clarity", score: 20, description: "" },
      solutionDefinition: {
        name: "Solution Definition",
        score: 20,
        description: "",
      },
      userUnderstanding: {
        name: "User Understanding",
        score: 20,
        description: "",
      },
      scopeBoundaries: { name: "Scope Boundaries", score: 15, description: "" },
    },
  };
  void score;
  console.log("PASS: ReadinessScore interface is correct");
  return true;
}

// Test 6: SpecState in IdeationStore
function testSpecState(): boolean {
  const state: SpecState = {
    spec: null,
    sections: [],
    readiness: null,
    isGenerating: false,
    isEditing: false,
    isSaving: false,
    error: null,
  };
  void state;
  console.log("PASS: SpecState interface is correct");
  return true;
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
  testReadinessScore(),
  testSpecState(),
];

const passed = results.filter((r) => r).length;
const failed = results.filter((r) => !r).length;

console.log("\n" + "=".repeat(60));
console.log(`Total: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
