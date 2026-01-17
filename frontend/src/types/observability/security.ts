/**
 * OBS-211: Security Types
 *
 * Types for security-related tracking, especially Bash command validation.
 */

// =============================================================================
// SECURITY HOOK TYPES
// =============================================================================

/**
 * Security hook result for Bash commands.
 */
export interface SecurityHookResult {
  decision: "allow" | "block";
  reason?: string; // Required if blocked
}

// =============================================================================
// COMMAND ALLOWLIST
// =============================================================================

/**
 * Allowed commands for Build Agents (defense-in-depth).
 */
export const ALLOWED_BASH_COMMANDS = {
  file_inspection: ["ls", "cat", "head", "tail", "wc", "grep", "find"],
  node: ["npm", "npx", "node"],
  vcs: ["git"],
  process: ["ps", "lsof", "sleep", "pkill"],
  build: ["tsc", "eslint", "prettier", "vitest", "jest"],
  custom: ["init.sh"],
} as const;

/**
 * Type for allowed command categories.
 */
export type AllowedCommandCategory = keyof typeof ALLOWED_BASH_COMMANDS;

/**
 * Commands requiring extra validation.
 */
export const COMMANDS_NEEDING_EXTRA_VALIDATION = [
  "pkill",
  "chmod",
  "rm",
  "mv",
  "cp",
] as const;

/**
 * Type for commands needing extra validation.
 */
export type ExtraValidationCommand =
  (typeof COMMANDS_NEEDING_EXTRA_VALIDATION)[number];

// =============================================================================
// COMMAND VALIDATION
// =============================================================================

/**
 * Command validation result.
 */
export interface CommandValidationResult {
  isAllowed: boolean;
  category?: AllowedCommandCategory;
  needsExtraValidation: boolean;
  command: string;
  args: string[];
  reason?: string;
}

// =============================================================================
// DANGEROUS PATTERNS
// =============================================================================

/**
 * Dangerous command patterns that should be blocked.
 */
export const DANGEROUS_PATTERNS = [
  "rm -rf /",
  "rm -rf /*",
  "sudo",
  "> /dev/",
  "dd if=",
  "mkfs",
  "chmod 777",
  ":(){:|:&};:", // Fork bomb
  "wget | sh",
  "curl | sh",
  "eval",
] as const;

/**
 * Type for dangerous patterns.
 */
export type DangerousPattern = (typeof DANGEROUS_PATTERNS)[number];

// =============================================================================
// BLOCKED COMMAND ENTRY
// =============================================================================

/**
 * Record of a blocked command.
 */
export interface BlockedCommand {
  id: string;
  executionId: string;
  taskId?: string;
  instanceId: string;

  // === COMMAND ===
  originalCommand: string;
  parsedCommand: string;
  parsedArgs: string[];

  // === BLOCK REASON ===
  reason: string; // Why the command was blocked
  blockReason: string; // Alias for reason
  pattern?: DangerousPattern;
  suggestion?: string; // Safer alternative

  // === TIMING ===
  blockedAt: string;
  transcriptEntryId?: string;
}

/**
 * Security validation result for Bash commands.
 */
export interface SecurityValidation {
  isValid: boolean;
  command: string;
  blockedPattern?: DangerousPattern;
  reason?: string;
  suggestion?: string;
}

// =============================================================================
// SECURITY SUMMARY
// =============================================================================

/**
 * Security summary for an execution.
 */
export interface SecuritySummary {
  executionId: string;
  totalCommands: number;
  allowedCommands: number;
  blockedCommands: number;
  blockRate: number;

  byCategory: Partial<Record<AllowedCommandCategory, number>>;

  blockedList: BlockedCommand[];

  patterns: Array<{
    pattern: string;
    count: number;
    examples: string[];
  }>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a command is in the allowlist.
 */
export function isCommandAllowed(command: string): boolean {
  const baseCommand = command.split(" ")[0].split("/").pop() || "";

  for (const category of Object.values(ALLOWED_BASH_COMMANDS)) {
    if ((category as readonly string[]).includes(baseCommand)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the category for an allowed command.
 */
export function getCommandCategory(
  command: string,
): AllowedCommandCategory | undefined {
  const baseCommand = command.split(" ")[0].split("/").pop() || "";

  for (const [category, commands] of Object.entries(ALLOWED_BASH_COMMANDS)) {
    if ((commands as readonly string[]).includes(baseCommand)) {
      return category as AllowedCommandCategory;
    }
  }

  return undefined;
}

/**
 * Check if command needs extra validation.
 */
export function needsExtraValidation(command: string): boolean {
  const baseCommand = command.split(" ")[0].split("/").pop() || "";
  return (COMMANDS_NEEDING_EXTRA_VALIDATION as readonly string[]).includes(
    baseCommand,
  );
}

/**
 * Check if command matches a dangerous pattern.
 */
export function matchesDangerousPattern(
  command: string,
): DangerousPattern | undefined {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (command.includes(pattern)) {
      return pattern;
    }
  }
  return undefined;
}
