import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  ButtonOption,
} from '../../types/ideation.js';

/**
 * SIGNAL EXTRACTOR
 *
 * Extracts structured signals from user messages and agent responses.
 * Uses a combination of LLM inference (when available in response) and
 * rule-based pattern matching for real-time extraction.
 */

export interface ParsedAgentResponse {
  reply: string;
  buttons?: ButtonOption[];
  formFields?: Record<string, unknown>;
  signals?: {
    selfDiscovery?: Partial<SelfDiscoveryState>;
    marketDiscovery?: Partial<MarketDiscoveryState>;
    narrowing?: Partial<NarrowingState>;
  };
  candidateTitle?: string;
  candidateSummary?: string;
}

export interface ExtractedSignals {
  selfDiscovery: Partial<SelfDiscoveryState>;
  marketDiscovery: Partial<MarketDiscoveryState>;
  narrowing: Partial<NarrowingState>;
}

export interface ExtractionContext {
  selfDiscovery: Partial<SelfDiscoveryState>;
  marketDiscovery: Partial<MarketDiscoveryState>;
  narrowing: Partial<NarrowingState>;
}

/**
 * Extract signals from user message and agent response.
 * Combines LLM-extracted signals with rule-based extraction.
 */
export function extractSignals(
  userMessage: string,
  agentResponse: ParsedAgentResponse,
  currentState: ExtractionContext
): ExtractedSignals {
  // Start with LLM-extracted signals if available
  const signals: ExtractedSignals = {
    selfDiscovery: agentResponse.signals?.selfDiscovery || {},
    marketDiscovery: agentResponse.signals?.marketDiscovery || {},
    narrowing: agentResponse.signals?.narrowing || {},
  };

  // Apply rule-based extraction to fill gaps
  const ruleExtracted = extractWithRules(userMessage, currentState);

  // Merge rule-based extractions (LLM takes precedence)
  return {
    selfDiscovery: { ...ruleExtracted.selfDiscovery, ...signals.selfDiscovery },
    marketDiscovery: { ...ruleExtracted.marketDiscovery, ...signals.marketDiscovery },
    narrowing: { ...ruleExtracted.narrowing, ...signals.narrowing },
  };
}

/**
 * Rule-based signal extraction patterns.
 */
function extractWithRules(
  message: string,
  _context: ExtractionContext
): ExtractedSignals {
  const signals: ExtractedSignals = {
    selfDiscovery: {},
    marketDiscovery: {},
    narrowing: {},
  };

  const lowerMessage = message.toLowerCase();

  // Extract frustrations
  const frustrationPatterns = [
    /(?:hate|frustrate|annoy|bother|drives me crazy|sick of)\s+(?:it\s+)?(?:when\s+)?(.+?)(?:\.|$)/gi,
    /(?:I'm tired of|I'm sick of|I can't stand)\s+(.+?)(?:\.|$)/gi,
    /(?:the problem is|the issue is)\s+(.+?)(?:\.|$)/gi,
  ];

  const frustrations: Array<{
    description: string;
    source: string;
    severity: 'high' | 'medium' | 'low';
  }> = [];

  for (const pattern of frustrationPatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const description = match[1].trim();
      if (description.length > 10) {
        frustrations.push({
          description,
          source: 'user_message',
          severity: determineSeverity(match[0]),
        });
      }
    }
  }

  if (frustrations.length > 0) {
    signals.selfDiscovery.frustrations = frustrations;
  }

  // Extract customer type signals
  const customerTypeSignals = extractCustomerType(lowerMessage);
  if (customerTypeSignals.value) {
    signals.narrowing.customerType = customerTypeSignals;
  }

  // Extract product type signals
  const productTypeSignals = extractProductType(lowerMessage);
  if (productTypeSignals.value) {
    signals.narrowing.productType = productTypeSignals;
  }

  // Extract geography signals
  const geographySignals = extractGeography(lowerMessage);
  if (geographySignals.value) {
    signals.narrowing.geography = geographySignals;
  }

  // Extract expertise signals
  const expertiseSignals = extractExpertise(message);
  if (expertiseSignals.length > 0) {
    signals.selfDiscovery.expertise = expertiseSignals;
  }

  // Extract interest signals
  const interestSignals = extractInterests(message);
  if (interestSignals.length > 0) {
    signals.selfDiscovery.interests = interestSignals;
  }

  // Extract impact vision
  const impactVision = extractImpactVision(lowerMessage);
  if (impactVision) {
    signals.selfDiscovery.impactVision = impactVision;
  }

  return signals;
}

/**
 * Determine severity based on language intensity.
 */
function determineSeverity(text: string): 'high' | 'medium' | 'low' {
  const highIntensity = ['hate', 'drives me crazy', "can't stand", 'absolutely', 'terrible'];
  const lowIntensity = ['minor', 'small', 'little', 'somewhat', 'slightly'];

  const lower = text.toLowerCase();

  if (highIntensity.some(word => lower.includes(word))) {
    return 'high';
  }
  if (lowIntensity.some(word => lower.includes(word))) {
    return 'low';
  }
  return 'medium';
}

/**
 * Extract customer type from message.
 */
export function extractCustomerType(message: string): { value: string | null; confidence: number } {
  const b2bPatterns = [
    /\b(?:business|businesses|companies|enterprise|enterprises|B2B|corporate|corporations)\b/i,
    /\b(?:for\s+companies|sell\s+to\s+businesses|business\s+customers)\b/i,
  ];

  const b2cPatterns = [
    /\b(?:consumers?|individuals?|people|users?|customers|B2C|personal)\b/i,
    /\b(?:for\s+people|everyday\s+users|regular\s+people)\b/i,
  ];

  const marketplacePatterns = [
    /\b(?:marketplace|platform|two-sided|both\s+buyers?\s+and\s+sellers?)\b/i,
  ];

  let b2bScore = 0;
  let b2cScore = 0;
  let marketplaceScore = 0;

  for (const pattern of b2bPatterns) {
    if (pattern.test(message)) b2bScore++;
  }
  for (const pattern of b2cPatterns) {
    if (pattern.test(message)) b2cScore++;
  }
  for (const pattern of marketplacePatterns) {
    if (pattern.test(message)) marketplaceScore++;
  }

  if (marketplaceScore > 0) {
    return { value: 'marketplace', confidence: 0.8 };
  }
  if (b2bScore > b2cScore && b2bScore > 0) {
    return { value: 'B2B', confidence: Math.min(0.9, 0.5 + b2bScore * 0.2) };
  }
  if (b2cScore > b2bScore && b2cScore > 0) {
    return { value: 'B2C', confidence: Math.min(0.9, 0.5 + b2cScore * 0.2) };
  }

  return { value: null, confidence: 0 };
}

/**
 * Extract product type from message.
 */
export function extractProductType(message: string): { value: string | null; confidence: number } {
  const digitalPatterns = [
    /\b(?:app|software|SaaS|platform|website|digital|online|mobile)\b/i,
    /\b(?:API|dashboard|tool|automation)\b/i,
  ];

  const physicalPatterns = [
    /\b(?:physical|hardware|device|product|manufacturing|tangible)\b/i,
    /\b(?:shipping|inventory|warehouse)\b/i,
  ];

  const servicePatterns = [
    /\b(?:service|consulting|agency|freelance|coaching|training)\b/i,
    /\b(?:done-for-you|managed|outsourced)\b/i,
  ];

  let digitalScore = 0;
  let physicalScore = 0;
  let serviceScore = 0;

  for (const pattern of digitalPatterns) {
    if (pattern.test(message)) digitalScore++;
  }
  for (const pattern of physicalPatterns) {
    if (pattern.test(message)) physicalScore++;
  }
  for (const pattern of servicePatterns) {
    if (pattern.test(message)) serviceScore++;
  }

  // Check for hybrid signals
  const scores = [
    { type: 'digital', score: digitalScore },
    { type: 'physical', score: physicalScore },
    { type: 'service', score: serviceScore },
  ].sort((a, b) => b.score - a.score);

  if (scores[0].score > 0 && scores[1].score > 0 && scores[0].score === scores[1].score) {
    return { value: 'hybrid', confidence: 0.6 };
  }

  if (scores[0].score > 0) {
    return { value: scores[0].type, confidence: Math.min(0.9, 0.5 + scores[0].score * 0.15) };
  }

  return { value: null, confidence: 0 };
}

/**
 * Extract geography from message.
 */
export function extractGeography(message: string): { value: string | null; confidence: number } {
  const localPatterns = [
    /\b(?:local|my\s+city|my\s+area|nearby|neighborhood|suburb)\b/i,
    /\b(?:Sydney|Melbourne|Brisbane|Perth|Adelaide)\b/i,
  ];

  const nationalPatterns = [
    /\b(?:national|country-wide|Australia-wide|across\s+Australia)\b/i,
  ];

  const globalPatterns = [
    /\b(?:global|worldwide|international|anywhere|remote)\b/i,
  ];

  let localScore = 0;
  let nationalScore = 0;
  let globalScore = 0;

  for (const pattern of localPatterns) {
    if (pattern.test(message)) localScore++;
  }
  for (const pattern of nationalPatterns) {
    if (pattern.test(message)) nationalScore++;
  }
  for (const pattern of globalPatterns) {
    if (pattern.test(message)) globalScore++;
  }

  if (globalScore > Math.max(localScore, nationalScore)) {
    return { value: 'global', confidence: Math.min(0.9, 0.5 + globalScore * 0.2) };
  }
  if (nationalScore > Math.max(localScore, globalScore)) {
    return { value: 'national', confidence: Math.min(0.9, 0.5 + nationalScore * 0.2) };
  }
  if (localScore > 0) {
    return { value: 'local', confidence: Math.min(0.9, 0.5 + localScore * 0.2) };
  }

  return { value: null, confidence: 0 };
}

/**
 * Extract expertise areas from message.
 */
export function extractExpertise(message: string): Array<{
  area: string;
  depth: 'expert' | 'competent' | 'novice';
  evidence: string;
}> {
  const expertisePatterns = [
    { pattern: /I(?:'ve| have)\s+(?:worked|been working)\s+(?:in|on|with)\s+(.+?)\s+for\s+(\d+)\s+years?/gi, depth: 'expert' as const },
    { pattern: /I\s+know\s+a\s+lot\s+about\s+(.+?)(?:\.|,|$)/gi, depth: 'competent' as const },
    { pattern: /I(?:'m| am)\s+(?:an?\s+)?expert\s+(?:in|at)\s+(.+?)(?:\.|,|$)/gi, depth: 'expert' as const },
    { pattern: /I\s+specialize\s+in\s+(.+?)(?:\.|,|$)/gi, depth: 'expert' as const },
    { pattern: /my\s+background\s+is\s+in\s+(.+?)(?:\.|,|$)/gi, depth: 'competent' as const },
  ];

  const expertise: Array<{
    area: string;
    depth: 'expert' | 'competent' | 'novice';
    evidence: string;
  }> = [];

  for (const { pattern, depth } of expertisePatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const area = match[1].trim();
      if (area.length > 3 && area.length < 100) {
        expertise.push({
          area,
          depth,
          evidence: match[0],
        });
      }
    }
  }

  return expertise;
}

/**
 * Extract interests from message.
 */
export function extractInterests(message: string): Array<{
  topic: string;
  genuine: boolean;
  evidence: string;
}> {
  const interestPatterns = [
    { pattern: /I(?:'m| am)\s+(?:really\s+)?(?:interested|passionate|excited)\s+(?:in|about)\s+(.+?)(?=\.|,|!|$)/gi, genuine: true },
    { pattern: /I\s+love\s+(.+?)(?=\.|,|!|$)/gi, genuine: true },
    { pattern: /I\s+enjoy\s+(.+?)(?=\.|,|!|$)/gi, genuine: true },
    { pattern: /I\s+want\s+to\s+(?:work\s+on|explore|learn|try)\s+(.+?)(?=\.|,|!|$)/gi, genuine: false },
    { pattern: /I(?:'d| would)\s+like\s+to\s+(?:explore|learn|try)\s+(.+?)(?=\.|,|!|$)/gi, genuine: false },
  ];

  const interests: Array<{
    topic: string;
    genuine: boolean;
    evidence: string;
  }> = [];

  for (const { pattern, genuine } of interestPatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      const topic = match[1].trim();
      if (topic.length >= 2 && topic.length < 100) {
        interests.push({
          topic,
          genuine,
          evidence: match[0],
        });
      }
    }
  }

  return interests;
}

/**
 * Extract impact vision from message.
 */
export function extractImpactVision(message: string): {
  level: 'world' | 'country' | 'city' | 'community' | null;
  description: string | null;
  confidence: number;
} | null {
  const worldPatterns = [
    /\b(?:change\s+the\s+world|global\s+impact|worldwide|humanity)\b/i,
    /\b(?:millions\s+of\s+people|everyone|the\s+planet)\b/i,
  ];

  const countryPatterns = [
    /\b(?:across\s+Australia|nationally|country-wide|Australian)\b/i,
  ];

  const cityPatterns = [
    /\b(?:my\s+city|locally|in\s+Sydney|in\s+Melbourne|urban)\b/i,
  ];

  const communityPatterns = [
    /\b(?:my\s+community|neighborhood|local\s+community|small\s+group)\b/i,
  ];

  for (const pattern of worldPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { level: 'world', description: match[0], confidence: 0.7 };
    }
  }

  for (const pattern of countryPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { level: 'country', description: match[0], confidence: 0.7 };
    }
  }

  for (const pattern of cityPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { level: 'city', description: match[0], confidence: 0.7 };
    }
  }

  for (const pattern of communityPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { level: 'community', description: match[0], confidence: 0.7 };
    }
  }

  return null;
}

/**
 * Extract market data from web search results.
 */
export function extractMarketData(searchResults: { title: string; url: string; snippet: string }[]): {
  competitors: Array<{ name: string; description: string; source: string }>;
  gaps: Array<{ description: string; source: string }>;
  timingSignals: Array<{ signal: string; source: string }>;
} {
  const competitors: Array<{ name: string; description: string; source: string }> = [];
  const gaps: Array<{ description: string; source: string }> = [];
  const timingSignals: Array<{ signal: string; source: string }> = [];

  for (const result of searchResults) {
    // Extract competitor mentions
    const companyPatterns = [
      /(?:competitor|alternative|similar to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/g,
      /([A-Z][a-zA-Z]+)\s+(?:offers|provides|is a|is the)\s+/g,
    ];

    for (const pattern of companyPatterns) {
      let match;
      while ((match = pattern.exec(result.snippet)) !== null) {
        competitors.push({
          name: match[1],
          description: result.snippet.slice(0, 100),
          source: result.url,
        });
      }
    }

    // Extract gap mentions
    const gapPatterns = [
      /(?:lack of|missing|no\s+solution|gap in)\s+(.+?)(?:\.|,|$)/gi,
      /(?:unmet need|underserved)\s+(.+?)(?:\.|,|$)/gi,
    ];

    for (const pattern of gapPatterns) {
      let match;
      while ((match = pattern.exec(result.snippet)) !== null) {
        gaps.push({
          description: match[1].trim(),
          source: result.url,
        });
      }
    }

    // Extract timing signals
    const timingPatterns = [
      /(?:growing|emerging|trending|rising|new)\s+(?:market|demand|interest)/gi,
      /(?:recent|2024|2025)\s+(?:regulation|law|change)/gi,
    ];

    for (const pattern of timingPatterns) {
      const match = result.snippet.match(pattern);
      if (match) {
        timingSignals.push({
          signal: match[0],
          source: result.url,
        });
      }
    }
  }

  return { competitors, gaps, timingSignals };
}
