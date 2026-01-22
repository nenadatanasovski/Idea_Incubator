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
    <div className="flex flex-col h-full p-6">
      {/* Two-column layout: Health Panel on left, Change Log on right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Health Panel - takes 1 column */}
        <div className="lg:col-span-1">
          <MemoryGraphHealthPanel />
        </div>

        {/* Change Log - takes 3 columns and fills remaining height */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <MemoryGraphChangeLog className="flex-1" />
        </div>
      </div>
    </div>
  );
}
