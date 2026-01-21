/**
 * FOLLOW-UP QUESTION GENERATOR
 *
 * Generates contextual follow-up questions when the main response
 * lacks engagement (no question, no buttons, no form).
 *
 * Uses the full ideation agent framework with memory context,
 * conversation history, and system prompt for coherent follow-ups.
 */

import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { ButtonOption } from "../../types/ideation.js";
import { FollowUpContext } from "./orchestrator.js";
import { memoryManager } from "./memory-manager.js";
import { messageStore } from "./message-store.js";
import { candidateManager } from "./candidate-manager.js";

export interface FollowUpResponse {
  text: string;
  buttons?: ButtonOption[];
}

/**
 * Generate a contextual follow-up question using the full ideation context.
 * Loads memory files, conversation history, and uses the system prompt.
 */
export async function generateFollowUp(
  context: FollowUpContext,
): Promise<FollowUpResponse> {
  try {
    // Load full session context
    const [memoryState, messages, candidate] = await Promise.all([
      memoryManager.loadState(context.sessionId),
      messageStore.getBySession(context.sessionId),
      candidateManager.getActiveForSession(context.sessionId),
    ]);

    // Build context summary from memory
    const contextParts: string[] = [];

    if (memoryState.selfDiscovery) {
      const sd = memoryState.selfDiscovery;
      if (sd.expertise?.length) {
        contextParts.push(
          `User expertise: ${sd.expertise.map((e) => e.area).join(", ")}`,
        );
      }
      if (sd.interests?.length) {
        contextParts.push(
          `User interests: ${sd.interests.map((i) => i.topic).join(", ")}`,
        );
      }
      if (sd.frustrations?.length) {
        contextParts.push(
          `User frustrations: ${sd.frustrations.map((f) => f.description).join("; ")}`,
        );
      }
    }

    if (memoryState.narrowingState) {
      const ns = memoryState.narrowingState;
      if (ns.customerType?.value) {
        contextParts.push(`Target customer: ${ns.customerType.value}`);
      }
      if (ns.productType?.value) {
        contextParts.push(`Product type: ${ns.productType.value}`);
      }
    }

    if (candidate) {
      contextParts.push(`Current idea: "${candidate.title}"`);
      if (candidate.summary) {
        contextParts.push(`Summary: ${candidate.summary}`);
      }
    }

    // Build conversation history (last 6 messages for context)
    const recentMessages = messages.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Add follow-up specific instruction
    const followUpInstruction = buildFollowUpInstruction(context, contextParts);

    // Use a minimal system prompt for follow-ups - we want SHORT questions only
    const minimalSystemPrompt = `You are generating a brief follow-up question for an ideation conversation. Your ONLY job is to output a single short question (1-2 sentences max) to keep the conversation flowing. Do NOT provide explanations, analysis, frameworks, or lengthy responses.`;

    const response = await anthropicClient.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 100, // Reduced from 400 to enforce brevity
      system: minimalSystemPrompt,
      messages: [
        ...recentMessages,
        {
          role: "user",
          content: followUpInstruction,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return getFallbackFollowUp(context);
    }

    // Parse the response - look for JSON or plain text
    const responseText = textContent.text.trim();

    // Try to extract JSON if present
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.text && parsed.text.endsWith("?")) {
          return {
            text: parsed.text,
            buttons: parsed.buttons || undefined,
          };
        }
      } catch {
        // Not valid JSON, continue to plain text parsing
      }
    }

    // Extract just the question if plain text
    // Look for the last sentence ending with ?
    const questionMatch = responseText.match(/[^.!?]*\?/g);
    if (questionMatch && questionMatch.length > 0) {
      const lastQuestion = questionMatch[questionMatch.length - 1].trim();
      return { text: lastQuestion };
    }

    // If no question found, use fallback
    return getFallbackFollowUp(context);
  } catch (error) {
    console.error("[FollowUpGenerator] Error generating follow-up:", error);
    return getFallbackFollowUp(context);
  }
}

/**
 * Build the follow-up instruction based on context.
 */
function buildFollowUpInstruction(
  context: FollowUpContext,
  sessionContext: string[],
): string {
  let situationContext = "";

  switch (context.reason) {
    case "artifact_created":
      situationContext = `You just created a ${context.artifactType || "visual"} artifact${context.artifactTitle ? ` titled "${context.artifactTitle}"` : ""}.`;
      break;
    case "search_initiated":
      situationContext = `You just initiated a web search for: ${context.searchQueries?.join(", ") || "market research"}.`;
      break;
    case "no_question":
    default:
      situationContext = `You just provided a response to the user.`;
  }

  const contextSummary =
    sessionContext.length > 0
      ? `\n\nSession context:\n- ${sessionContext.join("\n- ")}`
      : "";

  return `Generate a SHORT follow-up question (one sentence only).

Context: ${situationContext}
User said: "${context.lastUserMessage}"
${contextSummary}

CRITICAL: Output ONLY a brief question. No explanations, no frameworks, no analysis. Just one question ending with "?"

Example good outputs:
- "What aspect would you like to explore first?"
- "Does this direction feel right to you?"
- "What's your biggest concern about this approach?"

Respond with JSON: {"text": "Your one-sentence question here?"}`;
}

/**
 * Get a fallback follow-up question when generation fails.
 */
function getFallbackFollowUp(context: FollowUpContext): FollowUpResponse {
  switch (context.reason) {
    case "artifact_created":
      return {
        text: "What aspects of this would you like to explore further?",
        buttons: [
          {
            id: "refine",
            label: "Refine this",
            value: "refine",
            style: "secondary",
          },
          {
            id: "explore_more",
            label: "Explore another angle",
            value: "explore_more",
            style: "secondary",
          },
          {
            id: "move_on",
            label: "Move on",
            value: "move_on",
            style: "outline",
          },
        ],
      };

    case "search_initiated":
      return {
        text: "While I'm pulling that data, is there anything specific you're hoping to find or validate?",
      };

    case "no_question":
    default:
      return {
        text: "What would you like to explore next?",
        buttons: [
          {
            id: "dig_deeper",
            label: "Dig deeper",
            value: "dig_deeper",
            style: "secondary",
          },
          {
            id: "new_direction",
            label: "Try a new direction",
            value: "new_direction",
            style: "secondary",
          },
          {
            id: "summarize",
            label: "Summarize so far",
            value: "summarize",
            style: "outline",
          },
        ],
      };
  }
}

/**
 * Quick check if a message likely ends with engagement.
 * Used for fast pre-filtering before more expensive checks.
 */
export function hasEngagement(
  text: string,
  hasButtons: boolean,
  hasForm: boolean,
): boolean {
  if (hasButtons || hasForm) return true;
  const trimmed = text.trim();
  return trimmed.endsWith("?");
}
