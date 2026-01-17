/**
 * Spec Generation Prompt Template
 *
 * Prompt for generating structured specifications from ideation sessions.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-004-B)
 */

import type { IdeationMessage } from "../../../types/ideation.js";
import type { SpecSectionType } from "../../../types/spec.js";

/**
 * Section extraction prompts
 */
export const SECTION_PROMPTS: Record<SpecSectionType, string> = {
  problem: `Extract the PROBLEM STATEMENT from the conversation:
- What problem is being solved?
- What are the pain points?
- What is the current situation vs desired state?
Write a clear, concise problem statement (2-4 sentences).`,

  target_users: `Extract the TARGET USERS from the conversation:
- Who are the primary users?
- What are their characteristics?
- What context do they operate in?
Write a description of target users (2-4 sentences).`,

  functional_desc: `Extract the FUNCTIONAL DESCRIPTION from the conversation:
- What will the solution do?
- What are the key capabilities?
- How does it solve the problem?
Write a functional description (3-5 sentences).`,

  success_criteria: `Extract SUCCESS CRITERIA from the conversation:
- What defines success?
- What measurable outcomes are expected?
- What goals need to be achieved?
Return as a JSON array of 3-7 specific, measurable criteria.`,

  constraints: `Extract CONSTRAINTS from the conversation:
- What limitations exist?
- What must be considered?
- What requirements must be met?
Return as a JSON array of 3-7 constraints.`,

  out_of_scope: `Extract OUT OF SCOPE items from the conversation:
- What explicitly won't be included?
- What is deferred to later?
- What is explicitly excluded?
Return as a JSON array of 3-5 out-of-scope items.`,

  risks: `Extract RISKS from the conversation:
- What could go wrong?
- What uncertainties exist?
- What challenges are anticipated?
Return as a JSON array of 3-5 risks.`,

  assumptions: `Extract ASSUMPTIONS from the conversation:
- What is being assumed?
- What conditions are expected?
- What dependencies exist?
Return as a JSON array of 3-5 assumptions.`,
};

/**
 * Build the main spec generation prompt
 */
export function buildSpecGenerationPrompt(
  messages: IdeationMessage[],
  ideaTitle?: string,
): string {
  // Format conversation
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `You are a specification expert. Analyze this ideation conversation and generate a structured product specification.

## Conversation
${conversationText}

${ideaTitle ? `## Idea Title\n${ideaTitle}\n` : ""}

## Instructions

Generate a complete product specification by extracting information from the conversation. For each section, provide:
1. The extracted content
2. A confidence score (0-100) indicating how well the conversation supports this section
3. If confidence < 50, include a clarifying question

## Response Format

Respond ONLY with a JSON object in this exact format:
{
  "title": "Spec title based on the idea",
  "problemStatement": {
    "content": "Clear problem statement",
    "confidence": 80,
    "clarifyingQuestion": null
  },
  "targetUsers": {
    "content": "Description of target users",
    "confidence": 75,
    "clarifyingQuestion": null
  },
  "functionalDescription": {
    "content": "What the solution does",
    "confidence": 70,
    "clarifyingQuestion": "What is the primary interaction model?"
  },
  "successCriteria": {
    "content": ["Criterion 1", "Criterion 2", "Criterion 3"],
    "confidence": 60,
    "clarifyingQuestion": "What metrics define success?"
  },
  "constraints": {
    "content": ["Constraint 1", "Constraint 2"],
    "confidence": 65,
    "clarifyingQuestion": null
  },
  "outOfScope": {
    "content": ["Item 1", "Item 2"],
    "confidence": 50,
    "clarifyingQuestion": "Are there specific features to explicitly exclude?"
  },
  "risks": {
    "content": ["Risk 1", "Risk 2"],
    "confidence": 55,
    "clarifyingQuestion": null
  },
  "assumptions": {
    "content": ["Assumption 1", "Assumption 2"],
    "confidence": 60,
    "clarifyingQuestion": null
  }
}

## Guidelines

1. Extract actual content from the conversation - don't make things up
2. Be specific and concrete, not generic
3. Use the user's language and terminology
4. For array fields, include 3-7 items when sufficient info exists
5. Set confidence based on how explicitly the topic was discussed:
   - 80-100: Explicitly discussed in detail
   - 60-79: Mentioned or implied
   - 40-59: Partially covered
   - 0-39: Barely mentioned or missing
6. Include clarifying questions for any section with confidence < 50`;
}

/**
 * Build prompt for regenerating a specific section
 */
export function buildSectionRegenerationPrompt(
  messages: IdeationMessage[],
  sectionType: SpecSectionType,
  currentContent: string,
  additionalContext?: string,
): string {
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const sectionPrompt = SECTION_PROMPTS[sectionType];

  return `You are refining a section of a product specification.

## Conversation
${conversationText}

## Current Content
${currentContent}

${additionalContext ? `## Additional Context\n${additionalContext}\n` : ""}

## Task
${sectionPrompt}

## Response Format

Respond ONLY with a JSON object:
{
  "content": "The improved content (string or array depending on section type)",
  "confidence": 75,
  "changes": "Brief description of what was improved"
}`;
}

/**
 * Build prompt for validating a complete spec
 */
export function buildSpecValidationPrompt(spec: {
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
}): string {
  return `Validate this product specification for completeness and consistency.

## Specification

**Problem Statement:**
${spec.problemStatement || "(Not provided)"}

**Target Users:**
${spec.targetUsers || "(Not provided)"}

**Functional Description:**
${spec.functionalDescription || "(Not provided)"}

**Success Criteria:**
${spec.successCriteria?.length ? spec.successCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(Not provided)"}

**Constraints:**
${spec.constraints?.length ? spec.constraints.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(Not provided)"}

**Out of Scope:**
${spec.outOfScope?.length ? spec.outOfScope.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(Not provided)"}

## Validation

Check for:
1. Completeness - are all sections filled?
2. Consistency - do sections align with each other?
3. Clarity - is the language specific and actionable?
4. Measurability - are success criteria testable?

## Response Format

{
  "isValid": true,
  "overallScore": 85,
  "issues": [
    { "section": "successCriteria", "issue": "Criterion 2 is not measurable", "suggestion": "Add specific metrics" }
  ],
  "strengths": ["Clear problem statement", "Well-defined target users"],
  "recommendations": ["Consider adding timeline constraints"]
}`;
}
