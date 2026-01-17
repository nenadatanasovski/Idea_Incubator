/**
 * Task Decomposer
 *
 * Breaks down large tasks into atomic subtasks with full context.
 * Part of: Task System V2 Implementation Plan (IMPL-4.4)
 *
 * Enhanced per TASK-DECOMPOSITION-COMPREHENSIVE-PLAN.md:
 * - PRD/Spec context loading
 * - Intelligent AC splitting
 * - Test command distribution per subtask type
 * - Enhanced split suggestions with source context
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import { Task, TaskCategory } from "../../../types/task-agent.js";
import { CreateTaskImpactInput } from "../../../types/task-impact.js";
import { atomicityValidator } from "./atomicity-validator.js";
import { generateDisplayId } from "./display-id-generator.js";

/**
 * Database row interface for tasks (snake_case columns)
 */
interface TaskRow {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  queue: string | null;
  task_list_id: string | null;
  project_id: string | null;
  priority: string;
  effort: string;
  phase: number;
  position: number;
  owner: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Map database row to Task object
 */
function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    displayId: row.display_id,
    title: row.title,
    description: row.description || undefined,
    category: row.category as Task["category"],
    status: row.status as Task["status"],
    queue: row.queue as Task["queue"],
    taskListId: row.task_list_id || undefined,
    projectId: row.project_id || undefined,
    priority: row.priority as Task["priority"],
    effort: row.effort as Task["effort"],
    phase: row.phase,
    position: row.position,
    owner: row.owner as Task["owner"],
    assignedAgentId: row.assigned_agent_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * Context for decomposition - loaded from PRDs, appendices, related tasks
 */
export interface DecompositionContext {
  task: Task;
  appendices: TaskAppendix[];
  linkedPrds: PrdInfo[];
  relatedTasks: TaskRelation[];
  fileImpacts: FileImpactRow[];
  existingAcceptanceCriteria: string[];
}

interface TaskAppendix {
  id: string;
  taskId: string;
  appendixType: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface PrdInfo {
  id: string;
  title: string;
  content: string;
  requirements?: string[];
}

interface TaskRelation {
  id: string;
  relationshipType: string;
  relatedTaskId: string;
  relatedTaskTitle: string;
}

interface FileImpactRow {
  targetPath: string;
  operation: string;
  impactType: string;
}

/**
 * Enhanced split suggestion with AC and test commands
 */
export interface EnhancedSplitSuggestion {
  title: string;
  description: string;
  category: TaskCategory;
  estimatedEffort: string;
  dependencies: string[]; // References to other splits (by index)
  impacts: CreateTaskImpactInput[];
  acceptanceCriteria: string[]; // Per-subtask AC
  testCommands: string[]; // Per-subtask tests
  sourceContext: {
    fromPrd?: string;
    fromParentCriteria?: number[];
    reasoning: string;
  };
  dependsOnIndex?: number; // Index of subtask this depends on
}

/**
 * Legacy split suggestion (backwards compatibility)
 */
export interface SplitSuggestion {
  title: string;
  description: string;
  category: TaskCategory;
  estimatedEffort: string;
  dependencies: string[];
  impacts: CreateTaskImpactInput[];
}

/**
 * Enhanced decomposition result
 */
export interface DecompositionResult {
  originalTaskId: string;
  suggestedTasks: EnhancedSplitSuggestion[];
  totalEstimatedEffort: string;
  decompositionReason: string;
  contextUsed: {
    prdsUsed: string[];
    criteriaDistributed: number;
    criteriaGenerated: number;
  };
}

/**
 * Test command mappings by subtask type
 */
const TEST_COMMAND_MAPPING: Record<string, string[]> = {
  database: ["npx tsc --noEmit", "npm run test:db"],
  api: ["npx tsc --noEmit", "npm run test:server"],
  service: ["npx tsc --noEmit", "npm run test:server"],
  ui: ["npx tsc --noEmit", "npm run test:frontend"],
  test: ["npm test -- --passWithNoTests"],
  types: ["npx tsc --noEmit"],
  other: ["npx tsc --noEmit", "npm test -- --passWithNoTests"],
};

/**
 * Keyword to subtask type mapping for AC distribution
 */
const AC_KEYWORD_MAPPING: Record<string, string[]> = {
  database: [
    "database",
    "table",
    "migration",
    "schema",
    "column",
    "index",
    "constraint",
    "sql",
  ],
  api: [
    "api",
    "endpoint",
    "route",
    "request",
    "response",
    "http",
    "rest",
    "server",
  ],
  ui: [
    "component",
    "ui",
    "button",
    "form",
    "modal",
    "page",
    "view",
    "frontend",
    "react",
    "display",
  ],
  test: ["test", "spec", "coverage", "verify", "assert", "expect"],
  types: ["type", "interface", "enum", "typescript", "schema"],
};

/**
 * Task Decomposer class
 */
export class TaskDecomposer {
  /**
   * Load context for decomposition from PRDs, appendices, and related tasks
   */
  async loadContext(taskId: string): Promise<DecompositionContext> {
    const taskRow = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!taskRow) {
      throw new Error(`Task ${taskId} not found`);
    }

    const task = mapTaskRow(taskRow);

    // 1. Load task appendices
    const appendicesRaw = await query<{
      id: string;
      task_id: string;
      appendix_type: string;
      content: string;
      metadata: string | null;
    }>(
      "SELECT id, task_id, appendix_type, content, metadata FROM task_appendices WHERE task_id = ?",
      [taskId],
    );

    const appendices: TaskAppendix[] = appendicesRaw.map((a) => ({
      id: a.id,
      taskId: a.task_id,
      appendixType: a.appendix_type,
      content: a.content,
      metadata: a.metadata ? JSON.parse(a.metadata) : undefined,
    }));

    // 2. Load linked PRDs via prd_tasks table
    const prdsRaw = await query<{
      id: string;
      title: string;
      problem_statement: string | null;
      functional_description: string | null;
      success_criteria: string | null;
    }>(
      `SELECT p.id, p.title, p.problem_statement, p.functional_description, p.success_criteria
       FROM prds p
       JOIN prd_tasks pt ON p.id = pt.prd_id
       WHERE pt.task_id = ?`,
      [taskId],
    );

    const linkedPrds: PrdInfo[] = prdsRaw.map((p) => {
      // Compose content from multiple PRD fields
      const parts: string[] = [];
      if (p.problem_statement) parts.push(`Problem: ${p.problem_statement}`);
      if (p.functional_description)
        parts.push(`Description: ${p.functional_description}`);

      return {
        id: p.id,
        title: p.title,
        content: parts.join("\n\n"),
        requirements: p.success_criteria ? JSON.parse(p.success_criteria) : [],
      };
    });

    // 3. Load related tasks (implements, inspired_by relationships)
    const relatedRaw = await query<{
      id: string;
      relationship_type: string;
      target_task_id: string;
      target_title: string;
    }>(
      `SELECT tr.id, tr.relationship_type, tr.target_task_id, t.title as target_title
       FROM task_relationships tr
       JOIN tasks t ON t.id = tr.target_task_id
       WHERE tr.source_task_id = ? AND tr.relationship_type IN ('implements', 'inspired_by', 'related_to')`,
      [taskId],
    );

    const relatedTasks: TaskRelation[] = relatedRaw.map((r) => ({
      id: r.id,
      relationshipType: r.relationship_type,
      relatedTaskId: r.target_task_id,
      relatedTaskTitle: r.target_title,
    }));

    // 4. Load file impacts
    const impactsRaw = await query<{
      target_path: string;
      operation: string;
      impact_type: string;
    }>(
      "SELECT target_path, operation, impact_type FROM task_impacts WHERE task_id = ?",
      [taskId],
    );

    const fileImpacts: FileImpactRow[] = impactsRaw.map((i) => ({
      targetPath: i.target_path,
      operation: i.operation,
      impactType: i.impact_type,
    }));

    // 5. Extract existing acceptance criteria from appendices
    const acAppendix = appendices.find(
      (a) => a.appendixType === "acceptance_criteria",
    );
    let existingAcceptanceCriteria: string[] = [];

    if (acAppendix) {
      try {
        const parsed = JSON.parse(acAppendix.content);
        if (Array.isArray(parsed)) {
          existingAcceptanceCriteria = parsed;
        } else if (parsed.criteria && Array.isArray(parsed.criteria)) {
          existingAcceptanceCriteria = parsed.criteria;
        }
      } catch {
        // If not JSON, split by newlines
        existingAcceptanceCriteria = acAppendix.content
          .split("\n")
          .filter((line) => line.trim());
      }
    }

    return {
      task,
      appendices,
      linkedPrds,
      relatedTasks,
      fileImpacts,
      existingAcceptanceCriteria,
    };
  }

  /**
   * Split acceptance criteria among subtasks based on keyword matching
   */
  splitAcceptanceCriteria(
    criteria: string[],
    subtasks: EnhancedSplitSuggestion[],
  ): Map<number, string[]> {
    const distribution = new Map<number, string[]>();

    // Initialize empty arrays for each subtask
    for (let i = 0; i < subtasks.length; i++) {
      distribution.set(i, []);
    }

    for (let criterionIdx = 0; criterionIdx < criteria.length; criterionIdx++) {
      const criterion = criteria[criterionIdx].toLowerCase();
      const matchingSubtasks: number[] = [];

      // Find subtasks that match this criterion
      for (let subtaskIdx = 0; subtaskIdx < subtasks.length; subtaskIdx++) {
        const subtask = subtasks[subtaskIdx];
        const componentType = this.getComponentFromPath(
          subtask.impacts[0]?.targetPath || "",
        );

        // Check if criterion keywords match subtask's component type
        const keywords = AC_KEYWORD_MAPPING[componentType] || [];
        const matches = keywords.some((kw) => criterion.includes(kw));

        // Also check category-based matching
        const categoryMatch =
          (criterion.includes("database") && componentType === "database") ||
          (criterion.includes("api") && componentType === "api") ||
          (criterion.includes("ui") && componentType === "ui") ||
          (criterion.includes("test") && componentType === "test");

        if (matches || categoryMatch) {
          matchingSubtasks.push(subtaskIdx);
        }
      }

      // Distribute criterion
      if (matchingSubtasks.length === 0) {
        // If no specific match, give to first subtask (or the most relevant one)
        distribution.get(0)?.push(criteria[criterionIdx]);
      } else if (matchingSubtasks.length === 1) {
        // Single match - assign directly
        distribution.get(matchingSubtasks[0])?.push(criteria[criterionIdx]);
      } else {
        // Multiple matches - duplicate to all matching subtasks
        for (const idx of matchingSubtasks) {
          distribution.get(idx)?.push(criteria[criterionIdx]);
        }
      }
    }

    return distribution;
  }

  /**
   * Assign appropriate test commands to subtasks based on their type
   */
  assignTestCommands(
    subtasks: EnhancedSplitSuggestion[],
  ): EnhancedSplitSuggestion[] {
    return subtasks.map((subtask) => {
      const componentType = this.getComponentFromPath(
        subtask.impacts[0]?.targetPath ||
          subtask.category ||
          subtask.title.toLowerCase(),
      );

      // Get test commands for this component type
      const testCommands = TEST_COMMAND_MAPPING[componentType] ||
        TEST_COMMAND_MAPPING.other || ["npx tsc --noEmit"];

      return {
        ...subtask,
        testCommands: [...new Set([...subtask.testCommands, ...testCommands])],
      };
    });
  }

  /**
   * Generate criteria for subtasks that have none
   */
  generateCriteriaForSubtask(subtask: EnhancedSplitSuggestion): string[] {
    const criteria: string[] = [];
    const componentType = this.getComponentFromPath(
      subtask.impacts[0]?.targetPath || "",
    );

    switch (componentType) {
      case "database":
        criteria.push("Database migration runs without errors");
        criteria.push("Schema changes are properly applied");
        break;
      case "api":
        criteria.push("API endpoint returns correct status codes");
        criteria.push("Request validation works correctly");
        break;
      case "ui":
        criteria.push("Component renders without errors");
        criteria.push("User interactions work as expected");
        break;
      case "test":
        criteria.push("All tests pass");
        criteria.push("Test coverage meets requirements");
        break;
      case "types":
        criteria.push("TypeScript compiles without errors");
        criteria.push("Types are properly exported");
        break;
      default:
        criteria.push(`${subtask.title} works as specified`);
        criteria.push("No regressions introduced");
    }

    return criteria;
  }

  /**
   * Decompose a task into atomic subtasks with full context
   */
  async decompose(taskId: string): Promise<DecompositionResult> {
    // Load full context
    const context = await this.loadContext(taskId);
    const { task, existingAcceptanceCriteria, linkedPrds } = context;

    // Validate atomicity first
    const atomicity = await atomicityValidator.validate(task);

    if (atomicity.isAtomic) {
      return {
        originalTaskId: taskId,
        suggestedTasks: [],
        totalEstimatedEffort: task.effort,
        decompositionReason: "Task is already atomic",
        contextUsed: {
          prdsUsed: [],
          criteriaDistributed: 0,
          criteriaGenerated: 0,
        },
      };
    }

    // Generate splits based on failed rules and context
    const splits = await this.suggestSplitsEnhanced(context);

    // Distribute existing acceptance criteria to subtasks
    const acDistribution = this.splitAcceptanceCriteria(
      existingAcceptanceCriteria,
      splits,
    );

    // Apply distributed AC and generate missing criteria
    let criteriaDistributed = 0;
    let criteriaGenerated = 0;

    for (let i = 0; i < splits.length; i++) {
      const distributedAC = acDistribution.get(i) || [];
      criteriaDistributed += distributedAC.length;

      if (distributedAC.length === 0) {
        // Generate criteria for subtasks with none
        const generatedAC = this.generateCriteriaForSubtask(splits[i]);
        splits[i].acceptanceCriteria = generatedAC;
        splits[i].sourceContext.reasoning = "Generated based on subtask type";
        criteriaGenerated += generatedAC.length;
      } else {
        splits[i].acceptanceCriteria = distributedAC;
        splits[i].sourceContext.fromParentCriteria = distributedAC.map(
          (_, idx) =>
            existingAcceptanceCriteria.findIndex(
              (c) => c === distributedAC[idx],
            ),
        );
      }
    }

    // Assign test commands based on component types
    const splitsWithTests = this.assignTestCommands(splits);

    // Calculate total effort
    const effortValues: Record<string, number> = {
      trivial: 1,
      small: 2,
      medium: 4,
      large: 8,
      epic: 16,
    };

    const totalEffort = splitsWithTests.reduce(
      (sum, s) => sum + (effortValues[s.estimatedEffort] || 4),
      0,
    );

    const totalEffortLabel =
      totalEffort <= 1
        ? "trivial"
        : totalEffort <= 2
          ? "small"
          : totalEffort <= 4
            ? "medium"
            : totalEffort <= 8
              ? "large"
              : "epic";

    return {
      originalTaskId: taskId,
      suggestedTasks: splitsWithTests,
      totalEstimatedEffort: totalEffortLabel,
      decompositionReason:
        atomicity.suggestedSplits?.join("; ") || "Task not atomic",
      contextUsed: {
        prdsUsed: linkedPrds.map((p) => p.title),
        criteriaDistributed,
        criteriaGenerated,
      },
    };
  }

  /**
   * Preview decomposition without executing
   */
  async preview(taskId: string): Promise<DecompositionResult> {
    return this.decompose(taskId);
  }

  /**
   * Generate enhanced split suggestions for a task with context
   */
  async suggestSplitsEnhanced(
    context: DecompositionContext,
  ): Promise<EnhancedSplitSuggestion[]> {
    const { task, fileImpacts, linkedPrds } = context;
    const splits: EnhancedSplitSuggestion[] = [];
    const description = task.description || "";

    // Strategy 1: Split by component type (from file impacts)
    const componentGroups = this.groupByComponent(fileImpacts);
    if (Object.keys(componentGroups).length > 1) {
      let depIndex = -1;
      for (const [component, componentImpacts] of Object.entries(
        componentGroups,
      )) {
        const category = this.getCategoryForComponent(component);
        const splitIndex = splits.length;

        splits.push({
          title: `${task.title} - ${component} changes`,
          description: `${component} portion of: ${description}`,
          category,
          estimatedEffort: this.estimateEffort(componentImpacts.length),
          dependencies: depIndex >= 0 ? [depIndex.toString()] : [],
          dependsOnIndex: depIndex >= 0 ? depIndex : undefined,
          impacts: componentImpacts.map((i) => ({
            taskId: "", // Will be set on execution
            impactType: i.impactType as
              | "file"
              | "api"
              | "function"
              | "database"
              | "type",
            operation: i.operation as "CREATE" | "UPDATE" | "DELETE" | "READ",
            targetPath: i.targetPath,
          })),
          acceptanceCriteria: [],
          testCommands: [],
          sourceContext: {
            fromPrd: linkedPrds[0]?.title,
            reasoning: `Split by ${component} component type`,
          },
        });

        // Set up dependency chain based on phase order
        if (component === "database") {
          depIndex = splitIndex;
        } else if (component === "types" && depIndex >= 0) {
          depIndex = splitIndex;
        }
      }

      // Sort by phase order
      const phaseOrder: Record<string, number> = {
        database: 1,
        types: 2,
        api: 3,
        service: 4,
        ui: 5,
        test: 6,
        other: 7,
      };

      splits.sort((a, b) => {
        const componentA = this.getComponentFromPath(
          a.impacts[0]?.targetPath || a.category,
        );
        const componentB = this.getComponentFromPath(
          b.impacts[0]?.targetPath || b.category,
        );
        return (phaseOrder[componentA] || 7) - (phaseOrder[componentB] || 7);
      });

      // Rebuild dependencies after sort
      for (let i = 1; i < splits.length; i++) {
        splits[i].dependencies = [(i - 1).toString()];
        splits[i].dependsOnIndex = i - 1;
      }
    }

    // Strategy 2: Split if task has multiple "and" clauses
    if (splits.length === 0) {
      const andParts = this.splitByConjunction(task.title, description);
      if (andParts.length > 1) {
        for (let i = 0; i < andParts.length; i++) {
          splits.push({
            title: andParts[i],
            description: `Part of: ${description}`,
            category: task.category,
            estimatedEffort: "small",
            dependencies: i > 0 ? [(i - 1).toString()] : [],
            dependsOnIndex: i > 0 ? i - 1 : undefined,
            impacts: [],
            acceptanceCriteria: [],
            testCommands: [],
            sourceContext: {
              reasoning: `Split by conjunction - part ${i + 1} of ${andParts.length}`,
            },
          });
        }
      }
    }

    // Strategy 2.5: Split by numbered list items in description
    if (splits.length === 0 && description) {
      const numberedItems = this.parseNumberedList(description);

      // Extract run command and acceptance criteria from description
      const runCommandMatch = description.match(
        /Run Command:\s*(.+?)(?:\n|$)/i,
      );
      const runCommand = runCommandMatch ? runCommandMatch[1].trim() : null;

      // Extract acceptance criteria section
      const acSection = description.match(
        /Acceptance Criteria:[\s\S]*?((?=\n\n)|$)/i,
      );
      const originalAC = acSection
        ? acSection[0]
            .replace(/Acceptance Criteria:/i, "")
            .split(/\n/)
            .map((line) => line.replace(/^[-•*]\s*/, "").trim())
            .filter((line) => line.length > 0)
        : [];

      if (numberedItems.length >= 3) {
        // Group related items (e.g., TranscriptWriter tests together)
        const groups = this.groupRelatedItems(numberedItems);

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const groupTitle =
            group.length === 1 ? group[0].text : this.getGroupTitle(group);

          // Determine test command
          const testCommands: string[] = [];
          if (runCommand) {
            testCommands.push(runCommand);
          } else {
            testCommands.push("npx tsc --noEmit");
          }

          // Distribute relevant AC to this group
          const relevantAC = this.findRelevantAC(originalAC, group);

          splits.push({
            title: `${task.title} - ${groupTitle}`,
            description: group
              .map((item) => `${item.number}. ${item.text}`)
              .join("\n"),
            category: task.category === "task" ? "test" : task.category,
            estimatedEffort: group.length <= 2 ? "trivial" : "small",
            dependencies: i > 0 ? [(i - 1).toString()] : [],
            dependsOnIndex: i > 0 ? i - 1 : undefined,
            impacts: [],
            acceptanceCriteria:
              relevantAC.length > 0 ? relevantAC : [`${groupTitle} tests pass`],
            testCommands,
            sourceContext: {
              reasoning: `Split by numbered list - ${group.length} test(s) in group`,
            },
          });
        }
      }
    }

    // Strategy 3: Default split by phase (Design -> Implementation -> Testing)
    if (
      (splits.length === 0 && task.effort === "large") ||
      task.effort === "epic"
    ) {
      splits.push(
        {
          title: `${task.title} - Design`,
          description: `Design phase: ${description}`,
          category: "research",
          estimatedEffort: "small",
          dependencies: [],
          impacts: [],
          acceptanceCriteria: ["Design document reviewed and approved"],
          testCommands: [],
          sourceContext: {
            reasoning: "Default phase split - design phase",
          },
        },
        {
          title: `${task.title} - Implementation`,
          description: `Implementation phase: ${description}`,
          category: task.category,
          estimatedEffort: "medium",
          dependencies: ["0"],
          dependsOnIndex: 0,
          impacts: fileImpacts.map((i) => ({
            taskId: "",
            impactType: i.impactType as
              | "file"
              | "api"
              | "function"
              | "database"
              | "type",
            operation: i.operation as "CREATE" | "UPDATE" | "DELETE" | "READ",
            targetPath: i.targetPath,
          })),
          acceptanceCriteria: ["Implementation matches design specification"],
          testCommands: [],
          sourceContext: {
            reasoning: "Default phase split - implementation phase",
          },
        },
        {
          title: `${task.title} - Testing`,
          description: `Testing phase: ${description}`,
          category: "test",
          estimatedEffort: "small",
          dependencies: ["1"],
          dependsOnIndex: 1,
          impacts: [],
          acceptanceCriteria: ["All tests pass", "No regressions introduced"],
          testCommands: ["npm test -- --passWithNoTests"],
          sourceContext: {
            reasoning: "Default phase split - testing phase",
          },
        },
      );
    }

    // Strategy 4: Fallback for medium effort tasks - split into Implementation + Verification
    if (splits.length === 0 && task.effort === "medium") {
      splits.push(
        {
          title: `${task.title} - Implementation`,
          description: `Core implementation: ${description}`,
          category: task.category,
          estimatedEffort: "small",
          dependencies: [],
          impacts: fileImpacts.map((i) => ({
            taskId: "",
            impactType: i.impactType as
              | "file"
              | "api"
              | "function"
              | "database"
              | "type",
            operation: i.operation as "CREATE" | "UPDATE" | "DELETE" | "READ",
            targetPath: i.targetPath,
          })),
          acceptanceCriteria: ["Core functionality implemented"],
          testCommands: ["npx tsc --noEmit"],
          sourceContext: {
            reasoning: "Default split - implementation phase",
          },
        },
        {
          title: `${task.title} - Verification`,
          description: `Verify and test: ${description}`,
          category: "test",
          estimatedEffort: "trivial",
          dependencies: ["0"],
          dependsOnIndex: 0,
          impacts: [],
          acceptanceCriteria: [
            "All acceptance criteria verified",
            "Tests pass",
          ],
          testCommands: ["npm test -- --passWithNoTests"],
          sourceContext: {
            reasoning: "Default split - verification phase",
          },
        },
      );
    }

    // Strategy 5: Fallback for small effort tasks - just suggest a single atomic subtask
    if (splits.length === 0 && task.effort === "small") {
      splits.push({
        title: task.title,
        description: description || task.title,
        category: task.category,
        estimatedEffort: "small",
        dependencies: [],
        impacts: fileImpacts.map((i) => ({
          taskId: "",
          impactType: i.impactType as
            | "file"
            | "api"
            | "function"
            | "database"
            | "type",
          operation: i.operation as "CREATE" | "UPDATE" | "DELETE" | "READ",
          targetPath: i.targetPath,
        })),
        acceptanceCriteria: ["Task completed as specified"],
        testCommands: ["npx tsc --noEmit"],
        sourceContext: {
          reasoning:
            "Single atomic task - add acceptance criteria before execution",
        },
      });
    }

    return splits;
  }

  /**
   * Generate split suggestions for a task (legacy method for backwards compatibility)
   */
  async suggestSplits(task: Task): Promise<SplitSuggestion[]> {
    const context = await this.loadContext(task.id);
    const enhanced = await this.suggestSplitsEnhanced(context);

    // Convert to legacy format
    return enhanced.map((s) => ({
      title: s.title,
      description: s.description,
      category: s.category,
      estimatedEffort: s.estimatedEffort,
      dependencies: s.dependencies,
      impacts: s.impacts,
    }));
  }

  /**
   * Execute decomposition - create subtasks with full context and mark original as skipped
   */
  async executeDecomposition(
    taskId: string,
    splits: EnhancedSplitSuggestion[],
  ): Promise<Task[]> {
    const originalTaskRow = await getOne<TaskRow>(
      "SELECT * FROM tasks WHERE id = ?",
      [taskId],
    );

    if (!originalTaskRow) {
      throw new Error(`Task ${taskId} not found`);
    }

    const originalTask = mapTaskRow(originalTaskRow);

    const createdTasks: Task[] = [];
    const idMapping = new Map<number, string>();

    // Create subtasks
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const newId = uuidv4();
      const now = new Date().toISOString();

      // Generate display_id for the subtask
      const displayId = await generateDisplayId(
        split.category as TaskCategory,
        originalTask.projectId,
      );

      await run(
        `INSERT INTO tasks (id, display_id, title, description, category, status, queue, task_list_id, project_id, priority, effort, phase, position, owner, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          displayId,
          split.title,
          split.description,
          split.category,
          "pending",
          originalTask.queue,
          originalTask.taskListId || null,
          originalTask.projectId || null,
          originalTask.priority,
          split.estimatedEffort,
          i + 1,
          i,
          "build_agent",
          now,
          now,
        ],
      );

      idMapping.set(i, newId);

      // Create file impacts
      for (const impact of split.impacts) {
        await run(
          `INSERT INTO task_impacts (id, task_id, impact_type, operation, target_path, confidence, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            newId,
            impact.impactType,
            impact.operation,
            impact.targetPath,
            0.8,
            "decomposer",
            now,
            now,
          ],
        );
      }

      // Create acceptance_criteria appendix if we have criteria
      if (split.acceptanceCriteria.length > 0) {
        await run(
          `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
           VALUES (?, ?, 'acceptance_criteria', 'inline', ?, 0, datetime('now'))`,
          [uuidv4(), newId, JSON.stringify(split.acceptanceCriteria)],
        );
      }

      // Create test_context appendix if we have test commands
      if (split.testCommands.length > 0) {
        await run(
          `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
           VALUES (?, ?, 'test_context', 'inline', ?, 0, datetime('now'))`,
          [uuidv4(), newId, JSON.stringify({ commands: split.testCommands })],
        );
      }

      const createdTaskRow = await getOne<TaskRow>(
        "SELECT * FROM tasks WHERE id = ?",
        [newId],
      );
      if (createdTaskRow) {
        createdTasks.push(mapTaskRow(createdTaskRow));
      }
    }

    // Create dependencies between subtasks (based on dependsOnIndex)
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const sourceId = idMapping.get(i);

      // Handle explicit dependsOnIndex
      if (split.dependsOnIndex !== undefined && split.dependsOnIndex >= 0) {
        const targetId = idMapping.get(split.dependsOnIndex);
        if (sourceId && targetId) {
          await run(
            `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              sourceId,
              targetId,
              "depends_on",
              new Date().toISOString(),
            ],
          );
        }
      }

      // Handle legacy dependencies array
      for (const depRef of split.dependencies) {
        const depIndex = parseInt(depRef, 10);
        if (depIndex !== split.dependsOnIndex) {
          const targetId = idMapping.get(depIndex);
          if (sourceId && targetId) {
            // Check if relationship already exists
            const existing = await getOne(
              `SELECT id FROM task_relationships
               WHERE source_task_id = ? AND target_task_id = ? AND relationship_type = 'depends_on'`,
              [sourceId, targetId],
            );

            if (!existing) {
              await run(
                `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  uuidv4(),
                  sourceId,
                  targetId,
                  "depends_on",
                  new Date().toISOString(),
                ],
              );
            }
          }
        }
      }
    }

    // Create parent-child relationships
    for (const createdTask of createdTasks) {
      await run(
        `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          createdTask.id,
          taskId,
          "child_of",
          new Date().toISOString(),
        ],
      );
    }

    // Record state history for decomposition
    await run(
      `INSERT INTO task_state_history (id, task_id, from_status, to_status, changed_by, actor_type, reason, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        taskId,
        originalTask.status,
        "skipped",
        "task-decomposer",
        "system",
        `Decomposed into ${createdTasks.length} subtasks`,
        JSON.stringify({
          subtaskIds: createdTasks.map((t) => t.id),
          decompositionReason: "Task not atomic",
        }),
        new Date().toISOString(),
      ],
    );

    // Mark original task as skipped
    await run(
      `UPDATE tasks SET status = 'skipped', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), taskId],
    );

    await saveDb();

    return createdTasks;
  }

  /**
   * Determine if a task should be decomposed
   */
  async shouldDecompose(
    task: Task,
  ): Promise<{ should: boolean; reasons: string[] }> {
    const atomicity = await atomicityValidator.validate(task);

    return {
      should: !atomicity.isAtomic,
      reasons: atomicity.suggestedSplits || [],
    };
  }

  /**
   * Group impacts by component type
   */
  private groupByComponent(
    impacts: FileImpactRow[],
  ): Record<string, FileImpactRow[]> {
    const groups: Record<string, FileImpactRow[]> = {};

    for (const impact of impacts) {
      const component = this.getComponentFromPath(impact.targetPath);
      if (!groups[component]) {
        groups[component] = [];
      }
      groups[component].push(impact);
    }

    return groups;
  }

  /**
   * Get component type from file path
   */
  private getComponentFromPath(path: string): string {
    const lowerPath = path.toLowerCase();

    if (
      lowerPath.includes("database") ||
      lowerPath.includes("migration") ||
      lowerPath.endsWith(".sql")
    ) {
      return "database";
    }
    if (lowerPath.includes("types/") || lowerPath.includes(".d.ts")) {
      return "types";
    }
    if (lowerPath.includes("routes/") || lowerPath.includes("api/")) {
      return "api";
    }
    if (lowerPath.includes("services/")) {
      return "service";
    }
    if (
      lowerPath.includes("components/") ||
      lowerPath.includes(".tsx") ||
      lowerPath.includes(".jsx")
    ) {
      return "ui";
    }
    if (lowerPath.includes("test") || lowerPath.includes("spec")) {
      return "test";
    }
    return "other";
  }

  /**
   * Get category for component type
   */
  private getCategoryForComponent(component: string): TaskCategory {
    const mapping: Record<string, TaskCategory> = {
      database: "infrastructure",
      types: "task",
      api: "feature",
      service: "feature",
      ui: "design",
      test: "test",
      other: "task",
    };
    return mapping[component] || "task";
  }

  /**
   * Estimate effort based on impact count
   */
  private estimateEffort(impactCount: number): string {
    if (impactCount <= 1) return "trivial";
    if (impactCount <= 3) return "small";
    if (impactCount <= 5) return "medium";
    return "large";
  }

  /**
   * Split text by conjunction words
   */
  private splitByConjunction(title: string, _description?: string): string[] {
    const text = `${title}`;
    const parts = text.split(/\s+and\s+|\s*,\s*(?=and\s+|\w)/i);
    return parts.map((p) => p.trim()).filter((p) => p.length > 5);
  }

  /**
   * Parse numbered list items from description
   */
  private parseNumberedList(
    description: string,
  ): Array<{ number: number; text: string }> {
    const items: Array<{ number: number; text: string }> = [];

    // Match patterns like "1. Some text" or "1) Some text"
    const regex = /^(\d+)[.)]\s+(.+?)$/gm;
    let match;

    while ((match = regex.exec(description)) !== null) {
      items.push({
        number: parseInt(match[1], 10),
        text: match[2].trim(),
      });
    }

    return items;
  }

  /**
   * Group related items by common prefix (e.g., TranscriptWriter tests together)
   */
  private groupRelatedItems(
    items: Array<{ number: number; text: string }>,
  ): Array<Array<{ number: number; text: string }>> {
    const groups: Array<Array<{ number: number; text: string }>> = [];
    const prefixMap = new Map<
      string,
      Array<{ number: number; text: string }>
    >();

    for (const item of items) {
      // Extract the main subject (first word or CamelCase identifier)
      const prefixMatch = item.text.match(/^([A-Z][a-zA-Z]+)/);
      const prefix = prefixMatch ? prefixMatch[1] : "General";

      if (!prefixMap.has(prefix)) {
        prefixMap.set(prefix, []);
      }
      prefixMap.get(prefix)!.push(item);
    }

    // Convert map to array of groups
    for (const [, groupItems] of prefixMap) {
      groups.push(groupItems);
    }

    // Sort groups by first item number to maintain order
    groups.sort((a, b) => a[0].number - b[0].number);

    return groups;
  }

  /**
   * Get a descriptive title for a group of related items
   */
  private getGroupTitle(
    group: Array<{ number: number; text: string }>,
  ): string {
    if (group.length === 0) return "Tests";

    // Extract common prefix
    const firstText = group[0].text;
    const prefixMatch = firstText.match(/^([A-Z][a-zA-Z]+)/);

    if (prefixMatch) {
      return `${prefixMatch[1]} Tests`;
    }

    // Fallback to first few words
    const words = firstText.split(/\s+/).slice(0, 3);
    return words.join(" ");
  }

  /**
   * Find acceptance criteria relevant to a group of items
   */
  private findRelevantAC(
    allAC: string[],
    group: Array<{ number: number; text: string }>,
  ): string[] {
    const relevantAC: string[] = [];

    // Extract keywords from the group
    const keywords = new Set<string>();
    for (const item of group) {
      // Add CamelCase identifiers
      const matches = item.text.match(/[A-Z][a-z]+/g) || [];
      matches.forEach((m) => keywords.add(m.toLowerCase()));

      // Add important words
      const words = item.text.toLowerCase().split(/\s+/);
      words.forEach((w) => {
        if (w.length > 4) keywords.add(w);
      });
    }

    // Find AC that mentions these keywords
    for (const ac of allAC) {
      const acLower = ac.toLowerCase();
      for (const keyword of keywords) {
        if (acLower.includes(keyword)) {
          if (!relevantAC.includes(ac)) {
            relevantAC.push(ac);
          }
          break;
        }
      }
    }

    return relevantAC;
  }
}

// Export singleton instance
export const taskDecomposer = new TaskDecomposer();
export default taskDecomposer;
