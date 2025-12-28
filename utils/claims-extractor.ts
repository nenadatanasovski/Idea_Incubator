/**
 * Claims Extractor
 *
 * Extract verifiable claims from idea content for research verification.
 * Used to build targeted search queries for market and technology validation.
 */
import { client, useClaudeCli } from './anthropic-client.js';
import { CostTracker } from './cost-tracker.js';
import { logDebug, logWarning } from './logger.js';

export interface ExtractedClaims {
  domain: string;
  technology: string[];
  competitors: string[];
  marketSize: string | null;
  targetMarket: string;
  keyAssumptions: string[];
}

/**
 * Extract verifiable claims from idea content using LLM.
 *
 * @param content - The idea content (README.md)
 * @param costTracker - Cost tracker instance for API usage
 * @returns Extracted claims for research verification
 */
export async function extractClaimsFromContent(
  content: string,
  costTracker: CostTracker
): Promise<ExtractedClaims> {
  // Use manual extraction if using CLI (to avoid unexpected costs)
  if (useClaudeCli) {
    logDebug('Using manual claims extraction (CLI mode)');
    return extractClaimsManually(content);
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-3-5-20240307',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract key claims from this idea description for research verification.

${content.substring(0, 6000)}

Return JSON:
{
  "domain": "primary industry/market domain (e.g., 'plant care', 'fintech', 'healthcare SaaS')",
  "technology": ["key technologies mentioned (e.g., 'AI', 'React Native', 'computer vision')"],
  "competitors": ["competitors or alternatives mentioned by name"],
  "marketSize": "any market size claims or null (e.g., '$50B TAM')",
  "targetMarket": "target customer description (e.g., 'small business owners', 'home gardeners')",
  "keyAssumptions": ["key assumptions the idea relies on (e.g., 'users willing to pay $10/month', 'AI can accurately identify plants')"]
}`
      }]
    });

    costTracker.track(response.usage, 'claims-extraction');

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logDebug('Claims extraction: No JSON found in response');
      return extractClaimsManually(content);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      domain: parsed.domain || 'general',
      technology: Array.isArray(parsed.technology) ? parsed.technology : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      marketSize: parsed.marketSize || null,
      targetMarket: parsed.targetMarket || 'general consumers',
      keyAssumptions: Array.isArray(parsed.keyAssumptions) ? parsed.keyAssumptions : []
    };
  } catch (error) {
    logWarning(`LLM claims extraction failed: ${error}`);
    return extractClaimsManually(content);
  }
}

/**
 * Extract claims using pattern matching (fallback when LLM unavailable).
 */
function extractClaimsManually(content: string): ExtractedClaims {
  const claims = createEmptyClaims();
  const lowerContent = content.toLowerCase();

  // Extract technology mentions
  const techPatterns = [
    'ai', 'machine learning', 'ml', 'deep learning', 'neural network',
    'computer vision', 'nlp', 'natural language', 'gpt', 'llm',
    'react', 'vue', 'angular', 'node', 'python', 'typescript',
    'aws', 'gcp', 'azure', 'kubernetes', 'docker',
    'blockchain', 'web3', 'nft', 'crypto',
    'mobile app', 'ios', 'android', 'react native', 'flutter',
    'api', 'saas', 'paas', 'microservices', 'iot', 'wearable',
    'cloud', 'telemedicine', 'telehealth'
  ];
  for (const tech of techPatterns) {
    if (lowerContent.includes(tech)) {
      claims.technology.push(tech);
    }
  }

  // Extract market size claims
  const marketSizeMatch = content.match(/\$[\d,]+\s*(billion|million|B|M|bn|mn)/i);
  if (marketSizeMatch) {
    claims.marketSize = marketSizeMatch[0];
  }

  // Extract TAM/SAM/SOM claims
  const tamMatch = content.match(/TAM[:\s]+\$?[\d,]+\s*(billion|million|B|M)?/i);
  if (tamMatch) {
    claims.marketSize = claims.marketSize || tamMatch[0];
  }

  // Extract competitors mentioned in Competition section
  const competitionMatch = content.match(/##\s*Competition[\s\S]*?(?=##|$)/i);
  if (competitionMatch) {
    // Look for list items in competition section
    const listItems = competitionMatch[0].match(/^[-*]\s*(.+?)(?:\s*\(|$)/gm);
    if (listItems) {
      claims.competitors = listItems
        .map(item => item.replace(/^[-*]\s*/, '').replace(/\s*\(.*$/, '').trim())
        .filter(c => c.length > 0 && c.length < 50);
    }
  }

  // Extract domain from summary or title
  const summaryMatch = content.match(/summary:\s*"?([^"\n]+)"?/i);
  if (summaryMatch) {
    // Extract key domain words from summary
    const summaryWords = summaryMatch[1].toLowerCase();
    const domainPatterns = [
      'pet', 'health', 'wellness', 'fitness', 'finance', 'fintech',
      'education', 'edtech', 'food', 'travel', 'real estate',
      'e-commerce', 'social', 'gaming', 'entertainment', 'healthcare',
      'insurance', 'legal', 'hr', 'marketing', 'productivity'
    ];
    for (const domain of domainPatterns) {
      if (summaryWords.includes(domain)) {
        claims.domain = domain;
        break;
      }
    }
  }

  // Fallback: Try to extract domain from title
  if (claims.domain === 'general') {
    const titleMatch = content.match(/^#\s+(.+)/m);
    if (titleMatch) {
      claims.domain = titleMatch[1].split(' ').slice(0, 3).join(' ').toLowerCase();
    }
  }

  // Extract target market
  const targetMatch = content.match(/##\s*Target\s*Market[\s\S]*?(?=##|$)/i);
  if (targetMatch) {
    const firstLine = targetMatch[0].split('\n').find(l => l.match(/^[-*]/));
    if (firstLine) {
      claims.targetMarket = firstLine.replace(/^[-*]\s*/, '').trim();
    }
  }

  return claims;
}

/**
 * Create empty claims object.
 */
function createEmptyClaims(): ExtractedClaims {
  return {
    domain: 'general',
    technology: [],
    competitors: [],
    marketSize: null,
    targetMarket: 'general consumers',
    keyAssumptions: []
  };
}

/**
 * Build search queries from extracted claims.
 * Returns targeted queries for market and technology verification.
 */
export function buildSearchQueries(claims: ExtractedClaims): string[] {
  const year = new Date().getFullYear();
  const queries: string[] = [];

  // Market size verification
  if (claims.domain && claims.domain !== 'general') {
    queries.push(`${claims.domain} market size ${year}`);
    queries.push(`${claims.domain} industry analysis report ${year}`);
  }

  // Competitor discovery
  if (claims.domain && claims.domain !== 'general') {
    queries.push(`${claims.domain} companies startups ${year}`);
  }

  // Verify mentioned competitors
  if (claims.competitors.length > 0) {
    queries.push(`${claims.competitors.slice(0, 3).join(' ')} alternatives competitors`);
  }

  // Market trends
  if (claims.domain && claims.domain !== 'general') {
    queries.push(`${claims.domain} market trends growth ${year}`);
  }

  // Technology feasibility (limit to 2)
  for (const tech of claims.technology.slice(0, 2)) {
    queries.push(`${tech} implementation production examples ${year}`);
  }

  // Deduplicate
  return [...new Set(queries)];
}
