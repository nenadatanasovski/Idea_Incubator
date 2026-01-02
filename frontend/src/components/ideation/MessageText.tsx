// =============================================================================
// FILE: frontend/src/components/ideation/MessageText.tsx
// Message text with full markdown rendering using ReactMarkdown
// =============================================================================

import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { MessageTextProps } from '../../types/ideation';

// Pre-process content to convert @artifact:id references to special links
const processArtifactReferences = (content: string): string => {
  // Match @artifact:id pattern (id can be alphanumeric with dashes)
  return content.replace(
    /@artifact:([a-zA-Z0-9_-]+)/g,
    '[📎 artifact:$1](artifact://$1)'
  );
};

export function MessageText({ content, isStreaming = false, onArtifactClick }: MessageTextProps) {
  // Process content to convert artifact references to links
  const processedContent = processArtifactReferences(content);

  const handleArtifactClick = useCallback((e: React.MouseEvent, artifactId: string) => {
    e.preventDefault();
    if (onArtifactClick) {
      onArtifactClick(artifactId);
    }
  }, [onArtifactClick]);

  return (
    <div className="message-text prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return (
                <code className="bg-gray-700 text-gray-100 px-1.5 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match ? match[1] : 'text'}
                PreTag="div"
                customStyle={{
                  margin: '0.5rem 0',
                  borderRadius: '0.375rem',
                  fontSize: '13px',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
          // Tables
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-gray-600 text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-gray-700">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-gray-600 px-3 py-2 text-left font-semibold text-gray-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-gray-600 px-3 py-2 text-gray-300">
                {children}
              </td>
            );
          },
          // Links - handle both regular and artifact links
          a({ href, children }) {
            // Check if this is an artifact link
            if (href?.startsWith('artifact://')) {
              const artifactId = href.replace('artifact://', '');
              return (
                <button
                  onClick={(e) => handleArtifactClick(e, artifactId)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 transition-colors text-sm font-mono cursor-pointer border-none"
                  title={`View artifact: ${artifactId}`}
                >
                  {children}
                </button>
              );
            }
            // Regular external link
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                {children}
              </a>
            );
          },
          // Headings
          h1({ children }) {
            return <h1 className="text-xl font-bold text-gray-100 mt-4 mb-2">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold text-gray-100 mt-3 mb-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold text-gray-200 mt-3 mb-1">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-sm font-semibold text-gray-200 mt-2 mb-1">{children}</h4>;
          },
          // Paragraphs
          p({ children }) {
            return <p className="text-gray-300 mb-2 last:mb-0">{children}</p>;
          },
          // Lists
          ul({ children }) {
            return <ul className="list-disc list-inside space-y-1 mb-2 text-gray-300">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-1 mb-2 text-gray-300">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-gray-300">{children}</li>;
          },
          // Horizontal rule
          hr() {
            return <hr className="border-gray-600 my-4" />;
          },
          // Blockquote
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-gray-500 pl-4 italic text-gray-400 my-2">
                {children}
              </blockquote>
            );
          },
          // Strong/bold
          strong({ children }) {
            return <strong className="font-semibold text-gray-100">{children}</strong>;
          },
          // Emphasis/italic
          em({ children }) {
            return <em className="italic text-gray-300">{children}</em>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
      )}
    </div>
  );
}

export default MessageText;
