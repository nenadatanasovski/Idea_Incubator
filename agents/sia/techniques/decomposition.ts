// agents/sia/techniques/decomposition.ts - Break complex tasks into subtasks

import { AtomicTask, TaskContext } from "../../../types/build-agent.js";
import { FailureAnalysis, SIAResult } from "../../../types/sia-agent.js";
import { BaseTechnique } from "./base.js";

/**
 * Decomposition Technique
 *
 * Breaks a complex task into smaller, independent subtasks.
 * Best used when:
 * - Task is too large/complex to complete in one attempt
 * - Multiple distinct operations are bundled together
 * - Error indicates overwhelm (too many things at once)
 */
export class DecompositionTechnique extends BaseTechnique {
  name = "decomposition";
  description = "Break complex task into smaller subtasks";

  protected targetIssueTypes: Array<FailureAnalysis["issueType"]> = [
    "complexity",
  ];
  protected suitabilityKeywords = [
    "too large",
    "too complex",
    "multiple",
    "several",
    "many",
    "all at once",
    "overwhelm",
    "timeout",
    "context",
  ];
  protected baseScore = 0.4;

  async apply(
    task: AtomicTask,
    _context: TaskContext,
    analysis: FailureAnalysis,
  ): Promise<SIAResult> {
    // Analyze the task to identify natural decomposition points
    const subtaskPlans = this.analyzeDecomposition(task, analysis);

    if (subtaskPlans.length < 2) {
      // Can't meaningfully decompose
      return this.createEscalateResult(
        "Task cannot be meaningfully decomposed into smaller parts",
      );
    }

    // Create subtasks
    const subtasks: AtomicTask[] = subtaskPlans.map((plan, index) => ({
      id: this.generateSubtaskId(task.id, index),
      phase: task.phase,
      action: task.action,
      file: plan.file || task.file,
      status: "pending",
      requirements: plan.requirements,
      gotchas: task.gotchas,
      validation: {
        command: plan.validationCommand || task.validation.command,
        expected: plan.validationExpected || task.validation.expected,
      },
      dependsOn:
        index > 0
          ? [this.generateSubtaskId(task.id, index - 1)]
          : task.dependsOn,
    }));

    return this.createDecomposedResult(subtasks);
  }

  /**
   * Analyze task to find decomposition points
   */
  private analyzeDecomposition(
    task: AtomicTask,
    _analysis: FailureAnalysis,
  ): SubtaskPlan[] {
    const plans: SubtaskPlan[] = [];

    // Strategy 1: Decompose by file if task mentions multiple files
    const fileMatches = this.extractFileReferences(task);
    if (fileMatches.length > 1) {
      for (const file of fileMatches) {
        plans.push({
          file,
          requirements: task.requirements.filter(
            (r) =>
              r.toLowerCase().includes(file.toLowerCase()) ||
              !this.mentionsOtherFiles(r, fileMatches, file),
          ),
          validationCommand: task.validation.command,
          validationExpected: task.validation.expected,
        });
      }
      if (plans.length > 1) return plans;
    }

    // Strategy 2: Decompose by requirement groups
    const reqGroups = this.groupRequirements(task.requirements);
    if (reqGroups.length > 1) {
      for (const group of reqGroups) {
        plans.push({
          file: task.file,
          requirements: group,
          validationCommand: task.validation.command,
          validationExpected: task.validation.expected,
        });
      }
      if (plans.length > 1) return plans;
    }

    // Strategy 3: Generic split (setup → core → validation)
    if (task.requirements.length >= 3) {
      const third = Math.ceil(task.requirements.length / 3);

      plans.push({
        file: task.file,
        requirements: [
          ...task.requirements.slice(0, third),
          "Set up foundational structure for subsequent changes",
        ],
        validationCommand: task.validation.command,
        validationExpected: "no errors",
      });

      plans.push({
        file: task.file,
        requirements: [
          ...task.requirements.slice(third, third * 2),
          "Build core functionality",
        ],
        validationCommand: task.validation.command,
        validationExpected: "no errors",
      });

      plans.push({
        file: task.file,
        requirements: [
          ...task.requirements.slice(third * 2),
          "Complete remaining functionality and verify integration",
        ],
        validationCommand: task.validation.command,
        validationExpected: task.validation.expected,
      });

      return plans;
    }

    // Can't decompose
    return [];
  }

  /**
   * Extract file references from task
   */
  private extractFileReferences(task: AtomicTask): string[] {
    const files: Set<string> = new Set();

    // Add main file
    files.add(task.file);

    // Look for file paths in requirements
    const filePattern = /[\w-]+\.(?:ts|tsx|js|jsx|css|scss|html|json|md)/gi;

    for (const req of task.requirements) {
      const matches = req.match(filePattern);
      if (matches) {
        matches.forEach((f) => files.add(f));
      }
    }

    return Array.from(files);
  }

  /**
   * Check if requirement mentions other files
   */
  private mentionsOtherFiles(
    req: string,
    allFiles: string[],
    currentFile: string,
  ): boolean {
    const otherFiles = allFiles.filter((f) => f !== currentFile);
    return otherFiles.some((f) => req.toLowerCase().includes(f.toLowerCase()));
  }

  /**
   * Group requirements by related functionality
   */
  private groupRequirements(requirements: string[]): string[][] {
    if (requirements.length < 4) return [requirements];

    const groups: string[][] = [];
    const used = new Set<number>();

    // Simple keyword-based grouping
    const keywordGroups: Record<string, string[]> = {
      setup: ["create", "initialize", "setup", "configure", "install"],
      data: ["schema", "database", "table", "model", "data", "type"],
      logic: ["function", "method", "implement", "handle", "process"],
      ui: ["component", "render", "display", "style", "layout"],
      test: ["test", "verify", "validate", "check", "assert"],
    };

    for (const [_groupName, keywords] of Object.entries(keywordGroups)) {
      const group: string[] = [];

      requirements.forEach((req, index) => {
        if (used.has(index)) return;

        const reqLower = req.toLowerCase();
        if (keywords.some((kw) => reqLower.includes(kw))) {
          group.push(req);
          used.add(index);
        }
      });

      if (group.length > 0) {
        groups.push(group);
      }
    }

    // Add remaining requirements to last group or create new one
    const remaining = requirements.filter((_, i) => !used.has(i));
    if (remaining.length > 0) {
      if (groups.length > 0) {
        groups[groups.length - 1].push(...remaining);
      } else {
        groups.push(remaining);
      }
    }

    return groups.filter((g) => g.length > 0);
  }
}

interface SubtaskPlan {
  file: string;
  requirements: string[];
  validationCommand?: string;
  validationExpected?: string;
}
