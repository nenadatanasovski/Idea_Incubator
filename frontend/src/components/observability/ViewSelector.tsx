/**
 * ViewSelector - Tab navigation for observability views
 */

import {
  Activity,
  Wrench,
  CheckSquare,
  Sparkles,
  ScrollText,
} from "lucide-react";
import type { ObservabilityView } from "../../types/observability";

interface ViewSelectorProps {
  currentView: ObservabilityView;
  onViewChange: (view: ObservabilityView) => void;
}

const views: Array<{
  id: ObservabilityView;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "timeline", label: "Timeline", icon: Activity },
  { id: "tool-uses", label: "Tools", icon: Wrench },
  { id: "assertions", label: "Assertions", icon: CheckSquare },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export default function ViewSelector({
  currentView,
  onViewChange,
}: ViewSelectorProps) {
  return (
    <div className="flex border-b border-gray-200">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium
              border-b-2 transition-colors
              ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <Icon className="h-4 w-4" />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Compact version for mobile
export function ViewSelectorCompact({
  currentView,
  onViewChange,
}: ViewSelectorProps) {
  return (
    <select
      value={currentView}
      onChange={(e) => onViewChange(e.target.value as ObservabilityView)}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
    >
      {views.map((view) => (
        <option key={view.id} value={view.id}>
          {view.label}
        </option>
      ))}
    </select>
  );
}
