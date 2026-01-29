# Source Content Loader

Create `server/services/graph/source-loader.ts`:

```typescript
/**
 * SourceLoader
 *
 * Lazily loads full content for block sources.
 * Sources can come from: conversations, artifacts, memory files, or external URLs.
 */

import { db } from "../../db";
import { ideationMessages, artifacts } from "../../../schema";
import { eq, inArray } from "drizzle-orm";

export interface LoadedSource {
  id: string;
  blockId: string;
  sourceType: string;
  sourceId: string;
  relevanceScore: number | null;
  content: string;
  metadata: {
    role?: string; // For conversation: 'user' | 'assistant'
    artifactType?: string; // For artifact: 'pitch_deck' | 'action_plan' | etc.
    externalUrl?: string; // For external sources
    timestamp?: string;
    title?: string;
  };
}

export class SourceLoader {
  /**
   * Load full content for a list of sources
   */
  async loadSources(
    sources: Array<{
      id: string;
      blockId: string;
      sourceType: string;
      sourceId: string;
      relevanceScore: number | null;
    }>,
  ): Promise<LoadedSource[]> {
    // Group by source type for efficient batch loading
    const byType = new Map<string, typeof sources>();

    for (const source of sources) {
      if (!byType.has(source.sourceType)) {
        byType.set(source.sourceType, []);
      }
      byType.get(source.sourceType)!.push(source);
    }

    const results: LoadedSource[] = [];

    // Load conversation sources
    const conversationSources = byType.get("conversation") || [];
    if (conversationSources.length) {
      const loaded = await this.loadConversationSources(conversationSources);
      results.push(...loaded);
    }

    // Load artifact sources
    const artifactSources = byType.get("artifact") || [];
    if (artifactSources.length) {
      const loaded = await this.loadArtifactSources(artifactSources);
      results.push(...loaded);
    }

    // Load external sources (URLs)
    const externalSources = byType.get("external") || [];
    if (externalSources.length) {
      const loaded = await this.loadExternalSources(externalSources);
      results.push(...loaded);
    }

    // User-created sources (content is inline)
    const userSources = byType.get("user_created") || [];
    for (const source of userSources) {
      results.push({
        ...source,
        content: "[User-created block - no external source]",
        metadata: {},
      });
    }

    return results;
  }

  /**
   * Load conversation message sources
   */
  private async loadConversationSources(
    sources: Array<{
      id: string;
      blockId: string;
      sourceType: string;
      sourceId: string;
      relevanceScore: number | null;
    }>,
  ): Promise<LoadedSource[]> {
    const messageIds = sources.map((s) => s.sourceId);

    const messages = await db
      .select()
      .from(ideationMessages)
      .where(inArray(ideationMessages.id, messageIds));

    const messageMap = new Map(messages.map((m) => [m.id, m]));

    return sources.map((source) => {
      const message = messageMap.get(source.sourceId);
      return {
        ...source,
        content: message?.content || "[Message not found]",
        metadata: {
          role: message?.role,
          timestamp: message?.createdAt || undefined,
        },
      };
    });
  }

  /**
   * Load artifact sources
   */
  private async loadArtifactSources(
    sources: Array<{
      id: string;
      blockId: string;
      sourceType: string;
      sourceId: string;
      relevanceScore: number | null;
    }>,
  ): Promise<LoadedSource[]> {
    const artifactIds = sources.map((s) => s.sourceId);

    const artifactRows = await db
      .select()
      .from(artifacts)
      .where(inArray(artifacts.id, artifactIds));

    const artifactMap = new Map(artifactRows.map((a) => [a.id, a]));

    return sources.map((source) => {
      const artifact = artifactMap.get(source.sourceId);
      return {
        ...source,
        content: artifact?.content || "[Artifact not found]",
        metadata: {
          artifactType: artifact?.type,
          title: artifact?.title || undefined,
          timestamp: artifact?.createdAt || undefined,
        },
      };
    });
  }

  /**
   * Load external URL sources
   */
  private async loadExternalSources(
    sources: Array<{
      id: string;
      blockId: string;
      sourceType: string;
      sourceId: string;
      relevanceScore: number | null;
    }>,
  ): Promise<LoadedSource[]> {
    // External sources store URL in sourceId
    // Content would need to be fetched or cached separately
    return sources.map((source) => ({
      ...source,
      content: "[External source - visit URL for content]",
      metadata: {
        externalUrl: source.sourceId,
      },
    }));
  }
}

export const sourceLoader = new SourceLoader();
```

## Integrate with GraphQueryService

```typescript
// In graph-query-service.ts, update getBlockSources:

import { sourceLoader } from "./source-loader";

async getBlockSources(blockId: string, includeContent: boolean = false): Promise<LoadedSource[]> {
  const sources = await db
    .select()
    .from(memoryBlockSources)
    .where(eq(memoryBlockSources.blockId, blockId));

  if (!includeContent) {
    return sources.map(s => ({
      ...s,
      content: "",
      metadata: {},
    }));
  }

  return sourceLoader.loadSources(sources);
}
```
