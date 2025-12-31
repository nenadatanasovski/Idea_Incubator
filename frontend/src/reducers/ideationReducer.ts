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
          isLoading: false,
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

    default:
      return state;
  }
}
