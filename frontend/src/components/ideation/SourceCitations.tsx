// =============================================================================
// FILE: frontend/src/components/ideation/SourceCitations.tsx
// Source citations for web search results
// =============================================================================

import { useState } from "react";
import { Globe, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { SourceCitationsProps } from "../../types/ideation";

export function SourceCitations({ sources }: SourceCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  const visibleSources = isExpanded ? sources : sources.slice(0, 3);
  const hasMore = sources.length > 3;

  return (
    <div className="source-citations bg-gray-50 rounded-lg border border-gray-200 p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Sources</span>
          <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
            {sources.length}
          </span>
        </div>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Show {sources.length - 3} more{" "}
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visibleSources.map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 bg-white rounded border border-gray-100 hover:border-gray-300
                       transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-blue-600 truncate group-hover:underline">
                    {source.title}
                  </span>
                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {source.source}
                </p>
              </div>
            </div>
            {source.snippet && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {source.snippet}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

export default SourceCitations;
