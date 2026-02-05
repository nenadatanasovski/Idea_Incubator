/**
 * Idea Pipeline API Routes
 * 
 * REST API for managing idea lifecycle transitions through phases:
 * ideation → spec → build → deployed
 * 
 * Routes:
 * - GET /api/idea-pipeline/:ideaId/status - Get pipeline state
 * - POST /api/idea-pipeline/:ideaId/transition - Request transition
 * - POST /api/idea-pipeline/:ideaId/pause - Pause pipeline
 * - POST /api/idea-pipeline/:ideaId/resume - Resume pipeline
 * - GET /api/idea-pipeline/:ideaId/history - Get transition history
 * - PATCH /api/idea-pipeline/:ideaId/settings - Update settings
 */

import { Router, Request, Response } from 'express';
import { getOrchestrator, IdeaPhase } from '../pipeline/orchestrator.js';
import { query } from '../../database/db.js';

const router = Router();

/**
 * GET /api/idea-pipeline/:ideaId/status
 * Get current pipeline state for an idea
 */
router.get('/:ideaId/status', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    const orchestrator = getOrchestrator();
    const state = await orchestrator.getState(ideaId);
    const availableTransitions = orchestrator.getAvailableTransitions(state.currentPhase);
    
    res.json({
      state,
      availableTransitions,
      canAutoAdvance: state.autoAdvance && !state.humanReviewRequired,
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error getting status:', error);
    res.status(500).json({ 
      error: 'Failed to get pipeline status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/idea-pipeline/:ideaId/transition
 * Request a phase transition
 */
router.post('/:ideaId/transition', async (req: Request, res: Response): Promise<void> => {
  const { ideaId } = req.params;
  const { targetPhase, reason, force } = req.body;
  
  if (!targetPhase) {
    res.status(400).json({ error: 'targetPhase is required' });
    return;
  }
  
  try {
    const orchestrator = getOrchestrator();
    const result = await orchestrator.requestTransition(
      ideaId,
      targetPhase as IdeaPhase,
      reason || 'User requested transition',
      'user',
      force === true
    );
    
    if (result.success) {
      const newState = await orchestrator.getState(ideaId);
      res.json({ 
        success: true, 
        newPhase: result.newPhase,
        state: newState
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('[IdeaPipeline] Error executing transition:', error);
    res.status(500).json({ 
      error: 'Failed to execute transition',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/idea-pipeline/:ideaId/pause
 * Pause pipeline progress
 */
router.post('/:ideaId/pause', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    const orchestrator = getOrchestrator();
    const result = await orchestrator.pause(ideaId);
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[IdeaPipeline] Error pausing:', error);
    res.status(500).json({ error: 'Failed to pause pipeline' });
  }
});

/**
 * POST /api/idea-pipeline/:ideaId/resume
 * Resume paused pipeline
 */
router.post('/:ideaId/resume', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    const orchestrator = getOrchestrator();
    const result = await orchestrator.resume(ideaId);
    
    if (result.success) {
      const state = await orchestrator.getState(ideaId);
      res.json({ success: true, state });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[IdeaPipeline] Error resuming:', error);
    res.status(500).json({ error: 'Failed to resume pipeline' });
  }
});

/**
 * GET /api/idea-pipeline/:ideaId/history
 * Get transition history
 */
router.get('/:ideaId/history', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  try {
    const history = await query<{
      id: number;
      from_phase: string;
      to_phase: string;
      reason: string;
      triggered_by: string;
      success: number;
      error_message: string | null;
      created_at: string;
    }>(
      `SELECT * FROM pipeline_transitions 
       WHERE idea_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [ideaId, limit]
    );
    
    res.json({
      history: history.map(h => ({
        id: h.id,
        fromPhase: h.from_phase,
        toPhase: h.to_phase,
        reason: h.reason,
        triggeredBy: h.triggered_by,
        success: h.success === 1,
        errorMessage: h.error_message,
        createdAt: h.created_at,
      }))
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error getting history:', error);
    res.status(500).json({ error: 'Failed to get transition history' });
  }
});

/**
 * PATCH /api/idea-pipeline/:ideaId/settings
 * Update pipeline settings
 */
router.patch('/:ideaId/settings', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  const { autoAdvance, humanReviewRequired } = req.body;
  
  try {
    const orchestrator = getOrchestrator();
    const state = await orchestrator.getState(ideaId);
    
    if (autoAdvance !== undefined) {
      state.autoAdvance = autoAdvance;
    }
    if (humanReviewRequired !== undefined) {
      state.humanReviewRequired = humanReviewRequired;
    }
    
    // Save via internal method - we need to expose this
    // For now, update directly
    await query(
      `UPDATE idea_pipeline_state 
       SET auto_advance = ?, human_review_required = ?, updated_at = ?
       WHERE idea_id = ?`,
      [
        state.autoAdvance ? 1 : 0,
        state.humanReviewRequired ? 1 : 0,
        new Date().toISOString(),
        ideaId
      ]
    );
    
    res.json({ success: true, settings: { autoAdvance: state.autoAdvance, humanReviewRequired: state.humanReviewRequired } });
  } catch (error) {
    console.error('[IdeaPipeline] Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/idea-pipeline/:ideaId/progress
 * Get detailed progress for current phase
 */
router.get('/:ideaId/progress', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    const orchestrator = getOrchestrator();
    const state = await orchestrator.getState(ideaId);
    
    let phaseProgress: any = null;
    
    switch (state.currentPhase) {
      case 'ideation':
      case 'ideation_ready':
        phaseProgress = {
          phase: 'ideation',
          completionScore: state.ideationProgress.completionScore,
          blockerCount: state.ideationProgress.blockerCount,
          confidenceScore: state.ideationProgress.confidenceScore,
          milestones: state.ideationProgress.milestones,
          readyForSpec: state.ideationProgress.completionScore >= 0.6,
        };
        break;
        
      case 'specification':
      case 'spec_ready':
        phaseProgress = {
          phase: 'specification',
          sessionId: state.specProgress?.sessionId,
          sectionsComplete: state.specProgress?.sectionsComplete || 0,
          sectionsTotal: state.specProgress?.sectionsTotal || 0,
          pendingQuestions: state.specProgress?.pendingQuestions || [],
          generatedTasks: state.specProgress?.generatedTasks || 0,
          readyForBuild: (state.specProgress?.pendingQuestions?.length || 0) === 0,
        };
        break;
        
      case 'building':
      case 'build_review':
        phaseProgress = {
          phase: 'building',
          sessionId: state.buildProgress?.sessionId,
          tasksComplete: state.buildProgress?.tasksComplete || 0,
          tasksTotal: state.buildProgress?.tasksTotal || 0,
          currentTask: state.buildProgress?.currentTask,
          failedTasks: state.buildProgress?.failedTasks || 0,
          siaInterventions: state.buildProgress?.siaInterventions || 0,
          percentComplete: state.buildProgress?.tasksTotal 
            ? Math.round((state.buildProgress.tasksComplete / state.buildProgress.tasksTotal) * 100)
            : 0,
        };
        break;
        
      case 'deployed':
        phaseProgress = {
          phase: 'deployed',
          complete: true,
        };
        break;
    }
    
    res.json({
      currentPhase: state.currentPhase,
      progress: phaseProgress,
      autoAdvance: state.autoAdvance,
      humanReviewRequired: state.humanReviewRequired,
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

export default router;
