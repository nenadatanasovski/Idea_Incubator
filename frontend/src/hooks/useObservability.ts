/**
 * Observability Data Hooks
 * React hooks for fetching observability data from the API
 */

import { useState, useEffect, useCallback, useMemo } from "react";
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

// === Custom Error Classes ===

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// === Enhanced API Fetcher with Retry Logic ===

interface FetchOptions {
  retries?: number;
  retryDelay?: number;
}

async function fetchApiWithRetry<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const { retries = 3, retryDelay = 1000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundError(`Resource not found: ${endpoint}`);
        }
        throw new ApiError(
          `API error: ${response.status} ${response.statusText}`,
          response.status,
        );
      }
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Unknown error");
      }
      return json.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry on 404 errors
      if (err instanceof NotFoundError) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1)),
        );
      }
    }
  }

  throw lastError!;
}

// Generic API fetcher (backward compatible)
async function fetchApi<T>(endpoint: string): Promise<T> {
  return fetchApiWithRetry<T>(endpoint, { retries: 0 });
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

// === Debounced Filter Hooks (OBS-704) ===

/**
 * Simple debounce function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounced = ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T & { cancel: () => void };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  return debounced;
}

/**
 * Hook for debounced tool use filtering.
 * Prevents excessive API calls when filters change rapidly.
 */
export function useToolUsesDebounced(
  executionId: string | undefined,
  initialOptions: UseToolUsesOptions = {},
  debounceMs: number = 300,
) {
  const [options, setOptions] = useState(initialOptions);
  const { toolUses, total, hasMore, loading, error, refetch } = useToolUses(
    executionId,
    options,
  );

  // Debounced setter for filter updates
  const debouncedSetOptions = useMemo(
    () =>
      debounce((newOptions: Partial<UseToolUsesOptions>) => {
        setOptions((prev) => ({ ...prev, ...newOptions }));
      }, debounceMs),
    [debounceMs],
  );

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetOptions.cancel();
    };
  }, [debouncedSetOptions]);

  return {
    toolUses,
    total,
    hasMore,
    loading,
    error,
    refetch,
    filters: options,
    setFilters: debouncedSetOptions,
    setFiltersImmediate: setOptions,
  };
}

/**
 * Hook for debounced transcript filtering.
 */
export function useTranscriptDebounced(
  executionId: string | undefined,
  initialOptions: UseTranscriptOptions = {},
  debounceMs: number = 300,
) {
  const [options, setOptions] = useState(initialOptions);
  const { entries, total, hasMore, loading, error, refetch } = useTranscript(
    executionId,
    options,
  );

  const debouncedSetOptions = useMemo(
    () =>
      debounce((newOptions: Partial<UseTranscriptOptions>) => {
        setOptions((prev) => ({ ...prev, ...newOptions }));
      }, debounceMs),
    [debounceMs],
  );

  useEffect(() => {
    return () => {
      debouncedSetOptions.cancel();
    };
  }, [debouncedSetOptions]);

  return {
    entries,
    total,
    hasMore,
    loading,
    error,
    refetch,
    filters: options,
    setFilters: debouncedSetOptions,
    setFiltersImmediate: setOptions,
  };
}

// === Task-Scoped Hooks (OBS-708) ===

/**
 * Hook for all observability data related to a specific task.
 */
export function useTaskObservability(taskId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [toolUses, setToolUses] = useState<ToolUse[]>([]);
  const [assertions, setAssertions] = useState<AssertionResultEntry[]>([]);
  const [skills, setSkills] = useState<SkillTrace[]>([]);

  const fetchData = useCallback(async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [transcriptRes, toolUsesRes, assertionsRes, skillsRes] =
        await Promise.all([
          fetchApiWithRetry<PaginatedResponse<TranscriptEntry>>(
            `/tasks/${taskId}/transcript`,
          ),
          fetchApiWithRetry<PaginatedResponse<ToolUse>>(
            `/tasks/${taskId}/tool-uses`,
          ),
          fetchApiWithRetry<PaginatedResponse<AssertionResultEntry>>(
            `/tasks/${taskId}/assertions`,
          ),
          fetchApiWithRetry<PaginatedResponse<SkillTrace>>(
            `/tasks/${taskId}/skills`,
          ),
        ]);

      setTranscript(transcriptRes.data);
      setToolUses(toolUsesRes.data);
      setAssertions(assertionsRes.data);
      setSkills(skillsRes.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Computed stats
  const toolCallCount = toolUses.length;
  const errorCount = toolUses.filter((t) => t.isError).length;
  const assertionPassRate =
    assertions.length > 0
      ? assertions.filter((a) => a.result === "pass").length / assertions.length
      : 1;

  return {
    transcript,
    toolUses,
    assertions,
    skills,
    loading,
    error,
    refetch: fetchData,
    // Computed stats
    toolCallCount,
    errorCount,
    assertionPassRate,
  };
}

/**
 * Hook for task timeline (ordered events).
 */
export function useTaskTimeline(taskId: string | undefined) {
  const { transcript, toolUses, assertions, loading, error, refetch } =
    useTaskObservability(taskId);

  // Merge and sort all events by timestamp
  const timeline = useMemo(() => {
    const events: Array<{
      timestamp: string;
      type: "transcript" | "tool_use" | "assertion";
      data: TranscriptEntry | ToolUse | AssertionResultEntry;
    }> = [];

    for (const entry of transcript) {
      events.push({
        timestamp: entry.timestamp,
        type: "transcript",
        data: entry,
      });
    }
    for (const toolUse of toolUses) {
      events.push({
        timestamp: toolUse.startTime,
        type: "tool_use",
        data: toolUse,
      });
    }
    for (const assertion of assertions) {
      events.push({
        timestamp: assertion.timestamp,
        type: "assertion",
        data: assertion,
      });
    }

    return events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [transcript, toolUses, assertions]);

  return { timeline, loading, error, refetch };
}

// === Discoveries Hook ===

/**
 * Hook for fetching discovery entries (transcript entries with entryType='discovery').
 */
export function useDiscoveries(
  executionId: string | undefined,
  options: { limit?: number; offset?: number } = {},
) {
  const { entries, total, hasMore, loading, error, refetch } = useTranscript(
    executionId,
    {
      entryType: "discovery",
      ...options,
    },
  );

  return {
    discoveries: entries,
    total,
    hasMore,
    loading,
    error,
    refetch,
  };
}

// === Entity Detail Hooks (Phase 9 - Deep Linking) ===

/**
 * Fetch a single task with details.
 */
export function useTaskDetail(executionId: string, taskId: string) {
  const [task, setTask] = useState<{
    id: string;
    displayId?: string;
    title?: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    waveNumber?: number;
    toolUseCount: number;
    assertionCount: number;
    passedAssertions: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId || !taskId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await fetchApiWithRetry<typeof task>(
        `/executions/${executionId}/tasks/${taskId}`,
      );
      setTask(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [executionId, taskId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { task, isLoading, error, refetch: fetchData };
}

/**
 * Fetch a single tool use with details.
 */
export function useToolUseDetail(executionId: string, toolId: string) {
  const [toolUse, setToolUse] = useState<ToolUse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId || !toolId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await fetchApiWithRetry<ToolUse>(
        `/executions/${executionId}/tool-uses/${toolId}`,
      );
      setToolUse(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [executionId, toolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { toolUse, isLoading, error, refetch: fetchData };
}

/**
 * Fetch a single assertion with chain info.
 */
export function useAssertionDetail(executionId: string, assertionId: string) {
  const [assertion, setAssertion] = useState<AssertionResultEntry | null>(null);
  const [chainInfo, setChainInfo] = useState<{
    position: number;
    total: number;
    previousId?: string;
    nextId?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId || !assertionId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await fetchApiWithRetry<{
        assertion: AssertionResultEntry;
        chainInfo?: typeof chainInfo;
      }>(`/executions/${executionId}/assertions/${assertionId}`);
      setAssertion(result.assertion || result);
      setChainInfo(result.chainInfo || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [executionId, assertionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { assertion, chainInfo, isLoading, error, refetch: fetchData };
}

/**
 * Fetch wave details with tasks and agents.
 */
export function useWaveDetail(executionId: string, waveNumber: number) {
  const [wave, setWave] = useState<{
    id?: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    taskCount: number;
    maxParallelAgents: number;
  } | null>(null);
  const [tasks, setTasks] = useState<
    Array<{ id: string; displayId?: string; status: string }>
  >([]);
  const [agents, setAgents] = useState<
    Array<{ id: string; name?: string; status: string }>
  >([]);
  const [navigation, setNavigation] = useState<{
    current: number;
    total: number;
    hasPrevious: boolean;
    hasNext: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId || !waveNumber) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await fetchApiWithRetry<{
        wave: typeof wave;
        tasks: typeof tasks;
        agents: typeof agents;
        navigation?: typeof navigation;
      }>(`/executions/${executionId}/waves/${waveNumber}`);
      setWave(result.wave || null);
      setTasks(result.tasks || []);
      setAgents(result.agents || []);
      setNavigation(result.navigation || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [executionId, waveNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    wave,
    tasks,
    agents,
    navigation,
    isLoading,
    error,
    refetch: fetchData,
  };
}

/**
 * Fetch skill trace with tool calls and assertions.
 */
export function useSkillTraceDetail(executionId: string, skillId: string) {
  const [skillTrace, setSkillTrace] = useState<{
    skill: SkillTrace;
    taskId?: string;
    toolCalls?: Array<{
      toolUseId: string;
      tool: string;
      inputSummary: string;
      resultStatus: string;
      durationMs: number;
    }>;
    assertions?: Array<{
      id: string;
      category: string;
      description: string;
      result: string;
    }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId || !skillId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await fetchApiWithRetry<typeof skillTrace>(
        `/executions/${executionId}/skills/${skillId}`,
      );
      setSkillTrace(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [executionId, skillId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { skillTrace, isLoading, error, refetch: fetchData };
}

/**
 * Fetch transcript entry with navigation.
 */
export function useTranscriptEntryDetail(executionId: string, entryId: string) {
  const [entry, setEntry] = useState<TranscriptEntry | null>(null);
  const [previousEntry, setPreviousEntry] = useState<{
    id: string;
    sequence: number;
    entryType: string;
  } | null>(null);
  const [nextEntry, setNextEntry] = useState<{
    id: string;
    sequence: number;
    entryType: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!executionId || !entryId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const result = await fetchApiWithRetry<{
        entry: TranscriptEntry;
        previous?: typeof previousEntry;
        next?: typeof nextEntry;
      }>(`/executions/${executionId}/transcript/${entryId}`);
      setEntry(result.entry || result);
      setPreviousEntry(result.previous || null);
      setNextEntry(result.next || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [executionId, entryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    entry,
    previousEntry,
    nextEntry,
    isLoading,
    error,
    refetch: fetchData,
  };
}
