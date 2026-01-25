/**
 * Graph Snapshot Entity
 *
 * Stores point-in-time snapshots of memory graph state for version control.
 * Each snapshot captures all blocks, links, and memberships as a JSON blob.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const graphSnapshots = sqliteTable(
  "graph_snapshots",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    blockCount: integer("block_count").notNull(),
    linkCount: integer("link_count").notNull(),
    // JSON blob containing: { blocks: [], links: [], memberships: [] }
    snapshotData: text("snapshot_data").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_graph_snapshots_session").on(table.sessionId),
    index("idx_graph_snapshots_created_at").on(table.createdAt),
  ],
);

export const insertGraphSnapshotSchema = createInsertSchema(graphSnapshots);
export const selectGraphSnapshotSchema = createSelectSchema(graphSnapshots);

export const createGraphSnapshotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type GraphSnapshot = typeof graphSnapshots.$inferSelect;
export type NewGraphSnapshot = typeof graphSnapshots.$inferInsert;
export type CreateGraphSnapshot = z.infer<typeof createGraphSnapshotSchema>;

// Type for the parsed snapshot data
export interface GraphSnapshotData {
  blocks: Array<{
    id: string;
    sessionId: string;
    ideaId: string | null;
    type: string;
    title: string | null;
    content: string;
    properties: string | null;
    status: string | null;
    confidence: number | null;
    abstractionLevel: string | null;
    createdAt: string;
    updatedAt: string;
    extractedFromMessageId: string | null;
    artifactId: string | null;
  }>;
  links: Array<{
    id: string;
    sessionId: string;
    sourceBlockId: string;
    targetBlockId: string;
    linkType: string;
    degree: string | null;
    confidence: number | null;
    reason: string | null;
    status: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  memberships: Array<{
    blockId: string;
    graphType: string;
    createdAt: string;
  }>;
}

// Summary type for listing snapshots (without full data)
export interface GraphSnapshotSummary {
  id: string;
  sessionId: string;
  name: string;
  description: string | null;
  blockCount: number;
  linkCount: number;
  createdAt: string;
}
