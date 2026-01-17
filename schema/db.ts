/**
 * Drizzle ORM database connection
 *
 * This module provides a Drizzle-wrapped database connection
 * compatible with the existing sql.js setup.
 */

import { drizzle } from "drizzle-orm/sql-js";
import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import { getDb } from "../database/db.js";

let drizzleDb: SQLJsDatabase | null = null;

/**
 * Get Drizzle ORM database instance
 * Uses the existing sql.js database connection
 */
export async function getDrizzleDb(): Promise<SQLJsDatabase> {
  if (drizzleDb) return drizzleDb;

  const sqlJsDb = await getDb();
  drizzleDb = drizzle(sqlJsDb);

  return drizzleDb;
}

/**
 * Reset the Drizzle connection (useful after database reload)
 */
export function resetDrizzleDb(): void {
  drizzleDb = null;
}

export type { SQLJsDatabase };
