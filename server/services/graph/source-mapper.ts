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

const SOURCE_MAPPING_SYSTEM_PROMPT = `You are an expert at analyzing knowledge graphs and tracing the origins of AI-generated insights.

CONTEXT: This is an ideation system where:
- Users have conversations with an AI about their ideas
- The AI generates memory graph blocks (insights, problems, hypotheses, etc.) based on user messages
- Blocks are NOT direct quotes - they are AI-synthesized insights DERIVED FROM user inputs
- Your job is to trace which user messages INFORMED or INSPIRED each block

Your task: Map sources (user messages, fetched URLs) to blocks they contributed to.

A source should be mapped to a block when:
1. The source contains information that the AI used to generate the block
2. The block represents an insight, analysis, or synthesis of content from that source
3. There is a semantic connection - the block's topic/content is informed by the source

DO NOT map sources that are:
- Completely unrelated topics
- Generic greetings with no substantive content
- System messages that didn't contribute information

GUIDELINES:
- User messages about a topic SHOULD map to blocks about that same topic
- If a user discusses "X problem", blocks analyzing "X problem" should trace back to that message
- Each block typically traces to 1-4 sources that informed it
- Some sources (like detailed descriptions) may inform multiple related blocks
- Map liberally for lineage tracking - err on the side of inclusion

Relevance scoring:
- 0.9-1.0: Block directly addresses or analyzes content from this source
- 0.7-0.9: Block synthesizes or expands on ideas from this source
- 0.5-0.7: Source provides context that influenced the block's generation
- 0.3-0.5: Weak but traceable connection (include these too)

Return JSON only, no markdown:
{
  "mappings": [
    {
      "block_id": "block-uuid",
      "source_id": "source-id",
      "relevance_score": 0.85,
      "reason": "User described their problem with X, and this block analyzes the X problem"
    }
  ]
}`;

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
        const contentSnippet = source.content.slice(0, 500);

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

    const userPrompt = `Analyze these memory graph blocks and trace which sources informed their creation.

## BLOCKS TO MAP (${blocks.length} total)

${blocksSection}

## AVAILABLE SOURCES (${sources.length} total)

${sourcesSection}

## TASK

Trace the lineage of each block back to its source(s). Remember:
- Blocks are AI-generated insights BASED ON user messages
- If a user talked about topic X, blocks about X should trace to that message
- We want comprehensive lineage tracking, not just direct quotes

For each block, identify sources that:
- Provided the topic, problem, or context the block analyzes
- Contain information that the AI synthesized into the block
- Have clear semantic connection to the block's content

Include mappings with relevance 0.3 or higher. Each block should typically have at least one source connection.

Return your analysis as JSON with mappings array.`;

    try {
      console.log(
        `[SourceMapper] Calling Claude Opus 4.5 for source mapping...`,
      );
      console.log(
        `[SourceMapper] User prompt preview (first 500 chars): ${userPrompt.slice(0, 500)}...`,
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
      console.log(
        `[SourceMapper] AI response (first 1000 chars): ${jsonText.slice(0, 1000)}`,
      );

      // Extract JSON from response - AI often includes prose before/after the JSON
      // Look for JSON code block first, then try to find raw JSON object
      const jsonCodeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonCodeBlockMatch) {
        jsonText = jsonCodeBlockMatch[1].trim();
        console.log("[SourceMapper] Extracted JSON from code block");
      } else {
        // Try to find JSON object directly (starts with { ends with })
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
          console.log("[SourceMapper] Extracted JSON object from response");
        }
      }

      try {
        const parsed = JSON.parse(jsonText);
        const mappings = parsed.mappings || [];

        console.log(`[SourceMapper] AI returned ${mappings.length} mappings`);

        // Minimum relevance threshold - lowered to capture more lineage connections
        const MIN_RELEVANCE_THRESHOLD = 0.3;

        // Validate and filter mappings
        const validMappings = mappings.filter(
          (m: {
            block_id?: string;
            source_id?: string;
            relevance_score?: number;
            reason?: string;
          }) =>
            m.block_id &&
            m.source_id &&
            typeof m.relevance_score === "number" &&
            m.relevance_score >= MIN_RELEVANCE_THRESHOLD &&
            m.reason,
        );

        console.log(
          `[SourceMapper] After filtering (>=${MIN_RELEVANCE_THRESHOLD}): ${validMappings.length} mappings`,
        );

        return validMappings;
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
