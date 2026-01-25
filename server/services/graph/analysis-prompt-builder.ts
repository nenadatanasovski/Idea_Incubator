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
  artifact: "ARTIFACTS",
  memory_file: "MEMORY STATE",
  user_block: "USER INSIGHTS",
  external: "EXTERNAL CONTENT",
};

const SOURCE_TYPE_WEIGHT_LABELS: Record<SourceType, string> = {
  conversation: "High",
  artifact: "High",
  memory_file: "Very High",
  user_block: "Medium",
  external: "Variable",
};

const SOURCE_TYPE_DESCRIPTIONS: Record<SourceType, string> = {
  conversation: "Recent dialogue between user and assistant.",
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
    artifact: [],
    memory_file: [],
    user_block: [],
    external: [],
  };

  collectionResult.sources.forEach((source) => {
    if (sourcesByType[source.type]) {
      sourcesByType[source.type].push(source);
    }
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

1. Extract NEW insights not already in the existing graph
2. Attribute each insight to its source (sourceId, sourceType)
3. Weight confidence by source reliability
4. Identify cross-source corroborations (increases confidence)
5. Flag contradictions between sources

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
      "id": "change_1",
      "type": "create_block",
      "blockType": "content|assumption|risk|action|decision|option|meta|synthesis|pattern|stakeholder_view",
      "content": "The extracted insight",
      "graphMembership": ["problem", "solution", "market", "risk", "fit", "business", "spec"],
      "confidence": 0.85,
      "sourceId": "source-id-here",
      "sourceType": "conversation|artifact|memory_file|user_block",
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
      ]
    }
  ],
  "cascadeEffects": [],
  "previewNodes": [],
  "previewEdges": []
}`;

  const userPrompt = sections.join("\n") + "\n" + instructionSection;

  const systemPrompt = `You are a knowledge graph analyst. Your task is to analyze content from multiple sources and extract insights for a knowledge graph.

You must:
- Identify NEW insights not already captured in existing blocks
- Attribute every proposed change to its source (provide sourceId and sourceType)
- Adjust confidence based on source reliability weights
- Note when multiple sources corroborate the same insight (increases confidence)
- Flag any contradictions between sources

Source reliability order (highest to lowest):
1. Memory files (viability_assessment: 0.95, market_discovery: 0.9, self_discovery: 0.85)
2. Artifacts (research: 0.9, analysis: 0.85, comparison: 0.8)
3. Conversation (user messages: 1.0, assistant: 0.8)
4. User blocks (based on status and confidence)

Return ONLY valid JSON. Do not include any text before or after the JSON.`;

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
    // Clean up response - remove markdown code blocks if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    // Basic validation
    if (!parsed.context || !parsed.proposedChanges) {
      console.error(
        "[AnalysisPromptBuilder] Invalid response structure: missing required fields",
      );
      return null;
    }

    // Ensure all proposed changes have source attribution
    const validatedChanges = parsed.proposedChanges.map((change: any) => ({
      ...change,
      sourceId: change.sourceId || "unknown",
      sourceType: change.sourceType || "conversation",
      sourceWeight: change.sourceWeight || 0.7,
      corroboratedBy: change.corroboratedBy || [],
      contradicts: change.contradicts || [],
    }));

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
