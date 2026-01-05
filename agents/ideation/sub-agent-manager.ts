/**
 * SUB-AGENT MANAGER
 *
 * Manages parallel execution of multiple sub-agents for different task types.
 * Spawns agents concurrently, tracks their status, and emits events for UI updates.
 */

import { getConfig } from '../../config/index.js';
import { client as anthropicClient } from '../../utils/anthropic-client.js';

/**
 * Task types supported by the sub-agent manager.
 */
export type SubAgentTaskType = 'action-plan' | 'pitch-refine' | 'architecture-explore' | 'custom';

/**
 * Status of a sub-agent task.
 */
export type SubAgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Represents a task to be executed by a sub-agent.
 */
export interface SubAgentTask {
  id: string;
  type: SubAgentTaskType;
  label: string;  // e.g., "Creating 30/60/90 day action plan..."
  status: SubAgentTaskStatus;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Configuration for spawning a sub-agent task.
 */
export interface SubAgentTaskConfig {
  id: string;
  type: SubAgentTaskType;
  label: string;
  prompt?: string;  // Custom prompt for 'custom' type tasks
}

/**
 * Callback function for status change events.
 */
export type StatusChangeCallback = (tasks: SubAgentTask[]) => void;

/**
 * System prompts for each task type.
 */
const TASK_SYSTEM_PROMPTS: Record<SubAgentTaskType, string> = {
  'action-plan': `You are an action planning specialist. Your job is to create detailed, actionable plans.

## OUTPUT FORMAT
Create a structured action plan with the following sections:

### 30-Day Goals (Quick Wins)
- Immediate, achievable milestones
- Focus on validation and learning
- Low-risk, high-learning activities

### 60-Day Goals (Foundation Building)
- Build on 30-day progress
- Start establishing key processes
- Begin resource acquisition

### 90-Day Goals (Scale Preparation)
- Major milestone achievements
- Prepare for growth phase
- Establish metrics and KPIs

For each goal, include:
- Specific action items
- Success criteria
- Potential blockers and mitigation strategies
- Resource requirements

Be specific, actionable, and realistic.`,

  'pitch-refine': `You are a pitch refinement specialist. Your job is to craft compelling, concise pitches.

## OUTPUT FORMAT
Create a refined pitch with the following components:

### One-Liner
A single sentence that captures the essence (max 15 words)

### Elevator Pitch (30 seconds)
A compelling 3-4 sentence pitch for quick introductions

### Problem Statement
Clear articulation of the pain point being solved

### Solution Overview
How the idea addresses the problem uniquely

### Value Proposition
Why someone should care (benefits, not features)

### Call to Action
What you want the listener to do next

Focus on clarity, emotional resonance, and memorability.`,

  'architecture-explore': `You are a technical architecture specialist. Your job is to explore and document system designs.

## OUTPUT FORMAT
Create an architecture exploration with:

### System Overview
High-level description of the proposed architecture

### Core Components
- List each major component
- Describe its responsibility
- Define interfaces with other components

### Data Flow
How data moves through the system

### Technology Considerations
- Recommended technologies/frameworks
- Trade-offs for each choice
- Scalability considerations

### Integration Points
- External systems
- APIs and protocols
- Third-party services

### Security Considerations
- Authentication/authorization
- Data protection
- Compliance requirements

### Evolution Path
- MVP architecture
- Short-term scaling
- Long-term vision

Be practical and consider real-world constraints.`,

  'custom': `You are a versatile AI assistant. Execute the task as specified by the user.

## GUIDELINES
- Be thorough and detailed
- Structure your response clearly
- Provide actionable insights
- Consider practical constraints
- Highlight key decisions and trade-offs

Adapt your response format to best suit the task at hand.`,
};

/**
 * Default prompts for generating content based on context.
 */
const TASK_DEFAULT_PROMPTS: Record<Exclude<SubAgentTaskType, 'custom'>, string> = {
  'action-plan': `Based on the provided context about this idea, create a comprehensive 30/60/90 day action plan.

Consider:
- Current stage of the idea
- Available resources and constraints
- Key risks and how to mitigate them
- Learning opportunities at each phase
- Clear success criteria for each milestone`,

  'pitch-refine': `Based on the provided context, create a refined and compelling pitch.

Focus on:
- Clarity and conciseness
- Emotional resonance
- Unique value proposition
- Addressing potential objections
- Creating urgency or interest`,

  'architecture-explore': `Based on the provided context, explore potential technical architectures.

Consider:
- Simplicity vs. capability trade-offs
- Build vs. buy decisions
- Scalability requirements
- Team capabilities
- Time-to-market constraints`,
};

/**
 * Manages parallel execution of sub-agents.
 */
export class SubAgentManager {
  private client: typeof anthropicClient;
  private maxConcurrency: number;

  constructor(options?: { maxConcurrency?: number }) {
    this.client = anthropicClient;
    // Run sequentially (1 at a time) to avoid API rate limiting and timeouts
    this.maxConcurrency = options?.maxConcurrency ?? 1;
  }

  /**
   * Spawn multiple agents in parallel to execute tasks.
   *
   * @param tasks - Array of task configurations
   * @param context - Shared context for all agents (idea details, session state, etc.)
   * @param onStatusChange - Callback invoked whenever any task's status changes
   * @returns Promise resolving to the completed tasks with results
   */
  async spawnAgents(
    tasks: SubAgentTaskConfig[],
    context: string,
    onStatusChange?: StatusChangeCallback
  ): Promise<SubAgentTask[]> {
    // Initialize all tasks as pending
    const taskStates: SubAgentTask[] = tasks.map((config) => ({
      id: config.id,
      type: config.type,
      label: config.label,
      status: 'pending' as SubAgentTaskStatus,
    }));

    // Emit initial state
    onStatusChange?.(this.cloneTasks(taskStates));

    // Create execution promises for all tasks
    const executeTask = async (index: number): Promise<void> => {
      const taskConfig = tasks[index];
      const taskState = taskStates[index];

      // Mark as running
      taskState.status = 'running';
      taskState.startedAt = new Date();
      onStatusChange?.(this.cloneTasks(taskStates));

      try {
        // Execute the task
        const result = await this.executeSubAgent(taskConfig, context);

        // Mark as completed
        taskState.status = 'completed';
        taskState.result = result;
        taskState.completedAt = new Date();
        onStatusChange?.(this.cloneTasks(taskStates));
      } catch (error) {
        // Mark as failed
        taskState.status = 'failed';
        taskState.error = error instanceof Error ? error.message : 'Unknown error';
        taskState.completedAt = new Date();
        onStatusChange?.(this.cloneTasks(taskStates));
      }
    };

    // Execute tasks with concurrency control
    await this.executeWithConcurrency(
      tasks.map((_, index) => () => executeTask(index)),
      this.maxConcurrency
    );

    return this.cloneTasks(taskStates);
  }

  /**
   * Execute a single sub-agent task with timeout protection and retry logic.
   */
  private async executeSubAgent(
    taskConfig: SubAgentTaskConfig,
    context: string
  ): Promise<string> {
    const systemPrompt = TASK_SYSTEM_PROMPTS[taskConfig.type];

    // Build the user message
    let userPrompt: string;
    if (taskConfig.type === 'custom' && taskConfig.prompt) {
      userPrompt = `## CONTEXT\n${context}\n\n## TASK\n${taskConfig.prompt}`;
    } else {
      const defaultPrompt = TASK_DEFAULT_PROMPTS[taskConfig.type as Exclude<SubAgentTaskType, 'custom'>];
      userPrompt = `## CONTEXT\n${context}\n\n## TASK\n${defaultPrompt}`;
    }

    console.log(`[SubAgentManager] Starting task: ${taskConfig.id} (${taskConfig.type})`);
    console.log(`[SubAgentManager] Label: ${taskConfig.label}`);

    // Retry configuration
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 360_000; // 360 seconds (6 minutes)
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 3s, 9s (base 3 instead of 2 for more recovery time)
        const backoffMs = Math.pow(3, attempt) * 1000;
        console.log(`[SubAgentManager] Retry ${attempt}/${MAX_RETRIES} for ${taskConfig.id} after ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Sub-agent task timed out after ${TIMEOUT_MS / 1000}s: ${taskConfig.label}`));
          }, TIMEOUT_MS);
        });

        // Race the API call against timeout
        const response = await Promise.race([
          this.client.messages.create({
            model: 'claude-opus-4-5-20251101',
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
          timeoutPromise,
        ]);

        // Extract text content
        const textContent = response.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text response from sub-agent');
        }

        console.log(`[SubAgentManager] Completed task: ${taskConfig.id}`);
        console.log(`[SubAgentManager] Result length: ${textContent.text.length} chars`);

        return textContent.text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[SubAgentManager] Attempt ${attempt + 1} failed for ${taskConfig.id}:`, lastError.message);

        // Don't retry on certain errors
        if (lastError.message.includes('invalid_api_key') ||
            lastError.message.includes('authentication')) {
          throw lastError;
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('Sub-agent task failed after retries');
  }

  /**
   * Execute promises with concurrency control and staggered starts.
   */
  private async executeWithConcurrency(
    taskFns: (() => Promise<void>)[],
    limit: number
  ): Promise<void> {
    const executing = new Set<Promise<void>>();
    const STAGGER_DELAY_MS = 1000; // 1 second delay between task starts to avoid rate limiting

    for (let i = 0; i < taskFns.length; i++) {
      const taskFn = taskFns[i];

      // Stagger task starts to avoid API rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY_MS));
      }

      // Start the task
      const promise = taskFn().finally(() => {
        executing.delete(promise);
      });
      executing.add(promise);

      // If we've hit the limit, wait for one to complete
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }

    // Wait for all remaining tasks
    await Promise.all(executing);
  }

  /**
   * Create a deep clone of tasks array to ensure immutable state.
   */
  private cloneTasks(tasks: SubAgentTask[]): SubAgentTask[] {
    return tasks.map((task) => ({
      ...task,
      startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
      completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    }));
  }

  /**
   * Create a task configuration with a generated ID.
   */
  static createTask(
    type: SubAgentTaskType,
    label: string,
    prompt?: string
  ): SubAgentTaskConfig {
    const id = `task_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return { id, type, label, prompt };
  }

  /**
   * Create a batch of common development tasks.
   */
  static createDevelopmentBatch(): SubAgentTaskConfig[] {
    return [
      SubAgentManager.createTask('action-plan', 'Creating 30/60/90 day action plan...'),
      SubAgentManager.createTask('pitch-refine', 'Refining elevator pitch...'),
      SubAgentManager.createTask('architecture-explore', 'Exploring technical architecture...'),
    ];
  }

  /**
   * Check if all tasks in a batch are complete (success or failure).
   */
  static isComplete(tasks: SubAgentTask[]): boolean {
    return tasks.every((t) => t.status === 'completed' || t.status === 'failed');
  }

  /**
   * Check if any tasks failed.
   */
  static hasFailures(tasks: SubAgentTask[]): boolean {
    return tasks.some((t) => t.status === 'failed');
  }

  /**
   * Get completed results as a map.
   */
  static getResults(tasks: SubAgentTask[]): Map<string, string> {
    const results = new Map<string, string>();
    for (const task of tasks) {
      if (task.status === 'completed' && task.result) {
        results.set(task.id, task.result);
      }
    }
    return results;
  }

  /**
   * Get results grouped by task type.
   */
  static getResultsByType(tasks: SubAgentTask[]): Record<SubAgentTaskType, string | undefined> {
    const results: Record<SubAgentTaskType, string | undefined> = {
      'action-plan': undefined,
      'pitch-refine': undefined,
      'architecture-explore': undefined,
      'custom': undefined,
    };

    for (const task of tasks) {
      if (task.status === 'completed' && task.result) {
        results[task.type] = task.result;
      }
    }

    return results;
  }
}

// Export singleton for convenience
export const subAgentManager = new SubAgentManager();
