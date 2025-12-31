import { RefreshCw, TrendingUp, TrendingDown, Target, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface WeakCategory {
  category: string
  score: number
  targetScore?: number
}

interface IterationHeaderProps {
  iterationNumber: number
  previousScore?: number
  currentScore?: number
  targetScore?: number
  focusAreas: string[]
  weakCategories: WeakCategory[]
  userDirection?: string
  className?: string
}

export default function IterationHeader({
  iterationNumber,
  previousScore,
  currentScore,
  targetScore = 7.5,
  focusAreas,
  weakCategories,
  userDirection,
  className
}: IterationHeaderProps) {
  const scoreDelta = previousScore !== undefined && currentScore !== undefined
    ? currentScore - previousScore
    : null

  const hasImproved = scoreDelta !== null && scoreDelta > 0
  const hasDeclined = scoreDelta !== null && scoreDelta < 0

  return (
    <div className={clsx(
      'rounded-lg border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4',
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 text-white">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Iteration {iterationNumber}
          </h3>
          <p className="text-sm text-gray-600">
            Focused improvement cycle
          </p>
        </div>
      </div>

      {/* Score comparison */}
      {(previousScore !== undefined || currentScore !== undefined) && (
        <div className="flex items-center gap-6 mb-4 p-3 bg-white rounded-lg border border-orange-100">
          {previousScore !== undefined && (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Previous</div>
              <div className="text-xl font-bold text-gray-400">
                {previousScore.toFixed(1)}
              </div>
            </div>
          )}

          {scoreDelta !== null && (
            <div className={clsx(
              'flex items-center px-3 py-1 rounded-full text-sm font-medium',
              hasImproved && 'bg-green-100 text-green-700',
              hasDeclined && 'bg-red-100 text-red-700',
              !hasImproved && !hasDeclined && 'bg-gray-100 text-gray-700'
            )}>
              {hasImproved ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : hasDeclined ? (
                <TrendingDown className="h-4 w-4 mr-1" />
              ) : null}
              {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
            </div>
          )}

          {currentScore !== undefined && (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Current</div>
              <div className={clsx(
                'text-xl font-bold',
                currentScore >= 7 ? 'text-green-600' :
                currentScore >= 5 ? 'text-amber-600' : 'text-red-600'
              )}>
                {currentScore.toFixed(1)}
              </div>
            </div>
          )}

          <div className="flex items-center text-sm text-gray-500">
            <Target className="h-4 w-4 mr-1" />
            Target: {targetScore}+
          </div>
        </div>
      )}

      {/* Focus areas */}
      {focusAreas.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Focusing on:
          </div>
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((area, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weak categories */}
      {weakCategories.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Areas needing improvement:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {weakCategories.map((cat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-white rounded border border-orange-100"
              >
                <span className="text-sm text-gray-700">{cat.category}</span>
                <span className={clsx(
                  'text-sm font-semibold',
                  cat.score >= 6 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {cat.score.toFixed(1)}/10
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User direction */}
      {userDirection && (
        <div className="p-3 bg-white rounded-lg border border-orange-100">
          <div className="text-xs text-gray-500 mb-1">Your focus direction:</div>
          <p className="text-sm text-gray-800">{userDirection}</p>
        </div>
      )}

      {/* Guidance */}
      <div className="mt-4 pt-4 border-t border-orange-200">
        <p className="text-sm text-gray-600">
          Answer the targeted questions below to strengthen your weak areas.
          Once you've made improvements, re-run the evaluation to track your progress.
        </p>
      </div>
    </div>
  )
}
