/**
 * FinancialViabilityCard
 *
 * Displays financial viability metrics for a strategy,
 * including revenue estimates, goal alignment, and investment requirements.
 */

import type { EnhancedStrategy, IdeaFinancialAllocation } from '../types';

interface Props {
  strategy: EnhancedStrategy;
  allocation?: IdeaFinancialAllocation | null;
  className?: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const getTimelineColor = (alignment: string) => {
  switch (alignment) {
    case 'faster':
      return 'text-green-600 bg-green-50';
    case 'aligned':
      return 'text-blue-600 bg-blue-50';
    case 'slower':
      return 'text-yellow-600 bg-yellow-50';
    case 'unlikely':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export default function FinancialViabilityCard({ strategy, allocation, className = '' }: Props) {
  const { revenueEstimates, goalAlignment } = strategy;

  if (!revenueEstimates && !goalAlignment) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
        Financial Viability
      </h4>

      <div className="space-y-4">
        {/* Revenue Estimates */}
        {revenueEstimates && (
          <div>
            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Revenue Projections
            </h5>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-500">Year 1</span>
                <div className="mt-1">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(revenueEstimates.year1.mid)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({formatCurrency(revenueEstimates.year1.low)} - {formatCurrency(revenueEstimates.year1.high)})
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-500">Year 3</span>
                <div className="mt-1">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(revenueEstimates.year3.mid)}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({formatCurrency(revenueEstimates.year3.low)} - {formatCurrency(revenueEstimates.year3.high)})
                  </span>
                </div>
              </div>
            </div>
            {revenueEstimates.assumptions && revenueEstimates.assumptions.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                <span className="font-medium">Key assumptions:</span>
                <ul className="mt-1 list-disc list-inside">
                  {revenueEstimates.assumptions.slice(0, 2).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Goal Alignment */}
        {goalAlignment && (
          <div className="pt-3 border-t border-gray-100">
            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Goal Alignment
            </h5>
            <div className="space-y-2">
              {/* Income Target */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Meets Income Target</span>
                <span className={`text-sm font-medium ${goalAlignment.meetsIncomeTarget ? 'text-green-600' : 'text-red-600'}`}>
                  {goalAlignment.meetsIncomeTarget ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Gap to Target */}
              {goalAlignment.gapToTarget !== null && goalAlignment.gapToTarget !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Gap to Target</span>
                  <span className={`text-sm font-medium ${goalAlignment.gapToTarget > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {goalAlignment.gapToTarget > 0 ? '+' : ''}{formatCurrency(goalAlignment.gapToTarget)}
                  </span>
                </div>
              )}

              {/* Timeline Alignment */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Timeline</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTimelineColor(goalAlignment.timelineAlignment)}`}>
                  {goalAlignment.timelineAlignment}
                </span>
              </div>

              {/* Runway Sufficient */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Runway Sufficient</span>
                <span className={`text-sm font-medium ${goalAlignment.runwaySufficient ? 'text-green-600' : 'text-red-600'}`}>
                  {goalAlignment.runwaySufficient ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Investment Feasible */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Investment Feasible</span>
                <span className={`text-sm font-medium ${goalAlignment.investmentFeasible ? 'text-green-600' : 'text-red-600'}`}>
                  {goalAlignment.investmentFeasible ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Comparison with Allocation */}
        {allocation && (
          <div className="pt-3 border-t border-gray-100">
            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">
              vs. Your Allocation
            </h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Allocated:</span>
                <span className="font-medium ml-1">{formatCurrency(allocation.allocatedBudget || 0)}</span>
              </div>
              <div>
                <span className="text-gray-500">Target:</span>
                <span className="font-medium ml-1">{formatCurrency(allocation.targetIncomeFromIdea || 0)}/yr</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
