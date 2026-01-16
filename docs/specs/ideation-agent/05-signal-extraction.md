# Spec 5: Signal Extraction

## Overview

This specification covers the signal extraction system that parses user messages and agent responses to populate session state. Uses a hybrid approach: LLM-provided signals with rule-based fallback.

## Dependencies

- Spec 1: Database & Data Models
- Spec 4: Session Management (state types)

---

## 1. Signal Extractor

Create file: `agents/ideation/signal-extractor.ts`

```typescript
import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  ExtractedSignal,
} from "../../types/ideation.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";

/**
 * SIGNAL EXTRACTION SYSTEM
 *
 * Primary: Use signals from LLM's structured JSON output
 * Fallback: Rule-based pattern matching on conversation text
 * Merge: Combine both with LLM signals taking precedence
 */

export interface ExtractedSignals {
  selfDiscovery: Partial<SelfDiscoveryState>;
  marketDiscovery: Partial<MarketDiscoveryState>;
  narrowing: Partial<NarrowingState>;
}

export interface ParsedAgentResponse {
  reply: string;
  buttons?: Array<{ id: string; label: string; value: string; style: string }>;
  formFields?: Record<string, unknown>;
  signals?: Partial<ExtractedSignals>;
  candidateTitle?: string;
  candidateSummary?: string;
}

export interface SessionState {
  selfDiscovery?: Partial<SelfDiscoveryState>;
  marketDiscovery?: Partial<MarketDiscoveryState>;
  narrowing?: Partial<NarrowingState>;
}

/**
 * Extract signals from user message and agent response.
 */
export function extractSignals(
  userMessage: string,
  agentResponse: ParsedAgentResponse,
  existingState: SessionState,
): ExtractedSignals {
  // Primary: LLM-provided signals (if agent returned them)
  const llmSignals = agentResponse.signals || {};

  // Fallback: Rule-based extraction from conversation text
  const textSignals = extractSignalsFromText(userMessage, agentResponse.reply);

  // Merge with LLM signals taking precedence
  return mergeSignals(llmSignals, textSignals, existingState);
}

// ============================================================================
// RULE-BASED SIGNAL EXTRACTION (Fallback)
// ============================================================================

/**
 * Extract signals from text using pattern matching.
 */
export function extractSignalsFromText(
  userMessage: string,
  agentReply: string,
): ExtractedSignals {
  const signals: ExtractedSignals = {
    selfDiscovery: {},
    marketDiscovery: {},
    narrowing: {},
  };

  const msgLower = userMessage.toLowerCase();

  // ---------------------------------------------------------------------------
  // FRUSTRATION DETECTION
  // ---------------------------------------------------------------------------
  signals.selfDiscovery.frustrations = extractFrustrations(userMessage);

  // ---------------------------------------------------------------------------
  // CUSTOMER TYPE DETECTION
  // ---------------------------------------------------------------------------
  const customerType = extractCustomerType(userMessage);
  if (customerType) {
    signals.narrowing = {
      ...signals.narrowing,
      customerType: customerType,
    };
  }

  // ---------------------------------------------------------------------------
  // PRODUCT TYPE DETECTION
  // ---------------------------------------------------------------------------
  const productType = extractProductType(userMessage);
  if (productType) {
    signals.narrowing = {
      ...signals.narrowing,
      productType: productType,
    };
  }

  // ---------------------------------------------------------------------------
  // GEOGRAPHY DETECTION
  // ---------------------------------------------------------------------------
  const geography = extractGeography(userMessage);
  if (geography) {
    signals.narrowing = {
      ...signals.narrowing,
      geography: geography,
    };
  }

  // ---------------------------------------------------------------------------
  // EXPERTISE INDICATORS
  // ---------------------------------------------------------------------------
  signals.selfDiscovery.expertise = extractExpertise(userMessage);

  // ---------------------------------------------------------------------------
  // INTEREST/PASSION INDICATORS
  // ---------------------------------------------------------------------------
  signals.selfDiscovery.interests = extractInterests(userMessage);

  // ---------------------------------------------------------------------------
  // CONSTRAINT INDICATORS
  // ---------------------------------------------------------------------------
  const constraints = extractConstraints(userMessage);
  if (Object.keys(constraints).length > 0) {
    signals.selfDiscovery.constraints = constraints;
  }

  return signals;
}

// ============================================================================
// FRUSTRATION EXTRACTION
// ============================================================================

const FRUSTRATION_PATTERNS = [
  { pattern: /i('m| am) (so )?frustrat(ed|ing)/i, severity: "high" as const },
  { pattern: /drives me (crazy|nuts|insane)/i, severity: "high" as const },
  { pattern: /i hate (when|how|that)/i, severity: "high" as const },
  { pattern: /annoy(s|ed|ing)/i, severity: "medium" as const },
  { pattern: /wish (i|there was|someone would)/i, severity: "medium" as const },
  { pattern: /pain(ful)? (to|when)/i, severity: "medium" as const },
  { pattern: /takes (forever|too long|way too)/i, severity: "medium" as const },
  { pattern: /hard(er)? than it should/i, severity: "medium" as const },
  { pattern: /doesn't work (well|properly|right)/i, severity: "low" as const },
  { pattern: /could be better/i, severity: "low" as const },
];

export function extractFrustrations(text: string): Array<{
  description: string;
  source: string;
  severity: "high" | "medium" | "low";
}> {
  const frustrations: Array<{
    description: string;
    source: string;
    severity: "high" | "medium" | "low";
  }> = [];

  for (const { pattern, severity } of FRUSTRATION_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      const context = extractSurroundingContext(text, match.index, 100);
      frustrations.push({
        description: context,
        source: "user_message",
        severity,
      });
      break; // Only capture strongest frustration per message
    }
  }

  return frustrations;
}

// ============================================================================
// CUSTOMER TYPE EXTRACTION
// ============================================================================

const CUSTOMER_TYPE_PATTERNS = [
  {
    pattern: /\b(B2B|business(es)?|enterprise|companies|corporate)\b/i,
    value: "B2B",
  },
  {
    pattern: /\b(B2C|consumer|individual|people|everyone|person)\b/i,
    value: "B2C",
  },
  { pattern: /\b(marketplace|platform|two[- ]sided)\b/i, value: "Marketplace" },
  { pattern: /\b(small business|SMB|SME|startup)\b/i, value: "B2B_SMB" },
];

export function extractCustomerType(
  text: string,
): { value: string; confidence: number } | null {
  for (const { pattern, value } of CUSTOMER_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        value,
        confidence: 0.6, // Lower confidence for rule-based extraction
      };
    }
  }
  return null;
}

// ============================================================================
// PRODUCT TYPE EXTRACTION
// ============================================================================

const PRODUCT_TYPE_PATTERNS = [
  {
    pattern: /\b(app|software|saas|platform|website|tool|api)\b/i,
    value: "Digital",
  },
  {
    pattern: /\b(physical|hardware|device|gadget|product|manufacturing)\b/i,
    value: "Physical",
  },
  {
    pattern: /\b(service|consulting|agency|freelance|coaching)\b/i,
    value: "Service",
  },
  { pattern: /\b(marketplace|platform connecting)\b/i, value: "Marketplace" },
];

export function extractProductType(
  text: string,
): { value: string; confidence: number } | null {
  for (const { pattern, value } of PRODUCT_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        value,
        confidence: 0.6,
      };
    }
  }
  return null;
}

// ============================================================================
// GEOGRAPHY EXTRACTION
// ============================================================================

const GEOGRAPHY_PATTERNS = [
  { pattern: /\b(local|my city|nearby|neighborhood)\b/i, value: "Local" },
  {
    pattern: /\b(australia|australian|sydney|melbourne|brisbane)\b/i,
    value: "Australia",
  },
  {
    pattern: /\b(global|worldwide|international|anywhere)\b/i,
    value: "Global",
  },
  { pattern: /\b(us|usa|america|states)\b/i, value: "USA" },
  { pattern: /\b(uk|united kingdom|britain|london)\b/i, value: "UK" },
  { pattern: /\b(europe|european|eu)\b/i, value: "Europe" },
];

export function extractGeography(
  text: string,
): { value: string; confidence: number } | null {
  for (const { pattern, value } of GEOGRAPHY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        value,
        confidence: 0.7,
      };
    }
  }
  return null;
}

// ============================================================================
// EXPERTISE EXTRACTION
// ============================================================================

const EXPERTISE_PATTERNS = [
  /i('ve| have) (been |)working (in|on|with)/i,
  /i('ve| have) (spent )?(\d+) years/i,
  /i know (a lot )?about/i,
  /in my experience/i,
  /i('m| am) (a|an) (expert|specialist|professional)/i,
];

export function extractExpertise(text: string): Array<{
  area: string;
  depth: "expert" | "competent" | "novice";
  evidence: string;
}> {
  const expertise: Array<{
    area: string;
    depth: "expert" | "competent" | "novice";
    evidence: string;
  }> = [];

  for (const pattern of EXPERTISE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      const context = extractSurroundingContext(text, match.index, 150);
      expertise.push({
        area: extractTopicFromContext(context),
        depth: "competent", // Conservative estimate
        evidence: context,
      });
    }
  }

  return expertise;
}

// ============================================================================
// INTEREST EXTRACTION
// ============================================================================

const PASSION_PATTERNS = [
  /i love/i,
  /i('m| am) passionate about/i,
  /i really (enjoy|like)/i,
  /i can('t| cannot) stop thinking about/i,
  /i lose track of time when/i,
  /fascinates me/i,
];

export function extractInterests(text: string): Array<{
  topic: string;
  genuine: boolean;
  evidence: string;
}> {
  const interests: Array<{
    topic: string;
    genuine: boolean;
    evidence: string;
  }> = [];

  for (const pattern of PASSION_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      const context = extractSurroundingContext(text, match.index, 100);
      interests.push({
        topic: extractTopicFromContext(context),
        genuine: true,
        evidence: context,
      });
    }
  }

  return interests;
}

// ============================================================================
// CONSTRAINT EXTRACTION
// ============================================================================

export function extractConstraints(
  text: string,
): Partial<SelfDiscoveryState["constraints"]> {
  const constraints: Partial<SelfDiscoveryState["constraints"]> = {};
  const msgLower = text.toLowerCase();

  // Time constraints
  const timeMatch = text.match(/(\d+)\s*(hours?|hrs?)\s*(per|a|\/)\s*week/i);
  if (timeMatch) {
    constraints.timeHoursPerWeek = parseInt(timeMatch[1]);
  }

  // Capital constraints
  if (
    /bootstrap|self[- ]fund|no (outside )?funding|own money/i.test(msgLower)
  ) {
    constraints.capital = "bootstrap";
  } else if (/raise|funding|investors|vc|venture/i.test(msgLower)) {
    constraints.capital = "seeking_funding";
  }

  // Risk tolerance
  if (/low risk|safe|secure|stable/i.test(msgLower)) {
    constraints.riskTolerance = "low";
  } else if (/high risk|gamble|bet big|all in/i.test(msgLower)) {
    constraints.riskTolerance = "high";
  }

  return constraints;
}

// ============================================================================
// IMPACT VISION EXTRACTION
// ============================================================================

export type ImpactLevel =
  | "world"
  | "country"
  | "city"
  | "community"
  | "individual";

export interface ImpactVision {
  level: ImpactLevel;
  description: string;
  evidence: string;
  confidence: number; // 0-100
}

const IMPACT_PATTERNS: Record<ImpactLevel, RegExp[]> = {
  world: [
    /change the world/i,
    /global impact/i,
    /billions of (people|lives)/i,
    /humanity|mankind/i,
    /worldwide|global scale/i,
    /revolutionize the (world|planet|industry)/i,
    /solve (a )?(global|world) (problem|crisis)/i,
  ],
  country: [
    /across (the country|australia|usa|uk)/i,
    /national(ly)?/i,
    /throughout (australia|the nation)/i,
    /millions of (people|users|customers)/i,
    /country-?wide/i,
    /help (australians?|americans?|canadians?)/i,
  ],
  city: [
    /in (my |our )?(city|town|area|region)/i,
    /local(ly)?/i,
    /(sydney|melbourne|brisbane|perth|adelaide)/i,
    /thousands of (people|users)/i,
    /in (the )?city/i,
    /regional/i,
  ],
  community: [
    /(my |our )community/i,
    /neighborhood|neighbourhood/i,
    /(small |local )group/i,
    /hundreds of (people|users)/i,
    /niche (market|audience|community)/i,
    /specific (group|audience|segment)/i,
  ],
  individual: [
    /help (myself|individuals)/i,
    /personal/i,
    /one(-| )on(-| )one/i,
    /small scale/i,
    /few (people|users|customers)/i,
  ],
};

/**
 * Extract impact vision from user text.
 * Determines the scope/scale of desired impact.
 */
export function extractImpactVision(text: string): ImpactVision | null {
  const textLower = text.toLowerCase();

  // Check each level from broadest to narrowest
  const levels: ImpactLevel[] = [
    "world",
    "country",
    "city",
    "community",
    "individual",
  ];

  for (const level of levels) {
    for (const pattern of IMPACT_PATTERNS[level]) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        const evidence = extractSurroundingContext(text, match.index, 100);
        return {
          level,
          description: getImpactDescription(level),
          evidence,
          confidence: calculateImpactConfidence(text, level),
        };
      }
    }
  }

  return null;
}

function getImpactDescription(level: ImpactLevel): string {
  const descriptions: Record<ImpactLevel, string> = {
    world: "Global impact affecting billions",
    country: "National impact affecting millions",
    city: "Regional/city impact affecting thousands",
    community: "Community impact affecting hundreds",
    individual: "Individual/personal impact",
  };
  return descriptions[level];
}

function calculateImpactConfidence(text: string, level: ImpactLevel): number {
  const patterns = IMPACT_PATTERNS[level];
  let matchCount = 0;

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matchCount++;
    }
  }

  // Multiple pattern matches increase confidence
  // 1 match = 60%, 2 matches = 75%, 3+ matches = 90%
  if (matchCount >= 3) return 90;
  if (matchCount === 2) return 75;
  return 60;
}

// ============================================================================
// INTEREST STRENGTH SCORING
// ============================================================================

export type EngagementLevel =
  | "passionate"
  | "interested"
  | "curious"
  | "casual";

export interface InterestWithStrength {
  topic: string;
  genuine: boolean;
  evidence: string;
  engagementLevel: EngagementLevel;
  strengthScore: number; // 0-100
}

const PASSIONATE_INDICATORS = [
  /i live and breathe/i,
  /obsessed with/i,
  /can('t| cannot) stop/i,
  /my life('s)? (work|mission|passion)/i,
  /dedicate(d)? my/i,
  /years (of experience|working) (in|on|with)/i,
];

const INTERESTED_INDICATORS = [
  /i('m| am) passionate about/i,
  /i love/i,
  /fascinates me/i,
  /i really (enjoy|care about)/i,
  /means a lot to me/i,
];

const CURIOUS_INDICATORS = [
  /i('m| am) curious about/i,
  /want(ed)? to (learn|explore|try)/i,
  /interesting (to me)?/i,
  /intrigued by/i,
];

const CASUAL_INDICATORS = [
  /i (kind of |sort of )?like/i,
  /might be (cool|nice|fun)/i,
  /could be interesting/i,
  /i guess/i,
];

/**
 * Score interest/passion strength.
 * Returns detailed engagement assessment.
 */
export function scoreInterestStrength(
  text: string,
  topic: string,
): InterestWithStrength {
  const evidence = text;

  // Check from highest to lowest engagement
  if (PASSIONATE_INDICATORS.some((p) => p.test(text))) {
    return {
      topic,
      genuine: true,
      evidence,
      engagementLevel: "passionate",
      strengthScore: 90,
    };
  }

  if (INTERESTED_INDICATORS.some((p) => p.test(text))) {
    return {
      topic,
      genuine: true,
      evidence,
      engagementLevel: "interested",
      strengthScore: 70,
    };
  }

  if (CURIOUS_INDICATORS.some((p) => p.test(text))) {
    return {
      topic,
      genuine: false, // Not yet proven genuine
      evidence,
      engagementLevel: "curious",
      strengthScore: 50,
    };
  }

  // Default to casual
  return {
    topic,
    genuine: false,
    evidence,
    engagementLevel: "casual",
    strengthScore: 30,
  };
}

/**
 * Enhanced interest extraction with strength scoring.
 */
export function extractInterestsWithStrength(
  text: string,
): InterestWithStrength[] {
  const interests: InterestWithStrength[] = [];
  const allPatterns = [
    ...PASSIONATE_INDICATORS,
    ...INTERESTED_INDICATORS,
    ...CURIOUS_INDICATORS,
    ...PASSION_PATTERNS,
  ];

  for (const pattern of allPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      const context = extractSurroundingContext(text, match.index, 100);
      const topic = extractTopicFromContext(context);

      // Avoid duplicates
      if (!interests.some((i) => i.topic === topic)) {
        interests.push(scoreInterestStrength(context, topic));
      }
    }
  }

  // Sort by strength score descending
  return interests.sort((a, b) => b.strengthScore - a.strengthScore);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract surrounding context from a match.
 */
export function extractSurroundingContext(
  text: string,
  matchIndex: number,
  radius: number,
): string {
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + radius);
  let context = text.slice(start, end).trim();

  // Add ellipsis if truncated
  if (start > 0) context = "..." + context;
  if (end < text.length) context = context + "...";

  return context;
}

/**
 * Extract likely topic from context.
 */
export function extractTopicFromContext(context: string): string {
  // Remove common filler words and extract key phrase
  const cleaned = context
    .replace(/^.*?(about|with|in|on|for)\s+/i, "")
    .replace(/[.!?,;].*$/, "")
    .trim();

  return cleaned.slice(0, 50); // Limit length
}

// ============================================================================
// SIGNAL MERGING
// ============================================================================

/**
 * Merge LLM signals with rule-based signals.
 * LLM signals take precedence.
 */
export function mergeSignals(
  llmSignals: Partial<ExtractedSignals>,
  textSignals: ExtractedSignals,
  existingState: SessionState,
): ExtractedSignals {
  return {
    selfDiscovery: {
      ...existingState.selfDiscovery,
      ...textSignals.selfDiscovery,
      ...llmSignals.selfDiscovery,
      // Merge arrays (frustrations, expertise, interests)
      frustrations: dedupeByDescription([
        ...(existingState.selfDiscovery?.frustrations || []),
        ...(textSignals.selfDiscovery?.frustrations || []),
        ...(llmSignals.selfDiscovery?.frustrations || []),
      ]),
      expertise: dedupeByArea([
        ...(existingState.selfDiscovery?.expertise || []),
        ...(textSignals.selfDiscovery?.expertise || []),
        ...(llmSignals.selfDiscovery?.expertise || []),
      ]),
      interests: dedupeByTopic([
        ...(existingState.selfDiscovery?.interests || []),
        ...(textSignals.selfDiscovery?.interests || []),
        ...(llmSignals.selfDiscovery?.interests || []),
      ]),
    },
    marketDiscovery: {
      ...existingState.marketDiscovery,
      ...textSignals.marketDiscovery,
      ...llmSignals.marketDiscovery,
    },
    narrowing: {
      ...existingState.narrowing,
      // For narrowing, only update if new signal has higher confidence
      productType: selectHigherConfidence(
        existingState.narrowing?.productType,
        textSignals.narrowing?.productType,
        llmSignals.narrowing?.productType,
      ),
      customerType: selectHigherConfidence(
        existingState.narrowing?.customerType,
        textSignals.narrowing?.customerType,
        llmSignals.narrowing?.customerType,
      ),
      geography: selectHigherConfidence(
        existingState.narrowing?.geography,
        textSignals.narrowing?.geography,
        llmSignals.narrowing?.geography,
      ),
    },
  };
}

// Deduplication helpers
function dedupeByDescription<T extends { description: string }>(
  items: T[],
): T[] {
  return items.filter(
    (v, i, a) => a.findIndex((t) => t.description === v.description) === i,
  );
}

function dedupeByArea<T extends { area: string }>(items: T[]): T[] {
  return items.filter((v, i, a) => a.findIndex((t) => t.area === v.area) === i);
}

function dedupeByTopic<T extends { topic: string }>(items: T[]): T[] {
  return items.filter(
    (v, i, a) => a.findIndex((t) => t.topic === v.topic) === i,
  );
}

/**
 * Select the option with highest confidence.
 */
function selectHigherConfidence<
  T extends { value: string | null; confidence: number },
>(...options: (T | undefined)[]): T {
  const validOptions = options.filter((o) => o && o.value !== null) as T[];
  if (validOptions.length === 0) {
    return { value: null, confidence: 0 } as T;
  }
  return validOptions.reduce((best, current) =>
    current.confidence > best.confidence ? current : best,
  );
}

// ============================================================================
// MARKET DATA EXTRACTION FROM WEB SEARCH
// ============================================================================

export interface CompetitorData {
  name: string;
  description: string;
  url?: string;
  strengths?: string[];
  weaknesses?: string[];
  pricingModel?: string;
}

export interface MarketGap {
  description: string;
  evidence: string;
  opportunity: string;
  confidence: number; // 0-100
}

export interface MarketTrend {
  name: string;
  direction: "growing" | "stable" | "declining";
  evidence: string;
  relevance: string;
}

export interface ExtractedMarketData {
  competitors: CompetitorData[];
  gaps: MarketGap[];
  trends: MarketTrend[];
  marketSize?: {
    value: string;
    currency: string;
    year: number;
    source: string;
  };
  searchQuery: string;
  extractedAt: string;
}

/**
 * Extract market data from web search response text.
 * Used when agent performs market research during ideation.
 */
export function extractMarketDataFromResponse(
  searchResponse: string,
  searchQuery: string,
): ExtractedMarketData {
  const data: ExtractedMarketData = {
    competitors: [],
    gaps: [],
    trends: [],
    searchQuery,
    extractedAt: new Date().toISOString(),
  };

  // Extract competitors
  data.competitors = extractCompetitors(searchResponse);

  // Extract market gaps
  data.gaps = extractMarketGaps(searchResponse);

  // Extract trends
  data.trends = extractMarketTrends(searchResponse);

  // Extract market size
  data.marketSize = extractMarketSize(searchResponse);

  return data;
}

const COMPETITOR_PATTERNS = [
  /(?:competitor|alternative|similar to|like|compared to|versus|vs\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:is a|offers|provides|competes)/gi,
  /(?:market leader|top player|dominant|leading)\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
];

function extractCompetitors(text: string): CompetitorData[] {
  const competitors: CompetitorData[] = [];
  const seenNames = new Set<string>();

  for (const pattern of COMPETITOR_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();

      // Filter out common false positives
      if (name.length < 3 || seenNames.has(name.toLowerCase())) continue;
      if (/^(The|This|That|They|It|We|Our|Their)$/i.test(name)) continue;

      seenNames.add(name.toLowerCase());

      // Extract surrounding context for description
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(text.length, match.index + 200);
      const context = text.slice(contextStart, contextEnd);

      competitors.push({
        name,
        description: extractCompetitorDescription(context, name),
        strengths: extractStrengths(context),
        weaknesses: extractWeaknesses(context),
      });
    }
  }

  return competitors.slice(0, 10); // Limit to top 10
}

function extractCompetitorDescription(context: string, name: string): string {
  // Try to find a sentence that describes what the competitor does
  const sentences = context
    .split(/[.!?]/)
    .filter((s) => s.toLowerCase().includes(name.toLowerCase()));
  if (sentences.length > 0) {
    return sentences[0].trim().slice(0, 200);
  }
  return "";
}

function extractStrengths(context: string): string[] {
  const strengths: string[] = [];
  const patterns = [
    /(?:strength|advantage|benefit|known for|excels at)\s*[:\-]?\s*([^.!?]+)/gi,
    /(?:pros?)\s*[:\-]\s*([^.!?]+)/gi,
  ];

  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) {
      strengths.push(match[1].trim().slice(0, 100));
    }
  }

  return strengths;
}

function extractWeaknesses(context: string): string[] {
  const weaknesses: string[] = [];
  const patterns = [
    /(?:weakness|disadvantage|drawback|limited|lacks)\s*[:\-]?\s*([^.!?]+)/gi,
    /(?:cons?)\s*[:\-]\s*([^.!?]+)/gi,
    /(?:complaints?|criticism)\s*[:\-]?\s*([^.!?]+)/gi,
  ];

  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) {
      weaknesses.push(match[1].trim().slice(0, 100));
    }
  }

  return weaknesses;
}

const GAP_PATTERNS = [
  /(?:gap|missing|lacking|no one|nobody)\s+(?:in the market|offers|provides|solves)\s*[:\-]?\s*([^.!?]+)/gi,
  /(?:opportunity|underserved|unmet need)\s*[:\-]?\s*([^.!?]+)/gi,
  /(?:pain point|frustration|complaint)\s+(?:about|with|is)\s*[:\-]?\s*([^.!?]+)/gi,
];

function extractMarketGaps(text: string): MarketGap[] {
  const gaps: MarketGap[] = [];

  for (const pattern of GAP_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const description = match[1].trim();
      if (description.length < 10) continue;

      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + 150);

      gaps.push({
        description: description.slice(0, 200),
        evidence: text.slice(contextStart, contextEnd).trim(),
        opportunity: inferOpportunity(description),
        confidence: 60, // Default confidence for pattern-matched gaps
      });
    }
  }

  return gaps.slice(0, 5); // Limit to top 5
}

function inferOpportunity(gapDescription: string): string {
  return `Address: ${gapDescription.slice(0, 100)}`;
}

const TREND_PATTERNS = [
  /(?:trend|growing|rising|increasing)\s*[:\-]?\s*([^.!?]+)/gi,
  /(?:market.*(?:growing|expanding|projected))\s*[:\-]?\s*([^.!?]+)/gi,
  /(?:declining|shrinking|decreasing)\s+(?:market|demand|interest)\s*[:\-]?\s*([^.!?]+)/gi,
];

function extractMarketTrends(text: string): MarketTrend[] {
  const trends: MarketTrend[] = [];

  for (const pattern of TREND_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const evidence = match[1].trim();
      if (evidence.length < 10) continue;

      const direction = determineTrendDirection(match[0]);

      trends.push({
        name: evidence.slice(0, 50),
        direction,
        evidence: evidence.slice(0, 150),
        relevance: "Identified from market research",
      });
    }
  }

  return trends.slice(0, 5);
}

function determineTrendDirection(
  matchText: string,
): "growing" | "stable" | "declining" {
  const lower = matchText.toLowerCase();
  if (/growing|rising|increasing|expanding|projected/.test(lower))
    return "growing";
  if (/declining|shrinking|decreasing|falling/.test(lower)) return "declining";
  return "stable";
}

const MARKET_SIZE_PATTERN =
  /(?:market size|market value|tam|total addressable market)\s*[:\-]?\s*\$?([\d,.]+)\s*(billion|million|trillion|B|M|T)?/gi;

function extractMarketSize(
  text: string,
):
  | { value: string; currency: string; year: number; source: string }
  | undefined {
  const match = MARKET_SIZE_PATTERN.exec(text);
  if (!match) return undefined;

  const value = match[1];
  const unit = match[2] || "";

  // Try to find year near the market size mention
  const contextStart = Math.max(0, match.index - 50);
  const contextEnd = Math.min(text.length, match.index + 100);
  const context = text.slice(contextStart, contextEnd);
  const yearMatch = context.match(/20\d{2}/);

  return {
    value: `${value} ${unit}`.trim(),
    currency: "USD",
    year: yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear(),
    source: "Web search extraction",
  };
}

/**
 * Update market discovery state with extracted web search data.
 */
export function updateMarketDiscoveryWithWebData(
  currentState: Partial<MarketDiscoveryState>,
  webData: ExtractedMarketData,
): Partial<MarketDiscoveryState> {
  return {
    ...currentState,
    competitors: [
      ...(currentState.competitors || []),
      ...webData.competitors.map((c) => ({
        name: c.name,
        description: c.description,
        differentiator: c.strengths?.join(", ") || "Unknown",
      })),
    ],
    gaps: [
      ...(currentState.gaps || []),
      ...webData.gaps.map((g) => ({
        description: g.description,
        evidence: g.evidence,
        opportunity: g.opportunity,
      })),
    ],
    trends: [
      ...(currentState.trends || []),
      ...webData.trends.map((t) => ({
        name: t.name,
        direction: t.direction,
        relevance: t.relevance,
      })),
    ],
    searchesPerformed: [
      ...(currentState.searchesPerformed || []),
      {
        query: webData.searchQuery,
        timestamp: webData.extractedAt,
        findings: `Found ${webData.competitors.length} competitors, ${webData.gaps.length} gaps, ${webData.trends.length} trends`,
      },
    ],
  };
}
```

---

## 2. Vagueness Detection

Create file: `agents/ideation/vagueness-detector.ts`

```typescript
import {
  SelfDiscoveryState,
  NarrowingState,
  IdeaCandidate,
  IdeationMessage,
} from "../../types/ideation.js";

/**
 * VAGUENESS DETECTION
 *
 * Flags ideas that are too abstract/undefined to validate with market research.
 * Returns specific issues and suggested clarifying questions.
 */

export interface VaguenessIssue {
  type:
    | "abstract_problem"
    | "undefined_user"
    | "handwavy_solution"
    | "no_scope"
    | "buzzword_heavy";
  description: string;
  evidence: string;
}

export interface VaguenessAssessment {
  isVague: boolean;
  score: number; // 0-100, higher = more vague
  issues: VaguenessIssue[];
  clarifyingQuestions: string[];
}

// Pattern groups
const ABSTRACT_PROBLEM_PATTERNS = [
  /make (things|it|the world) better/i,
  /improve (the |)(experience|situation|things)/i,
  /help people/i, // Too broad without specifics
  /solve (a|the) problem/i, // Meta - doesn't say which problem
];

const UNDEFINED_USER_PATTERNS = [
  /for (everyone|anybody|anyone|all people)/i,
  /target (market|audience|users?).*everyone/i,
  /people (in general|broadly)/i,
];

const HANDWAVY_SOLUTION_PATTERNS = [
  /use (AI|ML|blockchain|technology) to/i, // Tech as magic wand
  /some (kind|sort|type) of/i,
  /something (like|similar to)/i,
  /basically (just |)a/i,
  /leverage.*to/i, // Corporate speak
];

const BUZZWORDS = [
  "synergy",
  "leverage",
  "disrupt",
  "revolutionize",
  "paradigm",
  "ecosystem",
  "holistic",
  "scalable",
  "robust",
  "seamless",
  "cutting-edge",
  "next-gen",
  "innovative",
  "game-changing",
];

/**
 * Assess vagueness of an idea based on current state.
 */
export function assessVagueness(
  candidate: IdeaCandidate | null,
  selfDiscovery: SelfDiscoveryState,
  narrowingState: NarrowingState,
  conversationHistory: IdeationMessage[],
): VaguenessAssessment {
  const issues: VaguenessIssue[] = [];
  const clarifyingQuestions: string[] = [];

  // Get recent user messages for analysis
  const recentUserMessages = conversationHistory
    .filter((m) => m.role === "user")
    .slice(-10)
    .map((m) => m.content)
    .join(" ");

  // ---------------------------------------------------------------------------
  // ABSTRACT PROBLEM DETECTION
  // ---------------------------------------------------------------------------
  for (const pattern of ABSTRACT_PROBLEM_PATTERNS) {
    const match = recentUserMessages.match(pattern);
    if (match && selfDiscovery.frustrations.length === 0) {
      issues.push({
        type: "abstract_problem",
        description: "Problem statement is too abstract to validate",
        evidence: match[0],
      });
      clarifyingQuestions.push(
        "Can you describe a specific moment when you experienced this problem? What exactly happened?",
      );
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // UNDEFINED USER DETECTION
  // ---------------------------------------------------------------------------
  for (const pattern of UNDEFINED_USER_PATTERNS) {
    const match = recentUserMessages.match(pattern);
    if (match) {
      issues.push({
        type: "undefined_user",
        description: 'Target user is undefined - "everyone" means no one',
        evidence: match[0],
      });
      clarifyingQuestions.push(
        'Who would be desperate to use this? Not "nice to have" - who NEEDS it?',
      );
      break;
    }
  }

  // ---------------------------------------------------------------------------
  // HANDWAVY SOLUTION DETECTION
  // ---------------------------------------------------------------------------
  if (!candidate?.summary || candidate.summary.length < 20) {
    for (const pattern of HANDWAVY_SOLUTION_PATTERNS) {
      const match = recentUserMessages.match(pattern);
      if (match) {
        issues.push({
          type: "handwavy_solution",
          description: "Solution is described in vague terms",
          evidence: match[0],
        });
        clarifyingQuestions.push(
          "Walk me through exactly what happens when someone uses this. They open it and then what?",
        );
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // NO SCOPE DETECTION
  // ---------------------------------------------------------------------------
  const hasScope =
    narrowingState.productType.value !== null ||
    narrowingState.customerType.value !== null ||
    narrowingState.geography.value !== null;

  if (!hasScope && conversationHistory.length > 10) {
    issues.push({
      type: "no_scope",
      description: "No clear scope defined after extended conversation",
      evidence: "Product type, customer type, and geography all undefined",
    });
    clarifyingQuestions.push(
      "Let's narrow this down: Would this be software, a physical product, or a service?",
    );
  }

  // ---------------------------------------------------------------------------
  // BUZZWORD HEAVY DETECTION
  // ---------------------------------------------------------------------------
  const buzzwordCount = BUZZWORDS.filter((bw) =>
    recentUserMessages.toLowerCase().includes(bw),
  ).length;

  if (buzzwordCount >= 3) {
    const foundBuzzwords = BUZZWORDS.filter((bw) =>
      recentUserMessages.toLowerCase().includes(bw),
    );
    issues.push({
      type: "buzzword_heavy",
      description: "Description relies on buzzwords instead of specifics",
      evidence: `Found ${buzzwordCount} buzzwords: ${foundBuzzwords.join(", ")}`,
    });
    clarifyingQuestions.push(
      "Let's get concrete: What does V1 actually DO? Not the vision - the minimum first version.",
    );
  }

  // ---------------------------------------------------------------------------
  // CALCULATE VAGUENESS SCORE
  // ---------------------------------------------------------------------------
  let score = 0;

  // Each issue type adds to score
  score += issues.filter((i) => i.type === "abstract_problem").length * 25;
  score += issues.filter((i) => i.type === "undefined_user").length * 25;
  score += issues.filter((i) => i.type === "handwavy_solution").length * 20;
  score += issues.filter((i) => i.type === "no_scope").length * 15;
  score += issues.filter((i) => i.type === "buzzword_heavy").length * 15;

  // Reduce score if we have concrete signals
  if (selfDiscovery.frustrations.length > 0) score -= 15;
  if (selfDiscovery.expertise.length > 0) score -= 10;
  if (narrowingState.customerType.value) score -= 10;
  if (candidate?.summary && candidate.summary.length > 50) score -= 15;

  score = Math.max(0, Math.min(100, score));

  return {
    isVague: score >= 50,
    score,
    issues,
    clarifyingQuestions: clarifyingQuestions.slice(0, 2), // Max 2 questions
  };
}

/**
 * Get clarifying question for most pressing vagueness issue.
 */
export function getTopClarifyingQuestion(
  assessment: VaguenessAssessment,
): string | null {
  if (assessment.clarifyingQuestions.length === 0) return null;
  return assessment.clarifyingQuestions[0];
}
```

---

## 3. Test Plan

Create file: `tests/ideation/signal-extractor.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import {
  extractSignals,
  extractSignalsFromText,
  extractFrustrations,
  extractCustomerType,
  extractProductType,
  extractGeography,
  extractExpertise,
  extractInterests,
  extractConstraints,
  extractSurroundingContext,
  extractTopicFromContext,
  mergeSignals,
} from "../../agents/ideation/signal-extractor.js";

describe("SignalExtractor", () => {
  // ===========================================================================
  // FRUSTRATION EXTRACTION
  // ===========================================================================

  describe("extractFrustrations", () => {
    test('PASS: Detects high-severity frustration with "frustrated"', () => {
      const text = "I'm so frustrated with how slow this app is";
      const frustrations = extractFrustrations(text);

      expect(frustrations.length).toBe(1);
      expect(frustrations[0].severity).toBe("high");
      expect(frustrations[0].source).toBe("user_message");
    });

    test('PASS: Detects high-severity frustration with "drives me crazy"', () => {
      const text = "It drives me crazy when the system crashes";
      const frustrations = extractFrustrations(text);

      expect(frustrations.length).toBe(1);
      expect(frustrations[0].severity).toBe("high");
    });

    test('PASS: Detects high-severity frustration with "I hate"', () => {
      const text = "I hate when meetings go over time";
      const frustrations = extractFrustrations(text);

      expect(frustrations.length).toBe(1);
      expect(frustrations[0].severity).toBe("high");
    });

    test('PASS: Detects medium-severity frustration with "annoying"', () => {
      const text = "Its really annoying to have to do this manually";
      const frustrations = extractFrustrations(text);

      expect(frustrations.length).toBe(1);
      expect(frustrations[0].severity).toBe("medium");
    });

    test('PASS: Detects medium-severity frustration with "wish"', () => {
      const text = "I wish there was a better way to track expenses";
      const frustrations = extractFrustrations(text);

      expect(frustrations.length).toBe(1);
      expect(frustrations[0].severity).toBe("medium");
    });

    test('PASS: Detects low-severity frustration with "could be better"', () => {
      const text = "The current solution could be better";
      const frustrations = extractFrustrations(text);

      expect(frustrations.length).toBe(1);
      expect(frustrations[0].severity).toBe("low");
    });

    test("PASS: Returns empty array when no frustration detected", () => {
      const text = "I had a great day today, everything worked perfectly";
      const frustrations = extractFrustrations(text);

      expect(frustrations).toEqual([]);
    });

    test("PASS: Captures surrounding context", () => {
      const text =
        "I'm frustrated with the booking process for coworking spaces";
      const frustrations = extractFrustrations(text);

      expect(frustrations[0].description).toContain("booking process");
    });
  });

  // ===========================================================================
  // CUSTOMER TYPE EXTRACTION
  // ===========================================================================

  describe("extractCustomerType", () => {
    test("PASS: Detects B2B", () => {
      const result = extractCustomerType("I want to sell to businesses");
      expect(result).not.toBeNull();
      expect(result!.value).toBe("B2B");
      expect(result!.confidence).toBe(0.6);
    });

    test('PASS: Detects B2B with "enterprise"', () => {
      const result = extractCustomerType(
        "Enterprise customers would love this",
      );
      expect(result!.value).toBe("B2B");
    });

    test("PASS: Detects B2C", () => {
      const result = extractCustomerType(
        "Regular consumers would use this app",
      );
      expect(result!.value).toBe("B2C");
    });

    test('PASS: Detects B2C with "individual"', () => {
      const result = extractCustomerType("For individual users who need help");
      expect(result!.value).toBe("B2C");
    });

    test("PASS: Detects Marketplace", () => {
      const result = extractCustomerType("It would be a two-sided marketplace");
      expect(result!.value).toBe("Marketplace");
    });

    test("PASS: Detects B2B_SMB", () => {
      const result = extractCustomerType("Small business owners are my target");
      expect(result!.value).toBe("B2B_SMB");
    });

    test("PASS: Returns null for no match", () => {
      const result = extractCustomerType("I like pizza");
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // PRODUCT TYPE EXTRACTION
  // ===========================================================================

  describe("extractProductType", () => {
    test('PASS: Detects Digital with "app"', () => {
      const result = extractProductType("I want to build an app");
      expect(result!.value).toBe("Digital");
    });

    test('PASS: Detects Digital with "software"', () => {
      const result = extractProductType("This would be software for teams");
      expect(result!.value).toBe("Digital");
    });

    test('PASS: Detects Digital with "SaaS"', () => {
      const result = extractProductType("A SaaS product for HR");
      expect(result!.value).toBe("Digital");
    });

    test("PASS: Detects Physical", () => {
      const result = extractProductType("A physical device for monitoring");
      expect(result!.value).toBe("Physical");
    });

    test("PASS: Detects Service", () => {
      const result = extractProductType("A consulting service for startups");
      expect(result!.value).toBe("Service");
    });

    test("PASS: Detects Marketplace", () => {
      const result = extractProductType(
        "A platform connecting buyers and sellers",
      );
      expect(result!.value).toBe("Marketplace");
    });
  });

  // ===========================================================================
  // GEOGRAPHY EXTRACTION
  // ===========================================================================

  describe("extractGeography", () => {
    test("PASS: Detects Local", () => {
      const result = extractGeography("Just for my city");
      expect(result!.value).toBe("Local");
    });

    test("PASS: Detects Australia", () => {
      const result = extractGeography("I'm based in Sydney");
      expect(result!.value).toBe("Australia");
    });

    test("PASS: Detects Global", () => {
      const result = extractGeography("This could work worldwide");
      expect(result!.value).toBe("Global");
    });

    test("PASS: Detects USA", () => {
      const result = extractGeography("The US market is huge");
      expect(result!.value).toBe("USA");
    });

    test("PASS: Has higher confidence than customer type", () => {
      const result = extractGeography("Focused on Australia");
      expect(result!.confidence).toBe(0.7);
    });
  });

  // ===========================================================================
  // EXPERTISE EXTRACTION
  // ===========================================================================

  describe("extractExpertise", () => {
    test('PASS: Detects "working in" pattern', () => {
      const expertise = extractExpertise(
        "I've been working in healthcare for 10 years",
      );
      expect(expertise.length).toBe(1);
      expect(expertise[0].depth).toBe("competent");
    });

    test('PASS: Detects "years" pattern', () => {
      const expertise = extractExpertise(
        "I've spent 5 years building software",
      );
      expect(expertise.length).toBe(1);
    });

    test('PASS: Detects "in my experience" pattern', () => {
      const expertise = extractExpertise(
        "In my experience, this is how things work",
      );
      expect(expertise.length).toBe(1);
    });

    test('PASS: Detects "expert" declaration', () => {
      const expertise = extractExpertise("I'm an expert in machine learning");
      expect(expertise.length).toBe(1);
    });

    test("PASS: Captures multiple expertise areas", () => {
      const expertise = extractExpertise(
        "I've been working in finance. In my experience, this is important.",
      );
      expect(expertise.length).toBe(2);
    });
  });

  // ===========================================================================
  // INTEREST EXTRACTION
  // ===========================================================================

  describe("extractInterests", () => {
    test('PASS: Detects "I love"', () => {
      const interests = extractInterests("I love building products");
      expect(interests.length).toBe(1);
      expect(interests[0].genuine).toBe(true);
    });

    test('PASS: Detects "passionate about"', () => {
      const interests = extractInterests("I'm passionate about sustainability");
      expect(interests.length).toBe(1);
    });

    test('PASS: Detects "fascinates me"', () => {
      const interests = extractInterests("AI fascinates me deeply");
      expect(interests.length).toBe(1);
    });
  });

  // ===========================================================================
  // CONSTRAINT EXTRACTION
  // ===========================================================================

  describe("extractConstraints", () => {
    test("PASS: Extracts time constraint", () => {
      const constraints = extractConstraints("I have about 10 hours per week");
      expect(constraints.timeHoursPerWeek).toBe(10);
    });

    test('PASS: Extracts time constraint with "hrs"', () => {
      const constraints = extractConstraints("20 hrs/week to spare");
      expect(constraints.timeHoursPerWeek).toBe(20);
    });

    test("PASS: Detects bootstrap capital", () => {
      const constraints = extractConstraints("I want to bootstrap this");
      expect(constraints.capital).toBe("bootstrap");
    });

    test("PASS: Detects self-funding", () => {
      const constraints = extractConstraints("Using my own money only");
      expect(constraints.capital).toBe("bootstrap");
    });

    test("PASS: Detects seeking funding", () => {
      const constraints = extractConstraints("I plan to raise funding");
      expect(constraints.capital).toBe("seeking_funding");
    });

    test("PASS: Detects low risk tolerance", () => {
      const constraints = extractConstraints("I prefer low risk options");
      expect(constraints.riskTolerance).toBe("low");
    });

    test("PASS: Detects high risk tolerance", () => {
      const constraints = extractConstraints("I'm willing to bet big on this");
      expect(constraints.riskTolerance).toBe("high");
    });
  });

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  describe("extractSurroundingContext", () => {
    test("PASS: Extracts context with radius", () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const context = extractSurroundingContext(text, 10, 5);

      expect(context.length).toBeLessThanOrEqual(15);
    });

    test("PASS: Adds ellipsis when truncated", () => {
      const text = "Start middle end";
      const context = extractSurroundingContext(text, 6, 3);

      expect(context).toContain("...");
    });

    test("PASS: Handles start of string", () => {
      const text = "Start of the text";
      const context = extractSurroundingContext(text, 0, 5);

      expect(context).not.toMatch(/^\.{3}/);
    });

    test("PASS: Handles end of string", () => {
      const text = "End of text";
      const context = extractSurroundingContext(text, text.length - 1, 5);

      expect(context).not.toMatch(/\.{3}$/);
    });
  });

  describe("extractTopicFromContext", () => {
    test("PASS: Removes filler words", () => {
      const topic = extractTopicFromContext(
        "I'm passionate about building products",
      );
      expect(topic).not.toMatch(/^about/);
    });

    test("PASS: Limits length to 50 chars", () => {
      const longContext = "a".repeat(100);
      const topic = extractTopicFromContext(longContext);

      expect(topic.length).toBeLessThanOrEqual(50);
    });
  });

  // ===========================================================================
  // SIGNAL MERGING
  // ===========================================================================

  describe("mergeSignals", () => {
    test("PASS: LLM signals take precedence", () => {
      const llmSignals = {
        narrowing: {
          customerType: { value: "B2B", confidence: 0.9 },
        },
      };
      const textSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowing: {
          customerType: { value: "B2C", confidence: 0.6 },
        },
      };

      const merged = mergeSignals(llmSignals, textSignals, {});

      expect(merged.narrowing.customerType?.value).toBe("B2B");
    });

    test("PASS: Dedupes frustrations by description", () => {
      const existing = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Slow app",
              source: "user",
              severity: "high" as const,
            },
          ],
        },
      };
      const textSignals = {
        selfDiscovery: {
          frustrations: [
            {
              description: "Slow app",
              source: "user",
              severity: "high" as const,
            },
          ],
        },
        marketDiscovery: {},
        narrowing: {},
      };

      const merged = mergeSignals({}, textSignals, existing);

      expect(merged.selfDiscovery.frustrations?.length).toBe(1);
    });

    test("PASS: Preserves existing state when no new signals", () => {
      const existing = {
        narrowing: {
          customerType: { value: "B2B", confidence: 0.8 },
        },
      };

      const merged = mergeSignals(
        {},
        {
          selfDiscovery: {},
          marketDiscovery: {},
          narrowing: {},
        },
        existing,
      );

      expect(merged.narrowing.customerType?.value).toBe("B2B");
    });

    test("PASS: Selects higher confidence option", () => {
      const existing = {
        narrowing: {
          productType: { value: "Digital", confidence: 0.5 },
        },
      };
      const textSignals = {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowing: {
          productType: { value: "Service", confidence: 0.8 },
        },
      };

      const merged = mergeSignals({}, textSignals, existing);

      expect(merged.narrowing.productType?.value).toBe("Service");
    });
  });

  // ===========================================================================
  // FULL EXTRACTION
  // ===========================================================================

  describe("extractSignals", () => {
    test("PASS: Combines user message and agent response", () => {
      const userMessage =
        "I'm frustrated with how hard it is to find coworking spaces in Sydney";
      const agentResponse = {
        reply: "That sounds frustrating. Tell me more about your experience.",
        signals: {
          narrowing: {
            geography: { value: "Sydney", confidence: 0.9 },
          },
        },
      };

      const signals = extractSignals(userMessage, agentResponse, {});

      expect(signals.selfDiscovery.frustrations?.length).toBeGreaterThan(0);
      expect(signals.narrowing.geography?.value).toBe("Sydney");
    });

    test("PASS: Falls back to text extraction when no LLM signals", () => {
      const userMessage = "I want to build an app for businesses";
      const agentResponse = {
        reply: "Interesting! What kind of businesses?",
      };

      const signals = extractSignals(userMessage, agentResponse, {});

      expect(signals.narrowing.productType?.value).toBe("Digital");
      expect(signals.narrowing.customerType?.value).toBe("B2B");
    });
  });
});
```

### Vagueness Detector Tests

Create file: `tests/ideation/vagueness-detector.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import {
  assessVagueness,
  getTopClarifyingQuestion,
} from "../../agents/ideation/vagueness-detector.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";
import { IdeationMessage } from "../../types/ideation.js";

// Helper to create messages
function createMessages(contents: string[]): IdeationMessage[] {
  return contents.map((content, i) => ({
    id: `msg_${i}`,
    sessionId: "test_session",
    role: "user" as const,
    content,
    buttonsShown: null,
    buttonClicked: null,
    formShown: null,
    formResponse: null,
    tokenCount: content.length / 4,
    createdAt: new Date(),
  }));
}

describe("VaguenessDetector", () => {
  describe("assessVagueness", () => {
    test("PASS: Detects abstract problem statement", () => {
      const messages = createMessages([
        "I want to make things better",
        "Help people in general",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.issues.some((i) => i.type === "abstract_problem")).toBe(
        true,
      );
    });

    test('PASS: Detects undefined user "everyone"', () => {
      const messages = createMessages([
        "This is for everyone",
        "Target audience is all people",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.issues.some((i) => i.type === "undefined_user")).toBe(
        true,
      );
    });

    test("PASS: Detects handwavy solution with tech buzzwords", () => {
      const messages = createMessages([
        "I want to use AI to solve problems",
        "Something like a platform",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(
        assessment.issues.some((i) => i.type === "handwavy_solution"),
      ).toBe(true);
    });

    test("PASS: Detects no scope after extended conversation", () => {
      const messages = createMessages(Array(15).fill("Some random discussion"));

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.issues.some((i) => i.type === "no_scope")).toBe(true);
    });

    test("PASS: Detects buzzword-heavy description", () => {
      const messages = createMessages([
        "A synergistic platform that leverages innovative paradigms",
        "Creating a holistic ecosystem with seamless integration",
        "Revolutionary next-gen solution for scalable disruption",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.issues.some((i) => i.type === "buzzword_heavy")).toBe(
        true,
      );
    });

    test("PASS: Returns isVague=true for score >= 50", () => {
      const messages = createMessages([
        "I want to help everyone",
        "Make things better using AI",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.isVague).toBe(true);
      expect(assessment.score).toBeGreaterThanOrEqual(50);
    });

    test("PASS: Reduces vagueness score with concrete signals", () => {
      const selfDiscovery = createDefaultSelfDiscoveryState();
      selfDiscovery.frustrations = [
        { description: "Specific problem", source: "user", severity: "high" },
      ];
      selfDiscovery.expertise = [
        { area: "healthcare", depth: "expert", evidence: "worked there" },
      ];

      const narrowing = createDefaultNarrowingState();
      narrowing.customerType = { value: "B2B", confidence: 0.8 };

      const messages = createMessages(["Some vague statement"]);

      const assessment = assessVagueness(
        {
          id: "c1",
          title: "Test",
          summary: "A detailed summary of the idea with specific details.",
        } as any,
        selfDiscovery,
        narrowing,
        messages,
      );

      expect(assessment.score).toBeLessThan(50);
    });

    test("PASS: Provides clarifying questions for issues", () => {
      const messages = createMessages([
        "I want to help everyone with something",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.clarifyingQuestions.length).toBeGreaterThan(0);
    });

    test("PASS: Limits clarifying questions to 2", () => {
      const messages = createMessages([
        "Use AI to leverage synergy for everyone",
        "A paradigm-shifting platform",
      ]);

      const assessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        messages,
      );

      expect(assessment.clarifyingQuestions.length).toBeLessThanOrEqual(2);
    });

    test("PASS: Score is clamped between 0 and 100", () => {
      // Very vague
      const vagueMessages = createMessages([
        "Help everyone with everything using AI",
        "Synergistic holistic paradigm disruption",
      ]);

      const vagueAssessment = assessVagueness(
        null,
        createDefaultSelfDiscoveryState(),
        createDefaultNarrowingState(),
        vagueMessages,
      );

      expect(vagueAssessment.score).toBeLessThanOrEqual(100);
      expect(vagueAssessment.score).toBeGreaterThanOrEqual(0);

      // Very concrete
      const concreteSelfDiscovery = createDefaultSelfDiscoveryState();
      concreteSelfDiscovery.frustrations = [
        { description: "Specific", source: "user", severity: "high" },
        { description: "Another", source: "user", severity: "high" },
      ];
      concreteSelfDiscovery.expertise = [
        { area: "Domain", depth: "expert", evidence: "proof" },
      ];

      const concreteNarrowing = createDefaultNarrowingState();
      concreteNarrowing.customerType = { value: "B2B", confidence: 0.9 };

      const concreteAssessment = assessVagueness(
        {
          id: "c1",
          title: "Test",
          summary: "A very detailed and specific summary of the idea",
        } as any,
        concreteSelfDiscovery,
        concreteNarrowing,
        [],
      );

      expect(concreteAssessment.score).toBeLessThanOrEqual(100);
      expect(concreteAssessment.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getTopClarifyingQuestion", () => {
    test("PASS: Returns first question", () => {
      const assessment = {
        isVague: true,
        score: 60,
        issues: [],
        clarifyingQuestions: ["Question 1", "Question 2"],
      };

      const question = getTopClarifyingQuestion(assessment);

      expect(question).toBe("Question 1");
    });

    test("PASS: Returns null when no questions", () => {
      const assessment = {
        isVague: false,
        score: 20,
        issues: [],
        clarifyingQuestions: [],
      };

      const question = getTopClarifyingQuestion(assessment);

      expect(question).toBeNull();
    });
  });
});
```

### Impact Vision Tests

```typescript
import { describe, test, expect } from "vitest";
import {
  extractImpactVision,
  ImpactLevel,
} from "../../agents/ideation/signal-extractor.js";

describe("ImpactVisionExtraction", () => {
  describe("extractImpactVision", () => {
    test("PASS: Detects world-level impact", () => {
      const vision = extractImpactVision(
        "I want to change the world with this idea",
      );

      expect(vision).not.toBeNull();
      expect(vision!.level).toBe("world");
      expect(vision!.confidence).toBeGreaterThanOrEqual(60);
    });

    test("PASS: Detects global impact with billions", () => {
      const vision = extractImpactVision(
        "This could help billions of people globally",
      );

      expect(vision).not.toBeNull();
      expect(vision!.level).toBe("world");
    });

    test("PASS: Detects country-level impact", () => {
      const vision = extractImpactVision(
        "I want to help Australians across the country",
      );

      expect(vision).not.toBeNull();
      expect(vision!.level).toBe("country");
    });

    test("PASS: Detects city-level impact", () => {
      const vision = extractImpactVision("This is for people in Sydney");

      expect(vision).not.toBeNull();
      expect(vision!.level).toBe("city");
    });

    test("PASS: Detects community-level impact", () => {
      const vision = extractImpactVision("I want to help my local community");

      expect(vision).not.toBeNull();
      expect(vision!.level).toBe("community");
    });

    test("PASS: Detects individual-level impact", () => {
      const vision = extractImpactVision(
        "This is a personal project to help myself",
      );

      expect(vision).not.toBeNull();
      expect(vision!.level).toBe("individual");
    });

    test("PASS: Returns null when no impact indicators", () => {
      const vision = extractImpactVision("I have an idea for a mobile app");

      expect(vision).toBeNull();
    });

    test("PASS: Higher confidence with multiple matches", () => {
      const singleMatch = extractImpactVision("I want to change the world");
      const multiMatch = extractImpactVision(
        "I want to change the world and have global impact reaching billions of people",
      );

      expect(multiMatch!.confidence).toBeGreaterThan(singleMatch!.confidence);
    });
  });
});
```

### Interest Strength Tests

```typescript
import { describe, test, expect } from "vitest";
import {
  scoreInterestStrength,
  extractInterestsWithStrength,
  EngagementLevel,
} from "../../agents/ideation/signal-extractor.js";

describe("InterestStrengthScoring", () => {
  describe("scoreInterestStrength", () => {
    test("PASS: Detects passionate engagement", () => {
      const result = scoreInterestStrength(
        "I live and breathe this space. It's my life's work.",
        "technology",
      );

      expect(result.engagementLevel).toBe("passionate");
      expect(result.strengthScore).toBeGreaterThanOrEqual(80);
      expect(result.genuine).toBe(true);
    });

    test("PASS: Detects obsessed level passion", () => {
      const result = scoreInterestStrength(
        "I'm obsessed with solving this problem",
        "problem solving",
      );

      expect(result.engagementLevel).toBe("passionate");
      expect(result.genuine).toBe(true);
    });

    test("PASS: Detects interested engagement", () => {
      const result = scoreInterestStrength(
        "I love working on developer tools",
        "developer tools",
      );

      expect(result.engagementLevel).toBe("interested");
      expect(result.strengthScore).toBeGreaterThanOrEqual(60);
      expect(result.genuine).toBe(true);
    });

    test("PASS: Detects curious engagement", () => {
      const result = scoreInterestStrength(
        "I'm curious about machine learning",
        "machine learning",
      );

      expect(result.engagementLevel).toBe("curious");
      expect(result.strengthScore).toBeGreaterThanOrEqual(40);
      expect(result.genuine).toBe(false); // Not yet proven genuine
    });

    test("PASS: Detects casual engagement", () => {
      const result = scoreInterestStrength(
        "I kind of like the idea",
        "general",
      );

      expect(result.engagementLevel).toBe("casual");
      expect(result.strengthScore).toBeLessThan(40);
      expect(result.genuine).toBe(false);
    });

    test("PASS: Default to casual for neutral text", () => {
      const result = scoreInterestStrength(
        "There is a market for this",
        "market",
      );

      expect(result.engagementLevel).toBe("casual");
    });
  });

  describe("extractInterestsWithStrength", () => {
    test("PASS: Extracts multiple interests with different strengths", () => {
      const interests = extractInterestsWithStrength(
        "I'm passionate about sustainability, and I'm also curious about blockchain technology",
      );

      expect(interests.length).toBeGreaterThanOrEqual(2);
      // Should be sorted by strength
      expect(interests[0].strengthScore).toBeGreaterThanOrEqual(
        interests[1].strengthScore,
      );
    });

    test("PASS: Returns empty array when no interests", () => {
      const interests = extractInterestsWithStrength(
        "The weather is nice today",
      );

      expect(interests.length).toBe(0);
    });

    test("PASS: Avoids duplicate topics", () => {
      const interests = extractInterestsWithStrength(
        "I love AI and I really enjoy AI tools",
      );

      const uniqueTopics = new Set(interests.map((i) => i.topic));
      expect(interests.length).toBe(uniqueTopics.size);
    });
  });
});
```

### Market Data Extraction Tests

```typescript
import { describe, test, expect } from "vitest";
import {
  extractMarketDataFromResponse,
  updateMarketDiscoveryWithWebData,
  ExtractedMarketData,
} from "../../agents/ideation/signal-extractor.js";

describe("MarketDataExtraction", () => {
  describe("extractMarketDataFromResponse", () => {
    test("PASS: Extracts competitors from search results", () => {
      const searchText = `
        In the project management space, competitor Asana offers robust task management.
        Similar to Trello, which provides kanban boards. The market leader is Monday.com.
      `;

      const data = extractMarketDataFromResponse(
        searchText,
        "project management tools",
      );

      expect(data.competitors.length).toBeGreaterThan(0);
      expect(
        data.competitors.some((c) => c.name.toLowerCase().includes("asana")),
      ).toBe(true);
    });

    test("PASS: Extracts market gaps", () => {
      const searchText = `
        There is a gap in the market for affordable enterprise solutions.
        Users have pain points about complex onboarding processes.
        An underserved segment is small businesses with limited budgets.
      `;

      const data = extractMarketDataFromResponse(
        searchText,
        "enterprise software gaps",
      );

      expect(data.gaps.length).toBeGreaterThan(0);
    });

    test("PASS: Extracts market trends", () => {
      const searchText = `
        The trend is towards remote work solutions. Market is growing at 15% annually.
        AI-powered tools are rising in popularity.
      `;

      const data = extractMarketDataFromResponse(searchText, "market trends");

      expect(data.trends.length).toBeGreaterThan(0);
      expect(data.trends.some((t) => t.direction === "growing")).toBe(true);
    });

    test("PASS: Extracts market size", () => {
      const searchText = `
        The market size for cloud computing is $500 billion as of 2024.
        TAM: $50 billion projected by 2025.
      `;

      const data = extractMarketDataFromResponse(
        searchText,
        "cloud computing market",
      );

      expect(data.marketSize).not.toBeUndefined();
      expect(data.marketSize?.value).toContain("500");
    });

    test("PASS: Handles empty search results gracefully", () => {
      const data = extractMarketDataFromResponse("", "test query");

      expect(data.competitors).toEqual([]);
      expect(data.gaps).toEqual([]);
      expect(data.trends).toEqual([]);
      expect(data.marketSize).toBeUndefined();
      expect(data.searchQuery).toBe("test query");
    });

    test("PASS: Limits competitor extraction to 10", () => {
      // Create text with many potential matches
      const searchText = Array(20)
        .fill(null)
        .map(
          (_, i) =>
            `Company${i} is a competitor. Alternative ProductX${i} offers services.`,
        )
        .join(" ");

      const data = extractMarketDataFromResponse(searchText, "competitors");

      expect(data.competitors.length).toBeLessThanOrEqual(10);
    });
  });

  describe("updateMarketDiscoveryWithWebData", () => {
    test("PASS: Merges web data with existing state", () => {
      const existingState = {
        competitors: [
          {
            name: "Existing",
            description: "Already known",
            differentiator: "First",
          },
        ],
      };

      const webData: ExtractedMarketData = {
        competitors: [{ name: "NewComp", description: "From search" }],
        gaps: [
          {
            description: "A gap",
            evidence: "Some text",
            opportunity: "Fix it",
            confidence: 70,
          },
        ],
        trends: [
          {
            name: "AI trend",
            direction: "growing" as const,
            evidence: "Data",
            relevance: "High",
          },
        ],
        searchQuery: "test",
        extractedAt: new Date().toISOString(),
      };

      const updated = updateMarketDiscoveryWithWebData(existingState, webData);

      expect(updated.competitors?.length).toBe(2);
      expect(updated.gaps?.length).toBe(1);
      expect(updated.trends?.length).toBe(1);
      expect(updated.searchesPerformed?.length).toBe(1);
    });

    test("PASS: Records search in history", () => {
      const webData: ExtractedMarketData = {
        competitors: [{ name: "Comp", description: "Desc" }],
        gaps: [],
        trends: [],
        searchQuery: "my search query",
        extractedAt: "2024-01-15T10:00:00Z",
      };

      const updated = updateMarketDiscoveryWithWebData({}, webData);

      expect(updated.searchesPerformed?.[0].query).toBe("my search query");
      expect(updated.searchesPerformed?.[0].findings).toContain(
        "1 competitors",
      );
    });
  });
});
```

---

## 4. Implementation Checklist

- [ ] Create `agents/ideation/signal-extractor.ts`
- [ ] Create `agents/ideation/vagueness-detector.ts`
- [ ] Create `tests/ideation/signal-extractor.test.ts`
- [ ] Create `tests/ideation/vagueness-detector.test.ts`
- [ ] Run tests: `npm test -- tests/ideation/signal-extractor.test.ts tests/ideation/vagueness-detector.test.ts`
- [ ] Verify all tests pass

---

## 5. Success Criteria

| Test Category             | Expected Pass |
| ------------------------- | ------------- |
| Frustration extraction    | 7             |
| Customer type extraction  | 7             |
| Product type extraction   | 6             |
| Geography extraction      | 5             |
| Expertise extraction      | 5             |
| Interest extraction       | 3             |
| Constraint extraction     | 7             |
| Helper functions          | 4             |
| Signal merging            | 4             |
| Full extraction           | 2             |
| Vagueness detection       | 10            |
| Impact vision extraction  | 8             |
| Interest strength scoring | 10            |
| Market data extraction    | 8             |
| **Total**                 | **86**        |
