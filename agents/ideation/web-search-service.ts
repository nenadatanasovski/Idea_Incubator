import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * WEB SEARCH SERVICE
 *
 * Performs web searches during ideation to validate markets,
 * find competitors, and check timing signals.
 */

export interface WebSearchResult {
  query: string;
  results: SearchResultItem[];
  timestamp: string;
  error?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface SearchPurpose {
  type: 'competitor_check' | 'market_validation' | 'timing_signal' | 'failed_attempts' | 'general';
  context: string;
}

/**
 * Perform a web search using Claude CLI with WebSearch tool.
 */
export async function performWebSearch(
  query: string,
  purpose: SearchPurpose
): Promise<WebSearchResult> {
  const timestamp = new Date().toISOString();

  try {
    // Use Claude CLI with WebSearch tool
    const prompt = buildSearchPrompt(query, purpose);
    const result = await runClaudeCliWithSearch(prompt);

    return {
      query,
      results: parseSearchResults(result),
      timestamp,
    };
  } catch (error) {
    return {
      query,
      results: [],
      timestamp,
      error: (error as Error).message,
    };
  }
}

/**
 * Build a search prompt based on purpose.
 */
export function buildSearchPrompt(query: string, purpose: SearchPurpose): string {
  const purposeInstructions: Record<SearchPurpose['type'], string> = {
    competitor_check: `Search for competitors and alternatives in this space. Focus on: company names, their offerings, pricing models, and market position.`,
    market_validation: `Validate if there's a real market for this. Look for: market size data, user demand signals, industry reports.`,
    timing_signal: `Check if the timing is right for this idea. Look for: recent trends, regulatory changes, technology shifts, market events.`,
    failed_attempts: `Search for failed or pivoted companies in this space. Look for: post-mortems, lessons learned, common failure modes.`,
    general: `Perform a general search to understand the landscape.`,
  };

  return `
${purposeInstructions[purpose.type]}

Context: ${purpose.context}

Search query: "${query}"

Please search for this and return:
1. Key findings (3-5 bullet points)
2. Source URLs with titles
3. Any concerns or red flags
4. Opportunities identified
`;
}

/**
 * Execute Claude CLI with WebSearch tool.
 */
async function runClaudeCliWithSearch(prompt: string): Promise<string> {
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');

  try {
    const { stdout } = await execAsync(
      `claude --allowedTools WebSearch --print "${escapedPrompt}"`,
      {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      }
    );

    return stdout;
  } catch (error) {
    throw new Error(`Web search failed: ${(error as Error).message}`);
  }
}

/**
 * Parse search results from Claude CLI output.
 */
export function parseSearchResults(output: string): SearchResultItem[] {
  const results: SearchResultItem[] = [];

  // Extract URLs with markdown link pattern [title](url)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(output)) !== null) {
    results.push({
      title: match[1],
      url: match[2],
      snippet: extractSnippet(output, match.index),
      source: extractHostname(match[2]),
    });
  }

  // Also check for bare URLs
  const urlPattern = /(https?:\/\/[^\s\)]+)/g;
  while ((match = urlPattern.exec(output)) !== null) {
    if (!results.some(r => r.url === match[1])) {
      results.push({
        title: 'Source',
        url: match[1],
        snippet: extractSnippet(output, match.index),
        source: extractHostname(match[1]),
      });
    }
  }

  return results.slice(0, 10); // Limit to 10 results
}

/**
 * Extract hostname from URL.
 */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Extract snippet around a URL match.
 */
function extractSnippet(text: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 150);
  const end = Math.min(text.length, matchIndex + 150);
  let snippet = text.slice(start, end).trim();

  // Clean up and add ellipsis
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet.replace(/\[.*?\]\(.*?\)/g, '').trim();
}

/**
 * Search strategy for ideation agent.
 * Determines what to search based on current state.
 */
export interface SearchStrategy {
  queries: string[];
  purposes: SearchPurpose[];
}

export function determineSearchStrategy(
  candidateTitle: string,
  narrowingState: { productType?: string; customerType?: string; geography?: string }
): SearchStrategy {
  const queries: string[] = [];
  const purposes: SearchPurpose[] = [];

  // Always check for competitors
  queries.push(`${candidateTitle} competitors alternatives`);
  purposes.push({
    type: 'competitor_check',
    context: `Looking for direct competitors to: ${candidateTitle}`,
  });

  // Check market validation
  queries.push(`${candidateTitle} market size demand`);
  purposes.push({
    type: 'market_validation',
    context: `Validating market demand for: ${candidateTitle}`,
  });

  // Check for failed attempts if B2C
  if (narrowingState.customerType === 'B2C') {
    queries.push(`${candidateTitle} startup failed shutdown`);
    purposes.push({
      type: 'failed_attempts',
      context: `Looking for previous failed attempts in: ${candidateTitle}`,
    });
  }

  // Add geography-specific search if local
  if (narrowingState.geography === 'local') {
    queries.push(`${candidateTitle} australia local market`);
    purposes.push({
      type: 'market_validation',
      context: `Checking Australian/local market for: ${candidateTitle}`,
    });
  }

  return { queries, purposes };
}

/**
 * Batch execute searches with rate limiting.
 */
export async function executeSearchBatch(
  strategy: SearchStrategy
): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  for (let i = 0; i < strategy.queries.length; i++) {
    const result = await performWebSearch(strategy.queries[i], strategy.purposes[i]);
    results.push(result);

    // Rate limit: wait 1 second between searches
    if (i < strategy.queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Analyze search results for viability concerns.
 */
export function analyzeSearchResults(results: WebSearchResult[]): {
  competitors: number;
  concerns: string[];
  opportunities: string[];
} {
  let competitors = 0;
  const concerns: string[] = [];
  const opportunities: string[] = [];

  for (const result of results) {
    // Count competitor mentions
    competitors += result.results.length;

    // Look for failure patterns
    for (const item of result.results) {
      if (/failed|shutdown|closed|pivoted/i.test(item.snippet)) {
        concerns.push(`Previous attempt failed: ${item.title}`);
      }
      if (/growing|emerging|opportunity|gap/i.test(item.snippet)) {
        opportunities.push(`Market signal: ${item.snippet.slice(0, 100)}`);
      }
    }
  }

  return { competitors, concerns, opportunities };
}
