/**
 * AllocationFeasibilityCheck
 *
 * Validates whether the user's resource allocation is feasible
 * for the selected strategy and approach.
 */

import type { IdeaFinancialAllocation, EnhancedStrategy } from '../types';
import { strategicApproachMeta } from '../types';

interface Props {
  allocation: IdeaFinancialAllocation;
  strategy?: EnhancedStrategy;
  className?: string;
}

interface CheckResult {
  category: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  suggestion?: string;
}

function runFeasibilityChecks(
  allocation: IdeaFinancialAllocation,
  _strategy?: EnhancedStrategy
): CheckResult[] {
  const results: CheckResult[] = [];
  const approach = allocation.strategicApproach;
  const meta = approach ? strategicApproachMeta[approach] : null;

  // Budget check
  const budget = allocation.allocatedBudget || 0;
  if (approach === 'create' && budget < 25000) {
    results.push({
      category: 'Budget',
      status: 'warning',
      message: `$${budget.toLocaleString()} may be tight for category creation`,
      suggestion: 'Consider increasing budget or choosing a leaner approach',
    });
  } else if (['copy_improve', 'localize', 'specialize'].includes(approach || '') && budget < 5000) {
    results.push({
      category: 'Budget',
      status: 'warning',
      message: `Very limited budget of $${budget.toLocaleString()}`,
      suggestion: 'Focus on bootstrapped/sweat equity approach',
    });
  } else {
    results.push({
      category: 'Budget',
      status: 'pass',
      message: `$${budget.toLocaleString()} allocated`,
    });
  }

  // Time check
  const hours = allocation.allocatedWeeklyHours || 0;
  if (hours < 10) {
    results.push({
      category: 'Time',
      status: 'warning',
      message: `Only ${hours} hours/week allocated`,
      suggestion: 'Consider if this is sufficient for meaningful progress',
    });
  } else if (hours >= 30) {
    results.push({
      category: 'Time',
      status: 'pass',
      message: `${hours} hours/week - full commitment`,
    });
  } else {
    results.push({
      category: 'Time',
      status: 'pass',
      message: `${hours} hours/week allocated`,
    });
  }

  // Runway check
  const runway = allocation.allocatedRunwayMonths || 0;
  if (approach === 'create' && runway < 12) {
    results.push({
      category: 'Runway',
      status: 'fail',
      message: `${runway} months is insufficient for category creation`,
      suggestion: 'Need 12-18+ months for create approach',
    });
  } else if (['copy_improve', 'localize'].includes(approach || '') && runway < 3) {
    results.push({
      category: 'Runway',
      status: 'warning',
      message: `${runway} months is very tight`,
      suggestion: 'Consider extending runway to 6+ months',
    });
  } else {
    results.push({
      category: 'Runway',
      status: 'pass',
      message: `${runway} months runway`,
    });
  }

  // Risk alignment check
  const riskLevel = allocation.ideaRiskTolerance;
  if (meta) {
    const approachRisk = meta.riskLevel;
    if (riskLevel === 'low' && approachRisk === 'high') {
      results.push({
        category: 'Risk Alignment',
        status: 'warning',
        message: 'High-risk approach with low risk tolerance',
        suggestion: 'Consider a lower-risk approach or adjust expectations',
      });
    } else if (riskLevel === 'very_high' && approachRisk === 'low') {
      results.push({
        category: 'Risk Alignment',
        status: 'pass',
        message: 'Conservative approach with high risk tolerance - room to pivot',
      });
    } else {
      results.push({
        category: 'Risk Alignment',
        status: 'pass',
        message: 'Risk tolerance matches approach',
      });
    }
  }

  // Validation budget check
  const validationBudget = allocation.validationBudget || 0;
  if (validationBudget === 0) {
    results.push({
      category: 'Validation',
      status: 'warning',
      message: 'No validation budget set',
      suggestion: 'Allocate 10-20% for pre-commitment validation',
    });
  } else if (validationBudget < budget * 0.05) {
    results.push({
      category: 'Validation',
      status: 'warning',
      message: 'Validation budget is less than 5% of total',
      suggestion: 'Consider increasing validation allocation',
    });
  } else {
    results.push({
      category: 'Validation',
      status: 'pass',
      message: `$${validationBudget.toLocaleString()} for validation`,
    });
  }

  return results;
}

const getStatusIcon = (status: 'pass' | 'warning' | 'fail') => {
  switch (status) {
    case 'pass':
      return (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'fail':
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
  }
};

export default function AllocationFeasibilityCheck({ allocation, strategy, className = '' }: Props) {
  const checks = runFeasibilityChecks(allocation, strategy);
  const passCount = checks.filter(c => c.status === 'pass').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  const overallStatus = failCount > 0 ? 'fail' : warningCount > 0 ? 'warning' : 'pass';

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Feasibility Check
        </h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600">{passCount} pass</span>
          {warningCount > 0 && <span className="text-yellow-600">{warningCount} warning</span>}
          {failCount > 0 && <span className="text-red-600">{failCount} fail</span>}
        </div>
      </div>

      <div className="space-y-3">
        {checks.map((check, idx) => (
          <div key={idx} className="flex items-start gap-3">
            {getStatusIcon(check.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{check.category}</span>
              </div>
              <p className="text-sm text-gray-600">{check.message}</p>
              {check.suggestion && (
                <p className="text-xs text-gray-500 mt-0.5">{check.suggestion}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {overallStatus !== 'pass' && (
        <div className={`mt-4 p-3 rounded-lg ${
          overallStatus === 'fail' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <p className={`text-sm ${overallStatus === 'fail' ? 'text-red-700' : 'text-yellow-700'}`}>
            {overallStatus === 'fail'
              ? 'Critical feasibility issues detected. Address before proceeding.'
              : 'Some concerns to consider. Review suggestions above.'}
          </p>
        </div>
      )}
    </div>
  );
}
