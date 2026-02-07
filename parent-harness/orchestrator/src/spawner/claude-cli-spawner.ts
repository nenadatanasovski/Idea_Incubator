/**
 * Claude CLI Spawner - Executes tasks via Claude CLI directly
 * 
 * NO OpenClaw involvement. Spawns Claude CLI processes directly
 * with full tool access (Read, Write, Edit, exec).
 */

import { spawn } from 'child_process';

// Codebase root
const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

export interface SpawnRequest {
  task: string;
  agentType: string;
  model?: string;
  timeoutSeconds?: number;
  label?: string;
}

export interface SpawnResponse {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

/**
 * Build the full prompt for a task
 */
export function buildAgentPrompt(
  agentType: string,
  taskTitle: string,
  taskDescription: string,
  passCriteria?: string[]
): string {
  const systemContext = `You are an autonomous AI agent working on the Vibe Platform codebase.

## CODEBASE LOCATION
${CODEBASE_ROOT}

## AVAILABLE TOOLS
You have access to:
- Read: Read file contents
- Write: Create or modify files
- Edit: Make precise edits to files
- exec: Execute shell commands (npm, git, etc.)

## COMPLETION SIGNALS
When finished, include one of these in your final message:
- TASK_COMPLETE: <summary of what was done>
- TASK_FAILED: <reason why it cannot be completed>

## RULES
- Verify syntax with \`npx tsc --noEmit\` (DO NOT run npm test - QA agent handles all testing)
- Write clean, documented code
- Don't make unnecessary changes
- If stuck, explain why in TASK_FAILED
`;

  const rolePrompts: Record<string, string> = {
    build_agent: `## ROLE: Build Agent
You implement features and fix bugs. Focus on:
- Clean, maintainable code
- Proper TypeScript types
- Unit tests for new code`,

    qa_agent: `## ROLE: QA Agent
You verify implementations and find bugs. You are the ONLY agent that runs tests. Focus on:
- Running test suites: \`npm test -- --pool=forks --poolOptions.forks.maxForks=1\` (serialized to prevent CPU exhaustion)
- Running typecheck: \`npm run build\`
- Checking edge cases
- Verifying all requirements are met`,

    spec_agent: `## ROLE: Specification Agent
You create technical specifications. Focus on:
- Clear requirements
- Testable acceptance criteria`,

    planning_agent: `## ROLE: Planning Agent
You analyze and plan work. Focus on:
- Identifying gaps and improvements
- Breaking work into tasks`,

    research_agent: `## ROLE: Research Agent
You investigate and analyze. Focus on:
- Understanding existing code
- Documenting findings`,

    test_agent: `## ROLE: Test Agent
You WRITE tests only (DO NOT run npm test - QA agent handles test execution). Focus on:
- Writing unit tests
- Writing integration tests
- Covering edge cases`,

    evaluator_agent: `## ROLE: Evaluator Agent
You assess quality and completeness. Focus on:
- Code review
- Requirement verification`,

    decomposition_agent: `## ROLE: Decomposition Agent
You break down complex tasks. Focus on:
- Subtask identification
- Dependency mapping`,

    task_agent: `## ROLE: Task Agent
You execute specific tasks. Focus on:
- Completing the assigned work
- Reporting results`,

    validation_agent: `## ROLE: Validation Agent
You validate implementations. Focus on:
- Testing functionality
- Verifying correctness`,
  };

  const role = rolePrompts[agentType] || rolePrompts.build_agent;

  let taskSection = `
## TASK
**Title:** ${taskTitle}

**Description:**
${taskDescription}
`;

  if (passCriteria && passCriteria.length > 0) {
    taskSection += `
**Pass Criteria (ALL must be met):**
${passCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`;
  }

  taskSection += `
## INSTRUCTIONS
1. Read relevant files to understand the current state
2. Implement the required changes
3. Run typecheck: \`npx tsc --noEmit\` (do NOT run npm test - QA agent handles testing)
4. Output TASK_COMPLETE with a summary, or TASK_FAILED with reason
`;

  return `${systemContext}\n\n${role}\n\n${taskSection}`;
}

/**
 * Spawn Claude CLI directly
 */
export async function spawnViaCLI(request: SpawnRequest): Promise<SpawnResponse> {
  const { task, model = 'sonnet', timeoutSeconds = 300 } = request;

  return new Promise((resolve) => {
    const output: string[] = [];
    const errors: string[] = [];

    // Spawn claude CLI with allowed tools
    const claude = spawn('claude', [
      '--print',
      '--model', model,
      '--allowedTools', 'Read,Write,Edit,exec',
      '--max-turns', '20',
      task,
    ], {
      cwd: CODEBASE_ROOT,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      claude.kill('SIGTERM');
      resolve({
        success: false,
        error: `Timeout after ${timeoutSeconds}s`,
        output: output.join(''),
        exitCode: -1,
      });
    }, timeoutSeconds * 1000);

    claude.stdout.on('data', (data: Buffer) => {
      output.push(data.toString());
    });

    claude.stderr.on('data', (data: Buffer) => {
      errors.push(data.toString());
    });

    claude.on('close', (code) => {
      clearTimeout(timeout);
      
      const fullOutput = output.join('');
      const isComplete = fullOutput.includes('TASK_COMPLETE');
      const isFailed = fullOutput.includes('TASK_FAILED');

      resolve({
        success: isComplete && !isFailed,
        output: fullOutput,
        error: isFailed ? errors.join('') || fullOutput.split('TASK_FAILED:')[1]?.trim() : undefined,
        exitCode: code ?? 0,
      });
    });

    claude.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        error: `Failed to spawn Claude CLI: ${err.message}`,
        exitCode: -1,
      });
    });
  });
}

/**
 * Check if Claude CLI is available
 */
export async function checkClaudeCliHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('claude', ['--version'], { stdio: 'pipe' });
    
    check.on('close', (code) => {
      resolve(code === 0);
    });

    check.on('error', () => {
      resolve(false);
    });

    // Timeout after 5s
    setTimeout(() => {
      check.kill();
      resolve(false);
    }, 5000);
  });
}

export default {
  buildAgentPrompt,
  spawnViaCLI,
  checkClaudeCliHealth,
};
