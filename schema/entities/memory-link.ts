/**
 * Memory Link Entity
 *
 * Stores relationships between memory blocks (edges in the graph).
 */

import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { memoryBlocks } from "./memory-block.js";

export const linkTypes = [
  "addresses",
  "creates",
  "requires",
  "conflicts",
  "supports",
  "depends_on",
  "enables",
  "suggests",
  "supersedes",
  "validates",
  "invalidates",
  "references",
  "evidence_for",
  "elaborates",
  "refines",
  "specializes",
  "alternative_to",
  "instance_of",
  "constrained_by",
  "derived_from",
  "measured_by",
] as const;

export const linkDegrees = ["full", "partial", "minimal"] as const;

export const linkStatuses = ["active", "superseded", "removed"] as const;

export type LinkType = (typeof linkTypes)[number];
export type LinkDegree = (typeof linkDegrees)[number];
export type LinkStatus = (typeof linkStatuses)[number];

export const memoryLinks = sqliteTable(
  "memory_links",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    sourceBlockId: text("source_block_id")
      .notNull()
      .references(() => memoryBlocks.id, { onDelete: "cascade" }),
    targetBlockId: text("target_block_id")
      .notNull()
      .references(() => memoryBlocks.id, { onDelete: "cascade" }),
    linkType: text("link_type", { enum: linkTypes }).notNull(),
    degree: text("degree", { enum: linkDegrees }),
    confidence: real("confidence"),
    reason: text("reason"),
    status: text("status", { enum: linkStatuses }).default("active"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_memory_links_session").on(table.sessionId),
    index("idx_memory_links_source").on(table.sourceBlockId),
    index("idx_memory_links_target").on(table.targetBlockId),
    index("idx_memory_links_type").on(table.linkType),
  ],
);

export const insertMemoryLinkSchema = createInsertSchema(memoryLinks);
export const selectMemoryLinkSchema = createSelectSchema(memoryLinks);

export const updateMemoryLinkSchema = z.object({
  linkType: z.enum(linkTypes).optional(),
  degree: z.enum(linkDegrees).optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  reason: z.string().optional().nullable(),
  status: z.enum(linkStatuses).optional(),
});

export type MemoryLink = typeof memoryLinks.$inferSelect;
export type NewMemoryLink = typeof memoryLinks.$inferInsert;
export type UpdateMemoryLink = z.infer<typeof updateMemoryLinkSchema>;
