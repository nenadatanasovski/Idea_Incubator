/**
 * Traceability Service
 *
 * Provides traceability analysis between PRD requirements and tasks.
 * Calculates spec coverage, finds orphan tasks, and identifies gaps.
 */

import { query, getOne } from "../../database/db.js";
import { PrdRow, PrdTaskLinkRow } from "../../types/prd.js";
import type {
  ProjectTraceability,
  SpecSectionCoverage,
  SpecItemCoverage,
  LinkedTask,
  OrphanTask,
  CoverageGap,
  TaskSpecLink,
  CoverageStats,
  TraceabilityLinkType,
  TraceabilityHierarchy,
  HierarchyNode,
} from "../../types/traceability.js";
import type { TaskStatus } from "../../types/task-agent.js";

interface TaskRow {
  id: string;
  display_id: string;
  title: string;
  status: string;
  category: string;
  created_at: string;
  project_id: string | null;
}

/**
 * TraceabilityService class
 */
export class TraceabilityService {
  /**
   * Get complete spec coverage for a project
   */
  async getSpecCoverage(
    projectId: string,
  ): Promise<ProjectTraceability | null> {
    // Get the primary PRD for this project
    const prd = await getOne<PrdRow>(
      "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
      [projectId],
    );

    if (!prd) {
      // No PRD for this project - return empty traceability
      return null;
    }

    // Parse PRD arrays
    // Success criteria can be either strings or objects with {criterion, metric, target}
    const rawSuccessCriteria = JSON.parse(prd.success_criteria || "[]");
    const successCriteria: string[] = rawSuccessCriteria.map(
      (
        item: string | { criterion: string; metric: string; target: string },
      ) => {
        if (typeof item === "string") {
          return item;
        }
        // Convert object to readable string
        return `${item.criterion} (${item.metric}: ${item.target})`;
      },
    );
    const constraints: string[] = JSON.parse(prd.constraints || "[]");

    // Get all task links for this PRD
    const taskLinks = await query<PrdTaskLinkRow & { task_id: string }>(
      `SELECT pt.*, t.id as task_id, t.display_id, t.title, t.status
       FROM prd_tasks pt
       INNER JOIN tasks t ON pt.task_id = t.id
       WHERE pt.prd_id = ?`,
      [prd.id],
    );

    // Build linked tasks map by requirement ref
    const linksByRef = new Map<string, LinkedTask[]>();
    for (const link of taskLinks) {
      if (!link.requirement_ref) continue;
      const ref = link.requirement_ref;
      if (!linksByRef.has(ref)) {
        linksByRef.set(ref, []);
      }
      linksByRef.get(ref)!.push({
        id: link.task_id,
        displayId:
          (link as unknown as { display_id: string }).display_id ||
          link.task_id,
        title: (link as unknown as { title: string }).title || "Untitled",
        status: (link as unknown as { status: string }).status as TaskStatus,
        linkType: link.link_type as TraceabilityLinkType,
      });
    }

    // Build success criteria coverage
    const scItems: SpecItemCoverage[] = successCriteria.map((content, idx) => {
      const ref = `success_criteria[${idx}]`;
      const linked = linksByRef.get(ref) || [];
      return {
        index: idx,
        content,
        linkedTasks: linked,
        isCovered: linked.length > 0,
      };
    });

    const scCovered = scItems.filter((i) => i.isCovered).length;
    const scSection: SpecSectionCoverage = {
      sectionType: "success_criteria",
      sectionTitle: "Success Criteria",
      totalItems: successCriteria.length,
      coveredItems: scCovered,
      coveragePercentage:
        successCriteria.length > 0
          ? Math.round((scCovered / successCriteria.length) * 100)
          : 100,
      items: scItems,
    };

    // Build constraints coverage
    const constraintItems: SpecItemCoverage[] = constraints.map(
      (content, idx) => {
        const ref = `constraints[${idx}]`;
        const linked = linksByRef.get(ref) || [];
        return {
          index: idx,
          content,
          linkedTasks: linked,
          isCovered: linked.length > 0,
        };
      },
    );

    const constraintsCovered = constraintItems.filter(
      (i) => i.isCovered,
    ).length;
    const constraintsSection: SpecSectionCoverage = {
      sectionType: "constraints",
      sectionTitle: "Constraints",
      totalItems: constraints.length,
      coveredItems: constraintsCovered,
      coveragePercentage:
        constraints.length > 0
          ? Math.round((constraintsCovered / constraints.length) * 100)
          : 100,
      items: constraintItems,
    };

    // Calculate overall coverage
    const totalItems = successCriteria.length + constraints.length;
    const coveredItems = scCovered + constraintsCovered;
    const overallCoverage =
      totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 100;

    // Get orphan count
    const orphanCount = await this.getOrphanTaskCount(projectId);

    // Calculate gap count
    const gapCount = totalItems - coveredItems;

    return {
      projectId,
      prdId: prd.id,
      prdTitle: prd.title,
      sections: [scSection, constraintsSection],
      overallCoverage,
      orphanTaskCount: orphanCount,
      gapCount,
    };
  }

  /**
   * Get tasks linked to a specific task's spec requirements
   */
  async getTaskSpecLinks(taskId: string): Promise<TaskSpecLink[]> {
    const links = await query<
      PrdTaskLinkRow & {
        prd_title: string;
        success_criteria: string;
        constraints: string;
      }
    >(
      `SELECT pt.*, p.title as prd_title, p.success_criteria, p.constraints
       FROM prd_tasks pt
       INNER JOIN prds p ON pt.prd_id = p.id
       WHERE pt.task_id = ?`,
      [taskId],
    );

    return links.map((link) => {
      const ref = link.requirement_ref || "";
      let sectionType = "";
      let itemIndex = 0;
      let itemContent = "";

      // Parse requirement ref
      const match = ref.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        sectionType = match[1];
        itemIndex = parseInt(match[2], 10);

        // Get content from appropriate section
        if (sectionType === "success_criteria") {
          const sc = JSON.parse(link.success_criteria || "[]");
          const item = sc[itemIndex];
          if (typeof item === "string") {
            itemContent = item;
          } else if (item) {
            // Handle object format {criterion, metric, target}
            itemContent = `${item.criterion} (${item.metric}: ${item.target})`;
          }
        } else if (sectionType === "constraints") {
          const constraints = JSON.parse(link.constraints || "[]");
          itemContent = constraints[itemIndex] || "";
        }
      }

      return {
        id: link.id,
        taskId: link.task_id,
        prdId: link.prd_id,
        prdTitle: link.prd_title,
        requirementRef: ref,
        sectionType,
        itemIndex,
        itemContent,
        linkType: link.link_type as TraceabilityLinkType,
        createdAt: link.created_at,
      };
    });
  }

  /**
   * Get orphan tasks (tasks with no PRD links) for a project
   */
  async getOrphanTasks(projectId: string): Promise<OrphanTask[]> {
    const orphans = await query<TaskRow>(
      `SELECT t.*
       FROM tasks t
       WHERE t.project_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM prd_tasks pt WHERE pt.task_id = t.id
         )
       ORDER BY t.created_at DESC`,
      [projectId],
    );

    return orphans.map((t) => ({
      id: t.id,
      displayId: t.display_id || t.id,
      title: t.title,
      status: t.status as TaskStatus,
      category: t.category,
      createdAt: t.created_at,
    }));
  }

  /**
   * Get orphan task count for a project
   */
  async getOrphanTaskCount(projectId: string): Promise<number> {
    const result = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM tasks t
       WHERE t.project_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM prd_tasks pt WHERE pt.task_id = t.id
         )`,
      [projectId],
    );
    return result?.count || 0;
  }

  /**
   * Get coverage gaps (spec items with no linked tasks)
   *
   * NOTE: Only analyzes `success_criteria` and `constraints` for task coverage.
   * The `business_context` field is intentionally NOT analyzed because it contains
   * non-functional items like budget constraints, resource limitations, and business KPIs
   * that don't translate to implementation tasks.
   */
  async getCoverageGaps(projectId: string): Promise<CoverageGap[]> {
    // Get the primary PRD for this project
    const prd = await getOne<PrdRow>(
      "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
      [projectId],
    );

    if (!prd) {
      return [];
    }

    // Get all linked requirement refs for this PRD
    const links = await query<{ requirement_ref: string }>(
      "SELECT DISTINCT requirement_ref FROM prd_tasks WHERE prd_id = ? AND requirement_ref IS NOT NULL",
      [prd.id],
    );
    const linkedRefs = new Set(links.map((l) => l.requirement_ref));

    const gaps: CoverageGap[] = [];

    // Check success criteria (can be strings or objects)
    const rawSuccessCriteria = JSON.parse(prd.success_criteria || "[]");
    const successCriteria: string[] = rawSuccessCriteria.map(
      (
        item: string | { criterion: string; metric: string; target: string },
      ) => {
        if (typeof item === "string") {
          return item;
        }
        return `${item.criterion} (${item.metric}: ${item.target})`;
      },
    );
    for (let i = 0; i < successCriteria.length; i++) {
      const ref = `success_criteria[${i}]`;
      if (!linkedRefs.has(ref)) {
        gaps.push({
          prdId: prd.id,
          prdTitle: prd.title,
          sectionType: "success_criteria",
          sectionTitle: "Success Criteria",
          itemIndex: i,
          itemContent: successCriteria[i],
          severity: "high",
        });
      }
    }

    // Check constraints
    const constraints: string[] = JSON.parse(prd.constraints || "[]");
    for (let i = 0; i < constraints.length; i++) {
      const ref = `constraints[${i}]`;
      if (!linkedRefs.has(ref)) {
        gaps.push({
          prdId: prd.id,
          prdTitle: prd.title,
          sectionType: "constraints",
          sectionTitle: "Constraints",
          itemIndex: i,
          itemContent: constraints[i],
          severity: "medium",
        });
      }
    }

    return gaps;
  }

  /**
   * Get tasks linked to a specific requirement in a PRD
   */
  async getRequirementTasks(
    prdId: string,
    requirementRef: string,
  ): Promise<LinkedTask[]> {
    const taskLinks = await query<{
      task_id: string;
      display_id: string;
      title: string;
      status: string;
      link_type: string;
    }>(
      `SELECT pt.link_type, t.id as task_id, t.display_id, t.title, t.status
       FROM prd_tasks pt
       INNER JOIN tasks t ON pt.task_id = t.id
       WHERE pt.prd_id = ? AND pt.requirement_ref = ?`,
      [prdId, requirementRef],
    );

    return taskLinks.map((link) => ({
      id: link.task_id,
      displayId: link.display_id || link.task_id,
      title: link.title || "Untitled",
      status: link.status as TaskStatus,
      linkType: link.link_type as TraceabilityLinkType,
    }));
  }

  /**
   * Get coverage statistics summary for a project
   */
  async getCoverageStats(projectId: string): Promise<CoverageStats | null> {
    const traceability = await this.getSpecCoverage(projectId);
    if (!traceability) {
      return null;
    }

    let totalRequirements = 0;
    let coveredRequirements = 0;

    for (const section of traceability.sections) {
      totalRequirements += section.totalItems;
      coveredRequirements += section.coveredItems;
    }

    return {
      overallCoverage: traceability.overallCoverage,
      coveredRequirements,
      totalRequirements,
      orphanTaskCount: traceability.orphanTaskCount,
      gapCount: traceability.gapCount,
    };
  }

  /**
   * Get hierarchical traceability data for tree view
   */
  async getHierarchy(projectId: string): Promise<TraceabilityHierarchy | null> {
    // Get PRD
    const prd = await getOne<PrdRow>(
      "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
      [projectId],
    );

    if (!prd) return null;

    // Get all task links with task and task list details
    const taskLinks = await query<{
      task_id: string;
      display_id: string;
      title: string;
      status: string;
      task_list_id: string | null;
      task_list_name: string | null;
      requirement_ref: string;
      link_type: string;
    }>(
      `
      SELECT
        pt.task_id,
        pt.requirement_ref,
        pt.link_type,
        t.display_id,
        t.title,
        t.status,
        t.task_list_id,
        tl.name as task_list_name
      FROM prd_tasks pt
      INNER JOIN tasks t ON pt.task_id = t.id
      LEFT JOIN task_lists_v2 tl ON t.task_list_id = tl.id
      WHERE pt.prd_id = ?
    `,
      [prd.id],
    );

    // Parse PRD arrays
    const rawSuccessCriteria = JSON.parse(prd.success_criteria || "[]");
    const successCriteria: string[] = rawSuccessCriteria.map(
      (item: string | { criterion: string }) =>
        typeof item === "string" ? item : item.criterion,
    );
    const constraints: string[] = JSON.parse(prd.constraints || "[]");

    // Build hierarchy root
    const root: HierarchyNode = {
      id: prd.id,
      type: "prd",
      label: prd.title,
      children: [],
      metadata: { taskCount: taskLinks.length },
    };

    // Build sections
    const sections = [
      {
        type: "success_criteria",
        title: "Success Criteria",
        items: successCriteria,
      },
      { type: "constraints", title: "Constraints", items: constraints },
    ];

    for (const section of sections) {
      const sectionNode: HierarchyNode = {
        id: `section-${section.type}`,
        type: "section",
        label: section.title,
        children: [],
        metadata: { taskCount: 0, coveredCount: 0 },
      };

      // Build requirements
      for (let i = 0; i < section.items.length; i++) {
        const ref = `${section.type}[${i}]`;
        const linkedTasks = taskLinks.filter((t) => t.requirement_ref === ref);

        const requirementNode: HierarchyNode = {
          id: ref,
          type: "requirement",
          label: section.items[i],
          isCovered: linkedTasks.length > 0,
          children: [],
          metadata: {
            requirementRef: ref,
            taskCount: linkedTasks.length,
          },
        };

        // Group tasks by task list
        const tasksByList = new Map<string, typeof taskLinks>();
        for (const task of linkedTasks) {
          const listId = task.task_list_id || "ungrouped";
          if (!tasksByList.has(listId)) {
            tasksByList.set(listId, []);
          }
          tasksByList.get(listId)!.push(task);
        }

        // Build task list nodes
        for (const [listId, tasks] of tasksByList) {
          if (listId === "ungrouped" && tasks.length > 0) {
            // Add tasks directly without list grouping
            for (const task of tasks) {
              requirementNode.children.push({
                id: task.task_id,
                type: "task",
                label: task.title,
                status: task.status as TaskStatus,
                linkType: task.link_type as TraceabilityLinkType,
                children: [],
                metadata: { displayId: task.display_id },
              });
            }
          } else if (tasks.length > 0) {
            const listNode: HierarchyNode = {
              id: listId,
              type: "task_list",
              label: tasks[0].task_list_name || "Unknown List",
              children: tasks.map((task) => ({
                id: task.task_id,
                type: "task" as const,
                label: task.title,
                status: task.status as TaskStatus,
                linkType: task.link_type as TraceabilityLinkType,
                children: [],
                metadata: { displayId: task.display_id },
              })),
              metadata: { taskCount: tasks.length },
            };
            requirementNode.children.push(listNode);
          }
        }

        sectionNode.children.push(requirementNode);
        sectionNode.metadata!.taskCount! += linkedTasks.length;
        if (linkedTasks.length > 0) {
          sectionNode.metadata!.coveredCount!++;
        }
      }

      // Calculate section coverage
      sectionNode.coverage =
        section.items.length > 0
          ? Math.round(
              (sectionNode.metadata!.coveredCount! / section.items.length) *
                100,
            )
          : 100;

      root.children.push(sectionNode);
    }

    // Get stats
    const orphanCount = await this.getOrphanTaskCount(projectId);
    const totalReqs = successCriteria.length + constraints.length;
    const coveredReqs = root.children.reduce(
      (sum, s) => sum + (s.metadata?.coveredCount || 0),
      0,
    );

    return {
      projectId,
      prdId: prd.id,
      prdTitle: prd.title,
      root,
      stats: {
        totalRequirements: totalReqs,
        coveredRequirements: coveredReqs,
        totalTasks: taskLinks.length,
        orphanTasks: orphanCount,
      },
    };
  }
}

// Export singleton instance
export const traceabilityService = new TraceabilityService();
export default traceabilityService;
