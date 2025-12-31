import { ReactNode } from 'react'
import clsx from 'clsx'
import type { IncubationPhase } from './IncubationStepper'
import { incubationPhases } from './IncubationStepper'

interface PhaseContainerProps {
  currentPhase: IncubationPhase
  children: ReactNode
  className?: string
  /** Optional content to render on the right side of the phase header (e.g., score + buttons) */
  headerRightContent?: ReactNode
}

/**
 * PhaseContainer wraps phase-specific content and provides visual context
 * for which phase the user is currently working on.
 */
export default function PhaseContainer({
  currentPhase,
  children,
  className,
  headerRightContent
}: PhaseContainerProps) {
  const phaseConfig = incubationPhases.find(p => p.id === currentPhase)

  if (!phaseConfig) {
    return <div className={className}>{children}</div>
  }

  const Icon = phaseConfig.icon

  return (
    <div className={clsx('relative', className)}>
      {/* Phase header */}
      <div className={clsx(
        'mb-6 p-4 rounded-lg border-l-4',
        phaseConfig.borderColor,
        'bg-gray-50'
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'flex items-center justify-center w-10 h-10 rounded-full',
              phaseConfig.bgColor,
              'text-white'
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{phaseConfig.label}</h2>
              <p className="text-sm text-gray-600">{phaseConfig.instructions}</p>
            </div>
          </div>
          {headerRightContent && (
            <div className="flex items-center gap-4">
              {headerRightContent}
            </div>
          )}
        </div>
      </div>

      {/* Phase content */}
      <div className="phase-content">
        {children}
      </div>
    </div>
  )
}

// Phase-specific content components for better organization
interface CapturePhaseContentProps {
  ideaTitle: string
  ideaSummary: string | null
  ideaContent: string | null
  onEdit: () => void
  onContinue: () => void
}

export function CapturePhaseContent({
  ideaTitle,
  ideaSummary,
  ideaContent,
  onEdit,
  onContinue
}: CapturePhaseContentProps) {
  const hasBasicContent = ideaTitle && (ideaSummary || ideaContent)

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Idea Summary</h3>
          <span className={clsx(
            'px-2 py-1 rounded text-xs font-medium',
            hasBasicContent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          )}>
            {hasBasicContent ? 'Complete' : 'Needs content'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Title</label>
            <p className="text-gray-900">{ideaTitle || 'No title'}</p>
          </div>

          {ideaSummary && (
            <div>
              <label className="text-sm font-medium text-gray-500">Summary</label>
              <p className="text-gray-700">{ideaSummary}</p>
            </div>
          )}

          {!ideaContent && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700">
                Add more details about your idea to improve evaluation quality.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onEdit} className="btn btn-secondary">
          Edit Idea
        </button>
        <button
          onClick={onContinue}
          disabled={!hasBasicContent}
          className="btn btn-primary disabled:opacity-50"
        >
          Begin Development →
        </button>
      </div>
    </div>
  )
}

interface EvaluatePhaseContentProps {
  hasEvaluation: boolean
  score?: number | null
  confidence?: number | null
  isEvaluating: boolean
  onEvaluate: () => void
  onViewResults: () => void
}

/**
 * EvaluatePhaseHeaderContent renders score badge + action buttons
 * to be placed in the PhaseContainer header via headerRightContent prop.
 */
export function EvaluatePhaseHeaderContent({
  hasEvaluation,
  score,
  confidence,
  isEvaluating,
  onEvaluate,
}: Omit<EvaluatePhaseContentProps, 'onViewResults'>) {
  if (hasEvaluation && score !== null && score !== undefined) {
    // Show score badge and re-evaluate button
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'flex items-center justify-center w-10 h-10 rounded-full',
            score >= 7 ? 'bg-green-100' : score >= 5 ? 'bg-yellow-100' : 'bg-red-100'
          )}>
            <span className={clsx(
              'text-lg font-bold',
              score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {score.toFixed(1)}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {confidence !== null && confidence !== undefined
              ? `${Math.round(confidence * 100)}% conf`
              : ''}
          </span>
        </div>
        <button onClick={onEvaluate} className="btn btn-secondary btn-sm">
          Re-evaluate
        </button>
      </div>
    )
  }

  // No evaluation yet - just show Run Evaluation button
  return (
    <button
      onClick={onEvaluate}
      disabled={isEvaluating}
      className="btn btn-primary"
    >
      {isEvaluating ? 'Starting...' : 'Run Evaluation'}
    </button>
  )
}

/**
 * @deprecated Use EvaluatePhaseHeaderContent with PhaseContainer's headerRightContent prop instead
 */
export function EvaluatePhaseContent({
  hasEvaluation,
  score,
  confidence,
  isEvaluating,
  onEvaluate,
  onViewResults
}: EvaluatePhaseContentProps) {
  if (hasEvaluation && score !== null && score !== undefined) {
    // Compact layout for completed evaluation
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4">
          <div className={clsx(
            'flex items-center justify-center w-14 h-14 rounded-full',
            score >= 7 ? 'bg-green-100' : score >= 5 ? 'bg-yellow-100' : 'bg-red-100'
          )}>
            <span className={clsx(
              'text-xl font-bold',
              score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {score.toFixed(1)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Evaluation Complete</h3>
            <p className="text-sm text-gray-500">
              {confidence !== null && confidence !== undefined
                ? `${Math.round(confidence * 100)}% confidence`
                : 'Score available'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onViewResults} className="btn btn-primary btn-sm">
            View Results
          </button>
          <button onClick={onEvaluate} className="btn btn-secondary btn-sm">
            Re-evaluate
          </button>
        </div>
      </div>
    )
  }

  // Compact layout for ready-to-evaluate state
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary-100">
          <span className="text-xl font-bold text-primary-600">?</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Ready for Evaluation</h3>
          <p className="text-sm text-gray-500">
            30 criteria • 6 categories • ~$2 cost
          </p>
        </div>
      </div>
      <button
        onClick={onEvaluate}
        disabled={isEvaluating}
        className="btn btn-primary"
      >
        {isEvaluating ? 'Starting...' : 'Run Evaluation'}
      </button>
    </div>
  )
}
