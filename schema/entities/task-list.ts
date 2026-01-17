/**
 * Task List Entity (v2)
 *
 * Container for organizing tasks within a project.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { projects } from "./project.js";

export const taskListStatuses = [
  "draft",
  "ready",
  "in_progress",
  "paused",
  "completed",
  "archived",
] as const;

export type TaskListStatus = (typeof taskListStatuses)[number];

export const taskListsV2 = sqliteTable(
  "task_lists_v2",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    projectId: text("project_id").references(() => projects.id),

    status: text("status", { enum: taskListStatuses })
      .notNull()
      .default("draft"),

    // Execution config
    maxParallelAgents: integer("max_parallel_agents").default(3),
    autoExecute: integer("auto_execute").default(0),

    // Statistics
    totalTasks: integer("total_tasks").default(0),
    completedTasks: integer("completed_tasks").default(0),
    failedTasks: integer("failed_tasks").default(0),

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
    index("idx_task_lists_v2_project").on(table.projectId),
    index("idx_task_lists_v2_status").on(table.status),
  ],
);

export const insertTaskListSchema = createInsertSchema(taskListsV2);
export const selectTaskListSchema = createSelectSchema(taskListsV2);

export const updateTaskListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(taskListStatuses).optional(),
  maxParallelAgents: z.number().int().min(1).max(10).optional(),
  autoExecute: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type TaskList = typeof taskListsV2.$inferSelect;
export type NewTaskList = typeof taskListsV2.$inferInsert;
export type UpdateTaskList = z.infer<typeof updateTaskListSchema>;
