// =============================================================================
// FILE: frontend/src/components/ideation/IdeaSelector.tsx
// Dropdown component for selecting ideas
// Implements TEST-UI-008 requirements
// =============================================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface IdeaInfo {
  slug: string;
  title: string;
  ideaType:
    | "business"
    | "feature_internal"
    | "feature_external"
    | "service"
    | "pivot";
  stage: string;
  created: string;
  updated: string;
  isDraft: boolean;
}

export interface IdeaSelectorProps {
  userSlug: string;
  selectedIdea: { userSlug: string; ideaSlug: string } | null;
  onSelectIdea: (idea: { userSlug: string; ideaSlug: string } | null) => void;
  onNewIdea?: () => void;
  className?: string;
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const ChevronDownIcon = () => (
  <svg
    data-testid="dropdown-arrow"
    className="w-4 h-4 text-gray-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="w-4 h-4 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

const IdeaIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "business":
      return (
        <svg
          className="w-4 h-4 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      );
    case "feature_internal":
    case "feature_external":
      return (
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
          />
        </svg>
      );
    case "service":
      return (
        <svg
          className="w-4 h-4 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          />
        </svg>
      );
    case "pivot":
      return (
        <svg
          className="w-4 h-4 text-amber-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
  }
};

const DraftIcon = () => (
  <svg
    className="w-4 h-4 text-gray-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get display name for idea type
 */
function getTypeDisplayName(type: string): string {
  switch (type) {
    case "business":
      return "Business";
    case "feature_internal":
      return "Feature";
    case "feature_external":
      return "Integration";
    case "service":
      return "Service";
    case "pivot":
      return "Pivot";
    default:
      return type;
  }
}

/**
 * Format relative date
 */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const IdeaSelector: React.FC<IdeaSelectorProps> = ({
  userSlug,
  selectedIdea,
  onSelectIdea,
  onNewIdea,
  className = "",
}) => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [ideas, setIdeas] = useState<IdeaInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch ideas from API
  const fetchIdeas = useCallback(async () => {
    if (!userSlug) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ideation/ideas/${userSlug}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ideas: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success && result.data?.ideas) {
        setIdeas(result.data.ideas);
      } else {
        setIdeas([]);
      }
    } catch (err) {
      console.error("Error fetching ideas:", err);
      setError(err instanceof Error ? err.message : "Failed to load ideas");
      setIdeas([]);
    } finally {
      setIsLoading(false);
    }
  }, [userSlug]);

  // Fetch ideas on mount and when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchIdeas();
    }
  }, [isOpen, fetchIdeas]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Filter ideas based on search query
  const filteredIdeas = useMemo(() => {
    if (!searchQuery.trim()) return ideas;
    const query = searchQuery.toLowerCase();
    return ideas.filter(
      (idea) =>
        idea.title.toLowerCase().includes(query) ||
        idea.slug.toLowerCase().includes(query) ||
        idea.ideaType.toLowerCase().includes(query),
    );
  }, [ideas, searchQuery]);

  // Group ideas by category
  const groupedIdeas = useMemo(() => {
    const recent: IdeaInfo[] = [];
    const byType: Record<string, IdeaInfo[]> = {};
    const drafts: IdeaInfo[] = [];

    // Get last 5 accessed (sorted by updated date)
    const sortedByDate = [...filteredIdeas].sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
    );

    for (const idea of sortedByDate.slice(0, 5)) {
      if (!idea.isDraft) {
        recent.push(idea);
      }
    }

    // Group non-drafts by type
    for (const idea of filteredIdeas) {
      if (idea.isDraft) {
        drafts.push(idea);
      } else {
        const typeName = getTypeDisplayName(idea.ideaType);
        if (!byType[typeName]) {
          byType[typeName] = [];
        }
        byType[typeName].push(idea);
      }
    }

    return { recent, byType, drafts };
  }, [filteredIdeas]);

  // Handle idea selection
  const handleSelectIdea = useCallback(
    (idea: IdeaInfo) => {
      onSelectIdea({ userSlug, ideaSlug: idea.slug });
      setIsOpen(false);
      setSearchQuery("");
    },
    [userSlug, onSelectIdea],
  );

  // Handle new idea click
  const handleNewIdea = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    onNewIdea?.();
  }, [onNewIdea]);

  // Get current idea info
  const currentIdea = useMemo(() => {
    if (!selectedIdea) return null;
    return ideas.find((idea) => idea.slug === selectedIdea.ideaSlug) || null;
  }, [selectedIdea, ideas]);

  // Display text for the selector button
  const displayText = currentIdea
    ? `Working on: ${currentIdea.title}`
    : "Select an idea to work on...";

  return (
    <div
      ref={dropdownRef}
      data-testid="idea-selector"
      className={`relative ${className}`}
    >
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {currentIdea ? (
          <>
            <IdeaIcon type={currentIdea.ideaType} />
            <span className="max-w-[200px] truncate">{displayText}</span>
          </>
        ) : (
          <span className="text-gray-500">{displayText}</span>
        )}
        <ChevronDownIcon />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          data-testid="idea-selector-dropdown"
          aria-expanded={isOpen}
          className="absolute z-50 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <span className="absolute left-2 top-1/2 transform -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                ref={searchInputRef}
                data-testid="idea-search"
                type="text"
                placeholder="Search ideas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="p-4 text-center text-gray-500 text-sm">
              Loading...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 text-center text-red-500 text-sm">{error}</div>
          )}

          {/* Ideas List */}
          {!isLoading && !error && (
            <div className="max-h-80 overflow-y-auto">
              {/* Recent Ideas */}
              {groupedIdeas.recent.length > 0 && (
                <div data-testid="group-recent" className="py-1">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Recent
                  </div>
                  {groupedIdeas.recent.map((idea) => (
                    <IdeaOption
                      key={idea.slug}
                      idea={idea}
                      isSelected={selectedIdea?.ideaSlug === idea.slug}
                      onSelect={handleSelectIdea}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              )}

              {/* By Type */}
              {Object.keys(groupedIdeas.byType).length > 0 && (
                <div
                  data-testid="group-by-type"
                  className="py-1 border-t border-gray-200 dark:border-gray-700"
                >
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    By Type
                  </div>
                  {Object.entries(groupedIdeas.byType).map(
                    ([typeName, typeIdeas]) => (
                      <div key={typeName}>
                        <div className="px-3 py-0.5 text-xs text-gray-400 dark:text-gray-500">
                          {typeName}
                        </div>
                        {typeIdeas.map((idea) => (
                          <IdeaOption
                            key={idea.slug}
                            idea={idea}
                            isSelected={selectedIdea?.ideaSlug === idea.slug}
                            onSelect={handleSelectIdea}
                            searchQuery={searchQuery}
                          />
                        ))}
                      </div>
                    ),
                  )}
                </div>
              )}

              {/* Drafts */}
              {groupedIdeas.drafts.length > 0 && (
                <div
                  data-testid="group-drafts"
                  className="py-1 border-t border-gray-200 dark:border-gray-700"
                >
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Drafts
                  </div>
                  {groupedIdeas.drafts.map((idea) => (
                    <IdeaOption
                      key={idea.slug}
                      idea={idea}
                      isSelected={selectedIdea?.ideaSlug === idea.slug}
                      onSelect={handleSelectIdea}
                      searchQuery={searchQuery}
                      isDraft
                    />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {filteredIdeas.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {searchQuery ? "No ideas match your search" : "No ideas yet"}
                </div>
              )}
            </div>
          )}

          {/* New Idea Option */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              data-testid="new-idea-option"
              onClick={handleNewIdea}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <PlusIcon />
              <span>New idea</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// IdeaOption Component
// -----------------------------------------------------------------------------

interface IdeaOptionProps {
  idea: IdeaInfo;
  isSelected: boolean;
  onSelect: (idea: IdeaInfo) => void;
  searchQuery: string;
  isDraft?: boolean;
}

const IdeaOption: React.FC<IdeaOptionProps> = ({
  idea,
  isSelected,
  onSelect,
  searchQuery,
  isDraft = false,
}) => {
  // Check if this option should be visible based on search
  const isVisible =
    !searchQuery ||
    idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    idea.slug.toLowerCase().includes(searchQuery.toLowerCase());

  if (!isVisible) return null;

  return (
    <button
      data-testid="idea-option"
      onClick={() => onSelect(idea)}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
        ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        }
      `}
    >
      {isDraft ? <DraftIcon /> : <IdeaIcon type={idea.ideaType} />}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{idea.title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span>{idea.stage}</span>
          <span>-</span>
          <span>{formatRelativeDate(idea.updated)}</span>
        </div>
      </div>
      {isSelected && (
        <svg
          className="w-4 h-4 text-blue-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
};

export default IdeaSelector;
