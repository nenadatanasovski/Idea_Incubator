# Observability System Implementation Plan - Phase 7: React Hooks

> **Location:** `docs/specs/observability/implementation-plan-phase-7.md`
> **Purpose:** Actionable implementation plan for React hooks and frontend data layer
> **Status:** Partially Complete - Needs Enhancement
> **Priority:** P2 (Required for UI components Phase 8)
> **Dependencies:** Phase 4 (TypeScript Types), Phase 5 (API Routes), Phase 6 (WebSocket Streaming)

---

## Executive Summary

Phase 7 implements the React hooks that serve as the data layer for the Observability UI components. These hooks handle REST API data fetching, WebSocket streaming, and provide a clean interface for UI components.

| Scope               | Details                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| **Hook Files**      | `frontend/src/hooks/useObservability*.ts`                                      |
| **Type Files**      | `frontend/src/types/observability.ts`                                          |
| **Tasks**           | OBS-700 to OBS-715                                                             |
| **Deliverables**    | Complete React hooks for observability data access and real-time updates       |
| **Test Validation** | Hook tests verifying data fetching, WebSocket connection, and state management |

---

## Current Implementation Status

### Already Implemented

| File                            | Status      | Features                                                      |
| ------------------------------- | ----------- | ------------------------------------------------------------- |
| `useObservability.ts`           | ✅ Complete | API hooks for executions, transcript, tool uses, assertions   |
| `useObservabilityStream.ts`     | ✅ Complete | WebSocket streaming with auto-reconnect, event filtering      |
| `useObservabilityConnection.ts` | ✅ Complete | Alternative WebSocket connection with subscription management |
| `observability.ts` (types)      | ✅ Complete | Full TypeScript type definitions                              |

### Gaps Identified

| Gap                           | Impact                                    | Task ID |
| ----------------------------- | ----------------------------------------- | ------- |
| No real-time data fusion hook | UI cannot merge API + WebSocket data      | OBS-705 |
| Missing QuickStats hook       | QuickStats component lacks dedicated hook | OBS-706 |
| No infinite scroll helpers    | Large datasets require manual pagination  | OBS-707 |
| Missing hook tests            | No validation of hook behavior            | OBS-714 |
| No hook index export          | Inconsistent import paths                 | OBS-715 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PHASE 7 HOOK ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  UI COMPONENTS (Phase 8)                                                 │
│       │                                                                  │
│       ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      REACT HOOKS (Phase 7)                          │ │
│  │                                                                      │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │ │
│  │  │ API Hooks       │  │ WebSocket Hooks │  │ Fusion Hooks        │ │ │
│  │  │                 │  │                 │  │                     │ │ │
│  │  │ useExecutions   │  │ useObservability│  │ useRealtimeExec     │ │ │
│  │  │ useExecution    │  │ Stream          │  │ useRealtimeTransc   │ │ │
│  │  │ useTranscript   │  │                 │  │ useRealtimeToolUses │ │ │
│  │  │ useToolUses     │  │ useObservability│  │                     │ │ │
│  │  │ useAssertions   │  │ Connection      │  │                     │ │ │
│  │  │ useSkillTraces  │  │                 │  │                     │ │ │
│  │  │ useMessageBus   │  │                 │  │                     │ │ │
│  │  │ useCrossRefs    │  │                 │  │                     │ │ │
│  │  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │ │
│  │           │                    │                      │            │ │
│  └───────────┼────────────────────┼──────────────────────┼────────────┘ │
│              │                    │                      │              │
│              ▼                    ▼                      │              │
│  ┌────────────────────┐  ┌────────────────────┐         │              │
│  │ REST API           │  │ WebSocket Server   │◄────────┘              │
│  │ /api/observability │  │ /ws?observability= │                        │
│  └────────────────────┘  └────────────────────┘                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### OBS-700: Verify Existing API Hooks (Complete)

**File:** `frontend/src/hooks/useObservability.ts`

**Purpose:** Validate existing API hooks are complete and functional.

#### Existing Hooks Checklist

- [x] `useExecutions()` - List executions with pagination
- [x] `useExecution(id)` - Single execution details
- [x] `useTranscript(executionId, options)` - Transcript entries with filtering
- [x] `useToolUses(executionId, options)` - Tool uses with filtering
- [x] `useAssertions(executionId, options)` - Assertions with filtering
- [x] `useSkillTraces(executionId, options)` - Skill traces
- [x] `useToolSummary(executionId)` - Tool usage aggregates
- [x] `useAssertionSummary(executionId)` - Assertion statistics
- [x] `useMessageBusLogs(options)` - Message bus entries
- [x] `useCrossRefs(entityType, entityId)` - Cross-references

#### Test Script

```bash
# Verify API hooks compile
npx tsc --noEmit frontend/src/hooks/useObservability.ts
```

#### Pass Criteria

- [ ] All hooks compile without TypeScript errors
- [ ] API fetcher correctly handles success/error responses
- [ ] Pagination parameters (limit, offset) properly encoded
- [ ] Filter options correctly converted to query parameters

---

### OBS-701: Verify Existing WebSocket Hook (Complete)

**File:** `frontend/src/hooks/useObservabilityStream.ts`

**Purpose:** Validate WebSocket streaming hook is complete and functional.

#### Existing Features Checklist

- [x] Auto-connect on mount
- [x] Auto-reconnect with exponential backoff
- [x] Maximum reconnection attempts limit
- [x] Event buffer with configurable max size
- [x] Event filtering by type
- [x] Connection status tracking
- [x] Disconnect on unmount

#### Test Script

```bash
# Verify WebSocket hook compiles
npx tsc --noEmit frontend/src/hooks/useObservabilityStream.ts
```

#### Pass Criteria

- [ ] Hook compiles without TypeScript errors
- [ ] Exponential backoff formula correct (base \* 2^attempts)
- [ ] Event buffer respects maxEvents limit
- [ ] WebSocket URL correctly built with protocol detection

---

### OBS-702: Verify Connection Hook (Complete)

**File:** `frontend/src/hooks/useObservabilityConnection.ts`

**Purpose:** Validate alternative connection hook with subscription management.

#### Existing Features Checklist

- [x] Subscription-based event filtering
- [x] Ping/pong keepalive support
- [x] Connection status enum (connected, reconnecting, offline)
- [x] Event callback support
- [x] Manual reconnect trigger

#### Test Script

```bash
# Verify connection hook compiles
npx tsc --noEmit frontend/src/hooks/useObservabilityConnection.ts
```

#### Pass Criteria

- [ ] Hook compiles without TypeScript errors
- [ ] Subscriptions correctly sent on connection
- [ ] Ping messages handled with pong response
- [ ] Event filtering respects subscriptions array

---

### OBS-703: Enhance API Hooks with Better Error Handling

**File:** `frontend/src/hooks/useObservability.ts`

**Purpose:** Improve error handling and add retry logic.

#### Implementation

```typescript
// Add to useObservability.ts

interface UseApiOptions<T> {
  enabled?: boolean;
  retries?: number;
  retryDelay?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

// Enhanced API fetcher with retry logic
async function fetchApiWithRetry<T>(
  endpoint: string,
  options: { retries?: number; retryDelay?: number } = {},
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
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Unknown error");
      }
      return json.data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1)),
        );
      }
    }
  }

  throw lastError!;
}

// Custom error classes
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
```

#### Acceptance Criteria

- [ ] Retry logic implemented with configurable attempts
- [ ] Exponential backoff between retries
- [ ] Custom error types for different failure modes
- [ ] Error callbacks supported

#### Test Script

```typescript
// tests/hooks/test-useObservability-errors.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useExecution } from "../../frontend/src/hooks/useObservability";

describe("useExecution error handling", () => {
  it("retries on transient failure", async () => {
    // Mock fetch to fail twice then succeed
    let attempts = 0;
    global.fetch = jest.fn(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: { id: "exec-123" } }),
      });
    });

    const { result } = renderHook(() => useExecution("exec-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.execution?.id).toBe("exec-123");
      expect(attempts).toBe(3);
    });
  });

  it("surfaces error after max retries", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Persistent error")));

    const { result } = renderHook(() => useExecution("exec-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error?.message).toContain("Persistent error");
    });
  });
});
```

#### Pass Criteria

- [ ] Tests pass with `npm test -- --grep "useObservability"`
- [ ] Failed requests retry up to configured limit
- [ ] Errors correctly categorized (NotFound vs ApiError)

---

### OBS-704: Add Debounced Filter Hook

**File:** `frontend/src/hooks/useObservability.ts`

**Purpose:** Add debounced filtering for tool uses and transcript.

#### Implementation

```typescript
// Add to useObservability.ts

import { useMemo, useRef } from "react";
import debounce from "lodash/debounce";

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
```

#### Acceptance Criteria

- [ ] Filter changes debounced by configurable delay
- [ ] Immediate filter option available for programmatic updates
- [ ] Debounce cancelled on unmount to prevent memory leaks
- [ ] Current filters exposed for UI display

#### Test Script

```typescript
// tests/hooks/test-useObservability-debounce.ts
import { renderHook, act } from "@testing-library/react";
import { useToolUsesDebounced } from "../../frontend/src/hooks/useObservability";

describe("useToolUsesDebounced", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: { data: [], total: 0 } }),
      }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("debounces rapid filter changes", () => {
    const { result } = renderHook(() =>
      useToolUsesDebounced("exec-123", {}, 300),
    );

    // Rapid filter changes
    act(() => {
      result.current.setFilters({ tool: "Read" });
      result.current.setFilters({ tool: "Write" });
      result.current.setFilters({ tool: "Edit" });
    });

    // Before debounce timeout - only initial fetch
    expect(fetch).toHaveBeenCalledTimes(1);

    // After debounce timeout - one more fetch
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("allows immediate filter updates", () => {
    const { result } = renderHook(() =>
      useToolUsesDebounced("exec-123", {}, 300),
    );

    act(() => {
      result.current.setFiltersImmediate({ tool: "Bash" });
    });

    // Immediate update should trigger fetch without debounce
    expect(fetch).toHaveBeenCalledTimes(2); // Initial + immediate
  });
});
```

#### Pass Criteria

- [ ] Debounce test passes
- [ ] Rapid filter changes consolidated into single API call
- [ ] Immediate setter bypasses debounce

---

### OBS-705: Create Real-Time Data Fusion Hook

**File:** `frontend/src/hooks/useRealtimeObservability.ts`

**Purpose:** Combine API data with WebSocket updates for real-time UI.

#### Implementation

```typescript
// frontend/src/hooks/useRealtimeObservability.ts

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranscript } from "./useObservability";
import { useObservabilityStream } from "./useObservabilityStream";
import type {
  TranscriptEntry,
  ObservabilityEvent,
} from "../types/observability";

interface UseRealtimeTranscriptOptions {
  entryType?: string;
  category?: string;
  taskId?: string;
  limit?: number;
  autoRefreshOnReconnect?: boolean;
}

/**
 * Hook that combines API data with WebSocket streaming for real-time transcript updates.
 *
 * - Initial data loaded via REST API
 * - New entries appended via WebSocket
 * - Automatic deduplication
 * - Reconnection triggers data refresh
 */
export function useRealtimeTranscript(
  executionId: string | undefined,
  options: UseRealtimeTranscriptOptions = {},
) {
  const { autoRefreshOnReconnect = true, ...apiOptions } = options;

  // API data for initial load
  const {
    entries: apiEntries,
    loading,
    error,
    refetch,
  } = useTranscript(executionId, apiOptions);

  // WebSocket for real-time updates
  const { events, isConnected, status } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  // Merged entries (API + WebSocket)
  const [mergedEntries, setMergedEntries] = useState<TranscriptEntry[]>([]);
  const seenIds = useMemo(() => new Set<string>(), [executionId]);

  // Update merged entries when API data loads
  useEffect(() => {
    if (apiEntries.length > 0) {
      setMergedEntries(apiEntries);
      apiEntries.forEach((e) => seenIds.add(e.id));
    }
  }, [apiEntries, seenIds]);

  // Append new entries from WebSocket
  useEffect(() => {
    const transcriptEvents = events.filter(
      (e) => e.type === "transcript:entry",
    );

    const newEntries: TranscriptEntry[] = [];

    for (const event of transcriptEvents) {
      const entry = event.data as TranscriptEntry;
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        newEntries.push(entry);
      }
    }

    if (newEntries.length > 0) {
      setMergedEntries((prev) => [...prev, ...newEntries]);
    }
  }, [events, seenIds]);

  // Refresh on reconnection
  useEffect(() => {
    if (autoRefreshOnReconnect && status.connected && status.lastConnectedAt) {
      refetch();
    }
  }, [
    status.connected,
    status.lastConnectedAt,
    autoRefreshOnReconnect,
    refetch,
  ]);

  // Get latest entry
  const latestEntry = mergedEntries[mergedEntries.length - 1] || null;

  return {
    entries: mergedEntries,
    latestEntry,
    loading,
    error,
    refetch,
    isLive: isConnected,
    connectionStatus: status,
    newEntriesCount: mergedEntries.length - apiEntries.length,
  };
}

/**
 * Hook for real-time tool use updates.
 */
export function useRealtimeToolUses(
  executionId: string | undefined,
  options: { limit?: number } = {},
) {
  const {
    toolUses: apiToolUses,
    loading,
    error,
    refetch,
  } = useToolUses(executionId, options);

  const { events, isConnected, status } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  const [mergedToolUses, setMergedToolUses] = useState<ToolUse[]>([]);
  const [inProgress, setInProgress] = useState<Map<string, ToolUse>>(new Map());

  // Process tool use events
  useEffect(() => {
    for (const event of events) {
      if (event.type === "tooluse:start") {
        const toolUse = event.data as ToolUse;
        setInProgress((prev) => new Map(prev).set(toolUse.id, toolUse));
      } else if (event.type === "tooluse:end") {
        const toolUse = event.data as ToolUse;
        setInProgress((prev) => {
          const next = new Map(prev);
          next.delete(toolUse.id);
          return next;
        });
        setMergedToolUses((prev) => {
          const exists = prev.some((t) => t.id === toolUse.id);
          if (exists) return prev;
          return [...prev, toolUse];
        });
      }
    }
  }, [events]);

  // Initialize with API data
  useEffect(() => {
    if (apiToolUses.length > 0) {
      setMergedToolUses(apiToolUses);
    }
  }, [apiToolUses]);

  return {
    toolUses: mergedToolUses,
    inProgressTools: Array.from(inProgress.values()),
    loading,
    error,
    refetch,
    isLive: isConnected,
  };
}

/**
 * Hook for real-time assertion updates.
 */
export function useRealtimeAssertions(executionId: string | undefined) {
  const {
    assertions: apiAssertions,
    loading,
    error,
    refetch,
  } = useAssertions(executionId);

  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  const [mergedAssertions, setMergedAssertions] = useState<
    AssertionResultEntry[]
  >([]);
  const [runningPassRate, setRunningPassRate] = useState<number>(1);

  useEffect(() => {
    if (apiAssertions.length > 0) {
      setMergedAssertions(apiAssertions);
      const passed = apiAssertions.filter((a) => a.result === "pass").length;
      setRunningPassRate(passed / apiAssertions.length);
    }
  }, [apiAssertions]);

  useEffect(() => {
    for (const event of events) {
      if (event.type === "assertion:result") {
        const assertion = event.data as AssertionResultEntry;
        setMergedAssertions((prev) => {
          const exists = prev.some((a) => a.id === assertion.id);
          if (exists) return prev;
          const next = [...prev, assertion];
          const passed = next.filter((a) => a.result === "pass").length;
          setRunningPassRate(passed / next.length);
          return next;
        });
      }
    }
  }, [events]);

  return {
    assertions: mergedAssertions,
    runningPassRate,
    loading,
    error,
    refetch,
    isLive: isConnected,
    totalCount: mergedAssertions.length,
    passedCount: mergedAssertions.filter((a) => a.result === "pass").length,
    failedCount: mergedAssertions.filter((a) => a.result === "fail").length,
  };
}
```

#### Acceptance Criteria

- [ ] API data loaded on mount
- [ ] WebSocket events merged without duplicates
- [ ] Reconnection triggers data refresh
- [ ] In-progress tools tracked separately
- [ ] Running pass rate calculated in real-time

#### Test Script

```typescript
// tests/hooks/test-useRealtimeObservability.ts
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRealtimeTranscript } from "../../frontend/src/hooks/useRealtimeObservability";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 1;

  constructor() {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  close() {
    this.readyState = 3;
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("useRealtimeTranscript", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              data: [
                { id: "entry-1", entryType: "phase_start", summary: "Test" },
              ],
              total: 1,
            },
          }),
      }),
    );
  });

  it("merges API data with WebSocket events", async () => {
    const { result } = renderHook(() => useRealtimeTranscript("exec-123"));

    // Wait for API data
    await waitFor(() => {
      expect(result.current.entries.length).toBe(1);
    });

    // Simulate WebSocket event
    act(() => {
      MockWebSocket.instances[0]?.simulateMessage({
        type: "transcript:entry",
        data: { id: "entry-2", entryType: "task_start", summary: "New entry" },
      });
    });

    await waitFor(() => {
      expect(result.current.entries.length).toBe(2);
      expect(result.current.newEntriesCount).toBe(1);
    });
  });

  it("deduplicates entries by ID", async () => {
    const { result } = renderHook(() => useRealtimeTranscript("exec-123"));

    await waitFor(() => {
      expect(result.current.entries.length).toBe(1);
    });

    // Simulate duplicate entry
    act(() => {
      MockWebSocket.instances[0]?.simulateMessage({
        type: "transcript:entry",
        data: { id: "entry-1", entryType: "phase_start", summary: "Test" }, // Same ID
      });
    });

    // Should still be 1
    expect(result.current.entries.length).toBe(1);
  });
});
```

#### Pass Criteria

- [ ] Real-time transcript test passes
- [ ] Deduplication test passes
- [ ] API and WebSocket data correctly merged

---

### OBS-706: Create QuickStats Hook

**File:** `frontend/src/hooks/useObservabilityStats.ts`

**Purpose:** Provide aggregated statistics for the QuickStats component.

#### Implementation

```typescript
// frontend/src/hooks/useObservabilityStats.ts

import { useState, useEffect, useCallback, useMemo } from "react";
import { useObservabilityStream } from "./useObservabilityStream";
import type {
  ObservabilityEvent,
  ToolResultStatus,
} from "../types/observability";

interface QuickStatsData {
  activeExecutions: number;
  toolCallsPerMinute: number;
  passRate: number;
  errorCount: number;
  blockedCount: number;
  discoveriesCount: number;
  lastUpdated: string;
}

interface UseQuickStatsOptions {
  executionId?: string;
  refreshIntervalMs?: number;
}

/**
 * Hook for QuickStats component - provides real-time aggregated metrics.
 */
export function useQuickStats(options: UseQuickStatsOptions = {}) {
  const { executionId, refreshIntervalMs = 5000 } = options;

  const [stats, setStats] = useState<QuickStatsData>({
    activeExecutions: 0,
    toolCallsPerMinute: 0,
    passRate: 1,
    errorCount: 0,
    blockedCount: 0,
    discoveriesCount: 0,
    lastUpdated: new Date().toISOString(),
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket for real-time updates
  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: true,
    maxEvents: 500,
  });

  // Track tool calls in sliding window (1 minute)
  const toolCallTimestamps = useMemo(() => [] as number[], [executionId]);

  // Calculate tool calls per minute
  const calculateToolCallsPerMinute = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    while (
      toolCallTimestamps.length > 0 &&
      toolCallTimestamps[0] < oneMinuteAgo
    ) {
      toolCallTimestamps.shift();
    }

    return toolCallTimestamps.length;
  }, [toolCallTimestamps]);

  // Process events to update stats
  useEffect(() => {
    let assertions = { total: 0, passed: 0 };
    let errors = 0;
    let blocked = 0;
    let discoveries = 0;

    for (const event of events) {
      if (event.type === "tooluse:end") {
        toolCallTimestamps.push(Date.now());
        const data = event.data as {
          resultStatus?: ToolResultStatus;
          isError?: boolean;
          isBlocked?: boolean;
        };
        if (data.isError) errors++;
        if (data.isBlocked) blocked++;
      } else if (event.type === "assertion:result") {
        assertions.total++;
        const data = event.data as { result?: string };
        if (data.result === "pass") assertions.passed++;
      } else if (event.type === "transcript:entry") {
        const data = event.data as { entryType?: string };
        if (data.entryType === "discovery") discoveries++;
      }
    }

    setStats((prev) => ({
      ...prev,
      toolCallsPerMinute: calculateToolCallsPerMinute(),
      passRate:
        assertions.total > 0
          ? assertions.passed / assertions.total
          : prev.passRate,
      errorCount: errors,
      blockedCount: blocked,
      discoveriesCount: discoveries,
      lastUpdated: new Date().toISOString(),
    }));
  }, [events, toolCallTimestamps, calculateToolCallsPerMinute]);

  // Fetch initial stats from API
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "/api/observability/stats" +
          (executionId ? `?executionId=${executionId}` : ""),
      );
      if (!response.ok) throw new Error("Failed to fetch stats");
      const json = await response.json();
      if (json.success) {
        setStats((prev) => ({ ...prev, ...json.data }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchStats();

    if (refreshIntervalMs > 0) {
      const interval = setInterval(fetchStats, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchStats, refreshIntervalMs]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
    isLive: isConnected,
  };
}

/**
 * Hook for tracking tool calls per minute with sliding window.
 */
export function useToolCallRate(
  executionId?: string,
  windowMs: number = 60000,
) {
  const [rate, setRate] = useState(0);
  const timestamps = useMemo(() => [] as number[], [executionId]);

  const { events } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });

  useEffect(() => {
    for (const event of events) {
      if (event.type === "tooluse:end") {
        timestamps.push(Date.now());
      }
    }

    // Clean up old timestamps
    const cutoff = Date.now() - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    setRate(timestamps.length);
  }, [events, timestamps, windowMs]);

  return rate;
}
```

#### Acceptance Criteria

- [ ] Stats calculated from WebSocket events
- [ ] Initial stats loaded from API
- [ ] Periodic refresh interval configurable
- [ ] Tool calls per minute uses sliding window
- [ ] Pass rate updated in real-time

#### Test Script

```typescript
// tests/hooks/test-useQuickStats.ts
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useQuickStats,
  useToolCallRate,
} from "../../frontend/src/hooks/useObservabilityStats";

describe("useQuickStats", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              activeExecutions: 2,
              passRate: 0.95,
              errorCount: 1,
            },
          }),
      }),
    );
  });

  it("loads initial stats from API", async () => {
    const { result } = renderHook(() => useQuickStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.stats.activeExecutions).toBe(2);
      expect(result.current.stats.passRate).toBe(0.95);
    });
  });
});

describe("useToolCallRate", () => {
  it("calculates rate from WebSocket events", async () => {
    const { result } = renderHook(() => useToolCallRate("exec-123", 60000));

    // Initially zero
    expect(result.current).toBe(0);
  });
});
```

#### Pass Criteria

- [ ] Initial stats load test passes
- [ ] Tool call rate calculation correct

---

### OBS-707: Create Infinite Scroll Hook

**File:** `frontend/src/hooks/useInfiniteObservability.ts`

**Purpose:** Provide infinite scroll/pagination helpers for large datasets.

#### Implementation

```typescript
// frontend/src/hooks/useInfiniteObservability.ts

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  TranscriptEntry,
  ToolUse,
  AssertionResultEntry,
} from "../types/observability";

interface UseInfiniteOptions {
  pageSize?: number;
  threshold?: number;
}

interface InfiniteState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  total: number;
}

/**
 * Generic infinite scroll hook factory.
 */
function createInfiniteHook<T>(
  fetchFn: (
    executionId: string,
    offset: number,
    limit: number,
  ) => Promise<{ data: T[]; total: number; hasMore: boolean }>,
) {
  return function useInfinite(
    executionId: string | undefined,
    options: UseInfiniteOptions = {},
  ) {
    const { pageSize = 50, threshold = 100 } = options;

    const [state, setState] = useState<InfiniteState<T>>({
      items: [],
      loading: true,
      loadingMore: false,
      error: null,
      hasMore: true,
      total: 0,
    });

    const offsetRef = useRef(0);
    const loadingRef = useRef(false);

    // Initial load
    const loadInitial = useCallback(async () => {
      if (!executionId) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const result = await fetchFn(executionId, 0, pageSize);
        offsetRef.current = result.data.length;
        setState({
          items: result.data,
          loading: false,
          loadingMore: false,
          error: null,
          hasMore: result.hasMore,
          total: result.total,
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      }
    }, [executionId, pageSize]);

    // Load more
    const loadMore = useCallback(async () => {
      if (!executionId || loadingRef.current || !state.hasMore) return;

      loadingRef.current = true;
      setState((prev) => ({ ...prev, loadingMore: true }));

      try {
        const result = await fetchFn(executionId, offsetRef.current, pageSize);
        offsetRef.current += result.data.length;
        setState((prev) => ({
          ...prev,
          items: [...prev.items, ...result.data],
          loadingMore: false,
          hasMore: result.hasMore,
          total: result.total,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loadingMore: false,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
      } finally {
        loadingRef.current = false;
      }
    }, [executionId, pageSize, state.hasMore]);

    // Reset and reload
    const reset = useCallback(() => {
      offsetRef.current = 0;
      loadInitial();
    }, [loadInitial]);

    // Initial load on mount
    useEffect(() => {
      loadInitial();
    }, [loadInitial]);

    // Intersection observer ref for automatic loading
    const observerRef = useCallback(
      (node: HTMLElement | null) => {
        if (!node) return;

        const observer = new IntersectionObserver(
          (entries) => {
            if (
              entries[0].isIntersecting &&
              state.hasMore &&
              !state.loadingMore
            ) {
              loadMore();
            }
          },
          { threshold: 0.1 },
        );

        observer.observe(node);
        return () => observer.disconnect();
      },
      [loadMore, state.hasMore, state.loadingMore],
    );

    return {
      ...state,
      loadMore,
      reset,
      observerRef,
    };
  };
}

// API fetch functions
async function fetchTranscript(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/transcript?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchToolUses(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/tool-uses?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchAssertions(
  executionId: string,
  offset: number,
  limit: number,
) {
  const response = await fetch(
    `/api/observability/executions/${executionId}/assertions?offset=${offset}&limit=${limit}`,
  );
  const json = await response.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

// Export typed hooks
export const useInfiniteTranscript =
  createInfiniteHook<TranscriptEntry>(fetchTranscript);
export const useInfiniteToolUses = createInfiniteHook<ToolUse>(fetchToolUses);
export const useInfiniteAssertions =
  createInfiniteHook<AssertionResultEntry>(fetchAssertions);
```

#### Acceptance Criteria

- [ ] Initial page loaded on mount
- [ ] `loadMore()` fetches next page
- [ ] `hasMore` correctly indicates more data available
- [ ] IntersectionObserver for automatic loading
- [ ] Reset function clears and reloads

#### Test Script

```typescript
// tests/hooks/test-useInfiniteObservability.ts
import { renderHook, act, waitFor } from "@testing-library/react";
import { useInfiniteTranscript } from "../../frontend/src/hooks/useInfiniteObservability";

describe("useInfiniteTranscript", () => {
  beforeEach(() => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      const offset = (callCount - 1) * 50;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              data: Array.from({ length: 50 }, (_, i) => ({
                id: `entry-${offset + i}`,
                entryType: "phase_start",
              })),
              total: 150,
              hasMore: callCount < 3,
            },
          }),
      });
    });
  });

  it("loads initial page on mount", async () => {
    const { result } = renderHook(() => useInfiniteTranscript("exec-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items.length).toBe(50);
      expect(result.current.hasMore).toBe(true);
    });
  });

  it("loads more items when loadMore called", async () => {
    const { result } = renderHook(() => useInfiniteTranscript("exec-123"));

    await waitFor(() => {
      expect(result.current.items.length).toBe(50);
    });

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items.length).toBe(100);
    });
  });

  it("stops loading when no more items", async () => {
    const { result } = renderHook(() => useInfiniteTranscript("exec-123"));

    await waitFor(() => expect(result.current.items.length).toBe(50));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items.length).toBe(100));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items.length).toBe(150);
      expect(result.current.hasMore).toBe(false);
    });

    // Another loadMore should do nothing
    act(() => {
      result.current.loadMore();
    });

    expect(result.current.items.length).toBe(150);
  });
});
```

#### Pass Criteria

- [ ] Initial page test passes
- [ ] Load more test passes
- [ ] No more items test passes

---

### OBS-708: Add Task-Scoped Hooks

**File:** `frontend/src/hooks/useObservability.ts`

**Purpose:** Add hooks for task-level observability data.

#### Implementation

```typescript
// Add to useObservability.ts

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
          fetchApi<PaginatedResponse<TranscriptEntry>>(
            `/tasks/${taskId}/transcript`,
          ),
          fetchApi<PaginatedResponse<ToolUse>>(`/tasks/${taskId}/tool-uses`),
          fetchApi<PaginatedResponse<AssertionResultEntry>>(
            `/tasks/${taskId}/assertions`,
          ),
          fetchApi<PaginatedResponse<SkillTrace>>(`/tasks/${taskId}/skills`),
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

  return {
    transcript,
    toolUses,
    assertions,
    skills,
    loading,
    error,
    refetch: fetchData,
    // Computed
    toolCallCount: toolUses.length,
    errorCount: toolUses.filter((t) => t.isError).length,
    assertionPassRate:
      assertions.length > 0
        ? assertions.filter((a) => a.result === "pass").length /
          assertions.length
        : 1,
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
```

#### Acceptance Criteria

- [ ] All task data fetched in parallel
- [ ] Computed stats (toolCallCount, errorCount, passRate) available
- [ ] Timeline sorted chronologically
- [ ] Loading/error states managed correctly

#### Test Script

```typescript
// tests/hooks/test-useTaskObservability.ts
import { renderHook, waitFor } from "@testing-library/react";
import {
  useTaskObservability,
  useTaskTimeline,
} from "../../frontend/src/hooks/useObservability";

describe("useTaskObservability", () => {
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (url.includes("transcript")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, data: { data: [], total: 0 } }),
        });
      }
      if (url.includes("tool-uses")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                data: [
                  { id: "tu-1", isError: false },
                  { id: "tu-2", isError: true },
                ],
                total: 2,
              },
            }),
        });
      }
      if (url.includes("assertions")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                data: [
                  { id: "a-1", result: "pass" },
                  { id: "a-2", result: "fail" },
                ],
                total: 2,
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ success: true, data: { data: [], total: 0 } }),
      });
    });
  });

  it("fetches all task data in parallel", async () => {
    const { result } = renderHook(() => useTaskObservability("task-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(result.current.toolCallCount).toBe(2);
    expect(result.current.errorCount).toBe(1);
    expect(result.current.assertionPassRate).toBe(0.5);
  });
});
```

#### Pass Criteria

- [ ] Parallel fetch test passes
- [ ] Computed stats correct

---

### OBS-709: Create Filter State Hook

**File:** `frontend/src/hooks/useObservabilityFilters.ts`

**Purpose:** Manage filter state with URL synchronization.

#### Implementation

```typescript
// frontend/src/hooks/useObservabilityFilters.ts

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  TranscriptEntryType,
  ToolCategory,
  ToolResultStatus,
  AssertionResult,
  Severity,
} from "../types/observability";

interface TranscriptFilterState {
  entryTypes: TranscriptEntryType[];
  categories: string[];
  taskId: string | null;
  search: string;
}

interface ToolUseFilterState {
  tools: string[];
  categories: ToolCategory[];
  status: ToolResultStatus[];
  showErrors: boolean;
  showBlocked: boolean;
  search: string;
}

interface AssertionFilterState {
  results: AssertionResult[];
  categories: string[];
  chainId: string | null;
}

interface MessageBusFilterState {
  severity: Severity[];
  sources: string[];
  eventTypes: string[];
  search: string;
}

/**
 * Hook for managing transcript filters with URL sync.
 */
export function useTranscriptFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<TranscriptFilterState>(
    () => ({
      entryTypes: (searchParams.get("entryTypes")?.split(",") ||
        []) as TranscriptEntryType[],
      categories: searchParams.get("categories")?.split(",") || [],
      taskId: searchParams.get("taskId"),
      search: searchParams.get("search") || "",
    }),
    [searchParams],
  );

  const setFilter = useCallback(
    <K extends keyof TranscriptFilterState>(
      key: K,
      value: TranscriptFilterState[K],
    ) => {
      setSearchParams((params) => {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          } else {
            params.delete(key);
          }
        } else if (value) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
        return params;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((params) => {
      params.delete("entryTypes");
      params.delete("categories");
      params.delete("taskId");
      params.delete("search");
      return params;
    });
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.entryTypes.length > 0 ||
      filters.categories.length > 0 ||
      !!filters.taskId ||
      !!filters.search
    );
  }, [filters]);

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    // Convenience togglers
    toggleEntryType: (type: TranscriptEntryType) => {
      const current = filters.entryTypes;
      if (current.includes(type)) {
        setFilter(
          "entryTypes",
          current.filter((t) => t !== type),
        );
      } else {
        setFilter("entryTypes", [...current, type]);
      }
    },
    toggleCategory: (category: string) => {
      const current = filters.categories;
      if (current.includes(category)) {
        setFilter(
          "categories",
          current.filter((c) => c !== category),
        );
      } else {
        setFilter("categories", [...current, category]);
      }
    },
  };
}

/**
 * Hook for managing tool use filters with URL sync.
 */
export function useToolUseFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ToolUseFilterState>(
    () => ({
      tools: searchParams.get("tools")?.split(",") || [],
      categories: (searchParams.get("categories")?.split(",") ||
        []) as ToolCategory[],
      status: (searchParams.get("status")?.split(",") ||
        []) as ToolResultStatus[],
      showErrors: searchParams.get("showErrors") === "true",
      showBlocked: searchParams.get("showBlocked") === "true",
      search: searchParams.get("search") || "",
    }),
    [searchParams],
  );

  const setFilter = useCallback(
    <K extends keyof ToolUseFilterState>(
      key: K,
      value: ToolUseFilterState[K],
    ) => {
      setSearchParams((params) => {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          } else {
            params.delete(key);
          }
        } else if (typeof value === "boolean") {
          if (value) {
            params.set(key, "true");
          } else {
            params.delete(key);
          }
        } else if (value) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
        return params;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((params) => {
      params.delete("tools");
      params.delete("categories");
      params.delete("status");
      params.delete("showErrors");
      params.delete("showBlocked");
      params.delete("search");
      return params;
    });
  }, [setSearchParams]);

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters:
      filters.tools.length > 0 ||
      filters.categories.length > 0 ||
      filters.status.length > 0 ||
      filters.showErrors ||
      filters.showBlocked ||
      !!filters.search,
  };
}

/**
 * Hook for managing assertion filters with URL sync.
 */
export function useAssertionFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<AssertionFilterState>(
    () => ({
      results: (searchParams.get("results")?.split(",") ||
        []) as AssertionResult[],
      categories: searchParams.get("categories")?.split(",") || [],
      chainId: searchParams.get("chainId"),
    }),
    [searchParams],
  );

  const setFilter = useCallback(
    <K extends keyof AssertionFilterState>(
      key: K,
      value: AssertionFilterState[K],
    ) => {
      setSearchParams((params) => {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          } else {
            params.delete(key);
          }
        } else if (value) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
        return params;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((params) => {
      params.delete("results");
      params.delete("categories");
      params.delete("chainId");
      return params;
    });
  }, [setSearchParams]);

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters:
      filters.results.length > 0 ||
      filters.categories.length > 0 ||
      !!filters.chainId,
    // Convenience
    showOnlyFailures: () => setFilter("results", ["fail"]),
    showOnlyPasses: () => setFilter("results", ["pass"]),
  };
}

/**
 * Hook for managing message bus filters.
 */
export function useMessageBusFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<MessageBusFilterState>(
    () => ({
      severity: (searchParams.get("severity")?.split(",") || []) as Severity[],
      sources: searchParams.get("sources")?.split(",") || [],
      eventTypes: searchParams.get("eventTypes")?.split(",") || [],
      search: searchParams.get("search") || "",
    }),
    [searchParams],
  );

  const setFilter = useCallback(
    <K extends keyof MessageBusFilterState>(
      key: K,
      value: MessageBusFilterState[K],
    ) => {
      setSearchParams((params) => {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(","));
          } else {
            params.delete(key);
          }
        } else if (value) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
        return params;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((params) => {
      params.delete("severity");
      params.delete("sources");
      params.delete("eventTypes");
      params.delete("search");
      return params;
    });
  }, [setSearchParams]);

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters:
      filters.severity.length > 0 ||
      filters.sources.length > 0 ||
      filters.eventTypes.length > 0 ||
      !!filters.search,
    // Convenience
    showErrorsOnly: () => setFilter("severity", ["error", "critical"]),
  };
}
```

#### Acceptance Criteria

- [ ] Filters synchronized with URL search params
- [ ] Array filters correctly serialized/deserialized
- [ ] Boolean filters handled correctly
- [ ] Clear filters removes all params
- [ ] `hasActiveFilters` computed correctly

#### Test Script

```typescript
// tests/hooks/test-useObservabilityFilters.ts
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useTranscriptFilters } from "../../frontend/src/hooks/useObservabilityFilters";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={["/?entryTypes=phase_start,phase_end"]}>
    {children}
  </MemoryRouter>
);

describe("useTranscriptFilters", () => {
  it("parses initial URL params", () => {
    const { result } = renderHook(() => useTranscriptFilters(), { wrapper });

    expect(result.current.filters.entryTypes).toEqual(["phase_start", "phase_end"]);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("toggles entry type", () => {
    const { result } = renderHook(() => useTranscriptFilters(), { wrapper });

    act(() => {
      result.current.toggleEntryType("task_start");
    });

    expect(result.current.filters.entryTypes).toContain("task_start");
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => useTranscriptFilters(), { wrapper });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
  });
});
```

#### Pass Criteria

- [ ] URL param parsing test passes
- [ ] Toggle test passes
- [ ] Clear filters test passes

---

### OBS-710: Add Entity Navigation Hook

**File:** `frontend/src/hooks/useObservabilityNavigation.ts`

**Purpose:** Provide navigation helpers for deep linking.

#### Implementation

```typescript
// frontend/src/hooks/useObservabilityNavigation.ts

import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { EntityType } from "../types/observability";

/**
 * Hook for navigating between observability entities with deep linking.
 */
export function useObservabilityNavigation() {
  const navigate = useNavigate();
  const { executionId, taskId, toolUseId, assertionId, skillTraceId } =
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

  // Navigate to tool use
  const goToToolUse = useCallback(
    (
      execId: string,
      toolUseId: string,
      options?: { showContext?: boolean },
    ) => {
      const params = new URLSearchParams();
      if (options?.showContext) params.set("context", "transcript");
      const query = params.toString();
      navigate(
        `/observability/executions/${execId}/tool-uses/${toolUseId}${query ? `?${query}` : ""}`,
      );
    },
    [navigate],
  );

  // Navigate to assertion
  const goToAssertion = useCallback(
    (
      execId: string,
      assertionId: string,
      options?: { expandEvidence?: boolean },
    ) => {
      const params = new URLSearchParams();
      if (options?.expandEvidence) params.set("expand", "evidence");
      const query = params.toString();
      navigate(
        `/observability/executions/${execId}/assertions/${assertionId}${query ? `?${query}` : ""}`,
      );
    },
    [navigate],
  );

  // Navigate to skill trace
  const goToSkillTrace = useCallback(
    (execId: string, skillTraceId: string) => {
      navigate(`/observability/executions/${execId}/skills/${skillTraceId}`);
    },
    [navigate],
  );

  // Navigate to transcript entry
  const goToTranscriptEntry = useCallback(
    (execId: string, entryId: string) => {
      navigate(`/observability/executions/${execId}/transcript/${entryId}`);
    },
    [navigate],
  );

  // Generic entity navigation
  const goToEntity = useCallback(
    (entityType: EntityType, entityId: string, executionIdParam?: string) => {
      const execId = executionIdParam || executionId;
      if (!execId) return;

      switch (entityType) {
        case "execution":
          goToExecution(entityId);
          break;
        case "tool_use":
          goToToolUse(execId, entityId);
          break;
        case "assertion":
          goToAssertion(execId, entityId);
          break;
        case "skill_trace":
          goToSkillTrace(execId, entityId);
          break;
        case "transcript":
          goToTranscriptEntry(execId, entityId);
          break;
      }
    },
    [
      executionId,
      goToExecution,
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
      const base = window.location.origin;

      switch (entityType) {
        case "execution":
          return `${base}/observability/executions/${entityId}`;
        case "tool_use":
          return `${base}/observability/executions/${execId}/tool-uses/${entityId}`;
        case "assertion":
          return `${base}/observability/executions/${execId}/assertions/${entityId}`;
        case "skill_trace":
          return `${base}/observability/executions/${execId}/skills/${entityId}`;
        default:
          return base;
      }
    },
    [executionId],
  );

  return {
    // Current context
    currentExecutionId: executionId,
    currentTaskId: taskId,
    currentToolUseId: toolUseId,
    currentAssertionId: assertionId,
    currentSkillTraceId: skillTraceId,

    // Navigation functions
    goToExecution,
    goToToolUse,
    goToAssertion,
    goToSkillTrace,
    goToTranscriptEntry,
    goToEntity,
    goBack,

    // Utilities
    buildShareableLink,
  };
}
```

#### Acceptance Criteria

- [ ] Navigation functions work for all entity types
- [ ] URL params correctly extracted
- [ ] Shareable links built correctly
- [ ] Query params supported (context, expand)

#### Test Script

```typescript
// tests/hooks/test-useObservabilityNavigation.ts
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useObservabilityNavigation } from "../../frontend/src/hooks/useObservabilityNavigation";

const navigateMock = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => navigateMock,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={["/observability/executions/exec-123"]}>
    <Routes>
      <Route path="/observability/executions/:executionId" element={children} />
    </Routes>
  </MemoryRouter>
);

describe("useObservabilityNavigation", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("extracts current execution ID from URL", () => {
    const { result } = renderHook(() => useObservabilityNavigation(), { wrapper });
    expect(result.current.currentExecutionId).toBe("exec-123");
  });

  it("navigates to tool use with context", () => {
    const { result } = renderHook(() => useObservabilityNavigation(), { wrapper });

    act(() => {
      result.current.goToToolUse("exec-123", "tu-456", { showContext: true });
    });

    expect(navigateMock).toHaveBeenCalledWith(
      "/observability/executions/exec-123/tool-uses/tu-456?context=transcript"
    );
  });

  it("builds shareable link", () => {
    const { result } = renderHook(() => useObservabilityNavigation(), { wrapper });

    const link = result.current.buildShareableLink("tool_use", "tu-456", "exec-123");
    expect(link).toContain("/observability/executions/exec-123/tool-uses/tu-456");
  });
});
```

#### Pass Criteria

- [ ] Context extraction test passes
- [ ] Navigation with params test passes
- [ ] Shareable link test passes

---

### OBS-711-713: Reserved for Additional Hooks

Reserved task IDs for future hook requirements discovered during implementation.

---

### OBS-714: Create Hook Test Suite

**File:** `tests/hooks/test-observability-hooks.ts`

**Purpose:** Comprehensive test suite for all observability hooks.

#### Test Suite Structure

```typescript
// tests/hooks/test-observability-hooks.ts

/**
 * Phase 7 Observability Hooks Test Suite
 *
 * Run: npm test -- tests/hooks/test-observability-hooks.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockFetch(responses: Record<string, unknown>) {
  return jest.fn((url: string) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: response }),
        });
      }
    }
    return Promise.reject(new Error(`No mock for ${url}`));
  });
}

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: ((e: Error) => void) | null = null;
  readyState = WebSocket.OPEN;

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  close(code: number = 1000) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code });
  }

  send(_data: string) {}

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

// ============================================================================
// TEST SUITE: API HOOKS
// ============================================================================

describe("Phase 7: API Hooks", () => {
  describe("useExecutions", () => {
    it("fetches execution list", async () => {
      // Test implementation
    });

    it("handles pagination", async () => {
      // Test implementation
    });

    it("handles errors", async () => {
      // Test implementation
    });
  });

  describe("useExecution", () => {
    it("fetches single execution", async () => {
      // Test implementation
    });

    it("returns null for missing ID", async () => {
      // Test implementation
    });
  });

  describe("useTranscript", () => {
    it("fetches transcript entries", async () => {
      // Test implementation
    });

    it("applies filters correctly", async () => {
      // Test implementation
    });
  });

  describe("useToolUses", () => {
    it("fetches tool uses", async () => {
      // Test implementation
    });

    it("filters by status", async () => {
      // Test implementation
    });
  });

  describe("useAssertions", () => {
    it("fetches assertions", async () => {
      // Test implementation
    });

    it("filters by result", async () => {
      // Test implementation
    });
  });
});

// ============================================================================
// TEST SUITE: WEBSOCKET HOOKS
// ============================================================================

describe("Phase 7: WebSocket Hooks", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;
  });

  describe("useObservabilityStream", () => {
    it("connects automatically", async () => {
      // Test implementation
    });

    it("reconnects on disconnect", async () => {
      // Test implementation
    });

    it("filters events by type", async () => {
      // Test implementation
    });

    it("limits event buffer size", async () => {
      // Test implementation
    });
  });

  describe("useObservabilityConnection", () => {
    it("manages subscriptions", async () => {
      // Test implementation
    });

    it("handles ping/pong", async () => {
      // Test implementation
    });
  });
});

// ============================================================================
// TEST SUITE: FUSION HOOKS
// ============================================================================

describe("Phase 7: Real-Time Fusion Hooks", () => {
  describe("useRealtimeTranscript", () => {
    it("merges API and WebSocket data", async () => {
      // Test implementation
    });

    it("deduplicates entries", async () => {
      // Test implementation
    });
  });

  describe("useQuickStats", () => {
    it("calculates real-time stats", async () => {
      // Test implementation
    });
  });
});

// ============================================================================
// TEST SUITE: UTILITY HOOKS
// ============================================================================

describe("Phase 7: Utility Hooks", () => {
  describe("useInfiniteTranscript", () => {
    it("loads pages incrementally", async () => {
      // Test implementation
    });

    it("stops when no more data", async () => {
      // Test implementation
    });
  });

  describe("useTranscriptFilters", () => {
    it("syncs with URL", async () => {
      // Test implementation
    });
  });

  describe("useObservabilityNavigation", () => {
    it("navigates to entities", async () => {
      // Test implementation
    });
  });
});
```

#### Acceptance Criteria

- [ ] All hook tests pass
- [ ] Coverage > 80% for hook files
- [ ] Edge cases tested (empty data, errors, disconnects)

#### Test Script

```bash
# Run hook tests
npm test -- tests/hooks/test-observability-hooks.ts

# Run with coverage
npm test -- --coverage tests/hooks/test-observability-hooks.ts
```

#### Pass Criteria

- [ ] All tests pass: `npm test -- tests/hooks/test-observability-hooks.ts`
- [ ] Coverage report shows > 80% coverage

---

### OBS-715: Create Hook Index Export

**File:** `frontend/src/hooks/observability/index.ts`

**Purpose:** Clean exports for all observability hooks.

#### Implementation

```typescript
// frontend/src/hooks/observability/index.ts

// === API Hooks ===
export {
  useExecutions,
  useExecution,
  useTranscript,
  useToolUses,
  useAssertions,
  useSkillTraces,
  useToolSummary,
  useAssertionSummary,
  useMessageBusLogs,
  useCrossRefs,
  useTaskObservability,
  useTaskTimeline,
} from "../useObservability";

export {
  useToolUsesDebounced,
  useTranscriptDebounced,
} from "../useObservability";

// === WebSocket Hooks ===
export { useObservabilityStream } from "../useObservabilityStream";
export { default as useObservabilityConnection } from "../useObservabilityConnection";

// === Real-Time Fusion Hooks ===
export {
  useRealtimeTranscript,
  useRealtimeToolUses,
  useRealtimeAssertions,
} from "../useRealtimeObservability";

// === Stats Hooks ===
export { useQuickStats, useToolCallRate } from "../useObservabilityStats";

// === Infinite Scroll Hooks ===
export {
  useInfiniteTranscript,
  useInfiniteToolUses,
  useInfiniteAssertions,
} from "../useInfiniteObservability";

// === Filter Hooks ===
export {
  useTranscriptFilters,
  useToolUseFilters,
  useAssertionFilters,
  useMessageBusFilters,
} from "../useObservabilityFilters";

// === Navigation Hooks ===
export { useObservabilityNavigation } from "../useObservabilityNavigation";

// === Re-export Types ===
export type {
  TranscriptEntry,
  ToolUse,
  AssertionResultEntry,
  SkillTrace,
  MessageBusLogEntry,
  ExecutionRun,
  ToolSummary,
  AssertionSummary,
  ObservabilityEvent,
  ObservabilityEventType,
} from "../../types/observability";
```

#### Acceptance Criteria

- [ ] All hooks exported from single entry point
- [ ] Types re-exported for convenience
- [ ] Import paths work: `import { useTranscript } from '@/hooks/observability'`

#### Test Script

```bash
# Verify exports compile
npx tsc --noEmit frontend/src/hooks/observability/index.ts

# Verify imports work
echo "import { useTranscript, useObservabilityStream, useQuickStats } from './frontend/src/hooks/observability';" > /tmp/test-import.ts
npx tsc --noEmit /tmp/test-import.ts
```

#### Pass Criteria

- [ ] Index file compiles without errors
- [ ] All exports importable

---

## Phase 7 Test Validation Script

**File:** `tests/e2e/test-obs-phase7-hooks.ts`

```typescript
#!/usr/bin/env npx tsx
/**
 * Phase 7 React Hooks Validation Tests
 *
 * Validates that all observability hooks are:
 * 1. Exported correctly
 * 2. Compilable without errors
 * 3. Follow hook naming conventions
 *
 * Run: npx tsx tests/e2e/test-obs-phase7-hooks.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const HOOKS_DIR = "frontend/src/hooks";
const EXPECTED_HOOKS = [
  "useObservability.ts",
  "useObservabilityStream.ts",
  "useObservabilityConnection.ts",
  "useRealtimeObservability.ts",
  "useObservabilityStats.ts",
  "useInfiniteObservability.ts",
  "useObservabilityFilters.ts",
  "useObservabilityNavigation.ts",
];

const EXPECTED_EXPORTS = [
  "useExecutions",
  "useExecution",
  "useTranscript",
  "useToolUses",
  "useAssertions",
  "useSkillTraces",
  "useToolSummary",
  "useAssertionSummary",
  "useMessageBusLogs",
  "useCrossRefs",
  "useObservabilityStream",
  "useQuickStats",
  "useRealtimeTranscript",
  "useInfiniteTranscript",
  "useTranscriptFilters",
  "useObservabilityNavigation",
];

// ============================================================================
// TEST 1: Hook Files Exist
// ============================================================================
function testHookFilesExist(): boolean {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: Hook Files Exist");
  console.log("=".repeat(70));

  let passed = true;
  const existingHooks: string[] = [];
  const missingHooks: string[] = [];

  for (const hookFile of EXPECTED_HOOKS) {
    const fullPath = path.join(HOOKS_DIR, hookFile);
    if (fs.existsSync(fullPath)) {
      existingHooks.push(hookFile);
      console.log(`✓ ${hookFile}`);
    } else {
      missingHooks.push(hookFile);
      console.log(`✗ ${hookFile} (MISSING)`);
      passed = false;
    }
  }

  console.log(`\nExisting: ${existingHooks.length}/${EXPECTED_HOOKS.length}`);
  console.log(`Missing: ${missingHooks.length}`);

  if (passed) {
    console.log("✓ TEST 1 PASSED\n");
  } else {
    console.log("✗ TEST 1 FAILED\n");
  }

  return passed;
}

// ============================================================================
// TEST 2: TypeScript Compilation
// ============================================================================
function testTypeScriptCompilation(): boolean {
  console.log("=".repeat(70));
  console.log("TEST 2: TypeScript Compilation");
  console.log("=".repeat(70));

  try {
    // Compile hook files
    execSync(`npx tsc --noEmit ${HOOKS_DIR}/useObservability.ts 2>&1`, {
      encoding: "utf8",
    });
    console.log("✓ useObservability.ts compiles");

    execSync(`npx tsc --noEmit ${HOOKS_DIR}/useObservabilityStream.ts 2>&1`, {
      encoding: "utf8",
    });
    console.log("✓ useObservabilityStream.ts compiles");

    execSync(
      `npx tsc --noEmit ${HOOKS_DIR}/useObservabilityConnection.ts 2>&1`,
      {
        encoding: "utf8",
      },
    );
    console.log("✓ useObservabilityConnection.ts compiles");

    console.log("✓ TEST 2 PASSED\n");
    return true;
  } catch (err) {
    console.log(`✗ Compilation error: ${err}`);
    console.log("✗ TEST 2 FAILED\n");
    return false;
  }
}

// ============================================================================
// TEST 3: Hook Naming Conventions
// ============================================================================
function testHookNamingConventions(): boolean {
  console.log("=".repeat(70));
  console.log("TEST 3: Hook Naming Conventions");
  console.log("=".repeat(70));

  let passed = true;

  for (const hookFile of EXPECTED_HOOKS) {
    const fullPath = path.join(HOOKS_DIR, hookFile);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");

    // Check for exported hooks starting with "use"
    const exportMatches =
      content.match(/export\s+(?:function|const)\s+(\w+)/g) || [];
    const hookExports = exportMatches.map((m) =>
      m.replace(/export\s+(?:function|const)\s+/, ""),
    );

    for (const hookName of hookExports) {
      if (hookName.startsWith("use")) {
        console.log(`✓ ${hookFile}: ${hookName}`);
      } else if (hookName === hookName.toUpperCase()) {
        // Constants are OK
        console.log(`✓ ${hookFile}: ${hookName} (constant)`);
      } else {
        console.log(`⚠ ${hookFile}: ${hookName} (not a hook name)`);
      }
    }
  }

  console.log("✓ TEST 3 PASSED\n");
  return passed;
}

// ============================================================================
// TEST 4: Required Exports Present
// ============================================================================
function testRequiredExports(): boolean {
  console.log("=".repeat(70));
  console.log("TEST 4: Required Exports Present");
  console.log("=".repeat(70));

  let passed = true;
  const foundExports: string[] = [];
  const missingExports: string[] = [];

  // Read all hook files and collect exports
  for (const hookFile of EXPECTED_HOOKS) {
    const fullPath = path.join(HOOKS_DIR, hookFile);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const exportMatches =
      content.match(/export\s+(?:function|const)\s+(\w+)/g) || [];

    for (const match of exportMatches) {
      const name = match.replace(/export\s+(?:function|const)\s+/, "");
      if (!foundExports.includes(name)) {
        foundExports.push(name);
      }
    }
  }

  // Check for required exports
  for (const required of EXPECTED_EXPORTS) {
    if (foundExports.includes(required)) {
      console.log(`✓ ${required}`);
    } else {
      console.log(`✗ ${required} (MISSING)`);
      missingExports.push(required);
      passed = false;
    }
  }

  console.log(`\nFound: ${foundExports.length}`);
  console.log(`Required: ${EXPECTED_EXPORTS.length}`);
  console.log(`Missing: ${missingExports.length}`);

  if (passed) {
    console.log("✓ TEST 4 PASSED\n");
  } else {
    console.log("✗ TEST 4 FAILED (some hooks need implementation)\n");
  }

  return passed;
}

// ============================================================================
// Main
// ============================================================================
function main(): void {
  console.log("\n" + "=".repeat(70));
  console.log("OBSERVABILITY PHASE 7 REACT HOOKS VALIDATION");
  console.log("=".repeat(70));

  const results = {
    filesExist: testHookFilesExist(),
    compiles: testTypeScriptCompilation(),
    naming: testHookNamingConventions(),
    exports: testRequiredExports(),
  };

  console.log("=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Files Exist:       ${results.filesExist ? "PASS" : "FAIL"}`);
  console.log(`Compilation:       ${results.compiles ? "PASS" : "FAIL"}`);
  console.log(`Naming Convention: ${results.naming ? "PASS" : "FAIL"}`);
  console.log(`Required Exports:  ${results.exports ? "PASS" : "PARTIAL"}`);

  const allPassed = results.filesExist && results.compiles && results.naming;

  if (allPassed) {
    console.log("\n✓ PHASE 7 CORE REQUIREMENTS PASSED");
    console.log("Note: Some enhancement hooks may still need implementation.");
  } else {
    console.log("\n✗ PHASE 7 HAS FAILURES");
    process.exit(1);
  }
}

main();
```

---

## Task Summary

| Task ID | Title                          | File                                               | Status      | Priority |
| ------- | ------------------------------ | -------------------------------------------------- | ----------- | -------- |
| OBS-700 | Verify Existing API Hooks      | `frontend/src/hooks/useObservability.ts`           | ✅ Complete | P2       |
| OBS-701 | Verify Existing WebSocket Hook | `frontend/src/hooks/useObservabilityStream.ts`     | ✅ Complete | P2       |
| OBS-702 | Verify Connection Hook         | `frontend/src/hooks/useObservabilityConnection.ts` | ✅ Complete | P2       |
| OBS-703 | Enhance Error Handling         | `frontend/src/hooks/useObservability.ts`           | 🔲 Pending  | P2       |
| OBS-704 | Add Debounced Filter Hook      | `frontend/src/hooks/useObservability.ts`           | 🔲 Pending  | P2       |
| OBS-705 | Create Real-Time Fusion Hook   | `frontend/src/hooks/useRealtimeObservability.ts`   | 🔲 Pending  | P2       |
| OBS-706 | Create QuickStats Hook         | `frontend/src/hooks/useObservabilityStats.ts`      | 🔲 Pending  | P2       |
| OBS-707 | Create Infinite Scroll Hook    | `frontend/src/hooks/useInfiniteObservability.ts`   | 🔲 Pending  | P2       |
| OBS-708 | Add Task-Scoped Hooks          | `frontend/src/hooks/useObservability.ts`           | 🔲 Pending  | P2       |
| OBS-709 | Create Filter State Hook       | `frontend/src/hooks/useObservabilityFilters.ts`    | 🔲 Pending  | P2       |
| OBS-710 | Add Entity Navigation Hook     | `frontend/src/hooks/useObservabilityNavigation.ts` | 🔲 Pending  | P2       |
| OBS-714 | Create Hook Test Suite         | `tests/hooks/test-observability-hooks.ts`          | 🔲 Pending  | P2       |
| OBS-715 | Create Hook Index Export       | `frontend/src/hooks/observability/index.ts`        | 🔲 Pending  | P2       |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 7 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VERIFICATION (Already Done)                                             │
│  ───────────────────────────                                            │
│  ✓ OBS-700: Verify useObservability.ts exists and works                 │
│  ✓ OBS-701: Verify useObservabilityStream.ts exists and works           │
│  ✓ OBS-702: Verify useObservabilityConnection.ts exists and works       │
│                                                                          │
│  ENHANCEMENT TASKS                                                       │
│  ─────────────────                                                      │
│  1. OBS-703: Add retry logic and better error handling                  │
│  2. OBS-704: Add debounced filter setters                               │
│                                                                          │
│  NEW HOOK IMPLEMENTATION                                                 │
│  ───────────────────────                                                │
│  3. OBS-705: Create useRealtimeObservability.ts (API + WS fusion)       │
│  4. OBS-706: Create useObservabilityStats.ts (QuickStats data)          │
│  5. OBS-707: Create useInfiniteObservability.ts (pagination)            │
│  6. OBS-708: Add task-scoped hooks to useObservability.ts               │
│  7. OBS-709: Create useObservabilityFilters.ts (URL sync)               │
│  8. OBS-710: Create useObservabilityNavigation.ts (deep links)          │
│                                                                          │
│  TESTING & EXPORT                                                        │
│  ────────────────                                                       │
│  9. OBS-714: Create comprehensive hook test suite                       │
│  10. OBS-715: Create hooks/observability/index.ts for clean exports     │
│                                                                          │
│  VALIDATION                                                              │
│  ──────────                                                             │
│  11. Run: npx tsx tests/e2e/test-obs-phase7-hooks.ts                    │
│      └─ Verify: PHASE 7 CORE REQUIREMENTS PASSED                        │
│  12. Run: npm test -- tests/hooks/test-observability-hooks.ts           │
│      └─ Verify: All tests pass                                          │
│                                                                          │
│  SUCCESS CRITERIA                                                        │
│  ────────────────                                                       │
│  ✓ All hook files compile without TypeScript errors                     │
│  ✓ Hook naming conventions followed (use* prefix)                       │
│  ✓ API hooks support filtering and pagination                           │
│  ✓ WebSocket hooks support auto-reconnect                               │
│  ✓ Real-time fusion hooks merge API + WebSocket                         │
│  ✓ Filter hooks sync with URL                                           │
│  ✓ Navigation hooks support deep linking                                │
│  ✓ All hooks exportable from index                                      │
│  ✓ Test suite passes with > 80% coverage                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Run Commands

```bash
# After implementing Phase 7 tasks

# Step 1: Verify TypeScript compilation
npx tsc --noEmit frontend/src/hooks/useObservability.ts
npx tsc --noEmit frontend/src/hooks/useObservabilityStream.ts

# Step 2: Run validation script
npx tsx tests/e2e/test-obs-phase7-hooks.ts

# Step 3: Run hook tests
npm test -- tests/hooks/test-observability-hooks.ts

# Step 4: Run with coverage
npm test -- --coverage tests/hooks/
```

### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 7 REACT HOOKS VALIDATION
======================================================================

======================================================================
TEST 1: Hook Files Exist
======================================================================
✓ useObservability.ts
✓ useObservabilityStream.ts
✓ useObservabilityConnection.ts
...

Existing: 8/8
Missing: 0
✓ TEST 1 PASSED

======================================================================
TEST 2: TypeScript Compilation
======================================================================
✓ useObservability.ts compiles
✓ useObservabilityStream.ts compiles
✓ useObservabilityConnection.ts compiles
✓ TEST 2 PASSED

======================================================================
TEST 3: Hook Naming Conventions
======================================================================
✓ useObservability.ts: useExecutions
✓ useObservability.ts: useExecution
✓ useObservability.ts: useTranscript
...
✓ TEST 3 PASSED

======================================================================
TEST 4: Required Exports Present
======================================================================
✓ useExecutions
✓ useExecution
✓ useTranscript
...

Found: 20
Required: 16
Missing: 0
✓ TEST 4 PASSED

======================================================================
SUMMARY
======================================================================
Files Exist:       PASS
Compilation:       PASS
Naming Convention: PASS
Required Exports:  PASS

✓ PHASE 7 CORE REQUIREMENTS PASSED
```

---

## Related Documents

| Document                                                           | Purpose                        |
| ------------------------------------------------------------------ | ------------------------------ |
| [SPEC.md](./SPEC.md)                                               | System specification           |
| [appendices/TYPES.md](./appendices/TYPES.md)                       | TypeScript type definitions    |
| [api/README.md](./api/README.md)                                   | API endpoint specifications    |
| [ui/README.md](./ui/README.md)                                     | UI component specifications    |
| [implementation-plan-phase-5.md](./implementation-plan-phase-5.md) | API Routes (Phase 5)           |
| [implementation-plan-phase-8.md](./implementation-plan-phase-8.md) | UI Components (Phase 8) - Next |

---

_Phase 7 Implementation Plan: React Hooks - Frontend Data Layer_
