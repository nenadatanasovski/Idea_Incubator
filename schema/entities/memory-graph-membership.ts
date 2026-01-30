/**
 * Memory Graph Membership Entity
 *
 * Junction table for block-to-graph-type assignments.
 */

import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { memoryBlocks } from "./memory-block.js";

export const graphTypes = [
  // Core dimensions (10)
  "problem",
  "solution",
  "market",
  "risk",
  "fit",
  "business",
  "spec",
  "distribution",
  "marketing",
  "manufacturing",
  // New dimensions (7)
  "user", // Founder/builder profile (skills, constraints, preferences)
  "competition", // Competitive landscape analysis
  "validation", // Experiments, tests, proof points
  "tasks", // Task management (epics, stories, bugs)
  "timeline", // Phases, milestones, deadlines
  "customer", // Target customer profiles/personas
  "product", // Current product state (live, not pending changes)
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
