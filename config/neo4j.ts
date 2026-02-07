/**
 * Neo4j Connection Configuration
 * 
 * Provides connection driver and session management for Neo4j graph database.
 */

import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

/**
 * Get or create the Neo4j driver instance
 */
export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'vibedevpassword';

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 30000,
      connectionTimeout: 30000,
    });

    console.log(`[Neo4j] Connected to ${uri}`);
  }

  return driver;
}

/**
 * Get a new session for database operations
 */
export function getSession(): Session {
  return getDriver().session();
}

/**
 * Close the driver connection (call on shutdown)
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('[Neo4j] Connection closed');
  }
}

/**
 * Verify the connection is working
 */
export async function verifyConnection(): Promise<boolean> {
  const session = getSession();
  try {
    const result = await session.run('RETURN 1 as test');
    return result.records[0].get('test').toNumber() === 1;
  } catch (error) {
    console.error('[Neo4j] Connection verification failed:', error);
    return false;
  } finally {
    await session.close();
  }
}

/**
 * Run a Cypher query with parameters
 */
export async function runQuery<T = unknown>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = getSession();
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => {
      const obj: Record<string, unknown> = {};
      (record.keys as string[]).forEach((key: string) => {
        obj[key] = record.get(key);
      });
      return obj as T;
    });
  } finally {
    await session.close();
  }
}

/**
 * Run a write query (create, update, delete)
 */
export async function runWrite(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<{ nodesCreated: number; nodesDeleted: number; relationshipsCreated: number }> {
  const session = getSession();
  try {
    const result = await session.run(cypher, params);
    const summary = result.summary.counters.updates();
    return {
      nodesCreated: summary.nodesCreated,
      nodesDeleted: summary.nodesDeleted,
      relationshipsCreated: summary.relationshipsCreated,
    };
  } finally {
    await session.close();
  }
}
