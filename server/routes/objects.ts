/**
 * Objects API Routes
 * Provides introspection of database tables - schema and data access
 */

import { Router, Request, Response } from "express";
import { query } from "../../database/db.js";
import { relationshipMapper } from "../services/observability/relationship-mapper.js";

const router = Router();

interface TableInfo {
  name: string;
  type: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    primaryKey: boolean;
  }>;
  rowCount: number;
}

/**
 * GET /api/objects/tables
 * List all tables in the database with their schemas
 */
router.get("/tables", async (_req: Request, res: Response) => {
  try {
    // Get all tables (excluding sqlite internal tables)
    const tables = await query<TableInfo>(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table', 'view')
       AND name NOT LIKE 'sqlite_%'
       ORDER BY type DESC, name ASC`,
    );

    const tableSchemas: TableSchema[] = [];

    for (const table of tables) {
      // Get column info for each table
      const columns = await query<ColumnInfo>(
        `PRAGMA table_info("${table.name}")`,
      );

      // Get row count
      let rowCount = 0;
      try {
        const countResult = await query<{ count: number }>(
          `SELECT COUNT(*) as count FROM "${table.name}"`,
        );
        rowCount = countResult[0]?.count || 0;
      } catch {
        // Some views might fail to count
        rowCount = 0;
      }

      tableSchemas.push({
        name: table.name,
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type || "TEXT",
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1,
        })),
        rowCount,
      });
    }

    res.json({
      success: true,
      data: {
        tables: tableSchemas,
        count: tableSchemas.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tables" });
  }
});

/**
 * GET /api/objects/tables/:tableName
 * Get schema and metadata for a specific table
 */
router.get("/tables/:tableName", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;

    // Validate table exists
    const tableCheck = await query<TableInfo>(
      `SELECT name, type FROM sqlite_master
       WHERE (type = 'table' OR type = 'view')
       AND name = ?`,
      [tableName],
    );

    if (tableCheck.length === 0) {
      return res.status(404).json({ success: false, error: "Table not found" });
    }

    // Get column info
    const columns = await query<ColumnInfo>(
      `PRAGMA table_info("${tableName}")`,
    );

    // Get row count
    let rowCount = 0;
    try {
      const countResult = await query<{ count: number }>(
        `SELECT COUNT(*) as count FROM "${tableName}"`,
      );
      rowCount = countResult[0]?.count || 0;
    } catch {
      rowCount = 0;
    }

    // Get foreign keys
    const foreignKeys = await query<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
    }>(`PRAGMA foreign_key_list("${tableName}")`);

    // Get indexes
    const indexes = await query<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
    }>(`PRAGMA index_list("${tableName}")`);

    return res.json({
      success: true,
      data: {
        name: tableName,
        type: tableCheck[0].type,
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type || "TEXT",
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          primaryKey: col.pk === 1,
        })),
        rowCount,
        foreignKeys: foreignKeys.map((fk) => ({
          column: fk.from,
          referencesTable: fk.table,
          referencesColumn: fk.to,
        })),
        indexes: indexes.map((idx) => ({
          name: idx.name,
          unique: idx.unique === 1,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch table schema:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch table schema" });
  }
});

/**
 * GET /api/objects/tables/:tableName/rows
 * Get rows from a specific table with pagination and search
 */
router.get("/tables/:tableName/rows", async (req: Request, res: Response) => {
  try {
    const { tableName } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || "";
    const sortColumn = (req.query.sortColumn as string) || "";
    const sortDirection = (req.query.sortDirection as string) || "ASC";

    // Validate table exists
    const tableCheck = await query<TableInfo>(
      `SELECT name, type FROM sqlite_master
       WHERE (type = 'table' OR type = 'view')
       AND name = ?`,
      [tableName],
    );

    if (tableCheck.length === 0) {
      return res.status(404).json({ success: false, error: "Table not found" });
    }

    // Get columns for search
    const columns = await query<ColumnInfo>(
      `PRAGMA table_info("${tableName}")`,
    );

    // Build search clause
    let whereClause = "1=1";
    const params: (string | number)[] = [];

    if (search.trim()) {
      const searchConditions = columns
        .filter((col) =>
          ["TEXT", "VARCHAR", "CHAR", ""].includes(col.type.toUpperCase()),
        )
        .map((col) => `CAST("${col.name}" AS TEXT) LIKE ?`)
        .join(" OR ");

      if (searchConditions) {
        whereClause = `(${searchConditions})`;
        const searchTerm = `%${search}%`;
        for (
          let i = 0;
          i <
          columns.filter((col) =>
            ["TEXT", "VARCHAR", "CHAR", ""].includes(col.type.toUpperCase()),
          ).length;
          i++
        ) {
          params.push(searchTerm);
        }
      }
    }

    // Build sort clause
    let orderClause = "";
    if (sortColumn) {
      // Validate sort column exists
      const validColumn = columns.find(
        (col) => col.name.toLowerCase() === sortColumn.toLowerCase(),
      );
      if (validColumn) {
        const direction =
          sortDirection.toUpperCase() === "DESC" ? "DESC" : "ASC";
        orderClause = `ORDER BY "${validColumn.name}" ${direction}`;
      }
    }

    // Get total count with search filter
    const countResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`,
      params,
    );
    const total = countResult[0]?.count || 0;

    // Get rows with pagination
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM "${tableName}" WHERE ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.json({
      success: true,
      data: {
        rows,
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type || "TEXT",
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch table rows:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch table rows" });
  }
});

/**
 * GET /api/objects/search
 * Search across all tables for a term
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const searchTerm = (req.query.q as string) || "";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!searchTerm.trim()) {
      return res.json({
        success: true,
        data: {
          results: [],
          total: 0,
        },
      });
    }

    // Get all tables
    const tables = await query<TableInfo>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'`,
    );

    const results: Array<{
      table: string;
      matchCount: number;
      sampleMatches: Record<string, unknown>[];
    }> = [];

    const searchPattern = `%${searchTerm}%`;

    for (const table of tables) {
      try {
        // Get text columns for this table
        const columns = await query<ColumnInfo>(
          `PRAGMA table_info("${table.name}")`,
        );

        const textColumns = columns.filter((col) =>
          ["TEXT", "VARCHAR", "CHAR", ""].includes(col.type.toUpperCase()),
        );

        if (textColumns.length === 0) continue;

        // Build search query
        const searchConditions = textColumns
          .map((col) => `CAST("${col.name}" AS TEXT) LIKE ?`)
          .join(" OR ");

        const params = textColumns.map(() => searchPattern);

        // Get match count
        const countResult = await query<{ count: number }>(
          `SELECT COUNT(*) as count FROM "${table.name}" WHERE ${searchConditions}`,
          params,
        );
        const matchCount = countResult[0]?.count || 0;

        if (matchCount > 0) {
          // Get sample matches
          const sampleMatches = await query<Record<string, unknown>>(
            `SELECT * FROM "${table.name}" WHERE ${searchConditions} LIMIT 3`,
            params,
          );

          results.push({
            table: table.name,
            matchCount,
            sampleMatches,
          });
        }
      } catch {
        // Skip tables that cause errors
        continue;
      }
    }

    // Sort by match count descending
    results.sort((a, b) => b.matchCount - a.matchCount);

    return res.json({
      success: true,
      data: {
        results: results.slice(0, limit),
        total: results.reduce((sum, r) => sum + r.matchCount, 0),
        tablesSearched: tables.length,
      },
    });
  } catch (error) {
    console.error("Failed to search tables:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to search tables" });
  }
});

/**
 * GET /api/objects/relationships
 * Get all table relationships in the database
 */
router.get("/relationships", async (_req: Request, res: Response) => {
  try {
    const graph = await relationshipMapper.getFullGraph();
    return res.json({
      success: true,
      data: {
        tables: graph.tables,
        relationships: graph.relationships,
        tableCount: graph.tables.length,
        relationshipCount: graph.relationships.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch relationships:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch relationships" });
  }
});

/**
 * GET /api/objects/tables/:tableName/relationships
 * Get direct relationships for a specific table
 */
router.get(
  "/tables/:tableName/relationships",
  async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const directRelationships =
        await relationshipMapper.getDirectRelationships(tableName);
      return res.json({
        success: true,
        data: directRelationships,
      });
    } catch (error) {
      console.error("Failed to fetch table relationships:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch relationships";
      return res.status(500).json({ success: false, error: message });
    }
  },
);

/**
 * GET /api/objects/tables/:tableName/relationship-cluster
 * Get the full relationship cluster/group for a table
 * This includes all tables transitively connected to the given table
 */
router.get(
  "/tables/:tableName/relationship-cluster",
  async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const cluster =
        await relationshipMapper.getRelationshipCluster(tableName);
      return res.json({
        success: true,
        data: cluster,
      });
    } catch (error) {
      console.error("Failed to fetch relationship cluster:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch relationship cluster";
      return res.status(500).json({ success: false, error: message });
    }
  },
);

/**
 * GET /api/objects/clusters
 * Get all relationship clusters (connected components) in the database
 */
router.get("/clusters", async (_req: Request, res: Response) => {
  try {
    const clusters = await relationshipMapper.getAllClusters();
    return res.json({
      success: true,
      data: {
        clusters,
        clusterCount: clusters.length,
        largestClusterSize: clusters[0]?.tables.length || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch clusters:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch clusters" });
  }
});

/**
 * POST /api/objects/relationships/refresh
 * Force refresh the relationship graph cache
 */
router.post("/relationships/refresh", async (_req: Request, res: Response) => {
  try {
    await relationshipMapper.refresh();
    const graph = await relationshipMapper.getFullGraph();
    return res.json({
      success: true,
      data: {
        tableCount: graph.tables.length,
        relationshipCount: graph.relationships.length,
        refreshedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to refresh relationships:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to refresh relationships" });
  }
});

export default router;
