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
  },
  conversation: {
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: "",
    error: null,
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
          risks: action.payload.risks,
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

    default:
      return state;
  }
}
