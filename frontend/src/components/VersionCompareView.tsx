import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { VersionDiff } from "../api/client";

interface VersionCompareViewProps {
  diff: VersionDiff;
  onClose?: () => void;
}

function ChangeIndicator({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="flex items-center gap-1 text-green-600">
        <TrendingUp className="h-4 w-4" />+{delta.toFixed(1)}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600">
        <TrendingDown className="h-4 w-4" />
        {delta.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-gray-400">
      <Minus className="h-4 w-4" />0
    </span>
  );
}

export default function VersionCompareView({
  diff,
  onClose,
}: VersionCompareViewProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          Version Comparison
          <span className="text-sm font-normal text-gray-500">
            v{diff.from} <ArrowRight className="inline h-4 w-4" /> v{diff.to}
          </span>
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        )}
      </div>

      {/* Content Changes */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Content Changes
        </h4>
        {diff.contentChanges.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No significant content changes detected.
          </p>
        ) : (
          <div className="space-y-3">
            {diff.contentChanges.map((change, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700 capitalize">
                    {change.field.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  <div className="p-3">
                    <div className="text-xs font-medium text-red-600 mb-1">
                      Before (v{diff.from})
                    </div>
                    <div className="text-sm text-gray-600 bg-red-50 p-2 rounded">
                      {change.before || (
                        <span className="italic text-gray-400">(empty)</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-medium text-green-600 mb-1">
                      After (v{diff.to})
                    </div>
                    <div className="text-sm text-gray-600 bg-green-50 p-2 rounded">
                      {change.after || (
                        <span className="italic text-gray-400">(empty)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Score Changes */}
      {diff.scoreChanges && diff.scoreChanges.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Score Changes
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    Criterion
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-700">
                    v{diff.from}
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-700">
                    v{diff.to}
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-700">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {diff.scoreChanges.map((change, index) => (
                  <tr
                    key={index}
                    className={`border-b border-gray-100 ${
                      change.delta > 0
                        ? "bg-green-50"
                        : change.delta < 0
                          ? "bg-red-50"
                          : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-medium text-gray-900">
                      {change.criterion}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-600">
                      {change.before.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-600">
                      {change.after.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <ChangeIndicator delta={change.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
