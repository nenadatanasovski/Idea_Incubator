/**
 * ObservableAgent - Base class for all observable TypeScript agents
 *
 * Provides unified observability infrastructure for any agent
 * by composing TranscriptWriter, ToolUseLogger, and AssertionRecorder.
 * Mirrors Python ObservableAgent API for consistency.
 *
 * OBS-101: Phase 3 TypeScript ObservableAgent Base Class
 */

import {
  TranscriptWriter,
  ToolUseLogger,
  AssertionRecorder,
  type AssertionEvidence,
  type ChainResult,
} from "../services/observability/index.js";

export interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  toolUseId: string;
  output: unknown;
  isError?: boolean;
  errorMessage?: string;
}

export interface ObservableAgentOptions {
  executionId: string;
  instanceId: string;
  agentType?: string;
  waveId?: string;
  waveNumber?: number;
}

/**
 * Abstract base class for observable agents.
 *
 * Composes all observability infrastructure and provides
 * a unified interface for logging lifecycle events, tool uses,
 * assertions, and discoveries.
 *
 * Usage:
 *   class MyAgent extends ObservableAgent {
 *     constructor(options: ObservableAgentOptions) {
 *       super({ ...options, agentType: 'my-agent' });
 *     }
 *
 *     async run(taskId: string): Promise<void> {
 *       await this.logTaskStart(taskId, 'My task');
 *       try {
 *         // Do work...
 *         await this.logTaskEnd(taskId, 'complete');
 *       } catch (e) {
 *         await this.logError(e.message, taskId);
 *         throw e;
 *       } finally {
 *         await this.close();
 *       }
 *     }
 *   }
 */
export abstract class ObservableAgent {
  protected executionId: string;
  protected instanceId: string;
  protected agentType: string;
  protected waveId?: string;
  protected waveNumber?: number;

  protected transcript: TranscriptWriter;
  protected toolLogger: ToolUseLogger;
  protected assertionRecorder: AssertionRecorder;

  private phaseStartTimes: Map<string, number> = new Map();
  private taskStartTimes: Map<string, number> = new Map();
  private currentTaskId?: string;

  constructor(options: ObservableAgentOptions) {
    this.executionId = options.executionId;
    this.instanceId = options.instanceId;
    this.agentType = options.agentType || "agent";
    this.waveId = options.waveId;
    this.waveNumber = options.waveNumber;

    // Initialize observability infrastructure
    this.transcript = new TranscriptWriter({
      executionId: this.executionId,
      instanceId: this.instanceId,
      waveId: this.waveId,
      waveNumber: this.waveNumber,
      source: "agent",
    });

    this.toolLogger = new ToolUseLogger(this.transcript);

    this.assertionRecorder = new AssertionRecorder(
      this.transcript,
      this.executionId,
    );
  }

  // =========================================================================
  // Lifecycle Logging
  // =========================================================================

  /**
   * Log start of a phase
   */
  protected async logPhaseStart(
    phaseName: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    this.phaseStartTimes.set(phaseName, Date.now());
    return this.transcript.writePhaseStart(phaseName, {
      agentType: this.agentType,
      ...details,
    });
  }

  /**
   * Log end of a phase
   */
  protected async logPhaseEnd(
    phaseName: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    const startTime = this.phaseStartTimes.get(phaseName);
    this.phaseStartTimes.delete(phaseName);

    const durationMs = startTime ? Date.now() - startTime : undefined;

    return this.transcript.writePhaseEnd(phaseName, durationMs, {
      agentType: this.agentType,
      ...details,
    });
  }

  /**
   * Log start of a task
   */
  protected async logTaskStart(
    taskId: string,
    taskTitle: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    this.taskStartTimes.set(taskId, Date.now());
    this.currentTaskId = taskId;
    return this.transcript.writeTaskStart(taskId, taskTitle, details);
  }

  /**
   * Log end of a task
   */
  protected async logTaskEnd(
    taskId: string,
    status: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    const startTime = this.taskStartTimes.get(taskId);
    this.taskStartTimes.delete(taskId);

    const durationMs = startTime ? Date.now() - startTime : undefined;

    if (this.currentTaskId === taskId) {
      this.currentTaskId = undefined;
    }

    return this.transcript.writeTaskEnd(taskId, status, durationMs, details);
  }

  // =========================================================================
  // Tool Logging
  // =========================================================================

  /**
   * Log start of a tool invocation
   */
  protected async logToolStart(
    toolName: string,
    toolInput: Record<string, unknown>,
    taskId?: string,
  ): Promise<string> {
    return this.toolLogger.logStart(
      toolName,
      toolInput,
      taskId || this.currentTaskId,
    );
  }

  /**
   * Log completion of a tool invocation
   */
  protected async logToolEnd(
    toolUseId: string,
    output: unknown,
    isError: boolean = false,
    errorMessage?: string,
  ): Promise<void> {
    await this.toolLogger.logEnd(toolUseId, output, isError, errorMessage);
  }

  /**
   * Log security-blocked tool invocation
   */
  protected async logToolBlocked(
    toolUseId: string,
    reason: string,
  ): Promise<void> {
    await this.toolLogger.logBlocked(toolUseId, reason);
  }

  /**
   * Log a complete tool invocation in one call
   */
  protected async logToolSimple(
    toolName: string,
    toolInput: Record<string, unknown>,
    output: unknown,
    taskId?: string,
    isError: boolean = false,
    errorMessage?: string,
  ): Promise<string> {
    return this.toolLogger.logSimple(
      toolName,
      toolInput,
      output,
      taskId || this.currentTaskId,
      isError,
      errorMessage,
    );
  }

  // =========================================================================
  // Assertion Recording
  // =========================================================================

  /**
   * Start an assertion chain for validation
   */
  protected async startAssertionChain(
    taskId: string,
    description: string,
  ): Promise<string> {
    return this.assertionRecorder.startChain(
      taskId || this.currentTaskId!,
      description,
    );
  }

  /**
   * End assertion chain and get results
   */
  protected async endAssertionChain(chainId: string): Promise<ChainResult> {
    return this.assertionRecorder.endChain(chainId);
  }

  /**
   * Assert a file was created
   */
  protected async assertFileCreated(
    taskId: string,
    filePath: string,
  ): Promise<string> {
    return this.assertionRecorder.assertFileCreated(
      taskId || this.currentTaskId!,
      filePath,
    );
  }

  /**
   * Assert a file was modified
   */
  protected async assertFileModified(
    taskId: string,
    filePath: string,
  ): Promise<string> {
    return this.assertionRecorder.assertFileModified(
      taskId || this.currentTaskId!,
      filePath,
    );
  }

  /**
   * Assert a file was deleted
   */
  protected async assertFileDeleted(
    taskId: string,
    filePath: string,
  ): Promise<string> {
    return this.assertionRecorder.assertFileDeleted(
      taskId || this.currentTaskId!,
      filePath,
    );
  }

  /**
   * Assert TypeScript compilation passes
   */
  protected async assertTypescriptCompiles(taskId?: string): Promise<string> {
    return this.assertionRecorder.assertTypescriptCompiles(
      taskId || this.currentTaskId!,
    );
  }

  /**
   * Assert linting passes
   */
  protected async assertLintPasses(taskId?: string): Promise<string> {
    return this.assertionRecorder.assertLintPasses(
      taskId || this.currentTaskId!,
    );
  }

  /**
   * Assert tests pass
   */
  protected async assertTestsPass(
    taskId?: string,
    pattern?: string,
  ): Promise<string> {
    return this.assertionRecorder.assertTestsPass(
      taskId || this.currentTaskId!,
      pattern,
    );
  }

  /**
   * Run a custom assertion via command
   */
  protected async assertCustom(
    taskId: string,
    category: string,
    description: string,
    command: string,
    timeout?: number,
  ): Promise<string> {
    return this.assertionRecorder.assertCustom(
      taskId || this.currentTaskId!,
      category,
      description,
      command,
      timeout,
    );
  }

  /**
   * Record a manual assertion result
   */
  protected async assertManual(
    taskId: string,
    category: string,
    description: string,
    passed: boolean,
    evidenceDetails?: Partial<AssertionEvidence>,
  ): Promise<string> {
    return this.assertionRecorder.assertManual(
      taskId || this.currentTaskId!,
      category,
      description,
      passed,
      evidenceDetails,
    );
  }

  // =========================================================================
  // Error Logging
  // =========================================================================

  /**
   * Log an error with optional stack trace
   */
  protected async logError(
    message: string,
    taskId?: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.transcript.writeError(message, taskId || this.currentTaskId, {
      agentType: this.agentType,
      ...details,
    });
  }

  // =========================================================================
  // Discovery Logging (for SIA-type agents)
  // =========================================================================

  /**
   * Log a discovery (gotcha, pattern, decision)
   */
  protected async logDiscovery(
    discoveryType: string,
    content: string,
    confidence: number = 0.5,
    taskId?: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.transcript.writeDiscovery(
      discoveryType,
      content,
      taskId || this.currentTaskId,
      {
        type: discoveryType,
        confidence: Math.max(0.0, Math.min(1.0, confidence)),
        agentType: this.agentType,
        ...details,
      },
    );
  }

  // =========================================================================
  // Coordination Logging
  // =========================================================================

  /**
   * Log file/resource lock acquisition
   */
  protected async logLockAcquire(
    resource: string,
    lockType: string = "exclusive",
    taskId?: string,
  ): Promise<string> {
    return this.transcript.write({
      entryType: "lock_acquire",
      category: "coordination",
      taskId: taskId || this.currentTaskId,
      summary: `Lock acquired: ${resource}`,
      details: {
        resource,
        lockType,
        agentType: this.agentType,
      },
    });
  }

  /**
   * Log file/resource lock release
   */
  protected async logLockRelease(
    resource: string,
    taskId?: string,
  ): Promise<string> {
    return this.transcript.write({
      entryType: "lock_release",
      category: "coordination",
      taskId: taskId || this.currentTaskId,
      summary: `Lock released: ${resource}`,
      details: {
        resource,
        agentType: this.agentType,
      },
    });
  }

  /**
   * Log checkpoint creation
   */
  protected async logCheckpoint(
    checkpointId: string,
    taskId?: string,
    details?: Record<string, unknown>,
  ): Promise<string> {
    return this.transcript.writeCheckpoint(
      checkpointId,
      taskId || this.currentTaskId,
      {
        agentType: this.agentType,
        ...details,
      },
    );
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  /**
   * Close and cleanup resources
   */
  async close(): Promise<void> {
    // TranscriptWriter, ToolUseLogger, AssertionRecorder don't need explicit cleanup
    // since they use the shared db connection
  }
}

export default ObservableAgent;
