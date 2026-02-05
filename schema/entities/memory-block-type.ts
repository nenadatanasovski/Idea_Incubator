/**
 * Memory Block Type Entity
 *
 * Junction table for block-to-block-type assignments (many-to-many).
 */

import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { memoryBlocks } from "./memory-block.js";

/**
 * ARCH-001: 9 canonical block types
 * 
 * Consolidated from 21 organic types. See ARCH-001-TYPE-MAPPING.md for migration.
 */
export const canonicalBlockTypes = [
  "knowledge",    // Verified facts, patterns, insights (was: insight, fact, pattern, synthesis, learning, persona)
  "decision",     // Choices made with rationale (was: decision, option)
  "assumption",   // Unverified beliefs to test
  "question",     // Open unknowns to investigate
  "requirement",  // Constraints, must-haves (was: requirement, constraint)
  "task",         // Work items, actions (was: action, task, story, bug, epic, blocker, milestone)
  "proposal",     // Suggested changes awaiting approval
  "artifact",     // Outputs (code, docs, specs)
  "evidence",     // Validation data, proof (was: evaluation)
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
