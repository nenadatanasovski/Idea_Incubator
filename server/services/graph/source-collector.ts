/**
 * Multi-Source Collector Service
 *
 * Collects and aggregates content from multiple source types for graph analysis:
 * - Conversation insights (AI-synthesized from raw messages)
 * - Artifacts (research, code, analysis, etc.)
 * - Memory files (state files with embedded JSON)
 * - User-created blocks (manual insights)
 * - External content (imported)
 */

import { query, getOne, run, saveDb } from "../../../database/db.js";
import {
  synthesizeConversation,
  INSIGHT_TYPE_WEIGHTS,
  type InsightType,
} from "./conversation-synthesizer.js";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Conversation Insight Cache (Persistent)
// =============================================================================
// Cache synthesized insights in the database to avoid expensive re-synthesis
// when no new messages exist. Persists across server restarts.

// Track in-progress synthesis operations to prevent concurrent synthesis for same session
const synthesisInProgress = new Map<string, Promise<any>>();

// Initialize the cache table
async function ensureCacheTable(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS conversation_insight_cache (
      session_id TEXT PRIMARY KEY,
      last_message_timestamp TEXT NOT NULL,
      last_message_id TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      cached_at TEXT NOT NULL
    )
  `);
}

// Get cached insights from database
async function getCachedInsights(sessionId: string): Promise<{
  insights: any[];
  lastMessageTimestamp: string;
  lastMessageId: string;
  cachedAt: string;
} | null> {
  console.log(`[SourceCollector] Checking DB cache for session: ${sessionId}`);
  await ensureCacheTable();
  const row = await getOne<{
    last_message_timestamp: string;
    last_message_id: string;
    insights_json: string;
    cached_at: string;
  }>(
    `SELECT last_message_timestamp, last_message_id, insights_json, cached_at
     FROM conversation_insight_cache WHERE session_id = ?`,
    [sessionId],
  );

  if (!row) {
    console.log(
      `[SourceCollector] No cache found in DB for session: ${sessionId}`,
    );
    return null;
  }

  console.log(
    `[SourceCollector] Found cache in DB, last_message_timestamp: ${row.last_message_timestamp}`,
  );

  try {
    return {
      insights: JSON.parse(row.insights_json),
      lastMessageTimestamp: row.last_message_timestamp,
      lastMessageId: row.last_message_id,
      cachedAt: row.cached_at,
    };
  } catch (e) {
    console.log(`[SourceCollector] Error parsing cached insights: ${e}`);
    return null;
  }
}

// Save insights to database cache
async function saveCachedInsights(
  sessionId: string,
  insights: any[],
  lastMessageTimestamp: string,
  lastMessageId: string,
): Promise<void> {
  await ensureCacheTable();
  const cachedAt = new Date().toISOString();
  const insightsJson = JSON.stringify(insights);

  await run(
    `INSERT OR REPLACE INTO conversation_insight_cache
     (session_id, last_message_timestamp, last_message_id, insights_json, cached_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, lastMessageTimestamp, lastMessageId, insightsJson, cachedAt],
  );

  // Persist to disk so cache survives server restarts
  await saveDb();
  console.log(
    `[SourceCollector] Cache persisted to disk for session ${sessionId}`,
  );
}

// Clear cache for a session
export async function clearConversationInsightCache(
  sessionId: string,
): Promise<void> {
  await ensureCacheTable();
  await run(`DELETE FROM conversation_insight_cache WHERE session_id = ?`, [
    sessionId,
  ]);
  synthesisInProgress.delete(sessionId);
  console.log(
    `[SourceCollector] Cleared insight cache for session: ${sessionId}`,
  );
}

// Clear entire cache
export async function clearAllConversationInsightCaches(): Promise<void> {
  await ensureCacheTable();
  await run(`DELETE FROM conversation_insight_cache`);
  synthesisInProgress.clear();
  console.log(`[SourceCollector] Cleared all insight caches`);
}

// =============================================================================
// Types and Interfaces
// =============================================================================

export type SourceType =
  | "conversation" // Raw chat messages (legacy)
  | "conversation_insight" // AI-synthesized conversation insights
  | "artifact" // Created artifacts
  | "memory_file" // Memory state files
  | "user_block" // User-created blocks
  | "external"; // Imported content

export interface CollectedSource {
  id: string;
  type: SourceType;
  content: string;
  metadata: {
    title?: string;
    createdAt: string;
    updatedAt?: string;
    artifactType?: string;
    memoryFileType?: string;
    role?: "user" | "assistant" | "system";
    // Conversation insight specific metadata
    insightType?: InsightType;
    sourceContext?: string;
    synthesized?: boolean;
    supersedes?: {
      insightId: string;
      reason: string;
    };
  };
  weight: number; // Source reliability weight (0.0-1.0)
}

export interface SourceCollectionResult {
  sources: CollectedSource[];
  totalTokenEstimate: number;
  truncated: boolean;
  collectionMetadata: {
    conversationCount: number; // Raw messages (if using legacy mode)
    conversationInsightCount: number; // Synthesized insights
    artifactCount: number;
    memoryFileCount: number;
    userBlockCount: number;
  };
}

export interface CollectionOptions {
  sourceTypes?: SourceType[];
  tokenBudget?: number;
  conversationLimit?: number;
  includeExistingBlocks?: boolean;
  // Use AI synthesis for conversations (default: true)
  // When true, raw messages are synthesized into meaningful insights
  // When false, raw messages are returned as-is (legacy mode)
  synthesizeConversations?: boolean;
  // Optional idea slug to collect file-based artifacts from idea folder
  // Used when session isn't linked but user is viewing a specific idea
  ideaSlug?: string;
}

// =============================================================================
// Weight Tables
// =============================================================================

// Artifact type weights (higher = more reliable)
export const ARTIFACT_WEIGHTS: Record<string, number> = {
  research: 0.9, // Verified external data
  analysis: 0.85, // Structured analysis
  comparison: 0.8, // Comparative insights
  "idea-summary": 0.75, // Synthesized content
  markdown: 0.7, // General documentation
  code: 0.7, // Implementation details
  mermaid: 0.6, // Visual diagrams (text extracted)
  template: 0.5, // Boilerplate content
};

// Memory file type weights
export const MEMORY_FILE_WEIGHTS: Record<string, number> = {
  viability_assessment: 0.95, // Validated analysis
  market_discovery: 0.9, // External market data
  self_discovery: 0.85, // User-confirmed insights
  idea_candidate: 0.8, // Refined idea state
  narrowing_state: 0.75, // Working hypotheses
  conversation_summary: 0.7, // Compressed history
  handoff_notes: 0.6, // Transition context
};

// Role weights for conversation messages
export const ROLE_WEIGHTS: Record<string, number> = {
  user: 1.0, // User input is ground truth
  assistant: 0.8, // AI responses
  system: 0.6, // System messages
};

// Default options
const DEFAULT_OPTIONS: Required<Omit<CollectionOptions, "ideaSlug">> & {
  ideaSlug?: string;
} = {
  sourceTypes: ["conversation", "artifact", "user_block"], // memory_file removed - using memory graph instead
  tokenBudget: 50000,
  conversationLimit: 50,
  includeExistingBlocks: true,
  synthesizeConversations: true, // Use AI synthesis by default
  ideaSlug: undefined,
};

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Rough token estimate (4 chars per token approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// Conversation Source Collector (with AI Synthesis)
// =============================================================================

/**
 * Collect conversation sources as AI-synthesized insights.
 * Uses the conversation synthesizer to extract meaningful knowledge chunks
 * (decisions, assumptions, questions, insights, etc.) instead of raw messages.
 *
 * OPTIMIZATION: Caches synthesized insights and only re-synthesizes when new messages exist.
 * This avoids expensive AI calls when the user repeatedly opens the source selection modal.
 */
export async function collectConversationInsights(
  sessionId: string,
  limit: number = 50,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting conversation insights for session: ${sessionId}`,
  );

  // Get the latest message to check if we need to re-synthesize
  const latestMessage = await getOne<{
    id: string;
    created_at: string;
  }>(
    `SELECT id, created_at FROM ideation_messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId],
  );

  // Check for cached insights in database (persists across server restarts)
  const cached = await getCachedInsights(sessionId);

  // If we have cached insights and no new messages, return cached
  if (cached && latestMessage) {
    const lastCachedTimestamp = new Date(cached.lastMessageTimestamp).getTime();
    const latestMessageTimestamp = new Date(latestMessage.created_at).getTime();

    if (latestMessageTimestamp <= lastCachedTimestamp) {
      console.log(
        `[SourceCollector] Using PERSISTENT cached insights (${cached.insights.length} insights, no new messages since ${cached.lastMessageTimestamp})`,
      );
      return cached.insights as CollectedSource[];
    }

    console.log(
      `[SourceCollector] Cache invalidated - new messages detected since ${cached.lastMessageTimestamp}`,
    );
  }

  // Check if synthesis is already in progress for this session (in-memory lock)
  const existingPromise = synthesisInProgress.get(sessionId);
  if (existingPromise) {
    console.log(
      `[SourceCollector] Synthesis already in progress for session ${sessionId}, waiting...`,
    );
    return existingPromise;
  }

  // Start synthesis and track the promise
  const synthesisPromise = doSynthesis(
    sessionId,
    limit,
    latestMessage ?? undefined,
  );
  synthesisInProgress.set(sessionId, synthesisPromise);

  try {
    const result = await synthesisPromise;
    return result;
  } finally {
    // Clean up the in-progress tracker
    synthesisInProgress.delete(sessionId);
  }
}

/**
 * Internal function to perform the actual synthesis.
 * Separated to allow tracking with synthesisInProgress.
 */
async function doSynthesis(
  sessionId: string,
  limit: number,
  latestMessage: { id: string; created_at: string } | undefined,
): Promise<CollectedSource[]> {
  console.log(`[SourceCollector] Synthesizing conversation insights...`);
  const synthesisResult = await synthesizeConversation(sessionId, limit);

  if (synthesisResult.insights.length === 0) {
    console.log(`[SourceCollector] No insights synthesized from conversation`);
    // Still cache empty result to avoid re-synthesizing empty conversations
    if (latestMessage) {
      await saveCachedInsights(
        sessionId,
        [],
        latestMessage.created_at,
        latestMessage.id,
      );
    }
    return [];
  }

  // Convert insights to CollectedSource format
  const sources: CollectedSource[] = synthesisResult.insights.map(
    (insight) => ({
      id: `insight_${insight.id}`,
      type: "conversation_insight" as SourceType,
      content: insight.content,
      metadata: {
        title: insight.title,
        createdAt: new Date().toISOString(),
        insightType: insight.type,
        sourceContext: insight.sourceContext,
        synthesized: true,
      },
      weight: INSIGHT_TYPE_WEIGHTS[insight.type] * insight.confidence,
    }),
  );

  // Cache the results to database (persists across server restarts)
  if (latestMessage) {
    await saveCachedInsights(
      sessionId,
      sources,
      latestMessage.created_at,
      latestMessage.id,
    );
    console.log(
      `[SourceCollector] PERSISTENTLY cached ${sources.length} insights for session ${sessionId}`,
    );
  }

  const tokenEstimate = sources.reduce(
    (acc, s) => acc + estimateTokens(s.content),
    0,
  );

  console.log(
    `[SourceCollector] Synthesized ${sources.length} insights from ${synthesisResult.totalMessages} messages`,
  );
  console.log(
    `[SourceCollector] Insight breakdown:`,
    synthesisResult.synthesisMetadata,
  );
  console.log(
    `[SourceCollector] Conversation insight collection complete: ~${tokenEstimate} tokens`,
  );

  return sources;
}

/**
 * Collect raw conversation messages (legacy mode).
 * Returns individual user/assistant messages without synthesis.
 */
export async function collectConversationSourcesRaw(
  sessionId: string,
  limit: number = 50,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting raw conversation sources for session: ${sessionId}`,
  );

  const messages = await query<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>(
    `SELECT id, role, content, created_at FROM ideation_messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [sessionId, limit],
  );

  const sources: CollectedSource[] = messages.map((m) => ({
    id: m.id,
    type: "conversation" as SourceType,
    content: m.content,
    metadata: {
      createdAt: m.created_at,
      role: m.role as "user" | "assistant" | "system",
      synthesized: false,
    },
    weight: ROLE_WEIGHTS[m.role] || 0.7,
  }));

  const tokenEstimate = sources.reduce(
    (acc, s) => acc + estimateTokens(s.content),
    0,
  );
  console.log(
    `[SourceCollector] Found ${messages.length} raw messages (limit: ${limit})`,
  );
  console.log(
    `[SourceCollector] Raw conversation collection complete: ${sources.length} sources, ~${tokenEstimate} tokens`,
  );

  return sources;
}

/**
 * Main conversation source collector.
 * By default uses AI synthesis, but can fall back to raw mode.
 */
export async function collectConversationSources(
  sessionId: string,
  limit: number = 50,
  synthesize: boolean = true,
): Promise<CollectedSource[]> {
  if (synthesize) {
    return collectConversationInsights(sessionId, limit);
  }
  return collectConversationSourcesRaw(sessionId, limit);
}

// =============================================================================
// Artifact Source Collector
// =============================================================================

/**
 * Collect file-based artifacts from an idea folder.
 * Looks for markdown files in the idea folder structure.
 */
async function collectIdeaFolderArtifacts(
  ideaSlug: string,
): Promise<CollectedSource[]> {
  const sources: CollectedSource[] = [];

  // Check both legacy and new folder structures
  const possiblePaths = [
    path.resolve(process.cwd(), "ideas", ideaSlug), // Legacy: ideas/[slug]/
  ];

  for (const ideaPath of possiblePaths) {
    if (!fs.existsSync(ideaPath)) {
      continue;
    }

    console.log(
      `[SourceCollector] Scanning idea folder for artifacts: ${ideaPath}`,
    );

    // Recursively find all markdown files
    const findMarkdownFiles = (dir: string, files: string[] = []): string[] => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // Skip hidden directories and node_modules
            if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
              findMarkdownFiles(fullPath, files);
            }
          } else if (entry.name.endsWith(".md")) {
            files.push(fullPath);
          }
        }
      } catch (err) {
        console.warn(`[SourceCollector] Error reading directory ${dir}:`, err);
      }
      return files;
    };

    const markdownFiles = findMarkdownFiles(ideaPath);
    console.log(
      `[SourceCollector] Found ${markdownFiles.length} markdown files in idea folder`,
    );

    for (const filePath of markdownFiles) {
      try {
        let content = fs.readFileSync(filePath, "utf-8");
        const relativePath = path.relative(ideaPath, filePath);
        const fileName = path.basename(filePath, ".md");

        // Determine artifact type based on path/filename
        let artifactType = "markdown";
        if (relativePath.includes("research")) artifactType = "research";
        else if (relativePath.includes("analysis")) artifactType = "analysis";
        else if (fileName.includes("pitch") || fileName.includes("elevator"))
          artifactType = "idea-summary";

        // Create a unique ID based on file path
        // Use full base64 encoding (no truncation) to avoid collisions
        // for files with similar paths like agents/build-agent-foo.md and agents/build-agent-bar.md
        const sourceId = `file_${Buffer.from(relativePath)
          .toString("base64")
          .replace(/[^a-zA-Z0-9]/g, "")}`;

        sources.push({
          id: sourceId,
          type: "artifact" as SourceType,
          content,
          metadata: {
            title: (() => {
              const baseName = fileName.replace(/-/g, " ").replace(/_/g, " ");
              const relDir = path.dirname(relativePath);
              if (relDir === ".") return baseName;
              const pathPrefix = relDir
                .split(path.sep)
                .map((s) => s.replace(/-/g, " ").replace(/_/g, " "))
                .join(" / ");
              return `${pathPrefix} / ${baseName}`;
            })(),
            createdAt: new Date().toISOString(),
            artifactType,
          },
          weight: ARTIFACT_WEIGHTS[artifactType] || 0.7,
        });

        console.log(
          `[SourceCollector]   - File artifact: ${relativePath} (${content.length} chars)`,
        );
      } catch (err) {
        console.warn(`[SourceCollector] Error reading file ${filePath}:`, err);
      }
    }
  }

  return sources;
}

export async function collectArtifactSources(
  sessionId: string,
  ideaSlug?: string,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting artifact sources for session: ${sessionId}`,
  );
  console.log(
    `[SourceCollector] ideaSlug param: ${ideaSlug || "(not provided)"}`,
  );

  // First, get session info to check for linked idea
  const session = await getOne<{
    user_slug: string | null;
    idea_slug: string | null;
  }>(`SELECT user_slug, idea_slug FROM ideation_sessions WHERE id = ?`, [
    sessionId,
  ]);

  console.log(
    `[SourceCollector] Session idea_slug from DB: ${session?.idea_slug || "(not set)"}`,
  );

  // Use provided ideaSlug or fall back to session's linked idea
  const effectiveIdeaSlug = ideaSlug || session?.idea_slug;
  console.log(
    `[SourceCollector] effectiveIdeaSlug: ${effectiveIdeaSlug || "(none)"}`,
  );

  // Check if idea folder exists
  if (effectiveIdeaSlug) {
    const ideaPath = path.resolve(process.cwd(), "ideas", effectiveIdeaSlug);
    console.log(`[SourceCollector] Checking idea folder path: ${ideaPath}`);
    console.log(
      `[SourceCollector] Idea folder exists: ${fs.existsSync(ideaPath)}`,
    );
  }

  const artifacts = await query<{
    id: string;
    type: string;
    title: string;
    content: string | null;
    file_path: string | null;
    created_at: string;
    updated_at: string | null;
  }>(
    `SELECT id, type, title, content, file_path, created_at, updated_at
     FROM ideation_artifacts
     WHERE session_id = ?
     ORDER BY created_at DESC`,
    [sessionId],
  );

  console.log(
    `[SourceCollector] Found ${artifacts.length} artifacts in database for session ${sessionId}`,
  );

  // Log details about artifacts found
  artifacts.forEach((a) => {
    console.log(
      `[SourceCollector]   - Artifact ${a.id}: type=${a.type}, title="${a.title?.slice(0, 30)}...", hasContent=${a.content != null}, hasFilePath=${a.file_path != null}`,
    );
  });

  const sources: CollectedSource[] = [];

  for (const a of artifacts) {
    // Get content from content field or read from file
    let content = a.content;

    if (content == null && a.file_path) {
      // Try to read from file
      try {
        if (fs.existsSync(a.file_path)) {
          content = fs.readFileSync(a.file_path, "utf-8");
          console.log(
            `[SourceCollector] Read ${content.length} chars from file: ${a.file_path}`,
          );
        } else {
          console.warn(
            `[SourceCollector] File not found: ${a.file_path} for artifact ${a.id}`,
          );
          continue;
        }
      } catch (err) {
        console.error(
          `[SourceCollector] Error reading file ${a.file_path}:`,
          err,
        );
        continue;
      }
    }

    if (content == null) {
      console.log(
        `[SourceCollector] Skipping artifact ${a.id}: no content and no file_path`,
      );
      continue;
    }

    sources.push({
      id: a.id,
      type: "artifact" as SourceType,
      content,
      metadata: {
        title: a.title,
        createdAt: a.created_at,
        updatedAt: a.updated_at || undefined,
        artifactType: a.type,
      },
      weight: ARTIFACT_WEIGHTS[a.type] || 0.7,
    });
  }

  // Also collect file-based artifacts from idea folder if available
  if (effectiveIdeaSlug) {
    console.log(
      `[SourceCollector] Collecting from idea folder: ${effectiveIdeaSlug}`,
    );
    const folderArtifacts = await collectIdeaFolderArtifacts(effectiveIdeaSlug);
    sources.push(...folderArtifacts);
    console.log(
      `[SourceCollector] Added ${folderArtifacts.length} file-based artifacts from idea folder`,
    );
  }

  // Log weight breakdown
  const weightBreakdown: Record<string, { count: number; weight: number }> = {};
  sources.forEach((s) => {
    const type = s.metadata.artifactType || "unknown";
    if (!weightBreakdown[type]) {
      weightBreakdown[type] = { count: 0, weight: s.weight };
    }
    weightBreakdown[type].count++;
  });

  const tokenEstimate = sources.reduce(
    (acc, s) => acc + estimateTokens(s.content),
    0,
  );
  console.log(`[SourceCollector] Found ${artifacts.length} DB artifacts`);
  console.log(
    `[SourceCollector] Artifact collection complete: ${sources.length} sources, ~${tokenEstimate} tokens`,
  );
  Object.entries(weightBreakdown).forEach(([type, data]) => {
    console.log(`  - ${type}: ${data.count} (weight: ${data.weight})`);
  });

  return sources;
}

// =============================================================================
// Memory File Source Collector
// Memory Graph Migration: Now queries memory_blocks table instead of
// deprecated ideation_memory_files table. The ideation_memory_files table
// is kept for backward compatibility but no longer written to.
// =============================================================================

/**
 * Extract embedded JSON state from memory file content.
 * Memory files may contain <!-- STATE_JSON --> comments with structured data.
 */
function extractStateFromMemoryFile(content: string): {
  markdown: string;
  state: Record<string, unknown> | null;
} {
  const stateMatch = content.match(/<!--\s*STATE_JSON\s*\n([\s\S]*?)\n\s*-->/);

  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      const markdown = content.replace(stateMatch[0], "").trim();
      return { markdown, state };
    } catch {
      // Failed to parse JSON, return content as-is
      return { markdown: content, state: null };
    }
  }

  return { markdown: content, state: null };
}

/**
 * Collect memory sources from memory_blocks table.
 * Memory Graph Migration: This replaces the deprecated ideation_memory_files table.
 * Blocks with types like 'learning', 'pattern', 'synthesis' serve as memory.
 */
export async function collectMemoryFileSources(
  sessionId: string,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting memory sources from graph for session: ${sessionId}`,
  );

  // Query memory blocks that serve as "memory" (learnings, patterns, synthesis, etc.)
  const memoryBlocks = await query<{
    id: string;
    type: string;
    content: string;
    properties: string | null;
    confidence: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, type, content, properties, confidence, created_at, updated_at
     FROM memory_blocks
     WHERE session_id = ?
       AND type IN ('learning', 'pattern', 'synthesis', 'decision', 'assumption')
       AND status = 'active'
     ORDER BY updated_at DESC`,
    [sessionId],
  );

  // Map block types to memory file weights for backward compatibility
  const blockTypeToWeight: Record<string, number> = {
    learning: 0.9, // High value learnings
    pattern: 0.85, // Recognized patterns
    synthesis: 0.8, // Synthesized insights
    decision: 0.85, // Validated decisions
    assumption: 0.7, // Working assumptions
  };

  const sources: CollectedSource[] = memoryBlocks.map((block) => {
    const { markdown, state } = extractStateFromMemoryFile(block.content);

    // Include both markdown and state in content for analysis
    let content = markdown;
    if (state) {
      content += `\n\n## Extracted State\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
    }

    // Include relevant properties if present (exclude bulky arrays like all_sources)
    if (block.properties) {
      try {
        const props = JSON.parse(block.properties);
        // Remove large arrays that bloat content unnecessarily
        const {
          all_sources: _allSources,
          corroborated_by: _corroborated,
          ...relevantProps
        } = props;
        if (Object.keys(relevantProps).length > 0) {
          content += `\n\n## Properties\n\`\`\`json\n${JSON.stringify(relevantProps, null, 2)}\n\`\`\``;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Use block confidence if available, otherwise use type-based weight
    const baseWeight = blockTypeToWeight[block.type] || 0.7;
    const weight =
      block.confidence !== null ? block.confidence * baseWeight : baseWeight;

    return {
      id: block.id,
      type: "memory_file" as SourceType, // Keep type for backward compatibility
      content,
      metadata: {
        createdAt: block.created_at,
        updatedAt: block.updated_at,
        memoryFileType: block.type, // Use block type as the "file type"
      },
      weight,
    };
  });

  // Also check legacy ideation_memory_files for backward compatibility
  const legacyMemoryFiles = await query<{
    id: string;
    file_type: string;
    content: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, file_type, content, created_at, updated_at
     FROM ideation_memory_files
     WHERE session_id = ?
     ORDER BY updated_at DESC`,
    [sessionId],
  );

  // Add legacy memory files if any exist
  for (const mf of legacyMemoryFiles) {
    const { markdown, state } = extractStateFromMemoryFile(mf.content);

    let content = markdown;
    if (state) {
      content += `\n\n## Extracted State\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
    }

    sources.push({
      id: mf.id,
      type: "memory_file" as SourceType,
      content,
      metadata: {
        createdAt: mf.created_at,
        updatedAt: mf.updated_at,
        memoryFileType: mf.file_type,
      },
      weight: MEMORY_FILE_WEIGHTS[mf.file_type] || 0.7,
    });
  }

  // Log breakdown
  const weightBreakdown: Record<string, { count: number; weight: number }> = {};
  sources.forEach((s) => {
    const type = s.metadata.memoryFileType || "unknown";
    if (!weightBreakdown[type]) {
      weightBreakdown[type] = { count: 0, weight: s.weight };
    }
    weightBreakdown[type].count++;
  });

  const tokenEstimate = sources.reduce(
    (acc, s) => acc + estimateTokens(s.content),
    0,
  );
  console.log(
    `[SourceCollector] Found ${memoryBlocks.length} memory blocks + ${legacyMemoryFiles.length} legacy files`,
  );
  console.log(
    `[SourceCollector] Memory source collection complete: ${sources.length} sources, ~${tokenEstimate} tokens`,
  );
  Object.entries(weightBreakdown).forEach(([type, data]) => {
    console.log(`  - ${type}: ${data.count} (weight: ${data.weight})`);
  });

  return sources;
}

// =============================================================================
// User Block Source Collector
// =============================================================================

export async function collectUserBlockSources(
  sessionId: string,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting user-created block sources for session: ${sessionId}`,
  );

  // Query blocks that were manually created (not extracted from messages or artifacts)
  const userBlocks = await query<{
    id: string;
    type: string;
    content: string;
    status: string;
    confidence: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, type, content, status, confidence, created_at, updated_at
     FROM memory_blocks
     WHERE session_id = ?
       AND extracted_from_message_id IS NULL
       AND artifact_id IS NULL
       AND status IN ('active', 'validated', 'draft')
     ORDER BY created_at DESC`,
    [sessionId],
  );

  // Weight by status: validated > active > draft
  const statusWeights: Record<string, number> = {
    validated: 1.0,
    active: 0.85,
    draft: 0.7,
  };

  const sources: CollectedSource[] = userBlocks.map((block) => ({
    id: block.id,
    type: "user_block",
    content: block.content,
    metadata: {
      createdAt: block.created_at,
      updatedAt: block.updated_at,
    },
    weight: (block.confidence || 0.8) * (statusWeights[block.status] || 0.8),
  }));

  const tokenEstimate = sources.reduce(
    (acc, s) => acc + estimateTokens(s.content),
    0,
  );
  console.log(
    `[SourceCollector] Found ${userBlocks.length} total blocks, ${sources.length} are user-created`,
  );
  console.log(
    `[SourceCollector] User block collection complete: ${sources.length} sources, ~${tokenEstimate} tokens`,
  );

  return sources;
}

// =============================================================================
// Unified Collection Orchestrator
// =============================================================================

export async function collectAllSources(
  sessionId: string,
  options: CollectionOptions = {},
): Promise<SourceCollectionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  console.log(
    `[SourceCollector] Starting unified collection for session: ${sessionId}`,
  );
  console.log(`[SourceCollector] Token budget: ${opts.tokenBudget}`);
  console.log(
    `[SourceCollector] Collection order: ${opts.sourceTypes.join(", ")}`,
  );

  const result: SourceCollectionResult = {
    sources: [],
    totalTokenEstimate: 0,
    truncated: false,
    collectionMetadata: {
      conversationCount: 0,
      conversationInsightCount: 0,
      artifactCount: 0,
      memoryFileCount: 0,
      userBlockCount: 0,
    },
  };

  console.log(
    `[SourceCollector] Conversation synthesis: ${opts.synthesizeConversations ? "enabled" : "disabled"}`,
  );

  // Collect in priority order: conversation first (AI synthesis), then artifact > user_block
  // memory_file removed - using memory graph context injection instead
  const priorityOrder: SourceType[] = [
    "conversation",
    "artifact",
    "user_block",
  ];

  for (const sourceType of priorityOrder) {
    if (!opts.sourceTypes.includes(sourceType)) continue;

    let sources: CollectedSource[] = [];

    try {
      switch (sourceType) {
        case "conversation":
          sources = await collectConversationSources(
            sessionId,
            opts.conversationLimit,
            opts.synthesizeConversations, // Pass synthesis option
          );
          // If synthesis returned nothing, fall back to raw messages
          if (sources.length === 0 && opts.synthesizeConversations) {
            console.warn(
              `[SourceCollector] Synthesis returned 0 insights, falling back to raw messages`,
            );
            sources = await collectConversationSourcesRaw(
              sessionId,
              opts.conversationLimit,
            );
            result.collectionMetadata.conversationCount = sources.length;
          } else if (opts.synthesizeConversations) {
            result.collectionMetadata.conversationInsightCount = sources.length;
          } else {
            result.collectionMetadata.conversationCount = sources.length;
          }
          break;
        case "artifact":
          sources = await collectArtifactSources(sessionId, opts.ideaSlug);
          result.collectionMetadata.artifactCount = sources.length;
          break;
        // memory_file case removed - using memory graph context injection instead
        case "user_block":
          sources = await collectUserBlockSources(sessionId);
          result.collectionMetadata.userBlockCount = sources.length;
          break;
      }
    } catch (error) {
      console.error(
        `[SourceCollector] Error collecting ${sourceType} sources:`,
        error,
      );
      // For conversations, fall back to raw messages if synthesis fails
      if (sourceType === "conversation" && opts.synthesizeConversations) {
        console.warn(
          `[SourceCollector] Conversation synthesis failed, falling back to raw messages`,
        );
        try {
          sources = await collectConversationSourcesRaw(
            sessionId,
            opts.conversationLimit,
          );
          result.collectionMetadata.conversationCount = sources.length;
        } catch (fallbackError) {
          console.error(
            `[SourceCollector] Raw conversation fallback also failed:`,
            fallbackError,
          );
          continue;
        }
      } else {
        // Continue with other sources on partial failure
        continue;
      }
    }

    // Add sources respecting token budget
    for (const source of sources) {
      const sourceTokens = estimateTokens(source.content);

      if (result.totalTokenEstimate + sourceTokens > opts.tokenBudget) {
        result.truncated = true;
        console.log(
          `[SourceCollector] Token budget reached, truncating ${sourceType} sources`,
        );
        break;
      }

      result.sources.push(source);
      result.totalTokenEstimate += sourceTokens;
    }

    if (result.truncated) break;
  }

  const duration = Date.now() - startTime;

  // Log summary
  console.log(`[SourceCollector] === Collection Summary ===`);
  console.log(`  Total sources: ${result.sources.length}`);
  console.log(
    `  Token estimate: ${result.totalTokenEstimate} / ${opts.tokenBudget}`,
  );
  console.log(`  Truncated: ${result.truncated}`);
  console.log(`  By type:`);

  const byType: Record<string, { count: number; tokens: number }> = {};
  result.sources.forEach((s) => {
    if (!byType[s.type]) byType[s.type] = { count: 0, tokens: 0 };
    byType[s.type].count++;
    byType[s.type].tokens += estimateTokens(s.content);
  });

  Object.entries(byType).forEach(([type, data]) => {
    console.log(`    - ${type}: ${data.count} sources (${data.tokens} tokens)`);
  });

  console.log(`[SourceCollector] Collection complete in ${duration}ms`);

  return result;
}

// =============================================================================
// Initialization logging
// =============================================================================

console.log(
  `[SourceCollector] Initialized with source types: conversation, artifact, memory_file, user_block, external`,
);
