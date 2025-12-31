// =============================================================================
// FILE: frontend/src/types/ideation-state.ts
// State management types for Ideation Agent
// =============================================================================

import type { IdeaCandidate, ViabilityRisk } from './index';
import type { TokenUsageInfo, EntryMode, IdeationMessage } from './ideation';

// Re-export for convenience
export type { TokenUsageInfo, EntryMode, IdeationMessage };

// -----------------------------------------------------------------------------
// Session State
// -----------------------------------------------------------------------------

export interface IdeationSessionState {
  sessionId: string | null;
  profileId: string;
  status: 'idle' | 'loading' | 'active' | 'completed' | 'abandoned' | 'error';
  entryMode: EntryMode;
  error: string | null;
}

export interface ConversationState {
  messages: IdeationMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
}

export interface CandidateState {
  candidate: IdeaCandidate | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  showIntervention: boolean;
  interventionType: 'warning' | 'critical' | null;
}

export interface TokenState {
  usage: TokenUsageInfo;
  handoffPending: boolean;
  handoffCount: number;
}

// -----------------------------------------------------------------------------
// Combined Store State
// -----------------------------------------------------------------------------

export interface IdeationStore {
  session: IdeationSessionState;
  conversation: ConversationState;
  candidate: CandidateState;
  tokens: TokenState;
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

export type IdeationAction =
  | { type: 'SESSION_START'; payload: { profileId: string; entryMode: EntryMode } }
  | { type: 'SESSION_CREATED'; payload: { sessionId: string; greeting: string } }
  | { type: 'SESSION_ERROR'; payload: { error: string } }
  | { type: 'SESSION_COMPLETE'; payload: { ideaId: string } }
  | { type: 'SESSION_ABANDON' }
  | { type: 'MESSAGE_SEND'; payload: { content: string } }
  | { type: 'MESSAGE_STREAM_START' }
  | { type: 'MESSAGE_STREAM_CHUNK'; payload: { chunk: string } }
  | { type: 'MESSAGE_STREAM_END'; payload: { message: IdeationMessage } }
  | { type: 'MESSAGE_RECEIVED'; payload: { message: IdeationMessage } }
  | { type: 'MESSAGE_ERROR'; payload: { error: string } }
  | { type: 'BUTTON_CLICK'; payload: { buttonId: string; buttonValue: string } }
  | { type: 'FORM_SUBMIT'; payload: { formId: string; answers: Record<string, unknown> } }
  | { type: 'CANDIDATE_UPDATE'; payload: { candidate: IdeaCandidate } }
  | { type: 'CANDIDATE_CLEAR' }
  | { type: 'CONFIDENCE_UPDATE'; payload: { confidence: number } }
  | { type: 'VIABILITY_UPDATE'; payload: { viability: number; risks: ViabilityRisk[] } }
  | { type: 'INTERVENTION_SHOW'; payload: { type: 'warning' | 'critical' } }
  | { type: 'INTERVENTION_DISMISS' }
  | { type: 'TOKEN_UPDATE'; payload: { usage: TokenUsageInfo } }
  | { type: 'HANDOFF_PENDING' }
  | { type: 'HANDOFF_COMPLETE' };
