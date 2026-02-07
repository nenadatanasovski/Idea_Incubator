/**
 * Shared Anthropic client configuration
 * Supports multiple auth methods:
 * 1. ANTHROPIC_API_KEY → standard SDK
 * 2. ANTHROPIC_OAUTH_TOKEN → pi-ai library (OAuth)
 * 3. Otherwise → Claude Code CLI (OAuth via CLI session)
 */
import Anthropic from "@anthropic-ai/sdk";
import { 
  streamAnthropic, 
  getEnvApiKey, 
  getModel, 
  registerBuiltInApiProviders 
} from "@mariozechner/pi-ai";
import { createCliClient, callClaudeCli } from "./claude-cli-client.js";

// Register pi-ai providers on module load
registerBuiltInApiProviders();

// Check auth methods
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
const hasOAuthToken = !!process.env.ANTHROPIC_OAUTH_TOKEN;

// Determine which method to use
export const useClaudeCli = !hasApiKey && !hasOAuthToken;
export const usePiAi = hasOAuthToken && !hasApiKey;

// Client type that matches the Anthropic SDK interface we use
export type AnthropicClient = {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      model: string;
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    }>;
  };
};

/**
 * Create a pi-ai based client that wraps streamAnthropic
 * to match the Anthropic SDK interface
 */
function createPiAiClient(): AnthropicClient {
  const apiKey = getEnvApiKey("anthropic");

  return {
    messages: {
      create: async (params) => {
        // Get the model from pi-ai registry
        // We need to dynamically get the model, but getModel has strict typing
        // Use a type assertion to work with dynamic model strings
        type AnthropicModels = "claude-3-5-sonnet-20241022" | "claude-3-5-haiku-20241022" | "claude-3-opus-20240229";
        const model = getModel("anthropic", (params.model || "claude-3-5-sonnet-20241022") as AnthropicModels);
        if (!model) {
          throw new Error(`Model not found: ${params.model}`);
        }

        // Build context in pi-ai format with proper Message types
        // Import the Message types to ensure compatibility
        type PiAiMessage = import("@mariozechner/pi-ai").Message;
        type PiAiUserMessage = import("@mariozechner/pi-ai").UserMessage;
        type PiAiAssistantMessage = import("@mariozechner/pi-ai").AssistantMessage;

        const messages: PiAiMessage[] = params.messages.map(m => {
          if (m.role === "user") {
            const userMsg: PiAiUserMessage = {
              role: "user" as const,
              content: [{ type: "text" as const, text: m.content }],
              timestamp: Date.now()
            };
            return userMsg;
          } else {
            // For assistant messages in the input, we need a full AssistantMessage
            const assistantMsg: PiAiAssistantMessage = {
              role: "assistant" as const,
              content: [{ type: "text" as const, text: m.content }],
              api: model.api,
              provider: model.provider,
              model: model.id,
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                  total: 0
                }
              },
              stopReason: "stop" as const,
              timestamp: Date.now()
            };
            return assistantMsg;
          }
        });

        const context: import("@mariozechner/pi-ai").Context = {
          systemPrompt: params.system,
          messages: messages
        };

        const content: Array<{ type: "text"; text: string }> = [];
        let stopReason = "end_turn";
        let inputTokens = 0;
        let outputTokens = 0;

        const response = streamAnthropic(model, context, {
          apiKey: apiKey!,
          maxTokens: params.max_tokens
        });

        let text = "";
        for await (const chunk of response) {
          if (chunk.type === "text_delta" && chunk.delta) {
            text += chunk.delta;
          }
          if (chunk.type === "done") {
            stopReason = chunk.reason || "end_turn";
            if (chunk.message?.usage) {
              inputTokens = chunk.message.usage.input || 0;
              outputTokens = chunk.message.usage.output || 0;
            }
          }
        }

        if (text) {
          content.push({ type: "text", text });
        }

        return {
          content,
          model: params.model,
          stop_reason: stopReason,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          },
        };
      },
    },
  };
}

// Create client with appropriate configuration
export function createAnthropicClient(): AnthropicClient {
  if (hasApiKey) {
    // Standard API key - use SDK directly
    console.log("[Auth] Using Anthropic SDK with API key");
    return new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }) as unknown as AnthropicClient;
  } else if (hasOAuthToken) {
    // OAuth token - use pi-ai library
    console.log("[Auth] Using pi-ai with OAuth token");
    return createPiAiClient();
  } else {
    // No API key or OAuth token - use Claude Code CLI
    console.log(
      "[Auth] Using Claude Code CLI for API calls (OAuth via CLI session)",
    );
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
    model?: "haiku" | "sonnet" | "opus";
    maxTokens?: number;
    systemPrompt?: string;
    tools?: string[]; // Enable specific tools like 'WebSearch'
  } = {},
): Promise<string> {
  const response = await callClaudeCli([{ role: "user", content: prompt }], {
    model: options.model || "opus",
    _maxTokens: options.maxTokens || 4096,
    systemPrompt: options.systemPrompt,
    tools: options.tools,
  });

  // Extract text from response
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text;
}
