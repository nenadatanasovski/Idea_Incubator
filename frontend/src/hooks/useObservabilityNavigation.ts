/**
 * Observability Navigation Hook (OBS-710)
 * Provides navigation helpers for deep linking between observability entities.
 */

import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { EntityType } from "../types/observability";

/**
 * Hook for navigating between observability entities with deep linking.
 */
export function useObservabilityNavigation() {
  const navigate = useNavigate();
  const { executionId, taskId, toolUseId, assertionId, skillTraceId, entryId } =
    useParams();

  // Navigate to execution
  const goToExecution = useCallback(
    (
      id: string,
      view?: "timeline" | "tool-uses" | "assertions" | "skills" | "logs",
    ) => {
      const path = view
        ? `/observability/executions/${id}/${view}`
        : `/observability/executions/${id}`;
      navigate(path);
    },
    [navigate],
  );

  // Navigate to executions list
  const goToExecutionsList = useCallback(() => {
    navigate("/observability/executions");
  }, [navigate]);

  // Navigate to tool use
  const goToToolUse = useCallback(
    (
      execId: string,
      toolUseIdParam: string,
      options?: { showContext?: boolean },
    ) => {
      const params = new URLSearchParams();
      if (options?.showContext) params.set("context", "transcript");
      const query = params.toString();
      navigate(
        `/observability/executions/${execId}/tool-uses/${toolUseIdParam}${query ? `?${query}` : ""}`,
      );
    },
    [navigate],
  );

  // Navigate to assertion
  const goToAssertion = useCallback(
    (
      execId: string,
      assertionIdParam: string,
      options?: { expandEvidence?: boolean },
    ) => {
      const params = new URLSearchParams();
      if (options?.expandEvidence) params.set("expand", "evidence");
      const query = params.toString();
      navigate(
        `/observability/executions/${execId}/assertions/${assertionIdParam}${query ? `?${query}` : ""}`,
      );
    },
    [navigate],
  );

  // Navigate to skill trace
  const goToSkillTrace = useCallback(
    (execId: string, skillTraceIdParam: string) => {
      navigate(
        `/observability/executions/${execId}/skills/${skillTraceIdParam}`,
      );
    },
    [navigate],
  );

  // Navigate to transcript entry
  const goToTranscriptEntry = useCallback(
    (execId: string, entryIdParam: string) => {
      navigate(
        `/observability/executions/${execId}/transcript/${entryIdParam}`,
      );
    },
    [navigate],
  );

  // Navigate to task view
  const goToTask = useCallback(
    (taskIdParam: string) => {
      navigate(`/observability/tasks/${taskIdParam}`);
    },
    [navigate],
  );

  // Generic entity navigation
  const goToEntity = useCallback(
    (entityType: EntityType, entityId: string, executionIdParam?: string) => {
      const execId = executionIdParam || executionId;
      if (!execId && entityType !== "execution" && entityType !== "task")
        return;

      switch (entityType) {
        case "execution":
          goToExecution(entityId);
          break;
        case "task":
          goToTask(entityId);
          break;
        case "tool_use":
          if (execId) goToToolUse(execId, entityId);
          break;
        case "assertion":
          if (execId) goToAssertion(execId, entityId);
          break;
        case "skill_trace":
          if (execId) goToSkillTrace(execId, entityId);
          break;
        case "transcript":
          if (execId) goToTranscriptEntry(execId, entityId);
          break;
      }
    },
    [
      executionId,
      goToExecution,
      goToTask,
      goToToolUse,
      goToAssertion,
      goToSkillTrace,
      goToTranscriptEntry,
    ],
  );

  // Go back in history
  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Build shareable link
  const buildShareableLink = useCallback(
    (entityType: EntityType, entityId: string, executionIdParam?: string) => {
      const execId = executionIdParam || executionId;
      const base = typeof window !== "undefined" ? window.location.origin : "";

      switch (entityType) {
        case "execution":
          return `${base}/observability/executions/${entityId}`;
        case "task":
          return `${base}/observability/tasks/${entityId}`;
        case "tool_use":
          return `${base}/observability/executions/${execId}/tool-uses/${entityId}`;
        case "assertion":
          return `${base}/observability/executions/${execId}/assertions/${entityId}`;
        case "skill_trace":
          return `${base}/observability/executions/${execId}/skills/${entityId}`;
        case "transcript":
          return `${base}/observability/executions/${execId}/transcript/${entityId}`;
        default:
          return base;
      }
    },
    [executionId],
  );

  // Copy link to clipboard
  const copyLinkToClipboard = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      executionIdParam?: string,
    ) => {
      const link = buildShareableLink(entityType, entityId, executionIdParam);
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        return true;
      }
      return false;
    },
    [buildShareableLink],
  );

  return {
    // Current context from URL params
    currentExecutionId: executionId,
    currentTaskId: taskId,
    currentToolUseId: toolUseId,
    currentAssertionId: assertionId,
    currentSkillTraceId: skillTraceId,
    currentEntryId: entryId,

    // Navigation functions
    goToExecution,
    goToExecutionsList,
    goToToolUse,
    goToAssertion,
    goToSkillTrace,
    goToTranscriptEntry,
    goToTask,
    goToEntity,
    goBack,

    // Utilities
    buildShareableLink,
    copyLinkToClipboard,
  };
}

/**
 * Hook for breadcrumb navigation data.
 */
export function useObservabilityBreadcrumbs() {
  const {
    currentExecutionId,
    currentTaskId,
    currentToolUseId,
    currentAssertionId,
    currentSkillTraceId,
    currentEntryId,
  } = useObservabilityNavigation();

  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: "Observability", href: "/observability" },
  ];

  if (currentExecutionId) {
    breadcrumbs.push({
      label: "Executions",
      href: "/observability/executions",
    });
    breadcrumbs.push({
      label: `Execution ${currentExecutionId.slice(0, 8)}...`,
      href: `/observability/executions/${currentExecutionId}`,
    });
  }

  if (currentTaskId) {
    breadcrumbs.push({
      label: `Task ${currentTaskId.slice(0, 8)}...`,
      href: `/observability/tasks/${currentTaskId}`,
    });
  }

  if (currentToolUseId) {
    breadcrumbs.push({
      label: "Tool Uses",
      href: `/observability/executions/${currentExecutionId}/tool-uses`,
    });
    breadcrumbs.push({
      label: `Tool Use ${currentToolUseId.slice(0, 8)}...`,
    });
  }

  if (currentAssertionId) {
    breadcrumbs.push({
      label: "Assertions",
      href: `/observability/executions/${currentExecutionId}/assertions`,
    });
    breadcrumbs.push({
      label: `Assertion ${currentAssertionId.slice(0, 8)}...`,
    });
  }

  if (currentSkillTraceId) {
    breadcrumbs.push({
      label: "Skills",
      href: `/observability/executions/${currentExecutionId}/skills`,
    });
    breadcrumbs.push({
      label: `Skill ${currentSkillTraceId.slice(0, 8)}...`,
    });
  }

  if (currentEntryId) {
    breadcrumbs.push({
      label: "Timeline",
      href: `/observability/executions/${currentExecutionId}`,
    });
    breadcrumbs.push({
      label: `Entry ${currentEntryId.slice(0, 8)}...`,
    });
  }

  return breadcrumbs;
}
