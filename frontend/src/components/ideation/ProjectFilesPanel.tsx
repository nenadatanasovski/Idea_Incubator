// =============================================================================
// FILE: frontend/src/components/ideation/ProjectFilesPanel.tsx
// Project files panel showing file tree with folder expansion and file preview
// Part of: Phase 9 - Project Folder & Spec Output (T9.2)
// =============================================================================

import { memo, useState, useCallback, useEffect, useMemo } from "react";
import {
  FolderOpen,
  FolderClosed,
  File,
  FileText,
  FilePlus,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  X,
  Clock,
  Sparkles,
  Link,
  RefreshCw,
  Search,
} from "lucide-react";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  isGenerated?: boolean;
  hasBlockReferences?: boolean;
  blockReferenceCount?: number;
  children?: FileNode[];
}

export interface ProjectFilesPanelProps {
  userSlug: string;
  ideaSlug: string;
  isVisible?: boolean;
  onFileSelect?: (file: FileNode) => void;
  onCreateFile?: () => void;
  onFilesLoaded?: (count: number) => void;
  className?: string;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  expandedFolders: Set<string>;
  selectedPath: string | null;
  onToggleFolder: (path: string) => void;
  onSelectFile: (file: FileNode) => void;
}

function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getFileIcon(name: string): typeof File {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["md", "txt", "json", "yaml", "yml"].includes(ext || "")) {
    return FileText;
  }
  return File;
}

const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  expandedFolders,
  selectedPath,
  onToggleFolder,
  onSelectFile,
}: FileTreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const FileIcon =
    node.type === "directory"
      ? isExpanded
        ? FolderOpen
        : FolderClosed
      : getFileIcon(node.name);

  const handleClick = () => {
    if (node.type === "directory") {
      onToggleFolder(node.path);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm
          hover:bg-gray-100 rounded-md transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
          ${isSelected ? "bg-blue-50 text-blue-700" : "text-gray-700"}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse indicator for folders */}
        {node.type === "directory" && (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
          </span>
        )}

        {node.type === "file" && <span className="w-4" />}

        <FileIcon
          className={`w-4 h-4 flex-shrink-0 ${
            node.type === "directory" ? "text-yellow-500" : "text-gray-400"
          }`}
        />

        <span className="truncate flex-1">{node.name}</span>

        {/* Indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {node.isGenerated && (
            <span title="AI Generated">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            </span>
          )}
          {node.hasBlockReferences && (
            <span
              title={`${node.blockReferenceCount || 0} block references`}
              className="flex items-center gap-0.5 text-xs text-blue-600"
            >
              <Link className="w-3 h-3" />
              {node.blockReferenceCount || 0}
            </span>
          )}
          {node.size !== undefined && node.type === "file" && (
            <span className="text-xs text-gray-400">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
      </button>

      {/* Render children if expanded */}
      {node.type === "directory" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              selectedPath={selectedPath}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface FilePreviewModalProps {
  file: FileNode | null;
  content: string | null;
  isLoading: boolean;
  onClose: () => void;
  onOpenExternal?: (file: FileNode) => void;
}

const FilePreviewModal = memo(function FilePreviewModal({
  file,
  content,
  isLoading,
  onClose,
  onOpenExternal,
}: FilePreviewModalProps) {
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">{file.name}</span>
            {file.modifiedAt && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {formatDate(file.modifiedAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onOpenExternal && (
              <button
                onClick={() => onOpenExternal(file)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Open in external editor"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : content !== null ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {content}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Unable to preview this file
            </div>
          )}
        </div>

        {/* Footer with block references */}
        {file.hasBlockReferences && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Link className="w-4 h-4" />
              <span>
                This file references {file.blockReferenceCount || 0} memory
                blocks
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export const ProjectFilesPanel = memo(function ProjectFilesPanel({
  userSlug,
  ideaSlug,
  isVisible = true,
  onFileSelect,
  onCreateFile,
  onFilesLoaded,
  className = "",
}: ProjectFilesPanelProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch files when panel becomes visible
  useEffect(() => {
    if (!isVisible || !userSlug || !ideaSlug) return;

    const fetchFiles = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/ideation/ideas/${userSlug}/${ideaSlug}/files`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch files");
        }

        const data = await response.json();
        // API returns { success: true, data: { files: [...] } }
        const filesData = data.data?.files || data.files || [];
        setFiles(filesData);

        // Count total files (recursively)
        const countFiles = (nodes: FileNode[]): number => {
          return nodes.reduce((count, node) => {
            if (node.type === "file") return count + 1;
            if (node.children) return count + countFiles(node.children);
            return count;
          }, 0);
        };
        onFilesLoaded?.(countFiles(filesData));

        // Auto-expand root folders
        if (filesData.length > 0) {
          const rootPaths = filesData
            .filter((f: FileNode) => f.type === "directory")
            .map((f: FileNode) => f.path);
          setExpandedFolders(new Set(rootPaths));
        }
      } catch (err) {
        console.error("[ProjectFilesPanel] Error fetching files:", err);
        setError(err instanceof Error ? err.message : "Failed to load files");
        onFilesLoaded?.(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, [isVisible, userSlug, ideaSlug, onFilesLoaded]);

  // Handle folder toggle
  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle file selection
  const handleSelectFile = useCallback(
    (file: FileNode) => {
      setSelectedFile(file);
      onFileSelect?.(file);
    },
    [onFileSelect],
  );

  // Handle file preview (double-click or enter)
  const handlePreviewFile = useCallback(
    async (file: FileNode) => {
      if (file.type === "directory") return;

      setPreviewFile(file);
      setPreviewContent(null);
      setIsPreviewLoading(true);

      try {
        const response = await fetch(
          `/api/ideation/ideas/${userSlug}/${ideaSlug}/files/${encodeURIComponent(file.path)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch file content");
        }

        const data = await response.json();
        // API returns { success: true, data: { content: "..." } }
        setPreviewContent(data.data?.content || data.content || "");
      } catch (err) {
        console.error("[ProjectFilesPanel] Error fetching file:", err);
        setPreviewContent(null);
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [userSlug, ideaSlug],
  );

  // Close preview modal
  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewContent(null);
  }, []);

  // Refresh files
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ideation/ideas/${userSlug}/${ideaSlug}/files`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      // API returns { success: true, data: { files: [...] } }
      setFiles(data.data?.files || data.files || []);
    } catch (err) {
      console.error("[ProjectFilesPanel] Error refreshing files:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh files");
    } finally {
      setIsLoading(false);
    }
  }, [userSlug, ideaSlug]);

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;

    const query = searchQuery.toLowerCase();

    const filterNode = (node: FileNode): FileNode | null => {
      const nameMatches = node.name.toLowerCase().includes(query);

      if (node.type === "file") {
        return nameMatches ? node : null;
      }

      // For directories, filter children and include if any match
      const filteredChildren = node.children
        ?.map(filterNode)
        .filter((n): n is FileNode => n !== null);

      if (nameMatches || (filteredChildren && filteredChildren.length > 0)) {
        return { ...node, children: filteredChildren };
      }

      return null;
    };

    return files.map(filterNode).filter((n): n is FileNode => n !== null);
  }, [files, searchQuery]);

  // Calculate file stats
  const stats = useMemo(() => {
    const countFiles = (
      nodes: FileNode[],
    ): { files: number; generated: number } => {
      let files = 0;
      let generated = 0;
      for (const node of nodes) {
        if (node.type === "file") {
          files++;
          if (node.isGenerated) generated++;
        } else if (node.children) {
          const childStats = countFiles(node.children);
          files += childStats.files;
          generated += childStats.generated;
        }
      }
      return { files, generated };
    };
    return countFiles(files);
  }, [files]);

  if (!isVisible) return null;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-sm text-gray-700">
            Project Files
          </span>
          <span className="text-xs text-gray-400">
            {stats.files} files
            {stats.generated > 0 && ` (${stats.generated} generated)`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Refresh files"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          {onCreateFile && (
            <button
              onClick={onCreateFile}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="New file"
            >
              <FilePlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading && files.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <span className="text-red-500 text-sm">{error}</span>
            <button
              onClick={handleRefresh}
              className="mt-2 text-blue-600 text-sm hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-gray-500">
            {searchQuery ? (
              <>
                <Search className="w-8 h-8 mb-2 text-gray-300" />
                <span className="text-sm">
                  No files matching "{searchQuery}"
                </span>
              </>
            ) : (
              <>
                <FolderOpen className="w-8 h-8 mb-2 text-gray-300" />
                <span className="text-sm">No files in this project yet</span>
                {onCreateFile && (
                  <button
                    onClick={onCreateFile}
                    className="mt-2 text-blue-600 text-sm hover:underline"
                  >
                    Create your first file
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div
            onDoubleClick={() => {
              // Handle double-click on selected file to preview
              if (selectedFile && selectedFile.type === "file") {
                handlePreviewFile(selectedFile);
              }
            }}
          >
            {filteredFiles.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                expandedFolders={expandedFolders}
                selectedPath={selectedFile?.path || null}
                onToggleFolder={handleToggleFolder}
                onSelectFile={handleSelectFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected file info bar */}
      {selectedFile && selectedFile.type === "file" && (
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="truncate">{selectedFile.path}</span>
            <button
              onClick={() => handlePreviewFile(selectedFile)}
              className="text-blue-600 hover:text-blue-700 hover:underline flex-shrink-0 ml-2"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        content={previewContent}
        isLoading={isPreviewLoading}
        onClose={handleClosePreview}
      />
    </div>
  );
});

export default ProjectFilesPanel;
