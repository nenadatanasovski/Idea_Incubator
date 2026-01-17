/**
 * EntityList - Lists all schema entities with metadata
 */

import { useState, useEffect } from "react";
import { Table2, Key, Link2, Loader2 } from "lucide-react";
import clsx from "clsx";

interface EntityMetadata {
  key: string;
  name: string;
  table: string;
  description: string;
  file: string;
  primaryKey: string;
  foreignKeyCount: number;
}

interface EntityListProps {
  entities: string[];
  selectedEntity: string | null;
  onSelectEntity: (entity: string) => void;
}

export default function EntityList({
  entities,
  selectedEntity,
  onSelectEntity,
}: EntityListProps) {
  const [metadata, setMetadata] = useState<EntityMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch entity metadata
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const response = await fetch("/api/schema/entities");
        if (response.ok) {
          const json = await response.json();
          const data = json.data ?? json;
          setMetadata(data.entities || []);
        }
      } catch (err) {
        console.error("Failed to fetch entity metadata:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMetadata();
  }, []);

  // Get metadata for an entity
  const getEntityMetadata = (entityKey: string) =>
    metadata.find((m) => m.key === entityKey);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-lg border border-gray-200">
        <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-700">
          Entities ({entities.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No entities found
          </div>
        ) : (
          entities.map((entityKey) => {
            const meta = getEntityMetadata(entityKey);
            return (
              <button
                key={entityKey}
                onClick={() => onSelectEntity(entityKey)}
                className={clsx(
                  "w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0",
                  selectedEntity === entityKey
                    ? "bg-primary-50 border-l-2 border-l-primary-500"
                    : "",
                )}
              >
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span
                    className={clsx(
                      "font-medium truncate",
                      selectedEntity === entityKey
                        ? "text-primary-700"
                        : "text-gray-700",
                    )}
                  >
                    {meta?.name || entityKey}
                  </span>
                </div>
                {meta && (
                  <div className="mt-1 ml-6 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      {meta.primaryKey}
                    </span>
                    {meta.foreignKeyCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {meta.foreignKeyCount} FK
                      </span>
                    )}
                  </div>
                )}
                {meta?.description && (
                  <p className="mt-1 ml-6 text-xs text-gray-400 line-clamp-1">
                    {meta.description}
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
