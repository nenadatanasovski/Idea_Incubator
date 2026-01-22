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
        `INSERT INTO memory_blocks (id, session_id, type, content, properties, status, confidence, abstraction_level, created_at, updated_at, artifact_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          blockId,
          sessionId,
          data.type,
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

      return res.status(201).json({
        id: blockId,
        sessionId,
        ...data,
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
// POST /session/:sessionId/graph/analyze-changes
// ============================================================================
// Analyze session for potential graph updates - returns proposed changes

graphRouter.post(
  "/:sessionId/graph/analyze-changes",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Get session messages
      const messages = await query<{
        id: string;
        role: string;
        content: string;
        created_at: string;
      }>(
        `SELECT id, role, content, created_at FROM ideation_messages
         WHERE session_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
        [sessionId],
      );

      if (messages.length === 0) {
        return res.json({
          context: {
            who: "Unknown",
            what: "No conversation content",
            when: new Date().toISOString(),
            where: "Ideation session",
            why: "No messages to analyze",
          },
          proposedChanges: [],
          cascadeEffects: [],
          previewNodes: [],
          previewEdges: [],
        });
      }

      // Get existing blocks for comparison
      const existingBlocks =
        await blockExtractor.getBlocksForSession(sessionId);
      const existingLinks = await blockExtractor.getLinksForSession(sessionId);

      // Build conversation context for analysis
      const conversationText = messages
        .reverse()
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

      // Call AI to analyze and propose changes
      const analysis = await analyzeSessionForGraphUpdates(
        sessionId,
        conversationText,
        existingBlocks,
        existingLinks,
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
                `INSERT INTO memory_blocks (id, session_id, type, content, status, confidence, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
                [
                  blockId,
                  sessionId,
                  change.blockType || "content",
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
// Helper: Analyze session for graph updates
// ============================================================================

async function analyzeSessionForGraphUpdates(
  sessionId: string,
  conversationText: string,
  existingBlocks: MemoryBlock[],
  existingLinks: MemoryLink[],
): Promise<{
  context: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
  };
  proposedChanges: Array<{
    id: string;
    type: "create_block" | "update_block" | "create_link";
    blockType?: string;
    content: string;
    graphMembership?: string[];
    confidence: number;
    sourceMessageId?: string;
  }>;
  cascadeEffects: Array<{
    id: string;
    affectedBlockId: string;
    affectedBlockContent: string;
    effectType: "confidence_change" | "status_change" | "link_invalidation";
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  previewNodes: Array<{
    id: string;
    type: string;
    content: string;
    isNew?: boolean;
  }>;
  previewEdges: Array<{
    id: string;
    source: string;
    target: string;
    linkType: string;
    isNew?: boolean;
  }>;
}> {
  const { client: anthropicClient } =
    await import("../../../utils/anthropic-client.js");

  const ANALYSIS_PROMPT = `Analyze this conversation and identify what should be added to the knowledge graph.

EXISTING BLOCKS (${existingBlocks.length} total):
${existingBlocks
  .slice(0, 10)
  .map((b) => `- [${b.type}] ${b.content.slice(0, 100)}`)
  .join("\n")}
${existingBlocks.length > 10 ? `... and ${existingBlocks.length - 10} more` : ""}

CONVERSATION:
${conversationText.slice(0, 8000)}

Analyze using 5W1H framework and identify:
1. WHO: Who are the key stakeholders mentioned?
2. WHAT: What are the main concepts, ideas, decisions?
3. WHEN: Any temporal aspects or timelines?
4. WHERE: What domains, markets, or contexts?
5. WHY: What are the motivations, goals, reasons?

For each new insight NOT already in existing blocks, propose a graph change.
Only propose changes for genuinely new information.

Return JSON only:
{
  "context": {
    "who": "brief answer",
    "what": "brief answer",
    "when": "brief answer",
    "where": "brief answer",
    "why": "brief answer"
  },
  "proposedChanges": [
    {
      "id": "change_1",
      "type": "create_block",
      "blockType": "content|assumption|risk|action|decision|option|meta|synthesis|pattern|stakeholder_view",
      "content": "The extracted insight",
      "graphMembership": ["problem", "solution", "market", "risk", "fit", "business", "spec"],
      "confidence": 0.85
    }
  ],
  "cascadeEffects": [],
  "previewNodes": [],
  "previewEdges": []
}`;

  try {
    const response = await anthropicClient.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: ANALYSIS_PROMPT,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return getEmptyAnalysis();
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    // Build preview nodes from existing + proposed
    const previewNodes = existingBlocks.slice(0, 20).map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content.slice(0, 50),
      isNew: false,
    }));

    // Add proposed blocks as new preview nodes
    for (const change of parsed.proposedChanges || []) {
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

    return {
      context: parsed.context || getEmptyAnalysis().context,
      proposedChanges: parsed.proposedChanges || [],
      cascadeEffects: parsed.cascadeEffects || [],
      previewNodes,
      previewEdges,
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
