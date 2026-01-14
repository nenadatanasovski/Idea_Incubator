/**
 * PRD Coverage Chart Component
 *
 * Visualizes PRD coverage and completion progress.
 * Part of: Task System V2 Implementation Plan (IMPL-7.3)
 */

interface PRDCoverage {
  totalRequirements: number
  coveredRequirements: number
  coveragePercentage: number
  uncoveredRequirements: string[]
}

interface PRDProgress {
  totalTasks: number
  completedTasks: number
  completionPercentage: number
}

interface PRDCoverageChartProps {
  coverage: PRDCoverage
  progress?: PRDProgress | null
}

export default function PRDCoverageChart({ coverage, progress }: PRDCoverageChartProps) {
  const coveragePercent = Math.round(coverage.coveragePercentage)
  const completionPercent = progress ? Math.round(progress.completionPercentage) : 0

  // Calculate colors based on percentage
  const getCoverageColor = (percent: number) => {
    if (percent >= 80) return { bar: 'bg-green-500', text: 'text-green-700' }
    if (percent >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700' }
    return { bar: 'bg-red-500', text: 'text-red-700' }
  }

  const getCompletionColor = (percent: number) => {
    if (percent >= 80) return { bar: 'bg-blue-500', text: 'text-blue-700' }
    if (percent >= 50) return { bar: 'bg-blue-400', text: 'text-blue-600' }
    return { bar: 'bg-blue-300', text: 'text-blue-500' }
  }

  const coverageColors = getCoverageColor(coveragePercent)
  const completionColors = getCompletionColor(completionPercent)

  return (
    <div className="space-y-4">
      {/* Coverage Progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Requirement Coverage</span>
          <span className={`text-sm font-semibold ${coverageColors.text}`}>
            {coveragePercent}%
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${coverageColors.bar} transition-all duration-500 rounded-full`}
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>{coverage.coveredRequirements} covered</span>
          <span>{coverage.totalRequirements} total</span>
        </div>
      </div>

      {/* Completion Progress (if available) */}
      {progress && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Task Completion</span>
            <span className={`text-sm font-semibold ${completionColors.text}`}>
              {completionPercent}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${completionColors.bar} transition-all duration-500 rounded-full`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{progress.completedTasks} completed</span>
            <span>{progress.totalTasks} total</span>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{coverage.totalRequirements}</div>
          <div className="text-xs text-gray-500">Requirements</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{coverage.uncoveredRequirements.length}</div>
          <div className="text-xs text-gray-500">Gaps</div>
        </div>
      </div>
    </div>
  )
}
