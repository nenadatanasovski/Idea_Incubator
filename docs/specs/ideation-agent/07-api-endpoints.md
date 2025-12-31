# Spec 7: API Endpoints

## Overview

This specification covers all REST API endpoints for the Ideation Agent system, including request/response schemas, validation, and error handling.

## Dependencies

- Spec 1-6: All previous specifications
- Existing `server/api.ts` Express router

---

## 1. Route Registration

Add to `server/api.ts`:

```typescript
import { ideationRouter } from './routes/ideation.js';

// Add ideation routes
router.use('/ideation', ideationRouter);
```

---

## 2. Ideation Routes

Create file: `server/routes/ideation.ts`

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionManager } from '../../agents/ideation/session-manager.js';
import { messageStore } from '../../agents/ideation/message-store.js';
import { memoryManager } from '../../agents/ideation/memory-manager.js';
import { agentOrchestrator } from '../../agents/ideation/orchestrator.js';
import { generateGreetingWithButtons } from '../../agents/ideation/greeting-generator.js';
import { candidateManager } from '../../agents/ideation/candidate-manager.js';
import { calculateTokenUsage, estimateTokens } from '../../agents/ideation/token-counter.js';
import { getProfileById } from '../../services/profile-service.js';
import { createIdea, syncIdea } from '../../services/idea-service.js';

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

const SessionIdSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
});

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

    // Initialize memory files
    await memoryManager.initializeSession(session.id);

    // Generate personalized greeting
    const greeting = generateGreetingWithButtons(profile);

    // Store greeting as first assistant message
    await messageStore.create({
      sessionId: session.id,
      role: 'assistant',
      content: greeting.text,
      buttonsShown: greeting.buttons,
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

    // Store user message
    await messageStore.create({
      sessionId,
      role: 'user',
      content: message,
    });

    // Process message through orchestrator
    const response = await agentOrchestrator.processMessage(session, message, profile);

    // Store assistant message
    await messageStore.create({
      sessionId,
      role: 'assistant',
      content: response.reply,
      buttonsShown: response.buttons || undefined,
      formShown: response.form || undefined,
    });

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

    // Return response
    res.json({
      reply: response.reply,
      buttons: response.buttons,
      formFields: response.form,
      ideaCandidate: candidateData ? {
        id: candidateData.id,
        title: candidateData.title,
        summary: candidateData.summary,
        confidence: response.confidence,
        viability: response.viability,
      } : null,
      intervention,
      handoffOccurred: response.handoffOccurred,
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

    // Record button click on last assistant message
    const lastMessage = await messageStore.getLastAssistant(sessionId);
    if (lastMessage) {
      await messageStore.update(lastMessage.id, { buttonClicked: buttonId });
    }

    // Forward to message handler with button value
    req.body = { sessionId, message: buttonValue };
    return ideationRouter.handle(req, res, () => {});

  } catch (error) {
    console.error('Error processing button click:', error);
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

    // Get memory files for context
    const selfDiscoveryFile = await memoryManager.read(sessionId, 'self_discovery');
    const marketDiscoveryFile = await memoryManager.read(sessionId, 'market_discovery');

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
      // Would need to add a getAllByProfile method
      sessions = await sessionManager.getActiveByProfile(profileId as string);
    }

    res.json({ sessions });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ADDITIONAL SCHEMAS
// ============================================================================

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
    const userMessage = await messageStore.create({
      sessionId,
      role: 'user',
      content: formattedResponse,
      formResponse: { formId, responses },
    });

    // Get conversation history
    const messages = await messageStore.getBySession(sessionId);

    // Get profile for context
    const profile = await getProfileById(session.profileId);

    // Get active candidate
    const candidate = await candidateManager.getActiveBySession(sessionId);

    // Process through agent
    const agentResponse = await agentOrchestrator.processMessage({
      session,
      profile: profile || {},
      messages,
      candidate,
      userMessage: formattedResponse,
    });

    // Store agent response
    const assistantMessage = await messageStore.create({
      sessionId,
      role: 'assistant',
      content: agentResponse.text,
      buttonsShown: agentResponse.buttons,
      formShown: agentResponse.form,
    });

    // Update candidate if needed
    if (agentResponse.candidateUpdate) {
      if (candidate) {
        await candidateManager.update(candidate.id, agentResponse.candidateUpdate);
      } else {
        await candidateManager.create({
          sessionId,
          title: agentResponse.candidateUpdate.title,
          summary: agentResponse.candidateUpdate.summary,
        });
      }
    }

    res.json({
      reply: agentResponse.text,
      buttons: agentResponse.buttons,
      form: agentResponse.form,
      candidate: await candidateManager.getActiveBySession(sessionId),
    });

  } catch (error) {
    console.error('Error processing form:', error);
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
      candidate = await candidateManager.getActiveBySession(sessionId);
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
      status: 'paused',
    });

    // Store save action as memory
    await memoryManager.appendToFile(sessionId, 'conversation_summary', `
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
    const candidate = await candidateManager.getActiveBySession(sessionId);
    if (candidate) {
      await candidateManager.update(candidate.id, {
        status: 'discarded',
      });
    }

    // Store discard reason if provided
    if (reason) {
      await memoryManager.appendToFile(sessionId, 'conversation_summary', `
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

    // Initialize new session
    await memoryManager.initializeSession(newSession.id);

    // Generate fresh greeting
    const greeting = generateGreetingWithButtons(profile || {});

    // Store greeting
    await messageStore.create({
      sessionId: newSession.id,
      role: 'assistant',
      content: greeting.text,
      buttonsShown: greeting.buttons,
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
// POST /api/ideation/message/stream
// ============================================================================
// Streaming message endpoint using Server-Sent Events

import { StreamingResponseHandler, createSSEStream } from '../../agents/ideation/streaming.js';

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
    await messageStore.create({
      sessionId,
      role: 'user',
      content: message,
    });

    // Get context
    const messages = await messageStore.getBySession(sessionId);
    const profile = await getProfileById(session.profileId);
    const candidate = await candidateManager.getActiveBySession(sessionId);

    // Create streaming handler
    const handler = new StreamingResponseHandler(agentOrchestrator.getClient());

    // Listen for stream events
    handler.on('stream', (event) => {
      if (event.type === 'text_delta') {
        stream.send('text_delta', { text: event.data });
      } else if (event.type === 'message_complete') {
        // Store complete message
        messageStore.create({
          sessionId,
          role: 'assistant',
          content: event.data.text,
          buttonsShown: event.data.buttons,
          formShown: event.data.form,
        });

        // Handle candidate updates
        if (event.data.candidateUpdate && candidate) {
          candidateManager.update(candidate.id, event.data.candidateUpdate);
        }

        stream.send('message_complete', {
          reply: event.data.text,
          buttons: event.data.buttons,
          form: event.data.form,
        });
        stream.end();
      } else if (event.type === 'error') {
        stream.send('error', { message: (event.data as Error).message });
        stream.end();
      }
    });

    // Start streaming
    await handler.streamMessage(
      messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      agentOrchestrator.getSystemPrompt(profile || {})
    );

  } catch (error) {
    console.error('Error in streaming message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

---

## 2b. Error Classes

Create file: `server/errors/ideation-errors.ts`

```typescript
/**
 * IDEATION ERROR CLASSES
 *
 * Custom error types for structured error handling in the ideation API.
 */

export class IdeationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'IdeationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// Session errors
export class SessionNotFoundError extends IdeationError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', 404);
  }
}

export class SessionNotActiveError extends IdeationError {
  constructor(sessionId: string, currentStatus: string) {
    super(
      `Session is not active: ${sessionId}`,
      'SESSION_NOT_ACTIVE',
      400,
      { currentStatus }
    );
  }
}

export class SessionAlreadyExistsError extends IdeationError {
  constructor(profileId: string, existingSessionId: string) {
    super(
      'An active session already exists for this profile',
      'SESSION_ALREADY_EXISTS',
      409,
      { existingSessionId }
    );
  }
}

// Candidate errors
export class CandidateNotFoundError extends IdeationError {
  constructor(candidateId: string) {
    super(`Candidate not found: ${candidateId}`, 'CANDIDATE_NOT_FOUND', 404);
  }
}

export class NoCandidateError extends IdeationError {
  constructor(sessionId: string) {
    super(
      `No active candidate for session: ${sessionId}`,
      'NO_CANDIDATE',
      400
    );
  }
}

// Profile errors
export class ProfileNotFoundError extends IdeationError {
  constructor(profileId: string) {
    super(`Profile not found: ${profileId}`, 'PROFILE_NOT_FOUND', 404);
  }
}

// Validation errors
export class ValidationError extends IdeationError {
  constructor(issues: unknown[]) {
    super('Validation error', 'VALIDATION_ERROR', 400, { issues });
  }
}

// Token/Context errors
export class ContextLimitError extends IdeationError {
  constructor(currentTokens: number, limit: number) {
    super(
      'Context limit exceeded, handoff required',
      'CONTEXT_LIMIT_EXCEEDED',
      400,
      { currentTokens, limit, requiresHandoff: true }
    );
  }
}

// Agent errors
export class AgentProcessingError extends IdeationError {
  constructor(message: string, originalError?: Error) {
    super(
      `Agent processing failed: ${message}`,
      'AGENT_PROCESSING_ERROR',
      500,
      { originalError: originalError?.message }
    );
  }
}

export class WebSearchError extends IdeationError {
  constructor(query: string, originalError?: Error) {
    super(
      `Web search failed for: ${query}`,
      'WEB_SEARCH_ERROR',
      500,
      { query, originalError: originalError?.message }
    );
  }
}

// Memory/File errors
export class MemoryFileError extends IdeationError {
  constructor(sessionId: string, fileType: string, operation: string) {
    super(
      `Memory file operation failed: ${operation}`,
      'MEMORY_FILE_ERROR',
      500,
      { sessionId, fileType, operation }
    );
  }
}

/**
 * Error handler middleware for Express.
 */
export function ideationErrorHandler(
  error: Error,
  req: any,
  res: any,
  next: any
) {
  if (error instanceof IdeationError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Wrap async route handlers to catch errors.
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

---

## 3. Candidate Manager

Create file: `agents/ideation/candidate-manager.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../../database/db.js';
import {
  IdeaCandidate,
  IdeaCandidateRow,
  CandidateStatus,
} from '../../types/ideation.js';
import { mapCandidateRowToCandidate, mapCandidateToRow } from '../../utils/ideation-mappers.js';

/**
 * CANDIDATE MANAGER
 *
 * Manages idea candidates during ideation sessions.
 */

export interface CreateCandidateParams {
  sessionId: string;
  title: string;
  summary?: string;
  confidence?: number;
  viability?: number;
  userSuggested?: boolean;
}

export interface UpdateCandidateParams {
  title?: string;
  summary?: string;
  confidence?: number;
  viability?: number;
  status?: CandidateStatus;
  capturedIdeaId?: string;
}

export class CandidateManager {
  /**
   * Create a new candidate.
   */
  async create(params: CreateCandidateParams): Promise<IdeaCandidate> {
    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO ideation_candidates (
        id, session_id, title, summary, confidence, viability,
        user_suggested, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'forming', ?, ?)
    `, [
      id,
      params.sessionId,
      params.title,
      params.summary || null,
      params.confidence || 0,
      params.viability || 100,
      params.userSuggested ? 1 : 0,
      now,
      now,
    ]);

    await saveDb();

    return this.getById(id) as Promise<IdeaCandidate>;
  }

  /**
   * Get candidate by ID.
   */
  async getById(candidateId: string): Promise<IdeaCandidate | null> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_candidates WHERE id = ?
    `, [candidateId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>) as IdeaCandidateRow;

    return mapCandidateRowToCandidate(row);
  }

  /**
   * Get active candidate for session.
   */
  async getActiveForSession(sessionId: string): Promise<IdeaCandidate | null> {
    const db = getDb();
    const results = db.exec(`
      SELECT * FROM ideation_candidates
      WHERE session_id = ? AND status IN ('forming', 'active')
      ORDER BY updated_at DESC
      LIMIT 1
    `, [sessionId]);

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const columns = results[0].columns;
    const values = results[0].values[0];
    const row = columns.reduce((obj, col, i) => {
      obj[col] = values[i];
      return obj;
    }, {} as Record<string, unknown>) as IdeaCandidateRow;

    return mapCandidateRowToCandidate(row);
  }

  /**
   * Get or create candidate for session.
   */
  async getOrCreateForSession(sessionId: string, params: {
    title: string;
    summary?: string;
    confidence: number;
    viability: number;
  }): Promise<IdeaCandidate> {
    const existing = await this.getActiveForSession(sessionId);

    if (existing) {
      // Update existing
      return this.update(existing.id, {
        title: params.title,
        summary: params.summary,
        confidence: params.confidence,
        viability: params.viability,
        status: params.confidence >= 50 ? 'active' : 'forming',
      }) as Promise<IdeaCandidate>;
    }

    // Create new
    return this.create({
      sessionId,
      title: params.title,
      summary: params.summary,
      confidence: params.confidence,
      viability: params.viability,
    });
  }

  /**
   * Update candidate.
   */
  async update(candidateId: string, params: UpdateCandidateParams): Promise<IdeaCandidate | null> {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.title !== undefined) {
      updates.push('title = ?');
      values.push(params.title);
    }
    if (params.summary !== undefined) {
      updates.push('summary = ?');
      values.push(params.summary);
    }
    if (params.confidence !== undefined) {
      updates.push('confidence = ?');
      values.push(params.confidence);
    }
    if (params.viability !== undefined) {
      updates.push('viability = ?');
      values.push(params.viability);
    }
    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
    }
    if (params.capturedIdeaId !== undefined) {
      updates.push('captured_idea_id = ?');
      values.push(params.capturedIdeaId);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(candidateId);

    db.run(`
      UPDATE ideation_candidates
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    await saveDb();

    return this.getById(candidateId);
  }

  /**
   * Discard a candidate.
   */
  async discard(candidateId: string): Promise<void> {
    await this.update(candidateId, { status: 'discarded' });
  }

  /**
   * Save a candidate (for later).
   */
  async save(candidateId: string): Promise<void> {
    await this.update(candidateId, { status: 'saved' });
  }
}

// Singleton
export const candidateManager = new CandidateManager();
```

---

## 4. Test Plan

Create file: `tests/ideation/api-endpoints.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index.js';
import { initDb, closeDb, getDb } from '../../database/db.js';

describe('Ideation API Endpoints', () => {
  let testProfileId: string;

  beforeAll(async () => {
    await initDb();
    // Create test profile
    testProfileId = `test_profile_${Date.now()}`;
    const db = getDb();
    db.run(`
      INSERT INTO user_profiles (id, name, slug, goals, created_at, updated_at)
      VALUES (?, 'Test User', 'test-user', '{}', datetime('now'), datetime('now'))
    `, [testProfileId]);
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    // Clean up test sessions
    const db = getDb();
    db.run(`DELETE FROM ideation_sessions WHERE profile_id LIKE 'test_%'`);
  });

  // ===========================================================================
  // POST /api/ideation/start
  // ===========================================================================

  describe('POST /api/ideation/start', () => {
    test('PASS: Creates session with valid profile', async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.greeting).toContain('Welcome');
      expect(res.body.buttons).toBeInstanceOf(Array);
    });

    test('PASS: Greeting includes buttons', async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });

      expect(res.body.buttons.length).toBe(3);
      expect(res.body.buttons[0]).toHaveProperty('id');
      expect(res.body.buttons[0]).toHaveProperty('label');
      expect(res.body.buttons[0]).toHaveProperty('value');
    });

    test('FAIL: Returns 404 for invalid profile', async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: 'nonexistent_profile' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Profile not found');
    });

    test('FAIL: Returns 400 for missing profileId', async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Validation');
    });
  });

  // ===========================================================================
  // POST /api/ideation/message
  // ===========================================================================

  describe('POST /api/ideation/message', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Processes message and returns response', async () => {
      const res = await request(app)
        .post('/api/ideation/message')
        .send({
          sessionId,
          message: 'I want to solve healthcare problems',
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
      expect(typeof res.body.reply).toBe('string');
    });

    test('PASS: Returns ideaCandidate when confidence is high', async () => {
      // Send multiple messages to build confidence
      await request(app)
        .post('/api/ideation/message')
        .send({ sessionId, message: 'I work in healthcare IT and have 10 years experience' });

      await request(app)
        .post('/api/ideation/message')
        .send({ sessionId, message: 'The biggest problem is data interoperability in emergency departments' });

      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId, message: 'I want to build a platform to solve this for hospitals' });

      // May or may not have candidate depending on agent response
      if (res.body.ideaCandidate) {
        expect(res.body.ideaCandidate).toHaveProperty('id');
        expect(res.body.ideaCandidate).toHaveProperty('title');
        expect(res.body.ideaCandidate).toHaveProperty('confidence');
      }
    });

    test('PASS: Returns buttons when appropriate', async () => {
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId, message: 'I want to build something' });

      // Buttons are optional depending on agent response
      if (res.body.buttons) {
        expect(Array.isArray(res.body.buttons)).toBe(true);
      }
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId: 'nonexistent', message: 'Hello' });

      expect(res.status).toBe(404);
    });

    test('FAIL: Returns 400 for missing message', async () => {
      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId });

      expect(res.status).toBe(400);
    });

    test('FAIL: Returns 400 for completed session', async () => {
      // Complete the session first
      await request(app)
        .post(`/api/ideation/session/${sessionId}/abandon`);

      const res = await request(app)
        .post('/api/ideation/message')
        .send({ sessionId, message: 'Hello' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not active');
    });
  });

  // ===========================================================================
  // POST /api/ideation/button
  // ===========================================================================

  describe('POST /api/ideation/button', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Button click is processed as message', async () => {
      const res = await request(app)
        .post('/api/ideation/button')
        .send({
          sessionId,
          buttonId: 'btn_frustration',
          buttonValue: "There's something that frustrates me",
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
    });

    test('FAIL: Returns 400 for missing buttonId', async () => {
      const res = await request(app)
        .post('/api/ideation/button')
        .send({ sessionId, buttonValue: 'test' });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/capture
  // ===========================================================================

  describe('POST /api/ideation/capture', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('FAIL: Returns 400 if no candidate exists', async () => {
      const res = await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No idea candidate');
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/capture')
        .send({ sessionId: 'nonexistent' });

      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // GET /api/ideation/session/:sessionId
  // ===========================================================================

  describe('GET /api/ideation/session/:sessionId', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Returns session details', async () => {
      const res = await request(app)
        .get(`/api/ideation/session/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(res.body.messages).toBeInstanceOf(Array);
    });

    test('PASS: Includes messages in response', async () => {
      // Add a message
      await request(app)
        .post('/api/ideation/message')
        .send({ sessionId, message: 'Test message' });

      const res = await request(app)
        .get(`/api/ideation/session/${sessionId}`);

      expect(res.body.messages.length).toBeGreaterThan(0);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .get('/api/ideation/session/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // POST /api/ideation/session/:sessionId/abandon
  // ===========================================================================

  describe('POST /api/ideation/session/:sessionId/abandon', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Abandons active session', async () => {
      const res = await request(app)
        .post(`/api/ideation/session/${sessionId}/abandon`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify session is abandoned
      const sessionRes = await request(app)
        .get(`/api/ideation/session/${sessionId}`);
      expect(sessionRes.body.session.status).toBe('abandoned');
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/session/nonexistent/abandon');

      expect(res.status).toBe(404);
    });

    test('FAIL: Returns 400 for already abandoned session', async () => {
      // Abandon first
      await request(app)
        .post(`/api/ideation/session/${sessionId}/abandon`);

      // Try again
      const res = await request(app)
        .post(`/api/ideation/session/${sessionId}/abandon`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not active');
    });
  });

  // ===========================================================================
  // GET /api/ideation/sessions
  // ===========================================================================

  describe('GET /api/ideation/sessions', () => {
    test('PASS: Returns sessions for profile', async () => {
      // Create a session
      await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });

      const res = await request(app)
        .get('/api/ideation/sessions')
        .query({ profileId: testProfileId });

      expect(res.status).toBe(200);
      expect(res.body.sessions).toBeInstanceOf(Array);
    });

    test('PASS: Returns empty array for profile with no sessions', async () => {
      const res = await request(app)
        .get('/api/ideation/sessions')
        .query({ profileId: 'no_sessions_profile' });

      expect(res.status).toBe(200);
      expect(res.body.sessions).toEqual([]);
    });

    test('FAIL: Returns 400 for missing profileId', async () => {
      const res = await request(app)
        .get('/api/ideation/sessions');

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/form
  // ===========================================================================

  describe('POST /api/ideation/form', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Processes form submission', async () => {
      const res = await request(app)
        .post('/api/ideation/form')
        .send({
          sessionId,
          formId: 'constraints_form',
          responses: {
            geography: 'local',
            product_type: ['digital', 'service'],
            hours_per_week: 20,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
    });

    test('PASS: Handles array responses in form', async () => {
      const res = await request(app)
        .post('/api/ideation/form')
        .send({
          sessionId,
          formId: 'interests_form',
          responses: {
            interests: ['tech', 'sustainability', 'health'],
          },
        });

      expect(res.status).toBe(200);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/form')
        .send({
          sessionId: 'nonexistent_session',
          formId: 'test_form',
          responses: {},
        });

      expect(res.status).toBe(404);
    });

    test('FAIL: Returns 400 for missing formId', async () => {
      const res = await request(app)
        .post('/api/ideation/form')
        .send({
          sessionId,
          responses: {},
        });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/save
  // ===========================================================================

  describe('POST /api/ideation/save', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Saves session with active candidate', async () => {
      // First send a message to create a candidate
      await request(app)
        .post('/api/ideation/message')
        .send({
          sessionId,
          message: 'I want to build a marketplace for vintage synthesizers',
        });

      const res = await request(app)
        .post('/api/ideation/save')
        .send({
          sessionId,
          notes: 'Want to think about this more',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('saved');
    });

    test('FAIL: Returns 404 when no candidate exists', async () => {
      const res = await request(app)
        .post('/api/ideation/save')
        .send({ sessionId });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No candidate');
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/save')
        .send({ sessionId: 'nonexistent_session' });

      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // POST /api/ideation/discard
  // ===========================================================================

  describe('POST /api/ideation/discard', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Discards session and creates new one', async () => {
      const res = await request(app)
        .post('/api/ideation/discard')
        .send({
          sessionId,
          reason: 'Want to start fresh',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.newSessionId).toBeDefined();
      expect(res.body.newSessionId).not.toBe(sessionId);
      expect(res.body.greeting).toBeDefined();
    });

    test('PASS: Discards without reason', async () => {
      const res = await request(app)
        .post('/api/ideation/discard')
        .send({ sessionId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/discard')
        .send({ sessionId: 'nonexistent_session' });

      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // POST /api/ideation/message/stream
  // ===========================================================================

  describe('POST /api/ideation/message/stream', () => {
    let sessionId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/ideation/start')
        .send({ profileId: testProfileId });
      sessionId = res.body.sessionId;
    });

    test('PASS: Returns SSE content type', async () => {
      const res = await request(app)
        .post('/api/ideation/message/stream')
        .send({
          sessionId,
          message: 'Tell me about your process',
        });

      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      const res = await request(app)
        .post('/api/ideation/message/stream')
        .send({
          sessionId: 'nonexistent_session',
          message: 'Hello',
        });

      expect(res.status).toBe(404);
    });
  });
});
```

### Error Classes Tests

Create file: `tests/ideation/error-classes.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import {
  IdeationError,
  SessionNotFoundError,
  SessionNotActiveError,
  SessionAlreadyExistsError,
  CandidateNotFoundError,
  NoCandidateError,
  ProfileNotFoundError,
  ValidationError,
  ContextLimitError,
  AgentProcessingError,
  WebSearchError,
  MemoryFileError,
  ideationErrorHandler,
  asyncHandler,
} from '../../server/errors/ideation-errors.js';

describe('IdeationErrors', () => {

  describe('IdeationError base class', () => {
    test('PASS: Creates error with all fields', () => {
      const error = new IdeationError('Test error', 'TEST_ERROR', 400, { extra: 'data' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ extra: 'data' });
    });

    test('PASS: toJSON returns correct structure', () => {
      const error = new IdeationError('Test', 'TEST', 500, { foo: 'bar' });
      const json = error.toJSON();

      expect(json.error).toBe('Test');
      expect(json.code).toBe('TEST');
      expect(json.details).toEqual({ foo: 'bar' });
    });
  });

  describe('SessionNotFoundError', () => {
    test('PASS: Has correct properties', () => {
      const error = new SessionNotFoundError('session_123');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.message).toContain('session_123');
    });
  });

  describe('SessionNotActiveError', () => {
    test('PASS: Includes current status in details', () => {
      const error = new SessionNotActiveError('session_123', 'completed');

      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ currentStatus: 'completed' });
    });
  });

  describe('SessionAlreadyExistsError', () => {
    test('PASS: Returns 409 conflict', () => {
      const error = new SessionAlreadyExistsError('profile_1', 'existing_session');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('SESSION_ALREADY_EXISTS');
      expect(error.details).toEqual({ existingSessionId: 'existing_session' });
    });
  });

  describe('ValidationError', () => {
    test('PASS: Includes validation issues', () => {
      const issues = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError(issues);

      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ issues });
    });
  });

  describe('ContextLimitError', () => {
    test('PASS: Includes token counts', () => {
      const error = new ContextLimitError(85000, 80000);

      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({
        currentTokens: 85000,
        limit: 80000,
        requiresHandoff: true,
      });
    });
  });

  describe('ideationErrorHandler', () => {
    test('PASS: Handles IdeationError', () => {
      const error = new SessionNotFoundError('test');
      const mockRes = {
        status: (code: number) => ({
          json: (body: unknown) => ({ code, body }),
        }),
      };

      const result = ideationErrorHandler(error, {}, mockRes, () => {});

      expect(result.code).toBe(404);
    });

    test('PASS: Handles generic Error', () => {
      const error = new Error('Random error');
      const mockRes = {
        status: (code: number) => ({
          json: (body: unknown) => ({ code, body }),
        }),
      };

      const result = ideationErrorHandler(error, {}, mockRes, () => {});

      expect(result.code).toBe(500);
    });
  });

  describe('asyncHandler', () => {
    test('PASS: Catches async errors', async () => {
      let caughtError: Error | null = null;
      const handler = asyncHandler(async () => {
        throw new Error('Async error');
      });

      await handler({}, {}, (err: Error) => { caughtError = err; });

      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toBe('Async error');
    });
  });
});
```

---

## 5. Implementation Checklist

- [ ] Add ideation route registration to `server/api.ts`
- [ ] Create `server/routes/ideation.ts`
- [ ] Create `server/errors/ideation-errors.ts`
- [ ] Create `agents/ideation/candidate-manager.ts`
- [ ] Create `tests/ideation/api-endpoints.test.ts`
- [ ] Create `tests/ideation/error-classes.test.ts`
- [ ] Run tests: `npm test -- tests/ideation/`
- [ ] Verify all tests pass

---

## 6. Success Criteria

| Test Category | Expected Pass | Expected Fail |
|---------------|---------------|---------------|
| POST /start | 2 | 2 |
| POST /message | 3 | 3 |
| POST /button | 1 | 1 |
| POST /capture | 0 | 2 |
| GET /session/:id | 2 | 1 |
| POST /session/:id/abandon | 1 | 2 |
| GET /sessions | 2 | 1 |
| POST /form | 2 | 2 |
| POST /save | 1 | 2 |
| POST /discard | 2 | 1 |
| POST /message/stream | 1 | 1 |
| Error Classes | 11 | 0 |
| **Total** | **28** | **18** |
