/**
 * Schema Registry
 *
 * Central registry for all schema entities, enums, and relationships.
 * This is the machine-readable manifest that enables programmatic discovery.
 */

import type { ZodTypeAny } from "zod";

// ============================================
// Registry Types
// ============================================

export interface EntityMetadata {
  /** Entity name (PascalCase) */
  name: string;
  /** Source file path */
  file: string;
  /** Database table name */
  table: string;
  /** Human-readable description */
  description: string;
  /** Primary key column name */
  primaryKey: string;
  /** Foreign key relationships */
  foreignKeys: Array<{
    column: string;
    references: { table: string; column: string };
  }>;
  /** Lazy loader for select schema */
  selectSchema: () => Promise<ZodTypeAny>;
  /** Lazy loader for insert schema */
  insertSchema: () => Promise<ZodTypeAny>;
}

export interface SchemaRegistry {
  /** Schema version */
  version: string;
  /** Generation timestamp */
  generatedAt: string;
  /** All registered entities */
  entities: Record<string, EntityMetadata>;
  /** All registered enums */
  enums: Record<string, readonly string[]>;
  /** Entity relationships */
  relationships: Array<{
    from: string;
    to: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
    through?: string;
  }>;
}

// ============================================
// Enum Imports
// ============================================

import {
  taskStatuses,
  taskCategories,
  taskPriorities,
  taskEfforts,
  taskOwners,
} from "./entities/task.js";
import { taskListStatuses } from "./entities/task-list.js";
import { projectStatuses } from "./entities/project.js";
import { ideaTypes, lifecycleStages } from "./entities/idea.js";
import { relationshipTypes } from "./entities/task-relationship.js";
import { prdStatuses } from "./entities/prd.js";

// ============================================
// Schema Registry Instance
// ============================================

export const schemaRegistry: SchemaRegistry = {
  version: "1.0.0",
  generatedAt: new Date().toISOString(),

  entities: {
    // Wave 1: Base tables
    idea: {
      name: "Idea",
      file: "schema/entities/idea.ts",
      table: "ideas",
      description: "Core idea entity for the incubation system",
      primaryKey: "id",
      foreignKeys: [],
      selectSchema: async () => {
        const { selectIdeaSchema } = await import("./entities/idea.js");
        return selectIdeaSchema as ZodTypeAny;
      },
      insertSchema: async () => {
        const { insertIdeaSchema } = await import("./entities/idea.js");
        return insertIdeaSchema as ZodTypeAny;
      },
    },
    project: {
      name: "Project",
      file: "schema/entities/project.ts",
      table: "projects",
      description: "Formal project bridging Ideas and Tasks",
      primaryKey: "id",
      foreignKeys: [
        { column: "idea_id", references: { table: "ideas", column: "id" } },
      ],
      selectSchema: async () => {
        const { selectProjectSchema } = await import("./entities/project.js");
        return selectProjectSchema as ZodTypeAny;
      },
      insertSchema: async () => {
        const { insertProjectSchema } = await import("./entities/project.js");
        return insertProjectSchema as ZodTypeAny;
      },
    },

    // Wave 2: First-level dependencies
    taskList: {
      name: "TaskList",
      file: "schema/entities/task-list.ts",
      table: "task_lists_v2",
      description: "Container for organizing tasks within a project",
      primaryKey: "id",
      foreignKeys: [
        {
          column: "project_id",
          references: { table: "projects", column: "id" },
        },
      ],
      selectSchema: async () => {
        const { selectTaskListSchema } =
          await import("./entities/task-list.js");
        return selectTaskListSchema as ZodTypeAny;
      },
      insertSchema: async () => {
        const { insertTaskListSchema } =
          await import("./entities/task-list.js");
        return insertTaskListSchema as ZodTypeAny;
      },
    },
    prd: {
      name: "PRD",
      file: "schema/entities/prd.ts",
      table: "prds",
      description: "Product Requirements Document defining requirements",
      primaryKey: "id",
      foreignKeys: [
        {
          column: "project_id",
          references: { table: "projects", column: "id" },
        },
        {
          column: "parent_prd_id",
          references: { table: "prds", column: "id" },
        },
      ],
      selectSchema: async () => {
        const { selectPrdSchema } = await import("./entities/prd.js");
        return selectPrdSchema as ZodTypeAny;
      },
      insertSchema: async () => {
        const { insertPrdSchema } = await import("./entities/prd.js");
        return insertPrdSchema as ZodTypeAny;
      },
    },

    // Wave 3: Tasks
    task: {
      name: "Task",
      file: "schema/entities/task.ts",
      table: "tasks",
      description: "Core task entity for the parallel execution system",
      primaryKey: "id",
      foreignKeys: [
        {
          column: "task_list_id",
          references: { table: "task_lists_v2", column: "id" },
        },
        {
          column: "project_id",
          references: { table: "projects", column: "id" },
        },
      ],
      selectSchema: async () => {
        const { selectTaskSchema } = await import("./entities/task.js");
        return selectTaskSchema as ZodTypeAny;
      },
      insertSchema: async () => {
        const { insertTaskSchema } = await import("./entities/task.js");
        return insertTaskSchema as ZodTypeAny;
      },
    },
    taskRelationship: {
      name: "TaskRelationship",
      file: "schema/entities/task-relationship.ts",
      table: "task_relationships",
      description: "Dependencies and relationships between tasks",
      primaryKey: "id",
      foreignKeys: [
        {
          column: "source_task_id",
          references: { table: "tasks", column: "id" },
        },
        {
          column: "target_task_id",
          references: { table: "tasks", column: "id" },
        },
      ],
      selectSchema: async () => {
        const { selectTaskRelationshipSchema } =
          await import("./entities/task-relationship.js");
        return selectTaskRelationshipSchema as ZodTypeAny;
      },
      insertSchema: async () => {
        const { insertTaskRelationshipSchema } =
          await import("./entities/task-relationship.js");
        return insertTaskRelationshipSchema as ZodTypeAny;
      },
    },
  },

  enums: {
    // Idea enums
    ideaType: ideaTypes,
    lifecycleStage: lifecycleStages,

    // Project enums
    projectStatus: projectStatuses,

    // Task enums
    taskStatus: taskStatuses,
    taskCategory: taskCategories,
    taskPriority: taskPriorities,
    taskEffort: taskEfforts,
    taskOwner: taskOwners,

    // Task list enums
    taskListStatus: taskListStatuses,

    // Relationship enums
    relationshipType: relationshipTypes,

    // PRD enums
    prdStatus: prdStatuses,
  },

  relationships: [
    // Project relationships
    { from: "project", to: "idea", type: "one-to-one" },
    { from: "taskList", to: "project", type: "many-to-many" },
    { from: "prd", to: "project", type: "many-to-many" },
    { from: "prd", to: "prd", type: "one-to-many" }, // parent-child

    // Task relationships
    { from: "task", to: "taskList", type: "many-to-many" },
    { from: "task", to: "project", type: "many-to-many" },
    { from: "taskRelationship", to: "task", type: "many-to-many" },
  ],
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get entity metadata by name
 */
export function getEntity(name: string): EntityMetadata | undefined {
  return schemaRegistry.entities[name];
}

/**
 * Get all entity names
 */
export function getEntityNames(): string[] {
  return Object.keys(schemaRegistry.entities);
}

/**
 * Get enum values by name
 */
export function getEnum(name: string): readonly string[] | undefined {
  return schemaRegistry.enums[name];
}

/**
 * Get all enum names
 */
export function getEnumNames(): string[] {
  return Object.keys(schemaRegistry.enums);
}

/**
 * Get relationships for an entity
 */
export function getRelationshipsForEntity(entityName: string) {
  return schemaRegistry.relationships.filter(
    (r) => r.from === entityName || r.to === entityName,
  );
}
