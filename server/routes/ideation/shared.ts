/**
 * Shared imports, schemas, and helper functions for ideation routes.
 * Split from the monolithic ideation.ts for better maintainability.
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import { getOne, query, saveDb } from "../../../database/db.js";
import { sessionManager } from "../../../agents/ideation/session-manager.js";
import { messageStore } from "../../../agents/ideation/message-store.js";
import { memoryManager } from "../../../agents/ideation/memory-manager.js";
import { agentOrchestrator } from "../../../agents/ideation/orchestrator.js";
import { generateGreetingWithButtons } from "../../../agents/ideation/greeting-generator.js";
import type { UserProfile } from "../../../agents/ideation/greeting-generator.js";
import { candidateManager } from "../../../agents/ideation/candidate-manager.js";
import {
  createSSEStream,
  StreamingResponseHandler,
} from "../../../agents/ideation/streaming.js";
import { client as anthropicClient } from "../../../utils/anthropic-client.js";
import { buildSystemPrompt } from "../../../agents/ideation/system-prompt.js";
import { performWebSearch } from "../../../agents/ideation/web-search-service.js";
import type { SearchPurpose } from "../../../agents/ideation/web-search-service.js";
import { artifactStore } from "../../../agents/ideation/artifact-store.js";
import {
  saveArtifact as saveUnifiedArtifact,
  loadArtifact as loadUnifiedArtifact,
  listArtifacts as listUnifiedArtifacts,
  deleteArtifact as deleteUnifiedArtifact,
} from "../../../agents/ideation/unified-artifact-store.js";
import type {
  UnifiedArtifact,
  CreateArtifactInput,
  ArtifactType,
} from "../../../agents/ideation/unified-artifact-store.js";
import {
  ideaFolderExists,
  createDraftFolder,
  renameDraftToIdea,
} from "../../../utils/folder-structure.js";
import type { IdeaType, ParentInfo } from "../../../utils/folder-structure.js";
import { subAgentStore } from "../../../agents/ideation/subagent-store.js";
import {
  editArtifact,
  detectArtifactEditRequest,
} from "../../../agents/ideation/artifact-editor.js";
import {
  emitSessionEvent,
  emitSubAgentSpawn,
  emitSubAgentStatus,
  emitSubAgentResult,
} from "../../websocket.js";
import { subAgentManager } from "../../../agents/ideation/sub-agent-manager.js";
import type { SubAgentTask as ManagerSubAgentTask } from "../../../agents/ideation/sub-agent-manager.js";

// Re-export commonly used items
export {
  Router,
  Request,
  Response,
  NextFunction,
  z,
  uuidv4,
  Anthropic,
  getOne,
  query,
  saveDb,
  sessionManager,
  messageStore,
  memoryManager,
  agentOrchestrator,
  generateGreetingWithButtons,
  UserProfile,
  candidateManager,
  createSSEStream,
  StreamingResponseHandler,
  anthropicClient,
  buildSystemPrompt,
  performWebSearch,
  SearchPurpose,
  artifactStore,
  saveUnifiedArtifact,
  loadUnifiedArtifact,
  listUnifiedArtifacts,
  deleteUnifiedArtifact,
  UnifiedArtifact,
  CreateArtifactInput,
  ArtifactType,
  subAgentStore,
  editArtifact,
  detectArtifactEditRequest,
  ideaFolderExists,
  createDraftFolder,
  renameDraftToIdea,
  IdeaType,
  ParentInfo,
  emitSessionEvent,
  emitSubAgentSpawn,
  emitSubAgentStatus,
  emitSubAgentResult,
  subAgentManager,
  ManagerSubAgentTask,
};

// ============================================================================
// REQUEST TIMEOUT MIDDLEWARE
// ============================================================================

export const REQUEST_TIMEOUT_MS = 400000; // 400 seconds

export const timeoutMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Set a server-side timeout
  req.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      console.error(
        `[Ideation] Request timeout after ${REQUEST_TIMEOUT_MS}ms for ${req.method} ${req.path}`,
      );
      res.status(504).json({
        error: "Request timeout",
        message: `The request took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds. Please try again.`,
      });
    }
  });

  // Also set socket timeout
  if (req.socket) {
    req.socket.setTimeout(REQUEST_TIMEOUT_MS);
  }

  // Set response headers for long-running requests
  res.setHeader("Connection", "keep-alive");
  res.setHeader(
    "Keep-Alive",
    `timeout=${Math.floor(REQUEST_TIMEOUT_MS / 1000)}`,
  );

  next();
};

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const StartSessionSchema = z.object({
  profileId: z.string().min(1, "profileId is required"),
});

export const SendMessageSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  message: z.string().min(1, "message is required"),
});

export const ButtonClickSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  buttonId: z.string().min(1, "buttonId is required"),
  buttonValue: z.string(),
  buttonLabel: z.string().optional(),
});

export const CaptureIdeaSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export const FormSubmitSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  formId: z.string().min(1, "formId is required"),
  responses: z.record(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  ),
});

export const SaveForLaterSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  candidateId: z.string().optional(),
  notes: z.string().optional(),
});

export const DiscardAndRestartSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  reason: z.string().optional(),
});

export const EditMessageSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  messageId: z.string().min(1, "messageId is required"),
  newContent: z.string().min(1, "newContent is required"),
});

export const WebSearchSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  queries: z.array(z.string()).min(1, "At least one query is required"),
  context: z.string().optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export async function getProfileById(
  profileId: string,
): Promise<UserProfile | null> {
  const profile = await getOne<{
    id: string;
    name: string;
    technical_skills: string | null;
    interests: string | null;
    professional_experience: string | null;
    city: string | null;
    country: string | null;
  }>(
    "SELECT id, name, technical_skills, interests, professional_experience, city, country FROM user_profiles WHERE id = ?",
    [profileId],
  );

  if (!profile) return null;

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

export async function createIdea(params: {
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

/**
 * Creates a sub-agent status callback with proper deduplication.
 */
export function createSubAgentStatusCallback(
  sessionId: string,
  logPrefix: string = "[SubAgent]",
): (tasks: ManagerSubAgentTask[]) => void {
  const emittedStatuses = new Set<string>();
  const savedArtifacts = new Set<string>();

  return (tasks: ManagerSubAgentTask[]) => {
    for (const task of tasks) {
      const statusKey = `${task.id}:${task.status}`;

      if (emittedStatuses.has(statusKey)) {
        continue;
      }

      console.log(`${logPrefix} Task ${task.id} status: ${task.status}`);
      emittedStatuses.add(statusKey);

      if (
        task.status === "running" ||
        task.status === "completed" ||
        task.status === "failed"
      ) {
        emitSubAgentStatus(sessionId, task.id, task.status, task.error);

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

      if (
        task.status === "completed" &&
        task.result &&
        !savedArtifacts.has(task.id)
      ) {
        savedArtifacts.add(task.id);
        emitSubAgentResult(sessionId, task.id, task.result);

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
