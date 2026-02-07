/**
 * OpenClaw Spawner - Executes tasks via OpenClaw sessions_spawn
 * 
 * This is the interface between the parent harness and OpenClaw.
 * It calls OpenClaw's gateway API to spawn sub-agents that have
 * full tool access (file, exec, browser).
 * 
 * NO API KEYS NEEDED - OpenClaw handles OAuth.
 */

// Codebase root
const CODEBASE_ROOT = '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// OpenClaw Gateway
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3030';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;

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
  sessionKey?: string;
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
Use the standard tools:
- Read: Read file contents (use path parameter)
- Write: Create or modify files (use path and content parameters)
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
 * Spawn an agent via OpenClaw Gateway API
 */
export async function spawnViaOpenClaw(request: SpawnRequest): Promise<SpawnResponse> {
  const { task, model = 'sonnet', timeoutSeconds = 300, label } = request;

  try {
    const response = await fetch(`${GATEWAY_URL}/api/sessions/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        task,
        label: label || `harness-${Date.now()}`,
        model,
        runTimeoutSeconds: timeoutSeconds,
        cleanup: 'delete',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `Gateway responded ${response.status}: ${errorText}` 
      };
    }

    const result = await response.json() as {
      output?: string;
      result?: string;
      error?: string;
      sessionKey?: string;
    };
    
    // Check for completion signals in output
    const output = result.output || result.result || '';
    const isComplete = output.includes('TASK_COMPLETE');
    const isFailed = output.includes('TASK_FAILED') || result.error;

    return {
      success: isComplete && !isFailed,
      output,
      error: isFailed ? (result.error || output.split('TASK_FAILED:')[1]?.trim()) : undefined,
      sessionKey: result.sessionKey,
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to call OpenClaw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if OpenClaw Gateway is reachable
 */
export async function checkOpenClawHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${GATEWAY_URL}/health`, {
      method: 'GET',
      headers: GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default {
  buildAgentPrompt,
  spawnViaOpenClaw,
  checkOpenClawHealth,
};
