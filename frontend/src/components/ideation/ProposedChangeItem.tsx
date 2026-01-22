// =============================================================================
// FILE: frontend/src/components/ideation/ProposedChangeItem.tsx
// Checkbox row showing proposed graph change
// =============================================================================

import {
  Plus,
  RefreshCw,
  Link as LinkIcon,
  CheckSquare,
  Square,
} from "lucide-react";
import type { ProposedChange } from "../../types/ideation-state";

export interface ProposedChangeItemProps {
  change: ProposedChange;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export function ProposedChangeItem({
  change,
  isSelected,
  onToggle,
}: ProposedChangeItemProps) {
  const getTypeIcon = () => {
    switch (change.type) {
      case "create_block":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "update_block":
        return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case "create_link":
        return <LinkIcon className="w-4 h-4 text-purple-600" />;
      default:
        return <Plus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeLabel = () => {
    switch (change.type) {
      case "create_block":
        return `CREATE ${change.blockType?.toUpperCase() || "BLOCK"}`;
      case "update_block":
        return `UPDATE ${change.blockType?.toUpperCase() || "BLOCK"}`;
      case "create_link":
        return "CREATE LINK";
      default:
        return "CHANGE";
    }
  };

  const confidenceColor =
    change.confidence >= 0.8
      ? "text-green-600"
      : change.confidence >= 0.5
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
        ${isSelected ? "bg-purple-50 border-purple-300" : "bg-white border-gray-200 hover:bg-gray-50"}
      `}
      onClick={() => onToggle(change.id)}
      role="checkbox"
      aria-checked={isSelected}
      data-testid={`proposed-change-${change.id}`}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        {isSelected ? (
          <CheckSquare className="w-5 h-5 text-purple-600" />
        ) : (
          <Square className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Type icon */}
      <div className="flex-shrink-0 mt-0.5">{getTypeIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {getTypeLabel()}
          </span>
          <span className={`text-xs font-medium ${confidenceColor}`}>
            {Math.round(change.confidence * 100)}%
          </span>
        </div>
        <p className="text-sm text-gray-900 line-clamp-2">{change.content}</p>
        {change.graphMembership && change.graphMembership.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {change.graphMembership.map((graph) => (
              <span
                key={graph}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
              >
                {graph}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProposedChangeItem;
