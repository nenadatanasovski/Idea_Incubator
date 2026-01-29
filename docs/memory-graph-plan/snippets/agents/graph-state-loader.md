# Graph State Loader

Create `agents/ideation/graph-state-loader.ts`:

```typescript
/**
 * GraphStateLoader
 *
 * Reconstructs ideation state from memory graph queries.
 * Replaces the MemoryManager.loadState() function.
 */

import { graphQueryService } from "../../server/services/graph/graph-query-service";
import type { GraphQueryResult, BlockResult } from "../../types/graph-query";

// State interfaces (keep compatible with existing code)
export interface SelfDiscoveryState {
  impactVision: {
    level: string | null;
    description: string | null;
    confidence: number;
  };
  frustrations: Array<{
    description: string;
    source: string;
    severity: "high" | "medium" | "low";
  }>;
  expertise: Array<{
    area: string;
    depth: "expert" | "competent" | "novice";
    evidence: string;
  }>;
  interests: Array<{
    topic: string;
    genuine: boolean;
    evidence: string;
  }>;
  skills: {
    identified: Array<{ name: string; level: string; evidence: string }>;
    gaps: string[];
    strengths: string[];
  };
  constraints: {
    location: { fixed: boolean; target: string | null };
    timeHoursPerWeek: number | null;
    capital: "bootstrap" | "seeking" | "have_funding" | null;
    riskTolerance: "low" | "medium" | "high" | null;
  };
}

export interface MarketDiscoveryState {
  competitors: Array<{
    name: string;
    description: string;
    strengths: string[];
    weaknesses: string[];
    source: string;
  }>;
  marketGaps: Array<{
    description: string;
    evidence: string;
    relevance: "high" | "medium" | "low";
  }>;
  timingSignals: Array<{
    signal: string;
    source: string;
    implication: string;
  }>;
  failedAttempts: Array<{
    what: string;
    why: string;
    lesson: string;
    source: string;
  }>;
}

export interface NarrowingState {
  dimensions: {
    productType: { value: string | null; confidence: number };
    customerType: { value: string | null; confidence: number };
    geography: { value: string | null; confidence: number };
    scale: { value: string | null; confidence: number };
    technicalDepth: { value: string | null; confidence: number };
  };
  workingHypotheses: Array<{
    description: string;
    supporting: string[];
    contradicting: string[];
  }>;
  questionsToAsk: Array<{
    question: string;
    purpose: string;
  }>;
}

export interface LoadedState {
  selfDiscovery: SelfDiscoveryState;
  marketDiscovery: MarketDiscoveryState;
  narrowingState: NarrowingState;
}

export class GraphStateLoader {
  /**
   * Load full state from memory graph for an idea
   */
  async loadState(ideaId: string): Promise<LoadedState> {
    // Fetch all relevant blocks in parallel
    const [
      userBlocks,
      marketBlocks,
      competitionBlocks,
      validationBlocks,
      decisionBlocks,
    ] = await Promise.all([
      graphQueryService.getUserProfile(ideaId),
      graphQueryService.getMarketContext(ideaId),
      graphQueryService.query({
        ideaId,
        graphMemberships: ["competition"],
        statuses: ["active", "validated"],
      }),
      graphQueryService.query({
        ideaId,
        graphMemberships: ["validation"],
        statuses: ["active"],
      }),
      graphQueryService.query({
        ideaId,
        blockTypes: ["decision"],
        statuses: ["active"],
      }),
    ]);

    return {
      selfDiscovery: this.extractSelfDiscovery(userBlocks),
      marketDiscovery: this.extractMarketDiscovery(
        marketBlocks,
        competitionBlocks,
      ),
      narrowingState: this.extractNarrowingState(
        decisionBlocks,
        validationBlocks,
      ),
    };
  }

  /**
   * Extract self-discovery state from user profile blocks
   */
  private extractSelfDiscovery(result: GraphQueryResult): SelfDiscoveryState {
    const blocks = result.blocks;

    // Find impact vision block
    const visionBlock = blocks.find(
      (b) =>
        (b.blockTypes.includes("insight") &&
          b.content.toLowerCase().includes("impact")) ||
        b.title?.toLowerCase().includes("vision"),
    );

    // Find frustration blocks
    const frustrations = blocks
      .filter(
        (b) =>
          b.properties?.type === "frustration" ||
          b.properties?.category === "pain_point",
      )
      .map((b) => ({
        description: b.content,
        source: (b.properties?.source as string) || "conversation",
        severity:
          (b.properties?.severity as "high" | "medium" | "low") || "medium",
      }));

    // Find expertise blocks
    const expertise = blocks
      .filter((b) => b.blockTypes.includes("fact") && b.properties?.skill_name)
      .map((b) => ({
        area: (b.properties?.skill_name as string) || b.title || "",
        depth:
          (b.properties?.proficiency as "expert" | "competent" | "novice") ||
          "competent",
        evidence: (b.properties?.evidence as string) || b.content,
      }));

    // Find constraint blocks
    const constraintBlocks = blocks.filter((b) =>
      b.blockTypes.includes("constraint"),
    );
    const timeConstraint = constraintBlocks.find(
      (b) => b.properties?.constraint_type === "time",
    );
    const locationConstraint = constraintBlocks.find(
      (b) => b.properties?.constraint_type === "location",
    );
    const capitalConstraint = constraintBlocks.find(
      (b) => b.properties?.constraint_type === "capital",
    );
    const riskConstraint = constraintBlocks.find(
      (b) => b.properties?.constraint_type === "risk",
    );

    return {
      impactVision: {
        level: (visionBlock?.properties?.level as string) || null,
        description: visionBlock?.content || null,
        confidence: visionBlock?.confidence || 0,
      },
      frustrations,
      expertise,
      interests: blocks
        .filter((b) => b.properties?.type === "interest")
        .map((b) => ({
          topic: b.title || b.content.substring(0, 50),
          genuine: b.confidence ? b.confidence > 0.7 : true,
          evidence: (b.properties?.evidence as string) || "",
        })),
      skills: {
        identified: expertise.map((e) => ({
          name: e.area,
          level: e.depth,
          evidence: e.evidence,
        })),
        gaps: blocks
          .filter((b) => b.properties?.type === "skill_gap")
          .map((b) => b.content),
        strengths: expertise
          .filter((e) => e.depth === "expert")
          .map((e) => e.area),
      },
      constraints: {
        location: {
          fixed: locationConstraint?.properties?.flexibility === "low",
          target: (locationConstraint?.properties?.value as string) || null,
        },
        timeHoursPerWeek: (timeConstraint?.properties?.value as number) || null,
        capital:
          (capitalConstraint?.properties?.value as
            | "bootstrap"
            | "seeking"
            | "have_funding") || null,
        riskTolerance:
          (riskConstraint?.properties?.value as "low" | "medium" | "high") ||
          null,
      },
    };
  }

  /**
   * Extract market discovery state from market blocks
   */
  private extractMarketDiscovery(
    marketResult: GraphQueryResult,
    competitionResult: GraphQueryResult,
  ): MarketDiscoveryState {
    const marketBlocks = marketResult.blocks;
    const competitionBlocks = competitionResult.blocks;

    return {
      competitors: competitionBlocks
        .filter((b) => b.properties?.entity_type === "competitor")
        .map((b) => ({
          name: b.title || (b.properties?.name as string) || "",
          description: b.content,
          strengths: (b.properties?.strengths as string[]) || [],
          weaknesses: (b.properties?.weaknesses as string[]) || [],
          source: (b.properties?.source as string) || "",
        })),
      marketGaps: marketBlocks
        .filter(
          (b) =>
            b.blockTypes.includes("insight") || b.blockTypes.includes("option"),
        )
        .map((b) => ({
          description: b.content,
          evidence: (b.properties?.evidence as string) || "",
          relevance:
            (b.properties?.relevance as "high" | "medium" | "low") || "medium",
        })),
      timingSignals: marketBlocks
        .filter((b) => b.properties?.type === "timing_signal")
        .map((b) => ({
          signal: b.content,
          source: (b.properties?.source as string) || "",
          implication: (b.properties?.implication as string) || "",
        })),
      failedAttempts: marketBlocks
        .filter(
          (b) =>
            b.blockTypes.includes("learning") ||
            b.properties?.type === "failed_attempt",
        )
        .map((b) => ({
          what: b.title || "",
          why: (b.properties?.reason as string) || "",
          lesson: b.content,
          source: (b.properties?.source as string) || "",
        })),
    };
  }

  /**
   * Extract narrowing state from decision blocks
   */
  private extractNarrowingState(
    decisionResult: GraphQueryResult,
    validationResult: GraphQueryResult,
  ): NarrowingState {
    const decisions = decisionResult.blocks;
    const validations = validationResult.blocks;

    // Find dimension decisions
    const findDimension = (name: string) => {
      const block = decisions.find(
        (b) =>
          b.properties?.dimension === name ||
          b.title?.toLowerCase().includes(name),
      );
      return {
        value: (block?.properties?.value as string) || block?.content || null,
        confidence: block?.confidence || 0,
      };
    };

    return {
      dimensions: {
        productType: findDimension("product"),
        customerType: findDimension("customer"),
        geography: findDimension("geography"),
        scale: findDimension("scale"),
        technicalDepth: findDimension("technical"),
      },
      workingHypotheses: validations
        .filter((b) => b.blockTypes.includes("assumption"))
        .map((b) => ({
          description: b.content,
          supporting: (b.properties?.supporting as string[]) || [],
          contradicting: (b.properties?.contradicting as string[]) || [],
        })),
      questionsToAsk: validations
        .filter((b) => b.blockTypes.includes("question"))
        .map((b) => ({
          question: b.content,
          purpose: (b.properties?.purpose as string) || "",
        })),
    };
  }
}

export const graphStateLoader = new GraphStateLoader();
```
