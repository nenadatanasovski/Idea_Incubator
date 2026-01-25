/**
 * GraphFilters Component
 * Filter chips and controls for graph visualization
 */

import { useCallback, useState } from "react";
import type {
  GraphType,
  BlockType,
  BlockStatus,
  AbstractionLevel,
  SourceType,
  GraphFilters as GraphFiltersType,
} from "../../types/graph";
import { nodeColors, graphColors } from "../../types/graph";

export interface GraphFiltersProps {
  filters: GraphFiltersType;
  onFiltersChange: (filters: GraphFiltersType) => void;
  onReset: () => void;
  nodeCount?: number;
  filteredNodeCount?: number;
  className?: string;
}

// All available graph types
const ALL_GRAPH_TYPES: GraphType[] = [
  "problem",
  "solution",
  "market",
  "risk",
  "fit",
  "business",
  "spec",
];

// All available block types (excludes 'link' as it's typically hidden in graph display)
type FilterableBlockType = Exclude<BlockType, "link">;
const ALL_BLOCK_TYPES: FilterableBlockType[] = [
  "content",
  "meta",
  "synthesis",
  "pattern",
  "decision",
  "option",
  "derived",
  "assumption",
  "cycle",
  "placeholder",
  "stakeholder_view",
  "topic",
  "external",
  "action",
];

// All available statuses
const ALL_STATUSES: BlockStatus[] = [
  "draft",
  "active",
  "validated",
  "superseded",
  "abandoned",
];

// All available abstraction levels
const ALL_ABSTRACTION_LEVELS: AbstractionLevel[] = [
  "vision",
  "strategy",
  "tactic",
  "implementation",
];

// All available source types (internal data sources)
const ALL_SOURCE_TYPES: SourceType[] = [
  "chat",
  "artifact",
  "memory_file",
  "memory_db",
  "user_created",
  "ai_generated",
];

// Source type labels and colors (internal data sources)
const SOURCE_TYPE_LABELS: Record<SourceType, { label: string; color: string }> =
  {
    chat: { label: "Chat", color: "#8B5CF6" }, // Purple - conversation
    artifact: { label: "Artifact", color: "#F59E0B" }, // Amber - markdown files
    memory_file: { label: "Memory File", color: "#06B6D4" }, // Cyan - ideation agent memory
    memory_db: { label: "Database", color: "#3B82F6" }, // Blue - memory blocks/links
    user_created: { label: "User Created", color: "#22C55E" }, // Green - manual
    ai_generated: { label: "AI Generated", color: "#EC4899" }, // Pink - AI analysis
  };

// Abstraction level labels and colors
const ABSTRACTION_LEVEL_LABELS: Record<
  AbstractionLevel,
  { label: string; color: string }
> = {
  vision: { label: "Vision", color: "#8B5CF6" }, // Purple
  strategy: { label: "Strategy", color: "#3B82F6" }, // Blue
  tactic: { label: "Tactic", color: "#22C55E" }, // Green
  implementation: { label: "Implementation", color: "#F59E0B" }, // Amber
};

// Human-readable labels for block types (excludes 'link' as it's typically hidden)
const BLOCK_TYPE_LABELS: Record<FilterableBlockType, string> = {
  content: "Content",
  meta: "Meta",
  synthesis: "Synthesis",
  pattern: "Pattern",
  decision: "Decision",
  option: "Option",
  derived: "Derived",
  assumption: "Assumption",
  cycle: "Cycle",
  placeholder: "Placeholder",
  stakeholder_view: "Stakeholder",
  topic: "Topic",
  external: "External",
  action: "Action",
};

// Human-readable labels for graph types
const GRAPH_TYPE_LABELS: Record<GraphType, string> = {
  problem: "Problem",
  solution: "Solution",
  market: "Market",
  risk: "Risk",
  fit: "Fit",
  business: "Business",
  spec: "Spec",
};

// Status labels with icons
const STATUS_LABELS: Record<BlockStatus, { label: string; icon: string }> = {
  draft: { label: "Draft", icon: "pencil" },
  active: { label: "Active", icon: "check-circle" },
  validated: { label: "Validated", icon: "badge-check" },
  superseded: { label: "Superseded", icon: "archive" },
  abandoned: { label: "Abandoned", icon: "x-circle" },
};

/**
 * Filter chip component
 */
function FilterChip({
  label,
  isSelected,
  onClick,
  color,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium
        transition-all duration-150 ease-in-out
        border
        ${
          isSelected
            ? "border-transparent shadow-sm"
            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300"
        }
      `}
      style={{
        backgroundColor: isSelected
          ? color
            ? `${color}20`
            : "rgb(59, 130, 246, 0.15)"
          : undefined,
        color: isSelected ? color || "rgb(59, 130, 246)" : undefined,
      }}
    >
      {label}
    </button>
  );
}

/**
 * Filter section component
 */
function FilterSection({
  title,
  children,
  isExpanded,
  onToggle,
  activeCount,
}: {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  activeCount?: number;
}) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-2.5 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
      >
        <span className="flex items-center gap-2">
          {title}
          {activeCount !== undefined && activeCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs">
              {activeCount}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isExpanded && <div className="pb-3">{children}</div>}
    </div>
  );
}

/**
 * Confidence slider component
 * Uses a proper dual-range slider with pointer-events handling
 */
function ConfidenceSlider({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  const [min, max] = value;
  // Track which thumb is being dragged to handle overlapping values
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);

  // Determine which slider to activate based on click position
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const distToMin = Math.abs(clickPosition - min);
    const distToMax = Math.abs(clickPosition - max);

    // Activate the closer thumb
    if (distToMin <= distToMax) {
      if (clickPosition < max) {
        onChange([clickPosition, max]);
      }
    } else {
      if (clickPosition > min) {
        onChange([min, clickPosition]);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{Math.round(min * 100)}%</span>
        <span>{Math.round(max * 100)}%</span>
      </div>
      <div
        className="relative h-6 cursor-pointer"
        onClick={handleTrackClick}
        role="group"
        aria-label="Confidence range slider"
      >
        {/* Background track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gray-200 dark:bg-gray-600 rounded-full" />
        {/* Active range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-blue-500 rounded-full pointer-events-none"
          style={{
            left: `${min * 100}%`,
            width: `${(max - min) * 100}%`,
          }}
        />
        {/* Min slider - positioned only on left portion */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={min}
          onChange={(e) => {
            const newMin = parseFloat(e.target.value);
            if (newMin < max) {
              onChange([newMin, max]);
            }
          }}
          onMouseDown={() => setActiveThumb("min")}
          onMouseUp={() => setActiveThumb(null)}
          onTouchStart={() => setActiveThumb("min")}
          onTouchEnd={() => setActiveThumb(null)}
          className="absolute top-0 h-full opacity-0 cursor-pointer"
          style={{
            left: 0,
            width: `${((min + max) / 2) * 100}%`,
            pointerEvents: activeThumb === "max" ? "none" : "auto",
          }}
          aria-label="Minimum confidence"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={min}
        />
        {/* Max slider - positioned only on right portion */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={max}
          onChange={(e) => {
            const newMax = parseFloat(e.target.value);
            if (newMax > min) {
              onChange([min, newMax]);
            }
          }}
          onMouseDown={() => setActiveThumb("max")}
          onMouseUp={() => setActiveThumb(null)}
          onTouchStart={() => setActiveThumb("max")}
          onTouchEnd={() => setActiveThumb(null)}
          className="absolute top-0 h-full opacity-0 cursor-pointer"
          style={{
            left: `${((min + max) / 2) * 100}%`,
            width: `${(1 - (min + max) / 2) * 100}%`,
            pointerEvents: activeThumb === "min" ? "none" : "auto",
          }}
          aria-label="Maximum confidence"
          aria-valuemin={min}
          aria-valuemax={1}
          aria-valuenow={max}
        />
        {/* Visual thumb indicators */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-200 border-2 border-blue-500 rounded-full shadow-sm pointer-events-none"
          style={{ left: `calc(${min * 100}% - 8px)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-gray-200 border-2 border-blue-500 rounded-full shadow-sm pointer-events-none"
          style={{ left: `calc(${max * 100}% - 8px)` }}
        />
      </div>
      {/* Preset buttons */}
      <div className="flex gap-1 mt-2">
        <button
          onClick={() => onChange([0, 1])}
          className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          All
        </button>
        <button
          onClick={() => onChange([0.7, 1])}
          className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          High
        </button>
        <button
          onClick={() => onChange([0.3, 0.7])}
          className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Med
        </button>
        <button
          onClick={() => onChange([0, 0.3])}
          className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Low
        </button>
      </div>
    </div>
  );
}

/**
 * GraphFilters Component
 */
export function GraphFilters({
  filters,
  onFiltersChange,
  onReset,
  nodeCount,
  filteredNodeCount,
  className = "",
}: GraphFiltersProps) {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["graphTypes", "blockTypes"]),
  );

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Toggle a graph type filter
  const toggleGraphType = useCallback(
    (graphType: GraphType) => {
      const newGraphTypes = filters.graphTypes.includes(graphType)
        ? filters.graphTypes.filter((t) => t !== graphType)
        : [...filters.graphTypes, graphType];
      onFiltersChange({ ...filters, graphTypes: newGraphTypes });
    },
    [filters, onFiltersChange],
  );

  // Toggle a block type filter
  const toggleBlockType = useCallback(
    (blockType: BlockType) => {
      const newBlockTypes = filters.blockTypes.includes(blockType)
        ? filters.blockTypes.filter((t) => t !== blockType)
        : [...filters.blockTypes, blockType];
      onFiltersChange({ ...filters, blockTypes: newBlockTypes });
    },
    [filters, onFiltersChange],
  );

  // Toggle a status filter
  const toggleStatus = useCallback(
    (status: BlockStatus) => {
      const newStatuses = filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status];
      onFiltersChange({ ...filters, statuses: newStatuses });
    },
    [filters, onFiltersChange],
  );

  // Toggle an abstraction level filter
  const toggleAbstractionLevel = useCallback(
    (level: AbstractionLevel) => {
      const newLevels = filters.abstractionLevels.includes(level)
        ? filters.abstractionLevels.filter((l) => l !== level)
        : [...filters.abstractionLevels, level];
      onFiltersChange({ ...filters, abstractionLevels: newLevels });
    },
    [filters, onFiltersChange],
  );

  // Toggle a source type filter
  const toggleSourceType = useCallback(
    (sourceType: SourceType) => {
      const newSourceTypes = filters.sourceTypes.includes(sourceType)
        ? filters.sourceTypes.filter((s) => s !== sourceType)
        : [...filters.sourceTypes, sourceType];
      onFiltersChange({ ...filters, sourceTypes: newSourceTypes });
    },
    [filters, onFiltersChange],
  );

  // Update confidence range
  const updateConfidenceRange = useCallback(
    (range: [number, number]) => {
      onFiltersChange({ ...filters, confidenceRange: range });
    },
    [filters, onFiltersChange],
  );

  // Check if any filters are active
  const hasActiveFilters =
    filters.graphTypes.length > 0 ||
    filters.blockTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.abstractionLevels.length > 0 ||
    filters.sourceTypes.length > 0 ||
    filters.confidenceRange[0] > 0 ||
    filters.confidenceRange[1] < 1;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
      data-testid="graph-filters"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Filters
          </span>
          {filteredNodeCount !== undefined && nodeCount !== undefined && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filteredNodeCount} / {nodeCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Filter sections */}
      <div className="px-4 divide-y divide-gray-200 dark:divide-gray-700">
        {/* Graph Types */}
        <FilterSection
          title="Graph Type"
          isExpanded={expandedSections.has("graphTypes")}
          onToggle={() => toggleSection("graphTypes")}
          activeCount={filters.graphTypes.length}
        >
          <div className="flex flex-wrap gap-2">
            {ALL_GRAPH_TYPES.map((graphType) => (
              <FilterChip
                key={graphType}
                label={GRAPH_TYPE_LABELS[graphType]}
                isSelected={filters.graphTypes.includes(graphType)}
                onClick={() => toggleGraphType(graphType)}
                color={graphColors[graphType]}
              />
            ))}
          </div>
        </FilterSection>

        {/* Block Types */}
        <FilterSection
          title="Block Type"
          isExpanded={expandedSections.has("blockTypes")}
          onToggle={() => toggleSection("blockTypes")}
          activeCount={filters.blockTypes.length}
        >
          <div className="flex flex-wrap gap-2">
            {ALL_BLOCK_TYPES.map((blockType) => (
              <FilterChip
                key={blockType}
                label={BLOCK_TYPE_LABELS[blockType]}
                isSelected={filters.blockTypes.includes(blockType)}
                onClick={() => toggleBlockType(blockType)}
                color={nodeColors[blockType]}
              />
            ))}
          </div>
        </FilterSection>

        {/* Status */}
        <FilterSection
          title="Status"
          isExpanded={expandedSections.has("statuses")}
          onToggle={() => toggleSection("statuses")}
          activeCount={filters.statuses.length}
        >
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((status) => (
              <FilterChip
                key={status}
                label={STATUS_LABELS[status].label}
                isSelected={filters.statuses.includes(status)}
                onClick={() => toggleStatus(status)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Abstraction Level */}
        <FilterSection
          title="Abstraction Level"
          isExpanded={expandedSections.has("abstractionLevels")}
          onToggle={() => toggleSection("abstractionLevels")}
          activeCount={filters.abstractionLevels.length}
        >
          <div className="flex flex-wrap gap-2">
            {ALL_ABSTRACTION_LEVELS.map((level) => (
              <FilterChip
                key={level}
                label={ABSTRACTION_LEVEL_LABELS[level].label}
                isSelected={filters.abstractionLevels.includes(level)}
                onClick={() => toggleAbstractionLevel(level)}
                color={ABSTRACTION_LEVEL_LABELS[level].color}
              />
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Filter by abstraction hierarchy: Vision → Strategy → Tactic →
            Implementation
          </div>
        </FilterSection>

        {/* Source Type */}
        <FilterSection
          title="Source Type"
          isExpanded={expandedSections.has("sourceTypes")}
          onToggle={() => toggleSection("sourceTypes")}
          activeCount={filters.sourceTypes.length}
        >
          <div className="flex flex-wrap gap-2">
            {ALL_SOURCE_TYPES.map((sourceType) => (
              <FilterChip
                key={sourceType}
                label={SOURCE_TYPE_LABELS[sourceType].label}
                isSelected={filters.sourceTypes.includes(sourceType)}
                onClick={() => toggleSourceType(sourceType)}
                color={SOURCE_TYPE_LABELS[sourceType].color}
              />
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Filter by where the data originated from
          </div>
        </FilterSection>

        {/* Confidence */}
        <FilterSection
          title="Confidence"
          isExpanded={expandedSections.has("confidence")}
          onToggle={() => toggleSection("confidence")}
          activeCount={
            filters.confidenceRange[0] > 0 || filters.confidenceRange[1] < 1
              ? 1
              : 0
          }
        >
          <ConfidenceSlider
            value={filters.confidenceRange}
            onChange={updateConfidenceRange}
          />
        </FilterSection>
      </div>
    </div>
  );
}

export default GraphFilters;
