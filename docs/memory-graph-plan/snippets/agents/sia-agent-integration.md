# SIA Agent Graph Integration

Modify `agents/sia/knowledge-writer.ts`:

```typescript
import { graphQueryService } from "../../server/services/graph/graph-query-service";

export class KnowledgeWriter {
  /**
   * Write a learning to the memory graph
   */
  async writeLearning(
    ideaId: string,
    learning: ExtractedLearning,
  ): Promise<string> {
    // Check for duplicates first
    const existing = await graphQueryService.getExistingLearnings(ideaId);

    const isDuplicate = existing.blocks.some(
      (b) => this.calculateSimilarity(b.content, learning.content) > 0.8,
    );

    if (isDuplicate) {
      // Update confidence of existing instead
      const match = existing.blocks.find(
        (b) => this.calculateSimilarity(b.content, learning.content) > 0.8,
      );
      if (match) {
        await this.incrementConfidence(match.id);
        return match.id;
      }
    }

    // Create new learning block
    const blockId = await graphQueryService.createBlock({
      ideaId,
      type: learning.type === "gotcha" ? "learning" : "pattern",
      blockTypes: [learning.type === "gotcha" ? "learning" : "pattern"],
      graphMemberships: ["validation"],
      title: learning.title,
      content: learning.content,
      confidence: learning.confidence,
      properties: {
        type: learning.type,
        file_patterns: learning.filePatterns,
        action_types: learning.actionTypes,
        source_execution_id: learning.sourceExecutionId,
        occurrences: 1,
        discovered_at: new Date().toISOString(),
      },
    });

    return blockId;
  }

  /**
   * Increment confidence when same learning is discovered again
   */
  private async incrementConfidence(blockId: string): Promise<void> {
    const block = await graphQueryService.getBlockById(blockId);
    if (!block) return;

    const occurrences = ((block.properties?.occurrences as number) || 1) + 1;
    const newConfidence = Math.min(1.0, (block.confidence || 0.5) + 0.1);

    await graphQueryService.updateBlock(blockId, {
      confidence: newConfidence,
      properties: {
        ...block.properties,
        occurrences,
        last_seen: new Date().toISOString(),
      },
    });
  }

  private calculateSimilarity(a: string, b: string): number {
    // Simple Jaccard similarity
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
  }
}
```

## Update SIA Main Logic

Modify `agents/sia/index.ts`:

```typescript
async analyzeAndExtract(executionId: string, ideaId: string): Promise<SIAResult> {
  // Get execution context from graph
  const context = await graphQueryService.getExecutionContext(ideaId);

  // Get existing learnings to avoid duplicates
  const existingLearnings = await graphQueryService.getExistingLearnings(ideaId);

  // Extract new learnings
  const newLearnings = await this.extractor.extract(context, existingLearnings);

  // Write to graph
  const writer = new KnowledgeWriter();
  const writtenIds: string[] = [];

  for (const learning of newLearnings) {
    const id = await writer.writeLearning(ideaId, learning);
    writtenIds.push(id);
  }

  return {
    learningsExtracted: newLearnings.length,
    learningsWritten: writtenIds.length,
    blockIds: writtenIds,
  };
}
```
