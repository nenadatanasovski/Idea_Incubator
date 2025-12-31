import { useState } from 'react';
import type {
  PositioningDecision,
  EnhancedStrategy,
  TimingDecision,
  StrategicApproach,
  RiskResponse,
  RiskResponseType,
  DisagreeReason,
  RiskResponseStats,
} from '../types';
import { strategicApproachMeta, riskResponseMeta, disagreeReasonMeta } from '../types';
import { savePositioningDecision } from '../api/client';

interface Risk {
  id: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  mitigation?: string;
}

interface Props {
  slug: string;
  strategies: EnhancedStrategy[];
  risks: Risk[];
  selectedStrategyId: string | null;
  selectedApproach: StrategicApproach | null;
  timingUrgency?: 'high' | 'medium' | 'low';
  timingWindow?: string;
  onComplete: (decision: PositioningDecision) => void;
  onBack?: () => void;
}

export default function DecisionCapture({
  slug,
  strategies,
  risks,
  selectedStrategyId,
  selectedApproach,
  timingUrgency,
  timingWindow,
  onComplete,
  onBack,
}: Props) {
  const [decision, setDecision] = useState<Partial<PositioningDecision>>({
    primaryStrategyId: selectedStrategyId,
    primaryStrategyName: strategies.find(s => (s.id || s.name) === selectedStrategyId)?.name,
    selectedApproach,
    acknowledgedRiskIds: [],
    riskResponses: [],
    timingDecision: null,
    timingRationale: null,
    notes: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Build a map of risk responses for easy lookup
  const riskResponseMap = new Map<string, RiskResponse>(
    (decision.riskResponses || []).map(r => [r.riskId, r])
  );

  // Calculate stats
  const calculateStats = (responses: RiskResponse[]): RiskResponseStats => ({
    total: risks.length,
    responded: responses.filter(r => r.response !== 'skip').length,
    mitigate: responses.filter(r => r.response === 'mitigate').length,
    accept: responses.filter(r => r.response === 'accept').length,
    monitor: responses.filter(r => r.response === 'monitor').length,
    disagree: responses.filter(r => r.response === 'disagree').length,
    skipped: responses.filter(r => r.response === 'skip').length,
  });

  const stats = calculateStats(decision.riskResponses || []);

  // Handle risk response selection
  const handleRiskResponse = (
    risk: Risk,
    responseType: RiskResponseType,
    details?: { disagreeReason?: DisagreeReason; reasoning?: string; mitigationPlan?: string }
  ) => {
    const existingResponses = decision.riskResponses || [];
    const filtered = existingResponses.filter(r => r.riskId !== risk.id);

    const newResponse: RiskResponse = {
      riskId: risk.id,
      riskDescription: risk.description,
      riskSeverity: risk.severity,
      response: responseType,
      disagreeReason: details?.disagreeReason,
      reasoning: details?.reasoning,
      mitigationPlan: details?.mitigationPlan,
      respondedAt: new Date().toISOString(),
    };

    // Also update legacy acknowledgedRiskIds for backward compatibility
    const acknowledgedRiskIds = responseType !== 'skip' && responseType !== 'disagree'
      ? [...new Set([...(decision.acknowledgedRiskIds || []), risk.id])]
      : (decision.acknowledgedRiskIds || []).filter(id => id !== risk.id);

    setDecision({
      ...decision,
      riskResponses: [...filtered, newResponse],
      acknowledgedRiskIds,
    });

    // Collapse after selecting
    if (responseType !== 'disagree' && responseType !== 'mitigate') {
      setExpandedRiskId(null);
    }
  };

  const handleTimingChange = (timing: TimingDecision) => {
    setDecision({ ...decision, timingDecision: timing });
  };

  const handleSubmit = async () => {
    // Validation - only require strategy and timing
    if (!decision.primaryStrategyId) {
      setError('Please select a primary strategy');
      return;
    }
    if (!decision.timingDecision) {
      setError('Please make a timing decision');
      return;
    }

    // Show gentle hint if no risk responses, but don't block
    if ((decision.riskResponses || []).length === 0 && risks.length > 0) {
      if (!showHint) {
        setShowHint(true);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const finalDecision: PositioningDecision = {
        ...decision as PositioningDecision,
        riskResponseStats: calculateStats(decision.riskResponses || []),
      };

      await savePositioningDecision(slug, finalDecision);
      onComplete(finalDecision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save decision');
    } finally {
      setSaving(false);
    }
  };

  const selectedStrategy = strategies.find(s => (s.id || s.name) === decision.primaryStrategyId);

  // Sort risks: high severity first, then by whether they have a response
  const sortedRisks = [...risks].sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const aHasResponse = riskResponseMap.has(a.id);
    const bHasResponse = riskResponseMap.has(b.id);

    if (aHasResponse !== bHasResponse) return aHasResponse ? 1 : -1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Capture Your Positioning Decision</h3>
        <p className="text-gray-600 mt-1">
          Review your choices and confirm your strategic direction before updating the idea.
        </p>
      </div>

      {/* Selected Strategy Summary */}
      <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Selected Strategy</h4>
        {selectedStrategy ? (
          <div>
            <p className="font-semibold text-gray-900">{selectedStrategy.name}</p>
            <p className="text-sm text-gray-600 mt-1">{selectedStrategy.description}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-blue-600">
                Fit Score: {selectedStrategy.fitWithProfile}/10
              </span>
              {selectedApproach && (
                <span className="text-gray-600">
                  Approach: {strategicApproachMeta[selectedApproach].label}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-amber-600">No strategy selected. Please go back and select one.</p>
        )}

        {/* Optional: Secondary Strategy */}
        {strategies.length > 1 && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Strategy (optional backup)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={decision.secondaryStrategyId || ''}
              onChange={(e) => {
                const id = e.target.value || null;
                const name = strategies.find(s => (s.id || s.name) === id)?.name || null;
                setDecision({
                  ...decision,
                  secondaryStrategyId: id,
                  secondaryStrategyName: name,
                });
              }}
            >
              <option value="">None</option>
              {strategies
                .filter(s => (s.id || s.name) !== decision.primaryStrategyId)
                .map(s => (
                  <option key={s.id || s.name} value={s.id || s.name}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      {/* Risk Assessment Section */}
      {risks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-medium text-gray-900">
                Risk Assessment
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Optional)
                </span>
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Review the identified risks and share your perspective. Your responses help refine Update phase suggestions.
              </p>
            </div>
            {stats.responded > 0 && (
              <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {stats.responded} of {risks.length} responded
              </div>
            )}
          </div>

          <div className="space-y-3">
            {sortedRisks.map(risk => {
              const existingResponse = riskResponseMap.get(risk.id);
              const isExpanded = expandedRiskId === risk.id;
              const severityColors = {
                high: 'bg-red-100 text-red-700 border-red-200',
                medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                low: 'bg-gray-100 text-gray-600 border-gray-200'
              };

              return (
                <div
                  key={risk.id}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    existingResponse
                      ? riskResponseMeta[existingResponse.response].bgColor
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Risk Header */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${severityColors[risk.severity]}`}>
                        {risk.severity.toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium">{risk.description}</p>
                        {risk.mitigation && (
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">AI Suggested:</span> {risk.mitigation}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Response Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(['mitigate', 'accept', 'monitor', 'disagree', 'skip'] as RiskResponseType[]).map(responseType => {
                        const meta = riskResponseMeta[responseType];
                        const isSelected = existingResponse?.response === responseType;

                        return (
                          <button
                            key={responseType}
                            onClick={() => {
                              if (responseType === 'disagree' || responseType === 'mitigate') {
                                setExpandedRiskId(isExpanded && existingResponse?.response === responseType ? null : risk.id);
                                handleRiskResponse(risk, responseType);
                              } else {
                                handleRiskResponse(risk, responseType);
                                setExpandedRiskId(null);
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all border ${
                              isSelected
                                ? `${meta.bgColor} ${meta.color} ring-2 ring-offset-1`
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                            title={meta.description}
                          >
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expanded Details Section */}
                  {isExpanded && existingResponse && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                      {existingResponse.response === 'disagree' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Why do you disagree?
                          </label>
                          <div className="space-y-2">
                            {(['not_applicable', 'already_addressed', 'low_likelihood', 'insider_knowledge', 'other'] as DisagreeReason[]).map(reason => (
                              <label key={reason} className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`disagree-${risk.id}`}
                                  checked={existingResponse.disagreeReason === reason}
                                  onChange={() => handleRiskResponse(risk, 'disagree', {
                                    ...existingResponse,
                                    disagreeReason: reason
                                  })}
                                  className="mt-1"
                                />
                                <div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {disagreeReasonMeta[reason].label}
                                  </span>
                                  <p className="text-xs text-gray-500">
                                    {disagreeReasonMeta[reason].description}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {(existingResponse.response === 'mitigate' || existingResponse.response === 'monitor') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your mitigation plan
                          </label>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            placeholder="How will you address this risk?"
                            value={existingResponse.mitigationPlan || ''}
                            onChange={(e) => handleRiskResponse(risk, existingResponse.response, {
                              ...existingResponse,
                              mitigationPlan: e.target.value
                            })}
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Additional reasoning (optional)
                        </label>
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                          placeholder="Any additional context..."
                          value={existingResponse.reasoning || ''}
                          onChange={(e) => handleRiskResponse(risk, existingResponse.response, {
                            ...existingResponse,
                            reasoning: e.target.value
                          })}
                        />
                      </div>

                      <button
                        onClick={() => setExpandedRiskId(null)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Response Summary */}
          {stats.responded > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {stats.mitigate > 0 && (
                <span className="text-blue-600">{stats.mitigate} mitigating</span>
              )}
              {stats.accept > 0 && (
                <span className="text-green-600">{stats.accept} accepted</span>
              )}
              {stats.monitor > 0 && (
                <span className="text-yellow-600">{stats.monitor} monitoring</span>
              )}
              {stats.disagree > 0 && (
                <span className="text-red-600">{stats.disagree} disputed</span>
              )}
              {stats.skipped > 0 && (
                <span className="text-gray-500">{stats.skipped} skipped</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Timing Decision */}
      <section>
        <h4 className="font-medium text-gray-900 mb-3">Timing Decision</h4>
        {(timingUrgency || timingWindow) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm">
            {timingUrgency && (
              <p>
                <strong>Market Urgency:</strong>{' '}
                <span
                  className={
                    timingUrgency === 'high'
                      ? 'text-red-600'
                      : timingUrgency === 'medium'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }
                >
                  {timingUrgency.toUpperCase()}
                </span>
              </p>
            )}
            {timingWindow && <p className="mt-1">{timingWindow}</p>}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {(['proceed_now', 'wait', 'urgent'] as TimingDecision[]).map(timing => {
            const isSelected = decision.timingDecision === timing;
            return (
              <button
                key={timing}
                onClick={() => handleTimingChange(timing)}
                className={`p-4 border rounded-lg text-center transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">
                  {timing === 'proceed_now' && '▶️'}
                  {timing === 'wait' && '⏸️'}
                  {timing === 'urgent' && '🚀'}
                </div>
                <div className="font-medium text-gray-900">
                  {timing === 'proceed_now' && 'Proceed Now'}
                  {timing === 'wait' && 'Wait'}
                  {timing === 'urgent' && 'Urgent'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {timing === 'proceed_now' && 'Start work at normal pace'}
                  {timing === 'wait' && 'Hold for better timing'}
                  {timing === 'urgent' && 'Act fast, window closing'}
                </div>
              </button>
            );
          })}
        </div>

        {decision.timingDecision && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timing Rationale (optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Why this timing decision?"
              value={decision.timingRationale || ''}
              onChange={(e) =>
                setDecision({ ...decision, timingRationale: e.target.value || null })
              }
            />
          </div>
        )}
      </section>

      {/* Notes */}
      <section>
        <h4 className="font-medium text-gray-900 mb-3">Additional Notes</h4>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Any additional context or decisions to capture..."
          value={decision.notes || ''}
          onChange={(e) => setDecision({ ...decision, notes: e.target.value || null })}
        />
      </section>

      {/* Decision Summary */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Decision Summary</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-32 text-gray-500">Primary Strategy:</dt>
            <dd className="font-medium text-gray-900">
              {decision.primaryStrategyName || 'Not selected'}
            </dd>
          </div>
          {decision.secondaryStrategyName && (
            <div className="flex">
              <dt className="w-32 text-gray-500">Secondary:</dt>
              <dd className="text-gray-900">{decision.secondaryStrategyName}</dd>
            </div>
          )}
          {selectedApproach && (
            <div className="flex">
              <dt className="w-32 text-gray-500">Approach:</dt>
              <dd className="text-gray-900">{strategicApproachMeta[selectedApproach].label}</dd>
            </div>
          )}
          <div className="flex">
            <dt className="w-32 text-gray-500">Timing:</dt>
            <dd className="text-gray-900 capitalize">
              {decision.timingDecision?.replace('_', ' ') || 'Not decided'}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-32 text-gray-500">Risks:</dt>
            <dd className="text-gray-900">
              {risks.length === 0
                ? 'No risks identified'
                : stats.responded === 0
                ? `${risks.length} risks (not yet reviewed)`
                : `${stats.responded}/${risks.length} reviewed`}
            </dd>
          </div>
        </dl>
      </section>

      {/* Hint Toast */}
      {showHint && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="font-medium">Tip: Responding to risks helps generate better Update suggestions</p>
              <p className="text-sm mt-1">You can still proceed without reviewing risks, or go back and add your responses.</p>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setShowHint(false)}
                  className="text-sm text-amber-700 hover:text-amber-900 underline"
                >
                  I'll review risks first
                </button>
                <button
                  onClick={() => {
                    setShowHint(false);
                    handleSubmit();
                  }}
                  className="text-sm font-medium text-amber-800 hover:text-amber-900"
                >
                  Continue anyway →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !decision.primaryStrategyId || !decision.timingDecision}
          className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Confirm & Continue to Update'}
        </button>
      </div>
    </div>
  );
}
