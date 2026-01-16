# Spec 3: Core Utilities (Communication & Pre-Answered Questions)

## Overview

This specification covers utility modules for the Ideation Agent:

- **Communication Style Classifier**: Analyzes user communication patterns
- **Pre-Answered Questions Mapping**: Maps ideation signals to Development questions
- **Helper Utilities**: Context extraction and formatting utilities

## Dependencies

- Spec 1: Database & Data Models (types/ideation.ts)
- Spec 2: Core Calculators (confidence-calculator.ts, viability-calculator.ts)

---

## 5. Communication Style Classifier

### 5.1 Purpose

The Communication Style Classifier analyzes user messages to determine their communication style. This is critical for:

- Maintaining rapport during agent handoffs
- Adapting agent tone to user preference
- Improving user experience through personalization

### 5.2 Implementation

```typescript
// =============================================================================
// FILE: agents/ideation/communication-classifier.ts
// =============================================================================

export type CommunicationStyle =
  | "verbose"
  | "terse"
  | "analytical"
  | "emotional";

export interface StyleClassification {
  primary: CommunicationStyle;
  confidence: number; // 0.0-1.0
  scores: Record<CommunicationStyle, number>;
  evidence: string[];
}

export interface MessageAnalysis {
  wordCount: number;
  averageSentenceLength: number;
  questionRatio: number;
  exclamationRatio: number;
  technicalTermRatio: number;
  emotionalWordRatio: number;
  dataReferences: number;
}

// Emotional word patterns
const EMOTIONAL_PATTERNS = [
  /\b(love|hate|excited|frustrated|amazing|terrible|wonderful|awful)\b/gi,
  /\b(feel|feeling|felt)\b/gi,
  /!{2,}/g, // Multiple exclamation marks
  /\b(honestly|personally|truly)\b/gi,
];

// Technical/analytical patterns
const ANALYTICAL_PATTERNS = [
  /\b(data|metrics|analysis|percentage|ratio|statistics)\b/gi,
  /\b(therefore|consequently|because|thus|hence)\b/gi,
  /\b(specifically|precisely|exactly|technically)\b/gi,
  /\d+%|\d+\.\d+/g, // Numbers and percentages
];

/**
 * Classifies the user's communication style based on message history
 */
export function classifyCommunicationStyle(
  messages: Array<{ role: string; content: string }>,
): StyleClassification {
  // Filter to user messages only
  const userMessages = messages.filter((m) => m.role === "user");

  if (userMessages.length === 0) {
    return {
      primary: "verbose",
      confidence: 0,
      scores: { verbose: 0.25, terse: 0.25, analytical: 0.25, emotional: 0.25 },
      evidence: ["No user messages to analyze"],
    };
  }

  // Analyze all user messages
  const analyses = userMessages.map((m) => analyzeMessage(m.content));
  const aggregated = aggregateAnalyses(analyses);

  // Calculate style scores
  const scores = calculateStyleScores(aggregated);

  // Determine primary style
  const primary = Object.entries(scores).reduce((a, b) =>
    scores[a[0] as CommunicationStyle] > scores[b[0] as CommunicationStyle]
      ? a
      : b,
  )[0] as CommunicationStyle;

  // Calculate confidence (difference between top 2 scores)
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const confidence = sortedScores[0] - sortedScores[1];

  return {
    primary,
    confidence: Math.min(confidence * 2, 1), // Scale to 0-1
    scores,
    evidence: generateEvidence(aggregated, primary),
  };
}

function analyzeMessage(content: string): MessageAnalysis {
  const words = content.split(/\s+/).filter((w) => w.length > 0);
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const emotionalMatches = EMOTIONAL_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0,
  );

  const analyticalMatches = ANALYTICAL_PATTERNS.reduce(
    (count, pattern) => count + (content.match(pattern)?.length || 0),
    0,
  );

  return {
    wordCount: words.length,
    averageSentenceLength: words.length / Math.max(sentences.length, 1),
    questionRatio:
      (content.match(/\?/g)?.length || 0) / Math.max(sentences.length, 1),
    exclamationRatio:
      (content.match(/!/g)?.length || 0) / Math.max(sentences.length, 1),
    technicalTermRatio: analyticalMatches / Math.max(words.length, 1),
    emotionalWordRatio: emotionalMatches / Math.max(words.length, 1),
    dataReferences: content.match(/\d+/g)?.length || 0,
  };
}

function aggregateAnalyses(analyses: MessageAnalysis[]): MessageAnalysis {
  const count = analyses.length;
  return {
    wordCount: analyses.reduce((s, a) => s + a.wordCount, 0) / count,
    averageSentenceLength:
      analyses.reduce((s, a) => s + a.averageSentenceLength, 0) / count,
    questionRatio: analyses.reduce((s, a) => s + a.questionRatio, 0) / count,
    exclamationRatio:
      analyses.reduce((s, a) => s + a.exclamationRatio, 0) / count,
    technicalTermRatio:
      analyses.reduce((s, a) => s + a.technicalTermRatio, 0) / count,
    emotionalWordRatio:
      analyses.reduce((s, a) => s + a.emotionalWordRatio, 0) / count,
    dataReferences: analyses.reduce((s, a) => s + a.dataReferences, 0) / count,
  };
}

function calculateStyleScores(
  analysis: MessageAnalysis,
): Record<CommunicationStyle, number> {
  const scores: Record<CommunicationStyle, number> = {
    verbose: 0,
    terse: 0,
    analytical: 0,
    emotional: 0,
  };

  // Verbose: long messages, detailed explanations
  if (analysis.wordCount > 50) scores.verbose += 0.3;
  if (analysis.averageSentenceLength > 15) scores.verbose += 0.2;
  scores.verbose += Math.min(analysis.wordCount / 200, 0.5);

  // Terse: short, direct messages
  if (analysis.wordCount < 20) scores.terse += 0.3;
  if (analysis.averageSentenceLength < 8) scores.terse += 0.2;
  scores.terse += Math.max(0, 0.5 - analysis.wordCount / 100);

  // Analytical: data-driven, logical
  scores.analytical += analysis.technicalTermRatio * 10;
  scores.analytical += Math.min(analysis.dataReferences / 5, 0.3);
  if (analysis.questionRatio < 0.2) scores.analytical += 0.1;

  // Emotional: feeling-based, expressive
  scores.emotional += analysis.emotionalWordRatio * 15;
  scores.emotional += analysis.exclamationRatio * 2;

  // Normalize scores to sum to 1
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const key of Object.keys(scores) as CommunicationStyle[]) {
      scores[key] /= total;
    }
  } else {
    // Default distribution
    scores.verbose = 0.25;
    scores.terse = 0.25;
    scores.analytical = 0.25;
    scores.emotional = 0.25;
  }

  return scores;
}

function generateEvidence(
  analysis: MessageAnalysis,
  style: CommunicationStyle,
): string[] {
  const evidence: string[] = [];

  switch (style) {
    case "verbose":
      evidence.push(
        `Average message length: ${Math.round(analysis.wordCount)} words`,
      );
      evidence.push(
        `Average sentence length: ${Math.round(analysis.averageSentenceLength)} words`,
      );
      break;
    case "terse":
      evidence.push(
        `Short, direct messages averaging ${Math.round(analysis.wordCount)} words`,
      );
      break;
    case "analytical":
      evidence.push(`Uses data and technical terms frequently`);
      evidence.push(
        `References numbers/statistics ${Math.round(analysis.dataReferences)} times per message`,
      );
      break;
    case "emotional":
      evidence.push(`Uses emotional language and exclamations`);
      evidence.push(`Expressive communication style`);
      break;
  }

  return evidence;
}
```

### 5.3 Tests

```typescript
describe("CommunicationStyleClassifier", () => {
  describe("classifyCommunicationStyle", () => {
    test("PASS: Identifies verbose style from long messages", () => {
      const messages = [
        {
          role: "user",
          content: `I have been thinking about this problem for quite some time now,
            and I believe there are multiple aspects we need to consider. First,
            let me explain my background in this area and then we can discuss
            the various approaches that might work for our specific situation.`,
        },
        {
          role: "user",
          content: `Building on what I mentioned earlier, I think we should also
            take into account the feedback I received from several colleagues
            who have extensive experience in this domain. They suggested that
            we explore alternative methodologies that could yield better results.`,
        },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("verbose");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test("PASS: Identifies terse style from short messages", () => {
      const messages = [
        { role: "user", content: "Yes." },
        { role: "user", content: "Healthcare apps." },
        { role: "user", content: "Small clinics." },
        { role: "user", content: "B2B." },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("terse");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test("PASS: Identifies analytical style from data-heavy messages", () => {
      const messages = [
        {
          role: "user",
          content: `Based on the data I analyzed, the market shows 15% YoY growth.
            Specifically, the TAM is approximately $4.2B with a CAC of $150
            and LTV of $2,400. Therefore, the LTV:CAC ratio of 16:1 is promising.`,
        },
        {
          role: "user",
          content: `The metrics indicate that conversion rates are 3.2% on average,
            consequently we should focus on optimizing the funnel. Precisely 67%
            of users drop off at step 2.`,
        },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("analytical");
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    test("PASS: Identifies emotional style from expressive messages", () => {
      const messages = [
        {
          role: "user",
          content: `I absolutely LOVE this idea!! It makes me so excited to think
            about the possibilities! Honestly, I feel like this could truly
            change everything!`,
        },
        {
          role: "user",
          content: `I hate how frustrating the current solutions are! It feels
            like no one cares about the user experience. Personally, I'm
            passionate about fixing this!`,
        },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("emotional");
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    test("PASS: Returns low confidence for mixed styles", () => {
      const messages = [
        { role: "user", content: "I think healthcare is interesting." },
        {
          role: "user",
          content: "The data shows 20% growth which is exciting!",
        },
        { role: "user", content: "Yes, B2B." },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.confidence).toBeLessThan(0.5);
    });

    test("PASS: Ignores assistant messages", () => {
      const messages = [
        {
          role: "assistant",
          content: "This is a long assistant message with many words...",
        },
        { role: "user", content: "Yes." },
        {
          role: "assistant",
          content: "Another verbose response from the agent...",
        },
        { role: "user", content: "Ok." },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("terse");
    });

    test("PASS: Returns default for empty messages", () => {
      const result = classifyCommunicationStyle([]);

      expect(result.confidence).toBe(0);
      expect(result.scores.verbose).toBe(0.25);
      expect(result.scores.terse).toBe(0.25);
    });

    test("PASS: Scores always sum to 1", () => {
      const messages = [
        { role: "user", content: "Any random message content here." },
      ];

      const result = classifyCommunicationStyle(messages);

      const total = Object.values(result.scores).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1, 5);
    });
  });
});
```

---

## 6. Pre-Answered Questions Mapping

### 6.1 Purpose

When a user captures an idea from ideation, many Development phase questions can be pre-answered based on signals extracted during the conversation. This mapping defines which ideation signals answer which Development questions.

### 6.2 Implementation

```typescript
// =============================================================================
// FILE: agents/ideation/pre-answered-mapper.ts
// =============================================================================

import type {
  SelfDiscovery,
  MarketDiscovery,
  NarrowingState,
} from "../../types/ideation";

export interface PreAnsweredQuestion {
  questionId: string;
  answer: string;
  source: "ideation_agent";
  confidence: number; // 0.0-1.0
  evidenceQuotes: string[];
}

export interface IdeationSignals {
  selfDiscovery: Partial<SelfDiscovery>;
  marketDiscovery: Partial<MarketDiscovery>;
  narrowingState: Partial<NarrowingState>;
  candidateTitle?: string;
  candidateSummary?: string;
}

// Development question IDs mapped to signal extraction logic
const QUESTION_MAPPINGS: Array<{
  questionId: string;
  signalPath: string;
  transformer: (value: unknown, signals: IdeationSignals) => string | null;
  minConfidence: number;
}> = [
  // Problem-related questions
  {
    questionId: "DEV_PROBLEM_STATEMENT",
    signalPath: "selfDiscovery.frustrations",
    transformer: (frustrations: unknown) => {
      if (!Array.isArray(frustrations) || frustrations.length === 0)
        return null;
      const highSeverity = frustrations.filter(
        (f: { severity: string }) => f.severity === "high",
      );
      if (highSeverity.length > 0) {
        return highSeverity
          .map((f: { description: string }) => f.description)
          .join(". ");
      }
      return frustrations
        .slice(0, 2)
        .map((f: { description: string }) => f.description)
        .join(". ");
    },
    minConfidence: 0.6,
  },
  {
    questionId: "DEV_TARGET_USER",
    signalPath: "narrowingState.customerType",
    transformer: (customerType: unknown) => {
      if (!customerType || typeof customerType !== "object") return null;
      const ct = customerType as { value: string | null; confidence: number };
      if (!ct.value) return null;
      const mapping: Record<string, string> = {
        B2B: "Businesses and organizations",
        B2C: "Individual consumers",
        B2B2C: "Businesses that serve consumers",
        Marketplace: "Two-sided marketplace participants",
      };
      return mapping[ct.value] || ct.value;
    },
    minConfidence: 0.7,
  },
  {
    questionId: "DEV_TARGET_USER_DETAIL",
    signalPath: "selfDiscovery.expertise",
    transformer: (expertise: unknown, signals: IdeationSignals) => {
      const customerType = signals.narrowingState?.customerType?.value;
      if (!customerType) return null;

      const expertiseAreas = expertise as
        | Array<{ area: string; depth: string }>
        | undefined;
      if (!expertiseAreas || expertiseAreas.length === 0) return null;

      const primaryExpertise = expertiseAreas[0].area;
      return `${customerType === "B2B" ? "Organizations" : "People"} in the ${primaryExpertise} space`;
    },
    minConfidence: 0.5,
  },
  // Solution-related questions
  {
    questionId: "DEV_SOLUTION_TYPE",
    signalPath: "narrowingState.productType",
    transformer: (productType: unknown) => {
      if (!productType || typeof productType !== "object") return null;
      const pt = productType as { value: string | null };
      const mapping: Record<string, string> = {
        Digital: "Software/digital product",
        Physical: "Physical product",
        Hybrid: "Combination of digital and physical",
        Service: "Service-based business",
      };
      return pt.value ? mapping[pt.value] || pt.value : null;
    },
    minConfidence: 0.7,
  },
  {
    questionId: "DEV_TECHNICAL_APPROACH",
    signalPath: "narrowingState.technicalDepth",
    transformer: (technicalDepth: unknown) => {
      if (!technicalDepth || typeof technicalDepth !== "object") return null;
      const td = technicalDepth as { value: string | null };
      const mapping: Record<string, string> = {
        no_code: "No-code tools (Bubble, Webflow, etc.)",
        low_code: "Low-code platforms with some custom development",
        full_custom: "Fully custom development",
      };
      return td.value ? mapping[td.value] || td.value : null;
    },
    minConfidence: 0.6,
  },
  // Market-related questions
  {
    questionId: "DEV_GEOGRAPHY",
    signalPath: "narrowingState.geography",
    transformer: (geography: unknown) => {
      if (!geography || typeof geography !== "object") return null;
      const geo = geography as { value: string | null };
      const mapping: Record<string, string> = {
        Local: "Local market (single city/region)",
        National: "National market",
        Global: "Global/international market",
      };
      return geo.value ? mapping[geo.value] || geo.value : null;
    },
    minConfidence: 0.8,
  },
  {
    questionId: "DEV_COMPETITORS",
    signalPath: "marketDiscovery.competitors",
    transformer: (competitors: unknown) => {
      if (!Array.isArray(competitors) || competitors.length === 0) return null;
      return competitors
        .slice(0, 5)
        .map((c: { name: string; description?: string }) =>
          c.description ? `${c.name}: ${c.description}` : c.name,
        )
        .join("\n");
    },
    minConfidence: 0.7,
  },
  {
    questionId: "DEV_MARKET_GAP",
    signalPath: "marketDiscovery.gaps",
    transformer: (gaps: unknown) => {
      if (!Array.isArray(gaps) || gaps.length === 0) return null;
      const highRelevance = gaps.filter(
        (g: { relevance: string }) => g.relevance === "high",
      );
      if (highRelevance.length > 0) {
        return highRelevance
          .map((g: { description: string }) => g.description)
          .join(". ");
      }
      return gaps
        .slice(0, 2)
        .map((g: { description: string }) => g.description)
        .join(". ");
    },
    minConfidence: 0.6,
  },
  // Personal fit questions
  {
    questionId: "DEV_UNFAIR_ADVANTAGE",
    signalPath: "selfDiscovery.expertise",
    transformer: (expertise: unknown, signals: IdeationSignals) => {
      const expertiseAreas = expertise as
        | Array<{ area: string; depth: string }>
        | undefined;
      if (!expertiseAreas) return null;

      const expertLevel = expertiseAreas.filter((e) => e.depth === "expert");
      if (expertLevel.length === 0) return null;

      const areas = expertLevel.map((e) => e.area).join(", ");
      return `Expert-level knowledge in: ${areas}`;
    },
    minConfidence: 0.7,
  },
  {
    questionId: "DEV_TIME_COMMITMENT",
    signalPath: "selfDiscovery.constraints",
    transformer: (constraints: unknown) => {
      if (!constraints || typeof constraints !== "object") return null;
      const c = constraints as { timeHoursPerWeek?: number };
      if (c.timeHoursPerWeek === undefined) return null;

      if (c.timeHoursPerWeek >= 40) return "Full-time (40+ hours/week)";
      if (c.timeHoursPerWeek >= 20) return "Part-time (20-40 hours/week)";
      if (c.timeHoursPerWeek >= 10) return "Side project (10-20 hours/week)";
      return "Hobby level (less than 10 hours/week)";
    },
    minConfidence: 0.9,
  },
  {
    questionId: "DEV_FUNDING_APPROACH",
    signalPath: "selfDiscovery.constraints",
    transformer: (constraints: unknown) => {
      if (!constraints || typeof constraints !== "object") return null;
      const c = constraints as { capital?: string };
      if (!c.capital) return null;

      const mapping: Record<string, string> = {
        bootstrap: "Bootstrapped/self-funded",
        seeking_funding: "Seeking external investment",
        have_funding: "Already have funding secured",
      };
      return mapping[c.capital] || c.capital;
    },
    minConfidence: 0.9,
  },
  // Idea summary
  {
    questionId: "DEV_ONE_LINE_PITCH",
    signalPath: "candidateSummary",
    transformer: (summary: unknown) => {
      if (typeof summary !== "string" || summary.length === 0) return null;
      return summary;
    },
    minConfidence: 0.8,
  },
];

/**
 * Generates pre-answered questions based on ideation signals
 */
export function generatePreAnsweredQuestions(
  signals: IdeationSignals,
): PreAnsweredQuestion[] {
  const results: PreAnsweredQuestion[] = [];

  for (const mapping of QUESTION_MAPPINGS) {
    const value = getNestedValue(signals, mapping.signalPath);
    if (value === undefined) continue;

    const answer = mapping.transformer(value, signals);
    if (answer === null) continue;

    const confidence = calculateAnswerConfidence(
      signals,
      mapping.signalPath,
      mapping.minConfidence,
    );
    if (confidence < mapping.minConfidence) continue;

    results.push({
      questionId: mapping.questionId,
      answer,
      source: "ideation_agent",
      confidence,
      evidenceQuotes: extractEvidenceQuotes(signals, mapping.signalPath),
    });
  }

  return results;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function calculateAnswerConfidence(
  signals: IdeationSignals,
  signalPath: string,
  minRequired: number,
): number {
  // Check if the signal has its own confidence value
  const value = getNestedValue(signals, signalPath);

  if (value && typeof value === "object" && "confidence" in value) {
    return (value as { confidence: number }).confidence;
  }

  // For arrays, confidence based on count
  if (Array.isArray(value)) {
    return Math.min(value.length * 0.2 + 0.4, 1);
  }

  // Default confidence for simple values
  return value ? minRequired + 0.1 : 0;
}

function extractEvidenceQuotes(
  signals: IdeationSignals,
  signalPath: string,
): string[] {
  const value = getNestedValue(signals, signalPath);

  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item: unknown) => {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        return (
          (obj.quote as string) ||
          (obj.description as string) ||
          JSON.stringify(item)
        );
      }
      return String(item);
    });
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.value) return [String(obj.value)];
  }

  return [];
}

/**
 * Generates the handoff data structure for Development phase
 */
export function generateDevelopmentHandoff(
  signals: IdeationSignals,
  sessionId: string,
  candidateConfidence: number,
  candidateViability: number,
  viabilityRisks: Array<{
    riskType: string;
    description: string;
    severity: string;
  }>,
): {
  preAnsweredQuestions: PreAnsweredQuestion[];
  ideationMetadata: {
    sessionId: string;
    confidenceAtCapture: number;
    viabilityAtCapture: number;
    viabilityRisks: typeof viabilityRisks;
    userSuggestedIdea: boolean;
  };
} {
  return {
    preAnsweredQuestions: generatePreAnsweredQuestions(signals),
    ideationMetadata: {
      sessionId,
      confidenceAtCapture: candidateConfidence,
      viabilityAtCapture: candidateViability,
      viabilityRisks,
      userSuggestedIdea: false, // Set based on candidate.userSuggested
    },
  };
}
```

### 6.3 Tests

```typescript
describe("PreAnsweredQuestionsMapper", () => {
  describe("generatePreAnsweredQuestions", () => {
    test("PASS: Maps high-severity frustrations to problem statement", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Finding doctors is too hard",
              source: "user",
              severity: "high",
            },
            {
              description: "Wait times are excessive",
              source: "user",
              severity: "high",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const problemQuestion = result.find(
        (q) => q.questionId === "DEV_PROBLEM_STATEMENT",
      );
      expect(problemQuestion).toBeDefined();
      expect(problemQuestion!.answer).toContain("Finding doctors");
      expect(problemQuestion!.confidence).toBeGreaterThanOrEqual(0.6);
    });

    test("PASS: Maps customer type to target user", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          customerType: { value: "B2B", confidence: 0.9 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const targetUser = result.find((q) => q.questionId === "DEV_TARGET_USER");
      expect(targetUser).toBeDefined();
      expect(targetUser!.answer).toBe("Businesses and organizations");
    });

    test("PASS: Maps product type to solution type", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          productType: { value: "Digital", confidence: 0.8 },
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const solutionType = result.find(
        (q) => q.questionId === "DEV_SOLUTION_TYPE",
      );
      expect(solutionType).toBeDefined();
      expect(solutionType!.answer).toBe("Software/digital product");
    });

    test("PASS: Maps competitors to competitor list", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {
          competitors: [
            {
              name: "Competitor A",
              description: "Market leader",
              strengths: [],
              weaknesses: [],
              source: "web",
            },
            {
              name: "Competitor B",
              description: "Fast growing",
              strengths: [],
              weaknesses: [],
              source: "web",
            },
          ],
        },
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const competitors = result.find(
        (q) => q.questionId === "DEV_COMPETITORS",
      );
      expect(competitors).toBeDefined();
      expect(competitors!.answer).toContain("Competitor A");
      expect(competitors!.answer).toContain("Competitor B");
    });

    test("PASS: Maps expertise to unfair advantage", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          expertise: [
            {
              area: "Healthcare IT",
              depth: "expert",
              evidence: "Worked 10 years",
            },
            {
              area: "Machine Learning",
              depth: "competent",
              evidence: "Self-taught",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const advantage = result.find(
        (q) => q.questionId === "DEV_UNFAIR_ADVANTAGE",
      );
      expect(advantage).toBeDefined();
      expect(advantage!.answer).toContain("Healthcare IT");
      expect(advantage!.answer).not.toContain("Machine Learning"); // Only expert level
    });

    test("PASS: Maps time constraints to commitment level", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          constraints: {
            timeHoursPerWeek: 15,
          },
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const commitment = result.find(
        (q) => q.questionId === "DEV_TIME_COMMITMENT",
      );
      expect(commitment).toBeDefined();
      expect(commitment!.answer).toBe("Side project (10-20 hours/week)");
    });

    test("PASS: Skips questions below confidence threshold", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {
          customerType: { value: "B2B", confidence: 0.3 }, // Below 0.7 threshold
        },
      };

      const result = generatePreAnsweredQuestions(signals);

      const targetUser = result.find((q) => q.questionId === "DEV_TARGET_USER");
      expect(targetUser).toBeUndefined();
    });

    test("PASS: Returns empty array for empty signals", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      expect(result).toEqual([]);
    });

    test("PASS: Includes evidence quotes", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Test frustration",
              source: "user",
              severity: "high",
              quote: "I hate this!",
            },
          ],
        },
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generatePreAnsweredQuestions(signals);

      const problemQuestion = result.find(
        (q) => q.questionId === "DEV_PROBLEM_STATEMENT",
      );
      expect(problemQuestion?.evidenceQuotes).toBeDefined();
      expect(problemQuestion?.evidenceQuotes.length).toBeGreaterThan(0);
    });
  });

  describe("generateDevelopmentHandoff", () => {
    test("PASS: Includes all metadata", () => {
      const signals: IdeationSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowingState: {},
      };

      const result = generateDevelopmentHandoff(
        signals,
        "session_123",
        75,
        80,
        [
          {
            riskType: "saturated_market",
            description: "Many competitors",
            severity: "medium",
          },
        ],
      );

      expect(result.ideationMetadata.sessionId).toBe("session_123");
      expect(result.ideationMetadata.confidenceAtCapture).toBe(75);
      expect(result.ideationMetadata.viabilityAtCapture).toBe(80);
      expect(result.ideationMetadata.viabilityRisks).toHaveLength(1);
    });
  });
});
```

---

## 7. Helper Utilities

### 7.1 Context Extraction Helpers

```typescript
// =============================================================================
// FILE: agents/ideation/context-helpers.ts
// =============================================================================

import type { IdeationMessage } from "../../types/ideation";

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
  const assistantMessages = messages.filter((m) => m.role === "assistant");

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
```

---

## 8. Implementation Checklist

- [ ] Create `agents/ideation/` directory
- [ ] Create `agents/ideation/confidence-calculator.ts`
- [ ] Create `agents/ideation/viability-calculator.ts`
- [ ] Create `agents/ideation/token-counter.ts`
- [ ] Create `tests/ideation/confidence-calculator.test.ts`
- [ ] Create `tests/ideation/viability-calculator.test.ts`
- [ ] Create `tests/ideation/token-counter.test.ts`
- [ ] Run tests: `npm test -- tests/ideation/confidence-calculator.test.ts`
- [ ] Run tests: `npm test -- tests/ideation/viability-calculator.test.ts`
- [ ] Run tests: `npm test -- tests/ideation/token-counter.test.ts`
- [ ] Verify all tests pass

---

## 6. Success Criteria

| Test Category                     | Expected Pass |
| --------------------------------- | ------------- |
| Confidence - Problem Definition   | 6             |
| Confidence - Target User          | 5             |
| Confidence - Solution Direction   | 4             |
| Confidence - Differentiation      | 4             |
| Confidence - User Fit             | 4             |
| Confidence - Total Score          | 5             |
| Confidence - Helpers              | 4             |
| Viability - Market Exists         | 4             |
| Viability - Technical Feasibility | 6             |
| Viability - Competitive Space     | 3             |
| Viability - Resource Reality      | 4             |
| Viability - Clarity Score         | 2             |
| Viability - Intervention          | 3             |
| Viability - Total Score           | 4             |
| Viability - Helpers               | 4             |
| Token Counter                     | 12            |
| **Total**                         | **70+**       |
