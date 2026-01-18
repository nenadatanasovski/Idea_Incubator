/**
 * CrossReferencePanel - Display related entities with navigation links
 *
 * Shows cross-references for observability entities, enabling
 * quick navigation between related items.
 */

import { Link } from "react-router-dom";
import { Loader2, ExternalLink } from "lucide-react";
import { useCrossRefs } from "../../hooks/useObservability";
import { buildObservabilityUrl } from "../../utils/observability-urls";
import type { EntityType } from "../../types/observability";

interface CrossReferencePanelProps {
  entityType:
    | "task"
    | "toolUse"
    | "assertion"
    | "skillTrace"
    | "transcriptEntry";
  entityId: string;
  executionId: string;
}

// Map component entity types to API entity types
const entityTypeMap: Record<string, EntityType> = {
  task: "task",
  toolUse: "tool_use",
  assertion: "assertion",
  skillTrace: "skill_trace",
  transcriptEntry: "transcript",
};

// Map API entity types to URL path types
const urlTypeMap: Record<
  string,
  "task" | "tool" | "assertion" | "skill" | "transcript" | "execution"
> = {
  task: "task",
  tool_use: "tool",
  assertion: "assertion",
  skill_trace: "skill",
  transcript: "transcript",
  execution: "execution",
};

// Icons for each entity type
const entityIcons: Record<string, string> = {
  task: "🎯",
  tool_use: "🔧",
  assertion: "✅",
  skill_trace: "🔮",
  transcript: "📋",
  execution: "📊",
};

export default function CrossReferencePanel({
  entityType,
  entityId,
  executionId,
}: CrossReferencePanelProps) {
  const apiEntityType = entityTypeMap[entityType];
  const { crossRef, loading, error } = useCrossRefs(apiEntityType, entityId);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !crossRef) {
    return null; // Gracefully hide if cross-refs unavailable
  }

  const renderLink = (
    type: "task" | "tool" | "assertion" | "skill" | "transcript" | "execution",
    id: string,
    label: string,
  ) => {
    const urlMap: Record<string, string> = {
      task: buildObservabilityUrl("task", { id: executionId, taskId: id }),
      tool: buildObservabilityUrl("tool", { id: executionId, toolId: id }),
      assertion: buildObservabilityUrl("assertion", {
        id: executionId,
        assertId: id,
      }),
      skill: buildObservabilityUrl("skill", { id: executionId, skillId: id }),
      transcript: buildObservabilityUrl("transcript", {
        id: executionId,
        entryId: id,
      }),
      execution: buildObservabilityUrl("execution", { id }),
    };

    return (
      <Link
        to={urlMap[type] || "#"}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        {label}
        <ExternalLink className="h-3 w-3" />
      </Link>
    );
  };

  // Get related entities from the crossRef
  const relatedEntities = crossRef.relatedTo || [];

  if (relatedEntities.length === 0) {
    return (
      <aside className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Related</h3>
        <p className="text-sm text-gray-500">No related entities found</p>
      </aside>
    );
  }

  // Group related entities by type
  const groupedEntities: Record<string, typeof relatedEntities> = {};
  for (const entity of relatedEntities) {
    const type = entity.type;
    if (!groupedEntities[type]) {
      groupedEntities[type] = [];
    }
    groupedEntities[type].push(entity);
  }

  return (
    <aside className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Related</h3>

      <div className="space-y-4">
        {Object.entries(groupedEntities).map(([type, entities]) => {
          const urlType = urlTypeMap[type] || "execution";
          const icon = entityIcons[type] || "📄";
          const typeLabel = type
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

          return (
            <div key={type}>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {typeLabel} ({entities.length})
              </h4>
              <ul className="space-y-2">
                {entities.slice(0, 5).map((entity) => (
                  <li key={entity.id} className="flex items-center gap-2">
                    <span className="text-gray-500">{icon}</span>
                    {renderLink(
                      urlType,
                      entity.id,
                      entity.summary || entity.id.slice(0, 8),
                    )}
                  </li>
                ))}
                {entities.length > 5 && (
                  <li className="text-sm text-gray-500">
                    +{entities.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
