import type { RiskResponse, RiskResponseStats } from '../types';
import { riskResponseMeta, disagreeReasonMeta } from '../types';

interface Props {
  responses: RiskResponse[];
  stats: RiskResponseStats | null;
  compact?: boolean;
}

export default function RiskResponseSummary({ responses, stats, compact = false }: Props) {
  if (!responses || responses.length === 0) {
    return null;
  }

  const actualStats = stats || {
    total: responses.length,
    responded: responses.filter(r => r.response !== 'skip').length,
    mitigate: responses.filter(r => r.response === 'mitigate').length,
    accept: responses.filter(r => r.response === 'accept').length,
    monitor: responses.filter(r => r.response === 'monitor').length,
    disagree: responses.filter(r => r.response === 'disagree').length,
    skipped: responses.filter(r => r.response === 'skip').length,
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {actualStats.mitigate > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
            {riskResponseMeta.mitigate.icon} {actualStats.mitigate} mitigating
          </span>
        )}
        {actualStats.accept > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded">
            {riskResponseMeta.accept.icon} {actualStats.accept} accepted
          </span>
        )}
        {actualStats.monitor > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded">
            {riskResponseMeta.monitor.icon} {actualStats.monitor} monitoring
          </span>
        )}
        {actualStats.disagree > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded">
            {riskResponseMeta.disagree.icon} {actualStats.disagree} disputed
          </span>
        )}
      </div>
    );
  }

  // Group responses by type
  const grouped = {
    mitigate: responses.filter(r => r.response === 'mitigate'),
    accept: responses.filter(r => r.response === 'accept'),
    monitor: responses.filter(r => r.response === 'monitor'),
    disagree: responses.filter(r => r.response === 'disagree'),
    skip: responses.filter(r => r.response === 'skip'),
  };

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Risk Assessment Summary</h4>
        <span className="text-sm text-gray-500">
          {actualStats.responded} of {actualStats.total} reviewed
        </span>
      </div>

      {/* Stats bar */}
      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-200">
        {actualStats.mitigate > 0 && (
          <div
            className="bg-blue-500"
            style={{ width: `${(actualStats.mitigate / actualStats.total) * 100}%` }}
            title={`${actualStats.mitigate} mitigating`}
          />
        )}
        {actualStats.accept > 0 && (
          <div
            className="bg-green-500"
            style={{ width: `${(actualStats.accept / actualStats.total) * 100}%` }}
            title={`${actualStats.accept} accepted`}
          />
        )}
        {actualStats.monitor > 0 && (
          <div
            className="bg-yellow-500"
            style={{ width: `${(actualStats.monitor / actualStats.total) * 100}%` }}
            title={`${actualStats.monitor} monitoring`}
          />
        )}
        {actualStats.disagree > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${(actualStats.disagree / actualStats.total) * 100}%` }}
            title={`${actualStats.disagree} disputed`}
          />
        )}
        {actualStats.skipped > 0 && (
          <div
            className="bg-gray-400"
            style={{ width: `${(actualStats.skipped / actualStats.total) * 100}%` }}
            title={`${actualStats.skipped} skipped`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {actualStats.mitigate > 0 && (
          <div className="flex items-center gap-1 text-blue-700">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            {actualStats.mitigate} mitigating
          </div>
        )}
        {actualStats.accept > 0 && (
          <div className="flex items-center gap-1 text-green-700">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            {actualStats.accept} accepted
          </div>
        )}
        {actualStats.monitor > 0 && (
          <div className="flex items-center gap-1 text-yellow-700">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            {actualStats.monitor} monitoring
          </div>
        )}
        {actualStats.disagree > 0 && (
          <div className="flex items-center gap-1 text-red-700">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            {actualStats.disagree} disputed
          </div>
        )}
      </div>

      {/* Detailed sections */}
      <div className="space-y-3 mt-4">
        {/* Disagreements - most important */}
        {grouped.disagree.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h5 className="font-medium text-red-800 mb-2">
              Disputed Risks ({grouped.disagree.length})
            </h5>
            <ul className="space-y-2 text-sm">
              {grouped.disagree.map(r => (
                <li key={r.riskId} className="text-red-700">
                  <div className="font-medium">{r.riskDescription}</div>
                  {r.disagreeReason && (
                    <div className="text-red-600 text-xs mt-0.5">
                      Reason: {disagreeReasonMeta[r.disagreeReason]?.label || r.disagreeReason}
                    </div>
                  )}
                  {r.reasoning && (
                    <div className="text-red-600 text-xs italic mt-0.5">
                      "{r.reasoning}"
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mitigations */}
        {grouped.mitigate.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h5 className="font-medium text-blue-800 mb-2">
              Risks Being Mitigated ({grouped.mitigate.length})
            </h5>
            <ul className="space-y-2 text-sm">
              {grouped.mitigate.map(r => (
                <li key={r.riskId} className="text-blue-700">
                  <div className="font-medium">{r.riskDescription}</div>
                  {r.mitigationPlan && (
                    <div className="text-blue-600 text-xs mt-0.5">
                      Plan: {r.mitigationPlan}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Monitoring */}
        {grouped.monitor.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <h5 className="font-medium text-yellow-800 mb-2">
              Risks Being Monitored ({grouped.monitor.length})
            </h5>
            <ul className="space-y-1 text-sm text-yellow-700">
              {grouped.monitor.map(r => (
                <li key={r.riskId}>
                  {r.riskDescription}
                  {r.mitigationPlan && (
                    <span className="text-yellow-600 text-xs ml-2">
                      ({r.mitigationPlan})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Accepted */}
        {grouped.accept.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h5 className="font-medium text-green-800 mb-2">
              Accepted Risks ({grouped.accept.length})
            </h5>
            <ul className="space-y-1 text-sm text-green-700">
              {grouped.accept.map(r => (
                <li key={r.riskId}>{r.riskDescription}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
