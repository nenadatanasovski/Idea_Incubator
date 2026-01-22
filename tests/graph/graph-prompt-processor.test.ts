/**
 * Graph Prompt Processor Tests
 * Test Suite 5: AI Prompt Integration - Unit Tests
 */

import { describe, it, expect } from "vitest";
import {
  parsePrompt,
  processGraphPrompt,
  findBlocksByKeyword,
  findBlocksByType,
  findBlockByName,
  Block,
} from "../../server/services/graph-prompt-processor.js";

describe("Graph Prompt Processor", () => {
  // Test blocks for processing
  const testBlocks: Block[] = [
    {
      id: "block_market",
      type: "content",
      content: "Market is $50B",
      properties: { market: "Legal tech", market_size: 50000000000 },
      status: "active",
    },
    {
      id: "block_solution",
      type: "content",
      content: "AI-powered search tool",
      properties: { solution: "AI tool" },
      status: "active",
    },
    {
      id: "block_problem",
      type: "content",
      content: "Lawyers waste time on research",
      properties: { problem: "Research time waste" },
      status: "active",
    },
    {
      id: "block_assumption_001",
      type: "assumption",
      content: "Users will adopt AI tools",
      properties: {},
      status: "draft",
    },
    {
      id: "block_risk_001",
      type: "content",
      content: "Regulatory compliance risks",
      properties: { risk: "compliance" },
      status: "active",
    },
    {
      id: "block_revenue",
      type: "content",
      content: "Expected revenue of $10M ARR",
      properties: { business: "revenue", amount: 10000000 },
      status: "active",
    },
  ];

  describe("parsePrompt", () => {
    it("should parse link creation prompts", () => {
      const result = parsePrompt(
        "Link the solution block to the problem block",
      );
      expect(result.intent).toBe("link");
      expect(result.entities.sourceBlock).toBe("solution");
      expect(result.entities.targetBlock).toBe("problem");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should parse connect variation of link prompts", () => {
      const result = parsePrompt("Connect the market to the solution");
      expect(result.intent).toBe("link");
      expect(result.entities.sourceBlock).toBe("market");
      expect(result.entities.targetBlock).toBe("solution");
    });

    it("should parse highlight/query prompts", () => {
      const result = parsePrompt("What blocks mention market?");
      // The highlight pattern catches "what blocks...mention X"
      expect(result.intent).toBe("highlight");
      expect(result.entities.keyword).toBe("market");
    });

    it("should parse highlight all block type prompts", () => {
      const result = parsePrompt("Highlight all assumptions");
      expect(result.intent).toBe("highlight");
      // Block type is normalized to singular form
      expect(result.entities.blockType).toBe("assumption");
    });

    it("should parse filter prompts for graph types", () => {
      const result = parsePrompt("Show only the solution graph");
      expect(result.intent).toBe("filter");
      expect(result.entities.graphType).toBe("solution");
    });

    it("should parse filter prompts for market graph", () => {
      const result = parsePrompt("Filter to market");
      expect(result.intent).toBe("filter");
      expect(result.entities.graphType).toBe("market");
    });

    it("should parse status update prompts", () => {
      const result = parsePrompt("Mark the market block as validated");
      expect(result.intent).toBe("update_status");
      expect(result.entities.sourceBlock).toBe("market");
      expect(result.entities.status).toBe("validated");
    });

    it("should parse set status variation", () => {
      const result = parsePrompt("Set the solution block status to draft");
      expect(result.intent).toBe("update_status");
      expect(result.entities.sourceBlock).toBe("solution");
      expect(result.entities.status).toBe("draft");
    });

    it("should return unknown for ambiguous prompts", () => {
      const result = parsePrompt("Do something");
      expect(result.intent).toBe("unknown");
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe("findBlocksByKeyword", () => {
    it("should find blocks by content keyword", () => {
      const results = findBlocksByKeyword(testBlocks, "market");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((b) => b.id === "block_market")).toBe(true);
    });

    it("should find blocks by property keyword", () => {
      const results = findBlocksByKeyword(testBlocks, "Legal");
      expect(results.some((b) => b.id === "block_market")).toBe(true);
    });

    it("should be case insensitive", () => {
      const results = findBlocksByKeyword(testBlocks, "REVENUE");
      expect(results.some((b) => b.id === "block_revenue")).toBe(true);
    });

    it("should return empty array when no matches", () => {
      const results = findBlocksByKeyword(testBlocks, "nonexistent");
      expect(results).toHaveLength(0);
    });
  });

  describe("findBlocksByType", () => {
    it("should find blocks by type", () => {
      const results = findBlocksByType(testBlocks, "assumption");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("block_assumption_001");
    });

    it("should find all content blocks", () => {
      const results = findBlocksByType(testBlocks, "content");
      expect(results.length).toBe(5);
    });
  });

  describe("findBlockByName", () => {
    it("should find block by partial name match in id", () => {
      const result = findBlockByName(testBlocks, "market");
      expect(result).toBeDefined();
      expect(result?.id).toBe("block_market");
    });

    it("should find block by property match", () => {
      const result = findBlockByName(testBlocks, "solution");
      expect(result).toBeDefined();
      expect(result?.id).toBe("block_solution");
    });

    it("should return undefined for no match", () => {
      const result = findBlockByName(testBlocks, "nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("processGraphPrompt", () => {
    it("should create a link between blocks", async () => {
      const result = await processGraphPrompt(
        "Link the solution block to the problem block",
        testBlocks,
      );

      expect(result.action).toBe("link_created");
      expect(result.link).toBeDefined();
      expect(result.link?.source).toBe("block_solution");
      expect(result.link?.target).toBe("block_problem");
    });

    it("should highlight matching nodes for query", async () => {
      const result = await processGraphPrompt(
        "What blocks mention market?",
        testBlocks,
      );

      expect(result.action).toBe("highlight");
      expect(result.nodeIds).toBeDefined();
      expect(result.nodeIds).toContain("block_market");
    });

    it("should apply filters for filter requests", async () => {
      const result = await processGraphPrompt(
        "Show only the solution graph",
        testBlocks,
      );

      expect(result.action).toBe("filter");
      expect(result.filters).toBeDefined();
      expect(result.filters?.graphType).toEqual(["solution"]);
    });

    it("should update block status", async () => {
      const result = await processGraphPrompt(
        "Mark the market block as validated",
        testBlocks,
      );

      expect(result.action).toBe("block_updated");
      expect(result.block).toBeDefined();
      expect(result.block?.status).toBe("validated");
    });

    it("should return clarification for ambiguous requests", async () => {
      const result = await processGraphPrompt("Do something", testBlocks);

      expect(result.action).toBe("clarification_needed");
      expect(result.message).toContain("Could you be more specific");
    });

    it("should return clarification when block not found", async () => {
      const result = await processGraphPrompt(
        "Link the nonexistent block to the market block",
        testBlocks,
      );

      expect(result.action).toBe("clarification_needed");
      expect(result.message).toContain("Could not find");
    });

    it("should handle highlight assumptions", async () => {
      const result = await processGraphPrompt(
        "Highlight all assumptions",
        testBlocks,
      );

      // This should find the assumption block
      expect(result.action).toBe("highlight");
      expect(result.nodeIds).toBeDefined();
    });

    it("should filter by risk graph", async () => {
      const result = await processGraphPrompt(
        "Show only risk blocks",
        testBlocks,
      );

      expect(result.action).toBe("filter");
      expect(result.filters?.graphType).toEqual(["risk"]);
    });
  });
});

describe("Test Suite 5 Pass Criteria", () => {
  const testBlocks: Block[] = [
    {
      id: "block_market",
      type: "content",
      content: "Market is $50B",
      properties: { market: "Legal tech" },
      status: "active",
    },
    {
      id: "block_solution",
      type: "content",
      content: "AI-powered search",
      properties: { solution: "AI tool" },
      status: "active",
    },
    {
      id: "block_assumption",
      type: "assumption",
      content: "Users will adopt",
      properties: {},
      status: "active",
    },
  ];

  describe("Pass Criteria Validation", () => {
    it("Link creation prompts work", async () => {
      const result = await processGraphPrompt(
        "Link the solution block to the market block",
        testBlocks,
      );
      expect(result.action).toBe("link_created");
      expect(result.link).toMatchObject({
        source: "block_solution",
        target: "block_market",
      });
    });

    it("Query/highlight prompts work", async () => {
      const result = await processGraphPrompt(
        "What blocks mention market?",
        testBlocks,
      );
      expect(result.action).toBe("highlight");
      expect(result.nodeIds).toContain("block_market");
    });

    it("Filter prompts work", async () => {
      const result = await processGraphPrompt(
        "Show only the solution graph",
        testBlocks,
      );
      expect(result.action).toBe("filter");
      expect(result.filters).toMatchObject({
        graphType: ["solution"],
      });
    });

    it("Status update prompts work", async () => {
      const result = await processGraphPrompt(
        "Mark the market block as validated",
        testBlocks,
      );
      expect(result.action).toBe("block_updated");
      expect(result.block?.status).toBe("validated");
    });

    it("Ambiguous prompts request clarification", async () => {
      const result = await processGraphPrompt("Do something", testBlocks);
      expect(result.action).toBe("clarification_needed");
      expect(result.message).toContain("Could you be more specific");
    });
  });
});
