/**
 * Web Search Utility
 *
 * Provides web search capability independent of Claude API.
 * Uses DuckDuckGo's lite HTML interface for free, no-API-key searches.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  error?: string;
}

/**
 * Perform a web search using DuckDuckGo's lite interface.
 * This approach doesn't require API keys and works from CLI.
 */
export async function webSearch(query: string, maxResults: number = 5): Promise<SearchResponse> {
  try {
    // Use DuckDuckGo's lite HTML version (no JavaScript required)
    const encodedQuery = encodeURIComponent(query);
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      return { query, results: [], error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const results = parseSearchResults(html, maxResults);

    return { query, results };
  } catch (error) {
    return {
      query,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Parse DuckDuckGo lite HTML to extract search results.
 * DDG Lite structure:
 *   <a rel="nofollow" href="//duckduckgo.com/l/?uddg=..." class='result-link'>Title</a>
 *   <td class='result-snippet'>Snippet with <b>bold</b> terms</td>
 *   <span class='timestamp'>2024-02-27T00:00:00.0000000</span>
 */
function parseSearchResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Pattern for result links - href comes before class in DDG
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*class='result-link'[^>]*>([^<]+)<\/a>/gi;

  // Pattern for snippets - need to capture content that may include <b> tags
  const snippetPattern = /<td[^>]*class='result-snippet'[^>]*>([\s\S]*?)<\/td>/gi;

  // Pattern for timestamps
  const timestampPattern = /<span[^>]*class='timestamp'[^>]*>([^<]+)<\/span>/gi;

  // Extract all links
  const links: { url: string; title: string }[] = [];
  let linkMatch;
  while ((linkMatch = linkPattern.exec(html)) !== null && links.length < maxResults) {
    const rawUrl = linkMatch[1];
    const title = decodeHtmlEntities(linkMatch[2]).trim();
    const url = extractRealUrl(rawUrl);
    if (url && title) {
      links.push({ url, title });
    }
  }

  // Extract all snippets
  const snippets: string[] = [];
  let snippetMatch;
  while ((snippetMatch = snippetPattern.exec(html)) !== null && snippets.length < maxResults) {
    // Strip HTML tags and decode entities
    const snippet = stripHtml(snippetMatch[1]);
    snippets.push(snippet);
  }

  // Extract all timestamps
  const timestamps: string[] = [];
  let timestampMatch;
  while ((timestampMatch = timestampPattern.exec(html)) !== null && timestamps.length < maxResults) {
    // Parse ISO timestamp to readable date
    const isoDate = timestampMatch[1];
    try {
      const date = new Date(isoDate);
      timestamps.push(date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
    } catch {
      timestamps.push(isoDate.split('T')[0]);
    }
  }

  // Combine links, snippets, and timestamps, filtering out ads
  const adDomains = ['ebay.com', 'amazon.com', 'bing.com/aclick', 'duckduckgo.com/y.js'];

  for (let i = 0; i < links.length && results.length < maxResults; i++) {
    const url = links[i].url;

    // Skip ad URLs
    if (adDomains.some(domain => url.includes(domain))) {
      continue;
    }

    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
      date: timestamps[i] || undefined
    });
  }

  return results;
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Extract the real URL from DuckDuckGo's redirect URL.
 * DDG uses URLs like: //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com
 */
function extractRealUrl(rawUrl: string): string | null {
  // Check if it's a DDG redirect URL
  if (rawUrl.includes('uddg=')) {
    const match = rawUrl.match(/uddg=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }

  // If it starts with http, use as-is
  if (rawUrl.startsWith('http')) {
    return rawUrl;
  }

  return null;
}

/**
 * Perform multiple searches and aggregate results.
 */
export async function multiSearch(
  queries: string[],
  maxResultsPerQuery: number = 3
): Promise<Map<string, SearchResponse>> {
  const results = new Map<string, SearchResponse>();

  // Execute searches sequentially to avoid rate limiting
  for (const query of queries) {
    const response = await webSearch(query, maxResultsPerQuery);
    results.set(query, response);

    // Small delay between requests to be polite
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Format search results for LLM consumption.
 */
export function formatSearchResultsForLLM(searchResults: Map<string, SearchResponse>): string {
  const sections: string[] = [];

  for (const [query, response] of searchResults) {
    if (response.error) {
      sections.push(`## Search: "${query}"\nError: ${response.error}\n`);
      continue;
    }

    if (response.results.length === 0) {
      sections.push(`## Search: "${query}"\nNo results found.\n`);
      continue;
    }

    const resultText = response.results.map((r, i) => {
      const dateStr = r.date ? ` (${r.date})` : '';
      return `${i + 1}. **${r.title}**${dateStr}\n   Source: ${r.url}\n   ${r.snippet}`;
    }).join('\n\n');

    sections.push(`## Search: "${query}"\n\n${resultText}\n`);
  }

  return sections.join('\n---\n\n');
}
