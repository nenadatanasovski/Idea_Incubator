/**
 * Decomposition Agent System Prompts
 *
 * System and user prompt templates for AI-powered task decomposition.
 */

export const DECOMPOSITION_SYSTEM_PROMPT = `You are a Task Decomposition Agent specializing in breaking down complex software development tasks into atomic, executable subtasks.

## Your Role
Analyze tasks and determine if they should be decomposed into smaller, focused subtasks. When decomposing, create subtasks that follow the single responsibility principle and can be executed independently or with clear dependencies.

## Decomposition Principles

### When to Decompose
- Task touches multiple system components (database, API, UI, tests)
- Task description mentions multiple distinct actions (using "and", numbered lists)
- Task has multiple unrelated acceptance criteria
- Task effort is "large" or "epic"
- Task would require multiple git commits to complete properly

### When NOT to Decompose
- Task is already atomic (single concern, single component)
- Task effort is "trivial" or "small"
- Task is a simple bug fix with clear solution
- Further splitting would create artificial boundaries

### Subtask Design Rules
1. **Single Responsibility**: Each subtask should do ONE thing well
2. **Clear Boundaries**: Subtask scope should be unambiguous
3. **Independent Testing**: Each subtask should be testable in isolation
4. **Sensible Dependencies**: Order subtasks by natural execution order:
   - Database/Schema changes first
   - Type definitions second
   - Backend/API changes third
   - Frontend/UI changes fourth
   - Tests and documentation last
5. **Preserve Context**: Carry forward relevant acceptance criteria to each subtask
6. **Appropriate Effort**: Each subtask should be "trivial" to "medium" effort

## Output Format
Respond with a JSON object matching this structure:
\`\`\`json
{
  "shouldDecompose": boolean,
  "reasoning": "Explanation of decomposition decision",
  "confidence": 0.0-1.0,
  "warnings": ["Optional warnings or considerations"],
  "subtasks": [
    {
      "title": "Clear, action-oriented title",
      "description": "Detailed description of what needs to be done",
      "category": "feature|bug|task|test|documentation|...",
      "effort": "trivial|small|medium",
      "acceptanceCriteria": ["Testable criterion 1", "Testable criterion 2"],
      "testCommands": ["npx tsc --noEmit", "npm test"],
      "fileImpacts": [
        {"targetPath": "path/to/file.ts", "operation": "CREATE|UPDATE|DELETE", "impactType": "file|api|type"}
      ],
      "dependsOnIndex": null or 0-based index,
      "rationale": "Why this subtask exists",
      "addressesCriteria": [0, 1]
    }
  ]
}
\`\`\`

## Important Guidelines
- Be conservative: Only decompose when it genuinely helps
- Be specific: Subtask titles and descriptions should be actionable
- Be practical: Consider what a developer can reasonably complete in one session
- Map acceptance criteria: Track which parent criteria each subtask addresses
- Avoid over-engineering: Don't create more subtasks than necessary`;

/**
 * Build the user prompt with full context
 */
export function buildDecompositionPrompt(
  task: {
    id: string;
    displayId: string;
    title: string;
    description?: string;
    category: string;
    effort: string;
    status: string;
  },
  appendices: { appendixType: string; content: string }[],
  prdContext: { title: string; content: string }[],
  relatedTasks: {
    displayId: string;
    title: string;
    relationshipType: string;
  }[],
  fileImpacts: { targetPath: string; operation: string; impactType: string }[],
  gotchas: { content: string; filePattern?: string }[],
): string {
  const sections: string[] = [];

  // Task details
  sections.push(`## Task to Analyze

**ID:** ${task.displayId}
**Title:** ${task.title}
**Category:** ${task.category}
**Effort:** ${task.effort}
**Status:** ${task.status}

**Description:**
${task.description || "(No description provided)"}
`);

  // Acceptance criteria from appendices
  const acAppendix = appendices.find(
    (a) => a.appendixType === "acceptance_criteria",
  );
  if (acAppendix) {
    try {
      const criteria = JSON.parse(acAppendix.content);
      if (Array.isArray(criteria) && criteria.length > 0) {
        sections.push(`## Existing Acceptance Criteria
${criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}
`);
      }
    } catch {
      sections.push(`## Existing Acceptance Criteria
${acAppendix.content}
`);
    }
  }

  // PRD context
  if (prdContext.length > 0) {
    sections.push(`## Linked PRD Context
${prdContext.map((p) => `### ${p.title}\n${p.content}`).join("\n\n")}
`);
  }

  // Related tasks
  if (relatedTasks.length > 0) {
    sections.push(`## Related Tasks
${relatedTasks.map((t) => `- [${t.displayId}] ${t.title} (${t.relationshipType})`).join("\n")}
`);
  }

  // File impacts
  if (fileImpacts.length > 0) {
    sections.push(`## Predicted File Impacts
${fileImpacts.map((f) => `- ${f.operation} ${f.targetPath} (${f.impactType})`).join("\n")}
`);
  }

  // Gotchas
  if (gotchas.length > 0) {
    sections.push(`## Relevant Gotchas/Warnings
${gotchas.map((g) => `- ${g.content}${g.filePattern ? ` (applies to: ${g.filePattern})` : ""}`).join("\n")}
`);
  }

  // Code context appendix
  const codeAppendix = appendices.find(
    (a) => a.appendixType === "code_context",
  );
  if (codeAppendix) {
    sections.push(`## Code Context
${codeAppendix.content}
`);
  }

  // Final instruction
  sections.push(`## Your Task

Analyze this task and determine:
1. Should it be decomposed into subtasks?
2. If yes, what are the logical subtasks?
3. How should acceptance criteria be distributed?
4. What is the correct execution order?

Respond with the JSON structure specified in your instructions.`);

  return sections.join("\n");
}
