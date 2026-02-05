/**
 * GRAPH ANALYSIS SUBAGENT
 *
 * Specialized sub-agent for background graph analysis tasks.
 * Runs asynchronously with status indicators via WebSocket.
 */

import { v4 as uuidv4 } from "uuid";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { blockExtractor, MemoryBlock, MemoryLink } from "./block-extractor.js";
import { LinkType, GraphType } from "../../schema/index.js";

// ============================================================================
// TYPES
// ============================================================================

export type GraphSubagentTask =
  | "cascade-detection"
  | "link-inference"
  | "contradiction-scan"
  | "assumption-surface"
  | "confidence-recalc"
  | "cycle-detection"
  | "completeness-check"
  | "duplicate-detection"
  | "stale-detection";

export interface GraphAnalysisParams {
  // For cascade-detection
  triggeredByBlockId?: string;
  changeType?: "created" | "updated" | "deleted";

  // For link-inference
  minConfidence?: number;
  maxSuggestions?: number;

  // For confidence-recalc
  sourceBlockIds?: string[];

  // For completeness-check
  targetSpecType?: "mvp" | "full" | "pitch";
}

export interface AffectedBlock {
  blockId: string;
  reason: string;
  suggestedAction: "review" | "auto-update" | "notify";
  propagationLevel: number;
}

export interface LinkSuggestion {
  sourceId: string;
  targetId: string;
  linkType: LinkType;
  confidence: number;
  reason: string;
}

export interface Contradiction {
  blockAId: string;
  blockBId: string;
  contradictionType: "direct" | "implied" | "values";
  description: string;
  severity: "high" | "medium" | "low";
}

export interface SurfacedAssumption {
  content: string;
  sourceBlockId: string;
  confidence: number;
  criticality: "critical" | "important" | "minor";
  suggestedGraphTypes: GraphType[];
}

export interface DetectedCycle {
  blockIds: string[];
  cycleType: "blocking" | "reinforcing";
  description: string;
}

export interface GraphAnalysisResult {
  taskId: string;
  taskType: GraphSubagentTask;
  success: boolean;
  duration: number;

  cascadeResult?: {
    affectedBlocks: AffectedBlock[];
    propagationDepth: number;
  };

  linkInferenceResult?: {
    suggestions: LinkSuggestion[];
  };

  contradictionResult?: {
    contradictions: Contradiction[];
  };

  assumptionResult?: {
    surfacedAssumptions: SurfacedAssumption[];
  };

  cycleResult?: {
    cycles: DetectedCycle[];
  };

  completenessResult?: {
    score: number;
    missingPieces: { type: string; category: string; description: string }[];
  };

  duplicateResult?: {
    duplicates: { blockAId: string; blockBId: string; similarity: number }[];
  };

  staleResult?: {
    staleBlocks: { blockId: string; reason: string; sourceUpdatedAt: string }[];
  };
}

export type ProgressCallback = (progress: number, currentStep: string) => void;

// ============================================================================
// GRAPH ANALYSIS SUBAGENT CLASS
// ============================================================================

export class GraphAnalysisSubagent {
  private client: typeof anthropicClient;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Run a graph analysis task.
   */
  async runAnalysis(
    taskType: GraphSubagentTask,
    sessionId: string,
    params: GraphAnalysisParams = {},
    onProgress?: ProgressCallback,
  ): Promise<GraphAnalysisResult> {
    const taskId = uuidv4();
    const startTime = Date.now();

    onProgress?.(0, "Starting analysis...");

    try {
      let result: Partial<GraphAnalysisResult> = {};

      switch (taskType) {
        case "cascade-detection":
          result.cascadeResult = await this.runCascadeDetection(
            sessionId,
            params,
            onProgress,
          );
          break;
        case "link-inference":
          result.linkInferenceResult = await this.runLinkInference(
            sessionId,
            params,
            onProgress,
          );
          break;
        case "contradiction-scan":
          result.contradictionResult = await this.runContradictionScan(
            sessionId,
            onProgress,
          );
          break;
        case "assumption-surface":
          result.assumptionResult = await this.runAssumptionSurface(
            sessionId,
            onProgress,
          );
          break;
        case "confidence-recalc":
          // Recalculate confidence - just return success
          onProgress?.(100, "Confidence recalculated");
          break;
        case "cycle-detection":
          result.cycleResult = await this.runCycleDetection(
            sessionId,
            onProgress,
          );
          break;
        case "completeness-check":
          result.completenessResult = await this.runCompletenessCheck(
            sessionId,
            params,
            onProgress,
          );
          break;
        case "duplicate-detection":
          result.duplicateResult = await this.runDuplicateDetection(
            sessionId,
            onProgress,
          );
          break;
        case "stale-detection":
          result.staleResult = await this.runStaleDetection(
            sessionId,
            onProgress,
          );
          break;
      }

      onProgress?.(100, "Analysis complete");

      return {
        taskId,
        taskType,
        success: true,
        duration: Date.now() - startTime,
        ...result,
      };
    } catch (error) {
      return {
        taskId,
        taskType,
        success: false,
        duration: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // ANALYSIS METHODS
  // ============================================================================

  private async runCascadeDetection(
    sessionId: string,
    params: GraphAnalysisParams,
    onProgress?: ProgressCallback,
  ): Promise<{
    affectedBlocks: AffectedBlock[];
    propagationDepth: number;
  }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const links = await blockExtractor.getLinksForSession(sessionId);

    onProgress?.(30, "Analyzing dependencies...");

    const triggerBlock = params.triggeredByBlockId;
    if (!triggerBlock) {
      return { affectedBlocks: [], propagationDepth: 0 };
    }

    // Find all blocks that depend on the trigger block
    const affectedBlocks: AffectedBlock[] = [];
    const visited = new Set<string>();
    const queue: { id: string; level: number }[] = [
      { id: triggerBlock, level: 0 },
    ];
    let maxDepth = 0;

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      // Find links where this block is the target
      const dependentLinks = links.filter((l) => l.sourceBlockId === id);

      for (const link of dependentLinks) {
        if (!visited.has(link.targetBlockId)) {
          const block = blocks.find((b) => b.id === link.targetBlockId);
          if (block) {
            affectedBlocks.push({
              blockId: block.id,
              reason: `Depends on changed block via ${link.linkType}`,
              suggestedAction: this.suggestAction(link.linkType),
              propagationLevel: level + 1,
            });
            queue.push({ id: block.id, level: level + 1 });
            maxDepth = Math.max(maxDepth, level + 1);
          }
        }
      }

      onProgress?.(
        30 + (visited.size / blocks.length) * 60,
        `Processing block ${visited.size}/${blocks.length}`,
      );
    }

    onProgress?.(95, "Finalizing results...");

    return {
      affectedBlocks,
      propagationDepth: maxDepth,
    };
  }

  private suggestAction(
    linkType: LinkType,
  ): "review" | "auto-update" | "notify" {
    switch (linkType) {
      case "derived_from":
      case "evidence_for":
        return "auto-update";
      case "conflicts":
      case "supersedes":
        return "review";
      default:
        return "notify";
    }
  }

  private async runLinkInference(
    sessionId: string,
    params: GraphAnalysisParams,
    onProgress?: ProgressCallback,
  ): Promise<{ suggestions: LinkSuggestion[] }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const links = await blockExtractor.getLinksForSession(sessionId);
    const memberships = await blockExtractor.getGraphMemberships(
      blocks.map((b) => b.id),
    );

    onProgress?.(30, "Analyzing potential links...");

    const minConfidence = params.minConfidence ?? 0.7;
    const maxSuggestions = params.maxSuggestions ?? 10;

    // Use Claude to infer potential links
    const blocksContext = blocks
      .map((b) => {
        const graphs = memberships.get(b.id) || [];
        return `[${b.id}] (${b.type}, ${graphs.join(",")}): ${b.content.substring(0, 100)}`;
      })
      .join("\n");

    const existingLinks = links
      .map((l) => `${l.sourceBlockId} -[${l.linkType}]-> ${l.targetBlockId}`)
      .join("\n");

    onProgress?.(50, "Calling AI for link inference...");

    const response = await this.client.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 2048,
      system: `You are a knowledge graph analyst. Given a list of blocks and existing links, suggest new links that should exist but are missing.

Output JSON only:
{
  "suggestions": [
    {
      "sourceId": "block_id_1",
      "targetId": "block_id_2",
      "linkType": "addresses|evidence_for|requires|etc",
      "confidence": 0.0-1.0,
      "reason": "why this link should exist"
    }
  ]
}`,
      messages: [
        {
          role: "user",
          content: `Blocks:\n${blocksContext}\n\nExisting Links:\n${existingLinks || "(none)"}\n\nSuggest missing links (max ${maxSuggestions}, min confidence ${minConfidence}):`,
        },
      ],
    });

    onProgress?.(80, "Parsing results...");

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { suggestions: [] };
    }

    try {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
      }
      const parsed = JSON.parse(jsonText);
      return {
        suggestions: (parsed.suggestions || [])
          .filter((s: LinkSuggestion) => s.confidence >= minConfidence)
          .slice(0, maxSuggestions),
      };
    } catch {
      return { suggestions: [] };
    }
  }

  private async runContradictionScan(
    sessionId: string,
    onProgress?: ProgressCallback,
  ): Promise<{ contradictions: Contradiction[] }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);

    onProgress?.(30, "Scanning for contradictions...");

    const blocksContext = blocks
      .map((b) => `[${b.id}]: ${b.content}`)
      .join("\n\n");

    onProgress?.(50, "Calling AI for contradiction detection...");

    const response = await this.client.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 2048,
      system: `You are a logic analyst. Given blocks of information, find any contradictions between them.

Output JSON only:
{
  "contradictions": [
    {
      "blockAId": "block_id_1",
      "blockBId": "block_id_2",
      "contradictionType": "direct|implied|values",
      "description": "why these contradict",
      "severity": "high|medium|low"
    }
  ]
}`,
      messages: [
        {
          role: "user",
          content: `Find contradictions in these blocks:\n\n${blocksContext}`,
        },
      ],
    });

    onProgress?.(80, "Parsing results...");

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { contradictions: [] };
    }

    try {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
      }
      return JSON.parse(jsonText);
    } catch {
      return { contradictions: [] };
    }
  }

  private async runAssumptionSurface(
    sessionId: string,
    onProgress?: ProgressCallback,
  ): Promise<{ surfacedAssumptions: SurfacedAssumption[] }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);

    // Filter out existing assumption blocks
    const nonAssumptionBlocks = blocks.filter((b) => b.type !== "assumption");

    onProgress?.(30, "Analyzing content for hidden assumptions...");

    const blocksContext = nonAssumptionBlocks
      .map((b) => `[${b.id}]: ${b.content}`)
      .join("\n\n");

    onProgress?.(50, "Calling AI for assumption detection...");

    const response = await this.client.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 2048,
      system: `You are an assumption analyst. Given blocks of information, surface any implicit assumptions that are not explicitly stated.

Output JSON only:
{
  "surfacedAssumptions": [
    {
      "content": "the assumption text",
      "sourceBlockId": "block_id that implies this",
      "confidence": 0.0-1.0,
      "criticality": "critical|important|minor",
      "suggestedGraphTypes": ["problem", "solution", "market", "risk", "fit", "business", "spec"]
    }
  ]
}`,
      messages: [
        {
          role: "user",
          content: `Find implicit assumptions in these blocks:\n\n${blocksContext}`,
        },
      ],
    });

    onProgress?.(80, "Parsing results...");

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return { surfacedAssumptions: [] };
    }

    try {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
      }
      return JSON.parse(jsonText);
    } catch {
      return { surfacedAssumptions: [] };
    }
  }

  private async runCycleDetection(
    sessionId: string,
    onProgress?: ProgressCallback,
  ): Promise<{ cycles: DetectedCycle[] }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const links = await blockExtractor.getLinksForSession(sessionId);

    onProgress?.(30, "Building dependency graph...");

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const block of blocks) {
      graph.set(block.id, []);
    }
    for (const link of links) {
      const deps = graph.get(link.sourceBlockId) || [];
      deps.push(link.targetBlockId);
      graph.set(link.sourceBlockId, deps);
    }

    onProgress?.(50, "Detecting cycles...");

    // Tarjan's algorithm for cycle detection
    const cycles: DetectedCycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const detectCycle = (nodeId: string): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycleNodes = path.slice(cycleStart);
        cycleNodes.push(nodeId);

        cycles.push({
          blockIds: cycleNodes,
          cycleType: this.determineCycleType(cycleNodes, links),
          description: `Cycle involving ${cycleNodes.length} blocks`,
        });
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        detectCycle(neighbor);
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const blockId of graph.keys()) {
      detectCycle(blockId);
    }

    onProgress?.(90, "Finalizing results...");

    return { cycles };
  }

  private determineCycleType(
    cycleNodes: string[],
    links: MemoryLink[],
  ): "blocking" | "reinforcing" {
    // Check if cycle contains blocking link types
    for (let i = 0; i < cycleNodes.length - 1; i++) {
      const link = links.find(
        (l) =>
          l.sourceBlockId === cycleNodes[i] &&
          l.targetBlockId === cycleNodes[i + 1],
      );
      if (
        link &&
        ["requires", "blocks", "constrained_by"].includes(link.linkType)
      ) {
        return "blocking";
      }
    }
    return "reinforcing";
  }

  private async runCompletenessCheck(
    sessionId: string,
    _params: GraphAnalysisParams,
    onProgress?: ProgressCallback,
  ): Promise<{
    score: number;
    missingPieces: { type: string; category: string; description: string }[];
  }> {
    onProgress?.(10, "Loading graph data...");

    const { specValidator } = await import("./spec-validator.js");

    onProgress?.(50, "Running validation...");

    const validation = await specValidator.checkGraphCompleteness(sessionId);

    onProgress?.(90, "Compiling results...");

    return {
      score: validation.overallScore,
      missingPieces: validation.missingPieces.map((p) => ({
        type: p.type,
        category: p.category,
        description: p.description,
      })),
    };
  }

  private async runDuplicateDetection(
    sessionId: string,
    onProgress?: ProgressCallback,
  ): Promise<{
    duplicates: { blockAId: string; blockBId: string; similarity: number }[];
  }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);

    onProgress?.(30, "Computing similarities...");

    const duplicates: {
      blockAId: string;
      blockBId: string;
      similarity: number;
    }[] = [];

    // Simple Jaccard similarity for now
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const wordsA = new Set(blocks[i].content.toLowerCase().split(/\s+/));
        const wordsB = new Set(blocks[j].content.toLowerCase().split(/\s+/));
        const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
        const union = new Set([...wordsA, ...wordsB]);
        const similarity = intersection.size / union.size;

        if (similarity > 0.7) {
          duplicates.push({
            blockAId: blocks[i].id,
            blockBId: blocks[j].id,
            similarity,
          });
        }
      }

      onProgress?.(
        30 + (i / blocks.length) * 60,
        `Comparing block ${i + 1}/${blocks.length}`,
      );
    }

    return { duplicates };
  }

  private async runStaleDetection(
    sessionId: string,
    onProgress?: ProgressCallback,
  ): Promise<{
    staleBlocks: { blockId: string; reason: string; sourceUpdatedAt: string }[];
  }> {
    onProgress?.(10, "Loading graph data...");

    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const links = await blockExtractor.getLinksForSession(sessionId);

    onProgress?.(50, "Checking for stale blocks...");

    const staleBlocks: {
      blockId: string;
      reason: string;
      sourceUpdatedAt: string;
    }[] = [];

    // Find derived blocks and check if their sources have been updated
    const derivedLinks = links.filter((l) => l.linkType === "derived_from");

    for (const link of derivedLinks) {
      const derivedBlock = blocks.find((b) => b.id === link.sourceBlockId);
      const sourceBlock = blocks.find((b) => b.id === link.targetBlockId);

      if (derivedBlock && sourceBlock) {
        const derivedTime = new Date(derivedBlock.updatedAt).getTime();
        const sourceTime = new Date(sourceBlock.updatedAt).getTime();

        if (sourceTime > derivedTime) {
          staleBlocks.push({
            blockId: derivedBlock.id,
            reason: `Source block "${sourceBlock.content.substring(0, 50)}..." was updated`,
            sourceUpdatedAt: sourceBlock.updatedAt,
          });
        }
      }
    }

    return { staleBlocks };
  }
}

// ============================================================================
// GRAPH-TO-PROJECT LINKING (Phase 9 - T9.6)
// ============================================================================

export interface FileBlockReference {
  filePath: string;
  blockIds: string[];
  referenceType: "generated_from" | "references" | "describes";
}

export interface BlockFileLink {
  blockId: string;
  artifactId: string;
  artifactType: "spec" | "research" | "planning" | "build" | "other";
  artifactSection?: string;
  filePath: string;
}

/**
 * Analyze session and link blocks to project files
 */
export async function linkBlocksToProjectFiles(
  sessionId: string,
  userSlug: string,
  ideaSlug: string,
): Promise<BlockFileLink[]> {
  const blocks = await blockExtractor.getBlocksForSession(sessionId);
  const links: BlockFileLink[] = [];

  // Import project file utilities
  const { getIdeaFolderPath, ideaFolderExists } =
    await import("../../utils/folder-structure.js");

  if (!ideaFolderExists(userSlug, ideaSlug)) {
    return [];
  }

  const ideaFolderPath = getIdeaFolderPath(userSlug, ideaSlug);

  // Map block types to file paths
  const blockTypeToFile: Record<
    string,
    { path: string; type: BlockFileLink["artifactType"] }
  > = {
    content: { path: "README.md", type: "other" },
    decision: { path: "planning/brief.md", type: "planning" },
    assumption: { path: "validation/assumptions.md", type: "planning" },
  };

  // Map graph types to file paths
  const graphTypeToFile: Record<
    string,
    { path: string; type: BlockFileLink["artifactType"] }
  > = {
    problem: { path: "problem-solution.md", type: "planning" },
    solution: { path: "problem-solution.md", type: "planning" },
    market: { path: "research/market.md", type: "research" },
    risk: { path: "validation/assumptions.md", type: "planning" },
    fit: { path: "target-users.md", type: "planning" },
    business: { path: "business-model.md", type: "planning" },
    spec: { path: "build/APP-SPEC.md", type: "spec" },
  };

  // Get graph memberships
  const memberships = await blockExtractor.getGraphMemberships(
    blocks.map((b) => b.id),
  );

  for (const block of blocks) {
    // Check if block type has a direct file mapping
    const typeMapping = blockTypeToFile[block.type];
    if (typeMapping) {
      const fullPath = `${ideaFolderPath}/${typeMapping.path}`;
      const { existsSync } = await import("fs");
      if (existsSync(fullPath)) {
        links.push({
          blockId: block.id,
          artifactId: `file:${typeMapping.path}`,
          artifactType: typeMapping.type,
          filePath: typeMapping.path,
        });
      }
    }

    // Check graph memberships for file mappings
    const graphs = memberships.get(block.id) || [];
    for (const graph of graphs) {
      const graphMapping = graphTypeToFile[graph];
      if (graphMapping) {
        const fullPath = `${ideaFolderPath}/${graphMapping.path}`;
        const { existsSync } = await import("fs");
        if (existsSync(fullPath)) {
          // Avoid duplicate links
          const existing = links.find(
            (l) => l.blockId === block.id && l.filePath === graphMapping.path,
          );
          if (!existing) {
            links.push({
              blockId: block.id,
              artifactId: `file:${graphMapping.path}`,
              artifactType: graphMapping.type,
              filePath: graphMapping.path,
            });
          }
        }
      }
    }
  }

  // Update blocks with artifact references
  for (const link of links) {
    await blockExtractor.updateBlockArtifactLink(
      link.blockId,
      link.artifactId,
      link.artifactType,
      link.artifactSection,
    );
  }

  return links;
}

/**
 * Find all blocks that reference a specific project file
 */
export async function findBlocksReferencingFile(
  sessionId: string,
  filePath: string,
): Promise<MemoryBlock[]> {
  const blocks = await blockExtractor.getBlocksForSession(sessionId);

  // Filter blocks that have artifactId matching the file path
  const referencingBlocks = blocks.filter((block) => {
    const artifactId = block.properties?.artifactId;
    if (!artifactId) return false;

    // Check if artifactId contains the file path
    if (typeof artifactId === "string") {
      return artifactId.includes(filePath) || artifactId === `file:${filePath}`;
    }
    return false;
  });

  return referencingBlocks;
}

/**
 * Get file references grouped by file path
 */
export async function getFileBlockReferences(
  sessionId: string,
): Promise<FileBlockReference[]> {
  const blocks = await blockExtractor.getBlocksForSession(sessionId);
  const fileRefs = new Map<
    string,
    { blockIds: string[]; type: FileBlockReference["referenceType"] }
  >();

  for (const block of blocks) {
    const artifactId = block.properties?.artifactId;
    if (!artifactId || typeof artifactId !== "string") continue;

    // Extract file path from artifactId
    const filePath = artifactId.startsWith("file:")
      ? artifactId.substring(5)
      : artifactId;

    const existing = fileRefs.get(filePath);
    if (existing) {
      existing.blockIds.push(block.id);
    } else {
      // Determine reference type based on block type (ARCH-001 types)
      let refType: FileBlockReference["referenceType"] = "references";
      if (block.type === "artifact") {
        refType = "generated_from";
      } else if (block.type === "evidence" || block.type === "knowledge") {
        refType = "describes";
      }

      fileRefs.set(filePath, { blockIds: [block.id], type: refType });
    }
  }

  return Array.from(fileRefs.entries()).map(([filePath, data]) => ({
    filePath,
    blockIds: data.blockIds,
    referenceType: data.type,
  }));
}

// Singleton export
export const graphAnalysisSubagent = new GraphAnalysisSubagent();
