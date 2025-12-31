import { Check, Lightbulb, Search, Sparkles, RefreshCw, BarChart3, Repeat } from 'lucide-react'
import clsx from 'clsx'
import type { LifecycleStage } from '../types'

interface LifecycleTimelineProps {
  currentStage: LifecycleStage
  incubationPhase?: string
}

// New 6-phase incubation system
const incubationPhases = [
  {
    id: 'capture',
    label: 'Capture',
    icon: Lightbulb,
    color: 'bg-purple-500',
    description: 'Initial idea capture and documentation'
  },
  {
    id: 'clarify',
    label: 'Clarify',
    icon: Search,
    color: 'bg-blue-500',
    description: 'Gap analysis and assumption identification'
  },
  {
    id: 'position',
    label: 'Position',
    icon: Sparkles,
    color: 'bg-cyan-500',
    description: 'Strategic positioning and financial planning'
  },
  {
    id: 'update',
    label: 'Update',
    icon: RefreshCw,
    color: 'bg-amber-500',
    description: 'Refine based on insights'
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    icon: BarChart3,
    color: 'bg-green-500',
    description: 'AI-powered scoring against 30 criteria'
  },
  {
    id: 'iterate',
    label: 'Iterate',
    icon: Repeat,
    color: 'bg-orange-500',
    description: 'Improve based on evaluation results'
  }
]

// Map old lifecycle stages to incubation phases
function mapStageToPhase(stage: LifecycleStage): string {
  const mapping: Record<string, string> = {
    'SPARK': 'capture',
    'CLARIFY': 'clarify',
    'RESEARCH': 'clarify',
    'IDEATE': 'position',
    'EVALUATE': 'evaluate',
    'VALIDATE': 'evaluate',
    'DESIGN': 'iterate',
    'PROTOTYPE': 'iterate',
    'TEST': 'iterate',
    'REFINE': 'iterate',
    'BUILD': 'iterate',
    'LAUNCH': 'iterate',
    'GROW': 'iterate',
    'MAINTAIN': 'iterate',
    'PIVOT': 'position',
    'PAUSE': 'capture',
    'SUNSET': 'iterate',
    'ARCHIVE': 'iterate',
    'ABANDONED': 'capture'
  }
  return mapping[stage] || 'capture'
}

export default function LifecycleTimeline({ currentStage, incubationPhase }: LifecycleTimelineProps) {
  // Use explicit incubation phase if provided, otherwise map from lifecycle stage
  const currentPhaseId = incubationPhase || mapStageToPhase(currentStage)
  const currentIndex = incubationPhases.findIndex(p => p.id === currentPhaseId)

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Incubation Progress</h3>

      {/* Timeline */}
      <div className="relative min-w-max">
        {/* Progress Line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200">
          {currentIndex >= 0 && (
            <div
              className="h-full bg-primary-500 transition-all duration-500"
              style={{
                width: `${((currentIndex + 1) / incubationPhases.length) * 100}%`,
              }}
            />
          )}
        </div>

        {/* Phase Dots */}
        <div className="relative flex justify-between px-4">
          {incubationPhases.map((phase, index) => {
            const isPast = index < currentIndex
            const isCurrent = index === currentIndex
            const isFuture = index > currentIndex
            const Icon = phase.icon

            return (
              <div
                key={phase.id}
                className="flex flex-col items-center"
                style={{ minWidth: '80px' }}
              >
                {/* Dot */}
                <div
                  className={clsx(
                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                    isCurrent && `${phase.color} border-white text-white shadow-lg`,
                    isPast && 'bg-primary-500 border-primary-500 text-white',
                    isFuture && 'bg-white border-gray-300 text-gray-400'
                  )}
                >
                  {isPast ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className={clsx('h-4 w-4', isCurrent && 'fill-current')} />
                  )}
                </div>

                {/* Label */}
                <span
                  className={clsx(
                    'mt-2 text-xs font-medium text-center',
                    isCurrent && 'text-gray-900',
                    isPast && 'text-primary-600',
                    isFuture && 'text-gray-400'
                  )}
                >
                  {phase.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current phase description */}
      {currentIndex >= 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'px-3 py-1 rounded-full text-sm font-medium text-white',
                incubationPhases[currentIndex]?.color || 'bg-gray-500'
              )}
            >
              {incubationPhases[currentIndex]?.label}
            </span>
            <span className="text-sm text-gray-500">
              Phase {currentIndex + 1} of {incubationPhases.length}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {incubationPhases[currentIndex]?.description}
          </p>
        </div>
      )}
    </div>
  )
}
