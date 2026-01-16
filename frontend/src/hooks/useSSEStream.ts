// =============================================================================
// FILE: frontend/src/hooks/useSSEStream.ts
// SSE streaming hook for real-time AI responses
// =============================================================================

import { useCallback, useRef } from "react";

interface SSEStreamOptions {
  onChunk: (chunk: string) => void;
  onComplete: (finalData?: unknown) => void;
  onError: (error: Error) => void;
}

export function useSSEStream() {
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(
    (url: string, options: SSEStreamOptions): EventSource => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "chunk") {
            options.onChunk(data.content);
          } else if (data.type === "complete") {
            options.onComplete(data.data);
            eventSource.close();
          } else if (data.type === "error") {
            options.onError(new Error(data.message || "Stream error"));
            eventSource.close();
          }
        } catch (error) {
          // If not JSON, treat as plain text chunk
          options.onChunk(event.data);
        }
      };

      eventSource.onerror = () => {
        // Check if we're just at the end of stream
        if (eventSource.readyState === EventSource.CLOSED) {
          options.onComplete();
        } else {
          options.onError(new Error("SSE connection failed"));
          eventSource.close();
        }
      };

      return eventSource;
    },
    [],
  );

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { connect, disconnect };
}

/**
 * Hook for managing streaming text state.
 */
export function useStreamingText() {
  const textRef = useRef("");

  const startStream = useCallback(() => {
    textRef.current = "";
  }, []);

  const appendChunk = useCallback((chunk: string) => {
    textRef.current += chunk;
    return textRef.current;
  }, []);

  const endStream = useCallback(() => {
    const finalText = textRef.current;
    textRef.current = "";
    return finalText;
  }, []);

  const getText = useCallback(() => {
    return textRef.current;
  }, []);

  return {
    startStream,
    appendChunk,
    endStream,
    getText,
  };
}
