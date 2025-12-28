import { useState, useEffect, useCallback, useRef } from 'react';

// Event types matching server broadcast.ts
export type DebateEventType =
  | 'connected'
  | 'debate:started'
  | 'debate:criterion:start'     // NEW: Marks start of debate for a specific criterion
  | 'debate:round:started'
  | 'evaluator:initial'          // NEW: Initial assessment (before debate)
  | 'evaluator:speaking'         // DEPRECATED: Use evaluator:initial or evaluator:defense
  | 'evaluator:defense'          // NEW: Defense against red team (during debate)
  | 'redteam:challenge'
  | 'arbiter:verdict'
  | 'debate:round:complete'
  | 'debate:criterion:complete'  // NEW: Marks end of debate for a specific criterion
  | 'debate:complete'
  | 'synthesis:started'
  | 'synthesis:complete'
  | 'error'
  | 'pong';

export interface DebateEvent {
  type: DebateEventType;
  timestamp: string;
  ideaSlug: string;
  runId?: string;
  data: {
    criterion?: string;
    category?: string;
    roundNumber?: number;
    persona?: string;
    content?: string;
    score?: number;
    adjustment?: number;
    verdict?: string;
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface DebateStreamState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  events: DebateEvent[];
  currentRound: number;
  currentCriterion: string | null;
  phase: 'idle' | 'evaluating' | 'challenging' | 'judging' | 'synthesizing' | 'complete';
}

interface UseDebateStreamOptions {
  ideaSlug: string;
  autoConnect?: boolean;
  maxEvents?: number;
}

// WebSocket URL - in dev, connect directly to backend; in prod, use same host
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // In development, Vite runs on 5173, backend on 3001 - connect directly to backend
  if (import.meta.env.DEV) {
    return 'ws://localhost:3001';
  }
  // In production, WebSocket is on the same host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export function useDebateStream({
  ideaSlug,
  autoConnect = true,
  maxEvents = 500, // Increased to handle full 30-criterion evaluations
}: UseDebateStreamOptions) {
  const [state, setState] = useState<DebateStreamState>({
    connected: false,
    connecting: false,
    error: null,
    events: [],
    currentRound: 0,
    currentCriterion: null,
    phase: 'idle',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const connectingRef = useRef(false); // Guard against concurrent connection attempts
  const ideaSlugRef = useRef(ideaSlug);

  // Keep slug ref updated
  ideaSlugRef.current = ideaSlug;

  const addEvent = useCallback(
    (event: DebateEvent) => {
      setState((prev) => ({
        ...prev,
        events: [...prev.events.slice(-maxEvents + 1), event],
      }));
    },
    [maxEvents]
  );

  const updatePhase = useCallback((type: DebateEventType, data: DebateEvent['data']) => {
    setState((prev) => {
      let phase = prev.phase;
      let currentRound = prev.currentRound;
      let currentCriterion = prev.currentCriterion;

      switch (type) {
        case 'debate:started':
          phase = 'idle';
          currentRound = 0;
          break;
        case 'debate:criterion:start':
          // New criterion debate starting
          currentCriterion = data.criterion || null;
          phase = 'evaluating';
          break;
        case 'debate:round:started':
          currentRound = data.roundNumber || prev.currentRound + 1;
          currentCriterion = data.criterion || prev.currentCriterion;
          break;
        case 'evaluator:initial':
        case 'evaluator:speaking':
          phase = 'evaluating';
          break;
        case 'redteam:challenge':
          phase = 'challenging';
          currentCriterion = data.criterion || prev.currentCriterion;
          break;
        case 'evaluator:defense':
          phase = 'evaluating';
          break;
        case 'arbiter:verdict':
          phase = 'judging';
          break;
        case 'debate:round:complete':
          phase = 'idle';
          break;
        case 'debate:criterion:complete':
          // Criterion debate complete, stay idle until next
          phase = 'idle';
          break;
        case 'synthesis:started':
          phase = 'synthesizing';
          break;
        case 'synthesis:complete':
        case 'debate:complete':
          phase = 'complete';
          break;
      }

      return { ...prev, phase, currentRound, currentCriterion };
    });
  }, []);

  const connect = useCallback(() => {
    // Guard: already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Guard: concurrent connection attempt or unmounted
    if (connectingRef.current || !isMountedRef.current) {
      return;
    }

    connectingRef.current = true;
    setState((prev) => ({ ...prev, connecting: true, error: null }));

    // Use ref to get current slug value
    const slug = ideaSlugRef.current;
    const ws = new WebSocket(`${getWsUrl()}/ws?idea=${encodeURIComponent(slug)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      connectingRef.current = false;
      if (!isMountedRef.current) {
        ws.close();
        return;
      }
      setState((prev) => ({ ...prev, connected: true, connecting: false, error: null }));

      // Start ping interval to keep connection alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data: DebateEvent = JSON.parse(event.data);
        if (data.type !== 'pong') {
          addEvent(data);
          updatePhase(data.type, data.data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      connectingRef.current = false;
      if (!isMountedRef.current) return;
      setState((prev) => ({
        ...prev,
        error: 'WebSocket connection error',
        connecting: false,
      }));
    };

    ws.onclose = () => {
      connectingRef.current = false;
      if (!isMountedRef.current) return;
      setState((prev) => ({ ...prev, connected: false, connecting: false }));

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Attempt reconnect after 5 seconds if still mounted
      reconnectTimeoutRef.current = setTimeout(() => {
        if (autoConnect && isMountedRef.current) {
          connect();
        }
      }, 5000);
    };
  }, [addEvent, updatePhase, autoConnect]); // Removed ideaSlug - using ref instead

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      // Only close if connection is open or connecting
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    connectingRef.current = false;
  }, []);

  const clearEvents = useCallback(() => {
    setState((prev) => ({ ...prev, events: [] }));
  }, []);

  // Auto-connect on mount - use refs for stable behavior with React Strict Mode
  useEffect(() => {
    isMountedRef.current = true;

    // Small delay to handle React Strict Mode double-mount
    const connectTimeout = setTimeout(() => {
      if (autoConnect && ideaSlug && isMountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(connectTimeout);
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaSlug]);

  return {
    ...state,
    connect,
    disconnect,
    clearEvents,
  };
}
