// =============================================================================
// FILE: frontend/src/components/ideation/IdeationSession.tsx
// Main container for an ideation session
// =============================================================================

import { useEffect, useReducer, useCallback, useRef, useState } from 'react';
import { SessionHeader } from './SessionHeader';
import { ConversationPanel } from './ConversationPanel';
import { IdeaCandidatePanel } from './IdeaCandidatePanel';
import { useIdeationAPI } from '../../hooks/useIdeationAPI';
import { ideationReducer, initialState } from '../../reducers/ideationReducer';
import type { IdeationSessionProps } from '../../types/ideation';

// Generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function IdeationSession({
  sessionId: initialSessionId,
  profileId,
  entryMode,
  isResuming = false,
  onComplete,
  onExit,
}: IdeationSessionProps) {
  const [state, dispatch] = useReducer(ideationReducer, initialState);
  const api = useIdeationAPI();
  const initRef = useRef(false);
  const buttonClickInProgressRef = useRef(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Initialize or resume session (with guard against React 18 Strict Mode double-invoke)
  useEffect(() => {
    if (initRef.current) return;

    initRef.current = true;

    async function initSession() {
      dispatch({ type: 'SESSION_START', payload: { profileId, entryMode } });

      try {
        const result = await api.startSession(profileId, entryMode);
        dispatch({
          type: 'SESSION_CREATED',
          payload: { sessionId: result.sessionId, greeting: result.greeting },
        });

        // Add greeting message
        dispatch({
          type: 'MESSAGE_RECEIVED',
          payload: {
            message: {
              id: generateMessageId(),
              sessionId: result.sessionId,
              role: 'assistant',
              content: result.greeting,
              buttons: result.buttons || null,
              form: null,
              createdAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to start session' },
        });
      }
    }

    async function resumeSession() {
      dispatch({ type: 'SESSION_START', payload: { profileId, entryMode: null } });

      try {
        const sessionData = await api.loadSession(initialSessionId);

        dispatch({
          type: 'SESSION_CREATED',
          payload: { sessionId: initialSessionId, greeting: '' },
        });

        // Add all existing messages
        for (const msg of sessionData.messages) {
          dispatch({
            type: 'MESSAGE_RECEIVED',
            payload: {
              message: {
                id: msg.id || generateMessageId(),
                sessionId: initialSessionId,
                role: msg.role,
                content: msg.content,
                buttons: (msg.buttonsShown as import('../../types').ButtonOption[]) || null,
                form: (msg.formShown as import('../../types').FormDefinition) || null,
                createdAt: msg.createdAt,
              },
            },
          });
        }

        // Update candidate if present
        if (sessionData.candidate) {
          dispatch({
            type: 'CANDIDATE_UPDATE',
            payload: {
              candidate: {
                title: sessionData.candidate.title,
                summary: sessionData.candidate.summary ?? undefined,
              },
            },
          });
          dispatch({
            type: 'CONFIDENCE_UPDATE',
            payload: { confidence: sessionData.candidate.confidence },
          });
          dispatch({
            type: 'VIABILITY_UPDATE',
            payload: {
              viability: sessionData.candidate.viability,
              risks: [],
            },
          });
        }
      } catch (error) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to resume session' },
        });
      }
    }

    if (isResuming && initialSessionId) {
      resumeSession();
    } else if (!initialSessionId) {
      initSession();
    }
  }, [profileId, entryMode, initialSessionId, isResuming, api]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'MESSAGE_SEND', payload: { content } });

    // Add user message to conversation
    const userMessage = {
      id: generateMessageId(),
      sessionId: state.session.sessionId,
      role: 'user' as const,
      content,
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'MESSAGE_RECEIVED', payload: { message: userMessage } });

    // Start streaming
    dispatch({ type: 'MESSAGE_STREAM_START' });

    try {
      const response = await api.sendMessage(state.session.sessionId, content);

      // Update with response
      dispatch({
        type: 'MESSAGE_STREAM_END',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Update candidate if present
      if (response.candidateUpdate) {
        dispatch({
          type: 'CANDIDATE_UPDATE',
          payload: { candidate: response.candidateUpdate },
        });
      }

      // Update confidence/viability
      if (response.confidence !== undefined) {
        dispatch({
          type: 'CONFIDENCE_UPDATE',
          payload: { confidence: response.confidence },
        });
      }
      if (response.viability !== undefined) {
        dispatch({
          type: 'VIABILITY_UPDATE',
          payload: {
            viability: response.viability,
            risks: response.risks || [],
          },
        });
      }

      // Check for intervention
      if (response.intervention) {
        dispatch({
          type: 'INTERVENTION_SHOW',
          payload: { type: response.intervention.type },
        });
      }

      // Update token usage
      if (response.tokenUsage) {
        dispatch({
          type: 'TOKEN_UPDATE',
          payload: { usage: response.tokenUsage },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: errorMessage },
      });

      // If session is not active, treat as session-level error to show full error screen
      if (errorMessage.toLowerCase().includes('session is not active') ||
          errorMessage.toLowerCase().includes('session expired')) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: 'Your session has expired. Please start a new session.' },
        });
      }
    }
  }, [state.session.sessionId, api]);

  // Handle button clicks
  const handleButtonClick = useCallback(async (buttonId: string, buttonValue: string, buttonLabel: string) => {
    if (!state.session.sessionId) return;
    // Prevent double clicks - use ref for synchronous check
    if (buttonClickInProgressRef.current || state.conversation.isLoading) return;
    buttonClickInProgressRef.current = true;

    dispatch({ type: 'BUTTON_CLICK', payload: { buttonId, buttonValue } });

    // Add user's selection as a message in the conversation (use label for display)
    const userMessage = {
      id: generateMessageId(),
      sessionId: state.session.sessionId,
      role: 'user' as const,
      content: buttonLabel,
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'MESSAGE_RECEIVED', payload: { message: userMessage } });

    try {
      const response = await api.clickButton(state.session.sessionId, buttonId, buttonValue);

      dispatch({
        type: 'MESSAGE_RECEIVED',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Update metrics if present
      if (response.confidence !== undefined) {
        dispatch({ type: 'CONFIDENCE_UPDATE', payload: { confidence: response.confidence } });
      }
      if (response.viability !== undefined) {
        dispatch({ type: 'VIABILITY_UPDATE', payload: { viability: response.viability, risks: response.risks || [] } });
      }
      if (response.candidateUpdate) {
        dispatch({ type: 'CANDIDATE_UPDATE', payload: { candidate: response.candidateUpdate } });
      }
      // Update token usage
      if (response.tokenUsage) {
        dispatch({
          type: 'TOKEN_UPDATE',
          payload: { usage: response.tokenUsage },
        });
      }
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to process button click' },
      });
    } finally {
      buttonClickInProgressRef.current = false;
    }
  }, [state.session.sessionId, api]);

  // Handle form submissions
  const handleFormSubmit = useCallback(async (formId: string, answers: Record<string, unknown>) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'FORM_SUBMIT', payload: { formId, answers } });

    try {
      const response = await api.submitForm(state.session.sessionId, formId, answers);

      dispatch({
        type: 'MESSAGE_RECEIVED',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to submit form' },
      });
    }
  }, [state.session.sessionId, api]);

  // Handle capture
  const handleCapture = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      const result = await api.captureIdea(state.session.sessionId);
      dispatch({ type: 'SESSION_COMPLETE', payload: { ideaId: result.ideaId } });
      // Pass slug for navigation since route is /ideas/:slug
      onComplete(result.ideaSlug);
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to capture idea' },
      });
    }
  }, [state.session.sessionId, api, onComplete]);

  // Handle save for later
  const handleSave = useCallback(async () => {
    console.log('[handleSave] Called, sessionId:', state.session.sessionId);
    if (!state.session.sessionId) {
      console.log('[handleSave] No session ID, returning early');
      return;
    }

    try {
      console.log('[handleSave] Calling api.saveForLater...');
      await api.saveForLater(state.session.sessionId);
      console.log('[handleSave] Success! Setting toast...');
      // Show success toast
      setToast({ message: 'Idea saved for later! You can resume this session anytime.', type: 'success' });
      // Auto-hide after 4 seconds
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      console.log('[handleSave] Error:', error);
      setToast({ message: error instanceof Error ? error.message : 'Failed to save idea', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [state.session.sessionId, api]);

  // Handle abandon
  const handleAbandon = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      await api.abandonSession(state.session.sessionId);
      dispatch({ type: 'SESSION_ABANDON' });
      onExit();
    } catch (error) {
      console.error('Failed to abandon session:', error);
      onExit();
    }
  }, [state.session.sessionId, api, onExit]);

  // Handle discard candidate
  const handleDiscard = useCallback(() => {
    dispatch({ type: 'CANDIDATE_CLEAR' });
    dispatch({ type: 'INTERVENTION_DISMISS' });
  }, []);

  // Handle intervention continue
  const handleContinue = useCallback(() => {
    dispatch({ type: 'INTERVENTION_DISMISS' });
  }, []);

  if (state.session.status === 'error') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-red-600 mb-4">{state.session.error}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (state.session.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Starting your ideation session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ideation-session h-full flex flex-col relative">
      <SessionHeader
        sessionId={state.session.sessionId || ''}
        tokenUsage={state.tokens.usage}
        onAbandon={handleAbandon}
        onMinimize={onExit}
      />

      <div className="flex-1 flex overflow-hidden">
        <ConversationPanel
          messages={state.conversation.messages}
          isLoading={state.conversation.isLoading}
          error={state.conversation.error}
          onSendMessage={handleSendMessage}
          onButtonClick={handleButtonClick}
          onFormSubmit={handleFormSubmit}
        />

        <IdeaCandidatePanel
          candidate={state.candidate.candidate}
          confidence={state.candidate.confidence}
          viability={state.candidate.viability}
          risks={state.candidate.risks}
          onCapture={handleCapture}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onContinue={handleContinue}
          showIntervention={state.candidate.showIntervention}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          data-testid="toast-notification"
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-80"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default IdeationSession;
