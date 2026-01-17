/**
 * Template for creating new schema entities.
 *
 * WORKFLOW:
 * 1. Copy this file to schema/entities/{entity-name}.ts
 * 2. Define the table using sqliteTable()
 * 3. Create Zod schemas with createInsertSchema/createSelectSchema
 * 4. Export types using $inferSelect and $inferInsert
 * 5. Add to schema/registry.ts
 * 6. Run: npm run schema:generate
 * 7. Run: npm run schema:migrate
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// 1. Table Definition (Source of Truth)
export const myEntities = sqliteTable("my_entities", {
  // Primary key (always UUID as text)
  id: text("id").primaryKey(),

  // Required fields
  name: text("name").notNull(),

  // Optional fields with defaults
  status: text("status", { enum: ["active", "inactive"] }).default("active"),

  // Numeric fields
  count: integer("count").default(0),
  score: real("score"),

  // Timestamps (always as TEXT in SQLite)
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at"),
});

// 2. Auto-generated Zod Schemas
// Note: drizzle-zod generates these automatically from the table definition
export const insertMyEntitySchema = createInsertSchema(myEntities);
export const selectMyEntitySchema = createSelectSchema(myEntities);

// 3. Manual update schema (for partial updates)
export const updateMyEntitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  count: z.number().int().optional(),
  score: z.number().min(0).max(100).optional().nullable(),
});

// 4. Auto-inferred TypeScript Types
export type MyEntity = typeof myEntities.$inferSelect;
export type NewMyEntity = typeof myEntities.$inferInsert;
export type UpdateMyEntity = z.infer<typeof updateMyEntitySchema>;
