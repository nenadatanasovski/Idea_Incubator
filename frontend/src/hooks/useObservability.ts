/**
 * Observability Data Hooks
 * React hooks for fetching observability data from the API
 */

import { useState, useEffect, useCallback } from "react";
import type {
  ExecutionRun,
  TranscriptEntry,
  ToolUse,
  AssertionResultEntry,
  SkillTrace,
  MessageBusLogEntry,
  ToolSummary,
  AssertionSummary,
  CrossReference,
  PaginatedResponse,
  EntityType,
} from "../types/observability";

const API_BASE = "/api/observability";

// Generic API fetcher
async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  const json = await response.json();
  if (!json.success) {
    throw new Error(json.error || "Unknown error");
  }
  return json.data;
}

// === Execution Hooks ===

interface UseExecutionsOptions {
  status?: string;
  taskListId?: string;
  limit?: number;
  offset?: number;
}

export function useExecutions(options: UseExecutionsOptions = {}) {
  const [data, setData] = useState<PaginatedResponse<ExecutionRun> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      if (options.taskListId) params.set("taskListId", options.taskListId);
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const query = params.toString();
      const result = await fetchApi<PaginatedResponse<ExecutionRun>>(
        `/executions${query ? `?${query}` : ""}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [options.status, options.taskListId, options.limit, options.offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    executions: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    error,
    refetch: fetchData,
  };
}

export function useExecution(id: string | undefined) {
  const [execution, setExecution] = useState<ExecutionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchApi<ExecutionRun>(`/executions/${id}`);
      setExecution(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { execution, loading, error, refetch: fetchData };
}

// === Transcript Hook ===

interface UseTranscriptOptions {
  entryType?: string;
  category?: string;
  taskId?: string;
  limit?: number;
  offset?: number;
}

export function useTranscript(
  executionId: string | undefined,
  options: UseTranscriptOptions = {},
) {
  const [data, setData] = useState<PaginatedResponse<TranscriptEntry> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.entryType) params.set("entryType", options.entryType);
      if (options.category) params.set("category", options.category);
      if (options.taskId) params.set("taskId", options.taskId);
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const query = params.toString();
      const result = await fetchApi<PaginatedResponse<TranscriptEntry>>(
        `/executions/${executionId}/transcript${query ? `?${query}` : ""}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [
    executionId,
    options.entryType,
    options.category,
    options.taskId,
    options.limit,
    options.offset,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    entries: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    error,
    refetch: fetchData,
  };
}

// === Tool Uses Hook ===

interface UseToolUsesOptions {
  tool?: string;
  category?: string;
  status?: string;
  isError?: boolean;
  limit?: number;
  offset?: number;
}

export function useToolUses(
  executionId: string | undefined,
  options: UseToolUsesOptions = {},
) {
  const [data, setData] = useState<PaginatedResponse<ToolUse> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.tool) params.set("tool", options.tool);
      if (options.category) params.set("category", options.category);
      if (options.status) params.set("status", options.status);
      if (options.isError !== undefined)
        params.set("isError", String(options.isError));
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const query = params.toString();
      const result = await fetchApi<PaginatedResponse<ToolUse>>(
        `/executions/${executionId}/tool-uses${query ? `?${query}` : ""}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [
    executionId,
    options.tool,
    options.category,
    options.status,
    options.isError,
    options.limit,
    options.offset,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    toolUses: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    error,
    refetch: fetchData,
  };
}

// === Assertions Hook ===

interface UseAssertionsOptions {
  result?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function useAssertions(
  executionId: string | undefined,
  options: UseAssertionsOptions = {},
) {
  const [data, setData] =
    useState<PaginatedResponse<AssertionResultEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.result) params.set("result", options.result);
      if (options.category) params.set("category", options.category);
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const query = params.toString();
      const result = await fetchApi<PaginatedResponse<AssertionResultEntry>>(
        `/executions/${executionId}/assertions${query ? `?${query}` : ""}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [
    executionId,
    options.result,
    options.category,
    options.limit,
    options.offset,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    assertions: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    error,
    refetch: fetchData,
  };
}

// === Skill Traces Hook ===

export function useSkillTraces(
  executionId: string | undefined,
  options: { limit?: number; offset?: number } = {},
) {
  const [data, setData] = useState<PaginatedResponse<SkillTrace> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const query = params.toString();
      const result = await fetchApi<PaginatedResponse<SkillTrace>>(
        `/executions/${executionId}/skills${query ? `?${query}` : ""}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [executionId, options.limit, options.offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    skills: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    error,
    refetch: fetchData,
  };
}

// === Summary Hooks ===

export function useToolSummary(executionId: string | undefined) {
  const [summary, setSummary] = useState<ToolSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchApi<ToolSummary>(
        `/executions/${executionId}/tool-summary`,
      );
      setSummary(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { summary, loading, error, refetch: fetchData };
}

export function useAssertionSummary(executionId: string | undefined) {
  const [summary, setSummary] = useState<AssertionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchApi<AssertionSummary>(
        `/executions/${executionId}/assertion-summary`,
      );
      setSummary(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { summary, loading, error, refetch: fetchData };
}

// === Message Bus Hook ===

interface UseMessageBusOptions {
  executionId?: string;
  severity?: string;
  category?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export function useMessageBusLogs(options: UseMessageBusOptions = {}) {
  const [data, setData] =
    useState<PaginatedResponse<MessageBusLogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (options.executionId) params.set("executionId", options.executionId);
      if (options.severity) params.set("severity", options.severity);
      if (options.category) params.set("category", options.category);
      if (options.source) params.set("source", options.source);
      if (options.limit) params.set("limit", String(options.limit));
      if (options.offset) params.set("offset", String(options.offset));

      const query = params.toString();
      const result = await fetchApi<PaginatedResponse<MessageBusLogEntry>>(
        `/logs/message-bus${query ? `?${query}` : ""}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [
    options.executionId,
    options.severity,
    options.category,
    options.source,
    options.limit,
    options.offset,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    logs: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading,
    error,
    refetch: fetchData,
  };
}

// === Cross-References Hook ===

export function useCrossRefs(
  entityType: EntityType | undefined,
  entityId: string | undefined,
) {
  const [crossRef, setCrossRef] = useState<CrossReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!entityType || !entityId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchApi<CrossReference>(
        `/cross-refs/${entityType}/${entityId}`,
      );
      setCrossRef(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { crossRef, loading, error, refetch: fetchData };
}
