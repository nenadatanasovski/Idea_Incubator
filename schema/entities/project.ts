/**
 * Project Entity
 *
 * Represents a formal project that bridges Ideas (ideation) and Tasks (execution).
 * Projects provide the organizational container for continuous development.
 */

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Project status enum values
export const projectStatuses = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

// Table definition
export const projects = sqliteTable(
  "projects",
  {
    // Primary key
    id: text("id").primaryKey(),

    // Identity
    slug: text("slug").notNull().unique(),
    code: text("code").notNull().unique(), // 2-4 char uppercase code for display IDs

    // Core fields
    name: text("name").notNull(),
    description: text("description"),

    // Relationships
    ideaId: text("idea_id").unique(), // 1:1 with ideas
    ownerId: text("owner_id"),

    // Status
    status: text("status", { enum: projectStatuses })
      .notNull()
      .default("active"),

    // Timestamps
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_projects_status").on(table.status),
    index("idx_projects_idea_id").on(table.ideaId),
    index("idx_projects_owner_id").on(table.ownerId),
  ],
);

// Auto-generated Zod schemas from Drizzle table
export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);

// Manual update schema (partial insert without id/timestamps)
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(projectStatuses).optional(),
  ownerId: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
});

// TypeScript types
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
