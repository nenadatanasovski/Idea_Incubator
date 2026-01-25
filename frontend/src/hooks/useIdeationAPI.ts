// =============================================================================
// FILE: frontend/src/hooks/useIdeationAPI.ts
// API hooks for Ideation Agent
// =============================================================================

import { useCallback, useMemo } from "react";
import type {
  EntryMode,
  TokenUsageInfo,
  IdeationMessage,
  Artifact,
  ResearchResult,
} from "../types/ideation";
import type {
  ButtonOption,
  FormDefinition,
  IdeaCandidate,
  ViabilityRisk,
} from "../types";
import type {
  GraphUpdateAnalysis,
  GraphSnapshotSummary,
} from "../types/ideation-state";

const API_BASE = "/api/ideation";

interface StartSessionResponse {
  sessionId: string;
  greeting: string;
  buttons?: ButtonOption[];
}

interface ArtifactUpdateResponse {
  id: string;
  content: string;
  title?: string;
  updatedAt: string;
}

interface SubAgentTask {
  id: string;
  type: string;
  label: string;
  prompt?: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface FollowUpContext {
  reason: "no_question" | "artifact_created" | "search_initiated";
  artifactType?: string;
  artifactTitle?: string;
  searchQueries?: string[];
  lastUserMessage: string;
  sessionId: string;
  assistantMessageId: string;
}

interface MessageResponse {
  userMessageId?: string;
  messageId?: string;
  reply: string;
  buttons?: ButtonOption[];
  form?: FormDefinition;
  candidateUpdate?: IdeaCandidate;
  confidence?: number;
  viability?: number;
  risks?: ViabilityRisk[];
  intervention?: { type: "warning" | "critical" };
  tokenUsage?: TokenUsageInfo;
  webSearchQueries?: string[]; // Queries to execute async
  artifact?: Artifact; // Visual artifact from agent
  artifactUpdate?: ArtifactUpdateResponse; // Update to existing artifact
  // Quick-ack fields for parallel sub-agent execution
  isQuickAck?: boolean;
  subAgentTasks?: SubAgentTask[];
  // Follow-up fields for async engagement
  followUpPending?: boolean;
  followUpContext?: FollowUpContext;
}

interface WebSearchResponse {
  success: boolean;
  artifact: {
    id: string;
    type: "research";
    title: string;
    content: ResearchResult[];
    queries: string[];
    timestamp: string;
  };
}

interface EditMessageResponse extends MessageResponse {
  deletedCount: number;
}

interface CaptureResponse {
  ideaId: string;
  ideaSlug: string;
}

interface SessionResponse {
  sessionId: string;
  profileId: string;
  status: string;
  entryMode: string;
  messages: IdeationMessage[];
  candidate?: IdeaCandidate;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  tokenUsage: TokenUsageInfo;
}

interface SessionListResponse {
  sessions: Array<{
    id: string;
    profileId: string;
    status: string;
    entryMode: string;
    messageCount: number;
    candidateTitle?: string;
    confidence?: number;
    viability?: number;
    lastActivityAt: string;
  }>;
}

export function useIdeationAPI() {
  const startSession = useCallback(
    async (
      profileId: string,
      entryMode: EntryMode,
    ): Promise<StartSessionResponse> => {
      const response = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, entryMode }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to start session" } }));
        throw new Error(error.error?.message || "Failed to start session");
      }

      return response.json();
    },
    [],
  );

  const sendMessage = useCallback(
    async (sessionId: string, message: string): Promise<MessageResponse> => {
      const response = await fetch(`${API_BASE}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to send message" }));
        // Handle both { error: "string" } and { error: { message: "string" } } formats
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.error?.message || "Failed to send message";
        throw new Error(errorMessage);
      }

      return response.json();
    },
    [],
  );

  const editMessage = useCallback(
    async (
      sessionId: string,
      messageId: string,
      newContent: string,
    ): Promise<EditMessageResponse> => {
      const response = await fetch(`${API_BASE}/message/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messageId, newContent }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to edit message" }));
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.error?.message || "Failed to edit message";
        throw new Error(errorMessage);
      }

      return response.json();
    },
    [],
  );

  const clickButton = useCallback(
    async (
      sessionId: string,
      buttonId: string,
      buttonValue: string,
      buttonLabel?: string,
    ): Promise<MessageResponse> => {
      const response = await fetch(`${API_BASE}/button`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, buttonId, buttonValue, buttonLabel }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: { message: "Failed to process button click" },
        }));
        throw new Error(
          error.error?.message || "Failed to process button click",
        );
      }

      return response.json();
    },
    [],
  );

  const submitForm = useCallback(
    async (
      sessionId: string,
      formId: string,
      answers: Record<string, unknown>,
    ): Promise<MessageResponse> => {
      const response = await fetch(`${API_BASE}/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, formId, answers }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to submit form" } }));
        throw new Error(error.error?.message || "Failed to submit form");
      }

      return response.json();
    },
    [],
  );

  const captureIdea = useCallback(
    async (sessionId: string): Promise<CaptureResponse> => {
      const response = await fetch(`${API_BASE}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to capture idea" } }));
        throw new Error(error.error?.message || "Failed to capture idea");
      }

      return response.json();
    },
    [],
  );

  const saveForLater = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: "Failed to save session" } }));
      throw new Error(error.error?.message || "Failed to save session");
    }
  }, []);

  const discardSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to discard session" } }));
        throw new Error(error.error?.message || "Failed to discard session");
      }
    },
    [],
  );

  const abandonSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/session/${sessionId}/abandon`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to abandon session" } }));
        throw new Error(error.error?.message || "Failed to abandon session");
      }
    },
    [],
  );

  const getSession = useCallback(
    async (sessionId: string): Promise<SessionResponse> => {
      const response = await fetch(`${API_BASE}/session/${sessionId}`);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to get session" } }));
        throw new Error(error.error?.message || "Failed to get session");
      }

      return response.json();
    },
    [],
  );

  const loadSession = useCallback(
    async (
      sessionId: string,
    ): Promise<{
      session: {
        id: string;
        profileId: string;
        status: string;
        entryMode: string | null;
        userSlug?: string | null;
        ideaSlug?: string | null;
      };
      messages: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        buttonsShown?: unknown[];
        formShown?: unknown;
        createdAt: string;
      }>;
      candidate: {
        id: string;
        title: string;
        summary: string | null;
        confidence: number;
        viability: number;
      } | null;
      artifacts?: Artifact[];
      subAgents?: Array<{
        id: string;
        sessionId: string;
        type: string;
        name: string;
        status: "pending" | "spawning" | "running" | "completed" | "failed";
        result?: string;
        error?: string;
        startedAt: string;
        completedAt?: string;
      }>;
    }> => {
      const response = await fetch(`${API_BASE}/session/${sessionId}`);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to load session" } }));
        throw new Error(error.error?.message || "Failed to load session");
      }

      return response.json();
    },
    [],
  );

  const listSessions = useCallback(
    async (
      profileId: string,
      status?: string,
    ): Promise<SessionListResponse> => {
      const params = new URLSearchParams({ profileId });
      if (status) params.append("status", status);

      const response = await fetch(`${API_BASE}/sessions?${params}`);

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Failed to list sessions" } }));
        throw new Error(error.error?.message || "Failed to list sessions");
      }

      return response.json();
    },
    [],
  );

  /**
   * Delete an artifact from the database
   */
  const deleteArtifact = useCallback(
    async (
      sessionId: string,
      artifactId: string,
    ): Promise<{ success: boolean }> => {
      const response = await fetch(`${API_BASE}/artifact/${artifactId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to delete artifact" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to delete artifact",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Save an artifact to the database
   */
  const saveArtifact = useCallback(
    async (
      sessionId: string,
      artifact: {
        id: string;
        type: string;
        title: string;
        content: string | object;
        language?: string;
        identifier?: string;
      },
    ): Promise<{ success: boolean; artifactId: string }> => {
      const response = await fetch(`${API_BASE}/artifact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, artifact }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to save artifact" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to save artifact",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Update candidate details (title, summary)
   */
  const updateCandidate = useCallback(
    async (
      sessionId: string,
      updates: { title?: string; summary?: string },
    ): Promise<{ success: boolean; candidate: IdeaCandidate }> => {
      const response = await fetch(`${API_BASE}/candidate/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...updates }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to update candidate" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to update candidate",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Link a session to a specific user/idea
   */
  const linkIdea = useCallback(
    async (
      sessionId: string,
      userSlug: string,
      ideaSlug: string,
    ): Promise<{ success: boolean }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/link-idea`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userSlug, ideaSlug }),
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to link idea" }));
        throw new Error(
          typeof error.error === "string" ? error.error : "Failed to link idea",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Execute async web search and return results as an artifact
   */
  const executeWebSearch = useCallback(
    async (
      sessionId: string,
      queries: string[],
      context?: string,
    ): Promise<Artifact> => {
      const response = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, queries, context }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Web search failed" }));
        throw new Error(
          typeof error.error === "string" ? error.error : "Web search failed",
        );
      }

      const data: WebSearchResponse = await response.json();

      // Convert to Artifact format
      return {
        id: data.artifact.id,
        type: "research",
        title: data.artifact.title,
        content: data.artifact.content,
        queries: data.artifact.queries,
        status: "ready",
        createdAt: data.artifact.timestamp,
        identifier: `research_${queries[0]?.slice(0, 20).replace(/\s+/g, "_").toLowerCase() || "results"}`,
      };
    },
    [],
  );

  /**
   * Trigger async follow-up question generation.
   * Called when the main response lacks engagement (no question, no buttons).
   */
  const triggerFollowUp = useCallback(
    async (
      sessionId: string,
      context: FollowUpContext,
    ): Promise<{
      success: boolean;
      messageId?: string;
      text?: string;
      buttons?: ButtonOption[];
    }> => {
      try {
        const response = await fetch(`${API_BASE}/follow-up`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, context }),
        });

        if (!response.ok) {
          console.error("[useIdeationAPI] Follow-up request failed");
          return { success: false };
        }

        return response.json();
      } catch (error) {
        console.error("[useIdeationAPI] Error triggering follow-up:", error);
        return { success: false };
      }
    },
    [],
  );

  /**
   * Analyze session for potential graph updates.
   * Uses AI to extract proposed blocks and links from conversation.
   * @param selectedSourceIds - Optional array of source IDs to include in analysis
   * @param ideaSlug - Optional idea slug to include file-based artifacts from idea folder
   */
  const analyzeGraphChanges = useCallback(
    async (
      sessionId: string,
      selectedSourceIds?: string[],
      ideaSlug?: string,
    ): Promise<GraphUpdateAnalysis> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/analyze-changes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedSourceIds, ideaSlug }),
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to analyze graph changes" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to analyze graph changes",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Reset (clear) all blocks and links for a session.
   */
  const resetGraph = useCallback(
    async (
      sessionId: string,
    ): Promise<{
      success: boolean;
      blocksDeleted: number;
      linksDeleted: number;
    }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/reset`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to reset graph" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to reset graph",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Apply selected graph changes to the memory graph.
   */
  const applyGraphChanges = useCallback(
    async (
      sessionId: string,
      changeIds: string[],
      changes?: Array<{
        id: string;
        type: "create_block" | "update_block" | "create_link";
        blockType?: string;
        title?: string; // Short 3-5 word summary
        content?: string; // Optional for create_link types which don't have content
        graphMembership?: string[];
        confidence?: number;
        // Source attribution - CRITICAL for tracking where insights came from
        sourceId?: string; // ID of the source (message ID, artifact ID, etc.)
        sourceType?: string; // e.g., "conversation_insight", "artifact", "memory_file"
        sourceWeight?: number; // Reliability weight 0-1
        corroboratedBy?: Array<{
          sourceId: string;
          sourceType: string;
          snippet?: string;
        }>;
        sourceMessageId?: string; // Legacy field
        sourceBlockId?: string;
        targetBlockId?: string;
        linkType?: string;
        reason?: string; // Reason for the link
        // Supersession handling
        supersedesBlockId?: string; // If this block supersedes an existing block
        supersessionReason?: string; // Reason for superseding
        // For update_block status changes
        blockId?: string; // Target block for updates
        statusChange?: {
          blockId?: string;
          newStatus: "superseded" | "abandoned";
          reason?: string;
        };
      }>,
    ): Promise<{
      success: boolean;
      blocksCreated: number;
      linksCreated: number;
      blocksUpdated: number;
    }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/apply-changes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changeIds, changes }),
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to apply graph changes" }));
        // Include validation details in error message if available
        let errorMessage = "Failed to apply graph changes";
        if (typeof error.error === "string") {
          errorMessage = error.error;
          if (error.details && Array.isArray(error.details)) {
            const detailsStr = error.details
              .map(
                (d: { path?: string[]; message?: string }) =>
                  `${d.path?.join(".") || "field"}: ${d.message || "invalid"}`,
              )
              .join("; ");
            errorMessage += `: ${detailsStr}`;
            console.error(
              "[applyGraphChanges] Validation details:",
              error.details,
            );
          }
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    [],
  );

  // ============================================================================
  // Graph Snapshot / Versioning Methods
  // ============================================================================

  /**
   * List all snapshots for a session (metadata only)
   */
  const listGraphSnapshots = useCallback(
    async (
      sessionId: string,
    ): Promise<{ success: boolean; snapshots: GraphSnapshotSummary[] }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/snapshots`,
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to list snapshots" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to list snapshots",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Create a new snapshot of the current graph state
   */
  const createGraphSnapshot = useCallback(
    async (
      sessionId: string,
      name: string,
      description?: string,
    ): Promise<{ success: boolean; snapshot: GraphSnapshotSummary }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/snapshots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to create snapshot" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to create snapshot",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Restore graph to a previous snapshot state
   */
  const restoreGraphSnapshot = useCallback(
    async (
      sessionId: string,
      snapshotId: string,
    ): Promise<{
      success: boolean;
      restoredAt: string;
      blockCount: number;
      linkCount: number;
    }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/snapshots/${snapshotId}/restore`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to restore snapshot" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to restore snapshot",
        );
      }

      return response.json();
    },
    [],
  );

  /**
   * Delete a snapshot
   */
  const deleteGraphSnapshot = useCallback(
    async (
      sessionId: string,
      snapshotId: string,
    ): Promise<{ success: boolean }> => {
      const response = await fetch(
        `${API_BASE}/session/${sessionId}/graph/snapshots/${snapshotId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to delete snapshot" }));
        throw new Error(
          typeof error.error === "string"
            ? error.error
            : "Failed to delete snapshot",
        );
      }

      return response.json();
    },
    [],
  );

  return useMemo(
    () => ({
      startSession,
      sendMessage,
      editMessage,
      clickButton,
      submitForm,
      captureIdea,
      saveForLater,
      discardSession,
      abandonSession,
      getSession,
      loadSession,
      listSessions,
      executeWebSearch,
      saveArtifact,
      deleteArtifact,
      updateCandidate,
      linkIdea,
      triggerFollowUp,
      analyzeGraphChanges,
      applyGraphChanges,
      resetGraph,
      // Snapshot/versioning
      listGraphSnapshots,
      createGraphSnapshot,
      restoreGraphSnapshot,
      deleteGraphSnapshot,
    }),
    [
      startSession,
      sendMessage,
      editMessage,
      clickButton,
      submitForm,
      captureIdea,
      saveForLater,
      discardSession,
      abandonSession,
      getSession,
      loadSession,
      listSessions,
      executeWebSearch,
      saveArtifact,
      deleteArtifact,
      updateCandidate,
      linkIdea,
      triggerFollowUp,
      analyzeGraphChanges,
      applyGraphChanges,
      resetGraph,
      listGraphSnapshots,
      createGraphSnapshot,
      restoreGraphSnapshot,
      deleteGraphSnapshot,
    ],
  );
}
