/**
 * PRD (Product Requirements Document) Entity
 *
 * PRDs define requirements that link to task lists and tasks.
 */

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./project.js";

export const prdStatuses = ["draft", "review", "approved", "archived"] as const;

export type PrdStatus = (typeof prdStatuses)[number];

export const prds = sqliteTable(
  "prds",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),

    userId: text("user_id").notNull(),
    projectId: text("project_id").references(() => projects.id),
    parentPrdId: text("parent_prd_id"),

    problemStatement: text("problem_statement"),
    targetUsers: text("target_users"),
    functionalDescription: text("functional_description"),

    // JSON arrays stored as text
    successCriteria: text("success_criteria").notNull().default("[]"),
    constraints: text("constraints").notNull().default("[]"),
    outOfScope: text("out_of_scope").notNull().default("[]"),

    status: text("status", { enum: prdStatuses }).notNull().default("draft"),

    approvedAt: text("approved_at"),
    approvedBy: text("approved_by"),

    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_prds_project").on(table.projectId),
    index("idx_prds_status").on(table.status),
    index("idx_prds_parent").on(table.parentPrdId),
  ],
);

export const insertPrdSchema = createInsertSchema(prds);
export const selectPrdSchema = createSelectSchema(prds);

export const updatePrdSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  problemStatement: z.string().max(5000).optional().nullable(),
  targetUsers: z.string().max(2000).optional().nullable(),
  functionalDescription: z.string().max(10000).optional().nullable(),
  successCriteria: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  outOfScope: z.array(z.string()).optional(),
  status: z.enum(prdStatuses).optional(),
});

export type PRD = typeof prds.$inferSelect;
export type NewPRD = typeof prds.$inferInsert;
export type UpdatePRD = z.infer<typeof updatePrdSchema>;
