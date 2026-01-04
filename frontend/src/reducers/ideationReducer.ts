// =============================================================================
// FILE: frontend/src/reducers/ideationReducer.ts
// State management reducer for Ideation Agent
// =============================================================================

import type {
  IdeationStore,
  IdeationAction,
  TokenUsageInfo,
} from '../types/ideation-state';

const DEFAULT_TOKEN_USAGE: TokenUsageInfo = {
  total: 0,
  limit: 100000,
  percentUsed: 0,
  shouldHandoff: false,
};

export const initialState: IdeationStore = {
  session: {
    sessionId: null,
    profileId: '',
    status: 'idle',
    entryMode: null,
    error: null,
  },
  conversation: {
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: '',
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
  },
  subAgents: {
    subAgents: [],
    activeCount: 0,
  },
};

export function ideationReducer(
  state: IdeationStore,
  action: IdeationAction
): IdeationStore {
  switch (action.type) {
    // =========================================================================
    // Session Actions
    // =========================================================================
    case 'SESSION_START':
      return {
        ...state,
        session: {
          ...state.session,
          profileId: action.payload.profileId,
          entryMode: action.payload.entryMode,
          status: 'loading',
          error: null,
        },
      };

    case 'SESSION_CREATED':
      return {
        ...state,
        session: {
          ...state.session,
          sessionId: action.payload.sessionId,
          status: 'active',
        },
      };

    case 'SESSION_ERROR':
      return {
        ...state,
        session: {
          ...state.session,
          status: 'error',
          error: action.payload.error,
        },
      };

    case 'SESSION_COMPLETE':
      return {
        ...state,
        session: {
          ...state.session,
          status: 'completed',
        },
      };

    case 'SESSION_ABANDON':
      return {
        ...state,
        session: {
          ...state.session,
          status: 'abandoned',
        },
      };

    // =========================================================================
    // Message Actions
    // =========================================================================
    case 'MESSAGE_SEND':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: true,
          error: null,
        },
      };

    case 'MESSAGE_STREAM_START':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isStreaming: true,
          streamingContent: '',
        },
      };

    case 'MESSAGE_STREAM_CHUNK':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          streamingContent: state.conversation.streamingContent + action.payload.chunk,
        },
      };

    case 'MESSAGE_STREAM_END':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload.message],
          isLoading: false,
          isStreaming: false,
          streamingContent: '',
        },
      };

    case 'MESSAGE_RECEIVED':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload.message],
          // Only clear loading when assistant responds, not when adding user message
          isLoading: action.payload.message.role === 'user' ? state.conversation.isLoading : false,
        },
      };

    case 'MESSAGE_ERROR':
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: false,
          isStreaming: false,
          error: action.payload.error,
        },
      };

    case 'BUTTON_CLICK': {
      // Mark the button as clicked in the last message
      const messagesWithClick = [...state.conversation.messages];
      const lastIdx = messagesWithClick.length - 1;
      if (lastIdx >= 0 && messagesWithClick[lastIdx].role === 'assistant') {
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

    case 'FORM_SUBMIT':
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
    case 'CANDIDATE_UPDATE':
      return {
        ...state,
        candidate: {
          ...state.candidate,
          candidate: action.payload.candidate,
        },
      };

    case 'CANDIDATE_CLEAR':
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

    case 'CONFIDENCE_UPDATE':
      return {
        ...state,
        candidate: {
          ...state.candidate,
          confidence: action.payload.confidence,
        },
      };

    case 'VIABILITY_UPDATE':
      return {
        ...state,
        candidate: {
          ...state.candidate,
          viability: action.payload.viability,
          risks: action.payload.risks,
        },
      };

    case 'INTERVENTION_SHOW':
      return {
        ...state,
        candidate: {
          ...state.candidate,
          showIntervention: true,
          interventionType: action.payload.type,
        },
      };

    case 'INTERVENTION_DISMISS':
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
    case 'TOKEN_UPDATE':
      return {
        ...state,
        tokens: {
          ...state.tokens,
          usage: action.payload.usage,
        },
      };

    case 'HANDOFF_PENDING':
      return {
        ...state,
        tokens: {
          ...state.tokens,
          handoffPending: true,
        },
      };

    case 'HANDOFF_COMPLETE':
      return {
        ...state,
        tokens: {
          ...state.tokens,
          handoffPending: false,
          handoffCount: state.tokens.handoffCount + 1,
        },
      };

    case 'MESSAGES_TRUNCATE': {
      // Find the index of the message to truncate from
      const messageIndex = state.conversation.messages.findIndex(
        m => m.id === action.payload.messageId
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

    case 'MESSAGE_UPDATE_ID': {
      // Update a message's ID (used to sync frontend IDs with backend IDs)
      const updatedMessages = state.conversation.messages.map(m =>
        m.id === action.payload.oldId ? { ...m, id: action.payload.newId } : m
      );
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: updatedMessages,
        },
      };
    }

    case 'MESSAGE_CONTENT_UPDATE': {
      // Update a message's content (used for async artifact edit completion)
      const messagesWithUpdate = state.conversation.messages.map(m =>
        m.id === action.payload.messageId ? { ...m, content: action.payload.content } : m
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
    case 'ARTIFACT_ADD':
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

    case 'ARTIFACT_UPDATE': {
      const updatedArtifacts = state.artifacts.artifacts.map(a =>
        a.id === action.payload.id ? { ...a, ...action.payload.updates } : a
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

    case 'ARTIFACT_REMOVE':
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          artifacts: state.artifacts.artifacts.filter(a => a.id !== action.payload.id),
          currentArtifact:
            state.artifacts.currentArtifact?.id === action.payload.id
              ? null
              : state.artifacts.currentArtifact,
        },
      };

    case 'ARTIFACT_SELECT':
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          currentArtifact: action.payload.artifact,
          isPanelOpen: action.payload.artifact !== null,
        },
      };

    case 'ARTIFACT_LOADING_START':
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          isLoading: true,
          artifacts: state.artifacts.artifacts.map(a =>
            a.id === action.payload.id ? { ...a, status: 'loading' as const } : a
          ),
        },
      };

    case 'ARTIFACT_LOADING_END': {
      const newStatus = action.payload.error ? 'error' : 'ready';
      const finalArtifacts = state.artifacts.artifacts.map(a =>
        a.id === action.payload.id
          ? {
              ...a,
              status: newStatus as 'error' | 'ready',
              error: action.payload.error,
            }
          : a
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

    case 'ARTIFACT_PANEL_TOGGLE':
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          isPanelOpen: action.payload.isOpen,
        },
      };

    case 'ARTIFACTS_CLEAR':
      return {
        ...state,
        artifacts: {
          artifacts: [],
          currentArtifact: null,
          isLoading: false,
          isPanelOpen: false,
        },
      };

    // =========================================================================
    // Sub-Agent Actions
    // =========================================================================
    case 'SUBAGENT_SPAWN': {
      // IDEMPOTENCY CHECK: Prevent duplicate sub-agents with same ID
      // This can happen if both API response and WebSocket emit spawn events
      const existingAgent = state.subAgents.subAgents.find(
        agent => agent.id === action.payload.id
      );
      if (existingAgent) {
        console.log('[Reducer] SUBAGENT_SPAWN ignored - already exists:', action.payload.id);
        return state; // Don't add duplicate
      }

      const newSubAgent = {
        id: action.payload.id,
        type: action.payload.type,
        name: action.payload.name,
        status: 'spawning' as const,
        startedAt: new Date().toISOString(),
      };
      return {
        ...state,
        subAgents: {
          subAgents: [...state.subAgents.subAgents, newSubAgent],
          activeCount: state.subAgents.activeCount + 1,
        },
      };
    }

    case 'SUBAGENT_STATUS': {
      const updatedSubAgents = state.subAgents.subAgents.map(agent =>
        agent.id === action.payload.id
          ? {
              ...agent,
              status: action.payload.status,
              error: action.payload.error,
              ...(action.payload.status === 'completed' || action.payload.status === 'failed'
                ? { completedAt: new Date().toISOString() }
                : {}),
            }
          : agent
      );
      // Calculate active count (spawning or running)
      const activeCount = updatedSubAgents.filter(
        a => a.status === 'spawning' || a.status === 'running'
      ).length;
      return {
        ...state,
        subAgents: {
          subAgents: updatedSubAgents,
          activeCount,
        },
      };
    }

    case 'SUBAGENT_RESULT': {
      const subAgentsWithResult = state.subAgents.subAgents.map(agent =>
        agent.id === action.payload.id
          ? {
              ...agent,
              status: 'completed' as const,
              result: action.payload.result,
              completedAt: new Date().toISOString(),
            }
          : agent
      );
      // Calculate active count (spawning or running)
      const activeAfterResult = subAgentsWithResult.filter(
        a => a.status === 'spawning' || a.status === 'running'
      ).length;
      return {
        ...state,
        subAgents: {
          subAgents: subAgentsWithResult,
          activeCount: activeAfterResult,
        },
      };
    }

    case 'SUBAGENT_CLEAR':
      return {
        ...state,
        subAgents: {
          subAgents: [],
          activeCount: 0,
        },
      };

    default:
      return state;
  }
}
