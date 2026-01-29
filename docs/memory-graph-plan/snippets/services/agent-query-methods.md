# Agent-Specific Query Methods

Add these methods to `GraphQueryService` in `server/services/graph/graph-query-service.ts`:

## Ideation Agent Queries

```typescript
/**
 * Get user profile blocks for personalization
 */
async getUserProfile(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["user"],
    blockTypes: ["fact", "constraint", "insight"],
    statuses: ["active", "validated"],
    orderBy: "confidence",
    order: "desc",
  });
}

/**
 * Get problem/solution understanding
 */
async getProblemSolution(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["problem", "solution"],
    includeLinkedBlocks: true,
    linkTypes: ["addresses", "creates", "requires"],
    statuses: ["active", "validated"],
  });
}

/**
 * Get market and competition context
 */
async getMarketContext(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["market", "competition"],
    blockTypes: ["fact", "insight", "assumption"],
    minConfidence: 0.5,
    statuses: ["active", "validated"],
  });
}
```

## Spec Agent Queries

```typescript
/**
 * Get all requirements and constraints for spec generation
 */
async getSpecRequirements(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["spec"],
    blockTypes: ["requirement", "constraint", "decision"],
    statuses: ["active", "validated"],
    includeLinkedBlocks: true,
    linkTypes: ["requires", "constrained_by", "depends_on"],
  });
}

/**
 * Get validation evidence for spec
 */
async getValidationEvidence(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["validation"],
    blockTypes: ["fact", "evaluation"],
    includeSources: true,
  });
}
```

## Build Agent Queries

```typescript
/**
 * Get task context for build agent
 */
async getTaskContext(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["tasks"],
    blockTypes: ["epic", "story", "task", "bug"],
    statuses: ["active"], // Only active tasks
    orderBy: "created_at",
    order: "asc",
  });
}

/**
 * Get requirements relevant to a specific task
 */
async getTaskRequirements(ideaId: string, taskBlockId: string): Promise<GraphQueryResult> {
  // First get links from the task
  const links = await db
    .select()
    .from(memoryLinks)
    .where(
      and(
        eq(memoryLinks.sourceBlockId, taskBlockId),
        inArray(memoryLinks.linkType, ["requires", "addresses", "depends_on"])
      )
    );

  const linkedBlockIds = links.map(l => l.targetBlockId);

  if (!linkedBlockIds.length) {
    return { blocks: [], links: [], pagination: { total: 0, limit: 0, offset: 0, hasMore: false } };
  }

  // Fetch the linked blocks
  const blocks = await db
    .select()
    .from(memoryBlocks)
    .where(inArray(memoryBlocks.id, linkedBlockIds));

  return {
    blocks: blocks.map(b => ({
      id: b.id,
      type: b.type,
      blockTypes: [],
      graphMemberships: [],
      title: b.title,
      content: b.content,
      properties: b.properties ? JSON.parse(b.properties) : {},
      status: b.status as any,
      confidence: b.confidence,
      abstractionLevel: b.abstractionLevel as any,
      createdAt: b.createdAt || "",
      updatedAt: b.updatedAt || "",
    })),
    links: [],
    pagination: { total: blocks.length, limit: blocks.length, offset: 0, hasMore: false },
  };
}

/**
 * Get gotchas and patterns from SIA
 */
async getLearnings(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    blockTypes: ["learning", "pattern"],
    minConfidence: 0.7,
    statuses: ["active", "validated"],
    orderBy: "confidence",
    order: "desc",
    limit: 20,
  });
}
```

## SIA Agent Queries

```typescript
/**
 * Get execution context for learning extraction
 */
async getExecutionContext(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["tasks", "spec"],
    blockTypes: ["task", "bug", "decision"],
    includeSources: true,
  });
}

/**
 * Check for existing learnings (for duplicate detection)
 */
async getExistingLearnings(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    blockTypes: ["learning", "pattern"],
  });
}
```

## Marketing Agent Queries

```typescript
/**
 * Get positioning and marketing context
 */
async getMarketingContext(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["marketing", "competition", "customer"],
    blockTypes: ["insight", "fact", "persona", "decision"],
  });
}

/**
 * Get distribution strategy blocks
 */
async getDistributionStrategy(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["distribution", "marketing"],
    blockTypes: ["decision", "option", "action"],
  });
}

/**
 * Get customer personas
 */
async getCustomerPersonas(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    graphMemberships: ["customer"],
    blockTypes: ["persona"],
    statuses: ["active", "validated"],
  });
}
```

## Evaluation Queries

```typescript
/**
 * Get all evaluations for an idea
 */
async getEvaluations(ideaId: string): Promise<GraphQueryResult> {
  return this.query({
    ideaId,
    blockTypes: ["evaluation"],
    includeSources: true,
    orderBy: "created_at",
    order: "desc",
  });
}
```

## Readiness Check Methods

```typescript
/**
 * Check spec generation readiness
 */
async checkSpecReadiness(ideaId: string): Promise<{
  ready: boolean;
  score: number;
  missing: string[];
}> {
  const result = await this.query({
    ideaId,
    graphMemberships: ["problem", "solution", "spec"],
    includeStats: true,
  });

  const missing: string[] = [];
  const stats = result.stats!;

  // Check required elements
  if (!stats.byGraphMembership.problem) {
    missing.push("Problem definition blocks");
  }
  if (!stats.byGraphMembership.solution) {
    missing.push("Solution description blocks");
  }
  if (!stats.byBlockType.requirement) {
    missing.push("Requirements");
  }

  const score = Math.max(0, 100 - (missing.length * 25));

  return {
    ready: missing.length === 0,
    score,
    missing,
  };
}

/**
 * Check marketing/launch readiness
 */
async checkLaunchReadiness(ideaId: string): Promise<{
  ready: boolean;
  score: number;
  missing: string[];
}> {
  const result = await this.query({
    ideaId,
    graphMemberships: ["marketing", "customer", "distribution"],
    includeStats: true,
  });

  const missing: string[] = [];
  const stats = result.stats!;

  if (!stats.byBlockType.persona) {
    missing.push("Customer personas");
  }
  if (!stats.byGraphMembership.marketing) {
    missing.push("Marketing strategy blocks");
  }
  if (!stats.byGraphMembership.distribution) {
    missing.push("Distribution channel blocks");
  }

  const score = Math.max(0, 100 - (missing.length * 25));

  return {
    ready: missing.length === 0,
    score,
    missing,
  };
}
```
