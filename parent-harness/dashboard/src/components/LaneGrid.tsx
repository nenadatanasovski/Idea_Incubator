/**
 * LaneGrid Component
 * 
 * The core visualization showing tasks organized by lanes (rows) and waves (columns).
 * Ported from Vibe Platform for parent-harness dashboard.
 */

import { useState } from 'react';
import type { Lane, Wave, LaneTask, LaneCategory } from '../types/pipeline';
import { LANE_CATEGORY_CONFIG } from '../types/pipeline';
import { WaveCell } from './WaveCell';

interface LaneGridProps {
  lanes: Lane[];
  waves: Wave[];
  activeWaveNumber: number;
  selectedWaveNumber?: number;
  onTaskClick?: (task: LaneTask) => void;
  onLaneClick?: (lane: Lane) => void;
}

const CategoryIcon = ({ category }: { category: LaneCategory }) => {
  const baseClass = 'w-4 h-4';
  switch (category) {
    case 'database':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      );
    case 'types':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case 'api':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      );
    case 'ui':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    case 'tests':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      );
    case 'infrastructure':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
  }
};

export function LaneGrid({
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
        className="flex items-center justify-center h-64 bg-gray-800 rounded-lg border border-gray-700"
      >
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <p className="text-gray-400">No lanes defined</p>
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
      className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700"
    >
      <table className="w-full border-collapse min-w-[600px]">
        {/* Wave column headers */}
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-900 p-2 border-b border-r border-gray-700 w-40">
              <span className="text-sm font-medium text-gray-400">Lane</span>
            </th>
            {waveColumns.map((waveNum) => {
              const wave = waves.find((w) => w.waveNumber === waveNum);
              const isActive = waveNum === activeWaveNumber;
              const isSelected = waveNum === selectedWaveNumber;

              return (
                <th
                  key={waveNum}
                  className={`
                    p-2 border-b border-gray-700 min-w-[120px]
                    ${isActive ? 'bg-blue-900/30' : 'bg-gray-900'}
                    ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-300">
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
                        className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded"
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
                  ${isHovered ? 'bg-gray-700' : ''}
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
                    p-2 border-r border-b border-gray-700
                    bg-gray-800
                    cursor-pointer hover:bg-gray-700
                    transition-all duration-150
                  `}
                  onClick={() => onLaneClick?.(lane)}
                >
                  <div className="flex items-center gap-2">
                    <span className={config?.color || 'text-gray-400'}>
                      <CategoryIcon category={lane.category as LaneCategory} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">
                        {lane.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {lane.tasksCompleted}/{lane.tasksTotal} tasks
                      </div>
                    </div>
                    {lane.status === 'blocked' && (
                      <span className="text-amber-400 text-xs">◐</span>
                    )}
                    {lane.status === 'complete' && (
                      <span className="text-green-400 text-xs">✓</span>
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
                      className="border-b border-gray-700/50 p-0"
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

export default LaneGrid;
