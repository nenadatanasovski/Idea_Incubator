/**
 * MemoryDatabasePanel Component
 * Displays the memory database contents (blocks, links, graphs) and ideation memory files
 * Supports navigation from graph nodes to specific database entries
 */

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import {
  Database,
  Table,
  Link2,
  Layers,
  Search,
  RefreshCw,
  ArrowLeft,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Filter,
} from "lucide-react";

export type MemoryTableName =
  | "blocks"
  | "links"
  | "graphs"
  | "sessions"
  | "files";

interface MemoryBlock {
  id: string;
  sessionId: string;
  ideaId?: string;
  type: string;
  title?: string | null; // Short 3-5 word summary for quick identification
  content: string;
  properties: Record<string, unknown>;
  status: string;
  confidence?: number;
  abstractionLevel?: string;
  createdAt: string;
  updatedAt: string;
  extractedFromMessageId?: string;
  artifactId?: string;
}

// Block type display config
const BLOCK_TYPE_DISPLAY: Record<string, { label: string; color: string }> = {
  content: { label: "Content", color: "bg-blue-100 text-blue-700" },
  synthesis: { label: "Synthesis", color: "bg-purple-100 text-purple-700" },
  action: { label: "Action", color: "bg-orange-100 text-orange-700" },
  decision: { label: "Decision", color: "bg-green-100 text-green-700" },
  option: { label: "Option", color: "bg-yellow-100 text-yellow-700" },
  assumption: { label: "Assumption", color: "bg-red-100 text-red-700" },
  pattern: { label: "Pattern", color: "bg-indigo-100 text-indigo-700" },
  derived: { label: "Derived", color: "bg-cyan-100 text-cyan-700" },
  external: { label: "External", color: "bg-gray-100 text-gray-700" },
  topic: { label: "Topic", color: "bg-teal-100 text-teal-700" },
  stakeholder_view: {
    label: "Stakeholder",
    color: "bg-pink-100 text-pink-700",
  },
  cycle: { label: "Cycle", color: "bg-amber-100 text-amber-700" },
  placeholder: { label: "Placeholder", color: "bg-slate-100 text-slate-700" },
  meta: { label: "Meta", color: "bg-violet-100 text-violet-700" },
  link: { label: "Link", color: "bg-sky-100 text-sky-700" },
};

// Abstraction level display config
const ABSTRACTION_LEVEL_DISPLAY: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  vision: {
    label: "Vision",
    color: "bg-purple-100 text-purple-700",
    icon: "🎯",
  },
  strategy: {
    label: "Strategy",
    color: "bg-blue-100 text-blue-700",
    icon: "🧭",
  },
  tactic: { label: "Tactic", color: "bg-green-100 text-green-700", icon: "🔧" },
  implementation: {
    label: "Implementation",
    color: "bg-gray-100 text-gray-700",
    icon: "⚙️",
  },
};

interface MemoryLink {
  id: string;
  sourceBlockId: string;
  targetBlockId: string;
  linkType: string;
  degree?: string;
  confidence?: number;
  reason?: string;
}

interface MemoryFile {
  id: string;
  sessionId: string;
  fileType: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryDatabasePanelProps {
  sessionId: string;
  // Navigation props - highlight specific entry
  highlightTable?: MemoryTableName;
  highlightId?: string;
  // Callback to go back to graph
  onBackToGraph?: () => void;
  className?: string;
}

/**
 * Table tab button
 */
function TableTab({
  name,
  icon: Icon,
  isActive,
  count,
  onClick,
}: {
  name: string;
  icon: React.ElementType;
  isActive: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        isActive
          ? "bg-cyan-100 text-cyan-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{name}</span>
      {count !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-xs ${
            isActive ? "bg-cyan-200 text-cyan-800" : "bg-gray-200 text-gray-600"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Filter tag component
 */
function FilterTag({
  label,
  count,
  isActive,
  color,
  onClick,
}: {
  label: string;
  count?: number;
  isActive: boolean;
  color?: string;
  onClick: () => void;
}) {
  const baseColor = color || "gray";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
        isActive
          ? `bg-${baseColor}-200 text-${baseColor}-800 ring-2 ring-${baseColor}-400 ring-offset-1`
          : `bg-${baseColor}-100 text-${baseColor}-700 hover:bg-${baseColor}-200`
      }`}
      style={
        isActive
          ? {
              boxShadow: `0 0 0 2px white, 0 0 0 4px var(--tw-ring-color, #94a3b8)`,
            }
          : {}
      }
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            isActive ? `bg-${baseColor}-300` : `bg-${baseColor}-200`
          }`}
        >
          {count}
        </span>
      )}
      {isActive && <X className="w-3 h-3" />}
    </button>
  );
}

/**
 * Filter bar component
 */
function FilterBar({
  filters,
  activeFilters,
  onToggleFilter,
  onClearAll,
}: {
  filters: { key: string; label: string; count: number; color?: string }[];
  activeFilters: Set<string>;
  onToggleFilter: (key: string) => void;
  onClearAll: () => void;
}) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50/50 overflow-x-auto">
      <Filter className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map((filter) => (
          <FilterTag
            key={filter.key}
            label={filter.label}
            count={filter.count}
            color={filter.color}
            isActive={activeFilters.has(filter.key)}
            onClick={() => onToggleFilter(filter.key)}
          />
        ))}
      </div>
      {activeFilters.size > 0 && (
        <button
          onClick={onClearAll}
          className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex-shrink-0"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/**
 * Memory file type display names and colors
 */
const MEMORY_FILE_DISPLAY: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  self_discovery: {
    label: "Self Discovery",
    color: "bg-purple-100 text-purple-700",
    icon: "🔍",
  },
  market_discovery: {
    label: "Market Discovery",
    color: "bg-blue-100 text-blue-700",
    icon: "📊",
  },
  narrowing_state: {
    label: "Narrowing State",
    color: "bg-amber-100 text-amber-700",
    icon: "🎯",
  },
  idea_candidate: {
    label: "Idea Candidate",
    color: "bg-green-100 text-green-700",
    icon: "💡",
  },
  viability_assessment: {
    label: "Viability Assessment",
    color: "bg-red-100 text-red-700",
    icon: "⚖️",
  },
  conversation_summary: {
    label: "Conversation Summary",
    color: "bg-gray-100 text-gray-700",
    icon: "📝",
  },
  handoff_notes: {
    label: "Handoff Notes",
    color: "bg-cyan-100 text-cyan-700",
    icon: "🤝",
  },
};

/**
 * MemoryDatabasePanel Component
 */
export function MemoryDatabasePanel({
  sessionId,
  highlightTable,
  highlightId,
  onBackToGraph,
  className = "",
}: MemoryDatabasePanelProps) {
  const [activeTable, setActiveTable] = useState<MemoryTableName>(
    highlightTable || "files",
  );
  const [blocks, setBlocks] = useState<MemoryBlock[]>([]);
  const [links, setLinks] = useState<MemoryLink[]>([]);
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<MemoryBlock | null>(null);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(
    new Set(),
  );

  // Filter states
  const [blockTypeFilters, setBlockTypeFilters] = useState<Set<string>>(
    new Set(),
  );
  const [blockStatusFilters, setBlockStatusFilters] = useState<Set<string>>(
    new Set(),
  );
  const [blockAbstractionFilters, setBlockAbstractionFilters] = useState<
    Set<string>
  >(new Set());
  const [linkTypeFilters, setLinkTypeFilters] = useState<Set<string>>(
    new Set(),
  );
  const [fileTypeFilters, setFileTypeFilters] = useState<Set<string>>(
    new Set(),
  );

  // Toggle file expansion
  const toggleFileExpansion = useCallback((fileId: string) => {
    setExpandedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  // Generic filter toggle helper
  const toggleFilter = useCallback(
    (
      setFilters: React.Dispatch<React.SetStateAction<Set<string>>>,
      key: string,
    ) => {
      setFilters((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [],
  );

  // Compute available filter options from data
  const blockTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    blocks.forEach((b) => counts.set(b.type, (counts.get(b.type) || 0) + 1));
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: key.replace(/_/g, " "),
        count,
        color: "blue",
      }))
      .sort((a, b) => b.count - a.count);
  }, [blocks]);

  const blockStatusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    blocks.forEach((b) =>
      counts.set(b.status, (counts.get(b.status) || 0) + 1),
    );
    const statusColors: Record<string, string> = {
      active: "green",
      validated: "blue",
      draft: "yellow",
      superseded: "orange",
      abandoned: "red",
    };
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: key,
        count,
        color: statusColors[key] || "gray",
      }))
      .sort((a, b) => b.count - a.count);
  }, [blocks]);

  const blockAbstractionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    blocks.forEach((b) => {
      if (b.abstractionLevel) {
        counts.set(
          b.abstractionLevel,
          (counts.get(b.abstractionLevel) || 0) + 1,
        );
      }
    });
    const abstractionColors: Record<string, string> = {
      vision: "purple",
      strategy: "blue",
      tactic: "green",
      implementation: "gray",
    };
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: ABSTRACTION_LEVEL_DISPLAY[key]?.label || key,
        count,
        color: abstractionColors[key] || "gray",
      }))
      .sort((a, b) => b.count - a.count);
  }, [blocks]);

  const linkTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    links.forEach((l) =>
      counts.set(l.linkType, (counts.get(l.linkType) || 0) + 1),
    );
    return Array.from(counts.entries())
      .map(([key, count]) => ({
        key,
        label: key.replace(/_/g, " "),
        count,
        color: "purple",
      }))
      .sort((a, b) => b.count - a.count);
  }, [links]);

  const fileTypeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    memoryFiles.forEach((f) =>
      counts.set(f.fileType, (counts.get(f.fileType) || 0) + 1),
    );
    return Array.from(counts.entries())
      .map(([key, count]) => {
        const display = MEMORY_FILE_DISPLAY[key];
        return {
          key,
          label: display?.label || key.replace(/_/g, " "),
          count,
          color: display
            ? display.color.includes("purple")
              ? "purple"
              : display.color.includes("blue")
                ? "blue"
                : display.color.includes("amber")
                  ? "amber"
                  : display.color.includes("green")
                    ? "green"
                    : display.color.includes("red")
                      ? "red"
                      : display.color.includes("cyan")
                        ? "cyan"
                        : "gray"
            : "gray",
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [memoryFiles]);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch memory files (ideation agent's working memory)
      const filesRes = await fetch(
        `/api/ideation/session/${sessionId}/memory-files`,
      );
      if (filesRes.ok) {
        const filesData = await filesRes.json();
        setMemoryFiles(
          (filesData.data?.memoryFiles || filesData.memoryFiles || []).map(
            (f: Record<string, unknown>) => ({
              id: f.id,
              sessionId: f.sessionId || f.session_id,
              fileType: f.fileType || f.file_type,
              content: f.content || "",
              version: f.version || 1,
              createdAt: f.createdAt || f.created_at,
              updatedAt: f.updatedAt || f.updated_at,
            }),
          ),
        );
      }

      // Fetch blocks
      const blocksRes = await fetch(
        `/api/ideation/session/${sessionId}/blocks`,
      );
      if (blocksRes.ok) {
        const blocksData = await blocksRes.json();
        setBlocks(
          (blocksData.data?.blocks || blocksData.blocks || []).map(
            (b: Record<string, unknown>) => ({
              id: b.id as string,
              sessionId: (b.sessionId || b.session_id) as string,
              ideaId: (b.ideaId || b.idea_id) as string | undefined,
              type: b.type as string,
              title: (b.title || null) as string | null | undefined,
              content: b.content as string,
              properties: (b.properties || {}) as Record<string, unknown>,
              status: (b.status || "active") as string,
              confidence: b.confidence as number | undefined,
              abstractionLevel: (b.abstractionLevel || b.abstraction_level) as
                | string
                | undefined,
              createdAt: (b.created_at || b.createdAt) as string,
              updatedAt: (b.updated_at || b.updatedAt) as string,
              extractedFromMessageId: (b.extractedFromMessageId ||
                b.extracted_from_message_id) as string | undefined,
              artifactId: (b.artifactId || b.artifact_id) as string | undefined,
            }),
          ),
        );
      }

      // Fetch links
      const linksRes = await fetch(`/api/ideation/session/${sessionId}/links`);
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setLinks(
          (linksData.data?.links || linksData.links || []).map(
            (l: Record<string, unknown>) => ({
              id: l.id,
              sourceBlockId: l.sourceBlockId || l.source,
              targetBlockId: l.targetBlockId || l.target,
              linkType: l.linkType || l.link_type,
              degree: l.degree,
              confidence: l.confidence,
              reason: l.reason,
            }),
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Switch to highlighted table when prop changes
  useEffect(() => {
    if (highlightTable) {
      setActiveTable(highlightTable);
    }
  }, [highlightTable]);

  // Scroll to highlighted item
  useEffect(() => {
    if (highlightId) {
      const element = document.getElementById(`memory-row-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightId, activeTable]);

  // Filter blocks by search query and tag filters
  const filteredBlocks = useMemo(() => {
    let result = blocks;

    // Apply type filters
    if (blockTypeFilters.size > 0) {
      result = result.filter((b) => blockTypeFilters.has(b.type));
    }

    // Apply status filters
    if (blockStatusFilters.size > 0) {
      result = result.filter((b) => blockStatusFilters.has(b.status));
    }

    // Apply abstraction level filters
    if (blockAbstractionFilters.size > 0) {
      result = result.filter(
        (b) =>
          b.abstractionLevel && blockAbstractionFilters.has(b.abstractionLevel),
      );
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.content.toLowerCase().includes(query) ||
          b.type.toLowerCase().includes(query) ||
          (b.title && b.title.toLowerCase().includes(query)) ||
          b.id.includes(query),
      );
    }

    return result;
  }, [
    blocks,
    searchQuery,
    blockTypeFilters,
    blockStatusFilters,
    blockAbstractionFilters,
  ]);

  // Filter links by search query and tag filters
  const filteredLinks = useMemo(() => {
    let result = links;

    // Apply link type filters
    if (linkTypeFilters.size > 0) {
      result = result.filter((l) => linkTypeFilters.has(l.linkType));
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.linkType.toLowerCase().includes(query) ||
          l.sourceBlockId.includes(query) ||
          l.targetBlockId.includes(query),
      );
    }

    return result;
  }, [links, searchQuery, linkTypeFilters]);

  // Filter memory files by search query and tag filters
  const filteredMemoryFiles = useMemo(() => {
    let result = memoryFiles;

    // Apply file type filters
    if (fileTypeFilters.size > 0) {
      result = result.filter((f) => fileTypeFilters.has(f.fileType));
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.fileType.toLowerCase().includes(query) ||
          f.content.toLowerCase().includes(query),
      );
    }

    return result;
  }, [memoryFiles, searchQuery, fileTypeFilters]);

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {onBackToGraph && (
            <button
              onClick={onBackToGraph}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Graph
            </button>
          )}
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Memory Database
            </h2>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Table tabs */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 overflow-x-auto">
        <TableTab
          name="Memory Files"
          icon={FileText}
          isActive={activeTable === "files"}
          count={memoryFiles.length}
          onClick={() => setActiveTable("files")}
        />
        <TableTab
          name="Blocks"
          icon={Table}
          isActive={activeTable === "blocks"}
          count={blocks.length}
          onClick={() => setActiveTable("blocks")}
        />
        <TableTab
          name="Links"
          icon={Link2}
          isActive={activeTable === "links"}
          count={links.length}
          onClick={() => setActiveTable("links")}
        />
        <TableTab
          name="Graphs"
          icon={Layers}
          isActive={activeTable === "graphs"}
          onClick={() => setActiveTable("graphs")}
        />
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTable === "files" ? "memory files" : activeTable}...`}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter bars */}
      {activeTable === "files" && fileTypeOptions.length > 0 && (
        <FilterBar
          filters={fileTypeOptions}
          activeFilters={fileTypeFilters}
          onToggleFilter={(key) => toggleFilter(setFileTypeFilters, key)}
          onClearAll={() => setFileTypeFilters(new Set())}
        />
      )}

      {activeTable === "blocks" && (
        <div className="border-b border-gray-100">
          {blockTypeOptions.length > 0 && (
            <FilterBar
              filters={blockTypeOptions}
              activeFilters={blockTypeFilters}
              onToggleFilter={(key) => toggleFilter(setBlockTypeFilters, key)}
              onClearAll={() => setBlockTypeFilters(new Set())}
            />
          )}
          {blockStatusOptions.length > 0 && (
            <FilterBar
              filters={blockStatusOptions}
              activeFilters={blockStatusFilters}
              onToggleFilter={(key) => toggleFilter(setBlockStatusFilters, key)}
              onClearAll={() => setBlockStatusFilters(new Set())}
            />
          )}
          {blockAbstractionOptions.length > 0 && (
            <FilterBar
              filters={blockAbstractionOptions}
              activeFilters={blockAbstractionFilters}
              onToggleFilter={(key) =>
                toggleFilter(setBlockAbstractionFilters, key)
              }
              onClearAll={() => setBlockAbstractionFilters(new Set())}
            />
          )}
        </div>
      )}

      {activeTable === "links" && linkTypeOptions.length > 0 && (
        <FilterBar
          filters={linkTypeOptions}
          activeFilters={linkTypeFilters}
          onToggleFilter={(key) => toggleFilter(setLinkTypeFilters, key)}
          onClearAll={() => setLinkTypeFilters(new Set())}
        />
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-4 m-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}

        {/* Memory Files tab - Table View */}
        {!isLoading && !error && activeTable === "files" && (
          <div className="overflow-x-auto">
            {filteredMemoryFiles.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No memory files found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Memory files are created as the ideation agent learns about
                  your idea
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">
                      Version
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Content Preview
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-44">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMemoryFiles.map((file) => {
                    const display = MEMORY_FILE_DISPLAY[file.fileType] || {
                      label: file.fileType.replace(/_/g, " "),
                      color: "bg-gray-100 text-gray-700",
                      icon: "📄",
                    };
                    const isExpanded = expandedFileIds.has(file.id);
                    return (
                      <tr
                        key={file.id}
                        id={`memory-row-${file.id}`}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          highlightId === file.id
                            ? "bg-cyan-50 border-l-4 border-l-cyan-500"
                            : ""
                        }`}
                        onClick={() => toggleFileExpansion(file.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{display.icon}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${display.color}`}
                            >
                              {display.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-gray-600">
                            v{file.version}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 truncate max-w-md">
                            {file.content.substring(0, 120)}
                            {file.content.length > 120 ? "..." : ""}
                          </p>
                          {isExpanded && (
                            <div className="mt-2 bg-white border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                                {file.content}
                              </pre>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-500">
                            {new Date(file.updatedAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Blocks tab - Table View */}
        {!isLoading && !error && activeTable === "blocks" && (
          <div className="overflow-x-auto">
            {filteredBlocks.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No blocks found</p>
            ) : (
              <table className="w-full min-w-[1600px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200">
                    <th className="px-2 py-3 w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">
                      Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[300px]">
                      Content
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBlocks.map((block) => {
                    const typeDisplay = BLOCK_TYPE_DISPLAY[block.type] || {
                      label: block.type.replace(/_/g, " "),
                      color: "bg-gray-100 text-gray-700",
                    };
                    const abstractionDisplay = block.abstractionLevel
                      ? ABSTRACTION_LEVEL_DISPLAY[block.abstractionLevel]
                      : null;
                    const statusColors: Record<string, string> = {
                      active: "bg-green-100 text-green-700",
                      validated: "bg-blue-100 text-blue-700",
                      draft: "bg-yellow-100 text-yellow-700",
                      superseded: "bg-orange-100 text-orange-700",
                      abandoned: "bg-red-100 text-red-700",
                    };

                    // Determine source
                    let sourceLabel = "—";
                    let sourceIcon = "";
                    if (block.extractedFromMessageId) {
                      sourceLabel = "Chat";
                      sourceIcon = "💬";
                    } else if (block.artifactId) {
                      sourceLabel = "Artifact";
                      sourceIcon = "📄";
                    }

                    const isExpanded = selectedBlock?.id === block.id;

                    return (
                      <Fragment key={block.id}>
                        <tr
                          id={`memory-row-${block.id}`}
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                            highlightId === block.id
                              ? "bg-cyan-50 border-l-4 border-l-cyan-500"
                              : isExpanded
                                ? "bg-gray-100"
                                : ""
                          }`}
                          onClick={() =>
                            setSelectedBlock(isExpanded ? null : block)
                          }
                        >
                          <td className="px-2 py-2.5 text-center">
                            <button
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBlock(isExpanded ? null : block);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-200"
                              title={block.id}
                            >
                              {block.id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${typeDisplay.color}`}
                            >
                              {typeDisplay.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {block.title ? (
                              <span className="text-sm text-gray-700 font-medium line-clamp-2">
                                {block.title}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                statusColors[block.status] ||
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {block.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {abstractionDisplay ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${abstractionDisplay.color}`}
                              >
                                <span>{abstractionDisplay.icon}</span>
                                <span>{abstractionDisplay.label}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-sm text-gray-700 line-clamp-2">
                              {block.content.substring(0, 150)}
                              {block.content.length > 150 ? "..." : ""}
                            </p>
                          </td>
                          <td className="px-4 py-2.5">
                            {block.confidence !== undefined ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden w-14">
                                  <div
                                    className="h-full bg-cyan-500 rounded-full"
                                    style={{
                                      width: `${Math.round(block.confidence * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {Math.round(block.confidence * 100)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {sourceLabel !== "—" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                                <span>{sourceIcon}</span>
                                <span>{sourceLabel}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {new Date(block.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                        {/* Inline expanded details row */}
                        {isExpanded && (
                          <tr
                            key={`${block.id}-details`}
                            className="bg-gray-50"
                          >
                            <td colSpan={10} className="px-4 py-4">
                              <div className="ml-6">
                                {/* Metadata grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      ID
                                    </dt>
                                    <dd
                                      className="font-mono text-xs text-gray-700 truncate"
                                      title={block.id}
                                    >
                                      {block.id}
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Type
                                    </dt>
                                    <dd>
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${typeDisplay.color}`}
                                      >
                                        {typeDisplay.label}
                                      </span>
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Status
                                    </dt>
                                    <dd>
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                                          statusColors[block.status] ||
                                          "bg-gray-100 text-gray-600"
                                        }`}
                                      >
                                        {block.status}
                                      </span>
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Abstraction
                                    </dt>
                                    <dd>
                                      {abstractionDisplay ? (
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${abstractionDisplay.color}`}
                                        >
                                          <span>{abstractionDisplay.icon}</span>
                                          <span>
                                            {abstractionDisplay.label}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">
                                          —
                                        </span>
                                      )}
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Confidence
                                    </dt>
                                    <dd>
                                      {block.confidence !== undefined ? (
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-16">
                                            <div
                                              className="h-full bg-cyan-500 rounded-full"
                                              style={{
                                                width: `${Math.round(block.confidence * 100)}%`,
                                              }}
                                            />
                                          </div>
                                          <span className="text-xs text-gray-600 font-medium">
                                            {Math.round(block.confidence * 100)}
                                            %
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">
                                          —
                                        </span>
                                      )}
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Source
                                    </dt>
                                    <dd className="text-xs text-gray-700">
                                      {block.extractedFromMessageId ? (
                                        <span className="inline-flex items-center gap-1">
                                          💬 Chat message
                                        </span>
                                      ) : block.artifactId ? (
                                        <span className="inline-flex items-center gap-1">
                                          📄 Artifact
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Created
                                    </dt>
                                    <dd className="text-xs text-gray-700">
                                      {new Date(
                                        block.createdAt,
                                      ).toLocaleString()}
                                    </dd>
                                  </div>
                                  <div className="bg-white rounded-lg p-2 border border-gray-200">
                                    <dt className="text-xs text-gray-500 mb-1">
                                      Updated
                                    </dt>
                                    <dd className="text-xs text-gray-700">
                                      {new Date(
                                        block.updatedAt,
                                      ).toLocaleString()}
                                    </dd>
                                  </div>
                                </div>

                                {/* Title (if present) */}
                                {block.title && (
                                  <div className="mb-3">
                                    <dt className="text-xs font-medium text-gray-500 mb-1">
                                      Title
                                    </dt>
                                    <dd className="text-sm text-gray-900 font-medium bg-white rounded-lg p-3 border border-gray-200">
                                      {block.title}
                                    </dd>
                                  </div>
                                )}

                                {/* Content */}
                                <div className="mb-3">
                                  <dt className="text-xs font-medium text-gray-500 mb-1">
                                    Content
                                  </dt>
                                  <dd className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200 whitespace-pre-wrap">
                                    {block.content}
                                  </dd>
                                </div>

                                {/* Properties (if not empty) */}
                                {Object.keys(block.properties).length > 0 && (
                                  <div className="mb-3">
                                    <dt className="text-xs font-medium text-gray-500 mb-1">
                                      Properties
                                    </dt>
                                    <dd className="font-mono text-xs text-gray-700 bg-white rounded-lg p-3 border border-gray-200 overflow-x-auto">
                                      <pre>
                                        {JSON.stringify(
                                          block.properties,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </dd>
                                  </div>
                                )}

                                {/* Source references */}
                                {(block.extractedFromMessageId ||
                                  block.artifactId ||
                                  block.ideaId) && (
                                  <div className="pt-3 border-t border-gray-200">
                                    <dt className="text-xs font-medium text-gray-500 mb-2">
                                      References
                                    </dt>
                                    <div className="flex flex-wrap gap-2">
                                      {block.extractedFromMessageId && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 text-xs text-gray-600">
                                          <span>Message:</span>
                                          <span className="font-mono">
                                            {block.extractedFromMessageId.slice(
                                              0,
                                              8,
                                            )}
                                            ...
                                          </span>
                                        </span>
                                      )}
                                      {block.artifactId && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 text-xs text-gray-600">
                                          <span>Artifact:</span>
                                          <span className="font-mono">
                                            {block.artifactId.slice(0, 8)}...
                                          </span>
                                        </span>
                                      )}
                                      {block.ideaId && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 text-xs text-gray-600">
                                          <span>Idea:</span>
                                          <span className="font-mono">
                                            {block.ideaId.slice(0, 8)}...
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Links tab - Table View */}
        {!isLoading && !error && activeTable === "links" && (
          <div className="overflow-x-auto">
            {filteredLinks.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No links found</p>
            ) : (
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">
                      Link Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                      Degree
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">
                      Source Block
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">
                      Target Block
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLinks.map((link) => (
                    <tr
                      key={link.id}
                      id={`memory-row-${link.id}`}
                      className={`hover:bg-gray-50 transition-colors ${
                        highlightId === link.id
                          ? "bg-cyan-50 border-l-4 border-l-cyan-500"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {link.linkType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {link.degree ? (
                          <span className="text-xs text-gray-600 italic">
                            {link.degree}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {link.sourceBlockId.slice(0, 12)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          {link.targetBlockId.slice(0, 12)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {link.confidence !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden w-16">
                              <div
                                className="h-full bg-purple-500 rounded-full"
                                style={{
                                  width: `${Math.round(link.confidence * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round(link.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {link.reason ? (
                          <p className="text-xs text-gray-600 truncate max-w-xs">
                            {link.reason}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Graphs tab - Table View Placeholder */}
        {!isLoading && !error && activeTable === "graphs" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48">
                    Graph Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                    Nodes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                    Edges
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-44">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      Graph membership view coming soon
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Track which blocks belong to which knowledge graphs
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryDatabasePanel;
