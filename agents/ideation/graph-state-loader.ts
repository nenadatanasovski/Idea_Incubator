/**
 * GraphStateLoader
 *
 * Reconstructs ideation state from memory graph queries.
 * Replaces the MemoryManager.loadState() function.
 */

import { graphQueryService } from "../../server/services/graph/graph-query-service.js";
import { reportGenerator } from "../../server/services/graph/report-generator.js";
import { query as dbQuery } from "../../database/db.js";
import type { GraphQueryResult } from "../../types/graph-query.js";
import type {
  IdeaTypeSelectionState,
  IdeaTypeSelection,
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
} from "../../types/ideation.js";
import { createDefaultIdeaTypeSelectionState } from "../../utils/ideation-defaults.js";

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

    // Map capital value to correct enum
    const capitalValue = capitalConstraint?.properties?.value as string;
    let capital: "bootstrap" | "seeking_funding" | "have_funding" | null = null;
    if (capitalValue === "bootstrap") capital = "bootstrap";
    else if (capitalValue === "seeking" || capitalValue === "seeking_funding")
      capital = "seeking_funding";
    else if (capitalValue === "have_funding") capital = "have_funding";

    // Map vision level to correct enum
    const levelValue = visionBlock?.properties?.level as string;
    let level: "world" | "country" | "city" | "community" | null = null;
    if (
      levelValue === "world" ||
      levelValue === "country" ||
      levelValue === "city" ||
      levelValue === "community"
    ) {
      level = levelValue;
    }

    return {
      impactVision: {
        level,
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
          skill: e.area,
          level: e.depth,
          testedVia: e.evidence,
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
        capital,
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
      gaps: marketBlocks
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
      locationContext: {
        city: null,
        jobMarketTrends: null,
        localOpportunities: [],
        marketPresence: null,
      },
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
      productType: findDimension("product"),
      customerType: findDimension("customer"),
      geography: findDimension("geography"),
      scale: findDimension("scale"),
      technicalDepth: findDimension("technical"),
      hypotheses: validations
        .filter((b) => b.blockTypes.includes("assumption"))
        .map((b) => ({
          description: b.content,
          supporting: (b.properties?.supporting as string[]) || [],
          contradicting: (b.properties?.contradicting as string[]) || [],
        })),
      questionsNeeded: validations
        .filter((b) => b.blockTypes.includes("question"))
        .map((b) => ({
          question: b.content,
          purpose: (b.properties?.purpose as string) || "",
        })),
    };
  }

  /**
   * Get formatted context files for agent system prompt (replaces memoryManager.getAll)
   */
  async getContextFiles(
    ideaId: string,
  ): Promise<Array<{ fileType: string; content: string }>> {
    console.log(
      `[GraphStateLoader] 🧠 Loading memory graph context for idea: ${ideaId}`,
    );
    const state = await this.loadState(ideaId);

    // Log what was found in the memory graph
    const expertiseCount = state.selfDiscovery?.expertise?.length || 0;
    const frustrationCount = state.selfDiscovery?.frustrations?.length || 0;
    const competitorCount = state.marketDiscovery?.competitors?.length || 0;
    const gapCount = state.marketDiscovery?.gaps?.length || 0;
    const hypothesesCount = state.narrowingState?.hypotheses?.length || 0;

    console.log(`[GraphStateLoader] 📊 Memory graph context loaded:`);
    console.log(`  - Expertise areas: ${expertiseCount}`);
    console.log(`  - Frustrations: ${frustrationCount}`);
    console.log(`  - Competitors: ${competitorCount}`);
    console.log(`  - Market gaps: ${gapCount}`);
    console.log(`  - Hypotheses: ${hypothesesCount}`);

    const files: Array<{ fileType: string; content: string }> = [];

    // Self-discovery context
    files.push({
      fileType: "self_discovery",
      content: this.formatSelfDiscovery(state.selfDiscovery),
    });

    // Market discovery context
    files.push({
      fileType: "market_discovery",
      content: this.formatMarketDiscovery(state.marketDiscovery),
    });

    // Narrowing state context
    files.push({
      fileType: "narrowing_state",
      content: this.formatNarrowingState(state.narrowingState),
    });

    return files;
  }

  private formatSelfDiscovery(state: SelfDiscoveryState): string {
    const sections: string[] = ["# Self-Discovery\n"];

    if (state.impactVision?.level) {
      sections.push(`## Impact Vision`);
      sections.push(`- Level: ${state.impactVision.level}`);
      if (state.impactVision.description) {
        sections.push(`- Description: ${state.impactVision.description}`);
      }
      sections.push(
        `- Confidence: ${Math.round(state.impactVision.confidence * 100)}%\n`,
      );
    }

    if (state.frustrations.length > 0) {
      sections.push(`## Frustrations`);
      state.frustrations.forEach((f, i) => {
        sections.push(
          `${i + 1}. **${f.severity.toUpperCase()}**: ${f.description}`,
        );
      });
      sections.push("");
    }

    if (state.expertise.length > 0) {
      sections.push(`## Expertise Areas`);
      state.expertise.forEach((e) => {
        sections.push(`- **${e.area}** (${e.depth}): ${e.evidence}`);
      });
      sections.push("");
    }

    return sections.join("\n");
  }

  private formatMarketDiscovery(state: MarketDiscoveryState): string {
    const sections: string[] = ["# Market Discovery\n"];

    if (state.competitors.length > 0) {
      sections.push(`## Competitors`);
      state.competitors.forEach((c) => {
        sections.push(`### ${c.name}`);
        sections.push(c.description);
        if (c.strengths.length)
          sections.push(`Strengths: ${c.strengths.join(", ")}`);
        if (c.weaknesses.length)
          sections.push(`Weaknesses: ${c.weaknesses.join(", ")}`);
      });
      sections.push("");
    }

    if (state.gaps.length > 0) {
      sections.push(`## Market Gaps`);
      state.gaps.forEach((g) => {
        sections.push(`- **${g.relevance}**: ${g.description}`);
      });
      sections.push("");
    }

    return sections.join("\n");
  }

  private formatNarrowingState(state: NarrowingState): string {
    const sections: string[] = ["# Narrowing State\n"];

    sections.push(`## Dimensions`);
    if (state.productType.value)
      sections.push(`- Product Type: ${state.productType.value}`);
    if (state.customerType.value)
      sections.push(`- Customer Type: ${state.customerType.value}`);
    if (state.geography.value)
      sections.push(`- Geography: ${state.geography.value}`);
    if (state.scale.value) sections.push(`- Scale: ${state.scale.value}`);
    if (state.technicalDepth.value)
      sections.push(`- Technical Depth: ${state.technicalDepth.value}`);
    sections.push("");

    if (state.hypotheses.length > 0) {
      sections.push(`## Working Hypotheses`);
      state.hypotheses.forEach((h) => {
        sections.push(`- ${h.description}`);
      });
      sections.push("");
    }

    if (state.questionsNeeded.length > 0) {
      sections.push(`## Questions to Ask`);
      state.questionsNeeded.forEach((q) => {
        sections.push(`- ${q.question}`);
      });
      sections.push("");
    }

    return sections.join("\n");
  }

  /**
   * Load idea type selection state from graph (queries decision blocks)
   */
  async loadIdeaTypeSelection(ideaId: string): Promise<IdeaTypeSelectionState> {
    // Query for idea type decision blocks
    const result = await graphQueryService.query({
      ideaId,
      blockTypes: ["decision"],
      statuses: ["active"],
    });

    // Find idea type decision block
    const ideaTypeBlock = result.blocks.find(
      (b) => b.properties?.decision_type === "idea_type",
    );

    if (!ideaTypeBlock) {
      return createDefaultIdeaTypeSelectionState();
    }

    return {
      ideaTypeSelected: true,
      ideaType:
        (ideaTypeBlock.properties?.idea_type as IdeaTypeSelection) || null,
      parentSelectionNeeded:
        !!ideaTypeBlock.properties?.parent_selection_needed,
      parentSelected: !!ideaTypeBlock.properties?.parent_selected,
      parentType:
        (ideaTypeBlock.properties?.parent_type as "internal" | "external") ||
        null,
      parentSlug: (ideaTypeBlock.properties?.parent_slug as string) || null,
      parentName: (ideaTypeBlock.properties?.parent_name as string) || null,
    };
  }

  /**
   * Update idea type selection state (no-op in graph-based system - use block creation)
   * TODO: Task 3.7 - This should create/update decision blocks instead
   */
  async updateIdeaTypeSelection(
    _ideaId: string,
    _state: IdeaTypeSelectionState,
  ): Promise<void> {
    // In graph-based architecture, this would create/update a decision block
    // For now, this is a no-op as the orchestrator extraction handles this
    // The state will be reconstructed from graph queries on next load
  }

  /**
   * Get agent context from memory graph
   *
   * Returns structured context with:
   * 1. Top-level: Report summaries (overview, themes, open questions)
   * 2. Navigation instructions: How to query deeper by block type and graph dimension
   * 3. Key blocks: Critical decisions and requirements
   *
   * This mimics the Claude Code skills folder methodology where the agent
   * reads top-level summaries and knows how to drill down when needed.
   */
  async getAgentContext(sessionId: string): Promise<{
    topLevel: string;
    instructions: string;
    keyBlocks: string;
    stats: {
      reportCount: number;
      blockCount: number;
      blocksByType: Record<string, number>;
    };
  }> {
    console.log(
      `[GraphStateLoader] 🧠 Loading agent context for session: ${sessionId}`,
    );

    // 1. Get reports for top-level summaries
    const reports = await reportGenerator.getReportsForSession(sessionId);
    console.log(`[GraphStateLoader] 📊 Found ${reports.length} reports`);

    // 2. Get block counts by type for stats
    const blockStats = await dbQuery<{ type: string; count: number }>(
      `SELECT type, COUNT(*) as count FROM memory_blocks
       WHERE session_id = ? AND status = 'active'
       GROUP BY type`,
      [sessionId],
    );
    const blocksByType: Record<string, number> = {};
    let totalBlocks = 0;
    for (const stat of blockStats) {
      blocksByType[stat.type] = stat.count;
      totalBlocks += stat.count;
    }

    // 3. Get key blocks: decisions and requirements (most important for context)
    const keyBlocks = await dbQuery<{
      id: string;
      type: string;
      title: string | null;
      content: string;
      confidence: number | null;
    }>(
      `SELECT id, type, title, content, confidence FROM memory_blocks
       WHERE session_id = ?
       AND status = 'active'
       AND type IN ('decision', 'requirement', 'assumption')
       ORDER BY confidence DESC, created_at DESC
       LIMIT 20`,
      [sessionId],
    );

    // 4. Get graph dimension stats
    const dimensionStats = await dbQuery<{ graph_type: string; count: number }>(
      `SELECT graph_type, COUNT(DISTINCT block_id) as count
       FROM memory_graph_memberships mgm
       JOIN memory_blocks mb ON mgm.block_id = mb.id
       WHERE mb.session_id = ? AND mb.status = 'active'
       GROUP BY graph_type`,
      [sessionId],
    );

    // Format top-level context (report summaries)
    const topLevelSections: string[] = [
      "# MEMORY GRAPH CONTEXT",
      "",
      "## Overview",
      `This session has ${totalBlocks} knowledge blocks organized into ${reports.length} thematic groups.`,
      "",
    ];

    if (reports.length > 0) {
      topLevelSections.push("## Thematic Groups (Top-Level Summaries)");
      topLevelSections.push("");
      for (const report of reports.slice(0, 10)) {
        // Limit to top 10 reports
        topLevelSections.push(`### ${report.groupName}`);
        if (report.overview) {
          topLevelSections.push(report.overview);
        }
        if (report.keyThemes && report.keyThemes.length > 0) {
          topLevelSections.push(
            `**Key Themes:** ${report.keyThemes.slice(0, 5).join(", ")}`,
          );
        }
        if (report.openQuestions && report.openQuestions.length > 0) {
          topLevelSections.push(
            `**Open Questions:** ${report.openQuestions.slice(0, 3).join("; ")}`,
          );
        }
        topLevelSections.push("");
      }
    }

    // Format navigation instructions
    const instructionsSections: string[] = [
      "## How to Access Deeper Information",
      "",
      "When you need more specific information, you can mentally query the memory graph by:",
      "",
      "### By Block Type:",
    ];

    // Add block type inventory
    const blockTypeDescriptions: Record<string, string> = {
      decision: "Strategic choices and commitments made",
      requirement: "Must-have constraints and specifications",
      insight: "Key findings and non-obvious observations",
      fact: "Verified data points and evidence",
      assumption: "Hypotheses that need validation",
      pattern: "Recurring themes identified",
      question: "Open questions to investigate",
      action: "Next steps and tasks",
    };

    for (const [type, count] of Object.entries(blocksByType)) {
      const desc = blockTypeDescriptions[type] || type;
      instructionsSections.push(`- **${type}** (${count} blocks): ${desc}`);
    }

    instructionsSections.push("");
    instructionsSections.push("### By Graph Dimension:");

    // Add dimension inventory
    const dimensionDescriptions: Record<string, string> = {
      problem: "Problem space and pain points",
      solution: "Solution approaches and features",
      market: "Market size, trends, and opportunities",
      competition: "Competitive landscape",
      user: "User profiles and personas",
      validation: "Evidence and validation data",
      risk: "Identified risks and concerns",
      business: "Business model and revenue",
      spec: "Technical specifications",
    };

    for (const stat of dimensionStats) {
      const desc = dimensionDescriptions[stat.graph_type] || stat.graph_type;
      instructionsSections.push(
        `- **${stat.graph_type}** (${stat.count} blocks): ${desc}`,
      );
    }

    // Format key blocks
    const keyBlocksSections: string[] = [
      "## Key Decisions & Requirements",
      "",
      "These are the most important blocks to be aware of:",
      "",
    ];

    for (const block of keyBlocks) {
      const title = block.title || block.content.substring(0, 50) + "...";
      const confidence = block.confidence
        ? ` (${Math.round(block.confidence * 100)}% confidence)`
        : "";
      keyBlocksSections.push(
        `### [${block.type.toUpperCase()}] ${title}${confidence}`,
      );
      keyBlocksSections.push(
        block.content.substring(0, 300) +
          (block.content.length > 300 ? "..." : ""),
      );
      keyBlocksSections.push("");
    }

    console.log(`[GraphStateLoader] ✅ Agent context loaded:`);
    console.log(`  - Reports: ${reports.length}`);
    console.log(`  - Total blocks: ${totalBlocks}`);
    console.log(`  - Key blocks: ${keyBlocks.length}`);
    console.log(`  - Block types: ${Object.keys(blocksByType).join(", ")}`);

    return {
      topLevel: topLevelSections.join("\n"),
      instructions: instructionsSections.join("\n"),
      keyBlocks: keyBlocksSections.join("\n"),
      stats: {
        reportCount: reports.length,
        blockCount: totalBlocks,
        blocksByType,
      },
    };
  }
}

export const graphStateLoader = new GraphStateLoader();
