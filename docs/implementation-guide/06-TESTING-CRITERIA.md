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
describe('Pipeline State Schema', () => {
  describe('Creation', () => {
    it('creates pipeline state when idea is created', async () => {
      const idea = await createIdea({ name: 'Test Idea' });
      const state = await db.ideaPipelineState.findUnique({ 
        where: { ideaId: idea.id } 
      });
      
      expect(state).toBeDefined();
      expect(state.currentPhase).toBe('ideation');
      expect(state.autoAdvance).toBe(true);
    });
    
    it('initializes progress fields to defaults', async () => {
      const state = await createPipelineState('idea-1');
      
      expect(state.ideationCompletionScore).toBe(0);
      expect(state.ideationBlockerCount).toBe(0);
      expect(state.specSectionsComplete).toBeNull();
      expect(state.buildTasksComplete).toBeNull();
    });
  });
  
  describe('Updates', () => {
    it('tracks phase transitions', async () => {
      const state = await createPipelineState('idea-1');
      
      await db.ideaPipelineState.update({
        where: { ideaId: 'idea-1' },
        data: { 
          currentPhase: 'ideation_ready',
          previousPhase: 'ideation',
          lastTransition: new Date(),
          transitionReason: 'Test transition'
        }
      });
      
      const updated = await db.ideaPipelineState.findUnique({ 
        where: { ideaId: 'idea-1' } 
      });
      expect(updated.currentPhase).toBe('ideation_ready');
      expect(updated.previousPhase).toBe('ideation');
    });
  });
});
```

### PIPE-002: Pipeline Orchestrator

```typescript
describe('PipelineOrchestrator', () => {
  describe('State Management', () => {
    it('returns current state for idea', async () => {
      await setIdeaPhase('idea-1', 'ideation');
      
      const state = await orchestrator.getState('idea-1');
      
      expect(state.currentPhase).toBe('ideation');
      expect(state.ideaId).toBe('idea-1');
    });
    
    it('caches state in memory', async () => {
      const state1 = await orchestrator.getState('idea-1');
      const state2 = await orchestrator.getState('idea-1');
      
      expect(state1).toBe(state2); // Same reference
    });
  });
  
  describe('Transitions', () => {
    it('validates transition is allowed', async () => {
      await setIdeaPhase('idea-1', 'ideation');
      
      // Invalid: can't jump to building
      const result = await orchestrator.requestTransition(
        'idea-1', 'building', 'test'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });
    
    it('executes valid transition', async () => {
      await setIdeaPhase('idea-1', 'ideation_ready');
      
      const result = await orchestrator.requestTransition(
        'idea-1', 'specification', 'User requested'
      );
      
      expect(result.success).toBe(true);
      
      const state = await orchestrator.getState('idea-1');
      expect(state.currentPhase).toBe('specification');
    });
    
    it('emits transition event', async () => {
      const events: any[] = [];
      orchestrator.on('transition', e => events.push(e));
      
      await setIdeaPhase('idea-1', 'ideation_ready');
      await orchestrator.requestTransition('idea-1', 'specification', 'test');
      
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        ideaId: 'idea-1',
        from: 'ideation_ready',
        to: 'specification'
      });
    });
    
    it('rolls back on failure', async () => {
      await setIdeaPhase('idea-1', 'ideation_ready');
      
      // Mock spec agent to throw
      specAgent.startSession.mockRejectedValue(new Error('Failed'));
      
      await orchestrator.requestTransition('idea-1', 'specification', 'test');
      
      const state = await orchestrator.getState('idea-1');
      expect(state.currentPhase).toBe('ideation_ready'); // Rolled back
    });
  });
  
  describe('Prerequisites', () => {
    it('blocks transition when prerequisites not met', async () => {
      await setIdeaPhase('idea-1', 'ideation');
      await setIdeationProgress('idea-1', { completionScore: 0.3 }); // Below 0.6
      
      const result = await orchestrator.requestTransition(
        'idea-1', 'ideation_ready', 'test'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('60% minimum');
    });
  });
});
```

### PIPE-003: Completion Detector

```typescript
describe('IdeationCompletionDetector', () => {
  describe('Milestone Detection', () => {
    it('detects problem statement artifact', async () => {
      await createArtifact('idea-1', 'problem_statement', 'Users waste time...');
      
      const progress = await detector.analyzeReadiness('idea-1');
      
      expect(progress.keyMilestones.problemDefined).toBe(true);
    });
    
    it('detects solution from conversation', async () => {
      // No artifact, but mentioned in conversation
      await createMessages('idea-1', [
        { role: 'user', content: 'The solution is a mobile app' },
        { role: 'assistant', content: 'Great, a mobile app that...' }
      ]);
      
      const progress = await detector.analyzeReadiness('idea-1');
      
      expect(progress.keyMilestones.solutionClear).toBe(true);
    });
    
    it('calculates completion score from milestones', async () => {
      // 3 of 5 milestones met
      await createArtifact('idea-1', 'problem_statement', '...');
      await createArtifact('idea-1', 'solution_description', '...');
      await createArtifact('idea-1', 'target_user', '...');
      
      const progress = await detector.analyzeReadiness('idea-1');
      
      expect(progress.completionScore).toBe(0.6); // 3/5
    });
  });
  
  describe('Blocker Detection', () => {
    it('counts unanswered questions', async () => {
      await createPendingQuestion('idea-1', 'What is your budget?');
      await createPendingQuestion('idea-1', 'Who are competitors?');
      
      const progress = await detector.analyzeReadiness('idea-1');
      
      expect(progress.blockerCount).toBe(2);
    });
  });
});
```

---

## Part 2: Specification Agent Tests

### SPEC-001: Spec Session Schema

```typescript
describe('Spec Session Schema', () => {
  it('creates session with JSON fields', async () => {
    const session = await db.specSessions.create({
      data: {
        ideaId: 'idea-1',
        currentDraft: JSON.stringify({ name: 'Test Spec' }),
        pendingQuestions: JSON.stringify([{ id: 'q1', question: 'Test?' }]),
        answeredQuestions: JSON.stringify([]),
        tasks: JSON.stringify([]),
      }
    });
    
    expect(session.status).toBe('active');
    expect(JSON.parse(session.currentDraft!).name).toBe('Test Spec');
  });
  
  it('stores and retrieves complex specs', async () => {
    const spec = {
      overview: { name: 'My App', description: 'Does things' },
      features: [{ id: 'f1', name: 'Auth', priority: 'must-have' }],
      dataModel: { entities: [] },
    };
    
    const session = await db.specSessions.create({
      data: {
        ideaId: 'idea-1',
        currentDraft: JSON.stringify(spec),
      }
    });
    
    const loaded = await db.specSessions.findUnique({ where: { id: session.id } });
    expect(JSON.parse(loaded!.currentDraft!)).toEqual(spec);
  });
});
```

### SPEC-002: Spec Agent Core

```typescript
describe('SpecAgent', () => {
  describe('Session Start', () => {
    it('creates session with initial draft', async () => {
      const handoff = createMockHandoff({
        problemStatement: 'Users need to track habits',
        solutionDescription: 'A habit tracking app',
      });
      
      const session = await specAgent.startSession('idea-1', handoff);
      
      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.currentDraft).toBeDefined();
      expect(session.currentDraft?.overview.name).toBeTruthy();
    });
    
    it('identifies gaps and creates questions', async () => {
      const handoff = createMockHandoff({
        problemStatement: 'Users need something',
        // Vague - should generate questions
      });
      
      const session = await specAgent.startSession('idea-1', handoff);
      
      expect(session.pendingQuestions.length).toBeGreaterThan(0);
      expect(session.status).toBe('pending_input');
    });
  });
  
  describe('Question Answering', () => {
    it('updates spec with answer', async () => {
      const session = await createSpecSession('idea-1', {
        pendingQuestions: [{ id: 'q1', question: 'What platforms?' }]
      });
      
      const result = await specAgent.answerQuestion(
        session.id, 'q1', 'iOS and Android mobile apps'
      );
      
      expect(result.updated).toBe(true);
      
      const updated = await specAgent.loadSession(session.id);
      expect(updated?.answeredQuestions).toHaveLength(1);
      expect(updated?.currentDraft?.overview).toContain('mobile');
    });
    
    it('transitions to active when all questions answered', async () => {
      const session = await createSpecSession('idea-1', {
        status: 'pending_input',
        pendingQuestions: [{ id: 'q1', question: 'Last question?' }]
      });
      
      await specAgent.answerQuestion(session.id, 'q1', 'The answer');
      
      const updated = await specAgent.loadSession(session.id);
      expect(updated?.status).toBe('active');
      expect(updated?.pendingQuestions).toHaveLength(0);
    });
  });
  
  describe('Finalization', () => {
    it('generates tasks from spec', async () => {
      const session = await createSpecSession('idea-1', {
        status: 'active',
        pendingQuestions: [],
        currentDraft: createMockSpec(),
      });
      
      const result = await specAgent.finalize(session.id);
      
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks[0].testCriteria).toBeDefined();
    });
    
    it('fails if questions pending', async () => {
      const session = await createSpecSession('idea-1', {
        pendingQuestions: [{ id: 'q1', question: 'Unanswered?' }]
      });
      
      await expect(specAgent.finalize(session.id))
        .rejects.toThrow('questions pending');
    });
    
    it('emits specComplete event', async () => {
      const events: any[] = [];
      specAgent.on('specComplete', e => events.push(e));
      
      const session = await createSpecSession('idea-1', { pendingQuestions: [] });
      await specAgent.finalize(session.id);
      
      expect(events).toHaveLength(1);
      expect(events[0].ideaId).toBe('idea-1');
    });
  });
});
```

---

## Part 3: Build Agent Tests

### BUILD-002: Build Agent Loop

```typescript
describe('BuildAgent', () => {
  describe('Session Start', () => {
    it('creates session from spec handoff', async () => {
      await createSpecWithTasks('idea-1', 5);
      
      const session = await buildAgent.startBuild('idea-1');
      
      expect(session.status).toBe('active');
      expect(session.tasks).toHaveLength(5);
      expect(session.currentTaskIndex).toBe(0);
    });
    
    it('emits buildStarted event', async () => {
      const events: any[] = [];
      buildAgent.on('buildStarted', e => events.push(e));
      
      await buildAgent.startBuild('idea-1');
      
      expect(events).toHaveLength(1);
      expect(events[0].taskCount).toBeGreaterThan(0);
    });
  });
  
  describe('Task Execution', () => {
    it('executes tasks sequentially', async () => {
      const executionOrder: string[] = [];
      taskExecutor.execute.mockImplementation(async (task) => {
        executionOrder.push(task.id);
        return { success: true, files: [] };
      });
      
      await buildAgent.startBuild('idea-1');
      await waitForBuildComplete('idea-1');
      
      // Tasks executed in order
      expect(executionOrder).toEqual(['t1', 't2', 't3']);
    });
    
    it('commits to git after each task', async () => {
      const commits: string[] = [];
      gitIntegration.commit.mockImplementation(async (_, msg) => {
        commits.push(msg);
        return 'abc123';
      });
      
      await buildAgent.startBuild('idea-1');
      await waitForBuildComplete('idea-1');
      
      expect(commits).toHaveLength(3); // One per task
    });
    
    it('retries failed tasks up to 3 times', async () => {
      let attempts = 0;
      taskExecutor.execute.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error('Fails');
        return { success: true };
      });
      
      await buildAgent.startBuild('idea-1');
      await waitForBuildComplete('idea-1');
      
      expect(attempts).toBe(3);
    });
  });
  
  describe('SIA Integration', () => {
    it('triggers SIA after 3 failures', async () => {
      taskExecutor.execute.mockRejectedValue(new Error('Always fails'));
      
      await buildAgent.startBuild('idea-1');
      
      await waitFor(() => {
        expect(siaAgent.intervene).toHaveBeenCalled();
      });
    });
    
    it('uses modified task from SIA', async () => {
      let callCount = 0;
      taskExecutor.execute.mockImplementation(async (task) => {
        callCount++;
        if (callCount <= 3) throw new Error('Fails');
        expect(task.description).toBe('Improved description');
        return { success: true };
      });
      
      siaAgent.intervene.mockResolvedValue({
        type: 'fixed',
        modifiedTask: { description: 'Improved description' }
      });
      
      await buildAgent.startBuild('idea-1');
      await waitForBuildComplete('idea-1');
      
      expect(callCount).toBe(4); // 3 fails + 1 success
    });
    
    it('inserts subtasks when SIA decomposes', async () => {
      taskExecutor.execute.mockRejectedValueOnce(new Error('Too complex'));
      siaAgent.intervene.mockResolvedValue({
        type: 'decomposed',
        subtasks: [
          { id: 't1-sub-1', name: 'Part 1' },
          { id: 't1-sub-2', name: 'Part 2' },
        ]
      });
      
      const session = await buildAgent.startBuild('idea-1');
      
      await waitFor(() => {
        const s = buildAgent.getSession(session.id);
        expect(s?.tasks.length).toBeGreaterThan(1);
      });
    });
  });
  
  describe('Human Escalation', () => {
    it('sets status to human_needed when SIA gives up', async () => {
      taskExecutor.execute.mockRejectedValue(new Error('Impossible'));
      siaAgent.intervene.mockResolvedValue({
        type: 'escalate',
        reason: 'Cannot fix'
      });
      
      const session = await buildAgent.startBuild('idea-1');
      
      await waitFor(() => {
        const s = buildAgent.getSession(session.id);
        expect(s?.status).toBe('human_needed');
      });
    });
    
    it('emits humanNeeded event', async () => {
      const events: any[] = [];
      buildAgent.on('humanNeeded', e => events.push(e));
      
      taskExecutor.execute.mockRejectedValue(new Error('Impossible'));
      siaAgent.intervene.mockResolvedValue({ type: 'escalate' });
      
      await buildAgent.startBuild('idea-1');
      
      await waitFor(() => {
        expect(events).toHaveLength(1);
        expect(events[0].taskName).toBeDefined();
      });
    });
  });
  
  describe('Controls', () => {
    it('pause stops the loop', async () => {
      const session = await buildAgent.startBuild('idea-1');
      
      await buildAgent.pause(session.id);
      
      const s = buildAgent.getSession(session.id);
      expect(s?.status).toBe('paused');
    });
    
    it('resume continues from current task', async () => {
      const session = await buildAgent.startBuild('idea-1');
      await buildAgent.pause(session.id);
      
      const tasksBefore = session.completedTasks.length;
      
      await buildAgent.resume(session.id);
      await waitForBuildComplete('idea-1');
      
      const s = buildAgent.getSession(session.id);
      expect(s?.completedTasks.length).toBeGreaterThan(tasksBefore);
    });
    
    it('skip advances past current task', async () => {
      taskExecutor.execute.mockRejectedValue(new Error('Stuck'));
      siaAgent.intervene.mockResolvedValue({ type: 'escalate' });
      
      const session = await buildAgent.startBuild('idea-1');
      
      await waitFor(() => {
        const s = buildAgent.getSession(session.id);
        return s?.status === 'human_needed';
      });
      
      await buildAgent.skipTask(session.id);
      
      const s = buildAgent.getSession(session.id);
      expect(s?.failedTasks).toContain('t1');
      expect(s?.currentTaskIndex).toBe(1);
      expect(s?.status).toBe('active');
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
describe('E2E: Idea to Deployed App', () => {
  it('completes full journey', async () => {
    // 1. Start ideation
    const { ideaId } = await api.post('/api/ideation/start');
    
    // 2. Chat until ready
    await api.post(`/api/ideation/${ideaId}/message`, {
      message: 'I want to build a habit tracker app'
    });
    await api.post(`/api/ideation/${ideaId}/message`, {
      message: 'For busy professionals who want to build good habits'
    });
    // ... more messages until completion score > 60%
    
    // 3. Transition to spec
    await api.post(`/api/pipeline/${ideaId}/transition`, {
      targetPhase: 'specification'
    });
    
    // 4. Answer spec questions
    const specSession = await api.get(`/api/specification/${ideaId}/session`);
    for (const q of specSession.pendingQuestions) {
      await api.post(`/api/specification/${specSession.id}/answer`, {
        questionId: q.id,
        answer: 'Mobile app with React Native'
      });
    }
    
    // 5. Finalize spec
    await api.post(`/api/specification/${specSession.id}/finalize`);
    
    // 6. Start build
    await api.post(`/api/pipeline/${ideaId}/transition`, {
      targetPhase: 'building'
    });
    
    // 7. Wait for completion (with timeout)
    await waitFor(async () => {
      const status = await api.get(`/api/build/${ideaId}/status`);
      return status.status === 'complete';
    }, { timeout: 300000 }); // 5 minutes
    
    // 8. Verify deployed
    const finalState = await api.get(`/api/pipeline/${ideaId}/status`);
    expect(finalState.state.currentPhase).toBe('deployed');
  }, 600000); // 10 minute timeout
});
```

### Phase Transition Tests

```typescript
describe('E2E: Phase Transitions', () => {
  it('ideation → ideation_ready when milestones met', async () => {
    const ideaId = await setupIdeaWithMilestones();
    
    // Auto-transition should fire
    await waitFor(async () => {
      const state = await api.get(`/api/pipeline/${ideaId}/status`);
      return state.state.currentPhase === 'ideation_ready';
    });
  });
  
  it('spec_ready → building starts build agent', async () => {
    const ideaId = await setupIdeaWithSpec();
    
    await api.post(`/api/pipeline/${ideaId}/transition`, {
      targetPhase: 'building'
    });
    
    // Build session should exist
    const buildStatus = await api.get(`/api/build/${ideaId}/status`);
    expect(buildStatus.status).not.toBe('not_started');
  });
  
  it('human_needed pauses pipeline', async () => {
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

## Summary

Each task has:
1. **Unit tests** — Test the component in isolation
2. **Integration tests** — Test with real dependencies
3. **E2E tests** — Test the full user journey

**Test coverage targets:**
- Unit: >80%
- Integration: >60%
- E2E: Critical paths only

**Running tests:**
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test
```

---

*Next: [07-NETWORK-PILLAR.md](./07-NETWORK-PILLAR.md) — Future collaboration features (deferred)*
