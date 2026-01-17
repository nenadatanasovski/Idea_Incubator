/**
 * ObservabilityConnectionProvider
 *
 * Context provider for shared WebSocket connection across all Observability sub-tabs.
 * Ensures only one connection is active regardless of which sub-tab is viewed.
 */

import { createContext, useContext, ReactNode, useCallback } from "react";
import useObservabilityConnection, {
  ConnectionStatus,
  ObservabilityEvent,
  ObservabilityEventType,
} from "../../hooks/useObservabilityConnection";

interface ObservabilityConnectionContextValue {
  status: ConnectionStatus;
  isConnected: boolean;
  events: ObservabilityEvent[];
  error: Error | null;
  reconnect: () => void;
  clearEvents: () => void;
  subscribe: (eventTypes: ObservabilityEventType[]) => void;
}

const ObservabilityConnectionContext =
  createContext<ObservabilityConnectionContextValue | null>(null);

interface ObservabilityConnectionProviderProps {
  children: ReactNode;
  onEvent?: (event: ObservabilityEvent) => void;
}

export function ObservabilityConnectionProvider({
  children,
  onEvent,
}: ObservabilityConnectionProviderProps) {
  const connection = useObservabilityConnection({
    enabled: true,
    onEvent,
    subscriptions: ["execution", "agent", "question", "event", "assertion"],
  });

  // Get status message for screen readers
  const getStatusMessage = () => {
    switch (connection.status) {
      case "connected":
        return "Connected to real-time updates";
      case "reconnecting":
        return "Reconnecting to real-time updates";
      case "offline":
        return "Offline - real-time updates unavailable";
      default:
        return "";
    }
  };

  return (
    <ObservabilityConnectionContext.Provider value={connection}>
      {/* ARIA live region for connection status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {getStatusMessage()}
      </div>
      {children}
    </ObservabilityConnectionContext.Provider>
  );
}

/**
 * Hook to access the shared observability connection
 */
export function useObservabilityConnectionContext(): ObservabilityConnectionContextValue {
  const context = useContext(ObservabilityConnectionContext);
  if (!context) {
    // Return a default disconnected state if used outside provider
    return {
      status: "offline" as ConnectionStatus,
      isConnected: false,
      events: [],
      error: null,
      reconnect: () => {},
      clearEvents: () => {},
      subscribe: () => {},
    };
  }
  return context;
}

/**
 * Hook to subscribe to specific event types and receive callbacks
 */
export function useObservabilityEvents(eventTypes: ObservabilityEventType[]) {
  const { events, subscribe } = useObservabilityConnectionContext();

  // Subscribe to specified event types
  const subscribeToEvents = useCallback(() => {
    subscribe(eventTypes);
  }, [subscribe, eventTypes]);

  // Filter events to only include subscribed types
  const filteredEvents = events.filter((e) => eventTypes.includes(e.type));

  return {
    events: filteredEvents,
    subscribeToEvents,
  };
}

export default ObservabilityConnectionProvider;
