/**
 * Task Executor for Build Agent
 *
 * Executes atomic tasks in dependency order, managing state and handling failures.
 */

import { AtomicTask, TaskContext } from '../../types/build-agent.js';
import { ContextPrimer } from './context-primer.js';

export type TaskState = 'pending' | 'running' | 'done' | 'failed' | 'blocked' | 'skipped';

export interface ExecutionResult {
  taskId: string;
  state: TaskState;
  output?: string;
  error?: string;
  duration: number;
  attempt: number;
}

export interface ExecutionProgress {
  total: number;
  completed: number;
  failed: number;
  current: string | null;
  percentage: number;
}

export interface TaskExecutorOptions {
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (progress: ExecutionProgress) => void;
  onTaskComplete?: (result: ExecutionResult) => void;
  onTaskFailed?: (taskId: string, error: Error) => void;
  codeGenerator?: CodeGeneratorInterface;
  fileWriter?: FileWriterInterface;
  validationRunner?: ValidationRunnerInterface;
}

// Interfaces for dependencies (to be implemented in other BLD tasks)
export interface CodeGeneratorInterface {
  generate(task: AtomicTask, context: TaskContext): Promise<string>;
}

export interface FileWriterInterface {
  write(filePath: string, content: string): Promise<{ success: boolean; error?: string }>;
}

export interface ValidationRunnerInterface {
  run(command: string, expected: string): Promise<{ success: boolean; output: string }>;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

export class TaskExecutor {
  private contextPrimer: ContextPrimer;
  private maxRetries: number;
  private retryDelay: number;
  private taskStates: Map<string, TaskState>;
  private taskResults: Map<string, ExecutionResult>;
  private onProgress?: (progress: ExecutionProgress) => void;
  private onTaskComplete?: (result: ExecutionResult) => void;
  private onTaskFailed?: (taskId: string, error: Error) => void;
  private codeGenerator?: CodeGeneratorInterface;
  private fileWriter?: FileWriterInterface;
  private validationRunner?: ValidationRunnerInterface;

  constructor(options: TaskExecutorOptions = {}) {
    this.contextPrimer = new ContextPrimer();
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
    this.taskStates = new Map();
    this.taskResults = new Map();
    this.onProgress = options.onProgress;
    this.onTaskComplete = options.onTaskComplete;
    this.onTaskFailed = options.onTaskFailed;
    this.codeGenerator = options.codeGenerator;
    this.fileWriter = options.fileWriter;
    this.validationRunner = options.validationRunner;
  }

  /**
   * Execute all tasks in dependency order
   */
  async execute(tasks: AtomicTask[], specPath: string): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    // Initialize task states
    for (const task of tasks) {
      this.taskStates.set(task.id, 'pending');
    }

    // Order tasks by dependencies
    const orderedTasks = this.orderByDependency(tasks);

    // Execute each task
    for (const task of orderedTasks) {
      // Check if dependencies are satisfied
      const unsatisfiedDeps = this.getUnsatisfiedDependencies(task);
      if (unsatisfiedDeps.length > 0) {
        const depDetails = unsatisfiedDeps
          .map(depId => {
            const depState = this.taskStates.get(depId);
            return `${depId} (${depState || 'not found'})`;
          })
          .join(', ');
        const result: ExecutionResult = {
          taskId: task.id,
          state: 'skipped',
          error: `Dependencies not satisfied: ${depDetails}`,
          duration: 0,
          attempt: 0
        };
        results.push(result);
        this.taskStates.set(task.id, 'skipped');
        continue;
      }

      // Load context for task
      const context = await this.contextPrimer.loadTask(task, tasks, specPath);

      // Execute with retry logic
      const result = await this.executeWithRetry(task, context);
      results.push(result);
      this.taskResults.set(task.id, result);

      // Update progress
      this.emitProgress(tasks, task.id);

      // Notify completion or failure
      if (result.state === 'done') {
        this.onTaskComplete?.(result);
      } else if (result.state === 'failed') {
        this.onTaskFailed?.(task.id, new Error(result.error || 'Unknown error'));
      }
    }

    return results;
  }

  /**
   * Execute a single task
   */
  async executeOne(task: AtomicTask, context: TaskContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.taskStates.set(task.id, 'running');

    try {
      // Step 1: Generate code if we have a generator
      let generatedCode = task.codeTemplate || '';
      if (this.codeGenerator) {
        generatedCode = await this.codeGenerator.generate(task, context);
      }

      // Step 2: Write file if we have a writer
      if (this.fileWriter && generatedCode) {
        const writeResult = await this.fileWriter.write(task.file, generatedCode);
        if (!writeResult.success) {
          throw new Error(`Failed to write file: ${writeResult.error}`);
        }
      }

      // Step 3: Run validation if we have a runner
      if (this.validationRunner && task.validation.command) {
        const validationResult = await this.validationRunner.run(
          task.validation.command,
          task.validation.expected
        );
        if (!validationResult.success) {
          throw new Error(`Validation failed: ${validationResult.output}`);
        }
      }

      const duration = Date.now() - startTime;
      this.taskStates.set(task.id, 'done');

      return {
        taskId: task.id,
        state: 'done',
        output: generatedCode,
        duration,
        attempt: 1
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.taskStates.set(task.id, 'failed');

      return {
        taskId: task.id,
        state: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration,
        attempt: 1
      };
    }
  }

  /**
   * Execute task with retry logic
   */
  private async executeWithRetry(task: AtomicTask, context: TaskContext): Promise<ExecutionResult> {
    let lastResult: ExecutionResult | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const result = await this.executeOne(task, context);
      result.attempt = attempt;
      lastResult = result;

      if (result.state === 'done') {
        return result;
      }

      // If failed and not last attempt, wait and retry
      if (attempt < this.maxRetries) {
        await this.sleep(this.calculateBackoff(attempt));
      }
    }

    // All retries exhausted
    return lastResult || {
      taskId: task.id,
      state: 'failed',
      error: 'Max retries exceeded',
      duration: 0,
      attempt: this.maxRetries
    };
  }

  /**
   * Order tasks by dependency (topological sort)
   * Throws error if circular dependencies are detected
   */
  private orderByDependency(tasks: AtomicTask[]): AtomicTask[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: AtomicTask[] = [];

    const visit = (taskId: string, path: string[] = []) => {
      if (visited.has(taskId)) return;

      if (visiting.has(taskId)) {
        // Circular dependency detected
        const cycle = [...path, taskId].slice(path.indexOf(taskId));
        throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }

      visiting.add(taskId);
      path.push(taskId);

      const task = taskMap.get(taskId);
      if (!task) {
        visiting.delete(taskId);
        path.pop();
        return;
      }

      for (const depId of task.dependsOn) {
        visit(depId, [...path]);
      }

      result.push(task);
      visiting.delete(taskId);
      visited.add(taskId);
      path.pop();
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }

  /**
   * Check if all dependencies are satisfied
   */
  private _areDependenciesSatisfied(task: AtomicTask): boolean {
    for (const depId of task.dependsOn) {
      const depState = this.taskStates.get(depId);
      if (depState !== 'done') {
        return false;
      }
    }
    return true;
  }

  /**
   * Get list of unsatisfied dependencies for a task
   */
  private getUnsatisfiedDependencies(task: AtomicTask): string[] {
    const unsatisfied: string[] = [];
    for (const depId of task.dependsOn) {
      const depState = this.taskStates.get(depId);
      if (depState !== 'done') {
        unsatisfied.push(depId);
      }
    }
    return unsatisfied;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * delay;
    return Math.min(delay + jitter, 60000);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit progress update
   */
  private emitProgress(tasks: AtomicTask[], currentTaskId: string): void {
    if (!this.onProgress) return;

    const completed = Array.from(this.taskStates.values()).filter(s => s === 'done').length;
    const failed = Array.from(this.taskStates.values()).filter(s => s === 'failed').length;

    this.onProgress({
      total: tasks.length,
      completed,
      failed,
      current: currentTaskId,
      percentage: Math.round((completed / tasks.length) * 100)
    });
  }

  /**
   * Get current task state
   */
  getTaskState(taskId: string): TaskState | undefined {
    return this.taskStates.get(taskId);
  }

  /**
   * Get all task states
   */
  getAllTaskStates(): Map<string, TaskState> {
    return new Map(this.taskStates);
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): ExecutionResult | undefined {
    return this.taskResults.get(taskId);
  }

  /**
   * Reset executor state
   */
  reset(): void {
    this.taskStates.clear();
    this.taskResults.clear();
  }

  /**
   * Set code generator
   */
  setCodeGenerator(generator: CodeGeneratorInterface): void {
    this.codeGenerator = generator;
  }

  /**
   * Set file writer
   */
  setFileWriter(writer: FileWriterInterface): void {
    this.fileWriter = writer;
  }

  /**
   * Set validation runner
   */
  setValidationRunner(runner: ValidationRunnerInterface): void {
    this.validationRunner = runner;
  }

  /**
   * Validate task dependency graph
   * Returns list of validation errors (empty if valid)
   */
  validateDependencyGraph(tasks: AtomicTask[]): string[] {
    const errors: string[] = [];
    const taskIds = new Set(tasks.map(t => t.id));

    for (const task of tasks) {
      // Check for missing dependencies
      for (const depId of task.dependsOn) {
        if (!taskIds.has(depId)) {
          errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
        }
      }

      // Check for self-dependency
      if (task.dependsOn.includes(task.id)) {
        errors.push(`Task ${task.id} depends on itself`);
      }
    }

    // Check for circular dependencies
    try {
      this.orderByDependency(tasks);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }

    return errors;
  }

  /**
   * Generate dependency graph visualization (DOT format)
   * Can be rendered with Graphviz
   */
  visualizeDependencyGraph(tasks: AtomicTask[]): string {
    const lines: string[] = ['digraph TaskDependencies {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box];');
    lines.push('');

    // Add nodes with state colors
    for (const task of tasks) {
      const state = this.taskStates.get(task.id) || 'pending';
      const color = this.getStateColor(state);
      const label = `${task.id}\\n${task.phase}\\n${task.action}`;
      lines.push(`  "${task.id}" [label="${label}", fillcolor="${color}", style=filled];`);
    }

    lines.push('');

    // Add edges
    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        lines.push(`  "${depId}" -> "${task.id}";`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Get color for task state visualization
   */
  private getStateColor(state: TaskState): string {
    const colors: Record<TaskState, string> = {
      pending: 'lightgray',
      running: 'lightyellow',
      done: 'lightgreen',
      failed: 'lightcoral',
      blocked: 'orange',
      skipped: 'lightblue'
    };
    return colors[state] || 'white';
  }
}

/**
 * Create a task executor instance
 */
export function createTaskExecutor(options?: TaskExecutorOptions): TaskExecutor {
  return new TaskExecutor(options);
}
