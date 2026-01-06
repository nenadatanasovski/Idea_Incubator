#!/usr/bin/env tsx
/**
 * Migration Script: Migrate Database Artifacts to Filesystem
 *
 * This script migrates existing artifacts from the ideation_artifacts table
 * to the filesystem-based storage model.
 *
 * For each artifact with content:
 * 1. Determines target idea folder (from session, artifact metadata, or creates draft folder)
 * 2. Writes to file with proper frontmatter
 * 3. Updates database row with file_path
 * 4. Sets content to NULL (file-backed)
 *
 * The migration is idempotent - running twice is safe:
 * - Artifacts already migrated (file_path set, content NULL) are skipped
 * - Files are overwritten if re-migrating
 *
 * Usage: npx tsx scripts/migrate-artifacts-to-files.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { closeDb, query, run, saveDb } from '../database/db.js';
import { runMigrations } from '../database/migrate.js';
import { getConfig } from '../config/index.js';
import {
  generateFrontmatter,
  ArtifactType,
  ArtifactMetadata,
} from '../agents/ideation/unified-artifact-store.js';
import { createUserFolder } from '../utils/folder-structure.js';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';

/**
 * Database artifact row structure
 */
interface DbArtifact {
  id: string;
  session_id: string;
  type: string;
  title: string;
  content: string | null;
  language: string | null;
  queries: string | null;
  identifier: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string | null;
  user_slug: string | null;
  idea_slug: string | null;
  file_path: string | null;
  [key: string]: unknown;
}

/**
 * Database session row structure
 */
interface DbSession {
  id: string;
  user_slug: string | null;
  idea_slug: string | null;
  [key: string]: unknown;
}

/**
 * Migration result statistics
 */
interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ id: string; error: string }>;
}

/**
 * Get the users root directory
 */
function getUsersRoot(): string {
  const config = getConfig();
  const projectRoot = path.dirname(config.paths.ideas);
  return path.join(projectRoot, 'users');
}

/**
 * Generate a file path for an artifact based on its type and title.
 */
function generateFilePath(type: string, title: string): string {
  // Convert title to slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50); // Limit length

  // Map types to subdirectories
  const typeToDir: Record<string, string> = {
    research: 'research',
    mermaid: 'assets/diagrams',
    markdown: '',
    code: 'build',
    analysis: 'analysis',
    comparison: 'analysis',
    'idea-summary': '',
    template: '',
  };

  const dir = typeToDir[type] || '';
  const extension = type === 'mermaid' ? '.mmd' : '.md';
  const fileName = `${slug || 'artifact'}${extension}`;

  return dir ? `${dir}/${fileName}` : fileName;
}

/**
 * Parse research content that may be JSON
 */
function parseContent(content: string, type: string): string {
  // Research artifacts often have JSON content with synthesis
  if (type === 'research') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.synthesis) {
        return parsed.synthesis;
      }
      // If no synthesis, stringify nicely
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, return as-is
      return content;
    }
  }
  return content;
}

/**
 * Migrate a single artifact to filesystem
 */
async function migrateArtifact(
  artifact: DbArtifact,
  session: DbSession | null
): Promise<{ success: boolean; error?: string }> {
  // Determine user and idea slugs
  let userSlug = artifact.user_slug || session?.user_slug;
  let ideaSlug = artifact.idea_slug || session?.idea_slug;

  // If no user slug, create a default migration user
  if (!userSlug) {
    userSlug = 'migration-drafts';
  }

  // If no idea slug, create a draft folder
  if (!ideaSlug) {
    ideaSlug = `draft-${artifact.session_id.substring(0, 8)}`;
  }

  const usersRoot = getUsersRoot();
  const ideaFolder = path.resolve(usersRoot, userSlug, 'ideas', ideaSlug);

  // Ensure user and idea folders exist
  await createUserFolder(userSlug);
  if (!fs.existsSync(ideaFolder)) {
    fs.mkdirSync(ideaFolder, { recursive: true });
  }

  // Parse content
  const body = parseContent(artifact.content!, artifact.type);

  // Determine file path (use existing if any, otherwise generate)
  let filePath = artifact.file_path;
  if (!filePath) {
    filePath = generateFilePath(artifact.type, artifact.title);
  }

  // Build metadata for frontmatter
  const metadata: ArtifactMetadata = {
    id: artifact.id,
    title: artifact.title,
    type: artifact.type as ArtifactType,
    userSlug,
    ideaSlug,
    sessionId: artifact.session_id,
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at || artifact.created_at,
  };

  // Add optional fields
  if (artifact.language) {
    metadata.language = artifact.language;
  }
  if (artifact.queries) {
    try {
      metadata.queries = JSON.parse(artifact.queries);
    } catch {
      // Not valid JSON, skip
    }
  }
  if (artifact.identifier) {
    metadata.identifier = artifact.identifier;
  }

  // Generate file content with frontmatter
  const frontmatter = generateFrontmatter(metadata);
  const fileContent = frontmatter + body;

  // Ensure parent directory exists (for nested paths like research/market.md)
  const absolutePath = path.join(ideaFolder, filePath);
  const parentDir = path.dirname(absolutePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(absolutePath, fileContent, 'utf-8');

  // Update database: set file_path and NULL content
  await run(
    `UPDATE ideation_artifacts
     SET file_path = ?, content = NULL, user_slug = ?, idea_slug = ?, updated_at = ?
     WHERE id = ?`,
    [filePath, userSlug, ideaSlug, new Date().toISOString(), artifact.id]
  );

  return { success: true };
}

/**
 * Main migration function
 */
async function migrateArtifacts(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  // Get all artifacts with content that haven't been migrated yet
  const artifacts = await query<DbArtifact>(
    `SELECT * FROM ideation_artifacts WHERE content IS NOT NULL`
  );

  result.total = artifacts.length;

  if (artifacts.length === 0) {
    logInfo('No artifacts to migrate (all already file-backed or no artifacts exist)');
    return result;
  }

  logInfo(`Found ${artifacts.length} artifact(s) to migrate`);

  // Cache sessions for lookup
  const sessionCache = new Map<string, DbSession>();

  for (let i = 0; i < artifacts.length; i++) {
    const artifact = artifacts[i];
    const progress = `[${i + 1}/${artifacts.length}]`;

    // Check if already migrated (has file_path AND no content)
    // Note: We're processing artifacts with content, so this check is for safety
    if (artifact.file_path && !artifact.content) {
      logInfo(`${progress} Skipping ${artifact.id} (already migrated)`);
      result.skipped++;
      continue;
    }

    // Get session info for this artifact
    let session = sessionCache.get(artifact.session_id);
    if (!session) {
      const sessions = await query<DbSession>(
        `SELECT id, user_slug, idea_slug FROM ideation_sessions WHERE id = ?`,
        [artifact.session_id]
      );
      if (sessions.length > 0) {
        session = sessions[0];
        sessionCache.set(artifact.session_id, session);
      }
    }

    try {
      logInfo(`${progress} Migrating: ${artifact.title.substring(0, 50)}...`);

      const migrationResult = await migrateArtifact(artifact, session || null);

      if (migrationResult.success) {
        result.migrated++;
        logSuccess(`${progress} Migrated: ${artifact.id}`);
      } else {
        result.errors++;
        result.errorDetails.push({
          id: artifact.id,
          error: migrationResult.error || 'Unknown error'
        });
        logError(`${progress} Failed: ${artifact.id} - ${migrationResult.error}`);
      }
    } catch (error) {
      result.errors++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errorDetails.push({ id: artifact.id, error: errorMsg });
      logError(`${progress} Failed: ${artifact.id} - ${errorMsg}`);
    }
  }

  return result;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    logInfo('Starting artifact migration to filesystem...');
    logInfo('');

    // Initialize database
    await runMigrations();

    // Run migration
    const result = await migrateArtifacts();

    // Save database changes
    await saveDb();

    // Print summary
    console.log('\n');
    console.log('Migration Summary:');
    console.log('==================');
    console.log(`  Total artifacts:    ${result.total}`);
    console.log(`  Migrated:           ${result.migrated}`);
    console.log(`  Skipped:            ${result.skipped}`);
    console.log(`  Errors:             ${result.errors}`);

    if (result.errorDetails.length > 0) {
      console.log('\nError Details:');
      for (const err of result.errorDetails) {
        console.log(`  - ${err.id}: ${err.error}`);
      }
    }

    // Verify: check that no artifacts have both content and file_path
    const badArtifacts = await query<{ id: string }>(
      `SELECT id FROM ideation_artifacts WHERE content IS NOT NULL AND file_path IS NOT NULL`
    );

    if (badArtifacts.length > 0) {
      logWarning(`\nWarning: ${badArtifacts.length} artifact(s) have both content and file_path`);
      logWarning('This should not happen after a successful migration');
    } else {
      logSuccess('\nVerification passed: No artifacts have both content and file_path');
    }

    logSuccess('\nMigration complete.');
  } catch (error) {
    logError('Migration failed', error as Error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run if called directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith('migrate-artifacts-to-files.ts') ||
    process.argv[1].endsWith('migrate-artifacts-to-files.js'));

if (isMainModule) {
  main();
}

export { migrateArtifacts };
