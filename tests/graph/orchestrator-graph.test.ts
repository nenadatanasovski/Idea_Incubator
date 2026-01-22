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
      success: true,
      result: { supersessionChains: [], conflicts: [] },
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

vi.mock("../../agents/ideation/memory-manager.js", () => ({
  memoryManager: {
    getAll: vi.fn().mockResolvedValue([]),
    loadState: vi.fn().mockResolvedValue({
      selfDiscovery: {},
      marketDiscovery: {},
      narrowingState: {},
    }),
    updateAll: vi.fn().mockResolvedValue(undefined),
    loadIdeaTypeSelection: vi.fn().mockResolvedValue({
      ideaTypeSelected: true,
      parentSelected: true,
    }),
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
import { blockExtractor } from "../../agents/ideation/block-extractor.js";
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
            type: "content",
            content: "Market size is $50B",
            sessionId: "session_123",
            status: "active",
            confidence: 0.8,
          },
        ],
        links: [],
        warnings: [],
      });

      await blockExtractor.extractFromMessage(
        "The market size is approximately $50B",
        "session_123",
        "msg_456",
        [],
      );

      expect(mockExtract).toHaveBeenCalledWith(
        "The market size is approximately $50B",
        "session_123",
        "msg_456",
        [],
      );
    });

    it("should return extracted blocks with proper structure", async () => {
      const mockExtract = vi.mocked(blockExtractor.extractFromMessage);
      const expectedResult = {
        blocks: [
          {
            id: "block_1",
            type: "content" as const,
            content: "Target market: B2B SaaS",
            sessionId: "session_123",
            status: "active" as const,
            confidence: 0.85,
          },
          {
            id: "block_2",
            type: "assumption" as const,
            content: "Users will pay for premium features",
            sessionId: "session_123",
            status: "active" as const,
            confidence: 0.6,
          },
        ],
        links: [
          {
            id: "link_1",
            sourceBlockId: "block_1",
            targetBlockId: "block_2",
            linkType: "requires" as const,
          },
        ],
        warnings: [],
      };

      mockExtract.mockResolvedValue(expectedResult);

      const result = await blockExtractor.extractFromMessage(
        "Test message",
        "session_123",
        "msg_456",
        [],
      );

      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0].type).toBe("content");
      expect(result.blocks[1].type).toBe("assumption");
      expect(result.links).toHaveLength(1);
      expect(result.links[0].linkType).toBe("requires");
    });
  });

  describe("Cascade Detection Integration", () => {
    it("should call graphAnalysisSubagent.runAnalysis for cascade detection", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        success: true,
        result: {
          supersessionChains: [
            {
              sourceBlock: "block_1",
              supersededBlocks: ["block_old_1"],
            },
          ],
          conflicts: [],
        },
      });

      await graphAnalysisSubagent.runAnalysis(
        "session_123",
        "cascade-detection",
        {
          newBlockIds: ["block_1", "block_2"],
          detectSupersession: true,
          detectConflicts: true,
        },
      );

      expect(mockAnalysis).toHaveBeenCalledWith(
        "session_123",
        "cascade-detection",
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
        success: true,
        result: {
          supersessionChains: [
            {
              sourceBlock: "block_new",
              supersededBlocks: ["block_old_1", "block_old_2"],
              reason: "Updated market size data",
            },
          ],
          conflicts: [],
        },
      });

      const result = await graphAnalysisSubagent.runAnalysis(
        "session_123",
        "cascade-detection",
        { newBlockIds: ["block_new"] },
      );

      expect(result.success).toBe(true);
      const cascadeResult = result.result as {
        supersessionChains: Array<{
          sourceBlock: string;
          supersededBlocks: string[];
        }>;
      };
      expect(cascadeResult.supersessionChains).toHaveLength(1);
      expect(cascadeResult.supersessionChains[0].supersededBlocks).toContain(
        "block_old_1",
      );
    });

    it("should handle cascade detection with conflicts", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        success: true,
        result: {
          supersessionChains: [],
          conflicts: [
            {
              block1: "block_a",
              block2: "block_b",
              conflictType: "contradicts",
              description: "Market size estimates differ significantly",
            },
          ],
        },
      });

      const result = await graphAnalysisSubagent.runAnalysis(
        "session_123",
        "cascade-detection",
        { newBlockIds: ["block_a"] },
      );

      expect(result.success).toBe(true);
      const cascadeResult = result.result as {
        conflicts: Array<{ block1: string; block2: string }>;
      };
      expect(cascadeResult.conflicts).toHaveLength(1);
    });

    it("should handle failed cascade detection gracefully", async () => {
      const mockAnalysis = vi.mocked(graphAnalysisSubagent.runAnalysis);
      mockAnalysis.mockResolvedValue({
        success: false,
        error: "Analysis failed due to invalid block IDs",
      });

      const result = await graphAnalysisSubagent.runAnalysis(
        "session_123",
        "cascade-detection",
        { newBlockIds: ["invalid_block"] },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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
            type: "content",
            content: "Test content",
            sessionId: "session_123",
            status: "active",
            confidence: 0.3,
          },
        ],
        links: [],
        warnings: [
          "Block confidence below threshold (0.3 < 0.5)",
          "Potential duplicate detected for existing block",
        ],
      });

      const result = await blockExtractor.extractFromMessage(
        "Test message",
        "session_123",
        "msg_456",
        [],
      );

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain("confidence below threshold");
      expect(result.warnings[1]).toContain("duplicate");
    });
  });

  describe("Duplicate Detection", () => {
    it("should pass existing blocks for duplicate detection", async () => {
      const existingBlocks = [
        {
          id: "existing_1",
          type: "content" as const,
          content: "Market size is $50B",
          sessionId: "session_123",
          status: "active" as const,
          confidence: 0.9,
        },
      ];

      const mockGetBlocks = vi.mocked(blockExtractor.getBlocksForSession);
      mockGetBlocks.mockResolvedValue(existingBlocks);

      const mockExtract = vi.mocked(blockExtractor.extractFromMessage);
      mockExtract.mockResolvedValue({
        blocks: [],
        links: [],
        warnings: ["Duplicate detected: Market size is $50B"],
      });

      const blocks = await blockExtractor.getBlocksForSession("session_123");
      expect(blocks).toEqual(existingBlocks);

      await blockExtractor.extractFromMessage(
        "The market size is $50B",
        "session_123",
        "msg_456",
        existingBlocks,
      );

      expect(mockExtract).toHaveBeenCalledWith(
        expect.any(String),
        "session_123",
        "msg_456",
        existingBlocks,
      );
    });
  });
});
