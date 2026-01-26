/**
 * Tests for Report Generator service
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  reportGenerator,
  buildReportPrompt,
  parseReportResponse,
  computeGroupHash,
} from "../../../server/services/graph/report-generator.js";

describe("Report Generator", () => {
  const mockNodes = [
    {
      id: "n1",
      title: "Market validation needed",
      content: "We need to validate market size before proceeding",
      type: "problem",
    },
    {
      id: "n2",
      title: "Survey approach",
      content: "Use customer surveys to validate market assumptions",
      type: "solution",
    },
    {
      id: "n3",
      title: "Cost concerns",
      content: "Surveys can be expensive, need budget consideration",
      type: "risk",
    },
  ];

  const mockEdges = [
    { id: "e1", source: "n2", target: "n1", linkType: "addresses" },
    { id: "e2", source: "n3", target: "n2", linkType: "contradicts" },
  ];

  describe("computeGroupHash", () => {
    it("should generate consistent hash for same node IDs", () => {
      const hash1 = computeGroupHash(["n1", "n2", "n3"]);
      const hash2 = computeGroupHash(["n1", "n2", "n3"]);

      expect(hash1).toBe(hash2);
    });

    it("should generate same hash regardless of input order", () => {
      const hash1 = computeGroupHash(["n1", "n2", "n3"]);
      const hash2 = computeGroupHash(["n3", "n1", "n2"]);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different node IDs", () => {
      const hash1 = computeGroupHash(["n1", "n2"]);
      const hash2 = computeGroupHash(["n1", "n3"]);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle single node", () => {
      const hash = computeGroupHash(["n1"]);
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("buildReportPrompt", () => {
    it("should include all node titles in the prompt", () => {
      const { user } = buildReportPrompt(mockNodes, mockEdges);

      expect(user).toContain("Market validation needed");
      expect(user).toContain("Survey approach");
      expect(user).toContain("Cost concerns");
    });

    it("should include node content in the prompt", () => {
      const { user } = buildReportPrompt(mockNodes, mockEdges);

      expect(user).toContain("validate market size");
      expect(user).toContain("customer surveys");
    });

    it("should include edge relationships", () => {
      const { user } = buildReportPrompt(mockNodes, mockEdges);

      expect(user).toContain("addresses");
      expect(user).toContain("contradicts");
    });

    it("should include node types", () => {
      const { user } = buildReportPrompt(mockNodes, mockEdges);

      expect(user).toContain("problem");
      expect(user).toContain("solution");
      expect(user).toContain("risk");
    });

    it("should have proper system prompt", () => {
      const { system } = buildReportPrompt(mockNodes, mockEdges);

      expect(system).toContain("analyst");
      expect(system).toContain("JSON");
    });

    it("should include other group summaries when provided", () => {
      const otherGroups = [
        {
          groupHash: "hash1",
          groupName: "Technical Group",
          overview: "Technical implementation details",
        },
      ];

      const { user } = buildReportPrompt(mockNodes, mockEdges, otherGroups);

      expect(user).toContain("Technical Group");
      expect(user).toContain("Technical implementation details");
    });
  });

  describe("parseReportResponse", () => {
    it("should extract all sections from valid JSON response", () => {
      const mockResponse = JSON.stringify({
        groupName: "Market Validation",
        overview: "This group focuses on market validation approaches.",
        keyThemes: ["validation", "cost", "surveys"],
        story:
          'The "Market validation needed" problem is addressed by "Survey approach".',
        relationshipsToGroups: [],
        openQuestions: ["How to reduce survey costs?"],
        nodesSummary: [
          {
            nodeId: "n1",
            title: "Market validation needed",
            oneLiner: "Core problem to solve",
          },
        ],
      });

      const report = parseReportResponse(mockResponse);

      expect(report.groupName).toBe("Market Validation");
      expect(report.overview).toBe(
        "This group focuses on market validation approaches.",
      );
      expect(report.keyThemes).toHaveLength(3);
      expect(report.keyThemes).toContain("validation");
      expect(report.story).toContain('"Market validation needed"');
      expect(report.openQuestions).toHaveLength(1);
      expect(report.nodesSummary).toHaveLength(1);
      expect(report.nodesSummary[0].nodeId).toBe("n1");
    });

    it("should handle response with markdown code block wrapper", () => {
      const mockResponse = `\`\`\`json
{
  "groupName": "Test Group",
  "overview": "Test overview",
  "keyThemes": ["theme1"],
  "story": "Test story",
  "relationshipsToGroups": [],
  "openQuestions": [],
  "nodesSummary": []
}
\`\`\``;

      const report = parseReportResponse(mockResponse);

      expect(report.groupName).toBe("Test Group");
      expect(report.overview).toBe("Test overview");
    });

    it("should throw error for invalid JSON", () => {
      expect(() => parseReportResponse("not valid json")).toThrow();
    });

    it("should handle empty arrays gracefully", () => {
      const mockResponse = JSON.stringify({
        groupName: "Empty Group",
        overview: "No content",
        keyThemes: [],
        story: "",
        relationshipsToGroups: [],
        openQuestions: [],
        nodesSummary: [],
      });

      const report = parseReportResponse(mockResponse);

      expect(report.keyThemes).toHaveLength(0);
      expect(report.openQuestions).toHaveLength(0);
      expect(report.nodesSummary).toHaveLength(0);
    });

    it("should preserve node title references in story", () => {
      const mockResponse = JSON.stringify({
        groupName: "Test",
        overview: "Test",
        keyThemes: [],
        story:
          'The insight "Market validation needed" connects to "Survey approach" which is challenged by "Cost concerns".',
        relationshipsToGroups: [],
        openQuestions: [],
        nodesSummary: [],
      });

      const report = parseReportResponse(mockResponse);

      expect(report.story).toContain('"Market validation needed"');
      expect(report.story).toContain('"Survey approach"');
      expect(report.story).toContain('"Cost concerns"');
    });
  });

  describe("markReportsStale", () => {
    it("should be callable", async () => {
      // This is a database operation, so we just verify the function exists
      expect(typeof reportGenerator.markReportsStale).toBe("function");
    });
  });

  describe("getReportForNode", () => {
    it("should be callable", async () => {
      expect(typeof reportGenerator.getReportForNode).toBe("function");
    });
  });

  describe("getReportsForSession", () => {
    it("should be callable", async () => {
      expect(typeof reportGenerator.getReportsForSession).toBe("function");
    });
  });
});
