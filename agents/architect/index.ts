/**
 * Architect Agent - Main exports
 */

export { ArchitectAgent, type ArchitectAgentConfig } from "./architect-agent.js";
export * from "./types.js";
export * from "./prompts.js";
export * from "./diagram-generator.js";
export {
  ArchitectureValidator,
  type ValidationIssue,
  type ValidationReport,
  type ValidationSeverity,
} from "./architecture-validator.js";
