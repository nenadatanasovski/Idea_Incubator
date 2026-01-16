/**
 * Relationship Manager
 *
 * Utilities for managing idea relationships in the database.
 * Implements storage and retrieval of parent/child, integration, evolution,
 * forking, branching, collaboration, and AI-detected relationships.
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, saveDb, getOne } from "../database/db.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Valid relationship types as defined in the database schema.
 */
export type RelationshipType =
  | "parent"
  | "child"
  | "integrates_with"
  | "evolved_from"
  | "forked_from"
  | "branched_from"
  | "collaboration"
  | "competes_with"
  | "shares_audience_with";

/**
 * Relationship metadata structure.
 */
export interface RelationshipMetadata {
  [key: string]: unknown;
}

/**
 * A relationship between two ideas (or an idea and an external entity).
 */
export interface Relationship {
  id: string;
  fromUser: string;
  fromIdea: string;
  toUser: string | null;
  toIdea: string | null;
  toExternal: string | null;
  relationshipType: RelationshipType;
  metadata: RelationshipMetadata;
  createdAt: Date;
  createdBy: string | null;
}

/**
 * Database row structure for idea_relationships table.
 */
interface RelationshipRow {
  [key: string]: unknown;
  id: string;
  from_user: string;
  from_idea: string;
  to_user: string | null;
  to_idea: string | null;
  to_external: string | null;
  relationship_type: string;
  metadata: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Basic idea information for relationship queries.
 */
export interface Idea {
  slug: string;
  userSlug: string;
  title?: string;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Add a relationship between ideas or to an external entity.
 *
 * @param fromUser - User slug who owns the "from" idea
 * @param fromIdea - Idea slug of the source idea
 * @param toUser - User slug who owns the "to" idea (null for external)
 * @param toIdea - Idea slug of the target idea (null for external)
 * @param type - The type of relationship
 * @param metadata - Additional metadata for the relationship
 * @param createdBy - User who created this relationship (optional)
 * @returns The ID of the created relationship
 */
export async function addRelationship(
  fromUser: string,
  fromIdea: string,
  toUser: string | null,
  toIdea: string | null,
  type: RelationshipType,
  metadata: RelationshipMetadata = {},
  createdBy?: string,
): Promise<string> {
  const id = uuidv4();
  const metadataJson = JSON.stringify(metadata);

  // Determine if this is an external relationship
  const toExternal =
    toUser === null && toIdea === null
      ? (metadata.externalName as string) || null
      : null;

  await run(
    `INSERT INTO idea_relationships (id, from_user, from_idea, to_user, to_idea, to_external, relationship_type, metadata, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      fromUser,
      fromIdea,
      toUser,
      toIdea,
      toExternal,
      type,
      metadataJson,
      createdBy || null,
    ],
  );

  await saveDb();

  return id;
}

/**
 * Get all relationships for an idea.
 *
 * @param userSlug - User slug who owns the idea
 * @param ideaSlug - Idea slug
 * @returns Array of relationships where this idea is involved (as source or target)
 */
export async function getRelationships(
  userSlug: string,
  ideaSlug: string,
): Promise<Relationship[]> {
  const rows = await query<RelationshipRow>(
    `SELECT * FROM idea_relationships
     WHERE (from_user = ? AND from_idea = ?)
        OR (to_user = ? AND to_idea = ?)
     ORDER BY created_at DESC`,
    [userSlug, ideaSlug, userSlug, ideaSlug],
  );

  return rows.map(rowToRelationship);
}

/**
 * Get all children of an idea (ideas where this idea is the parent).
 *
 * @param userSlug - User slug who owns the parent idea
 * @param ideaSlug - Idea slug of the parent
 * @returns Array of child ideas
 */
export async function getChildren(
  userSlug: string,
  ideaSlug: string,
): Promise<Idea[]> {
  // Find relationships where this idea is the "to" (target) and type is "parent"
  // This means the "from" idea considers this idea its parent
  const rows = await query<RelationshipRow>(
    `SELECT * FROM idea_relationships
     WHERE to_user = ? AND to_idea = ? AND relationship_type = 'parent'
     ORDER BY created_at DESC`,
    [userSlug, ideaSlug],
  );

  return rows.map((row) => ({
    slug: row.from_idea,
    userSlug: row.from_user,
  }));
}

/**
 * Get the parent of an idea (if it has one).
 *
 * @param userSlug - User slug who owns the idea
 * @param ideaSlug - Idea slug
 * @returns Parent idea or null if no parent
 */
export async function getParent(
  userSlug: string,
  ideaSlug: string,
): Promise<Idea | null> {
  // Find relationship where this idea has a parent relationship
  const row = await getOne<RelationshipRow>(
    `SELECT * FROM idea_relationships
     WHERE from_user = ? AND from_idea = ? AND relationship_type = 'parent'
     LIMIT 1`,
    [userSlug, ideaSlug],
  );

  if (!row || !row.to_idea || !row.to_user) {
    return null;
  }

  return {
    slug: row.to_idea,
    userSlug: row.to_user,
  };
}

/**
 * Remove a specific relationship by ID.
 *
 * @param relationshipId - The ID of the relationship to remove
 */
export async function removeRelationship(
  relationshipId: string,
): Promise<void> {
  await run(`DELETE FROM idea_relationships WHERE id = ?`, [relationshipId]);
  await saveDb();
}

/**
 * Get relationships of a specific type for an idea.
 *
 * @param userSlug - User slug who owns the idea
 * @param ideaSlug - Idea slug
 * @param type - The relationship type to filter by
 * @returns Array of relationships of the specified type
 */
export async function getRelationshipsByType(
  userSlug: string,
  ideaSlug: string,
  type: RelationshipType,
): Promise<Relationship[]> {
  const rows = await query<RelationshipRow>(
    `SELECT * FROM idea_relationships
     WHERE ((from_user = ? AND from_idea = ?) OR (to_user = ? AND to_idea = ?))
       AND relationship_type = ?
     ORDER BY created_at DESC`,
    [userSlug, ideaSlug, userSlug, ideaSlug, type],
  );

  return rows.map(rowToRelationship);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert a database row to a Relationship object.
 */
function rowToRelationship(row: RelationshipRow): Relationship {
  let metadata: RelationshipMetadata = {};
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      // Invalid JSON, use empty object
      metadata = {};
    }
  }

  return {
    id: row.id,
    fromUser: row.from_user,
    fromIdea: row.from_idea,
    toUser: row.to_user,
    toIdea: row.to_idea,
    toExternal: row.to_external,
    relationshipType: row.relationship_type as RelationshipType,
    metadata,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

// ============================================================================
// FILE SYNC FUNCTIONS
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/index.js";

/**
 * Get the path to the relationships.json file for an idea.
 */
function getRelationshipsFilePath(userSlug: string, ideaSlug: string): string {
  const config = getConfig();
  const projectRoot = path.dirname(config.paths.ideas);
  return path.join(
    projectRoot,
    "users",
    userSlug,
    "ideas",
    ideaSlug,
    ".metadata",
    "relationships.json",
  );
}

/**
 * Structure for the relationships.json file.
 */
interface RelationshipsFileData {
  idea_type: string | null;
  parent: {
    type: string;
    slug: string | null;
    name: string | null;
  } | null;
  integrates_with: Array<{ user: string; slug: string } | { external: string }>;
  evolved_from: { user: string; slug: string } | null;
  forked_from: { user: string; slug: string } | null;
  branched_from: { user: string; slug: string } | null;
  collaboration: {
    contributors: string[];
    ai_suggested_partners: string[];
  };
  ai_detected: {
    competes_with: Array<{ user: string; slug: string }>;
    shares_audience_with: Array<{ user: string; slug: string }>;
  };
}

/**
 * Create the default empty relationships file structure.
 */
function createDefaultRelationshipsData(): RelationshipsFileData {
  return {
    idea_type: null,
    parent: null,
    integrates_with: [],
    evolved_from: null,
    forked_from: null,
    branched_from: null,
    collaboration: {
      contributors: [],
      ai_suggested_partners: [],
    },
    ai_detected: {
      competes_with: [],
      shares_audience_with: [],
    },
  };
}

/**
 * Sync relationships from database to the .metadata/relationships.json file.
 *
 * Reads all relationships for an idea from the database and writes them
 * to the relationships.json file. Creates the file if it doesn't exist.
 *
 * @param userSlug - User slug who owns the idea
 * @param ideaSlug - Idea slug
 */
export async function syncRelationshipsToFile(
  userSlug: string,
  ideaSlug: string,
): Promise<void> {
  const filePath = getRelationshipsFilePath(userSlug, ideaSlug);
  const metadataDir = path.dirname(filePath);

  // Ensure .metadata directory exists
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  // Start with existing file data or default structure
  let fileData: RelationshipsFileData;
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      fileData = JSON.parse(content);
    } catch {
      fileData = createDefaultRelationshipsData();
    }
  } else {
    fileData = createDefaultRelationshipsData();
  }

  // Get all relationships from database where this idea is the source
  const relationships = await getRelationships(userSlug, ideaSlug);

  // Filter to only relationships where this idea is the "from" side
  const outgoingRelationships = relationships.filter(
    (r) => r.fromUser === userSlug && r.fromIdea === ideaSlug,
  );

  // Reset file relationship arrays (keep idea_type and collaboration as is)
  fileData.parent = null;
  fileData.integrates_with = [];
  fileData.evolved_from = null;
  fileData.forked_from = null;
  fileData.branched_from = null;
  fileData.ai_detected = {
    competes_with: [],
    shares_audience_with: [],
  };

  // Populate from database relationships
  for (const rel of outgoingRelationships) {
    switch (rel.relationshipType) {
      case "parent":
        if (rel.toUser && rel.toIdea) {
          // Internal parent
          fileData.parent = {
            type: "internal",
            slug: rel.toIdea,
            name: null,
          };
        } else if (rel.toExternal) {
          // External parent
          fileData.parent = {
            type: "external",
            slug: null,
            name: rel.toExternal,
          };
        }
        break;

      case "integrates_with":
        if (rel.toUser && rel.toIdea) {
          fileData.integrates_with.push({ user: rel.toUser, slug: rel.toIdea });
        } else if (rel.toExternal) {
          fileData.integrates_with.push({ external: rel.toExternal });
        }
        break;

      case "evolved_from":
        if (rel.toUser && rel.toIdea) {
          fileData.evolved_from = { user: rel.toUser, slug: rel.toIdea };
        }
        break;

      case "forked_from":
        if (rel.toUser && rel.toIdea) {
          fileData.forked_from = { user: rel.toUser, slug: rel.toIdea };
        }
        break;

      case "branched_from":
        if (rel.toUser && rel.toIdea) {
          fileData.branched_from = { user: rel.toUser, slug: rel.toIdea };
        }
        break;

      case "competes_with":
        if (rel.toUser && rel.toIdea) {
          fileData.ai_detected.competes_with.push({
            user: rel.toUser,
            slug: rel.toIdea,
          });
        }
        break;

      case "shares_audience_with":
        if (rel.toUser && rel.toIdea) {
          fileData.ai_detected.shares_audience_with.push({
            user: rel.toUser,
            slug: rel.toIdea,
          });
        }
        break;
    }
  }

  // Write to file
  fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), "utf-8");
}

/**
 * Sync relationships from .metadata/relationships.json file to database.
 *
 * Reads the relationships.json file and updates the database accordingly.
 * Handles missing file gracefully by creating it with default values.
 *
 * @param userSlug - User slug who owns the idea
 * @param ideaSlug - Idea slug
 */
export async function syncRelationshipsFromFile(
  userSlug: string,
  ideaSlug: string,
): Promise<void> {
  const filePath = getRelationshipsFilePath(userSlug, ideaSlug);
  const metadataDir = path.dirname(filePath);

  // Ensure .metadata directory exists
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  // Read file data or create default
  let fileData: RelationshipsFileData;
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      fileData = JSON.parse(content);
    } catch {
      // Invalid JSON, create default file
      fileData = createDefaultRelationshipsData();
      fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), "utf-8");
      return; // Nothing to sync
    }
  } else {
    // File doesn't exist, create it with defaults
    fileData = createDefaultRelationshipsData();
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), "utf-8");
    return; // Nothing to sync
  }

  // Get current database relationships for this idea (where idea is source)
  const existingRelationships = await getRelationships(userSlug, ideaSlug);
  const outgoingRelationships = existingRelationships.filter(
    (r) => r.fromUser === userSlug && r.fromIdea === ideaSlug,
  );

  // Remove existing relationships from database (we'll re-add from file)
  for (const rel of outgoingRelationships) {
    await removeRelationship(rel.id);
  }

  // Add relationships from file to database

  // Parent relationship
  if (fileData.parent) {
    if (fileData.parent.type === "internal" && fileData.parent.slug) {
      await addRelationship(
        userSlug,
        ideaSlug,
        userSlug, // Assume same user for internal
        fileData.parent.slug,
        "parent",
        {},
      );
    } else if (fileData.parent.type === "external" && fileData.parent.name) {
      await addRelationship(userSlug, ideaSlug, null, null, "parent", {
        externalName: fileData.parent.name,
      });
    }
  }

  // Integrates_with relationships
  if (fileData.integrates_with && Array.isArray(fileData.integrates_with)) {
    for (const integration of fileData.integrates_with) {
      if ("user" in integration && "slug" in integration) {
        await addRelationship(
          userSlug,
          ideaSlug,
          integration.user,
          integration.slug,
          "integrates_with",
          {},
        );
      } else if ("external" in integration) {
        await addRelationship(
          userSlug,
          ideaSlug,
          null,
          null,
          "integrates_with",
          { externalName: integration.external },
        );
      }
    }
  }

  // Evolved_from relationship
  if (
    fileData.evolved_from &&
    fileData.evolved_from.user &&
    fileData.evolved_from.slug
  ) {
    await addRelationship(
      userSlug,
      ideaSlug,
      fileData.evolved_from.user,
      fileData.evolved_from.slug,
      "evolved_from",
      {},
    );
  }

  // Forked_from relationship
  if (
    fileData.forked_from &&
    fileData.forked_from.user &&
    fileData.forked_from.slug
  ) {
    await addRelationship(
      userSlug,
      ideaSlug,
      fileData.forked_from.user,
      fileData.forked_from.slug,
      "forked_from",
      {},
    );
  }

  // Branched_from relationship
  if (
    fileData.branched_from &&
    fileData.branched_from.user &&
    fileData.branched_from.slug
  ) {
    await addRelationship(
      userSlug,
      ideaSlug,
      fileData.branched_from.user,
      fileData.branched_from.slug,
      "branched_from",
      {},
    );
  }

  // AI detected: competes_with
  if (
    fileData.ai_detected?.competes_with &&
    Array.isArray(fileData.ai_detected.competes_with)
  ) {
    for (const competitor of fileData.ai_detected.competes_with) {
      if (competitor.user && competitor.slug) {
        await addRelationship(
          userSlug,
          ideaSlug,
          competitor.user,
          competitor.slug,
          "competes_with",
          {},
        );
      }
    }
  }

  // AI detected: shares_audience_with
  if (
    fileData.ai_detected?.shares_audience_with &&
    Array.isArray(fileData.ai_detected.shares_audience_with)
  ) {
    for (const shared of fileData.ai_detected.shares_audience_with) {
      if (shared.user && shared.slug) {
        await addRelationship(
          userSlug,
          ideaSlug,
          shared.user,
          shared.slug,
          "shares_audience_with",
          {},
        );
      }
    }
  }
}
