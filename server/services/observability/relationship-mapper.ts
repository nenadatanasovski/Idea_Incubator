/**
 * Relationship Mapper Service
 * Maps all table relationships in the database by analyzing foreign key constraints
 * and provides methods to get direct and transitive relationships
 */

import { query } from "../../../database/db.js";

export interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationshipType: "one-to-many" | "many-to-one" | "one-to-one";
}

export interface TableNode {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

export interface ForeignKeyInfo {
  column: string;
  referencesTable: string;
  referencesColumn: string;
}

export interface RelationshipGraph {
  tables: TableNode[];
  relationships: TableRelationship[];
}

export interface DirectRelationships {
  table: TableNode;
  outgoing: TableRelationship[]; // This table references other tables
  incoming: TableRelationship[]; // Other tables reference this table
  relatedTables: TableNode[];
}

export interface RelationshipCluster {
  tables: TableNode[];
  relationships: TableRelationship[];
  centralTable: string;
}

interface SQLiteColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface SQLiteForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
}

interface SQLiteTableInfo {
  name: string;
  type: string;
}

/**
 * RelationshipMapper class
 * Singleton that caches relationship mappings
 */
class RelationshipMapper {
  private graph: RelationshipGraph | null = null;
  private lastRefresh: Date | null = null;
  private refreshIntervalMs = 60000; // Refresh every minute

  /**
   * Get the full relationship graph
   */
  async getFullGraph(): Promise<RelationshipGraph> {
    if (this.shouldRefresh()) {
      await this.buildGraph();
    }
    return this.graph!;
  }

  /**
   * Get direct relationships for a specific table
   */
  async getDirectRelationships(
    tableName: string,
  ): Promise<DirectRelationships> {
    const graph = await this.getFullGraph();

    const table = graph.tables.find((t) => t.name === tableName);
    if (!table) {
      throw new Error(`Table not found: ${tableName}`);
    }

    // Find outgoing relationships (this table references others)
    const outgoing = graph.relationships.filter(
      (r) => r.fromTable === tableName,
    );

    // Find incoming relationships (others reference this table)
    const incoming = graph.relationships.filter((r) => r.toTable === tableName);

    // Get all related table names
    const relatedTableNames = new Set<string>();
    outgoing.forEach((r) => relatedTableNames.add(r.toTable));
    incoming.forEach((r) => relatedTableNames.add(r.fromTable));

    // Get related table nodes
    const relatedTables = graph.tables.filter((t) =>
      relatedTableNames.has(t.name),
    );

    return {
      table,
      outgoing,
      incoming,
      relatedTables,
    };
  }

  /**
   * Get the full relationship cluster/group for a table
   * This includes all tables transitively connected to the given table
   */
  async getRelationshipCluster(
    tableName: string,
  ): Promise<RelationshipCluster> {
    const graph = await this.getFullGraph();

    // BFS to find all connected tables
    const visited = new Set<string>();
    const queue: string[] = [tableName];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all directly connected tables
      graph.relationships.forEach((rel) => {
        if (rel.fromTable === current && !visited.has(rel.toTable)) {
          queue.push(rel.toTable);
        }
        if (rel.toTable === current && !visited.has(rel.fromTable)) {
          queue.push(rel.fromTable);
        }
      });
    }

    // Filter tables and relationships to only include those in the cluster
    const tables = graph.tables.filter((t) => visited.has(t.name));
    const relationships = graph.relationships.filter(
      (r) => visited.has(r.fromTable) && visited.has(r.toTable),
    );

    return {
      tables,
      relationships,
      centralTable: tableName,
    };
  }

  /**
   * Get all relationship clusters (connected components)
   */
  async getAllClusters(): Promise<RelationshipCluster[]> {
    const graph = await this.getFullGraph();
    const visited = new Set<string>();
    const clusters: RelationshipCluster[] = [];

    for (const table of graph.tables) {
      if (!visited.has(table.name)) {
        const cluster = await this.getRelationshipCluster(table.name);
        cluster.tables.forEach((t) => visited.add(t.name));
        clusters.push(cluster);
      }
    }

    // Sort clusters by size (largest first)
    return clusters.sort((a, b) => b.tables.length - a.tables.length);
  }

  /**
   * Check if two tables can run operations in parallel (no relationship)
   */
  async canRunParallel(table1: string, table2: string): Promise<boolean> {
    const cluster1 = await this.getRelationshipCluster(table1);
    return !cluster1.tables.some((t) => t.name === table2);
  }

  /**
   * Force refresh the relationship graph
   */
  async refresh(): Promise<void> {
    await this.buildGraph();
  }

  private shouldRefresh(): boolean {
    if (!this.graph || !this.lastRefresh) return true;
    return Date.now() - this.lastRefresh.getTime() > this.refreshIntervalMs;
  }

  private async buildGraph(): Promise<void> {
    // Get all tables and views
    const tables = await query<SQLiteTableInfo>(
      `SELECT name, type FROM sqlite_master
       WHERE type IN ('table', 'view')
       AND name NOT LIKE 'sqlite_%'
       ORDER BY name ASC`,
    );

    const tableNodes: TableNode[] = [];
    const allRelationships: TableRelationship[] = [];
    const foreignKeyLookup = new Map<string, Map<string, ForeignKeyInfo>>();

    // First pass: collect all foreign keys
    for (const table of tables) {
      const foreignKeys = await query<SQLiteForeignKey>(
        `PRAGMA foreign_key_list("${table.name}")`,
      );

      const fkMap = new Map<string, ForeignKeyInfo>();
      for (const fk of foreignKeys) {
        fkMap.set(fk.from, {
          column: fk.from,
          referencesTable: fk.table,
          referencesColumn: fk.to,
        });

        // Create relationship entry
        allRelationships.push({
          fromTable: table.name,
          fromColumn: fk.from,
          toTable: fk.table,
          toColumn: fk.to,
          relationshipType: "many-to-one", // Default assumption
        });
      }
      foreignKeyLookup.set(table.name, fkMap);
    }

    // Second pass: build table nodes with column info
    for (const table of tables) {
      const columns = await query<SQLiteColumnInfo>(
        `PRAGMA table_info("${table.name}")`,
      );

      const fkMap = foreignKeyLookup.get(table.name) || new Map();
      const primaryKeys: string[] = [];
      const foreignKeys: ForeignKeyInfo[] = [];

      const columnInfos: ColumnInfo[] = columns.map((col) => {
        const isPrimaryKey = col.pk > 0;
        const fkInfo = fkMap.get(col.name);
        const isForeignKey = !!fkInfo;

        if (isPrimaryKey) {
          primaryKeys.push(col.name);
        }
        if (fkInfo) {
          foreignKeys.push(fkInfo);
        }

        return {
          name: col.name,
          type: col.type || "TEXT",
          nullable: col.notnull === 0,
          primaryKey: isPrimaryKey,
          isForeignKey,
          referencesTable: fkInfo?.referencesTable,
          referencesColumn: fkInfo?.referencesColumn,
        };
      });

      tableNodes.push({
        name: table.name,
        columns: columnInfos,
        primaryKeys,
        foreignKeys,
      });
    }

    // Deduplicate relationships and determine relationship types
    const uniqueRelationships = this.deduplicateRelationships(allRelationships);

    this.graph = {
      tables: tableNodes,
      relationships: uniqueRelationships,
    };
    this.lastRefresh = new Date();
  }

  private deduplicateRelationships(
    relationships: TableRelationship[],
  ): TableRelationship[] {
    const seen = new Set<string>();
    return relationships.filter((rel) => {
      const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// Export singleton instance
export const relationshipMapper = new RelationshipMapper();
