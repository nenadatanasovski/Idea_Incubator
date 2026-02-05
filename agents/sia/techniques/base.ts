// agents/sia/techniques/base.ts - Base interface for SIA techniques

import { AtomicTask, TaskContext } from "../../../types/build-agent.js";
import { FailureAnalysis, SIAResult, Technique } from "../../../types/sia-agent.js";

/**
 * Abstract base class for SIA techniques
 * Provides common functionality and structure
 */
export abstract class BaseTechnique implements Technique {
  abstract name: string;
  abstract description: string;
  
  /**
   * Keywords that indicate this technique might be suitable
   */
  protected suitabilityKeywords: string[] = [];
  
  /**
   * Issue types this technique handles well
   */
  protected targetIssueTypes: Array<FailureAnalysis["issueType"]> = [];
  
  /**
   * Base score for this technique (0-1)
   */
  protected baseScore: number = 0.5;

  /**
   * Score how suitable this technique is for the failure
   * Default implementation uses keywords and issue type matching
   */
  scoreSuitability(analysis: FailureAnalysis): number {
    let score = this.baseScore;
    
    // Boost score if issue type matches
    if (this.targetIssueTypes.includes(analysis.issueType)) {
      score += 0.3;
    }
    
    // Check keywords in root cause
    const rootCauseLower = analysis.rootCause.toLowerCase();
    for (const keyword of this.suitabilityKeywords) {
      if (rootCauseLower.includes(keyword.toLowerCase())) {
        score += 0.1;
      }
    }
    
    // Check keywords in error patterns
    for (const pattern of analysis.errorPatterns) {
      const patternLower = pattern.toLowerCase();
      for (const keyword of this.suitabilityKeywords) {
        if (patternLower.includes(keyword.toLowerCase())) {
          score += 0.05;
        }
      }
    }
    
    // Cap at 1.0
    return Math.min(score, 1.0);
  }
  
  /**
   * Apply the technique to the task
   */
  abstract apply(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): Promise<SIAResult>;
  
  /**
   * Helper to create a "fixed" result
   */
  protected createFixedResult(modifiedTask: AtomicTask): SIAResult {
    return {
      type: "fixed",
      technique: this.name,
      modifiedTask,
    };
  }
  
  /**
   * Helper to create a "decomposed" result
   */
  protected createDecomposedResult(subtasks: AtomicTask[]): SIAResult {
    return {
      type: "decomposed",
      technique: this.name,
      subtasks,
    };
  }
  
  /**
   * Helper to create an "escalate" result
   */
  protected createEscalateResult(reason: string): SIAResult {
    return {
      type: "escalate",
      technique: this.name,
      reason,
    };
  }
  
  /**
   * Generate a unique subtask ID
   */
  protected generateSubtaskId(parentId: string, index: number): string {
    return `${parentId}-sub-${index + 1}`;
  }
}

export { Technique };
