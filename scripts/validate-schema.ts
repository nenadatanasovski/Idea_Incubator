/**
 * Schema Validation Script
 *
 * Validates that all entities in the schema registry are properly configured
 * and their Zod schemas can be loaded.
 *
 * Usage: npm run schema:validate
 */

import { schemaRegistry } from "../schema/registry.js";

async function validateSchema(): Promise<void> {
  console.log("=== Schema Validation ===\n");
  const errors: string[] = [];
  const warnings: string[] = [];

  // Track counts
  let entityCount = 0;
  let enumCount = 0;
  let relationshipCount = 0;

  // Validate all entities
  console.log("Validating entities...");
  for (const [name, entity] of Object.entries(schemaRegistry.entities)) {
    try {
      // Try to load schemas
      const selectSchema = await entity.selectSchema();
      const insertSchema = await entity.insertSchema();

      if (!selectSchema) {
        errors.push(`Entity ${name}: selectSchema returned undefined`);
      }
      if (!insertSchema) {
        errors.push(`Entity ${name}: insertSchema returned undefined`);
      }

      // Validate metadata
      if (!entity.table) {
        errors.push(`Entity ${name}: Missing table name`);
      }
      if (!entity.primaryKey) {
        errors.push(`Entity ${name}: Missing primary key`);
      }

      console.log(`  ✓ ${name} (${entity.table})`);
      entityCount++;
    } catch (e) {
      errors.push(`Entity ${name}: Failed to load schemas - ${e}`);
      console.log(`  ✗ ${name}: ${e}`);
    }
  }

  // Validate enums
  console.log("\nValidating enums...");
  for (const [name, values] of Object.entries(schemaRegistry.enums)) {
    if (!Array.isArray(values) || values.length === 0) {
      errors.push(`Enum ${name}: Must be a non-empty array`);
      console.log(`  ✗ ${name}: Invalid enum values`);
    } else {
      console.log(`  ✓ ${name} (${values.length} values)`);
      enumCount++;
    }
  }

  // Validate relationships
  console.log("\nValidating relationships...");
  for (const rel of schemaRegistry.relationships) {
    // Check if source entity exists (or will exist)
    const sourceExists = schemaRegistry.entities[rel.from];
    const targetExists = schemaRegistry.entities[rel.to];

    if (!sourceExists) {
      warnings.push(
        `Relationship: Entity '${rel.from}' not yet in registry (may be pending migration)`,
      );
    }
    if (!targetExists) {
      warnings.push(
        `Relationship: Entity '${rel.to}' not yet in registry (may be pending migration)`,
      );
    }

    console.log(
      `  ${sourceExists && targetExists ? "✓" : "⚠"} ${rel.from} -> ${rel.to} (${rel.type})`,
    );
    relationshipCount++;
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`  Entities: ${entityCount}`);
  console.log(`  Enums: ${enumCount}`);
  console.log(`  Relationships: ${relationshipCount}`);

  // Report warnings
  if (warnings.length > 0) {
    console.log(`\n⚠ Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  }

  // Report errors and exit
  if (errors.length > 0) {
    console.log(`\n✗ Errors (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("\n✓ Schema validation passed");
}

validateSchema().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
