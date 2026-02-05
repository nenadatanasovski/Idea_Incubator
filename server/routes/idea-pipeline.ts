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
 * - POST /api/idea-pipeline/:ideaId/spec/start - Start spec generation
 * - GET /api/idea-pipeline/:ideaId/spec/status - Get spec session status
 * - POST /api/idea-pipeline/:ideaId/spec/answer - Answer spec questions
 */

import { Router, Request, Response } from 'express';
import { getOrchestrator, IdeaPhase } from '../pipeline/orchestrator.js';
import { getSpecBridge } from '../pipeline/spec-bridge.js';
import { query, getOne } from '../../database/db.js';

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

// ==================== SPEC ROUTES ====================

/**
 * POST /api/idea-pipeline/:ideaId/spec/start
 * Start spec generation for an idea
 */
router.post('/:ideaId/spec/start', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    const orchestrator = getOrchestrator();
    const state = await orchestrator.getState(ideaId);
    
    // Check if we're in a valid phase for spec generation
    if (state.currentPhase !== 'ideation_ready' && state.currentPhase !== 'specification') {
      res.status(400).json({
        error: `Cannot start spec from phase: ${state.currentPhase}. Must be in ideation_ready or specification phase.`
      });
      return;
    }
    
    // Load ideation handoff data
    const artifacts = await query<{ type: string; content: string }>(
      'SELECT type, content FROM ideation_artifacts WHERE idea_id = ?',
      [ideaId]
    );
    
    const sessions = await query<{ id: string }>(
      'SELECT id FROM ideation_sessions WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1',
      [ideaId]
    );
    
    let conversationSummary = '';
    if (sessions.length > 0) {
      const messages = await query<{ role: string; content: string }>(
        'SELECT role, content FROM ideation_messages WHERE session_id = ? ORDER BY created_at LIMIT 20',
        [sessions[0].id]
      );
      conversationSummary = messages.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
    }
    
    // Build handoff object
    const handoff = {
      ideaId,
      problemStatement: artifacts.find(a => a.type === 'problem_statement' || a.type === 'problem')?.content || '',
      solutionDescription: artifacts.find(a => a.type === 'solution_description' || a.type === 'solution')?.content || '',
      targetUsers: artifacts.find(a => a.type === 'target_user' || a.type === 'target_audience')?.content || '',
      artifacts: artifacts.map(a => ({ type: a.type, content: a.content })),
      conversationSummary,
    };
    
    // Start spec generation
    const specBridge = getSpecBridge();
    const session = await specBridge.startSession(ideaId, handoff);
    
    // Transition to specification phase if not already there
    if (state.currentPhase === 'ideation_ready') {
      await orchestrator.requestTransition(
        ideaId,
        'specification',
        'Spec generation started',
        'system'
      );
    }
    
    res.json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error starting spec:', error);
    res.status(500).json({
      error: 'Failed to start spec generation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/idea-pipeline/:ideaId/spec/status
 * Get spec session status
 */
router.get('/:ideaId/spec/status', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    const specBridge = getSpecBridge();
    const session = specBridge.getSessionForIdea(ideaId);
    
    if (!session) {
      // Check if there's a completed spec in the database
      const savedSpec = await getOne<{
        spec_content: string;
        tasks_content: string;
        task_count: number;
        generated_at: string;
      }>('SELECT * FROM spec_outputs WHERE idea_id = ?', [ideaId]);
      
      if (savedSpec) {
        res.json({
          status: 'complete',
          taskCount: savedSpec.task_count,
          generatedAt: savedSpec.generated_at,
          hasOutput: true,
        });
        return;
      }
      
      res.json({
        status: 'not_started',
        hasOutput: false,
      });
      return;
    }
    
    res.json({
      sessionId: session.sessionId,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      hasOutput: !!session.output,
      taskCount: session.output?.metadata.taskCount || 0,
      questions: session.status === 'questions' ? session.output?.questions : undefined,
      error: session.error,
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error getting spec status:', error);
    res.status(500).json({ error: 'Failed to get spec status' });
  }
});

/**
 * POST /api/idea-pipeline/:ideaId/spec/answer
 * Answer pending questions and resume spec generation
 */
router.post('/:ideaId/spec/answer', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  const { sessionId, answers } = req.body;
  
  if (!sessionId || !answers || typeof answers !== 'object') {
    res.status(400).json({ error: 'sessionId and answers object are required' });
    return;
  }
  
  try {
    const specBridge = getSpecBridge();
    const answerMap = new Map<string, string>(Object.entries(answers));
    
    const session = await specBridge.answerQuestions(sessionId, answerMap);
    
    res.json({
      success: true,
      status: session.status,
      taskCount: session.output?.metadata.taskCount || 0,
      hasMoreQuestions: session.status === 'questions',
      questions: session.status === 'questions' ? session.output?.questions : undefined,
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error answering spec questions:', error);
    res.status(500).json({
      error: 'Failed to process answers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/idea-pipeline/:ideaId/spec/output
 * Get generated spec content
 */
router.get('/:ideaId/spec/output', async (req: Request, res: Response) => {
  const { ideaId } = req.params;
  
  try {
    // First check database
    const savedSpec = await getOne<{
      spec_content: string;
      tasks_content: string;
      task_count: number;
      generated_at: string;
    }>('SELECT * FROM spec_outputs WHERE idea_id = ?', [ideaId]);
    
    if (savedSpec) {
      res.json({
        success: true,
        spec: savedSpec.spec_content,
        tasks: savedSpec.tasks_content,
        taskCount: savedSpec.task_count,
        generatedAt: savedSpec.generated_at,
      });
      return;
    }
    
    // Check active session
    const specBridge = getSpecBridge();
    const session = specBridge.getSessionForIdea(ideaId);
    
    if (session?.output) {
      res.json({
        success: true,
        spec: session.output.spec,
        tasks: session.output.tasks,
        taskCount: session.output.metadata.taskCount,
        warnings: session.output.metadata.warnings,
      });
      return;
    }
    
    res.status(404).json({
      error: 'No spec output found for this idea'
    });
  } catch (error) {
    console.error('[IdeaPipeline] Error getting spec output:', error);
    res.status(500).json({ error: 'Failed to get spec output' });
  }
});

export default router;
