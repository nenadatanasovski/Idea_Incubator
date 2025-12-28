import type { Synthesis } from '../types'
import { scoreInterpretation } from '../types'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Lock,
  ArrowRight,
  Pause,
  Play,
  XOctagon,
  RefreshCw,
  Lightbulb,
} from 'lucide-react'
import clsx from 'clsx'

interface SynthesisViewProps {
  synthesis: Synthesis | null
}

const recommendationInfo = {
  PURSUE: {
    icon: Play,
    label: 'Pursue',
    description: 'This idea shows strong potential and should be actively developed',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  REFINE: {
    icon: RefreshCw,
    label: 'Refine',
    description: 'This idea has potential but needs further development',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
  },
  PAUSE: {
    icon: Pause,
    label: 'Pause',
    description: 'This idea should be put on hold for now',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  ABANDON: {
    icon: XOctagon,
    label: 'Abandon',
    description: 'This idea is not viable and should be discontinued',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
  },
}

export default function SynthesisView({ synthesis }: SynthesisViewProps) {
  if (!synthesis) {
    return (
      <div className="card text-center py-12">
        <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No synthesis available</p>
        <p className="text-sm text-gray-400 mt-1">
          Complete an evaluation to generate a synthesis
        </p>
      </div>
    )
  }

  const recInfo = recommendationInfo[synthesis.recommendation]
  const RecIcon = recInfo.icon
  const isPreliminary = synthesis.is_preliminary

  return (
    <div className="space-y-6">
      {/* Preliminary Analysis Banner */}
      {isPreliminary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900">Preliminary Synthesis</h4>
              <p className="text-sm text-blue-700 mt-1">
                This synthesis is auto-generated based on your idea's readiness and development answers.
                Run a full evaluation for comprehensive AI-powered analysis with debate and red team challenges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Recommendation */}
      <div className={clsx('card border-2', `border-${recInfo.color.replace('bg-', '')}`)}>
        <div className="flex items-start gap-4">
          <div className={clsx('p-3 rounded-lg', recInfo.bgColor)}>
            <RecIcon className={clsx('h-8 w-8', recInfo.textColor)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{recInfo.label}</h2>
              {synthesis.locked && (
                <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">{recInfo.description}</p>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl font-bold ${scoreInterpretation.getColor(
                synthesis.overall_score ?? 0
              )}`}
            >
              {(synthesis.overall_score ?? 0).toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">
              {Math.round((synthesis.confidence ?? 0) * 100)}% confidence
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Executive Summary</h3>
        <p className="text-gray-700 leading-relaxed">{synthesis.executive_summary}</p>
      </div>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Strengths */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h3 className="font-semibold text-gray-900">Key Strengths</h3>
          </div>
          <ul className="space-y-2">
            {synthesis.key_strengths.map((strength, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Weaknesses */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold text-gray-900">Key Weaknesses</h3>
          </div>
          <ul className="space-y-2">
            {synthesis.key_weaknesses.map((weakness, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Critical Assumptions */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">Critical Assumptions</h3>
        </div>
        <ul className="space-y-2">
          {synthesis.critical_assumptions.map((assumption, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{assumption}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Unresolved Questions */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">Unresolved Questions</h3>
        </div>
        <ul className="space-y-2">
          {synthesis.unresolved_questions.map((question, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{question}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendation Reasoning */}
      <div className={clsx('card', recInfo.bgColor)}>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className={clsx('h-5 w-5', recInfo.textColor)} />
          <h3 className={clsx('font-semibold', recInfo.textColor)}>
            Why {recInfo.label}?
          </h3>
        </div>
        <p className="text-gray-700 leading-relaxed">
          {synthesis.recommendation_reasoning}
        </p>
      </div>
    </div>
  )
}
