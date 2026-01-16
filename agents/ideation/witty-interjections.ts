/**
 * WITTY INTERJECTION SYSTEM
 *
 * Adds occasional personality to agent responses (~10% of the time).
 * Contextual one-liners that feel natural, not forced.
 */

export interface WittyInterjection {
  text: string;
  category:
    | "self_awareness"
    | "market_reality"
    | "encouragement"
    | "gentle_push";
  triggers: string[];
}

// Interjection library
const INTERJECTIONS: WittyInterjection[] = [
  // Self-awareness
  {
    text: "Ah, the classic 'surely someone's solved this' moment. Usually they haven't, or they've done it poorly.",
    category: "self_awareness",
    triggers: ["surely", "someone must have", "already exists", "been done"],
  },
  {
    text: "That's either a terrible idea or a brilliant one. Often the same thing.",
    category: "self_awareness",
    triggers: [
      "crazy idea",
      "might be dumb",
      "sounds weird",
      "probably stupid",
    ],
  },
  {
    text: "Most people say 'everyone' when asked who'd use their idea. You didn't. That's good.",
    category: "self_awareness",
    triggers: ["specific audience", "niche", "particular group"],
  },
  {
    text: "The graveyard of startups is full of 'obvious' ideas no one could make work.",
    category: "self_awareness",
    triggers: ["obvious", "easy", "simple", "straightforward"],
  },
  {
    text: "Passion and patience are both P-words. You'll need both.",
    category: "self_awareness",
    triggers: ["passionate", "love this", "excited about"],
  },

  // Market reality
  {
    text: "Competition can be good news — it means people are actually paying for solutions.",
    category: "market_reality",
    triggers: ["competitor", "competition", "already doing this"],
  },
  {
    text: "The difference between a feature and a product is often just marketing.",
    category: "market_reality",
    triggers: ["just a feature", "too small", "add-on"],
  },
  {
    text: "Timing is the silent killer of good ideas. Right idea, wrong decade.",
    category: "market_reality",
    triggers: ["too early", "too late", "timing", "market ready"],
  },
  {
    text: "The best businesses solve problems people didn't know they'd pay to fix.",
    category: "market_reality",
    triggers: ["pain point", "frustration", "annoyance"],
  },

  // Encouragement
  {
    text: "Naivety is an asset in early stages. Experts often can't see the obvious gaps.",
    category: "encouragement",
    triggers: ["don't know enough", "no experience", "not an expert"],
  },
  {
    text: "The best founders often come from outside the industry they disrupt.",
    category: "encouragement",
    triggers: ["outsider", "never worked in", "different background"],
  },
  {
    text: "Constraints breed creativity. Limited time or money can be a feature, not a bug.",
    category: "encouragement",
    triggers: ["limited time", "no money", "bootstrap", "part-time"],
  },

  // Gentle push
  {
    text: "Ideas are cheap. Execution is expensive. Let's make sure this one's worth the price.",
    category: "gentle_push",
    triggers: ["many ideas", "could do anything", "options"],
  },
  {
    text: "Shall we dig deeper, or is this comfortable surface-level chat?",
    category: "gentle_push",
    triggers: ["maybe", "could be", "not sure", "possibly"],
  },
  {
    text: "I notice you're hedging. What would it take to commit to exploring this seriously?",
    category: "gentle_push",
    triggers: ["might work", "could try", "not sure if"],
  },
];

/**
 * Decide if we should inject a witty interjection.
 * Target: ~10% of responses.
 */
export function shouldInjectWit(): boolean {
  return Math.random() < 0.1;
}

/**
 * Find a contextually appropriate interjection.
 */
export function findRelevantInterjection(
  userMessage: string,
  agentReply: string,
): WittyInterjection | null {
  const combinedText = `${userMessage} ${agentReply}`.toLowerCase();

  // Find interjections with matching triggers
  const matches = INTERJECTIONS.filter((interjection) =>
    interjection.triggers.some((trigger) =>
      combinedText.includes(trigger.toLowerCase()),
    ),
  );

  if (matches.length === 0) return null;

  // Return random match
  return matches[Math.floor(Math.random() * matches.length)];
}

/**
 * Inject witty interjection into response if appropriate.
 */
export function maybeInjectWit(
  userMessage: string,
  agentReply: string,
): string {
  // Check probability
  if (!shouldInjectWit()) return agentReply;

  // Find relevant interjection
  const interjection = findRelevantInterjection(userMessage, agentReply);
  if (!interjection) return agentReply;

  // Inject at natural break point
  return injectAtNaturalBreak(agentReply, interjection.text);
}

/**
 * Inject text at a natural break point in the response.
 */
export function injectAtNaturalBreak(text: string, injection: string): string {
  // Look for paragraph breaks
  const paragraphs = text.split("\n\n");

  if (paragraphs.length >= 2) {
    // Insert after first paragraph
    paragraphs.splice(1, 0, `*${injection}*`);
    return paragraphs.join("\n\n");
  }

  // Look for sentence breaks
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length >= 2) {
    // Insert after first sentence
    sentences.splice(1, 0, `*${injection}*`);
    return sentences.join(" ");
  }

  // Just append with emphasis
  return `${text}\n\n*${injection}*`;
}

/**
 * Get random interjection by category for explicit use.
 */
export function getRandomByCategory(
  category: WittyInterjection["category"],
): string {
  const matches = INTERJECTIONS.filter((i) => i.category === category);
  if (matches.length === 0) return "";
  return matches[Math.floor(Math.random() * matches.length)].text;
}

/**
 * Track used interjections to avoid repetition in session.
 */
export class InterjectionTracker {
  private usedInSession: Set<string> = new Set();

  reset(): void {
    this.usedInSession.clear();
  }

  getUnused(candidates: WittyInterjection[]): WittyInterjection | null {
    const unused = candidates.filter((c) => !this.usedInSession.has(c.text));
    if (unused.length === 0) return null;

    const selected = unused[Math.floor(Math.random() * unused.length)];
    this.usedInSession.add(selected.text);
    return selected;
  }

  markUsed(text: string): void {
    this.usedInSession.add(text);
  }
}

/**
 * Get all interjections for reference.
 */
export function getAllInterjections(): WittyInterjection[] {
  return [...INTERJECTIONS];
}

/**
 * Get interjections by category.
 */
export function getInterjectionsByCategory(
  category: WittyInterjection["category"],
): WittyInterjection[] {
  return INTERJECTIONS.filter((i) => i.category === category);
}
