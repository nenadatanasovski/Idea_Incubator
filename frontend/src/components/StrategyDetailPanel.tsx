import type { EnhancedStrategy, IdeaFinancialAllocation } from '../types';

interface Props {
  strategy: EnhancedStrategy;
  allocation?: IdeaFinancialAllocation | null;
  onClose?: () => void;
  onSelect?: () => void;
  isSelected?: boolean;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getScoreColor = (score: number): string => {
  if (score >= 8) return 'text-green-600 bg-green-50';
  if (score >= 6) return 'text-yellow-600 bg-yellow-50';
  if (score >= 4) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
};

const getAlignmentIcon = (alignment: 'favorable' | 'neutral' | 'challenging' | undefined) => {
  if (alignment === 'favorable') {
    return (
      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    );
  }
  if (alignment === 'challenging') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
};

export default function StrategyDetailPanel({
  strategy,
  allocation: _allocation,
  onClose,
  onSelect,
  isSelected,
}: Props) {
  const { fiveWH, revenueEstimates, goalAlignment, allocationFeasibility, profileFitBreakdown } = strategy;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold">{strategy.name}</h3>
            <p className="text-blue-100 mt-1">{strategy.description}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Fit Score */}
            <div className={`px-3 py-1 rounded-full text-lg font-bold ${getScoreColor(strategy.fitWithProfile)}`}>
              {strategy.fitWithProfile}/10
            </div>
            {/* Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Timing Alignment */}
        {strategy.timingAlignment && (
          <div className="flex items-center gap-2 mt-3 text-sm">
            {getAlignmentIcon(strategy.timingAlignment)}
            <span>
              Timing: <span className="capitalize font-medium">{strategy.timingAlignment}</span>
            </span>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* 5W+H Framework - Always Visible */}
        {fiveWH && Object.values(fiveWH).some(Boolean) && (
          <section>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Strategic Framework (5W+H)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fiveWH.what && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-1">What</h5>
                  <p className="text-sm text-gray-600">{fiveWH.what}</p>
                </div>
              )}
              {fiveWH.why && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Why</h5>
                  <p className="text-sm text-gray-600">{fiveWH.why}</p>
                </div>
              )}
              {fiveWH.how && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-1">How</h5>
                  <p className="text-sm text-gray-600">{fiveWH.how}</p>
                </div>
              )}
              {fiveWH.when && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-1">When</h5>
                  <p className="text-sm text-gray-600">{fiveWH.when}</p>
                </div>
              )}
              {fiveWH.where && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Where</h5>
                  <p className="text-sm text-gray-600">{fiveWH.where}</p>
                </div>
              )}
              {fiveWH.howMuch && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-1">How Much</h5>
                  <p className="text-sm text-gray-600">{fiveWH.howMuch}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Differentiators & Tradeoffs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Differentiators */}
          {strategy.differentiators && strategy.differentiators.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Key Differentiators
              </h4>
              <ul className="space-y-2">
                {strategy.differentiators.map((diff, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5">+</span>
                    <span className="text-gray-700">{diff}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tradeoffs */}
          {strategy.tradeoffs && strategy.tradeoffs.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Tradeoffs
              </h4>
              <ul className="space-y-2">
                {strategy.tradeoffs.map((tradeoff, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-500 mt-0.5">!</span>
                    <span className="text-gray-700">{tradeoff}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Revenue Estimates */}
        {revenueEstimates && (
          <section>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Revenue Estimates
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-700 mb-2">Year 1</h5>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">Low:</span>
                  <span className="text-sm font-medium">{formatCurrency(revenueEstimates.year1.low)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">Mid:</span>
                  <span className="text-lg font-bold text-blue-700">{formatCurrency(revenueEstimates.year1.mid)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">High:</span>
                  <span className="text-sm font-medium">{formatCurrency(revenueEstimates.year1.high)}</span>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-green-700 mb-2">Year 3</h5>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">Low:</span>
                  <span className="text-sm font-medium">{formatCurrency(revenueEstimates.year3.low)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">Mid:</span>
                  <span className="text-lg font-bold text-green-700">{formatCurrency(revenueEstimates.year3.mid)}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500">High:</span>
                  <span className="text-sm font-medium">{formatCurrency(revenueEstimates.year3.high)}</span>
                </div>
              </div>
            </div>
            {revenueEstimates.assumptions && revenueEstimates.assumptions.length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs font-medium text-gray-500 mb-1">Key Assumptions:</h5>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {revenueEstimates.assumptions.map((assumption, i) => (
                    <li key={i}>• {assumption}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Goal Alignment */}
        {goalAlignment && (
          <section>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Goal Alignment
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`p-3 rounded-lg text-center ${goalAlignment.meetsIncomeTarget ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`text-2xl mb-1 ${goalAlignment.meetsIncomeTarget ? 'text-green-600' : 'text-red-600'}`}>
                  {goalAlignment.meetsIncomeTarget ? '✓' : '✗'}
                </div>
                <div className="text-xs text-gray-600">Meets Income Target</div>
                {goalAlignment.gapToTarget && !goalAlignment.meetsIncomeTarget && (
                  <div className="text-xs text-red-600 mt-1">
                    Gap: {formatCurrency(goalAlignment.gapToTarget)}
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-lg text-center ${goalAlignment.runwaySufficient ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`text-2xl mb-1 ${goalAlignment.runwaySufficient ? 'text-green-600' : 'text-red-600'}`}>
                  {goalAlignment.runwaySufficient ? '✓' : '✗'}
                </div>
                <div className="text-xs text-gray-600">Runway Sufficient</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${goalAlignment.investmentFeasible ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`text-2xl mb-1 ${goalAlignment.investmentFeasible ? 'text-green-600' : 'text-red-600'}`}>
                  {goalAlignment.investmentFeasible ? '✓' : '✗'}
                </div>
                <div className="text-xs text-gray-600">Investment Feasible</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${
                goalAlignment.timelineAlignment === 'faster' || goalAlignment.timelineAlignment === 'aligned'
                  ? 'bg-green-50'
                  : goalAlignment.timelineAlignment === 'slower'
                  ? 'bg-yellow-50'
                  : 'bg-red-50'
              }`}>
                <div className={`text-sm font-bold mb-1 capitalize ${
                  goalAlignment.timelineAlignment === 'faster' || goalAlignment.timelineAlignment === 'aligned'
                    ? 'text-green-600'
                    : goalAlignment.timelineAlignment === 'slower'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}>
                  {goalAlignment.timelineAlignment}
                </div>
                <div className="text-xs text-gray-600">Timeline Alignment</div>
              </div>
            </div>
          </section>
        )}

        {/* Profile Fit Breakdown */}
        {profileFitBreakdown && (
          <section>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Profile Fit Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileFitBreakdown.strengths && profileFitBreakdown.strengths.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-green-700 mb-2">Strengths</h5>
                  <ul className="space-y-1">
                    {profileFitBreakdown.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-green-700 flex items-start gap-1">
                        <span>+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {profileFitBreakdown.gaps && profileFitBreakdown.gaps.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-amber-700 mb-2">Gaps</h5>
                  <ul className="space-y-1">
                    {profileFitBreakdown.gaps.map((g, i) => (
                      <li key={i} className="text-sm text-amber-700 flex items-start gap-1">
                        <span>!</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {profileFitBreakdown.suggestions && profileFitBreakdown.suggestions.length > 0 && (
              <div className="mt-3 bg-blue-50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-blue-700 mb-2">Suggestions</h5>
                <ul className="space-y-1">
                  {profileFitBreakdown.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-blue-700">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Allocation Feasibility */}
        {allocationFeasibility && (
          <section>
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Resource Feasibility
            </h4>
            <div className={`rounded-lg p-4 ${allocationFeasibility.overallFeasible ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                {allocationFeasibility.overallFeasible ? (
                  <>
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium text-green-700">Resources are sufficient</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium text-amber-700">Resource gaps identified</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Budget: </span>
                  <span className={allocationFeasibility.budgetSufficient ? 'text-green-600' : 'text-red-600'}>
                    {allocationFeasibility.budgetSufficient ? 'OK' : `Gap: ${formatCurrency(allocationFeasibility.budgetGap || 0)}`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Time: </span>
                  <span className={allocationFeasibility.timeSufficient ? 'text-green-600' : 'text-red-600'}>
                    {allocationFeasibility.timeSufficient ? 'OK' : `Gap: ${allocationFeasibility.timeGap || 0} hrs/wk`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Runway: </span>
                  <span className={allocationFeasibility.runwaySufficient ? 'text-green-600' : 'text-red-600'}>
                    {allocationFeasibility.runwaySufficient ? 'OK' : `Gap: ${allocationFeasibility.runwayGap || 0} mo`}
                  </span>
                </div>
              </div>

              {/* Adjustment Options */}
              {!allocationFeasibility.overallFeasible && allocationFeasibility.adjustmentOptions && allocationFeasibility.adjustmentOptions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <h5 className="text-xs font-medium text-amber-700 mb-2">Options to address gaps:</h5>
                  <ul className="space-y-1">
                    {allocationFeasibility.adjustmentOptions.map((opt, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        • {opt.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Action Button */}
        {onSelect && (
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={onSelect}
              className={`w-full py-3 px-4 text-center font-medium rounded-lg transition-colors ${
                isSelected
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isSelected ? 'Selected as Primary Strategy' : 'Select This Strategy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
