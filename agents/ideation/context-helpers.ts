// =============================================================================
// FILE: agents/ideation/context-helpers.ts
// =============================================================================

import type { IdeationMessage } from "../../types/ideation.js";

/**
 * Extracts surrounding context from message history
 */
export function extractSurroundingContext(
  messages: IdeationMessage[],
  messageIndex: number,
  windowSize: number = 2,
): string {
  const start = Math.max(0, messageIndex - windowSize);
  const end = Math.min(messages.length, messageIndex + windowSize + 1);

  return messages
    .slice(start, end)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

/**
 * Extracts the topic being discussed from recent context
 */
export function extractTopicFromContext(
  messages: IdeationMessage[],
  lastN: number = 3,
): string {
  const recentMessages = messages.slice(-lastN);

  // Simple heuristic: look for noun phrases in user messages
  const userContent = recentMessages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  // Extract key phrases (simplified)
  const phrases = userContent.match(/\b[A-Z][a-z]+(?:\s+[a-z]+)*\b/g) || [];

  return phrases.slice(0, 3).join(", ") || "the current topic";
}

/**
 * Generates a brief summary of conversation for handoff notes
 */
export function generateBriefSummary(
  messages: IdeationMessage[],
  maxLength: number = 500,
): string {
  if (messages.length === 0) return "No conversation yet.";

  const userMessages = messages.filter((m) => m.role === "user");

  const keyPoints: string[] = [];

  // First user message often sets the tone
  if (userMessages[0]) {
    keyPoints.push(
      `Started with: "${userMessages[0].content.slice(0, 100)}..."`,
    );
  }

  // Count message exchanges
  keyPoints.push(`${messages.length} total messages exchanged.`);

  // Last topic discussed
  if (userMessages.length > 1) {
    const lastUser = userMessages[userMessages.length - 1].content;
    keyPoints.push(`Last discussed: "${lastUser.slice(0, 100)}..."`);
  }

  const summary = keyPoints.join(" ");
  return summary.slice(0, maxLength);
}

/**
 * Extracts keywords from user messages for search queries
 */
export function extractKeywordsForSearch(
  messages: IdeationMessage[],
  maxKeywords: number = 5,
): string[] {
  const userContent = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  // Simple keyword extraction: look for capitalized words and common nouns
  const words = userContent.split(/\s+/);
  const keywords: Map<string, number> = new Map();

  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (cleaned.length > 3) {
      keywords.set(cleaned, (keywords.get(cleaned) || 0) + 1);
    }
  }

  // Sort by frequency and return top N
  return Array.from(keywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Gets the last N messages for context window
 */
export function getRecentMessages(
  messages: IdeationMessage[],
  count: number = 10,
): IdeationMessage[] {
  return messages.slice(-count);
}

/**
 * Formats messages for LLM context
 */
export function formatMessagesForContext(
  messages: IdeationMessage[],
  includeMetadata: boolean = false,
): string {
  return messages
    .map((m) => {
      const roleLabel =
        m.role === "user"
          ? "User"
          : m.role === "assistant"
            ? "Assistant"
            : "System";
      const metadata = includeMetadata ? ` [${m.createdAt.toISOString()}]` : "";
      return `${roleLabel}${metadata}: ${m.content}`;
    })
    .join("\n\n");
}

/**
 * Checks if a topic has been discussed
 */
export function hasDiscussedTopic(
  messages: IdeationMessage[],
  topicKeywords: string[],
): boolean {
  const allContent = messages.map((m) => m.content.toLowerCase()).join(" ");

  return topicKeywords.some((keyword) =>
    allContent.includes(keyword.toLowerCase()),
  );
}

/**
 * Counts user confirmations/agreements
 */
export function countUserConfirmations(messages: IdeationMessage[]): number {
  const confirmationPatterns = [
    /\byes\b/i,
    /\byeah\b/i,
    /\bexactly\b/i,
    /\bthat's right\b/i,
    /\bcorrect\b/i,
    /\bperfect\b/i,
    /\bi agree\b/i,
    /\bsounds good\b/i,
    /\blet's do it\b/i,
    /\bi like\b/i,
  ];

  return messages
    .filter((m) => m.role === "user")
    .filter((m) =>
      confirmationPatterns.some((pattern) => pattern.test(m.content)),
    ).length;
}
