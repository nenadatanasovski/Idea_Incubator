/**
 * ContextManager
 *
 * Manages context limits and prompts users to save insights to graph.
 * Replaces the handoff mechanism.
 */

import { blockExtractor } from "./block-extractor.js";
import { messageStore } from "./message-store.js";

export interface ContextStatus {
  tokensUsed: number;
  tokenLimit: number;
  percentUsed: number;
  shouldPromptSave: boolean;
}

export interface SaveResult {
  blocksCreated: number;
  linksCreated: number;
  success: boolean;
  error?: string;
}

// Threshold at which to prompt user (90% of context)
const CONTEXT_THRESHOLD = 0.9;

export class ContextManager {
  /**
   * Check if context limit is approaching
   */
  checkContextStatus(tokensUsed: number, tokenLimit: number): ContextStatus {
    const percentUsed = tokensUsed / tokenLimit;

    return {
      tokensUsed,
      tokenLimit,
      percentUsed,
      shouldPromptSave: percentUsed >= CONTEXT_THRESHOLD,
    };
  }

  /**
   * Generate the prompt to show user when context limit is approaching
   */
  generateSavePrompt(): string {
    return `
## Context Limit Approaching

Your conversation is approaching the context limit. To continue without losing insights:

**[Save & Continue]** - Extract insights from this conversation into the memory graph, then start a fresh session with full context from the graph.

**[Continue Without Saving]** - Start a fresh session. Recent conversation insights will not be saved (but you can always come back to this session).

What would you like to do?
    `.trim();
  }

  /**
   * Save current conversation insights to memory graph
   */
  async saveConversationToGraph(
    sessionId: string,
    _ideaId: string,
  ): Promise<SaveResult> {
    try {
      // Get messages and existing blocks for the session
      const messages = await messageStore.getBySession(sessionId);
      const existingBlocks =
        await blockExtractor.getBlocksForSession(sessionId);

      // Filter to assistant messages (they contain the insights)
      const assistantMessages = messages.filter((m) => m.role === "assistant");

      let totalBlocksCreated = 0;
      let totalLinksCreated = 0;

      // Extract blocks from each message
      for (const message of assistantMessages) {
        // Extract new blocks
        const result = await blockExtractor.extractFromMessage(
          message,
          sessionId,
          existingBlocks,
        );

        totalBlocksCreated += result.blocks.length;
        totalLinksCreated += result.links.length;
      }

      return {
        blocksCreated: totalBlocksCreated,
        linksCreated: totalLinksCreated,
        success: true,
      };
    } catch (error) {
      return {
        blocksCreated: 0,
        linksCreated: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Prepare context for new session by querying graph
   */
  async prepareNewSessionContext(ideaId: string): Promise<string> {
    // Import here to avoid circular dependency
    const { graphQueryService } =
      await import("../../server/services/graph/graph-query-service.js");

    const result = await graphQueryService.query({
      ideaId,
      statuses: ["active", "validated"],
      minConfidence: 0.6,
      orderBy: "updated_at",
      order: "desc",
      limit: 50,
      includeStats: true,
    });

    const sections: string[] = [
      "# Session Context (from Memory Graph)",
      "",
      `Total blocks: ${result.stats?.totalBlocks || 0}`,
      "",
    ];

    // Group blocks by graph membership for readable context
    const byMembership = new Map<string, typeof result.blocks>();

    for (const block of result.blocks) {
      for (const membership of block.graphMemberships) {
        if (!byMembership.has(membership)) {
          byMembership.set(membership, []);
        }
        byMembership.get(membership)!.push(block);
      }
    }

    for (const [membership, blocks] of byMembership) {
      sections.push(
        `## ${membership.charAt(0).toUpperCase() + membership.slice(1)}`,
      );
      for (const block of blocks.slice(0, 5)) {
        sections.push(
          `- **${block.title || "Untitled"}**: ${block.content.substring(0, 150)}...`,
        );
      }
      sections.push("");
    }

    return sections.join("\n");
  }
}

export const contextManager = new ContextManager();
