/**
 * Task Relationship Entity
 *
 * Dependencies and relationships between tasks.
 */

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tasks } from "./task.js";

export const relationshipTypes = [
  "depends_on",
  "blocks",
  "related_to",
  "duplicate_of",
  "parent_of",
  "child_of",
  "supersedes",
  "implements",
  "conflicts_with",
  "enables",
  "inspired_by",
  "tests",
] as const;

export type RelationshipType = (typeof relationshipTypes)[number];

export const taskRelationships = sqliteTable(
  "task_relationships",
  {
    id: text("id").primaryKey(),
    sourceTaskId: text("source_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    targetTaskId: text("target_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type", {
      enum: relationshipTypes,
    }).notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_task_rel_source").on(table.sourceTaskId),
    index("idx_task_rel_target").on(table.targetTaskId),
    index("idx_task_rel_type").on(table.relationshipType),
  ],
);

export const insertTaskRelationshipSchema =
  createInsertSchema(taskRelationships);
export const selectTaskRelationshipSchema =
  createSelectSchema(taskRelationships);

export const createTaskRelationshipSchema = z.object({
  sourceTaskId: z.string().uuid(),
  targetTaskId: z.string().uuid(),
  relationshipType: z.enum(relationshipTypes),
});

export type TaskRelationship = typeof taskRelationships.$inferSelect;
export type NewTaskRelationship = typeof taskRelationships.$inferInsert;
export type CreateTaskRelationship = z.infer<
  typeof createTaskRelationshipSchema
>;
