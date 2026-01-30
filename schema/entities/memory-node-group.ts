/**
 * Memory Node Group Entity
 *
 * Clusters of related blocks that share a theme. Enables "Level 1" querying
 * for graph exploration and context retrieval.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { ideas } from "./idea.js";
import { memoryBlocks } from "./memory-block.js";

export const memoryNodeGroups = sqliteTable(
  "memory_node_groups",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    sessionId: text("session_id"),
    name: text("name").notNull(),
    summary: text("summary"),
    theme: text("theme"),
    blockCount: integer("block_count").default(0),
    avgConfidence: real("avg_confidence"),
    dominantBlockTypes: text("dominant_block_types"), // JSON array of most common types
    keyInsights: text("key_insights"), // JSON array of top 3 insight summaries
    primaryGraphMembership: text("primary_graph_membership"),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index("idx_node_groups_idea").on(table.ideaId, table.version)],
);

export const memoryNodeGroupBlocks = sqliteTable(
  "memory_node_group_blocks",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => memoryNodeGroups.id, { onDelete: "cascade" }),
    blockId: text("block_id")
      .notNull()
      .references(() => memoryBlocks.id, { onDelete: "cascade" }),
    createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.blockId] }),
    index("idx_node_group_blocks_block").on(table.blockId),
  ],
);

export const insertMemoryNodeGroupSchema = createInsertSchema(memoryNodeGroups);
export const selectMemoryNodeGroupSchema = createSelectSchema(memoryNodeGroups);

export const updateMemoryNodeGroupSchema = z.object({
  name: z.string().optional(),
  summary: z.string().optional().nullable(),
  theme: z.string().optional().nullable(),
  blockCount: z.number().optional(),
  avgConfidence: z.number().optional().nullable(),
  dominantBlockTypes: z.string().optional().nullable(),
  keyInsights: z.string().optional().nullable(),
  primaryGraphMembership: z.string().optional().nullable(),
  updatedAt: z.string().optional(),
});

export const insertMemoryNodeGroupBlockSchema = createInsertSchema(
  memoryNodeGroupBlocks,
);
export const selectMemoryNodeGroupBlockSchema = createSelectSchema(
  memoryNodeGroupBlocks,
);

export type MemoryNodeGroup = typeof memoryNodeGroups.$inferSelect;
export type NewMemoryNodeGroup = typeof memoryNodeGroups.$inferInsert;
export type UpdateMemoryNodeGroup = z.infer<typeof updateMemoryNodeGroupSchema>;

export type MemoryNodeGroupBlock = typeof memoryNodeGroupBlocks.$inferSelect;
export type NewMemoryNodeGroupBlock = typeof memoryNodeGroupBlocks.$inferInsert;
