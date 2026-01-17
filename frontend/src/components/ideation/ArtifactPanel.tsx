// =============================================================================
// FILE: frontend/src/components/ideation/ArtifactPanel.tsx
// Right side panel for displaying artifacts with tabs
// =============================================================================

import React, { useState, useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { Artifact, ArtifactPanelProps } from "../../types/ideation";
import { ArtifactRenderer } from "./ArtifactRenderer";

// Icon components
const CloseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const ExpandIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
    />
  </svg>
);

const CollapseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
    />
  </svg>
);

const CopyIcon = () => (
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
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const TrashIcon = () => (
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
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const EditIcon = () => (
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
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
);

// Artifact type icons
const getArtifactIcon = (type: string) => {
  switch (type) {
    case "code":
      return (
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
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      );
    case "research":
      return (
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case "mermaid":
      return (
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
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      );
    case "markdown":
    case "text":
      return (
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case "idea-summary":
    case "analysis":
      return (
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
    default:
      return (
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
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
  }
};

// Small pencil icon for tab rename
const TabEditIcon = () => (
  <svg
    className="w-3 h-3"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

// BlockNote WYSIWYG Markdown Editor
interface BlockNoteMarkdownEditorProps {
  content: string;
  onContentChange: (markdown: string) => void;
}

const BlockNoteMarkdownEditor: React.FC<BlockNoteMarkdownEditorProps> = ({
  content,
  onContentChange,
}) => {
  const [isReady, setIsReady] = useState(false);

  // Create editor instance
  const editor = useCreateBlockNote({
    initialContent: undefined, // Will be set via markdown
  });

  // Load initial markdown content
  useEffect(() => {
    const loadContent = async () => {
      if (editor && content) {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(content);
          editor.replaceBlocks(editor.document, blocks);
          setIsReady(true);
        } catch (err) {
          console.error("[BlockNote] Failed to parse markdown:", err);
          setIsReady(true);
        }
      } else {
        setIsReady(true);
      }
    };
    loadContent();
  }, [editor]); // Only run once when editor is created

  // Handle content changes - convert blocks back to markdown
  const handleChange = async () => {
    if (editor && isReady) {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        console.log("[BlockNote] Content changed, length:", markdown.length);
        onContentChange(markdown);
      } catch (err) {
        console.error("[BlockNote] Failed to convert to markdown:", err);
      }
    }
  };

  if (!editor) return null;

  return (
    <div className="h-full overflow-auto blocknote-editor">
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  );
};

// Tab component for artifact selection
interface ArtifactTabProps {
  artifact: Artifact;
  isSelected: boolean;
  onSelect: () => void;
  onRename?: (newTitle: string) => void;
}

const ArtifactTab: React.FC<ArtifactTabProps> = ({
  artifact,
  isSelected,
  onSelect,
  onRename,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(artifact.title);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update edited title when artifact title changes externally
  useEffect(() => {
    setEditedTitle(artifact.title);
  }, [artifact.title]);

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return; // Don't select while editing
    e.preventDefault();
    onSelect();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== artifact.title && onRename) {
      onRename(trimmed);
    } else {
      setEditedTitle(artifact.title); // Reset if empty or unchanged
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditedTitle(artifact.title);
      setIsEditing(false);
    }
  };

  const isUpdating = artifact.status === "updating";
  const isLoading = artifact.status === "loading";

  return (
    <div
      className={`
        relative flex items-center gap-2 px-3 py-2 text-sm rounded-t-lg border-b-2 transition-all duration-150
        cursor-pointer flex-shrink-0 select-none group
        ${
          isSelected
            ? "bg-white border-blue-500 text-gray-900 font-medium shadow-sm z-10"
            : "bg-transparent border-transparent text-blue-600 hover:bg-gray-100"
        }
        ${isUpdating ? "animate-pulse bg-blue-50" : ""}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="flex-shrink-0">
        {isLoading || isUpdating ? (
          <LoadingSpinner />
        ) : (
          getArtifactIcon(artifact.type)
        )}
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-24 px-1 py-0.5 text-sm bg-white border border-blue-400 rounded outline-none focus:ring-1 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="truncate max-w-[100px]" title={artifact.title}>
            {isUpdating ? (
              <span className="text-blue-600 font-medium">Updating...</span>
            ) : (
              artifact.title
            )}
          </span>
          {/* Edit icon - show on hover */}
          {onRename && isHovered && !isUpdating && !isLoading && (
            <button
              type="button"
              onClick={handleEditClick}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              title="Rename artifact"
            >
              <TabEditIcon />
            </button>
          )}
        </>
      )}

      {artifact.status === "error" && (
        <span
          className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"
          title="Error"
        />
      )}
    </div>
  );
};

// Expand icon for minimized state
const ChevronLeftIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

// Main panel component
// Link icon for copying artifact reference
const LinkIcon = () => (
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
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({
  artifacts,
  currentArtifact,
  onSelectArtifact,
  onCloseArtifact,
  onExpandArtifact,
  onDeleteArtifact,
  onEditArtifact,
  onRenameArtifact,
  isLoading,
  isMinimized = false,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Reset edit mode when artifact changes
  useEffect(() => {
    setIsEditing(false);
    setEditedContent("");
  }, [currentArtifact?.id]);

  // Get content as string for editing
  const getContentAsString = (artifact: Artifact | null): string => {
    if (!artifact) return "";
    if (typeof artifact.content === "string") return artifact.content;
    return JSON.stringify(artifact.content, null, 2);
  };

  const handleStartEdit = () => {
    if (!currentArtifact) return;
    setEditedContent(getContentAsString(currentArtifact));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent("");
  };

  const handleSaveEdit = async () => {
    console.log("[ArtifactPanel] handleSaveEdit called");
    console.log("[ArtifactPanel] currentArtifact:", currentArtifact?.id);
    console.log("[ArtifactPanel] editedContent length:", editedContent.length);

    if (!currentArtifact || !onEditArtifact) {
      console.log("[ArtifactPanel] Early return - missing artifact or handler");
      return;
    }

    if (!editedContent) {
      console.log("[ArtifactPanel] No content to save!");
      return;
    }

    setIsSaving(true);
    try {
      console.log(
        "[ArtifactPanel] Calling onEditArtifact with content length:",
        editedContent.length,
      );
      await onEditArtifact(currentArtifact.id, editedContent);
      console.log("[ArtifactPanel] Save successful!");
      setIsEditing(false);
      setEditedContent("");
    } catch (error) {
      console.error("[ArtifactPanel] Failed to save edit:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!currentArtifact || !onDeleteArtifact) return;
    onDeleteArtifact(currentArtifact.id);
    setShowDeleteConfirm(false);
  };

  const handleCopy = async () => {
    if (!currentArtifact) return;
    const content =
      typeof currentArtifact.content === "string"
        ? currentArtifact.content
        : JSON.stringify(currentArtifact.content, null, 2);

    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyId = async () => {
    if (!currentArtifact) return;
    const reference = `@artifact:${currentArtifact.id}`;
    await navigator.clipboard.writeText(reference);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (artifacts.length === 0) {
    return null;
  }

  // Minimized view - thin vertical strip
  if (isMinimized) {
    return (
      <div className="flex flex-col items-center w-10 h-full bg-gray-100 border-l border-gray-200">
        <button
          onClick={onExpandArtifact}
          className="flex flex-col items-center gap-2 py-4 px-2 hover:bg-gray-200 transition-colors w-full"
          title="Expand artifacts panel"
        >
          <ChevronLeftIcon />
          <span
            className="text-xs text-gray-500 writing-mode-vertical transform rotate-180"
            style={{ writingMode: "vertical-rl" }}
          >
            Artifacts ({artifacts.length})
          </span>
        </button>
        {/* Artifact type indicators */}
        <div className="flex flex-col items-center gap-2 mt-2 px-2">
          {artifacts.slice(0, 5).map((artifact) => (
            <button
              key={artifact.id}
              onClick={onExpandArtifact}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
              title={artifact.title}
            >
              {artifact.status === "loading" ? (
                <LoadingSpinner />
              ) : (
                getArtifactIcon(artifact.type)
              )}
            </button>
          ))}
          {artifacts.length > 5 && (
            <span className="text-xs text-gray-400">
              +{artifacts.length - 5}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        flex flex-col bg-white border-l border-gray-200 relative
        ${isFullscreen ? "fixed inset-0 z-50" : "w-[450px] h-full"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">
          Artifacts ({artifacts.length})
        </h3>
        <div className="flex items-center gap-2">
          {currentArtifact && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title={copied ? "Copied!" : "Copy content"}
            >
              {copied ? (
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <CopyIcon />
              )}
            </button>
          )}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
          </button>
          <button
            onClick={onCloseArtifact}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="Close panel"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto px-2 pt-2 pb-0 gap-1 bg-gray-50 border-b border-gray-200 relative z-10">
        {artifacts.map((artifact, index) => {
          console.log(
            `[ArtifactPanel] Rendering tab ${index}:`,
            artifact.id,
            "currentArtifact:",
            currentArtifact?.id,
          );
          return (
            <ArtifactTab
              key={artifact.id}
              artifact={artifact}
              isSelected={currentArtifact?.id === artifact.id}
              onSelect={() => {
                console.log(
                  "[ArtifactPanel] Tab onSelect called for:",
                  artifact.id,
                  artifact.title,
                );
                onSelectArtifact(artifact);
              }}
              onRename={
                onRenameArtifact
                  ? (newTitle) => onRenameArtifact(artifact.id, newTitle)
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner />
              <span className="text-sm text-gray-500">Loading artifact...</span>
            </div>
          </div>
        ) : currentArtifact ? (
          isEditing ? (
            <BlockNoteMarkdownEditor
              content={editedContent}
              onContentChange={(markdown) => {
                setEditedContent(markdown);
              }}
            />
          ) : (
            <ArtifactRenderer
              artifact={currentArtifact}
              isFullscreen={isFullscreen}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select an artifact to view
          </div>
        )}
      </div>

      {/* Footer with artifact info */}
      {currentArtifact && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-2">
              {getArtifactIcon(currentArtifact.type)}
              <span className="capitalize">{currentArtifact.type}</span>
              {currentArtifact.language && (
                <>
                  <span className="text-gray-300">•</span>
                  <span>{currentArtifact.language}</span>
                </>
              )}
            </span>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <LoadingSpinner />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                </>
              ) : (
                <>
                  {onEditArtifact && (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit artifact"
                    >
                      <EditIcon />
                    </button>
                  )}
                  {onDeleteArtifact && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete artifact"
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <button
                    onClick={handleCopyId}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-200 transition-colors group"
                    title="Copy artifact reference to use in messages"
                  >
                    {copiedId ? (
                      <>
                        <svg
                          className="w-3.5 h-3.5 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-green-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon />
                        <span className="font-mono text-blue-500 group-hover:text-blue-400">
                          @{currentArtifact.id.slice(0, 8)}
                        </span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-4 max-w-sm shadow-xl">
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Delete Artifact?
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete "{currentArtifact?.title}"? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactPanel;
