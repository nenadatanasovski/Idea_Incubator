/**
 * Prompt Builder - Enhances agent prompts with historical context
 *
 * Injects relevant past sessions, error patterns, and success patterns
 * into agent system prompts when spawning with a task.
 */

import * as sessions from "../db/sessions.js";
import * as memory from "./index.js";
import {
  calculateRelevance,
  generateTaskSignature,
} from "../introspection/relevance.js";
import type { Task } from "../db/tasks.js";

/**
 * Build an enhanced prompt section with agent's relevant history.
 * Returns a string to be appended to the agent's system prompt.
 *
 * When a task is provided, injects:
 * - Top 5 relevant past sessions
 * - Known error patterns from memory
 * - Successful approaches from memory
 */
export function buildIntrospectionContext(
  agentId: string,
  task?: Task,
): string {
  const sections: string[] = [];

  if (!task) {
    return "";
  }

  // Generate task signature for similarity matching
  const sig = generateTaskSignature({
    title: task.title,
    category: task.category || undefined,
  });

  // 1. Relevant past sessions (top 5)
  const allSessions = sessions.getSessions({ agentId, limit: 50 });
  const scored = allSessions
    .map((session) => ({
      session,
      relevance: calculateRelevance(session, {
        taskSignature: sig.hash,
        currentTime: Date.now(),
      }),
    }))
    .filter((s) => s.relevance >= 0.3)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  if (scored.length > 0) {
    sections.push("## Relevant Past Sessions");
    sections.push("You have worked on similar tasks before:\n");

    for (const { session, relevance } of scored) {
      const summary = extractSessionSummary(session);
      const pct = Math.round(relevance * 100);
      sections.push(
        `- **Session ${session.id.substring(0, 8)}** (relevance: ${pct}%, status: ${session.status})`,
      );
      if (summary) {
        sections.push(`  ${summary}`);
      }
    }
    sections.push("");
  }

  // 2. Error patterns from agent memory
  const errorPatterns = memory.recallAll(agentId, "error_pattern");
  if (errorPatterns.length > 0) {
    sections.push("## Known Error Patterns");
    sections.push("Watch out for these based on your past experience:\n");

    for (const pattern of errorPatterns.slice(0, 3)) {
      let description = "";
      try {
        const details = JSON.parse(pattern.value);
        description = details.description || pattern.key;
      } catch {
        description = pattern.key;
      }
      sections.push(`- **${pattern.key}**: ${description}`);
    }
    sections.push("");
  }

  // 3. Success patterns from agent memory
  const successPatterns = memory.recallAll(agentId, "success_pattern");
  if (successPatterns.length > 0) {
    sections.push("## Successful Approaches");
    sections.push("These techniques have worked well for you:\n");

    for (const pattern of successPatterns.slice(0, 3)) {
      let description = "";
      try {
        const details = JSON.parse(pattern.value);
        description = details.description || pattern.key;
      } catch {
        description = pattern.key;
      }
      sections.push(`- **${pattern.key}**: ${description}`);
    }
    sections.push("");
  }

  if (sections.length === 0) {
    return "";
  }

  return "\n---\n\n# Agent Introspection Context\n\n" + sections.join("\n");
}

/**
 * Extract a concise summary from a session.
 */
function extractSessionSummary(session: sessions.AgentSession): string {
  let output = session.output || "";

  if (!output && session.metadata) {
    try {
      const meta = JSON.parse(session.metadata);
      output = meta.output || "";
    } catch {
      // Invalid metadata
    }
  }

  if (!output) return "";

  // Extract first sentence or truncate to 100 chars
  const firstSentence = output.match(/^[^.!?]+[.!?]/)?.[0];
  if (firstSentence && firstSentence.length <= 150) {
    return firstSentence;
  }
  return output.substring(0, 100) + (output.length > 100 ? "..." : "");
}

export default {
  buildIntrospectionContext,
};
