# Pipeline Orchestration: The Critical Integration Layer

> **Status:** 🔴 Critical Gap
> **Priority:** Highest — This is the main blocker for E2E flow
> **Estimated Effort:** 1 week

---

## The Problem

Individual agents work, but there's no system to:

1. **Detect** when one phase is complete
2. **Trigger** transition to the next phase
3. **Pass context** between phases
4. **Handle failures** in transitions
5. **Allow manual override** when needed

### Current State

```
Ideation Agent → [MANUAL GAP] → Spec Agent → [MANUAL GAP] → Build Agent

User must:
1. Recognize ideation is "done" (no signal)
2. Manually trigger spec generation (no button)
3. Wait and hope (no status)
4. Manually trigger build (no connection)
```

### Target State

```
Ideation Agent → [AUTO] → Spec Agent → [AUTO] → Build Agent
                   ↑           ↑           ↑
            Orchestrator manages all transitions
            User is notified and can override
```

---

## Part 1: Pipeline State Machine

### 1.1 Idea Lifecycle States

```typescript
// types/pipeline.ts

export type IdeaPhase =
  | "ideation" // Initial conversation
  | "ideation_ready" // Sufficient for spec generation
  | "specification" // Spec agent active
  | "spec_ready" // Spec complete, ready for build
  | "building" // Build agent active
  | "build_review" // Human review needed
  | "deployed" // App is live
  | "paused" // User paused progress
  | "failed"; // Unrecoverable error

export interface IdeaState {
  ideaId: string;
  currentPhase: IdeaPhase;
  previousPhase: IdeaPhase | null;

  // Phase-specific progress
  ideationProgress: IdeationProgress;
  specProgress: SpecProgress | null;
  buildProgress: BuildProgress | null;

  // Transition metadata
  lastTransition: Date | null;
  transitionReason: string | null;

  // Control flags
  autoAdvance: boolean; // User preference
  humanReviewRequired: boolean;
}

export interface IdeationProgress {
  completionScore: number; // 0-1, how "complete" is the idea
  blockerCount: number; // Questions that need answers
  confidenceScore: number; // AI confidence in understanding
  keyMilestones: {
    problemDefined: boolean;
    solutionClear: boolean;
    targetUserKnown: boolean;
    differentiationIdentified: boolean;
    technicalApproachClear: boolean;
  };
}

export interface SpecProgress {
  sectionsComplete: number;
  sectionsTotal: number;
  pendingQuestions: string[];
  generatedTasks: number;
}

export interface BuildProgress {
  tasksComplete: number;
  tasksTotal: number;
  currentTask: string | null;
  failedTasks: number;
  siaInterventions: number;
}
```

### 1.2 State Transitions

```typescript
// Valid transitions
const validTransitions: Record<IdeaPhase, IdeaPhase[]> = {
  ideation: ["ideation_ready", "paused", "failed"],
  ideation_ready: ["specification", "ideation", "paused"], // Can go back
  specification: ["spec_ready", "ideation_ready", "paused", "failed"],
  spec_ready: ["building", "specification", "paused"],
  building: ["build_review", "deployed", "paused", "failed"],
  build_review: ["building", "deployed", "paused"],
  deployed: ["building"], // Can rebuild
  paused: [
    "ideation",
    "ideation_ready",
    "specification",
    "spec_ready",
    "building",
  ],
  failed: ["ideation", "specification", "building"], // Can retry
};

export function canTransition(from: IdeaPhase, to: IdeaPhase): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}
```

---

## Part 2: Pipeline Orchestrator

### 2.1 Core Orchestrator

**File:** `server/pipeline/orchestrator.ts`

```typescript
import { EventEmitter } from "events";
import { IdeaState, IdeaPhase, canTransition } from "./types";

export class PipelineOrchestrator extends EventEmitter {
  private ideaStates: Map<string, IdeaState> = new Map();
  private transitionQueue: TransitionRequest[] = [];
  private isProcessing = false;

  constructor(
    private ideationAgent: IdeationAgent,
    private specAgent: SpecAgent,
    private buildAgent: BuildAgent,
    private siaAgent: SIAAgent,
    private db: Database,
  ) {
    super();
    this.setupListeners();
  }

  /**
   * Get current state for an idea
   */
  async getState(ideaId: string): Promise<IdeaState> {
    // Check cache first
    if (this.ideaStates.has(ideaId)) {
      return this.ideaStates.get(ideaId)!;
    }

    // Load from database
    const state = await this.loadState(ideaId);
    this.ideaStates.set(ideaId, state);
    return state;
  }

  /**
   * Request a phase transition
   */
  async requestTransition(
    ideaId: string,
    targetPhase: IdeaPhase,
    reason: string,
    force: boolean = false,
  ): Promise<TransitionResult> {
    const state = await this.getState(ideaId);

    // Validate transition
    if (!force && !canTransition(state.currentPhase, targetPhase)) {
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
    return this.executeTransition(ideaId, targetPhase, reason);
  }

  /**
   * Check if prerequisites for transition are met
   */
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

  /**
   * Execute the actual transition
   */
  private async executeTransition(
    ideaId: string,
    targetPhase: IdeaPhase,
    reason: string,
  ): Promise<TransitionResult> {
    const state = await this.getState(ideaId);
    const previousPhase = state.currentPhase;

    try {
      // Pre-transition hooks
      await this.runPreTransitionHooks(ideaId, previousPhase, targetPhase);

      // Update state
      state.previousPhase = previousPhase;
      state.currentPhase = targetPhase;
      state.lastTransition = new Date();
      state.transitionReason = reason;

      // Persist
      await this.saveState(ideaId, state);

      // Start target phase agent
      await this.startPhaseAgent(ideaId, targetPhase);

      // Emit event
      this.emit("transition", {
        ideaId,
        from: previousPhase,
        to: targetPhase,
        reason,
      });

      // Post-transition hooks
      await this.runPostTransitionHooks(ideaId, previousPhase, targetPhase);

      return { success: true };
    } catch (error) {
      // Rollback
      state.currentPhase = previousPhase;
      await this.saveState(ideaId, state);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Start the appropriate agent for a phase
   */
  private async startPhaseAgent(
    ideaId: string,
    phase: IdeaPhase,
  ): Promise<void> {
    switch (phase) {
      case "specification":
        await this.specAgent.startSession(ideaId);
        break;
      case "building":
        await this.buildAgent.startBuild(ideaId);
        break;
      // ideation is already running by default
    }
  }

  /**
   * Setup listeners for agent events
   */
  private setupListeners(): void {
    // Listen for ideation completion signals
    this.ideationAgent.on("readyForSpec", async ({ ideaId, confidence }) => {
      const state = await this.getState(ideaId);

      if (state.autoAdvance && confidence >= 0.8) {
        await this.requestTransition(
          ideaId,
          "ideation_ready",
          `Auto-transition: ideation confidence ${confidence}`,
        );
      } else {
        // Notify user that manual transition is available
        this.emit("transitionAvailable", {
          ideaId,
          from: "ideation",
          to: "ideation_ready",
          confidence,
        });
      }
    });

    // Listen for spec completion
    this.specAgent.on("specComplete", async ({ ideaId, taskCount }) => {
      const state = await this.getState(ideaId);

      if (state.autoAdvance) {
        await this.requestTransition(
          ideaId,
          "spec_ready",
          `Spec complete with ${taskCount} tasks`,
        );
      }
    });

    // Listen for build completion
    this.buildAgent.on("buildComplete", async ({ ideaId }) => {
      await this.requestTransition(ideaId, "deployed", "Build complete");
    });

    // Listen for build failures
    this.buildAgent.on("taskFailed", async ({ ideaId, taskId, attempts }) => {
      if (attempts >= 3) {
        // Trigger SIA
        await this.siaAgent.intervene(ideaId, taskId);
      }
    });
  }
}
```

### 2.2 Transition Detection

**File:** `server/pipeline/transition-detector.ts`

```typescript
/**
 * Detects when ideation is ready for spec generation
 */
export class IdeationCompletionDetector {
  constructor(private orchestrator: PipelineOrchestrator) {}

  /**
   * Analyze conversation to determine readiness
   */
  async analyzeReadiness(ideaId: string): Promise<IdeationProgress> {
    const messages = await this.loadMessages(ideaId);
    const artifacts = await this.loadArtifacts(ideaId);

    // Calculate milestones
    const milestones = {
      problemDefined: this.hasProblemStatement(artifacts),
      solutionClear: this.hasSolutionDescription(artifacts),
      targetUserKnown: this.hasTargetUser(artifacts),
      differentiationIdentified: this.hasDifferentiation(artifacts),
      technicalApproachClear: this.hasTechnicalApproach(artifacts),
    };

    // Calculate completion score
    const milestoneCount = Object.values(milestones).filter(Boolean).length;
    const completionScore = milestoneCount / 5;

    // Check for blockers (unanswered questions)
    const blockerCount = await this.countUnansweredQuestions(ideaId);

    // AI confidence in understanding
    const confidenceScore = await this.calculateAIConfidence(
      messages,
      artifacts,
    );

    return {
      completionScore,
      blockerCount,
      confidenceScore,
      keyMilestones: milestones,
    };
  }

  /**
   * Check if idea has a clear problem statement
   */
  private hasProblemStatement(artifacts: Artifact[]): boolean {
    return artifacts.some(
      (a) =>
        a.type === "problem_statement" ||
        (a.type === "brief" && a.content.includes("problem")),
    );
  }

  /**
   * Calculate AI's confidence in understanding the idea
   */
  private async calculateAIConfidence(
    messages: Message[],
    artifacts: Artifact[],
  ): Promise<number> {
    // Use LLM to assess confidence
    const prompt = `
      Based on the following conversation and extracted artifacts, 
      how confident are you (0-1) that you understand this idea well enough 
      to generate a technical specification?
      
      Conversation summary: ${this.summarize(messages)}
      
      Artifacts:
      ${artifacts.map((a) => `- ${a.type}: ${a.content.slice(0, 200)}`).join("\n")}
      
      Respond with just a number between 0 and 1.
    `;

    const response = await this.llm.complete(prompt);
    return parseFloat(response) || 0.5;
  }
}
```

---

## Part 3: Context Handoff

### 3.1 Ideation → Spec Handoff

**File:** `server/pipeline/handoffs/ideation-to-spec.ts`

```typescript
export interface IdeationToSpecHandoff {
  ideaId: string;

  // Core idea information
  problemStatement: string;
  solutionDescription: string;
  targetUsers: TargetUser[];

  // Extracted knowledge
  requirements: {
    functional: string[];
    nonFunctional: string[];
    constraints: string[];
  };

  // Context from conversation
  conversationInsights: {
    userPreferences: string[];
    explicitRequests: string[];
    concernsRaised: string[];
  };

  // Memory graph snapshot
  knowledgeGraph: {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  };
}

export async function prepareIdeationHandoff(
  ideaId: string,
): Promise<IdeationToSpecHandoff> {
  const idea = await loadIdea(ideaId);
  const artifacts = await loadArtifacts(ideaId);
  const messages = await loadMessages(ideaId);
  const graph = await loadKnowledgeGraph(ideaId);

  // Extract problem statement
  const problemArtifact = artifacts.find((a) => a.type === "problem_statement");
  const problemStatement =
    problemArtifact?.content ||
    (await extractFromMessages(messages, "problem"));

  // Extract solution
  const solutionArtifact = artifacts.find(
    (a) => a.type === "solution_description",
  );
  const solutionDescription =
    solutionArtifact?.content ||
    (await extractFromMessages(messages, "solution"));

  // Extract requirements from conversation
  const requirements = await extractRequirements(messages, artifacts);

  // Extract conversation insights
  const conversationInsights = await extractInsights(messages);

  return {
    ideaId,
    problemStatement,
    solutionDescription,
    targetUsers: idea.targetUsers || [],
    requirements,
    conversationInsights,
    knowledgeGraph: {
      nodes: graph.nodes,
      edges: graph.edges,
    },
  };
}
```

### 3.2 Spec → Build Handoff

**File:** `server/pipeline/handoffs/spec-to-build.ts`

```typescript
export interface SpecToBuildHandoff {
  ideaId: string;

  // Specification
  specification: {
    overview: string;
    features: Feature[];
    dataModel: DataModel;
    apiEndpoints: APIEndpoint[];
    uiComponents: UIComponent[];
  };

  // Generated tasks
  tasks: TaskDefinition[];

  // Execution plan
  executionPlan: {
    phases: ExecutionPhase[];
    dependencies: TaskDependency[];
    estimatedDuration: number; // minutes
  };

  // Context for build agent
  buildContext: {
    techStack: TechStack;
    codeStyle: CodeStylePreferences;
    testingRequirements: TestingConfig;
  };
}

export async function prepareSpecHandoff(
  ideaId: string,
): Promise<SpecToBuildHandoff> {
  const spec = await loadSpecification(ideaId);
  const tasks = await loadTasks(ideaId);

  // Calculate execution plan
  const executionPlan = calculateExecutionPlan(tasks);

  // Determine tech stack from spec
  const techStack = determineTechStack(spec);

  return {
    ideaId,
    specification: spec,
    tasks,
    executionPlan,
    buildContext: {
      techStack,
      codeStyle: getDefaultCodeStyle(techStack),
      testingRequirements: getDefaultTestingConfig(),
    },
  };
}
```

---

## Part 4: API Endpoints

### 4.1 Pipeline Status

**File:** `server/routes/pipeline.ts`

```typescript
import { Router } from "express";
import { orchestrator } from "../pipeline/orchestrator";

const router = Router();

/**
 * GET /api/pipeline/:ideaId/status
 * Get current pipeline state for an idea
 */
router.get("/:ideaId/status", async (req, res) => {
  const { ideaId } = req.params;

  try {
    const state = await orchestrator.getState(ideaId);
    const progress = await orchestrator.getProgressDetails(ideaId);

    res.json({
      state,
      progress,
      availableTransitions: getAvailableTransitions(state.currentPhase),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get pipeline status" });
  }
});

/**
 * POST /api/pipeline/:ideaId/transition
 * Request a phase transition
 */
router.post("/:ideaId/transition", async (req, res) => {
  const { ideaId } = req.params;
  const { targetPhase, force } = req.body;

  try {
    const result = await orchestrator.requestTransition(
      ideaId,
      targetPhase,
      "User requested transition",
      force,
    );

    if (result.success) {
      res.json({ success: true, newPhase: targetPhase });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to execute transition" });
  }
});

/**
 * POST /api/pipeline/:ideaId/pause
 * Pause pipeline progress
 */
router.post("/:ideaId/pause", async (req, res) => {
  const { ideaId } = req.params;

  await orchestrator.requestTransition(ideaId, "paused", "User paused");
  res.json({ success: true });
});

/**
 * POST /api/pipeline/:ideaId/resume
 * Resume paused pipeline
 */
router.post("/:ideaId/resume", async (req, res) => {
  const { ideaId } = req.params;
  const state = await orchestrator.getState(ideaId);

  if (state.currentPhase !== "paused") {
    return res.status(400).json({ error: "Pipeline is not paused" });
  }

  await orchestrator.requestTransition(
    ideaId,
    state.previousPhase!,
    "User resumed",
  );
  res.json({ success: true });
});

/**
 * WebSocket: /api/pipeline/:ideaId/stream
 * Real-time pipeline updates
 */
router.ws("/:ideaId/stream", (ws, req) => {
  const { ideaId } = req.params;

  const handleTransition = (event: TransitionEvent) => {
    if (event.ideaId === ideaId) {
      ws.send(JSON.stringify({ type: "transition", ...event }));
    }
  };

  const handleProgress = (event: ProgressEvent) => {
    if (event.ideaId === ideaId) {
      ws.send(JSON.stringify({ type: "progress", ...event }));
    }
  };

  orchestrator.on("transition", handleTransition);
  orchestrator.on("progress", handleProgress);

  ws.on("close", () => {
    orchestrator.off("transition", handleTransition);
    orchestrator.off("progress", handleProgress);
  });
});

export default router;
```

---

## Part 5: Frontend Integration

### 5.1 Pipeline Status Hook

**File:** `frontend/src/hooks/usePipelineStatus.ts`

```typescript
export function usePipelineStatus(ideaId: string) {
  const [state, setState] = useState<IdeaState | null>(null);
  const [progress, setProgress] = useState<ProgressDetails | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<IdeaPhase[]>(
    [],
  );

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // WebSocket for real-time updates
    const ws = new WebSocket(`/api/pipeline/${ideaId}/stream`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "transition") {
        setState((prev) => (prev ? { ...prev, currentPhase: data.to } : null));
        fetchStatus(); // Refresh full state
      }

      if (data.type === "progress") {
        setProgress(data.progress);
      }
    };

    return () => ws.close();
  }, [ideaId]);

  const requestTransition = async (targetPhase: IdeaPhase, force = false) => {
    const response = await fetch(`/api/pipeline/${ideaId}/transition`, {
      method: "POST",
      body: JSON.stringify({ targetPhase, force }),
    });
    return response.json();
  };

  const pause = () =>
    fetch(`/api/pipeline/${ideaId}/pause`, { method: "POST" });
  const resume = () =>
    fetch(`/api/pipeline/${ideaId}/resume`, { method: "POST" });

  return {
    state,
    progress,
    availableTransitions,
    requestTransition,
    pause,
    resume,
  };
}
```

### 5.2 Transition Controls Component

**File:** `frontend/src/components/TransitionControls.tsx`

```typescript
export function TransitionControls({ ideaId }: { ideaId: string }) {
  const { state, availableTransitions, requestTransition } = usePipelineStatus(ideaId);
  const [isTransitioning, setIsTransitioning] = useState(false);

  if (!state) return <Skeleton />;

  const handleTransition = async (targetPhase: IdeaPhase) => {
    setIsTransitioning(true);
    try {
      const result = await requestTransition(targetPhase);
      if (!result.success) {
        toast.error(result.error);
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Current phase badge */}
      <span className="badge badge-primary">
        {formatPhase(state.currentPhase)}
      </span>

      {/* Transition buttons */}
      {availableTransitions.map(phase => (
        <button
          key={phase}
          onClick={() => handleTransition(phase)}
          disabled={isTransitioning}
          className="btn btn-sm btn-secondary"
        >
          → {formatPhase(phase)}
        </button>
      ))}

      {/* Auto-advance toggle */}
      <label className="flex items-center gap-2 ml-4">
        <input
          type="checkbox"
          checked={state.autoAdvance}
          onChange={e => updateAutoAdvance(ideaId, e.target.checked)}
        />
        <span className="text-sm">Auto-advance</span>
      </label>
    </div>
  );
}
```

---

## Part 6: Implementation Tasks

### Task PIPE-001: Create Pipeline State Schema

**Database Migration:**

```sql
CREATE TABLE idea_pipeline_state (
  idea_id TEXT PRIMARY KEY REFERENCES ideas(id),
  current_phase TEXT NOT NULL DEFAULT 'ideation',
  previous_phase TEXT,
  last_transition TIMESTAMP,
  transition_reason TEXT,
  auto_advance BOOLEAN DEFAULT true,
  human_review_required BOOLEAN DEFAULT false,

  -- Ideation progress
  ideation_completion_score REAL DEFAULT 0,
  ideation_blocker_count INTEGER DEFAULT 0,
  ideation_confidence_score REAL DEFAULT 0,

  -- Spec progress
  spec_sections_complete INTEGER,
  spec_sections_total INTEGER,
  spec_pending_questions TEXT, -- JSON array
  spec_generated_tasks INTEGER,

  -- Build progress
  build_tasks_complete INTEGER,
  build_tasks_total INTEGER,
  build_current_task TEXT,
  build_failed_tasks INTEGER DEFAULT 0,
  build_sia_interventions INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_phase ON idea_pipeline_state(current_phase);
```

**Acceptance Criteria:**

- [ ] Migration runs successfully
- [ ] All existing ideas get default pipeline state
- [ ] Indexes created for common queries

**Test:**

```typescript
describe("Pipeline State Schema", () => {
  it("creates pipeline state for new idea", async () => {
    const idea = await createIdea({ name: "Test" });
    const state = await db.ideaPipelineState.findUnique({
      where: { ideaId: idea.id },
    });

    expect(state).toBeDefined();
    expect(state.currentPhase).toBe("ideation");
    expect(state.autoAdvance).toBe(true);
  });
});
```

---

### Task PIPE-002: Implement PipelineOrchestrator Class

**File:** `server/pipeline/orchestrator.ts`

**Acceptance Criteria:**

- [ ] Can get state for any idea
- [ ] Validates transitions before executing
- [ ] Emits events on transitions
- [ ] Handles rollback on failure

**Test:**

```typescript
describe("PipelineOrchestrator", () => {
  it("validates transitions", async () => {
    const orch = new PipelineOrchestrator(/* deps */);

    // Cannot jump from ideation to building
    const result = await orch.requestTransition("idea-1", "building", "test");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot transition");
  });

  it("executes valid transition", async () => {
    const orch = new PipelineOrchestrator(/* deps */);
    const events: any[] = [];
    orch.on("transition", (e) => events.push(e));

    // Setup: idea is in ideation_ready
    await setIdeaPhase("idea-1", "ideation_ready");

    const result = await orch.requestTransition(
      "idea-1",
      "specification",
      "test",
    );
    expect(result.success).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe("specification");
  });
});
```

---

### Task PIPE-003: Implement Ideation Completion Detector

**File:** `server/pipeline/transition-detector.ts`

**Acceptance Criteria:**

- [ ] Calculates completion score based on milestones
- [ ] Detects blocker count (unanswered questions)
- [ ] Uses LLM to assess confidence
- [ ] Returns structured progress object

**Test:**

```typescript
describe("IdeationCompletionDetector", () => {
  it("calculates completion score from milestones", async () => {
    const detector = new IdeationCompletionDetector(mockOrchestrator);

    // Setup: idea has problem, solution, and target user defined
    await createArtifact("idea-1", "problem_statement", "Users waste time...");
    await createArtifact("idea-1", "solution_description", "An app that...");
    await createArtifact("idea-1", "target_user", "Busy professionals...");

    const progress = await detector.analyzeReadiness("idea-1");

    expect(progress.keyMilestones.problemDefined).toBe(true);
    expect(progress.keyMilestones.solutionClear).toBe(true);
    expect(progress.keyMilestones.targetUserKnown).toBe(true);
    expect(progress.completionScore).toBe(0.6); // 3/5 milestones
  });
});
```

---

### Task PIPE-004: Implement Context Handoff Functions

**Files:**

- `server/pipeline/handoffs/ideation-to-spec.ts`
- `server/pipeline/handoffs/spec-to-build.ts`

**Acceptance Criteria:**

- [ ] Ideation→Spec handoff extracts all relevant context
- [ ] Spec→Build handoff includes execution plan
- [ ] Handoffs are serializable (can be logged/stored)
- [ ] Missing data handled gracefully

**Test:**

```typescript
describe("IdeationToSpecHandoff", () => {
  it("extracts problem statement from artifacts", async () => {
    await createArtifact("idea-1", "problem_statement", "Users struggle to...");

    const handoff = await prepareIdeationHandoff("idea-1");

    expect(handoff.problemStatement).toBe("Users struggle to...");
  });

  it("extracts insights from conversation", async () => {
    await createMessages("idea-1", [
      { role: "user", content: "I want it to be really fast" },
      { role: "assistant", content: "Speed is important for your users..." },
    ]);

    const handoff = await prepareIdeationHandoff("idea-1");

    expect(handoff.conversationInsights.userPreferences).toContain("fast");
  });
});
```

---

### Task PIPE-005: Create Pipeline API Routes

**File:** `server/routes/pipeline.ts`

**Acceptance Criteria:**

- [ ] GET /status returns current state and progress
- [ ] POST /transition validates and executes
- [ ] POST /pause and /resume work correctly
- [ ] WebSocket streams updates in real-time

**Test:**

```typescript
describe("Pipeline API", () => {
  it("GET /status returns full state", async () => {
    const res = await request(app)
      .get("/api/pipeline/idea-1/status")
      .expect(200);

    expect(res.body.state).toBeDefined();
    expect(res.body.state.currentPhase).toBe("ideation");
    expect(res.body.availableTransitions).toContain("ideation_ready");
  });

  it("POST /transition requires valid target", async () => {
    const res = await request(app)
      .post("/api/pipeline/idea-1/transition")
      .send({ targetPhase: "deployed" }) // Invalid from ideation
      .expect(400);

    expect(res.body.error).toContain("Cannot transition");
  });
});
```

---

### Task PIPE-006: Create Frontend Pipeline Hooks

**Files:**

- `frontend/src/hooks/usePipelineStatus.ts`
- `frontend/src/hooks/usePipelineProgress.ts`

**Acceptance Criteria:**

- [ ] usePipelineStatus returns current state
- [ ] Real-time updates via WebSocket
- [ ] Transition functions work correctly
- [ ] Loading and error states handled

**Test:**

```typescript
describe("usePipelineStatus", () => {
  it("fetches initial status", async () => {
    const { result } = renderHook(() => usePipelineStatus("idea-1"));

    await waitFor(() => {
      expect(result.current.state).toBeDefined();
    });

    expect(result.current.state?.currentPhase).toBe("ideation");
  });

  it("updates on WebSocket message", async () => {
    const { result } = renderHook(() => usePipelineStatus("idea-1"));

    // Simulate WebSocket message
    act(() => {
      mockWebSocket.emit(
        "message",
        JSON.stringify({
          type: "transition",
          ideaId: "idea-1",
          to: "ideation_ready",
        }),
      );
    });

    expect(result.current.state?.currentPhase).toBe("ideation_ready");
  });
});
```

---

## Summary

The Pipeline Orchestrator is the **critical missing piece** that connects all agents:

1. **State machine** tracks idea lifecycle
2. **Transition detection** identifies when phases are complete
3. **Context handoff** passes information between agents
4. **API/WebSocket** enables frontend integration
5. **Testing** ensures reliability

**Implementation order:**

1. PIPE-001: Database schema
2. PIPE-002: Core orchestrator
3. PIPE-003: Completion detector
4. PIPE-004: Handoff functions
5. PIPE-005: API routes
6. PIPE-006: Frontend hooks

---

_Next: [03-SPEC-AGENT-COMPLETION.md](./03-SPEC-AGENT-COMPLETION.md) — Finishing the specification agent_
