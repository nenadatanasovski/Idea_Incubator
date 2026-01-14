/**
 * PRD Coverage Service
 *
 * Calculates and tracks PRD requirement coverage.
 * Part of: Task System V2 Implementation Plan (IMPL-3.5)
 */

import { query, getOne } from '../../database/db.js';
import {
  PrdCoverage,
  PrdRow,
  PrdTaskLinkRow,
} from '../../types/prd.js';

/**
 * PRD Coverage Service class
 */
export class PrdCoverageService {
  /**
   * Calculate coverage for a PRD
   */
  async calculateCoverage(prdId: string): Promise<PrdCoverage> {
    // Get PRD
    const prd = await getOne<PrdRow>(
      'SELECT * FROM prds WHERE id = ?',
      [prdId]
    );

    if (!prd) {
      throw new Error(`PRD ${prdId} not found`);
    }

    const successCriteria: string[] = JSON.parse(prd.success_criteria);
    const constraints: string[] = JSON.parse(prd.constraints);

    // Get linked task lists count
    const taskListCount = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM prd_task_lists WHERE prd_id = ?',
      [prdId]
    );

    // Get linked tasks
    const linkedTasks = await query<PrdTaskLinkRow>(
      'SELECT * FROM prd_tasks WHERE prd_id = ?',
      [prdId]
    );

    // Get completed tasks count
    const completedTasksResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks t
       INNER JOIN prd_tasks pt ON t.id = pt.task_id
       WHERE pt.prd_id = ? AND t.status = 'completed'`,
      [prdId]
    );

    // Calculate which success criteria are covered
    const coveredCriteria = new Set<number>();
    for (const link of linkedTasks) {
      if (link.requirement_ref?.startsWith('success_criteria[')) {
        const match = link.requirement_ref.match(/success_criteria\[(\d+)\]/);
        if (match) {
          coveredCriteria.add(parseInt(match[1], 10));
        }
      }
    }

    // Calculate which constraints are verified (tasks with 'tests' link type)
    const verifiedConstraints = new Set<number>();
    for (const link of linkedTasks) {
      if (link.link_type === 'tests' && link.requirement_ref?.startsWith('constraints[')) {
        const match = link.requirement_ref.match(/constraints\[(\d+)\]/);
        if (match) {
          verifiedConstraints.add(parseInt(match[1], 10));
        }
      }
    }

    const totalRequirements = successCriteria.length + constraints.length;
    const coveredRequirements = coveredCriteria.size + verifiedConstraints.size;
    const coveragePercent = totalRequirements > 0
      ? Math.round((coveredRequirements / totalRequirements) * 100)
      : 100;

    return {
      prdId,
      totalRequirements,
      coveredRequirements,
      coveragePercent,
      bySection: {
        successCriteria: {
          total: successCriteria.length,
          covered: coveredCriteria.size,
        },
        constraints: {
          total: constraints.length,
          verified: verifiedConstraints.size,
        },
      },
      linkedTaskLists: taskListCount?.count || 0,
      linkedTasks: linkedTasks.length,
      completedTasks: completedTasksResult?.count || 0,
    };
  }

  /**
   * Get coverage by section
   */
  async getCoverageBySection(prdId: string): Promise<Record<string, number>> {
    const coverage = await this.calculateCoverage(prdId);

    const scCoverage = coverage.bySection.successCriteria.total > 0
      ? Math.round((coverage.bySection.successCriteria.covered / coverage.bySection.successCriteria.total) * 100)
      : 100;

    const constraintsCoverage = coverage.bySection.constraints.total > 0
      ? Math.round((coverage.bySection.constraints.verified / coverage.bySection.constraints.total) * 100)
      : 100;

    return {
      successCriteria: scCoverage,
      constraints: constraintsCoverage,
      overall: coverage.coveragePercent,
    };
  }

  /**
   * Get uncovered requirements
   */
  async getUncoveredRequirements(prdId: string): Promise<string[]> {
    const prd = await getOne<PrdRow>(
      'SELECT * FROM prds WHERE id = ?',
      [prdId]
    );

    if (!prd) {
      throw new Error(`PRD ${prdId} not found`);
    }

    const successCriteria: string[] = JSON.parse(prd.success_criteria);
    const constraints: string[] = JSON.parse(prd.constraints);

    // Get linked requirements
    const linkedTasks = await query<PrdTaskLinkRow>(
      'SELECT requirement_ref FROM prd_tasks WHERE prd_id = ? AND requirement_ref IS NOT NULL',
      [prdId]
    );
    const linkedRefs = new Set(linkedTasks.map(lt => lt.requirement_ref));

    const uncovered: string[] = [];

    // Check success criteria
    for (let i = 0; i < successCriteria.length; i++) {
      const ref = `success_criteria[${i}]`;
      if (!linkedRefs.has(ref)) {
        uncovered.push(`Success Criteria ${i + 1}: ${successCriteria[i]}`);
      }
    }

    // Check constraints
    for (let i = 0; i < constraints.length; i++) {
      const ref = `constraints[${i}]`;
      if (!linkedRefs.has(ref)) {
        uncovered.push(`Constraint ${i + 1}: ${constraints[i]}`);
      }
    }

    return uncovered;
  }

  /**
   * Get requirement coverage details
   */
  async getRequirementCoverage(
    prdId: string,
    requirementRef: string
  ): Promise<{ covered: boolean; tasks: string[] }> {
    const linkedTasks = await query<{ task_id: string }>(
      'SELECT task_id FROM prd_tasks WHERE prd_id = ? AND requirement_ref = ?',
      [prdId, requirementRef]
    );

    return {
      covered: linkedTasks.length > 0,
      tasks: linkedTasks.map(lt => lt.task_id),
    };
  }

  /**
   * Get completion progress
   */
  async getCompletionProgress(prdId: string): Promise<{ total: number; completed: number; percentage: number }> {
    const linkedTasksResult = await getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM prd_tasks WHERE prd_id = ?',
      [prdId]
    );

    const completedTasksResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks t
       INNER JOIN prd_tasks pt ON t.id = pt.task_id
       WHERE pt.prd_id = ? AND t.status = 'completed'`,
      [prdId]
    );

    const total = linkedTasksResult?.count || 0;
    const completed = completedTasksResult?.count || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 100;

    return { total, completed, percentage };
  }

  /**
   * Check if coverage meets threshold
   */
  async checkCoverageThreshold(prdId: string, threshold: number): Promise<boolean> {
    const coverage = await this.calculateCoverage(prdId);
    return coverage.coveragePercent >= threshold;
  }
}

// Export singleton instance
export const prdCoverageService = new PrdCoverageService();
export default prdCoverageService;
