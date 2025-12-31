import { X, AlertTriangle, CheckCircle, ArrowRight, Pause, Search } from 'lucide-react'
import clsx from 'clsx'
import type { Gap } from './GapAnalysisView'

export type ViabilityDecision = 'proceed' | 'research_more' | 'pause'

interface ViabilityAdvisoryModalProps {
  isOpen: boolean
  readinessPercent: number
  criticalGaps: Gap[]
  significantGaps: Gap[]
  recommendation: ViabilityDecision
  onDecision: (decision: ViabilityDecision, reason?: string) => void
  onClose: () => void
}

const decisionConfig: Record<ViabilityDecision, {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}> = {
  proceed: {
    label: 'Continue to Position',
    description: 'Move forward with strategic positioning and resource allocation',
    icon: ArrowRight,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200'
  },
  research_more: {
    label: 'Address Gaps First',
    description: 'Stay in clarify phase and research critical gaps',
    icon: Search,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200'
  },
  pause: {
    label: 'Pause Idea',
    description: 'Set aside for now and return later',
    icon: Pause,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 hover:bg-gray-100 border-gray-200'
  }
}

export default function ViabilityAdvisoryModal({
  isOpen,
  readinessPercent,
  criticalGaps,
  significantGaps,
  recommendation,
  onDecision,
  onClose
}: ViabilityAdvisoryModalProps) {
  if (!isOpen) return null

  const getRecommendationText = () => {
    if (criticalGaps.length === 0 && readinessPercent >= 80) {
      return 'Your idea is well-developed. Proceeding to the Position phase is recommended.'
    }
    if (criticalGaps.length > 0) {
      return `${criticalGaps.length} critical gap${criticalGaps.length > 1 ? 's' : ''} identified. Consider addressing these before proceeding.`
    }
    if (readinessPercent < 80) {
      return 'Some areas need more development. Consider answering more questions.'
    }
    return 'Review your idea before proceeding.'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Viability Advisory</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Readiness indicator */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-3">
              <span className={clsx(
                'text-2xl font-bold',
                readinessPercent >= 80 ? 'text-green-600' :
                readinessPercent >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>
                {Math.round(readinessPercent)}%
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Readiness Score</h3>
          </div>

          {/* Gaps summary */}
          <div className="space-y-3">
            {criticalGaps.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">
                    {criticalGaps.length} Critical Gap{criticalGaps.length > 1 ? 's' : ''}
                  </p>
                  <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                    {criticalGaps.slice(0, 3).map((gap, idx) => (
                      <li key={idx}>{gap.description}</li>
                    ))}
                    {criticalGaps.length > 3 && (
                      <li className="text-red-600">+{criticalGaps.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {significantGaps.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">
                    {significantGaps.length} Significant Gap{significantGaps.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}

            {criticalGaps.length === 0 && significantGaps.length === 0 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">No Critical Gaps</p>
                  <p className="text-sm text-green-700">Your idea is ready for the next phase</p>
                </div>
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500 mb-1">System Recommendation</p>
            <p className="text-gray-900">{getRecommendationText()}</p>
          </div>

          {/* Decision options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Choose how to proceed:</p>

            {Object.entries(decisionConfig).map(([key, config]) => {
              const Icon = config.icon
              const isRecommended = key === recommendation

              return (
                <button
                  key={key}
                  onClick={() => onDecision(key as ViabilityDecision)}
                  className={clsx(
                    'w-full p-4 rounded-lg border-2 transition-all text-left',
                    config.bgColor,
                    isRecommended && 'ring-2 ring-primary-500 ring-offset-2'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', config.color)} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{config.label}</span>
                        {isRecommended && (
                          <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
