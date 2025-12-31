import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getOne, query, saveDb } from '../../database/db.js';
import { sessionManager } from '../../agents/ideation/session-manager.js';
import { messageStore } from '../../agents/ideation/message-store.js';
import { memoryManager } from '../../agents/ideation/memory-manager.js';
import { agentOrchestrator } from '../../agents/ideation/orchestrator.js';
import { generateGreetingWithButtons, UserProfile } from '../../agents/ideation/greeting-generator.js';
import { candidateManager } from '../../agents/ideation/candidate-manager.js';
import { createSSEStream, StreamingResponseHandler } from '../../agents/ideation/streaming.js';
import { client as anthropicClient } from '../../utils/anthropic-client.js';
import { buildSystemPrompt } from '../../agents/ideation/system-prompt.js';

export const ideationRouter = Router();

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

const StartSessionSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
});

const SendMessageSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  message: z.string().min(1, 'message is required'),
});

const ButtonClickSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  buttonId: z.string().min(1, 'buttonId is required'),
  buttonValue: z.string(),
});

const CaptureIdeaSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
});

const FormSubmitSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  formId: z.string().min(1, 'formId is required'),
  responses: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])),
});

const SaveForLaterSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  candidateId: z.string().optional(),
  notes: z.string().optional(),
});

const DiscardAndRestartSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  reason: z.string().optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getProfileById(profileId: string): Promise<UserProfile | null> {
  const profile = await getOne<{
    id: string;
    name: string;
    technical_skills: string | null;
    interests: string | null;
    professional_experience: string | null;
    city: string | null;
    country: string | null;
  }>('SELECT id, name, technical_skills, interests, professional_experience, city, country FROM user_profiles WHERE id = ?', [profileId]);

  if (!profile) return null;

  // Parse skills and interests
  const parseField = (val: string | null): string[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return val.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    }
  };

  return {
    name: profile.name,
    skills: parseField(profile.technical_skills),
    interests: parseField(profile.interests),
    experience: profile.professional_experience ? {
      industries: parseField(profile.professional_experience),
    } : undefined,
    location: profile.city || profile.country ? {
      city: profile.city || undefined,
      country: profile.country || undefined,
    } : undefined,
  };
}

async function createIdea(params: {
  title: string;
  type: string;
  stage: string;
  summary?: string;
}): Promise<{ id: string; slug: string }> {
  const id = uuidv4();
  const slug = params.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  const now = new Date().toISOString();

  await query(
    `INSERT INTO ideas (id, slug, title, summary, idea_type, lifecycle_stage, folder_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, slug, params.title, params.summary || null, params.type, params.stage, `ideas/${slug}`, now, now]
  );

  await saveDb();

  return { id, slug };
}

// ============================================================================
// POST /api/ideation/start
// ============================================================================
// Starts a new ideation session

ideationRouter.post('/start', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = StartSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { profileId } = parseResult.data;

    // Load profile
    const profile = await getProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Create session
    const session = await sessionManager.create({ profileId });

    // Generate personalized greeting
    const greeting = generateGreetingWithButtons(profile);

    // Store greeting as first assistant message
    await messageStore.add({
      sessionId: session.id,
      role: 'assistant',
      content: greeting.text,
      buttonsShown: greeting.buttons,
      tokenCount: Math.ceil(greeting.text.length / 4),
    });

    // Update session message count
    await sessionManager.update(session.id, { messageCount: 1 });

    // Return response
    res.json({
      sessionId: session.id,
      greeting: greeting.text,
      buttons: greeting.buttons,
    });

  } catch (error) {
    console.error('Error starting ideation session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/message
// ============================================================================
// Handles user message and returns agent response

ideationRouter.post('/message', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = SendMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, message } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Load profile
    const profile = await getProfileById(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Process message through orchestrator
    const response = await agentOrchestrator.processMessage(session, message, profile as Record<string, unknown>);

    // Update session
    const messages = await messageStore.getBySession(sessionId);
    const totalTokens = await messageStore.getTotalTokens(sessionId);
    await sessionManager.update(sessionId, {
      messageCount: messages.length,
      tokenCount: totalTokens,
    });

    // Get or create candidate if confidence is high enough
    let candidateData = null;
    if (response.confidence >= 30 && response.candidateUpdate) {
      const candidate = await candidateManager.getOrCreateForSession(sessionId, {
        title: response.candidateUpdate.title,
        summary: response.candidateUpdate.summary,
        confidence: response.confidence,
        viability: response.viability,
      });
      candidateData = candidate;
    }

    // Build intervention if needed
    let intervention = null;
    if (response.requiresIntervention) {
      intervention = {
        type: response.viability < 25 ? 'critical' : 'warning',
        message: 'Viability concerns detected',
        options: [
          { id: 'address', label: 'Address challenges', value: 'Let\'s address these challenges' },
          { id: 'pivot', label: 'Pivot direction', value: 'I want to explore a different direction' },
          { id: 'continue', label: 'Continue anyway', value: 'I understand the risks, let\'s continue' },
          { id: 'fresh', label: 'Start fresh', value: 'Let\'s start with a completely new idea' },
        ],
      };
    }

    // Calculate token usage for frontend display
    const TOKEN_LIMIT = 100000; // Claude's context limit
    const percentUsed = Math.min((totalTokens / TOKEN_LIMIT) * 100, 100);
    const shouldHandoff = percentUsed >= 80;

    // Return response
    res.json({
      reply: response.reply,
      buttons: response.buttons,
      formFields: response.form,
      candidateUpdate: candidateData ? {
        id: candidateData.id,
        title: candidateData.title,
        summary: candidateData.summary,
      } : null,
      confidence: response.confidence,
      viability: response.viability,
      risks: response.risks || [],
      intervention,
      handoffOccurred: response.handoffOccurred,
      tokenUsage: {
        total: totalTokens,
        limit: TOKEN_LIMIT,
        percentUsed,
        shouldHandoff,
      },
    });

  } catch (error) {
    console.error('Error processing ideation message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/button
// ============================================================================
// Handles button click as if it were a message

ideationRouter.post('/button', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = ButtonClickSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, buttonId, buttonValue } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Get last assistant message and record button click
    const messages = await messageStore.getBySession(sessionId);
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    if (lastAssistantMessage) {
      await messageStore.recordButtonClick(lastAssistantMessage.id, buttonId);
    }

    // Load profile
    const profile = await getProfileById(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Process button value as message through orchestrator
    const response = await agentOrchestrator.processMessage(session, buttonValue, profile as Record<string, unknown>);

    // Update session
    const updatedMessages = await messageStore.getBySession(sessionId);
    const totalTokens = await messageStore.getTotalTokens(sessionId);
    await sessionManager.update(sessionId, {
      messageCount: updatedMessages.length,
      tokenCount: totalTokens,
    });

    // Get or create candidate if confidence is high enough
    let candidateData = null;
    if (response.confidence >= 30 && response.candidateUpdate) {
      const candidate = await candidateManager.getOrCreateForSession(sessionId, {
        title: response.candidateUpdate.title,
        summary: response.candidateUpdate.summary,
        confidence: response.confidence,
        viability: response.viability,
      });
      candidateData = candidate;
    }

    // Calculate token usage for frontend display
    const TOKEN_LIMIT = 100000; // Claude's context limit
    const percentUsed = Math.min((totalTokens / TOKEN_LIMIT) * 100, 100);
    const shouldHandoff = percentUsed >= 80;

    // Return response
    res.json({
      reply: response.reply,
      buttons: response.buttons,
      formFields: response.form,
      candidateUpdate: candidateData ? {
        id: candidateData.id,
        title: candidateData.title,
        summary: candidateData.summary,
      } : null,
      confidence: response.confidence,
      viability: response.viability,
      risks: response.risks || [],
      handoffOccurred: response.handoffOccurred,
      tokenUsage: {
        total: totalTokens,
        limit: TOKEN_LIMIT,
        percentUsed,
        shouldHandoff,
      },
    });

  } catch (error) {
    console.error('Error processing button click:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/form
// ============================================================================
// Handles form submissions

ideationRouter.post('/form', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = FormSubmitSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, formId, responses } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check session state
    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Session is not active',
        status: session.status,
      });
    }

    // Format responses as user message
    const formattedResponse = Object.entries(responses)
      .map(([field, value]) => {
        if (Array.isArray(value)) {
          return `${field}: ${value.join(', ')}`;
        }
        return `${field}: ${value}`;
      })
      .join('\n');

    // Store as user message with form reference
    await messageStore.add({
      sessionId,
      role: 'user',
      content: formattedResponse,
      formResponse: { formId, responses },
      tokenCount: Math.ceil(formattedResponse.length / 4),
    });

    // Get profile for context
    const profile = await getProfileById(session.profileId);

    // Process through agent
    const agentResponse = await agentOrchestrator.processMessage(
      session,
      formattedResponse,
      profile || {}
    );

    // Update candidate if needed
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (agentResponse.candidateUpdate) {
      if (candidate) {
        await candidateManager.update(candidate.id, {
          title: agentResponse.candidateUpdate.title,
          summary: agentResponse.candidateUpdate.summary,
          confidence: agentResponse.confidence,
          viability: agentResponse.viability,
        });
      } else {
        await candidateManager.create({
          sessionId,
          title: agentResponse.candidateUpdate.title,
          summary: agentResponse.candidateUpdate.summary,
          confidence: agentResponse.confidence,
          viability: agentResponse.viability,
        });
      }
    }

    res.json({
      reply: agentResponse.reply,
      buttons: agentResponse.buttons,
      form: agentResponse.form,
      candidate: await candidateManager.getActiveForSession(sessionId),
    });

  } catch (error) {
    console.error('Error processing form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/capture
// ============================================================================
// Captures the current idea candidate to the Ideas system

ideationRouter.post('/capture', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = CaptureIdeaSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get current candidate
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (!candidate) {
      return res.status(400).json({ error: 'No idea candidate to capture' });
    }

    // Create idea in system
    const idea = await createIdea({
      title: candidate.title,
      type: 'business', // Default type
      stage: 'SPARK',
      summary: candidate.summary || undefined,
    });

    // Update candidate status
    await candidateManager.update(candidate.id, {
      status: 'captured',
      capturedIdeaId: idea.id,
    });

    // Complete session
    await sessionManager.complete(sessionId);

    // Return response
    res.json({
      ideaId: idea.id,
      ideaSlug: idea.slug,
      prePopulatedFields: {
        title: candidate.title,
        type: 'business',
        summary: candidate.summary,
      },
      ideationMetadata: {
        sessionId,
        confidenceAtCapture: candidate.confidence,
        viabilityAtCapture: candidate.viability,
      },
    });

  } catch (error) {
    console.error('Error capturing idea:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/save
// ============================================================================
// Saves current idea for later

ideationRouter.post('/save', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = SaveForLaterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, candidateId, notes } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get candidate (use provided or active)
    let candidate;
    if (candidateId) {
      candidate = await candidateManager.getById(candidateId);
    } else {
      candidate = await candidateManager.getActiveForSession(sessionId);
    }

    if (!candidate) {
      return res.status(404).json({ error: 'No candidate to save' });
    }

    // Update candidate status
    await candidateManager.update(candidate.id, {
      status: 'saved',
    });

    // Update session status
    await sessionManager.update(sessionId, {
      status: 'paused' as 'active', // Cast for now, may need to extend type
    });

    // Store save action as memory
    await memoryManager.upsert(sessionId, 'conversation_summary', `
# Conversation Summary

## Saved for Later
**Timestamp**: ${new Date().toISOString()}
**Candidate**: ${candidate.title}
${notes ? `**Notes**: ${notes}` : ''}
`);

    res.json({
      success: true,
      candidate: await candidateManager.getById(candidate.id),
      message: 'Idea saved for later. You can resume this session anytime.',
    });

  } catch (error) {
    console.error('Error saving for later:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/discard
// ============================================================================
// Discards current session and optionally starts fresh

ideationRouter.post('/discard', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = DiscardAndRestartSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, reason } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Discard any active candidates
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (candidate) {
      await candidateManager.update(candidate.id, {
        status: 'discarded',
      });
    }

    // Store discard reason if provided
    if (reason) {
      await memoryManager.upsert(sessionId, 'conversation_summary', `
# Conversation Summary

## Session Discarded
**Timestamp**: ${new Date().toISOString()}
**Reason**: ${reason}
`);
    }

    // Abandon the session
    await sessionManager.abandon(sessionId);

    // Create new session for restart
    const profile = await getProfileById(session.profileId);
    const newSession = await sessionManager.create({
      profileId: session.profileId,
    });

    // Generate fresh greeting
    const greeting = generateGreetingWithButtons(profile || {});

    // Store greeting
    await messageStore.add({
      sessionId: newSession.id,
      role: 'assistant',
      content: greeting.text,
      buttonsShown: greeting.buttons,
      tokenCount: Math.ceil(greeting.text.length / 4),
    });

    res.json({
      success: true,
      newSessionId: newSession.id,
      greeting: greeting.text,
      buttons: greeting.buttons,
    });

  } catch (error) {
    console.error('Error discarding session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /api/ideation/session/:sessionId
// ============================================================================
// Get session details

ideationRouter.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await messageStore.getBySession(sessionId);
    const candidate = await candidateManager.getActiveForSession(sessionId);

    res.json({
      session,
      messages,
      candidate,
    });

  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/session/:sessionId/abandon
// ============================================================================
// Abandon a session

ideationRouter.post('/session/:sessionId/abandon', async (req: Request, res: Response) => {
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
// GET /api/ideation/sessions
// ============================================================================
// List sessions for a profile

ideationRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { profileId, status } = req.query;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    let sessions;
    if (status === 'active') {
      sessions = await sessionManager.getActiveByProfile(profileId as string);
    } else {
      // Return all active sessions for now
      sessions = await sessionManager.getActiveByProfile(profileId as string);
    }

    res.json({ sessions });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/message/stream
// ============================================================================
// Streaming message endpoint using Server-Sent Events

ideationRouter.post('/message/stream', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = SendMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, message } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check session state
    if (session.status !== 'active') {
      return res.status(400).json({
        error: 'Session is not active',
        status: session.status,
      });
    }

    // Setup SSE stream
    const stream = createSSEStream(res);

    // Store user message
    await messageStore.add({
      sessionId,
      role: 'user',
      content: message,
      tokenCount: Math.ceil(message.length / 4),
    });

    // Get context
    const messages = await messageStore.getBySession(sessionId);
    const profile = await getProfileById(session.profileId);
    const candidate = await candidateManager.getActiveForSession(sessionId);

    // Create streaming handler
    const client = anthropicClient;
    const handler = new StreamingResponseHandler(client);

    // Listen for stream events
    handler.on('stream', async (event) => {
      if (event.type === 'text_delta') {
        stream.send('text_delta', { text: event.data });
      } else if (event.type === 'message_complete') {
        const data = event.data as {
          text: string;
          buttons: unknown[] | null;
          form: unknown | null;
          candidateUpdate: { title: string; summary: string } | null;
        };

        // Store complete message
        await messageStore.add({
          sessionId,
          role: 'assistant',
          content: data.text,
          buttonsShown: data.buttons as unknown as import('../../types/ideation.js').ButtonOption[] | null,
          formShown: data.form as import('../../types/ideation.js').FormDefinition | null,
          tokenCount: Math.ceil(data.text.length / 4),
        });

        // Handle candidate updates
        if (data.candidateUpdate && candidate) {
          await candidateManager.update(candidate.id, {
            title: data.candidateUpdate.title,
            summary: data.candidateUpdate.summary,
          });
        }

        stream.send('message_complete', {
          reply: data.text,
          buttons: data.buttons,
          form: data.form,
        });
        stream.end();
      } else if (event.type === 'error') {
        stream.send('error', { message: (event.data as Error).message });
        stream.end();
      }
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt(profile || {});

    // Start streaming
    await handler.streamMessage(
      messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      systemPrompt
    );

  } catch (error) {
    console.error('Error in streaming message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
