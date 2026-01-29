# Build Agent Graph Integration

Modify `agents/build/core.ts`:

## Add Imports

```typescript
import { graphQueryService } from "../../server/services/graph/graph-query-service";
```

## Load Context from Graph

```typescript
/**
 * Load build context from memory graph
 */
private async loadGraphContext(ideaId: string): Promise<BuildContext> {
  const [taskContext, requirements, learnings] = await Promise.all([
    graphQueryService.getTaskContext(ideaId),
    graphQueryService.getSpecRequirements(ideaId),
    graphQueryService.getLearnings(ideaId),
  ]);

  return {
    tasks: taskContext.blocks.map(b => ({
      id: b.id,
      type: b.blockTypes[0] || b.type,
      title: b.title || "",
      content: b.content,
      status: b.properties?.status as string || "todo",
      priority: b.properties?.priority as string || "medium",
    })),
    requirements: requirements.blocks.map(b => ({
      id: b.id,
      content: b.content,
      type: b.blockTypes.includes("constraint") ? "constraint" : "requirement",
    })),
    learnings: learnings.blocks.map(b => ({
      id: b.id,
      content: b.content,
      confidence: b.confidence || 0,
      type: b.blockTypes.includes("pattern") ? "pattern" : "gotcha",
    })),
  };
}
```

## Update Build Execution

```typescript
async execute(buildConfig: BuildConfig): Promise<BuildResult> {
  // Load context from graph
  const graphContext = await this.loadGraphContext(buildConfig.ideaId);

  // Inject learnings into prompts
  const gotchas = graphContext.learnings
    .filter(l => l.type === "gotcha")
    .map(l => `- ${l.content}`)
    .join("\n");

  // Use in code generation prompt
  const prompt = `
    ## Requirements
    ${graphContext.requirements.map(r => `- ${r.content}`).join("\n")}

    ## Known Gotchas (avoid these mistakes)
    ${gotchas}

    ## Task
    ${buildConfig.task}
  `;

  // Continue with existing build logic...
}
```

## Save Learnings to Graph

```typescript
/**
 * Save a learning discovered during build
 */
async saveLearning(ideaId: string, learning: {
  content: string;
  type: "pattern" | "gotcha";
  confidence: number;
  context: string;
}): Promise<void> {
  await graphQueryService.createBlock({
    ideaId,
    type: "learning",
    blockTypes: [learning.type === "pattern" ? "pattern" : "learning"],
    graphMemberships: ["validation"],
    content: learning.content,
    confidence: learning.confidence,
    properties: {
      type: learning.type,
      context: learning.context,
      discovered_at: new Date().toISOString(),
    },
  });
}
```
