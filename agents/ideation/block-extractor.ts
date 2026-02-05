/**
 * BLOCK EXTRACTOR SERVICE
 *
 * Extracts structured blocks from AI responses and artifacts for the memory graph.
 * Uses Claude to analyze content and identify blocks, links, and graph memberships.
 */

import { v4 as uuidv4 } from "uuid";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { query, run, saveDb } from "../../database/db.js";
import { IdeationMessage } from "../../types/ideation.js";
import { StoredArtifact } from "./artifact-store.js";
import {
  BlockType,
  BlockStatus,
  blockTypes,
  graphTypes,
  GraphType,
  LinkType,
  linkTypes,
  canonicalBlockTypes,
  type CanonicalBlockType,
} from "../../schema/index.js";

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryBlock {
  id: string;
  sessionId: string;
  ideaId?: string | null;
  type: BlockType;
  title?: string | null; // Short 3-5 word summary for quick identification
  content: string;
  properties?: Record<string, unknown> | null;
  status: BlockStatus;
  confidence?: number | null;
  abstractionLevel?: "vision" | "strategy" | "tactic" | "implementation" | null;
  createdAt: string;
  updatedAt: string;
  extractedFromMessageId?: string | null;
  artifactId?: string | null;
}

export interface MemoryLink {
  id: string;
  sessionId: string;
  sourceBlockId: string;
  targetBlockId: string;
  linkType: LinkType;
  degree?: "full" | "partial" | "minimal" | null;
  confidence?: number | null;
  reason?: string | null;
  status: "active" | "superseded" | "removed";
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionResult {
  blocks: MemoryBlock[];
  links: MemoryLink[];
  warnings: string[];
}

interface ExtractedBlock {
  type?: string; // Legacy single type (backward compat)
  types?: string[]; // New multi-type field
  content: string;
  confidence: number;
  graph_membership: string[];
  properties?: Record<string, unknown>;
  abstraction_level?: string;
}

interface ExtractedLink {
  source_content_match: string;
  target_content_match: string;
  link_type: string;
  degree?: string;
  confidence?: number;
  reason?: string;
}

interface ExtractionResponse {
  blocks: ExtractedBlock[];
  links: ExtractedLink[];
}

// ============================================================================
// EXTRACTION PROMPT
// ============================================================================

const BLOCK_EXTRACTION_PROMPT = `
Analyze this message and extract structured blocks. For each block, assign ONE type from these 9 canonical block types (ARCH-001):

1. **knowledge** - Verified facts, patterns, insights, conclusions, observations
2. **decision** - Choices made or being considered, with rationale
3. **assumption** - Unverified beliefs being made (implicit or explicit)
4. **question** - Open unknowns, things to investigate
5. **requirement** - Must-have constraints, specifications, acceptance criteria
6. **task** - Actions, next steps, to-dos, work items
7. **proposal** - Suggested changes or improvements awaiting approval
8. **artifact** - References to outputs (code, docs, specs, files)
9. **evidence** - Validation data, proof, measurements, external research

IMPORTANT: 
- Use exactly ONE type per block from the 9 above
- Do NOT use: insight, fact, pattern, synthesis, option, action, meta (these are old types)
- Graph dimensions (problem, solution, market, risk, etc.) go in graph_membership, NOT as types

For each block, determine:
- types: Array with exactly ONE block type from the 9 canonical types above
- content: The actual content/text (keep it concise but complete)
- confidence: 0.0-1.0 how confident this information is correct
- graph_membership: Which business dimensions this belongs to: problem, solution, market, risk, fit, business, spec, distribution, marketing, manufacturing
- properties: Any structured data (numbers, dates, named entities) including source attribution
- abstraction_level: vision, strategy, tactic, or implementation

For source attribution, extract when applicable and add to properties:
- source_type: research_firm | primary_research | expert | anecdote | assumption | unknown
- source_name: The name of the source (e.g., "Gartner 2025 Report", "Interview with John Smith")
- source_date: When the source was published or obtained (ISO format, e.g., "2025-03-15")
- verifiable: true if the claim can be independently verified, false otherwise

For links between blocks, identify:
- source_content_match: Content of the source block
- target_content_match: Content of the target block
- link_type: One of: addresses, creates, requires, conflicts, supports, depends_on, enables, suggests, supersedes, validates, invalidates, references, evidence_for, elaborates, refines, specializes, alternative_to, instance_of, constrained_by, derived_from, measured_by
- degree: full, partial, or minimal
- confidence: 0.0-1.0
- reason: Why this link exists

Return JSON only, no markdown:
{
  "blocks": [
    {
      "types": ["knowledge"],
      "content": "Legal tech market is $50B TAM",
      "confidence": 0.85,
      "graph_membership": ["market"],
      "properties": {
        "market_size": 50000000000,
        "market": "Legal tech",
        "source_type": "research_firm",
        "source_name": "Gartner 2025 Legal Tech Report",
        "source_date": "2025-03-15",
        "verifiable": true
      },
      "abstraction_level": "strategy"
    }
  ],
  "links": [
    {
      "source_content_match": "Legal tech market is $50B TAM",
      "target_content_match": "Our target is enterprise legal departments",
      "link_type": "evidence_for",
      "degree": "partial",
      "confidence": 0.8,
      "reason": "Market size supports enterprise targeting"
    }
  ]
}

If no meaningful blocks can be extracted, return: {"blocks": [], "links": []}

CRITICAL: Your entire response must be valid JSON. Start with { and end with }. No explanations, no markdown, no text before or after. Just the JSON object.
`;

// ============================================================================
// BLOCK EXTRACTOR CLASS
// ============================================================================

export class BlockExtractor {
  private client: typeof anthropicClient;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Extract blocks from an AI response message.
   */
  async extractFromMessage(
    message: IdeationMessage,
    sessionId: string,
    existingBlocks: MemoryBlock[] = [],
  ): Promise<ExtractionResult> {
    // Skip extraction for user messages and short messages
    if (message.role === "user" || message.content.length < 50) {
      return { blocks: [], links: [], warnings: [] };
    }

    const extraction = await this.callExtractionLLM(message.content);
    return this.processExtraction(
      extraction,
      sessionId,
      existingBlocks,
      message.id,
      undefined,
    );
  }

  /**
   * Extract blocks from an artifact (pitch deck, action plan, etc.)
   */
  async extractFromArtifact(
    artifact: StoredArtifact,
    sessionId: string,
    existingBlocks: MemoryBlock[] = [],
  ): Promise<ExtractionResult> {
    const content =
      typeof artifact.content === "string"
        ? artifact.content
        : JSON.stringify(artifact.content, null, 2);

    // Skip extraction for very short content
    if (content.length < 50) {
      return { blocks: [], links: [], warnings: [] };
    }

    const extraction = await this.callExtractionLLM(content);
    return this.processExtraction(
      extraction,
      sessionId,
      existingBlocks,
      undefined,
      artifact.id,
    );
  }

  /**
   * Re-extract all blocks from session history.
   */
  async reextractSession(sessionId: string): Promise<ExtractionResult> {
    // Clear existing blocks for this session
    await run(
      "DELETE FROM memory_graph_memberships WHERE block_id IN (SELECT id FROM memory_blocks WHERE session_id = ?)",
      [sessionId],
    );
    await run("DELETE FROM memory_links WHERE session_id = ?", [sessionId]);
    await run("DELETE FROM memory_blocks WHERE session_id = ?", [sessionId]);
    await saveDb();

    // Get all messages for the session
    const messages = await query<{
      id: string;
      role: string;
      content: string;
    }>(
      "SELECT id, role, content FROM ideation_messages WHERE session_id = ? ORDER BY created_at ASC",
      [sessionId],
    );

    const allBlocks: MemoryBlock[] = [];
    const allLinks: MemoryLink[] = [];
    const allWarnings: string[] = [];

    // Extract from each message
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.content.length >= 50) {
        const result = await this.extractFromMessage(
          {
            id: msg.id,
            sessionId,
            role: msg.role as "user" | "assistant",
            content: msg.content,
            buttonsShown: null,
            buttonClicked: null,
            formShown: null,
            formResponse: null,
            webSearchResults: null,
            tokenCount: 0,
            createdAt: new Date(),
          },
          sessionId,
          allBlocks,
        );
        allBlocks.push(...result.blocks);
        allLinks.push(...result.links);
        allWarnings.push(...result.warnings);
      }
    }

    // Get all artifacts for the session
    const artifacts = await query<{
      id: string;
      type: string;
      title: string;
      content: string;
    }>(
      "SELECT id, type, title, content FROM ideation_artifacts WHERE session_id = ?",
      [sessionId],
    );

    for (const artifact of artifacts) {
      const result = await this.extractFromArtifact(
        {
          id: artifact.id,
          sessionId,
          type: artifact.type as StoredArtifact["type"],
          title: artifact.title,
          content: artifact.content,
          status: "ready",
          createdAt: new Date().toISOString(),
        },
        sessionId,
        allBlocks,
      );
      allBlocks.push(...result.blocks);
      allLinks.push(...result.links);
      allWarnings.push(...result.warnings);
    }

    return { blocks: allBlocks, links: allLinks, warnings: allWarnings };
  }

  /**
   * Get all blocks for a session.
   */
  async getBlocksForSession(sessionId: string): Promise<MemoryBlock[]> {
    const rows = await query<{
      id: string;
      session_id: string;
      idea_id: string | null;
      type: string;
      title: string | null;
      content: string;
      properties: string | null;
      status: string;
      confidence: number | null;
      abstraction_level: string | null;
      created_at: string;
      updated_at: string;
      extracted_from_message_id: string | null;
      artifact_id: string | null;
    }>(
      "SELECT * FROM memory_blocks WHERE session_id = ? ORDER BY created_at ASC",
      [sessionId],
    );

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      ideaId: row.idea_id,
      type: row.type as BlockType,
      title: row.title,
      content: row.content,
      properties: row.properties ? JSON.parse(row.properties) : null,
      status: row.status as BlockStatus,
      confidence: row.confidence,
      abstractionLevel:
        row.abstraction_level as MemoryBlock["abstractionLevel"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      extractedFromMessageId: row.extracted_from_message_id,
      artifactId: row.artifact_id,
    }));
  }

  /**
   * Get all links for a session.
   */
  async getLinksForSession(sessionId: string): Promise<MemoryLink[]> {
    const rows = await query<{
      id: string;
      session_id: string;
      source_block_id: string;
      target_block_id: string;
      link_type: string;
      degree: string | null;
      confidence: number | null;
      reason: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      "SELECT * FROM memory_links WHERE session_id = ? ORDER BY created_at ASC",
      [sessionId],
    );

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      sourceBlockId: row.source_block_id,
      targetBlockId: row.target_block_id,
      linkType: row.link_type as LinkType,
      degree: row.degree as MemoryLink["degree"],
      confidence: row.confidence,
      reason: row.reason,
      status: row.status as MemoryLink["status"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Get graph memberships for blocks.
   */
  async getGraphMemberships(
    blockIds: string[],
  ): Promise<Map<string, GraphType[]>> {
    if (blockIds.length === 0) {
      return new Map();
    }

    const placeholders = blockIds.map(() => "?").join(",");
    const rows = await query<{
      block_id: string;
      graph_type: string;
    }>(
      `SELECT block_id, graph_type FROM memory_graph_memberships WHERE block_id IN (${placeholders})`,
      blockIds,
    );

    const memberships = new Map<string, GraphType[]>();
    for (const row of rows) {
      const existing = memberships.get(row.block_id) || [];
      existing.push(row.graph_type as GraphType);
      memberships.set(row.block_id, existing);
    }

    return memberships;
  }

  /**
   * Get block types from the junction table for blocks.
   */
  async getBlockTypes(blockIds: string[]): Promise<Map<string, string[]>> {
    if (blockIds.length === 0) {
      return new Map();
    }

    const placeholders = blockIds.map(() => "?").join(",");
    const rows = await query<{
      block_id: string;
      block_type: string;
    }>(
      `SELECT block_id, block_type FROM memory_block_types WHERE block_id IN (${placeholders})`,
      blockIds,
    );

    const typeMap = new Map<string, string[]>();
    for (const row of rows) {
      const existing = typeMap.get(row.block_id) || [];
      existing.push(row.block_type);
      typeMap.set(row.block_id, existing);
    }

    return typeMap;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Call Claude to extract blocks from content.
   */
  private async callExtractionLLM(
    content: string,
  ): Promise<ExtractionResponse> {
    try {
      const response = await this.client.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 4096,
        system: BLOCK_EXTRACTION_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract blocks from this content:\n\n${content}`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        return { blocks: [], links: [] };
      }

      try {
        // Try to parse JSON from the response
        let jsonText = textContent.text.trim();

        // Remove markdown code block if present
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
        }
        
        // Try to extract JSON if response starts with non-JSON text
        if (!jsonText.startsWith("{")) {
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          } else {
            // No JSON found at all - model returned prose
            console.warn("[BlockExtractor] No JSON found in response, returning empty");
            return { blocks: [], links: [] };
          }
        }

        const parsed = JSON.parse(jsonText);
        return {
          blocks: parsed.blocks || [],
          links: parsed.links || [],
        };
      } catch (parseError) {
        console.error(
          "[BlockExtractor] Failed to parse extraction response:",
          parseError,
        );
        console.error(
          "[BlockExtractor] Raw response (first 200 chars):",
          textContent.text.slice(0, 200),
        );
        return { blocks: [], links: [] };
      }
    } catch (error) {
      console.error("[BlockExtractor] Extraction LLM call failed:", error);
      return { blocks: [], links: [] };
    }
  }

  /**
   * Process extracted data into MemoryBlocks and MemoryLinks.
   */
  private async processExtraction(
    extraction: ExtractionResponse,
    sessionId: string,
    existingBlocks: MemoryBlock[],
    messageId?: string,
    artifactId?: string,
  ): Promise<ExtractionResult> {
    const warnings: string[] = [];
    const newBlocks: MemoryBlock[] = [];
    const newLinks: MemoryLink[] = [];
    const contentToBlockId = new Map<string, string>();

    // Process blocks
    for (const extracted of extraction.blocks) {
      // Support both new "types" array and legacy "type" string
      const rawTypes =
        extracted.types && extracted.types.length > 0
          ? extracted.types
          : extracted.type
            ? [extracted.type]
            : [];

      // Validate block types and remap graph dimension names
      const { blockTypes: validatedTypes, remappedGraphTypes } =
        this.validateBlockTypes(rawTypes);

      // Also validate via legacy method for backward compat on memory_blocks.type column
      const primaryType =
        this.validateBlockType(validatedTypes[0]) || ("knowledge" as BlockType);

      // Check for duplicates using semantic similarity
      const duplicate = this.findDuplicate(extracted.content, existingBlocks);
      if (duplicate) {
        warnings.push(
          `Duplicate detected: "${extracted.content.substring(0, 50)}..." matches existing block`,
        );
        contentToBlockId.set(extracted.content, duplicate.id);
        continue;
      }

      const now = new Date().toISOString();
      const block: MemoryBlock = {
        id: uuidv4(),
        sessionId,
        type: primaryType,
        content: extracted.content,
        properties: extracted.properties || null,
        status: "active",
        confidence: extracted.confidence || null,
        abstractionLevel: this.validateAbstractionLevel(
          extracted.abstraction_level,
        ),
        createdAt: now,
        updatedAt: now,
        extractedFromMessageId: messageId || null,
        artifactId: artifactId || null,
      };

      // Save block to database
      await run(
        `INSERT INTO memory_blocks (id, session_id, type, content, properties, status, confidence, abstraction_level, created_at, updated_at, extracted_from_message_id, artifact_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          block.id,
          block.sessionId,
          block.type,
          block.content,
          block.properties ? JSON.stringify(block.properties) : null,
          block.status,
          block.confidence ?? null,
          block.abstractionLevel ?? null,
          block.createdAt,
          block.updatedAt,
          block.extractedFromMessageId ?? null,
          block.artifactId ?? null,
        ],
      );

      // Save block types to junction table
      for (const bt of validatedTypes) {
        await run(
          `INSERT OR IGNORE INTO memory_block_types (block_id, block_type, created_at) VALUES (?, ?, ?)`,
          [block.id, bt, now],
        );
      }

      // Save graph memberships (merge extracted + remapped from block type validation)
      const graphMemberships = this.validateGraphMemberships(
        extracted.graph_membership,
      );
      // Add remapped graph types (from AI using graph names as block types)
      for (const gt of remappedGraphTypes) {
        if (!graphMemberships.includes(gt)) {
          graphMemberships.push(gt);
        }
      }
      for (const graphType of graphMemberships) {
        await run(
          `INSERT INTO memory_graph_memberships (block_id, graph_type, created_at) VALUES (?, ?, ?)`,
          [block.id, graphType, now],
        );
      }

      newBlocks.push(block);
      contentToBlockId.set(extracted.content, block.id);
      existingBlocks.push(block);
    }

    // Process links
    for (const extracted of extraction.links) {
      const sourceBlockId = this.findBlockIdByContent(
        extracted.source_content_match,
        existingBlocks,
        contentToBlockId,
      );
      const targetBlockId = this.findBlockIdByContent(
        extracted.target_content_match,
        existingBlocks,
        contentToBlockId,
      );

      if (!sourceBlockId || !targetBlockId) {
        warnings.push(
          `Could not find blocks for link: ${extracted.source_content_match.substring(0, 30)}... -> ${extracted.target_content_match.substring(0, 30)}...`,
        );
        continue;
      }

      const linkType = this.validateLinkType(extracted.link_type);
      if (!linkType) {
        warnings.push(`Invalid link type: ${extracted.link_type}`);
        continue;
      }

      const now = new Date().toISOString();
      const link: MemoryLink = {
        id: uuidv4(),
        sessionId,
        sourceBlockId,
        targetBlockId,
        linkType,
        degree: this.validateDegree(extracted.degree),
        confidence: extracted.confidence || null,
        reason: extracted.reason || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      // Save link to database
      await run(
        `INSERT INTO memory_links (id, session_id, source_block_id, target_block_id, link_type, degree, confidence, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          link.id,
          link.sessionId,
          link.sourceBlockId,
          link.targetBlockId,
          link.linkType,
          link.degree ?? null,
          link.confidence ?? null,
          link.reason ?? null,
          link.status,
          link.createdAt,
          link.updatedAt,
        ],
      );

      newLinks.push(link);
    }

    await saveDb();

    return { blocks: newBlocks, links: newLinks, warnings };
  }

  /**
   * Find a duplicate block using semantic similarity.
   */
  private findDuplicate(
    content: string,
    existingBlocks: MemoryBlock[],
  ): MemoryBlock | null {
    // Simple string similarity for now (can be enhanced with embeddings)
    const normalizedContent = content.toLowerCase().trim();

    for (const block of existingBlocks) {
      const normalizedExisting = block.content.toLowerCase().trim();

      // Exact match
      if (normalizedContent === normalizedExisting) {
        return block;
      }

      // High overlap (simple Jaccard similarity)
      const contentWords = new Set(normalizedContent.split(/\s+/));
      const existingWords = new Set(normalizedExisting.split(/\s+/));
      const intersection = new Set(
        [...contentWords].filter((x) => existingWords.has(x)),
      );
      const union = new Set([...contentWords, ...existingWords]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.8) {
        return block;
      }
    }

    return null;
  }

  /**
   * Find block ID by content match.
   */
  private findBlockIdByContent(
    contentMatch: string,
    existingBlocks: MemoryBlock[],
    contentToBlockId: Map<string, string>,
  ): string | null {
    // First check the exact content map
    if (contentToBlockId.has(contentMatch)) {
      return contentToBlockId.get(contentMatch)!;
    }

    // Then search existing blocks for partial matches
    const normalizedMatch = contentMatch.toLowerCase().trim();
    for (const block of existingBlocks) {
      const normalizedContent = block.content.toLowerCase().trim();
      if (
        normalizedContent.includes(normalizedMatch) ||
        normalizedMatch.includes(normalizedContent)
      ) {
        return block.id;
      }
    }

    return null;
  }

  /**
   * Validate and return block type.
   */
  private validateBlockType(type: string): BlockType | null {
    const normalized = type.toLowerCase().replace(/-/g, "_");
    if (blockTypes.includes(normalized as BlockType)) {
      return normalized as BlockType;
    }
    return null;
  }

  /**
   * Validate block types array, remap old types to ARCH-001 types.
   * Returns { blockTypes, remappedGraphTypes } where remappedGraphTypes should be
   * added to graphMembership.
   */
  private validateBlockTypes(types: string[]): {
    blockTypes: CanonicalBlockType[];
    remappedGraphTypes: GraphType[];
  } {
    const validBlockTypes: CanonicalBlockType[] = [];
    const remappedGraphTypes: GraphType[] = [];

    // Map old types to new ARCH-001 types
    const typeMapping: Record<string, CanonicalBlockType> = {
      // Old extractor types → new
      'insight': 'knowledge',
      'fact': 'knowledge',
      'pattern': 'knowledge',
      'synthesis': 'knowledge',
      'option': 'decision',
      'action': 'task',
      'meta': 'knowledge',
      // Old schema types → new
      'content': 'knowledge',
      'derived': 'knowledge',
      'cycle': 'knowledge',
      'stakeholder_view': 'knowledge',
      'external': 'evidence',
      'placeholder': 'question',
      'learning': 'knowledge',
      'persona': 'knowledge',
      'constraint': 'requirement',
      'blocker': 'task',
      'epic': 'task',
      'story': 'task',
      'bug': 'task',
      'milestone': 'task',
      'evaluation': 'evidence',
    };

    for (const t of types) {
      const normalized = t.toLowerCase().replace(/-/g, "_");
      
      // Check if it's already a valid ARCH-001 type
      if (canonicalBlockTypes.includes(normalized as CanonicalBlockType)) {
        validBlockTypes.push(normalized as CanonicalBlockType);
      }
      // Check if it's an old type that needs mapping
      else if (typeMapping[normalized]) {
        validBlockTypes.push(typeMapping[normalized]);
      }
      // Check if it's a graph dimension (should be in graph_membership)
      else if (graphTypes.includes(normalized as GraphType)) {
        remappedGraphTypes.push(normalized as GraphType);
      }
    }

    // Default to "knowledge" if no valid type found
    if (validBlockTypes.length === 0) {
      validBlockTypes.push("knowledge");
    }

    return { blockTypes: validBlockTypes, remappedGraphTypes };
  }

  /**
   * Validate and return link type.
   */
  private validateLinkType(type: string): LinkType | null {
    const normalized = type.toLowerCase().replace(/-/g, "_");
    if (linkTypes.includes(normalized as LinkType)) {
      return normalized as LinkType;
    }
    return null;
  }

  /**
   * Validate and return graph memberships.
   */
  private validateGraphMemberships(memberships: string[]): GraphType[] {
    if (!memberships || !Array.isArray(memberships)) {
      return [];
    }
    return memberships
      .map((m) => m.toLowerCase())
      .filter((m) => graphTypes.includes(m as GraphType)) as GraphType[];
  }

  /**
   * Validate and return abstraction level.
   */
  private validateAbstractionLevel(
    level?: string,
  ): MemoryBlock["abstractionLevel"] {
    if (!level) return null;
    const normalized = level.toLowerCase();
    if (
      ["vision", "strategy", "tactic", "implementation"].includes(normalized)
    ) {
      return normalized as MemoryBlock["abstractionLevel"];
    }
    return null;
  }

  /**
   * Validate and return degree.
   */
  private validateDegree(degree?: string): MemoryLink["degree"] {
    if (!degree) return null;
    const normalized = degree.toLowerCase();
    if (["full", "partial", "minimal"].includes(normalized)) {
      return normalized as MemoryLink["degree"];
    }
    return null;
  }

  // ============================================================================
  // ARTIFACT LINKING (Phase 9 - T9.6)
  // ============================================================================

  /**
   * Update a block's artifact link (for Graph-to-Project linking).
   *
   * @param blockId - The block ID to update
   * @param artifactId - The artifact ID (e.g., "file:build/APP-SPEC.md")
   * @param artifactType - The type of artifact
   * @param artifactSection - Optional section within the artifact
   */
  async updateBlockArtifactLink(
    blockId: string,
    artifactId: string,
    artifactType: string,
    artifactSection?: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    // Get current block properties
    const rows = await query<{ properties: string | null }>(
      `SELECT properties FROM memory_blocks WHERE id = ?`,
      [blockId],
    );

    if (rows.length === 0) {
      console.warn(
        `[BlockExtractor] Block ${blockId} not found for artifact linking`,
      );
      return;
    }

    // Parse existing properties
    let properties: Record<string, unknown> = {};
    if (rows[0].properties) {
      try {
        properties = JSON.parse(rows[0].properties);
      } catch {
        properties = {};
      }
    }

    // Add artifact linking properties
    properties.artifactId = artifactId;
    properties.artifactType = artifactType;
    if (artifactSection) {
      properties.artifactSection = artifactSection;
    }

    // Update block
    await run(
      `UPDATE memory_blocks SET properties = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(properties), now, blockId],
    );

    console.log(
      `[BlockExtractor] Linked block ${blockId} to artifact ${artifactId}`,
    );
  }

  /**
   * Get all blocks linked to a specific artifact.
   *
   * @param sessionId - The session ID
   * @param artifactId - The artifact ID to find blocks for
   * @returns Array of blocks linked to the artifact
   */
  async getBlocksByArtifact(
    sessionId: string,
    artifactId: string,
  ): Promise<MemoryBlock[]> {
    const blocks = await this.getBlocksForSession(sessionId);

    return blocks.filter((block) => {
      if (!block.properties) return false;
      return block.properties.artifactId === artifactId;
    });
  }
}

// Singleton export
export const blockExtractor = new BlockExtractor();
