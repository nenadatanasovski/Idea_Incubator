/**
 * Natural Language Parser
 *
 * Parses natural language input to extract task information.
 * Used for Telegram task creation and other natural language interfaces.
 *
 * Part of: PTE-101 to PTE-103
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Parsed task intent from natural language
 */
export interface ParsedTaskIntent {
  title: string;
  description?: string;
  category?: string;
  confidence: number;
  suggestedProjectId?: string;
  dependencies?: string[];
  estimatedFiles?: string[];
  isValidTask: boolean;
  validationMessage?: string;
}

/**
 * Confirmation message for user
 */
export interface ConfirmationMessage {
  text: string;
  editableFields: {
    title: boolean;
    description: boolean;
    category: boolean;
    project: boolean;
  };
  originalInput: string;
  parsedIntent: ParsedTaskIntent;
}

// Category detection patterns
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(fix|bug|error|issue|broken|crash|fail)\b/i, category: "bug" },
  {
    pattern: /\b(add|create|new|implement|build|make)\b/i,
    category: "feature",
  },
  {
    pattern: /\b(improve|enhance|better|optimize|upgrade)\b/i,
    category: "enhancement",
  },
  {
    pattern: /\b(refactor|clean|restructure|reorganize)\b/i,
    category: "refactor",
  },
  { pattern: /\b(test|spec|unit|integration|e2e)\b/i, category: "test" },
  {
    pattern: /\b(doc|document|readme|comment|explain)\b/i,
    category: "documentation",
  },
  {
    pattern: /\b(deploy|release|ci|cd|pipeline|infra)\b/i,
    category: "infrastructure",
  },
  {
    pattern: /\b(research|investigate|explore|analyze|study)\b/i,
    category: "research",
  },
];

// File pattern detection
const FILE_PATTERNS: Array<{ pattern: RegExp; files: string[] }> = [
  { pattern: /\b(api|route|endpoint)\b/i, files: ["server/routes/*.ts"] },
  {
    pattern: /\b(component|ui|frontend)\b/i,
    files: ["frontend/src/components/*.tsx"],
  },
  {
    pattern: /\b(database|migration|schema|table)\b/i,
    files: ["database/migrations/*.sql"],
  },
  { pattern: /\b(type|interface|typedef)\b/i, files: ["types/*.ts"] },
  { pattern: /\b(test|spec)\b/i, files: ["tests/**/*.ts"] },
  { pattern: /\b(style|css|tailwind)\b/i, files: ["frontend/src/**/*.css"] },
];

/**
 * Parse natural language input to extract task intent
 *
 * @param input Raw natural language input
 * @returns Parsed task intent
 */
export async function parseTaskIntent(
  input: string,
): Promise<ParsedTaskIntent> {
  const trimmedInput = input.trim();

  // Validate input
  if (!trimmedInput || trimmedInput.length < 5) {
    return {
      title: trimmedInput,
      confidence: 0,
      isValidTask: false,
      validationMessage: "Input is too short. Please provide more details.",
    };
  }

  // Try rule-based parsing first (fast, no API call)
  const ruleBasedResult = parseWithRules(trimmedInput);

  // If high confidence from rules, return immediately
  if (ruleBasedResult.confidence >= 0.8) {
    return ruleBasedResult;
  }

  // For lower confidence, try AI parsing
  try {
    const aiResult = await parseWithAI(trimmedInput);
    // Merge rule-based and AI results, preferring AI for title/description
    return {
      ...ruleBasedResult,
      ...aiResult,
      confidence: Math.max(ruleBasedResult.confidence, aiResult.confidence),
      estimatedFiles: [
        ...(ruleBasedResult.estimatedFiles || []),
        ...(aiResult.estimatedFiles || []),
      ].filter((v, i, a) => a.indexOf(v) === i),
    };
  } catch (err) {
    console.error(
      "[NaturalLanguageParser] AI parsing failed, using rule-based result:",
      err,
    );
    return ruleBasedResult;
  }
}

/**
 * Rule-based parsing (fast, no API call)
 */
function parseWithRules(input: string): ParsedTaskIntent {
  // Extract category
  let category: string | undefined;
  for (const { pattern, category: cat } of CATEGORY_PATTERNS) {
    if (pattern.test(input)) {
      category = cat;
      break;
    }
  }

  // Extract potential file impacts
  const estimatedFiles: string[] = [];
  for (const { pattern, files } of FILE_PATTERNS) {
    if (pattern.test(input)) {
      estimatedFiles.push(...files);
    }
  }

  // Clean up input for title
  let title = input;

  // Remove common prefixes
  title = title.replace(
    /^(please|can you|could you|i want to|i need to|we need to|let's)\s+/i,
    "",
  );
  title = title.replace(/^(the task is to|task:)\s*/i, "");

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate if too long
  if (title.length > 100) {
    const lastSpace = title.lastIndexOf(" ", 100);
    title = title.substring(0, lastSpace > 50 ? lastSpace : 100) + "...";
  }

  // Calculate confidence based on signals
  let confidence = 0.5;
  if (category) confidence += 0.2;
  if (estimatedFiles.length > 0) confidence += 0.1;
  if (input.length > 20 && input.length < 200) confidence += 0.1;
  if (/\b(should|must|need|want)\b/i.test(input)) confidence += 0.05;

  return {
    title,
    category,
    confidence: Math.min(confidence, 0.95),
    estimatedFiles: estimatedFiles.length > 0 ? estimatedFiles : undefined,
    isValidTask: true,
  };
}

/**
 * AI-based parsing using Claude
 */
async function parseWithAI(input: string): Promise<ParsedTaskIntent> {
  const anthropic = new Anthropic();

  const systemPrompt = `You are a task parser. Extract structured task information from natural language input.

Respond with a JSON object containing:
- title: A clear, concise task title (under 80 characters)
- description: Optional additional details if input contains them
- category: One of: feature, bug, enhancement, refactor, test, documentation, infrastructure, research, other
- estimatedFiles: Array of likely file paths this task will modify (use glob patterns like "server/routes/*.ts")
- confidence: Your confidence in the parsing (0.0 to 1.0)

Only respond with the JSON object, no explanation.`;

  const response = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: input,
      },
    ],
  });

  // Extract text from response
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from AI");
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(textContent.text);
    return {
      title: parsed.title || input,
      description: parsed.description,
      category: parsed.category,
      confidence: parsed.confidence || 0.7,
      estimatedFiles: parsed.estimatedFiles,
      isValidTask: true,
    };
  } catch (err) {
    console.error(
      "[NaturalLanguageParser] Failed to parse AI response:",
      textContent.text,
    );
    throw new Error("Failed to parse AI response");
  }
}

/**
 * Generate a confirmation message for the user
 *
 * @param intent Parsed task intent
 * @param originalInput Original user input
 * @returns Confirmation message with editable fields
 */
export function generateConfirmation(
  intent: ParsedTaskIntent,
  originalInput: string,
): ConfirmationMessage {
  const confidenceEmoji =
    intent.confidence >= 0.8 ? "✅" : intent.confidence >= 0.6 ? "🤔" : "❓";

  let text = `${confidenceEmoji} **Task Parsed**\n\n`;
  text += `📝 **Title:** ${intent.title}\n`;

  if (intent.description) {
    text += `📄 **Description:** ${intent.description}\n`;
  }

  if (intent.category) {
    text += `🏷️ **Category:** ${intent.category}\n`;
  }

  if (intent.estimatedFiles && intent.estimatedFiles.length > 0) {
    text += `📁 **Estimated Files:**\n`;
    for (const file of intent.estimatedFiles.slice(0, 5)) {
      text += `   • ${file}\n`;
    }
  }

  text += `\n🎯 **Confidence:** ${Math.round(intent.confidence * 100)}%\n`;
  text += `\n_Reply "yes" to create, or provide corrections._`;

  return {
    text,
    editableFields: {
      title: true,
      description: true,
      category: true,
      project: true,
    },
    originalInput,
    parsedIntent: intent,
  };
}

/**
 * Apply user edits to a parsed intent
 *
 * @param original Original parsed intent
 * @param edits User edits (partial)
 * @returns Updated intent
 */
export function applyEdits(
  original: ParsedTaskIntent,
  edits: Partial<ParsedTaskIntent>,
): ParsedTaskIntent {
  return {
    ...original,
    ...edits,
    // Recalculate confidence based on user confirmation
    confidence: 1.0, // User confirmed/edited = 100% confidence
  };
}

/**
 * Check if input is a confirmation
 */
export function isConfirmation(input: string): boolean {
  const confirmPatterns = [
    /^(yes|y|ok|sure|confirm|create|go|do it|proceed)$/i,
    /^(looks good|that's right|correct|perfect)$/i,
    /^(✅|👍|✔️)$/,
  ];

  const trimmed = input.trim();
  return confirmPatterns.some((p) => p.test(trimmed));
}

/**
 * Check if input is a rejection/cancel
 */
export function isRejection(input: string): boolean {
  const rejectPatterns = [
    /^(no|n|cancel|abort|stop|nevermind|never mind)$/i,
    /^(❌|👎|✖️)$/,
  ];

  const trimmed = input.trim();
  return rejectPatterns.some((p) => p.test(trimmed));
}

/**
 * Parse edit intent from user input
 *
 * @param input User input like "change title to: New title"
 * @returns Parsed edits or null if not an edit
 */
export function parseEditIntent(
  input: string,
): Partial<ParsedTaskIntent> | null {
  const titleMatch = input.match(/(?:title|name)[\s:]+(.+)/i);
  if (titleMatch) {
    return { title: titleMatch[1].trim() };
  }

  const categoryMatch = input.match(/(?:category|type)[\s:]+(\w+)/i);
  if (categoryMatch) {
    return { category: categoryMatch[1].toLowerCase() };
  }

  const descMatch = input.match(/(?:description|desc|details)[\s:]+(.+)/i);
  if (descMatch) {
    return { description: descMatch[1].trim() };
  }

  return null;
}

export default {
  parseTaskIntent,
  generateConfirmation,
  applyEdits,
  isConfirmation,
  isRejection,
  parseEditIntent,
};
