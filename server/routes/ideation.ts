import { Router, Request, Response, NextFunction } from 'express';
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
import { performWebSearch, SearchPurpose } from '../../agents/ideation/web-search-service.js';
import { artifactStore } from '../../agents/ideation/artifact-store.js';
import { subAgentStore } from '../../agents/ideation/subagent-store.js';
import { editArtifact, detectArtifactEditRequest } from '../../agents/ideation/artifact-editor.js';
import { emitSessionEvent, emitSubAgentSpawn, emitSubAgentStatus, emitSubAgentResult } from '../websocket.js';
import { subAgentManager, SubAgentTask as ManagerSubAgentTask } from '../../agents/ideation/sub-agent-manager.js';

/**
 * Creates a sub-agent status callback with proper deduplication.
 * Tracks which task+status combinations have been emitted to avoid duplicates
 * when onStatusChange receives ALL tasks on every status change.
 */
function createSubAgentStatusCallback(
  sessionId: string,
  logPrefix: string = '[SubAgent]'
): (tasks: ManagerSubAgentTask[]) => void {
  // Track emitted statuses: "taskId:status"
  const emittedStatuses = new Set<string>();
  // Track saved artifacts by task ID
  const savedArtifacts = new Set<string>();

  return (tasks: ManagerSubAgentTask[]) => {
    for (const task of tasks) {
      const statusKey = `${task.id}:${task.status}`;

      // Skip if we've already processed this task+status combination
      if (emittedStatuses.has(statusKey)) {
        continue;
      }

      console.log(`${logPrefix} Task ${task.id} status: ${task.status}`);
      emittedStatuses.add(statusKey);

      // Emit status update
      if (task.status === 'running' || task.status === 'completed' || task.status === 'failed') {
        emitSubAgentStatus(sessionId, task.id, task.status, task.error);

        // Persist status to database
        subAgentStore.updateStatus(task.id, task.status as 'running' | 'completed' | 'failed', {
          result: task.result,
          error: task.error,
        }).catch(err => {
          console.error(`${logPrefix} Failed to persist sub-agent status: ${err}`);
        });
      }

      // Save artifact only once when completed
      if (task.status === 'completed' && task.result && !savedArtifacts.has(task.id)) {
        savedArtifacts.add(task.id);
        emitSubAgentResult(sessionId, task.id, task.result);

        // Save result as artifact
        const artifactId = `subagent_${task.id}`;
        artifactStore.save({
          id: artifactId,
          sessionId,
          type: 'markdown',
          title: task.label.replace('...', ''),
          content: task.result,
          status: 'ready',
        }).then(() => {
          console.log(`${logPrefix} Saved artifact: ${artifactId}`);
          // Notify frontend about new artifact
          emitSessionEvent('artifact:created', sessionId, {
            id: artifactId,
            type: 'markdown',
            title: task.label.replace('...', ''),
            content: task.result,
            status: 'ready',
            createdAt: new Date().toISOString(),
          });
        }).catch(err => {
          console.error(`${logPrefix} Failed to save artifact: ${err}`);
        });
      }
    }
  };
}

export const ideationRouter = Router();

// ============================================================================
// REQUEST TIMEOUT MIDDLEWARE
// ============================================================================
// Prevents browser timeout by returning an error before the default 2-minute
// browser fetch timeout. Also configures response for long-running requests.

const REQUEST_TIMEOUT_MS = 400000; // 400 seconds - allows for 360s Claude CLI timeout

const timeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set server timeout higher than our middleware timeout
  req.setTimeout(REQUEST_TIMEOUT_MS + 30000);
  res.setTimeout(REQUEST_TIMEOUT_MS + 30000);

  // Track if response has been sent
  let responded = false;

  const timeout = setTimeout(() => {
    if (!responded && !res.headersSent) {
      responded = true;
      console.error(`[Timeout] Request to ${req.path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
      res.status(504).json({
        error: 'Request timed out',
        message: 'The request took too long to process. Please try again with a simpler request.',
      });
    }
  }, REQUEST_TIMEOUT_MS);

  // Clear timeout when response finishes
  res.on('finish', () => {
    responded = true;
    clearTimeout(timeout);
  });

  res.on('close', () => {
    responded = true;
    clearTimeout(timeout);
  });

  next();
};

// Apply timeout to all ideation routes
ideationRouter.use(timeoutMiddleware);

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
  buttonLabel: z.string().optional(), // Display label for the button
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

const EditMessageSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  messageId: z.string().min(1, 'messageId is required'),
  newContent: z.string().min(1, 'newContent is required'),
});

const WebSearchSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  queries: z.array(z.string()).min(1, 'At least one query is required'),
  context: z.string().optional(),
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
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reactivate abandoned sessions when user sends a message
    if (session.status === 'abandoned') {
      await sessionManager.update(sessionId, { status: 'active' });
      session = await sessionManager.load(sessionId);
    }

    if (session!.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Load profile
    const profile = await getProfileById(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check for artifact edit request - delegate to sub-agent for async processing
    console.log(`[Message] Checking for artifact edit in: "${message.substring(0, 100)}..."`);
    const artifactEditRequest = detectArtifactEditRequest(message);
    console.log(`[Message] detectArtifactEditRequest result:`, artifactEditRequest);
    if (artifactEditRequest) {
      console.log(`[Message] Detected artifact edit request for ${artifactEditRequest.artifactId}`);

      // Verify artifact exists
      const artifacts = await artifactStore.getBySession(sessionId);
      const artifact = artifacts.find(a => a.id === artifactEditRequest.artifactId);

      if (artifact) {
        // Store user message
        const userMsg = await messageStore.add({
          sessionId,
          role: 'user',
          content: message,
          tokenCount: Math.ceil(message.length / 4),
        });

        // Store immediate response
        const assistantMsg = await messageStore.add({
          sessionId,
          role: 'assistant',
          content: `Updating the artifact "${artifact.title}" now...`,
          tokenCount: 20,
        });

        // Notify clients that edit is starting (include messageId for later update)
        emitSessionEvent('artifact:updating', sessionId, {
          artifactId: artifactEditRequest.artifactId,
          messageId: assistantMsg.id,
          summary: 'Updating artifact...',
        });

        // Trigger async edit (don't await)
        editArtifact({
          sessionId,
          artifactId: artifactEditRequest.artifactId,
          editRequest: artifactEditRequest.editRequest,
        })
          .then((result) => {
            if (result.success) {
              console.log(`[Message] Artifact edit completed for ${artifactEditRequest.artifactId}`);
              emitSessionEvent('artifact:updated', sessionId, {
                artifactId: result.artifactId,
                messageId: assistantMsg.id,
                content: result.content,
                summary: result.summary,
              });
              // Update the message in the database too
              messageStore.update(assistantMsg.id, {
                content: `Updated artifact "${artifact.title}". ${result.summary || ''}`,
              }).catch(err => console.error('[Message] Failed to update message:', err));
            } else {
              console.error(`[Message] Artifact edit failed: ${result.error}`);
              emitSessionEvent('artifact:error', sessionId, {
                artifactId: artifactEditRequest.artifactId,
                messageId: assistantMsg.id,
                error: result.error,
              });
            }
          })
          .catch((error) => {
            console.error(`[Message] Artifact edit error:`, error);
            emitSessionEvent('artifact:error', sessionId, {
              artifactId: artifactEditRequest.artifactId,
              messageId: assistantMsg.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });

        // Return immediately
        return res.json({
          userMessageId: userMsg.id,
          messageId: assistantMsg.id,
          reply: `Updating the artifact "${artifact.title}" now...`,
          buttons: null,
          formFields: null,
          candidateUpdate: null,
          confidence: 0,
          viability: 100,
          risks: [],
          intervention: null,
          handoffOccurred: false,
          tokenUsage: { total: 0, limit: 100000, percentUsed: 0, shouldHandoff: false },
          webSearchQueries: null,
          artifact: null,
          artifactUpdate: null,
          artifactEditPending: {
            artifactId: artifactEditRequest.artifactId,
            status: 'pending',
          },
        });
      } else {
        console.warn(`[Message] Artifact ${artifactEditRequest.artifactId} not found for edit`);
        // Fall through to normal processing - agent will handle the error
      }
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

    // Build artifact response if present and save to database
    let artifactResponse = null;
    if (response.artifact) {
      const artifactId = `text_${Date.now()}`;
      artifactResponse = {
        id: artifactId,
        type: response.artifact.type,
        title: response.artifact.title,
        content: response.artifact.content,
        language: response.artifact.language,
        status: 'ready',
        createdAt: new Date().toISOString(),
      };

      // Save artifact to database for persistence
      console.log(`[Routes/Message] Saving new artifact ${artifactId} to database`);
      await artifactStore.save({
        id: artifactId,
        sessionId,
        type: response.artifact.type,
        title: response.artifact.title,
        content: response.artifact.content,
        language: response.artifact.language,
        status: 'ready',
      });
      console.log(`[Routes/Message] Artifact ${artifactId} saved successfully`);
    }

    // Handle artifact update if present
    let artifactUpdateResponse = null;
    console.log(`[Routes/Message] Checking artifactUpdate:`, response.artifactUpdate ? `id=${response.artifactUpdate.id}, hasContent=${!!response.artifactUpdate.content}` : 'null');
    if (response.artifactUpdate) {
      const { id, content, title } = response.artifactUpdate;
      console.log(`[ArtifactUpdate] Processing artifact ${id}, content length: ${content?.length || 0}`);

      // Validate content is provided
      if (!content) {
        console.error(`[ArtifactUpdate] ERROR: No content provided for artifact ${id}! Agent failed to include updated content.`);
      } else {
        // Get existing artifact to preserve type/title
        const existingArtifacts = await artifactStore.getBySession(sessionId);
        const existingArtifact = existingArtifacts.find(a => a.id === id);

        if (existingArtifact) {
          // Update the artifact in the database, preserving original type
          await artifactStore.save({
            id,
            sessionId,
            type: existingArtifact.type,
            title: title || existingArtifact.title,
            content,
            status: 'ready',
          });
          artifactUpdateResponse = {
            id,
            content,
            title: title || existingArtifact.title,
            updatedAt: new Date().toISOString(),
          };
          console.log(`[ArtifactUpdate] Successfully updated artifact ${id} with ${content.length} chars`);
        } else {
          console.error(`[ArtifactUpdate] Artifact ${id} not found in session ${sessionId}`);
        }
      }
    }

    // Return response
    res.json({
      userMessageId: response.userMessageId,
      messageId: response.assistantMessageId,
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
      webSearchQueries: response.webSearchQueries || null, // Queries to execute async
      artifact: artifactResponse, // Visual artifact from agent
      artifactUpdate: artifactUpdateResponse, // Updated artifact from agent
      // Quick acknowledgment fields for sub-agent execution
      isQuickAck: response.isQuickAck,
      subAgentTasks: response.subAgentTasks || null,
    });

    // If this was a quick-ack response with sub-agent tasks, execute them asynchronously
    if (response.isQuickAck && response.subAgentTasks && response.subAgentTasks.length > 0) {
      console.log(`[Routes/Message] Quick-ack detected, spawning ${response.subAgentTasks.length} sub-agents`);

      // Build context for sub-agents from memory files
      const memoryFiles = await memoryManager.getAll(sessionId);
      const contextParts: string[] = [];

      // Add candidate info
      const candidate = await candidateManager.getActiveForSession(sessionId);
      if (candidate) {
        contextParts.push(`## Current Idea: ${candidate.title}`);
        if (candidate.summary) {
          contextParts.push(`Summary: ${candidate.summary}`);
        }
      }

      // Add memory file context
      for (const file of memoryFiles) {
        contextParts.push(`\n## ${file.fileType}\n${file.content}`);
      }

      const context = contextParts.join('\n');

      // Clear completed sub-agents from database before spawning new ones
      await subAgentStore.clearCompleted(sessionId);

      // Emit initial spawn events for UI and persist to database
      for (const task of response.subAgentTasks) {
        emitSubAgentSpawn(sessionId, task.id, task.type, task.label);
        // Save initial state to database
        await subAgentStore.save({
          id: task.id,
          sessionId,
          type: task.type,
          name: task.label,
          status: 'spawning',
        });
      }

      // Delay sub-agent execution to ensure HTTP response is flushed first
      // This prevents race condition where WebSocket 'running' arrives before frontend creates agents
      setTimeout(() => {
        subAgentManager.spawnAgents(
          response.subAgentTasks.map(t => ({
            id: t.id,
            type: t.type,
            label: t.label,
            prompt: t.prompt,
          })),
          context,
          // Use deduplicated callback to avoid multiple emissions per task
          createSubAgentStatusCallback(sessionId, '[SubAgent]')
        ).then((completedTasks) => {
          console.log(`[Routes/Message] All ${completedTasks.length} sub-agents completed`);
        }).catch((error) => {
          console.error(`[Routes/Message] Sub-agent execution error:`, error);
        });
      }, 100); // 100ms delay
    }

  } catch (error) {
    console.error('Error processing ideation message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/message/edit
// ============================================================================
// Edits a user message by deleting it and all subsequent messages,
// then processing the new content as a fresh message

ideationRouter.post('/message/edit', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = EditMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, messageId, newContent } = parseResult.data;

    // Load session
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reactivate abandoned sessions when user edits a message
    if (session.status === 'abandoned') {
      await sessionManager.update(sessionId, { status: 'active' });
      session = await sessionManager.load(sessionId);
    }

    if (session!.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Verify the message exists and belongs to this session
    const messageToEdit = await messageStore.get(messageId);
    if (!messageToEdit) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (messageToEdit.sessionId !== sessionId) {
      return res.status(400).json({ error: 'Message does not belong to this session' });
    }
    if (messageToEdit.role !== 'user') {
      return res.status(400).json({ error: 'Only user messages can be edited' });
    }

    // Delete the message and all messages after it
    const deletedCount = await messageStore.deleteFromMessage(sessionId, messageId);

    // Reset memory state so it can be recalculated from remaining messages
    await memoryManager.resetState(sessionId);

    // Load profile
    const profile = await getProfileById(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check for artifact edit request - delegate to sub-agent for async processing
    console.log(`[MessageEdit] Checking for artifact edit in: "${newContent.substring(0, 100)}..."`);
    const artifactEditRequest = detectArtifactEditRequest(newContent);
    console.log(`[MessageEdit] detectArtifactEditRequest result:`, artifactEditRequest);
    if (artifactEditRequest) {
      console.log(`[MessageEdit] Detected artifact edit request for ${artifactEditRequest.artifactId}`);

      // Verify artifact exists
      const artifacts = await artifactStore.getBySession(sessionId);
      const artifact = artifacts.find(a => a.id === artifactEditRequest.artifactId);

      if (artifact) {
        // Store user message
        const userMsg = await messageStore.add({
          sessionId,
          role: 'user',
          content: newContent,
          tokenCount: Math.ceil(newContent.length / 4),
        });

        // Store immediate response
        const assistantMsg = await messageStore.add({
          sessionId,
          role: 'assistant',
          content: `Updating the artifact "${artifact.title}" now...`,
          tokenCount: 20,
        });

        // Notify clients that edit is starting (include messageId for later update)
        emitSessionEvent('artifact:updating', sessionId, {
          artifactId: artifactEditRequest.artifactId,
          messageId: assistantMsg.id,
          summary: 'Updating artifact...',
        });

        // Trigger async edit (don't await)
        editArtifact({
          sessionId,
          artifactId: artifactEditRequest.artifactId,
          editRequest: artifactEditRequest.editRequest,
        })
          .then((result) => {
            if (result.success) {
              console.log(`[MessageEdit] Artifact edit completed for ${artifactEditRequest.artifactId}`);
              emitSessionEvent('artifact:updated', sessionId, {
                artifactId: result.artifactId,
                messageId: assistantMsg.id,
                content: result.content,
                summary: result.summary,
              });
              // Update the message in the database too
              messageStore.update(assistantMsg.id, {
                content: `Updated artifact "${artifact.title}". ${result.summary || ''}`,
              }).catch(err => console.error('[MessageEdit] Failed to update message:', err));
            } else {
              console.error(`[MessageEdit] Artifact edit failed: ${result.error}`);
              emitSessionEvent('artifact:error', sessionId, {
                artifactId: artifactEditRequest.artifactId,
                messageId: assistantMsg.id,
                error: result.error,
              });
            }
          })
          .catch((error) => {
            console.error(`[MessageEdit] Artifact edit error:`, error);
            emitSessionEvent('artifact:error', sessionId, {
              artifactId: artifactEditRequest.artifactId,
              messageId: assistantMsg.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });

        // Return immediately
        return res.json({
          userMessageId: userMsg.id,
          messageId: assistantMsg.id,
          reply: `Updating the artifact "${artifact.title}" now...`,
          buttons: null,
          formFields: null,
          candidateUpdate: null,
          confidence: 0,
          viability: 100,
          risks: [],
          intervention: null,
          handoffOccurred: false,
          tokenUsage: { total: 0, limit: 100000, percentUsed: 0, shouldHandoff: false },
          webSearchQueries: null,
          artifact: null,
          artifactUpdate: null,
          artifactEditPending: {
            artifactId: artifactEditRequest.artifactId,
            status: 'pending',
          },
        });
      } else {
        console.warn(`[MessageEdit] Artifact ${artifactEditRequest.artifactId} not found for edit`);
        // Fall through to normal processing - agent will handle the error
      }
    }

    // Process the new message through orchestrator (same as /message endpoint)
    const response = await agentOrchestrator.processMessage(session, newContent, profile as Record<string, unknown>);

    // Update session
    const messages = await messageStore.getBySession(sessionId);
    const totalTokens = await messageStore.getTotalTokens(sessionId);
    await sessionManager.update(sessionId, {
      messageCount: messages.length,
      tokenCount: totalTokens,
    });

    // Get or update candidate - always update existing candidate with new scores after edit
    let candidateData = null;
    const existingCandidate = await candidateManager.getActiveForSession(sessionId);

    if (existingCandidate) {
      // Update existing candidate with recalculated scores
      await candidateManager.update(existingCandidate.id, {
        confidence: response.confidence,
        viability: response.viability,
        ...(response.candidateUpdate ? {
          title: response.candidateUpdate.title,
          summary: response.candidateUpdate.summary,
        } : {}),
      });
      candidateData = {
        ...existingCandidate,
        confidence: response.confidence,
        viability: response.viability,
        ...(response.candidateUpdate || {}),
      };
    } else if (response.confidence >= 30 && response.candidateUpdate) {
      // Create new candidate if confidence is high enough
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
    const TOKEN_LIMIT = 100000;
    const percentUsed = Math.min((totalTokens / TOKEN_LIMIT) * 100, 100);
    const shouldHandoff = percentUsed >= 80;

    // Build artifact response if present and save to database
    let artifactResponse = null;
    if (response.artifact) {
      const artifactId = `text_${Date.now()}`;
      artifactResponse = {
        id: artifactId,
        type: response.artifact.type,
        title: response.artifact.title,
        content: response.artifact.content,
        language: response.artifact.language,
        status: 'ready',
        createdAt: new Date().toISOString(),
      };

      // Save artifact to database for persistence
      console.log(`[Routes/MessageEdit] Saving new artifact ${artifactId} to database`);
      await artifactStore.save({
        id: artifactId,
        sessionId,
        type: response.artifact.type,
        title: response.artifact.title,
        content: response.artifact.content,
        language: response.artifact.language,
        status: 'ready',
      });
      console.log(`[Routes/MessageEdit] Artifact ${artifactId} saved successfully`);
    }

    // Handle artifact update if present
    let artifactUpdateResponse = null;
    if (response.artifactUpdate) {
      const { id, content, title } = response.artifactUpdate;
      console.log(`[Routes/MessageEdit] Processing artifact update ${id}`);

      if (content) {
        const existingArtifacts = await artifactStore.getBySession(sessionId);
        const existingArtifact = existingArtifacts.find(a => a.id === id);

        if (existingArtifact) {
          await artifactStore.save({
            id,
            sessionId,
            type: existingArtifact.type,
            title: title || existingArtifact.title,
            content,
            status: 'ready',
          });
          artifactUpdateResponse = {
            id,
            content,
            title: title || existingArtifact.title,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }

    // Return response
    res.json({
      deletedCount,
      userMessageId: response.userMessageId,
      messageId: response.assistantMessageId,
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
      webSearchResults: response.webSearchResults || null,
      artifact: artifactResponse,
      artifactUpdate: artifactUpdateResponse,
      // Quick acknowledgment fields for sub-agent execution
      isQuickAck: response.isQuickAck,
      subAgentTasks: response.subAgentTasks || null,
    });

    // If this was a quick-ack response with sub-agent tasks, execute them asynchronously
    if (response.isQuickAck && response.subAgentTasks && response.subAgentTasks.length > 0) {
      console.log(`[Routes/MessageEdit] Quick-ack detected, spawning ${response.subAgentTasks.length} sub-agents`);

      // Build context for sub-agents from memory files
      const memoryFiles = await memoryManager.getAll(sessionId);
      const contextParts: string[] = [];

      if (memoryFiles.selfDiscovery) {
        contextParts.push(`## Self Discovery\n${JSON.stringify(memoryFiles.selfDiscovery, null, 2)}`);
      }
      if (memoryFiles.marketDiscovery) {
        contextParts.push(`## Market Discovery\n${JSON.stringify(memoryFiles.marketDiscovery, null, 2)}`);
      }
      if (memoryFiles.narrowing) {
        contextParts.push(`## Narrowing State\n${JSON.stringify(memoryFiles.narrowing, null, 2)}`);
      }
      if (candidateData) {
        contextParts.push(`## Current Idea Candidate\nTitle: ${candidateData.title}\nSummary: ${candidateData.summary || 'Not yet defined'}`);
      }

      const context = contextParts.join('\n');

      // Clear completed sub-agents from database before spawning new ones
      await subAgentStore.clearCompleted(sessionId);

      // Emit initial spawn events for UI and persist to database
      for (const task of response.subAgentTasks) {
        emitSubAgentSpawn(sessionId, task.id, task.type, task.label);
        // Save initial state to database
        await subAgentStore.save({
          id: task.id,
          sessionId,
          type: task.type,
          name: task.label,
          status: 'spawning',
        });
      }

      // Delay sub-agent execution to ensure HTTP response is flushed first
      // This prevents race condition where WebSocket 'running' arrives before frontend creates agents
      setTimeout(() => {
        subAgentManager.spawnAgents(
          response.subAgentTasks.map(t => ({
            id: t.id,
            type: t.type,
            label: t.label,
            prompt: t.prompt,
          })),
          context,
          // Use deduplicated callback to avoid multiple emissions per task
          createSubAgentStatusCallback(sessionId, '[SubAgent/Edit]')
        ).then(completedTasks => {
          console.log(`[Routes/MessageEdit] All ${completedTasks.length} sub-agents completed`);
        }).catch(err => {
          console.error(`[Routes/MessageEdit] Sub-agent execution error:`, err);
        });
      }, 100); // 100ms delay
    }

  } catch (error) {
    console.error('Error editing ideation message:', error);
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

    const { sessionId, buttonId, buttonValue, buttonLabel } = parseResult.data;

    // Load session
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reactivate abandoned sessions when user clicks a button
    if (session.status === 'abandoned') {
      await sessionManager.update(sessionId, { status: 'active' });
      session = await sessionManager.load(sessionId);
    }

    if (session!.status !== 'active') {
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

    // Use label for display, value for processing
    const displayMessage = buttonLabel || buttonValue;

    // Process button value as message through orchestrator
    // Pass displayMessage so it gets stored correctly, but the LLM sees the semantic value
    const response = await agentOrchestrator.processMessage(session, buttonValue, profile as Record<string, unknown>, displayMessage);

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
      userMessageId: response.userMessageId,
      messageId: response.assistantMessageId,
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
      webSearchQueries: response.webSearchQueries || null, // Queries to execute async
      // Quick acknowledgment fields for sub-agent execution
      isQuickAck: response.isQuickAck,
      subAgentTasks: response.subAgentTasks || null,
    });

    // If this was a quick-ack response with sub-agent tasks, execute them asynchronously
    if (response.isQuickAck && response.subAgentTasks && response.subAgentTasks.length > 0) {
      console.log(`[Routes/Button] Quick-ack detected, spawning ${response.subAgentTasks.length} sub-agents`);

      // Build context for sub-agents from memory files
      const memoryFiles = await memoryManager.getAll(sessionId);
      const contextParts: string[] = [];

      // Add candidate info
      const candidate = await candidateManager.getActiveForSession(sessionId);
      if (candidate) {
        contextParts.push(`## Current Idea: ${candidate.title}`);
        if (candidate.summary) {
          contextParts.push(`Summary: ${candidate.summary}`);
        }
      }

      // Add memory file context
      for (const file of memoryFiles) {
        contextParts.push(`\n## ${file.fileType}\n${file.content}`);
      }

      const context = contextParts.join('\n');

      // Clear completed sub-agents from database before spawning new ones
      await subAgentStore.clearCompleted(sessionId);

      // Emit initial spawn events for UI and persist to database
      for (const task of response.subAgentTasks) {
        emitSubAgentSpawn(sessionId, task.id, task.type, task.label);
        // Save initial state to database
        await subAgentStore.save({
          id: task.id,
          sessionId,
          type: task.type,
          name: task.label,
          status: 'spawning',
        });
      }

      // Delay sub-agent execution to ensure HTTP response is flushed first
      // This prevents race condition where WebSocket 'running' arrives before frontend creates agents
      setTimeout(() => {
        subAgentManager.spawnAgents(
          response.subAgentTasks.map(t => ({
            id: t.id,
            type: t.type,
            label: t.label,
            prompt: t.prompt,
          })),
          context,
          // Use deduplicated callback to avoid multiple emissions per task
          createSubAgentStatusCallback(sessionId, '[SubAgent/Button]')
        ).catch(err => {
          console.error(`[Routes/Button] Sub-agent execution failed:`, err);
        });
      }, 100); // 100ms delay
    }

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
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reactivate abandoned sessions when user submits a form
    if (session.status === 'abandoned') {
      await sessionManager.update(sessionId, { status: 'active' });
      session = await sessionManager.load(sessionId);
    }

    // Check session state
    if (session!.status !== 'active') {
      return res.status(400).json({
        error: 'Session is not active',
        status: session!.status,
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

    // Keep session active (user can resume it later)
    // Note: Session remains 'active' since 'paused' is not in the DB schema
    // The candidate's 'saved' status indicates this session has a saved idea

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
// POST /api/ideation/candidate/update
// ============================================================================
// Updates candidate details (title, summary)

const UpdateCandidateSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  title: z.string().optional(),
  summary: z.string().optional(),
});

ideationRouter.post('/candidate/update', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = UpdateCandidateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, title, summary } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get active candidate
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (!candidate) {
      return res.status(404).json({ error: 'No active candidate for this session' });
    }

    // Build update object
    const updates: { title?: string; summary?: string } = {};
    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;

    // Update candidate
    await candidateManager.update(candidate.id, updates);

    // Get updated candidate
    const updatedCandidate = await candidateManager.getById(candidate.id);

    res.json({
      success: true,
      candidate: updatedCandidate,
    });

  } catch (error) {
    console.error('Error updating candidate:', error);
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

    // Log artifact content lengths for debugging
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
// List sessions for a profile (with optional status filter)

ideationRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { profileId, status, includeAll } = req.query;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    // Get all sessions for the profile
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

    // Get candidate info for each session
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

    // Filter by status if requested
    let filteredSessions = sessionsWithDetails;
    if (status && status !== 'all') {
      filteredSessions = sessionsWithDetails.filter(s => s.status === status);
    } else if (!includeAll) {
      // By default, only return active and completed sessions (not abandoned)
      filteredSessions = sessionsWithDetails.filter(s => s.status !== 'abandoned');
    }

    res.json({ success: true, data: { sessions: filteredSessions } });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================================================
// DELETE /api/ideation/session/:sessionId
// ============================================================================
// Delete a session and its messages

ideationRouter.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Check session exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete in correct order (respecting foreign key constraints)
    // Note: viability_risks cascade from candidates automatically

    // Delete artifacts
    await query('DELETE FROM ideation_artifacts WHERE session_id = ?', [sessionId]);

    // Delete memory files
    await query('DELETE FROM ideation_memory_files WHERE session_id = ?', [sessionId]);

    // Delete searches
    await query('DELETE FROM ideation_searches WHERE session_id = ?', [sessionId]);

    // Delete signals
    await query('DELETE FROM ideation_signals WHERE session_id = ?', [sessionId]);

    // Delete messages (before candidates since messages may reference candidates)
    await query('DELETE FROM ideation_messages WHERE session_id = ?', [sessionId]);

    // Delete candidates (viability_risks will cascade)
    await query('DELETE FROM ideation_candidates WHERE session_id = ?', [sessionId]);

    // Delete session
    await query('DELETE FROM ideation_sessions WHERE id = ?', [sessionId]);

    await saveDb();

    res.json({ success: true, message: 'Session deleted' });

  } catch (error) {
    console.error('Error deleting session:', error);
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
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Reactivate abandoned sessions when user sends a streaming message
    if (session.status === 'abandoned') {
      await sessionManager.update(sessionId, { status: 'active' });
      session = await sessionManager.load(sessionId);
    }

    // Check session state
    if (session!.status !== 'active') {
      return res.status(400).json({
        error: 'Session is not active',
        status: session!.status,
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

    // Load artifacts for context
    const storedArtifacts = await artifactStore.getBySession(sessionId);
    const artifactSummaries = storedArtifacts.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      identifier: a.identifier,
    }));

    // Build system prompt with artifacts
    const systemPrompt = buildSystemPrompt(profile || {}, undefined, artifactSummaries);

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

// ============================================================================
// POST /api/ideation/artifact
// ============================================================================
// Saves an artifact to the database

const SaveArtifactSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  artifact: z.object({
    id: z.string().min(1),
    type: z.string(),
    title: z.string(),
    content: z.union([z.string(), z.record(z.unknown())]),
    language: z.string().optional(),
    identifier: z.string().optional(),
  }),
});

ideationRouter.post('/artifact', async (req: Request, res: Response) => {
  try {
    const parseResult = SaveArtifactSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('[SaveArtifact] Validation error:', parseResult.error.issues);
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, artifact } = parseResult.data;
    console.log(`[SaveArtifact] Saving artifact ${artifact.id} to session ${sessionId}`);

    // Verify session exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      console.error(`[SaveArtifact] Session ${sessionId} not found`);
      return res.status(404).json({ error: 'Session not found' });
    }

    // Save artifact
    await artifactStore.save({
      id: artifact.id,
      sessionId,
      type: artifact.type as 'markdown' | 'research' | 'mermaid' | 'code' | 'analysis' | 'comparison' | 'idea-summary',
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
      identifier: artifact.identifier,
      status: 'ready',
    });

    // Verify it was saved with correct content
    const savedArtifacts = await artifactStore.getBySession(sessionId);
    const saved = savedArtifacts.find(a => a.id === artifact.id);
    if (saved) {
      const savedContentLength = typeof saved.content === 'string' ? saved.content.length : JSON.stringify(saved.content).length;
      const inputContentLength = typeof artifact.content === 'string' ? artifact.content.length : JSON.stringify(artifact.content).length;
      console.log(`[SaveArtifact] Successfully saved artifact ${artifact.id}`);
      console.log(`[SaveArtifact] Input content length: ${inputContentLength}, Saved content length: ${savedContentLength}`);
      if (savedContentLength !== inputContentLength) {
        console.error(`[SaveArtifact] WARNING: Content length mismatch!`);
      }
    } else {
      console.error(`[SaveArtifact] WARNING: Artifact ${artifact.id} not found after save!`);
    }

    res.json({ success: true, artifactId: artifact.id });
  } catch (error) {
    console.error('[SaveArtifact] Error saving artifact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// DELETE /api/ideation/artifact/:artifactId
// ============================================================================
// Deletes an artifact from the database

ideationRouter.delete('/artifact/:artifactId', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Verify session exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete the artifact
    await query('DELETE FROM ideation_artifacts WHERE id = ? AND session_id = ?', [artifactId, sessionId]);
    await saveDb();

    console.log(`[DeleteArtifact] Deleted artifact ${artifactId} from session ${sessionId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[DeleteArtifact] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/artifact/edit
// ============================================================================
// Async artifact editing using dedicated sub-agent
// Returns immediately, sends WebSocket notification when complete

const EditArtifactSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  artifactId: z.string().min(1, 'artifactId is required'),
  editRequest: z.string().min(1, 'editRequest is required'),
});

ideationRouter.post('/artifact/edit', async (req: Request, res: Response) => {
  try {
    const parseResult = EditArtifactSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, artifactId, editRequest } = parseResult.data;
    console.log(`[ArtifactEdit] Starting async edit for ${artifactId} in session ${sessionId}`);

    // Verify session exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify artifact exists
    const artifacts = await artifactStore.getBySession(sessionId);
    const artifact = artifacts.find(a => a.id === artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Notify clients that edit is starting
    emitSessionEvent('artifact:updating', sessionId, {
      artifactId,
      summary: 'Updating artifact...',
    });

    // Return immediately - edit happens asynchronously
    res.json({
      success: true,
      status: 'pending',
      message: 'Artifact edit started. You will be notified when complete.',
    });

    // Execute edit asynchronously (don't await)
    editArtifact({ sessionId, artifactId, editRequest })
      .then((result) => {
        if (result.success) {
          console.log(`[ArtifactEdit] Async edit completed for ${artifactId}`);
          emitSessionEvent('artifact:updated', sessionId, {
            artifactId: result.artifactId,
            content: result.content,
            summary: result.summary,
          });
        } else {
          console.error(`[ArtifactEdit] Async edit failed for ${artifactId}: ${result.error}`);
          emitSessionEvent('artifact:error', sessionId, {
            artifactId,
            error: result.error,
          });
        }
      })
      .catch((error) => {
        console.error(`[ArtifactEdit] Async edit error for ${artifactId}:`, error);
        emitSessionEvent('artifact:error', sessionId, {
          artifactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

  } catch (error) {
    console.error('[ArtifactEdit] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /api/ideation/search
// ============================================================================
// Executes web searches asynchronously and returns results as artifacts

ideationRouter.post('/search', async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = WebSearchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.issues,
      });
    }

    const { sessionId, queries, context } = parseResult.data;

    // Load session to verify it exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Execute searches in parallel
    console.log(`[WebSearch API] Executing ${queries.length} searches...`);
    const searchPromises = queries.map(async (searchQuery: string) => {
      const purpose: SearchPurpose = {
        type: 'general',
        context: context || 'Ideation research',
      };
      return performWebSearch(searchQuery, purpose);
    });

    const rawResults = await Promise.all(searchPromises);

    // Format sources for citation
    const sources = rawResults.flatMap(r =>
      r.results.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source,
        query: r.query,
      }))
    );

    // Combine all synthesis content from Claude's research
    const combinedSynthesis = rawResults
      .filter(r => r.synthesis && r.synthesis.trim())
      .map(r => r.synthesis)
      .join('\n\n---\n\n');

    console.log(`[WebSearch API] Completed: ${sources.length} sources, synthesis length: ${combinedSynthesis.length}`);

    // Build artifact
    const artifactId = `research_${Date.now()}`;
    const artifact = {
      id: artifactId,
      type: 'research' as const,
      title: `Research: ${queries[0].slice(0, 30)}${queries.length > 1 ? ` (+${queries.length - 1} more)` : ''}`,
      content: {
        synthesis: combinedSynthesis,
        sources,
        queries,
      },
      queries,
      status: 'ready' as const,
      createdAt: new Date().toISOString(),
    };

    // Save artifact to database for session persistence
    await artifactStore.save({
      id: artifactId,
      sessionId,
      type: 'research',
      title: artifact.title,
      content: artifact.content,
      queries,
      identifier: `research_${queries[0]?.slice(0, 20).replace(/\s+/g, '_').toLowerCase() || 'results'}`,
      status: 'ready',
    });

    // Return synthesized research artifact
    res.json({
      success: true,
      artifact,
    });

  } catch (error) {
    console.error('Error executing web search:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Web search failed' });
    }
  }
});
