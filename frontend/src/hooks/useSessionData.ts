// =============================================================================
// useSessionData.ts
// Simple hook to load session data including artifacts and messages
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import type { Artifact } from "../types/ideation";

interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface SessionData {
  session: {
    id: string;
    idea_id: string;
    status: string;
    created_at: string;
  } | null;
  messages: SessionMessage[];
  artifacts: Artifact[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSessionData(sessionId: string | undefined): SessionData {
  const [session, setSession] = useState<SessionData["session"]>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ideation/session/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      const data = await response.json();
      setSession(data.session);
      setMessages(data.messages || []);
      setArtifacts(data.artifacts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    session,
    messages,
    artifacts,
    isLoading,
    error,
    refetch: fetchData,
  };
}
