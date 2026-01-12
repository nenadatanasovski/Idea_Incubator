/**
 * Task generation prompts for Spec Agent
 */

import { ParsedBrief } from '../brief-parser.js';
import { Gotcha } from '../context-loader.js';

export interface AnalyzedRequirements {
  functionalRequirements: FunctionalRequirement[];
  nonFunctionalRequirements: NonFunctionalRequirement[];
  constraints: string[];
  successCriteria: string[];
  ambiguities: Ambiguity[];
}

export interface FunctionalRequirement {
  id: string;
  description: string;
  priority: 'must' | 'should' | 'could';
}

export interface NonFunctionalRequirement {
  category: string;
  requirement: string;
  target: string;
}

export interface Ambiguity {
  area: string;
  question: string;
}

export function buildTaskGenerationPrompt(
  brief: ParsedBrief,
  requirements: AnalyzedRequirements,
  gotchas: Gotcha[]
): string {
  const taskCount = getTaskCountForComplexity(brief.complexity);

  return `Generate implementation tasks for the following feature.

## Feature
**Title:** ${brief.title}
**ID:** ${brief.id}
**Complexity:** ${brief.complexity}
**Target Task Count:** ${taskCount.min}-${taskCount.max} tasks

## Analyzed Requirements

### Functional Requirements
${requirements.functionalRequirements.map(r => `- [${r.id}] ${r.description} (${r.priority})`).join('\n')}

### Non-Functional Requirements
${requirements.nonFunctionalRequirements.map(r => `- ${r.category}: ${r.requirement} (target: ${r.target})`).join('\n')}

### Constraints
${requirements.constraints.map(c => `- ${c}`).join('\n')}

## Available Gotchas

Include relevant gotchas in each task:
${gotchas.map(g => `- [${g.id}] ${g.content} (applies to: ${g.filePattern}, ${g.actionType})`).join('\n')}

## Instructions

Generate ${taskCount.min}-${taskCount.max} atomic tasks following these rules:

1. **Phases in order:**
   - database: Migrations first
   - types: TypeScript interfaces
   - database: Query functions (depends on types)
   - services: Business logic (if needed)
   - api: Route handlers
   - tests: Test files last

2. **Each task must have:**
   - Unique ID (T-001, T-002, etc.)
   - Phase (database, types, services, api, tests)
   - Action (CREATE or UPDATE)
   - Single file path
   - Requirements list
   - Relevant gotchas
   - Validation command
   - Code template
   - Dependencies (task IDs this depends on)

3. **Output format:**

For each task, output a YAML block:

\`\`\`yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/XXX_feature.sql"
status: pending
requirements:
  - "Create table with columns..."
gotchas:
  - "Use TEXT for timestamps"
validation:
  command: "sqlite3 :memory: < file.sql && echo OK"
  expected: "OK"
code_template: |
  -- SQL here
depends_on: []
\`\`\`

Generate all tasks now:`;
}

export function getTaskCountForComplexity(complexity: 'simple' | 'medium' | 'complex'): { min: number; max: number } {
  switch (complexity) {
    case 'simple':
      return { min: 5, max: 8 };
    case 'medium':
      return { min: 10, max: 15 };
    case 'complex':
      return { min: 20, max: 30 };
  }
}
