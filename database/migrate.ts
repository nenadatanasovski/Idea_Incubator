#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getDb, exec, query, run, saveDb, closeDb } from './db.js';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Migration {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<string[]> {
  const results = await query<Migration>('SELECT name FROM _migrations ORDER BY id');
  return results.map(r => r.name);
}

/**
 * Get list of pending migrations
 */
async function getPendingMigrations(): Promise<string[]> {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = await glob('*.sql', { cwd: migrationsDir });
  const applied = await getAppliedMigrations();

  return files
    .filter(f => !applied.includes(f))
    .sort();
}

/**
 * Apply a single migration
 */
async function applyMigration(filename: string): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const filepath = path.join(migrationsDir, filename);

  logInfo(`Applying migration: ${filename}`);

  try {
    const sql = fs.readFileSync(filepath, 'utf-8');
    await exec(sql);
    await run('INSERT INTO _migrations (name) VALUES (?)', [filename]);
    logSuccess(`Applied: ${filename}`);
  } catch (error) {
    logError(`Failed to apply ${filename}`, error as Error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  await getDb(); // Initialize database
  await ensureMigrationsTable();

  const pending = await getPendingMigrations();

  if (pending.length === 0) {
    logInfo('No pending migrations.');
    return;
  }

  logInfo(`Found ${pending.length} pending migration(s).`);

  for (const migration of pending) {
    await applyMigration(migration);
  }

  await saveDb();
  logSuccess('All migrations applied successfully.');
}

/**
 * Show migration status
 */
export async function showMigrationStatus(): Promise<void> {
  await getDb();
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations();

  console.log('\nMigration Status:');
  console.log('=================\n');

  if (applied.length > 0) {
    console.log('Applied:');
    applied.forEach(m => console.log(`  ✓ ${m}`));
  }

  if (pending.length > 0) {
    console.log('\nPending:');
    pending.forEach(m => console.log(`  ○ ${m}`));
  }

  if (applied.length === 0 && pending.length === 0) {
    console.log('No migrations found.');
  }

  console.log('');
}

/**
 * Rollback last migration (if supported)
 */
export async function rollbackLastMigration(): Promise<void> {
  logWarning('Rollback not implemented - migrations are one-way.');
  logInfo('To reset, delete the database file and re-run migrations.');
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--status')) {
      await showMigrationStatus();
    } else if (args.includes('--rollback')) {
      await rollbackLastMigration();
    } else {
      await runMigrations();
    }
  } catch (error) {
    logError('Migration failed', error as Error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run if called directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('migrate.ts') ||
  process.argv[1].endsWith('migrate.js')
);

if (isMainModule) {
  main();
}
