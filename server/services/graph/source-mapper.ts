/**
 * Source-to-Node Mapper Service
 *
 * Uses Claude Opus 4.5 to intelligently map collected sources to newly created
 * memory graph nodes. This creates a many-to-many relationship between sources
 * and blocks, enabling comprehensive lineage tracking.
 *
 * Flow:
 * 1. Receive newly created blocks and collected sources
 * 2. Call Claude Opus 4.5 to analyze semantic relationships
 * 3. Store mappings in memory_block_sources junction table
 */

import { v4 as uuidv4 } from "uuid";
import { client as anthropicClient } from "../../../utils/anthropic-client.js";
import { query, run, saveDb } from "../../../database/db.js";
import type { CollectedSource } from "./source-collector.js";

// ============================================================================
// Types
// ============================================================================

export interface SourceMapping {
  blockId: string;
  sourceId: string;
  sourceType: string;
  sourceTitle: string | null;
  sourceContentSnippet: string | null;
  relevanceScore: number;
  mappingReason: string;
}

export interface BlockSummary {
  id: string;
  type: string;
  title: string | null;
  content: string;
}

export interface MappingResult {
  mappingsCreated: number;
  mappings: SourceMapping[];
  warnings: string[];
}

// ============================================================================
// AI Mapping Prompt
// ============================================================================

const SOURCE_MAPPING_SYSTEM_PROMPT = `You are an expert at analyzing knowledge graphs and tracing where insights originated.

Your task is to map sources (conversation messages, artifacts, memory files) to knowledge graph nodes (blocks).

For each block, identify which sources contributed to that insight. A source contributes to a block if:
1. The block's content is directly derived from or extracted from the source
2. The source provides evidence, data, or reasoning that supports the block
3. The source mentions concepts, entities, or claims that appear in the block
4. The source provides context that informed the creation of the block

Important rules:
- A block can have multiple contributing sources
- A source can contribute to multiple blocks
- Not every source will contribute to every block - be selective
- Focus on meaningful semantic relationships, not superficial word matches
- Provide a brief reason explaining why each source contributes to each block
- Rate relevance from 0.0 to 1.0 (0.8+ for direct derivation, 0.5-0.8 for supporting evidence, 0.3-0.5 for contextual relevance)

Return JSON only, no markdown:
{
  "mappings": [
    {
      "block_id": "block-uuid",
      "source_id": "source-id",
      "relevance_score": 0.85,
      "reason": "Block content about market size directly extracted from this artifact's research section"
    }
  ]
}

If no meaningful mappings exist, return: {"mappings": []}`;

// ============================================================================
// Source Mapper Class
// ============================================================================

export class SourceMapper {
  private client: typeof anthropicClient;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Map sources to newly created blocks using AI analysis.
   * Uses Claude Opus 4.5 for intelligent semantic mapping.
   *
   * @param blocks - The newly created memory blocks to map sources to
   * @param sources - The collected sources from the session
   * @param sessionId - The session ID for logging
   * @returns MappingResult with created mappings
   */
  async mapSourcesToBlocks(
    blocks: BlockSummary[],
    sources: CollectedSource[],
    sessionId: string,
  ): Promise<MappingResult> {
    const startTime = Date.now();
    console.log(
      `[SourceMapper] Starting source mapping for session ${sessionId}`,
    );
    console.log(
      `[SourceMapper] Blocks to map: ${blocks.length}, Sources available: ${sources.length}`,
    );

    if (blocks.length === 0 || sources.length === 0) {
      console.log(`[SourceMapper] No blocks or sources to map, skipping`);
      return { mappingsCreated: 0, mappings: [], warnings: [] };
    }

    try {
      // Call AI to analyze and create mappings
      const aiMappings = await this.callMappingLLM(blocks, sources);

      if (aiMappings.length === 0) {
        console.log(`[SourceMapper] AI found no meaningful mappings`);
        return { mappingsCreated: 0, mappings: [], warnings: [] };
      }

      // Create source lookup for metadata
      const sourceMap = new Map<string, CollectedSource>();
      for (const source of sources) {
        sourceMap.set(source.id, source);
      }

      // Save mappings to database
      const savedMappings: SourceMapping[] = [];
      const warnings: string[] = [];

      for (const mapping of aiMappings) {
        const source = sourceMap.get(mapping.source_id);

        if (!source) {
          warnings.push(
            `Source ${mapping.source_id} not found in sources list`,
          );
          continue;
        }

        // Validate block exists
        const blockExists = blocks.some((b) => b.id === mapping.block_id);
        if (!blockExists) {
          warnings.push(`Block ${mapping.block_id} not found in blocks list`);
          continue;
        }

        const mappingId = uuidv4();
        const contentSnippet = source.content.slice(0, 200);

        try {
          await run(
            `INSERT INTO memory_block_sources
             (id, block_id, source_id, source_type, source_title, source_content_snippet, relevance_score, mapping_reason, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(block_id, source_id) DO UPDATE SET
               relevance_score = excluded.relevance_score,
               mapping_reason = excluded.mapping_reason`,
            [
              mappingId,
              mapping.block_id,
              mapping.source_id,
              source.type,
              source.metadata.title || null,
              contentSnippet,
              mapping.relevance_score,
              mapping.reason,
              new Date().toISOString(),
            ],
          );

          savedMappings.push({
            blockId: mapping.block_id,
            sourceId: mapping.source_id,
            sourceType: source.type,
            sourceTitle: source.metadata.title || null,
            sourceContentSnippet: contentSnippet,
            relevanceScore: mapping.relevance_score,
            mappingReason: mapping.reason,
          });
        } catch (dbError) {
          console.error(
            `[SourceMapper] Error saving mapping for block ${mapping.block_id}:`,
            dbError,
          );
          warnings.push(
            `Failed to save mapping: ${mapping.block_id} <- ${mapping.source_id}`,
          );
        }
      }

      await saveDb();

      const duration = Date.now() - startTime;
      console.log(
        `[SourceMapper] Mapping complete in ${duration}ms: ${savedMappings.length} mappings created`,
      );

      return {
        mappingsCreated: savedMappings.length,
        mappings: savedMappings,
        warnings,
      };
    } catch (error) {
      console.error(`[SourceMapper] Error in source mapping:`, error);
      return {
        mappingsCreated: 0,
        mappings: [],
        warnings: [
          `Mapping failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Call Claude Opus 4.5 to analyze source-to-block relationships.
   */
  private async callMappingLLM(
    blocks: BlockSummary[],
    sources: CollectedSource[],
  ): Promise<
    Array<{
      block_id: string;
      source_id: string;
      relevance_score: number;
      reason: string;
    }>
  > {
    // Build user prompt with blocks and sources
    const blocksSection = blocks
      .map(
        (b) =>
          `Block ID: ${b.id}\nType: ${b.type}\nTitle: ${b.title || "(none)"}\nContent: ${b.content.slice(0, 300)}${b.content.length > 300 ? "..." : ""}`,
      )
      .join("\n\n---\n\n");

    const sourcesSection = sources
      .map(
        (s) =>
          `Source ID: ${s.id}\nType: ${s.type}\nTitle: ${s.metadata.title || "(none)"}\nContent Preview: ${s.content.slice(0, 400)}${s.content.length > 400 ? "..." : ""}`,
      )
      .join("\n\n---\n\n");

    const userPrompt = `Analyze these memory graph blocks and determine which sources contributed to each block.

## BLOCKS TO MAP (${blocks.length} total)

${blocksSection}

## AVAILABLE SOURCES (${sources.length} total)

${sourcesSection}

## TASK

For each block above, identify which sources contributed to it. Consider:
- Direct content derivation (high relevance 0.8+)
- Supporting evidence or data (medium relevance 0.5-0.8)
- Contextual information (lower relevance 0.3-0.5)

Return your analysis as JSON with mappings array.`;

    try {
      console.log(
        `[SourceMapper] Calling Claude Opus 4.5 for source mapping...`,
      );

      const response = await this.client.messages.create({
        model: "claude-opus-4-5-20251101", // Using Claude Opus 4.5 as specified
        max_tokens: 16384,
        system: SOURCE_MAPPING_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        console.warn(`[SourceMapper] No text content in AI response`);
        return [];
      }

      // Parse JSON response
      let jsonText = textContent.text.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
      }

      try {
        const parsed = JSON.parse(jsonText);
        const mappings = parsed.mappings || [];

        console.log(`[SourceMapper] AI returned ${mappings.length} mappings`);

        // Validate and filter mappings
        return mappings.filter(
          (m: {
            block_id?: string;
            source_id?: string;
            relevance_score?: number;
            reason?: string;
          }) =>
            m.block_id &&
            m.source_id &&
            typeof m.relevance_score === "number" &&
            m.reason,
        );
      } catch (parseError) {
        console.error(
          `[SourceMapper] Failed to parse AI response:`,
          parseError,
        );
        console.error(
          `[SourceMapper] Response preview:`,
          jsonText.slice(0, 500),
        );
        return [];
      }
    } catch (apiError) {
      console.error(`[SourceMapper] AI API call failed:`, apiError);
      throw apiError;
    }
  }

  /**
   * Get all source mappings for a specific block.
   */
  async getSourcesForBlock(blockId: string): Promise<SourceMapping[]> {
    const rows = await query<{
      id: string;
      block_id: string;
      source_id: string;
      source_type: string;
      source_title: string | null;
      source_content_snippet: string | null;
      relevance_score: number | null;
      mapping_reason: string | null;
    }>(
      `SELECT * FROM memory_block_sources WHERE block_id = ? ORDER BY relevance_score DESC`,
      [blockId],
    );

    return rows.map((row) => ({
      blockId: row.block_id,
      sourceId: row.source_id,
      sourceType: row.source_type,
      sourceTitle: row.source_title,
      sourceContentSnippet: row.source_content_snippet,
      relevanceScore: row.relevance_score || 0,
      mappingReason: row.mapping_reason || "",
    }));
  }

  /**
   * Get all blocks that a source contributed to.
   */
  async getBlocksForSource(sourceId: string): Promise<SourceMapping[]> {
    const rows = await query<{
      id: string;
      block_id: string;
      source_id: string;
      source_type: string;
      source_title: string | null;
      source_content_snippet: string | null;
      relevance_score: number | null;
      mapping_reason: string | null;
    }>(
      `SELECT * FROM memory_block_sources WHERE source_id = ? ORDER BY relevance_score DESC`,
      [sourceId],
    );

    return rows.map((row) => ({
      blockId: row.block_id,
      sourceId: row.source_id,
      sourceType: row.source_type,
      sourceTitle: row.source_title,
      sourceContentSnippet: row.source_content_snippet,
      relevanceScore: row.relevance_score || 0,
      mappingReason: row.mapping_reason || "",
    }));
  }

  /**
   * Delete all mappings for a block (used when block is deleted).
   */
  async deleteMappingsForBlock(blockId: string): Promise<void> {
    await run(`DELETE FROM memory_block_sources WHERE block_id = ?`, [blockId]);
    await saveDb();
  }
}

// Singleton export
export const sourceMapper = new SourceMapper();
