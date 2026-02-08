import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import { getOne, query, saveDb } from "../../database/db.js";
import {
  ideationRateLimiter,
  searchRateLimiter,
} from "../middleware/rate-limiter.js";
import { sessionManager } from "../../agents/ideation/session-manager.js";
import { messageStore } from "../../agents/ideation/message-store.js";
import { contextManager } from "../../agents/ideation/context-manager.js";
import { graphStateLoader } from "../../agents/ideation/graph-state-loader.js";
import { agentOrchestrator } from "../../agents/ideation/orchestrator.js";
import {
  generateGreetingWithButtons,
  UserProfile,
} from "../../agents/ideation/greeting-generator.js";
import { candidateManager } from "../../agents/ideation/candidate-manager.js";
import {
  createSSEStream,
  StreamingResponseHandler,
} from "../../agents/ideation/streaming.js";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
import { buildSystemPrompt } from "../../agents/ideation/system-prompt.js";
import {
  performWebSearch,
  SearchPurpose,
} from "../../agents/ideation/web-search-service.js";
import { artifactStore } from "../../agents/ideation/artifact-store.js";
import {
  saveArtifact as saveUnifiedArtifact,
  loadArtifact as loadUnifiedArtifact,
  listArtifacts as listUnifiedArtifacts,
  deleteArtifact as deleteUnifiedArtifact,
  UnifiedArtifact,
  CreateArtifactInput,
  ArtifactType,
} from "../../agents/ideation/unified-artifact-store.js";
import { subAgentStore } from "../../agents/ideation/subagent-store.js";
import {
  editArtifact,
  detectArtifactEditRequest,
} from "../../agents/ideation/artifact-editor.js";
import {
  ideaFolderExists,
  createDraftFolder,
  renameDraftToIdea,
  listUserIdeas,
  IdeaType,
  ParentInfo,
} from "../../utils/folder-structure.js";
import {
  emitSessionEvent,
  emitSubAgentSpawn,
  emitSubAgentStatus,
  emitSubAgentResult,
} from "../websocket.js";
import {
  subAgentManager,
  SubAgentTask as ManagerSubAgentTask,
} from "../../agents/ideation/sub-agent-manager.js";
import { generateFollowUp } from "../../agents/ideation/follow-up-generator.js";
import { FollowUpContext } from "../../agents/ideation/orchestrator.js";

/**
 * Creates a sub-agent status callback with proper deduplication.
 * Tracks which task+status combinations have been emitted to avoid duplicates
 * when onStatusChange receives ALL tasks on every status change.
 */
function createSubAgentStatusCallback(
  sessionId: string,
  logPrefix: string = "[SubAgent]",
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
      if (
        task.status === "running" ||
        task.status === "completed" ||
        task.status === "failed"
      ) {
        emitSubAgentStatus(sessionId, task.id, task.status, task.error);

        // Persist status to database
        subAgentStore
          .updateStatus(
            task.id,
            task.status as "running" | "completed" | "failed",
            {
              result: task.result,
              error: task.error,
            },
          )
          .catch((err) => {
            console.error(
              `${logPrefix} Failed to persist sub-agent status: ${err}`,
            );
          });
      }

      // Save artifact only once when completed
      if (
        task.status === "completed" &&
        task.result &&
        !savedArtifacts.has(task.id)
      ) {
        savedArtifacts.add(task.id);
        emitSubAgentResult(sessionId, task.id, task.result);

        // Save result as artifact
        const artifactId = `subagent_${task.id}`;
        artifactStore
          .save({
            id: artifactId,
            sessionId,
            type: "markdown",
            title: task.label.replace("...", ""),
            content: task.result,
            status: "ready",
          })
          .then(() => {
            console.log(`${logPrefix} Saved artifact: ${artifactId}`);
            // Notify frontend about new artifact
            emitSessionEvent("artifact:created", sessionId, {
              id: artifactId,
              type: "markdown",
              title: task.label.replace("...", ""),
              content: task.result,
              status: "ready",
              createdAt: new Date().toISOString(),
            });
          })
          .catch((err) => {
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

  const timeout = setTimeout((): void => {
    if (!responded && !res.headersSent) {
      responded = true;
      console.error(
        `[Timeout] Request to ${req.path} timed out after ${REQUEST_TIMEOUT_MS}ms`,
      );
      res.status(504).json({
        error: "Request timed out",
        message:
          "The request took too long to process. Please try again with a simpler request.",
      });
    }
  }, REQUEST_TIMEOUT_MS);

  // Clear timeout when response finishes
  res.on("finish", () => {
    responded = true;
    clearTimeout(timeout);
  });

  res.on("close", () => {
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
  profileId: z.string().min(1, "profileId is required"),
});

const SendMessageSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  message: z.string().min(1, "message is required"),
});

const ButtonClickSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  buttonId: z.string().min(1, "buttonId is required"),
  buttonValue: z.string(),
  buttonLabel: z.string().optional(), // Display label for the button
});

const CaptureIdeaSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

const FormSubmitSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  formId: z.string().min(1, "formId is required"),
  responses: z.record(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  ),
});

const SaveForLaterSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  candidateId: z.string().optional(),
  notes: z.string().optional(),
});

const DiscardAndRestartSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  reason: z.string().optional(),
});

const EditMessageSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  messageId: z.string().min(1, "messageId is required"),
  newContent: z.string().min(1, "newContent is required"),
});

const WebSearchSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  queries: z.array(z.string()).min(1, "At least one query is required"),
  context: z.string().optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getProfileById(profileId: string): Promise<UserProfile | null> {
  const profile = await getOne<{
    id: string;
    name: string;
    slug: string | null;
    technical_skills: string | null;
    interests: string | null;
    professional_experience: string | null;
    city: string | null;
    country: string | null;
  }>(
    "SELECT id, name, slug, technical_skills, interests, professional_experience, city, country FROM user_profiles WHERE id = ?",
    [profileId],
  );

  if (!profile) return null;

  // Parse skills and interests
  const parseField = (val: string | null): string[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return val
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  };

  return {
    name: profile.name,
    slug: profile.slug || undefined,
    skills: parseField(profile.technical_skills),
    interests: parseField(profile.interests),
    experience: profile.professional_experience
      ? {
          industries: parseField(profile.professional_experience),
        }
      : undefined,
    location:
      profile.city || profile.country
        ? {
            city: profile.city || undefined,
            country: profile.country || undefined,
          }
        : undefined,
  };
}

/**
 * Auto-creates an idea folder when a candidate gets a title.
 * This eliminates the need for manual "Capture" button clicks.
 */
async function autoCreateIdeaFolder(
  sessionId: string,
  candidateTitle: string,
  profileId: string,
): Promise<{ userSlug: string; ideaSlug: string } | null> {
  try {
    // Get session to check current idea_slug
    const db = await import("../../database/db.js");
    const sessionRow = await db.getOne<{
      user_slug: string | null;
      idea_slug: string | null;
    }>(`SELECT user_slug, idea_slug FROM ideation_sessions WHERE id = ?`, [
      sessionId,
    ]);

    if (!sessionRow) {
      console.log(`[AutoCreate] Session ${sessionId} not found`);
      return null;
    }

    // If already has a non-draft idea_slug, don't overwrite
    if (sessionRow.idea_slug && !sessionRow.idea_slug.startsWith("draft_")) {
      console.log(
        `[AutoCreate] Session already linked to idea: ${sessionRow.idea_slug}`,
      );
      return {
        userSlug: sessionRow.user_slug || "",
        ideaSlug: sessionRow.idea_slug,
      };
    }

    // Get profile to get user_slug
    const profile = await getProfileById(profileId);
    if (!profile?.slug) {
      console.log(`[AutoCreate] Profile ${profileId} has no slug`);
      return null;
    }

    const userSlug = profile.slug;

    // Generate idea slug from candidate title
    const ideaSlug = candidateTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);

    // Check if idea already exists
    if (ideaFolderExists(userSlug, ideaSlug)) {
      console.log(`[AutoCreate] Idea folder already exists: ${ideaSlug}`);
      // Link to existing idea
      await db.run(
        `UPDATE ideation_sessions SET user_slug = ?, idea_slug = ?, last_activity_at = ? WHERE id = ?`,
        [userSlug, ideaSlug, new Date().toISOString(), sessionId],
      );
      await db.saveDb();
      return { userSlug, ideaSlug };
    }

    // If has draft, rename it
    if (sessionRow.idea_slug?.startsWith("draft_")) {
      console.log(
        `[AutoCreate] Renaming draft ${sessionRow.idea_slug} to ${ideaSlug}`,
      );
      await renameDraftToIdea(
        userSlug,
        sessionRow.idea_slug,
        ideaSlug,
        "business",
      );
    } else {
      // Create new idea folder directly
      console.log(`[AutoCreate] Creating new idea folder: ${ideaSlug}`);
      const draftResult = await createDraftFolder(userSlug);
      await renameDraftToIdea(
        userSlug,
        draftResult.draftId,
        ideaSlug,
        "business",
      );
    }

    // Update session with idea link
    await db.run(
      `UPDATE ideation_sessions SET user_slug = ?, idea_slug = ?, last_activity_at = ? WHERE id = ?`,
      [userSlug, ideaSlug, new Date().toISOString(), sessionId],
    );
    await db.saveDb();

    console.log(
      `[AutoCreate] Successfully created idea folder and linked session: ${userSlug}/${ideaSlug}`,
    );
    return { userSlug, ideaSlug };
  } catch (error) {
    console.error("[AutoCreate] Error auto-creating idea folder:", error);
    return null;
  }
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
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  const now = new Date().toISOString();

  await query(
    `INSERT INTO ideas (id, slug, title, summary, idea_type, lifecycle_stage, folder_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      params.title,
      params.summary || null,
      params.type,
      params.stage,
      `ideas/${slug}`,
      now,
      now,
    ],
  );

  await saveDb();

  return { id, slug };
}

// ============================================================================
// POST /api/ideation/start
// ============================================================================
// Starts a new ideation session

ideationRouter.post("/start", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = StartSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { profileId } = parseResult.data;

    // Load profile
    const profile = await getProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Create session
    const session = await sessionManager.create({ profileId });

    // Generate personalized greeting
    const greeting = generateGreetingWithButtons(profile);

    // Store greeting as first assistant message
    await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: greeting.text,
      buttonsShown: greeting.buttons,
      tokenCount: Math.ceil(greeting.text.length / 4),
    });

    // Update session message count
    await sessionManager.update(session.id, { messageCount: 1 });

    // Return response
    return res.json({
      sessionId: session.id,
      greeting: greeting.text,
      buttons: greeting.buttons,
    });
  } catch (error) {
    console.error("Error starting ideation session:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/message
// ============================================================================
// Handles user message and returns agent response

ideationRouter.post(
  "/message",
  ideationRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const parseResult = SendMessageSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { sessionId, message } = parseResult.data;

      // Load session
      let session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Reactivate abandoned or completed sessions when user sends a message
      if (session.status === "abandoned" || session.status === "completed") {
        await sessionManager.update(sessionId, { status: "active" });
        session = await sessionManager.load(sessionId);
      }

      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "Session is not active" });
      }

      // Load profile
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const profile = await getProfileById(session.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Check for artifact edit request - delegate to sub-agent for async processing
      console.log(
        `[Message] Checking for artifact edit in: "${message.substring(0, 100)}..."`,
      );
      const artifactEditRequest = detectArtifactEditRequest(message);
      console.log(
        `[Message] detectArtifactEditRequest result:`,
        artifactEditRequest,
      );
      if (artifactEditRequest) {
        console.log(
          `[Message] Detected artifact edit request for ${artifactEditRequest.artifactId}`,
        );

        // Verify artifact exists
        const artifacts = await artifactStore.getBySession(sessionId);
        const artifact = artifacts.find(
          (a) => a.id === artifactEditRequest.artifactId,
        );

        if (artifact) {
          // Store user message
          const userMsg = await messageStore.add({
            sessionId,
            role: "user",
            content: message,
            tokenCount: Math.ceil(message.length / 4),
          });

          // Store immediate response
          const assistantMsg = await messageStore.add({
            sessionId,
            role: "assistant",
            content: `Updating the artifact "${artifact.title}" now...`,
            tokenCount: 20,
          });

          // Notify clients that edit is starting (include messageId for later update)
          emitSessionEvent("artifact:updating", sessionId, {
            artifactId: artifactEditRequest.artifactId,
            messageId: assistantMsg.id,
            summary: "Updating artifact...",
          });

          // Trigger async edit (don't await)
          editArtifact({
            sessionId,
            artifactId: artifactEditRequest.artifactId,
            editRequest: artifactEditRequest.editRequest,
          })
            .then((result) => {
              if (result.success) {
                console.log(
                  `[Message] Artifact edit completed for ${artifactEditRequest.artifactId}`,
                );
                emitSessionEvent("artifact:updated", sessionId, {
                  artifactId: result.artifactId,
                  messageId: assistantMsg.id,
                  content: result.content,
                  summary: result.summary,
                });
                // Update the message in the database too
                messageStore
                  .update(assistantMsg.id, {
                    content: `Updated artifact "${artifact.title}". ${result.summary || ""}`,
                  })
                  .catch((err) =>
                    console.error("[Message] Failed to update message:", err),
                  );
              } else {
                console.error(
                  `[Message] Artifact edit failed: ${result.error}`,
                );
                emitSessionEvent("artifact:error", sessionId, {
                  artifactId: artifactEditRequest.artifactId,
                  messageId: assistantMsg.id,
                  error: result.error,
                });
              }
            })
            .catch((error) => {
              console.error(`[Message] Artifact edit error:`, error);
              emitSessionEvent("artifact:error", sessionId, {
                artifactId: artifactEditRequest.artifactId,
                messageId: assistantMsg.id,
                error: error instanceof Error ? error.message : "Unknown error",
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
            tokenUsage: {
              total: 0,
              limit: 100000,
              percentUsed: 0,
              shouldHandoff: false,
            },
            webSearchQueries: null,
            artifact: null,
            artifactUpdate: null,
            artifactEditPending: {
              artifactId: artifactEditRequest.artifactId,
              status: "pending",
            },
          });
        } else {
          console.warn(
            `[Message] Artifact ${artifactEditRequest.artifactId} not found for edit`,
          );
          // Fall through to normal processing - agent will handle the error
        }
      }

      // Process message through orchestrator
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const response = await agentOrchestrator.processMessage(
        session,
        message,
        profile as Record<string, unknown>,
      );

      // Update session
      const messages = await messageStore.getBySession(sessionId);
      const totalTokens = await messageStore.getTotalTokens(sessionId);
      await sessionManager.update(sessionId, {
        messageCount: messages.length,
        tokenCount: totalTokens,
      });

      // Get or create candidate whenever candidateUpdate exists
      let candidateData = null;
      if (response.candidateUpdate) {
        const candidate = await candidateManager.getOrCreateForSession(
          sessionId,
          {
            title: response.candidateUpdate.title,
            summary: response.candidateUpdate.summary,
          },
        );
        candidateData = candidate;
        // Auto-create idea folder when candidate gets a title
        if (response.candidateUpdate.title && session) {
          await autoCreateIdeaFolder(
            sessionId,
            response.candidateUpdate.title,
            session.profileId,
          );
        }
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
          status: "ready",
          createdAt: new Date().toISOString(),
        };

        // Save artifact to database for persistence
        console.log(
          `[Routes/Message] Saving new artifact ${artifactId} to database`,
        );
        await artifactStore.save({
          id: artifactId,
          sessionId,
          type: response.artifact.type,
          title: response.artifact.title,
          content: response.artifact.content,
          language: response.artifact.language,
          status: "ready",
        });
        console.log(
          `[Routes/Message] Artifact ${artifactId} saved successfully`,
        );
      }

      // Handle artifact update if present
      let artifactUpdateResponse = null;
      console.log(
        `[Routes/Message] Checking artifactUpdate:`,
        response.artifactUpdate
          ? `id=${response.artifactUpdate.id}, hasContent=${!!response.artifactUpdate.content}`
          : "null",
      );
      if (response.artifactUpdate) {
        const { id, content, title } = response.artifactUpdate;
        console.log(
          `[ArtifactUpdate] Processing artifact ${id}, content length: ${content?.length || 0}`,
        );

        // Validate content is provided
        if (!content) {
          console.error(
            `[ArtifactUpdate] ERROR: No content provided for artifact ${id}! Agent failed to include updated content.`,
          );
        } else {
          // Get existing artifact to preserve type/title
          const existingArtifacts = await artifactStore.getBySession(sessionId);
          const existingArtifact = existingArtifacts.find((a) => a.id === id);

          if (existingArtifact) {
            // Update the artifact in the database, preserving original type
            await artifactStore.save({
              id,
              sessionId,
              type: existingArtifact.type,
              title: title || existingArtifact.title,
              content,
              status: "ready",
            });
            artifactUpdateResponse = {
              id,
              content,
              title: title || existingArtifact.title,
              updatedAt: new Date().toISOString(),
            };
            console.log(
              `[ArtifactUpdate] Successfully updated artifact ${id} with ${content.length} chars`,
            );
          } else {
            console.error(
              `[ArtifactUpdate] Artifact ${id} not found in session ${sessionId}`,
            );
          }
        }
      }

      // Return response
      console.log(
        `[Routes/Message] Sending response - followUpPending: ${response.followUpPending}, hasContext: ${!!response.followUpContext}`,
      );

      return res.json({
        userMessageId: response.userMessageId,
        messageId: response.assistantMessageId,
        reply: response.reply,
        buttons: response.buttons,
        formFields: response.form,
        candidateUpdate: candidateData
          ? {
              id: candidateData.id,
              title: candidateData.title,
              summary: candidateData.summary,
            }
          : null,
        risks: response.risks || [],
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
        // Follow-up fields for async engagement recovery
        followUpPending: response.followUpPending || false,
        followUpContext: response.followUpContext || null,
      });

      // If this was a quick-ack response with sub-agent tasks, execute them asynchronously
      if (
        response.isQuickAck &&
        response.subAgentTasks &&
        response.subAgentTasks!.length > 0
      ) {
        console.log(
          `[Routes/Message] Quick-ack detected, spawning ${response.subAgentTasks!.length} sub-agents`,
        );

        // Build context for sub-agents from graph state
        const contextParts: string[] = [];

        // Add candidate info
        const candidate = await candidateManager.getActiveForSession(sessionId);
        if (candidate) {
          contextParts.push(`## Current Idea: ${candidate!.title}`);
          if (candidate!.summary) {
            contextParts.push(`Summary: ${candidate!.summary}`);
          }
        }

        // Add memory graph context if available
        // Uses new getAgentContext() which provides:
        // 1. Top-level summaries from reports
        // 2. Navigation instructions for drilling deeper
        // 3. Key blocks (decisions, requirements)
        const agentContext = await graphStateLoader.getAgentContext(sessionId);
        if (agentContext.stats.blockCount > 0) {
          console.log(
            `[Ideation] 🔗 Session ${sessionId} has ${agentContext.stats.blockCount} blocks, ${agentContext.stats.reportCount} reports`,
          );
          console.log(
            `[Ideation] 📥 Injecting memory graph context into agent...`,
          );
          contextParts.push(agentContext.topLevel);
          contextParts.push(agentContext.instructions);
          contextParts.push(agentContext.keyBlocks);
          console.log(
            `[Ideation] ✅ Memory graph context injected (${agentContext.stats.reportCount} reports, ${agentContext.stats.blockCount} blocks)`,
          );
        } else {
          console.log(
            `[Ideation] ⚠️ Session ${sessionId} has no memory graph data yet`,
          );
        }

        const context = contextParts.join("\n");

        // Clear completed sub-agents from database before spawning new ones
        await subAgentStore.clearCompleted(sessionId);

        // Emit initial spawn events for UI and persist to database
        for (const task of response.subAgentTasks!) {
          emitSubAgentSpawn(sessionId, task.id, task.type, task.label);
          // Save initial state to database
          await subAgentStore.save({
            id: task.id,
            sessionId,
            type: task.type,
            name: task.label,
            status: "spawning",
          });
        }

        // Delay sub-agent execution to ensure HTTP response is flushed first
        // This prevents race condition where WebSocket 'running' arrives before frontend creates agents
        setTimeout(() => {
          subAgentManager
            .spawnAgents(
              response.subAgentTasks!.map((t) => ({
                id: t.id,
                type: t.type,
                label: t.label,
                prompt: t.prompt,
              })),
              context,
              // Use deduplicated callback to avoid multiple emissions per task
              createSubAgentStatusCallback(sessionId, "[SubAgent]"),
            )
            .then((completedTasks) => {
              console.log(
                `[Routes/Message] All ${completedTasks.length} sub-agents completed`,
              );
            })
            .catch((error) => {
              console.error(
                `[Routes/Message] Sub-agent execution error:`,
                error,
              );
            });
        }, 100); // 100ms delay
      }
    } catch (error) {
      console.error("Error processing ideation message:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/message/edit
// ============================================================================
// Edits a user message by deleting it and all subsequent messages,
// then processing the new content as a fresh message

ideationRouter.post("/message/edit", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = EditMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, messageId, newContent } = parseResult.data;

    // Load session
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Reactivate abandoned sessions when user edits a message
    if (session.status === "abandoned") {
      await sessionManager.update(sessionId, { status: "active" });
      session = await sessionManager.load(sessionId);
    }

    if (session!.status !== "active") {
      return res.status(400).json({ error: "Session is not active" });
    }

    // Verify the message exists and belongs to this session
    const messageToEdit = await messageStore.get(messageId);
    if (!messageToEdit) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (messageToEdit.sessionId !== sessionId) {
      return res
        .status(400)
        .json({ error: "Message does not belong to this session" });
    }
    if (messageToEdit.role !== "user") {
      return res
        .status(400)
        .json({ error: "Only user messages can be edited" });
    }

    // Delete the message and all messages after it
    const deletedCount = await messageStore.deleteFromMessage(
      sessionId,
      messageId,
    );

    // Note: In graph-based architecture, state is reconstructed from blocks on demand
    // No explicit reset needed since loadState() queries fresh from graph

    // Load profile
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const profile = await getProfileById(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Check for artifact edit request - delegate to sub-agent for async processing
    console.log(
      `[MessageEdit] Checking for artifact edit in: "${newContent.substring(0, 100)}..."`,
    );
    const artifactEditRequest = detectArtifactEditRequest(newContent);
    console.log(
      `[MessageEdit] detectArtifactEditRequest result:`,
      artifactEditRequest,
    );
    if (artifactEditRequest) {
      console.log(
        `[MessageEdit] Detected artifact edit request for ${artifactEditRequest.artifactId}`,
      );

      // Verify artifact exists
      const artifacts = await artifactStore.getBySession(sessionId);
      const artifact = artifacts.find(
        (a) => a.id === artifactEditRequest.artifactId,
      );

      if (artifact) {
        // Store user message
        const userMsg = await messageStore.add({
          sessionId,
          role: "user",
          content: newContent,
          tokenCount: Math.ceil(newContent.length / 4),
        });

        // Store immediate response
        const assistantMsg = await messageStore.add({
          sessionId,
          role: "assistant",
          content: `Updating the artifact "${artifact.title}" now...`,
          tokenCount: 20,
        });

        // Notify clients that edit is starting (include messageId for later update)
        emitSessionEvent("artifact:updating", sessionId, {
          artifactId: artifactEditRequest.artifactId,
          messageId: assistantMsg.id,
          summary: "Updating artifact...",
        });

        // Trigger async edit (don't await)
        editArtifact({
          sessionId,
          artifactId: artifactEditRequest.artifactId,
          editRequest: artifactEditRequest.editRequest,
        })
          .then((result) => {
            if (result.success) {
              console.log(
                `[MessageEdit] Artifact edit completed for ${artifactEditRequest.artifactId}`,
              );
              emitSessionEvent("artifact:updated", sessionId, {
                artifactId: result.artifactId,
                messageId: assistantMsg.id,
                content: result.content,
                summary: result.summary,
              });
              // Update the message in the database too
              messageStore
                .update(assistantMsg.id, {
                  content: `Updated artifact "${artifact.title}". ${result.summary || ""}`,
                })
                .catch((err) =>
                  console.error("[MessageEdit] Failed to update message:", err),
                );
            } else {
              console.error(
                `[MessageEdit] Artifact edit failed: ${result.error}`,
              );
              emitSessionEvent("artifact:error", sessionId, {
                artifactId: artifactEditRequest.artifactId,
                messageId: assistantMsg.id,
                error: result.error,
              });
            }
          })
          .catch((error) => {
            console.error(`[MessageEdit] Artifact edit error:`, error);
            emitSessionEvent("artifact:error", sessionId, {
              artifactId: artifactEditRequest.artifactId,
              messageId: assistantMsg.id,
              error: error instanceof Error ? error.message : "Unknown error",
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
          tokenUsage: {
            total: 0,
            limit: 100000,
            percentUsed: 0,
            shouldHandoff: false,
          },
          webSearchQueries: null,
          artifact: null,
          artifactUpdate: null,
          artifactEditPending: {
            artifactId: artifactEditRequest.artifactId,
            status: "pending",
          },
        });
      } else {
        console.warn(
          `[MessageEdit] Artifact ${artifactEditRequest.artifactId} not found for edit`,
        );
        // Fall through to normal processing - agent will handle the error
      }
    }

    // Process the new message through orchestrator (same as /message endpoint)
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const response = await agentOrchestrator.processMessage(
      session,
      newContent,
      profile as Record<string, unknown>,
    );

    // Update session
    const messages = await messageStore.getBySession(sessionId);
    const totalTokens = await messageStore.getTotalTokens(sessionId);
    await sessionManager.update(sessionId, {
      messageCount: messages.length,
      tokenCount: totalTokens,
    });

    // Get or update candidate
    let candidateData = null;
    const existingCandidate =
      await candidateManager.getActiveForSession(sessionId);
    if (existingCandidate) {
      // Update existing candidate
      if (response.candidateUpdate) {
        await candidateManager.update(existingCandidate.id, {
          title: response.candidateUpdate.title,
          summary: response.candidateUpdate.summary,
        });
        // Auto-create idea folder when candidate gets a title
        if (response.candidateUpdate.title && session) {
          await autoCreateIdeaFolder(
            sessionId,
            response.candidateUpdate.title,
            session.profileId,
          );
        }
      }
      candidateData = {
        ...existingCandidate,
        ...(response.candidateUpdate || {}),
      };
    } else if (response.candidateUpdate) {
      // Create new candidate whenever candidateUpdate exists
      const candidate = await candidateManager.getOrCreateForSession(
        sessionId,
        {
          title: response.candidateUpdate.title,
          summary: response.candidateUpdate.summary,
        },
      );
      candidateData = candidate;
      // Auto-create idea folder when candidate gets a title
      if (response.candidateUpdate.title && session) {
        await autoCreateIdeaFolder(
          sessionId,
          response.candidateUpdate.title,
          session.profileId,
        );
      }
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
        status: "ready",
        createdAt: new Date().toISOString(),
      };

      // Save artifact to database for persistence
      console.log(
        `[Routes/MessageEdit] Saving new artifact ${artifactId} to database`,
      );
      await artifactStore.save({
        id: artifactId,
        sessionId,
        type: response.artifact.type,
        title: response.artifact.title,
        content: response.artifact.content,
        language: response.artifact.language,
        status: "ready",
      });
      console.log(
        `[Routes/MessageEdit] Artifact ${artifactId} saved successfully`,
      );
    }

    // Handle artifact update if present
    let artifactUpdateResponse = null;
    if (response.artifactUpdate) {
      const { id, content, title } = response.artifactUpdate;
      console.log(`[Routes/MessageEdit] Processing artifact update ${id}`);

      if (content) {
        const existingArtifacts = await artifactStore.getBySession(sessionId);
        const existingArtifact = existingArtifacts.find((a) => a.id === id);

        if (existingArtifact) {
          await artifactStore.save({
            id,
            sessionId,
            type: existingArtifact.type,
            title: title || existingArtifact.title,
            content,
            status: "ready",
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
    console.log(
      `[Routes/Edit] Sending response - followUpPending: ${response.followUpPending}, hasContext: ${!!response.followUpContext}`,
    );

    return res.json({
      deletedCount,
      userMessageId: response.userMessageId,
      messageId: response.assistantMessageId,
      reply: response.reply,
      buttons: response.buttons,
      formFields: response.form,
      candidateUpdate: candidateData
        ? {
            id: candidateData.id,
            title: candidateData.title,
            summary: candidateData.summary,
          }
        : null,
      risks: response.risks || [],
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
      // Follow-up fields for async engagement recovery
      followUpPending: response.followUpPending || false,
      followUpContext: response.followUpContext || null,
    });

    // If this was a quick-ack response with sub-agent tasks, execute them asynchronously
    if (
      response.isQuickAck &&
      response.subAgentTasks &&
      response.subAgentTasks!.length > 0
    ) {
      console.log(
        `[Routes/MessageEdit] Quick-ack detected, spawning ${response.subAgentTasks!.length} sub-agents`,
      );

      // Build context for sub-agents from graph state
      const contextParts: string[] = [];

      // Load graph state if session is linked to an idea
      const editSession = await sessionManager.load(sessionId);
      const ideaSlug = editSession?.ideaSlug;
      if (ideaSlug) {
        const graphState = await graphStateLoader.loadState(ideaSlug as string);
        if (graphState.selfDiscovery) {
          contextParts.push(
            `## Self Discovery\n${JSON.stringify(graphState.selfDiscovery, null, 2)}`,
          );
        }
        if (graphState.marketDiscovery) {
          contextParts.push(
            `## Market Discovery\n${JSON.stringify(graphState.marketDiscovery, null, 2)}`,
          );
        }
        if (graphState.narrowingState) {
          contextParts.push(
            `## Narrowing State\n${JSON.stringify(graphState.narrowingState, null, 2)}`,
          );
        }
      }
      if (candidateData) {
        contextParts.push(
          `## Current Idea Candidate\nTitle: ${candidateData.title}\nSummary: ${candidateData.summary || "Not yet defined"}`,
        );
      }

      const context = contextParts.join("\n");

      // Clear completed sub-agents from database before spawning new ones
      await subAgentStore.clearCompleted(sessionId);

      // Emit initial spawn events for UI and persist to database
      for (const task of response.subAgentTasks!) {
        emitSubAgentSpawn(sessionId, task.id, task.type, task.label);
        // Save initial state to database
        await subAgentStore.save({
          id: task.id,
          sessionId,
          type: task.type,
          name: task.label,
          status: "spawning",
        });
      }

      // Delay sub-agent execution to ensure HTTP response is flushed first
      // This prevents race condition where WebSocket 'running' arrives before frontend creates agents
      setTimeout(() => {
        subAgentManager
          .spawnAgents(
            response.subAgentTasks!.map((t) => ({
              id: t.id,
              type: t.type,
              label: t.label,
              prompt: t.prompt,
            })),
            context,
            // Use deduplicated callback to avoid multiple emissions per task
            createSubAgentStatusCallback(sessionId, "[SubAgent/Edit]"),
          )
          .then((completedTasks) => {
            console.log(
              `[Routes/MessageEdit] All ${completedTasks.length} sub-agents completed`,
            );
          })
          .catch((err) => {
            console.error(
              `[Routes/MessageEdit] Sub-agent execution error:`,
              err,
            );
          });
      }, 100); // 100ms delay
    }
  } catch (error) {
    console.error("Error editing ideation message:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/follow-up
// ============================================================================
// Generates a follow-up question when the main response lacked engagement.
// Called asynchronously by the frontend when followUpPending is true.
// Uses Haiku for fast, low-latency generation.

const FollowUpRequestSchema = z.object({
  sessionId: z.string().uuid(),
  context: z.object({
    reason: z.enum(["no_question", "artifact_created", "search_initiated"]),
    artifactType: z.string().optional(),
    artifactTitle: z.string().optional(),
    searchQueries: z.array(z.string()).optional(),
    lastUserMessage: z.string(),
    sessionId: z.string(),
    assistantMessageId: z.string(),
  }),
});

ideationRouter.post("/follow-up", async (req: Request, res: Response) => {
  console.log(
    `[Routes/FollowUp] ========== FOLLOW-UP ENDPOINT CALLED ==========`,
  );
  try {
    const parseResult = FollowUpRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, context } = parseResult.data;

    // Load session to verify it exists and is active
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status !== "active") {
      return res.status(400).json({ error: "Session is not active" });
    }

    // Emit pending event so frontend shows thinking indicator
    emitSessionEvent("followup:pending", sessionId, {
      reason: context.reason,
    });

    console.log(
      `[Routes/FollowUp] Generating follow-up for session ${sessionId}, reason: ${context.reason}`,
    );

    // Generate follow-up question using Haiku
    const followUp = await generateFollowUp(context as FollowUpContext);

    // Store the follow-up as a new assistant message
    const followUpMsg = await messageStore.add({
      sessionId,
      role: "assistant",
      content: followUp.text,
      buttonsShown: followUp.buttons || null,
      tokenCount: Math.ceil(followUp.text.length / 4),
    });

    // Emit the follow-up message via WebSocket
    emitSessionEvent("followup:message", sessionId, {
      messageId: followUpMsg.id,
      text: followUp.text,
      buttons: followUp.buttons || null,
      reason: context.reason,
    });

    console.log(
      `[Routes/FollowUp] Follow-up generated and sent for session ${sessionId}`,
    );

    return res.json({
      success: true,
      messageId: followUpMsg.id,
      text: followUp.text,
      buttons: followUp.buttons || null,
    });
  } catch (error) {
    console.error("Error generating follow-up:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/button
// ============================================================================
// Handles button click as if it were a message

ideationRouter.post(
  "/button",
  ideationRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const parseResult = ButtonClickSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { sessionId, buttonId, buttonValue, buttonLabel } =
        parseResult.data;

      // Load session
      let session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Reactivate abandoned sessions when user clicks a button
      if (session.status === "abandoned") {
        await sessionManager.update(sessionId, { status: "active" });
        session = await sessionManager.load(sessionId);
      }

      if (session!.status !== "active") {
        return res.status(400).json({ error: "Session is not active" });
      }

      // Get last assistant message and record button click
      const messages = await messageStore.getBySession(sessionId);
      const lastAssistantMessage = messages
        .filter((m) => m.role === "assistant")
        .pop();
      if (lastAssistantMessage) {
        await messageStore.recordButtonClick(lastAssistantMessage.id, buttonId);
      }

      // Load profile
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const profile = await getProfileById(session.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Use label for display, value for processing
      const displayMessage = buttonLabel || buttonValue;

      // Process button value as message through orchestrator
      // Pass displayMessage so it gets stored correctly, but the LLM sees the semantic value
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const response = await agentOrchestrator.processMessage(
        session,
        buttonValue,
        profile as Record<string, unknown>,
        displayMessage,
      );

      // Update session
      const updatedMessages = await messageStore.getBySession(sessionId);
      const totalTokens = await messageStore.getTotalTokens(sessionId);
      await sessionManager.update(sessionId, {
        messageCount: updatedMessages.length,
        tokenCount: totalTokens,
      });

      // Get or create candidate whenever candidateUpdate exists
      let candidateData = null;
      if (response.candidateUpdate) {
        const candidate = await candidateManager.getOrCreateForSession(
          sessionId,
          {
            title: response.candidateUpdate.title,
            summary: response.candidateUpdate.summary,
          },
        );
        candidateData = candidate;
        // Auto-create idea folder when candidate gets a title
        if (response.candidateUpdate.title && session) {
          await autoCreateIdeaFolder(
            sessionId,
            response.candidateUpdate.title,
            session.profileId,
          );
        }
      }

      // Calculate token usage for frontend display
      const TOKEN_LIMIT = 100000; // Claude's context limit
      const percentUsed = Math.min((totalTokens / TOKEN_LIMIT) * 100, 100);
      const shouldHandoff = percentUsed >= 80;

      // Return response
      console.log(
        `[Routes/Button] Sending response - followUpPending: ${response.followUpPending}, hasContext: ${!!response.followUpContext}`,
      );

      return res.json({
        userMessageId: response.userMessageId,
        messageId: response.assistantMessageId,
        reply: response.reply,
        buttons: response.buttons,
        formFields: response.form,
        candidateUpdate: candidateData
          ? {
              id: candidateData.id,
              title: candidateData.title,
              summary: candidateData.summary,
            }
          : null,
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
        // Follow-up fields for async engagement recovery
        followUpPending: response.followUpPending || false,
        followUpContext: response.followUpContext || null,
      });

      // If this was a quick-ack response with sub-agent tasks, execute them asynchronously
      if (
        response.isQuickAck &&
        response.subAgentTasks &&
        response.subAgentTasks!.length > 0
      ) {
        console.log(
          `[Routes/Button] Quick-ack detected, spawning ${response.subAgentTasks!.length} sub-agents`,
        );

        // Build context for sub-agents from graph state
        const contextParts: string[] = [];

        // Add candidate info
        const candidate = await candidateManager.getActiveForSession(sessionId);
        if (candidate) {
          contextParts.push(`## Current Idea: ${candidate!.title}`);
          if (candidate!.summary) {
            contextParts.push(`Summary: ${candidate!.summary}`);
          }
        }

        // Add memory graph context
        const buttonAgentContext =
          await graphStateLoader.getAgentContext(sessionId);
        if (buttonAgentContext.stats.blockCount > 0) {
          console.log(
            `[Ideation/Button] 🔗 Session has ${buttonAgentContext.stats.blockCount} blocks, ${buttonAgentContext.stats.reportCount} reports`,
          );
          console.log(`[Ideation/Button] 📥 Injecting memory graph context...`);
          contextParts.push(buttonAgentContext.topLevel);
          contextParts.push(buttonAgentContext.instructions);
          contextParts.push(buttonAgentContext.keyBlocks);
          console.log(
            `[Ideation/Button] ✅ Memory graph context injected (${buttonAgentContext.stats.reportCount} reports, ${buttonAgentContext.stats.blockCount} blocks)`,
          );
        } else {
          console.log(`[Ideation/Button] ⚠️ No memory graph data yet`);
        }

        const context = contextParts.join("\n");

        // Clear completed sub-agents from database before spawning new ones
        await subAgentStore.clearCompleted(sessionId);

        // Emit initial spawn events for UI and persist to database
        for (const task of response.subAgentTasks!) {
          emitSubAgentSpawn(sessionId, task.id, task.type, task.label);
          // Save initial state to database
          await subAgentStore.save({
            id: task.id,
            sessionId,
            type: task.type,
            name: task.label,
            status: "spawning",
          });
        }

        // Delay sub-agent execution to ensure HTTP response is flushed first
        // This prevents race condition where WebSocket 'running' arrives before frontend creates agents
        setTimeout(() => {
          subAgentManager
            .spawnAgents(
              response.subAgentTasks!.map((t) => ({
                id: t.id,
                type: t.type,
                label: t.label,
                prompt: t.prompt,
              })),
              context,
              // Use deduplicated callback to avoid multiple emissions per task
              createSubAgentStatusCallback(sessionId, "[SubAgent/Button]"),
            )
            .catch((err) => {
              console.error(`[Routes/Button] Sub-agent execution failed:`, err);
            });
        }, 100); // 100ms delay
      }
    } catch (error) {
      console.error("Error processing button click:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/form
// ============================================================================
// Handles form submissions

ideationRouter.post("/form", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = FormSubmitSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, formId, responses } = parseResult.data;

    // Load session
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Reactivate abandoned sessions when user submits a form
    if (session.status === "abandoned") {
      await sessionManager.update(sessionId, { status: "active" });
      session = await sessionManager.load(sessionId);
    }

    // Check session state
    if (session!.status !== "active") {
      return res.status(400).json({
        error: "Session is not active",
        status: session!.status,
      });
    }

    // Format responses as user message
    const formattedResponse = Object.entries(responses)
      .map(([field, value]) => {
        if (Array.isArray(value)) {
          return `${field}: ${value.join(", ")}`;
        }
        return `${field}: ${value}`;
      })
      .join("\n");

    // Store as user message with form reference
    await messageStore.add({
      sessionId,
      role: "user",
      content: formattedResponse,
      formResponse: { formId, responses },
      tokenCount: Math.ceil(formattedResponse.length / 4),
    });

    // Get profile for context
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const profile = await getProfileById(session.profileId);

    // Process through agent
    const agentResponse = await agentOrchestrator.processMessage(
      session,
      formattedResponse,
      profile || {},
    );

    // Update candidate if needed
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (agentResponse.candidateUpdate) {
      if (candidate) {
        await candidateManager.update(candidate.id, {
          title: agentResponse.candidateUpdate.title,
          summary: agentResponse.candidateUpdate.summary,
        });
      } else {
        await candidateManager.create({
          sessionId,
          title: agentResponse.candidateUpdate.title,
          summary: agentResponse.candidateUpdate.summary,
        });
      }
    }

    return res.json({
      reply: agentResponse.reply,
      buttons: agentResponse.buttons,
      form: agentResponse.form,
      candidate: await candidateManager.getActiveForSession(sessionId),
    });
  } catch (error) {
    console.error("Error processing form:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/capture
// ============================================================================
// Captures the current idea candidate to the Ideas system

ideationRouter.post("/capture", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = CaptureIdeaSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get current candidate
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (!candidate) {
      return res.status(400).json({ error: "No idea candidate to capture" });
    }

    // Create idea in system
    const idea = await createIdea({
      title: candidate.title,
      type: "business", // Default type
      stage: "SPARK",
      summary: candidate.summary || undefined,
    });

    // Update candidate status
    await candidateManager.update(candidate.id, {
      status: "captured",
      capturedIdeaId: idea.id,
    });

    // Complete session
    await sessionManager.complete(sessionId);

    // Return response
    return res.json({
      ideaId: idea.id,
      ideaSlug: idea.slug,
      prePopulatedFields: {
        title: candidate.title,
        type: "business",
        summary: candidate.summary,
      },
      ideationMetadata: {
        sessionId,
      },
    });
  } catch (error) {
    console.error("Error capturing idea:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/save
// ============================================================================
// Saves current idea for later

ideationRouter.post("/save", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = SaveForLaterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, candidateId } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get candidate (use provided or active)
    let candidate;
    if (candidateId) {
      candidate = await candidateManager.getById(candidateId);
    } else {
      candidate = await candidateManager.getActiveForSession(sessionId);
    }

    if (!candidate) {
      return res.status(404).json({ error: "No candidate to save" });
    }

    // Update candidate status
    await candidateManager.update(candidate.id, {
      status: "saved",
    });

    // Keep session active (user can resume it later)
    // Note: Session remains 'active' since 'paused' is not in the DB schema
    // The candidate's 'saved' status indicates this session has a saved idea

    // Note: In graph-based architecture, save events are captured through
    // block extraction from conversation rather than explicit memory file updates

    return res.json({
      success: true,
      candidate: await candidateManager.getById(candidate.id),
      message: "Idea saved for later. You can resume this session anytime.",
    });
  } catch (error) {
    console.error("Error saving for later:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/candidate/update
// ============================================================================
// Updates candidate details (title, summary)

const UpdateCandidateSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  title: z.string().optional(),
  summary: z.string().optional(),
});

ideationRouter.post(
  "/candidate/update",
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const parseResult = UpdateCandidateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { sessionId, title, summary } = parseResult.data;

      // Load session
      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get active candidate
      const candidate = await candidateManager.getActiveForSession(sessionId);
      if (!candidate) {
        return res
          .status(404)
          .json({ error: "No active candidate for this session" });
      }

      // Build update object
      const updates: { title?: string; summary?: string } = {};
      if (title !== undefined) updates.title = title;
      if (summary !== undefined) updates.summary = summary;

      // Update candidate
      await candidateManager.update(candidate.id, updates);

      // Get updated candidate
      const updatedCandidate = await candidateManager.getById(candidate.id);

      return res.json({
        success: true,
        candidate: updatedCandidate,
      });
    } catch (error) {
      console.error("Error updating candidate:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/discard
// ============================================================================
// Discards current session and optionally starts fresh

ideationRouter.post("/discard", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = DiscardAndRestartSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, reason } = parseResult.data;

    // Load session
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Discard any active candidates
    const candidate = await candidateManager.getActiveForSession(sessionId);
    if (candidate) {
      await candidateManager.update(candidate.id, {
        status: "discarded",
      });
    }

    // Note: Discard reason is logged but not stored in graph since session is being abandoned
    if (reason) {
      console.log(
        `[Routes/Discard] Session ${sessionId} discarded with reason: ${reason}`,
      );
    }

    // Abandon the session
    await sessionManager.abandon(sessionId);

    // Create new session for restart
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const profile = await getProfileById(session.profileId);
    const newSession = await sessionManager.create({
      profileId: session.profileId,
    });

    // Generate fresh greeting
    const greeting = generateGreetingWithButtons(profile || {});

    // Store greeting
    await messageStore.add({
      sessionId: newSession.id,
      role: "assistant",
      content: greeting.text,
      buttonsShown: greeting.buttons,
      tokenCount: Math.ceil(greeting.text.length / 4),
    });

    return res.json({
      success: true,
      newSessionId: newSession.id,
      greeting: greeting.text,
      buttons: greeting.buttons,
    });
  } catch (error) {
    console.error("Error discarding session:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// GET /api/ideation/session/:sessionId
// ============================================================================
// Get session details

ideationRouter.get(
  "/session/:sessionId",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      let session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Reactivate abandoned sessions when resumed
      if (session.status === "abandoned") {
        await sessionManager.update(sessionId, { status: "active" });
        session = await sessionManager.load(sessionId);
      }

      const messages = await messageStore.getBySession(sessionId);
      const candidate = await candidateManager.getActiveForSession(sessionId);
      const artifacts = await artifactStore.getBySession(sessionId);
      const subAgents = await subAgentStore.getBySession(sessionId);

      // Log artifact content lengths for debugging
      console.log(
        `[GetSession] Returning ${artifacts.length} artifacts, ${subAgents.length} sub-agents:`,
      );
      artifacts.forEach((a) => {
        const contentLen =
          typeof a.content === "string"
            ? a.content.length
            : JSON.stringify(a.content).length;
        console.log(`  - ${a.id}: "${a.title}" (${contentLen} chars)`);
      });

      return res.json({
        session,
        messages,
        candidate,
        artifacts,
        subAgents,
      });
    } catch (error) {
      console.error("Error getting session:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/session/:sessionId/abandon
// ============================================================================
// Abandon a session

ideationRouter.post(
  "/session/:sessionId/abandon",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "active") {
        return res.status(400).json({ error: "Session is not active" });
      }

      await sessionManager.abandon(sessionId);

      return res.json({ success: true });
    } catch (error) {
      console.error("Error abandoning session:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// PATCH /api/ideation/session/:sessionId/link-idea
// ============================================================================
// Link a session to a specific user/idea

const LinkIdeaSchema = z.object({
  userSlug: z.string().min(1, "userSlug is required"),
  ideaSlug: z.string().min(1, "ideaSlug is required"),
});

ideationRouter.patch(
  "/session/:sessionId/link-idea",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Validate request body
      const parseResult = LinkIdeaSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { userSlug, ideaSlug } = parseResult.data;

      // Load session
      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate that idea folder exists before linking
      if (!ideaFolderExists(userSlug, ideaSlug)) {
        return res.status(400).json({
          error: "Idea folder not found",
          message: `No idea folder exists at users/${userSlug}/ideas/${ideaSlug}`,
        });
      }

      // Update session in database with user_slug and idea_slug
      const db = await import("../../database/db.js");
      await db.run(
        `UPDATE ideation_sessions SET user_slug = ?, idea_slug = ?, last_activity_at = ? WHERE id = ?`,
        [userSlug, ideaSlug, new Date().toISOString(), sessionId],
      );
      await db.saveDb();

      // Load and return updated session
      const updatedSession = await sessionManager.load(sessionId);

      // Add userSlug and ideaSlug to the response since they may not be in the mapped session type
      return res.json({
        success: true,
        session: {
          ...updatedSession,
          userSlug,
          ideaSlug,
        },
      });
    } catch (error) {
      console.error("Error linking idea to session:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// PATCH /api/ideation/session/:sessionId/title
// ============================================================================
// Update session title and trigger folder creation if needed

const UpdateSessionTitleSchema = z.object({
  title: z.string().min(1, "title is required").max(200, "title too long"),
});

ideationRouter.patch(
  "/session/:sessionId/title",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Validate request body
      const parseResult = UpdateSessionTitleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { title } = parseResult.data;

      // Load session
      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Update session title
      await sessionManager.updateTitle(sessionId, title);

      // Auto-create idea folder if title is set (and folder doesn't exist yet)
      let folderInfo: { userSlug: string; ideaSlug: string } | null = null;
      if (title && session.profileId) {
        folderInfo = await autoCreateIdeaFolder(
          sessionId,
          title,
          session.profileId,
        );
      }

      // Load updated session
      const updatedSession = await sessionManager.load(sessionId);

      return res.json({
        success: true,
        title,
        session: updatedSession,
        folderCreated: folderInfo !== null,
        folder: folderInfo,
      });
    } catch (error) {
      console.error("Error updating session title:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/session/:sessionId/name-idea
// ============================================================================
// Converts a draft folder to a named idea by renaming it and adding templates

const NameIdeaSchema = z.object({
  title: z.string().min(1, "title is required"),
  ideaType: z.enum([
    "business",
    "feature_internal",
    "feature_external",
    "service",
    "pivot",
  ]),
  parent: z
    .object({
      type: z.enum(["internal", "external"]),
      slug: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

ideationRouter.post(
  "/session/:sessionId/name-idea",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Validate request body
      const parseResult = NameIdeaSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { title, ideaType, parent } = parseResult.data;

      // Load session
      const db = await import("../../database/db.js");
      const sessionRow = await db.getOne<{
        id: string;
        user_slug: string | null;
        idea_slug: string | null;
        status: string;
      }>(
        `SELECT id, user_slug, idea_slug, status FROM ideation_sessions WHERE id = ?`,
        [sessionId],
      );

      if (!sessionRow) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify session is linked to a draft
      if (!sessionRow.idea_slug || !sessionRow.idea_slug.startsWith("draft_")) {
        return res.status(400).json({
          error: "Session not linked to draft",
          message:
            "This session is not linked to a draft folder. Only sessions with draft folders can be named.",
        });
      }

      if (!sessionRow.user_slug) {
        return res.status(400).json({
          error: "Session missing user",
          message: "This session does not have a user_slug set.",
        });
      }

      // Generate slug from title
      const ideaSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);

      // Check if target slug already exists
      if (ideaFolderExists(sessionRow.user_slug, ideaSlug)) {
        return res.status(409).json({
          error: "Idea slug already exists",
          message: `An idea with slug '${ideaSlug}' already exists for this user.`,
        });
      }

      // Convert parent to ParentInfo type for folder structure
      const parentInfo: ParentInfo | undefined = parent
        ? {
            type: parent.type,
            slug: parent.slug,
            name: parent.name,
          }
        : undefined;
      // TODO: Pass parentInfo to renameDraftToIdea when relationship support is added
      void parentInfo; // Preserve for upcoming relationship feature

      // Rename draft folder to idea folder
      await renameDraftToIdea(
        sessionRow.user_slug,
        sessionRow.idea_slug,
        ideaSlug,
        ideaType as IdeaType,
      );

      // Update session's idea_slug in database
      await db.run(
        `UPDATE ideation_sessions SET idea_slug = ?, last_activity_at = ? WHERE id = ?`,
        [ideaSlug, new Date().toISOString(), sessionId],
      );
      await db.saveDb();

      // Return updated session
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
      console.error("Error naming idea:", error);

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes("already exists")) {
          return res.status(409).json({
            error: "Idea slug already exists",
            message: error.message,
          });
        }
        if (error.message.includes("does not exist")) {
          return res.status(400).json({
            error: "Draft folder not found",
            message: error.message,
          });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// GET /api/ideation/sessions
// ============================================================================
// List sessions for a profile (with optional status filter)

ideationRouter.get("/sessions", async (req: Request, res: Response) => {
  try {
    const { profileId, status, includeAll } = req.query;

    if (!profileId) {
      return res.status(400).json({ error: "profileId is required" });
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
      title: string | null;
    }>(
      `SELECT id, profile_id, status, entry_mode, message_count, token_count, started_at, completed_at, title
       FROM ideation_sessions
       WHERE profile_id = ?
       ORDER BY started_at DESC`,
      [profileId as string],
    );

    // Get candidate info for each session
    const sessionsWithDetails = await Promise.all(
      allSessions.map(async (session) => {
        const candidate = await candidateManager.getActiveForSession(
          session.id,
        );
        const lastMessage = await getOne<{
          content: string;
          created_at: string;
        }>(
          `SELECT content, created_at FROM ideation_messages
           WHERE session_id = ?
           ORDER BY created_at DESC LIMIT 1`,
          [session.id],
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
          // Session title takes precedence, fall back to candidate title for backward compatibility
          title: session.title || candidate?.title || null,
          candidateTitle: candidate?.title || null,
          candidateSummary: candidate?.summary || null,
          lastMessagePreview: lastMessage?.content?.slice(0, 100) || null,
          lastMessageAt: lastMessage?.created_at || session.started_at,
        };
      }),
    );

    // Filter by status if requested
    let filteredSessions = sessionsWithDetails;
    if (status && status !== "all") {
      filteredSessions = sessionsWithDetails.filter((s) => s.status === status);
    } else if (!includeAll) {
      // By default, only return active and completed sessions (not abandoned)
      filteredSessions = sessionsWithDetails.filter(
        (s) => s.status !== "abandoned",
      );
    }

    return res.json({ success: true, data: { sessions: filteredSessions } });
  } catch (error) {
    console.error("Error listing sessions:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});

// ============================================================================
// DELETE /api/ideation/session/:sessionId
// ============================================================================
// Delete a session and its messages

ideationRouter.delete(
  "/session/:sessionId",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Check session exists
      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Delete in correct order (respecting foreign key constraints)
      // Note: viability_risks cascade from candidates automatically

      // Delete artifacts
      await query("DELETE FROM ideation_artifacts WHERE session_id = ?", [
        sessionId,
      ]);

      // Delete memory files
      await query("DELETE FROM ideation_memory_files WHERE session_id = ?", [
        sessionId,
      ]);

      // Delete searches
      await query("DELETE FROM ideation_searches WHERE session_id = ?", [
        sessionId,
      ]);

      // Delete signals
      await query("DELETE FROM ideation_signals WHERE session_id = ?", [
        sessionId,
      ]);

      // Delete messages (before candidates since messages may reference candidates)
      await query("DELETE FROM ideation_messages WHERE session_id = ?", [
        sessionId,
      ]);

      // Delete candidates (viability_risks will cascade)
      await query("DELETE FROM ideation_candidates WHERE session_id = ?", [
        sessionId,
      ]);

      // Delete session
      await query("DELETE FROM ideation_sessions WHERE id = ?", [sessionId]);

      await saveDb();

      return res.json({ success: true, message: "Session deleted" });
    } catch (error) {
      console.error("Error deleting session:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/message/stream
// ============================================================================
// Streaming message endpoint using Server-Sent Events

ideationRouter.post("/message/stream", async (req: Request, res: Response) => {
  try {
    // Validate request
    const parseResult = SendMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, message } = parseResult.data;

    // Load session
    let session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Reactivate abandoned or completed sessions when user sends a streaming message
    if (session.status === "abandoned" || session.status === "completed") {
      await sessionManager.update(sessionId, { status: "active" });
      session = await sessionManager.load(sessionId);
    }

    // Check session state
    if (session!.status !== "active") {
      return res.status(400).json({
        error: "Session is not active",
        status: session!.status,
      });
    }

    // Setup SSE stream
    const stream = createSSEStream(res);

    // Store user message
    await messageStore.add({
      sessionId,
      role: "user",
      content: message,
      tokenCount: Math.ceil(message.length / 4),
    });

    // Get context
    const messages = await messageStore.getBySession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const profile = await getProfileById(session.profileId);
    const candidate = await candidateManager.getActiveForSession(sessionId);

    // Create streaming handler
    const handler = new StreamingResponseHandler(
      anthropicClient as unknown as Anthropic,
    );

    // Listen for stream events
    handler.on("stream", async (event) => {
      if (event.type === "text_delta") {
        stream.send("text_delta", { text: event.data });
      } else if (event.type === "message_complete") {
        const data = event.data as {
          text: string;
          buttons: unknown[] | null;
          form: unknown | null;
          candidateUpdate: { title: string; summary: string } | null;
        };

        // Store complete message
        await messageStore.add({
          sessionId,
          role: "assistant",
          content: data.text,
          buttonsShown: data.buttons as unknown as
            | import("../../types/ideation.js").ButtonOption[]
            | null,
          formShown: data.form as
            | import("../../types/ideation.js").FormDefinition
            | null,
          tokenCount: Math.ceil(data.text.length / 4),
        });

        // Handle candidate updates
        if (data.candidateUpdate && candidate) {
          await candidateManager.update(candidate.id, {
            title: data.candidateUpdate.title,
            summary: data.candidateUpdate.summary,
          });
        }

        stream.send("message_complete", {
          reply: data.text,
          buttons: data.buttons,
          form: data.form,
        });
        stream.end();
      } else if (event.type === "error") {
        stream.send("error", { message: (event.data as Error).message });
        stream.end();
      }
    });

    // Load artifacts for context
    const storedArtifacts = await artifactStore.getBySession(sessionId);
    const artifactSummaries = storedArtifacts.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      identifier: a.identifier,
    }));

    // Build system prompt with artifacts
    const systemPrompt = buildSystemPrompt(
      profile || {},
      undefined,
      artifactSummaries,
    );

    // Start streaming
    await handler.streamMessage(
      messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      systemPrompt,
    );

    // Streaming response sent via SSE
    return;
  } catch (error) {
    console.error("Error in streaming message:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
    return;
  }
});

// ============================================================================
// POST /api/ideation/artifact
// ============================================================================
// Saves an artifact to the database

const SaveArtifactSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  artifact: z.object({
    id: z.string().min(1),
    type: z.string(),
    title: z.string(),
    content: z.union([z.string(), z.record(z.unknown())]),
    language: z.string().optional(),
    identifier: z.string().optional(),
  }),
});

ideationRouter.post("/artifact", async (req: Request, res: Response) => {
  try {
    const parseResult = SaveArtifactSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error(
        "[SaveArtifact] Validation error:",
        parseResult.error.issues,
      );
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, artifact } = parseResult.data;
    console.log(
      `[SaveArtifact] Saving artifact ${artifact.id} to session ${sessionId}`,
    );

    // Verify session exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      console.error(`[SaveArtifact] Session ${sessionId} not found`);
      return res.status(404).json({ error: "Session not found" });
    }

    // Save artifact
    await artifactStore.save({
      id: artifact.id,
      sessionId,
      type: artifact.type as
        | "markdown"
        | "research"
        | "mermaid"
        | "code"
        | "analysis"
        | "comparison"
        | "idea-summary",
      title: artifact.title,
      content: artifact.content,
      language: artifact.language,
      identifier: artifact.identifier,
      status: "ready",
    });

    // Verify it was saved with correct content
    const savedArtifacts = await artifactStore.getBySession(sessionId);
    const saved = savedArtifacts.find((a) => a.id === artifact.id);
    if (saved) {
      const savedContentLength =
        typeof saved.content === "string"
          ? saved.content.length
          : JSON.stringify(saved.content).length;
      const inputContentLength =
        typeof artifact.content === "string"
          ? artifact.content.length
          : JSON.stringify(artifact.content).length;
      console.log(`[SaveArtifact] Successfully saved artifact ${artifact.id}`);
      console.log(
        `[SaveArtifact] Input content length: ${inputContentLength}, Saved content length: ${savedContentLength}`,
      );
      if (savedContentLength !== inputContentLength) {
        console.error(`[SaveArtifact] WARNING: Content length mismatch!`);
      }
    } else {
      console.error(
        `[SaveArtifact] WARNING: Artifact ${artifact.id} not found after save!`,
      );
    }

    return res.json({ success: true, artifactId: artifact.id });
  } catch (error) {
    console.error("[SaveArtifact] Error saving artifact:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// DELETE /api/ideation/artifact/:artifactId
// ============================================================================
// Deletes an artifact from the database

ideationRouter.delete(
  "/artifact/:artifactId",
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }

      // Verify session exists
      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Delete the artifact
      await query(
        "DELETE FROM ideation_artifacts WHERE id = ? AND session_id = ?",
        [artifactId, sessionId],
      );
      await saveDb();

      console.log(
        `[DeleteArtifact] Deleted artifact ${artifactId} from session ${sessionId}`,
      );

      // Emit WebSocket event for real-time UI updates
      emitSessionEvent("artifact:deleted", sessionId, {
        artifactId,
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("[DeleteArtifact] Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ============================================================================
// POST /api/ideation/artifact/edit
// ============================================================================
// Async artifact editing using dedicated sub-agent
// Returns immediately, sends WebSocket notification when complete

const EditArtifactSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  artifactId: z.string().min(1, "artifactId is required"),
  editRequest: z.string().min(1, "editRequest is required"),
});

ideationRouter.post("/artifact/edit", async (req: Request, res: Response) => {
  try {
    const parseResult = EditArtifactSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { sessionId, artifactId, editRequest } = parseResult.data;
    console.log(
      `[ArtifactEdit] Starting async edit for ${artifactId} in session ${sessionId}`,
    );

    // Verify session exists
    const session = await sessionManager.load(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Verify artifact exists
    const artifacts = await artifactStore.getBySession(sessionId);
    const artifact = artifacts.find((a) => a.id === artifactId);
    if (!artifact) {
      return res.status(404).json({ error: "Artifact not found" });
    }

    // Notify clients that edit is starting
    emitSessionEvent("artifact:updating", sessionId, {
      artifactId,
      summary: "Updating artifact...",
    });

    // Return immediately - edit happens asynchronously
    return res.json({
      success: true,
      status: "pending",
      message: "Artifact edit started. You will be notified when complete.",
    });

    // Execute edit asynchronously (don't await)
    editArtifact({ sessionId, artifactId, editRequest })
      .then((result) => {
        if (result.success) {
          console.log(`[ArtifactEdit] Async edit completed for ${artifactId}`);
          emitSessionEvent("artifact:updated", sessionId, {
            artifactId: result.artifactId,
            content: result.content,
            summary: result.summary,
          });
        } else {
          console.error(
            `[ArtifactEdit] Async edit failed for ${artifactId}: ${result.error}`,
          );
          emitSessionEvent("artifact:error", sessionId, {
            artifactId,
            error: result.error,
          });
        }
      })
      .catch((error) => {
        console.error(
          `[ArtifactEdit] Async edit error for ${artifactId}:`,
          error,
        );
        emitSessionEvent("artifact:error", sessionId, {
          artifactId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
  } catch (error) {
    console.error("[ArtifactEdit] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// POST /api/ideation/search
// ============================================================================
// Executes web searches asynchronously and returns results as artifacts

ideationRouter.post(
  "/search",
  searchRateLimiter,
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const parseResult = WebSearchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const { sessionId, queries, context } = parseResult.data;

      // Load session to verify it exists
      const session = await sessionManager.load(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Execute searches in parallel
      console.log(`[WebSearch API] Executing ${queries.length} searches...`);
      const searchPromises = queries.map(async (searchQuery: string) => {
        const purpose: SearchPurpose = {
          type: "general",
          context: context || "Ideation research",
        };
        return performWebSearch(searchQuery, purpose);
      });

      const rawResults = await Promise.all(searchPromises);

      // Format sources for citation
      const sources = rawResults.flatMap((r) =>
        r.results.map((item) => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          source: item.source,
          query: r.query,
        })),
      );

      // Combine all synthesis content from Claude's research
      const combinedSynthesis = rawResults
        .filter((r) => r.synthesis && r.synthesis.trim())
        .map((r) => r.synthesis)
        .join("\n\n---\n\n");

      console.log(
        `[WebSearch API] Completed: ${sources.length} sources, synthesis length: ${combinedSynthesis.length}`,
      );

      // Build artifact
      const artifactId = `research_${Date.now()}`;
      const artifact = {
        id: artifactId,
        type: "research" as const,
        title: `Research: ${queries[0].slice(0, 30)}${queries.length > 1 ? ` (+${queries.length - 1} more)` : ""}`,
        content: {
          synthesis: combinedSynthesis,
          sources,
          queries,
        },
        queries,
        status: "ready" as const,
        createdAt: new Date().toISOString(),
      };

      // Save artifact to database for session persistence
      await artifactStore.save({
        id: artifactId,
        sessionId,
        type: "research",
        title: artifact.title,
        content: artifact.content,
        queries,
        identifier: `research_${queries[0]?.slice(0, 20).replace(/\s+/g, "_").toLowerCase() || "results"}`,
        status: "ready",
      });

      // Return synthesized research artifact
      return res.json({
        success: true,
        artifact,
      });
    } catch (error) {
      console.error("Error executing web search:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Web search failed" });
      }
      return;
    }
  },
);

// ============================================================================
// GET /api/ideation/ideas/:userSlug
// ============================================================================
// List all ideas for a user (for IdeaSelector component)

ideationRouter.get("/ideas/:userSlug", async (req: Request, res: Response) => {
  try {
    const { userSlug } = req.params;

    if (!userSlug) {
      return res.status(400).json({
        error: "Validation error",
        message: "userSlug is required",
      });
    }

    console.log(`[IdeaSelector] Listing ideas for user: ${userSlug}`);

    const ideas = await listUserIdeas(userSlug);

    console.log(
      `[IdeaSelector] Found ${ideas.length} ideas for user ${userSlug}`,
    );

    return res.json({
      success: true,
      data: {
        ideas,
        count: ideas.length,
      },
    });
  } catch (error) {
    console.error("[IdeaSelector] Error listing ideas:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// GET /api/ideation/ideas/:userSlug/:ideaSlug/artifacts
// ============================================================================
// Get all artifacts for an idea (filesystem-based unified artifact store)

ideationRouter.get(
  "/ideas/:userSlug/:ideaSlug/artifacts",
  async (req: Request, res: Response) => {
    try {
      const { userSlug, ideaSlug } = req.params;

      if (!userSlug || !ideaSlug) {
        return res.status(400).json({
          error: "Validation error",
          message: "userSlug and ideaSlug are required",
        });
      }

      console.log(
        `[IdeaArtifacts] Listing artifacts for ${userSlug}/${ideaSlug}`,
      );

      // Use unified artifact store to list all artifacts in the idea folder
      const artifacts = await listUnifiedArtifacts(userSlug, ideaSlug);

      console.log(`[IdeaArtifacts] Found ${artifacts.length} artifacts`);

      return res.json({
        success: true,
        data: {
          artifacts,
          count: artifacts.length,
        },
      });
    } catch (error) {
      console.error("[IdeaArtifacts] Error listing artifacts:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ============================================================================
// POST /api/ideation/ideas/:userSlug/:ideaSlug/artifacts
// ============================================================================
// Create a new artifact in an idea folder (filesystem-based unified artifact store)

const CreateIdeaArtifactSchema = z.object({
  type: z.enum([
    "research",
    "mermaid",
    "markdown",
    "code",
    "analysis",
    "comparison",
    "idea-summary",
    "template",
  ]),
  title: z.string().min(1, "title is required"),
  content: z.string().min(1, "content is required"),
  sessionId: z.string().optional(),
  language: z.string().optional(),
  queries: z.array(z.string()).optional(),
  identifier: z.string().optional(),
  filePath: z.string().optional(),
});

ideationRouter.post(
  "/ideas/:userSlug/:ideaSlug/artifacts",
  async (req: Request, res: Response) => {
    try {
      const { userSlug, ideaSlug } = req.params;

      if (!userSlug || !ideaSlug) {
        return res.status(400).json({
          error: "Validation error",
          message: "userSlug and ideaSlug are required",
        });
      }

      // Validate request body
      const parseResult = CreateIdeaArtifactSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation error",
          details: parseResult.error.issues,
        });
      }

      const {
        type,
        title,
        content,
        sessionId,
        language,
        queries,
        identifier,
        filePath,
      } = parseResult.data;

      console.log(
        `[IdeaArtifacts] Creating artifact "${title}" for ${userSlug}/${ideaSlug}`,
      );

      // Build create artifact input
      const input: CreateArtifactInput = {
        type: type as ArtifactType,
        title,
        content,
        sessionId,
        language,
        queries,
        identifier,
        filePath,
      };

      // Save using unified artifact store
      const artifact: UnifiedArtifact = await saveUnifiedArtifact(
        userSlug,
        ideaSlug,
        input,
      );

      console.log(
        `[IdeaArtifacts] Created artifact ${artifact.id} at ${artifact.filePath}`,
      );

      return res.status(201).json({
        success: true,
        data: {
          artifact,
        },
      });
    } catch (error) {
      console.error("[IdeaArtifacts] Error creating artifact:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ============================================================================
// GET /api/ideation/ideas/:userSlug/:ideaSlug/artifacts/:filePath
// ============================================================================
// Get a specific artifact by file path

ideationRouter.get(
  "/ideas/:userSlug/:ideaSlug/artifacts/:filePath(*)",
  async (req: Request, res: Response) => {
    try {
      const { userSlug, ideaSlug, filePath } = req.params;

      if (!userSlug || !ideaSlug || !filePath) {
        return res.status(400).json({
          error: "Validation error",
          message: "userSlug, ideaSlug, and filePath are required",
        });
      }

      console.log(
        `[IdeaArtifacts] Loading artifact ${filePath} for ${userSlug}/${ideaSlug}`,
      );

      // Load using unified artifact store
      const artifact = await loadUnifiedArtifact(userSlug, ideaSlug, filePath);

      if (!artifact) {
        return res.status(404).json({
          error: "Not found",
          message: `Artifact not found: ${filePath}`,
        });
      }

      console.log(`[IdeaArtifacts] Loaded artifact ${artifact.id}`);

      return res.json({
        success: true,
        data: {
          artifact,
        },
      });
    } catch (error) {
      console.error("[IdeaArtifacts] Error loading artifact:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ============================================================================
// DELETE /api/ideation/ideas/:userSlug/:ideaSlug/artifacts/:filePath
// ============================================================================
// Delete an artifact by file path

ideationRouter.delete(
  "/ideas/:userSlug/:ideaSlug/artifacts/:filePath(*)",
  async (req: Request, res: Response) => {
    try {
      const { userSlug, ideaSlug, filePath } = req.params;

      if (!userSlug || !ideaSlug || !filePath) {
        return res.status(400).json({
          error: "Validation error",
          message: "userSlug, ideaSlug, and filePath are required",
        });
      }

      console.log(
        `[IdeaArtifacts] Deleting artifact ${filePath} for ${userSlug}/${ideaSlug}`,
      );

      // Delete using unified artifact store
      const deleted = await deleteUnifiedArtifact(userSlug, ideaSlug, filePath);

      if (!deleted) {
        return res.status(404).json({
          error: "Not found",
          message: `Artifact not found: ${filePath}`,
        });
      }

      console.log(`[IdeaArtifacts] Deleted artifact ${filePath}`);

      return res.json({
        success: true,
        message: "Artifact deleted",
      });
    } catch (error) {
      console.error("[IdeaArtifacts] Error deleting artifact:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ============================================================================
// POST /api/ideation/session
// ============================================================================
// Creates a new session with optional idea linking.
// When userSlug is provided without ideaSlug, creates a draft folder.

const CreateSessionWithUserSchema = z.object({
  userSlug: z.string().min(1, "userSlug is required"),
  ideaSlug: z.string().optional(),
  profileId: z.string().optional(),
});

ideationRouter.post("/session", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parseResult = CreateSessionWithUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error",
        details: parseResult.error.issues,
      });
    }

    const { userSlug, ideaSlug, profileId } = parseResult.data;
    let finalIdeaSlug = ideaSlug;

    console.log(
      `[Session] Creating session for user ${userSlug}, ideaSlug: ${ideaSlug || "none (will create draft)"}`,
    );

    // If no ideaSlug provided, create a draft folder
    if (!ideaSlug) {
      const draftResult = await createDraftFolder(userSlug);
      finalIdeaSlug = draftResult.draftId;
      console.log(
        `[Session] Created draft folder: ${draftResult.draftId} at ${draftResult.path}`,
      );
    } else {
      // Validate that idea folder exists if ideaSlug is provided
      if (!ideaFolderExists(userSlug, ideaSlug)) {
        return res.status(400).json({
          error: "Idea folder not found",
          message: `No idea folder exists at users/${userSlug}/ideas/${ideaSlug}`,
        });
      }
    }

    // Create session in database
    const db = await import("../../database/db.js");
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      `
      INSERT INTO ideation_sessions (
        id, profile_id, user_slug, idea_slug, status, current_phase, entry_mode,
        started_at, last_activity_at,
        handoff_count, token_count, message_count
      )
      VALUES (?, ?, ?, ?, 'active', 'exploring', 'discover', ?, ?, 0, 0, 0)
    `,
      [sessionId, profileId ?? null, userSlug, finalIdeaSlug, now, now] as (
        | string
        | number
        | boolean
        | null
      )[],
    );

    await db.saveDb();

    // Return session details
    return res.status(201).json({
      success: true,
      id: sessionId,
      userSlug,
      ideaSlug: finalIdeaSlug,
      status: "active",
      currentPhase: "exploring",
      entryMode: "discover",
      startedAt: now,
      lastActivityAt: now,
    });
  } catch (error) {
    console.error("[Session] Error creating session:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// CONTEXT MANAGEMENT ENDPOINTS (Memory Graph Migration)
// ============================================================================

/**
 * GET /api/ideation/session/:sessionId/context-status
 * Check if context limit is approaching
 */
ideationRouter.get(
  "/session/:sessionId/context-status",
  async (req: Request, res: Response) => {
    try {
      const tokensUsed = Number(req.query.tokensUsed) || 0;
      const tokenLimit = Number(req.query.tokenLimit) || 100000;

      const status = contextManager.checkContextStatus(tokensUsed, tokenLimit);

      return res.json(status);
    } catch (error) {
      console.error("[Context] Error checking status:", error);
      return res.status(500).json({ error: "Failed to check context status" });
    }
  },
);

/**
 * POST /api/ideation/session/:sessionId/save-to-graph
 * Save conversation insights to memory graph
 */
ideationRouter.post(
  "/session/:sessionId/save-to-graph",
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { ideaId } = req.body;

      if (!ideaId) {
        return res.status(400).json({ error: "ideaId is required" });
      }

      const result = await contextManager.saveConversationToGraph(
        sessionId,
        ideaId,
      );
      return res.json(result);
    } catch (error) {
      console.error("[Context] Error saving to graph:", error);
      return res.status(500).json({ error: "Failed to save to graph" });
    }
  },
);

/**
 * GET /api/ideation/idea/:ideaId/session-context
 * Get context from graph for new session
 */
ideationRouter.get(
  "/idea/:ideaId/session-context",
  async (req: Request, res: Response) => {
    try {
      const { ideaId } = req.params;
      const context = await contextManager.prepareNewSessionContext(ideaId);
      return res.json({ context });
    } catch (error) {
      console.error("[Context] Error preparing session context:", error);
      return res
        .status(500)
        .json({ error: "Failed to prepare session context" });
    }
  },
);
