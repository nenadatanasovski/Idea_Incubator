// agents/sia/techniques/prompt-restructure.ts - Rewrite task for clarity

import { AtomicTask, TaskContext } from "../../../types/build-agent.js";
import { FailureAnalysis, SIAResult } from "../../../types/sia-agent.js";
import { BaseTechnique } from "./base.js";

/**
 * Prompt Restructure Technique
 * 
 * Rewrites the task description to be clearer and more actionable.
 * Best used when:
 * - Requirements are ambiguous or vague
 * - Missing concrete details
 * - LLM seems confused about what to do
 */
export class PromptRestructureTechnique extends BaseTechnique {
  name = "prompt_restructure";
  description = "Rewrite task description for clarity";
  
  protected targetIssueTypes: Array<FailureAnalysis["issueType"]> = ["clarity"];
  protected suitabilityKeywords = [
    "unclear",
    "ambiguous",
    "vague",
    "confusing",
    "don't understand",
    "not sure",
    "which",
    "what",
    "how to",
    "missing",
    "undefined",
  ];
  protected baseScore = 0.5;
  
  async apply(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): Promise<SIAResult> {
    // Restructure the task based on the failure analysis
    const restructured = this.restructureTask(task, context, analysis);
    
    if (!restructured) {
      return this.createEscalateResult(
        "Could not meaningfully restructure the task"
      );
    }
    
    return this.createFixedResult(restructured);
  }
  
  /**
   * Restructure a task for clarity
   */
  private restructureTask(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): AtomicTask | null {
    const improvements: string[] = [];
    
    // Improve requirements based on error patterns
    const improvedRequirements = this.improveRequirements(
      task.requirements,
      analysis,
      context
    );
    
    if (improvedRequirements.length > task.requirements.length) {
      improvements.push("Added specificity to requirements");
    }
    
    // Add gotchas based on error patterns
    const additionalGotchas = this.extractGotchasFromError(analysis);
    const combinedGotchas = Array.from(new Set([...task.gotchas, ...additionalGotchas]));
    
    // Improve validation if it's too vague
    const improvedValidation = this.improveValidation(task, analysis);
    
    // If no meaningful improvements, return null
    if (
      improvedRequirements.length === task.requirements.length &&
      additionalGotchas.length === 0 &&
      improvedValidation.command === task.validation.command
    ) {
      return null;
    }
    
    return {
      ...task,
      requirements: improvedRequirements,
      gotchas: combinedGotchas,
      validation: improvedValidation,
    };
  }
  
  /**
   * Improve requirements based on analysis
   */
  private improveRequirements(
    requirements: string[],
    analysis: FailureAnalysis,
    context: TaskContext
  ): string[] {
    const improved: string[] = [];
    
    for (const req of requirements) {
      // Add the original requirement
      improved.push(req);
      
      // Check if this requirement is related to the error
      if (this.isRelatedToError(req, analysis)) {
        // Add clarifying requirements
        const clarifications = this.generateClarifications(req, analysis, context);
        improved.push(...clarifications);
      }
    }
    
    // Add explicit requirements based on error patterns
    const errorBasedReqs = this.generateErrorBasedRequirements(analysis);
    improved.push(...errorBasedReqs);
    
    // Remove duplicates
    return Array.from(new Set(improved));
  }
  
  /**
   * Check if a requirement is related to the error
   */
  private isRelatedToError(req: string, analysis: FailureAnalysis): boolean {
    const reqLower = req.toLowerCase();
    
    // Check if any error patterns mention keywords from the requirement
    for (const pattern of analysis.errorPatterns) {
      const patternLower = pattern.toLowerCase();
      const reqWords = reqLower.split(/\s+/).filter(w => w.length > 3);
      
      if (reqWords.some(word => patternLower.includes(word))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate clarifying requirements
   */
  private generateClarifications(
    req: string,
    analysis: FailureAnalysis,
    context: TaskContext
  ): string[] {
    const clarifications: string[] = [];
    const reqLower = req.toLowerCase();
    
    // Add type clarifications for TypeScript
    if (reqLower.includes("type") || reqLower.includes("interface")) {
      clarifications.push(
        "Ensure all TypeScript types are properly defined with explicit type annotations"
      );
    }
    
    // Add import clarifications
    if (analysis.errorPatterns.some(e => e.toLowerCase().includes("import"))) {
      clarifications.push(
        "Use correct import paths relative to the project structure"
      );
    }
    
    // Add async/await clarifications
    if (analysis.errorPatterns.some(e => 
      e.toLowerCase().includes("promise") || 
      e.toLowerCase().includes("async")
    )) {
      clarifications.push(
        "Ensure async functions are properly awaited and error handling is in place"
      );
    }
    
    // Add null/undefined handling
    if (analysis.errorPatterns.some(e => 
      e.toLowerCase().includes("undefined") || 
      e.toLowerCase().includes("null") ||
      e.toLowerCase().includes("cannot read")
    )) {
      clarifications.push(
        "Add null checks and handle undefined cases explicitly"
      );
    }
    
    return clarifications;
  }
  
  /**
   * Generate requirements based on error patterns
   */
  private generateErrorBasedRequirements(analysis: FailureAnalysis): string[] {
    const reqs: string[] = [];
    
    // Pattern-specific requirements
    for (const pattern of analysis.errorPatterns) {
      const patternLower = pattern.toLowerCase();
      
      if (patternLower.includes("module not found")) {
        reqs.push("Verify all imported modules exist and paths are correct");
      }
      
      if (patternLower.includes("type error") || patternLower.includes("type mismatch")) {
        reqs.push("Ensure type compatibility between function parameters and return values");
      }
      
      if (patternLower.includes("syntax error")) {
        reqs.push("Follow TypeScript/JavaScript syntax strictly, checking for missing brackets or semicolons");
      }
      
      if (patternLower.includes("timeout")) {
        reqs.push("Optimize performance - avoid expensive operations in the critical path");
      }
    }
    
    return Array.from(new Set(reqs)); // Deduplicate
  }
  
  /**
   * Extract gotchas from error analysis
   */
  private extractGotchasFromError(analysis: FailureAnalysis): string[] {
    const gotchas: string[] = [];
    
    // Root cause based gotchas
    if (analysis.rootCause) {
      gotchas.push(`Previous failure: ${analysis.rootCause} - avoid this pattern`);
    }
    
    // Error pattern based gotchas
    for (const pattern of analysis.errorPatterns.slice(0, 3)) { // Limit to 3
      if (pattern.length > 10 && pattern.length < 200) {
        gotchas.push(`Watch out: ${pattern}`);
      }
    }
    
    return gotchas;
  }
  
  /**
   * Improve validation command
   */
  private improveValidation(
    task: AtomicTask,
    analysis: FailureAnalysis
  ): { command: string; expected: string } {
    let command = task.validation.command;
    let expected = task.validation.expected;
    
    // If validation command is empty or too simple, suggest a better one
    if (!command || command.trim() === "") {
      // Suggest based on file type
      if (task.file.endsWith(".ts") || task.file.endsWith(".tsx")) {
        command = "npx tsc --noEmit";
        expected = "no errors";
      } else if (task.file.endsWith(".test.ts") || task.file.endsWith(".spec.ts")) {
        command = `npx vitest run ${task.file}`;
        expected = "tests passed";
      }
    }
    
    // Make expected more specific if it's too vague
    if (expected === "" || expected.toLowerCase() === "success") {
      expected = "exit code 0, no errors in output";
    }
    
    return { command, expected };
  }
}
