// server/pipeline/orchestrator.ts
// Pipeline Orchestrator: Manages idea lifecycle and phase transitions

import { EventEmitter } from "events";

// Types
export type IdeaPhase =
  | "ideation"
  | "ideation_ready"
  | "specification"
  | "spec_ready"
  | "building"
  | "build_review"
  | "deployed"
  | "paused"
  | "failed";

export interface IdeaState {
  ideaId: string;
  currentPhase: IdeaPhase;
  previousPhase: IdeaPhase | null;
  lastTransition: Date | null;
  transitionReason: string | null;
  autoAdvance: boolean;
  humanReviewRequired: boolean;

  ideationProgress: IdeationProgress;
  specProgress: SpecProgress | null;
  buildProgress: BuildProgress | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface IdeationProgress {
  completionScore: number;
  blockerCount: number;
  confidenceScore: number;
  milestones: {
    problemDefined: boolean;
    solutionClear: boolean;
    targetUserKnown: boolean;
    differentiationIdentified: boolean;
    technicalApproachClear: boolean;
  };
}

export interface SpecProgress {
  sessionId: string;
  sectionsComplete: number;
  sectionsTotal: number;
  pendingQuestions: string[];
  generatedTasks: number;
}

export interface BuildProgress {
  sessionId: string;
  tasksComplete: number;
  tasksTotal: number;
  currentTask: string | null;
  failedTasks: number;
  siaInterventions: number;
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  newPhase?: IdeaPhase;
}

export interface TransitionEvent {
  ideaId: string;
  from: IdeaPhase;
  to: IdeaPhase;
  reason: string;
  triggeredBy: "auto" | "user" | "system";
}

// Valid transitions
const VALID_TRANSITIONS: Record<IdeaPhase, IdeaPhase[]> = {
  ideation: ["ideation_ready", "paused", "failed"],
  ideation_ready: ["specification", "ideation", "paused"],
  specification: ["spec_ready", "ideation_ready", "paused", "failed"],
  spec_ready: ["building", "specification", "paused"],
  building: ["build_review", "deployed", "paused", "failed"],
  build_review: ["building", "deployed", "paused"],
  deployed: ["building"],
  paused: [
    "ideation",
    "ideation_ready",
    "specification",
    "spec_ready",
    "building",
  ],
  failed: ["ideation", "specification", "building"],
};

interface Database {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface PipelineSpecBridge {
  startSession(ideaId: string, handoff: any): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
}

interface PipelineBuildBridge {
  startBuild(ideaId: string): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
}

export class PipelineOrchestrator extends EventEmitter {
  private stateCache: Map<string, IdeaState> = new Map();

  constructor(
    private db: Database,
    private specBridge?: PipelineSpecBridge,
    private buildBridge?: PipelineBuildBridge,
  ) {
    super();
    this.setupAgentListeners();
  }

  /**
   * Get current state for an idea
   */
  async getState(ideaId: string): Promise<IdeaState> {
    // Check cache
    if (this.stateCache.has(ideaId)) {
      return this.stateCache.get(ideaId)!;
    }

    // Load from database
    const state = await this.loadState(ideaId);
    this.stateCache.set(ideaId, state);
    return state;
  }

  /**
   * Request a phase transition
   */
  async requestTransition(
    ideaId: string,
    targetPhase: IdeaPhase,
    reason: string,
    triggeredBy: "auto" | "user" | "system" = "user",
    force: boolean = false,
  ): Promise<TransitionResult> {
    const state = await this.getState(ideaId);

    // Validate transition
    if (!force && !this.canTransition(state.currentPhase, targetPhase)) {
      return {
        success: false,
        error: `Cannot transition from ${state.currentPhase} to ${targetPhase}`,
      };
    }

    // Check prerequisites
    const prereqResult = await this.checkPrerequisites(state, targetPhase);
    if (!prereqResult.met) {
      return {
        success: false,
        error: `Prerequisites not met: ${prereqResult.missing.join(", ")}`,
      };
    }

    // Execute transition
    return this.executeTransition(ideaId, targetPhase, reason, triggeredBy);
  }

  /**
   * Check if a transition is valid
   */
  canTransition(from: IdeaPhase, to: IdeaPhase): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Get available transitions for current phase
   */
  getAvailableTransitions(currentPhase: IdeaPhase): IdeaPhase[] {
    return VALID_TRANSITIONS[currentPhase] || [];
  }

  /**
   * Update ideation progress
   */
  async updateIdeationProgress(
    ideaId: string,
    progress: Partial<IdeationProgress>,
  ): Promise<void> {
    const state = await this.getState(ideaId);

    state.ideationProgress = {
      ...state.ideationProgress,
      ...progress,
    };

    await this.saveState(ideaId, state);

    // Check for auto-transition
    if (state.autoAdvance && state.currentPhase === "ideation") {
      await this.checkIdeationReadiness(ideaId);
    }
  }

  /**
   * Update spec progress
   */
  async updateSpecProgress(
    ideaId: string,
    progress: Partial<SpecProgress>,
  ): Promise<void> {
    const state = await this.getState(ideaId);

    state.specProgress = {
      ...state.specProgress,
      ...progress,
    } as SpecProgress;

    await this.saveState(ideaId, state);
  }

  /**
   * Update build progress
   */
  async updateBuildProgress(
    ideaId: string,
    progress: Partial<BuildProgress>,
  ): Promise<void> {
    const state = await this.getState(ideaId);

    state.buildProgress = {
      ...state.buildProgress,
      ...progress,
    } as BuildProgress;

    await this.saveState(ideaId, state);
  }

  /**
   * Pause pipeline
   */
  async pause(ideaId: string): Promise<TransitionResult> {
    return this.requestTransition(ideaId, "paused", "User paused", "user");
  }

  /**
   * Resume from pause
   */
  async resume(ideaId: string): Promise<TransitionResult> {
    const state = await this.getState(ideaId);

    if (state.currentPhase !== "paused") {
      return { success: false, error: "Pipeline is not paused" };
    }

    if (!state.previousPhase) {
      return { success: false, error: "No previous phase to resume to" };
    }

    return this.requestTransition(
      ideaId,
      state.previousPhase,
      "User resumed",
      "user",
    );
  }

  /**
   * Rollback to a previous phase after failure
   * This is a force transition that skips prerequisite checks
   */
  async rollback(
    ideaId: string,
    reason: string = "Rollback after failure",
  ): Promise<TransitionResult> {
    const state = await this.getState(ideaId);

    // Determine rollback target based on current phase
    const rollbackTargets: Partial<Record<IdeaPhase, IdeaPhase>> = {
      specification: "ideation_ready",
      spec_ready: "specification",
      building: "spec_ready",
      build_review: "building",
      failed: state.previousPhase || "ideation",
    };

    const targetPhase = rollbackTargets[state.currentPhase];

    if (!targetPhase) {
      return {
        success: false,
        error: `Cannot rollback from phase: ${state.currentPhase}`,
      };
    }

    // Clear phase-specific progress when rolling back
    if (targetPhase === "ideation_ready" || targetPhase === "ideation") {
      state.specProgress = null;
      state.buildProgress = null;
    } else if (
      targetPhase === "specification" ||
      targetPhase === "spec_ready"
    ) {
      state.buildProgress = null;
    }

    return this.requestTransition(ideaId, targetPhase, reason, "system", true);
  }

  /**
   * Mark a pipeline as failed
   */
  async markFailed(ideaId: string, error: string): Promise<TransitionResult> {
    return this.requestTransition(
      ideaId,
      "failed",
      `Failed: ${error}`,
      "system",
      true,
    );
  }

  /**
   * Retry from current phase (clears progress and restarts)
   */
  async retry(ideaId: string): Promise<TransitionResult> {
    const state = await this.getState(ideaId);

    // Can only retry from failed or certain phases
    if (state.currentPhase === "failed") {
      const targetPhase = state.previousPhase || "ideation";
      return this.requestTransition(
        ideaId,
        targetPhase,
        "Retrying from failure",
        "user",
      );
    }

    // For other phases, restart the current phase
    const restartPhases: IdeaPhase[] = ["specification", "building"];
    if (restartPhases.includes(state.currentPhase)) {
      // Clear progress for current phase
      if (state.currentPhase === "specification") {
        state.specProgress = null;
      } else if (state.currentPhase === "building") {
        state.buildProgress = null;
      }
      await this.saveState(ideaId, state);

      // Re-start the phase agent
      await this.startPhaseAgent(ideaId, state.currentPhase);

      return { success: true, newPhase: state.currentPhase };
    }

    return {
      success: false,
      error: `Cannot retry from phase: ${state.currentPhase}`,
    };
  }

  // Private methods

  private async loadState(ideaId: string): Promise<IdeaState> {
    const row = await this.db.get<{
      idea_id: string;
      current_phase: string;
      previous_phase: string | null;
      last_transition: string | null;
      transition_reason: string | null;
      auto_advance: number;
      human_review_required: number;
      ideation_completion_score: number;
      ideation_blocker_count: number;
      ideation_confidence_score: number;
      ideation_milestones: string | null;
      spec_session_id: string | null;
      spec_sections_complete: number | null;
      spec_sections_total: number | null;
      spec_pending_questions: string | null;
      spec_generated_tasks: number | null;
      build_session_id: string | null;
      build_tasks_complete: number | null;
      build_tasks_total: number | null;
      build_current_task: string | null;
      build_failed_tasks: number;
      build_sia_interventions: number;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM idea_pipeline_state WHERE idea_id = ?", [ideaId]);

    if (!row) {
      // Create default state
      return this.createDefaultState(ideaId);
    }

    const milestones = row.ideation_milestones
      ? JSON.parse(row.ideation_milestones)
      : {
          problemDefined: false,
          solutionClear: false,
          targetUserKnown: false,
          differentiationIdentified: false,
          technicalApproachClear: false,
        };

    return {
      ideaId: row.idea_id,
      currentPhase: row.current_phase as IdeaPhase,
      previousPhase: row.previous_phase as IdeaPhase | null,
      lastTransition: row.last_transition
        ? new Date(row.last_transition)
        : null,
      transitionReason: row.transition_reason,
      autoAdvance: row.auto_advance === 1,
      humanReviewRequired: row.human_review_required === 1,

      ideationProgress: {
        completionScore: row.ideation_completion_score,
        blockerCount: row.ideation_blocker_count,
        confidenceScore: row.ideation_confidence_score,
        milestones,
      },

      specProgress: row.spec_session_id
        ? {
            sessionId: row.spec_session_id,
            sectionsComplete: row.spec_sections_complete || 0,
            sectionsTotal: row.spec_sections_total || 0,
            pendingQuestions: row.spec_pending_questions
              ? JSON.parse(row.spec_pending_questions)
              : [],
            generatedTasks: row.spec_generated_tasks || 0,
          }
        : null,

      buildProgress: row.build_session_id
        ? {
            sessionId: row.build_session_id,
            tasksComplete: row.build_tasks_complete || 0,
            tasksTotal: row.build_tasks_total || 0,
            currentTask: row.build_current_task,
            failedTasks: row.build_failed_tasks,
            siaInterventions: row.build_sia_interventions,
          }
        : null,

      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async createDefaultState(ideaId: string): Promise<IdeaState> {
    const now = new Date();

    await this.db.run(
      "INSERT INTO idea_pipeline_state (idea_id, created_at, updated_at) VALUES (?, ?, ?)",
      [ideaId, now.toISOString(), now.toISOString()],
    );

    return {
      ideaId,
      currentPhase: "ideation",
      previousPhase: null,
      lastTransition: null,
      transitionReason: null,
      autoAdvance: true,
      humanReviewRequired: false,
      ideationProgress: {
        completionScore: 0,
        blockerCount: 0,
        confidenceScore: 0,
        milestones: {
          problemDefined: false,
          solutionClear: false,
          targetUserKnown: false,
          differentiationIdentified: false,
          technicalApproachClear: false,
        },
      },
      specProgress: null,
      buildProgress: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async saveState(ideaId: string, state: IdeaState): Promise<void> {
    const now = new Date();
    state.updatedAt = now;

    await this.db.run(
      `
      UPDATE idea_pipeline_state SET
        current_phase = ?,
        previous_phase = ?,
        last_transition = ?,
        transition_reason = ?,
        auto_advance = ?,
        human_review_required = ?,
        ideation_completion_score = ?,
        ideation_blocker_count = ?,
        ideation_confidence_score = ?,
        ideation_milestones = ?,
        spec_session_id = ?,
        spec_sections_complete = ?,
        spec_sections_total = ?,
        spec_pending_questions = ?,
        spec_generated_tasks = ?,
        build_session_id = ?,
        build_tasks_complete = ?,
        build_tasks_total = ?,
        build_current_task = ?,
        build_failed_tasks = ?,
        build_sia_interventions = ?,
        updated_at = ?
      WHERE idea_id = ?
    `,
      [
        state.currentPhase,
        state.previousPhase,
        state.lastTransition?.toISOString() || null,
        state.transitionReason,
        state.autoAdvance ? 1 : 0,
        state.humanReviewRequired ? 1 : 0,
        state.ideationProgress.completionScore,
        state.ideationProgress.blockerCount,
        state.ideationProgress.confidenceScore,
        JSON.stringify(state.ideationProgress.milestones),
        state.specProgress?.sessionId || null,
        state.specProgress?.sectionsComplete || null,
        state.specProgress?.sectionsTotal || null,
        state.specProgress?.pendingQuestions
          ? JSON.stringify(state.specProgress.pendingQuestions)
          : null,
        state.specProgress?.generatedTasks || null,
        state.buildProgress?.sessionId || null,
        state.buildProgress?.tasksComplete || null,
        state.buildProgress?.tasksTotal || null,
        state.buildProgress?.currentTask || null,
        state.buildProgress?.failedTasks || 0,
        state.buildProgress?.siaInterventions || 0,
        now.toISOString(),
        ideaId,
      ],
    );

    // Update cache
    this.stateCache.set(ideaId, state);
  }

  private async checkPrerequisites(
    state: IdeaState,
    targetPhase: IdeaPhase,
  ): Promise<{ met: boolean; missing: string[] }> {
    const missing: string[] = [];

    switch (targetPhase) {
      case "ideation_ready":
        if (state.ideationProgress.completionScore < 0.6) {
          missing.push("Idea needs more development (60% minimum)");
        }
        if (state.ideationProgress.blockerCount > 2) {
          missing.push("Too many unanswered questions");
        }
        break;

      case "specification":
        if (state.currentPhase !== "ideation_ready") {
          missing.push("Idea must be in ideation_ready state");
        }
        break;

      case "spec_ready":
        if (!state.specProgress) {
          missing.push("Spec not started");
        } else if (state.specProgress.pendingQuestions.length > 0) {
          missing.push("Spec has pending questions");
        }
        break;

      case "building":
        if (!state.specProgress || state.specProgress.generatedTasks === 0) {
          missing.push("No tasks generated from spec");
        }
        break;
    }

    return { met: missing.length === 0, missing };
  }

  private async executeTransition(
    ideaId: string,
    targetPhase: IdeaPhase,
    reason: string,
    triggeredBy: "auto" | "user" | "system",
  ): Promise<TransitionResult> {
    const state = await this.getState(ideaId);
    const previousPhase = state.currentPhase;

    try {
      // Run pre-transition hooks
      await this.runPreTransitionHooks(ideaId, previousPhase, targetPhase);

      // Update state
      state.previousPhase = previousPhase;
      state.currentPhase = targetPhase;
      state.lastTransition = new Date();
      state.transitionReason = reason;

      // Save state
      await this.saveState(ideaId, state);

      // Log transition
      await this.logTransition(
        ideaId,
        previousPhase,
        targetPhase,
        reason,
        triggeredBy,
        true,
      );

      // Start target phase agent
      await this.startPhaseAgent(ideaId, targetPhase);

      // Emit event
      const event: TransitionEvent = {
        ideaId,
        from: previousPhase,
        to: targetPhase,
        reason,
        triggeredBy,
      };
      this.emit("transition", event);

      // Run post-transition hooks
      await this.runPostTransitionHooks(ideaId, previousPhase, targetPhase);

      return { success: true, newPhase: targetPhase };
    } catch (error) {
      // Rollback
      state.currentPhase = previousPhase;
      await this.saveState(ideaId, state);

      // Log failed transition
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await this.logTransition(
        ideaId,
        previousPhase,
        targetPhase,
        reason,
        triggeredBy,
        false,
        errorMsg,
      );

      return { success: false, error: errorMsg };
    }
  }

  private async startPhaseAgent(
    ideaId: string,
    phase: IdeaPhase,
  ): Promise<void> {
    switch (phase) {
      case "specification":
        if (this.specBridge) {
          const handoff = await this.prepareIdeationHandoff(ideaId);
          await this.specBridge.startSession(ideaId, handoff);
        }
        break;

      case "building":
        if (this.buildBridge) {
          await this.buildBridge.startBuild(ideaId);
        }
        break;
    }
  }

  private async prepareIdeationHandoff(ideaId: string): Promise<any> {
    // Load artifacts and messages from ideation
    const artifacts = await this.db.all<{
      type: string;
      content: string;
    }>("SELECT type, content FROM ideation_artifacts WHERE idea_id = ?", [
      ideaId,
    ]);

    const messages = await this.db.all<{
      role: string;
      content: string;
    }>(
      "SELECT m.role, m.content FROM ideation_messages m JOIN ideation_sessions s ON m.session_id = s.id WHERE s.idea_id = ? ORDER BY m.created_at",
      [ideaId],
    );

    // Extract key information
    const problemArtifact = artifacts.find(
      (a) => a.type === "problem_statement",
    );
    const solutionArtifact = artifacts.find(
      (a) => a.type === "solution_description",
    );
    const targetUserArtifact = artifacts.find((a) => a.type === "target_user");

    return {
      ideaId,
      problemStatement: problemArtifact?.content || "",
      solutionDescription: solutionArtifact?.content || "",
      targetUsers: targetUserArtifact?.content || "",
      artifacts: artifacts.map((a) => ({ type: a.type, content: a.content })),
      conversationSummary: this.summarizeConversation(messages),
    };
  }

  private summarizeConversation(
    messages: { role: string; content: string }[],
  ): string {
    // Simple summary - take last few messages
    const recent = messages.slice(-10);
    return recent
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");
  }

  private async logTransition(
    ideaId: string,
    fromPhase: IdeaPhase,
    toPhase: IdeaPhase,
    reason: string,
    triggeredBy: string,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    await this.db.run(
      `
      INSERT INTO pipeline_transitions 
      (idea_id, from_phase, to_phase, reason, triggered_by, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        ideaId,
        fromPhase,
        toPhase,
        reason,
        triggeredBy,
        success ? 1 : 0,
        errorMessage || null,
      ],
    );
  }

  private async runPreTransitionHooks(
    ideaId: string,
    from: IdeaPhase,
    to: IdeaPhase,
  ): Promise<void> {
    // Emit pre-transition event for any listeners
    this.emit("preTransition", { ideaId, from, to });
  }

  private async runPostTransitionHooks(
    ideaId: string,
    from: IdeaPhase,
    to: IdeaPhase,
  ): Promise<void> {
    // Emit post-transition event for any listeners
    this.emit("postTransition", { ideaId, from, to });
  }

  private async checkIdeationReadiness(ideaId: string): Promise<void> {
    const state = await this.getState(ideaId);

    // Check if ready
    const { completionScore, confidenceScore } = state.ideationProgress;

    if (completionScore >= 0.6 && confidenceScore >= 0.7) {
      // Emit event for potential auto-transition
      this.emit("transitionAvailable", {
        ideaId,
        from: "ideation",
        to: "ideation_ready",
        confidence: confidenceScore,
      });

      // Auto-transition if enabled
      if (state.autoAdvance) {
        await this.requestTransition(
          ideaId,
          "ideation_ready",
          `Auto-transition: completion ${(completionScore * 100).toFixed(0)}%, confidence ${(confidenceScore * 100).toFixed(0)}%`,
          "auto",
        );
      }
    }
  }

  private setupAgentListeners(): void {
    // Listen for spec bridge events
    if (this.specBridge) {
      this.specBridge.on(
        "specComplete",
        async ({
          ideaId,
          taskCount,
        }: {
          ideaId: string;
          taskCount: number;
        }) => {
          const state = await this.getState(ideaId);

          await this.updateSpecProgress(ideaId, {
            generatedTasks: taskCount,
            pendingQuestions: [],
          });

          if (state.autoAdvance) {
            await this.requestTransition(
              ideaId,
              "spec_ready",
              `Spec complete with ${taskCount} tasks`,
              "auto",
            );
          }
        },
      );

      // Listen for questions that block spec generation
      this.specBridge.on(
        "questionsRequired",
        async ({ ideaId, questions }: { ideaId: string; questions: any[] }) => {
          await this.updateSpecProgress(ideaId, {
            pendingQuestions: questions.map((q: any) => q.content || q),
          });

          this.emit("specQuestionsRequired", { ideaId, questions });
        },
      );

      // Listen for spec failures
      this.specBridge.on(
        "specFailed",
        async ({ ideaId, error }: { ideaId: string; error: string }) => {
          this.emit("specFailed", { ideaId, error });
        },
      );
    }

    // Listen for build bridge events
    if (this.buildBridge) {
      this.buildBridge.on(
        "buildComplete",
        async ({ ideaId }: { ideaId: string }) => {
          await this.requestTransition(
            ideaId,
            "deployed",
            "Build complete",
            "auto",
          );
        },
      );

      this.buildBridge.on(
        "humanNeeded",
        async ({ ideaId }: { ideaId: string }) => {
          const state = await this.getState(ideaId);
          state.humanReviewRequired = true;
          await this.saveState(ideaId, state);

          this.emit("humanReviewRequired", { ideaId, phase: "building" });
        },
      );

      // Listen for build progress updates
      this.buildBridge.on(
        "buildProgress",
        async ({ ideaId, progress }: { ideaId: string; progress: any }) => {
          await this.updateBuildProgress(ideaId, {
            tasksComplete: progress.completed || 0,
            tasksTotal: progress.total || 0,
            currentTask: progress.current || null,
          });

          this.emit("buildProgress", { ideaId, progress });
        },
      );

      // Listen for build failures
      this.buildBridge.on(
        "buildFailed",
        async ({ ideaId, error }: { ideaId: string; error: string }) => {
          this.emit("buildFailed", { ideaId, error });
        },
      );
    }
  }
}

// Singleton instance
let orchestratorInstance: PipelineOrchestrator | null = null;

export function getOrchestrator(): PipelineOrchestrator {
  if (!orchestratorInstance) {
    throw new Error(
      "Orchestrator not initialized. Call initializeOrchestrator first.",
    );
  }
  return orchestratorInstance;
}

export function initializeOrchestrator(
  db: Database,
  specBridge?: PipelineSpecBridge,
  buildBridge?: PipelineBuildBridge,
): PipelineOrchestrator {
  orchestratorInstance = new PipelineOrchestrator(db, specBridge, buildBridge);
  return orchestratorInstance;
}
