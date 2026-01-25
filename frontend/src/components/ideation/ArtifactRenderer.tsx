// =============================================================================
// FILE: frontend/src/components/ideation/ArtifactRenderer.tsx
// Renders artifacts based on their type
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type {
  ArtifactRendererProps,
  ResearchResult,
  SynthesizedResearch,
} from "../../types/ideation";

// Mermaid is loaded dynamically to avoid Vite bundling issues with its lazy-loaded diagram types
let mermaidInstance: typeof import("mermaid").default | null = null;
let mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;

const getMermaid = async () => {
  if (mermaidInstance) return mermaidInstance;
  if (mermaidInitPromise) return mermaidInitPromise;

  mermaidInitPromise = import("mermaid").then((m) => {
    mermaidInstance = m.default;
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    });
    return mermaidInstance;
  });

  return mermaidInitPromise;
};

// Code artifact renderer
const CodeArtifact: React.FC<{ content: string; language?: string }> = ({
  content,
  language,
}) => {
  return (
    <div className="h-full overflow-auto">
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          minHeight: "100%",
          fontSize: "13px",
        }}
        showLineNumbers
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

// Mermaid diagram renderer
const MermaidArtifact: React.FC<{ content: string; id: string }> = ({
  content,
  id,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    const renderDiagram = async () => {
      if (!containerRef.current) return;

      try {
        const mermaid = await getMermaid();

        // Clean the content
        const cleanedContent = content
          .trim()
          .replace(/^```mermaid\s*/i, "")
          .replace(/```\s*$/, "")
          .trim();

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${id}`,
          cleanedContent,
        );
        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to render diagram",
        );
      }
    };

    renderDiagram();
  }, [content, id]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600">
        <p className="font-medium">Diagram Error</p>
        <p className="text-sm mt-1">{error}</p>
        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center p-4 bg-white min-h-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// HTML artifact renderer (sandboxed)
const HtmlArtifact: React.FC<{ content: string }> = ({ content }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
              </style>
            </head>
            <body>${content}</body>
          </html>
        `);
        doc.close();
      }
    }
  }, [content]);

  return (
    <iframe
      ref={iframeRef}
      title="HTML Preview"
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white"
    />
  );
};

// SVG artifact renderer
const SvgArtifact: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div
      className="flex items-center justify-center p-4 bg-white min-h-full"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

// Markdown artifact renderer
const MarkdownArtifact: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="p-4 prose prose-sm max-w-none prose-gray prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const inline = !match;
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{ fontSize: "12px" }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
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

// Research artifact renderer - displays synthesized research with sources
const ResearchArtifact: React.FC<{
  content: ResearchResult[] | SynthesizedResearch;
  queries: string[];
}> = ({ content, queries }) => {
  const [showSources, setShowSources] = useState(false);

  // Handle both old format (array) and new synthesized format (object)
  const isSynthesized =
    content && !Array.isArray(content) && "synthesis" in content;
  const synthesis = isSynthesized
    ? (content as SynthesizedResearch).synthesis
    : null;
  const sources = isSynthesized
    ? (content as SynthesizedResearch).sources
    : (content as ResearchResult[]);

  // Group sources by query for display
  const groupedSources: Record<string, ResearchResult[]> = {};
  (sources || []).forEach((result) => {
    const query = result.query || "General";
    if (!groupedSources[query]) {
      groupedSources[query] = [];
    }
    groupedSources[query].push(result);
  });

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {/* Query tags */}
      <div className="flex flex-wrap gap-2">
        {queries.map((query, idx) => (
          <span
            key={idx}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
          >
            {query}
          </span>
        ))}
      </div>

      {/* Synthesized content (new format) */}
      {synthesis && (
        <div className="prose prose-sm max-w-none prose-gray prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const inline = !match;
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ fontSize: "12px" }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code
                    className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              // Style links to look like citations
              a({ node, href, children, ...props }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {synthesis}
          </ReactMarkdown>
        </div>
      )}

      {/* Sources section */}
      {sources && sources.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showSources ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Sources ({sources.length})
          </button>

          {showSources && (
            <div className="mt-4 space-y-4">
              {Object.entries(groupedSources).map(([query, queryResults]) => (
                <div key={query} className="space-y-2">
                  <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {query}
                  </h5>
                  <div className="space-y-2">
                    {queryResults.map((result, idx) => (
                      <a
                        key={idx}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors bg-gray-50"
                      >
                        <h6 className="text-sm font-medium text-blue-600 hover:underline">
                          {result.title}
                        </h6>
                        <p className="text-xs text-gray-500 mt-1">
                          {result.source}
                        </p>
                        {result.snippet && (
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                            {result.snippet}
                          </p>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback for old format without synthesis */}
      {!synthesis && sources && sources.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No research results available
        </div>
      )}
    </div>
  );
};

// Idea summary artifact renderer
const IdeaSummaryArtifact: React.FC<{ content: string | object }> = ({
  content,
}) => {
  if (typeof content === "string") {
    return <MarkdownArtifact content={content} />;
  }

  // Render structured idea summary
  const summary = content as {
    title?: string;
    problem?: string;
    solution?: string;
    targetMarket?: string;
    uniqueValue?: string;
    keyRisks?: string[];
    nextSteps?: string[];
  };

  return (
    <div className="p-4 space-y-4">
      {summary.title && (
        <h3 className="text-lg font-semibold text-gray-900">{summary.title}</h3>
      )}

      {summary.problem && (
        <div>
          <h4 className="text-sm font-medium text-gray-500">Problem</h4>
          <p className="mt-1 text-gray-700">{summary.problem}</p>
        </div>
      )}

      {summary.solution && (
        <div>
          <h4 className="text-sm font-medium text-gray-500">Solution</h4>
          <p className="mt-1 text-gray-700">{summary.solution}</p>
        </div>
      )}

      {summary.targetMarket && (
        <div>
          <h4 className="text-sm font-medium text-gray-500">Target Market</h4>
          <p className="mt-1 text-gray-700">{summary.targetMarket}</p>
        </div>
      )}

      {summary.uniqueValue && (
        <div>
          <h4 className="text-sm font-medium text-gray-500">Unique Value</h4>
          <p className="mt-1 text-gray-700">{summary.uniqueValue}</p>
        </div>
      )}

      {summary.keyRisks && summary.keyRisks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500">Key Risks</h4>
          <ul className="mt-1 list-disc list-inside text-gray-700">
            {summary.keyRisks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.nextSteps && summary.nextSteps.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500">Next Steps</h4>
          <ul className="mt-1 list-disc list-inside text-gray-700">
            {summary.nextSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Error renderer
const ErrorArtifact: React.FC<{ error: string }> = ({ error }) => {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-600"
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
        <p className="text-gray-600">{error}</p>
      </div>
    </div>
  );
};

// Loading renderer
const LoadingArtifact: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="w-8 h-8 animate-spin text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
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
        <span className="text-sm text-gray-500">Generating artifact...</span>
      </div>
    </div>
  );
};

// Main renderer component
export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({
  artifact,
  isFullscreen: _isFullscreen,
}) => {
  // Handle loading state
  if (artifact.status === "loading") {
    return <LoadingArtifact />;
  }

  // Handle error state
  if (artifact.status === "error" && artifact.error) {
    return <ErrorArtifact error={artifact.error} />;
  }

  // Render based on artifact type
  switch (artifact.type) {
    case "code":
      return (
        <CodeArtifact
          content={
            typeof artifact.content === "string"
              ? artifact.content
              : JSON.stringify(artifact.content, null, 2)
          }
          language={artifact.language}
        />
      );

    case "mermaid":
      return (
        <MermaidArtifact
          content={typeof artifact.content === "string" ? artifact.content : ""}
          id={artifact.id}
        />
      );

    case "html":
      return (
        <HtmlArtifact
          content={typeof artifact.content === "string" ? artifact.content : ""}
        />
      );

    case "svg":
      return (
        <SvgArtifact
          content={typeof artifact.content === "string" ? artifact.content : ""}
        />
      );

    case "markdown":
    case "text":
      return (
        <MarkdownArtifact
          content={
            typeof artifact.content === "string"
              ? artifact.content
              : JSON.stringify(artifact.content, null, 2)
          }
        />
      );

    case "research":
      return (
        <ResearchArtifact
          content={artifact.content as ResearchResult[] | SynthesizedResearch}
          queries={artifact.queries || []}
        />
      );

    case "idea-summary":
    case "analysis":
    case "comparison":
      return <IdeaSummaryArtifact content={artifact.content} />;

    case "spec":
      // Spec artifacts show a summary view - full editing is in SpecPanel
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-blue-600">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="font-medium">Specification</span>
          </div>
          <MarkdownArtifact
            content={
              typeof artifact.content === "string"
                ? artifact.content
                : JSON.stringify(artifact.content, null, 2)
            }
          />
        </div>
      );

    case "react":
      // For React components, show the code with syntax highlighting
      return (
        <CodeArtifact
          content={
            typeof artifact.content === "string"
              ? artifact.content
              : JSON.stringify(artifact.content, null, 2)
          }
          language="jsx"
        />
      );

    default:
      // Default to markdown/text rendering
      return (
        <MarkdownArtifact
          content={
            typeof artifact.content === "string"
              ? artifact.content
              : JSON.stringify(artifact.content, null, 2)
          }
        />
      );
  }
};

export default ArtifactRenderer;
