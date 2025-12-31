/**
 * RunwaySurvivalChart
 *
 * Visualizes runway vs. time-to-revenue for a strategy,
 * showing whether the allocated runway is sufficient.
 */

import type { IdeaFinancialAllocation, EnhancedStrategy } from '../types';

interface Props {
  allocation: IdeaFinancialAllocation;
  strategy?: EnhancedStrategy;
  className?: string;
}

// Estimate time to revenue based on approach and strategy
function estimateTimeToRevenue(
  allocation: IdeaFinancialAllocation,
  strategy?: EnhancedStrategy
): { min: number; max: number; avg: number } {
  const approach = allocation.strategicApproach;

  // Base estimates by approach (in months)
  const approachEstimates: Record<string, { min: number; max: number }> = {
    create: { min: 12, max: 24 },
    copy_improve: { min: 3, max: 9 },
    combine: { min: 6, max: 12 },
    localize: { min: 2, max: 6 },
    specialize: { min: 4, max: 10 },
    time: { min: 1, max: 6 },
  };

  const estimate = approachEstimates[approach || 'create'] || { min: 6, max: 18 };

  // Adjust based on timing alignment if strategy is provided
  if (strategy?.timingAlignment) {
    if (strategy.timingAlignment === 'favorable') {
      estimate.min = Math.max(1, estimate.min - 2);
      estimate.max = Math.max(3, estimate.max - 3);
    } else if (strategy.timingAlignment === 'challenging') {
      estimate.min += 3;
      estimate.max += 6;
    }
  }

  return {
    min: estimate.min,
    max: estimate.max,
    avg: Math.round((estimate.min + estimate.max) / 2),
  };
}

export default function RunwaySurvivalChart({ allocation, strategy, className = '' }: Props) {
  const runway = allocation.allocatedRunwayMonths || 0;
  const timeToRevenue = estimateTimeToRevenue(allocation, strategy);

  // Calculate survival probability
  const survivalScore = runway >= timeToRevenue.max
    ? 100
    : runway >= timeToRevenue.avg
    ? 75
    : runway >= timeToRevenue.min
    ? 50
    : Math.max(0, (runway / timeToRevenue.min) * 50);

  const getSurvivalColor = () => {
    if (survivalScore >= 75) return 'bg-green-500';
    if (survivalScore >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSurvivalText = () => {
    if (survivalScore >= 75) return 'Strong runway coverage';
    if (survivalScore >= 50) return 'Adequate runway coverage';
    if (survivalScore >= 25) return 'Runway at risk';
    return 'Insufficient runway';
  };

  // Calculate positions for the visualization
  const maxMonths = Math.max(runway, timeToRevenue.max, 24);
  const runwayPercent = (runway / maxMonths) * 100;
  const revenueMinPercent = (timeToRevenue.min / maxMonths) * 100;
  const revenueMaxPercent = (timeToRevenue.max / maxMonths) * 100;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Runway vs. Time to Revenue
      </h4>

      {/* Survival Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Survival Probability</span>
          <span className="text-sm font-medium">{Math.round(survivalScore)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getSurvivalColor()}`}
            style={{ width: `${survivalScore}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{getSurvivalText()}</p>
      </div>

      {/* Timeline Visualization */}
      <div className="relative h-20 mt-6">
        {/* Background track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 bg-gray-100 rounded-full" />

        {/* Revenue window (min to max) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3 bg-blue-200 rounded-full"
          style={{
            left: `${revenueMinPercent}%`,
            width: `${revenueMaxPercent - revenueMinPercent}%`,
          }}
        />

        {/* Runway bar */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full ${getSurvivalColor()}`}
          style={{ width: `${runwayPercent}%` }}
        />

        {/* Runway marker */}
        <div
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${runwayPercent}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-xs font-medium text-gray-700 bg-white px-1 rounded">
            {runway}mo
          </span>
          <div className="w-0.5 h-4 bg-gray-400 mt-1" />
        </div>

        {/* Revenue min marker */}
        <div
          className="absolute bottom-0 flex flex-col items-center"
          style={{ left: `${revenueMinPercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-4 bg-blue-400 mb-1" />
          <span className="text-xs text-blue-600 bg-white px-1 rounded">
            {timeToRevenue.min}mo
          </span>
        </div>

        {/* Revenue max marker */}
        <div
          className="absolute bottom-0 flex flex-col items-center"
          style={{ left: `${revenueMaxPercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-4 bg-blue-400 mb-1" />
          <span className="text-xs text-blue-600 bg-white px-1 rounded">
            {timeToRevenue.max}mo
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className={`w-3 h-3 rounded ${getSurvivalColor()}`} />
          <span>Your Runway</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-200" />
          <span>Revenue Window</span>
        </div>
      </div>

      {/* Warning if insufficient */}
      {survivalScore < 50 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            <strong>Warning:</strong> Your runway of {runway} months may not be sufficient.
            Consider extending your runway or choosing a faster approach.
          </p>
        </div>
      )}
    </div>
  );
}
