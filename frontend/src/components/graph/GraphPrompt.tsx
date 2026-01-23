/**
 * GraphPrompt Component
 * AI-powered prompt interface for interacting with the memory graph
 *
 * Features:
 * - Text input with send button
 * - Example prompt suggestions
 * - Loading state during AI processing
 * - Error handling for failed requests
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { GraphFilters as GraphFiltersType } from "../../types/graph";

// ============================================================================
// Types
// ============================================================================

export type PromptActionType =
  | "link_created"
  | "highlight"
  | "filter"
  | "block_updated"
  | "clarification_needed"
  | "error";

export interface PromptResult {
  action: PromptActionType;
  message?: string;
  // For link_created
  link?: {
    id: string;
    source: string;
    target: string;
    linkType: string;
  };
  // For highlight
  nodeIds?: string[];
  // For filter
  filters?: Partial<GraphFiltersType>;
  // For block_updated
  block?: {
    id: string;
    status?: string;
    properties?: Record<string, unknown>;
  };
}

export interface GraphPromptProps {
  sessionId: string;
  onResult?: (result: PromptResult) => void;
  onHighlight?: (nodeIds: string[]) => void;
  onFilterChange?: (filters: Partial<GraphFiltersType>) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Example Prompts
// ============================================================================

const EXAMPLE_PROMPTS = [
  {
    label: "Link blocks",
    prompt: "Link the solution block to the problem block",
    icon: "🔗",
  },
  {
    label: "Find assumptions",
    prompt: "Highlight all assumptions",
    icon: "💡",
  },
  {
    label: "Filter by market",
    prompt: "Show only the market graph",
    icon: "🎯",
  },
  {
    label: "Find mentions",
    prompt: "What blocks mention revenue?",
    icon: "🔍",
  },
  {
    label: "Mark validated",
    prompt: "Mark the market size block as validated",
    icon: "✅",
  },
  {
    label: "Show risks",
    prompt: "Show only risk blocks",
    icon: "⚠️",
  },
];

// ============================================================================
// Component
// ============================================================================

export function GraphPrompt({
  sessionId,
  onResult,
  onHighlight,
  onFilterChange,
  disabled = false,
  className = "",
}: GraphPromptProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PromptResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  // Handle prompt submission
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!prompt.trim() || isLoading || disabled) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setLastResult(null);

      try {
        const response = await fetch(
          `/api/ideation/session/${sessionId}/graph/prompt`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: prompt.trim() }),
          },
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        const result: PromptResult = await response.json();
        setLastResult(result);

        // Handle the result based on action type
        if (result.action === "highlight" && result.nodeIds && onHighlight) {
          onHighlight(result.nodeIds);
        } else if (
          result.action === "filter" &&
          result.filters &&
          onFilterChange
        ) {
          onFilterChange(result.filters);
        }

        // Notify parent of result
        onResult?.(result);

        // Clear input on success (except for clarification)
        if (result.action !== "clarification_needed") {
          setPrompt("");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to process prompt";
        setError(errorMessage);
        setLastResult({
          action: "error",
          message: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      prompt,
      sessionId,
      isLoading,
      disabled,
      onResult,
      onHighlight,
      onFilterChange,
    ],
  );

  // Handle example prompt click
  const handleExampleClick = useCallback((examplePrompt: string) => {
    setPrompt(examplePrompt);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [handleSubmit],
  );

  return (
    <div className={`relative ${className}`} data-testid="graph-prompt">
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay hiding to allow click on suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            placeholder="Ask about your graph... (e.g., 'Link solution to problem')"
            disabled={disabled || isLoading}
            className={`
              w-full px-4 py-2.5 pr-10
              bg-white
              border border-gray-200
              rounded-lg
              text-sm text-gray-900
              placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            `}
            data-testid="graph-prompt-input"
          />

          {/* Suggestions Toggle */}
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            title="Show examples"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading || disabled}
          className={`
            px-4 py-2.5
            bg-blue-600 hover:bg-blue-700
            text-white text-sm font-medium
            rounded-lg
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            transition-colors
            flex items-center gap-2
          `}
          data-testid="graph-prompt-submit"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                data-testid="graph-prompt-loading"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span>Send</span>
            </>
          )}
        </button>
      </form>

      {/* Example Prompts Dropdown */}
      {showSuggestions && !isLoading && (
        <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Example Prompts
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleExampleClick(example.prompt)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">{example.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {example.label}
                  </p>
                  <p className="text-xs text-gray-500">{example.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Result Feedback */}
      {lastResult && lastResult.action !== "error" && (
        <div
          className={`
            mt-2 p-2 rounded-lg border
            ${
              lastResult.action === "clarification_needed"
                ? "bg-amber-50 border-amber-200"
                : "bg-green-50 border-green-200"
            }
          `}
        >
          <p
            className={`
              text-sm flex items-center gap-2
              ${
                lastResult.action === "clarification_needed"
                  ? "text-amber-600"
                  : "text-green-600"
              }
            `}
          >
            {lastResult.action === "clarification_needed" ? (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {lastResult.message || "Could you be more specific?"}
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {getActionMessage(lastResult)}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getActionMessage(result: PromptResult): string {
  switch (result.action) {
    case "link_created":
      return `Link created between blocks`;
    case "highlight":
      return `Highlighted ${result.nodeIds?.length || 0} nodes`;
    case "filter":
      const filterTypes = result.filters?.graphTypes || [];
      return filterTypes.length
        ? `Filtered to ${filterTypes.join(", ")} graph(s)`
        : "Filters applied";
    case "block_updated":
      return `Block updated${result.block?.status ? ` to ${result.block.status}` : ""}`;
    default:
      return "Action completed";
  }
}

export default GraphPrompt;
