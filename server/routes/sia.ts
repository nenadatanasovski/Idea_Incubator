// server/routes/sia.ts - SIA API routes

import { Router, Request, Response } from "express";
import {
  queryKnowledge,
  getKnowledgeEntry,
  getProposals,
  getProposal,
  updateProposalStatus,
} from "../../agents/sia/db.js";
import {
  analyzeExecution,
  getRecentCompletedBuilds,
  analyzeMultipleExecutions,
} from "../../agents/sia/execution-analyzer.js";
import {
  writeGotchas,
  writePatterns,
} from "../../agents/sia/knowledge-writer.js";
import { applyProposal } from "../../agents/sia/claude-md-updater.js";
import { KnowledgeQuery, ProposalStatus } from "../../types/sia.js";

const router = Router();

/**
 * POST /api/sia/analyze
 * Analyze a build execution and extract learnings
 */
router.post("/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { executionId } = req.body;

    if (!executionId) {
      res.status(400).json({ error: "executionId is required" });
      return;
    }

    // Analyze the execution
    const analysis = await analyzeExecution(executionId);

    // Write extracted gotchas and patterns to knowledge base
    const newGotchas = await writeGotchas(
      analysis.extractedGotchas,
      executionId,
      "build",
    );
    const newPatterns = await writePatterns(
      analysis.extractedPatterns,
      executionId,
      "build",
    );

    res.json({
      analysis,
      newGotchas,
      newPatterns,
      updatedEntries: [], // TODO: track merged entries
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/sia/analyze-recent
 * Analyze recent completed builds
 */
router.post(
  "/analyze-recent",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = req.body.limit || 10;

      // Get recent completed builds
      const builds = await getRecentCompletedBuilds(limit);
      const executionIds = builds.map((b) => b.id);

      // Analyze all of them
      const { analyses, aggregatedGotchas, aggregatedPatterns } =
        await analyzeMultipleExecutions(executionIds);

      // Write to knowledge base
      const newGotchas = await writeGotchas(
        aggregatedGotchas,
        "batch-analysis",
        "build",
      );
      const newPatterns = await writePatterns(
        aggregatedPatterns,
        "batch-analysis",
        "build",
      );

      res.json({
        buildsAnalyzed: analyses.length,
        totalGotchas: aggregatedGotchas.length,
        totalPatterns: aggregatedPatterns.length,
        newGotchas,
        newPatterns,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

/**
 * GET /api/sia/knowledge
 * Query knowledge base with filters
 */
router.get("/knowledge", async (req: Request, res: Response): Promise<void> => {
  try {
    const query: KnowledgeQuery = {
      type: req.query.type as KnowledgeQuery["type"],
      filePattern: req.query.filePattern as string,
      actionType: req.query.actionType as string,
      minConfidence: req.query.minConfidence
        ? parseFloat(req.query.minConfidence as string)
        : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const entries = await queryKnowledge(query);
    res.json({ entries, total: entries.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/sia/knowledge/:id
 * Get a specific knowledge entry
 */
router.get(
  "/knowledge/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await getKnowledgeEntry(req.params.id);
      if (!entry) {
        res.status(404).json({ error: "Knowledge entry not found" });
        return;
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

/**
 * GET /api/sia/gotchas
 * Get gotchas with filters
 */
router.get("/gotchas", async (req: Request, res: Response): Promise<void> => {
  try {
    const query: KnowledgeQuery = {
      type: "gotcha",
      filePattern: req.query.filePattern as string,
      actionType: req.query.actionType as string,
      minConfidence: req.query.minConfidence
        ? parseFloat(req.query.minConfidence as string)
        : 0.3,
    };

    const gotchas = await queryKnowledge(query);
    res.json({ gotchas });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/sia/patterns
 * Get patterns with filters
 */
router.get("/patterns", async (req: Request, res: Response): Promise<void> => {
  try {
    const query: KnowledgeQuery = {
      type: "pattern",
      filePattern: req.query.filePattern as string,
      actionType: req.query.actionType as string,
    };

    const patterns = await queryKnowledge(query);
    res.json({ patterns });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/sia/proposals
 * Get CLAUDE.md update proposals
 */
router.get("/proposals", async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as ProposalStatus | undefined;
    const proposals = await getProposals(status);
    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/sia/proposals/:id
 * Get a specific proposal
 */
router.get(
  "/proposals/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const proposal = await getProposal(req.params.id);
      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

/**
 * POST /api/sia/proposals/:id/approve
 * Approve a CLAUDE.md proposal
 */
router.post(
  "/proposals/:id/approve",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const proposal = await getProposal(req.params.id);
      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      if (proposal.status !== "pending") {
        res.status(400).json({ error: "Proposal is not pending" });
        return;
      }

      const notes = req.body.notes as string | undefined;
      await updateProposalStatus(req.params.id, "approved", notes);

      // Apply the change to CLAUDE.md and commit
      try {
        const commitHash = await applyProposal(req.params.id);
        res.json({
          success: true,
          appliedContent: proposal.proposedContent,
          commitHash,
        });
      } catch (applyError) {
        // Proposal was approved but applying failed
        res.status(500).json({
          success: false,
          approved: true,
          error: `Approved but failed to apply: ${(applyError as Error).message}`,
        });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

/**
 * POST /api/sia/proposals/:id/reject
 * Reject a CLAUDE.md proposal
 */
router.post(
  "/proposals/:id/reject",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const proposal = await getProposal(req.params.id);
      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      if (proposal.status !== "pending") {
        res.status(400).json({ error: "Proposal is not pending" });
        return;
      }

      const notes = req.body.notes as string;
      if (!notes) {
        res.status(400).json({ error: "Rejection notes are required" });
        return;
      }

      await updateProposalStatus(req.params.id, "rejected", notes);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

export default router;
