/**
 * INTENT CLASSIFIER
 *
 * Uses Haiku 4.5 to classify user intent when options are presented.
 * No regex, no pattern matching - pure semantic understanding.
 */

import { runClaudeCliWithPrompt } from "../../utils/anthropic-client.js";

/**
 * The classified intent of a user's response.
 */
export interface IntentClassification {
  /**
   * The type of intent detected:
   * - execute_selection: User wants to run specific options (e.g., "1 and 3")
   * - execute_all: User wants to run all options (e.g., "all of them", "do everything")
   * - question: User is asking something (e.g., "why not all?", "what's the difference?")
   * - suggestion: User is proposing something different (e.g., "combine 1 and 3 into one")
   * - continue_conversation: General response, not a selection
   */
  intent:
    | "execute_selection"
    | "execute_all"
    | "question"
    | "suggestion"
    | "continue_conversation";

  /**
   * Which options the user selected (1-indexed), if intent is execute_selection.
   */
  selectedOptions?: number[];

  /**
   * The key decision: should we spawn sub-tasks/agents for parallel execution?
   */
  shouldSpawnSubtasks: boolean;

  /**
   * Should the main Claude conversation handle this response?
   * True for questions, suggestions, and general conversation.
   */
  respondWithClaude: boolean;

  /**
   * Brief explanation of the classification (for debugging/logging).
   */
  reasoning: string;
}

/**
 * Represents an option that was presented to the user.
 */
export interface PresentedOption {
  number: number;
  text: string;
}

/**
 * Classify the user's intent when responding to presented options.
 *
 * @param userMessage - The user's response message
 * @param presentedOptions - The options that were shown to the user
 * @param assistantContext - The assistant's message that presented the options
 * @returns Classification result with intent and action guidance
 */
export async function classifyUserIntent(
  userMessage: string,
  presentedOptions: PresentedOption[],
  assistantContext: string,
): Promise<IntentClassification> {
  const optionsText = presentedOptions
    .map((o) => `${o.number}. ${o.text}`)
    .join("\n");

  const prompt = `You are an intent classifier. Analyze the user's response to determine their intent.

## Context
The assistant presented these options to the user:
${optionsText}

Assistant's message context:
"${assistantContext.slice(-500)}"

## User's Response
"${userMessage}"

## Your Task
Classify the user's intent into ONE of these categories:

1. **execute_selection** - User clearly wants to RUN/DO specific numbered options
   Examples: "1", "do 1 and 3", "the first one", "options 2 and 4", "1, 2, and 3"

2. **execute_all** - User clearly wants to RUN/DO ALL options
   Examples: "all of them", "do everything", "run all", "yes do all 4", "let's do them all"

3. **question** - User is ASKING something, not commanding execution
   Examples: "why not all?", "what's the difference between 1 and 2?", "can you explain option 3?", "which one is better?"

4. **suggestion** - User is PROPOSING a different approach or modification
   Examples: "combine 1 and 3 into one approach", "what if we did something else?", "I'd rather focus on...", "can we merge these?"

5. **continue_conversation** - General response that isn't about the options
   Examples: "interesting", "tell me more", "I'm not sure yet", "let me think about it"

## Critical Distinctions
- "all of the above" as a STATEMENT = execute_all (do all options)
- "why not all of the above?" as a QUESTION = question (asking about combining)
- "let's do all of them" = execute_all
- "could we do all of them?" = question (asking if possible)
- "1" = execute_selection
- "what about 1?" = question

## Response Format
Respond with ONLY valid JSON (no markdown, no explanation):
{
  "intent": "execute_selection" | "execute_all" | "question" | "suggestion" | "continue_conversation",
  "selectedOptions": [1, 2, 3] or null,
  "shouldSpawnSubtasks": true/false,
  "respondWithClaude": true/false,
  "reasoning": "brief explanation"
}

Rules for the boolean fields:
- shouldSpawnSubtasks: true ONLY for execute_selection or execute_all
- respondWithClaude: true for question, suggestion, continue_conversation; false for execute_selection/execute_all`;

  try {
    console.log("[IntentClassifier] Classifying user intent with Haiku...");
    console.log("[IntentClassifier] User message:", userMessage);
    console.log("[IntentClassifier] Options count:", presentedOptions.length);

    const response = await runClaudeCliWithPrompt(prompt, {
      model: "haiku",
      maxTokens: 500,
    });

    console.log("[IntentClassifier] Raw Haiku response:", response);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[IntentClassifier] No JSON found in response");
      return createFallbackClassification(userMessage);
    }

    const parsed = JSON.parse(jsonMatch[0]) as IntentClassification;

    // Validate the response
    if (!isValidClassification(parsed)) {
      console.error("[IntentClassifier] Invalid classification structure");
      return createFallbackClassification(userMessage);
    }

    console.log("[IntentClassifier] Classification result:", parsed);
    return parsed;
  } catch (error) {
    console.error("[IntentClassifier] Error classifying intent:", error);
    return createFallbackClassification(userMessage);
  }
}

/**
 * Check if a classification has all required fields.
 */
function isValidClassification(obj: unknown): obj is IntentClassification {
  if (typeof obj !== "object" || obj === null) return false;

  const c = obj as Record<string, unknown>;

  const validIntents = [
    "execute_selection",
    "execute_all",
    "question",
    "suggestion",
    "continue_conversation",
  ];

  return (
    typeof c.intent === "string" &&
    validIntents.includes(c.intent) &&
    typeof c.shouldSpawnSubtasks === "boolean" &&
    typeof c.respondWithClaude === "boolean" &&
    typeof c.reasoning === "string"
  );
}

/**
 * Create a safe fallback classification when Haiku fails.
 * Defaults to continue_conversation to let main Claude handle it.
 */
function createFallbackClassification(
  userMessage: string,
): IntentClassification {
  console.log("[IntentClassifier] Using fallback classification");

  return {
    intent: "continue_conversation",
    shouldSpawnSubtasks: false,
    respondWithClaude: true,
    reasoning: `Fallback: could not classify "${userMessage.slice(0, 50)}..."`,
  };
}

/**
 * Quick check if the assistant message contains presented options.
 * Used to determine if intent classification is needed.
 */
export function hasOptionsPresented(assistantMessage: string): boolean {
  // Look for numbered list patterns in the message
  const numberedListPattern = /(?:^|\n)\s*(?:\*\*)?(\d+)[.\)]/m;
  return numberedListPattern.test(assistantMessage);
}

/**
 * Extract options from an assistant message.
 */
export function extractOptionsFromMessage(content: string): PresentedOption[] {
  const options: PresentedOption[] = [];

  // Match patterns like "1. Text here" or "1) Text here" or "**1.** Text"
  const regex =
    /(?:^|\n)\s*(?:\*\*)?(\d+)[.\)]\*?\*?\s+(.+?)(?=\n\s*(?:\*\*)?\d+[.\)]|\n\n|$)/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const num = parseInt(match[1], 10);
    const text = match[2].trim();

    if (num >= 1 && num <= 9 && text.length > 0) {
      options.push({
        number: num,
        text: text,
      });
    }
  }

  return options;
}
