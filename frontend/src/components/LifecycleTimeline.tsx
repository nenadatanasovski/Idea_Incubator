import { lifecycleStages } from '../types'
import type { LifecycleStage } from '../types'
import { Check, Circle, Pause, Archive, XCircle } from 'lucide-react'
import clsx from 'clsx'

interface LifecycleTimelineProps {
  currentStage: LifecycleStage
}

// Main progression stages (linear flow)
const mainStages: LifecycleStage[] = [
  'SPARK',
  'CLARIFY',
  'RESEARCH',
  'IDEATE',
  'EVALUATE',
  'VALIDATE',
  'DESIGN',
  'PROTOTYPE',
  'TEST',
  'REFINE',
  'BUILD',
  'LAUNCH',
  'GROW',
  'MAINTAIN',
]

// Exit stages (branching off)
const exitStages: LifecycleStage[] = ['PIVOT', 'PAUSE', 'SUNSET', 'ARCHIVE', 'ABANDONED']

function getStageIcon(stage: LifecycleStage, isCurrent: boolean, isPast: boolean) {
  if (exitStages.includes(stage)) {
    if (stage === 'PAUSE') return <Pause className="h-4 w-4" />
    if (stage === 'ARCHIVE' || stage === 'SUNSET') return <Archive className="h-4 w-4" />
    if (stage === 'ABANDONED') return <XCircle className="h-4 w-4" />
    return <Circle className="h-4 w-4" />
  }

  if (isPast) return <Check className="h-4 w-4" />
  if (isCurrent) return <Circle className="h-4 w-4 fill-current" />
  return <Circle className="h-4 w-4" />
}

export default function LifecycleTimeline({ currentStage }: LifecycleTimelineProps) {
  const currentIndex = mainStages.indexOf(currentStage)
  const isExitStage = exitStages.includes(currentStage)

  // If in an exit stage, show the exit path
  if (isExitStage) {
    return (
      <div className="card">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Lifecycle Stage</h3>
        <div className="flex items-center justify-center py-4">
          <div
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-full text-white font-medium',
              lifecycleStages[currentStage]?.color || 'bg-gray-500'
            )}
          >
            {getStageIcon(currentStage, true, false)}
            <span>{lifecycleStages[currentStage]?.label || currentStage}</span>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">
          {currentStage === 'PAUSE' && 'This idea is currently paused'}
          {currentStage === 'PIVOT' && 'This idea is being pivoted to a new direction'}
          {currentStage === 'SUNSET' && 'This idea is being sunset'}
          {currentStage === 'ARCHIVE' && 'This idea has been archived'}
          {currentStage === 'ABANDONED' && 'This idea has been abandoned'}
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <h3 className="text-sm font-medium text-gray-500 mb-4">Lifecycle Progress</h3>

      {/* Timeline */}
      <div className="relative min-w-max">
        {/* Progress Line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200">
          {currentIndex >= 0 && (
            <div
              className="h-full bg-primary-500 transition-all duration-500"
              style={{
                width: `${((currentIndex + 1) / mainStages.length) * 100}%`,
              }}
            />
          )}
        </div>

        {/* Stage Dots */}
        <div className="relative flex justify-between px-4">
          {mainStages.map((stage, index) => {
            const isPast = index < currentIndex
            const isCurrent = index === currentIndex
            const isFuture = index > currentIndex
            const stageInfo = lifecycleStages[stage]

            return (
              <div
                key={stage}
                className="flex flex-col items-center"
                style={{ minWidth: '60px' }}
              >
                {/* Dot */}
                <div
                  className={clsx(
                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                    isCurrent && `${stageInfo.color} border-white text-white shadow-lg`,
                    isPast && 'bg-primary-500 border-primary-500 text-white',
                    isFuture && 'bg-white border-gray-300 text-gray-400'
                  )}
                >
                  {getStageIcon(stage, isCurrent, isPast)}
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
                  {stageInfo.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current stage description */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-medium text-white',
              lifecycleStages[currentStage]?.color || 'bg-gray-500'
            )}
          >
            {lifecycleStages[currentStage]?.label || currentStage}
          </span>
          <span className="text-sm text-gray-500">
            Stage {currentIndex + 1} of {mainStages.length}
          </span>
        </div>
      </div>
    </div>
  )
}
