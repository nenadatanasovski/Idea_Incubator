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
    const successCriteria: string[] = JSON.parse(prd.success_criteria || "[]");
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
          itemContent = sc[itemIndex] || "";
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

    // Check success criteria
    const successCriteria: string[] = JSON.parse(prd.success_criteria || "[]");
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
}

// Export singleton instance
export const traceabilityService = new TraceabilityService();
export default traceabilityService;
