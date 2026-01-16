/**
 * Analysis prompts for Spec Agent
 */

import { ParsedBrief } from "../brief-parser.js";
import { LoadedContext } from "../context-loader.js";

export function buildAnalysisPrompt(
  brief: ParsedBrief,
  context: LoadedContext,
): string {
  return `Analyze the following feature brief and extract structured requirements.

## Feature Brief

**Title:** ${brief.title}
**ID:** ${brief.id}
**Complexity:** ${brief.complexity}

### Problem
${brief.problem}

### Solution
${brief.solution}

### MVP Scope

**In Scope:**
${brief.mvpScope.inScope.map((s) => `- ${s}`).join("\n")}

**Out of Scope:**
${brief.mvpScope.outOfScope.map((s) => `- ${s}`).join("\n")}

### Success Criteria
${brief.successCriteria.map((c) => `- ${c}`).join("\n")}

${brief.architecture ? `### Architecture\n${brief.architecture}` : ""}

${brief.databaseSchema ? `### Database Schema\n\`\`\`sql\n${brief.databaseSchema}\n\`\`\`` : ""}

## Context

The following gotchas are known for this project:
${context.gotchas.map((g) => `- [${g.id}] ${g.content}`).join("\n")}

## Instructions

1. Identify all functional requirements from the brief
2. Identify non-functional requirements (performance, reliability, etc.)
3. Note any constraints from the project context
4. List success criteria that can be validated
5. Flag any ambiguities that need clarification

Output valid JSON matching this structure:
\`\`\`json
{
  "functionalRequirements": [
    { "id": "FR-001", "description": "...", "priority": "must" }
  ],
  "nonFunctionalRequirements": [
    { "category": "performance", "requirement": "...", "target": "..." }
  ],
  "constraints": ["..."],
  "successCriteria": ["..."],
  "ambiguities": [
    { "area": "...", "question": "..." }
  ]
}
\`\`\``;
}

export function buildArchitecturePrompt(
  brief: ParsedBrief,
  context: LoadedContext,
): string {
  return `Design the technical architecture for the following feature.

## Feature
**Title:** ${brief.title}
**Complexity:** ${brief.complexity}

### Problem
${brief.problem}

### Solution
${brief.solution}

${brief.databaseSchema ? `### Existing Schema Hint\n\`\`\`sql\n${brief.databaseSchema}\n\`\`\`` : ""}

## Project Patterns

From the project conventions:
${context.claude.substring(0, 2000)}...

## Instructions

Design an architecture that:
1. Fits the existing project patterns
2. Uses appropriate database schema (SQLite with TEXT timestamps)
3. Follows Express router patterns for API
4. Includes proper error handling

Output markdown with:
1. System context diagram (ASCII)
2. New files table (path, purpose)
3. Modified files table (path, changes)
4. Database schema (SQL)
5. TypeScript interfaces
6. API endpoints table`;
}
