// agents/sia/techniques/index.ts - Export all SIA techniques

export { BaseTechnique, Technique } from "./base.js";
export { DecompositionTechnique } from "./decomposition.js";
export { PromptRestructureTechnique } from "./prompt-restructure.js";
export { FreshStartTechnique, ContextPruningTechnique } from "./fresh-start.js";

// Re-export types
export type { FailureAnalysis, SIAResult } from "../../../types/sia-agent.js";
