/**
 * Claude Code CLI Client
 * Uses the `claude` CLI command to make API calls with OAuth token
 */
import { spawn } from "child_process";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeCliOptions {
  model?: string;
  systemPrompt?: string;
  _maxTokens?: number;
  jsonSchema?: object;
  tools?: string[]; // Enable specific tools like 'WebSearch'
}

/**
 * Call Claude via the CLI
 * This uses the OAuth token configured for Claude Code
 */
export async function callClaudeCli(
  messages: ClaudeMessage[],
  options: ClaudeCliOptions = {},
): Promise<ClaudeResponse> {
  const {
    model = "sonnet",
    systemPrompt,
    _maxTokens = 4096,
    tools = [],
  } = options;

  // Build the prompt from messages
  const prompt = messages
    .map((m) => (m.role === "user" ? m.content : `Assistant: ${m.content}`))
    .join("\n\n");

  // Build CLI arguments
  // Note: --dangerously-skip-permissions bypasses OAuth, so we don't use it
  const args = [
    "--print",
    "--output-format",
    "json",
    "--model",
    model,
    "--no-session-persistence", // Don't save sessions
  ];

  // Add tools if specified (e.g., 'WebSearch')
  // Use both --tools (to enable) and --allowedTools (to auto-approve)
  if (tools.length > 0) {
    args.push("--tools", tools.join(","));
    args.push("--allowedTools", tools.join(","));
  }

  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }

  // Use stdin for prompt to avoid argument length limits on large prompts
  // The prompt can be very large (40K+ tokens = 160K+ chars) which exceeds CLI arg limits
  const useStdin = prompt.length > 10000; // Use stdin for prompts > 10K chars

  if (!useStdin) {
    // Small prompts can be passed directly as argument
    args.push(prompt);
  }
  // For large prompts, we'll pipe to stdin

  // Debug: log the command being run (condensed)
  const toolsStr = tools.length > 0 ? ` [tools: ${tools.join(",")}]` : "";
  const stdinStr = useStdin ? " [stdin]" : "";
  console.log(
    `[CLI] Running claude --model ${model}${toolsStr}${stdinStr} (~${Math.round(prompt.length / 4)} tokens)`,
  );

  // Default timeout: 360 seconds for CLI calls (6 minutes)
  // Increased to handle complex requests with large context
  const CLI_TIMEOUT_MS = 360 * 1000;

  return new Promise((resolve, reject) => {
    // Build environment for Claude CLI
    // IMPORTANT: Remove ANTHROPIC_AUTH_TOKEN and ANTHROPIC_API_KEY from the environment
    // so the CLI uses its built-in OAuth session instead of trying to use the env var token directly
    const { ANTHROPIC_AUTH_TOKEN, ANTHROPIC_API_KEY, ...cleanEnv } =
      process.env;
    const env = {
      ...cleanEnv,
      HOME: process.env.HOME || "/Users/" + process.env.USER,
      PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    };

    const child = spawn("claude", args, {
      stdio: [useStdin ? "pipe" : "ignore", "pipe", "pipe"],
      env,
    });

    // If using stdin, write the prompt and close
    if (useStdin) {
      child.stdin?.write(prompt);
      child.stdin?.end();
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      console.log("[CLI] Timeout reached, killing process");
    }, CLI_TIMEOUT_MS);

    // Limit output size to prevent memory issues
    const MAX_OUTPUT_SIZE = 500 * 1024; // 500KB

    child.stdout.on("data", (data) => {
      if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += data.toString();
      }
    });

    child.stderr.on("data", (data) => {
      if (stderr.length < MAX_OUTPUT_SIZE) {
        stderr += data.toString();
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(
          new Error(
            "Claude CLI timed out after 360 seconds. Try a simpler request or start a new session.",
          ),
        );
        return;
      }

      if (code !== 0) {
        // Include stdout as well for debugging
        reject(
          new Error(
            `claude CLI exited with code ${code}.\nstderr: ${stderr}\nstdout: ${stdout}`,
          ),
        );
        return;
      }

      try {
        // Parse the JSON output
        const result = JSON.parse(stdout);

        // Check for API errors in the response
        if (result.is_error) {
          reject(
            new Error(`Claude API error: ${result.result || "Unknown error"}`),
          );
          return;
        }

        // Extract the response - Claude CLI JSON format
        let text = "";
        let inputTokens = 0;
        let outputTokens = 0;

        if (result.result) {
          // Stream-json format wraps in result
          text = result.result;
        } else if (result.content) {
          // Direct content array
          text = result.content
            .map((c: { text?: string }) => c.text || "")
            .join("");
        } else if (typeof result === "string") {
          text = result;
        } else {
          // Try to find text in the response
          text = JSON.stringify(result);
        }

        // Try to extract usage info
        if (result.usage) {
          inputTokens = result.usage.input_tokens || 0;
          outputTokens = result.usage.output_tokens || 0;
        }

        resolve({
          content: [{ type: "text", text }],
          model: model,
          stop_reason: "end_turn",
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          },
        });
      } catch (parseErr) {
        // If not JSON, treat as plain text response
        resolve({
          content: [{ type: "text", text: stdout.trim() }],
          model: model,
          stop_reason: "end_turn",
          usage: {
            input_tokens: 0,
            output_tokens: 0,
          },
        });
      }
    });
  });
}

/**
 * Create a client-like interface that uses the CLI
 */
export function createCliClient() {
  return {
    messages: {
      create: async (params: {
        model: string;
        max_tokens: number;
        system?: string;
        messages: Array<{ role: "user" | "assistant"; content: string }>;
      }) => {
        return callClaudeCli(params.messages, {
          model: params.model.includes("sonnet")
            ? "sonnet"
            : params.model.includes("opus")
              ? "opus"
              : params.model.includes("haiku")
                ? "haiku"
                : "sonnet",
          systemPrompt: params.system,
          _maxTokens: params.max_tokens,
        });
      },
    },
  };
}
