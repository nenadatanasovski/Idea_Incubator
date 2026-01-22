/**
 * Memory Graph Observability Routes
 *
 * API endpoints for monitoring and auditing Memory Graph changes.
 */

import { Router, Request, Response } from "express";
import { query, run, saveDb } from "../../../database/db.js";

export const memoryGraphRouter = Router();

// ============================================================================
// Types
// ============================================================================

interface GraphChangeEntry {
  id: string;
  timestamp: string;
  change_type: string;
  block_id: string;
  block_type: string;
  block_label: string | null;
  property_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  triggered_by: string;
  context_source: string;
  session_id: string;
  cascade_depth: number;
  affected_blocks: string | null;
}

interface MemoryBlock {
  id: string;
  type: string;
  content: string;
  status: string;
  properties: string | null;
  created_at: string;
  updated_at: string;
}

interface MemoryLink {
  id: string;
  source_block_id: string;
  target_block_id: string;
  link_type: string;
}

// ============================================================================
// GET /observability/memory-graph/changes
// ============================================================================
// Fetch change log entries with filtering

memoryGraphRouter.get("/changes", async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      timeRange = "24h",
      changeType,
      triggeredBy,
      showCascades = "true",
    } = req.query;

    // Build time filter
    let timeFilter = "";
    const now = new Date();
    switch (timeRange) {
      case "1h":
        timeFilter = `AND timestamp >= datetime('${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}')`;
        break;
      case "24h":
        timeFilter = `AND timestamp >= datetime('${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}')`;
        break;
      case "7d":
        timeFilter = `AND timestamp >= datetime('${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()}')`;
        break;
      default:
        timeFilter = "";
    }

    // Build query
    let sql = `
      SELECT
        gc.id,
        gc.timestamp,
        gc.change_type,
        gc.block_id,
        gc.block_type,
        gc.block_label,
        gc.property_changed,
        gc.old_value,
        gc.new_value,
        gc.triggered_by,
        gc.context_source,
        gc.session_id,
        gc.cascade_depth,
        gc.affected_blocks
      FROM memory_graph_changes gc
      WHERE 1=1
      ${timeFilter}
    `;

    const params: (string | number)[] = [];

    if (sessionId && typeof sessionId === "string") {
      sql += ` AND gc.session_id = ?`;
      params.push(sessionId);
    }

    if (changeType && changeType !== "all") {
      sql += ` AND gc.change_type = ?`;
      params.push(changeType as string);
    }

    if (triggeredBy && triggeredBy !== "all") {
      sql += ` AND gc.triggered_by = ?`;
      params.push(triggeredBy as string);
    }

    if (showCascades === "false") {
      sql += ` AND gc.cascade_depth = 0`;
    }

    sql += ` ORDER BY gc.timestamp DESC LIMIT 500`;

    const entries = await query<GraphChangeEntry>(sql, params);

    // Transform to API format
    const formattedEntries = entries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      changeType: entry.change_type,
      blockId: entry.block_id,
      blockType: entry.block_type,
      blockLabel: entry.block_label,
      propertyChanged: entry.property_changed,
      oldValue: entry.old_value,
      newValue: entry.new_value,
      triggeredBy: entry.triggered_by,
      contextSource: entry.context_source,
      sessionId: entry.session_id,
      cascadeDepth: entry.cascade_depth,
      affectedBlocks: entry.affected_blocks
        ? JSON.parse(entry.affected_blocks)
        : null,
    }));

    return res.json({ entries: formattedEntries });
  } catch (error) {
    console.error("Error fetching graph changes:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// GET /observability/memory-graph/health
// ============================================================================
// Get health metrics for the memory graph

memoryGraphRouter.get("/health", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    let sessionFilter = "";
    const params: string[] = [];

    if (sessionId && typeof sessionId === "string") {
      sessionFilter = "WHERE session_id = ?";
      params.push(sessionId);
    }

    // Get block counts
    const blockCounts = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM memory_blocks ${sessionFilter} GROUP BY status`,
      params,
    );

    const totalBlocks = blockCounts.reduce((sum, b) => sum + b.count, 0);
    const activeBlocks =
      blockCounts.find((b) => b.status === "active")?.count || 0;
    const supersededBlocks =
      blockCounts.find((b) => b.status === "superseded")?.count || 0;

    // Get stale derived values
    const staleResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks
       ${sessionFilter ? sessionFilter + " AND" : "WHERE"}
       type = 'derived' AND json_extract(properties, '$.stale') = 1`,
      params,
    );
    const staleDerivedValues = staleResult[0]?.count || 0;

    // Get unresolved cycles
    const cycleResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks
       ${sessionFilter ? sessionFilter + " AND" : "WHERE"}
       type = 'cycle' AND (json_extract(properties, '$.resolved') IS NULL OR json_extract(properties, '$.resolved') = 0)`,
      params,
    );
    const unresolvedCycles = cycleResult[0]?.count || 0;

    // Get dead external URLs
    const deadUrlResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks
       ${sessionFilter ? sessionFilter + " AND" : "WHERE"}
       type = 'external' AND json_extract(properties, '$.url_status') = 'dead'`,
      params,
    );
    const deadExternalUrls = deadUrlResult[0]?.count || 0;

    // Get pending confirmations
    const pendingResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks
       ${sessionFilter ? sessionFilter + " AND" : "WHERE"}
       status = 'draft' AND json_extract(properties, '$.pending_confirmation') = 1`,
      params,
    );
    const pendingConfirmations = pendingResult[0]?.count || 0;

    // Get orphan blocks (blocks with no links)
    const orphanResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM memory_blocks mb
       ${sessionFilter ? sessionFilter + " AND" : "WHERE"}
       NOT EXISTS (
         SELECT 1 FROM memory_links ml
         WHERE ml.source_block_id = mb.id OR ml.target_block_id = mb.id
       )`,
      params,
    );
    const orphanBlocks = orphanResult[0]?.count || 0;
    const orphanPercentage =
      totalBlocks > 0 ? (orphanBlocks / totalBlocks) * 100 : 0;

    return res.json({
      totalBlocks,
      activeBlocks,
      supersededBlocks,
      staleDerivedValues,
      unresolvedCycles,
      deadExternalUrls,
      pendingConfirmations,
      orphanBlocks,
      orphanPercentage,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching graph health:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /observability/memory-graph/changes
// ============================================================================
// Log a change to the memory graph (internal use)

memoryGraphRouter.post("/changes", async (req: Request, res: Response) => {
  try {
    const {
      changeType,
      blockId,
      blockType,
      blockLabel,
      propertyChanged,
      oldValue,
      newValue,
      triggeredBy,
      contextSource,
      sessionId,
      cascadeDepth = 0,
      affectedBlocks,
    } = req.body;

    const id = `gc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    await run(
      `INSERT INTO memory_graph_changes
       (id, timestamp, change_type, block_id, block_type, block_label,
        property_changed, old_value, new_value, triggered_by,
        context_source, session_id, cascade_depth, affected_blocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        timestamp,
        changeType,
        blockId,
        blockType,
        blockLabel || null,
        propertyChanged || null,
        oldValue || null,
        newValue || null,
        triggeredBy,
        contextSource,
        sessionId,
        cascadeDepth,
        affectedBlocks ? JSON.stringify(affectedBlocks) : null,
      ],
    );

    await saveDb();

    return res.json({ id, timestamp });
  } catch (error) {
    console.error("Error logging graph change:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// GET /observability/memory-graph/stale-blocks
// ============================================================================
// Get list of stale derived blocks

memoryGraphRouter.get("/stale-blocks", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    let sessionFilter = "";
    const params: string[] = [];

    if (sessionId && typeof sessionId === "string") {
      sessionFilter = "AND session_id = ?";
      params.push(sessionId);
    }

    const blocks = await query<MemoryBlock>(
      `SELECT id, type, content, status, properties, created_at, updated_at
       FROM memory_blocks
       WHERE type = 'derived'
       AND json_extract(properties, '$.stale') = 1
       ${sessionFilter}
       ORDER BY updated_at DESC`,
      params,
    );

    return res.json({ blocks });
  } catch (error) {
    console.error("Error fetching stale blocks:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// GET /observability/memory-graph/cycles
// ============================================================================
// Get list of unresolved cycles

memoryGraphRouter.get("/cycles", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query;

    let sessionFilter = "";
    const params: string[] = [];

    if (sessionId && typeof sessionId === "string") {
      sessionFilter = "AND session_id = ?";
      params.push(sessionId);
    }

    const cycles = await query<MemoryBlock>(
      `SELECT id, type, content, status, properties, created_at, updated_at
       FROM memory_blocks
       WHERE type = 'cycle'
       AND (json_extract(properties, '$.resolved') IS NULL OR json_extract(properties, '$.resolved') = 0)
       ${sessionFilter}
       ORDER BY created_at DESC`,
      params,
    );

    return res.json({ cycles });
  } catch (error) {
    console.error("Error fetching cycles:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
