/**
 * ObservabilitySearch - Unified search across all observability data
 * Features: debounced input, keyboard navigation, grouped results
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ScrollText,
  Play,
  Wrench,
  Bot,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

const API_BASE = "http://localhost:3001";

interface SearchResult {
  type: "event" | "execution" | "tool-use" | "agent" | "error";
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  href: string;
}

interface ObservabilitySearchProps {
  className?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ObservabilitySearch({
  className,
}: ObservabilitySearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch search results
  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/observability/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
      );
      const data = await response.json();
      if (data.success && data.data?.results) {
        setResults(data.data.results);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger search on debounced query change
  useEffect(() => {
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
          setQuery("");
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            const result = results[selectedIndex];
            navigate(result.href);
            setIsOpen(false);
            setQuery("");
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setQuery("");
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, selectedIndex, navigate],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".observability-search")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get icon for result type
  const getTypeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "event":
        return ScrollText;
      case "execution":
        return Play;
      case "tool-use":
        return Wrench;
      case "agent":
        return Bot;
      case "error":
        return AlertTriangle;
      default:
        return ScrollText;
    }
  };

  // Get color for result type
  const getTypeColor = (type: SearchResult["type"]) => {
    switch (type) {
      case "event":
        return "bg-purple-100 text-purple-700";
      case "execution":
        return "bg-blue-100 text-blue-700";
      case "tool-use":
        return "bg-green-100 text-green-700";
      case "agent":
        return "bg-orange-100 text-orange-700";
      case "error":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Group results by type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>,
  );

  // Build flat list with group headers for navigation
  const flatResults = results;

  const searchId = "observability-search";
  const resultsId = "observability-search-results";

  return (
    <div className={clsx("observability-search relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={searchId}
          type="text"
          role="combobox"
          aria-expanded={isOpen && results.length > 0}
          aria-controls={resultsId}
          aria-activedescendant={
            selectedIndex >= 0
              ? `${resultsId}-item-${selectedIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-label="Search observability data"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search events, executions, tools..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && (query || loading) && (
        <div
          ref={resultsRef}
          id={resultsId}
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-auto z-50"
        >
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Searching...</span>
            </div>
          ) : results.length === 0 && debouncedQuery ? (
            <div className="py-8 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No results found for "{debouncedQuery}"</p>
              <p className="text-sm text-gray-400 mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {Object.entries(groupedResults).map(([type, items]) => (
                <div key={type}>
                  {/* Type Header */}
                  <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0">
                    {type === "tool-use" ? "Tool Uses" : `${type}s`}
                  </div>
                  {/* Results */}
                  {items.map((result) => {
                    const globalIndex = flatResults.findIndex(
                      (r) => r.id === result.id && r.type === result.type,
                    );
                    const Icon = getTypeIcon(result.type);
                    const isSelected = selectedIndex === globalIndex;

                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        id={`${resultsId}-item-${globalIndex}`}
                        role="option"
                        aria-selected={isSelected}
                        data-index={globalIndex}
                        onClick={() => {
                          navigate(result.href);
                          setIsOpen(false);
                          setQuery("");
                        }}
                        className={clsx(
                          "w-full px-3 py-2 text-left flex items-start gap-3 transition-colors",
                          isSelected ? "bg-blue-50" : "hover:bg-gray-50",
                        )}
                      >
                        <span
                          className={clsx(
                            "inline-flex items-center justify-center w-6 h-6 rounded shrink-0",
                            getTypeColor(result.type),
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {result.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {result.subtitle}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatTimestamp(result.timestamp)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Keyboard hint */}
          {results.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  ↑↓
                </kbd>{" "}
                Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  Enter
                </kbd>{" "}
                Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  Esc
                </kbd>{" "}
                Close
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Format timestamp to relative time
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
