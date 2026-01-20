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
import { buildSystemPrompt } from "./system-prompt.js";

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

    // Build the system prompt with follow-up instruction
    const systemPrompt = buildSystemPrompt({
      selfDiscovery: memoryState.selfDiscovery || {},
      marketDiscovery: memoryState.marketDiscovery || {},
      narrowing: memoryState.narrowingState || {},
      candidate: candidate
        ? { title: candidate.title, summary: candidate.summary || undefined }
        : undefined,
    });

    // Add follow-up specific instruction
    const followUpInstruction = buildFollowUpInstruction(context, contextParts);

    const response = await anthropicClient.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 400,
      system: systemPrompt,
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

  return `[SYSTEM INSTRUCTION - FOLLOW-UP REQUIRED]

${situationContext}

The user's last message was: "${context.lastUserMessage}"
${contextSummary}

Your previous response didn't end with a question or provide buttons for the user to continue. Generate a natural follow-up to keep the conversation flowing.

Requirements:
1. Ask a question that helps develop the idea further
2. Make it feel like a natural continuation, not a forced question
3. Consider what the user might want to explore next based on the context
4. Keep it concise (1-2 sentences)

Respond with JSON:
{
  "text": "Your follow-up question here?",
  "buttons": [{"id": "opt1", "label": "Label", "value": "value", "style": "secondary"}]
}

The buttons are optional - only include them if distinct choices make sense.`;
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
