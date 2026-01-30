/**
 * Build Agent Core
 *
 * Main entry point for the Build Agent. Orchestrates task loading,
 * execution, and progress reporting.
 */

import { TaskLoader } from "./task-loader.js";
import {
  TaskExecutor,
  ExecutionResult,
  ExecutionProgress,
} from "./task-executor.js";
import { ContextPrimer } from "./context-primer.js";
import { CodeGenerator } from "./code-generator.js";
import { FileWriter } from "./file-writer.js";
import { ValidationRunner } from "./validation-runner.js";
import { CheckpointManager } from "./checkpoint-manager.js";
import { GitIntegration } from "./git-integration.js";
import {
  createBuildExecution,
  updateBuildExecution,
  createTaskExecution,
  updateTaskExecution,
  createBuildCheckpoint,
  saveDb,
} from "../../database/db.js";
import {
  emitBuildEvent,
  emitTaskStarted,
  emitTaskCompleted,
  emitTaskFailed,
  emitBuildProgress,
} from "../../server/websocket.js";
import { BuildOptions, AtomicTask } from "../../types/build-agent.js";
import { graphQueryService } from "../../server/services/graph/graph-query-service.js";

/**
 * Context loaded from memory graph for build execution
 */
interface GraphBuildContext {
  requirements: Array<{
    id: string;
    content: string;
    type: "requirement" | "constraint";
  }>;
  learnings: Array<{
    id: string;
    content: string;
    confidence: number;
    type: "pattern" | "gotcha";
  }>;
}

export interface BuildAgentOptions {
  apiKey?: string;
  projectRoot?: string;
  autoCommit?: boolean;
  maxRetries?: number;
  skipValidation?: boolean;
  dryRun?: boolean;
  tokenLimit?: number;
  ideaId?: string; // For loading context from memory graph
  onProgress?: (progress: ExecutionProgress) => void;
  onTaskComplete?: (result: ExecutionResult) => void;
  onTaskFailed?: (taskId: string, error: Error) => void;
}

export interface BuildResult {
  buildId: string;
  status: "completed" | "failed" | "cancelled";
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  results: ExecutionResult[];
  duration: number;
  error?: string;
}

/**
 * Build Agent - orchestrates build execution
 */
export class BuildAgent {
  private taskLoader: TaskLoader;
  private taskExecutor: TaskExecutor;
  private contextPrimer: ContextPrimer;
  private codeGenerator: CodeGenerator;
  private fileWriter: FileWriter;
  private validationRunner: ValidationRunner;
  private checkpointManager: CheckpointManager;
  private gitIntegration: GitIntegration;
  private options: BuildAgentOptions;

  constructor(options: BuildAgentOptions = {}) {
    this.options = options;
    const projectRoot = options.projectRoot || process.cwd();

    // Initialize components
    this.taskLoader = new TaskLoader({ projectRoot });
    this.contextPrimer = new ContextPrimer({
      projectRoot,
      tokenLimit: options.tokenLimit,
    });
    this.codeGenerator = new CodeGenerator({ apiKey: options.apiKey });
    this.fileWriter = new FileWriter({ projectRoot });
    this.validationRunner = new ValidationRunner({ cwd: projectRoot });
    this.checkpointManager = new CheckpointManager();
    this.gitIntegration = new GitIntegration({ cwd: projectRoot });

    // Initialize task executor with components
    this.taskExecutor = new TaskExecutor({
      maxRetries: options.maxRetries,
      onProgress: options.onProgress,
      onTaskComplete: options.onTaskComplete,
      onTaskFailed: options.onTaskFailed,
      codeGenerator: options.dryRun ? undefined : this.codeGenerator,
      fileWriter: options.dryRun ? undefined : this.fileWriter,
      validationRunner: options.skipValidation
        ? undefined
        : this.validationRunner,
    });
  }

  /**
   * Load build context from memory graph
   * This provides additional requirements and learnings that may not be in the task file
   */
  private async loadGraphContext(ideaId: string): Promise<GraphBuildContext> {
    const [requirements, learnings] = await Promise.all([
      graphQueryService.getSpecRequirements(ideaId),
      graphQueryService.getLearnings(ideaId),
    ]);

    return {
      requirements: requirements.blocks.map((b) => ({
        id: b.id,
        content: b.content,
        type: b.blockTypes.includes("constraint")
          ? ("constraint" as const)
          : ("requirement" as const),
      })),
      learnings: learnings.blocks.map((b) => ({
        id: b.id,
        content: b.content,
        confidence: b.confidence || 0,
        type: b.blockTypes.includes("pattern")
          ? ("pattern" as const)
          : ("gotcha" as const),
      })),
    };
  }

  /**
   * Run a build from a tasks.md file
   */
  async run(
    tasksPath: string,
    buildOptions?: BuildOptions,
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const opts = { ...this.options, ...buildOptions };

    // Load and parse tasks
    const parseResult = this.taskLoader.load(tasksPath);
    if (!parseResult.success || !parseResult.file) {
      throw new Error(parseResult.error || "Failed to parse tasks file");
    }

    const { frontmatter, tasks } = parseResult.file;

    // Create build execution record
    const buildId = await createBuildExecution({
      specId: frontmatter.id,
      specPath: tasksPath,
      tasksTotal: tasks.length,
      options: opts,
    });

    // Update status to running
    await updateBuildExecution(buildId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });
    await saveDb();

    // Emit build started event
    emitBuildEvent("build:started", buildId, {
      specId: frontmatter.id,
      specPath: tasksPath,
      tasksTotal: tasks.length,
    });

    // Load graph context if ideaId is provided
    let graphContext: GraphBuildContext | null = null;
    if (opts.ideaId) {
      try {
        graphContext = await this.loadGraphContext(opts.ideaId);
        console.log(
          `[BuildAgent] Loaded ${graphContext.requirements.length} requirements and ${graphContext.learnings.length} learnings from graph`,
        );
      } catch (err) {
        console.warn("[BuildAgent] Failed to load graph context:", err);
      }
    }

    // Order tasks by dependencies
    const orderedTasks = this.taskLoader.orderByDependency(tasks);

    // Convert LoadedTask to AtomicTask, merging graph context
    const graphGotchas = graphContext
      ? graphContext.learnings
          .filter((l) => l.type === "gotcha")
          .map((l) => l.content)
      : [];
    const graphRequirements = graphContext
      ? graphContext.requirements.map((r) => r.content)
      : [];

    const atomicTasks: AtomicTask[] = orderedTasks.map((t) => ({
      id: t.id,
      phase: t.phase,
      action: t.action,
      file: t.file,
      status: t.status,
      // Merge graph requirements with task requirements
      requirements: [...(t.requirements || []), ...graphRequirements],
      // Merge graph gotchas with task gotchas
      gotchas: [...(t.gotchas || []), ...graphGotchas],
      validation: t.validation,
      codeTemplate: t.codeTemplate,
      dependsOn: t.dependsOn,
    }));

    // Execute tasks
    const results: ExecutionResult[] = [];
    let tasksCompleted = 0;
    let tasksFailed = 0;

    for (const task of atomicTasks) {
      // Create task execution record
      const taskExecId = await createTaskExecution({
        buildId,
        taskId: task.id,
        phase: task.phase,
        action: task.action,
        filePath: task.file,
      });

      // Emit task started event
      emitTaskStarted(buildId, task.id, task.phase, task.action, task.file);

      // Update task status
      await updateTaskExecution(taskExecId, {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      // Load context for task
      const context = await this.contextPrimer.loadTask(
        task,
        atomicTasks,
        tasksPath,
      );

      // Execute task
      const result = await this.taskExecutor.executeOne(task, context);
      results.push(result);

      // Update task execution record
      await updateTaskExecution(taskExecId, {
        status: result.state === "done" ? "completed" : "failed",
        completedAt: new Date().toISOString(),
        generatedCode: result.output,
        errorMessage: result.error,
        durationMs: result.duration,
      });

      if (result.state === "done") {
        tasksCompleted++;
        emitTaskCompleted(buildId, task.id, tasksCompleted, atomicTasks.length);

        // Auto-commit if enabled
        if (opts.autoCommit && !opts.dryRun) {
          await this.gitIntegration.commit(task.id, task.file);
        }

        // Create checkpoint
        await createBuildCheckpoint({
          buildId,
          taskId: task.id,
          state: {
            completedTasks: results
              .filter((r) => r.state === "done")
              .map((r) => r.taskId),
            currentIndex: atomicTasks.findIndex((t) => t.id === task.id),
          },
        });
      } else {
        tasksFailed++;
        emitTaskFailed(buildId, task.id, result.error || "Unknown error");

        // Stop on failure (could make this configurable)
        break;
      }

      // Update build progress
      await updateBuildExecution(buildId, {
        currentTaskId: task.id,
        tasksCompleted,
        tasksFailed,
      });

      // Emit progress
      emitBuildProgress(
        buildId,
        tasksCompleted,
        atomicTasks.length,
        tasksFailed,
        task.id,
      );

      await saveDb();
    }

    // Determine final status
    const status = tasksFailed > 0 ? "failed" : "completed";
    const duration = Date.now() - startTime;

    // Update build execution
    await updateBuildExecution(buildId, {
      status,
      completedAt: new Date().toISOString(),
      tasksCompleted,
      tasksFailed,
      currentTaskId: null,
      errorMessage: tasksFailed > 0 ? `${tasksFailed} task(s) failed` : null,
    });
    await saveDb();

    // Emit build completed/failed event
    emitBuildEvent(
      status === "completed" ? "build:completed" : "build:failed",
      buildId,
      {
        tasksTotal: atomicTasks.length,
        tasksCompleted,
        tasksFailed,
        progressPct: 100,
      },
    );

    return {
      buildId,
      status,
      tasksTotal: atomicTasks.length,
      tasksCompleted,
      tasksFailed,
      results,
      duration,
      error: tasksFailed > 0 ? `${tasksFailed} task(s) failed` : undefined,
    };
  }

  /**
   * Resume a build from checkpoint
   */
  async resume(buildId: string, tasksPath: string): Promise<BuildResult> {
    // Load checkpoint
    const checkpoint = await this.checkpointManager.load(buildId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for build: ${buildId}`);
    }

    // Load tasks
    const parseResult = this.taskLoader.load(tasksPath);
    if (!parseResult.success || !parseResult.file) {
      throw new Error(parseResult.error || "Failed to parse tasks file");
    }

    // Filter out completed tasks
    const completedTaskIds = new Set(checkpoint.completedTasks);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const pendingCount = parseResult.file.tasks.filter(
      (t) => !completedTaskIds.has(t.id),
    ).length;

    // TODO: Continue execution with pending tasks only
    // For now, just run the full build again from the checkpoint state
    // Future: Execute only pending tasks instead of full run
    console.log(`Resuming build with ${pendingCount} pending tasks`);
    return this.run(tasksPath);
  }

  /**
   * Get current build state
   */
  getState(): Map<string, string> {
    return this.taskExecutor.getAllTaskStates();
  }

  /**
   * Reset the executor state
   */
  reset(): void {
    this.taskExecutor.reset();
  }
}

/**
 * Create a build agent instance
 */
export function createBuildAgent(options?: BuildAgentOptions): BuildAgent {
  return new BuildAgent(options);
}

/**
 * Run a build directly
 */
export async function runBuild(
  tasksPath: string,
  options?: BuildAgentOptions,
): Promise<BuildResult> {
  const agent = createBuildAgent(options);
  return agent.run(tasksPath);
}
