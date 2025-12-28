import { useCategoryScores, useEvaluations, useSynthesis, useDebateRounds, useRedTeamChallenges } from '../hooks/useEvaluations'
import { scoreInterpretation, categoryWeights } from '../types'
import type { EvaluationCategory, UserProfileSummary } from '../types'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  Shield,
  Play,
  Pause,
  RefreshCw,
  XOctagon,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

interface EvaluationScorecardProps {
  slug: string
  runId?: string
  profile?: UserProfileSummary | null
}

const categoryLabels: Record<EvaluationCategory, string> = {
  problem: 'Problem',
  solution: 'Solution',
  feasibility: 'Feasibility',
  fit: 'Fit',
  market: 'Market',
  risk: 'Risk',
}

const categoryIcons: Record<EvaluationCategory, string> = {
  problem: '🎯',
  solution: '💡',
  feasibility: '⚙️',
  fit: '🧩',
  market: '📊',
  risk: '⚠️',
}

const categoryDescriptions: Record<EvaluationCategory, { full: string; criteria: string[] }> = {
  problem: {
    full: 'How well-defined and validated is the problem?',
    criteria: ['Clarity', 'Severity', 'Target User', 'Validation', 'Uniqueness'],
  },
  solution: {
    full: 'How viable and differentiated is the proposed solution?',
    criteria: ['Clarity', 'Feasibility', 'Uniqueness', 'Scalability', 'Defensibility'],
  },
  feasibility: {
    full: 'Can this idea be executed with available resources?',
    criteria: ['Technical', 'Resources', 'Skills', 'Time to Value', 'Dependencies'],
  },
  fit: {
    full: 'Does this align with your goals and capabilities?',
    criteria: ['Personal', 'Passion', 'Skills', 'Network', 'Life Stage'],
  },
  market: {
    full: 'What is the market opportunity and competitive landscape?',
    criteria: ['Size', 'Growth', 'Competition', 'Entry Barriers', 'Timing'],
  },
  risk: {
    full: 'What are the key risks and potential failure modes?',
    criteria: ['Execution', 'Market', 'Technical', 'Financial', 'Regulatory'],
  },
}

const recommendationConfig = {
  PURSUE: { icon: Play, color: 'green', label: 'Pursue', emoji: '🚀' },
  REFINE: { icon: RefreshCw, color: 'yellow', label: 'Refine', emoji: '🔄' },
  PAUSE: { icon: Pause, color: 'orange', label: 'Pause', emoji: '⏸️' },
  ABANDON: { icon: XOctagon, color: 'red', label: 'Abandon', emoji: '❌' },
}

// Persona config for red team display (reserved for future use)
// const personaConfig = {
//   skeptic: { icon: AlertTriangle, label: 'Skeptic', color: 'red' },
//   realist: { icon: Target, label: 'Realist', color: 'amber' },
//   first_principles: { icon: Compass, label: 'First Principles', color: 'purple' },
// }

function ScoreGauge({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
  const percentage = (score / 10) * 100
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 8) return '#22c55e'
    if (s >= 7) return '#84cc16'
    if (s >= 6) return '#eab308'
    if (s >= 5) return '#f97316'
    return '#ef4444'
  }

  const dimensions = size === 'large' ? 'w-32 h-32' : 'w-16 h-16'
  const textSize = size === 'large' ? 'text-3xl' : 'text-lg'
  const labelSize = size === 'large' ? 'text-sm' : 'text-xs'

  return (
    <div className={clsx('relative', dimensions)}>
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke={getColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={clsx('font-bold', textSize)} style={{ color: getColor(score) }}>
          {score.toFixed(1)}
        </span>
        <span className={clsx('text-gray-500', labelSize)}>
          {scoreInterpretation.getLevel(score)}
        </span>
      </div>
    </div>
  )
}

function ScoreChange({ initial, final }: { initial: number; final: number }) {
  const change = final - initial
  if (Math.abs(change) < 0.1) {
    return (
      <span className="inline-flex items-center text-gray-500 text-sm">
        <Minus className="w-4 h-4 mr-1" />
        No change
      </span>
    )
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center text-green-600 text-sm font-medium">
        <TrendingUp className="w-4 h-4 mr-1" />
        +{change.toFixed(1)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-red-600 text-sm font-medium">
      <TrendingDown className="w-4 h-4 mr-1" />
      {change.toFixed(1)}
    </span>
  )
}

function CategoryCard({
  category,
  score,
  confidence: _confidence,
  initialScore,
  expanded,
  onToggle,
  criteria,
  hasProfile,
}: {
  category: EvaluationCategory
  score: number
  confidence: number
  initialScore?: number
  expanded: boolean
  onToggle: () => void
  criteria: Array<{ name: string; score: number; reasoning: string }>
  hasProfile?: boolean
}) {
  const label = categoryLabels[category]
  const icon = categoryIcons[category]
  const desc = categoryDescriptions[category]
  const weight = categoryWeights[category]
  const isFitCategory = category === 'fit'

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="text-left">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              {label}
              {isFitCategory && (
                hasProfile ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                    Personalized
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                    Generic
                  </span>
                )
              )}
            </div>
            <div className="text-xs text-gray-500">{desc.full}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={clsx('text-xl font-bold', scoreInterpretation.getColor(score))}>
              {score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-400">
              {Math.round(weight * 100)}% weight
            </div>
          </div>
          {initialScore !== undefined && Math.abs(score - initialScore) >= 0.1 && (
            <ScoreChange initial={initialScore} final={score} />
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="grid gap-2">
            {criteria.map((c) => (
              <div key={c.name} className="bg-white rounded p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-700">{c.name}</span>
                  <span className={clsx('font-bold text-sm', scoreInterpretation.getColor(c.score))}>
                    {c.score.toFixed(1)}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className={clsx('h-full rounded-full', scoreInterpretation.getBgColor(c.score))}
                    style={{ width: `${(c.score / 10) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{c.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InsightCard({ insight, type }: { insight: string; type: 'strength' | 'weakness' | 'assumption' | 'question' }) {
  const config = {
    strength: { icon: CheckCircle, color: 'green', label: 'Strength' },
    weakness: { icon: XCircle, color: 'red', label: 'Weakness' },
    assumption: { icon: AlertTriangle, color: 'amber', label: 'Assumption' },
    question: { icon: Target, color: 'blue', label: 'Question' },
  }
  const { icon: Icon, color, label } = config[type]

  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-lg', `bg-${color}-50`)}>
      <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', `text-${color}-500`)} />
      <div>
        <span className={clsx('text-xs font-medium', `text-${color}-700`)}>{label}</span>
        <p className="text-sm text-gray-700 mt-0.5">{insight}</p>
      </div>
    </div>
  )
}

export default function EvaluationScorecard({ slug, runId, profile }: EvaluationScorecardProps) {
  const { scores, loading: scoresLoading } = useCategoryScores(slug, runId)
  const { evaluations, loading: evalsLoading } = useEvaluations(slug, runId)
  const { synthesis } = useSynthesis(slug, runId)
  const { rounds } = useDebateRounds(slug, runId)
  const { challenges } = useRedTeamChallenges(slug, runId)

  const [expandedCategory, setExpandedCategory] = useState<EvaluationCategory | null>(null)
  const [showAllInsights, setShowAllInsights] = useState(false)

  if (scoresLoading || evalsLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-32 bg-gray-200 rounded-lg mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="card text-center py-12">
        <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Evaluation Yet</h3>
        <p className="text-gray-500 mb-4">
          Run an evaluation to see a comprehensive scorecard
        </p>
        <code className="text-sm bg-gray-100 px-3 py-1 rounded">
          npm run evaluate {slug}
        </code>
      </div>
    )
  }

  // Calculate scores
  const weightedAvg = scores.reduce((acc, cat) => {
    const weight = categoryWeights[cat.category as EvaluationCategory] || 0
    return acc + cat.avg_score * weight
  }, 0)

  // Check for debate data to show before/after
  const hasDebate = rounds.length > 0
  const initialScore = synthesis?.overall_score
    ? synthesis.overall_score + (rounds.reduce((sum, r) => sum + r.score_adjustment, 0) * -1) / rounds.length
    : weightedAvg

  // Group evaluations by category for expanded view
  const evaluationsByCategory = evaluations.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push({
      name: e.criterion.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      score: e.final_score,
      reasoning: e.reasoning,
    })
    return acc
  }, {} as Record<string, Array<{ name: string; score: number; reasoning: string }>>)

  // Calculate debate stats
  const totalRounds = rounds.length
  const evaluatorWins = rounds.filter(r => r.arbiter_verdict === 'EVALUATOR').length
  const redTeamWins = rounds.filter(r => r.arbiter_verdict === 'RED_TEAM').length
  const survivalRate = totalRounds > 0 ? (evaluatorWins / totalRounds) * 100 : 0

  // Group challenges by severity
  const criticalChallenges = challenges.filter(c => c.severity === 'critical' || c.severity === 'high')
  const addressedChallenges = challenges.filter(c => c.addressed)

  // Get key insights (limit to 6 unless expanded)
  const allInsights = [
    ...(synthesis?.key_strengths || []).map(s => ({ text: s, type: 'strength' as const })),
    ...(synthesis?.key_weaknesses || []).map(s => ({ text: s, type: 'weakness' as const })),
    ...(synthesis?.critical_assumptions || []).map(s => ({ text: s, type: 'assumption' as const })),
  ]
  const displayedInsights = showAllInsights ? allInsights : allInsights.slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Header with Overall Score */}
      <div className="card">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Score Gauge */}
          <div className="flex-shrink-0">
            <ScoreGauge score={weightedAvg} />
          </div>

          {/* Score Details */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Overall Evaluation Score</h2>
            <p className="text-gray-600 mb-4">
              Based on {evaluations.length} criteria across 6 categories
            </p>

            {/* Profile Badge */}
            {profile ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-full text-sm text-green-800 mb-4">
                <User className="w-4 h-4" />
                <span>Evaluated with profile: <strong>{profile.name}</strong></span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-full text-sm text-amber-800 mb-4">
                <AlertTriangle className="w-4 h-4" />
                <span>No profile linked - FT scores are generic</span>
              </div>
            )}

            {hasDebate && (
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 text-sm">
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <span className="text-gray-500">Initial: </span>
                  <span className="font-medium">{initialScore.toFixed(1)}</span>
                </div>
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <span className="text-gray-500">After Debate: </span>
                  <span className="font-medium">{weightedAvg.toFixed(1)}</span>
                </div>
                <ScoreChange initial={initialScore} final={weightedAvg} />
              </div>
            )}
          </div>

          {/* Recommendation Badge */}
          {synthesis?.recommendation && (
            <div className="flex-shrink-0">
              {(() => {
                const rec = recommendationConfig[synthesis.recommendation]
                const Icon = rec.icon
                return (
                  <div className={clsx(
                    'flex items-center gap-3 px-5 py-3 rounded-xl',
                    `bg-${rec.color}-100`
                  )}>
                    <Icon className={clsx('w-8 h-8', `text-${rec.color}-600`)} />
                    <div>
                      <div className={clsx('text-lg font-bold', `text-${rec.color}-700`)}>
                        {rec.label}
                      </div>
                      <div className="text-xs text-gray-600">Recommendation</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Debate Summary (if applicable) */}
      {hasDebate && (
        <div className="card bg-gradient-to-r from-purple-50 to-blue-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Red Team Debate Results
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{totalRounds}</div>
              <div className="text-sm text-gray-500">Total Rounds</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{evaluatorWins}</div>
              <div className="text-sm text-gray-500">Evaluator Wins</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{redTeamWins}</div>
              <div className="text-sm text-gray-500">Red Team Wins</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className={clsx(
                'text-3xl font-bold',
                survivalRate >= 50 ? 'text-green-600' : 'text-red-600'
              )}>
                {survivalRate.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500">Survival Rate</div>
            </div>
          </div>

          {challenges.length > 0 && (
            <div className="mt-4 pt-4 border-t border-purple-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  <AlertTriangle className="w-4 h-4 inline mr-1 text-red-500" />
                  {criticalChallenges.length} critical/high severity issues identified
                </span>
                <span className="text-gray-600">
                  <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
                  {addressedChallenges.length}/{challenges.length} addressed
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
        <p className="text-sm text-gray-500 mb-4">
          Click any category to see detailed criteria scores and reasoning
        </p>
        <div className="space-y-2">
          {scores.map((cat) => (
            <CategoryCard
              key={cat.category}
              category={cat.category as EvaluationCategory}
              score={cat.avg_score}
              confidence={cat.avg_confidence}
              expanded={expandedCategory === cat.category}
              onToggle={() =>
                setExpandedCategory(
                  expandedCategory === cat.category ? null : (cat.category as EvaluationCategory)
                )
              }
              criteria={evaluationsByCategory[cat.category] || []}
              hasProfile={!!profile}
            />
          ))}
        </div>
      </div>

      {/* Key Insights */}
      {allInsights.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {displayedInsights.map((insight, idx) => (
              <InsightCard key={idx} insight={insight.text} type={insight.type} />
            ))}
          </div>
          {allInsights.length > 6 && (
            <button
              onClick={() => setShowAllInsights(!showAllInsights)}
              className="mt-4 text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              {showAllInsights ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show all {allInsights.length} insights
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Executive Summary */}
      {synthesis?.executive_summary && (
        <div className="card bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h3>
          <p className="text-gray-700 leading-relaxed">{synthesis.executive_summary}</p>
          {synthesis.recommendation_reasoning && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-gray-900">Recommendation Reasoning</span>
              </div>
              <p className="text-sm text-gray-600">{synthesis.recommendation_reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{evaluations.length}</div>
          <div className="text-sm text-gray-500">Criteria Evaluated</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{scores.length}</div>
          <div className="text-sm text-gray-500">Categories Analyzed</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{challenges.length}</div>
          <div className="text-sm text-gray-500">Challenges Raised</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{totalRounds}</div>
          <div className="text-sm text-gray-500">Debate Rounds</div>
        </div>
      </div>
    </div>
  )
}
