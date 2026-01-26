/**
 * Node Group Report Entity
 *
 * Stores AI-synthesized reports for connected node groups in the memory graph.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const reportStatuses = ["current", "stale"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export const nodeGroupReports = sqliteTable(
  "node_group_reports",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),

    // Group identification
    nodeIds: text("node_ids").notNull(), // JSON array of node IDs
    groupHash: text("group_hash").notNull(),
    groupName: text("group_name"),

    // Report sections (AI-generated)
    overview: text("overview"),
    keyThemes: text("key_themes"), // JSON array
    story: text("story"),
    relationshipsToGroups: text("relationships_to_groups"), // JSON
    openQuestions: text("open_questions"), // JSON array
    nodesSummary: text("nodes_summary"), // JSON array

    // Metadata
    status: text("status", { enum: reportStatuses })
      .notNull()
      .default("current"),
    nodeCount: integer("node_count").notNull(),
    edgeCount: integer("edge_count").notNull(),
    generatedAt: text("generated_at").$defaultFn(() =>
      new Date().toISOString(),
    ),
    generationDurationMs: integer("generation_duration_ms"),
    modelUsed: text("model_used"),
  },
  (table) => [
    index("idx_node_group_reports_session").on(table.sessionId),
    index("idx_node_group_reports_status").on(table.status),
    index("idx_node_group_reports_hash").on(table.groupHash),
    uniqueIndex("idx_node_group_reports_unique").on(
      table.sessionId,
      table.groupHash,
    ),
  ],
);

export const insertNodeGroupReportSchema = createInsertSchema(nodeGroupReports);
export const selectNodeGroupReportSchema = createSelectSchema(nodeGroupReports);

export const updateNodeGroupReportSchema = z.object({
  groupName: z.string().optional().nullable(),
  overview: z.string().optional().nullable(),
  keyThemes: z.string().optional().nullable(),
  story: z.string().optional().nullable(),
  relationshipsToGroups: z.string().optional().nullable(),
  openQuestions: z.string().optional().nullable(),
  nodesSummary: z.string().optional().nullable(),
  status: z.enum(reportStatuses).optional(),
  generatedAt: z.string().optional().nullable(),
  generationDurationMs: z.number().optional().nullable(),
  modelUsed: z.string().optional().nullable(),
});

// Typed JSON structures for report sections
export interface NodeSummaryItem {
  nodeId: string;
  title: string;
  oneLiner: string;
}

export interface GroupRelationship {
  groupHash: string;
  groupName: string;
  relationship: string;
}

export type NodeGroupReport = typeof nodeGroupReports.$inferSelect;
export type NewNodeGroupReport = typeof nodeGroupReports.$inferInsert;
export type UpdateNodeGroupReport = z.infer<typeof updateNodeGroupReportSchema>;
