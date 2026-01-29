import {
  IdeationSession,
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  IdeaCandidate,
  ViabilityRisk,
} from "../../types/ideation.js";
import { sessionManager } from "./session-manager.js";
import { memoryManager } from "./memory-manager.js";
import { messageStore } from "./message-store.js";

/**
 * HANDOFF MODULE
 *
 * Prepares context for seamless agent handoffs when approaching token limits.
 * Ensures continuity of conversation with no user-visible interruption.
 */

export interface HandoffState {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
  candidate: IdeaCandidate | null;
  risks: ViabilityRisk[];
}

export interface HandoffResult {
  success: boolean;
  handoffId: string;
  memoryFilesCreated: number;
  tokensSaved: number;
}

/**
 * Prepare for handoff by saving all state to memory files.
 */
export async function prepareHandoff(
  session: IdeationSession,
  state: HandoffState,
): Promise<HandoffResult> {
  const handoffId = `handoff-${session.handoffCount + 1}`;

  // Generate conversation summary from recent messages
  const messages = await messageStore.getRecent(session.id, 20);
  const conversationSummary = generateConversationSummary(messages, state);

  // Update all memory files
  await memoryManager.updateAll(session.id, {
    selfDiscovery: state.selfDiscovery,
    marketDiscovery: state.marketDiscovery,
    narrowingState: state.narrowingState,
    candidate: state.candidate,
  });

  // Create handoff summary
  await memoryManager.createHandoffSummary(session.id, conversationSummary);

  // Increment handoff count
  await sessionManager.incrementHandoff(session.id);

  // Calculate tokens saved by summarizing
  const originalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0);
  const summaryTokens = Math.ceil(conversationSummary.length / 4); // Rough estimate
  const tokensSaved = Math.max(0, originalTokens - summaryTokens);

  return {
    success: true,
    handoffId,
    memoryFilesCreated: 4, // self_discovery, market_discovery, narrowing_state, idea_candidate
    tokensSaved,
  };
}

/**
 * Generate a conversation summary for handoff.
 */
function generateConversationSummary(
  messages: { role: string; content: string }[],
  state: HandoffState,
): string {
  const sections: string[] = [];

  // Recent conversation highlights
  sections.push("## Recent Conversation");
  const recentExchanges = messages.slice(-10);
  recentExchanges.forEach((m) => {
    const prefix = m.role === "user" ? "User" : "Agent";
    // Truncate long messages
    const content =
      m.content.length > 200 ? m.content.slice(0, 200) + "..." : m.content;
    sections.push(`**${prefix}:** ${content}`);
  });

  // Current state summary
  sections.push("\n## Current State");

  // Candidate status
  if (state.candidate) {
    sections.push(`- **Active Candidate:** ${state.candidate.title}`);
    if (state.candidate.summary) {
      sections.push(`- **Summary:** ${state.candidate.summary}`);
    }
  } else {
    sections.push("- No candidate formed yet, still exploring");
  }

  // Key discoveries
  if (state.selfDiscovery.frustrations.length > 0) {
    sections.push(
      `- **Key Frustrations:** ${state.selfDiscovery.frustrations.map((f) => f.description).join("; ")}`,
    );
  }

  if (state.selfDiscovery.expertise.length > 0) {
    sections.push(
      `- **Expertise:** ${state.selfDiscovery.expertise.map((e) => e.area).join(", ")}`,
    );
  }

  // Narrowing progress
  const narrowed: string[] = [];
  if (state.narrowingState.productType.value)
    narrowed.push(`Product: ${state.narrowingState.productType.value}`);
  if (state.narrowingState.customerType.value)
    narrowed.push(`Customer: ${state.narrowingState.customerType.value}`);
  if (state.narrowingState.geography.value)
    narrowed.push(`Geography: ${state.narrowingState.geography.value}`);
  if (narrowed.length > 0) {
    sections.push(`- **Narrowing:** ${narrowed.join(", ")}`);
  }

  // Active risks
  if (state.risks.length > 0) {
    const criticalRisks = state.risks.filter(
      (r) => r.severity === "critical" || r.severity === "high",
    );
    if (criticalRisks.length > 0) {
      sections.push(
        `- **Active Risks:** ${criticalRisks.map((r) => r.description).join("; ")}`,
      );
    }
  }

  // Next steps
  sections.push("\n## Suggested Next Steps");
  if (state.narrowingState.questionsNeeded.length > 0) {
    sections.push("- Questions to ask:");
    state.narrowingState.questionsNeeded.slice(0, 3).forEach((q) => {
      sections.push(`  - ${q.question}`);
    });
  } else if (!state.candidate) {
    sections.push("- Continue exploring to form an idea candidate");
  } else if (state.risks.length > 0) {
    sections.push("- Address identified risks before proceeding");
  } else {
    sections.push("- Continue refining the current candidate");
  }

  return sections.join("\n");
}

/**
 * Check if handoff is needed based on token count.
 */
export function shouldHandoff(
  tokenCount: number,
  threshold: number = 80000,
): boolean {
  return tokenCount >= threshold;
}

/**
 * Load handoff context for a new agent instance.
 */
export async function loadHandoffContext(sessionId: string): Promise<{
  systemPromptAddition: string;
  recentMessages: { role: string; content: string }[];
}> {
  // Get all memory files
  const memoryFiles = await memoryManager.getAll(sessionId);

  // Build system prompt addition
  const memoryContent = memoryFiles
    .map(
      (f) => `## ${f.fileType.replace(/_/g, " ").toUpperCase()}\n${f.content}`,
    )
    .join("\n\n");

  const systemPromptAddition = `
## HANDOFF CONTEXT
You are continuing a conversation that was handed off from a previous agent instance.
The user is unaware of this handoff. Continue naturally.

${memoryContent}
`;

  // Get recent messages (just a few for continuity)
  const recentMessages = await messageStore.getRecent(sessionId, 5);
  const formattedMessages = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return {
    systemPromptAddition,
    recentMessages: formattedMessages,
  };
}

/**
 * Clean up old messages after successful handoff.
 */
export async function cleanupAfterHandoff(
  sessionId: string,
  keepRecentCount: number = 10,
): Promise<{ deletedCount: number }> {
  const messages = await messageStore.getBySession(sessionId);

  if (messages.length <= keepRecentCount) {
    return { deletedCount: 0 };
  }

  // Keep the most recent messages
  const cutoffMessage = messages[messages.length - keepRecentCount];
  const deletedCount = await messageStore.deleteOlderThan(
    sessionId,
    cutoffMessage.id,
  );

  return { deletedCount };
}
