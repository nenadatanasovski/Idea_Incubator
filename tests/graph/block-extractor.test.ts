/**
 * Block Extractor Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IdeationMessage } from "../../types/ideation.js";

// Mock the database module
vi.mock("../../database/db.js", () => ({
  query: vi.fn().mockResolvedValue([]),
  run: vi.fn().mockResolvedValue(undefined),
  saveDb: vi.fn().mockResolvedValue(undefined),
  getOne: vi.fn().mockResolvedValue(null),
}));

// Mock the anthropic client
vi.mock("../../utils/anthropic-client.js", () => ({
  client: {
    messages: {
      create: vi.fn(),
    },
  },
}));

// Import after mocks are set up
import {
  BlockExtractor,
  MemoryBlock,
} from "../../agents/ideation/block-extractor.js";
import { client } from "../../utils/anthropic-client.js";

const mockCreate = vi.mocked(client.messages.create);

describe("BlockExtractor", () => {
  let extractor: BlockExtractor;

  beforeEach(() => {
    extractor = new BlockExtractor();
    vi.clearAllMocks();
  });

  describe("extractFromMessage", () => {
    it("should skip extraction for user messages", async () => {
      const message: IdeationMessage = {
        id: "msg_001",
        sessionId: "session_001",
        role: "user",
        content: "This is a user message about the legal tech market.",
        buttonsShown: null,
        buttonClicked: null,
        formShown: null,
        formResponse: null,
        webSearchResults: null,
        tokenCount: 50,
        createdAt: new Date(),
      };

      const result = await extractor.extractFromMessage(
        message,
        "session_001",
        [],
      );

      expect(result.blocks).toHaveLength(0);
      expect(result.links).toHaveLength(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should skip extraction for short messages", async () => {
      const message: IdeationMessage = {
        id: "msg_001",
        sessionId: "session_001",
        role: "assistant",
        content: "OK, got it!",
        buttonsShown: null,
        buttonClicked: null,
        formShown: null,
        formResponse: null,
        webSearchResults: null,
        tokenCount: 10,
        createdAt: new Date(),
      };

      const result = await extractor.extractFromMessage(
        message,
        "session_001",
        [],
      );

      expect(result.blocks).toHaveLength(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should extract blocks from assistant message", async () => {
      const message: IdeationMessage = {
        id: "msg_001",
        sessionId: "session_001",
        role: "assistant",
        content:
          "The legal tech market is estimated at $50B TAM. This presents a significant opportunity for AI-powered contract analysis tools that can save lawyers 10+ hours per week.",
        buttonsShown: null,
        buttonClicked: null,
        formShown: null,
        formResponse: null,
        webSearchResults: null,
        tokenCount: 100,
        createdAt: new Date(),
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              blocks: [
                {
                  type: "knowledge",
                  content: "Legal tech market is $50B TAM",
                  confidence: 0.85,
                  graph_membership: ["market"],
                  properties: { market_size: 50000000000 },
                },
                {
                  type: "knowledge",
                  content:
                    "AI-powered contract analysis tools can save lawyers 10+ hours per week",
                  confidence: 0.75,
                  graph_membership: ["solution", "fit"],
                  properties: { time_saved: "10+ hours" },
                },
              ],
              links: [
                {
                  source_content_match: "Legal tech market is $50B TAM",
                  target_content_match:
                    "AI-powered contract analysis tools can save lawyers 10+ hours per week",
                  link_type: "evidence_for",
                  degree: "partial",
                  confidence: 0.8,
                  reason: "Market size supports the opportunity",
                },
              ],
            }),
          },
        ],
        model: "claude-3-5-haiku-latest",
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 200 },
      } as any);

      const result = await extractor.extractFromMessage(
        message,
        "session_001",
        [],
      );

      expect(result.blocks.length).toBeGreaterThanOrEqual(1);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should detect and skip duplicate blocks", async () => {
      const existingBlocks: MemoryBlock[] = [
        {
          id: "block_existing",
          sessionId: "session_001",
          type: "knowledge",
          content: "Legal tech market is $50B TAM",
          properties: null,
          status: "active",
          confidence: 0.85,
          abstractionLevel: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const message: IdeationMessage = {
        id: "msg_001",
        sessionId: "session_001",
        role: "assistant",
        content:
          "As we discussed, the legal tech market is $50B TAM. This is a major opportunity.",
        buttonsShown: null,
        buttonClicked: null,
        formShown: null,
        formResponse: null,
        webSearchResults: null,
        tokenCount: 100,
        createdAt: new Date(),
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              blocks: [
                {
                  type: "knowledge",
                  content: "Legal tech market is $50B TAM",
                  confidence: 0.85,
                  graph_membership: ["market"],
                },
              ],
              links: [],
            }),
          },
        ],
        model: "claude-3-5-haiku-latest",
        stop_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 200 },
      } as any);

      const result = await extractor.extractFromMessage(
        message,
        "session_001",
        existingBlocks,
      );

      // Should have warning about duplicate
      expect(
        result.warnings.some((w) => w.includes("Duplicate detected")),
      ).toBe(true);
      // Should not create new block for duplicate
      expect(result.blocks).toHaveLength(0);
    });
  });

  describe("block type validation", () => {
    it("should validate all 9 canonical block types (ARCH-001)", () => {
      const validTypes = [
        "knowledge",    // Verified facts, patterns, insights
        "decision",     // Choices made with rationale
        "assumption",   // Unverified beliefs to test
        "question",     // Open unknowns to investigate
        "requirement",  // Constraints, must-haves
        "task",         // Work items, actions
        "proposal",     // Suggested changes awaiting approval
        "artifact",     // Outputs (code, docs, specs)
        "evidence",     // Validation data, proof
      ];

      // Access the private method via any cast for testing
      const extractorAny = extractor as any;

      for (const type of validTypes) {
        expect(extractorAny.validateBlockType(type)).toBe(type);
      }

      // Invalid type should return null
      expect(extractorAny.validateBlockType("invalid_type")).toBeNull();
    });
  });

  describe("link type validation", () => {
    it("should validate all 21 link types", () => {
      const validTypes = [
        "addresses",
        "creates",
        "requires",
        "conflicts",
        "supports",
        "depends_on",
        "enables",
        "suggests",
        "supersedes",
        "validates",
        "invalidates",
        "references",
        "evidence_for",
        "elaborates",
        "refines",
        "specializes",
        "alternative_to",
        "instance_of",
        "constrained_by",
        "derived_from",
        "measured_by",
      ];

      const extractorAny = extractor as any;

      for (const type of validTypes) {
        expect(extractorAny.validateLinkType(type)).toBe(type);
      }

      expect(extractorAny.validateLinkType("invalid_link")).toBeNull();
    });
  });

  describe("graph membership validation", () => {
    it("should validate graph memberships", () => {
      const extractorAny = extractor as any;

      const result = extractorAny.validateGraphMemberships([
        "problem",
        "solution",
        "market",
        "invalid",
      ]);

      expect(result).toContain("problem");
      expect(result).toContain("solution");
      expect(result).toContain("market");
      expect(result).not.toContain("invalid");
    });

    it("should handle empty or null memberships", () => {
      const extractorAny = extractor as any;

      expect(extractorAny.validateGraphMemberships([])).toHaveLength(0);
      expect(extractorAny.validateGraphMemberships(null)).toHaveLength(0);
      expect(extractorAny.validateGraphMemberships(undefined)).toHaveLength(0);
    });
  });

  describe("duplicate detection", () => {
    it("should detect exact duplicates", () => {
      const existingBlocks: MemoryBlock[] = [
        {
          id: "block_1",
          sessionId: "session_001",
          type: "knowledge",
          content: "The market size is $50B",
          properties: null,
          status: "active",
          confidence: 0.8,
          abstractionLevel: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const extractorAny = extractor as any;

      const duplicate = extractorAny.findDuplicate(
        "The market size is $50B",
        existingBlocks,
      );
      expect(duplicate).not.toBeNull();
      expect(duplicate?.id).toBe("block_1");
    });

    it("should detect high similarity duplicates", () => {
      const existingBlocks: MemoryBlock[] = [
        {
          id: "block_1",
          sessionId: "session_001",
          type: "knowledge",
          content: "The total addressable market size is $50 billion",
          properties: null,
          status: "active",
          confidence: 0.8,
          abstractionLevel: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const extractorAny = extractor as any;

      // Very similar content should be detected
      const duplicate = extractorAny.findDuplicate(
        "The total addressable market size is $50 billion TAM",
        existingBlocks,
      );
      expect(duplicate).not.toBeNull();
    });

    it("should not detect unrelated content as duplicate", () => {
      const existingBlocks: MemoryBlock[] = [
        {
          id: "block_1",
          sessionId: "session_001",
          type: "knowledge",
          content: "The market size is $50B",
          properties: null,
          status: "active",
          confidence: 0.8,
          abstractionLevel: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const extractorAny = extractor as any;

      const duplicate = extractorAny.findDuplicate(
        "The team has 10 years of experience",
        existingBlocks,
      );
      expect(duplicate).toBeNull();
    });
  });

  describe("abstraction level validation", () => {
    it("should validate abstraction levels", () => {
      const extractorAny = extractor as any;

      expect(extractorAny.validateAbstractionLevel("vision")).toBe("vision");
      expect(extractorAny.validateAbstractionLevel("strategy")).toBe(
        "strategy",
      );
      expect(extractorAny.validateAbstractionLevel("tactic")).toBe("tactic");
      expect(extractorAny.validateAbstractionLevel("implementation")).toBe(
        "implementation",
      );
      expect(extractorAny.validateAbstractionLevel("VISION")).toBe("vision");
      expect(extractorAny.validateAbstractionLevel("invalid")).toBeNull();
      expect(extractorAny.validateAbstractionLevel(undefined)).toBeNull();
    });
  });

  describe("degree validation", () => {
    it("should validate link degrees", () => {
      const extractorAny = extractor as any;

      expect(extractorAny.validateDegree("full")).toBe("full");
      expect(extractorAny.validateDegree("partial")).toBe("partial");
      expect(extractorAny.validateDegree("minimal")).toBe("minimal");
      expect(extractorAny.validateDegree("FULL")).toBe("full");
      expect(extractorAny.validateDegree("invalid")).toBeNull();
      expect(extractorAny.validateDegree(undefined)).toBeNull();
    });
  });
});
