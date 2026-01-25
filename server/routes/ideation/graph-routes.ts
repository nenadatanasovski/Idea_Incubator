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
  // Optional idea slug to include file-based artifacts from idea folder
  ideaSlug: z.string().optional(),
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

      const { sourceTypes, tokenBudget, limit, ideaSlug } = parseResult.data;

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
      if (ideaSlug) {
        options.ideaSlug = ideaSlug;
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
  // Optional idea slug to include file-based artifacts from idea folder
  ideaSlug: z.string().optional(),
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

      const { selectedSourceIds, ideaSlug } = parseResult.data;

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
        ideaSlug, // Pass ideaSlug for file-based artifacts
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
  // Sources from the analysis response - used to resolve sourceIds for lineage tracking
  sources: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum([
          "conversation",
          "conversation_insight",
          "artifact",
          "memory_file",
          "user_block",
          "external",
        ]),
        title: z.string().nullish(),
        artifactType: z.string().nullish(),
        memoryFileType: z.string().nullish(),
        weight: z.number().nullish(),
      }),
    )
    .nullish(),
  // Include the actual changes data so we don't need to re-analyze
  changes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["create_block", "update_block", "create_link"]),
        blockType: z.string().nullish(),
        title: z.string().nullish(), // Short 3-5 word summary
        content: z.string().nullish(), // Optional for create_link types which don't have content
        graphMembership: z.array(z.string()).nullish(),
        confidence: z.number().nullish(),
        // Source attribution fields - CRITICAL for tracking where insights came from
        sourceId: z.string().nullish(), // ID of the source (message ID, artifact ID, etc.)
        sourceType: z
          .enum([
            "conversation",
            "conversation_insight",
            "artifact",
            "memory_file",
            "user_block",
            "external",
          ])
          .nullish(),
        sourceWeight: z.number().nullish(), // Reliability weight 0-1
        corroboratedBy: z
          .array(
            z.object({
              sourceId: z.string(),
              sourceType: z.string(),
              snippet: z.string().nullish(),
            }),
          )
          .nullish(),
        // Legacy field
        sourceMessageId: z.string().nullish(),
        // For links
        sourceBlockId: z.string().nullish(),
        targetBlockId: z.string().nullish(),
        linkType: z.string().nullish(),
        reason: z.string().nullish(), // Reason for the link
        // For supersession handling
        supersedesBlockId: z.string().nullish(), // If this block supersedes an existing block
        supersessionReason: z.string().nullish(), // Reason for superseding
        // For status changes (e.g., marking blocks as superseded)
        blockId: z.string().nullish(), // Block ID for update_block
        statusChange: z
          .object({
            blockId: z.string().nullish(),
            newStatus: z.enum(["superseded", "abandoned"]),
            reason: z.string().nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
});

graphRouter.post(
  "/:sessionId/graph/apply-changes",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const parseResult = ApplyChangesSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.error(
          "[apply-changes] Validation failed. Issues:",
          JSON.stringify(parseResult.error.issues, null, 2),
        );
        console.error(
          "[apply-changes] Request body keys:",
          Object.keys(req.body),
        );
        if (req.body.changes && req.body.changes.length > 0) {
          console.error(
            "[apply-changes] First change:",
            JSON.stringify(req.body.changes[0], null, 2),
          );
        }
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { changeIds, changes, sources } = parseResult.data;
      const now = new Date().toISOString();

      let blocksCreated = 0;
      let linksCreated = 0;
      let blocksUpdated = 0;

      // Build a map from source type to source info for lineage resolution
      // This allows us to automatically resolve sourceId when AI didn't provide it
      const sourcesByType = new Map<
        string,
        { id: string; title: string | null }
      >();
      if (sources && sources.length > 0) {
        for (const source of sources) {
          // Store by type - if multiple sources of same type, last one wins
          // This is a simple heuristic; could be improved with better AI attribution
          sourcesByType.set(source.type, {
            id: source.id,
            title: source.title || null,
          });
        }
        console.log(
          `[apply-changes] Source lineage available: ${sources.length} sources`,
          Array.from(sourcesByType.keys()),
        );
      }

      // Helper function to resolve sourceId for lineage tracking
      // If AI provided a valid sourceId, use it. Otherwise, try to match by sourceType.
      const resolveSourceId = (
        sourceId: string | null | undefined,
        sourceType: string | null | undefined,
      ): string | undefined => {
        // Check if AI provided a valid sourceId
        const isValidSourceId =
          sourceId &&
          typeof sourceId === "string" &&
          sourceId.trim() !== "" &&
          sourceId !== "unknown";

        if (isValidSourceId) {
          return sourceId;
        }

        // Try to resolve from sources list by type
        if (sourceType && sourcesByType.has(sourceType)) {
          const resolved = sourcesByType.get(sourceType);
          console.log(
            `[apply-changes] Resolved sourceId via sourceType "${sourceType}" -> "${resolved?.id}"`,
          );
          return resolved?.id;
        }

        return undefined;
      };

      // Map temporary IDs (from AI response) to actual UUIDs
      const idMapping = new Map<string, string>();

      // If changes data provided, apply them directly
      if (changes && changes.length > 0) {
        // Filter to only selected changes
        const selectedChanges = changes.filter((c) => changeIds.includes(c.id));

        // First pass: Create all blocks and build ID mapping
        for (const change of selectedChanges) {
          try {
            if (change.type === "create_block") {
              // Skip blocks without content (shouldn't happen, but be defensive)
              if (!change.content) {
                console.warn(
                  `[apply-changes] Skipping block ${change.id} - no content provided`,
                );
                continue;
              }

              const blockId = uuidv4();

              // Map the temporary ID to the real UUID
              idMapping.set(change.id, blockId);

              // Build properties object with source attribution
              const properties: Record<string, unknown> = {};

              // Determine the effective sourceType - if AI didn't specify or defaulted to "conversation",
              // infer from available sources (prefer artifact if available)
              let effectiveSourceType = change.sourceType;
              if (
                !effectiveSourceType ||
                effectiveSourceType === "conversation"
              ) {
                // Check if we have artifact sources - if so, likely the insight came from there
                if (sourcesByType.has("artifact")) {
                  effectiveSourceType = "artifact";
                } else if (sourcesByType.has("memory_file")) {
                  effectiveSourceType = "memory_file";
                } else if (
                  sourcesByType.has("conversation") ||
                  sourcesByType.has("conversation_insight")
                ) {
                  effectiveSourceType = "conversation_insight";
                }
                // Log when we infer a different sourceType
                if (effectiveSourceType !== change.sourceType) {
                  console.log(
                    `[apply-changes] Inferred sourceType "${effectiveSourceType}" from sources (AI provided: "${change.sourceType}")`,
                  );
                }
              }

              // Resolve sourceId - uses AI-provided value if valid, otherwise
              // falls back to matching source from the sources list by sourceType
              const resolvedSourceId = resolveSourceId(
                change.sourceId,
                effectiveSourceType,
              );

              // Store source attribution in properties for traceability
              if (resolvedSourceId) {
                properties.source_id = resolvedSourceId;
              }
              if (effectiveSourceType) {
                properties.source_type = effectiveSourceType;
                // Also set specific fields based on source type for frontend compatibility
                // These enable navigation to the original source
                if (resolvedSourceId) {
                  if (effectiveSourceType === "artifact") {
                    properties.artifact_id = resolvedSourceId;
                    // Also store the artifact title if available from sources
                    const artifactSource = sourcesByType.get("artifact");
                    if (artifactSource?.title) {
                      properties.artifact_title = artifactSource.title;
                    }
                  } else if (
                    effectiveSourceType === "conversation" ||
                    effectiveSourceType === "conversation_insight"
                  ) {
                    properties.message_id = resolvedSourceId;
                  } else if (effectiveSourceType === "memory_file") {
                    properties.memory_file_type = resolvedSourceId;
                    // Store memory file title if available
                    const memorySource = sourcesByType.get("memory_file");
                    if (memorySource?.title) {
                      properties.memory_file_title = memorySource.title;
                    }
                  }
                }
              }
              if (change.sourceWeight !== undefined) {
                properties.source_weight = change.sourceWeight;
              }
              if (change.corroboratedBy && change.corroboratedBy.length > 0) {
                properties.corroborated_by = change.corroboratedBy;
              }

              // Store ALL sources that were part of this analysis for comprehensive lineage
              // This allows the frontend to show all potential sources for the insight
              if (sources && sources.length > 0) {
                properties.all_sources = sources.map((s) => ({
                  id: s.id,
                  type: s.type,
                  title: s.title,
                  weight: s.weight,
                }));
              }

              // Use resolved source ID for extracted_from_message_id when available
              const extractedFromId =
                resolvedSourceId || change.sourceMessageId || "ai_generated";

              await run(
                `INSERT INTO memory_blocks (id, session_id, type, title, content, properties, status, confidence, extracted_from_message_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
                [
                  blockId,
                  sessionId,
                  change.blockType || "content",
                  change.title || null,
                  change.content,
                  Object.keys(properties).length > 0
                    ? JSON.stringify(properties)
                    : null,
                  change.confidence || 0.8,
                  extractedFromId,
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

              // Handle supersession: if this block supersedes another
              if (change.supersedesBlockId) {
                const supersededId =
                  idMapping.get(change.supersedesBlockId) ||
                  change.supersedesBlockId;

                // Prevent self-supersession
                if (supersededId === blockId) {
                  console.warn(
                    `[apply-changes] Skipping self-supersession for block ${blockId}`,
                  );
                } else {
                  // Create supersedes link
                  const linkId = uuidv4();
                  await run(
                    `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, status, confidence, reason, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'supersedes', 'active', 0.95, ?, ?, ?)`,
                    [
                      linkId,
                      sessionId,
                      blockId,
                      supersededId,
                      change.supersessionReason || "Decision changed",
                      now,
                      now,
                    ],
                  );
                  linksCreated++;

                  // Mark superseded block as superseded
                  await run(
                    `UPDATE memory_blocks SET status = 'superseded', updated_at = ? WHERE id = ?`,
                    [now, supersededId],
                  );
                  blocksUpdated++;

                  console.log(
                    `[apply-changes] Block ${blockId} supersedes ${supersededId}`,
                  );

                  // Emit WebSocket events for the supersession
                  emitLinkCreated(sessionId, {
                    id: linkId,
                    link_type: "supersedes",
                    source: blockId,
                    target: supersededId,
                    confidence: 0.95,
                    reason: change.supersessionReason || "Decision changed",
                  });
                  emitBlockUpdated(sessionId, {
                    id: supersededId,
                    status: "superseded",
                  });
                }
              }
            }
          } catch (changeError) {
            console.error(
              `[apply-changes] Error creating block ${change.id}:`,
              changeError,
            );
          }
        }

        // Second pass: Create all links (after blocks exist)
        for (const change of selectedChanges) {
          try {
            if (change.type === "create_link") {
              if (change.sourceBlockId && change.targetBlockId) {
                // Resolve temporary IDs to actual UUIDs
                const resolvedSourceId =
                  idMapping.get(change.sourceBlockId) || change.sourceBlockId;
                const resolvedTargetId =
                  idMapping.get(change.targetBlockId) || change.targetBlockId;

                const linkId = uuidv4();

                await run(
                  `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, status, confidence, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
                  [
                    linkId,
                    sessionId,
                    resolvedSourceId,
                    resolvedTargetId,
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
                  source: resolvedSourceId,
                  target: resolvedTargetId,
                  confidence: change.confidence || 0.8,
                });

                linksCreated++;
              }
            } else if (change.type === "update_block") {
              // Handle status changes (e.g., marking blocks as superseded)
              if (change.statusChange) {
                const targetBlockId =
                  change.statusChange.blockId ||
                  change.blockId ||
                  idMapping.get(change.id);
                if (targetBlockId) {
                  await run(
                    `UPDATE memory_blocks SET status = ?, updated_at = ? WHERE id = ?`,
                    [change.statusChange.newStatus, now, targetBlockId],
                  );
                  blocksUpdated++;

                  console.log(
                    `[apply-changes] Updated block ${targetBlockId} status to ${change.statusChange.newStatus}`,
                  );

                  // Emit WebSocket event
                  emitBlockUpdated(sessionId, {
                    id: targetBlockId,
                    status: change.statusChange.newStatus,
                  });
                }
              } else {
                blocksUpdated++;
              }
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

        console.log(
          `[apply-changes] Applied ${blocksCreated} blocks and ${linksCreated} links (ID mappings: ${idMapping.size})`,
        );
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
  ideaSlug?: string, // Optional idea slug for file-based artifacts
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
    console.log(
      `[analyzeSessionForGraphUpdates] ideaSlug: ${ideaSlug || "(not provided)"}`,
    );
    let collectionResult = await collectAllSources(sessionId, {
      tokenBudget: 40000,
      conversationLimit: 50,
      ideaSlug, // Include file-based artifacts from idea folder
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
      const conversationInsightCount = filteredSources.filter(
        (s) => s.type === "conversation_insight",
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
          conversationInsightCount,
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
      max_tokens: 16384, // Increased from 4096 to allow for more blocks and links
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
      console.warn(
        `[analyzeSessionForGraphUpdates] Response content types:`,
        response.content.map((c) => c.type),
      );
      const result = getEmptyAnalysis();
      result.context.why = `Unable to analyze: No text content in AI response (got types: ${response.content.map((c) => c.type).join(", ")})`;
      return {
        ...result,
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
      console.warn(
        `[analyzeSessionForGraphUpdates] Raw response preview:`,
        textContent.text.slice(0, 500),
      );
      const result = getEmptyAnalysis();
      result.context.why = `Unable to analyze: Failed to parse AI response. Preview: ${textContent.text.slice(0, 200)}...`;
      return {
        ...result,
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

    // Include simplified source list for lineage tracking
    // This allows the frontend to display source info and enables
    // apply-changes to resolve sourceIds when AI didn't provide them
    const sourcesForLineage = collectionResult.sources.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.metadata.title || null,
      artifactType: s.metadata.artifactType || null,
      memoryFileType: s.metadata.memoryFileType || null,
      weight: s.weight,
    }));

    return {
      context: parsed.context,
      proposedChanges: parsed.proposedChanges,
      cascadeEffects: parsed.cascadeEffects,
      previewNodes,
      previewEdges,
      // NEW: Include sources for lineage tracking
      sources: sourcesForLineage,
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
    // Log full error details for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof Error) {
      console.error(
        "[analyzeSessionForGraphUpdates] Error message:",
        error.message,
      );
      console.error(
        "[analyzeSessionForGraphUpdates] Error stack:",
        error.stack,
      );
    }
    // Include error in response for debugging
    const result = getEmptyAnalysis();
    result.context.why = `Unable to analyze: ${errorMessage}`;
    return result;
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

// ============================================================================
// GRAPH SNAPSHOT / VERSIONING ROUTES
// ============================================================================

// Auto-create graph_snapshots table if it doesn't exist
// This handles the case where the server started before migrations were applied
let snapshotTableEnsured = false;
async function ensureSnapshotTable(): Promise<void> {
  if (snapshotTableEnsured) return;

  try {
    await run(
      `
      CREATE TABLE IF NOT EXISTS graph_snapshots (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        block_count INTEGER NOT NULL,
        link_count INTEGER NOT NULL,
        snapshot_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `,
      [],
    );

    await run(
      `CREATE INDEX IF NOT EXISTS idx_graph_snapshots_session ON graph_snapshots(session_id)`,
      [],
    );
    await run(
      `CREATE INDEX IF NOT EXISTS idx_graph_snapshots_created_at ON graph_snapshots(created_at)`,
      [],
    );

    snapshotTableEnsured = true;
    console.log("[graph-snapshot] Ensured graph_snapshots table exists");
  } catch (error) {
    console.error("[graph-snapshot] Error ensuring table:", error);
    throw error;
  }
}

// ============================================================================
// GET /session/:sessionId/graph/snapshots
// ============================================================================
// List all snapshots for a session (metadata only, not full data)

graphRouter.get(
  "/:sessionId/graph/snapshots",
  async (req: Request, res: Response) => {
    try {
      await ensureSnapshotTable();
      const { sessionId } = req.params;

      const snapshots = await query<{
        id: string;
        session_id: string;
        name: string;
        description: string | null;
        block_count: number;
        link_count: number;
        created_at: string;
      }>(
        `SELECT id, session_id, name, description, block_count, link_count, created_at
         FROM graph_snapshots
         WHERE session_id = ?
         ORDER BY created_at DESC`,
        [sessionId],
      );

      return res.json({
        success: true,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          sessionId: s.session_id,
          name: s.name,
          description: s.description,
          blockCount: s.block_count,
          linkCount: s.link_count,
          createdAt: s.created_at,
        })),
      });
    } catch (error) {
      console.error("Error listing snapshots:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/snapshots
// ============================================================================
// Create a new snapshot of the current graph state

const CreateSnapshotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

graphRouter.post(
  "/:sessionId/graph/snapshots",
  async (req: Request, res: Response) => {
    try {
      await ensureSnapshotTable();
      const { sessionId } = req.params;

      const parseResult = CreateSnapshotSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { name, description } = parseResult.data;
      const now = new Date().toISOString();
      const snapshotId = uuidv4();

      // Collect current graph state
      const blocks = await query<Record<string, unknown>>(
        `SELECT * FROM memory_blocks WHERE session_id = ?`,
        [sessionId],
      );

      const links = await query<Record<string, unknown>>(
        `SELECT * FROM memory_links WHERE session_id = ?`,
        [sessionId],
      );

      const memberships = await query<Record<string, unknown>>(
        `SELECT m.* FROM memory_graph_memberships m
         JOIN memory_blocks b ON m.block_id = b.id
         WHERE b.session_id = ?`,
        [sessionId],
      );

      // Create snapshot data blob
      const snapshotData = JSON.stringify({
        blocks,
        links,
        memberships,
      });

      // Insert snapshot
      await run(
        `INSERT INTO graph_snapshots (id, session_id, name, description, block_count, link_count, snapshot_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          snapshotId,
          sessionId,
          name,
          description || null,
          blocks.length,
          links.length,
          snapshotData,
          now,
        ],
      );

      await saveDb();

      console.log(
        `[graph-snapshot] Created snapshot "${name}" for session ${sessionId}: ${blocks.length} blocks, ${links.length} links`,
      );

      return res.status(201).json({
        success: true,
        snapshot: {
          id: snapshotId,
          sessionId,
          name,
          description: description || null,
          blockCount: blocks.length,
          linkCount: links.length,
          createdAt: now,
        },
      });
    } catch (error) {
      console.error("Error creating snapshot:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /session/:sessionId/graph/snapshots/:snapshotId/restore
// ============================================================================
// Restore graph to a previous snapshot state

graphRouter.post(
  "/:sessionId/graph/snapshots/:snapshotId/restore",
  async (req: Request, res: Response) => {
    try {
      await ensureSnapshotTable();
      const { sessionId, snapshotId } = req.params;
      const now = new Date().toISOString();

      // Get the snapshot
      const snapshot = await getOne<{
        id: string;
        session_id: string;
        name: string;
        snapshot_data: string;
      }>(
        `SELECT id, session_id, name, snapshot_data FROM graph_snapshots WHERE id = ? AND session_id = ?`,
        [snapshotId, sessionId],
      );

      if (!snapshot) {
        return res.status(404).json({ error: "Snapshot not found" });
      }

      // Parse snapshot data
      const snapshotData = JSON.parse(snapshot.snapshot_data) as {
        blocks: Array<{
          id: string;
          session_id: string;
          idea_id: string | null;
          type: string;
          title: string | null;
          content: string;
          properties: string | null;
          status: string | null;
          confidence: number | null;
          abstraction_level: string | null;
          created_at: string;
          updated_at: string;
          extracted_from_message_id: string | null;
          artifact_id: string | null;
        }>;
        links: Array<{
          id: string;
          session_id: string;
          source_block_id: string;
          target_block_id: string;
          link_type: string;
          degree: string | null;
          confidence: number | null;
          reason: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        }>;
        memberships: Array<{
          block_id: string;
          graph_type: string;
          created_at: string;
        }>;
      };

      // Auto-create a "before restore" snapshot for safety
      const currentBlocks = await query<Record<string, unknown>>(
        `SELECT * FROM memory_blocks WHERE session_id = ?`,
        [sessionId],
      );
      const currentLinks = await query<Record<string, unknown>>(
        `SELECT * FROM memory_links WHERE session_id = ?`,
        [sessionId],
      );
      const currentMemberships = await query<Record<string, unknown>>(
        `SELECT m.* FROM memory_graph_memberships m
         JOIN memory_blocks b ON m.block_id = b.id
         WHERE b.session_id = ?`,
        [sessionId],
      );

      if (currentBlocks.length > 0 || currentLinks.length > 0) {
        const autoSnapshotId = uuidv4();
        await run(
          `INSERT INTO graph_snapshots (id, session_id, name, description, block_count, link_count, snapshot_data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            autoSnapshotId,
            sessionId,
            `Before restore to "${snapshot.name}"`,
            `Auto-created before restoring to snapshot "${snapshot.name}"`,
            currentBlocks.length,
            currentLinks.length,
            JSON.stringify({
              blocks: currentBlocks,
              links: currentLinks,
              memberships: currentMemberships,
            }),
            now,
          ],
        );
        console.log(
          `[graph-snapshot] Auto-created backup snapshot before restore: ${autoSnapshotId}`,
        );
      }

      // Clear current graph
      await run(
        `DELETE FROM memory_graph_memberships WHERE block_id IN (SELECT id FROM memory_blocks WHERE session_id = ?)`,
        [sessionId],
      );
      await run(`DELETE FROM memory_links WHERE session_id = ?`, [sessionId]);
      await run(`DELETE FROM memory_blocks WHERE session_id = ?`, [sessionId]);

      // Restore blocks
      for (const block of snapshotData.blocks) {
        await run(
          `INSERT INTO memory_blocks (id, session_id, idea_id, type, title, content, properties, status, confidence, abstraction_level, created_at, updated_at, extracted_from_message_id, artifact_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            block.id,
            block.session_id,
            block.idea_id,
            block.type,
            block.title,
            block.content,
            block.properties,
            block.status,
            block.confidence,
            block.abstraction_level,
            block.created_at,
            block.updated_at,
            block.extracted_from_message_id,
            block.artifact_id,
          ],
        );
      }

      // Restore links
      for (const link of snapshotData.links) {
        await run(
          `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, degree, confidence, reason, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            link.id,
            link.session_id,
            link.source_block_id,
            link.target_block_id,
            link.link_type,
            link.degree,
            link.confidence,
            link.reason,
            link.status,
            link.created_at,
            link.updated_at,
          ],
        );
      }

      // Restore memberships
      for (const membership of snapshotData.memberships) {
        await run(
          `INSERT INTO memory_graph_memberships (block_id, graph_type, created_at)
           VALUES (?, ?, ?)`,
          [membership.block_id, membership.graph_type, membership.created_at],
        );
      }

      await saveDb();

      console.log(
        `[graph-snapshot] Restored snapshot "${snapshot.name}" for session ${sessionId}: ${snapshotData.blocks.length} blocks, ${snapshotData.links.length} links`,
      );

      return res.json({
        success: true,
        restoredAt: now,
        blockCount: snapshotData.blocks.length,
        linkCount: snapshotData.links.length,
      });
    } catch (error) {
      console.error("Error restoring snapshot:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// DELETE /session/:sessionId/graph/snapshots/:snapshotId
// ============================================================================
// Delete a snapshot

graphRouter.delete(
  "/:sessionId/graph/snapshots/:snapshotId",
  async (req: Request, res: Response) => {
    try {
      await ensureSnapshotTable();
      const { sessionId, snapshotId } = req.params;

      // Check if snapshot exists first
      const existing = await getOne<{ id: string }>(
        `SELECT id FROM graph_snapshots WHERE id = ? AND session_id = ?`,
        [snapshotId, sessionId],
      );

      if (!existing) {
        return res.status(404).json({ error: "Snapshot not found" });
      }

      await run(`DELETE FROM graph_snapshots WHERE id = ? AND session_id = ?`, [
        snapshotId,
        sessionId,
      ]);

      await saveDb();

      console.log(`[graph-snapshot] Deleted snapshot ${snapshotId}`);

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting snapshot:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);
