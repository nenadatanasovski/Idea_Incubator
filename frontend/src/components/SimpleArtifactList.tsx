// =============================================================================
// SimpleArtifactList.tsx
// Simple artifact list for the unified idea page
// =============================================================================

import { useState } from "react";
import {
  FileText,
  FileCode,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { Artifact } from "../types/ideation";

interface SimpleArtifactListProps {
  artifacts: Artifact[];
  isLoading?: boolean;
}

export function SimpleArtifactList({
  artifacts,
  isLoading,
}: SimpleArtifactListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500">
        <FileText className="w-8 h-8 mb-2" />
        <p>No artifacts yet</p>
        <p className="text-sm text-gray-400">
          Documents will appear here as the idea develops
        </p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "code":
        return <FileCode className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="divide-y divide-gray-100">
      {artifacts.map((artifact) => (
        <div key={artifact.id} className="py-3">
          <button
            onClick={() => toggleExpand(artifact.id)}
            className="w-full flex items-center gap-2 text-left hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
          >
            {expandedId === artifact.id ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            {getIcon(artifact.type)}
            <span className="font-medium text-gray-900 flex-1 truncate">
              {artifact.title}
            </span>
            <span className="text-xs text-gray-400">{artifact.type}</span>
          </button>

          {expandedId === artifact.id && (
            <div className="mt-2 ml-6 p-3 bg-gray-50 rounded-lg text-sm">
              {artifact.type === "code" ? (
                <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto">
                  {typeof artifact.content === "string"
                    ? artifact.content
                    : JSON.stringify(artifact.content, null, 2)}
                </pre>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {typeof artifact.content === "string"
                    ? artifact.content
                    : JSON.stringify(artifact.content, null, 2)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
