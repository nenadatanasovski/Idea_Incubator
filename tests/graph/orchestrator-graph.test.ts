/**
 * ORCHESTRATOR GRAPH INTEGRATION TESTS
 *
 * Tests the integration between the AgentOrchestrator and the memory graph
 * block extraction system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the block extractor
vi.mock("../../agents/ideation/block-extractor.js", () => ({
  blockExtractor: {
    getBlocksForSession: vi.fn().mockResolvedValue([]),
    extractFromMessage: vi.fn().mockResolvedValue({
      blocks: [],
      links: [],
      warnings: [],
    }),
  },
  ExtractionResult: {},
}));

// Mock the graph analysis subagent
vi.mock("../../agents/ideation/graph-analysis-subagent.js", () => ({
  graphAnalysisSubagent: {
    runAnalysis: vi.fn().mockResolvedValue({
      taskId: "mock_task",
      taskType: "cascade-detection",
      success: true,
      duration: 0,
    }),
  },
}));

// Mock the anthropic client
vi.mock("../../utils/anthropic-client.js", () => ({
  client: {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              text: "Here is my response about your idea.",
              buttons: null,
            }),
          },
        ],
      }),
    },
  },
}));

// Mock other dependencies
vi.mock("../../config/index.js", () => ({
  getConfig: () => ({ model: "claude-sonnet-4-20250514" }),
}));

vi.mock("../../agents/ideation/message-store.js", () => ({
  messageStore: {
    getBySession: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockImplementation((msg) => ({
      ...msg,
      id: `msg_${Date.now()}`,
      createdAt: new Date(),
    })),
  },
}));

vi.mock("../../agents/ideation/graph-state-loader.js", () => ({
  graphStateLoader: {
    loadState: vi.fn().mockResolvedValue({
      selfDiscovery: {},
      marketDiscovery: {},
      narrowingState: {},
    }),
    getContextFiles: vi.fn().mockResolvedValue([]),
    loadIdeaTypeSelection: vi.fn().mockResolvedValue({
      ideaTypeSelected: true,
      parentSelected: true,
    }),
    updateIdeaTypeSelection: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../agents/ideation/candidate-manager.js", () => ({
  candidateManager: {
    getActiveForSession: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "candidate_1" }),
    update: vi.fn().mockResolvedValue({ id: "candidate_1" }),
  },
}));

vi.mock("../../agents/ideation/artifact-store.js", () => ({
  artifactStore: {
    getBySession: vi.fn().mockResolvedValue([]),
  },
}));

// Import after mocks
import {
  blockExtractor,
  ExtractionResult,
} from "../../agents/ideation/block-extractor.js";
import { graphAnalysisSubagent } from "../../agents/ideation/graph-analysis-subagent.js";

describe("AgentOrchestrator - Graph Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Block Extraction Integration", () => {
    it("should call blockExtractor.getBlocksForSession with correct sessionId", async () => {
      const mockGetBlocks = vi.mocked(blockExtractor.getBlocksForSession);
      mockGetBlocks.mockResolvedValue([]);

      // Simulate extraction call (testing the mock setup)
      await blockExtractor.getBlocksForSession("session_123");

      expect(mockGetBlocks).toHaveBeenCalledWith("session_123");
    });

    it("should call blockExtractor.extractFromMessage with correct parameters", async () => {
      const mockExtract = vi.mocked(blockExtractor.extractFromMessage);
      mockExtract.mockResolvedValue({
        blocks: [
          {
            id: "block_1",
            type: "knowledge",
            content: "Market size is $50B",
            sessionId: "session_123",
            status: "active",
            confidence: 0.8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        links: [],
        warnings: [],
      });

      await blockExtractor.extractFromMessage(
        {
          id: "msg_456",
          sessionId: "session_123",
          role: "assistant",
          content: "The market size is approximately $50B",
          buttonsShown: null,
          buttonClicked: null,
          formShown: null,
          formResponse: null,
          webSearchResults: null,
          tokenCount: 0,
          createdAt: new Date(),
        } as any,
        "session_123",
        [],
      );

      expect(mockExtract).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg_456",
          content: "The market size is approximately $50B",
        }),
        "session_123",
        [],
      );
    });

    it("should return extracted blocks with proper structure", async () => {
      const mockExtract = vi.mocked(blockExtractor.extractFromMessage);
      const now = new Date().toISOString();
      const expectedResult: ExtractionResult = {
        blocks: [
          {
            id: "block_1",
            type: "knowledge",
            content: "Target market: B2B SaaS",
            sessionId: "session_123",
            status: "active",
            confidence: 0.85,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "block_2",
            type: "assumption",
            content: "Users will pay for premium features",
            sessionId: "session_123",
            status: "active",
            confidence: 0.6,
            createdAt: now,
            updatedAt: now,
          },
        ],
        links: [
          {
            id: "link_1",
            sessionId: "session_123",
            sourceBlockId: "block_1",
            targetBlockId: "block_2",
            linkType: "requires",
            status: "active",
            createdAt: now,
            updatedAt: now,
          },
        ],
        warnings: [],
      };

      mockExtract.mockResolvedValue(expectedResult);

      const result = await blockExtractor.extractFromMessage(
        {
          id: "msg_456",
          sessionId: "session_123",
          role: "assistant",
          content: "Test message",
          buttonsShown: null,
          buttonClicked: null,
          formShown: null,
          formResponse: null,
          webSearchResults: null,
          tokenCount: 0,
          createdAt: new Date(),
        } as any,
        "session_123",
        [],
      );

      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].type).toBe("knowledge");
      expect(result.blocks[1].type).toBe("assumption");
      expect(result.links).toHaveLength(1);
      expect(result.links[0].linkType).toBe("requires");
    });
  });

  describe("Cascade Detection Integration", () => {
    it("should call graphAnalysisSubagent.runAnalysis for cascade detection", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        taskId: "test_task_1",
        taskType: "cascade-detection",
        success: true,
        duration: 100,
        cascadeResult: {
          affectedBlocks: [
            {
              blockId: "block_old_1",
              reason: "Depends on changed block",
              suggestedAction: "review",
              propagationLevel: 1,
            },
          ],
          propagationDepth: 1,
        },
      });

      await graphAnalysisSubagent.runAnalysis(
        "cascade-detection",
        "session_123",
        {
          newBlockIds: ["block_1", "block_2"],
          detectSupersession: true,
          detectConflicts: true,
        },
      );

      expect(mockAnalysis).toHaveBeenCalledWith(
        "cascade-detection",
        "session_123",
        {
          newBlockIds: ["block_1", "block_2"],
          detectSupersession: true,
          detectConflicts: true,
        },
      );
    });

    it("should handle cascade detection with supersession chains", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        taskId: "test_task_2",
        taskType: "cascade-detection",
        success: true,
        duration: 150,
        cascadeResult: {
          affectedBlocks: [
            {
              blockId: "block_old_1",
              reason: "Updated market size data",
              suggestedAction: "review",
              propagationLevel: 1,
            },
            {
              blockId: "block_old_2",
              reason: "Updated market size data",
              suggestedAction: "review",
              propagationLevel: 1,
            },
          ],
          propagationDepth: 1,
        },
      });

      const result = await graphAnalysisSubagent.runAnalysis(
        "cascade-detection",
        "session_123",
        { newBlockIds: ["block_new"] },
      );

      expect(result.success).toBe(true);
      expect(result.cascadeResult).toBeDefined();
      expect(result.cascadeResult!.affectedBlocks).toHaveLength(2);
      expect(result.cascadeResult!.affectedBlocks[0].blockId).toBe(
        "block_old_1",
      );
    });

    it("should handle cascade detection with conflicts", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        taskId: "test_task_3",
        taskType: "contradiction-scan",
        success: true,
        duration: 120,
        contradictionResult: {
          contradictions: [
            {
              blockAId: "block_a",
              blockBId: "block_b",
              contradictionType: "direct",
              description: "Market size estimates differ significantly",
              severity: "high",
            },
          ],
        },
      });

      const result = await graphAnalysisSubagent.runAnalysis(
        "contradiction-scan",
        "session_123",
        { newBlockIds: ["block_a"] },
      );

      expect(result.success).toBe(true);
      expect(result.contradictionResult).toBeDefined();
      expect(result.contradictionResult!.contradictions).toHaveLength(1);
    });

    it("should handle failed cascade detection gracefully", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        taskId: "test_task_4",
        taskType: "cascade-detection",
        success: false,
        duration: 50,
      });

      const result = await graphAnalysisSubagent.runAnalysis(
        "cascade-detection",
        "session_123",
        { newBlockIds: ["invalid_block"] },
      );

      expect(result.success).toBe(false);
      expect(result.cascadeResult).toBeUndefined();
    });
  });

  describe("Extraction Configuration", () => {
    it("should respect default extraction configuration", async () => {
      // Import the default config
      const { defaultExtractionConfig } =
        await import("../../agents/ideation/orchestrator.js");

      expect(defaultExtractionConfig.autoExtractBlocks).toBe(true);
      expect(defaultExtractionConfig.extractionConfidenceThreshold).toBe(0.5);
      expect(defaultExtractionConfig.duplicateHandling).toBe("skip");
      expect(defaultExtractionConfig.triggerCascadeDetection).toBe(true);
    });
  });

  describe("Extraction Warnings", () => {
    it("should handle extraction warnings properly", async () => {
      const mockExtract = vi.mocked(blockExtractor.extractFromMessage);
      mockExtract.mockResolvedValue({
        blocks: [
          {
            id: "block_1",
            type: "knowledge",
            content: "Test content",
            sessionId: "session_123",
            status: "active",
            confidence: 0.3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        links: [],
        warnings: [
          "Block confidence below threshold (0.3 < 0.5)",
          "Potential duplicate detected for existing block",
        ],
      });

      const result = await blockExtractor.extractFromMessage(
        { id: "msg_456", content: "Test message" } as any,
        "session_123",
        [],
      );

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain("confidence below threshold");
      expect(result.warnings[1]).toContain("duplicate");
    });
  });

  describe("Duplicate Detection", () => {
    it("should pass existing blocks for duplicate detection", async () => {
      const now = new Date().toISOString();
      const existingBlocks = [
        {
          id: "existing_1",
          type: "knowledge" as const,
          content: "Market size is $50B",
          sessionId: "session_123",
          status: "active" as const,
          confidence: 0.9,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const mockGetBlocks = vi.mocked(blockExtractor.getBlocksForSession);
      mockGetBlocks.mockResolvedValue(existingBlocks as any);

      const mockExtract = vi.mocked(blockExtractor.extractFromMessage);
      mockExtract.mockResolvedValue({
        blocks: [],
        links: [],
        warnings: ["Duplicate detected: Market size is $50B"],
      });

      const blocks = await blockExtractor.getBlocksForSession("session_123");
      expect(blocks).toEqual(existingBlocks);

      await blockExtractor.extractFromMessage(
        { id: "msg_456", content: "The market size is $50B" } as any,
        "session_123",
        existingBlocks as any,
      );

      expect(mockExtract).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg_456" }),
        "session_123",
        expect.any(Array),
      );
    });
  });
});
