/**
 * Specification API Routes
 * 
 * Endpoints for specification session management.
 * Part of: SPEC-004 - Specification API Routes
 * 
 * Routes:
 * - POST /:ideaId/start - Start a new spec session
 * - GET /:ideaId/session - Get current spec session
 * - POST /:sessionId/answer - Answer a pending question
 * - POST /:sessionId/chat - Send a chat message
 * - POST /:sessionId/finalize - Finalize spec and generate tasks
 */

import { Router, Request, Response } from 'express';
import { getSpecSessionAgent } from '../../agents/specification/spec-session-agent.js';
import { getOne, query } from '../../database/db.js';
import { IdeationToSpecHandoff } from '../../agents/specification/session-manager.js';

const router = Router();

// Get the spec session agent instance
const specAgent = getSpecSessionAgent();

/**
 * Prepare ideation handoff data from database
 */
async function prepareIdeationHandoff(ideaId: string): Promise<IdeationToSpecHandoff> {
  // Get idea details
  const idea = await getOne<{
    id: string;
    title: string;
    slug: string;
    problem_statement: string;
    solution: string;
    target_user: string;
  }>(`SELECT id, title, slug, problem_statement, solution, target_user FROM ideas WHERE id = ?`, [ideaId]);

  if (!idea) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  // Get ideation session artifacts if available
  const artifacts: { type: string; content: string }[] = [];
  
  // Try to get ideation session data
  const ideationSession = await getOne<{
    id: string;
    idea_id: string;
  }>(`SELECT id, idea_id FROM ideation_sessions WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`, [ideaId]);

  if (ideationSession) {
    // Get messages as conversation summary
    const messages = await query<{ role: string; content: string }>(
      `SELECT role, content FROM ideation_messages WHERE session_id = ? ORDER BY created_at`,
      [ideationSession.id]
    );

    if (messages.length > 0) {
      // Extract last few messages as summary
      const recent = messages.slice(-10);
      const summary = recent.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
      artifacts.push({ type: 'conversation', content: summary });
    }

    // Get any artifacts stored
    const sessionArtifacts = await query<{ type: string; content: string }>(
      `SELECT artifact_type as type, content FROM ideation_artifacts WHERE session_id = ?`,
      [ideationSession.id]
    ).catch(() => []);

    artifacts.push(...sessionArtifacts);
  }

  return {
    ideaId,
    problemStatement: idea.problem_statement || '',
    solutionDescription: idea.solution || idea.title || '',
    targetUsers: idea.target_user || '',
    artifacts,
    conversationSummary: artifacts.find(a => a.type === 'conversation')?.content || '',
  };
}

/**
 * POST /api/specification/:ideaId/start
 * Start a new spec session for an idea
 */
router.post('/:ideaId/start', async (req: Request, res: Response) => {
  const { ideaId } = req.params;

  try {
    // Prepare handoff from ideation data
    const handoff = await prepareIdeationHandoff(ideaId);

    // Start session
    const session = await specAgent.startSession(ideaId, handoff);

    res.json({
      success: true,
      sessionId: session.id,
      status: session.status,
      draft: session.currentDraft,
      questions: session.pendingQuestions,
      draftVersion: session.draftVersion,
    });
  } catch (error) {
    console.error('[Specification] Start session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start spec session',
    });
  }
});

/**
 * GET /api/specification/:ideaId/session
 * Get current spec session for an idea
 */
router.get('/:ideaId/session', async (req: Request, res: Response): Promise<void> => {
  const { ideaId } = req.params;

  try {
    const session = await specAgent.getSessionByIdeaId(ideaId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'No spec session found for this idea',
      });
      return;
    }

    res.json({
      success: true,
      sessionId: session.id,
      status: session.status,
      draft: session.currentDraft,
      questions: session.pendingQuestions,
      answeredQuestions: session.answeredQuestions,
      tasks: session.tasks,
      draftVersion: session.draftVersion,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[Specification] Get session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get spec session',
    });
  }
});

/**
 * GET /api/specification/session/:sessionId
 * Get spec session by session ID
 */
router.get('/session/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    const session = await specAgent.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    res.json({
      success: true,
      sessionId: session.id,
      ideaId: session.ideaId,
      status: session.status,
      draft: session.currentDraft,
      questions: session.pendingQuestions,
      answeredQuestions: session.answeredQuestions,
      tasks: session.tasks,
      draftVersion: session.draftVersion,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[Specification] Get session by ID error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get spec session',
    });
  }
});

/**
 * POST /api/specification/:sessionId/answer
 * Answer a pending question
 */
router.post('/:sessionId/answer', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { questionId, answer } = req.body;

  if (!questionId || !answer) {
    res.status(400).json({
      success: false,
      error: 'questionId and answer are required',
    });
    return;
  }

  try {
    const result = await specAgent.answerQuestion(sessionId, questionId, answer);
    const session = await specAgent.getSession(sessionId);

    res.json({
      success: true,
      updated: result.updated,
      remainingQuestions: result.remainingQuestions,
      updatedDraft: session?.currentDraft,
      pendingQuestions: session?.pendingQuestions,
    });
  } catch (error) {
    console.error('[Specification] Answer question error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to answer question',
    });
  }
});

/**
 * POST /api/specification/:sessionId/chat
 * Send a chat message to the spec agent
 */
router.post('/:sessionId/chat', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { message } = req.body;

  if (!message) {
    res.status(400).json({
      success: false,
      error: 'message is required',
    });
    return;
  }

  try {
    const result = await specAgent.chat(sessionId, message);
    const session = await specAgent.getSession(sessionId);

    res.json({
      success: true,
      response: result.response,
      updatedSpec: result.updatedSpec,
      changes: result.changes,
      currentDraft: result.updatedSpec ? session?.currentDraft : undefined,
      pendingQuestions: session?.pendingQuestions,
    });
  } catch (error) {
    console.error('[Specification] Chat error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Chat failed',
    });
  }
});

/**
 * POST /api/specification/:sessionId/finalize
 * Finalize spec and generate tasks
 */
router.post('/:sessionId/finalize', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const result = await specAgent.finalize(sessionId);

    res.json({
      success: true,
      spec: result.spec,
      taskCount: result.tasks.length,
      tasks: result.tasks,
    });
  } catch (error) {
    console.error('[Specification] Finalize error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to finalize specification',
    });
  }
});

/**
 * DELETE /api/specification/:sessionId
 * Delete a spec session
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  try {
    const { getSessionManager } = await import('../../agents/specification/session-manager.js');
    const manager = await getSessionManager();
    await manager.deleteSession(sessionId);

    res.json({
      success: true,
      message: 'Session deleted',
    });
  } catch (error) {
    console.error('[Specification] Delete session error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session',
    });
  }
});

export default router;
