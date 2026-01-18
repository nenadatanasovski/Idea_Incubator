/**
 * TaskGroupSelector - Dropdown for selecting task grouping mode
 *
 * Options: None, Category, Phase, Spec Section, Parent Task
 */

import {
  ChevronDown,
  Layers,
  Tags,
  GitBranch,
  Target,
  ListTree,
} from "lucide-react";
import clsx from "clsx";

export type TaskGroupMode =
  | "none"
  | "category"
  | "phase"
  | "spec_section"
  | "parent";

interface TaskGroupSelectorProps {
  value: TaskGroupMode;
  onChange: (mode: TaskGroupMode) => void;
  className?: string;
}

const groupOptions: Array<{
  value: TaskGroupMode;
  label: string;
  icon: typeof Layers;
  description: string;
}> = [
  {
    value: "none",
    label: "No Grouping",
    icon: Layers,
    description: "Show tasks in a flat list",
  },
  {
    value: "category",
    label: "By Category",
    icon: Tags,
    description: "Group by task category (feature, bug, etc.)",
  },
  {
    value: "phase",
    label: "By Phase",
    icon: GitBranch,
    description: "Group by execution phase (1-5)",
  },
  {
    value: "spec_section",
    label: "By Spec Section",
    icon: Target,
    description: "Group by linked PRD section",
  },
  {
    value: "parent",
    label: "By Parent Task",
    icon: ListTree,
    description: "Show decomposition hierarchy",
  },
];

export default function TaskGroupSelector({
  value,
  onChange,
  className,
}: TaskGroupSelectorProps) {
  const selectedOption =
    groupOptions.find((o) => o.value === value) || groupOptions[0];
  const SelectedIcon = selectedOption.icon;

  return (
    <div className={clsx("relative inline-block", className)}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as TaskGroupMode)}
          className="appearance-none bg-white border border-gray-300 rounded-lg pl-9 pr-8 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer"
        >
          {groupOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <SelectedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

// Also export as a segmented control variant
export function TaskGroupSegmentedControl({
  value,
  onChange,
  className,
}: TaskGroupSelectorProps) {
  return (
    <div
      className={clsx(
        "inline-flex items-center bg-gray-100 rounded-lg p-1",
        className,
      )}
    >
      {groupOptions.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
            title={option.description}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
