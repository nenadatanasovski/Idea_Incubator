/**
 * StrategicSummaryCard
 *
 * Displays a high-level summary of the positioning analysis results,
 * including recommended strategy, primary opportunity, critical risk,
 * and timing assessment.
 */

import type { StrategicSummary } from '../types';

interface Props {
  summary: StrategicSummary;
  className?: string;
}

const getUrgencyColor = (urgency: 'high' | 'medium' | 'low') => {
  switch (urgency) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-green-600';
  }
};

const getFitColor = (fit: 'high' | 'medium' | 'low') => {
  switch (fit) {
    case 'high':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-red-100 text-red-800';
  }
};

const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
  switch (severity) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-green-600';
  }
};

export default function StrategicSummaryCard({ summary, className = '' }: Props) {
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Strategic Summary</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Confidence:</span>
          <span className={`text-sm font-medium ${
            summary.overallConfidence >= 0.7 ? 'text-green-600' :
            summary.overallConfidence >= 0.4 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {Math.round(summary.overallConfidence * 100)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recommended Strategy */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Recommended Strategy
          </h4>
          <p className="font-semibold text-gray-900 mt-1">
            {summary.recommendedStrategy.name}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-blue-600 font-medium">
              {summary.recommendedStrategy.fitScore}/10 fit
            </span>
          </div>
          {summary.recommendedStrategy.reason && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
              {summary.recommendedStrategy.reason}
            </p>
          )}
        </div>

        {/* Primary Opportunity */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Primary Opportunity
          </h4>
          <p className="font-semibold text-gray-900 mt-1">
            {summary.primaryOpportunity.segment}
          </p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-2 ${
            getFitColor(summary.primaryOpportunity.fit)
          }`}>
            {summary.primaryOpportunity.fit} fit
          </span>
        </div>

        {/* Critical Risk */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Key Risk
          </h4>
          <p className={`font-medium mt-1 truncate ${
            getSeverityColor(summary.criticalRisk.severity)
          }`}>
            {summary.criticalRisk.description}
          </p>
          <span className="text-xs text-gray-500 mt-2 block">
            Severity: {summary.criticalRisk.severity}
          </span>
          {summary.criticalRisk.mitigation && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">
              Mitigation: {summary.criticalRisk.mitigation}
            </p>
          )}
        </div>

        {/* Timing Assessment */}
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Timing
          </h4>
          <p className={`text-xl font-bold mt-1 ${
            getUrgencyColor(summary.timingAssessment.urgency)
          }`}>
            {summary.timingAssessment.urgency.toUpperCase()}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {summary.timingAssessment.window}
          </p>
        </div>
      </div>
    </div>
  );
}
