/**
 * Graph Prompt Processor Service
 * Handles parsing user prompts and mapping them to graph actions
 *
 * Supports:
 * - Link creation: "Link the solution block to the problem block"
 * - Highlighting: "What blocks mention market?"
 * - Filtering: "Show only the solution graph"
 * - Status updates: "Mark the market block as validated"
 */

import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Types
// ============================================================================

export type GraphType =
  | "problem"
  | "solution"
  | "market"
  | "risk"
  | "fit"
  | "business"
  | "spec";

export type BlockStatus =
  | "draft"
  | "active"
  | "validated"
  | "superseded"
  | "abandoned";

export type LinkType =
  | "addresses"
  | "creates"
  | "requires"
  | "blocks"
  | "unblocks"
  | "supersedes"
  | "refines"
  | "replaces"
  | "contradicts"
  | "evidence_for"
  | "derived_from"
  | "implements"
  | "implemented_by"
  | "alternative_to"
  | "synthesizes"
  | "instance_of"
  | "about"
  | "excludes"
  | "includes"
  | "constrained_by"
  | "validates_claim";

export type PromptIntent =
  | "link"
  | "highlight"
  | "filter"
  | "update_status"
  | "query"
  | "unknown";

export interface Block {
  id: string;
  type: string;
  content: string;
  properties: Record<string, unknown>;
  status: BlockStatus;
}

export interface Link {
  id: string;
  source: string;
  target: string;
  linkType: LinkType;
  confidence?: number;
  reason?: string;
}

export interface PromptParseResult {
  intent: PromptIntent;
  entities: {
    sourceBlock?: string;
    targetBlock?: string;
    blockType?: string;
    graphType?: GraphType;
    status?: BlockStatus;
    keyword?: string;
  };
  confidence: number;
}

export interface PromptActionResult {
  action:
    | "link_created"
    | "highlight"
    | "filter"
    | "block_updated"
    | "clarification_needed"
    | "error";
  message?: string;
  link?: {
    id: string;
    source: string;
    target: string;
    linkType: LinkType;
  };
  nodeIds?: string[];
  filters?: {
    graphType?: GraphType[];
    blockTypes?: string[];
    statuses?: BlockStatus[];
  };
  block?: {
    id: string;
    status?: BlockStatus;
    properties?: Record<string, unknown>;
  };
}

// ============================================================================
// Pattern Matchers
// ============================================================================

const LINK_PATTERNS = [
  /link\s+(?:the\s+)?(\w+)\s+(?:block\s+)?to\s+(?:the\s+)?(\w+)\s+(?:block)?/i,
  /connect\s+(?:the\s+)?(\w+)\s+(?:to|with)\s+(?:the\s+)?(\w+)/i,
  /create\s+(?:a\s+)?link\s+(?:between|from)\s+(?:the\s+)?(\w+)\s+(?:and|to)\s+(?:the\s+)?(\w+)/i,
];

const HIGHLIGHT_PATTERNS = [
  /(?:what|which|find|show|highlight)\s+(?:blocks?|nodes?)\s+(?:mention|contain|have|include|about)\s+(\w+)/i,
  /highlight\s+(?:all\s+)?(\w+)(?:\s+blocks?)?/i,
  /show\s+(?:me\s+)?(?:all\s+)?(\w+)(?:\s+blocks?)?/i,
  /find\s+(?:all\s+)?(?:blocks?\s+)?(?:with|about|mentioning)\s+(\w+)/i,
];

const FILTER_PATTERNS = [
  /(?:show|filter|display)\s+(?:only\s+)?(?:the\s+)?(\w+)\s+graph/i,
  /(?:filter|show)\s+(?:by|to)\s+(\w+)/i,
  /only\s+(?:show|display)\s+(\w+)\s+(?:blocks?|nodes?|graph)?/i,
  /show\s+only\s+(\w+)\s+blocks?/i, // "Show only risk blocks"
];

const STATUS_UPDATE_PATTERNS = [
  /mark\s+(?:the\s+)?(\w+)\s+(?:block\s+)?(?:as\s+)?(\w+)/i,
  /set\s+(?:the\s+)?(\w+)\s+(?:block\s+)?(?:status\s+)?to\s+(\w+)/i,
  /change\s+(?:the\s+)?(\w+)\s+(?:block\s+)?(?:status\s+)?to\s+(\w+)/i,
  /update\s+(?:the\s+)?(\w+)\s+(?:block\s+)?(?:to|as)\s+(\w+)/i,
];

const GRAPH_TYPES: GraphType[] = [
  "problem",
  "solution",
  "market",
  "risk",
  "fit",
  "business",
  "spec",
];

const BLOCK_TYPES = [
  "content",
  "link",
  "meta",
  "synthesis",
  "pattern",
  "decision",
  "option",
  "derived",
  "assumption",
  "cycle",
  "placeholder",
  "stakeholder_view",
  "topic",
  "external",
  "action",
];

const VALID_STATUSES: BlockStatus[] = [
  "draft",
  "active",
  "validated",
  "superseded",
  "abandoned",
];

/**
 * Normalize block type by handling plural forms
 */
function normalizeBlockType(type: string): string {
  const normalized = type.toLowerCase();
  // Handle common plural forms
  if (normalized.endsWith("s") && !BLOCK_TYPES.includes(normalized)) {
    const singular = normalized.slice(0, -1);
    if (BLOCK_TYPES.includes(singular)) {
      return singular;
    }
  }
  return normalized;
}

// ============================================================================
// Parse Functions
// ============================================================================

/**
 * Parse a user prompt to determine intent and extract entities
 */
export function parsePrompt(prompt: string): PromptParseResult {
  const normalizedPrompt = prompt.toLowerCase().trim();

  // Try link patterns
  for (const pattern of LINK_PATTERNS) {
    const match = normalizedPrompt.match(pattern);
    if (match) {
      return {
        intent: "link",
        entities: {
          sourceBlock: match[1],
          targetBlock: match[2],
        },
        confidence: 0.9,
      };
    }
  }

  // Try status update patterns
  for (const pattern of STATUS_UPDATE_PATTERNS) {
    const match = normalizedPrompt.match(pattern);
    if (match) {
      const status = match[2].toLowerCase() as BlockStatus;
      if (VALID_STATUSES.includes(status)) {
        return {
          intent: "update_status",
          entities: {
            sourceBlock: match[1],
            status: status,
          },
          confidence: 0.85,
        };
      }
    }
  }

  // Try filter patterns
  for (const pattern of FILTER_PATTERNS) {
    const match = normalizedPrompt.match(pattern);
    if (match) {
      const rawType = match[1].toLowerCase();
      const normalizedType = normalizeBlockType(rawType);

      // Check if it's a graph type
      if (GRAPH_TYPES.includes(rawType as GraphType)) {
        return {
          intent: "filter",
          entities: {
            graphType: rawType as GraphType,
          },
          confidence: 0.9,
        };
      }
      // Check if it's a block type filter (handling plural forms)
      if (BLOCK_TYPES.includes(normalizedType)) {
        return {
          intent: "filter",
          entities: {
            blockType: normalizedType,
          },
          confidence: 0.85,
        };
      }
    }
  }

  // Try highlight patterns
  for (const pattern of HIGHLIGHT_PATTERNS) {
    const match = normalizedPrompt.match(pattern);
    if (match) {
      const keyword = match[1].toLowerCase();
      // Check if it's a block type (handling plural forms)
      const normalizedType = normalizeBlockType(keyword);
      if (BLOCK_TYPES.includes(normalizedType)) {
        return {
          intent: "highlight",
          entities: {
            blockType: normalizedType,
          },
          confidence: 0.85,
        };
      }
      // Otherwise it's a keyword search
      return {
        intent: "highlight",
        entities: {
          keyword: keyword,
        },
        confidence: 0.8,
      };
    }
  }

  // Check for simple keyword mentions that might indicate a query
  const hasQuestionWord = /^(what|which|where|who|how|find|show)/i.test(
    normalizedPrompt,
  );
  if (hasQuestionWord) {
    // Try to extract a keyword from the query
    const wordMatch = normalizedPrompt.match(
      /(?:about|mention|with|contain)\s+(\w+)/i,
    );
    if (wordMatch) {
      return {
        intent: "query",
        entities: {
          keyword: wordMatch[1],
        },
        confidence: 0.7,
      };
    }
  }

  // Unable to determine intent
  return {
    intent: "unknown",
    entities: {},
    confidence: 0.3,
  };
}

/**
 * Find blocks matching a keyword in their content or properties
 */
export function findBlocksByKeyword(blocks: Block[], keyword: string): Block[] {
  const lowerKeyword = keyword.toLowerCase();
  return blocks.filter((block) => {
    // Check content
    if (block.content.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    // Check properties
    const propsStr = JSON.stringify(block.properties).toLowerCase();
    if (propsStr.includes(lowerKeyword)) {
      return true;
    }
    return false;
  });
}

/**
 * Find blocks by type
 */
export function findBlocksByType(blocks: Block[], type: string): Block[] {
  return blocks.filter((block) => block.type === type);
}

/**
 * Find blocks by graph type (checking properties)
 */
export function findBlocksByGraphType(
  blocks: Block[],
  graphType: GraphType,
): Block[] {
  return blocks.filter((block) => {
    const props = block.properties;
    // Check if the block has a property matching the graph type
    return props[graphType] !== undefined || props.graph_type === graphType;
  });
}

/**
 * Find a block by a partial name/identifier match
 */
export function findBlockByName(
  blocks: Block[],
  name: string,
): Block | undefined {
  const lowerName = name.toLowerCase();

  // Try exact id match first
  const exactMatch = blocks.find((b) => b.id.toLowerCase() === lowerName);
  if (exactMatch) return exactMatch;

  // Try id contains match
  const idMatch = blocks.find((b) =>
    b.id.toLowerCase().includes(`block_${lowerName}`),
  );
  if (idMatch) return idMatch;

  // Try content match (for blocks named by their content type)
  const contentMatch = blocks.find((b) => {
    // Check if the block type matches
    if (b.type === lowerName) return true;
    // Check if properties indicate this type
    if (b.properties[lowerName] !== undefined) return true;
    // Check if content starts with or contains the name
    return b.content.toLowerCase().includes(lowerName);
  });

  return contentMatch;
}

// ============================================================================
// Action Executors
// ============================================================================

/**
 * Process a user prompt and return the appropriate action result
 */
export async function processGraphPrompt(
  prompt: string,
  blocks: Block[],
  _existingLinks: Link[] = [], // Prefixed with _ since not used yet (will be used in Phase 8)
): Promise<PromptActionResult> {
  const parseResult = parsePrompt(prompt);

  switch (parseResult.intent) {
    case "link": {
      const { sourceBlock, targetBlock } = parseResult.entities;
      if (!sourceBlock || !targetBlock) {
        return {
          action: "clarification_needed",
          message: "Could you be more specific about which blocks to link?",
        };
      }

      const source = findBlockByName(blocks, sourceBlock);
      const target = findBlockByName(blocks, targetBlock);

      if (!source) {
        return {
          action: "clarification_needed",
          message: `Could not find a block matching "${sourceBlock}". Could you be more specific?`,
        };
      }
      if (!target) {
        return {
          action: "clarification_needed",
          message: `Could not find a block matching "${targetBlock}". Could you be more specific?`,
        };
      }

      const linkId = `link_${uuidv4().slice(0, 8)}`;
      return {
        action: "link_created",
        link: {
          id: linkId,
          source: source.id,
          target: target.id,
          linkType: "addresses", // Default link type
        },
        message: `Created link from ${source.id} to ${target.id}`,
      };
    }

    case "highlight": {
      const { blockType, keyword } = parseResult.entities;
      let matchingBlocks: Block[] = [];

      if (blockType) {
        matchingBlocks = findBlocksByType(blocks, blockType);
      } else if (keyword) {
        matchingBlocks = findBlocksByKeyword(blocks, keyword);
      }

      if (matchingBlocks.length === 0) {
        return {
          action: "clarification_needed",
          message: `No blocks found matching "${blockType || keyword}". Could you be more specific?`,
        };
      }

      return {
        action: "highlight",
        nodeIds: matchingBlocks.map((b) => b.id),
        message: `Highlighted ${matchingBlocks.length} block(s)`,
      };
    }

    case "filter": {
      const { graphType, blockType } = parseResult.entities;

      if (graphType) {
        return {
          action: "filter",
          filters: {
            graphType: [graphType],
          },
          message: `Filtered to ${graphType} graph`,
        };
      }

      if (blockType) {
        return {
          action: "filter",
          filters: {
            blockTypes: [blockType],
          },
          message: `Filtered to ${blockType} blocks`,
        };
      }

      return {
        action: "clarification_needed",
        message: "Could you specify which graph or block type to filter by?",
      };
    }

    case "update_status": {
      const { sourceBlock, status } = parseResult.entities;
      if (!sourceBlock || !status) {
        return {
          action: "clarification_needed",
          message: "Could you specify which block and what status to set?",
        };
      }

      const block = findBlockByName(blocks, sourceBlock);
      if (!block) {
        return {
          action: "clarification_needed",
          message: `Could not find a block matching "${sourceBlock}". Could you be more specific?`,
        };
      }

      return {
        action: "block_updated",
        block: {
          id: block.id,
          status: status,
        },
        message: `Updated ${block.id} status to ${status}`,
      };
    }

    case "query": {
      const { keyword } = parseResult.entities;
      if (!keyword) {
        return {
          action: "clarification_needed",
          message: "Could you be more specific about what you're looking for?",
        };
      }

      const matchingBlocks = findBlocksByKeyword(blocks, keyword);
      if (matchingBlocks.length === 0) {
        return {
          action: "clarification_needed",
          message: `No blocks found mentioning "${keyword}".`,
        };
      }

      return {
        action: "highlight",
        nodeIds: matchingBlocks.map((b) => b.id),
        message: `Found ${matchingBlocks.length} block(s) mentioning "${keyword}"`,
      };
    }

    case "unknown":
    default:
      return {
        action: "clarification_needed",
        message:
          "Could you be more specific? Try commands like 'Link X to Y', 'Show market graph', 'Highlight assumptions', or 'Mark block as validated'.",
      };
  }
}

export default {
  parsePrompt,
  processGraphPrompt,
  findBlocksByKeyword,
  findBlocksByType,
  findBlocksByGraphType,
  findBlockByName,
};
