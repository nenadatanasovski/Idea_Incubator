/**
 * SpecWorkflowBadge Component
 *
 * Displays the current workflow state of a spec with visual styling.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-005-B)
 */

import React from "react";
import type {
  SpecWorkflowState,
  SpecWorkflowBadgeProps,
  WORKFLOW_STATE_COLORS,
} from "../../types/spec";

const WORKFLOW_COLORS: typeof WORKFLOW_STATE_COLORS = {
  draft: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-300",
  },
  review: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
  },
  approved: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-300",
  },
  archived: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
  },
};

const WORKFLOW_LABELS: Record<SpecWorkflowState, string> = {
  draft: "Draft",
  review: "In Review",
  approved: "Approved",
  archived: "Archived",
};

// Size classes for badge
const SIZE_CLASSES = {
  sm: {
    badge: "px-2 py-0.5 text-xs",
    icon: "text-[10px]",
  },
  md: {
    badge: "px-2.5 py-1 text-sm",
    icon: "text-xs",
  },
  lg: {
    badge: "px-3 py-1.5 text-base",
    icon: "text-sm",
  },
};

export const SpecWorkflowBadge: React.FC<SpecWorkflowBadgeProps> = ({
  state,
  size = "md",
  onClick,
  showActions = false,
  allowedTransitions = [],
  onTransition,
}) => {
  const colors = WORKFLOW_COLORS[state];
  const label = WORKFLOW_LABELS[state];
  const sizeClasses = SIZE_CLASSES[size];

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={!onClick}
        className={`
          inline-flex items-center gap-1.5 rounded-full font-medium
          ${sizeClasses.badge}
          ${colors.bg} ${colors.text} border ${colors.border}
          ${onClick ? "cursor-pointer hover:opacity-80" : "cursor-default"}
          transition-opacity
        `}
      >
        <span className={sizeClasses.icon}>
          {state === "draft" && "✏️"}
          {state === "review" && "👁️"}
          {state === "approved" && "✅"}
          {state === "archived" && "📦"}
        </span>
        <span>{label}</span>
      </button>

      {showActions && allowedTransitions.length > 0 && onTransition && (
        <div className="flex gap-1">
          {allowedTransitions.map((targetState) => (
            <button
              key={targetState}
              onClick={() => onTransition(targetState)}
              className={`
                px-2 py-1 text-xs rounded
                ${WORKFLOW_COLORS[targetState].bg}
                ${WORKFLOW_COLORS[targetState].text}
                hover:opacity-80 transition-opacity
              `}
            >
              → {WORKFLOW_LABELS[targetState]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpecWorkflowBadge;
