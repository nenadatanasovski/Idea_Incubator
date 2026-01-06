// =============================================================================
// FILE: frontend/src/components/ideation/ArtifactPreview.tsx
// Preview component for viewing selected artifacts with metadata and actions
// =============================================================================

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Artifact, ArtifactType } from '../../types/ideation';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ArtifactPreviewProps {
  artifact: Artifact | null;
  onEdit?: (artifactId: string) => void;
  onDelete?: (artifactId: string) => void;
  onCopyRef?: (artifactId: string) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  isDeleting?: boolean;
  // Error state props (TEST-UI-014)
  error?: string | Error | null;
  onRetry?: () => void;
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24" data-testid="loading-spinner">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const SmallSpinner = ({ className = '' }: { className?: string }) => (
  <svg className={`w-4 h-4 animate-spin ${className}`} fill="none" viewBox="0 0 24 24" data-testid="save-progress">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get artifact type display name
 */
function getTypeDisplayName(type: ArtifactType): string {
  switch (type) {
    case 'code': return 'Code';
    case 'html': return 'HTML';
    case 'svg': return 'SVG';
    case 'mermaid': return 'Diagram';
    case 'react': return 'React';
    case 'text': return 'Text';
    case 'markdown': return 'Markdown';
    case 'research': return 'Research';
    case 'idea-summary': return 'Summary';
    case 'analysis': return 'Analysis';
    case 'comparison': return 'Comparison';
    default: return type;
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Extract filename from artifact title
 */
function extractFileName(title: string): string {
  if (title.includes('/')) {
    const parts = title.split('/');
    return parts[parts.length - 1];
  }
  return title;
}

// -----------------------------------------------------------------------------
// Confirmation Dialog Component
// -----------------------------------------------------------------------------

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      data-testid="confirm-dialog"
    >
      <div className="bg-white rounded-lg p-6 mx-4 max-w-sm shadow-xl">
        <h4 className="text-lg font-medium text-gray-900 mb-2">{title}</h4>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Markdown Renderer Component
// -----------------------------------------------------------------------------

interface MarkdownContentProps {
  content: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  return (
    <div className="prose dark:prose-invert prose-sm max-w-none p-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const inline = !match;
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ fontSize: '12px' }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({
  artifact,
  onEdit,
  onDelete,
  onCopyRef,
  isLoading = false,
  isSaving = false,
  isDeleting = false,
  // Error state props (TEST-UI-014)
  error = null,
  onRetry,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const handleEdit = useCallback(() => {
    if (artifact && onEdit) {
      onEdit(artifact.id);
    }
  }, [artifact, onEdit]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (artifact && onDelete) {
      onDelete(artifact.id);
    }
    setShowDeleteConfirm(false);
  }, [artifact, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleCopyRef = useCallback(async () => {
    if (!artifact) return;

    const fileName = extractFileName(artifact.title);
    const reference = `@[${fileName}]`;

    try {
      await navigator.clipboard.writeText(reference);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);

      if (onCopyRef) {
        onCopyRef(artifact.id);
      }
    } catch (err) {
      console.error('Failed to copy reference:', err);
    }
  }, [artifact, onCopyRef]);

  // Error state (TEST-UI-014)
  if (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    console.error('Artifact load error:', error);

    return (
      <div
        data-testid="artifact-preview"
        className="flex flex-col h-full bg-white dark:bg-gray-900"
      >
        <div
          data-testid="artifact-error"
          className="flex-1 flex items-center justify-center"
        >
          <div className="flex flex-col items-center max-w-md text-center p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Failed to load artifact
            </h3>
            <p
              data-testid="error-message"
              className="mt-1 text-xs text-gray-500 dark:text-gray-400"
            >
              {errorMessage}
            </p>
            {onRetry && (
              <button
                data-testid="btn-retry"
                onClick={onRetry}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="artifact-preview"
        className="flex flex-col h-full bg-white dark:bg-gray-900"
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Loading artifact...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!artifact) {
    return (
      <div
        data-testid="artifact-preview"
        className="flex flex-col h-full bg-white dark:bg-gray-900"
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <FileIcon />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No artifact selected
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Select an artifact from the table to preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get content as string
  const contentString = typeof artifact.content === 'string'
    ? artifact.content
    : JSON.stringify(artifact.content, null, 2);

  return (
    <div
      data-testid="artifact-preview"
      className="flex flex-col h-full bg-white dark:bg-gray-900"
    >
      {/* Header with metadata */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
            title={artifact.title}
          >
            {artifact.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="capitalize">{getTypeDisplayName(artifact.type)}</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span>Updated {formatDate(artifact.updatedAt || artifact.createdAt)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 ml-4">
          {/* Save progress indicator - shown when isSaving is true */}
          {isSaving && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-blue-600 dark:text-blue-400">
              <SmallSpinner className="text-blue-500" />
              <span className="text-xs font-medium">Saving...</span>
            </div>
          )}

          <button
            data-testid="btn-edit"
            onClick={handleEdit}
            disabled={isSaving || isDeleting}
            className={`p-2 rounded-lg transition-colors ${
              isSaving || isDeleting
                ? 'opacity-50 cursor-not-allowed text-gray-400'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            title="Edit artifact"
          >
            <EditIcon />
          </button>

          <button
            data-testid="btn-delete"
            onClick={handleDeleteClick}
            disabled={isSaving || isDeleting}
            className={`p-2 rounded-lg transition-colors ${
              isDeleting
                ? 'opacity-50 cursor-not-allowed'
                : isSaving
                ? 'opacity-50 cursor-not-allowed text-gray-400'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
            }`}
            title="Delete artifact"
          >
            {isDeleting ? <SmallSpinner className="text-red-500" /> : <TrashIcon />}
          </button>

          <button
            data-testid="btn-copy-ref"
            onClick={handleCopyRef}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
              copiedRef
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
            title="Copy @ref to clipboard"
          >
            {copiedRef ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium">Copied!</span>
              </>
            ) : (
              <>
                <LinkIcon />
                <span className="text-xs font-medium">Copy @ref</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content area with markdown rendering */}
      <div className="flex-1 overflow-auto">
        <MarkdownContent content={contentString} />
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Artifact?"
        message={`Are you sure you want to delete "${artifact.title}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default ArtifactPreview;
