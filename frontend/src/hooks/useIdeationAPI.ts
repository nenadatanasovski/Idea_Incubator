// =============================================================================
// FILE: frontend/src/hooks/useIdeationAPI.ts
// API hooks for Ideation Agent
// =============================================================================

import { useCallback, useMemo } from 'react';
import type { EntryMode, TokenUsageInfo, IdeationMessage } from '../types/ideation';
import type { ButtonOption, FormDefinition, IdeaCandidate, ViabilityRisk } from '../types';

const API_BASE = '/api/ideation';

interface StartSessionResponse {
  sessionId: string;
  greeting: string;
  buttons?: ButtonOption[];
}

interface MessageResponse {
  messageId: string;
  reply: string;
  buttons?: ButtonOption[];
  form?: FormDefinition;
  candidateUpdate?: IdeaCandidate;
  confidence?: number;
  viability?: number;
  risks?: ViabilityRisk[];
  intervention?: { type: 'warning' | 'critical' };
  tokenUsage?: TokenUsageInfo;
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
  const startSession = useCallback(async (
    profileId: string,
    entryMode: EntryMode
  ): Promise<StartSessionResponse> => {
    const response = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, entryMode }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to start session' } }));
      throw new Error(error.error?.message || 'Failed to start session');
    }

    return response.json();
  }, []);

  const sendMessage = useCallback(async (
    sessionId: string,
    message: string
  ): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
      // Handle both { error: "string" } and { error: { message: "string" } } formats
      const errorMessage = typeof errorData.error === 'string'
        ? errorData.error
        : errorData.error?.message || 'Failed to send message';
      throw new Error(errorMessage);
    }

    return response.json();
  }, []);

  const clickButton = useCallback(async (
    sessionId: string,
    buttonId: string,
    buttonValue: string
  ): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE}/button`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, buttonId, buttonValue }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to process button click' } }));
      throw new Error(error.error?.message || 'Failed to process button click');
    }

    return response.json();
  }, []);

  const submitForm = useCallback(async (
    sessionId: string,
    formId: string,
    answers: Record<string, unknown>
  ): Promise<MessageResponse> => {
    const response = await fetch(`${API_BASE}/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, formId, answers }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to submit form' } }));
      throw new Error(error.error?.message || 'Failed to submit form');
    }

    return response.json();
  }, []);

  const captureIdea = useCallback(async (
    sessionId: string
  ): Promise<CaptureResponse> => {
    const response = await fetch(`${API_BASE}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to capture idea' } }));
      throw new Error(error.error?.message || 'Failed to capture idea');
    }

    return response.json();
  }, []);

  const saveForLater = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to save session' } }));
      throw new Error(error.error?.message || 'Failed to save session');
    }
  }, []);

  const discardSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to discard session' } }));
      throw new Error(error.error?.message || 'Failed to discard session');
    }
  }, []);

  const abandonSession = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/session/${sessionId}/abandon`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to abandon session' } }));
      throw new Error(error.error?.message || 'Failed to abandon session');
    }
  }, []);

  const getSession = useCallback(async (sessionId: string): Promise<SessionResponse> => {
    const response = await fetch(`${API_BASE}/session/${sessionId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to get session' } }));
      throw new Error(error.error?.message || 'Failed to get session');
    }

    return response.json();
  }, []);

  const listSessions = useCallback(async (
    profileId: string,
    status?: string
  ): Promise<SessionListResponse> => {
    const params = new URLSearchParams({ profileId });
    if (status) params.append('status', status);

    const response = await fetch(`${API_BASE}/sessions?${params}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to list sessions' } }));
      throw new Error(error.error?.message || 'Failed to list sessions');
    }

    return response.json();
  }, []);

  return useMemo(() => ({
    startSession,
    sendMessage,
    clickButton,
    submitForm,
    captureIdea,
    saveForLater,
    discardSession,
    abandonSession,
    getSession,
    listSessions,
  }), [
    startSession,
    sendMessage,
    clickButton,
    submitForm,
    captureIdea,
    saveForLater,
    discardSession,
    abandonSession,
    getSession,
    listSessions,
  ]);
}
