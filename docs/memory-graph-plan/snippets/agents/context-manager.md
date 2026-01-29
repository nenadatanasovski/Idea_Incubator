# Context Manager

Create `agents/ideation/context-manager.ts` (replaces `handoff.ts`):

```typescript
/**
 * ContextManager
 *
 * Manages context limits and prompts users to save insights to graph.
 * Replaces the handoff mechanism.
 */

import { blockExtractor } from "./block-extractor";
import { messageStore } from "./message-store";

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
    ideaId: string,
  ): Promise<SaveResult> {
    try {
      // Get messages that haven't been extracted yet
      const messages = await messageStore.getBySession(sessionId);

      // Filter to assistant messages (they contain the insights)
      const assistantMessages = messages.filter((m) => m.role === "assistant");

      let totalBlocksCreated = 0;
      let totalLinksCreated = 0;

      // Extract blocks from each message
      for (const message of assistantMessages) {
        // Check if already extracted (has blocks linked to this message)
        const existingBlocks = await blockExtractor.getBlocksForMessage(
          message.id,
        );
        if (existingBlocks.length > 0) {
          continue; // Already extracted
        }

        // Extract new blocks
        const result = await blockExtractor.extractFromMessage(
          sessionId,
          ideaId,
          message.id,
          message.content,
        );

        totalBlocksCreated += result.blocksCreated;
        totalLinksCreated += result.linksCreated;
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
      await import("../../server/services/graph/graph-query-service");

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
```

## Orchestrator Integration

```typescript
// In orchestrator.ts, replace handoff imports and calls:

// Before:
import { prepareHandoff } from "./handoff";

// After:
import { contextManager } from "./context-manager";

// When checking token limits:
const status = contextManager.checkContextStatus(tokensUsed, tokenLimit);
if (status.shouldPromptSave) {
  // Return prompt to frontend
  return {
    type: "context_limit_prompt",
    message: contextManager.generateSavePrompt(),
  };
}
```
