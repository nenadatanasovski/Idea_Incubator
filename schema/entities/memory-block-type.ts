/**
 * Memory Block Type Entity
 *
 * Junction table for block-to-block-type assignments (many-to-many).
 */

import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { memoryBlocks } from "./memory-block.js";

export const canonicalBlockTypes = [
  // Core types (11)
  "insight",
  "fact",
  "assumption",
  "question",
  "decision",
  "action",
  "requirement",
  "option",
  "pattern",
  "synthesis",
  "meta",
  // New types (10)
  "constraint", // Limitations, boundaries, non-negotiables
  "blocker", // Active blockers preventing progress
  "epic", // Large body of work (task management)
  "story", // User story / feature request
  "task", // Specific work item
  "bug", // Defect or issue
  "persona", // Customer persona definition
  "milestone", // Timeline marker / deadline
  "evaluation", // Evaluation result (score, rationale)
  "learning", // SIA-extracted gotcha or pattern
] as const;

export type CanonicalBlockType = (typeof canonicalBlockTypes)[number];

export const memoryBlockTypes = sqliteTable(
  "memory_block_types",
  {
    blockId: text("block_id")
      .notNull()
      .references(() => memoryBlocks.id, { onDelete: "cascade" }),
    blockType: text("block_type").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    primaryKey({ columns: [table.blockId, table.blockType] }),
    index("idx_memory_block_types_type").on(table.blockType),
  ],
);

export const insertMemoryBlockTypeSchema = createInsertSchema(memoryBlockTypes);
export const selectMemoryBlockTypeSchema = createSelectSchema(memoryBlockTypes);

export type MemoryBlockType = typeof memoryBlockTypes.$inferSelect;
export type NewMemoryBlockType = typeof memoryBlockTypes.$inferInsert;
