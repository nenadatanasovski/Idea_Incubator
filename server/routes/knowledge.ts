// server/routes/knowledge.ts - Knowledge Base API routes

import { Router, Request, Response } from 'express';
import {
  queryKnowledge,
  getKnowledgeEntry,
  getProposals,
  getProposal,
  updateProposalStatus,
  KnowledgeType,
  ProposalStatus,
} from '../../agents/knowledge-base/index.js';
import {
  getRelevantGotchas,
  getRelevantPatterns,
  getKnowledgeStats,
  searchKnowledge,
  getRecentEntries,
  getPromotionCandidates,
} from '../../agents/knowledge-base/queries.js';

const router = Router();

/**
 * GET /api/knowledge
 * Query knowledge entries with filters
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type,
      minConfidence,
      filePattern,
      actionType,
      limit,
      offset,
    } = req.query;

    const entries = await queryKnowledge({
      type: type as KnowledgeType | undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
      filePattern: filePattern as string | undefined,
      actionType: actionType as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({ entries, count: entries.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/stats
 * Get knowledge base statistics
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getKnowledgeStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/recent
 * Get recent knowledge entries
 */
router.get('/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const entries = await getRecentEntries(limit);
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/search
 * Search knowledge base
 */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, type } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Search query (q) is required' });
      return;
    }

    const entries = await searchKnowledge(
      q as string,
      type as KnowledgeType | undefined
    );

    res.json({ entries, count: entries.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/gotchas
 * Get gotchas relevant to a file
 */
router.get('/gotchas', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, action } = req.query;

    if (!file) {
      res.status(400).json({ error: 'File path (file) is required' });
      return;
    }

    const gotchas = await getRelevantGotchas(
      file as string,
      action as string | undefined
    );

    res.json({ gotchas, count: gotchas.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/patterns
 * Get patterns relevant to a file
 */
router.get('/patterns', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, action } = req.query;

    if (!file) {
      res.status(400).json({ error: 'File path (file) is required' });
      return;
    }

    const patterns = await getRelevantPatterns(
      file as string,
      action as string | undefined
    );

    res.json({ patterns, count: patterns.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/promotion-candidates
 * Get entries ready for CLAUDE.md promotion
 */
router.get('/promotion-candidates', async (req: Request, res: Response): Promise<void> => {
  try {
    const minConfidence = parseFloat(req.query.minConfidence as string) || 0.8;
    const minOccurrences = parseInt(req.query.minOccurrences as string) || 2;

    const candidates = await getPromotionCandidates(minConfidence, minOccurrences);

    res.json({ candidates, count: candidates.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/:id
 * Get a single knowledge entry
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const entry = await getKnowledgeEntry(id);

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/proposals
 * Get CLAUDE.md proposals
 */
router.get('/proposals', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as ProposalStatus | undefined;
    const proposals = await getProposals(status);

    res.json({ proposals, count: proposals.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/knowledge/proposals/:id
 * Get a single proposal
 */
router.get('/proposals/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const proposal = await getProposal(id);

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PATCH /api/knowledge/proposals/:id
 * Update proposal status (approve/reject)
 */
router.patch('/proposals/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
      return;
    }

    const proposal = await getProposal(id);
    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    await updateProposalStatus(id, status as ProposalStatus, notes);

    res.json({ success: true, id, status });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
