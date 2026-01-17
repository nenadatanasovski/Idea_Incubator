/**
 * OBS-202: Tool Input/Output Types
 *
 * Structured input and output types for each tool category.
 */

// =============================================================================
// FILE OPERATION INPUTS
// =============================================================================

/**
 * Input for Read tool.
 */
export interface ReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

/**
 * Input for Write tool.
 */
export interface WriteInput {
  file_path: string;
  content: string;
}

/**
 * Input for Edit tool.
 */
export interface EditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/**
 * Input for Glob tool.
 */
export interface GlobInput {
  pattern: string;
  path?: string;
}

/**
 * Input for Grep tool.
 */
export interface GrepInput {
  pattern: string;
  path?: string;
  output_mode?: "content" | "files_with_matches" | "count";
  glob?: string;
  type?: string;
  multiline?: boolean;
  head_limit?: number;
}

// =============================================================================
// SHELL OPERATION INPUTS
// =============================================================================

/**
 * Input for Bash tool.
 */
export interface BashInput {
  command: string;
  description?: string;
  timeout?: number;
  run_in_background?: boolean;
}

// =============================================================================
// WEB OPERATION INPUTS
// =============================================================================

/**
 * Input for WebFetch tool.
 */
export interface WebFetchInput {
  url: string;
  prompt: string;
}

/**
 * Input for WebSearch tool.
 */
export interface WebSearchInput {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

// =============================================================================
// MCP PUPPETEER INPUTS
// =============================================================================

/**
 * Input for Puppeteer navigation.
 */
export interface PuppeteerNavigateInput {
  url: string;
  launchOptions?: Record<string, unknown>;
  allowDangerous?: boolean;
}

/**
 * Input for Puppeteer screenshot.
 */
export interface PuppeteerScreenshotInput {
  name: string;
  selector?: string;
  width?: number;
  height?: number;
  encoded?: boolean;
}

/**
 * Input for Puppeteer click.
 */
export interface PuppeteerClickInput {
  selector: string;
}

/**
 * Input for Puppeteer fill.
 */
export interface PuppeteerFillInput {
  selector: string;
  value: string;
}

/**
 * Input for Puppeteer select.
 */
export interface PuppeteerSelectInput {
  selector: string;
  value: string;
}

/**
 * Input for Puppeteer hover.
 */
export interface PuppeteerHoverInput {
  selector: string;
}

/**
 * Input for Puppeteer evaluate.
 */
export interface PuppeteerEvaluateInput {
  script: string;
}

// =============================================================================
// AGENT OPERATION INPUTS
// =============================================================================

/**
 * Input for Task (sub-agent) tool.
 */
export interface TaskInput {
  prompt: string;
  description: string;
  subagent_type: string;
  model?: "sonnet" | "opus" | "haiku";
  run_in_background?: boolean;
  max_turns?: number;
}

/**
 * Input for TodoWrite tool.
 */
export interface TodoWriteInput {
  todos: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
    activeForm: string;
  }>;
}

/**
 * Input for AskUserQuestion tool.
 */
export interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect: boolean;
  }>;
}

/**
 * Input for Skill tool.
 */
export interface SkillInput {
  skill: string;
  args?: string;
}

// =============================================================================
// GENERIC INPUT
// =============================================================================

/**
 * Generic input for unknown/custom tools.
 */
export interface GenericInput {
  [key: string]: unknown;
}

// =============================================================================
// INPUT UNION
// =============================================================================

/**
 * Union of all tool input types.
 */
export type ToolInputUnion =
  | ReadInput
  | WriteInput
  | EditInput
  | GlobInput
  | GrepInput
  | BashInput
  | WebFetchInput
  | WebSearchInput
  | PuppeteerNavigateInput
  | PuppeteerScreenshotInput
  | PuppeteerClickInput
  | PuppeteerFillInput
  | PuppeteerSelectInput
  | PuppeteerHoverInput
  | PuppeteerEvaluateInput
  | TaskInput
  | TodoWriteInput
  | AskUserQuestionInput
  | SkillInput
  | GenericInput;

// =============================================================================
// FILE OPERATION OUTPUTS
// =============================================================================

/**
 * Output from Read tool.
 */
export interface ReadOutput {
  success: boolean;
  content?: string;
  lineCount?: number;
  charCount?: number;
  truncated?: boolean;
}

/**
 * Output from Write tool.
 */
export interface WriteOutput {
  success: boolean;
  path: string;
  bytesWritten: number;
}

/**
 * Output from Edit tool.
 */
export interface EditOutput {
  success: boolean;
  path: string;
  replacements: number;
}

/**
 * Output from Glob tool.
 */
export interface GlobOutput {
  success: boolean;
  files: string[];
  count: number;
}

/**
 * Output from Grep tool.
 */
export interface GrepOutput {
  success: boolean;
  matches?: string[];
  files?: string[];
  count?: number;
}

// =============================================================================
// SHELL OPERATION OUTPUTS
// =============================================================================

/**
 * Output from Bash tool.
 */
export interface BashOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated?: boolean;
}

// =============================================================================
// WEB OPERATION OUTPUTS
// =============================================================================

/**
 * Output from WebFetch tool.
 */
export interface WebFetchOutput {
  success: boolean;
  content?: string;
  summary?: string;
  error?: string;
}

/**
 * Output from WebSearch tool.
 */
export interface WebSearchOutput {
  success: boolean;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

// =============================================================================
// GENERIC OUTPUT
// =============================================================================

/**
 * Generic output for unknown/custom tools.
 */
export interface GenericOutput {
  success: boolean;
  [key: string]: unknown;
}

// =============================================================================
// OUTPUT UNION
// =============================================================================

/**
 * Union of all tool output types.
 */
export type ToolOutputUnion =
  | ReadOutput
  | WriteOutput
  | EditOutput
  | GlobOutput
  | GrepOutput
  | BashOutput
  | WebFetchOutput
  | WebSearchOutput
  | GenericOutput;
