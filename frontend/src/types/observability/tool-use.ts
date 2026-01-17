/**
 * OBS-201: Tool Use Types
 *
 * Types for tracking tool invocations by Build Agents.
 */

import type { ToolCallRef } from "./transcript";

// =============================================================================
// TOOL ENUMS
// =============================================================================

/**
 * Categories for grouping tool uses (8 categories).
 */
export type ToolCategory =
  | "file_read" // Read, Glob, Grep
  | "file_write" // Write
  | "file_edit" // Edit
  | "shell" // Bash
  | "search" // Grep, Glob
  | "web" // WebFetch, WebSearch
  | "mcp" // MCP Puppeteer tools
  | "agent"; // Task (sub-agent)

/**
 * Result status for tool execution.
 */
export type ToolResultStatus = "done" | "error" | "blocked";

/**
 * Common tool names.
 */
export type ToolName =
  // File operations
  | "Read"
  | "Write"
  | "Edit"
  | "Glob"
  | "Grep"
  // System operations
  | "Bash"
  // Agent/Task operations
  | "Task"
  | "TodoWrite"
  | "AskUserQuestion"
  | "Skill"
  // Web operations
  | "WebFetch"
  | "WebSearch"
  // Notebook operations
  | "NotebookEdit"
  // MCP Puppeteer tools
  | "mcp__puppeteer__puppeteer_navigate"
  | "mcp__puppeteer__puppeteer_screenshot"
  | "mcp__puppeteer__puppeteer_click"
  | "mcp__puppeteer__puppeteer_fill"
  | "mcp__puppeteer__puppeteer_select"
  | "mcp__puppeteer__puppeteer_hover"
  | "mcp__puppeteer__puppeteer_evaluate"
  // Allow custom tools
  | string;

// =============================================================================
// TOOL USE ENTITY
// =============================================================================

/**
 * Complete record of a single tool invocation.
 * Matches the database schema for obs_tool_uses.
 */
export interface ToolUse {
  // === IDENTITY ===
  id: string; // UUID for this tool use
  executionId: string; // Parent execution
  taskId: string | null; // Current task (if applicable)
  transcriptEntryId: string; // Link to transcript entry

  // === TOOL IDENTITY ===
  tool: ToolName; // Tool that was invoked
  toolCategory: ToolCategory; // Category for filtering

  // === INVOCATION ===
  input: Record<string, unknown>; // Full input (structured)
  inputSummary: string; // Human-readable summary (max 200 chars)

  // === RESULT ===
  resultStatus: ToolResultStatus;
  output: Record<string, unknown> | null; // Full output (structured)
  outputSummary: string; // Human-readable summary (max 500 chars)

  // === ERROR HANDLING ===
  isError: boolean;
  isBlocked: boolean; // Security-blocked command
  errorMessage: string | null;
  blockReason: string | null; // Why command was blocked

  // === METRICS ===
  startTime: string; // ISO8601
  endTime: string; // ISO8601
  durationMs: number;

  // === CONTEXT ===
  withinSkill: string | null; // Skill ID if invoked during skill
  parentToolUseId: string | null; // For nested tool calls

  // === METADATA ===
  createdAt: string;
}

/**
 * Input for creating a tool use record.
 */
export interface ToolUseInput {
  tool: ToolName;
  toolCategory: ToolCategory;
  input: Record<string, unknown>;
  inputSummary: string;
  taskId?: string;
  withinSkill?: string;
  parentToolUseId?: string;
}

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

/**
 * Summary of tool usage for an execution.
 */
export interface ToolUseSummary {
  executionId: string;
  total: number;

  byTool: Record<
    string,
    {
      count: number;
      success: number;
      error: number;
      blocked: number;
      avgDurationMs: number;
    }
  >;

  byCategory: Record<
    ToolCategory,
    {
      count: number;
      success: number;
      error?: number;
      blocked?: number;
    }
  >;

  byStatus: {
    done: number;
    error: number;
    blocked: number;
  };

  avgDurationMs: number;
  errorRate: number;
  blockRate: number;

  timeline: {
    firstToolUse: string;
    lastToolUse: string;
    totalDurationMs: number;
  };

  errors: Array<{
    toolUseId: string;
    tool: string;
    inputSummary: string;
    errorMessage: string;
    timestamp: string;
  }>;

  blocked: Array<{
    toolUseId: string;
    tool: string;
    inputSummary: string;
    blockReason: string;
    timestamp: string;
  }>;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { ToolCallRef };
