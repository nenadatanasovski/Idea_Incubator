import { CheckCircle, AlertTriangle, Clock, Zap } from 'lucide-react'
import type { ReadinessScore, CriterionCoverage } from '../types'
import { readinessLevels, categoryNames } from '../types'

interface ReadinessMeterProps {
  readiness: ReadinessScore
  coverage?: CriterionCoverage[]
  onDevelop?: () => void
  onEvaluate?: () => void
  showDetails?: boolean
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

function CategoryProgress({ category, value }: { category: string; value: number }) {
  const color = value >= 0.8 ? 'bg-green-500' : value >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-24 truncate">{category}</span>
      <div className="flex-1">
        <ProgressBar value={value} color={color} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

function ReadinessIcon({ level }: { level: ReadinessScore['readinessLevel'] }) {
  switch (level) {
    case 'SPARK':
      return <Zap className="h-5 w-5 text-purple-500" />
    case 'CLARIFY':
      return <Clock className="h-5 w-5 text-blue-500" />
    case 'READY':
      return <AlertTriangle className="h-5 w-5 text-green-500" />
    case 'CONFIDENT':
      return <CheckCircle className="h-5 w-5 text-emerald-500" />
    default:
      return null
  }
}

export default function ReadinessMeter({
  readiness,
  coverage: _coverage,
  onDevelop,
  onEvaluate,
  showDetails = true
}: ReadinessMeterProps) {
  const levelMeta = readinessLevels[readiness.readinessLevel]
  const overallPercent = Math.round(readiness.overall * 100)

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${levelMeta.color} bg-opacity-20`}>
            <ReadinessIcon level={readiness.readinessLevel} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Idea Readiness</h3>
            <p className="text-sm text-gray-500">{levelMeta.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{overallPercent}%</div>
          <div className={`text-sm font-medium ${levelMeta.color.replace('bg-', 'text-')}`}>
            {levelMeta.label}
          </div>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="mt-4">
        <ProgressBar value={readiness.overall} color={levelMeta.color} />
      </div>

      {/* Category Breakdown */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Coverage by Category</h4>
          <div className="space-y-2">
            <CategoryProgress
              category={categoryNames.problem}
              value={readiness.byCategory.problem}
            />
            <CategoryProgress
              category={categoryNames.solution}
              value={readiness.byCategory.solution}
            />
            <CategoryProgress
              category={categoryNames.feasibility}
              value={readiness.byCategory.feasibility}
            />
            <CategoryProgress
              category={categoryNames.fit}
              value={readiness.byCategory.fit}
            />
            <CategoryProgress
              category={categoryNames.market}
              value={readiness.byCategory.market}
            />
            <CategoryProgress
              category={categoryNames.risk}
              value={readiness.byCategory.risk}
            />
            {readiness.byCategory.business_model !== undefined && (
              <CategoryProgress
                category={categoryNames.business_model}
                value={readiness.byCategory.business_model}
              />
            )}
          </div>
        </div>
      )}

      {/* Blocking Gaps */}
      {readiness.blockingGaps.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Critical Questions Unanswered
          </h4>
          <ul className="space-y-1">
            {readiness.blockingGaps.slice(0, 3).map((gap, index) => (
              <li key={index} className="text-sm text-gray-600">
                {gap}
              </li>
            ))}
            {readiness.blockingGaps.length > 3 && (
              <li className="text-sm text-gray-500 italic">
                +{readiness.blockingGaps.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      {(onDevelop || onEvaluate) && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-3">
          {onDevelop && (
            <button
              onClick={onDevelop}
              className="btn btn-secondary flex-1"
            >
              Develop Idea
            </button>
          )}
          {onEvaluate && (
            <button
              onClick={onEvaluate}
              disabled={!readiness.readyForEvaluation}
              className={`btn flex-1 ${
                readiness.readyForEvaluation
                  ? 'btn-primary'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={
                readiness.readyForEvaluation
                  ? 'Run evaluation'
                  : 'Answer more questions to enable evaluation'
              }
            >
              Run Evaluation
            </button>
          )}
        </div>
      )}
    </div>
  )
}
