/**
 * Pre-Evaluation Research Agent
 *
 * Uses Claude's native WebSearch tool to verify claims and discover
 * market intelligence before evaluation begins. Provides external
 * context with proper source attribution to Market and Solution evaluators.
 */
import { runClaudeCliWithPrompt } from '../utils/anthropic-client.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { logInfo, logDebug, logWarning } from '../utils/logger.js';
import { ExtractedClaims, buildSearchQueries } from '../utils/claims-extractor.js';

/**
 * Geographic market data for a specific region (local or global)
 */
export interface GeographicMarketData {
  region: string;  // e.g., "Australia", "Global", "United States"
  marketSize: {
    tam: string | null;   // Total Addressable Market
    sam: string | null;   // Serviceable Addressable Market
    som: string | null;   // Serviceable Obtainable Market
    sources: string[];
  };
  competitors: {
    players: string[];
    intensity: 'low' | 'moderate' | 'high' | 'intense' | 'unknown';
    sources: string[];
  };
  entryBarriers: {
    regulatory: string | null;
    capital: string | null;
    relationships: string | null;
    sources: string[];
  };
  marketTiming: {
    readiness: 'emerging' | 'growing' | 'mature' | 'declining' | 'unknown';
    catalysts: string[];
  };
}

/**
 * Creator's geographic location context
 */
export interface CreatorLocation {
  country: string;
  city?: string;
}

export interface ResearchResult {
  marketSize: {
    userClaim: string | null;
    verified: string | null;
    sources: string[];
  };
  competitors: {
    userMentioned: string[];
    discovered: string[];
    sources: string[];
  };
  trends: {
    direction: 'growing' | 'stable' | 'declining' | 'unknown';
    evidence: string;
    sources: string[];
  };
  techFeasibility: {
    assessment: 'proven' | 'emerging' | 'experimental' | 'unknown';
    examples: string[];
    sources: string[];
  };

  // NEW: Geographic breakdown for local vs global market analysis
  geographicAnalysis?: {
    localMarket: GeographicMarketData | null;   // User's country
    globalMarket: GeographicMarketData | null;  // Worldwide
    expansionMarkets?: GeographicMarketData[];  // Key expansion opportunities
    creatorLocation: CreatorLocation | null;
  };

  timestamp: string;
  searchesPerformed: number;
}

/**
 * Conduct pre-evaluation research using web search.
 *
 * @param ideaContent - The idea content (for context)
 * @param claims - Extracted claims from the idea
 * @param costTracker - Cost tracker instance
 * @param creatorLocation - Optional creator location for geographic analysis
 * @returns Research results with market and technology findings
 */
export async function conductPreEvaluationResearch(
  _ideaContent: string,  // Reserved for future use
  claims: ExtractedClaims,
  costTracker: CostTracker,
  creatorLocation?: CreatorLocation
): Promise<ResearchResult> {
  logInfo('Starting pre-evaluation research phase...');
  if (creatorLocation) {
    logInfo(`Creator location: ${creatorLocation.city || ''}, ${creatorLocation.country}`);
  }

  const queries = buildSearchQueries(claims);
  logDebug(`Built ${queries.length} research queries`);

  if (queries.length === 0) {
    logWarning('No research queries generated - insufficient claim data');
    return createEmptyResult(claims);
  }

  // Always use Claude's native WebSearch tool for research
  return await conductResearchViaCli(claims, queries, costTracker, creatorLocation);
}

/**
 * Conduct research using Claude's native WebSearch tool.
 * This uses Claude Code's built-in web search capability for reliable results.
 */
async function conductResearchViaCli(
  claims: ExtractedClaims,
  queries: string[],
  costTracker: CostTracker,
  creatorLocation?: CreatorLocation
): Promise<ResearchResult> {
  logInfo('Using Claude native WebSearch tool...');

  try {
    const currentYear = new Date().getFullYear();
    const hasLocation = !!creatorLocation?.country;
    const localRegion = creatorLocation?.country || 'Unknown';
    const localCity = creatorLocation?.city || '';

    // Build a research prompt that instructs Claude to use WebSearch
    // Include geographic-specific queries if location is known
    const researchPrompt = `You are a market research analyst. Use the WebSearch tool to research this business idea.

## Creator Context
${hasLocation ? `**The creator is based in ${localCity ? localCity + ', ' : ''}${localRegion}.**
You MUST research BOTH local (${localRegion}) AND global market data.` : 'Creator location unknown - focus on global market data.'}

## Research Tasks
Search for information about:

${hasLocation ? `### LOCAL MARKET RESEARCH (${localRegion})
1. Market size for: ${claims.domain} market ${localRegion} ${currentYear}
2. Key LOCAL competitors in: ${claims.domain} ${localRegion}
3. LOCAL regulations/barriers for: ${claims.domain} ${localRegion}
4. Market trends in ${localRegion} for: ${claims.domain}

### GLOBAL MARKET RESEARCH` : '### GLOBAL MARKET RESEARCH'}
${hasLocation ? '5' : '1'}. Global market size for: ${claims.domain} market ${currentYear}
${hasLocation ? '6' : '2'}. Top GLOBAL competitors in: ${claims.domain} ${claims.technology.join(' ')}
${hasLocation ? '7' : '3'}. Global market trends and growth rates for: ${claims.domain}
${hasLocation ? '8' : '4'}. Technology feasibility: ${claims.technology.join(', ')} applications

## User's Claims to Verify
- Market size claimed: ${claims.marketSize || 'Not specified'}
- Competitors mentioned: ${claims.competitors.join(', ') || 'None'}
- Technology: ${claims.technology.join(', ') || 'Not specified'}
- Target market: ${claims.targetMarket}

## Instructions
1. Use WebSearch to find current ${currentYear} data for each research task
2. After searching, compile your findings into this JSON format:

{
  "marketSize": {
    "verified": "GLOBAL market size with year, e.g. '$15.6 billion globally in ${currentYear}'",
    "sources": ["full URLs where market size was found"]
  },
  "competitors": {
    "discovered": ["competitor names found that were NOT in user's list"],
    "sources": ["full URLs where competitors were found"]
  },
  "trends": {
    "direction": "growing|stable|declining|unknown",
    "evidence": "growth rate or CAGR found in search results"
  },
  "techFeasibility": {
    "assessment": "proven|emerging|experimental|unknown",
    "examples": ["real company or product examples using this technology"]
  },
  ${hasLocation ? `"geographicAnalysis": {
    "localMarket": {
      "region": "${localRegion}",
      "marketSize": {
        "tam": "Total Addressable Market in ${localRegion}, e.g. '$X billion AUD'",
        "sam": "Serviceable Addressable Market in ${localRegion} or null if not found",
        "som": "Serviceable Obtainable Market in ${localRegion} or null if not found",
        "sources": ["URLs for local market data"]
      },
      "competitors": {
        "players": ["LOCAL competitors in ${localRegion}"],
        "intensity": "low|moderate|high|intense|unknown",
        "sources": ["URLs for local competitor data"]
      },
      "entryBarriers": {
        "regulatory": "Local regulations that affect entry in ${localRegion}",
        "capital": "Capital requirements for ${localRegion} market",
        "relationships": "Relationship/network requirements for ${localRegion}",
        "sources": ["URLs for barrier data"]
      },
      "marketTiming": {
        "readiness": "emerging|growing|mature|declining|unknown",
        "catalysts": ["factors driving ${localRegion} market growth"]
      }
    },
    "globalMarket": {
      "region": "Global",
      "marketSize": {
        "tam": "Global TAM, e.g. '$X billion USD'",
        "sam": "Global SAM or null",
        "som": "Global SOM or null",
        "sources": ["URLs for global market data"]
      },
      "competitors": {
        "players": ["Top GLOBAL competitors"],
        "intensity": "low|moderate|high|intense|unknown",
        "sources": ["URLs"]
      },
      "entryBarriers": {
        "regulatory": "Common global regulatory considerations",
        "capital": "Global scaling capital requirements",
        "relationships": "Global distribution/partnership requirements",
        "sources": []
      },
      "marketTiming": {
        "readiness": "emerging|growing|mature|declining|unknown",
        "catalysts": ["global market drivers"]
      }
    },
    "creatorLocation": {
      "country": "${localRegion}",
      "city": "${localCity || ''}"
    }
  },` : ''}
  "searchesPerformed": number
}

Return ONLY the JSON object after completing your searches.`;

    const researchResult = await runClaudeCliWithPrompt(researchPrompt, {
      model: 'sonnet',  // Use Sonnet for better tool use
      maxTokens: 4000,
      systemPrompt: 'You are a market research analyst with access to WebSearch. Search for current market data and return structured findings. Always include source URLs.',
      tools: ['WebSearch']  // Enable WebSearch tool
    });

    // Estimate token usage for CLI call
    costTracker.track({ input_tokens: 3000, output_tokens: 1500 }, 'research-websearch-cli');

    // Parse the JSON response
    const jsonMatch = researchResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logWarning('Could not parse synthesis response as JSON');
      return createEmptyResult(claims, queries.length);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Parse geographic analysis if present
    let geographicAnalysis: ResearchResult['geographicAnalysis'] = undefined;
    if (parsed.geographicAnalysis && creatorLocation) {
      const geoData = parsed.geographicAnalysis;

      const parseMarketData = (data: unknown): GeographicMarketData | null => {
        if (!data || typeof data !== 'object') return null;
        const d = data as Record<string, unknown>;
        return {
          region: String(d.region || 'Unknown'),
          marketSize: {
            tam: d.marketSize && typeof d.marketSize === 'object' ? String((d.marketSize as Record<string, unknown>).tam || '') || null : null,
            sam: d.marketSize && typeof d.marketSize === 'object' ? String((d.marketSize as Record<string, unknown>).sam || '') || null : null,
            som: d.marketSize && typeof d.marketSize === 'object' ? String((d.marketSize as Record<string, unknown>).som || '') || null : null,
            sources: d.marketSize && typeof d.marketSize === 'object' && Array.isArray((d.marketSize as Record<string, unknown>).sources) ? (d.marketSize as Record<string, unknown>).sources as string[] : []
          },
          competitors: {
            players: d.competitors && typeof d.competitors === 'object' && Array.isArray((d.competitors as Record<string, unknown>).players) ? (d.competitors as Record<string, unknown>).players as string[] : [],
            intensity: d.competitors && typeof d.competitors === 'object' ? ((d.competitors as Record<string, unknown>).intensity as GeographicMarketData['competitors']['intensity']) || 'unknown' : 'unknown',
            sources: d.competitors && typeof d.competitors === 'object' && Array.isArray((d.competitors as Record<string, unknown>).sources) ? (d.competitors as Record<string, unknown>).sources as string[] : []
          },
          entryBarriers: {
            regulatory: d.entryBarriers && typeof d.entryBarriers === 'object' ? String((d.entryBarriers as Record<string, unknown>).regulatory || '') || null : null,
            capital: d.entryBarriers && typeof d.entryBarriers === 'object' ? String((d.entryBarriers as Record<string, unknown>).capital || '') || null : null,
            relationships: d.entryBarriers && typeof d.entryBarriers === 'object' ? String((d.entryBarriers as Record<string, unknown>).relationships || '') || null : null,
            sources: d.entryBarriers && typeof d.entryBarriers === 'object' && Array.isArray((d.entryBarriers as Record<string, unknown>).sources) ? (d.entryBarriers as Record<string, unknown>).sources as string[] : []
          },
          marketTiming: {
            readiness: d.marketTiming && typeof d.marketTiming === 'object' ? ((d.marketTiming as Record<string, unknown>).readiness as GeographicMarketData['marketTiming']['readiness']) || 'unknown' : 'unknown',
            catalysts: d.marketTiming && typeof d.marketTiming === 'object' && Array.isArray((d.marketTiming as Record<string, unknown>).catalysts) ? (d.marketTiming as Record<string, unknown>).catalysts as string[] : []
          }
        };
      };

      geographicAnalysis = {
        localMarket: parseMarketData(geoData.localMarket),
        globalMarket: parseMarketData(geoData.globalMarket),
        creatorLocation: {
          country: creatorLocation.country,
          city: creatorLocation.city
        }
      };

      if (geographicAnalysis.localMarket) {
        logInfo(`Local market (${geographicAnalysis.localMarket.region}): TAM ${geographicAnalysis.localMarket.marketSize.tam || 'unknown'}`);
      }
      if (geographicAnalysis.globalMarket) {
        logInfo(`Global market: TAM ${geographicAnalysis.globalMarket.marketSize.tam || 'unknown'}`);
      }
    }

    return {
      marketSize: {
        userClaim: claims.marketSize,
        verified: parsed.marketSize?.verified || null,
        sources: Array.isArray(parsed.marketSize?.sources) ? parsed.marketSize.sources : []
      },
      competitors: {
        userMentioned: claims.competitors,
        discovered: Array.isArray(parsed.competitors?.discovered) ? parsed.competitors.discovered : [],
        sources: Array.isArray(parsed.competitors?.sources) ? parsed.competitors.sources : []
      },
      trends: {
        direction: parsed.trends?.direction || 'unknown',
        evidence: parsed.trends?.evidence || '',
        sources: []
      },
      techFeasibility: {
        assessment: parsed.techFeasibility?.assessment || 'unknown',
        examples: Array.isArray(parsed.techFeasibility?.examples) ? parsed.techFeasibility.examples : [],
        sources: []
      },
      geographicAnalysis,
      timestamp: new Date().toISOString(),
      searchesPerformed: queries.length
    };
  } catch (error) {
    logWarning(`CLI research phase failed: ${error}`);
    return createEmptyResult(claims, queries.length);
  }
}


/**
 * Create empty research result.
 */
function createEmptyResult(claims: ExtractedClaims, searchCount: number = 0): ResearchResult {
  return {
    marketSize: { userClaim: claims.marketSize, verified: null, sources: [] },
    competitors: { userMentioned: claims.competitors, discovered: [], sources: [] },
    trends: { direction: 'unknown', evidence: '', sources: [] },
    techFeasibility: { assessment: 'unknown', examples: [], sources: [] },
    timestamp: new Date().toISOString(),
    searchesPerformed: searchCount
  };
}

/**
 * Format research results for evaluator prompts.
 * Returns category-specific sections to include in evaluator context.
 *
 * @param research - Research result (can be null)
 * @param category - The evaluation category
 * @returns Formatted research section for the evaluator prompt
 */
export function formatResearchForCategory(
  research: ResearchResult | null,
  category: string
): string {
  if (!research) return '';

  switch (category) {
    case 'market':
      const geo = research.geographicAnalysis;
      let geoSection = '';

      // Add geographic analysis section if available
      if (geo) {
        geoSection = `

---

## Geographic Market Analysis
${geo.creatorLocation ? `**Creator Location:** ${geo.creatorLocation.city ? geo.creatorLocation.city + ', ' : ''}${geo.creatorLocation.country}` : ''}

### LOCAL MARKET (${geo.localMarket?.region || geo.creatorLocation?.country || 'Unknown Region'})

**Local Market Size:**
- TAM: ${geo.localMarket?.marketSize.tam || 'Not found'}
- SAM: ${geo.localMarket?.marketSize.sam || 'Not found'}
- SOM: ${geo.localMarket?.marketSize.som || 'Not found'}
${geo.localMarket?.marketSize.sources.length ? `- Sources: ${geo.localMarket.marketSize.sources.join(', ')}` : ''}

**Local Competitors:**
- Key Players: ${geo.localMarket?.competitors.players.join(', ') || 'None discovered'}
- Competition Intensity: ${geo.localMarket?.competitors.intensity || 'Unknown'}
${geo.localMarket?.competitors.sources.length ? `- Sources: ${geo.localMarket.competitors.sources.join(', ')}` : ''}

**Local Entry Barriers:**
- Regulatory: ${geo.localMarket?.entryBarriers.regulatory || 'Unknown'}
- Capital Requirements: ${geo.localMarket?.entryBarriers.capital || 'Unknown'}
- Relationship/Network: ${geo.localMarket?.entryBarriers.relationships || 'Unknown'}

**Local Market Timing:**
- Readiness: ${geo.localMarket?.marketTiming.readiness || 'Unknown'}
- Catalysts: ${geo.localMarket?.marketTiming.catalysts.join(', ') || 'None identified'}

### GLOBAL MARKET

**Global Market Size:**
- TAM: ${geo.globalMarket?.marketSize.tam || 'Not found'}
- SAM: ${geo.globalMarket?.marketSize.sam || 'Not found'}
${geo.globalMarket?.marketSize.sources.length ? `- Sources: ${geo.globalMarket.marketSize.sources.join(', ')}` : ''}

**Global Competitors:**
- Key Players: ${geo.globalMarket?.competitors.players.join(', ') || 'None discovered'}
- Competition Intensity: ${geo.globalMarket?.competitors.intensity || 'Unknown'}

**Global Entry Barriers:**
- Regulatory: ${geo.globalMarket?.entryBarriers.regulatory || 'Unknown'}
- Capital Requirements: ${geo.globalMarket?.entryBarriers.capital || 'Unknown'}

**Global Market Timing:**
- Readiness: ${geo.globalMarket?.marketTiming.readiness || 'Unknown'}
- Catalysts: ${geo.globalMarket?.marketTiming.catalysts.join(', ') || 'None identified'}

---

**GEOGRAPHIC ANALYSIS INSTRUCTIONS:**
1. Score each criterion considering BOTH local and global markets
2. For M1 (Market Size): Report local TAM and global TAM separately
3. For M3 (Competition): Note differences between local and global competitive intensity
4. For M4 (Entry Barriers): Assess if creator's LOCAL network helps with local barriers
5. For M5 (Timing): Note if local and global market timing differs
6. In reasoning, structure as: "LOCAL: [analysis]. GLOBAL: [analysis]. OVERALL: [weighted assessment]"
7. Recommend whether to start locally or go global first`;
      }

      return `## External Research (Web Search Results)

**Market Size (Global Overview):**
- User claimed: ${research.marketSize.userClaim || 'Not specified'}
- Verified: ${research.marketSize.verified || 'Could not verify'}
${research.marketSize.sources.length > 0 ? `- Sources: ${research.marketSize.sources.join(', ')}` : ''}

**Competitors (Global Overview):**
- User mentioned: ${research.competitors.userMentioned.join(', ') || 'None'}
- Discovered: ${research.competitors.discovered.join(', ') || 'None additional'}
${research.competitors.sources.length > 0 ? `- Sources: ${research.competitors.sources.join(', ')}` : ''}

**Market Trends:**
- Direction: ${research.trends.direction}
- Evidence: ${research.trends.evidence || 'No specific evidence found'}
${geoSection}

**IMPORTANT**: Use this research to validate or challenge the user's market claims. Discovered competitors should factor into M3 (Competition) assessment. If market size could not be verified, note this uncertainty.`;

    case 'solution':
      return `## Technology Research (Web Search Results)

**Technical Feasibility Assessment:**
- Status: ${research.techFeasibility.assessment}
- Production Examples: ${research.techFeasibility.examples.join(', ') || 'None found'}

**IMPORTANT**: Use this research when assessing S2 (Technical Feasibility). If the technology is "proven" with production examples, confidence should be higher. If "experimental" or "unknown", note this as a risk.`;

    default:
      return '';
  }
}

/**
 * Check if research phase should be skipped.
 * Now returns false since we support both API and CLI modes.
 */
export function shouldSkipResearch(): boolean {
  return false;  // Research now works in both API and CLI modes
}
