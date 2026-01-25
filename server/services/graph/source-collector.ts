/**
 * Multi-Source Collector Service
 *
 * Collects and aggregates content from multiple source types for graph analysis:
 * - Conversation messages
 * - Artifacts (research, code, analysis, etc.)
 * - Memory files (state files with embedded JSON)
 * - User-created blocks (manual insights)
 * - External content (imported)
 */

import { query } from "../../../database/db.js";

// =============================================================================
// Types and Interfaces
// =============================================================================

export type SourceType =
  | "conversation" // Chat messages
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
  };
  weight: number; // Source reliability weight (0.0-1.0)
}

export interface SourceCollectionResult {
  sources: CollectedSource[];
  totalTokenEstimate: number;
  truncated: boolean;
  collectionMetadata: {
    conversationCount: number;
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
const DEFAULT_OPTIONS: Required<CollectionOptions> = {
  sourceTypes: ["conversation", "artifact", "memory_file", "user_block"],
  tokenBudget: 50000,
  conversationLimit: 50,
  includeExistingBlocks: true,
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
// Conversation Source Collector
// =============================================================================

export async function collectConversationSources(
  sessionId: string,
  limit: number = 50,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting conversation sources for session: ${sessionId}`,
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
    type: "conversation",
    content: m.content,
    metadata: {
      createdAt: m.created_at,
      role: m.role as "user" | "assistant" | "system",
    },
    weight: ROLE_WEIGHTS[m.role] || 0.7,
  }));

  const tokenEstimate = sources.reduce(
    (acc, s) => acc + estimateTokens(s.content),
    0,
  );
  console.log(
    `[SourceCollector] Found ${messages.length} messages (limit: ${limit}, truncated: ${messages.length >= limit})`,
  );
  console.log(
    `[SourceCollector] Conversation collection complete: ${sources.length} sources, ~${tokenEstimate} tokens`,
  );

  return sources;
}

// =============================================================================
// Artifact Source Collector
// =============================================================================

export async function collectArtifactSources(
  sessionId: string,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting artifact sources for session: ${sessionId}`,
  );

  const artifacts = await query<{
    id: string;
    type: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string | null;
  }>(
    `SELECT id, type, title, content, created_at, updated_at
     FROM ideation_artifacts
     WHERE session_id = ?
     ORDER BY created_at DESC`,
    [sessionId],
  );

  const sources: CollectedSource[] = artifacts.map((a) => {
    // Truncate large artifacts with marker
    let content = a.content;
    if (content.length > 10000) {
      content = content.slice(0, 10000) + "\n\n[... TRUNCATED ...]";
    }

    return {
      id: a.id,
      type: "artifact",
      content,
      metadata: {
        title: a.title,
        createdAt: a.created_at,
        updatedAt: a.updated_at || undefined,
        artifactType: a.type,
      },
      weight: ARTIFACT_WEIGHTS[a.type] || 0.7,
    };
  });

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

export async function collectMemoryFileSources(
  sessionId: string,
): Promise<CollectedSource[]> {
  console.log(
    `[SourceCollector] Collecting memory file sources for session: ${sessionId}`,
  );

  const memoryFiles = await query<{
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

  const parsedStates: string[] = [];
  const sources: CollectedSource[] = memoryFiles.map((mf) => {
    const { markdown, state } = extractStateFromMemoryFile(mf.content);

    // Include both markdown and state in content for analysis
    let content = markdown;
    if (state) {
      content += `\n\n## Extracted State\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
      parsedStates.push(mf.file_type);
    }

    return {
      id: mf.id,
      type: "memory_file" as SourceType,
      content,
      metadata: {
        createdAt: mf.created_at,
        updatedAt: mf.updated_at,
        memoryFileType: mf.file_type,
      },
      weight: MEMORY_FILE_WEIGHTS[mf.file_type] || 0.7,
    };
  });

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
  console.log(`[SourceCollector] Found ${memoryFiles.length} memory files`);
  if (parsedStates.length > 0) {
    console.log(
      `[SourceCollector] Parsed state from: ${parsedStates.join(", ")}`,
    );
  }
  console.log(
    `[SourceCollector] Memory file collection complete: ${sources.length} sources, ~${tokenEstimate} tokens`,
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
      artifactCount: 0,
      memoryFileCount: 0,
      userBlockCount: 0,
    },
  };

  // Collect in priority order: memory_file > artifact > conversation > user_block
  const priorityOrder: SourceType[] = [
    "memory_file",
    "artifact",
    "conversation",
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
          );
          result.collectionMetadata.conversationCount = sources.length;
          break;
        case "artifact":
          sources = await collectArtifactSources(sessionId);
          result.collectionMetadata.artifactCount = sources.length;
          break;
        case "memory_file":
          sources = await collectMemoryFileSources(sessionId);
          result.collectionMetadata.memoryFileCount = sources.length;
          break;
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
      // Continue with other sources on partial failure
      continue;
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
