/**
 * SchemaPage - Data Model Documentation Browser
 *
 * Provides programmatic access to the schema registry with:
 * - Entity list with descriptions and metadata
 * - Entity detail view with JSON Schema
 * - Enum browser
 * - Relationship graph visualization
 */

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Search,
  Loader2,
  RefreshCw,
  List,
  GitBranch,
  Hash,
  Download,
  Copy,
  Check,
} from "lucide-react";
import clsx from "clsx";
import EntityList from "../components/schema/EntityList";
import EntityDetail from "../components/schema/EntityDetail";
import EnumList from "../components/schema/EnumList";
import SchemaERD from "../components/schema/SchemaERD";

interface SchemaOverview {
  version: string;
  generatedAt: string;
  summary: {
    entityCount: number;
    enumCount: number;
    relationshipCount: number;
  };
  entities: string[];
  enums: string[];
  endpoints: Record<string, string>;
}

type ViewMode = "entities" | "enums" | "erd";

export default function SchemaPage() {
  const [overview, setOverview] = useState<SchemaOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("entities");
  const [copied, setCopied] = useState(false);

  // Fetch schema overview
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schema");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const json = await response.json();
      // Unwrap API response wrapper { success: true, data: {...} }
      const data = json.data ?? json;
      setOverview(data);
      // Auto-select first entity if available
      if (data.entities?.length > 0 && !selectedEntity) {
        setSelectedEntity(data.entities[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch schema");
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  useEffect(() => {
    fetchOverview();
  }, []);

  // Filter entities by search term
  const filteredEntities =
    overview?.entities?.filter((e) =>
      e.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [];

  // Filter enums by search term
  const filteredEnums =
    overview?.enums?.filter((e) =>
      e.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [];

  // Export full schema
  const handleExport = async () => {
    try {
      const response = await fetch("/api/schema/full");
      const json = await response.json();
      const data = json.data ?? json;
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schema-${overview?.version || "export"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export schema:", err);
    }
  };

  // Copy API endpoint
  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/api/schema/entities/${selectedEntity}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading schema registry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchOverview}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Data Model</h1>
          <span className="text-sm text-gray-500 ml-2">
            v{overview?.version}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{overview?.summary?.entityCount ?? 0} entities</span>
            <span>{overview?.summary?.enumCount ?? 0} enums</span>
            <span>
              {overview?.summary?.relationshipCount ?? 0} relationships
            </span>
          </div>
          {/* Export button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            title="Export full schema as JSON"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {/* Refresh button */}
          <button
            onClick={fetchOverview}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            title="Refresh schema"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <div className="flex items-center bg-gray-100 rounded-md p-1">
          <button
            onClick={() => setViewMode("entities")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              viewMode === "entities"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <List className="w-4 h-4" />
            Entities
          </button>
          <button
            onClick={() => setViewMode("enums")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              viewMode === "enums"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <Hash className="w-4 h-4" />
            Enums
          </button>
          <button
            onClick={() => setViewMode("erd")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              viewMode === "erd"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <GitBranch className="w-4 h-4" />
            ERD
          </button>
        </div>

        {/* Search */}
        {viewMode !== "erd" && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${viewMode}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      {viewMode === "entities" && (
        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left Panel - Entity List */}
          <div className="w-72 flex-shrink-0">
            <EntityList
              entities={filteredEntities}
              selectedEntity={selectedEntity}
              onSelectEntity={setSelectedEntity}
            />
          </div>

          {/* Right Panel - Entity Detail */}
          <div className="flex-1 min-w-0">
            {selectedEntity ? (
              <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Entity Header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedEntity}
                  </h2>
                  <button
                    onClick={handleCopyEndpoint}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="Copy API endpoint"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    API
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <EntityDetail entityName={selectedEntity} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 bg-white rounded-lg border border-gray-200">
                Select an entity to view details
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "enums" && (
        <EnumList enums={filteredEnums} searchTerm={searchTerm} />
      )}

      {viewMode === "erd" && <SchemaERD />}
    </div>
  );
}
