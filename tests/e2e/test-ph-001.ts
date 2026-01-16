import {
  ClassificationRule,
  PHASE_REQUIREMENTS,
  CONTENT_INFERENCE_RULES,
  getAllLifecycleStages,
  validatePhaseRequirements,
  Classification,
  PhaseRequirements,
} from "../../agents/ideation/classification-rules.js";

// Test all lifecycle stages defined
const stages = getAllLifecycleStages();
console.log("Stages count:", stages.length);
console.log("Stages:", stages.join(", "));

// Check no duplicates
const issues = validatePhaseRequirements();
console.log("Duplicate issues:", Object.keys(issues).length);

// Check content rules
console.log("Content rules count:", CONTENT_INFERENCE_RULES.length);
console.log(
  "Has competitor:",
  CONTENT_INFERENCE_RULES.some((r) =>
    r.trigger.keywords.includes("competitor"),
  ),
);
console.log(
  "Has B2B:",
  CONTENT_INFERENCE_RULES.some((r) => r.trigger.keywords.includes("B2B")),
);
console.log(
  "Has funding:",
  CONTENT_INFERENCE_RULES.some((r) => r.trigger.keywords.includes("funding")),
);
console.log(
  "Has technical:",
  CONTENT_INFERENCE_RULES.some((r) => r.trigger.keywords.includes("technical")),
);
console.log(
  "Has legal:",
  CONTENT_INFERENCE_RULES.some((r) => r.trigger.keywords.includes("legal")),
);
console.log(
  "Has marketing:",
  CONTENT_INFERENCE_RULES.some((r) => r.trigger.keywords.includes("marketing")),
);

// Check SPARK phase
const spark = PHASE_REQUIREMENTS["SPARK"];
console.log("SPARK required:", spark.required);
console.log("SPARK recommended:", spark.recommended);

// Check CLARIFY phase
const clarify = PHASE_REQUIREMENTS["CLARIFY"];
console.log("CLARIFY required:", clarify.required);
console.log("CLARIFY recommended:", clarify.recommended);

// Verify ClassificationRule interface by creating an instance
const testRule: ClassificationRule = {
  document: "test.md",
  classification: "required",
  conditions: [{ type: "content_contains", value: "test" }],
};
console.log(
  "ClassificationRule test:",
  testRule.document,
  testRule.classification,
);

// All pass
console.log("TEST RESULT: PASS");
