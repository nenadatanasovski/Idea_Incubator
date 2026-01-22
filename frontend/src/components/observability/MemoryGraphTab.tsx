/**
 * MemoryGraphTab - Memory Graph Observability Tab
 *
 * Displays Memory Graph health metrics and change log for monitoring
 * and auditing graph changes in the observability section.
 */

import { MemoryGraphChangeLog } from "./MemoryGraphChangeLog";
import { MemoryGraphHealthPanel } from "./MemoryGraphHealthPanel";

export default function MemoryGraphTab() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Memory Graph
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor and audit changes to the Memory Graph across all sessions.
        </p>
      </div>

      {/* Health Panel and Change Log side by side on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Panel - takes 1 column */}
        <div className="lg:col-span-1">
          <MemoryGraphHealthPanel />
        </div>

        {/* Change Log - takes 2 columns */}
        <div className="lg:col-span-2">
          <MemoryGraphChangeLog />
        </div>
      </div>
    </div>
  );
}
