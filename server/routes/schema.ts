/**
 * Schema Discovery API Routes
 *
 * Provides programmatic access to the schema registry.
 * See: /api/schema for full documentation
 */

import { Router } from "express";
import { asyncHandler, respond } from "./shared.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  schemaRegistry,
  getEntity,
  getEntityNames,
  getEnum,
  getEnumNames,
  getRelationshipsForEntity,
} from "../../schema/index.js";

const router = Router();

/**
 * GET /api/schema
 * Overview of available schema endpoints
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const entityNames = getEntityNames();
    const enumNames = getEnumNames();

    respond(res, {
      version: schemaRegistry.version,
      generatedAt: schemaRegistry.generatedAt,
      summary: {
        entityCount: entityNames.length,
        enumCount: enumNames.length,
        relationshipCount: schemaRegistry.relationships.length,
      },
      entities: entityNames,
      enums: enumNames,
      endpoints: {
        "/api/schema": "This overview",
        "/api/schema/entities": "List all entities with metadata",
        "/api/schema/entities/:name": "Get specific entity JSON Schema",
        "/api/schema/enums": "Get all enum definitions",
        "/api/schema/enums/:name": "Get specific enum values",
        "/api/schema/relationships": "Get entity relationship graph",
        "/api/schema/full":
          "Full schema dump (all entities, enums, relationships)",
      },
    });
  }),
);

/**
 * GET /api/schema/entities
 * List all entities with metadata
 */
router.get(
  "/entities",
  asyncHandler(async (_req, res) => {
    const entities = Object.entries(schemaRegistry.entities).map(
      ([key, entity]) => ({
        key,
        name: entity.name,
        table: entity.table,
        description: entity.description,
        file: entity.file,
        primaryKey: entity.primaryKey,
        foreignKeyCount: entity.foreignKeys.length,
      }),
    );

    respond(res, { entities });
  }),
);

/**
 * GET /api/schema/entities/:name
 * Get specific entity with full JSON Schema
 */
router.get(
  "/entities/:name",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const entity = getEntity(name);

    if (!entity) {
      res.status(404).json({
        error: `Entity '${name}' not found`,
        available: getEntityNames(),
      });
      return;
    }

    // Load schemas dynamically
    const [selectSchema, insertSchema] = await Promise.all([
      entity.selectSchema(),
      entity.insertSchema(),
    ]);

    // Convert Zod schemas to JSON Schema
    const selectJsonSchema = zodToJsonSchema(selectSchema, {
      name: `${entity.name}Select`,
      $refStrategy: "none",
    });
    const insertJsonSchema = zodToJsonSchema(insertSchema, {
      name: `${entity.name}Insert`,
      $refStrategy: "none",
    });

    respond(res, {
      name: entity.name,
      table: entity.table,
      description: entity.description,
      file: entity.file,
      primaryKey: entity.primaryKey,
      foreignKeys: entity.foreignKeys,
      relationships: getRelationshipsForEntity(name),
      schemas: {
        select: selectJsonSchema,
        insert: insertJsonSchema,
      },
    });
  }),
);

/**
 * GET /api/schema/enums
 * Get all enum definitions
 */
router.get(
  "/enums",
  asyncHandler(async (_req, res) => {
    const enums = Object.entries(schemaRegistry.enums).map(
      ([name, values]) => ({
        name,
        valueCount: values.length,
        values: [...values],
      }),
    );

    respond(res, { enums });
  }),
);

/**
 * GET /api/schema/enums/:name
 * Get specific enum values
 */
router.get(
  "/enums/:name",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const values = getEnum(name);

    if (!values) {
      res.status(404).json({
        error: `Enum '${name}' not found`,
        available: getEnumNames(),
      });
      return;
    }

    respond(res, {
      name,
      valueCount: values.length,
      values: [...values],
    });
  }),
);

/**
 * GET /api/schema/relationships
 * Get entity relationship graph
 */
router.get(
  "/relationships",
  asyncHandler(async (_req, res) => {
    const { relationships } = schemaRegistry;

    // Build adjacency list for graph visualization
    const graph: Record<string, Array<{ to: string; type: string }>> = {};
    for (const rel of relationships) {
      if (!graph[rel.from]) graph[rel.from] = [];
      graph[rel.from].push({ to: rel.to, type: rel.type });
    }

    respond(res, {
      relationships,
      graph,
      summary: {
        total: relationships.length,
        oneToOne: relationships.filter((r) => r.type === "one-to-one").length,
        oneToMany: relationships.filter((r) => r.type === "one-to-many").length,
        manyToMany: relationships.filter((r) => r.type === "many-to-many")
          .length,
      },
    });
  }),
);

/**
 * GET /api/schema/full
 * Full schema dump with all entities, enums, and relationships
 */
router.get(
  "/full",
  asyncHandler(async (_req, res) => {
    // Load all entity schemas
    const entitiesWithSchemas = await Promise.all(
      Object.entries(schemaRegistry.entities).map(async ([key, entity]) => {
        const [selectSchema, insertSchema] = await Promise.all([
          entity.selectSchema(),
          entity.insertSchema(),
        ]);

        return {
          key,
          name: entity.name,
          table: entity.table,
          description: entity.description,
          file: entity.file,
          primaryKey: entity.primaryKey,
          foreignKeys: entity.foreignKeys,
          schemas: {
            select: zodToJsonSchema(selectSchema, {
              name: `${entity.name}Select`,
              $refStrategy: "none",
            }),
            insert: zodToJsonSchema(insertSchema, {
              name: `${entity.name}Insert`,
              $refStrategy: "none",
            }),
          },
        };
      }),
    );

    respond(res, {
      version: schemaRegistry.version,
      generatedAt: schemaRegistry.generatedAt,
      entities: entitiesWithSchemas,
      enums: Object.entries(schemaRegistry.enums).map(([name, values]) => ({
        name,
        values: [...values],
      })),
      relationships: schemaRegistry.relationships,
    });
  }),
);

export default router;
