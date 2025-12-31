/**
 * NicheTrapWarning
 *
 * Warns when a specialize approach might lead to a niche
 * that's too small or too competitive.
 */

import type { EnhancedStrategy, IdeaFinancialAllocation, ValidatedOpportunity } from '../types';

interface Props {
  strategy?: EnhancedStrategy;
  allocation?: IdeaFinancialAllocation | null;
  opportunities?: ValidatedOpportunity[];
  className?: string;
}

interface WarningLevel {
  level: 'none' | 'low' | 'medium' | 'high';
  message: string;
  details: string[];
}

function analyzeNicheTrap(
  strategy?: EnhancedStrategy,
  allocation?: IdeaFinancialAllocation | null,
  opportunities?: ValidatedOpportunity[]
): WarningLevel {
  const warnings: string[] = [];

  // Only applies to specialize approach
  if (allocation?.strategicApproach !== 'specialize') {
    return { level: 'none', message: '', details: [] };
  }

  // Check target income vs market size
  const targetIncome = allocation?.targetIncomeFromIdea || 0;
  if (targetIncome > 200000) {
    warnings.push('High income target in a specialized niche may be difficult');
  }

  // Check opportunities for small market indicators
  if (opportunities && opportunities.length > 0) {
    const smallMarkets = opportunities.filter(o =>
      o.marketSize?.toLowerCase().includes('small') ||
      o.marketSize?.toLowerCase().includes('niche') ||
      o.marketSize?.toLowerCase().includes('limited')
    );

    if (smallMarkets.length > 0) {
      warnings.push('Market size indicators suggest limited addressable market');
    }

    // Check for validation warnings
    const hasValidationWarnings = opportunities.some(
      o => o.validationWarnings && o.validationWarnings.length > 0
    );
    if (hasValidationWarnings) {
      warnings.push('Some opportunities have validation concerns');
    }
  }

  // Check strategy differentiators
  if (strategy?.differentiators) {
    const tooNarrow = strategy.differentiators.some(
      d => d.toLowerCase().includes('only') ||
           d.toLowerCase().includes('exclusively') ||
           d.toLowerCase().includes('sole')
    );
    if (tooNarrow) {
      warnings.push('Differentiation may be too narrow to sustain');
    }
  }

  // Determine warning level
  if (warnings.length === 0) {
    return { level: 'none', message: '', details: [] };
  }

  if (warnings.length >= 3) {
    return {
      level: 'high',
      message: 'High risk of niche trap',
      details: warnings,
    };
  }

  if (warnings.length >= 2) {
    return {
      level: 'medium',
      message: 'Moderate niche trap risk',
      details: warnings,
    };
  }

  return {
    level: 'low',
    message: 'Minor niche concerns',
    details: warnings,
  };
}

const getWarningStyles = (level: 'low' | 'medium' | 'high') => {
  switch (level) {
    case 'high':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-500',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-500',
      };
    case 'low':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        icon: 'text-blue-500',
      };
  }
};

export default function NicheTrapWarning({
  strategy,
  allocation,
  opportunities,
  className = '',
}: Props) {
  const warning = analyzeNicheTrap(strategy, allocation, opportunities);

  if (warning.level === 'none') {
    return null;
  }

  const styles = getWarningStyles(warning.level);

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <svg
          className={`w-5 h-5 flex-shrink-0 ${styles.icon}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <h4 className={`text-sm font-medium ${styles.text}`}>
            {warning.message}
          </h4>
          <ul className="mt-2 space-y-1">
            {warning.details.map((detail, idx) => (
              <li key={idx} className={`text-sm ${styles.text} opacity-80`}>
                {detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-600">
            <strong>Consider:</strong> Validate demand before committing.
            Ensure the niche is large enough to sustain your income goals.
          </p>
        </div>
      </div>
    </div>
  );
}
