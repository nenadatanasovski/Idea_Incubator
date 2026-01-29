# Integration Tests

Create `tests/integration/memory-graph-migration.test.ts`:

```typescript
describe("Memory Graph Migration Integration", () => {
  let ideaId: string;

  beforeAll(async () => {
    // Create test idea
    ideaId = await createTestIdea();
  });

  afterAll(async () => {
    // Cleanup
    await deleteTestIdea(ideaId);
  });

  test("full ideation flow without memory files", async () => {
    // Start session
    const session = await startIdeationSession(ideaId);

    // Send messages
    await sendMessage(session.id, "I'm frustrated with manual data entry");
    await sendMessage(session.id, "I have 5 years Python experience");

    // Verify blocks were created
    const blocks = await graphQueryService.query({ ideaId });
    expect(blocks.blocks.length).toBeGreaterThan(0);

    // Load state from graph
    const state = await graphStateLoader.loadState(ideaId);
    expect(state.selfDiscovery.frustrations.length).toBeGreaterThan(0);
    expect(state.selfDiscovery.expertise.length).toBeGreaterThan(0);

    // Verify no memory files were created
    const memoryFiles = await db.query(
      "SELECT * FROM ideation_memory_files WHERE session_id = ?",
      [session.id],
    );
    expect(memoryFiles.length).toBe(0);
  });

  test("build agent uses graph context", async () => {
    // Create requirement blocks
    await createTestBlock({
      ideaId,
      type: "requirement",
      blockTypes: ["requirement"],
      graphMemberships: ["spec"],
      content: "Must support OAuth login",
    });

    // Create learning block
    await createTestBlock({
      ideaId,
      type: "learning",
      blockTypes: ["learning"],
      graphMemberships: ["validation"],
      content: "Always use httpOnly cookies for tokens",
      confidence: 0.9,
    });

    // Build agent should see these
    const context = await buildAgent.loadGraphContext(ideaId);
    expect(context.requirements).toContainEqual(
      expect.objectContaining({ content: expect.stringContaining("OAuth") }),
    );
    expect(context.learnings).toContainEqual(
      expect.objectContaining({ content: expect.stringContaining("httpOnly") }),
    );
  });

  test("readiness checks work correctly", async () => {
    // Without required blocks, should not be ready
    let readiness = await checkSpecReadiness(ideaId);
    expect(readiness.ready).toBe(false);

    // Add required blocks
    await createTestBlock({
      ideaId,
      type: "insight",
      graphMemberships: ["problem"],
      content: "Users waste time on manual data entry",
    });

    await createTestBlock({
      ideaId,
      type: "insight",
      graphMemberships: ["solution"],
      content: "Automated data pipeline solution",
    });

    // Now should have higher score
    readiness = await checkSpecReadiness(ideaId);
    expect(readiness.score).toBeGreaterThan(50);
  });

  test("context limit flow saves to graph", async () => {
    const session = await startIdeationSession(ideaId);

    // Simulate many messages
    for (let i = 0; i < 10; i++) {
      await sendMessage(session.id, `Test message ${i}`);
    }

    // Trigger save to graph
    const result = await contextManager.saveConversationToGraph(
      session.id,
      ideaId,
    );
    expect(result.success).toBe(true);
    expect(result.blocksCreated).toBeGreaterThan(0);

    // New session should be able to load context
    const newSession = await startIdeationSession(ideaId);
    const context = await contextManager.prepareNewSessionContext(ideaId);
    expect(context).toContain("Session Context");
  });
});
```

## Unit Tests for GraphStateLoader

```typescript
describe("GraphStateLoader", () => {
  test("extracts user profile from graph", async () => {
    // Setup
    await createTestBlock({
      ideaId,
      type: "fact",
      blockTypes: ["skill"],
      graphMemberships: ["user"],
      content: "Expert Python developer",
      properties: { skill_name: "Python", proficiency: "expert" },
    });

    // Execute
    const state = await graphStateLoader.loadState(ideaId);

    // Verify
    expect(state.selfDiscovery.expertise).toContainEqual(
      expect.objectContaining({ area: "Python", depth: "expert" }),
    );
  });

  test("extracts market discovery from graph", async () => {
    await createTestBlock({
      ideaId,
      type: "insight",
      graphMemberships: ["competition"],
      content: "Competitor A has 40% market share",
      properties: { entity_type: "competitor", name: "Competitor A" },
    });

    const state = await graphStateLoader.loadState(ideaId);

    expect(state.marketDiscovery.competitors.length).toBeGreaterThan(0);
  });
});
```

## Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suites
npm test -- --grep "graph"
npm test -- --grep "ideation"
npm test -- --grep "build"

# Run integration tests
npm test -- tests/integration/memory-graph-migration.test.ts
```
