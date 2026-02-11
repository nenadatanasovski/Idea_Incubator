# Testing Criteria: Verification for All Tasks

> **Purpose:** Ensure each implementation task is properly verified
> **Principle:** A task isn't done until it passes its tests

---

## Testing Philosophy

1. **Test criteria defined BEFORE implementation**
2. **Each task has acceptance criteria**
3. **Automated tests where possible**
4. **Manual verification checklist for UI**

---

## Part 1: Pipeline Orchestration Tests

### PIPE-001: Pipeline State Schema

```typescript
describe("Pipeline State Schema", () => {
  describe("Creation", () => {
    it("creates pipeline state when idea is created", async () => {
      const idea = await createIdea({ name: "Test Idea" });
      const state = await db.ideaPipelineState.findUnique({
        where: { ideaId: idea.id },
      });

      expect(state).toBeDefined();
      expect(state.currentPhase).toBe("ideation");
      expect(state.autoAdvance).toBe(true);
    });

    it("initializes progress fields to defaults", async () => {
      const state = await createPipelineState("idea-1");

      expect(state.ideationCompletionScore).toBe(0);
      expect(state.ideationBlockerCount).toBe(0);
      expect(state.specSectionsComplete).toBeNull();
      expect(state.buildTasksComplete).toBeNull();
    });
  });

  describe("Updates", () => {
    it("tracks phase transitions", async () => {
      const state = await createPipelineState("idea-1");

      await db.ideaPipelineState.update({
        where: { ideaId: "idea-1" },
        data: {
          currentPhase: "ideation_ready",
          previousPhase: "ideation",
          lastTransition: new Date(),
          transitionReason: "Test transition",
        },
      });

      const updated = await db.ideaPipelineState.findUnique({
        where: { ideaId: "idea-1" },
      });
      expect(updated.currentPhase).toBe("ideation_ready");
      expect(updated.previousPhase).toBe("ideation");
    });
  });
});
```

### PIPE-002: Pipeline Orchestrator

```typescript
describe("PipelineOrchestrator", () => {
  describe("State Management", () => {
    it("returns current state for idea", async () => {
      await setIdeaPhase("idea-1", "ideation");

      const state = await orchestrator.getState("idea-1");

      expect(state.currentPhase).toBe("ideation");
      expect(state.ideaId).toBe("idea-1");
    });

    it("caches state in memory", async () => {
      const state1 = await orchestrator.getState("idea-1");
      const state2 = await orchestrator.getState("idea-1");

      expect(state1).toBe(state2); // Same reference
    });
  });

  describe("Transitions", () => {
    it("validates transition is allowed", async () => {
      await setIdeaPhase("idea-1", "ideation");

      // Invalid: can't jump to building
      const result = await orchestrator.requestTransition(
        "idea-1",
        "building",
        "test",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot transition");
    });

    it("executes valid transition", async () => {
      await setIdeaPhase("idea-1", "ideation_ready");

      const result = await orchestrator.requestTransition(
        "idea-1",
        "specification",
        "User requested",
      );

      expect(result.success).toBe(true);

      const state = await orchestrator.getState("idea-1");
      expect(state.currentPhase).toBe("specification");
    });

    it("emits transition event", async () => {
      const events: any[] = [];
      orchestrator.on("transition", (e) => events.push(e));

      await setIdeaPhase("idea-1", "ideation_ready");
      await orchestrator.requestTransition("idea-1", "specification", "test");

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        ideaId: "idea-1",
        from: "ideation_ready",
        to: "specification",
      });
    });

    it("rolls back on failure", async () => {
      await setIdeaPhase("idea-1", "ideation_ready");

      // Mock spec agent to throw
      specAgent.startSession.mockRejectedValue(new Error("Failed"));

      await orchestrator.requestTransition("idea-1", "specification", "test");

      const state = await orchestrator.getState("idea-1");
      expect(state.currentPhase).toBe("ideation_ready"); // Rolled back
    });
  });

  describe("Prerequisites", () => {
    it("blocks transition when prerequisites not met", async () => {
      await setIdeaPhase("idea-1", "ideation");
      await setIdeationProgress("idea-1", { completionScore: 0.3 }); // Below 0.6

      const result = await orchestrator.requestTransition(
        "idea-1",
        "ideation_ready",
        "test",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("60% minimum");
    });
  });
});
```

### PIPE-003: Completion Detector

```typescript
describe("IdeationCompletionDetector", () => {
  describe("Milestone Detection", () => {
    it("detects problem statement artifact", async () => {
      await createArtifact(
        "idea-1",
        "problem_statement",
        "Users waste time...",
      );

      const progress = await detector.analyzeReadiness("idea-1");

      expect(progress.keyMilestones.problemDefined).toBe(true);
    });

    it("detects solution from conversation", async () => {
      // No artifact, but mentioned in conversation
      await createMessages("idea-1", [
        { role: "user", content: "The solution is a mobile app" },
        { role: "assistant", content: "Great, a mobile app that..." },
      ]);

      const progress = await detector.analyzeReadiness("idea-1");

      expect(progress.keyMilestones.solutionClear).toBe(true);
    });

    it("calculates completion score from milestones", async () => {
      // 3 of 5 milestones met
      await createArtifact("idea-1", "problem_statement", "...");
      await createArtifact("idea-1", "solution_description", "...");
      await createArtifact("idea-1", "target_user", "...");

      const progress = await detector.analyzeReadiness("idea-1");

      expect(progress.completionScore).toBe(0.6); // 3/5
    });
  });

  describe("Blocker Detection", () => {
    it("counts unanswered questions", async () => {
      await createPendingQuestion("idea-1", "What is your budget?");
      await createPendingQuestion("idea-1", "Who are competitors?");

      const progress = await detector.analyzeReadiness("idea-1");

      expect(progress.blockerCount).toBe(2);
    });
  });
});
```

---

## Part 2: Specification Agent Tests

### SPEC-001: Spec Session Schema

```typescript
describe("Spec Session Schema", () => {
  it("creates session with JSON fields", async () => {
    const session = await db.specSessions.create({
      data: {
        ideaId: "idea-1",
        currentDraft: JSON.stringify({ name: "Test Spec" }),
        pendingQuestions: JSON.stringify([{ id: "q1", question: "Test?" }]),
        answeredQuestions: JSON.stringify([]),
        tasks: JSON.stringify([]),
      },
    });

    expect(session.status).toBe("active");
    expect(JSON.parse(session.currentDraft!).name).toBe("Test Spec");
  });

  it("stores and retrieves complex specs", async () => {
    const spec = {
      overview: { name: "My App", description: "Does things" },
      features: [{ id: "f1", name: "Auth", priority: "must-have" }],
      dataModel: { entities: [] },
    };

    const session = await db.specSessions.create({
      data: {
        ideaId: "idea-1",
        currentDraft: JSON.stringify(spec),
      },
    });

    const loaded = await db.specSessions.findUnique({
      where: { id: session.id },
    });
    expect(JSON.parse(loaded!.currentDraft!)).toEqual(spec);
  });
});
```

### SPEC-002: Spec Agent Core

```typescript
describe("SpecAgent", () => {
  describe("Session Start", () => {
    it("creates session with initial draft", async () => {
      const handoff = createMockHandoff({
        problemStatement: "Users need to track habits",
        solutionDescription: "A habit tracking app",
      });

      const session = await specAgent.startSession("idea-1", handoff);

      expect(session.id).toBeDefined();
      expect(session.status).toBe("active");
      expect(session.currentDraft).toBeDefined();
      expect(session.currentDraft?.overview.name).toBeTruthy();
    });

    it("identifies gaps and creates questions", async () => {
      const handoff = createMockHandoff({
        problemStatement: "Users need something",
        // Vague - should generate questions
      });

      const session = await specAgent.startSession("idea-1", handoff);

      expect(session.pendingQuestions.length).toBeGreaterThan(0);
      expect(session.status).toBe("pending_input");
    });
  });

  describe("Question Answering", () => {
    it("updates spec with answer", async () => {
      const session = await createSpecSession("idea-1", {
        pendingQuestions: [{ id: "q1", question: "What platforms?" }],
      });

      const result = await specAgent.answerQuestion(
        session.id,
        "q1",
        "iOS and Android mobile apps",
      );

      expect(result.updated).toBe(true);

      const updated = await specAgent.loadSession(session.id);
      expect(updated?.answeredQuestions).toHaveLength(1);
      expect(updated?.currentDraft?.overview).toContain("mobile");
    });

    it("transitions to active when all questions answered", async () => {
      const session = await createSpecSession("idea-1", {
        status: "pending_input",
        pendingQuestions: [{ id: "q1", question: "Last question?" }],
      });

      await specAgent.answerQuestion(session.id, "q1", "The answer");

      const updated = await specAgent.loadSession(session.id);
      expect(updated?.status).toBe("active");
      expect(updated?.pendingQuestions).toHaveLength(0);
    });
  });

  describe("Finalization", () => {
    it("generates tasks from spec", async () => {
      const session = await createSpecSession("idea-1", {
        status: "active",
        pendingQuestions: [],
        currentDraft: createMockSpec(),
      });

      const result = await specAgent.finalize(session.id);

      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0].testCriteria).toBeDefined();
    });

    it("fails if questions pending", async () => {
      const session = await createSpecSession("idea-1", {
        pendingQuestions: [{ id: "q1", question: "Unanswered?" }],
      });

      await expect(specAgent.finalize(session.id)).rejects.toThrow(
        "questions pending",
      );
    });

    it("emits specComplete event", async () => {
      const events: any[] = [];
      specAgent.on("specComplete", (e) => events.push(e));

      const session = await createSpecSession("idea-1", {
        pendingQuestions: [],
      });
      await specAgent.finalize(session.id);

      expect(events).toHaveLength(1);
      expect(events[0].ideaId).toBe("idea-1");
    });
  });
});
```

---

## Part 3: Build Agent Tests

### BUILD-002: Build Agent Loop

```typescript
describe("BuildAgent", () => {
  describe("Session Start", () => {
    it("creates session from spec handoff", async () => {
      await createSpecWithTasks("idea-1", 5);

      const session = await buildAgent.startBuild("idea-1");

      expect(session.status).toBe("active");
      expect(session.tasks).toHaveLength(5);
      expect(session.currentTaskIndex).toBe(0);
    });

    it("emits buildStarted event", async () => {
      const events: any[] = [];
      buildAgent.on("buildStarted", (e) => events.push(e));

      await buildAgent.startBuild("idea-1");

      expect(events).toHaveLength(1);
      expect(events[0].taskCount).toBeGreaterThan(0);
    });
  });

  describe("Task Execution", () => {
    it("executes tasks sequentially", async () => {
      const executionOrder: string[] = [];
      taskExecutor.execute.mockImplementation(async (task) => {
        executionOrder.push(task.id);
        return { success: true, files: [] };
      });

      await buildAgent.startBuild("idea-1");
      await waitForBuildComplete("idea-1");

      // Tasks executed in order
      expect(executionOrder).toEqual(["t1", "t2", "t3"]);
    });

    it("commits to git after each task", async () => {
      const commits: string[] = [];
      gitIntegration.commit.mockImplementation(async (_, msg) => {
        commits.push(msg);
        return "abc123";
      });

      await buildAgent.startBuild("idea-1");
      await waitForBuildComplete("idea-1");

      expect(commits).toHaveLength(3); // One per task
    });

    it("retries failed tasks up to 3 times", async () => {
      let attempts = 0;
      taskExecutor.execute.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error("Fails");
        return { success: true };
      });

      await buildAgent.startBuild("idea-1");
      await waitForBuildComplete("idea-1");

      expect(attempts).toBe(3);
    });
  });

  describe("SIA Integration", () => {
    it("triggers SIA after 3 failures", async () => {
      taskExecutor.execute.mockRejectedValue(new Error("Always fails"));

      await buildAgent.startBuild("idea-1");

      await waitFor(() => {
        expect(siaAgent.intervene).toHaveBeenCalled();
      });
    });

    it("uses modified task from SIA", async () => {
      let callCount = 0;
      taskExecutor.execute.mockImplementation(async (task) => {
        callCount++;
        if (callCount <= 3) throw new Error("Fails");
        expect(task.description).toBe("Improved description");
        return { success: true };
      });

      siaAgent.intervene.mockResolvedValue({
        type: "fixed",
        modifiedTask: { description: "Improved description" },
      });

      await buildAgent.startBuild("idea-1");
      await waitForBuildComplete("idea-1");

      expect(callCount).toBe(4); // 3 fails + 1 success
    });

    it("inserts subtasks when SIA decomposes", async () => {
      taskExecutor.execute.mockRejectedValueOnce(new Error("Too complex"));
      siaAgent.intervene.mockResolvedValue({
        type: "decomposed",
        subtasks: [
          { id: "t1-sub-1", name: "Part 1" },
          { id: "t1-sub-2", name: "Part 2" },
        ],
      });

      const session = await buildAgent.startBuild("idea-1");

      await waitFor(() => {
        const s = buildAgent.getSession(session.id);
        expect(s?.tasks.length).toBeGreaterThan(1);
      });
    });
  });

  describe("Human Escalation", () => {
    it("sets status to human_needed when SIA gives up", async () => {
      taskExecutor.execute.mockRejectedValue(new Error("Impossible"));
      siaAgent.intervene.mockResolvedValue({
        type: "escalate",
        reason: "Cannot fix",
      });

      const session = await buildAgent.startBuild("idea-1");

      await waitFor(() => {
        const s = buildAgent.getSession(session.id);
        expect(s?.status).toBe("human_needed");
      });
    });

    it("emits humanNeeded event", async () => {
      const events: any[] = [];
      buildAgent.on("humanNeeded", (e) => events.push(e));

      taskExecutor.execute.mockRejectedValue(new Error("Impossible"));
      siaAgent.intervene.mockResolvedValue({ type: "escalate" });

      await buildAgent.startBuild("idea-1");

      await waitFor(() => {
        expect(events).toHaveLength(1);
        expect(events[0].taskName).toBeDefined();
      });
    });
  });

  describe("Controls", () => {
    it("pause stops the loop", async () => {
      const session = await buildAgent.startBuild("idea-1");

      await buildAgent.pause(session.id);

      const s = buildAgent.getSession(session.id);
      expect(s?.status).toBe("paused");
    });

    it("resume continues from current task", async () => {
      const session = await buildAgent.startBuild("idea-1");
      await buildAgent.pause(session.id);

      const tasksBefore = session.completedTasks.length;

      await buildAgent.resume(session.id);
      await waitForBuildComplete("idea-1");

      const s = buildAgent.getSession(session.id);
      expect(s?.completedTasks.length).toBeGreaterThan(tasksBefore);
    });

    it("skip advances past current task", async () => {
      taskExecutor.execute.mockRejectedValue(new Error("Stuck"));
      siaAgent.intervene.mockResolvedValue({ type: "escalate" });

      const session = await buildAgent.startBuild("idea-1");

      await waitFor(() => {
        const s = buildAgent.getSession(session.id);
        return s?.status === "human_needed";
      });

      await buildAgent.skipTask(session.id);

      const s = buildAgent.getSession(session.id);
      expect(s?.failedTasks).toContain("t1");
      expect(s?.currentTaskIndex).toBe(1);
      expect(s?.status).toBe("active");
    });
  });
});
```

---

## Part 4: UI Tests

### UI-001: UnifiedLayout

```typescript
describe('UnifiedLayout', () => {
  it('renders header with all elements', () => {
    render(
      <UnifiedLayout ideaId="test" currentPhase="ideation">
        <div>Content</div>
      </UnifiedLayout>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByTestId('idea-selector')).toBeInTheDocument();
    expect(screen.getByTestId('phase-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('renders chat panel by default', () => {
    render(<UnifiedLayout ideaId="test" currentPhase="ideation"><div /></UnifiedLayout>);

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('chat-panel')).toHaveClass('w-80');
  });

  it('collapses chat panel on toggle', async () => {
    render(<UnifiedLayout ideaId="test" currentPhase="ideation"><div /></UnifiedLayout>);

    const toggle = screen.getByTestId('chat-toggle');
    await userEvent.click(toggle);

    expect(screen.getByTestId('chat-panel')).toHaveClass('w-12');
  });
});
```

### UI-002: ChatPanel

```typescript
describe('ChatPanel', () => {
  it('displays message history', () => {
    mockUseChat.mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there!' },
      ],
      sendMessage: jest.fn(),
      isStreaming: false,
    });

    render(<ChatPanel ideaId="test" expanded={true} onToggle={jest.fn()} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('shows agent activity indicator', () => {
    mockUseIdeaState.mockReturnValue({
      agentActivity: 'Extracting knowledge...',
    });

    render(<ChatPanel ideaId="test" expanded={true} onToggle={jest.fn()} />);

    expect(screen.getByText('Extracting knowledge...')).toBeInTheDocument();
  });

  it('sends message on submit', async () => {
    const sendMessage = jest.fn();
    mockUseChat.mockReturnValue({ messages: [], sendMessage, isStreaming: false });

    render(<ChatPanel ideaId="test" expanded={true} onToggle={jest.fn()} />);

    const input = screen.getByPlaceholderText(/share your thoughts/i);
    await userEvent.type(input, 'My message{enter}');

    expect(sendMessage).toHaveBeenCalledWith('My message');
  });
});
```

### Manual UI Checklist

```markdown
## UI Manual Verification Checklist

### Layout

- [ ] Header stays fixed on scroll
- [ ] Chat panel resizes smoothly
- [ ] Chat panel collapse animation works
- [ ] Mobile: chat collapses to icon
- [ ] Content area fills remaining space

### Chat Panel

- [ ] Messages display correctly
- [ ] User messages right-aligned (or styled differently)
- [ ] AI messages left-aligned
- [ ] Streaming indicator shows during response
- [ ] Auto-scroll to bottom on new message
- [ ] Agent activity banner appears when working

### Content Tabs

- [ ] Correct tabs show for each phase
- [ ] Tab switching is instant
- [ ] Tab content loads without flicker
- [ ] Scroll position preserved within tabs

### Build Progress

- [ ] Task list shows all tasks
- [ ] Current task has highlight/ring
- [ ] Completed tasks have checkmark
- [ ] Failed tasks have X
- [ ] Progress bar updates in real-time
- [ ] Live events feed scrolls
- [ ] Pause/resume buttons work
- [ ] Skip/resolve buttons appear when human_needed
```

---

## Part 5: E2E Tests

### Full Journey Test

```typescript
describe("E2E: Idea to Deployed App", () => {
  it("completes full journey", async () => {
    // 1. Start ideation
    const { ideaId } = await api.post("/api/ideation/start");

    // 2. Chat until ready
    await api.post(`/api/ideation/${ideaId}/message`, {
      message: "I want to build a habit tracker app",
    });
    await api.post(`/api/ideation/${ideaId}/message`, {
      message: "For busy professionals who want to build good habits",
    });
    // ... more messages until completion score > 60%

    // 3. Transition to spec
    await api.post(`/api/pipeline/${ideaId}/transition`, {
      targetPhase: "specification",
    });

    // 4. Answer spec questions
    const specSession = await api.get(`/api/specification/${ideaId}/session`);
    for (const q of specSession.pendingQuestions) {
      await api.post(`/api/specification/${specSession.id}/answer`, {
        questionId: q.id,
        answer: "Mobile app with React Native",
      });
    }

    // 5. Finalize spec
    await api.post(`/api/specification/${specSession.id}/finalize`);

    // 6. Start build
    await api.post(`/api/pipeline/${ideaId}/transition`, {
      targetPhase: "building",
    });

    // 7. Wait for completion (with timeout)
    await waitFor(
      async () => {
        const status = await api.get(`/api/build/${ideaId}/status`);
        return status.status === "complete";
      },
      { timeout: 300000 },
    ); // 5 minutes

    // 8. Verify deployed
    const finalState = await api.get(`/api/pipeline/${ideaId}/status`);
    expect(finalState.state.currentPhase).toBe("deployed");
  }, 600000); // 10 minute timeout
});
```

### Phase Transition Tests

```typescript
describe("E2E: Phase Transitions", () => {
  it("ideation → ideation_ready when milestones met", async () => {
    const ideaId = await setupIdeaWithMilestones();

    // Auto-transition should fire
    await waitFor(async () => {
      const state = await api.get(`/api/pipeline/${ideaId}/status`);
      return state.state.currentPhase === "ideation_ready";
    });
  });

  it("spec_ready → building starts build agent", async () => {
    const ideaId = await setupIdeaWithSpec();

    await api.post(`/api/pipeline/${ideaId}/transition`, {
      targetPhase: "building",
    });

    // Build session should exist
    const buildStatus = await api.get(`/api/build/${ideaId}/status`);
    expect(buildStatus.status).not.toBe("not_started");
  });

  it("human_needed pauses pipeline", async () => {
    const ideaId = await setupIdeaInBuild();

    // Force a task failure that SIA can't fix
    await forceTaskFailure(ideaId);

    await waitFor(async () => {
      const state = await api.get(`/api/pipeline/${ideaId}/status`);
      return state.state.humanReviewRequired === true;
    });
  });
});
```

---

## Part 6: Browser/Visual E2E Tests (Playwright)

> **Purpose:** Verify the frontend works correctly in real browsers, catch visual regressions, and test user interactions across the full application flow.

### Setup

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install

# Install dependencies for visual comparison
npm install -D pixelmatch pngjs
```

**playwright.config.ts:**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results.json" }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
```

---

### BROWSER-001: Unified Layout Visual Verification

```typescript
// e2e/layout.spec.ts
import { test, expect } from "@playwright/test";

test.describe("UnifiedLayout Visual Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ideas/test-idea");
    await page.waitForLoadState("networkidle");
  });

  test("renders complete layout structure", async ({ page }) => {
    // Header elements
    await expect(page.getByTestId("idea-selector")).toBeVisible();
    await expect(page.getByTestId("phase-indicator")).toBeVisible();
    await expect(page.getByTestId("user-menu")).toBeVisible();

    // Main content area
    await expect(page.getByTestId("main-content")).toBeVisible();

    // Chat panel
    await expect(page.getByTestId("chat-panel")).toBeVisible();
  });

  test("header remains fixed on scroll", async ({ page }) => {
    const header = page.getByRole("banner");
    const initialPosition = await header.boundingBox();

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    const afterScrollPosition = await header.boundingBox();

    expect(afterScrollPosition?.y).toBe(initialPosition?.y);
  });

  test("layout adapts to viewport sizes", async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByTestId("chat-panel")).toHaveCSS("width", "320px");

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId("chat-panel")).toBeVisible();

    // Mobile - chat should collapse
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByTestId("chat-toggle-mobile")).toBeVisible();
  });

  test("visual snapshot - ideation phase", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=ideation");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("layout-ideation.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("visual snapshot - specification phase", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=specification");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("layout-specification.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  test("visual snapshot - building phase", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=building");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("layout-building.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
```

---

### BROWSER-002: Chat Panel Interactions

```typescript
// e2e/chat-panel.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Chat Panel Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ideas/test-idea");
    await page.waitForLoadState("networkidle");
  });

  test("displays message history correctly", async ({ page }) => {
    // Mock or seed messages
    const userMessage = page
      .locator('[data-testid="message"][data-role="user"]')
      .first();
    const assistantMessage = page
      .locator('[data-testid="message"][data-role="assistant"]')
      .first();

    await expect(userMessage).toBeVisible();
    await expect(assistantMessage).toBeVisible();
  });

  test("sends message on Enter key", async ({ page }) => {
    const input = page.getByPlaceholder(/share your thoughts|type a message/i);
    const testMessage = "This is a test message";

    await input.fill(testMessage);
    await input.press("Enter");

    // Wait for message to appear in chat
    await expect(page.locator('[data-testid="message"]').last()).toContainText(
      testMessage,
    );
  });

  test("sends message on button click", async ({ page }) => {
    const input = page.getByPlaceholder(/share your thoughts|type a message/i);
    const sendButton = page.getByTestId("send-button");

    await input.fill("Button send test");
    await sendButton.click();

    await expect(page.locator('[data-testid="message"]').last()).toContainText(
      "Button send test",
    );
  });

  test("shows streaming indicator during AI response", async ({ page }) => {
    const input = page.getByPlaceholder(/share your thoughts|type a message/i);

    await input.fill("Tell me something");
    await input.press("Enter");

    // Streaming indicator should appear
    await expect(page.getByTestId("streaming-indicator")).toBeVisible();

    // Wait for response to complete
    await expect(page.getByTestId("streaming-indicator")).not.toBeVisible({
      timeout: 30000,
    });
  });

  test("auto-scrolls to new messages", async ({ page }) => {
    const chatContainer = page.getByTestId("chat-messages");
    const input = page.getByPlaceholder(/share your thoughts|type a message/i);

    // Send several messages to create scroll
    for (let i = 0; i < 5; i++) {
      await input.fill(`Test message ${i}`);
      await input.press("Enter");
      await page.waitForTimeout(500);
    }

    // Check if scrolled to bottom
    const isScrolledToBottom = await chatContainer.evaluate((el) => {
      return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 10;
    });

    expect(isScrolledToBottom).toBe(true);
  });

  test("collapses and expands panel", async ({ page }) => {
    const chatPanel = page.getByTestId("chat-panel");
    const toggleButton = page.getByTestId("chat-toggle");

    // Initially expanded
    await expect(chatPanel).toHaveAttribute("data-expanded", "true");

    // Collapse
    await toggleButton.click();
    await expect(chatPanel).toHaveAttribute("data-expanded", "false");

    // Expand again
    await toggleButton.click();
    await expect(chatPanel).toHaveAttribute("data-expanded", "true");
  });

  test("shows agent activity indicator", async ({ page }) => {
    // Trigger an action that causes agent activity
    const input = page.getByPlaceholder(/share your thoughts|type a message/i);
    await input.fill("Analyze this idea deeply");
    await input.press("Enter");

    // Activity indicator should appear
    const activityIndicator = page.getByTestId("agent-activity");
    await expect(activityIndicator).toBeVisible({ timeout: 5000 });
    await expect(activityIndicator).toContainText(
      /analyzing|processing|thinking/i,
    );
  });

  test("preserves input on failed send", async ({ page }) => {
    // Intercept and fail the API call
    await page.route("**/api/chat/**", (route) => {
      route.fulfill({ status: 500, body: "Server Error" });
    });

    const input = page.getByPlaceholder(/share your thoughts|type a message/i);
    await input.fill("This should not be lost");
    await input.press("Enter");

    // Input should retain the text
    await expect(input).toHaveValue("This should not be lost");

    // Error toast/message should appear
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
```

---

### BROWSER-003: Phase Transitions in the UI

```typescript
// e2e/phase-transitions.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Phase Transitions in the UI", () => {
  test("displays correct phase indicator", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=ideation");
    await page.waitForLoadState("networkidle");

    const phaseIndicator = page.getByTestId("phase-indicator");
    await expect(phaseIndicator).toContainText(/ideation/i);
    await expect(phaseIndicator).toHaveAttribute("data-phase", "ideation");
  });

  test("shows phase progress visually", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=specification");
    await page.waitForLoadState("networkidle");

    // Progress steps should show ideation complete, spec active
    const progressSteps = page.getByTestId("phase-progress");
    await expect(progressSteps.locator('[data-step="ideation"]')).toHaveClass(
      /complete/,
    );
    await expect(
      progressSteps.locator('[data-step="specification"]'),
    ).toHaveClass(/active/);
    await expect(progressSteps.locator('[data-step="building"]')).toHaveClass(
      /pending/,
    );
  });

  test("transitions between phases with animation", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=ideation_ready");
    await page.waitForLoadState("networkidle");

    // Click transition button
    const advanceButton = page.getByTestId("advance-phase-btn");
    await advanceButton.click();

    // Confirm dialog
    const confirmButton = page.getByRole("button", {
      name: /confirm|proceed/i,
    });
    await confirmButton.click();

    // Wait for transition animation
    await expect(page.getByTestId("phase-transition-overlay")).toBeVisible();
    await expect(page.getByTestId("phase-transition-overlay")).not.toBeVisible({
      timeout: 5000,
    });

    // Verify new phase
    await expect(page.getByTestId("phase-indicator")).toContainText(
      /specification/i,
    );
  });

  test("shows phase-specific content tabs", async ({ page }) => {
    // Ideation phase tabs
    await page.goto("/ideas/test-idea?phase=ideation");
    await expect(page.getByRole("tab", { name: /chat/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /knowledge/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /artifacts/i })).toBeVisible();

    // Specification phase tabs
    await page.goto("/ideas/test-idea?phase=specification");
    await expect(page.getByRole("tab", { name: /draft/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /questions/i })).toBeVisible();

    // Building phase tabs
    await page.goto("/ideas/test-idea?phase=building");
    await expect(page.getByRole("tab", { name: /progress/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /code/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /preview/i })).toBeVisible();
  });

  test("blocks invalid phase transitions", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=ideation");
    await page.waitForLoadState("networkidle");

    // Try to access building phase (should redirect or show error)
    await page.goto("/ideas/test-idea?phase=building");

    // Should redirect back or show error
    await expect(page.getByTestId("phase-error"))
      .toBeVisible()
      .catch(async () => {
        // Or redirected back
        await expect(page).toHaveURL(/phase=ideation/);
      });
  });

  test("real-time phase updates via WebSocket", async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=ideation");
    await page.waitForLoadState("networkidle");

    // Simulate backend phase change (via API or test helper)
    await page.evaluate(async () => {
      // Emit a mock WebSocket event
      window.dispatchEvent(
        new CustomEvent("phase-update", {
          detail: { phase: "ideation_ready" },
        }),
      );
    });

    // UI should update without refresh
    await expect(page.getByTestId("phase-indicator")).toContainText(/ready/i, {
      timeout: 5000,
    });
  });
});
```

---

### BROWSER-004: Memory Graph Rendering

```typescript
// e2e/memory-graph.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Memory Graph Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ideas/test-idea?tab=knowledge");
    await page.waitForLoadState("networkidle");
  });

  test("renders graph canvas", async ({ page }) => {
    const canvas = page.locator('canvas[data-testid="memory-graph"]');
    await expect(canvas).toBeVisible();

    // Canvas should have content (non-empty)
    const hasContent = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext("2d");
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, el.width, el.height).data;
      return data.some((value, i) => i % 4 !== 3 && value !== 0);
    });

    expect(hasContent).toBe(true);
  });

  test("displays nodes for knowledge items", async ({ page }) => {
    // Wait for graph to render
    await page.waitForFunction(
      () => {
        const graph = (window as any).__memoryGraph;
        return graph && graph.nodes.length > 0;
      },
      { timeout: 10000 },
    );

    // Check node count matches data
    const nodeCount = await page.evaluate(() => {
      return (window as any).__memoryGraph.nodes.length;
    });

    expect(nodeCount).toBeGreaterThan(0);
  });

  test("shows node details on hover", async ({ page }) => {
    const canvas = page.locator('canvas[data-testid="memory-graph"]');
    const bounds = await canvas.boundingBox();

    if (!bounds) throw new Error("Canvas not found");

    // Hover near center (where nodes likely are)
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );

    // Tooltip should appear
    await expect(page.getByTestId("graph-tooltip")).toBeVisible({
      timeout: 3000,
    });
  });

  test("zooms with mouse wheel", async ({ page }) => {
    const canvas = page.locator('canvas[data-testid="memory-graph"]');

    const initialZoom = await page.evaluate(() => {
      return (window as any).__memoryGraph.zoom;
    });

    await canvas.hover();
    await page.mouse.wheel(0, -100); // Zoom in

    const newZoom = await page.evaluate(() => {
      return (window as any).__memoryGraph.zoom;
    });

    expect(newZoom).toBeGreaterThan(initialZoom);
  });

  test("pans with drag", async ({ page }) => {
    const canvas = page.locator('canvas[data-testid="memory-graph"]');
    const bounds = await canvas.boundingBox();

    if (!bounds) throw new Error("Canvas not found");

    const initialOffset = await page.evaluate(() => {
      const g = (window as any).__memoryGraph;
      return { x: g.offsetX, y: g.offsetY };
    });

    // Drag across canvas
    await page.mouse.move(bounds.x + 100, bounds.y + 100);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 200);
    await page.mouse.up();

    const newOffset = await page.evaluate(() => {
      const g = (window as any).__memoryGraph;
      return { x: g.offsetX, y: g.offsetY };
    });

    expect(newOffset.x).not.toBe(initialOffset.x);
    expect(newOffset.y).not.toBe(initialOffset.y);
  });

  test("highlights connected nodes on selection", async ({ page }) => {
    const canvas = page.locator('canvas[data-testid="memory-graph"]');
    const bounds = await canvas.boundingBox();

    if (!bounds) throw new Error("Canvas not found");

    // Click on a node (center of canvas)
    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );

    // Selected node info panel should appear
    await expect(page.getByTestId("node-details-panel")).toBeVisible({
      timeout: 3000,
    });
  });

  test("visual snapshot - graph layout", async ({ page }) => {
    // Wait for graph to stabilize
    await page.waitForTimeout(2000);

    await expect(
      page.locator('[data-testid="memory-graph-container"]'),
    ).toHaveScreenshot("memory-graph.png", {
      animations: "disabled",
    });
  });

  test("handles empty graph gracefully", async ({ page }) => {
    await page.goto("/ideas/empty-idea?tab=knowledge");
    await page.waitForLoadState("networkidle");

    // Should show empty state, not error
    await expect(page.getByTestId("graph-empty-state")).toBeVisible();
    await expect(page.getByText(/no knowledge.*yet/i)).toBeVisible();
  });
});
```

---

### BROWSER-005: Build Progress Display

```typescript
// e2e/build-progress.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Build Progress Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ideas/test-idea?phase=building");
    await page.waitForLoadState("networkidle");
  });

  test("displays task list with correct statuses", async ({ page }) => {
    const taskList = page.getByTestId("build-task-list");
    await expect(taskList).toBeVisible();

    // Check for different task states
    await expect(
      taskList.locator('[data-status="completed"]').first(),
    ).toBeVisible();
    await expect(taskList.locator('[data-status="in_progress"]')).toHaveCount(
      1,
    );
    await expect(
      taskList.locator('[data-status="pending"]').first(),
    ).toBeVisible();
  });

  test("highlights current task", async ({ page }) => {
    const currentTask = page.locator('[data-status="in_progress"]');

    await expect(currentTask).toHaveClass(/ring-2|border-2|highlight/);
    await expect(currentTask).toBeVisible();
  });

  test("shows task completion checkmarks", async ({ page }) => {
    const completedTasks = page.locator('[data-status="completed"]');
    const count = await completedTasks.count();

    for (let i = 0; i < count; i++) {
      const checkmark = completedTasks
        .nth(i)
        .locator('[data-testid="checkmark"]');
      await expect(checkmark).toBeVisible();
    }
  });

  test("shows failed task indicators", async ({ page }) => {
    // Navigate to idea with failed task
    await page.goto("/ideas/failing-idea?phase=building");

    const failedTask = page.locator('[data-status="failed"]');
    await expect(failedTask.locator('[data-testid="fail-icon"]')).toBeVisible();
    await expect(failedTask).toHaveClass(/text-red|bg-red/);
  });

  test("updates progress bar in real-time", async ({ page }) => {
    const progressBar = page.getByTestId("build-progress-bar");
    const initialWidth = await progressBar.evaluate((el) => {
      return parseFloat(getComputedStyle(el).width);
    });

    // Wait for task to complete (or mock)
    await page.waitForTimeout(5000);

    const newWidth = await progressBar.evaluate((el) => {
      return parseFloat(getComputedStyle(el).width);
    });

    // Progress should have increased (or stayed same if no change)
    expect(newWidth).toBeGreaterThanOrEqual(initialWidth);
  });

  test("shows live event feed", async ({ page }) => {
    const eventFeed = page.getByTestId("build-event-feed");
    await expect(eventFeed).toBeVisible();

    // Should have recent events
    const events = eventFeed.locator('[data-testid="build-event"]');
    await expect(events.first()).toBeVisible();

    // Events should have timestamps
    await expect(events.first().locator("time")).toBeVisible();
  });

  test("event feed auto-scrolls to latest", async ({ page }) => {
    const eventFeed = page.getByTestId("build-event-feed");

    // Check if scrolled to bottom
    const isAtBottom = await eventFeed.evaluate((el) => {
      return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 10;
    });

    expect(isAtBottom).toBe(true);
  });

  test("pause button stops build", async ({ page }) => {
    const pauseButton = page.getByRole("button", { name: /pause/i });
    await pauseButton.click();

    // Status should change
    await expect(page.getByTestId("build-status")).toContainText(/paused/i);

    // Current task should show paused state
    await expect(page.locator('[data-status="in_progress"]')).toHaveAttribute(
      "data-paused",
      "true",
    );
  });

  test("resume button continues build", async ({ page }) => {
    // First pause
    await page.getByRole("button", { name: /pause/i }).click();
    await expect(page.getByTestId("build-status")).toContainText(/paused/i);

    // Then resume
    await page.getByRole("button", { name: /resume/i }).click();
    await expect(page.getByTestId("build-status")).toContainText(
      /running|active/i,
    );
  });

  test("shows human intervention UI when needed", async ({ page }) => {
    // Navigate to idea that needs human help
    await page.goto("/ideas/stuck-idea?phase=building");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("human-intervention-banner")).toBeVisible();
    await expect(page.getByRole("button", { name: /resolve/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /skip/i })).toBeVisible();
  });

  test("skip button advances past stuck task", async ({ page }) => {
    await page.goto("/ideas/stuck-idea?phase=building");

    const skipButton = page.getByRole("button", { name: /skip/i });
    await skipButton.click();

    // Confirm dialog
    await page.getByRole("button", { name: /confirm/i }).click();

    // Task should be marked skipped and build continues
    await expect(page.locator('[data-status="skipped"]')).toHaveCount(1);
    await expect(page.getByTestId("build-status")).toContainText(
      /running|active/i,
    );
  });

  test("visual snapshot - build in progress", async ({ page }) => {
    await expect(page.getByTestId("build-progress-container")).toHaveScreenshot(
      "build-progress.png",
      {
        animations: "disabled",
      },
    );
  });

  test("visual snapshot - build complete", async ({ page }) => {
    await page.goto("/ideas/completed-idea?phase=building");

    await expect(page.getByTestId("build-progress-container")).toHaveScreenshot(
      "build-complete.png",
      {
        animations: "disabled",
      },
    );
  });
});
```

---

### Running Browser Tests

```bash
# Run all Playwright tests
npx playwright test

# Run specific test file
npx playwright test e2e/chat-panel.spec.ts

# Run with UI mode (interactive debugging)
npx playwright test --ui

# Run in headed mode (see the browser)
npx playwright test --headed

# Run specific browser only
npx playwright test --project=chromium

# Update visual snapshots
npx playwright test --update-snapshots

# Generate HTML report
npx playwright show-report

# Debug a specific test
npx playwright test e2e/layout.spec.ts:15 --debug
```

**Add to package.json:**

```json
{
  "scripts": {
    "test:browser": "playwright test",
    "test:browser:ui": "playwright test --ui",
    "test:browser:headed": "playwright test --headed",
    "test:browser:update-snapshots": "playwright test --update-snapshots",
    "test:browser:report": "playwright show-report"
  }
}
```

---

### Vercel Preview Deployment Integration

**GitHub Actions Workflow (.github/workflows/playwright.yml):**

```yaml
name: Playwright Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  deployment_status:

jobs:
  test:
    name: Playwright Tests
    runs-on: ubuntu-latest
    if: github.event_name != 'deployment_status' || github.event.deployment_status.state == 'success'

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Determine test URL
        id: url
        run: |
          if [ "${{ github.event_name }}" = "deployment_status" ]; then
            echo "url=${{ github.event.deployment_status.target_url }}" >> $GITHUB_OUTPUT
          else
            echo "url=http://localhost:3000" >> $GITHUB_OUTPUT
          fi

      - name: Run Playwright tests
        run: npx playwright test
        env:
          PLAYWRIGHT_BASE_URL: ${{ steps.url.outputs.url }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload screenshots on failure
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-screenshots
          path: test-results/
          retention-days: 7

      - name: Comment on PR with results
        if: github.event_name == 'pull_request' && always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));

            const passed = results.suites.flatMap(s => s.specs).filter(s => s.ok).length;
            const failed = results.suites.flatMap(s => s.specs).filter(s => !s.ok).length;
            const total = passed + failed;

            const emoji = failed > 0 ? '❌' : '✅';
            const body = `## ${emoji} Playwright Test Results

            | Status | Count |
            |--------|-------|
            | ✅ Passed | ${passed} |
            | ❌ Failed | ${failed} |
            | **Total** | ${total} |

            ${failed > 0 ? '⚠️ Check the [workflow artifacts](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}) for screenshots and traces.' : ''}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

**Vercel-specific configuration (vercel.json):**

```json
{
  "github": {
    "silent": true
  },
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ]
}
```

**Wait for Vercel preview before testing:**

```yaml
# Alternative: Use vercel-action to wait for deployment
- name: Wait for Vercel Preview
  uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
  id: waitForVercel
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    max_timeout: 300

- name: Run Playwright tests against preview
  run: npx playwright test
  env:
    PLAYWRIGHT_BASE_URL: ${{ steps.waitForVercel.outputs.url }}
```

---

### Browser Test Checklist

```markdown
## Browser Test Manual Verification Checklist

### Cross-Browser

- [ ] Chrome - all tests pass
- [ ] Firefox - all tests pass
- [ ] Safari/WebKit - all tests pass
- [ ] Mobile Chrome - all tests pass
- [ ] Mobile Safari - all tests pass

### Visual Regression

- [ ] Baseline screenshots captured for each phase
- [ ] No unexpected visual changes in PR
- [ ] Dark mode variants captured (if applicable)
- [ ] Responsive breakpoints all captured

### Accessibility

- [ ] Keyboard navigation works throughout
- [ ] Screen reader announcements correct
- [ ] Focus indicators visible
- [ ] ARIA attributes present and correct

### Performance

- [ ] Pages load under 3 seconds
- [ ] Animations run at 60fps
- [ ] No layout thrashing during interactions
- [ ] Memory graph renders without freezing
```

---

## Summary

Each task has:

1. **Unit tests** — Test the component in isolation
2. **Integration tests** — Test with real dependencies
3. **API E2E tests** — Test the full user journey via API
4. **Browser E2E tests** — Test real browser interactions and visual correctness

**Test coverage targets:**

- Unit: >80%
- Integration: >60%
- API E2E: Critical paths only
- Browser E2E: All user-facing flows + visual snapshots

**Running tests:**

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# API E2E tests
npm run test:e2e

# Browser E2E tests (Playwright)
npm run test:browser            # Run all
npm run test:browser:ui         # Interactive UI mode
npm run test:browser:headed     # Watch tests run
npm run test:browser:update-snapshots  # Update visual baselines

# All tests
npm run test
```

---

_Next: [07-NETWORK-PILLAR.md](./07-NETWORK-PILLAR.md) — Future collaboration features (deferred)_
