/**
 * SPEC VALIDATOR SERVICE
 *
 * Validates memory graph completeness before generating app specs.
 * Checks for required blocks, links, and identifies missing pieces.
 */

import { blockExtractor, MemoryBlock, MemoryLink } from "./block-extractor.js";
import { GraphType, graphTypes } from "../../schema/index.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CheckResult {
  passed: boolean;
  message: string;
  affectedBlocks?: string[];
}

export interface MissingPiece {
  type: "required" | "recommended";
  category: "problem" | "solution" | "market" | "assumption" | "evidence";
  description: string;
  suggestion: string;
}

export interface SuggestedQuestion {
  question: string;
  targetGraphType: GraphType;
  targetBlockType: string;
  prefillContent?: string;
}

export interface GraphValidationResult {
  canGenerate: boolean;
  overallScore: number; // 0-100

  checks: {
    // Required checks (must pass)
    hasProblemBlocks: CheckResult;
    hasSolutionBlocks: CheckResult;
    problemSolutionLinked: CheckResult;
    noBlockingCycles: CheckResult;

    // Recommended checks (warnings only)
    hasMarketBlocks: CheckResult;
    hasValidatedAssumptions: CheckResult;
    criticalAssumptionsAddressed: CheckResult;
    hasEvidenceChains: CheckResult;
  };

  missingPieces: MissingPiece[];
  suggestedQuestions: SuggestedQuestion[];
}

export interface SpecSection {
  title: string;
  content: string;
  supportingBlocks: string[];
  confidence: number;
}

// ============================================================================
// SPEC VALIDATOR CLASS
// ============================================================================

export class SpecValidator {
  /**
   * Check graph completeness for spec generation.
   */
  async checkGraphCompleteness(
    sessionId: string,
  ): Promise<GraphValidationResult> {
    // Get all blocks and links
    const blocks = await blockExtractor.getBlocksForSession(sessionId);
    const links = await blockExtractor.getLinksForSession(sessionId);
    const memberships = await blockExtractor.getGraphMemberships(
      blocks.map((b) => b.id),
    );

    // Run all checks
    const checks = {
      hasProblemBlocks: this.checkHasProblemBlocks(blocks, memberships),
      hasSolutionBlocks: this.checkHasSolutionBlocks(blocks, memberships),
      problemSolutionLinked: this.checkProblemSolutionLinked(
        blocks,
        links,
        memberships,
      ),
      noBlockingCycles: this.checkNoBlockingCycles(blocks, links),
      hasMarketBlocks: this.checkHasMarketBlocks(blocks, memberships),
      hasValidatedAssumptions: this.checkValidatedAssumptions(blocks),
      criticalAssumptionsAddressed: this.checkCriticalAssumptions(blocks),
      hasEvidenceChains: this.checkEvidenceChains(blocks, links),
    };

    // Calculate overall score
    const overallScore = this.calculateOverallScore(checks);

    // Determine if we can generate (all required checks must pass)
    const canGenerate =
      checks.hasProblemBlocks.passed &&
      checks.hasSolutionBlocks.passed &&
      checks.problemSolutionLinked.passed &&
      checks.noBlockingCycles.passed;

    // Generate missing pieces and suggested questions
    const missingPieces = this.generateMissingPieces(checks);
    const suggestedQuestions = this.generateSuggestedQuestions(checks, blocks);

    return {
      canGenerate,
      overallScore,
      checks,
      missingPieces,
      suggestedQuestions,
    };
  }

  // ============================================================================
  // CHECK METHODS
  // ============================================================================

  private checkHasProblemBlocks(
    blocks: MemoryBlock[],
    memberships: Map<string, GraphType[]>,
  ): CheckResult {
    const problemBlocks = blocks.filter((b) => {
      const graphs = memberships.get(b.id) || [];
      return graphs.includes("problem");
    });

    if (problemBlocks.length === 0) {
      return {
        passed: false,
        message: "No problem blocks found in graph",
        affectedBlocks: [],
      };
    }

    return {
      passed: true,
      message: `Found ${problemBlocks.length} problem blocks`,
      affectedBlocks: problemBlocks.map((b) => b.id),
    };
  }

  private checkHasSolutionBlocks(
    blocks: MemoryBlock[],
    memberships: Map<string, GraphType[]>,
  ): CheckResult {
    const solutionBlocks = blocks.filter((b) => {
      const graphs = memberships.get(b.id) || [];
      return graphs.includes("solution");
    });

    if (solutionBlocks.length === 0) {
      return {
        passed: false,
        message: "No solution blocks found in graph",
        affectedBlocks: [],
      };
    }

    return {
      passed: true,
      message: `Found ${solutionBlocks.length} solution blocks`,
      affectedBlocks: solutionBlocks.map((b) => b.id),
    };
  }

  private checkProblemSolutionLinked(
    blocks: MemoryBlock[],
    links: MemoryLink[],
    memberships: Map<string, GraphType[]>,
  ): CheckResult {
    const problemBlockIds = new Set(
      blocks
        .filter((b) => {
          const graphs = memberships.get(b.id) || [];
          return graphs.includes("problem");
        })
        .map((b) => b.id),
    );

    const solutionBlockIds = new Set(
      blocks
        .filter((b) => {
          const graphs = memberships.get(b.id) || [];
          return graphs.includes("solution");
        })
        .map((b) => b.id),
    );

    // Check if any link connects problem to solution
    const hasAddressesLink = links.some(
      (link) =>
        (link.linkType === "addresses" &&
          solutionBlockIds.has(link.sourceBlockId) &&
          problemBlockIds.has(link.targetBlockId)) ||
        (link.linkType === "addresses" &&
          problemBlockIds.has(link.sourceBlockId) &&
          solutionBlockIds.has(link.targetBlockId)),
    );

    if (
      !hasAddressesLink &&
      problemBlockIds.size > 0 &&
      solutionBlockIds.size > 0
    ) {
      return {
        passed: false,
        message: "Problem and solution blocks are not linked",
        affectedBlocks: [...problemBlockIds, ...solutionBlockIds],
      };
    }

    if (problemBlockIds.size === 0 || solutionBlockIds.size === 0) {
      return {
        passed: false,
        message: "Missing problem or solution blocks to link",
        affectedBlocks: [],
      };
    }

    return {
      passed: true,
      message: "Problem-Solution fit established",
      affectedBlocks: [],
    };
  }

  private checkNoBlockingCycles(
    blocks: MemoryBlock[],
    links: MemoryLink[],
  ): CheckResult {
    // Find blocks that are part of blocking cycles
    const cycleBlocks = blocks.filter(
      (b) =>
        b.properties &&
        (b.properties as Record<string, unknown>).cycleType === "blocking",
    );

    if (cycleBlocks.length > 0) {
      return {
        passed: false,
        message: `Found ${cycleBlocks.length} blocks in blocking cycles`,
        affectedBlocks: cycleBlocks.map((b) => b.id),
      };
    }

    return {
      passed: true,
      message: "No blocking cycles detected",
      affectedBlocks: [],
    };
  }

  private checkHasMarketBlocks(
    blocks: MemoryBlock[],
    memberships: Map<string, GraphType[]>,
  ): CheckResult {
    const marketBlocks = blocks.filter((b) => {
      const graphs = memberships.get(b.id) || [];
      return graphs.includes("market");
    });

    if (marketBlocks.length === 0) {
      return {
        passed: false,
        message: "No market research blocks found",
        affectedBlocks: [],
      };
    }

    // Check for validated market data
    const validatedMarket = marketBlocks.filter(
      (b) => b.status === "validated" || (b.confidence && b.confidence > 0.7),
    );

    if (validatedMarket.length === 0) {
      return {
        passed: false,
        message: "Market blocks exist but none are validated",
        affectedBlocks: marketBlocks.map((b) => b.id),
      };
    }

    return {
      passed: true,
      message: `Found ${validatedMarket.length} validated market blocks`,
      affectedBlocks: validatedMarket.map((b) => b.id),
    };
  }

  private checkValidatedAssumptions(blocks: MemoryBlock[]): CheckResult {
    const assumptionBlocks = blocks.filter((b) => b.type === "assumption");

    if (assumptionBlocks.length === 0) {
      return {
        passed: true,
        message: "No explicit assumptions identified",
        affectedBlocks: [],
      };
    }

    const validatedCount = assumptionBlocks.filter(
      (b) => b.status === "validated",
    ).length;

    if (validatedCount === 0) {
      return {
        passed: false,
        message: `${assumptionBlocks.length} assumptions, none validated`,
        affectedBlocks: assumptionBlocks.map((b) => b.id),
      };
    }

    const ratio = validatedCount / assumptionBlocks.length;
    return {
      passed: ratio >= 0.5,
      message: `${validatedCount}/${assumptionBlocks.length} assumptions validated`,
      affectedBlocks: assumptionBlocks
        .filter((b) => b.status !== "validated")
        .map((b) => b.id),
    };
  }

  private checkCriticalAssumptions(blocks: MemoryBlock[]): CheckResult {
    const criticalAssumptions = blocks.filter((b) => {
      if (b.type !== "assumption") return false;
      const props = b.properties as Record<string, unknown> | null;
      return props?.criticality === "critical";
    });

    if (criticalAssumptions.length === 0) {
      return {
        passed: true,
        message: "No critical assumptions identified",
        affectedBlocks: [],
      };
    }

    const unaddressed = criticalAssumptions.filter(
      (b) => b.status !== "validated" && b.status !== "abandoned",
    );

    if (unaddressed.length > 0) {
      return {
        passed: false,
        message: `${unaddressed.length} critical assumptions not addressed`,
        affectedBlocks: unaddressed.map((b) => b.id),
      };
    }

    return {
      passed: true,
      message: "All critical assumptions addressed",
      affectedBlocks: [],
    };
  }

  private checkEvidenceChains(
    blocks: MemoryBlock[],
    links: MemoryLink[],
  ): CheckResult {
    // Check for evidence_for links
    const evidenceLinks = links.filter((l) => l.linkType === "evidence_for");

    if (evidenceLinks.length === 0) {
      return {
        passed: false,
        message: "No evidence chains established",
        affectedBlocks: [],
      };
    }

    // Find claims without evidence
    const claimsWithEvidence = new Set(
      evidenceLinks.map((l) => l.targetBlockId),
    );
    const contentBlocks = blocks.filter((b) => b.type === "knowledge");
    const claimsWithoutEvidence = contentBlocks.filter(
      (b) => !claimsWithEvidence.has(b.id),
    );

    if (claimsWithoutEvidence.length > contentBlocks.length * 0.5) {
      return {
        passed: false,
        message: `${claimsWithoutEvidence.length} claims lack supporting evidence`,
        affectedBlocks: claimsWithoutEvidence.map((b) => b.id),
      };
    }

    return {
      passed: true,
      message: `${evidenceLinks.length} evidence chains established`,
      affectedBlocks: [],
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private calculateOverallScore(
    checks: GraphValidationResult["checks"],
  ): number {
    const weights = {
      hasProblemBlocks: 15,
      hasSolutionBlocks: 15,
      problemSolutionLinked: 20,
      noBlockingCycles: 10,
      hasMarketBlocks: 15,
      hasValidatedAssumptions: 10,
      criticalAssumptionsAddressed: 10,
      hasEvidenceChains: 5,
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (checks[key as keyof typeof checks].passed) {
        score += weight;
      }
    }

    return score;
  }

  private generateMissingPieces(
    checks: GraphValidationResult["checks"],
  ): MissingPiece[] {
    const pieces: MissingPiece[] = [];

    if (!checks.hasProblemBlocks.passed) {
      pieces.push({
        type: "required",
        category: "problem",
        description: "No problem statement defined",
        suggestion:
          "Describe the specific problem your idea solves and who experiences it",
      });
    }

    if (!checks.hasSolutionBlocks.passed) {
      pieces.push({
        type: "required",
        category: "solution",
        description: "No solution defined",
        suggestion: "Describe how your idea solves the identified problem",
      });
    }

    if (
      !checks.problemSolutionLinked.passed &&
      checks.hasProblemBlocks.passed &&
      checks.hasSolutionBlocks.passed
    ) {
      pieces.push({
        type: "required",
        category: "problem",
        description: "Problem-Solution fit not established",
        suggestion: "Explain how your solution directly addresses the problem",
      });
    }

    if (!checks.hasMarketBlocks.passed) {
      pieces.push({
        type: "recommended",
        category: "market",
        description: "No validated market data",
        suggestion: "Add market size, target audience, or competitive analysis",
      });
    }

    if (!checks.hasValidatedAssumptions.passed) {
      pieces.push({
        type: "recommended",
        category: "assumption",
        description: "Unvalidated assumptions",
        suggestion: "Review and validate key assumptions about your idea",
      });
    }

    if (!checks.hasEvidenceChains.passed) {
      pieces.push({
        type: "recommended",
        category: "evidence",
        description: "Claims lack supporting evidence",
        suggestion: "Add research or data to support key claims",
      });
    }

    return pieces;
  }

  private generateSuggestedQuestions(
    checks: GraphValidationResult["checks"],
    blocks: MemoryBlock[],
  ): SuggestedQuestion[] {
    const questions: SuggestedQuestion[] = [];

    if (!checks.hasProblemBlocks.passed) {
      questions.push({
        question: "What specific problem does your idea solve?",
        targetGraphType: "problem",
        targetBlockType: "knowledge",
      });
      questions.push({
        question: "Who experiences this problem and how often?",
        targetGraphType: "problem",
        targetBlockType: "knowledge",
      });
    }

    if (!checks.hasSolutionBlocks.passed) {
      questions.push({
        question: "How does your idea solve this problem?",
        targetGraphType: "solution",
        targetBlockType: "knowledge",
      });
    }

    if (!checks.hasMarketBlocks.passed) {
      questions.push({
        question: "What is the size of your target market?",
        targetGraphType: "market",
        targetBlockType: "knowledge",
      });
      questions.push({
        question: "Who are your main competitors?",
        targetGraphType: "market",
        targetBlockType: "knowledge",
      });
    }

    if (!checks.hasValidatedAssumptions.passed) {
      const unvalidated = blocks.filter(
        (b) => b.type === "assumption" && b.status !== "validated",
      );
      for (const assumption of unvalidated.slice(0, 3)) {
        questions.push({
          question: `How have you validated: "${assumption.content.substring(0, 50)}..."?`,
          targetGraphType: "fit",
          targetBlockType: "knowledge",
          prefillContent: `Validation for: ${assumption.content}`,
        });
      }
    }

    return questions;
  }
}

// Singleton export
export const specValidator = new SpecValidator();
