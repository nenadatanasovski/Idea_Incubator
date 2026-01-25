/**
 * Graph management routes for ideation.
 * Handles memory graph CRUD, analysis, and validation operations.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { query, run, saveDb, getOne } from "../../../database/db.js";
import {
  blockExtractor,
  MemoryBlock,
  MemoryLink,
} from "../../../agents/ideation/block-extractor.js";
import { specValidator } from "../../../agents/ideation/spec-validator.js";
import {
  graphAnalysisSubagent,
  GraphSubagentTask,
} from "../../../agents/ideation/graph-analysis-subagent.js";
import {
  processGraphPrompt,
  Block,
  Link,
} from "../../services/graph-prompt-processor.js";
import { logGraphChange } from "../observability/memory-graph-routes.js";
import {
  emitBlockCreated,
  emitBlockUpdated,
  emitLinkCreated,
  emitLinkRemoved,
} from "../../websocket.js";
import {
  collectAllSources,
  collectConversationSources,
  collectArtifactSources,
  collectMemoryFileSources,
  collectUserBlockSources,
  type SourceType,
  type CollectionOptions,
  type SourceCollectionResult,
} from "../../services/graph/source-collector.js";
import {
  buildAnalysisPrompt,
  parseAnalysisResponse,
  type AnalysisResponse,
  type ExistingBlockSummary,
} from "../../services/graph/analysis-prompt-builder.js";

export const graphRouter = Router();

// ============================================================================
// GET /session/:sessionId/blocks
// ============================================================================
// Get all blocks for a session (used by frontend useGraphData hook)

graphRouter.get("/:sessionId/blocks", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const memberships = await blockExtractor.getGraphMemberships(
      blocks.map((b) => b.id),
    );

    // Convert to API response format with graph memberships
    const blocksWithMemberships = blocks.map((block) => ({
      ...block,
      graphMembership: memberships.get(block.id) || [],
    }));

    return res.json({
      success: true,
      data: {
        blocks: blocksWithMemberships,
      },
    });
  } catch (error) {
    console.error("Error getting blocks:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ============================================================================
// GET /session/:sessionId/links
// ============================================================================
// Get all links for a session (used by frontend useGraphData hook)

graphRouter.get("/:sessionId/links", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const links = await blockExtractor.getLinksForSession(sessionId);

    return res.json({
      success: true,
      data: {
        links,
      },
    });
  } catch (error) {
    console.error("Error getting links:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ============================================================================
// GET /session/:sessionId/graph
// ============================================================================
// Get the full memory graph for a session

graphRouter.get("/:sessionId/graph", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const links = await blockExtractor.getLinksForSession(sessionId);
    const memberships = await blockExtractor.getGraphMemberships(
      blocks.map((b) => b.id),
    );

    // Convert to API response format
    const blocksWithMemberships = blocks.map((block) => ({
      ...block,
      graphMembership: memberships.get(block.id) || [],
    }));

    return res.json({
      blocks: blocksWithMemberships,
      links,
      stats: {
        blockCount: blocks.length,
        linkCount: links.length,
        byType: blocks.reduce(
          (acc, b) => {
            acc[b.type] = (acc[b.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    });
  } catch (error) {
    console.error("Error getting graph:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /session/:sessionId/graph/blocks
// ============================================================================
// Create a new block

const CreateBlockSchema = z.object({
  type: z.string(),
  title: z.string().max(100).optional(), // Short 3-5 word summary
  content: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
  status: z
    .enum(["draft", "active", "validated", "superseded", "abandoned"])
    .default("active"),
  confidence: z.number().min(0).max(1).optional(),
  abstractionLevel: z
    .enum(["vision", "strategy", "tactic", "implementation"])
    .optional(),
  graphMembership: z.array(z.string()).optional(),
  artifactId: z.string().optional(),
});

graphRouter.post(
  "/:sessionId/graph/blocks",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = CreateBlockSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const data = parseResult.data;
      const now = new Date().toISOString();
      const blockId = uuidv4();

      // Insert block
      await run(
        `INSERT INTO memory_blocks (id, session_id, type, title, content, properties, status, confidence, abstraction_level, created_at, updated_at, artifact_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          blockId,
          sessionId,
          data.type,
          data.title || null,
          data.content,
          data.properties ? JSON.stringify(data.properties) : null,
          data.status,
          data.confidence || null,
          data.abstractionLevel || null,
          now,
          now,
          data.artifactId || null,
        ],
      );

      // Insert graph memberships
      if (data.graphMembership && data.graphMembership.length > 0) {
        for (const graphType of data.graphMembership) {
          await run(
            `INSERT INTO memory_graph_memberships (block_id, graph_type, created_at) VALUES (?, ?, ?)`,
            [blockId, graphType, now],
          );
        }
      }

      await saveDb();

      // Log the block creation for change tracking
      await logGraphChange({
        changeType: "created",
        blockId,
        blockType: data.type,
        blockLabel: data.content.slice(0, 50),
        triggeredBy: "user",
        contextSource: "graph-routes:create-block",
        sessionId,
      });

      // Broadcast block_created event via WebSocket
      emitBlockCreated(sessionId, {
        id: blockId,
        type: data.type,
        title: data.title,
        content: data.content,
        properties: data.properties,
        status: data.status,
        confidence: data.confidence,
        abstractionLevel: data.abstractionLevel,
        graphMembership: data.graphMembership,
      });

      return res.status(201).json({
        id: blockId,
        sessionId,
        type: data.type,
        title: data.title || null,
        content: data.content,
        properties: data.properties,
        status: data.status,
        confidence: data.confidence,
        abstractionLevel: data.abstractionLevel,
        graphMembership: data.graphMembership,
        artifactId: data.artifactId,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      console.error("Error creating block:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// PATCH /session/:sessionId/graph/blocks/:blockId
// ============================================================================
// Update a block

const UpdateBlockSchema = z.object({
  type: z.string().optional(),
  title: z.string().max(100).optional().nullable(), // Short 3-5 word summary
  content: z.string().min(1).optional(),
  properties: z.record(z.unknown()).optional().nullable(),
  status: z
    .enum(["draft", "active", "validated", "superseded", "abandoned"])
    .optional(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  abstractionLevel: z
    .enum(["vision", "strategy", "tactic", "implementation"])
    .optional()
    .nullable(),
  graphMembership: z.array(z.string()).optional(),
  artifactId: z.string().optional().nullable(),
});

graphRouter.patch(
  "/:sessionId/graph/blocks/:blockId",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, blockId } = req.params;

      const parseResult = UpdateBlockSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const data = parseResult.data;
      const now = new Date().toISOString();

      // Build update SQL
      const updates: string[] = ["updated_at = ?"];
      const params: (string | number | null)[] = [now];

      if (data.type !== undefined) {
        updates.push("type = ?");
        params.push(data.type);
      }
      if (data.title !== undefined) {
        updates.push("title = ?");
        params.push(data.title);
      }
      if (data.content !== undefined) {
        updates.push("content = ?");
        params.push(data.content);
      }
      if (data.properties !== undefined) {
        updates.push("properties = ?");
        params.push(data.properties ? JSON.stringify(data.properties) : null);
      }
      if (data.status !== undefined) {
        updates.push("status = ?");
        params.push(data.status);
      }
      if (data.confidence !== undefined) {
        updates.push("confidence = ?");
        params.push(data.confidence);
      }
      if (data.abstractionLevel !== undefined) {
        updates.push("abstraction_level = ?");
        params.push(data.abstractionLevel);
      }
      if (data.artifactId !== undefined) {
        updates.push("artifact_id = ?");
        params.push(data.artifactId);
      }

      params.push(blockId, sessionId);

      await run(
        `UPDATE memory_blocks SET ${updates.join(", ")} WHERE id = ? AND session_id = ?`,
        params,
      );

      // Update graph memberships if provided
      if (data.graphMembership !== undefined) {
        await run(`DELETE FROM memory_graph_memberships WHERE block_id = ?`, [
          blockId,
        ]);
        for (const graphType of data.graphMembership) {
          await run(
            `INSERT INTO memory_graph_memberships (block_id, graph_type, created_at) VALUES (?, ?, ?)`,
            [blockId, graphType, now],
          );
        }
      }

      await saveDb();

      // Log the block modification for change tracking
      const changedProperties = Object.keys(data).filter(
        (k) => k !== "graphMembership",
      );
      await logGraphChange({
        changeType: data.status === "superseded" ? "superseded" : "modified",
        blockId,
        blockType: data.type || "unknown",
        propertyChanged: changedProperties.join(", "),
        triggeredBy: "user",
        contextSource: "graph-routes:update-block",
        sessionId,
      });

      // Broadcast block_updated event via WebSocket
      emitBlockUpdated(sessionId, {
        id: blockId,
        type: data.type,
        title: data.title,
        content: data.content,
        properties: data.properties,
        status: data.status,
        confidence: data.confidence,
        abstractionLevel: data.abstractionLevel,
        graphMembership: data.graphMembership,
      });

      return res.json({ success: true, updatedAt: now });
    } catch (error) {
      console.error("Error updating block:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// DELETE /session/:sessionId/graph/blocks/:blockId
// ============================================================================
// Delete a block

graphRouter.delete(
  "/:sessionId/graph/blocks/:blockId",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, blockId } = req.params;

      // Get block info before deletion for logging
      const block = await getOne<{ type: string; content: string }>(
        `SELECT type, content FROM memory_blocks WHERE id = ? AND session_id = ?`,
        [blockId, sessionId],
      );

      // Delete memberships first (cascade should handle this, but be explicit)
      await run(`DELETE FROM memory_graph_memberships WHERE block_id = ?`, [
        blockId,
      ]);

      // Delete the block
      await run(`DELETE FROM memory_blocks WHERE id = ? AND session_id = ?`, [
        blockId,
        sessionId,
      ]);

      await saveDb();

      // Log the block deletion for change tracking
      if (block) {
        await logGraphChange({
          changeType: "deleted",
          blockId,
          blockType: block.type,
          blockLabel: block.content.slice(0, 50),
          triggeredBy: "user",
          contextSource: "graph-routes:delete-block",
          sessionId,
        });
      }

      // Broadcast block_updated event with 'abandoned' status to signal deletion
      emitBlockUpdated(sessionId, {
        id: blockId,
        status: "abandoned",
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting block:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/links
// ============================================================================
// Create a new link

const CreateLinkSchema = z.object({
  sourceBlockId: z.string(),
  targetBlockId: z.string(),
  linkType: z.string(),
  degree: z.enum(["full", "partial", "minimal"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

graphRouter.post(
  "/:sessionId/graph/links",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = CreateLinkSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const data = parseResult.data;
      const now = new Date().toISOString();
      const linkId = uuidv4();

      await run(
        `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, degree, confidence, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          linkId,
          sessionId,
          data.sourceBlockId,
          data.targetBlockId,
          data.linkType,
          data.degree || null,
          data.confidence || null,
          data.reason || null,
          now,
          now,
        ],
      );

      await saveDb();

      // Log the link creation for change tracking
      await logGraphChange({
        changeType: "linked",
        blockId: data.sourceBlockId,
        blockType: "link",
        blockLabel: `${data.linkType}: ${data.sourceBlockId.slice(0, 8)}→${data.targetBlockId.slice(0, 8)}`,
        triggeredBy: "user",
        contextSource: "graph-routes:create-link",
        sessionId,
        affectedBlocks: [data.sourceBlockId, data.targetBlockId],
      });

      // Broadcast link_created event via WebSocket
      emitLinkCreated(sessionId, {
        id: linkId,
        link_type: data.linkType,
        source: data.sourceBlockId,
        target: data.targetBlockId,
        degree: data.degree,
        confidence: data.confidence,
        reason: data.reason,
      });

      return res.status(201).json({
        id: linkId,
        sessionId,
        ...data,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      console.error("Error creating link:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// DELETE /session/:sessionId/graph/links/:linkId
// ============================================================================
// Delete a link

graphRouter.delete(
  "/:sessionId/graph/links/:linkId",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, linkId } = req.params;

      // Get link info before deletion for logging
      const link = await getOne<{
        source_block_id: string;
        target_block_id: string;
        link_type: string;
      }>(
        `SELECT source_block_id, target_block_id, link_type FROM memory_links WHERE id = ? AND session_id = ?`,
        [linkId, sessionId],
      );

      await run(`DELETE FROM memory_links WHERE id = ? AND session_id = ?`, [
        linkId,
        sessionId,
      ]);

      await saveDb();

      // Log the link deletion for change tracking
      if (link) {
        await logGraphChange({
          changeType: "unlinked",
          blockId: link.source_block_id,
          blockType: "link",
          blockLabel: `${link.link_type}: ${link.source_block_id.slice(0, 8)}→${link.target_block_id.slice(0, 8)}`,
          triggeredBy: "user",
          contextSource: "graph-routes:delete-link",
          sessionId,
          affectedBlocks: [link.source_block_id, link.target_block_id],
        });
      }

      // Broadcast link_removed event via WebSocket
      emitLinkRemoved(sessionId, {
        id: linkId,
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting link:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/prompt
// ============================================================================
// Process AI prompt to update graph

const GraphPromptSchema = z.object({
  prompt: z.string().min(1),
});

graphRouter.post(
  "/:sessionId/graph/prompt",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = GraphPromptSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { prompt } = parseResult.data;

      // Get current graph state
      const blocks = await blockExtractor.getBlocksForSession(sessionId);
      const links = await blockExtractor.getLinksForSession(sessionId);
      const memberships = await blockExtractor.getGraphMemberships(
        blocks.map((b) => b.id),
      );

      // Convert to format expected by processGraphPrompt
      const currentBlocks: Block[] = blocks.map((b) => ({
        id: b.id,
        type: b.type as Block["type"],
        content: b.content,
        properties: (b.properties || {}) as Record<string, unknown>,
        status: b.status as Block["status"],
        confidence: b.confidence || 0.8,
        abstractionLevel: b.abstractionLevel as Block["abstractionLevel"],
        graphMembership: (memberships.get(b.id) ||
          []) as Block["graphMembership"],
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }));

      const currentLinks: Link[] = links.map((l) => ({
        id: l.id,
        source: l.sourceBlockId,
        target: l.targetBlockId,
        linkType: l.linkType as Link["linkType"],
        degree: (l.degree || "full") as Link["degree"],
        confidence: l.confidence || 0.8,
        reason: l.reason || undefined,
        status: l.status as Link["status"],
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      }));

      // Process the prompt
      const result = await processGraphPrompt(
        prompt,
        currentBlocks,
        currentLinks,
      );

      return res.json(result);
    } catch (error) {
      console.error("Error processing graph prompt:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/extract
// ============================================================================
// Trigger manual extraction from session

graphRouter.post(
  "/:sessionId/graph/extract",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const result = await blockExtractor.reextractSession(sessionId);

      return res.json({
        blocksCreated: result.blocks.length,
        linksCreated: result.links.length,
        warnings: result.warnings,
      });
    } catch (error) {
      console.error("Error extracting blocks:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/analyze
// ============================================================================
// Trigger graph analysis subagent

const AnalyzeSchema = z.object({
  taskType: z.enum([
    "cascade-detection",
    "link-inference",
    "contradiction-scan",
    "assumption-surface",
    "confidence-recalc",
    "cycle-detection",
    "completeness-check",
    "duplicate-detection",
    "stale-detection",
  ]),
  params: z.record(z.unknown()).optional(),
});

graphRouter.post(
  "/:sessionId/graph/analyze",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = AnalyzeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { taskType, params } = parseResult.data;

      const result = await graphAnalysisSubagent.runAnalysis(
        taskType as GraphSubagentTask,
        sessionId,
        params || {},
      );

      return res.json(result);
    } catch (error) {
      console.error("Error running analysis:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// GET /session/:sessionId/graph/validation
// ============================================================================
// Check graph completeness for spec generation

graphRouter.get(
  "/:sessionId/graph/validation",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const validation = await specValidator.checkGraphCompleteness(sessionId);

      return res.json(validation);
    } catch (error) {
      console.error("Error validating graph:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// GET /session/:sessionId/graph/spec-readiness
// ============================================================================
// Quick check if spec can be generated

graphRouter.get(
  "/:sessionId/graph/spec-readiness",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const validation = await specValidator.checkGraphCompleteness(sessionId);

      return res.json({
        ready: validation.canGenerate,
        score: validation.overallScore,
        requiredChecksPassed:
          validation.checks.hasProblemBlocks.passed &&
          validation.checks.hasSolutionBlocks.passed &&
          validation.checks.problemSolutionLinked.passed &&
          validation.checks.noBlockingCycles.passed,
      });
    } catch (error) {
      console.error("Error checking spec readiness:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/blocks/:blockId/link-artifact
// ============================================================================
// Link a block to an artifact

const LinkArtifactSchema = z.object({
  artifactId: z.string(),
  section: z.string().optional(),
});

graphRouter.post(
  "/:sessionId/graph/blocks/:blockId/link-artifact",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, blockId } = req.params;

      const parseResult = LinkArtifactSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { artifactId } = parseResult.data;
      const now = new Date().toISOString();

      await run(
        `UPDATE memory_blocks SET artifact_id = ?, updated_at = ? WHERE id = ? AND session_id = ?`,
        [artifactId, now, blockId, sessionId],
      );

      await saveDb();

      return res.json({ success: true });
    } catch (error) {
      console.error("Error linking artifact:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// DELETE /session/:sessionId/graph/blocks/:blockId/artifact
// ============================================================================
// Remove artifact link from block

graphRouter.delete(
  "/:sessionId/graph/blocks/:blockId/artifact",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, blockId } = req.params;
      const now = new Date().toISOString();

      await run(
        `UPDATE memory_blocks SET artifact_id = NULL, updated_at = ? WHERE id = ? AND session_id = ?`,
        [now, blockId, sessionId],
      );

      await saveDb();

      return res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking artifact:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// DELETE /session/:sessionId/graph/reset
// ============================================================================
// Reset (clear) all blocks and links for a session

graphRouter.delete(
  "/:sessionId/graph/reset",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Get counts before deletion for logging
      const blockCount = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM memory_blocks WHERE session_id = ?`,
        [sessionId],
      );
      const linkCount = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM memory_links WHERE session_id = ?`,
        [sessionId],
      );

      // Delete all graph memberships for blocks in this session
      await run(
        `DELETE FROM memory_graph_memberships WHERE block_id IN (SELECT id FROM memory_blocks WHERE session_id = ?)`,
        [sessionId],
      );

      // Delete all links for this session
      await run(`DELETE FROM memory_links WHERE session_id = ?`, [sessionId]);

      // Delete all blocks for this session
      await run(`DELETE FROM memory_blocks WHERE session_id = ?`, [sessionId]);

      await saveDb();

      // Log the reset for change tracking
      await logGraphChange({
        changeType: "deleted",
        blockId: sessionId,
        blockType: "graph_reset",
        blockLabel: `Reset graph: removed ${blockCount?.count || 0} blocks, ${linkCount?.count || 0} links`,
        triggeredBy: "user",
        contextSource: "graph-routes:reset-graph",
        sessionId,
      });

      console.log(
        `[graph-reset] Cleared graph for session ${sessionId}: ${blockCount?.count || 0} blocks, ${linkCount?.count || 0} links removed`,
      );

      return res.json({
        success: true,
        blocksDeleted: blockCount?.count || 0,
        linksDeleted: linkCount?.count || 0,
      });
    } catch (error) {
      console.error("Error resetting graph:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/collect-sources
// ============================================================================
// Collect sources from multiple types for analysis

const CollectSourcesSchema = z.object({
  sourceTypes: z
    .array(
      z.enum([
        "conversation",
        "artifact",
        "memory_file",
        "user_block",
        "external",
      ]),
    )
    .optional(),
  tokenBudget: z.number().min(1000).max(100000).optional(),
  limit: z.number().min(1).max(100).optional(),
});

graphRouter.post(
  "/:sessionId/graph/collect-sources",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = CollectSourcesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { sourceTypes, tokenBudget, limit } = parseResult.data;

      const options: CollectionOptions = {};
      if (sourceTypes) {
        options.sourceTypes = sourceTypes as SourceType[];
      }
      if (tokenBudget) {
        options.tokenBudget = tokenBudget;
      }
      if (limit) {
        options.conversationLimit = limit;
      }

      const result = await collectAllSources(sessionId, options);

      return res.json(result);
    } catch (error) {
      console.error("Error collecting sources:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/analyze-changes
// ============================================================================
// Analyze session for potential graph updates - returns proposed changes
// Optionally accepts selectedSourceIds to filter which sources to include

const AnalyzeChangesSchema = z.object({
  selectedSourceIds: z.array(z.string()).optional(),
});

graphRouter.post(
  "/:sessionId/graph/analyze-changes",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = AnalyzeChangesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { selectedSourceIds } = parseResult.data;

      // Get existing blocks for comparison (will be empty after reset)
      const existingBlocks =
        await blockExtractor.getBlocksForSession(sessionId);
      const existingLinks = await blockExtractor.getLinksForSession(sessionId);

      // Call AI to analyze and propose changes with optional source filtering
      const analysis = await analyzeSessionForGraphUpdates(
        sessionId,
        "", // Legacy parameter no longer used
        existingBlocks,
        existingLinks,
        selectedSourceIds,
      );

      return res.json(analysis);
    } catch (error) {
      console.error("Error analyzing graph changes:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/apply-changes
// ============================================================================
// Apply selected proposed changes to the graph

const ApplyChangesSchema = z.object({
  changeIds: z.array(z.string()),
  // Include the actual changes data so we don't need to re-analyze
  changes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["create_block", "update_block", "create_link"]),
        blockType: z.string().optional(),
        content: z.string(),
        graphMembership: z.array(z.string()).optional(),
        confidence: z.number().optional(),
        sourceMessageId: z.string().optional(),
        // For links
        sourceBlockId: z.string().optional(),
        targetBlockId: z.string().optional(),
        linkType: z.string().optional(),
      }),
    )
    .optional(),
});

graphRouter.post(
  "/:sessionId/graph/apply-changes",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = ApplyChangesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { changeIds, changes } = parseResult.data;
      const now = new Date().toISOString();

      let blocksCreated = 0;
      let linksCreated = 0;
      let blocksUpdated = 0;

      // If changes data provided, apply them directly
      if (changes && changes.length > 0) {
        // Filter to only selected changes
        const selectedChanges = changes.filter((c) => changeIds.includes(c.id));

        for (const change of selectedChanges) {
          try {
            if (change.type === "create_block") {
              const blockId = uuidv4();

              await run(
                `INSERT INTO memory_blocks (id, session_id, type, title, content, status, confidence, extracted_from_message_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 'active', ?, 'ai_generated', ?, ?)`,
                [
                  blockId,
                  sessionId,
                  change.blockType || "content",
                  change.title || null,
                  change.content,
                  change.confidence || 0.8,
                  now,
                  now,
                ],
              );

              // Add graph memberships
              if (change.graphMembership && change.graphMembership.length > 0) {
                for (const graphType of change.graphMembership) {
                  await run(
                    `INSERT INTO memory_graph_memberships (block_id, graph_type, created_at) VALUES (?, ?, ?)`,
                    [blockId, graphType, now],
                  );
                }
              }

              // Broadcast block_created event via WebSocket
              emitBlockCreated(sessionId, {
                id: blockId,
                type: change.blockType || "content",
                title: change.title || null,
                content: change.content,
                confidence: change.confidence || 0.8,
                graphMembership: change.graphMembership,
              });

              blocksCreated++;
            } else if (change.type === "create_link") {
              if (change.sourceBlockId && change.targetBlockId) {
                const linkId = uuidv4();

                await run(
                  `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, status, confidence, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
                  [
                    linkId,
                    sessionId,
                    change.sourceBlockId,
                    change.targetBlockId,
                    change.linkType || "relates_to",
                    change.confidence || 0.8,
                    now,
                    now,
                  ],
                );

                // Broadcast link_created event via WebSocket
                emitLinkCreated(sessionId, {
                  id: linkId,
                  link_type: change.linkType || "relates_to",
                  source: change.sourceBlockId,
                  target: change.targetBlockId,
                  confidence: change.confidence || 0.8,
                });

                linksCreated++;
              }
            } else if (change.type === "update_block") {
              // For updates, we'd need the target block ID
              // This would require more sophisticated change tracking
              blocksUpdated++;
            }
          } catch (changeError) {
            console.error(
              `[apply-changes] Error applying change ${change.id}:`,
              changeError,
            );
            // Continue with other changes even if one fails
          }
        }

        await saveDb();
      } else {
        // Fallback: If no changes data, just return success with zeros
        // (This handles the case where changes weren't passed properly)
        console.warn(
          "[apply-changes] No changes data provided, returning success with no modifications",
        );
      }

      // Log the graph modification (safely, in case logGraphChange fails)
      try {
        await logGraphChange({
          changeType: "created",
          blockId: sessionId,
          blockType: "batch",
          blockLabel: `Applied ${blocksCreated} blocks, ${linksCreated} links`,
          triggeredBy: "user",
          contextSource: "graph-routes:apply-changes",
          sessionId,
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error("[apply-changes] Failed to log graph change:", logError);
      }

      return res.json({
        success: true,
        blocksCreated,
        linksCreated,
        blocksUpdated,
      });
    } catch (error) {
      console.error("Error applying graph changes:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// Helper: Analyze session for graph updates (Multi-Source Version)
// ============================================================================

/**
 * Analyzes all sources in a session and proposes knowledge graph updates.
 * Sources include: conversations, artifacts, memory files, and user-created blocks.
 * Each proposed change includes source attribution for traceability.
 *
 * @param selectedSourceIds - Optional array of source IDs to include. If provided,
 *                           only sources with matching IDs will be analyzed.
 */
async function analyzeSessionForGraphUpdates(
  sessionId: string,
  _conversationText: string, // Legacy parameter, kept for compatibility
  existingBlocks: MemoryBlock[],
  existingLinks: MemoryLink[],
  selectedSourceIds?: string[],
): Promise<
  AnalysisResponse & {
    collectionMetadata?: {
      conversationCount: number;
      artifactCount: number;
      memoryFileCount: number;
      userBlockCount: number;
      totalTokens: number;
      truncated: boolean;
    };
  }
> {
  const startTime = Date.now();
  console.log(
    `[analyzeSessionForGraphUpdates] Starting multi-source analysis for session: ${sessionId}`,
  );
  if (selectedSourceIds) {
    console.log(
      `[analyzeSessionForGraphUpdates] Filtering to ${selectedSourceIds.length} selected sources`,
    );
  }

  try {
    // Step 1: Collect sources from all types
    console.log(
      `[analyzeSessionForGraphUpdates] Step 1: Collecting sources...`,
    );
    let collectionResult = await collectAllSources(sessionId, {
      tokenBudget: 40000,
      conversationLimit: 50,
    });

    // Filter to selected sources if provided
    if (selectedSourceIds && selectedSourceIds.length > 0) {
      const selectedSet = new Set(selectedSourceIds);
      const filteredSources = collectionResult.sources.filter((s) =>
        selectedSet.has(s.id),
      );

      // Recalculate metadata
      const conversationCount = filteredSources.filter(
        (s) => s.type === "conversation",
      ).length;
      const artifactCount = filteredSources.filter(
        (s) => s.type === "artifact",
      ).length;
      const memoryFileCount = filteredSources.filter(
        (s) => s.type === "memory_file",
      ).length;
      const userBlockCount = filteredSources.filter(
        (s) => s.type === "user_block",
      ).length;

      // Recalculate token estimate
      const totalTokenEstimate = filteredSources.reduce(
        (sum, s) => sum + Math.ceil(s.content.length / 4),
        0,
      );

      collectionResult = {
        sources: filteredSources,
        totalTokenEstimate,
        truncated: false,
        collectionMetadata: {
          conversationCount,
          artifactCount,
          memoryFileCount,
          userBlockCount,
        },
      };

      console.log(
        `[analyzeSessionForGraphUpdates] Filtered to ${filteredSources.length} selected sources`,
      );
    }

    console.log(
      `[analyzeSessionForGraphUpdates] Collected ${collectionResult.sources.length} sources (~${collectionResult.totalTokenEstimate} tokens)`,
    );

    // Step 2: Build prompt with source segmentation
    console.log(
      `[analyzeSessionForGraphUpdates] Step 2: Building analysis prompt...`,
    );
    const existingBlockSummaries: ExistingBlockSummary[] = existingBlocks.map(
      (b) => ({
        id: b.id,
        type: b.type,
        content: b.content,
        status: b.status || "active",
      }),
    );

    const builtPrompt = buildAnalysisPrompt(
      collectionResult,
      existingBlockSummaries,
    );

    console.log(
      `[analyzeSessionForGraphUpdates] Prompt built: ~${builtPrompt.totalTokenEstimate} tokens`,
    );
    console.log(
      `[analyzeSessionForGraphUpdates] Source breakdown:`,
      builtPrompt.sourceSummary,
    );

    // Step 3: Call AI for analysis
    console.log(
      `[analyzeSessionForGraphUpdates] Step 3: Calling AI for analysis...`,
    );
    const { client: anthropicClient } =
      await import("../../../utils/anthropic-client.js");

    const response = await anthropicClient.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 4096,
      system: builtPrompt.systemPrompt,
      messages: [
        {
          role: "user",
          content: builtPrompt.userPrompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.warn(
        `[analyzeSessionForGraphUpdates] No text content in response`,
      );
      return {
        ...getEmptyAnalysis(),
        collectionMetadata: {
          conversationCount:
            collectionResult.collectionMetadata.conversationCount,
          artifactCount: collectionResult.collectionMetadata.artifactCount,
          memoryFileCount: collectionResult.collectionMetadata.memoryFileCount,
          userBlockCount: collectionResult.collectionMetadata.userBlockCount,
          totalTokens: collectionResult.totalTokenEstimate,
          truncated: collectionResult.truncated,
        },
      };
    }

    // Step 4: Parse and validate response
    console.log(`[analyzeSessionForGraphUpdates] Step 4: Parsing response...`);
    const parsed = parseAnalysisResponse(textContent.text);

    if (!parsed) {
      console.warn(`[analyzeSessionForGraphUpdates] Failed to parse response`);
      return {
        ...getEmptyAnalysis(),
        collectionMetadata: {
          conversationCount:
            collectionResult.collectionMetadata.conversationCount,
          artifactCount: collectionResult.collectionMetadata.artifactCount,
          memoryFileCount: collectionResult.collectionMetadata.memoryFileCount,
          userBlockCount: collectionResult.collectionMetadata.userBlockCount,
          totalTokens: collectionResult.totalTokenEstimate,
          truncated: collectionResult.truncated,
        },
      };
    }

    // Step 5: Build preview nodes and edges
    console.log(`[analyzeSessionForGraphUpdates] Step 5: Building preview...`);
    const previewNodes = existingBlocks.slice(0, 20).map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content.slice(0, 50),
      isNew: false,
    }));

    // Add proposed blocks as new preview nodes
    for (const change of parsed.proposedChanges) {
      if (change.type === "create_block") {
        previewNodes.push({
          id: change.id,
          type: change.blockType || "content",
          content: change.content.slice(0, 50),
          isNew: true,
        });
      }
    }

    // Build preview edges from existing links
    const previewEdges = existingLinks.slice(0, 20).map((l) => ({
      id: l.id,
      source: l.sourceBlockId,
      target: l.targetBlockId,
      linkType: l.linkType,
      isNew: false,
    }));

    const duration = Date.now() - startTime;
    console.log(
      `[analyzeSessionForGraphUpdates] Analysis complete in ${duration}ms`,
    );
    console.log(
      `[analyzeSessionForGraphUpdates] Proposed changes: ${parsed.proposedChanges.length}`,
    );
    console.log(
      `[analyzeSessionForGraphUpdates] Cascade effects: ${parsed.cascadeEffects.length}`,
    );

    // Log source attribution breakdown
    const attributionBreakdown: Record<string, number> = {};
    parsed.proposedChanges.forEach((change) => {
      const sourceType = change.sourceType || "unknown";
      attributionBreakdown[sourceType] =
        (attributionBreakdown[sourceType] || 0) + 1;
    });
    console.log(
      `[analyzeSessionForGraphUpdates] Changes by source:`,
      attributionBreakdown,
    );

    return {
      context: parsed.context,
      proposedChanges: parsed.proposedChanges,
      cascadeEffects: parsed.cascadeEffects,
      previewNodes,
      previewEdges,
      collectionMetadata: {
        conversationCount:
          collectionResult.collectionMetadata.conversationCount,
        artifactCount: collectionResult.collectionMetadata.artifactCount,
        memoryFileCount: collectionResult.collectionMetadata.memoryFileCount,
        userBlockCount: collectionResult.collectionMetadata.userBlockCount,
        totalTokens: collectionResult.totalTokenEstimate,
        truncated: collectionResult.truncated,
      },
    };
  } catch (error) {
    console.error("[analyzeSessionForGraphUpdates] Error:", error);
    return getEmptyAnalysis();
  }
}

function getEmptyAnalysis() {
  return {
    context: {
      who: "Unknown",
      what: "Analysis failed",
      when: new Date().toISOString(),
      where: "Ideation session",
      why: "Unable to analyze",
    },
    proposedChanges: [],
    cascadeEffects: [],
    previewNodes: [],
    previewEdges: [],
  };
}

// ============================================================================
// GET /session/:sessionId/graph/blocks/:blockId/artifact
// ============================================================================
// Get linked artifact for a block

graphRouter.get(
  "/:sessionId/graph/blocks/:blockId/artifact",
  async (req: Request, res: Response) => {
    try {
      const { sessionId, blockId } = req.params;

      const block = await getOne<{ artifact_id: string | null }>(
        `SELECT artifact_id FROM memory_blocks WHERE id = ? AND session_id = ?`,
        [blockId, sessionId],
      );

      if (!block) {
        return res.status(404).json({ error: "Block not found" });
      }

      if (!block.artifact_id) {
        return res.json({ artifact: null, artifactPath: null });
      }

      // Get artifact details
      const artifact = await getOne<{
        id: string;
        type: string;
        title: string;
        content: string;
      }>(
        `SELECT id, type, title, content FROM ideation_artifacts WHERE id = ?`,
        [block.artifact_id],
      );

      return res.json({
        artifact: artifact || null,
        artifactPath: artifact ? `/artifacts/${artifact.id}` : null,
      });
    } catch (error) {
      console.error("Error getting block artifact:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);
