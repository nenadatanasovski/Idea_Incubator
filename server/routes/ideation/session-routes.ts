/**
 * Session management routes for ideation.
 * Handles session CRUD, linking to ideas, naming drafts, etc.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  sessionManager,
  candidateManager,
  artifactStore,
  subAgentStore,
  messageStore,
  query,
  getOne,
  saveDb,
  timeoutMiddleware,
  ideaFolderExists,
  createDraftFolder,
  renameDraftToIdea,
  IdeaType,
  ParentInfo,
} from './shared.js';

export const sessionRouter = Router();

// Apply timeout middleware
sessionRouter.use(timeoutMiddleware);

// ============================================================================
// GET /session/:sessionId
// ============================================================================
// Get session details

sessionRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reactivate abandoned sessions when resumed
    if (session.status === 'abandoned') {
      await sessionManager.update(sessionId, { status: 'active' });
      session = await sessionManager.load(sessionId);
    }

    const messages = await messageStore.getBySession(sessionId);
    const candidate = await candidateManager.getActiveForSession(sessionId);
    const artifacts = await artifactStore.getBySession(sessionId);
    const subAgents = await subAgentStore.getBySession(sessionId);

    console.log(`[GetSession] Returning ${artifacts.length} artifacts, ${subAgents.length} sub-agents:`);
    artifacts.forEach(a => {
      const contentLen = typeof a.content === 'string' ? a.content.length : JSON.stringify(a.content).length;
      console.log(`  - ${a.id}: "${a.title}" (${contentLen} chars)`);
    });

    res.json({
      session,
      messages,
      candidate,
      artifacts,
      subAgents,
    });

  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /session/:sessionId/abandon
// ============================================================================
// Abandon a session

sessionRouter.post('/:sessionId/abandon', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    await sessionManager.abandon(sessionId);

    res.json({ success: true });

  } catch (error) {
    console.error('Error abandoning session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PATCH /session/:sessionId/link-idea
// ============================================================================
// Link a session to a specific user/idea

const LinkIdeaSchema = z.object({
  userSlug: z.string().min(1, 'userSlug is required'),
  ideaSlug: z.string().min(1, 'ideaSlug is required'),
});

sessionRouter.patch('/:sessionId/link-idea', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const parseResult = LinkIdeaSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { userSlug, ideaSlug } = parseResult.data;

    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!ideaFolderExists(userSlug, ideaSlug)) {
      return res.status(400).json({
        error: 'Idea folder not found',
        message: `No idea folder exists at users/${userSlug}/ideas/${ideaSlug}`,
      });
    }

    const db = await import('../../../database/db.js');
    await db.run(
      `UPDATE ideation_sessions SET user_slug = ?, idea_slug = ?, last_activity_at = ? WHERE id = ?`,
      [userSlug, ideaSlug, new Date().toISOString(), sessionId]
    );
    await db.saveDb();

    const updatedSession = await sessionManager.load(sessionId);

    return res.json({
      success: true,
      session: {
        ...updatedSession,
        userSlug,
        ideaSlug,
      },
    });

  } catch (error) {
    console.error('Error linking idea to session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /session/:sessionId/name-idea
// ============================================================================
// Converts a draft folder to a named idea

const NameIdeaSchema = z.object({
  title: z.string().min(1, 'title is required'),
  ideaType: z.enum(['business', 'feature_internal', 'feature_external', 'service', 'pivot']),
  parent: z.object({
    type: z.enum(['internal', 'external']),
    slug: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
});

sessionRouter.post('/:sessionId/name-idea', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const parseResult = NameIdeaSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { title, ideaType, parent } = parseResult.data;

    const db = await import('../../../database/db.js');
    const sessionRow = await db.getOne<{
      id: string;
      user_slug: string | null;
      idea_slug: string | null;
      status: string;
    }>(
      `SELECT id, user_slug, idea_slug, status FROM ideation_sessions WHERE id = ?`,
      [sessionId]
    );

    if (!sessionRow) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!sessionRow.idea_slug || !sessionRow.idea_slug.startsWith('draft_')) {
      return res.status(400).json({
        error: 'Session not linked to draft',
        message: 'This session is not linked to a draft folder. Only sessions with draft folders can be named.',
      });
    }

    if (!sessionRow.user_slug) {
      return res.status(400).json({
        error: 'Session missing user',
        message: 'This session does not have a user_slug set.',
      });
    }

    const ideaSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    if (ideaFolderExists(sessionRow.user_slug, ideaSlug)) {
      return res.status(409).json({
        error: 'Idea slug already exists',
        message: `An idea with slug '${ideaSlug}' already exists for this user.`,
      });
    }

    const parentInfo: ParentInfo | undefined = parent ? {
      type: parent.type,
      slug: parent.slug,
      name: parent.name,
    } : undefined;
    void parentInfo;

    await renameDraftToIdea(
      sessionRow.user_slug,
      sessionRow.idea_slug,
      ideaSlug,
      ideaType as IdeaType
    );

    await db.run(
      `UPDATE ideation_sessions SET idea_slug = ?, last_activity_at = ? WHERE id = ?`,
      [ideaSlug, new Date().toISOString(), sessionId]
    );
    await db.saveDb();

    return res.json({
      success: true,
      session: {
        id: sessionRow.id,
        userSlug: sessionRow.user_slug,
        ideaSlug: ideaSlug,
        status: sessionRow.status,
      },
    });

  } catch (error) {
    console.error('Error naming idea:', error);

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Idea slug already exists',
          message: error.message,
        });
      }
      if (error.message.includes('does not exist')) {
        return res.status(400).json({
          error: 'Draft folder not found',
          message: error.message,
        });
      }
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /sessions
// ============================================================================
// List sessions for a profile

sessionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { profileId, status, includeAll } = req.query;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const allSessions = await query<{
      id: string;
      profile_id: string;
      status: string;
      entry_mode: string | null;
      message_count: number;
      token_count: number;
      started_at: string;
      completed_at: string | null;
    }>(
      `SELECT id, profile_id, status, entry_mode, message_count, token_count, started_at, completed_at
       FROM ideation_sessions
       WHERE profile_id = ?
       ORDER BY started_at DESC`,
      [profileId as string]
    );

    const sessionsWithDetails = await Promise.all(
      allSessions.map(async (session) => {
        const candidate = await candidateManager.getActiveForSession(session.id);
        const lastMessage = await getOne<{ content: string; created_at: string }>(
          `SELECT content, created_at FROM ideation_messages
           WHERE session_id = ?
           ORDER BY created_at DESC LIMIT 1`,
          [session.id]
        );

        return {
          id: session.id,
          profileId: session.profile_id,
          status: session.status,
          entryMode: session.entry_mode,
          messageCount: session.message_count,
          tokenCount: session.token_count,
          startedAt: session.started_at,
          completedAt: session.completed_at,
          candidateTitle: candidate?.title || null,
          candidateSummary: candidate?.summary || null,
          lastMessagePreview: lastMessage?.content?.slice(0, 100) || null,
          lastMessageAt: lastMessage?.created_at || session.started_at,
        };
      })
    );

    let filteredSessions = sessionsWithDetails;
    if (status && status !== 'all') {
      filteredSessions = sessionsWithDetails.filter(s => s.status === status);
    } else if (!includeAll) {
      filteredSessions = sessionsWithDetails.filter(s => s.status !== 'abandoned');
    }

    res.json({ success: true, data: { sessions: filteredSessions } });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// DELETE /session/:sessionId
// ============================================================================
// Delete a session and its messages

sessionRouter.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await query('DELETE FROM ideation_artifacts WHERE session_id = ?', [sessionId]);
    await query('DELETE FROM ideation_memory_files WHERE session_id = ?', [sessionId]);
    await query('DELETE FROM ideation_searches WHERE session_id = ?', [sessionId]);
    await query('DELETE FROM ideation_signals WHERE session_id = ?', [sessionId]);
    await query('DELETE FROM ideation_messages WHERE session_id = ?', [sessionId]);
    await query('DELETE FROM ideation_candidates WHERE session_id = ?', [sessionId]);
    await query('DELETE FROM ideation_sessions WHERE id = ?', [sessionId]);

    await saveDb();

    res.json({ success: true, message: 'Session deleted' });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /session (create new session with optional idea linking)
// ============================================================================
// Creates a new session. When userSlug is provided without ideaSlug, creates a draft folder.

const CreateSessionWithUserSchema = z.object({
  userSlug: z.string().min(1, 'userSlug is required'),
  ideaSlug: z.string().optional(),
  profileId: z.string().optional(),
});

sessionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = CreateSessionWithUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { userSlug, ideaSlug, profileId } = parseResult.data;
    let finalIdeaSlug = ideaSlug;

    console.log(`[Session] Creating session for user ${userSlug}, ideaSlug: ${ideaSlug || 'none (will create draft)'}`);

    if (!ideaSlug) {
      const draftResult = await createDraftFolder(userSlug);
      finalIdeaSlug = draftResult.draftId;
      console.log(`[Session] Created draft folder: ${draftResult.draftId} at ${draftResult.path}`);
    } else {
      if (!ideaFolderExists(userSlug, ideaSlug)) {
        return res.status(400).json({
          error: 'Idea folder not found',
          message: `No idea folder exists at users/${userSlug}/ideas/${ideaSlug}`,
        });
      }
    }

    const db = await import('../../../database/db.js');
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    await db.run(`
      INSERT INTO ideation_sessions (
        id, profile_id, user_slug, idea_slug, status, current_phase, entry_mode,
        started_at, last_activity_at,
        handoff_count, token_count, message_count
      )
      VALUES (?, ?, ?, ?, 'active', 'exploring', 'discover', ?, ?, 0, 0, 0)
    `, [sessionId, profileId ?? null, userSlug, finalIdeaSlug, now, now]);

    await db.saveDb();

    return res.status(201).json({
      success: true,
      id: sessionId,
      userSlug,
      ideaSlug: finalIdeaSlug,
      status: 'active',
      currentPhase: 'exploring',
      entryMode: 'discover',
      startedAt: now,
      lastActivityAt: now,
    });

  } catch (error) {
    console.error('[Session] Error creating session:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
