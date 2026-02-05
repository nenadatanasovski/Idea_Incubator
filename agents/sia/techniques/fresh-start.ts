// agents/sia/techniques/fresh-start.ts - Clear context and retry with minimal state

import { AtomicTask, TaskContext } from "../../../types/build-agent.js";
import { FailureAnalysis, SIAResult } from "../../../types/sia-agent.js";
import { BaseTechnique } from "./base.js";

/**
 * Fresh Start Technique
 * 
 * Clears context pollution and retries with a clean slate.
 * Best used when:
 * - Previous attempts have polluted the context
 * - LLM is stuck in a loop making the same mistakes
 * - Context has become too noisy
 */
export class FreshStartTechnique extends BaseTechnique {
  name = "fresh_start";
  description = "Clear everything and retry with minimal context";
  
  protected targetIssueTypes: Array<FailureAnalysis["issueType"]> = ["environment", "unknown"];
  protected suitabilityKeywords = [
    "stuck",
    "loop",
    "same error",
    "repeated",
    "again",
    "still",
    "continues",
    "persists",
    "corrupted",
    "inconsistent",
    "state",
  ];
  protected baseScore = 0.3; // Lower base - use as last resort
  
  async apply(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): Promise<SIAResult> {
    // Create a fresh version of the task with minimal context
    const freshTask = this.createFreshTask(task, analysis);
    
    return this.createFixedResult(freshTask);
  }
  
  /**
   * Create a fresh task with minimal, clean requirements
   */
  private createFreshTask(
    task: AtomicTask,
    analysis: FailureAnalysis
  ): AtomicTask {
    // Simplify requirements to core essentials
    const essentialRequirements = this.extractEssentialRequirements(task.requirements);
    
    // Add a clear starting point instruction
    const freshRequirements = [
      `FRESH START: Implement this task from scratch, ignoring any previous attempts`,
      `File: ${task.file}`,
      `Action: ${task.action}`,
      ...essentialRequirements,
      `Focus on minimal, working implementation first`,
    ];
    
    // Clear gotchas that might be causing confusion, keep only general ones
    const safeGotchas = task.gotchas.filter(g => 
      !g.toLowerCase().includes("previous") &&
      !g.toLowerCase().includes("error") &&
      g.length < 100
    ).slice(0, 3);
    
    // Add fresh-start specific gotchas
    const freshGotchas = [
      "Start with the simplest possible implementation that compiles",
      "Add complexity only after basic structure works",
      ...safeGotchas,
    ];
    
    return {
      ...task,
      id: `${task.id}-fresh`,
      requirements: freshRequirements,
      gotchas: freshGotchas,
      // Keep original validation - that's how we know it works
      validation: task.validation,
    };
  }
  
  /**
   * Extract only the essential requirements
   */
  private extractEssentialRequirements(requirements: string[]): string[] {
    const essential: string[] = [];
    
    for (const req of requirements) {
      // Skip meta-requirements
      if (this.isMetaRequirement(req)) {
        continue;
      }
      
      // Simplify the requirement
      const simplified = this.simplifyRequirement(req);
      if (simplified) {
        essential.push(simplified);
      }
    }
    
    // Deduplicate and limit
    return Array.from(new Set(essential)).slice(0, 5);
  }
  
  /**
   * Check if a requirement is meta (about process, not functionality)
   */
  private isMetaRequirement(req: string): boolean {
    const metaKeywords = [
      "ensure",
      "make sure",
      "don't forget",
      "remember",
      "be careful",
      "watch out",
      "previous",
      "earlier",
      "last time",
    ];
    
    const reqLower = req.toLowerCase();
    return metaKeywords.some(kw => reqLower.includes(kw));
  }
  
  /**
   * Simplify a requirement to its core
   */
  private simplifyRequirement(req: string): string | null {
    // Remove qualifying phrases
    let simplified = req
      .replace(/\b(ensure|make sure|properly|correctly|carefully)\b/gi, "")
      .replace(/\b(if possible|when needed|as necessary)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    
    // Skip if too short after simplification
    if (simplified.length < 10) {
      return null;
    }
    
    // Capitalize first letter
    simplified = simplified.charAt(0).toUpperCase() + simplified.slice(1);
    
    return simplified;
  }
}

/**
 * Variant: Context Pruning Technique
 * 
 * Like Fresh Start but keeps some useful context.
 * More surgical than full fresh start.
 */
export class ContextPruningTechnique extends BaseTechnique {
  name = "context_pruning";
  description = "Remove noisy context while keeping useful parts";
  
  protected targetIssueTypes: Array<FailureAnalysis["issueType"]> = ["complexity", "environment"];
  protected suitabilityKeywords = [
    "context",
    "noise",
    "irrelevant",
    "too much",
    "overwhelming",
    "confused",
  ];
  protected baseScore = 0.35;
  
  async apply(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): Promise<SIAResult> {
    // Prune the task while keeping relevant context
    const prunedTask = this.pruneTask(task, context, analysis);
    
    return this.createFixedResult(prunedTask);
  }
  
  /**
   * Prune task to essential context
   */
  private pruneTask(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): AtomicTask {
    // Keep requirements that aren't related to errors
    const prunedRequirements = task.requirements.filter(req => {
      const reqLower = req.toLowerCase();
      
      // Keep if it's a core functional requirement
      if (this.isFunctionalRequirement(req)) {
        return true;
      }
      
      // Remove if it's explicitly mentioned in error patterns
      for (const pattern of analysis.errorPatterns) {
        if (reqLower.includes(pattern.toLowerCase().substring(0, 20))) {
          return false;
        }
      }
      
      return true;
    });
    
    // Keep only relevant gotchas
    const prunedGotchas = task.gotchas.filter(gotcha => {
      const gotchaLower = gotcha.toLowerCase();
      
      // Keep general best practices
      if (gotchaLower.includes("type") || 
          gotchaLower.includes("import") ||
          gotchaLower.includes("syntax")) {
        return true;
      }
      
      // Remove overly specific or error-related gotchas
      if (gotchaLower.includes("error") || 
          gotchaLower.includes("previous") ||
          gotcha.length > 150) {
        return false;
      }
      
      return true;
    }).slice(0, 5);
    
    return {
      ...task,
      requirements: prunedRequirements,
      gotchas: prunedGotchas,
    };
  }
  
  /**
   * Check if requirement is functional (describes behavior, not process)
   */
  private isFunctionalRequirement(req: string): boolean {
    const functionalVerbs = [
      "create",
      "implement",
      "add",
      "build",
      "define",
      "export",
      "return",
      "accept",
      "handle",
      "process",
      "render",
      "display",
      "fetch",
      "store",
      "validate",
    ];
    
    const reqLower = req.toLowerCase();
    return functionalVerbs.some(verb => reqLower.includes(verb));
  }
}
