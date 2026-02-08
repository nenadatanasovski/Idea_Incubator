/**
 * Integration tests for Memory Graph Migration
 *
 * Verifies that the graph-based state management works correctly
 * without the deprecated memory files system.
 */

import { describe, test, expect, afterAll } from "vitest";
import { getDb, saveDb, query as dbQuery } from "../../database/db.js";
import { graphStateLoader } from "../../agents/ideation/graph-state-loader.js";
import { contextManager } from "../../agents/ideation/context-manager.js";

// Test helpers
async function createTestSession(ideaSlug: string): Promise<string> {
  const db = await getDb();
  const sessionId = `test_session_${Date.now()}`;

  db.run(
    `INSERT INTO ideation_sessions (id, profile_id, status, current_phase, idea_slug)
     VALUES (?, 'test_profile', 'active', 'exploring', ?)`,
    [sessionId, ideaSlug],
  );
  await saveDb();

  return sessionId;
}

async function createTestBlock(params: {
  sessionId: string;
  ideaId: string;
  type: string;
  blockTypes?: string[];
  graphMemberships?: string[];
  content: string;
  properties?: Record<string, unknown>;
  confidence?: number;
}): Promise<string> {
  const db = await getDb();
  const blockId = `block_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  db.run(
    `INSERT INTO memory_blocks (id, session_id, idea_id, type, content, properties, confidence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      blockId,
      params.sessionId,
      params.ideaId,
      params.type,
      params.content,
      JSON.stringify(params.properties || {}),
      params.confidence || 0.8,
    ],
  );

  // Add block types
  if (params.blockTypes) {
    for (const blockType of params.blockTypes) {
      db.run(
        `INSERT OR IGNORE INTO memory_block_types (block_id, block_type)
         VALUES (?, ?)`,
        [blockId, blockType],
      );
    }
  }

  // Add graph memberships
  if (params.graphMemberships) {
    for (const membership of params.graphMemberships) {
      db.run(
        `INSERT OR IGNORE INTO memory_graph_memberships (block_id, graph_type)
         VALUES (?, ?)`,
        [blockId, membership],
      );
    }
  }

  await saveDb();
  return blockId;
}

async function cleanup(sessionIds: string[], blockIds: string[]) {
  const db = await getDb();

  // Delete blocks
  for (const blockId of blockIds) {
    db.run(`DELETE FROM memory_block_types WHERE block_id = ?`, [blockId]);
    db.run(`DELETE FROM memory_graph_memberships WHERE block_id = ?`, [
      blockId,
    ]);
    db.run(`DELETE FROM memory_blocks WHERE id = ?`, [blockId]);
  }

  // Delete sessions
  for (const sessionId of sessionIds) {
    db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [sessionId]);
  }

  await saveDb();
}

describe("Memory Graph Migration Integration", () => {
  const testIdeaSlug = `test_idea_${Date.now()}`;
  const sessionIds: string[] = [];
  const blockIds: string[] = [];

  afterAll(async () => {
    await cleanup(sessionIds, blockIds);
  });

  describe("GraphStateLoader", () => {
    test("loadState returns empty state for new idea", async () => {
      const state = await graphStateLoader.loadState("non_existent_idea");

      expect(state.selfDiscovery).toBeDefined();
      expect(state.marketDiscovery).toBeDefined();
      expect(state.narrowingState).toBeDefined();
    });

    test("extracts expertise from skill blocks", async () => {
      const sessionId = await createTestSession(testIdeaSlug);
      sessionIds.push(sessionId);

      const blockId = await createTestBlock({
        sessionId,
        ideaId: testIdeaSlug,
        type: "fact",
        blockTypes: ["fact"],
        graphMemberships: ["user"],
        content: "Expert Python developer with 10 years experience",
        properties: {
          skill_name: "Python",
          proficiency: "expert",
          evidence: "Built multiple production systems",
        },
      });
      blockIds.push(blockId);

      const state = await graphStateLoader.loadState(testIdeaSlug);

      expect(state.selfDiscovery.expertise.length).toBeGreaterThan(0);
      const pythonSkill = state.selfDiscovery.expertise.find(
        (e) => e.area === "Python",
      );
      expect(pythonSkill).toBeDefined();
      expect(pythonSkill?.depth).toBe("expert");
    });

    test("extracts frustrations from pain point blocks", async () => {
      const sessionId =
        sessionIds[0] || (await createTestSession(testIdeaSlug));
      if (!sessionIds.includes(sessionId)) sessionIds.push(sessionId);

      const blockId = await createTestBlock({
        sessionId,
        ideaId: testIdeaSlug,
        type: "insight",
        blockTypes: ["insight"],
        graphMemberships: ["problem"],
        content: "Manual data entry wastes 4 hours per week",
        properties: {
          type: "frustration",
          category: "pain_point",
          severity: "high",
        },
      });
      blockIds.push(blockId);

      const state = await graphStateLoader.loadState(testIdeaSlug);

      expect(state.selfDiscovery.frustrations.length).toBeGreaterThan(0);
    });

    test("getContextFiles returns formatted context", async () => {
      const files = await graphStateLoader.getContextFiles(testIdeaSlug);

      expect(files.length).toBe(3); // self_discovery, market_discovery, narrowing_state
      expect(files.map((f) => f.fileType)).toContain("self_discovery");
      expect(files.map((f) => f.fileType)).toContain("market_discovery");
      expect(files.map((f) => f.fileType)).toContain("narrowing_state");
    });
  });

  describe("ContextManager", () => {
    test("checkContextStatus returns correct status", () => {
      const status = contextManager.checkContextStatus(80000, 100000);

      expect(status.tokensUsed).toBe(80000);
      expect(status.tokenLimit).toBe(100000);
      expect(status.percentUsed).toBe(0.8);
      expect(status.shouldPromptSave).toBe(false);
    });

    test("checkContextStatus prompts save at 90%", () => {
      const status = contextManager.checkContextStatus(91000, 100000);

      expect(status.shouldPromptSave).toBe(true);
    });

    test("generateSavePrompt returns formatted prompt", () => {
      const prompt = contextManager.generateSavePrompt();

      expect(prompt).toContain("Context Limit Approaching");
      expect(prompt).toContain("Save & Continue");
      expect(prompt).toContain("Continue Without Saving");
    });
  });

  describe("No Memory Files Created", () => {
    test("ideation_memory_files table remains empty during session", async () => {
      await getDb();
      const sessionId = await createTestSession(`empty_test_${Date.now()}`);
      sessionIds.push(sessionId);

      // Create some blocks (simulating conversation)
      const blockId = await createTestBlock({
        sessionId,
        ideaId: `empty_test_${Date.now()}`,
        type: "insight",
        content: "Test insight",
      });
      blockIds.push(blockId);

      // Verify no memory files were created
      const memoryFiles = await dbQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM ideation_memory_files WHERE session_id = ?`,
        [sessionId],
      );

      expect(memoryFiles[0]?.count || 0).toBe(0);
    });
  });
});
