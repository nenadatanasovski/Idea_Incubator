/**
 * Shared Anthropic client configuration
 * Supports both API keys (ANTHROPIC_API_KEY) and Claude Code CLI (OAuth)
 *
 * Priority:
 * 1. If ANTHROPIC_API_KEY is set → use SDK directly
 * 2. Otherwise → use Claude Code CLI (which handles its own OAuth session)
 *
 * NOTE: The CLI has its own OAuth session stored by Claude Code.
 * We don't need to pass any token - just spawn the CLI and let it authenticate.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createCliClient, callClaudeCli } from './claude-cli-client.js';

// Check if API key is available
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

// Determine if we should use CLI (when no API key is set)
export const useClaudeCli = !hasApiKey;

// Client type that matches the Anthropic SDK interface we use
export type AnthropicClient = {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => Promise<{
      content: Array<{ type: 'text'; text: string }>;
      model: string;
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    }>;
  };
};

// Create client with appropriate configuration
export function createAnthropicClient(): AnthropicClient {
  if (hasApiKey) {
    // Standard API key - use SDK directly
    console.log('[Auth] Using Anthropic SDK with API key');
    return new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }) as unknown as AnthropicClient;
  } else {
    // No API key - use Claude Code CLI (which handles OAuth internally)
    console.log('[Auth] Using Claude Code CLI for API calls (OAuth via CLI session)');
    return createCliClient() as AnthropicClient;
  }
}

// Export a default client instance
export const client = createAnthropicClient();

/**
 * Run Claude CLI with a simple prompt string.
 * Convenience wrapper for research and other agents that need direct prompts.
 */
export async function runClaudeCliWithPrompt(
  prompt: string,
  options: {
    model?: 'haiku' | 'sonnet' | 'opus';
    maxTokens?: number;
    systemPrompt?: string;
    tools?: string[];  // Enable specific tools like 'WebSearch'
  } = {}
): Promise<string> {
  const response = await callClaudeCli(
    [{ role: 'user', content: prompt }],
    {
      model: options.model || 'sonnet',
      maxTokens: options.maxTokens || 4096,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
    }
  );

  // Extract text from response
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  return text;
}
