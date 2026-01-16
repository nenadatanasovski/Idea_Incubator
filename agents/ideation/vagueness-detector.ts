/**
 * VAGUENESS DETECTOR
 *
 * Detects vague, non-committal, or unclear responses that need follow-up.
 * Helps the agent know when to dig deeper vs. move on.
 */

export interface VaguenessAnalysis {
  isVague: boolean;
  score: number; // 0-1, higher = more vague
  reasons: string[];
  suggestedFollowUp: string | null;
}

export interface VaguenessPatterns {
  hedging: RegExp[];
  nonCommittal: RegExp[];
  deflecting: RegExp[];
  unclear: RegExp[];
}

/**
 * Default patterns for detecting vagueness.
 */
const DEFAULT_PATTERNS: VaguenessPatterns = {
  hedging: [
    /\b(?:maybe|perhaps|possibly|might|could be|could|sort of|kind of|somewhat)\b/i,
    /\b(?:I think|I guess|I suppose|probably|likely)\b/i,
    /\b(?:not sure|not certain|don't know|hard to say)\b/i,
  ],
  nonCommittal: [
    /\b(?:it depends|depends on|varies|sometimes|occasionally)\b/i,
    /\b(?:either way|both|neither|any|whatever)\b/i,
    /\b(?:we'll see|time will tell|who knows)\b/i,
  ],
  deflecting: [
    /\b(?:I haven't thought about|never considered|good question)\b/i,
    /\b(?:let me think|need to think|I'll have to)\b/i,
    /\b(?:that's interesting|interesting question)\b/i,
  ],
  unclear: [
    /\b(?:stuff|things|something|whatever|etc)\b/i,
    /\b(?:you know|like|basically|essentially)\b/i,
    /\b(?:and so on|and more|and such)\b/i,
  ],
};

/**
 * Analyze a message for vagueness.
 */
export function detectVagueness(
  message: string,
  patterns: VaguenessPatterns = DEFAULT_PATTERNS,
): VaguenessAnalysis {
  const reasons: string[] = [];
  let score = 0;

  // Check hedging patterns
  const hedgingMatches = countPatternMatches(message, patterns.hedging);
  if (hedgingMatches > 0) {
    reasons.push(`Hedging language detected (${hedgingMatches} instances)`);
    score += Math.min(0.4, hedgingMatches * 0.12);
  }

  // Check non-committal patterns
  const nonCommittalMatches = countPatternMatches(
    message,
    patterns.nonCommittal,
  );
  if (nonCommittalMatches > 0) {
    reasons.push(
      `Non-committal language detected (${nonCommittalMatches} instances)`,
    );
    score += Math.min(0.4, nonCommittalMatches * 0.15);
  }

  // Check deflecting patterns
  const deflectingMatches = countPatternMatches(message, patterns.deflecting);
  if (deflectingMatches > 0) {
    reasons.push(
      `Deflecting language detected (${deflectingMatches} instances)`,
    );
    score += Math.min(0.4, deflectingMatches * 0.15);
  }

  // Check unclear patterns
  const unclearMatches = countPatternMatches(message, patterns.unclear);
  if (unclearMatches > 0) {
    reasons.push(`Unclear language detected (${unclearMatches} instances)`);
    score += Math.min(0.4, unclearMatches * 0.1);
  }

  // Check message length (very short responses may be vague)
  const wordCount = message.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 5) {
    reasons.push("Very short response");
    score += 0.15;
  }

  // Cap score at 1.0
  score = Math.min(1.0, score);

  // Determine if vague (threshold: 0.3)
  const isVague = score >= 0.3;

  // Generate follow-up suggestion
  const suggestedFollowUp = generateFollowUp(reasons, score);

  return {
    isVague,
    score,
    reasons,
    suggestedFollowUp,
  };
}

/**
 * Count pattern matches in text.
 */
function countPatternMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    // Create a new regex with global flag to find all matches
    const globalPattern = new RegExp(pattern.source, "gi");
    const matches = text.match(globalPattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Generate a follow-up suggestion based on vagueness analysis.
 */
function generateFollowUp(reasons: string[], score: number): string | null {
  if (score < 0.3) {
    return null;
  }

  const followUps = [];

  if (reasons.some((r) => r.includes("Hedging"))) {
    followUps.push(
      "Can you be more specific about that?",
      "What would make you more certain?",
      "Let's break this down - what's the core of what you're saying?",
    );
  }

  if (reasons.some((r) => r.includes("Non-committal"))) {
    followUps.push(
      "If you had to choose one direction, which would it be?",
      "What's your gut telling you?",
      "What would need to be true for you to commit to one option?",
    );
  }

  if (reasons.some((r) => r.includes("Deflecting"))) {
    followUps.push(
      "Take a moment - what's your initial reaction?",
      "Even if you haven't thought about it deeply, what's your instinct?",
      "What's the first thing that comes to mind?",
    );
  }

  if (reasons.some((r) => r.includes("Unclear"))) {
    followUps.push(
      "Could you give me a specific example?",
      "What exactly do you mean by that?",
      "Can you elaborate on that point?",
    );
  }

  if (reasons.some((r) => r.includes("Very short"))) {
    followUps.push(
      "Tell me more about that.",
      "Can you expand on that?",
      "What else comes to mind?",
    );
  }

  // Return a random follow-up from the relevant ones
  if (followUps.length > 0) {
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  return "Could you tell me more about that?";
}

/**
 * Check if a message is a simple confirmation (yes/no/ok).
 */
export function isSimpleConfirmation(message: string): boolean {
  const confirmationPatterns = [
    /^(?:yes|yeah|yep|yup|sure|ok|okay|right|correct|exactly|definitely|absolutely)\.?$/i,
    /^(?:no|nope|nah|not really|not quite)\.?$/i,
    /^(?:uh-?huh|mm-?hm|mhm)\.?$/i,
  ];

  const trimmed = message.trim();

  for (const pattern of confirmationPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a message is a question back to the agent.
 */
export function isQuestionBack(message: string): boolean {
  const trimmed = message.trim();

  // Ends with question mark
  if (trimmed.endsWith("?")) {
    return true;
  }

  // Starts with question words
  const questionStarters = [
    /^(?:what|why|how|when|where|who|which|whose|whom)\b/i,
    /^(?:can you|could you|would you|will you)\b/i,
    /^(?:do you|does it|is it|are there)\b/i,
  ];

  for (const pattern of questionStarters) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a message indicates confusion or misunderstanding.
 */
export function isConfused(message: string): boolean {
  const confusionPatterns = [
    /\b(?:I don't understand|I'm confused|what do you mean|I'm not following)\b/i,
    /\b(?:can you explain|could you clarify|what does that mean)\b/i,
    /\b(?:I'm lost|that doesn't make sense|huh\??)\b/i,
  ];

  for (const pattern of confusionPatterns) {
    if (pattern.test(message)) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze message type for conversation flow.
 */
export type MessageType =
  | "substantive"
  | "vague"
  | "confirmation"
  | "question"
  | "confused"
  | "short";

export function classifyMessage(message: string): {
  type: MessageType;
  analysis: VaguenessAnalysis;
} {
  const analysis = detectVagueness(message);

  if (isConfused(message)) {
    return { type: "confused", analysis };
  }

  if (isQuestionBack(message)) {
    return { type: "question", analysis };
  }

  if (isSimpleConfirmation(message)) {
    return { type: "confirmation", analysis };
  }

  const wordCount = message.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 5 && !analysis.isVague) {
    return { type: "short", analysis };
  }

  if (analysis.isVague) {
    return { type: "vague", analysis };
  }

  return { type: "substantive", analysis };
}

/**
 * Get appropriate response strategy based on message classification.
 */
export function getResponseStrategy(messageType: MessageType): {
  strategy: string;
  shouldProbe: boolean;
  probeType: "specific" | "expand" | "clarify" | "confirm" | "none";
} {
  switch (messageType) {
    case "substantive":
      return {
        strategy: "Continue conversation naturally",
        shouldProbe: false,
        probeType: "none",
      };

    case "vague":
      return {
        strategy: "Ask for specifics or commitment",
        shouldProbe: true,
        probeType: "specific",
      };

    case "confirmation":
      return {
        strategy: "Acknowledge and move to next topic or probe for more",
        shouldProbe: true,
        probeType: "expand",
      };

    case "question":
      return {
        strategy: "Answer the question, then redirect to exploration",
        shouldProbe: false,
        probeType: "none",
      };

    case "confused":
      return {
        strategy: "Clarify the previous question or statement",
        shouldProbe: true,
        probeType: "clarify",
      };

    case "short":
      return {
        strategy: "Encourage elaboration",
        shouldProbe: true,
        probeType: "expand",
      };

    default:
      return {
        strategy: "Continue conversation",
        shouldProbe: false,
        probeType: "none",
      };
  }
}
