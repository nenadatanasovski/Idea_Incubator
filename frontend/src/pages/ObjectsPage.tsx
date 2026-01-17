import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Database,
  Table2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  Key,
  Hash,
  GitBranch,
  LayoutGrid,
} from "lucide-react";
import clsx from "clsx";
import TableERD from "../components/observability/TableERD";
import FullERDModal from "../components/observability/FullERDModal";

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  defaultValue?: string | null;
}

interface TableSchema {
  name: string;
  columns: Column[];
  rowCount: number;
}

interface TableData {
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  columns: { name: string; type: string }[];
}

export default function ObjectsPage() {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
  const [showSchema, setShowSchema] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "erd">("table");
  const [showFullERD, setShowFullERD] = useState(false);
  const pageSize = 50;

  // Fetch all tables
  useEffect(() => {
    async function fetchTables() {
      try {
        const response = await fetch("/api/objects/tables");
        const result = await response.json();
        if (result.success) {
          setTables(result.data.tables);
          // Auto-select first table if available
          if (result.data.tables.length > 0 && !selectedTable) {
            setSelectedTable(result.data.tables[0].name);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tables:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTables();
  }, []);

  // Fetch table data when selection changes
  const fetchTableData = useCallback(async () => {
    if (!selectedTable) return;

    setDataLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString(),
      });
      if (searchTerm) params.set("search", searchTerm);
      if (sortColumn) {
        params.set("sortColumn", sortColumn);
        params.set("sortDirection", sortDirection);
      }

      const response = await fetch(
        `/api/objects/tables/${encodeURIComponent(selectedTable)}/rows?${params}`,
      );
      const result = await response.json();
      if (result.success) {
        setTableData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch table data:", error);
    } finally {
      setDataLoading(false);
    }
  }, [selectedTable, currentPage, searchTerm, sortColumn, sortDirection]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  // Reset page when table or search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [selectedTable, searchTerm]);

  // Filter tables by search
  const filteredTables = tables.filter((table) =>
    table.name.toLowerCase().includes(tableSearch.toLowerCase()),
  );

  // Get selected table schema
  const selectedTableSchema = tables.find((t) => t.name === selectedTable);

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"));
    } else {
      setSortColumn(column);
      setSortDirection("ASC");
    }
  };

  // Format cell value for display
  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "NULL";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    const strValue = String(value);
    if (strValue.length > 100) {
      return strValue.substring(0, 100) + "...";
    }
    return strValue;
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    const upperType = type.toUpperCase();
    if (
      upperType.includes("INT") ||
      upperType.includes("NUM") ||
      upperType.includes("REAL")
    ) {
      return "bg-blue-100 text-blue-800";
    }
    if (
      upperType.includes("TEXT") ||
      upperType.includes("VARCHAR") ||
      upperType.includes("CHAR")
    ) {
      return "bg-green-100 text-green-800";
    }
    if (upperType.includes("BLOB")) {
      return "bg-purple-100 text-purple-800";
    }
    if (upperType.includes("DATE") || upperType.includes("TIME")) {
      return "bg-orange-100 text-orange-800";
    }
    if (upperType.includes("BOOL")) {
      return "bg-yellow-100 text-yellow-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading database schema...</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Database Objects</h1>
          <span className="text-sm text-gray-500 ml-2">
            {tables.length} tables
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left Panel - Table List */}
        <div className="w-64 flex-shrink-0 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Table Search */}
          <div className="p-3 border-b border-gray-200 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tables..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={clsx(
                  "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 transition-colors",
                  selectedTable === table.name
                    ? "bg-primary-50 text-primary-700 border-l-2 border-primary-500"
                    : "text-gray-700",
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Table2 className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{table.name}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {table.rowCount.toLocaleString()}
                </span>
              </button>
            ))}
            {filteredTables.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No tables match "{tableSearch}"
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Table Data */}
        <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden min-w-0">
          {selectedTable ? (
            <>
              {/* Table Header */}
              <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedTable}
                  </h2>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-gray-100 rounded-md p-0.5 ml-2">
                    <button
                      onClick={() => setViewMode("table")}
                      className={clsx(
                        "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                        viewMode === "table"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700",
                      )}
                      title="Table view"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Table
                    </button>
                    <button
                      onClick={() => setViewMode("erd")}
                      className={clsx(
                        "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                        viewMode === "erd"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700",
                      )}
                      title="ERD view"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      ERD
                    </button>
                  </div>

                  {viewMode === "table" && (
                    <button
                      onClick={() => setShowSchema(!showSchema)}
                      className={clsx(
                        "p-1.5 rounded-md transition-colors",
                        showSchema
                          ? "bg-primary-100 text-primary-700"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
                      )}
                      title="Toggle schema view"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Data Search - only show in table view */}
                {viewMode === "table" && (
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search in table..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Stats */}
                <div className="text-sm text-gray-500 flex-shrink-0">
                  {viewMode === "table" && tableData && (
                    <span>
                      {tableData.total.toLocaleString()} rows
                      {searchTerm && ` (filtered)`}
                    </span>
                  )}
                </div>
              </div>

              {/* Table View Content */}
              {viewMode === "table" && (
                <>
                  {/* Schema Panel (collapsible) */}
                  {showSchema && selectedTableSchema && (
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Schema ({selectedTableSchema.columns.length} columns)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedTableSchema.columns.map((col) => (
                          <div
                            key={col.name}
                            className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-gray-200 text-xs"
                          >
                            {col.primaryKey && (
                              <span title="Primary Key">
                                <Key className="w-3 h-3 text-yellow-500" />
                              </span>
                            )}
                            <span className="font-medium text-gray-700">
                              {col.name}
                            </span>
                            <span
                              className={clsx(
                                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                getTypeBadgeColor(col.type),
                              )}
                            >
                              {col.type || "TEXT"}
                            </span>
                            {col.nullable === false && (
                              <span className="text-red-500" title="NOT NULL">
                                *
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Data Table */}
                  <div className="flex-1 overflow-auto min-h-0">
                    {dataLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                        <span className="ml-2 text-gray-600">
                          Loading data...
                        </span>
                      </div>
                    ) : tableData && tableData.rows.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              <Hash className="w-3 h-3 inline" />
                            </th>
                            {tableData.columns.map((col) => (
                              <th
                                key={col.name}
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort(col.name)}
                              >
                                <div className="flex items-center gap-1">
                                  <span>{col.name}</span>
                                  <ArrowUpDown
                                    className={clsx(
                                      "w-3 h-3",
                                      sortColumn === col.name
                                        ? "text-primary-600"
                                        : "text-gray-400",
                                    )}
                                  />
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {tableData.rows.map((row, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                                {currentPage * pageSize + idx + 1}
                              </td>
                              {tableData.columns.map((col) => (
                                <td
                                  key={col.name}
                                  className="px-3 py-2 whitespace-nowrap text-gray-700 max-w-xs truncate"
                                  title={String(row[col.name] ?? "")}
                                >
                                  {row[col.name] === null ? (
                                    <span className="text-gray-400 italic">
                                      NULL
                                    </span>
                                  ) : (
                                    formatCellValue(row[col.name])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        {searchTerm
                          ? `No rows match "${searchTerm}"`
                          : "No data in this table"}
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  {tableData && tableData.total > pageSize && (
                    <div className="p-3 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
                      <div className="text-sm text-gray-500">
                        Showing {currentPage * pageSize + 1} to{" "}
                        {Math.min(
                          (currentPage + 1) * pageSize,
                          tableData.total,
                        )}{" "}
                        of {tableData.total.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setCurrentPage((p) => Math.max(0, p - 1))
                          }
                          disabled={currentPage === 0}
                          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {currentPage + 1} of {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(totalPages - 1, p + 1),
                            )
                          }
                          disabled={currentPage >= totalPages - 1}
                          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ERD View Content */}
              {viewMode === "erd" && (
                <TableERD
                  tableName={selectedTable}
                  onShowFullERD={() => setShowFullERD(true)}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a table to view its data
            </div>
          )}
        </div>
      </div>

      {/* Full ERD Modal */}
      {selectedTable && (
        <FullERDModal
          tableName={selectedTable}
          isOpen={showFullERD}
          onClose={() => setShowFullERD(false)}
        />
      )}
    </div>
  );
}
