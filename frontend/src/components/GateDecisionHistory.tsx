import { Shield, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import type { GateDecision } from '../api/client'

interface GateDecisionHistoryProps {
  decisions: GateDecision[]
}

const gateTypeLabels: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  viability: {
    label: 'Viability Gate',
    icon: Shield,
    color: 'text-purple-600'
  },
  evaluation: {
    label: 'Evaluation Gate',
    icon: CheckCircle,
    color: 'text-blue-600'
  }
}

const choiceLabels: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  proceed_confident: {
    label: 'Proceeded Confidently',
    icon: CheckCircle,
    color: 'text-green-600'
  },
  proceed_cautious: {
    label: 'Proceeded with Caution',
    icon: AlertTriangle,
    color: 'text-yellow-600'
  },
  more_development: {
    label: 'More Development',
    icon: Clock,
    color: 'text-blue-600'
  },
  pause: {
    label: 'Paused',
    icon: Clock,
    color: 'text-yellow-600'
  },
  abandon: {
    label: 'Abandoned',
    icon: XCircle,
    color: 'text-red-600'
  },
  iterate: {
    label: 'Iteration Started',
    icon: Clock,
    color: 'text-amber-600'
  },
  complete: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-green-600'
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function GateDecisionItem({ decision }: { decision: GateDecision }) {
  const gateType = gateTypeLabels[decision.gate_type] || {
    label: decision.gate_type,
    icon: Shield,
    color: 'text-gray-600'
  }
  const choice = choiceLabels[decision.user_choice] || {
    label: decision.user_choice,
    icon: CheckCircle,
    color: 'text-gray-600'
  }

  const GateIcon = gateType.icon
  const ChoiceIcon = choice.icon

  return (
    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg">
      <div className={`p-2 rounded-full bg-gray-100 ${gateType.color}`}>
        <GateIcon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{gateType.label}</span>
          <span className={`flex items-center gap-1 text-sm ${choice.color}`}>
            <ChoiceIcon className="h-3.5 w-3.5" />
            {choice.label}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
          <span>{formatDate(decision.decided_at)}</span>
          {decision.readiness_score !== null && (
            <span>Readiness: {decision.readiness_score}%</span>
          )}
          {decision.overall_score !== null && (
            <span>Score: {decision.overall_score.toFixed(1)}/10</span>
          )}
        </div>

        {decision.advisory_shown && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              View advisory shown
            </summary>
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">
              {decision.advisory_shown}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

export default function GateDecisionHistory({ decisions }: GateDecisionHistoryProps) {
  if (decisions.length === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No gate decisions recorded</p>
        <p className="text-xs mt-1">Decisions will appear here as you progress through the incubation process</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Gate Decision History</h3>
      </div>

      <div className="space-y-3">
        {decisions.map(decision => (
          <GateDecisionItem key={decision.id} decision={decision} />
        ))}
      </div>
    </div>
  )
}
