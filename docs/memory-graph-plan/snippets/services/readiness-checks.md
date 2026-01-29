# Readiness Checks

Create `server/services/graph/readiness-checks.ts`:

```typescript
/**
 * Readiness Checks
 *
 * Validates graph completeness for various stages.
 */

import { graphQueryService } from "./graph-query-service";

export interface ReadinessResult {
  ready: boolean;
  score: number;
  missing: Array<{
    item: string;
    description: string;
    importance: "critical" | "important" | "nice_to_have";
  }>;
  recommendations: string[];
}

/**
 * Check if ready for spec generation
 */
export async function checkSpecReadiness(
  ideaId: string,
): Promise<ReadinessResult> {
  const result = await graphQueryService.query({
    ideaId,
    graphMemberships: ["problem", "solution", "spec", "customer"],
    includeStats: true,
  });

  const missing: ReadinessResult["missing"] = [];
  const recommendations: string[] = [];

  // Critical: Problem definition
  if (!result.stats?.byGraphMembership.problem) {
    missing.push({
      item: "Problem Definition",
      description: "No blocks defining the problem space",
      importance: "critical",
    });
    recommendations.push(
      "Add blocks describing the core problem you're solving",
    );
  }

  // Critical: Solution approach
  if (!result.stats?.byGraphMembership.solution) {
    missing.push({
      item: "Solution Approach",
      description: "No blocks describing the solution",
      importance: "critical",
    });
    recommendations.push("Add blocks describing your solution approach");
  }

  // Important: Requirements
  if (!result.stats?.byBlockType.requirement) {
    missing.push({
      item: "Requirements",
      description: "No requirement blocks defined",
      importance: "important",
    });
    recommendations.push("Add specific requirements for the solution");
  }

  // Important: Customer understanding
  if (!result.stats?.byGraphMembership.customer) {
    missing.push({
      item: "Customer Understanding",
      description: "No customer profile blocks",
      importance: "important",
    });
    recommendations.push("Add customer personas or target user descriptions");
  }

  // Nice to have: Constraints
  if (!result.stats?.byBlockType.constraint) {
    missing.push({
      item: "Constraints",
      description: "No constraints documented",
      importance: "nice_to_have",
    });
  }

  const criticalMissing = missing.filter(
    (m) => m.importance === "critical",
  ).length;
  const importantMissing = missing.filter(
    (m) => m.importance === "important",
  ).length;

  const score = Math.max(0, 100 - criticalMissing * 30 - importantMissing * 15);

  return {
    ready: criticalMissing === 0,
    score,
    missing,
    recommendations,
  };
}

/**
 * Check if ready for marketing/launch
 */
export async function checkLaunchReadiness(
  ideaId: string,
): Promise<ReadinessResult> {
  const result = await graphQueryService.query({
    ideaId,
    graphMemberships: ["marketing", "customer", "distribution", "competition"],
    includeStats: true,
  });

  const missing: ReadinessResult["missing"] = [];
  const recommendations: string[] = [];

  // Critical: Customer personas
  if (!result.stats?.byBlockType.persona) {
    missing.push({
      item: "Customer Personas",
      description: "No customer personas defined",
      importance: "critical",
    });
    recommendations.push("Create detailed customer personas for targeting");
  }

  // Critical: Positioning
  const hasPositioning = result.blocks.some(
    (b) =>
      b.content.toLowerCase().includes("positioning") ||
      b.properties?.type === "positioning",
  );
  if (!hasPositioning) {
    missing.push({
      item: "Positioning Statement",
      description: "No clear positioning defined",
      importance: "critical",
    });
    recommendations.push("Define your market positioning vs competitors");
  }

  // Important: Distribution channels
  if (!result.stats?.byGraphMembership.distribution) {
    missing.push({
      item: "Distribution Channels",
      description: "No distribution strategy blocks",
      importance: "important",
    });
    recommendations.push("Identify primary distribution channels");
  }

  // Important: Competitive differentiation
  const hasDifferentiation = result.blocks.some(
    (b) =>
      b.content.toLowerCase().includes("differentiat") ||
      b.properties?.type === "differentiation",
  );
  if (!hasDifferentiation) {
    missing.push({
      item: "Competitive Differentiation",
      description: "No clear differentiation from competitors",
      importance: "important",
    });
    recommendations.push("Document what makes you different from competitors");
  }

  // Nice to have: Messaging
  const hasMessaging = result.blocks.some(
    (b) =>
      b.properties?.type === "messaging" ||
      b.title?.toLowerCase().includes("messaging"),
  );
  if (!hasMessaging) {
    missing.push({
      item: "Key Messaging",
      description: "No marketing messages defined",
      importance: "nice_to_have",
    });
  }

  const criticalMissing = missing.filter(
    (m) => m.importance === "critical",
  ).length;
  const importantMissing = missing.filter(
    (m) => m.importance === "important",
  ).length;

  const score = Math.max(0, 100 - criticalMissing * 30 - importantMissing * 15);

  return {
    ready: criticalMissing === 0,
    score,
    missing,
    recommendations,
  };
}

/**
 * Check if ready for build phase
 */
export async function checkBuildReadiness(
  ideaId: string,
): Promise<ReadinessResult> {
  const [specReadiness, taskBlocks] = await Promise.all([
    checkSpecReadiness(ideaId),
    graphQueryService.query({
      ideaId,
      graphMemberships: ["tasks"],
      blockTypes: ["epic", "story", "task"],
    }),
  ]);

  const missing: ReadinessResult["missing"] = [];
  const recommendations: string[] = [];

  // Must have spec ready
  if (!specReadiness.ready) {
    missing.push({
      item: "Specification",
      description:
        "Spec not ready: " +
        specReadiness.missing.map((m) => m.item).join(", "),
      importance: "critical",
    });
    recommendations.push("Complete spec generation first");
  }

  // Should have tasks defined
  if (taskBlocks.blocks.length === 0) {
    missing.push({
      item: "Task Breakdown",
      description: "No tasks defined for build",
      importance: "important",
    });
    recommendations.push("Break down spec into epics and stories");
  }

  const criticalMissing = missing.filter(
    (m) => m.importance === "critical",
  ).length;
  const importantMissing = missing.filter(
    (m) => m.importance === "important",
  ).length;

  const score = Math.max(0, 100 - criticalMissing * 30 - importantMissing * 15);

  return {
    ready: criticalMissing === 0,
    score,
    missing,
    recommendations,
  };
}
```
