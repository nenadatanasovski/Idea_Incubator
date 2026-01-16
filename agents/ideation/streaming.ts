import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
} from "../../types/ideation.js";

/**
 * STREAMING RESPONSE HANDLER
 *
 * Implements Server-Sent Events (SSE) for real-time chat experience.
 * Streams text tokens as they're generated, with final JSON parse.
 */

export interface StreamEvent {
  type: "text_delta" | "message_complete" | "error" | "tool_use";
  data: string | AgentResponse | Error | ToolUseBlock;
}

interface ToolUseBlock {
  id: string;
  name: string;
  input: unknown;
}

export interface AgentResponse {
  text: string;
  buttons: ButtonOption[] | null;
  form: FormDefinition | null;
  webSearchNeeded: string[] | null;
  candidateUpdate: { title: string; summary: string } | null;
  signals: ExtractedSignals;
}

export interface ButtonOption {
  id: string;
  label: string;
  value: string;
  style: "primary" | "secondary" | "danger";
}

export interface FormDefinition {
  fields: FormField[];
  submitLabel: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "radio" | "checkbox" | "slider" | "select";
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ExtractedSignals {
  selfDiscovery?: Partial<SelfDiscoveryState>;
  marketDiscovery?: Partial<MarketDiscoveryState>;
  narrowing?: Partial<NarrowingState>;
}

export class StreamingResponseHandler extends EventEmitter {
  private accumulatedText: string = "";
  private client: Anthropic;
  private isStreaming: boolean = false;

  constructor(client: Anthropic) {
    super();
    this.client = client;
  }

  /**
   * Stream a message and emit events as tokens arrive.
   */
  async streamMessage(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    systemPrompt: string,
    tools?: Anthropic.Tool[],
  ): Promise<AgentResponse> {
    this.isStreaming = true;
    this.accumulatedText = "";

    try {
      const stream = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools,
        stream: true,
      });

      for await (const event of stream) {
        if (!this.isStreaming) break;

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const textDelta = event.delta.text;
            this.accumulatedText += textDelta;
            this.emit("stream", {
              type: "text_delta",
              data: textDelta,
            } as StreamEvent);
          }
        } else if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            this.emit("stream", {
              type: "tool_use",
              data: {
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              },
            } as StreamEvent);
          }
        } else if (event.type === "message_stop") {
          // Message complete, parse the full response
          const response = this.parseResponse(this.accumulatedText);
          this.emit("stream", {
            type: "message_complete",
            data: response,
          } as StreamEvent);
          return response;
        }
      }

      // Fallback if stream ends without message_stop
      return this.parseResponse(this.accumulatedText);
    } catch (error) {
      this.emit("stream", {
        type: "error",
        data: error as Error,
      } as StreamEvent);
      throw error;
    } finally {
      this.isStreaming = false;
    }
  }

  /**
   * Cancel the current stream.
   */
  cancel(): void {
    this.isStreaming = false;
    this.emit("stream", {
      type: "error",
      data: new Error("Stream cancelled by user"),
    } as StreamEvent);
  }

  /**
   * Parse the accumulated text into structured response.
   */
  parseResponse(text: string): AgentResponse {
    // Try to extract JSON from the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // No JSON found, return text-only response
      return {
        text: text.trim(),
        buttons: null,
        form: null,
        webSearchNeeded: null,
        candidateUpdate: null,
        signals: {},
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.text || "",
        buttons: parsed.buttons || null,
        form: parsed.form || null,
        webSearchNeeded: parsed.webSearchNeeded || null,
        candidateUpdate: parsed.candidateUpdate || null,
        signals: parsed.signals || {},
      };
    } catch {
      // JSON parse failed, return text-only
      return {
        text: text.trim(),
        buttons: null,
        form: null,
        webSearchNeeded: null,
        candidateUpdate: null,
        signals: {},
      };
    }
  }
}

/**
 * SSE encoder for server-side streaming.
 */
export function encodeSSE(event: string, data: unknown): string {
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${dataStr}\n\n`;
}

/**
 * Create SSE stream for Express response.
 */
export function createSSEStream(res: {
  setHeader: (name: string, value: string) => void;
  flushHeaders: () => void;
  write: (chunk: string) => void;
  end: () => void;
}): {
  send: (event: string, data: unknown) => void;
  end: () => void;
} {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  return {
    send: (event: string, data: unknown) => {
      res.write(encodeSSE(event, data));
    },
    end: () => {
      res.write(encodeSSE("done", {}));
      res.end();
    },
  };
}

/**
 * Helper to create a mock response for testing.
 */
export function createMockSSEResponse(): {
  res: {
    setHeader: (name: string, value: string) => void;
    flushHeaders: () => void;
    write: (chunk: string) => void;
    end: () => void;
    headers: Record<string, string>;
    chunks: string[];
    ended: boolean;
  };
} {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  let ended = false;

  return {
    res: {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      flushHeaders: () => {},
      write: (chunk: string) => {
        chunks.push(chunk);
      },
      end: () => {
        ended = true;
      },
      headers,
      chunks,
      ended,
    },
  };
}
