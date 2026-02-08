/**
 * useSpec Hook
 *
 * Manages spec state via API polling.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-009-B)
 */

import { useState, useEffect, useCallback } from "react";
import type { Spec, SpecSection, ReadinessScore } from "../types/spec";

export interface UseSpecOptions {
  sessionId: string;
  specId?: string | null;
  /** Set to false to disable auto-fetching */
  enabled?: boolean;
  onWorkflowChange?: (fromState: string, toState: string) => void;
}

export interface UseSpecReturn {
  spec: Spec | null;
  sections: SpecSection[];
  readiness: ReadinessScore | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  fetchSpec: () => Promise<void>;
  updateSection: (sectionId: string, content: string) => Promise<void>;
  submitForReview: () => Promise<void>;
  approve: () => Promise<void>;
  requestChanges: (reason?: string) => Promise<void>;
  archive: () => Promise<void>;
}

export function useSpec({
  sessionId,
  specId,
  enabled = true,
  onWorkflowChange,
}: UseSpecOptions): UseSpecReturn {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [sections, setSections] = useState<SpecSection[]>([]);
  const [readiness, _setReadiness] = useState<ReadinessScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch spec data
  const fetchSpec = useCallback(async () => {
    if (!enabled || (!specId && !sessionId)) return;

    setIsLoading(true);
    setError(null);

    try {
      const endpoint = specId
        ? `/api/specs/${specId}`
        : `/api/specs/session/${sessionId}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        if (response.status === 404) {
          // No spec found - not an error
          setSpec(null);
          setSections([]);
          return;
        }
        throw new Error("Failed to fetch spec");
      }

      const data = await response.json();
      setSpec(data.spec);
      setSections(data.sections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch spec");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, specId, sessionId]);

  // Update a section
  const updateSection = useCallback(
    async (sectionId: string, content: string) => {
      if (!spec) return;

      try {
        const response = await fetch(
          `/api/specs/${spec.id}/sections/${sectionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to update section");
        }

        // Optimistic update
        setSections((prev) =>
          prev.map((s) => (s.id === sectionId ? { ...s, content } : s)),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update section",
        );
        throw err;
      }
    },
    [spec],
  );

  // Submit for review
  const submitForReview = useCallback(async () => {
    if (!spec) return;

    try {
      const response = await fetch(`/api/specs/${spec.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit for review");
      }

      const data = await response.json();
      setSpec(data.spec);
      onWorkflowChange?.("draft", "review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit for review",
      );
      throw err;
    }
  }, [spec, onWorkflowChange]);

  // Approve spec
  const approve = useCallback(async () => {
    if (!spec) return;

    try {
      const response = await fetch(`/api/specs/${spec.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve");
      }

      const data = await response.json();
      setSpec(data.spec);
      onWorkflowChange?.("review", "approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
      throw err;
    }
  }, [spec, onWorkflowChange]);

  // Request changes
  const requestChanges = useCallback(
    async (reason?: string) => {
      if (!spec) return;

      try {
        const response = await fetch(`/api/specs/${spec.id}/request-changes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to request changes");
        }

        const data = await response.json();
        setSpec(data.spec);
        onWorkflowChange?.("review", "draft");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to request changes",
        );
        throw err;
      }
    },
    [spec, onWorkflowChange],
  );

  // Archive spec
  const archive = useCallback(async () => {
    if (!spec) return;

    try {
      const response = await fetch(`/api/specs/${spec.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to archive");
      }

      const data = await response.json();
      setSpec(data.spec);
      onWorkflowChange?.(spec.workflowState, "archived");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive");
      throw err;
    }
  }, [spec, onWorkflowChange]);

  // Fetch spec on mount and when specId/sessionId changes
  useEffect(() => {
    fetchSpec();
  }, [fetchSpec]);

  // WebSocket subscription disabled - using polling instead
  // The WebSocket connection was causing errors due to proxy/connection issues
  // Real-time updates can be re-enabled later if needed

  return {
    spec,
    sections,
    readiness,
    isLoading,
    error,
    fetchSpec,
    updateSection,
    submitForReview,
    approve,
    requestChanges,
    archive,
  };
}

export default useSpec;
