/**
 * SourceLoader
 *
 * Lazily loads full content for block sources.
 * Sources can come from: conversations, artifacts, memory files, or external URLs.
 */

import { query as dbQuery } from "../../../database/db.js";

export interface LoadedSource {
  id: string;
  blockId: string;
  sourceType: string;
  sourceId: string;
  relevanceScore: number | null;
  content: string;
  metadata: {
    role?: string; // For conversation: 'user' | 'assistant'
    artifactType?: string; // For artifact: 'research' | 'mermaid' | etc.
    externalUrl?: string; // For external sources
    timestamp?: string;
    title?: string;
  };
}

interface RawSource {
  id: string;
  blockId: string;
  sourceType: string;
  sourceId: string;
  relevanceScore: number | null;
}

export class SourceLoader {
  /**
   * Load full content for a list of sources
   */
  async loadSources(sources: RawSource[]): Promise<LoadedSource[]> {
    // Group by source type for efficient batch loading
    const byType = new Map<string, RawSource[]>();

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
    sources: RawSource[],
  ): Promise<LoadedSource[]> {
    const messageIds = sources.map((s) => s.sourceId);

    if (!messageIds.length) return [];

    const placeholders = messageIds.map(() => "?").join(",");
    const messages = await dbQuery<{
      id: string;
      role: string;
      content: string;
      created_at: string;
    }>(
      `SELECT id, role, content, created_at FROM ideation_messages WHERE id IN (${placeholders})`,
      messageIds,
    );

    const messageMap = new Map(messages.map((m) => [m.id, m]));

    return sources.map((source) => {
      const message = messageMap.get(source.sourceId);
      return {
        ...source,
        content: message?.content || "[Message not found]",
        metadata: {
          role: message?.role,
          timestamp: message?.created_at || undefined,
        },
      };
    });
  }

  /**
   * Load artifact sources
   */
  private async loadArtifactSources(
    sources: RawSource[],
  ): Promise<LoadedSource[]> {
    const artifactIds = sources.map((s) => s.sourceId);

    if (!artifactIds.length) return [];

    const placeholders = artifactIds.map(() => "?").join(",");
    const artifacts = await dbQuery<{
      id: string;
      type: string;
      title: string;
      content: string;
      created_at: string;
    }>(
      `SELECT id, type, title, content, created_at FROM ideation_artifacts WHERE id IN (${placeholders})`,
      artifactIds,
    );

    const artifactMap = new Map(artifacts.map((a) => [a.id, a]));

    return sources.map((source) => {
      const artifact = artifactMap.get(source.sourceId);
      return {
        ...source,
        content: artifact?.content || "[Artifact not found]",
        metadata: {
          artifactType: artifact?.type,
          title: artifact?.title || undefined,
          timestamp: artifact?.created_at || undefined,
        },
      };
    });
  }

  /**
   * Load external URL sources
   */
  private async loadExternalSources(
    sources: RawSource[],
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
