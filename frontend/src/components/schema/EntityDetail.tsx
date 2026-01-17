/**
 * EntityDetail - Shows detailed entity schema information
 */

import { useState, useEffect } from "react";
import {
  Key,
  Link2,
  Loader2,
  FileCode,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import clsx from "clsx";

interface ForeignKey {
  column: string;
  references: {
    table: string;
    column: string;
  };
}

interface Relationship {
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  through?: string;
}

interface JsonSchemaProperty {
  type?: string | string[];
  enum?: string[];
  description?: string;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface EntitySchema {
  name: string;
  table: string;
  description: string;
  file: string;
  primaryKey: string;
  foreignKeys: ForeignKey[];
  relationships: Relationship[];
  schemas: {
    select: { definitions?: Record<string, JsonSchema> } & JsonSchema;
    insert: { definitions?: Record<string, JsonSchema> } & JsonSchema;
  };
}

interface EntityDetailProps {
  entityName: string;
}

export default function EntityDetail({ entityName }: EntityDetailProps) {
  const [entity, setEntity] = useState<EntitySchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["columns", "foreignKeys"]),
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch entity details
  useEffect(() => {
    async function fetchEntity() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/schema/entities/${encodeURIComponent(entityName)}`,
        );
        if (!response.ok) {
          throw new Error(`Entity not found: ${entityName}`);
        }
        const json = await response.json();
        const data = json.data ?? json;
        setEntity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch entity");
      } finally {
        setLoading(false);
      }
    }
    fetchEntity();
  }, [entityName]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const copyFieldName = (field: string) => {
    navigator.clipboard.writeText(field);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string | string[] | undefined) => {
    const typeStr = Array.isArray(type) ? type[0] : type;
    switch (typeStr) {
      case "string":
        return "bg-green-100 text-green-800";
      case "integer":
      case "number":
        return "bg-blue-100 text-blue-800";
      case "boolean":
        return "bg-yellow-100 text-yellow-800";
      case "array":
        return "bg-purple-100 text-purple-800";
      case "object":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Extract properties from JSON Schema
  const getSchemaProperties = (
    schema: EntitySchema["schemas"]["select"],
  ): Record<string, JsonSchemaProperty> => {
    // Handle nested definitions structure from zod-to-json-schema
    if (schema.definitions) {
      const defKey = Object.keys(schema.definitions)[0];
      if (defKey && schema.definitions[defKey]?.properties) {
        return schema.definitions[defKey].properties;
      }
    }
    return schema.properties || {};
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading entity...</span>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error || "Entity not found"}
      </div>
    );
  }

  const selectProperties = getSchemaProperties(entity.schemas.select);
  const insertProperties = getSchemaProperties(entity.schemas.insert);

  return (
    <div className="p-4 space-y-4">
      {/* Entity Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
            {entity.table}
          </span>
          <span className="text-gray-400">|</span>
          <span className="flex items-center gap-1">
            <Key className="w-3.5 h-3.5 text-yellow-500" />
            {entity.primaryKey}
          </span>
        </div>
        {entity.description && (
          <p className="text-sm text-gray-600">{entity.description}</p>
        )}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <FileCode className="w-3.5 h-3.5" />
          {entity.file}
        </div>
      </div>

      {/* Columns Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("columns")}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="font-medium text-gray-700">
            Columns ({Object.keys(selectProperties).length})
          </span>
          {expandedSections.has("columns") ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expandedSections.has("columns") && (
          <div className="divide-y divide-gray-100">
            {Object.entries(selectProperties).map(([name, prop]) => {
              const isRequired =
                entity.schemas.select.required?.includes(name) ||
                (entity.schemas.select.definitions &&
                  Object.values(
                    entity.schemas.select.definitions,
                  )[0]?.required?.includes(name));
              const isForeignKey = entity.foreignKeys.some(
                (fk) => fk.column === name,
              );
              const isPrimaryKey = name === entity.primaryKey || name === "id";

              return (
                <div
                  key={name}
                  className="px-3 py-2 hover:bg-gray-50 group flex items-start gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isPrimaryKey && (
                      <span title="Primary Key">
                        <Key className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                      </span>
                    )}
                    {isForeignKey && !isPrimaryKey && (
                      <span title="Foreign Key">
                        <Link2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      </span>
                    )}
                    {!isPrimaryKey && !isForeignKey && (
                      <span className="w-3.5 flex-shrink-0" />
                    )}
                    <span className="font-mono text-sm text-gray-800 truncate">
                      {name}
                    </span>
                    {!isRequired && (
                      <span className="text-xs text-gray-400">(optional)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={clsx(
                        "px-1.5 py-0.5 rounded text-xs font-medium",
                        getTypeBadgeColor(prop.type),
                      )}
                    >
                      {Array.isArray(prop.type)
                        ? prop.type.join(" | ")
                        : prop.type}
                    </span>
                    {prop.enum && (
                      <span
                        className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded"
                        title={prop.enum.join(", ")}
                      >
                        enum[{prop.enum.length}]
                      </span>
                    )}
                    <button
                      onClick={() => copyFieldName(name)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                      title="Copy field name"
                    >
                      {copiedField === name ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Foreign Keys Section */}
      {entity.foreignKeys.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("foreignKeys")}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-700">
              Foreign Keys ({entity.foreignKeys.length})
            </span>
            {expandedSections.has("foreignKeys") ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.has("foreignKeys") && (
            <div className="divide-y divide-gray-100">
              {entity.foreignKeys.map((fk) => (
                <div
                  key={fk.column}
                  className="px-3 py-2 flex items-center gap-2 text-sm"
                >
                  <Link2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-mono text-gray-700">{fk.column}</span>
                  <span className="text-gray-400">-&gt;</span>
                  <span className="font-mono text-primary-600">
                    {fk.references.table}.{fk.references.column}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Relationships Section */}
      {entity.relationships.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("relationships")}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="font-medium text-gray-700">
              Relationships ({entity.relationships.length})
            </span>
            {expandedSections.has("relationships") ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.has("relationships") && (
            <div className="divide-y divide-gray-100">
              {entity.relationships.map((rel, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 flex items-center gap-2 text-sm"
                >
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-xs font-medium",
                      rel.type === "one-to-one"
                        ? "bg-green-100 text-green-700"
                        : rel.type === "one-to-many"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700",
                    )}
                  >
                    {rel.type}
                  </span>
                  <span className="font-mono text-gray-700">{rel.from}</span>
                  <span className="text-gray-400">-&gt;</span>
                  <span className="font-mono text-primary-600">{rel.to}</span>
                  {rel.through && (
                    <span className="text-xs text-gray-400">
                      (via {rel.through})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insert Schema Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection("insertSchema")}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="font-medium text-gray-700">
            Insert Schema (for validation)
          </span>
          {expandedSections.has("insertSchema") ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expandedSections.has("insertSchema") && (
          <div className="p-3">
            <div className="text-xs text-gray-500 mb-2">
              Required fields:{" "}
              {(
                entity.schemas.insert.required ||
                (entity.schemas.insert.definitions &&
                  Object.values(entity.schemas.insert.definitions)[0]
                    ?.required) ||
                []
              )
                .slice(0, 10)
                .join(", ")}
              {(
                entity.schemas.insert.required ||
                (entity.schemas.insert.definitions &&
                  Object.values(entity.schemas.insert.definitions)[0]
                    ?.required) ||
                []
              ).length > 10 && "..."}
            </div>
            <div className="divide-y divide-gray-100">
              {Object.entries(insertProperties)
                .slice(0, 15)
                .map(([name, prop]) => (
                  <div key={name} className="py-1.5 flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-700">
                      {name}
                    </span>
                    {prop.default !== undefined && (
                      <span className="text-xs text-gray-400">
                        default: {JSON.stringify(prop.default)}
                      </span>
                    )}
                    {prop.minLength !== undefined && (
                      <span className="text-xs text-gray-400">
                        min: {prop.minLength}
                      </span>
                    )}
                    {prop.maxLength !== undefined && (
                      <span className="text-xs text-gray-400">
                        max: {prop.maxLength}
                      </span>
                    )}
                  </div>
                ))}
              {Object.keys(insertProperties).length > 15 && (
                <div className="py-1.5 text-xs text-gray-400">
                  ... and {Object.keys(insertProperties).length - 15} more
                  fields
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
