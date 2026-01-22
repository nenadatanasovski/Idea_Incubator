/**
 * Memory Graph Membership Entity
 *
 * Junction table for block-to-graph-type assignments.
 */

import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { memoryBlocks } from "./memory-block.js";

export const graphTypes = [
  "problem",
  "solution",
  "market",
  "risk",
  "fit",
  "business",
  "spec",
] as const;

export type GraphType = (typeof graphTypes)[number];

export const memoryGraphMemberships = sqliteTable(
  "memory_graph_memberships",
  {
    blockId: text("block_id")
      .notNull()
      .references(() => memoryBlocks.id, { onDelete: "cascade" }),
    graphType: text("graph_type", { enum: graphTypes }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    primaryKey({ columns: [table.blockId, table.graphType] }),
    index("idx_memory_graph_memberships_graph").on(table.graphType),
  ],
);

export const insertMemoryGraphMembershipSchema = createInsertSchema(
  memoryGraphMemberships,
);
export const selectMemoryGraphMembershipSchema = createSelectSchema(
  memoryGraphMemberships,
);

export type MemoryGraphMembership = typeof memoryGraphMemberships.$inferSelect;
export type NewMemoryGraphMembership =
  typeof memoryGraphMemberships.$inferInsert;
