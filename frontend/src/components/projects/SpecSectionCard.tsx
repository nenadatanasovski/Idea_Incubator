/**
 * SpecSectionCard - Displays a spec section with coverage status
 *
 * Shows section header with coverage percentage bar, and expandable items
 * with linked tasks.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import type { SpecSectionCoverage } from "../../hooks/useTraceability";
import LinkedTaskChip from "./LinkedTaskChip";

interface SpecSectionCardProps {
  section: SpecSectionCoverage;
  projectSlug?: string;
  defaultExpanded?: boolean;
  onItemClick?: (sectionType: string, itemIndex: number) => void;
}

function getCoverageColor(percentage: number): string {
  if (percentage === 100) return "bg-green-500";
  if (percentage >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getCoverageTextColor(percentage: number): string {
  if (percentage === 100) return "text-green-700";
  if (percentage >= 50) return "text-amber-700";
  return "text-red-700";
}

export default function SpecSectionCard({
  section,
  projectSlug,
  defaultExpanded = false,
  onItemClick,
}: SpecSectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
          <div className="text-left">
            <h3 className="font-medium text-gray-900">
              {section.sectionTitle}
            </h3>
            <p className="text-sm text-gray-500">
              {section.coveredItems} of {section.totalItems} items covered
            </p>
          </div>
        </div>

        {/* Coverage percentage */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all",
                getCoverageColor(section.coveragePercentage),
              )}
              style={{ width: `${section.coveragePercentage}%` }}
            />
          </div>
          <span
            className={clsx(
              "text-sm font-medium w-12 text-right",
              getCoverageTextColor(section.coveragePercentage),
            )}
          >
            {section.coveragePercentage}%
          </span>
        </div>
      </button>

      {/* Expanded items */}
      {isExpanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {section.items.map((item) => (
            <div key={item.index} className="bg-gray-50">
              {/* Item header */}
              <div
                className={clsx(
                  "flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-100 transition-colors",
                  onItemClick && "cursor-pointer",
                )}
                onClick={() => {
                  toggleItem(item.index);
                  onItemClick?.(section.sectionType, item.index);
                }}
              >
                {/* Coverage indicator */}
                <div className="flex-shrink-0 mt-0.5">
                  {item.isCovered ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>

                {/* Item content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {item.content}
                  </p>

                  {/* Linked tasks chips */}
                  {item.linkedTasks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.linkedTasks.map((task) => (
                        <LinkedTaskChip
                          key={task.id}
                          task={task}
                          projectSlug={projectSlug}
                          size="sm"
                        />
                      ))}
                    </div>
                  )}

                  {/* No tasks warning */}
                  {!item.isCovered && (
                    <p className="text-xs text-amber-600 mt-1.5">
                      No tasks linked to this requirement
                    </p>
                  )}
                </div>

                {/* Expand indicator for items with tasks */}
                {item.linkedTasks.length > 0 && (
                  <div className="flex-shrink-0">
                    {expandedItems.has(item.index) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                )}
              </div>

              {/* Expanded task details */}
              {expandedItems.has(item.index) && item.linkedTasks.length > 0 && (
                <div className="px-10 pb-3 space-y-2">
                  {item.linkedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <LinkedTaskChip
                        task={task}
                        projectSlug={projectSlug}
                        size="md"
                        showLinkType={true}
                      />
                      <span className="text-gray-600 truncate">
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {section.items.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No items in this section
            </div>
          )}
        </div>
      )}
    </div>
  );
}
