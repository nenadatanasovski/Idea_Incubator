import { useRedTeamChallenges, useDebateRounds } from '../hooks/useEvaluations'
import { AlertTriangle, Shield, Target, Compass, CheckCircle, XCircle, MessageSquare, Lightbulb } from 'lucide-react'
import clsx from 'clsx'

interface RedTeamViewProps {
  slug: string
  runId?: string
}

const personaInfo: Record<string, { icon: typeof AlertTriangle; label: string; description: string; color: string }> = {
  skeptic: {
    icon: AlertTriangle,
    label: 'Skeptic',
    description: 'Questions assumptions and looks for weaknesses',
    color: 'text-red-600 bg-red-50',
  },
  realist: {
    icon: Target,
    label: 'Realist',
    description: 'Focuses on practical implementation challenges',
    color: 'text-amber-600 bg-amber-50',
  },
  first_principles: {
    icon: Compass,
    label: 'First Principles',
    description: 'Challenges fundamental assumptions',
    color: 'text-purple-600 bg-purple-50',
  },
  'first-principles': {
    icon: Compass,
    label: 'First Principles',
    description: 'Challenges fundamental assumptions',
    color: 'text-purple-600 bg-purple-50',
  },
  competitor: {
    icon: Target,
    label: 'Competitor',
    description: 'Analyzes from a competitor perspective',
    color: 'text-blue-600 bg-blue-50',
  },
  contrarian: {
    icon: Compass,
    label: 'Contrarian',
    description: 'Takes opposing viewpoints',
    color: 'text-indigo-600 bg-indigo-50',
  },
  'edge-case': {
    icon: AlertTriangle,
    label: 'Edge Case',
    description: 'Identifies edge cases and exceptions',
    color: 'text-orange-600 bg-orange-50',
  },
  edge_case: {
    icon: AlertTriangle,
    label: 'Edge Case',
    description: 'Identifies edge cases and exceptions',
    color: 'text-orange-600 bg-orange-50',
  },
}

const severityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  minor: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  major: 'bg-orange-100 text-orange-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export default function RedTeamView({ slug, runId }: RedTeamViewProps) {
  const { challenges, loading: challengesLoading } = useRedTeamChallenges(slug, runId)
  const { rounds, loading: roundsLoading } = useDebateRounds(slug, runId)

  if (challengesLoading || roundsLoading) {
    return (
      <div className="card">
        <p className="text-gray-500">Loading red team data...</p>
      </div>
    )
  }

  if (challenges.length === 0 && rounds.length === 0) {
    return (
      <div className="card text-center py-12">
        <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No red team challenges yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Run an evaluation to generate challenges
        </p>
      </div>
    )
  }

  // Group challenges by persona
  const challengesByPersona = challenges.reduce((acc, challenge) => {
    if (!acc[challenge.persona]) acc[challenge.persona] = []
    acc[challenge.persona].push(challenge)
    return acc
  }, {} as Record<string, typeof challenges>)

  // Stats
  const totalChallenges = challenges.length
  const addressedChallenges = challenges.filter((c) => c.addressed).length
  const criticalChallenges = challenges.filter((c) => c.severity === 'critical').length
  const isPreliminary = challenges.some((c) => c.is_preliminary)

  return (
    <div className="space-y-6">
      {/* Preliminary Analysis Banner */}
      {isPreliminary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900">Preliminary Analysis</h4>
              <p className="text-sm text-blue-700 mt-1">
                These challenges are auto-generated based on your idea content and development answers.
                Run a full evaluation for comprehensive AI-powered red team analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-primary-500" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">{totalChallenges}</p>
              <p className="text-sm text-gray-500">Total Challenges</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">
                {addressedChallenges}/{totalChallenges}
              </p>
              <p className="text-sm text-gray-500">Addressed</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-2xl font-bold text-gray-900">{criticalChallenges}</p>
              <p className="text-sm text-gray-500">Critical Issues</p>
            </div>
          </div>
        </div>
      </div>

      {/* Challenges by Persona */}
      <div className="space-y-6">
        {Object.entries(challengesByPersona).map(([persona, personaChallenges]) => {
          const info = personaInfo[persona] || {
            icon: Shield,
            label: persona.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: 'Red team perspective',
            color: 'text-gray-600 bg-gray-50',
          }
          const Icon = info.icon

          return (
            <div key={persona} className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className={clsx('p-2 rounded-lg', info.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{info.label}</h3>
                  <p className="text-sm text-gray-500">{info.description}</p>
                </div>
                <span className="ml-auto badge bg-gray-100 text-gray-600">
                  {personaChallenges.length} challenges
                </span>
              </div>

              <div className="space-y-3">
                {personaChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className={clsx(
                      'border rounded-lg p-4',
                      challenge.addressed
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={clsx('badge', severityColors[challenge.severity?.toLowerCase()] || 'bg-gray-100 text-gray-800')}>
                            {challenge.severity || 'unknown'}
                          </span>
                          {challenge.category && (
                            <span className="badge bg-gray-100 text-gray-600">
                              {challenge.category}
                            </span>
                          )}
                          {challenge.criterion && (
                            <span className="badge bg-gray-100 text-gray-600">
                              {challenge.criterion.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800">{challenge.challenge}</p>
                        {challenge.resolution && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-gray-600">{challenge.resolution}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        {challenge.addressed ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Debate Rounds */}
      {rounds.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-primary-500" />
            <h3 className="font-semibold text-gray-900">Debate Transcript</h3>
          </div>

          <div className="space-y-4">
            {rounds.map((round) => (
              <div key={round.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-900">Round {round.round_number}</span>
                  <span
                    className={clsx(
                      'ml-3 badge',
                      round.score_adjustment > 0
                        ? 'bg-green-100 text-green-800'
                        : round.score_adjustment < 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {round.score_adjustment > 0 ? '+' : ''}{round.score_adjustment.toFixed(1)}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Evaluator */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-blue-100 text-blue-800">Evaluator</span>
                    </div>
                    <p className="text-sm text-gray-700">{round.evaluator_claim}</p>
                  </div>

                  {/* Red Team */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-red-100 text-red-800">Red Team</span>
                    </div>
                    <p className="text-sm text-gray-700">{round.redteam_challenge}</p>
                  </div>

                  {/* Arbiter */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-purple-100 text-purple-800">Arbiter</span>
                    </div>
                    <p className="text-sm text-gray-700">{round.arbiter_verdict}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
