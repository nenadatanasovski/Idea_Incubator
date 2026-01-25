/**
 * MemoryDatabasePanel Component
 * Displays the memory database contents (blocks, links, graphs) and ideation memory files
 * Supports navigation from graph nodes to specific database entries
 */

import { useState, useEffect, useMemo, useCallback } from "react";
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
  type: string;
  content: string;
  properties: Record<string, unknown>;
  status: string;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

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
 * Block row component
 */
function BlockRow({
  block,
  isHighlighted,
  onClick,
}: {
  block: MemoryBlock;
  isHighlighted: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isHighlighted ? "bg-cyan-50 border-l-4 border-l-cyan-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {block.content.substring(0, 100)}
            {block.content.length > 100 ? "..." : ""}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              {block.type}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                block.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {block.status}
            </span>
            {block.confidence !== undefined && (
              <span className="text-xs text-gray-500">
                {Math.round(block.confidence * 100)}% confidence
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}

/**
 * Link row component
 */
function LinkRow({
  link,
  isHighlighted,
  onClick,
}: {
  link: MemoryLink;
  isHighlighted: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isHighlighted ? "bg-cyan-50 border-l-4 border-l-cyan-500" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
          {link.linkType.replace(/_/g, " ")}
        </span>
        {link.degree && (
          <span className="text-xs text-gray-500 italic">{link.degree}</span>
        )}
        {link.confidence !== undefined && (
          <span className="text-xs text-gray-500">
            {Math.round(link.confidence * 100)}%
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
        <span className="font-mono truncate max-w-[120px]">
          {link.sourceBlockId.slice(0, 8)}
        </span>
        <span>→</span>
        <span className="font-mono truncate max-w-[120px]">
          {link.targetBlockId.slice(0, 8)}
        </span>
      </div>
    </button>
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
 * Memory file card component
 */
function MemoryFileCard({
  file,
  isHighlighted,
  isExpanded,
  onToggle,
}: {
  file: MemoryFile;
  isHighlighted: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const display = MEMORY_FILE_DISPLAY[file.fileType] || {
    label: file.fileType.replace(/_/g, " "),
    color: "bg-gray-100 text-gray-700",
    icon: "📄",
  };

  return (
    <div
      className={`border-b border-gray-100 ${
        isHighlighted ? "bg-cyan-50 border-l-4 border-l-cyan-500" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{display.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {display.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${display.color}`}
                >
                  v{file.version}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Updated: {new Date(file.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {file.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

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
              id: b.id,
              type: b.type,
              content: b.content,
              properties: b.properties || {},
              status: b.status || "active",
              confidence: b.confidence,
              createdAt: b.created_at || b.createdAt,
              updatedAt: b.updated_at || b.updatedAt,
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

  // Filter blocks by search query
  const filteredBlocks = useMemo(() => {
    if (!searchQuery) return blocks;
    const query = searchQuery.toLowerCase();
    return blocks.filter(
      (b) =>
        b.content.toLowerCase().includes(query) ||
        b.type.toLowerCase().includes(query) ||
        b.id.includes(query),
    );
  }, [blocks, searchQuery]);

  // Filter links by search query
  const filteredLinks = useMemo(() => {
    if (!searchQuery) return links;
    const query = searchQuery.toLowerCase();
    return links.filter(
      (l) =>
        l.linkType.toLowerCase().includes(query) ||
        l.sourceBlockId.includes(query) ||
        l.targetBlockId.includes(query),
    );
  }, [links, searchQuery]);

  // Filter memory files by search query
  const filteredMemoryFiles = useMemo(() => {
    if (!searchQuery) return memoryFiles;
    const query = searchQuery.toLowerCase();
    return memoryFiles.filter(
      (f) =>
        f.fileType.toLowerCase().includes(query) ||
        f.content.toLowerCase().includes(query),
    );
  }, [memoryFiles, searchQuery]);

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

        {/* Memory Files tab */}
        {!isLoading && !error && activeTable === "files" && (
          <div>
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
              filteredMemoryFiles.map((file) => (
                <div key={file.id} id={`memory-row-${file.id}`}>
                  <MemoryFileCard
                    file={file}
                    isHighlighted={highlightId === file.id}
                    isExpanded={expandedFileIds.has(file.id)}
                    onToggle={() => toggleFileExpansion(file.id)}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Blocks tab */}
        {!isLoading && !error && activeTable === "blocks" && (
          <div>
            {filteredBlocks.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No blocks found</p>
            ) : (
              filteredBlocks.map((block) => (
                <div key={block.id} id={`memory-row-${block.id}`}>
                  <BlockRow
                    block={block}
                    isHighlighted={highlightId === block.id}
                    onClick={() => setSelectedBlock(block)}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Links tab */}
        {!isLoading && !error && activeTable === "links" && (
          <div>
            {filteredLinks.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No links found</p>
            ) : (
              filteredLinks.map((link) => (
                <div key={link.id} id={`memory-row-${link.id}`}>
                  <LinkRow
                    link={link}
                    isHighlighted={highlightId === link.id}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Graphs tab */}
        {!isLoading && !error && activeTable === "graphs" && (
          <div className="p-4 text-center text-gray-500">
            Graph membership view coming soon
          </div>
        )}
      </div>

      {/* Selected block detail panel */}
      {selectedBlock && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">Block Details</h3>
            <button
              onClick={() => setSelectedBlock(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">ID</dt>
              <dd className="font-mono text-xs text-gray-700">
                {selectedBlock.id}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Content</dt>
              <dd className="text-gray-700">{selectedBlock.content}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Properties</dt>
              <dd className="font-mono text-xs text-gray-700 bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(selectedBlock.properties, null, 2)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

export default MemoryDatabasePanel;
