/**
 * useBuildSession Hook
 * 
 * Manages build session state via API and WebSocket for real-time updates.
 * Part of: BUILD-005 - Build Frontend Integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
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

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface BuildSession {
  sessionId: string;
  ideaId: string;
  specId: string;
  status: 'active' | 'paused' | 'complete' | 'failed' | 'human_needed';
  
  // Progress
  progress: {
    total: number;
    completed: number;
    failed: number;
    current: string | null;
    currentAttempt: number;
  };
  
  // Tasks
  tasks: TaskDefinition[];
  completedTasks: string[];
  failedTasks: string[];
  currentTaskIndex: number;
  
  // Execution state
  siaInterventions: number;
  lastError: string | null;
  
  // Output
  generatedFiles: number;
  commits: number;
  
  // Timestamps
  startedAt: string;
  lastActivityAt: string;
}

export interface BuildEvent {
  type: string;
  sessionId: string;
  taskId?: string;
  taskName?: string;
  attempt?: number;
  error?: string;
  commitHash?: string;
  timestamp: Date;
}

export interface UseBuildSessionOptions {
  ideaId: string;
  autoConnect?: boolean;
  onStatusChange?: (status: BuildSession['status']) => void;
  onTaskComplete?: (taskId: string) => void;
  onError?: (error: string) => void;
}

export interface UseBuildSessionReturn {
  // State
  session: BuildSession | null;
  events: BuildEvent[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  
  // Actions
  startBuild: () => Promise<BuildSession | null>;
  fetchStatus: () => Promise<void>;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
  skip: () => Promise<boolean>;
  resolve: (resolution: string) => Promise<boolean>;
  
  // Derived state
  isActive: boolean;
  isPaused: boolean;
  isComplete: boolean;
  needsHuman: boolean;
  progressPercent: number;
  currentTask: TaskDefinition | null;
}

export function useBuildSession({
  ideaId,
  autoConnect = true,
  onStatusChange,
  onTaskComplete,
  onError,
}: UseBuildSessionOptions): UseBuildSessionReturn {
  const [session, setSession] = useState<BuildSession | null>(null);
  const [events, setEvents] = useState<BuildEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current build status
  const fetchStatus = useCallback(async () => {
    if (!ideaId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/build/${ideaId}/status`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setSession(null);
          return;
        }
        throw new Error('Failed to fetch build status');
      }

      const data = await response.json();
      
      if (data.status === 'not_started') {
        setSession(null);
        return;
      }

      const newSession: BuildSession = {
        sessionId: data.sessionId,
        ideaId,
        specId: data.specId,
        status: data.status,
        progress: data.progress,
        tasks: data.tasks || [],
        completedTasks: data.completedTasks || [],
        failedTasks: data.failedTasks || [],
        currentTaskIndex: data.progress?.current ? 
          data.tasks?.findIndex((t: TaskDefinition) => t.name === data.progress.current) ?? 0 : 0,
        siaInterventions: data.siaInterventions || 0,
        lastError: data.lastError,
        generatedFiles: data.generatedFiles || 0,
        commits: data.commits || 0,
        startedAt: data.startedAt,
        lastActivityAt: data.lastActivityAt,
      };

      setSession(prev => {
        if (prev?.status !== newSession.status) {
          onStatusChange?.(newSession.status);
        }
        return newSession;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch build status';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [ideaId, onStatusChange, onError]);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!ideaId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/build/${ideaId}/stream`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const buildEvent: BuildEvent = {
            ...data,
            timestamp: new Date(),
          };

          setEvents(prev => [...prev, buildEvent].slice(-100)); // Keep last 100 events

          // Update session based on event
          if (['taskComplete', 'taskFailed', 'buildComplete', 'humanNeeded', 'paused', 'resumed'].includes(data.type)) {
            fetchStatus();
          }

          if (data.type === 'taskComplete') {
            onTaskComplete?.(data.taskId);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [ideaId, fetchStatus, onTaskComplete]);

  // Start a new build
  const startBuild = useCallback(async (): Promise<BuildSession | null> => {
    if (!ideaId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/build/${ideaId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start build');
      }

      // Fetch full status
      await fetchStatus();
      
      // Connect WebSocket for updates
      connectWebSocket();

      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start build';
      setError(msg);
      onError?.(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [ideaId, fetchStatus, connectWebSocket, session, onError]);

  // Pause the build
  const pause = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionId) return false;

    try {
      const response = await fetch(`/api/build/${session.sessionId}/pause`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [session?.sessionId, fetchStatus]);

  // Resume the build
  const resume = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionId) return false;

    try {
      const response = await fetch(`/api/build/${session.sessionId}/resume`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [session?.sessionId, fetchStatus]);

  // Skip current task
  const skip = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionId) return false;

    try {
      const response = await fetch(`/api/build/${session.sessionId}/skip`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [session?.sessionId, fetchStatus]);

  // Resolve current task manually
  const resolve = useCallback(async (resolution: string): Promise<boolean> => {
    if (!session?.sessionId) return false;

    try {
      const response = await fetch(`/api/build/${session.sessionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });

      if (response.ok) {
        await fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [session?.sessionId, fetchStatus]);

  // Initial fetch and WebSocket connection
  useEffect(() => {
    if (autoConnect && ideaId) {
      fetchStatus();
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [autoConnect, ideaId, fetchStatus, connectWebSocket]);

  // Derived state
  const isActive = session?.status === 'active';
  const isPaused = session?.status === 'paused';
  const isComplete = session?.status === 'complete';
  const needsHuman = session?.status === 'human_needed';
  
  const progressPercent = session?.progress 
    ? Math.round((session.progress.completed / Math.max(session.progress.total, 1)) * 100)
    : 0;
  
  const currentTask = session?.tasks && session.currentTaskIndex >= 0
    ? session.tasks[session.currentTaskIndex] ?? null
    : null;

  return {
    session,
    events,
    isLoading,
    isConnected,
    error,
    startBuild,
    fetchStatus,
    pause,
    resume,
    skip,
    resolve,
    isActive,
    isPaused,
    isComplete,
    needsHuman,
    progressPercent,
    currentTask,
  };
}

export default useBuildSession;
