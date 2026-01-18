/**
 * Observability Filter Hooks (OBS-709)
 * Manage filter state with URL synchronization.
 */

import { useCallback, useMemo } from "react";
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
      entryTypes: (searchParams.get("entryTypes")?.split(",").filter(Boolean) ||
        []) as TranscriptEntryType[],
      categories:
        searchParams.get("categories")?.split(",").filter(Boolean) || [],
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
      tools: searchParams.get("tools")?.split(",").filter(Boolean) || [],
      categories: (searchParams.get("categories")?.split(",").filter(Boolean) ||
        []) as ToolCategory[],
      status: (searchParams.get("status")?.split(",").filter(Boolean) ||
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
    // Convenience togglers
    toggleTool: (tool: string) => {
      const current = filters.tools;
      if (current.includes(tool)) {
        setFilter(
          "tools",
          current.filter((t) => t !== tool),
        );
      } else {
        setFilter("tools", [...current, tool]);
      }
    },
    toggleCategory: (category: ToolCategory) => {
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
 * Hook for managing assertion filters with URL sync.
 */
export function useAssertionFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<AssertionFilterState>(
    () => ({
      results: (searchParams.get("results")?.split(",").filter(Boolean) ||
        []) as AssertionResult[],
      categories:
        searchParams.get("categories")?.split(",").filter(Boolean) || [],
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
    // Convenience methods
    showOnlyFailures: () => setFilter("results", ["fail"]),
    showOnlyPasses: () => setFilter("results", ["pass"]),
    toggleResult: (result: AssertionResult) => {
      const current = filters.results;
      if (current.includes(result)) {
        setFilter(
          "results",
          current.filter((r) => r !== result),
        );
      } else {
        setFilter("results", [...current, result]);
      }
    },
  };
}

/**
 * Hook for managing message bus filters.
 */
export function useMessageBusFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<MessageBusFilterState>(
    () => ({
      severity: (searchParams.get("severity")?.split(",").filter(Boolean) ||
        []) as Severity[],
      sources: searchParams.get("sources")?.split(",").filter(Boolean) || [],
      eventTypes:
        searchParams.get("eventTypes")?.split(",").filter(Boolean) || [],
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
    // Convenience methods
    showErrorsOnly: () => setFilter("severity", ["error", "critical"]),
    toggleSeverity: (sev: Severity) => {
      const current = filters.severity;
      if (current.includes(sev)) {
        setFilter(
          "severity",
          current.filter((s) => s !== sev),
        );
      } else {
        setFilter("severity", [...current, sev]);
      }
    },
  };
}

/**
 * Combined filter hook for all observability views.
 * Useful when you need access to all filter types in one component.
 */
export function useObservabilityFiltersAll() {
  const transcript = useTranscriptFilters();
  const toolUse = useToolUseFilters();
  const assertion = useAssertionFilters();
  const messageBus = useMessageBusFilters();

  // Extract stable clearFilters functions to avoid dependency array issues
  const clearAllFilters = useCallback(() => {
    transcript.clearFilters();
    toolUse.clearFilters();
    assertion.clearFilters();
    messageBus.clearFilters();
  }, [
    transcript.clearFilters,
    toolUse.clearFilters,
    assertion.clearFilters,
    messageBus.clearFilters,
  ]);

  const hasAnyActiveFilters =
    transcript.hasActiveFilters ||
    toolUse.hasActiveFilters ||
    assertion.hasActiveFilters ||
    messageBus.hasActiveFilters;

  return {
    transcript,
    toolUse,
    assertion,
    messageBus,
    clearAllFilters,
    hasAnyActiveFilters,
  };
}
