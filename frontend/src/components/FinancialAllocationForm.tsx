import { useState, useEffect } from 'react';
import type {
  IdeaFinancialAllocation,
  AllocationPriority,
  IncomeType,
  PivotWillingness,
  RiskTolerance,
  UserProfileSummary,
} from '../types';
import {
  allocationPriorityMeta,
  incomeTypeMeta,
} from '../types';
import { getFinancialAllocation, saveFinancialAllocation } from '../api/client';

interface Props {
  slug: string;
  profile?: UserProfileSummary | null;
  onSave?: (allocation: IdeaFinancialAllocation) => void;
  onNext?: () => void;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const parseCurrency = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

export default function FinancialAllocationForm({ slug, profile, onSave, onNext }: Props) {
  const [allocation, setAllocation] = useState<Partial<IdeaFinancialAllocation>>({
    allocatedBudget: 0,
    allocatedWeeklyHours: 0,
    allocatedRunwayMonths: 0,
    allocationPriority: 'exploration',
    targetIncomeFromIdea: null,
    incomeTimelineMonths: null,
    incomeType: 'supplement',
    exitIntent: false,
    ideaRiskTolerance: null,
    maxAcceptableLoss: null,
    pivotWillingness: 'moderate',
    validationBudget: 0,
    maxTimeToValidateMonths: null,
    killCriteria: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAllocation() {
      try {
        setLoading(true);
        const data = await getFinancialAllocation(slug);
        if (data.exists) {
          setAllocation(data);
        }
      } catch (err) {
        console.error('Failed to load allocation:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAllocation();
  }, [slug]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await saveFinancialAllocation(slug, allocation);
      if (onSave) {
        onSave(allocation as IdeaFinancialAllocation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    await handleSave();
    if (!error && onNext) {
      onNext();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Calculate totals from profile if available
  const totalCapacity = profile?.total_investment_capacity ?? null;
  const totalHours = profile?.weekly_hours_available ?? null;

  return (
    <div className="space-y-8">
      {/* Header with Profile Context */}
      {profile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">Your Total Capacity</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-600">Investment:</span>{' '}
              <span className="font-medium">
                {totalCapacity ? formatCurrency(totalCapacity) : 'Not set'}
              </span>
            </div>
            <div>
              <span className="text-blue-600">Time:</span>{' '}
              <span className="font-medium">
                {totalHours ? `${totalHours} hrs/week` : 'Not set'}
              </span>
            </div>
            <div>
              <span className="text-blue-600">Base Risk:</span>{' '}
              <span className="font-medium capitalize">
                {profile.risk_tolerance ?? 'Not set'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Resource Allocation Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Resource Allocation for This Idea</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allocated Budget
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="text"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={allocation.allocatedBudget || ''}
                onChange={(e) => {
                  const val = parseCurrency(e.target.value);
                  setAllocation({ ...allocation, allocatedBudget: val ?? 0 });
                }}
                placeholder="0"
              />
            </div>
            {totalCapacity && (
              <p className="text-xs text-gray-500 mt-1">
                Max: {formatCurrency(totalCapacity)}
              </p>
            )}
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weekly Hours
            </label>
            <input
              type="number"
              min="0"
              max="80"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={allocation.allocatedWeeklyHours || ''}
              onChange={(e) => {
                setAllocation({
                  ...allocation,
                  allocatedWeeklyHours: parseFloat(e.target.value) || 0,
                });
              }}
              placeholder="0"
            />
            {totalHours && (
              <p className="text-xs text-gray-500 mt-1">Max: {totalHours} hrs/week</p>
            )}
          </div>

          {/* Runway */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Runway (months)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={allocation.allocatedRunwayMonths || ''}
              onChange={(e) => {
                setAllocation({
                  ...allocation,
                  allocatedRunwayMonths: parseInt(e.target.value) || 0,
                });
              }}
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long can you fund this idea?
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority Level
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={allocation.allocationPriority || 'exploration'}
              onChange={(e) => {
                setAllocation({
                  ...allocation,
                  allocationPriority: e.target.value as AllocationPriority,
                });
              }}
            >
              {Object.entries(allocationPriorityMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label} - {meta.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Income Goals Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Income Goals from This Idea</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Target Income */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Annual Income
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="text"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={allocation.targetIncomeFromIdea || ''}
                onChange={(e) => {
                  setAllocation({
                    ...allocation,
                    targetIncomeFromIdea: parseCurrency(e.target.value),
                  });
                }}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeline to Target (months)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={allocation.incomeTimelineMonths || ''}
              onChange={(e) => {
                setAllocation({
                  ...allocation,
                  incomeTimelineMonths: parseInt(e.target.value) || null,
                });
              }}
              placeholder="Optional"
            />
          </div>

          {/* Income Type */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Income Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(incomeTypeMeta).map(([key, meta]) => (
                <label
                  key={key}
                  className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    allocation.incomeType === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="incomeType"
                    value={key}
                    checked={allocation.incomeType === key}
                    onChange={() => {
                      setAllocation({ ...allocation, incomeType: key as IncomeType });
                    }}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="text-xs text-gray-500 text-center mt-1">
                    {meta.description}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Exit Intent */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allocation.exitIntent || false}
                onChange={(e) => {
                  setAllocation({ ...allocation, exitIntent: e.target.checked });
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Building to sell (exit intent)
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* Risk Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Risk Tolerance for This Idea</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Risk Tolerance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Level
              {profile?.risk_tolerance && (
                <span className="text-gray-500 font-normal">
                  {' '}
                  (Your baseline: {profile.risk_tolerance})
                </span>
              )}
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'very_high'] as RiskTolerance[]).map((level) => (
                <label
                  key={level}
                  className={`flex-1 text-center py-2 px-3 border rounded-lg cursor-pointer transition-colors ${
                    allocation.ideaRiskTolerance === level
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="riskTolerance"
                    value={level}
                    checked={allocation.ideaRiskTolerance === level}
                    onChange={() => {
                      setAllocation({ ...allocation, ideaRiskTolerance: level });
                    }}
                    className="sr-only"
                  />
                  <span className="text-sm capitalize">{level.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Max Loss */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Acceptable Loss
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="text"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={allocation.maxAcceptableLoss || ''}
                onChange={(e) => {
                  setAllocation({
                    ...allocation,
                    maxAcceptableLoss: parseCurrency(e.target.value),
                  });
                }}
                placeholder="Walk-away point"
              />
            </div>
          </div>

          {/* Pivot Willingness */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pivot Willingness
            </label>
            <div className="flex gap-2">
              {(['rigid', 'moderate', 'flexible', 'very_flexible'] as PivotWillingness[]).map(
                (level) => (
                  <label
                    key={level}
                    className={`flex-1 text-center py-2 px-3 border rounded-lg cursor-pointer transition-colors ${
                      allocation.pivotWillingness === level
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pivotWillingness"
                      value={level}
                      checked={allocation.pivotWillingness === level}
                      onChange={() => {
                        setAllocation({ ...allocation, pivotWillingness: level });
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm capitalize">{level.replace('_', ' ')}</span>
                  </label>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Validation Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Validation Budget</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Validation Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pre-commit Validation Budget
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="text"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={allocation.validationBudget || ''}
                onChange={(e) => {
                  setAllocation({
                    ...allocation,
                    validationBudget: parseCurrency(e.target.value) ?? 0,
                  });
                }}
                placeholder="0"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              How much to spend testing before full commitment
            </p>
          </div>

          {/* Max Validation Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Validation Time (months)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={allocation.maxTimeToValidateMonths || ''}
              onChange={(e) => {
                setAllocation({
                  ...allocation,
                  maxTimeToValidateMonths: parseInt(e.target.value) || null,
                });
              }}
              placeholder="Optional"
            />
          </div>

          {/* Kill Criteria */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kill Criteria
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              value={allocation.killCriteria || ''}
              onChange={(e) => {
                setAllocation({ ...allocation, killCriteria: e.target.value || null });
              }}
              placeholder="When should you stop? e.g., 'No paying customers after 3 months'"
            />
          </div>
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Continue to Approach Selection'}
        </button>
      </div>
    </div>
  );
}
