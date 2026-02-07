// agents/sia/agent.ts - Self-Improvement Agent for Build Intervention

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { AtomicTask, TaskContext } from "../../types/build-agent.js";
import {
  SIARequest,
  SIAResult,
  FailureAnalysis,
  TaskMemory,
  SIAAttemptRecord,
  Technique,
  DbSiaAttempt,
  DbSiaTaskMemory,
} from "../../types/sia-agent.js";
import { query, getOne, insert, update, saveDb } from "../../database/db.js";
import {
  DecompositionTechnique,
  PromptRestructureTechnique,
  FreshStartTechnique,
  ContextPruningTechnique,
} from "./techniques/index.js";

/**
 * Events emitted by SIA
 */
export interface SIAEvents {
  intervention: {
    taskId: string;
    technique: string;
    result: SIAResult["type"];
  };
  analysisComplete: {
    taskId: string;
    analysis: FailureAnalysis;
  };
  techniqueSelected: {
    taskId: string;
    technique: string;
    score: number;
  };
  escalation: {
    taskId: string;
    reason: string;
    techniquesAttempted: string[];
  };
}

/**
 * Self-Improvement Agent
 * 
 * Intervenes when the build agent fails a task repeatedly.
 * Analyzes failure patterns and applies techniques to fix or decompose tasks.
 */
export class SIAAgent extends EventEmitter {
  private techniques: Map<string, Technique> = new Map();
  
  constructor() {
    super();
    this.initializeTechniques();
  }
  
  /**
   * Initialize available techniques
   */
  private initializeTechniques(): void {
    // Core techniques (prioritized order)
    this.techniques.set("decomposition", new DecompositionTechnique());
    this.techniques.set("prompt_restructure", new PromptRestructureTechnique());
    this.techniques.set("context_pruning", new ContextPruningTechnique());
    this.techniques.set("fresh_start", new FreshStartTechnique());
  }
  
  /**
   * Main intervention method
   * Called when a task has failed multiple times
   */
  async intervene(request: SIARequest): Promise<SIAResult> {
    const { task, lastError, attempts, context, buildId } = request;
    
    console.log(`[SIA] Intervening on task ${task.id} (${attempts} failures)`);
    
    // Load task memory
    const memory = await this.loadTaskMemory(task.id);
    
    // Analyze the failure pattern
    const analysis = await this.analyzeFailure(task, lastError, memory);
    
    this.emit("analysisComplete", { taskId: task.id, analysis });
    
    // Select the best technique
    const technique = await this.selectTechnique(analysis, memory);
    
    if (!technique) {
      // No technique available - escalate
      const result: SIAResult = {
        type: "escalate",
        reason: `SIA exhausted all techniques. Last error: ${lastError}`,
      };
      
      await this.recordAttempt(task.id, buildId, "none", result, analysis, lastError, attempts);
      
      this.emit("escalation", {
        taskId: task.id,
        reason: result.reason,
        techniquesAttempted: memory.techniquesTried,
      });
      
      return result;
    }
    
    this.emit("techniqueSelected", {
      taskId: task.id,
      technique: technique.name,
      score: technique.scoreSuitability(analysis),
    });
    
    // Apply the technique
    const result = await this.applyTechnique(technique, task, context, analysis);
    
    // Record the attempt
    await this.recordAttempt(task.id, buildId, technique.name, result, analysis, lastError, attempts);
    
    // Emit intervention event
    this.emit("intervention", {
      taskId: task.id,
      technique: technique.name,
      result: result.type,
    });
    
    console.log(`[SIA] Technique ${technique.name} returned: ${result.type}`);
    
    return result;
  }
  
  /**
   * Analyze the failure pattern
   */
  async analyzeFailure(
    task: AtomicTask,
    lastError: string | null,
    memory: TaskMemory
  ): Promise<FailureAnalysis> {
    // Extract error patterns from the error message
    const errorPatterns = this.extractErrorPatterns(lastError);
    
    // Determine issue type based on error patterns
    const issueType = this.classifyIssueType(errorPatterns, task, memory);
    
    // Determine root cause
    const rootCause = this.determineRootCause(errorPatterns, task, memory);
    
    // Suggest approaches based on analysis
    const suggestedApproaches = this.suggestApproaches(issueType, errorPatterns, memory);
    
    // Calculate confidence in the analysis
    const confidence = this.calculateConfidence(errorPatterns, memory);
    
    return {
      rootCause,
      issueType,
      suggestedApproaches,
      confidence,
      errorPatterns,
    };
  }
  
  /**
   * Extract error patterns from error message
   */
  private extractErrorPatterns(error: string | null): string[] {
    if (!error) return ["Unknown error"];
    
    const patterns: string[] = [];
    
    // Common error pattern extractions
    const errorTypes = [
      /TypeError:\s*(.+?)(?:\n|$)/i,
      /SyntaxError:\s*(.+?)(?:\n|$)/i,
      /ReferenceError:\s*(.+?)(?:\n|$)/i,
      /Error:\s*(.+?)(?:\n|$)/i,
      /Cannot find module\s+'([^']+)'/i,
      /Cannot read propert[yies]+ of (undefined|null)/i,
      /is not a function/i,
      /is not defined/i,
      /Unexpected token/i,
      /timeout/i,
    ];
    
    for (const pattern of errorTypes) {
      const match = error.match(pattern);
      if (match) {
        patterns.push(match[0].trim());
      }
    }
    
    // If no specific patterns found, use first line
    if (patterns.length === 0) {
      const firstLine = error.split("\n")[0].trim();
      if (firstLine) {
        patterns.push(firstLine.substring(0, 200));
      }
    }
    
    return patterns;
  }
  
  /**
   * Classify the type of issue
   */
  private classifyIssueType(
    errorPatterns: string[],
    task: AtomicTask,
    memory: TaskMemory
  ): FailureAnalysis["issueType"] {
    const errorText = errorPatterns.join(" ").toLowerCase();
    
    // Clarity issues
    if (
      errorText.includes("undefined") ||
      errorText.includes("not defined") ||
      errorText.includes("cannot find") ||
      errorText.includes("missing")
    ) {
      return "clarity";
    }
    
    // Complexity issues
    if (
      errorText.includes("timeout") ||
      errorText.includes("too long") ||
      memory.totalInterventions > 2 ||
      task.requirements.length > 5
    ) {
      return "complexity";
    }
    
    // Environment issues
    if (
      errorText.includes("module not found") ||
      errorText.includes("cannot resolve") ||
      errorText.includes("enoent") ||
      errorText.includes("permission")
    ) {
      return "environment";
    }
    
    // Dependency issues
    if (
      errorText.includes("circular") ||
      errorText.includes("dependency") ||
      errorText.includes("require")
    ) {
      return "dependency";
    }
    
    return "unknown";
  }
  
  /**
   * Determine the root cause of failure
   */
  private determineRootCause(
    errorPatterns: string[],
    task: AtomicTask,
    memory: TaskMemory
  ): string {
    // Check if same error keeps occurring
    const previousErrors = memory.attempts
      .map(a => a.details?.error as string)
      .filter(Boolean);
    
    const errorText = errorPatterns[0] || "Unknown";
    
    if (previousErrors.some(pe => pe?.includes(errorText.substring(0, 50)))) {
      return `Recurring error: ${errorText}. Previous techniques did not resolve the underlying issue.`;
    }
    
    // Check task complexity
    if (task.requirements.length > 5) {
      return `Task complexity: ${task.requirements.length} requirements may be too many to handle in one pass.`;
    }
    
    // Default to error-based root cause
    return `Error during execution: ${errorText}`;
  }
  
  /**
   * Suggest approaches based on analysis
   */
  private suggestApproaches(
    issueType: FailureAnalysis["issueType"],
    _errorPatterns: string[],
    memory: TaskMemory
  ): string[] {
    const approaches: string[] = [];
    const tried = new Set(memory.techniquesTried);
    
    switch (issueType) {
      case "complexity":
        if (!tried.has("decomposition")) approaches.push("decomposition");
        if (!tried.has("context_pruning")) approaches.push("context_pruning");
        break;
        
      case "clarity":
        if (!tried.has("prompt_restructure")) approaches.push("prompt_restructure");
        if (!tried.has("fresh_start")) approaches.push("fresh_start");
        break;
        
      case "environment":
        if (!tried.has("fresh_start")) approaches.push("fresh_start");
        break;
        
      case "dependency":
        if (!tried.has("decomposition")) approaches.push("decomposition");
        break;
        
      default:
        // Try in order of general effectiveness
        for (const tech of ["prompt_restructure", "decomposition", "fresh_start"]) {
          if (!tried.has(tech)) approaches.push(tech);
        }
    }
    
    return approaches;
  }
  
  /**
   * Calculate confidence in the analysis
   */
  private calculateConfidence(
    errorPatterns: string[],
    memory: TaskMemory
  ): number {
    let confidence = 0.5; // Base confidence
    
    // More error patterns = more info = higher confidence
    confidence += Math.min(errorPatterns.length * 0.1, 0.2);
    
    // More history = better understanding
    confidence += Math.min(memory.attempts.length * 0.05, 0.15);
    
    // Previous successful techniques boost confidence
    if (memory.successfulTechnique) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 0.95);
  }
  
  /**
   * Select the best technique for this failure
   */
  async selectTechnique(
    analysis: FailureAnalysis,
    memory: TaskMemory
  ): Promise<Technique | null> {
    const triedTechniques = new Set(memory.techniquesTried);
    
    // Score all available techniques
    const rankings = Array.from(this.techniques.entries())
      .filter(([name]) => !triedTechniques.has(name))
      .map(([name, technique]) => ({
        name,
        technique,
        score: technique.scoreSuitability(analysis),
      }))
      .sort((a, b) => b.score - a.score);
    
    console.log(`[SIA] Technique rankings:`, rankings.map(r => `${r.name}: ${r.score.toFixed(2)}`));
    
    // Return highest scoring technique above threshold
    if (rankings.length === 0 || rankings[0].score < 0.25) {
      return null;
    }
    
    return rankings[0].technique;
  }
  
  /**
   * Apply a technique to the task
   */
  async applyTechnique(
    technique: Technique,
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): Promise<SIAResult> {
    try {
      return await technique.apply(task, context, analysis);
    } catch (error) {
      console.error(`[SIA] Technique ${technique.name} failed:`, error);
      return {
        type: "escalate",
        technique: technique.name,
        reason: `Technique failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  /**
   * Load task memory from database
   */
  async loadTaskMemory(taskId: string): Promise<TaskMemory> {
    const row = await getOne<DbSiaTaskMemory>(
      "SELECT * FROM sia_task_memory WHERE task_id = ?",
      [taskId]
    );
    
    if (row) {
      return {
        taskId: row.task_id,
        taskSignature: row.task_signature || "",
        attempts: JSON.parse(row.attempts) as SIAAttemptRecord[],
        techniquesTried: row.techniques_tried ? JSON.parse(row.techniques_tried) : [],
        successfulTechnique: row.successful_technique,
        totalInterventions: row.total_interventions,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    
    // Return empty memory for new tasks
    return {
      taskId,
      taskSignature: "",
      attempts: [],
      techniquesTried: [],
      successfulTechnique: null,
      totalInterventions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Record an intervention attempt
   */
  async recordAttempt(
    taskId: string,
    buildId: string | undefined,
    techniqueName: string,
    result: SIAResult,
    analysis: FailureAnalysis,
    originalError: string | null,
    attemptsBefore: number
  ): Promise<void> {
    const attemptId = uuidv4();
    const now = new Date().toISOString();
    
    // Record in sia_attempts
    await insert("sia_attempts", {
      id: attemptId,
      task_id: taskId,
      build_id: buildId || null,
      technique: techniqueName,
      result_type: result.type,
      details: JSON.stringify({
        reason: result.reason,
        subtaskCount: result.subtasks?.length,
        modified: !!result.modifiedTask,
      }),
      analysis: JSON.stringify(analysis),
      original_error: originalError,
      attempts_before: attemptsBefore,
    });
    
    // Update task memory
    await this.updateTaskMemory(taskId, techniqueName, result, now);
    
    await saveDb();
  }
  
  /**
   * Update task memory with new attempt
   */
  private async updateTaskMemory(
    taskId: string,
    techniqueName: string,
    result: SIAResult,
    timestamp: string
  ): Promise<void> {
    const existing = await getOne<DbSiaTaskMemory>(
      "SELECT * FROM sia_task_memory WHERE task_id = ?",
      [taskId]
    );
    
    const attemptRecord: SIAAttemptRecord = {
      technique: techniqueName,
      result: result.type,
      timestamp,
      details: { reason: result.reason },
    };
    
    if (existing) {
      const attempts = JSON.parse(existing.attempts) as SIAAttemptRecord[];
      attempts.push(attemptRecord);
      
      const techniquesTried = existing.techniques_tried 
        ? JSON.parse(existing.techniques_tried) as string[]
        : [];
      if (!techniquesTried.includes(techniqueName)) {
        techniquesTried.push(techniqueName);
      }
      
      await update(
        "sia_task_memory",
        {
          attempts: JSON.stringify(attempts),
          techniques_tried: JSON.stringify(techniquesTried),
          successful_technique: result.type === "fixed" || result.type === "decomposed"
            ? techniqueName
            : existing.successful_technique,
          total_interventions: existing.total_interventions + 1,
          updated_at: timestamp,
        },
        "task_id = ?",
        [taskId]
      );
    } else {
      await insert("sia_task_memory", {
        task_id: taskId,
        task_signature: null,
        attempts: JSON.stringify([attemptRecord]),
        techniques_tried: JSON.stringify([techniqueName]),
        successful_technique: result.type === "fixed" || result.type === "decomposed"
          ? techniqueName
          : null,
        total_interventions: 1,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  }
  
  /**
   * Get SIA metrics
   */
  async getMetrics(): Promise<{
    totalInterventions: number;
    successRate: number;
    techniqueBreakdown: Array<{
      technique: string;
      attempts: number;
      successes: number;
    }>;
  }> {
    const attempts = await query<DbSiaAttempt>(
      "SELECT * FROM sia_attempts"
    );
    
    const total = attempts.length;
    const successes = attempts.filter(a => 
      a.result_type === "fixed" || a.result_type === "decomposed"
    ).length;
    
    // Group by technique
    const byTechnique = new Map<string, { attempts: number; successes: number }>();
    for (const attempt of attempts) {
      const current = byTechnique.get(attempt.technique) || { attempts: 0, successes: 0 };
      current.attempts++;
      if (attempt.result_type === "fixed" || attempt.result_type === "decomposed") {
        current.successes++;
      }
      byTechnique.set(attempt.technique, current);
    }
    
    return {
      totalInterventions: total,
      successRate: total > 0 ? successes / total : 0,
      techniqueBreakdown: Array.from(byTechnique.entries()).map(([technique, stats]) => ({
        technique,
        ...stats,
      })),
    };
  }
}

/**
 * Create a new SIA agent instance
 */
export function createSIAAgent(): SIAAgent {
  return new SIAAgent();
}

// Export for use in build agent
export { SIAAgent as SIA };
