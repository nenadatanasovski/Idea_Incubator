/**
 * Task Entity
 *
 * Core task entity for the parallel execution system.
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { taskListsV2 } from "./task-list.js";
import { projects } from "./project.js";

export const taskCategories = [
  "feature",
  "bug",
  "task",
  "story",
  "epic",
  "spike",
  "improvement",
  "documentation",
  "test",
  "devops",
  "design",
  "research",
  "infrastructure",
  "security",
  "performance",
  "other",
] as const;

export const taskStatuses = [
  "draft",
  "evaluating",
  "pending",
  "in_progress",
  "completed",
  "failed",
  "blocked",
  "skipped",
] as const;

export const taskPriorities = ["P1", "P2", "P3", "P4"] as const;

export const taskEfforts = [
  "trivial",
  "small",
  "medium",
  "large",
  "epic",
] as const;

export const taskOwners = ["build_agent", "human", "task_agent"] as const;

export const taskQueues = ["evaluation"] as const;

export type TaskCategory = (typeof taskCategories)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];
export type TaskEffort = (typeof taskEfforts)[number];
export type TaskOwner = (typeof taskOwners)[number];
export type TaskQueue = (typeof taskQueues)[number] | null;

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    displayId: text("display_id").unique(),

    // Core fields
    title: text("title").notNull(),
    description: text("description"),
    category: text("category", { enum: taskCategories }).default("task"),

    // Status
    status: text("status", { enum: taskStatuses }).default("pending"),
    queue: text("queue"),

    // References
    taskListId: text("task_list_id").references(() => taskListsV2.id),
    projectId: text("project_id").references(() => projects.id),

    // Priority and effort
    priority: text("priority", { enum: taskPriorities }).default("P2"),
    effort: text("effort", { enum: taskEfforts }).default("medium"),

    // Ordering
    phase: integer("phase").default(1),
    position: integer("position").default(0),

    // Ownership
    owner: text("owner", { enum: taskOwners }).default("build_agent"),
    assignedAgentId: text("assigned_agent_id"),

    // Decomposition tracking
    parentTaskId: text("parent_task_id").references(
      (): ReturnType<typeof text> => tasks.id,
    ),
    isDecomposed: integer("is_decomposed").default(0),
    decompositionId: text("decomposition_id"),

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
    index("idx_tasks_display_id").on(table.displayId),
    index("idx_tasks_status").on(table.status),
    index("idx_tasks_queue").on(table.queue),
    index("idx_tasks_task_list_id").on(table.taskListId),
    index("idx_tasks_project_id").on(table.projectId),
    index("idx_tasks_priority").on(table.priority),
    index("idx_tasks_parent_task_id").on(table.parentTaskId),
    index("idx_tasks_decomposition_id").on(table.decompositionId),
  ],
);

export const insertTaskSchema = createInsertSchema(tasks);
export const selectTaskSchema = createSelectSchema(tasks);

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  category: z.enum(taskCategories).optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  effort: z.enum(taskEfforts).optional(),
  phase: z.number().int().min(1).optional(),
  position: z.number().int().min(0).optional(),
  owner: z.enum(taskOwners).optional(),
  assignedAgentId: z.string().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  isDecomposed: z.boolean().optional(),
  decompositionId: z.string().optional().nullable(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
