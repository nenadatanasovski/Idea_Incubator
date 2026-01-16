import {
  Lightbulb,
  Play,
  Edit2,
  GitBranch,
  History,
  Trash2,
  Loader2,
  Pause,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import type { IncubationPhase } from "./IncubationStepper";

interface PhaseActionBarProps {
  currentPhase: IncubationPhase;
  ideaSlug: string;
  readinessPercent?: number;
  canEvaluate?: boolean;
  hasEvaluation?: boolean;
  isEvaluating?: boolean;
  isDeleting?: boolean;

  onDevelop?: () => void;
  onEvaluate?: () => void;
  onEdit?: () => void;
  onBranch?: () => void;
  onHistory?: () => void;
  onDelete?: () => void;
  onPause?: () => void;
  onIterate?: () => void;
  onContinue?: () => void;

  className?: string;
}

interface ActionConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  variant: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  show: boolean;
}

export default function PhaseActionBar({
  currentPhase,
  readinessPercent = 0,
  canEvaluate = false,
  hasEvaluation = false,
  isEvaluating = false,
  isDeleting = false,
  onDevelop,
  onEvaluate,
  onEdit,
  onBranch,
  onHistory,
  onDelete,
  onPause,
  onIterate,
  onContinue,
  className,
}: PhaseActionBarProps) {
  // Define phase-specific actions
  const getPhaseActions = (): ActionConfig[] => {
    const commonActions: ActionConfig[] = [
      {
        id: "edit",
        label: "Edit",
        icon: Edit2,
        onClick: onEdit,
        variant: "secondary",
        show: true,
      },
      {
        id: "branch",
        label: "Branch",
        icon: GitBranch,
        onClick: onBranch,
        variant: "secondary",
        show: true,
      },
      {
        id: "history",
        label: "History",
        icon: History,
        onClick: onHistory,
        variant: "secondary",
        show: true,
      },
    ];

    switch (currentPhase) {
      case "capture":
        return [
          {
            id: "continue",
            label: "Begin Development",
            icon: ChevronRight,
            onClick: onContinue,
            variant: "primary",
            show: true,
          },
          ...commonActions,
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            onClick: onDelete,
            variant: "danger",
            loading: isDeleting,
            show: true,
          },
        ];

      case "clarify":
        return [
          {
            id: "develop",
            label: `Develop Idea (${Math.round(readinessPercent)}%)`,
            icon: Lightbulb,
            onClick: onDevelop,
            variant: "primary",
            show: true,
          },
          {
            id: "continue",
            label: "Continue to Analysis",
            icon: ChevronRight,
            onClick: onContinue,
            variant: "secondary",
            disabled: readinessPercent < 80,
            show: readinessPercent >= 50,
          },
          ...commonActions,
        ];

      case "position":
        return [
          {
            id: "continue",
            label: "Continue to Update",
            icon: ChevronRight,
            onClick: onContinue,
            variant: "primary",
            show: true,
          },
          {
            id: "develop",
            label: "Back to Questions",
            icon: Lightbulb,
            onClick: onDevelop,
            variant: "secondary",
            show: true,
          },
          ...commonActions,
        ];

      case "update":
        return [
          {
            id: "edit",
            label: "Update Idea",
            icon: Edit2,
            onClick: onEdit,
            variant: "primary",
            show: true,
          },
          {
            id: "continue",
            label: "Ready for Evaluation",
            icon: ChevronRight,
            onClick: onContinue,
            variant: "secondary",
            show: true,
          },
          {
            id: "branch",
            label: "Branch",
            icon: GitBranch,
            onClick: onBranch,
            variant: "secondary",
            show: true,
          },
          {
            id: "history",
            label: "History",
            icon: History,
            onClick: onHistory,
            variant: "secondary",
            show: true,
          },
        ];

      case "evaluate":
        return [
          {
            id: "evaluate",
            label: hasEvaluation ? "Re-evaluate" : "Run Evaluation",
            icon: Play,
            onClick: onEvaluate,
            variant: "primary",
            loading: isEvaluating,
            disabled: isEvaluating || !canEvaluate,
            show: true,
          },
          {
            id: "develop",
            label: "More Questions",
            icon: Lightbulb,
            onClick: onDevelop,
            variant: "secondary",
            show: true,
          },
          ...commonActions,
        ];

      case "iterate":
        return [
          {
            id: "iterate",
            label: "Focus & Iterate",
            icon: RefreshCw,
            onClick: onIterate,
            variant: "primary",
            show: true,
          },
          {
            id: "branch",
            label: "Try Different Approach",
            icon: GitBranch,
            onClick: onBranch,
            variant: "secondary",
            show: true,
          },
          {
            id: "pause",
            label: "Pause Idea",
            icon: Pause,
            onClick: onPause,
            variant: "secondary",
            show: true,
          },
          {
            id: "history",
            label: "History",
            icon: History,
            onClick: onHistory,
            variant: "secondary",
            show: true,
          },
        ];

      default:
        return commonActions;
    }
  };

  const actions = getPhaseActions().filter((a) => a.show);
  const primaryActions = actions.filter((a) => a.variant === "primary");
  const secondaryActions = actions.filter((a) => a.variant === "secondary");
  const dangerActions = actions.filter((a) => a.variant === "danger");

  return (
    <div className={clsx("card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Primary + Secondary actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {primaryActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
          {secondaryActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>

        {/* Danger actions */}
        {dangerActions.length > 0 && (
          <div className="flex items-center gap-2">
            {dangerActions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ action }: { action: ActionConfig }) {
  const Icon = action.icon;

  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={clsx(
        "btn inline-flex items-center",
        action.variant === "primary" && "btn-primary",
        action.variant === "secondary" && "btn-secondary",
        action.variant === "danger" &&
          "btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50",
        (action.disabled || action.loading) && "opacity-50 cursor-not-allowed",
      )}
    >
      {action.loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {action.label}
    </button>
  );
}
