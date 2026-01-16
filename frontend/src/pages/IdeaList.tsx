import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, ChevronRight, Plus } from "lucide-react";
import { useIdeas } from "../hooks/useIdeas";
import { lifecycleStages, scoreInterpretation } from "../types";
import type { IdeaType, LifecycleStage, IdeaFilters } from "../types";
import clsx from "clsx";

const ideaTypes: { value: IdeaType; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "creative", label: "Creative" },
  { value: "technical", label: "Technical" },
  { value: "personal", label: "Personal" },
  { value: "research", label: "Research" },
];

const ideaTypeColors: Record<IdeaType, string> = {
  business: "bg-blue-100 text-blue-800",
  creative: "bg-purple-100 text-purple-800",
  technical: "bg-green-100 text-green-800",
  personal: "bg-orange-100 text-orange-800",
  research: "bg-cyan-100 text-cyan-800",
};

export default function IdeaList() {
  const [filters, setFilters] = useState<IdeaFilters>({
    sortBy: "updated_at",
    sortOrder: "desc",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { ideas, loading, error } = useIdeas({
    ...filters,
    search: searchQuery || undefined,
  });

  const handleTypeFilter = (type: IdeaType | undefined) => {
    setFilters((prev) => ({ ...prev, type }));
  };

  const handleStageFilter = (stage: LifecycleStage | undefined) => {
    setFilters((prev) => ({ ...prev, stage }));
  };

  const handleSort = (sortBy: IdeaFilters["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortOrder:
        prev.sortBy === sortBy && prev.sortOrder === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ideas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {ideas.length} idea{ideas.length !== 1 ? "s" : ""} in your incubator
          </p>
        </div>
        <Link
          to="/ideas/new"
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Idea
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              "btn-secondary",
              showFilters && "bg-primary-50 text-primary-700",
            )}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleTypeFilter(undefined)}
                  className={clsx(
                    "badge cursor-pointer",
                    !filters.type
                      ? "bg-primary-100 text-primary-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  All
                </button>
                {ideaTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleTypeFilter(type.value)}
                    className={clsx(
                      "badge cursor-pointer",
                      filters.type === type.value
                        ? ideaTypeColors[type.value]
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stage
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStageFilter(undefined)}
                  className={clsx(
                    "badge cursor-pointer",
                    !filters.stage
                      ? "bg-primary-100 text-primary-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  All
                </button>
                {Object.entries(lifecycleStages)
                  .sort((a, b) => a[1].order - b[1].order)
                  .slice(0, 12) // Show first 12 stages
                  .map(([stage, meta]) => (
                    <button
                      key={stage}
                      onClick={() => handleStageFilter(stage as LifecycleStage)}
                      className={clsx(
                        "badge cursor-pointer",
                        filters.stage === stage
                          ? `${meta.color} text-white`
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                      )}
                    >
                      {meta.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort by
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "updated_at", label: "Updated" },
                  { value: "created_at", label: "Created" },
                  { value: "title", label: "Title" },
                  { value: "score", label: "Score" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      handleSort(option.value as IdeaFilters["sortBy"])
                    }
                    className={clsx(
                      "badge cursor-pointer",
                      filters.sortBy === option.value
                        ? "bg-primary-100 text-primary-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    )}
                  >
                    {option.label}
                    {filters.sortBy === option.value && (
                      <span className="ml-1">
                        {filters.sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="card">
          <p className="text-gray-500">Loading ideas...</p>
        </div>
      ) : error ? (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Error loading ideas: {error.message}</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No ideas found</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first idea using the CLI: npm run cli capture
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <Link
              key={idea.id}
              to={`/ideas/${idea.slug}`}
              className="card block hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`badge ${ideaTypeColors[idea.idea_type]}`}>
                      {idea.idea_type}
                    </span>
                    <span
                      className={`badge ${
                        lifecycleStages[idea.lifecycle_stage]?.color ||
                        "bg-gray-500"
                      } text-white`}
                    >
                      {lifecycleStages[idea.lifecycle_stage]?.label ||
                        idea.lifecycle_stage}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">
                    {idea.title}
                  </h3>
                  {idea.summary && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {idea.summary}
                    </p>
                  )}
                  {idea.tags && idea.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {idea.tags.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="badge bg-gray-100 text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center ml-4">
                  {idea.avg_final_score !== null && (
                    <div className="text-right mr-4">
                      <div
                        className={`text-2xl font-bold ${scoreInterpretation.getColor(
                          idea.avg_final_score,
                        )}`}
                      >
                        {idea.avg_final_score.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {scoreInterpretation.getLevel(idea.avg_final_score)}
                      </div>
                    </div>
                  )}
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
