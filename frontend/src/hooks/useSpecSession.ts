/**
 * useSpecSession Hook
 * 
 * Manages specification session state via API.
 * Part of: SPEC-005 - Specification Frontend Integration
 */

import { useState, useEffect, useCallback } from 'react';

// Types
export interface Specification {
  version: string;
  overview: {
    name: string;
    description: string;
    problemStatement: string;
    targetUsers: string[];
  };
  features: Feature[];
  constraints: Constraint[];
  assumptions: string[];
  generatedFrom?: string;
  confidence: number;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  acceptanceCriteria: string[];
  technicalNotes?: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface Constraint {
  type: 'technical' | 'business' | 'legal';
  description: string;
}

export interface SpecQuestion {
  id: string;
  question: string;
  context?: string;
  category: 'feature' | 'technical' | 'scope' | 'clarification';
  priority: 'blocking' | 'important' | 'optional';
  createdAt: string;
}

export interface SpecAnswer extends SpecQuestion {
  answer: string;
  answeredAt: string;
}

export interface TaskDefinition {
  id: string;
  specId: string;
  featureId: string;
  name: string;
  description: string;
  type: 'setup' | 'database' | 'api' | 'ui' | 'integration' | 'test';
  dependencies: string[];
  estimatedMinutes: number;
  technicalDetails: string;
  testCriteria: string[];
}

export interface SpecSession {
  sessionId: string;
  ideaId: string;
  status: 'active' | 'pending_input' | 'complete' | 'failed';
  draft: Specification | null;
  questions: SpecQuestion[];
  answeredQuestions: SpecAnswer[];
  tasks: TaskDefinition[];
  draftVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface UseSpecSessionOptions {
  ideaId: string;
  autoFetch?: boolean;
  onStatusChange?: (status: SpecSession['status']) => void;
  onError?: (error: string) => void;
}

export interface UseSpecSessionReturn {
  // State
  session: SpecSession | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startSession: () => Promise<SpecSession | null>;
  fetchSession: () => Promise<void>;
  answerQuestion: (questionId: string, answer: string) => Promise<boolean>;
  chat: (message: string) => Promise<{ response: string; updatedSpec: boolean } | null>;
  finalizeSpec: () => Promise<{ spec: Specification; tasks: TaskDefinition[] } | null>;
  
  // Derived state
  hasQuestions: boolean;
  isComplete: boolean;
  canFinalize: boolean;
}

export function useSpecSession({
  ideaId,
  autoFetch = true,
  onStatusChange,
  onError,
}: UseSpecSessionOptions): UseSpecSessionReturn {
  const [session, setSession] = useState<SpecSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing session
  const fetchSession = useCallback(async () => {
    if (!ideaId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/specification/${ideaId}/session`);
      
      if (response.status === 404) {
        // No session exists yet
        setSession(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const data = await response.json();
      
      if (data.success) {
        const newSession: SpecSession = {
          sessionId: data.sessionId,
          ideaId,
          status: data.status,
          draft: data.draft,
          questions: data.questions || [],
          answeredQuestions: data.answeredQuestions || [],
          tasks: data.tasks || [],
          draftVersion: data.draftVersion,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        setSession(prev => {
          if (prev?.status !== newSession.status) {
            onStatusChange?.(newSession.status);
          }
          return newSession;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch session';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [ideaId, onStatusChange, onError]);

  // Start a new session
  const startSession = useCallback(async (): Promise<SpecSession | null> => {
    if (!ideaId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/specification/${ideaId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start session');
      }

      const data = await response.json();

      if (data.success) {
        const newSession: SpecSession = {
          sessionId: data.sessionId,
          ideaId,
          status: data.status,
          draft: data.draft,
          questions: data.questions || [],
          answeredQuestions: [],
          tasks: [],
          draftVersion: data.draftVersion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setSession(newSession);
        onStatusChange?.(newSession.status);
        return newSession;
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      setError(msg);
      onError?.(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ideaId, onStatusChange, onError]);

  // Answer a question
  const answerQuestion = useCallback(async (
    questionId: string,
    answer: string
  ): Promise<boolean> => {
    if (!session?.sessionId) return false;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/specification/${session.sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to answer question');
      }

      const data = await response.json();

      if (data.success) {
        // Update session state
        setSession(prev => {
          if (!prev) return null;

          const answeredQ = prev.questions.find(q => q.id === questionId);
          const newAnswered = answeredQ ? [
            ...prev.answeredQuestions,
            { ...answeredQ, answer, answeredAt: new Date().toISOString() } as SpecAnswer,
          ] : prev.answeredQuestions;

          const newStatus = data.remainingQuestions === 0 ? 'active' : 'pending_input';
          
          if (prev.status !== newStatus) {
            onStatusChange?.(newStatus);
          }

          return {
            ...prev,
            draft: data.updatedDraft || prev.draft,
            questions: data.pendingQuestions || prev.questions.filter(q => q.id !== questionId),
            answeredQuestions: newAnswered,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          };
        });

        return true;
      }

      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to answer question';
      setError(msg);
      onError?.(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.sessionId, onStatusChange, onError]);

  // Chat with the spec agent
  const chat = useCallback(async (
    message: string
  ): Promise<{ response: string; updatedSpec: boolean } | null> => {
    if (!session?.sessionId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/specification/${session.sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Chat failed');
      }

      const data = await response.json();

      if (data.success) {
        if (data.updatedSpec && data.currentDraft) {
          setSession(prev => prev ? {
            ...prev,
            draft: data.currentDraft,
            questions: data.pendingQuestions || prev.questions,
            updatedAt: new Date().toISOString(),
          } : null);
        }

        return {
          response: data.response,
          updatedSpec: data.updatedSpec,
        };
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chat failed';
      setError(msg);
      onError?.(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.sessionId, onError]);

  // Finalize the specification
  const finalizeSpec = useCallback(async (): Promise<{
    spec: Specification;
    tasks: TaskDefinition[];
  } | null> => {
    if (!session?.sessionId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/specification/${session.sessionId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to finalize specification');
      }

      const data = await response.json();

      if (data.success) {
        setSession(prev => prev ? {
          ...prev,
          draft: data.spec,
          tasks: data.tasks,
          status: 'complete',
          updatedAt: new Date().toISOString(),
        } : null);

        onStatusChange?.('complete');

        return {
          spec: data.spec,
          tasks: data.tasks,
        };
      }

      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to finalize specification';
      setError(msg);
      onError?.(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.sessionId, onStatusChange, onError]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && ideaId) {
      fetchSession();
    }
  }, [autoFetch, ideaId, fetchSession]);

  // Derived state
  const hasQuestions = (session?.questions?.length ?? 0) > 0;
  const isComplete = session?.status === 'complete';
  const canFinalize = session?.status === 'active' && !hasQuestions && session?.draft !== null;

  return {
    session,
    isLoading,
    error,
    startSession,
    fetchSession,
    answerQuestion,
    chat,
    finalizeSpec,
    hasQuestions,
    isComplete,
    canFinalize,
  };
}

export default useSpecSession;
