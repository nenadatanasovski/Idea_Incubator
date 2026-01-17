/**
 * Idea Entity
 *
 * Core idea entity for the incubation system.
 */

import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const ideaTypes = [
  "business",
  "creative",
  "technical",
  "personal",
  "research",
] as const;

export const lifecycleStages = [
  "SPARK",
  "CLARIFY",
  "RESEARCH",
  "IDEATE",
  "EVALUATE",
  "VALIDATE",
  "DESIGN",
  "PROTOTYPE",
  "TEST",
  "REFINE",
  "BUILD",
  "LAUNCH",
  "GROW",
  "MAINTAIN",
  "PIVOT",
  "PAUSE",
  "SUNSET",
  "ARCHIVE",
  "ABANDONED",
] as const;

export type IdeaType = (typeof ideaTypes)[number];
export type LifecycleStage = (typeof lifecycleStages)[number];

export const ideas = sqliteTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    ideaType: text("idea_type", { enum: ideaTypes }),
    lifecycleStage: text("lifecycle_stage", { enum: lifecycleStages }).default(
      "SPARK",
    ),
    contentHash: text("content_hash"),
    folderPath: text("folder_path").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("idx_ideas_lifecycle").on(table.lifecycleStage),
    index("idx_ideas_type").on(table.ideaType),
  ],
);

export const insertIdeaSchema = createInsertSchema(ideas);
export const selectIdeaSchema = createSelectSchema(ideas);

export const updateIdeaSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  summary: z.string().max(5000).optional().nullable(),
  ideaType: z.enum(ideaTypes).optional().nullable(),
  lifecycleStage: z.enum(lifecycleStages).optional(),
  contentHash: z.string().optional().nullable(),
});

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
export type UpdateIdea = z.infer<typeof updateIdeaSchema>;
