import { RefreshCw, Target, TrendingUp } from "lucide-react";
import type { IterationLog } from "../api/client";

interface IterationBannerProps {
  iterationNumber: number;
  latestIteration?: IterationLog;
  previousScore?: number;
  currentScore?: number;
}

export default function IterationBanner({
  iterationNumber,
  latestIteration,
  previousScore,
  currentScore,
}: IterationBannerProps) {
  if (iterationNumber <= 1) {
    return null;
  }

  const improvement =
    previousScore && currentScore ? currentScore - previousScore : null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-full">
          <RefreshCw className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-amber-900">
              Iteration {iterationNumber}
            </h3>
            {improvement !== null && (
              <span
                className={`text-sm px-2 py-0.5 rounded-full ${
                  improvement > 0
                    ? "bg-green-100 text-green-700"
                    : improvement < 0
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                <TrendingUp className="inline h-3 w-3 mr-1" />
                {improvement >= 0 ? "+" : ""}
                {improvement.toFixed(1)} points
              </span>
            )}
          </div>

          {latestIteration && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <Target className="h-4 w-4" />
                <span>Focus: {latestIteration.userDirection}</span>
              </div>

              {latestIteration.triggerCriteria.length > 0 && (
                <div className="text-sm text-amber-700">
                  <span className="font-medium">Targeting: </span>
                  {latestIteration.triggerCriteria.join(", ")}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-amber-600 mt-2">
                <span>
                  Started:{" "}
                  {new Date(latestIteration.createdAt).toLocaleDateString()}
                </span>
                <span>
                  Previous score: {latestIteration.previousScore.toFixed(1)}/10
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
