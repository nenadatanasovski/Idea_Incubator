/**
 * Analysis Prompt Builder
 *
 * Builds structured prompts for AI analysis with content segmented by source type.
 * Supports attribution tracking and cross-source validation.
 */

import {
  type CollectedSource,
  type SourceCollectionResult,
  type SourceType,
  ARTIFACT_WEIGHTS,
  MEMORY_FILE_WEIGHTS,
} from "./source-collector.js";

// =============================================================================
// Types
// =============================================================================

export interface ExistingBlockSummary {
  id: string;
  type: string;
  content: string;
  status: string;
}

export interface PromptBuildOptions {
  includeExistingBlocks?: boolean;
  maxSourcesPerType?: number;
  includeSourceMetadata?: boolean;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  totalTokenEstimate: number;
  sourceSummary: {
    conversationCount: number;
    conversationInsightCount: number;
    artifactCount: number;
    memoryFileCount: number;
    userBlockCount: number;
    existingBlockCount: number;
  };
}

// =============================================================================
// Source Type Labels and Instructions
// =============================================================================

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  conversation: "CONVERSATION CONTEXT",
  conversation_insight: "AI-SYNTHESIZED INSIGHTS",
  artifact: "ARTIFACTS",
  memory_file: "MEMORY STATE",
  user_block: "USER INSIGHTS",
  external: "EXTERNAL CONTENT",
};

const SOURCE_TYPE_WEIGHT_LABELS: Record<SourceType, string> = {
  conversation: "High",
  conversation_insight: "Very High",
  artifact: "High",
  memory_file: "Very High",
  user_block: "Medium",
  external: "Variable",
};

const SOURCE_TYPE_DESCRIPTIONS: Record<SourceType, string> = {
  conversation: "Recent dialogue between user and assistant.",
  conversation_insight:
    "AI-synthesized key insights extracted from conversation history.",
  artifact: "Documents and code created during session.",
  memory_file: "Persisted discoveries and assessments.",
  user_block: "Manually captured observations.",
  external: "Imported content from external sources.",
};

// =============================================================================
// Helper Functions
// =============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatSource(
  source: CollectedSource,
  includeMetadata: boolean,
): string {
  const lines: string[] = [];

  // Add source ID and role/type metadata
  if (includeMetadata) {
    const meta: string[] = [`[ID: ${source.id}]`];
    if (source.metadata.role) {
      meta.push(`[Role: ${source.metadata.role}]`);
    }
    if (source.metadata.title) {
      meta.push(`[Title: ${source.metadata.title}]`);
    }
    if (source.metadata.artifactType) {
      meta.push(`[Type: ${source.metadata.artifactType}]`);
    }
    if (source.metadata.memoryFileType) {
      meta.push(`[FileType: ${source.metadata.memoryFileType}]`);
    }
    meta.push(`[Weight: ${source.weight.toFixed(2)}]`);
    lines.push(meta.join(" "));
  }

  // Add content (truncate if very long)
  let content = source.content;
  if (content.length > 2000) {
    content =
      content.slice(0, 2000) + "\n\n[... content truncated for analysis ...]";
  }
  lines.push(content);

  // Include supersession info if present (for conversation insights)
  if (source.metadata.supersedes) {
    lines.push("");
    lines.push(`SUPERSEDES: ${source.metadata.supersedes.insightId}`);
    lines.push(`REASON: ${source.metadata.supersedes.reason}`);
  }

  return lines.join("\n");
}

function formatSourceSection(
  sources: CollectedSource[],
  sourceType: SourceType,
  includeMetadata: boolean,
): string {
  if (sources.length === 0) return "";

  const label = SOURCE_TYPE_LABELS[sourceType];
  const weightLabel = SOURCE_TYPE_WEIGHT_LABELS[sourceType];
  const description = SOURCE_TYPE_DESCRIPTIONS[sourceType];

  const lines: string[] = [
    `## ${label} (Weight: ${weightLabel})`,
    "",
    description,
    "",
  ];

  sources.forEach((source, index) => {
    lines.push(`### Source ${index + 1}`);
    lines.push(formatSource(source, includeMetadata));
    lines.push("");
  });

  return lines.join("\n");
}

function formatExistingBlocks(blocks: ExistingBlockSummary[]): string {
  if (blocks.length === 0) return "";

  const lines: string[] = [
    "## EXISTING GRAPH",
    "",
    "Current blocks to avoid duplication.",
    "",
  ];

  blocks.slice(0, 20).forEach((block, index) => {
    lines.push(
      `${index + 1}. [${block.type}] ${block.content.slice(0, 100)}${block.content.length > 100 ? "..." : ""}`,
    );
  });

  if (blocks.length > 20) {
    lines.push(`... and ${blocks.length - 20} more blocks`);
  }

  lines.push("");
  return lines.join("\n");
}

// =============================================================================
// Main Prompt Builder
// =============================================================================

export function buildAnalysisPrompt(
  collectionResult: SourceCollectionResult,
  existingBlocks: ExistingBlockSummary[] = [],
  options: PromptBuildOptions = {},
): BuiltPrompt {
  const {
    includeExistingBlocks = true,
    maxSourcesPerType = 20,
    includeSourceMetadata = true,
  } = options;

  console.log(
    `[AnalysisPromptBuilder] Building prompt for ${collectionResult.sources.length} sources`,
  );

  // Group sources by type
  const sourcesByType: Record<SourceType, CollectedSource[]> = {
    conversation: [],
    conversation_insight: [],
    artifact: [],
    memory_file: [],
    user_block: [],
    external: [],
  };

  collectionResult.sources.forEach((source) => {
    if (sourcesByType[source.type]) {
      sourcesByType[source.type].push(source);
    } else {
      console.warn(
        `[AnalysisPromptBuilder] Unknown source type: ${source.type}`,
      );
    }
  });

  // Log source counts by type
  console.log(`[AnalysisPromptBuilder] Sources by type:`, {
    conversation: sourcesByType.conversation.length,
    conversation_insight: sourcesByType.conversation_insight.length,
    artifact: sourcesByType.artifact.length,
    memory_file: sourcesByType.memory_file.length,
    user_block: sourcesByType.user_block.length,
    external: sourcesByType.external.length,
  });

  // Limit sources per type
  Object.keys(sourcesByType).forEach((type) => {
    const key = type as SourceType;
    if (sourcesByType[key].length > maxSourcesPerType) {
      sourcesByType[key] = sourcesByType[key].slice(0, maxSourcesPerType);
    }
  });

  // Build sections in priority order (matching the plan template)
  const sections: string[] = [];
  const sectionOrder: SourceType[] = [
    "conversation_insight",
    "conversation",
    "artifact",
    "memory_file",
    "user_block",
  ];

  sectionOrder.forEach((sourceType) => {
    const section = formatSourceSection(
      sourcesByType[sourceType],
      sourceType,
      includeSourceMetadata,
    );
    if (section) {
      sections.push(section);
    }
  });

  // Add existing blocks section
  let existingBlockCount = 0;
  if (includeExistingBlocks && existingBlocks.length > 0) {
    sections.push(formatExistingBlocks(existingBlocks));
    existingBlockCount = existingBlocks.length;
  }

  // Build the user prompt with instructions
  const instructionSection = `## INSTRUCTIONS

1. Extract NEW insights not already in the existing graph as BLOCKS
2. Create LINKS between related blocks (both new and existing)
3. Attribute each insight to its source (sourceId, sourceType)
4. Weight confidence by source reliability
5. Identify cross-source corroborations (increases confidence)
6. Flag contradictions between sources
7. When a source indicates it SUPERSEDES another insight:
   - Create the new block with status "active"
   - Include "supersedesBlockId" field referencing the superseded block
   - Create a "supersedes" link from new block to the superseded block
   - The superseded block should be marked for status change to "superseded"

IMPORTANT: Create BOTH blocks AND links! A knowledge graph needs connections between nodes.

Link types to use:
- "supports" - one insight backs up another
- "contradicts" - insights are in tension
- "refines" - one insight adds detail to another
- "depends_on" - one insight requires another
- "leads_to" - one insight causes or implies another
- "related_to" - general semantic relationship
- "addresses" - a solution/action addresses a problem/risk
- "validates" - evidence that validates an assumption
- "derived_from" - one insight was derived from another
- "supersedes" - this insight replaces/supersedes an earlier one (use when SUPERSEDES is indicated)

Return JSON only with the following structure:
{
  "context": {
    "who": "Key stakeholders mentioned",
    "what": "Main concepts, ideas, decisions",
    "when": "Temporal aspects or timelines",
    "where": "Domains, markets, or contexts",
    "why": "Motivations, goals, reasons"
  },
  "proposedChanges": [
    {
      "id": "block_1",
      "type": "create_block",
      "blockType": "problem|solution|assumption|risk|decision|requirement|insight|question|opportunity|context|content",
      "title": "3-5 word summary",
      "content": "The extracted insight",
      "graphMembership": ["problem", "solution", "market", "risk", "fit", "business", "spec"],
      "confidence": 0.85,
      "sourceId": "source-id-here",
      "sourceType": "conversation|conversation_insight|artifact|memory_file|user_block|external",
      "sourceWeight": 0.9,
      "corroboratedBy": [
        {
          "sourceId": "another-source-id",
          "sourceType": "artifact",
          "snippet": "Supporting text snippet"
        }
      ],
      "contradicts": [
        {
          "blockId": "existing-block-id",
          "description": "How this contradicts",
          "severity": "minor|major"
        }
      ],
      "supersedesBlockId": "block_old_decision",
      "supersessionReason": "User changed their mind - explained why"
    },
    {
      "id": "link_1",
      "type": "create_link",
      "sourceBlockId": "block_1",
      "targetBlockId": "block_2",
      "linkType": "supports|contradicts|refines|depends_on|leads_to|related_to|addresses|validates|derived_from|supersedes",
      "confidence": 0.8,
      "reason": "Brief explanation of why these are connected"
    },
    {
      "id": "status_change_1",
      "type": "update_block",
      "blockId": "block_old_decision",
      "statusChange": {
        "newStatus": "superseded",
        "reason": "Replaced by newer decision"
      }
    }
  ],
  "cascadeEffects": [],
  "previewNodes": [],
  "previewEdges": []
}`;

  const userPrompt = sections.join("\n") + "\n" + instructionSection;

  const systemPrompt = `You are a knowledge graph analyst. Your task is to analyze content from multiple sources and build a CONNECTED knowledge graph with both BLOCKS (nodes) and LINKS (edges).

CRITICAL: A knowledge graph is USELESS without connections! You MUST create links between related blocks.

You must:
- Extract ALL meaningful insights as separate blocks (aim for 15-40 blocks from substantive content)
- Create LINKS between related blocks - every block should have at least one connection
- Create a concise title (3-5 words) for each block
- Attribute every change to its source (sourceId, sourceType)
- Adjust confidence based on source reliability weights
- Note when multiple sources corroborate the same insight

Block types to use:
- problem: Issues, challenges, pain points
- solution: Proposed solutions, approaches
- assumption: Beliefs being taken as true
- risk: Concerns, potential problems
- decision: Choices made or to be made
- requirement: Must-haves, constraints
- insight: Key observations, realizations
- question: Open questions needing answers
- opportunity: Potential benefits
- context: Background information
- content: General content that doesn't fit other types

Link types to use:
- supports, contradicts, refines, depends_on, leads_to, related_to, addresses, validates, derived_from

Source reliability order (highest to lowest):
1. Memory files (viability_assessment: 0.95, market_discovery: 0.9)
2. Artifacts (research: 0.9, analysis: 0.85)
3. Conversation (user: 1.0, assistant: 0.8)
4. User blocks (based on status)

Return ONLY valid JSON. No text before or after.`;

  // Calculate token estimates
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userPrompt);
  const totalTokenEstimate = systemTokens + userTokens;

  // Log sections included
  const includedSections = sectionOrder.filter(
    (t) => sourcesByType[t].length > 0,
  );
  if (existingBlockCount > 0) {
    includedSections.push("EXISTING GRAPH" as any);
  }
  console.log(
    `[AnalysisPromptBuilder] Sections included: ${includedSections.map((s) => SOURCE_TYPE_LABELS[s] || s).join(", ")}`,
  );
  console.log(
    `[AnalysisPromptBuilder] Total prompt tokens: ~${totalTokenEstimate}`,
  );
  console.log(`[AnalysisPromptBuilder] Prompt ready for analysis`);

  return {
    systemPrompt,
    userPrompt,
    totalTokenEstimate,
    sourceSummary: {
      conversationCount: sourcesByType.conversation.length,
      conversationInsightCount: sourcesByType.conversation_insight.length,
      artifactCount: sourcesByType.artifact.length,
      memoryFileCount: sourcesByType.memory_file.length,
      userBlockCount: sourcesByType.user_block.length,
      existingBlockCount,
    },
  };
}

// =============================================================================
// Response Schema Types (for Task 2.2)
// =============================================================================

export interface ProposedChange {
  id: string;
  type: "create_block" | "update_block" | "create_link";
  blockType?: string;
  title?: string; // Short 3-5 word summary for quick identification
  content: string;
  graphMembership?: string[];
  confidence: number;

  // Source attribution
  sourceId: string;
  sourceType: SourceType;
  sourceWeight: number;

  // Cross-source validation
  corroboratedBy?: Array<{
    sourceId: string;
    sourceType: SourceType;
    snippet: string;
  }>;

  // Conflict detection
  contradicts?: Array<{
    blockId: string;
    description: string;
    severity: "minor" | "major";
  }>;

  // Supersession handling
  supersedesBlockId?: string; // If this block supersedes an existing block
  supersessionReason?: string; // Reason for superseding

  // Status change for superseded blocks
  statusChange?: {
    blockId: string;
    newStatus: "superseded" | "abandoned";
    reason: string;
  };

  // Link-specific fields (for create_link type)
  sourceBlockId?: string;
  targetBlockId?: string;
  linkType?: string;
  reason?: string;
}

export interface AnalysisResponse {
  context: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
  };
  proposedChanges: ProposedChange[];
  cascadeEffects: Array<{
    id: string;
    affectedBlockId: string;
    affectedBlockContent: string;
    effectType: "confidence_change" | "status_change" | "link_invalidation";
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  previewNodes: Array<{
    id: string;
    type: string;
    content: string;
    isNew?: boolean;
  }>;
  previewEdges: Array<{
    id: string;
    source: string;
    target: string;
    linkType: string;
    isNew?: boolean;
  }>;
}

/**
 * Parse and validate AI response
 */
export function parseAnalysisResponse(
  responseText: string,
): AnalysisResponse | null {
  try {
    // Clean up response - extract JSON from markdown code blocks or raw text
    let jsonText = responseText.trim();

    // Try to extract JSON from markdown code block (```json ... ``` or ``` ... ```)
    // This handles AI responses that have text before/after the JSON block
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else if (jsonText.startsWith("```")) {
      // Fallback: if starts with ``` but no closing block found, strip all ```
      jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
    }

    // If still not valid JSON, try to find a JSON object in the text
    if (!jsonText.startsWith("{")) {
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    const parsed = JSON.parse(jsonText);

    // Basic validation
    if (!parsed.context || !parsed.proposedChanges) {
      console.error(
        "[AnalysisPromptBuilder] Invalid response structure: missing required fields",
      );
      return null;
    }

    // Ensure all proposed changes have source attribution and handle supersession
    const validatedChanges = parsed.proposedChanges.map((change: any) => {
      const validated: any = {
        ...change,
        sourceId: change.sourceId || "unknown",
        sourceType: change.sourceType || "conversation",
        sourceWeight: change.sourceWeight || 0.7,
        corroboratedBy: change.corroboratedBy || [],
        contradicts: change.contradicts || [],
      };

      // Include supersession fields if present
      if (change.supersedesBlockId) {
        validated.supersedesBlockId = change.supersedesBlockId;
        validated.supersessionReason =
          change.supersessionReason || "Decision changed";
      }

      // Include status change if present
      if (change.statusChange) {
        validated.statusChange = {
          blockId: change.statusChange.blockId || change.blockId,
          newStatus: change.statusChange.newStatus,
          reason: change.statusChange.reason || "Status updated",
        };
      }

      // Include link-specific fields
      if (change.type === "create_link") {
        validated.sourceBlockId = change.sourceBlockId;
        validated.targetBlockId = change.targetBlockId;
        validated.linkType = change.linkType || "related_to";
        validated.reason = change.reason;
      }

      return validated;
    });

    return {
      context: parsed.context,
      proposedChanges: validatedChanges,
      cascadeEffects: parsed.cascadeEffects || [],
      previewNodes: parsed.previewNodes || [],
      previewEdges: parsed.previewEdges || [],
    };
  } catch (error) {
    console.error("[AnalysisPromptBuilder] Failed to parse response:", error);
    return null;
  }
}
