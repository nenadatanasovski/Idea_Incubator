// =============================================================================
// FILE: frontend/src/reducers/ideationReducer.ts
// State management reducer for Ideation Agent
// =============================================================================

import type {
  IdeationStore,
  IdeationAction,
  TokenUsageInfo,
} from "../types/ideation-state";

const DEFAULT_TOKEN_USAGE: TokenUsageInfo = {
  total: 0,
  limit: 100000,
  percentUsed: 0,
  shouldHandoff: false,
};

export const initialState: IdeationStore = {
  session: {
    sessionId: null,
    profileId: "",
    status: "idle",
    entryMode: null,
    error: null,
    title: null,
  },
  conversation: {
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: "",
    error: null,
    followUpPending: false,
  },
  candidate: {
    candidate: null,
    confidence: 0,
    viability: 100,
    risks: [],
    showIntervention: false,
    interventionType: null,
  },
  tokens: {
    usage: DEFAULT_TOKEN_USAGE,
    handoffPending: false,
    handoffCount: 0,
  },
  artifacts: {
    artifacts: [],
    currentArtifact: null,
    isLoading: false,
    isPanelOpen: false,
    linkedIdea: null,
    viewMode: "files",
    selectedArtifactPath: null,
    artifactClassifications: {},
  },
  subAgents: {
    subAgents: [],
    activeCount: 0,
    triggerMessageId: null,
  },
  spec: {
    spec: null,
    sections: [],
    readiness: null,
    isGenerating: false,
    isEditing: false,
    isSaving: false,
    error: null,
  },
  memoryGraph: {
    pendingChangesCount: 0,
    isAnalyzing: false,
    isModalOpen: false,
    analysis: null,
    selectedChangeIds: [],
    isApplying: false,
    error: null,
    // Timestamp tracking for incremental analysis
    lastAnalyzedAt: null,
    // Applied insights - persisted after changes are applied to the graph
    appliedInsights: [],
    // Snapshot/versioning state
    snapshots: [],
    isLoadingSnapshots: false,
    isSavingSnapshot: false,
    isRestoringSnapshot: false,
    snapshotError: null,
  },
  context: {
    status: null,
    isSaving: false,
    saveResult: null,
  },
};

export function ideationReducer(
  state: IdeationStore,
  action: IdeationAction,
): IdeationStore {
  switch (action.type) {
    // =========================================================================
    // Session Actions
    // =========================================================================
    case "SESSION_START":
      return {
        ...state,
        session: {
          ...state.session,
          profileId: action.payload.profileId,
          entryMode: action.payload.entryMode,
          status: "loading",
          error: null,
        },
      };

    case "SESSION_CREATED":
      return {
        ...state,
        session: {
          ...state.session,
          sessionId: action.payload.sessionId,
          status: "active",
        },
      };

    case "SESSION_ERROR":
      return {
        ...state,
        session: {
          ...state.session,
          status: "error",
          error: action.payload.error,
        },
      };

    case "SESSION_COMPLETE":
      return {
        ...state,
        session: {
          ...state.session,
          status: "completed",
        },
      };

    case "SESSION_ABANDON":
      return {
        ...state,
        session: {
          ...state.session,
          status: "abandoned",
        },
      };

    case "SESSION_TITLE_UPDATE":
      return {
        ...state,
        session: {
          ...state.session,
          title: action.payload.title,
        },
      };

    // =========================================================================
    // Message Actions
    // =========================================================================
    case "MESSAGE_SEND":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: true,
          error: null,
        },
      };

    case "MESSAGE_STREAM_START":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isStreaming: true,
          streamingContent: "",
        },
      };

    case "MESSAGE_STREAM_CHUNK":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          streamingContent:
            state.conversation.streamingContent + action.payload.chunk,
        },
      };

    case "MESSAGE_STREAM_END":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload.message],
          isLoading: false,
          isStreaming: false,
          streamingContent: "",
        },
      };

    case "MESSAGE_RECEIVED":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload.message],
          // Only clear loading when assistant responds, not when adding user message
          isLoading:
            action.payload.message.role === "user"
              ? state.conversation.isLoading
              : false,
        },
      };

    case "MESSAGE_ERROR":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: false,
          isStreaming: false,
          error: action.payload.error,
        },
      };

    case "FOLLOWUP_PENDING_START":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          followUpPending: true,
        },
      };

    case "FOLLOWUP_PENDING_END":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          followUpPending: false,
        },
      };

    case "BUTTON_CLICK": {
      // Mark the button as clicked in the last message
      const messagesWithClick = [...state.conversation.messages];
      const lastIdx = messagesWithClick.length - 1;
      if (lastIdx >= 0 && messagesWithClick[lastIdx].role === "assistant") {
        messagesWithClick[lastIdx] = {
          ...messagesWithClick[lastIdx],
          buttonClicked: action.payload.buttonId,
        };
      }
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: messagesWithClick,
          isLoading: true,
        },
      };
    }

    case "FORM_SUBMIT":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: true,
        },
      };

    // =========================================================================
    // Candidate Actions
    // =========================================================================
    case "CANDIDATE_UPDATE":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          candidate: action.payload.candidate,
        },
        // Also update session title when candidate title changes (sync)
        session: {
          ...state.session,
          title: action.payload.candidate.title || state.session.title,
        },
      };

    case "CANDIDATE_CLEAR":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          candidate: null,
          confidence: 0,
          viability: 100,
          risks: [],
        },
      };

    case "CONFIDENCE_UPDATE":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          confidence: action.payload.confidence,
        },
      };

    case "VIABILITY_UPDATE":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          viability: action.payload.viability,
          risks: action.payload.risks || state.candidate.risks,
        },
      };

    case "INTERVENTION_SHOW":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          showIntervention: true,
          interventionType: action.payload.type,
        },
      };

    case "INTERVENTION_DISMISS":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          showIntervention: false,
          interventionType: null,
        },
      };

    // =========================================================================
    // Token Actions
    // =========================================================================
    case "TOKEN_UPDATE":
      return {
        ...state,
        tokens: {
          ...state.tokens,
          usage: action.payload.usage,
        },
      };

    case "HANDOFF_PENDING":
      return {
        ...state,
        tokens: {
          ...state.tokens,
          handoffPending: true,
        },
      };

    case "HANDOFF_COMPLETE":
      return {
        ...state,
        tokens: {
          ...state.tokens,
          handoffPending: false,
          handoffCount: state.tokens.handoffCount + 1,
        },
      };

    case "MESSAGES_TRUNCATE": {
      // Find the index of the message to truncate from
      const messageIndex = state.conversation.messages.findIndex(
        (m) => m.id === action.payload.messageId,
      );
      if (messageIndex === -1) {
        return state;
      }
      // Keep all messages before the specified message
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: state.conversation.messages.slice(0, messageIndex),
        },
      };
    }

    case "MESSAGE_UPDATE_ID": {
      // Update a message's ID (used to sync frontend IDs with backend IDs)
      const updatedMessages = state.conversation.messages.map((m) =>
        m.id === action.payload.oldId ? { ...m, id: action.payload.newId } : m,
      );
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: updatedMessages,
        },
      };
    }

    case "MESSAGE_CONTENT_UPDATE": {
      // Update a message's content (used for async artifact edit completion)
      const messagesWithUpdate = state.conversation.messages.map((m) =>
        m.id === action.payload.messageId
          ? { ...m, content: action.payload.content }
          : m,
      );
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: messagesWithUpdate,
        },
      };
    }

    // =========================================================================
    // Artifact Actions
    // =========================================================================
    case "ARTIFACT_ADD":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          artifacts: [...state.artifacts.artifacts, action.payload.artifact],
          // Auto-open panel and select the new artifact
          isPanelOpen: true,
          currentArtifact: action.payload.artifact,
        },
      };

    case "ARTIFACT_UPDATE": {
      const updatedArtifacts = state.artifacts.artifacts.map((a) =>
        a.id === action.payload.id ? { ...a, ...action.payload.updates } : a,
      );
      // Also update currentArtifact if it's the one being updated
      const updatedCurrent =
        state.artifacts.currentArtifact?.id === action.payload.id
          ? { ...state.artifacts.currentArtifact, ...action.payload.updates }
          : state.artifacts.currentArtifact;
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          artifacts: updatedArtifacts,
          currentArtifact: updatedCurrent,
        },
      };
    }

    case "ARTIFACT_REMOVE": {
      const remainingArtifacts = state.artifacts.artifacts.filter(
        (a) => a.id !== action.payload.id,
      );
      const isCurrentDeleted =
        state.artifacts.currentArtifact?.id === action.payload.id;

      let newCurrentArtifact = state.artifacts.currentArtifact;
      if (isCurrentDeleted) {
        // Find the index of the deleted artifact to select a nearby one
        const deletedIndex = state.artifacts.artifacts.findIndex(
          (a) => a.id === action.payload.id,
        );
        if (remainingArtifacts.length > 0) {
          // Select the artifact at the same index, or the last one if we deleted the last
          const newIndex = Math.min(
            deletedIndex,
            remainingArtifacts.length - 1,
          );
          newCurrentArtifact = remainingArtifacts[newIndex];
        } else {
          newCurrentArtifact = null;
        }
      }

      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          artifacts: remainingArtifacts,
          currentArtifact: newCurrentArtifact,
          // Close panel if no artifacts remain
          isPanelOpen:
            remainingArtifacts.length > 0 ? state.artifacts.isPanelOpen : false,
        },
      };
    }

    case "ARTIFACT_SELECT":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          currentArtifact: action.payload.artifact,
          isPanelOpen: action.payload.artifact !== null,
        },
      };

    case "ARTIFACT_LOADING_START":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          isLoading: true,
          artifacts: state.artifacts.artifacts.map((a) =>
            a.id === action.payload.id
              ? { ...a, status: "loading" as const }
              : a,
          ),
        },
      };

    case "ARTIFACT_LOADING_END": {
      const newStatus = action.payload.error ? "error" : "ready";
      const finalArtifacts = state.artifacts.artifacts.map((a) =>
        a.id === action.payload.id
          ? {
              ...a,
              status: newStatus as "error" | "ready",
              error: action.payload.error,
            }
          : a,
      );
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          isLoading: false,
          artifacts: finalArtifacts,
        },
      };
    }

    case "ARTIFACT_PANEL_TOGGLE":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          isPanelOpen: action.payload.isOpen,
        },
      };

    case "ARTIFACTS_CLEAR":
      return {
        ...state,
        artifacts: {
          artifacts: [],
          currentArtifact: null,
          isLoading: false,
          isPanelOpen: false,
          linkedIdea: null,
          viewMode: "files",
          selectedArtifactPath: null,
          artifactClassifications: {},
        },
      };

    // =========================================================================
    // Unified File System Actions
    // =========================================================================
    case "SET_LINKED_IDEA":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          linkedIdea: action.payload,
        },
      };

    case "SET_VIEW_MODE":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          viewMode: action.payload.viewMode,
        },
      };

    case "SET_SELECTED_ARTIFACT":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          selectedArtifactPath: action.payload.path,
        },
      };

    case "SET_ARTIFACT_CLASSIFICATIONS":
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          artifactClassifications: action.payload.classifications,
        },
      };

    // =========================================================================
    // Sub-Agent Actions
    // =========================================================================
    case "SUBAGENT_SPAWN": {
      // Check if agent already exists (may have been created by early status update)
      const existingAgentIndex = state.subAgents.subAgents.findIndex(
        (agent) => agent.id === action.payload.id,
      );

      if (existingAgentIndex !== -1) {
        // Agent exists (created by early status update) - update name/type but keep status
        console.log(
          "[Reducer] SUBAGENT_SPAWN updating existing agent:",
          action.payload.id,
        );
        const updatedSubAgents = state.subAgents.subAgents.map((agent) =>
          agent.id === action.payload.id
            ? { ...agent, name: action.payload.name, type: action.payload.type }
            : agent,
        );
        return {
          ...state,
          subAgents: {
            ...state.subAgents,
            subAgents: updatedSubAgents,
          },
        };
      }

      // Agent doesn't exist - create it
      const newSubAgent = {
        id: action.payload.id,
        type: action.payload.type,
        name: action.payload.name,
        status: "spawning" as const,
        startedAt: new Date().toISOString(),
      };
      return {
        ...state,
        subAgents: {
          subAgents: [...state.subAgents.subAgents, newSubAgent],
          activeCount: state.subAgents.activeCount + 1,
          // Set triggerMessageId if provided and this is the first agent
          triggerMessageId:
            action.payload.triggerMessageId ?? state.subAgents.triggerMessageId,
        },
      };
    }

    case "SUBAGENT_STATUS": {
      // Check if agent exists
      const existingAgentIndex = state.subAgents.subAgents.findIndex(
        (agent) => agent.id === action.payload.id,
      );

      let updatedSubAgents: typeof state.subAgents.subAgents;

      if (existingAgentIndex === -1) {
        // ROBUST FIX: Agent doesn't exist - create it with this status
        // This handles race conditions where status arrives before spawn
        console.log(
          "[Reducer] SUBAGENT_STATUS creating agent (race condition fix):",
          action.payload.id,
          action.payload.status,
        );
        const newAgent = {
          id: action.payload.id,
          type: "custom" as const,
          name: action.payload.id, // Placeholder - will show ID until spawn event arrives
          status: action.payload.status,
          startedAt: new Date().toISOString(),
          error: action.payload.error,
          ...(action.payload.status === "completed" ||
          action.payload.status === "failed"
            ? { completedAt: new Date().toISOString() }
            : {}),
        };
        updatedSubAgents = [...state.subAgents.subAgents, newAgent];
      } else {
        // Agent exists - update it
        updatedSubAgents = state.subAgents.subAgents.map((agent) =>
          agent.id === action.payload.id
            ? {
                ...agent,
                status: action.payload.status,
                error: action.payload.error,
                ...(action.payload.status === "completed" ||
                action.payload.status === "failed"
                  ? { completedAt: new Date().toISOString() }
                  : {}),
              }
            : agent,
        );
      }

      // Calculate active count (spawning or running)
      const activeCount = updatedSubAgents.filter(
        (a) => a.status === "spawning" || a.status === "running",
      ).length;
      return {
        ...state,
        subAgents: {
          ...state.subAgents,
          subAgents: updatedSubAgents,
          activeCount,
        },
      };
    }

    case "SUBAGENT_RESULT": {
      // Check if agent exists
      const existingResultAgent = state.subAgents.subAgents.find(
        (agent) => agent.id === action.payload.id,
      );

      let subAgentsWithResult: typeof state.subAgents.subAgents;

      if (!existingResultAgent) {
        // ROBUST FIX: Agent doesn't exist - create it as completed
        console.log(
          "[Reducer] SUBAGENT_RESULT creating agent (race condition fix):",
          action.payload.id,
        );
        const newAgent = {
          id: action.payload.id,
          type: "custom" as const,
          name: action.payload.id,
          status: "completed" as const,
          result: action.payload.result,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        subAgentsWithResult = [...state.subAgents.subAgents, newAgent];
      } else {
        subAgentsWithResult = state.subAgents.subAgents.map((agent) =>
          agent.id === action.payload.id
            ? {
                ...agent,
                status: "completed" as const,
                result: action.payload.result,
                completedAt: new Date().toISOString(),
              }
            : agent,
        );
      }

      // Calculate active count (spawning or running)
      const activeAfterResult = subAgentsWithResult.filter(
        (a) => a.status === "spawning" || a.status === "running",
      ).length;
      return {
        ...state,
        subAgents: {
          ...state.subAgents,
          subAgents: subAgentsWithResult,
          activeCount: activeAfterResult,
        },
      };
    }

    case "SUBAGENT_CLEAR":
      return {
        ...state,
        subAgents: {
          subAgents: [],
          activeCount: 0,
          triggerMessageId: null,
        },
      };

    // =========================================================================
    // Spec Actions
    // =========================================================================
    case "SPEC_READINESS_UPDATE":
      return {
        ...state,
        spec: {
          ...state.spec,
          readiness: action.payload.readiness,
        },
      };

    case "SPEC_GENERATE_START":
      return {
        ...state,
        spec: {
          ...state.spec,
          isGenerating: true,
          error: null,
        },
      };

    case "SPEC_GENERATE_COMPLETE":
      return {
        ...state,
        spec: {
          ...state.spec,
          spec: action.payload.spec,
          sections: action.payload.sections,
          isGenerating: false,
          error: null,
        },
      };

    case "SPEC_GENERATE_ERROR":
      return {
        ...state,
        spec: {
          ...state.spec,
          isGenerating: false,
          error: action.payload.error,
        },
      };

    case "SPEC_LOAD":
      return {
        ...state,
        spec: {
          ...state.spec,
          spec: action.payload.spec,
          sections: action.payload.sections,
          error: null,
        },
      };

    case "SPEC_UPDATE":
      return {
        ...state,
        spec: {
          ...state.spec,
          spec: state.spec.spec
            ? { ...state.spec.spec, ...action.payload.updates }
            : null,
        },
      };

    case "SPEC_SECTION_UPDATE": {
      const updatedSections = state.spec.sections.map((section) =>
        section.id === action.payload.sectionId
          ? { ...section, content: action.payload.content }
          : section,
      );
      return {
        ...state,
        spec: {
          ...state.spec,
          sections: updatedSections,
        },
      };
    }

    case "SPEC_EDIT_START":
      return {
        ...state,
        spec: {
          ...state.spec,
          isEditing: true,
        },
      };

    case "SPEC_EDIT_CANCEL":
      return {
        ...state,
        spec: {
          ...state.spec,
          isEditing: false,
        },
      };

    case "SPEC_SAVE_START":
      return {
        ...state,
        spec: {
          ...state.spec,
          isSaving: true,
          error: null,
        },
      };

    case "SPEC_SAVE_COMPLETE":
      return {
        ...state,
        spec: {
          ...state.spec,
          spec: action.payload.spec,
          isEditing: false,
          isSaving: false,
          error: null,
        },
      };

    case "SPEC_SAVE_ERROR":
      return {
        ...state,
        spec: {
          ...state.spec,
          isSaving: false,
          error: action.payload.error,
        },
      };

    case "SPEC_WORKFLOW_TRANSITION":
      return {
        ...state,
        spec: {
          ...state.spec,
          spec: state.spec.spec
            ? { ...state.spec.spec, workflowState: action.payload.newState }
            : null,
        },
      };

    case "SPEC_CLEAR":
      return {
        ...state,
        spec: {
          spec: null,
          sections: [],
          readiness: null,
          isGenerating: false,
          isEditing: false,
          isSaving: false,
          error: null,
        },
      };

    // =========================================================================
    // Memory Graph Actions
    // =========================================================================
    case "MEMORY_GRAPH_ANALYSIS_START":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isAnalyzing: true,
          error: null,
        },
      };

    case "MEMORY_GRAPH_ANALYSIS_COMPLETE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isAnalyzing: false,
          analysis: action.payload.analysis,
          isModalOpen: true,
          selectedChangeIds: action.payload.analysis.proposedChanges.map(
            (c) => c.id,
          ),
          error: null,
          // Update timestamp when analysis completes
          lastAnalyzedAt: new Date().toISOString(),
        },
      };

    case "MEMORY_GRAPH_ANALYSIS_ERROR":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isAnalyzing: false,
          error: action.payload.error,
        },
      };

    case "MEMORY_GRAPH_MODAL_OPEN":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isModalOpen: true,
        },
      };

    case "MEMORY_GRAPH_MODAL_CLOSE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isModalOpen: false,
          analysis: null,
          selectedChangeIds: [],
          error: null,
        },
      };

    case "MEMORY_GRAPH_CHANGES_SELECT":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          selectedChangeIds: action.payload.changeIds,
        },
      };

    case "MEMORY_GRAPH_APPLY_START":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isApplying: true,
          error: null,
        },
      };

    case "MEMORY_GRAPH_APPLY_COMPLETE": {
      // Preserve the applied insights before clearing the analysis
      const appliedChanges =
        state.memoryGraph.analysis?.proposedChanges.filter((change) =>
          state.memoryGraph.selectedChangeIds.includes(change.id),
        ) || [];
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isApplying: false,
          isModalOpen: false,
          analysis: null,
          selectedChangeIds: [],
          pendingChangesCount: 0,
          error: null,
          // Add newly applied insights to the persisted list
          appliedInsights: [
            ...state.memoryGraph.appliedInsights,
            ...appliedChanges,
          ],
        },
      };
    }

    case "MEMORY_GRAPH_APPLY_ERROR":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isApplying: false,
          error: action.payload.error,
        },
      };

    case "MEMORY_GRAPH_PENDING_COUNT_UPDATE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          pendingChangesCount: action.payload.count,
        },
      };

    case "MEMORY_GRAPH_CHANGE_DELETE": {
      // Remove a proposed change from the analysis
      if (!state.memoryGraph.analysis) return state;
      const filteredChanges = state.memoryGraph.analysis.proposedChanges.filter(
        (c) => c.id !== action.payload.changeId,
      );
      const filteredSelectedIds = state.memoryGraph.selectedChangeIds.filter(
        (id) => id !== action.payload.changeId,
      );
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          analysis: {
            ...state.memoryGraph.analysis,
            proposedChanges: filteredChanges,
          },
          selectedChangeIds: filteredSelectedIds,
        },
      };
    }

    case "MEMORY_GRAPH_CHANGE_EDIT": {
      // Update a proposed change in the analysis
      if (!state.memoryGraph.analysis) return state;
      const updatedChanges = state.memoryGraph.analysis.proposedChanges.map(
        (c) =>
          c.id === action.payload.changeId
            ? { ...c, ...action.payload.updates }
            : c,
      );
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          analysis: {
            ...state.memoryGraph.analysis,
            proposedChanges: updatedChanges,
          },
        },
      };
    }

    case "MEMORY_GRAPH_LAST_ANALYZED_UPDATE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          lastAnalyzedAt: action.payload.timestamp,
        },
      };

    case "MEMORY_GRAPH_INSIGHT_ADD": {
      // Add a single insight to the existing analysis (real-time via WebSocket)
      const newInsight = action.payload.insight;
      if (state.memoryGraph.analysis) {
        // Append to existing analysis
        return {
          ...state,
          memoryGraph: {
            ...state.memoryGraph,
            analysis: {
              ...state.memoryGraph.analysis,
              proposedChanges: [
                ...state.memoryGraph.analysis.proposedChanges,
                newInsight,
              ],
            },
            // Auto-select the new insight
            selectedChangeIds: [
              ...state.memoryGraph.selectedChangeIds,
              newInsight.id,
            ],
          },
        };
      }
      // Create new analysis with just this insight
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          analysis: {
            context: {
              who: "system",
              what: "auto-generated insight",
              when: new Date().toISOString(),
              where: "conversation",
              why: "real-time analysis",
            },
            proposedChanges: [newInsight],
            cascadeEffects: [],
            previewNodes: [],
            previewEdges: [],
          },
          selectedChangeIds: [newInsight.id],
        },
      };
    }

    case "MEMORY_GRAPH_INSIGHTS_LOAD": {
      // Load applied insights from backend (session resume)
      // This populates appliedInsights with persisted insights
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          appliedInsights: action.payload.insights,
        },
      };
    }

    // =========================================================================
    // Graph Snapshot Actions
    // =========================================================================
    case "GRAPH_SNAPSHOTS_LOAD_START":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isLoadingSnapshots: true,
          snapshotError: null,
        },
      };

    case "GRAPH_SNAPSHOTS_LOAD_COMPLETE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isLoadingSnapshots: false,
          snapshots: action.payload.snapshots,
        },
      };

    case "GRAPH_SNAPSHOTS_LOAD_ERROR":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isLoadingSnapshots: false,
          snapshotError: action.payload.error,
        },
      };

    case "GRAPH_SNAPSHOT_SAVE_START":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isSavingSnapshot: true,
          snapshotError: null,
        },
      };

    case "GRAPH_SNAPSHOT_SAVE_COMPLETE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isSavingSnapshot: false,
          snapshots: [action.payload.snapshot, ...state.memoryGraph.snapshots],
        },
      };

    case "GRAPH_SNAPSHOT_SAVE_ERROR":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isSavingSnapshot: false,
          snapshotError: action.payload.error,
        },
      };

    case "GRAPH_SNAPSHOT_RESTORE_START":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isRestoringSnapshot: true,
          snapshotError: null,
        },
      };

    case "GRAPH_SNAPSHOT_RESTORE_COMPLETE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isRestoringSnapshot: false,
        },
      };

    case "GRAPH_SNAPSHOT_RESTORE_ERROR":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          isRestoringSnapshot: false,
          snapshotError: action.payload.error,
        },
      };

    case "GRAPH_SNAPSHOT_DELETE":
      return {
        ...state,
        memoryGraph: {
          ...state.memoryGraph,
          snapshots: state.memoryGraph.snapshots.filter(
            (s) => s.id !== action.payload.snapshotId,
          ),
        },
      };

    // =========================================================================
    // Context Management Actions (Memory Graph Migration)
    // =========================================================================

    case "CONTEXT_STATUS_UPDATE":
      return {
        ...state,
        context: {
          ...state.context,
          status: action.payload.status,
        },
      };

    case "CONTEXT_SAVE_START":
      return {
        ...state,
        context: {
          ...state.context,
          isSaving: true,
          saveResult: null,
        },
      };

    case "CONTEXT_SAVE_COMPLETE":
      return {
        ...state,
        context: {
          ...state.context,
          isSaving: false,
          saveResult: {
            blocksCreated: action.payload.blocksCreated,
            linksCreated: action.payload.linksCreated,
            success: action.payload.success,
            error: action.payload.error,
          },
        },
      };

    case "CONTEXT_SAVE_ERROR":
      return {
        ...state,
        context: {
          ...state.context,
          isSaving: false,
          saveResult: {
            blocksCreated: 0,
            linksCreated: 0,
            success: false,
            error: action.payload.error,
          },
        },
      };

    default:
      return state;
  }
}
