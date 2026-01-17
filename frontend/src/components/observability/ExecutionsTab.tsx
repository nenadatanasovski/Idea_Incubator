/**
 * ExecutionsTab - Execution runs view within Observability
 * Shows task list execution history with filtering and status
 */

import { useState } from "react";
import ExecutionList from "./ExecutionList";
import clsx from "clsx";

type StatusFilter = "all" | "running" | "completed" | "failed" | "paused";

export default function ExecutionsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filterOptions: { value: StatusFilter; label: string; color: string }[] =
    [
      { value: "all", label: "All", color: "bg-gray-100 text-gray-700" },
      {
        value: "running",
        label: "Running",
        color: "bg-blue-100 text-blue-700",
      },
      {
        value: "completed",
        label: "Completed",
        color: "bg-green-100 text-green-700",
      },
      { value: "failed", label: "Failed", color: "bg-red-100 text-red-700" },
      {
        value: "paused",
        label: "Paused",
        color: "bg-yellow-100 text-yellow-700",
      },
    ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Execution Runs</h2>
          <p className="text-sm text-gray-500">
            View task list execution history, progress, and detailed logs
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-500">Status:</span>
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setStatusFilter(option.value)}
            className={clsx(
              "px-3 py-1 text-sm font-medium rounded-full transition-colors",
              statusFilter === option.value
                ? option.color
                : "bg-gray-50 text-gray-500 hover:bg-gray-100",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Execution List */}
      <div className="bg-white rounded-lg shadow p-6">
        <ExecutionList />
      </div>
    </div>
  );
}
