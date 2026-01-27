/**
 * Tests for Analysis Prompt Builder - Supersession Handling
 *
 * These tests verify that the analysis prompt builder correctly includes
 * supersession info in prompts and parses supersedes links from AI responses.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from "../../server/services/graph/analysis-prompt-builder.js";
import type {
  SourceCollectionResult,
  CollectedSource,
} from "../../server/services/graph/source-collector.js";

describe("Analysis Prompt Builder - Supersession", () => {
  describe("buildAnalysisPrompt - supersession info formatting", () => {
    test("includes supersession info in formatted prompt", () => {
      const sources: CollectedSource[] = [
        {
          id: "insight_vue",
          type: "conversation_insight",
          content: "Use Vue.js for frontend development",
          weight: 0.9,
          metadata: {
            insightType: "decision",
            title: "Switch to Vue.js",
            supersedes: {
              insightId: "insight_react",
              reason: "Simpler learning curve for the team",
            },
          },
        },
      ];

      const collectionResult: SourceCollectionResult = {
        sources,
        totalTokenEstimate: 100,
        truncated: false,
        collectionMetadata: {
          conversationCount: 0,
          conversationInsightCount: 1,
          artifactCount: 0,
          memoryFileCount: 0,
          userBlockCount: 0,
        },
      };

      const prompt = buildAnalysisPrompt(collectionResult, []);

      // Verify supersession info is included
      expect(prompt.userPrompt).toContain("SUPERSEDES: insight_react");
      expect(prompt.userPrompt).toContain("Simpler learning curve");
    });

    test("does not include supersession info when not present", () => {
      const sources: CollectedSource[] = [
        {
          id: "insight_regular",
          type: "conversation_insight",
          content: "Some regular insight without supersession",
          weight: 0.8,
          metadata: {
            insightType: "fact",
            title: "Regular Insight",
          },
        },
      ];

      const collectionResult: SourceCollectionResult = {
        sources,
        totalTokenEstimate: 50,
        truncated: false,
        collectionMetadata: {
          conversationCount: 0,
          conversationInsightCount: 1,
          artifactCount: 0,
          memoryFileCount: 0,
          userBlockCount: 0,
        },
      };

      const prompt = buildAnalysisPrompt(collectionResult, []);

      // Should not contain supersession markers
      expect(prompt.userPrompt).not.toContain("SUPERSEDES:");
    });

    test("includes supersedes link type in instructions", () => {
      const collectionResult: SourceCollectionResult = {
        sources: [],
        totalTokenEstimate: 0,
        truncated: false,
        collectionMetadata: {
          conversationCount: 0,
          conversationInsightCount: 0,
          artifactCount: 0,
          memoryFileCount: 0,
          userBlockCount: 0,
        },
      };

      const prompt = buildAnalysisPrompt(collectionResult, []);

      // Verify supersedes is listed as a valid link type
      expect(prompt.userPrompt).toContain('"supersedes"');
      expect(prompt.userPrompt).toContain(
        "supersedes", // Link type should be mentioned
      );
    });
  });

  describe("parseAnalysisResponse - supersession parsing", () => {
    test("parses supersedes link from AI response", () => {
      const aiResponse = `{
        "context": { "who": "User", "what": "Tech decisions", "when": "now", "where": "chat", "why": "planning" },
        "proposedChanges": [
          {
            "id": "block_vue",
            "type": "create_block",
            "blockType": "decision",
            "content": "Use Vue.js for frontend",
            "confidence": 0.9,
            "supersedesBlockId": "block_react",
            "supersessionReason": "User changed preference"
          },
          {
            "id": "link_supersedes",
            "type": "create_link",
            "sourceBlockId": "block_vue",
            "targetBlockId": "block_react",
            "linkType": "supersedes",
            "confidence": 0.95,
            "reason": "User changed decision due to simpler learning curve"
          }
        ],
        "cascadeEffects": []
      }`;

      const parsed = parseAnalysisResponse(aiResponse);

      expect(parsed).not.toBeNull();
      expect(parsed!.proposedChanges).toHaveLength(2);

      // Check the block with supersession
      const blockChange = parsed!.proposedChanges.find(
        (c) => c.type === "create_block",
      );
      expect(blockChange?.supersedesBlockId).toBe("block_react");
      expect(blockChange?.supersessionReason).toBe("User changed preference");

      // Check the supersedes link
      const linkChange = parsed!.proposedChanges.find(
        (c) => c.type === "create_link",
      );
      expect(linkChange?.linkType).toBe("supersedes");
      expect(linkChange?.sourceBlockId).toBe("block_vue");
      expect(linkChange?.targetBlockId).toBe("block_react");
    });

    test("parses status change for superseded block", () => {
      const aiResponse = `{
        "context": { "who": "User", "what": "Tech", "when": "now", "where": "chat", "why": "plan" },
        "proposedChanges": [
          {
            "id": "change_status",
            "type": "update_block",
            "blockId": "block_react",
            "statusChange": {
              "newStatus": "superseded",
              "reason": "Replaced by Vue decision"
            }
          }
        ],
        "cascadeEffects": []
      }`;

      const parsed = parseAnalysisResponse(aiResponse);

      expect(parsed).not.toBeNull();
      expect(parsed!.proposedChanges).toHaveLength(1);

      const statusChange = parsed!.proposedChanges.find(
        (c) => c.type === "update_block",
      );
      expect(statusChange?.statusChange?.newStatus).toBe("superseded");
      expect(statusChange?.statusChange?.reason).toBe(
        "Replaced by Vue decision",
      );
    });

    test("handles response without supersession data", () => {
      const aiResponse = `{
        "context": { "who": "User", "what": "General", "when": "now", "where": "chat", "why": "discussion" },
        "proposedChanges": [
          {
            "id": "block_1",
            "type": "create_block",
            "blockType": "context",
            "content": "Some context information",
            "confidence": 0.8
          }
        ],
        "cascadeEffects": []
      }`;

      const parsed = parseAnalysisResponse(aiResponse);

      expect(parsed).not.toBeNull();
      expect(parsed!.proposedChanges).toHaveLength(1);

      const block = parsed!.proposedChanges[0];
      expect(block.supersedesBlockId).toBeUndefined();
      expect(block.statusChange).toBeUndefined();
    });

    test("defaults supersessionReason when supersedesBlockId is present", () => {
      const aiResponse = `{
        "context": { "who": "User", "what": "Test", "when": "now", "where": "chat", "why": "test" },
        "proposedChanges": [
          {
            "id": "block_new",
            "type": "create_block",
            "blockType": "decision",
            "content": "New decision",
            "confidence": 0.9,
            "supersedesBlockId": "block_old"
          }
        ],
        "cascadeEffects": []
      }`;

      const parsed = parseAnalysisResponse(aiResponse);

      expect(parsed).not.toBeNull();
      const block = parsed!.proposedChanges[0];
      expect(block.supersedesBlockId).toBe("block_old");
      expect(block.supersessionReason).toBe("Decision changed"); // Default value
    });
  });

  describe("ProposedChange interface", () => {
    test("interface supports all supersession fields", () => {
      // This is a type-level test to ensure the interface has the correct shape
      const aiResponse = `{
        "context": { "who": "User", "what": "Test", "when": "now", "where": "chat", "why": "test" },
        "proposedChanges": [
          {
            "id": "block_1",
            "type": "create_block",
            "blockType": "decision",
            "title": "New Decision",
            "content": "Decision content",
            "graphMembership": ["business"],
            "confidence": 0.9,
            "sourceId": "src_1",
            "sourceType": "conversation_insight",
            "sourceWeight": 0.9,
            "supersedesBlockId": "old_block",
            "supersessionReason": "Changed mind"
          }
        ],
        "cascadeEffects": []
      }`;

      const parsed = parseAnalysisResponse(aiResponse);
      const block = parsed!.proposedChanges[0];

      // All fields should be accessible
      expect(block.id).toBe("block_1");
      expect(block.type).toBe("create_block");
      expect(block.blockType).toBe("decision");
      expect(block.supersedesBlockId).toBe("old_block");
      expect(block.supersessionReason).toBe("Changed mind");
    });
  });
});
