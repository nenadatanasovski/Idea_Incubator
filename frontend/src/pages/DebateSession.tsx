import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MessageSquare,
  Shield,
  Scale,
  ArrowLeft,
  Lightbulb,
  Clock,
  CheckCircle,
  XCircle,
  Minus,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { getDebateSession, type DebateSessionDetail } from '../api/client'
import type { DebateRound } from '../types'

// Group rounds by criterion
function groupByCriterion(rounds: DebateRound[]): Map<string, DebateRound[]> {
  const grouped = new Map<string, DebateRound[]>()
  for (const round of rounds) {
    const existing = grouped.get(round.criterion) || []
    existing.push(round)
    grouped.set(round.criterion, existing)
  }
  return grouped
}

// Verdict badge component
function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null

  const config = {
    EVALUATOR: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
    RED_TEAM: { color: 'bg-red-100 text-red-800', icon: XCircle },
    DRAW: { color: 'bg-gray-100 text-gray-800', icon: Minus },
  }[verdict] || { color: 'bg-gray-100 text-gray-800', icon: Minus }

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {verdict.replace('_', ' ')}
    </span>
  )
}

// Round card component
function RoundCard({ round }: { round: DebateRound }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-500">
            Round {round.round_number}
          </span>
          {round.redteam_persona && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded capitalize">
              {round.redteam_persona.replace(/_/g, ' ')}
            </span>
          )}
          <VerdictBadge verdict={round.arbiter_verdict} />
          {round.score_adjustment !== 0 && (
            <span className={`text-xs font-medium ${round.score_adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {round.score_adjustment > 0 ? '+' : ''}{round.score_adjustment}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Evaluator Claim */}
          {round.evaluator_claim && (
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-600 mb-1">Evaluator Claim</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{round.evaluator_claim}</p>
              </div>
            </div>
          )}

          {/* Red Team Challenge */}
          {round.redteam_challenge && (
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-red-600 mb-1">
                  Red Team Challenge
                  {round.redteam_persona && (
                    <span className="ml-1 font-normal text-gray-400">
                      ({round.redteam_persona.replace(/_/g, ' ')})
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{round.redteam_challenge}</p>
              </div>
            </div>
          )}

          {/* Evaluator Defense */}
          {round.evaluator_defense && (
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-600 mb-1">Evaluator Defense</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{round.evaluator_defense}</p>
              </div>
            </div>
          )}

          {/* Arbiter Verdict */}
          {round.arbiter_verdict && (
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Scale className="h-4 w-4 text-purple-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-600 mb-1">Arbiter Verdict</p>
                <div className="flex items-center space-x-2">
                  <VerdictBadge verdict={round.arbiter_verdict} />
                  {round.score_adjustment !== 0 && (
                    <span className={`text-sm font-medium ${round.score_adjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Score adjustment: {round.score_adjustment > 0 ? '+' : ''}{round.score_adjustment}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Criterion section component
function CriterionSection({ criterion, rounds }: { criterion: string; rounds: DebateRound[] }) {
  const [expanded, setExpanded] = useState(true)

  // Calculate stats
  const evaluatorWins = rounds.filter((r) => r.arbiter_verdict === 'EVALUATOR').length
  const redTeamWins = rounds.filter((r) => r.arbiter_verdict === 'RED_TEAM').length
  const draws = rounds.filter((r) => r.arbiter_verdict === 'DRAW').length
  const totalAdjustment = rounds.reduce((sum, r) => sum + (r.score_adjustment || 0), 0)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">{criterion}</h3>
          <span className="text-sm text-gray-500">{rounds.length} challenge{rounds.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm">
            {evaluatorWins > 0 && (
              <span className="text-blue-600">{evaluatorWins} Evaluator</span>
            )}
            {redTeamWins > 0 && (
              <span className="text-red-600">{redTeamWins} Red Team</span>
            )}
            {draws > 0 && (
              <span className="text-gray-600">{draws} Draw</span>
            )}
            {totalAdjustment !== 0 && (
              <span className={`font-medium ${totalAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Net: {totalAdjustment > 0 ? '+' : ''}{totalAdjustment}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 space-y-3">
          {rounds.map((round, index) => (
            <RoundCard key={`${round.criterion}-${round.round_number}-${index}`} round={round} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function DebateSession() {
  const { runId } = useParams<{ runId: string }>()
  const [session, setSession] = useState<DebateSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) return

    getDebateSession(runId)
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <Link to="/debate" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Debates
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error || 'Session not found'}</span>
        </div>
      </div>
    )
  }

  const groupedRounds = groupByCriterion(session.rounds)

  // Calculate overall stats
  const totalRounds = session.rounds.length
  const evaluatorWins = session.rounds.filter((r) => r.arbiter_verdict === 'EVALUATOR').length
  const redTeamWins = session.rounds.filter((r) => r.arbiter_verdict === 'RED_TEAM').length
  const netAdjustment = session.rounds.reduce((sum, r) => sum + (r.score_adjustment || 0), 0)

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/debate" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Debates
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-primary-600" />
              <Link
                to={`/ideas/${session.idea_slug}`}
                className="text-lg font-medium text-gray-900 hover:text-primary-600"
              >
                {session.idea_title}
              </Link>
            </div>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {new Date(session.started_at).toLocaleDateString()}
              </span>
              <span>{totalRounds} debate rounds</span>
              <span>{groupedRounds.size} criteria</span>
              {session.rounds_per_criterion > 0 && (
                <span className="text-primary-600 font-medium">
                  {session.rounds_per_criterion} round{session.rounds_per_criterion !== 1 ? 's' : ''}/criterion
                </span>
              )}
              {session.status && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  session.status === 'complete' ? 'bg-green-100 text-green-800' :
                  session.status === 'evaluation-only' ? 'bg-amber-100 text-amber-800' :
                  session.status === 'data-loss' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {session.status === 'evaluation-only' ? 'Evaluation Only' :
                   session.status === 'complete' ? 'Complete' :
                   session.status === 'data-loss' ? 'Data Lost' : 'In Progress'}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400 font-mono">{session.evaluation_run_id}</p>
          </div>

          {/* Stats */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{evaluatorWins}</p>
              <p className="text-xs text-gray-500">Evaluator Wins</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{redTeamWins}</p>
              <p className="text-xs text-gray-500">Red Team Wins</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${netAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netAdjustment >= 0 ? '+' : ''}{netAdjustment}
              </p>
              <p className="text-xs text-gray-500">Net Adjustment</p>
            </div>
            {session.apiCalls !== undefined && (
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-600">{session.apiCalls}</p>
                <p className="text-xs text-gray-500">API Calls</p>
              </div>
            )}
          </div>
        </div>

        {/* Synthesis summary if available */}
        {session.synthesis && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Final Synthesis</h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                session.synthesis.recommendation === 'PURSUE' ? 'bg-green-100 text-green-800' :
                session.synthesis.recommendation === 'REFINE' ? 'bg-yellow-100 text-yellow-800' :
                session.synthesis.recommendation === 'PAUSE' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {session.synthesis.recommendation}
              </span>
            </div>
            <p className="text-sm text-gray-600">{session.synthesis.executive_summary}</p>
            <div className="mt-3 flex items-center space-x-2">
              <span className="text-sm text-gray-500">Overall Score:</span>
              <span className="text-lg font-bold text-primary-600">
                {session.synthesis.overall_score.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Debate rounds by criterion */}
      <div className="space-y-4">
        {groupedRounds.size === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${session.status === 'data-loss' ? 'text-red-500' : 'text-amber-500'}`} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {session.status === 'evaluation-only' ? 'Evaluation Only - No Debate Data' :
               session.status === 'data-loss' ? 'Debate Data Lost' :
               'No Debate Rounds Found'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
              {session.status === 'evaluation-only'
                ? 'This evaluation ran without the debate phase. Scores are based on initial AI assessment only, without red team challenges.'
                : session.status === 'data-loss'
                ? 'The debate ran but the results were not saved to the database. This usually happens when the evaluation process crashes or exits unexpectedly before completing. You may want to re-run the evaluation.'
                : 'No debate rounds were recorded for this session. This could indicate the evaluation is still in progress or there was an issue with data recording.'}
            </p>
            {session.apiCalls !== undefined && session.apiCalls > 0 && (
              <p className="text-xs text-gray-400">
                {session.apiCalls} API calls were made during this session
              </p>
            )}
            <div className="mt-6">
              <Link
                to={`/ideas/${session.idea_slug}`}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                View Idea Details
              </Link>
            </div>
          </div>
        ) : (
          Array.from(groupedRounds.entries()).map(([criterion, rounds]) => (
            <CriterionSection key={criterion} criterion={criterion} rounds={rounds} />
          ))
        )}
      </div>
    </div>
  )
}
