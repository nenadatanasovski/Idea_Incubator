/**
 * LaneGrid Component
 *
 * The core visualization showing tasks organized by lanes (rows) and waves (columns).
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { useState } from "react";
import {
  Database,
  Code2,
  Server,
  Layout,
  TestTube2,
  Settings,
} from "lucide-react";
import type { Lane, Wave, LaneTask, LaneCategory } from "../../types/pipeline";
import { LANE_CATEGORY_CONFIG } from "../../types/pipeline";
import WaveCell from "./WaveCell";

interface LaneGridProps {
  lanes: Lane[];
  waves: Wave[];
  activeWaveNumber: number;
  selectedWaveNumber?: number;
  onTaskClick?: (task: LaneTask) => void;
  onLaneClick?: (lane: Lane) => void;
}

const CategoryIcon = ({ category }: { category: LaneCategory }) => {
  const iconClass = "w-4 h-4";
  switch (category) {
    case "database":
      return <Database className={iconClass} />;
    case "types":
      return <Code2 className={iconClass} />;
    case "api":
      return <Server className={iconClass} />;
    case "ui":
      return <Layout className={iconClass} />;
    case "tests":
      return <TestTube2 className={iconClass} />;
    case "infrastructure":
      return <Settings className={iconClass} />;
    default:
      return <Code2 className={iconClass} />;
  }
};

export default function LaneGrid({
  lanes,
  waves,
  activeWaveNumber,
  selectedWaveNumber,
  onTaskClick,
  onLaneClick,
}: LaneGridProps) {
  const [hoveredLaneId, setHoveredLaneId] = useState<string | null>(null);

  // Get max wave number to determine column count
  const maxWaveNumber = Math.max(
    ...waves.map((w) => w.waveNumber),
    ...lanes.flatMap((l) => l.tasks.map((t) => t.waveNumber)),
    1,
  );

  // Create wave column headers
  const waveColumns = Array.from({ length: maxWaveNumber }, (_, i) => i + 1);

  if (lanes.length === 0) {
    return (
      <div
        data-testid="lane-grid"
        className="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200"
      >
        <div className="text-center">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No lanes defined</p>
          <p className="text-gray-500 text-sm">
            Tasks will appear here once execution starts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="lane-grid"
      className="overflow-x-auto bg-white rounded-lg border border-gray-200"
    >
      <table className="w-full border-collapse min-w-[600px]">
        {/* Wave column headers */}
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 p-2 border-b border-r border-gray-200 w-40">
              <span className="text-sm font-medium text-gray-600">Lane</span>
            </th>
            {waveColumns.map((waveNum) => {
              const wave = waves.find((w) => w.waveNumber === waveNum);
              const isActive = waveNum === activeWaveNumber;
              const isSelected = waveNum === selectedWaveNumber;

              return (
                <th
                  key={waveNum}
                  className={`
                    p-2 border-b border-gray-200 min-w-[120px]
                    ${isActive ? "bg-blue-50" : "bg-gray-50"}
                    ${isSelected ? "ring-2 ring-inset ring-blue-500" : ""}
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-700">
                      Wave {waveNum}
                    </span>
                    {wave && (
                      <span className="text-xs text-gray-500">
                        {wave.tasksCompleted}/{wave.tasksTotal}
                      </span>
                    )}
                    {isActive && (
                      <span
                        data-testid="wave-active"
                        className="wave-active text-xs px-1.5 py-0.5 bg-primary-600 text-white rounded"
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Lane rows */}
        <tbody>
          {lanes.map((lane) => {
            const config = LANE_CATEGORY_CONFIG[lane.category as LaneCategory];
            const isHovered = hoveredLaneId === lane.id;

            return (
              <tr
                key={lane.id}
                data-testid={`lane-row-${lane.id}`}
                className={`
                  ${isHovered ? "bg-gray-50" : ""}
                  transition-colors duration-150
                `}
                onMouseEnter={() => setHoveredLaneId(lane.id)}
                onMouseLeave={() => setHoveredLaneId(null)}
              >
                {/* Lane header cell */}
                <td
                  data-testid={`lane-header-${lane.id}`}
                  className={`
                    sticky left-0 z-10
                    p-2 border-r border-b border-gray-200
                    ${config?.bgColor || "bg-gray-50"}
                    cursor-pointer hover:brightness-95
                    transition-all duration-150
                  `}
                  onClick={() => onLaneClick?.(lane)}
                >
                  <div className="flex items-center gap-2">
                    <span className={config?.color || "text-gray-600"}>
                      <CategoryIcon category={lane.category as LaneCategory} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {lane.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {lane.tasksCompleted}/{lane.tasksTotal} tasks
                      </div>
                    </div>
                    {lane.status === "blocked" && (
                      <span className="text-amber-600 text-xs">◐</span>
                    )}
                    {lane.status === "complete" && (
                      <span className="text-green-600 text-xs">✓</span>
                    )}
                  </div>
                </td>

                {/* Wave cells for this lane */}
                {waveColumns.map((waveNum) => {
                  const task = lane.tasks.find((t) => t.waveNumber === waveNum);
                  const isActiveWave = waveNum === activeWaveNumber;

                  return (
                    <td
                      key={`${lane.id}-${waveNum}`}
                      className="border-b border-gray-200/50 p-0"
                    >
                      <WaveCell
                        task={task}
                        waveNumber={waveNum}
                        isActiveWave={isActiveWave}
                        onClick={onTaskClick}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
