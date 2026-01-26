/**
 * useGraphWebSocket Hook
 * Real-time WebSocket connection for graph updates in Memory Graph visualization
 *
 * Handles:
 * - block_created events
 * - block_updated events
 * - link_created events
 * - link_removed events
 * - Automatic reconnection with exponential backoff
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ApiBlock } from "../../../types/graph";

// ============================================================================
// Types
// ============================================================================

export interface WebSocketEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp?: string;
}

export interface BlockCreatedPayload extends Partial<ApiBlock> {
  id: string;
  type?: string;
  title?: string | null; // Short 3-5 word summary
  content?: string;
  properties?: Record<string, unknown>;
}

export interface BlockUpdatedPayload {
  id: string;
  status?: string;
  content?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LinkCreatedPayload {
  id: string;
  link_type: string;
  source: string;
  target: string;
  degree?: string;
  confidence?: number;
  reason?: string;
}

export interface LinkRemovedPayload {
  id: string;
}

// Source mapping event payloads
export type SourceMappingStatus =
  | "started"
  | "processing"
  | "complete"
  | "failed"
  | "cancelled";

export interface SourceMappingPayload {
  jobId: string;
  blocksToMap: number;
  sourcesAvailable: number;
  mappingsCreated?: number;
  progress?: number; // 0-100
  status: SourceMappingStatus;
  error?: string;
}

export interface UseGraphWebSocketOptions {
  sessionId: string;
  wsUrl?: string;
  onBlockCreated?: (payload: BlockCreatedPayload) => void;
  onBlockUpdated?: (payload: BlockUpdatedPayload) => void;
  onLinkCreated?: (payload: LinkCreatedPayload) => void;
  onLinkRemoved?: (payload: LinkRemovedPayload) => void;
  // Source mapping events (background Claude Opus 4.5 processing)
  onSourceMappingStarted?: (payload: SourceMappingPayload) => void;
  onSourceMappingProgress?: (payload: SourceMappingPayload) => void;
  onSourceMappingComplete?: (payload: SourceMappingPayload) => void;
  onSourceMappingFailed?: (payload: SourceMappingPayload) => void;
  onSourceMappingCancelled?: (payload: SourceMappingPayload) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseGraphWebSocketReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
  lastEventTimestamp: string | null;
  connect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RECONNECT_INTERVAL = 1000; // 1 second base interval
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const MAX_BACKOFF_INTERVAL = 30000; // 30 seconds max

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time WebSocket updates to the graph
 */
export function useGraphWebSocket(
  options: UseGraphWebSocketOptions,
): UseGraphWebSocketReturn {
  const {
    sessionId,
    wsUrl,
    onBlockCreated,
    onBlockUpdated,
    onLinkCreated,
    onLinkRemoved,
    onSourceMappingStarted,
    onSourceMappingProgress,
    onSourceMappingComplete,
    onSourceMappingFailed,
    onSourceMappingCancelled,
    onError,
    onConnect,
    onDisconnect,
    reconnect = true,
    reconnectInterval = DEFAULT_RECONNECT_INTERVAL,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
  } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<string | null>(
    null,
  );

  // Refs for stable callback references and WebSocket instance
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(reconnect);
  const mountedRef = useRef(true);

  // Store latest callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onBlockCreated,
    onBlockUpdated,
    onLinkCreated,
    onLinkRemoved,
    onSourceMappingStarted,
    onSourceMappingProgress,
    onSourceMappingComplete,
    onSourceMappingFailed,
    onSourceMappingCancelled,
    onError,
    onConnect,
    onDisconnect,
  });

  // Update callback refs when they change
  useEffect(() => {
    callbacksRef.current = {
      onBlockCreated,
      onBlockUpdated,
      onLinkCreated,
      onLinkRemoved,
      onSourceMappingStarted,
      onSourceMappingProgress,
      onSourceMappingComplete,
      onSourceMappingFailed,
      onSourceMappingCancelled,
      onError,
      onConnect,
      onDisconnect,
    };
  }, [
    onBlockCreated,
    onBlockUpdated,
    onLinkCreated,
    onLinkRemoved,
    onSourceMappingStarted,
    onSourceMappingProgress,
    onSourceMappingComplete,
    onSourceMappingFailed,
    onSourceMappingCancelled,
    onError,
    onConnect,
    onDisconnect,
  ]);

  /**
   * Calculate backoff interval with exponential increase
   */
  const calculateBackoffInterval = useCallback(
    (attempt: number): number => {
      const backoff = reconnectInterval * Math.pow(2, attempt);
      return Math.min(backoff, MAX_BACKOFF_INTERVAL);
    },
    [reconnectInterval],
  );

  /**
   * Build the WebSocket URL
   */
  const buildWsUrl = useCallback((): string => {
    if (wsUrl) {
      return wsUrl;
    }

    // Build URL based on current location
    // Server expects session as query param: /ws?session={sessionId}
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws?session=${sessionId}`;
  }, [wsUrl, sessionId]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: WebSocketEvent = JSON.parse(event.data);
      const timestamp = data.timestamp || new Date().toISOString();

      if (mountedRef.current) {
        setLastEventTimestamp(timestamp);
      }

      switch (data.type) {
        case "block_created":
          callbacksRef.current.onBlockCreated?.(
            data.payload as BlockCreatedPayload,
          );
          break;

        case "block_updated":
          callbacksRef.current.onBlockUpdated?.(
            data.payload as BlockUpdatedPayload,
          );
          break;

        case "link_created":
          callbacksRef.current.onLinkCreated?.(
            data.payload as LinkCreatedPayload,
          );
          break;

        case "link_removed":
          callbacksRef.current.onLinkRemoved?.(
            data.payload as LinkRemovedPayload,
          );
          break;

        // Source mapping events (wrapped in IdeationEvent format)
        case "source_mapping_started":
          callbacksRef.current.onSourceMappingStarted?.(
            data.data as unknown as SourceMappingPayload,
          );
          break;

        case "source_mapping_progress":
          callbacksRef.current.onSourceMappingProgress?.(
            data.data as unknown as SourceMappingPayload,
          );
          break;

        case "source_mapping_complete":
          callbacksRef.current.onSourceMappingComplete?.(
            data.data as unknown as SourceMappingPayload,
          );
          break;

        case "source_mapping_failed":
          callbacksRef.current.onSourceMappingFailed?.(
            data.data as unknown as SourceMappingPayload,
          );
          break;

        case "source_mapping_cancelled":
          callbacksRef.current.onSourceMappingCancelled?.(
            data.data as unknown as SourceMappingPayload,
          );
          break;

        case "ping":
          // Respond to server pings if needed
          wsRef.current?.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          // Unknown event type - log but don't error
          console.debug(`Unknown WebSocket event type: ${data.type}`);
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
      const error = err instanceof Error ? err : new Error("Parse error");
      callbacksRef.current.onError?.(error);
    }
  }, []);

  /**
   * Schedule a reconnection attempt
   */
  const scheduleReconnect = useCallback(
    (attempt: number) => {
      if (!shouldReconnectRef.current || attempt >= maxReconnectAttempts) {
        if (mountedRef.current) {
          setIsReconnecting(false);
        }
        return;
      }

      const interval = calculateBackoffInterval(attempt);
      console.debug(
        `Scheduling WebSocket reconnect attempt ${attempt + 1} in ${interval}ms`,
      );

      if (mountedRef.current) {
        setIsReconnecting(true);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current && shouldReconnectRef.current) {
          setReconnectAttempts(attempt + 1);
          connect();
        }
      }, interval);
    },
    [maxReconnectAttempts, calculateBackoffInterval],
  );

  /**
   * Clean up WebSocket and reconnection timeout
   */
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent triggering reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    // Clean up any existing connection
    cleanup();

    if (!sessionId) {
      console.debug("WebSocket connect skipped: no sessionId");
      return;
    }

    // Validate sessionId looks like a valid UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(sessionId)) {
      console.debug(
        `WebSocket connect skipped: invalid sessionId format "${sessionId}"`,
      );
      return;
    }

    try {
      const url = buildWsUrl();
      console.debug(`WebSocket connecting to ${url}`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setIsConnected(true);
          setIsReconnecting(false);
          setReconnectAttempts(0);
          setLastError(null);
        }
        callbacksRef.current.onConnect?.();
        console.debug(`WebSocket connected to ${url}`);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        // WebSocket error events don't provide much detail
        // The actual error details come from the close event
        console.warn(
          "WebSocket error occurred - waiting for close event for details",
        );
        const error = new Error("WebSocket connection error");
        if (mountedRef.current) {
          setLastError(error);
        }
        callbacksRef.current.onError?.(error);
      };

      ws.onclose = (event) => {
        // Log close details for debugging
        console.debug(
          `WebSocket closed: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`,
        );

        if (mountedRef.current) {
          setIsConnected(false);
        }
        callbacksRef.current.onDisconnect?.();

        // Check if we should reconnect
        if (
          shouldReconnectRef.current &&
          !event.wasClean &&
          reconnectAttempts < maxReconnectAttempts
        ) {
          scheduleReconnect(reconnectAttempts);
        }
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Connection failed");
      if (mountedRef.current) {
        setLastError(error);
      }
      callbacksRef.current.onError?.(error);
    }
  }, [
    sessionId,
    buildWsUrl,
    cleanup,
    handleMessage,
    reconnectAttempts,
    maxReconnectAttempts,
    scheduleReconnect,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    cleanup();
    if (mountedRef.current) {
      setIsConnected(false);
      setIsReconnecting(false);
    }
  }, [cleanup]);

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    shouldReconnectRef.current = reconnect;

    if (sessionId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      cleanup();
    };
  }, [sessionId, reconnect]); // Only reconnect when sessionId changes

  return {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    lastError,
    lastEventTimestamp,
    connect,
    disconnect,
  };
}

export default useGraphWebSocket;
