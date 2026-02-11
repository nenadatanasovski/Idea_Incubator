/**
 * Memory Block Entity
 *
 * Stores all graph nodes/blocks for the memory graph system.
 */

import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * ARCH-001: 9 canonical block types
 *
 * Consolidated from 15 organic types. See ARCH-001-TYPE-MAPPING.md for migration.
 */
export const blockTypes = [
  "knowledge", // Verified facts, patterns, insights (was: content, synthesis, pattern, derived, cycle, stakeholder_view)
  "decision", // Choices made with rationale (was: decision, option)
  "assumption", // Unverified beliefs to test
  "question", // Open unknowns to investigate (was: placeholder)
  "requirement", // Constraints, must-haves
  "task", // Work items, actions (was: action)
  "proposal", // Suggested changes awaiting approval
  "artifact", // Outputs (code, docs, specs)
  "evidence", // Validation data, proof (was: external)
] as const;

export const blockStatuses = [
  "draft",
  "active",
  "validated",
  "superseded",
  "abandoned",
] as const;

export const abstractionLevels = [
  "vision",
  "strategy",
  "tactic",
  "implementation",
] as const;

export type BlockType = (typeof blockTypes)[number];
export type BlockStatus = (typeof blockStatuses)[number];
export type AbstractionLevel = (typeof abstractionLevels)[number];

export const memoryBlocks = sqliteTable(
  "memory_blocks",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    ideaId: text("idea_id"),
    type: text("type", { enum: blockTypes }).notNull(),
    title: text("title"), // Short 3-5 word summary for quick identification
    content: text("content").notNull(),
    properties: text("properties"), // JSON stored as text
    status: text("status", { enum: blockStatuses }).default("active"),
    confidence: real("confidence"),
    abstractionLevel: text("abstraction_level", { enum: abstractionLevels }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    extractedFromMessageId: text("extracted_from_message_id"),
    artifactId: text("artifact_id"),
  },
  (table) => [
    index("idx_memory_blocks_session").on(table.sessionId),
    index("idx_memory_blocks_idea").on(table.ideaId),
    index("idx_memory_blocks_type").on(table.type),
    index("idx_memory_blocks_status").on(table.status),
    index("idx_memory_blocks_artifact").on(table.artifactId),
    index("idx_memory_blocks_title").on(table.title),
  ],
);

export const insertMemoryBlockSchema = createInsertSchema(memoryBlocks);
export const selectMemoryBlockSchema = createSelectSchema(memoryBlocks);

export const updateMemoryBlockSchema = z.object({
  type: z.enum(blockTypes).optional(),
  title: z.string().max(100).optional().nullable(), // Short 3-5 word summary
  content: z.string().min(1).optional(),
  properties: z.string().optional().nullable(),
  status: z.enum(blockStatuses).optional(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  abstractionLevel: z.enum(abstractionLevels).optional().nullable(),
  artifactId: z.string().optional().nullable(),
});

export type MemoryBlock = typeof memoryBlocks.$inferSelect;
export type NewMemoryBlock = typeof memoryBlocks.$inferInsert;
export type UpdateMemoryBlock = z.infer<typeof updateMemoryBlockSchema>;
