import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Wifi,
  WifiOff,
  MessageSquare,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Bot,
  User,
  Gavel,
  ChevronDown,
  ChevronRight,
  Terminal,
  ChevronUp,
} from 'lucide-react'
import { useDebateStream, type DebateEvent } from '../hooks/useDebateStream'
import { useIdeas } from '../hooks/useIdeas'

// Phase indicator colors
const phaseColors = {
  idle: 'bg-gray-500',
  evaluating: 'bg-blue-500',
  challenging: 'bg-red-500',
  judging: 'bg-purple-500',
  synthesizing: 'bg-amber-500',
  complete: 'bg-green-500',
}

const phaseLabels = {
  idle: 'Waiting',
  evaluating: 'Evaluating',
  challenging: 'Challenging',
  judging: 'Judging',
  synthesizing: 'Synthesizing',
  complete: 'Complete',
}

// Category colors
const categoryColors: Record<string, { bg: string; text: string; border: string; header: string }> = {
  problem: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', header: 'bg-blue-100' },
  solution: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', header: 'bg-green-100' },
  feasibility: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', header: 'bg-amber-100' },
  fit: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', header: 'bg-purple-100' },
  market: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', header: 'bg-pink-100' },
  risk: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', header: 'bg-red-100' },
}

// A single debate for one criterion
interface CriterionDebate {
  criterion: string
  category: string
  startTime: string
  // Initial assessment (before debate)
  evaluatorAssessment?: { content: string; score?: number; timestamp: string }
  // Debate rounds with challenges, defenses, and verdicts
  rounds: DebateRound[]
  originalScore?: number
  finalScore?: number
  isComplete: boolean
  isSkipped: boolean  // Whether debate was skipped (budget/error)
  skipReason?: string // Reason for skipping
}

// A round within a debate
interface DebateRound {
  roundNumber: number
  challenges: { persona: string; content: string; timestamp: string }[]
  defenses: { content: string; concedes?: boolean; adjustedScore?: number; timestamp: string }[]
  arbiterVerdicts: { content: string; adjustment?: number; winner?: string; timestamp: string }[]
}

// Group events by criterion to create isolated debates
function groupEventsByCriterion(events: DebateEvent[]): CriterionDebate[] {
  const debates: Map<string, CriterionDebate> = new Map()
  const roundCounters: Map<string, number> = new Map()

  for (const event of events) {
    const criterion = event.data.criterion
    if (!criterion) continue

    const category = (event.data.category || 'problem').toLowerCase()

    // Initialize debate if first event for this criterion
    if (!debates.has(criterion)) {
      debates.set(criterion, {
        criterion,
        category,
        startTime: event.timestamp,
        rounds: [],
        isComplete: false,
        isSkipped: false,
      })
      roundCounters.set(criterion, 0)
    }

    const debate = debates.get(criterion)!

    switch (event.type) {
      // Criterion debate start (from debate.ts) - this is the authoritative source
      case 'debate:criterion:start':
        // Always set/update the assessment - criterionStart is the authoritative event
        debate.evaluatorAssessment = {
          content: event.data.content || debate.evaluatorAssessment?.content || '',
          score: event.data.score ?? debate.evaluatorAssessment?.score,
          timestamp: event.timestamp,
        }
        debate.originalScore = event.data.score ?? debate.originalScore
        break

      // Initial assessment (from specialized-evaluators.ts, before debate)
      case 'evaluator:initial':
        // Merge with existing if present, otherwise create new
        // This handles the case where evaluator:initial arrives before or after criterionStart
        debate.evaluatorAssessment = {
          content: event.data.content || debate.evaluatorAssessment?.content || '',
          score: event.data.score ?? debate.evaluatorAssessment?.score,
          timestamp: debate.evaluatorAssessment?.timestamp || event.timestamp,
        }
        if (event.data.score !== undefined && debate.originalScore === undefined) {
          debate.originalScore = event.data.score
        }
        break

      // DEPRECATED: Keep for backwards compatibility
      case 'evaluator:speaking':
        if (!debate.evaluatorAssessment) {
          debate.evaluatorAssessment = {
            content: event.data.content || '',
            score: event.data.score,
            timestamp: event.timestamp,
          }
        }
        break

      // Round started - create new round
      case 'debate:round:started': {
        const roundNum = event.data.roundNumber || (roundCounters.get(criterion) || 0) + 1
        roundCounters.set(criterion, roundNum)
        if (!debate.rounds.find(r => r.roundNumber === roundNum)) {
          debate.rounds.push({ roundNumber: roundNum, challenges: [], defenses: [], arbiterVerdicts: [] })
        }
        break
      }

      // Red team challenge
      case 'redteam:challenge': {
        const roundNum = event.data.roundNumber || roundCounters.get(criterion) || 1
        let round = debate.rounds.find(r => r.roundNumber === roundNum)
        if (!round) {
          round = { roundNumber: roundNum, challenges: [], defenses: [], arbiterVerdicts: [] }
          debate.rounds.push(round)
          roundCounters.set(criterion, roundNum)
        }
        round.challenges.push({
          persona: event.data.persona || 'Red Team',
          content: event.data.content || '',
          timestamp: event.timestamp,
        })
        break
      }

      // NEW: Evaluator defense (during debate)
      case 'evaluator:defense': {
        const roundNum = roundCounters.get(criterion) || 1
        let round = debate.rounds.find(r => r.roundNumber === roundNum)
        if (!round) {
          round = { roundNumber: roundNum, challenges: [], defenses: [], arbiterVerdicts: [] }
          debate.rounds.push(round)
        }
        round.defenses.push({
          content: event.data.content || '',
          concedes: event.data.message === 'Evaluator concedes this point',
          adjustedScore: event.data.score,
          timestamp: event.timestamp,
        })
        break
      }

      // Arbiter verdict
      case 'arbiter:verdict': {
        const roundNum = roundCounters.get(criterion) || 1
        let round = debate.rounds.find(r => r.roundNumber === roundNum)
        if (!round) {
          round = { roundNumber: roundNum, challenges: [], defenses: [], arbiterVerdicts: [] }
          debate.rounds.push(round)
        }
        round.arbiterVerdicts.push({
          content: event.data.verdict || event.data.content || '',
          adjustment: event.data.adjustment,
          winner: event.data.message,
          timestamp: event.timestamp,
        })
        break
      }

      // DEPRECATED: Keep for backwards compatibility
      case 'debate:round:complete':
        debate.finalScore = event.data.score
        debate.isComplete = true
        break

      // Criterion debate complete
      case 'debate:criterion:complete':
        debate.finalScore = event.data.score
        debate.isComplete = true
        break

      // Criterion debate skipped (budget/error)
      case 'debate:criterion:skipped':
        debate.finalScore = event.data.score
        debate.originalScore = event.data.score
        debate.isComplete = true
        debate.isSkipped = true
        debate.skipReason = event.data.message || 'Skipped'
        break
    }
  }

  // Sort debates by start time
  return Array.from(debates.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
}

// Format timestamp
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Event type colors for the log
const eventTypeColors: Record<string, string> = {
  'debate:started': 'text-green-600',
  'debate:criterion:start': 'text-blue-600',
  'debate:round:started': 'text-gray-600',
  'evaluator:initial': 'text-blue-500',
  'evaluator:defense': 'text-blue-400',
  'redteam:challenge': 'text-red-500',
  'arbiter:verdict': 'text-purple-500',
  'debate:round:complete': 'text-gray-500',
  'debate:criterion:complete': 'text-green-500',
  'debate:complete': 'text-green-700',
  'synthesis:started': 'text-amber-500',
  'synthesis:complete': 'text-amber-600',
  'api:call': 'text-cyan-500',
  'budget:status': 'text-green-400',
  'error': 'text-red-700',
  'connected': 'text-green-400',
}

type LogTab = 'events' | 'api';

// Event Log Panel component with tabs
function EventLogPanel({
  events,
  isOpen,
  onToggle,
}: {
  events: DebateEvent[]
  isOpen: boolean
  onToggle: () => void
}) {
  const logEndRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<LogTab>('events')

  // Filter events based on active tab
  const filteredEvents = useMemo(() => {
    if (activeTab === 'api') {
      return events.filter(e => e.type === 'api:call')
    }
    // For 'events' tab, show all non-api events
    return events.filter(e => e.type !== 'api:call')
  }, [events, activeTab])

  // Count API calls for badge
  const apiCallCount = useMemo(() =>
    events.filter(e => e.type === 'api:call').length
  , [events])

  // Calculate total API cost
  const totalApiCost = useMemo(() =>
    events
      .filter(e => e.type === 'api:call')
      .reduce((sum, e) => sum + (e.data.cost as number || 0), 0)
  , [events])

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredEvents.length, isOpen])

  return (
    <div className={`bg-gray-900 text-gray-100 transition-all duration-300 ${isOpen ? 'h-64' : 'h-10'}`}>
      {/* Header - clickable to toggle */}
      <button
        onClick={onToggle}
        className="w-full h-10 px-4 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">Event Log</span>
          <span className="text-xs text-gray-500">({events.length} events)</span>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && events.length > 0 && (
            <span className={`text-xs ${eventTypeColors[events[events.length - 1]?.type] || 'text-gray-400'}`}>
              Latest: {events[events.length - 1]?.type}
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Tabs and content */}
      {isOpen && (
        <div className="h-[calc(100%-2.5rem)] flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700 px-2">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('events'); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'events'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Events ({filteredEvents.length})
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveTab('api'); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'api'
                  ? 'text-white border-b-2 border-cyan-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              API Calls
              {apiCallCount > 0 && (
                <span className="bg-cyan-600 text-white px-1.5 py-0.5 rounded text-[10px]">
                  {apiCallCount}
                </span>
              )}
              {totalApiCost > 0 && (
                <span className="text-green-400 text-[10px]">
                  ${totalApiCost.toFixed(4)}
                </span>
              )}
            </button>
          </div>

          {/* Log content */}
          <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-1">
            {filteredEvents.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                {activeTab === 'api' ? 'No API calls yet...' : 'No events yet...'}
              </div>
            ) : (
              <>
                {filteredEvents.slice(-100).map((event, idx) => (
                  <div key={`${event.timestamp}-${idx}`} className="flex gap-2 hover:bg-gray-800 px-1 rounded">
                    <span className="text-gray-500 shrink-0">{formatTime(event.timestamp)}</span>
                    {activeTab === 'api' ? (
                      // API call format
                      <>
                        <span className="text-cyan-400 shrink-0">[{event.data.message}]</span>
                        <span className="text-gray-300">
                          <span className="text-blue-300">{(event.data.inputTokens as number || 0).toLocaleString()}</span>
                          <span className="text-gray-500"> in / </span>
                          <span className="text-purple-300">{(event.data.outputTokens as number || 0).toLocaleString()}</span>
                          <span className="text-gray-500"> out</span>
                          <span className="text-green-400 ml-2">${(event.data.cost as number || 0).toFixed(4)}</span>
                        </span>
                      </>
                    ) : (
                      // Standard event format
                      <>
                        <span className={`shrink-0 ${eventTypeColors[event.type] || 'text-gray-400'}`}>
                          [{event.type}]
                        </span>
                        <span className="text-gray-300 truncate">
                          {event.data.criterion && <span className="text-yellow-400">{event.data.criterion}</span>}
                          {event.data.roundNumber && <span className="text-gray-500"> R{event.data.roundNumber}</span>}
                          {event.data.persona && <span className="text-red-400"> ({event.data.persona})</span>}
                          {event.data.score !== undefined && <span className="text-cyan-400"> score:{event.data.score}</span>}
                          {event.data.adjustment !== undefined && event.data.adjustment !== 0 && (
                            <span className={event.data.adjustment > 0 ? 'text-green-400' : 'text-red-400'}>
                              {' '}{event.data.adjustment > 0 ? '+' : ''}{event.data.adjustment}
                            </span>
                          )}
                          {event.data.message && <span className="text-gray-400"> {event.data.message}</span>}
                        </span>
                      </>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Single debate card for one criterion
function DebateCard({
  debate,
  isActive,
  defaultExpanded,
}: {
  debate: CriterionDebate
  isActive: boolean
  defaultExpanded: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const colors = categoryColors[debate.category] || categoryColors.problem

  return (
    <div className={`rounded-lg border-2 ${colors.border} overflow-hidden mb-4 ${isActive ? 'ring-2 ring-primary-500' : ''}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full ${colors.header} px-4 py-3 flex items-center justify-between hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className={`h-5 w-5 ${colors.text}`} />
          ) : (
            <ChevronRight className={`h-5 w-5 ${colors.text}`} />
          )}
          <MessageSquare className={`h-5 w-5 ${colors.text}`} />
          <div className="text-left">
            <span className={`font-semibold ${colors.text}`}>{debate.criterion}</span>
            <span className={`ml-2 text-xs ${colors.text} opacity-70 capitalize`}>
              ({debate.category})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isActive && (
            <span className="flex items-center gap-1 text-xs bg-primary-500 text-white px-2 py-1 rounded-full">
              <Loader2 className="h-3 w-3 animate-spin" />
              Active
            </span>
          )}
          {debate.isSkipped && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
              Skipped
            </span>
          )}
          {debate.isComplete && debate.finalScore != null && (
            <span className="text-sm font-bold bg-white px-3 py-1 rounded-full shadow-sm">
              {debate.finalScore.toFixed(1)}/10
            </span>
          )}
          {debate.isComplete && !debate.isSkipped && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          {debate.isComplete && debate.isSkipped && (
            <AlertCircle className="h-5 w-5 text-amber-500" />
          )}
        </div>
      </button>

      {/* Expanded content - the debate conversation */}
      {expanded && (
        <div className={`${colors.bg} p-4`}>
          {/* Step 1: Evaluator's initial assessment */}
          {debate.evaluatorAssessment && (
            <div className="mb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-blue-700">Evaluator</span>
                    <span className="text-xs text-gray-400">{formatTime(debate.evaluatorAssessment.timestamp)}</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg rounded-tl-none px-4 py-3">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{debate.evaluatorAssessment.content}</p>
                    {debate.evaluatorAssessment.score != null && (
                      <div className="mt-2 flex justify-end">
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                          Initial Score: {debate.evaluatorAssessment.score}/10
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show skip reason if debate was skipped */}
          {debate.isSkipped && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Debate Skipped</span>
              </div>
              <p className="mt-1 text-sm text-amber-600">
                {debate.skipReason || 'This criterion was not debated'}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                The initial evaluation score ({debate.originalScore}/10) was kept without red team challenge.
              </p>
            </div>
          )}

          {/* Debate rounds: Challenge → Defense → Verdict */}
          {debate.rounds.map((round) => (
            <div key={round.roundNumber} className="mb-4">
              {/* Round header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gray-300" />
                <span className="text-xs font-medium text-gray-500 px-2">
                  Round {round.roundNumber}
                </span>
                <div className="h-px flex-1 bg-gray-300" />
              </div>

              {/* Red Team challenges */}
              {round.challenges.map((challenge, idx) => (
                <div key={`${round.roundNumber}-challenge-${idx}`} className="mb-3 flex justify-end">
                  <div className="flex flex-row-reverse items-start gap-3 max-w-[85%]">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 justify-end">
                        <span className="text-xs text-gray-400">{formatTime(challenge.timestamp)}</span>
                        <span className="text-sm font-semibold text-red-700">{challenge.persona}</span>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg rounded-tr-none px-4 py-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{challenge.content}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Evaluator defenses */}
              {round.defenses.map((defense, idx) => (
                <div key={`${round.roundNumber}-defense-${idx}`} className="mb-3 flex justify-start">
                  <div className="flex items-start gap-3 max-w-[85%]">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-blue-700">
                          Evaluator {defense.concedes ? '(concedes)' : '(defends)'}
                        </span>
                        <span className="text-xs text-gray-400">{formatTime(defense.timestamp)}</span>
                      </div>
                      <div className={`border rounded-lg rounded-tl-none px-4 py-3 ${
                        defense.concedes ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                      }`}>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{defense.content}</p>
                        {defense.adjustedScore != null && (
                          <div className="mt-2 flex justify-end">
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium">
                              Adjusted: {defense.adjustedScore}/10
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Arbiter verdicts */}
              {round.arbiterVerdicts.map((verdict, idx) => (
                <div key={`${round.roundNumber}-verdict-${idx}`} className="mt-3 flex justify-center">
                  <div className="flex items-start gap-3 max-w-[90%]">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Gavel className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-purple-700">Arbiter</span>
                        {verdict.winner && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            verdict.winner === 'EVALUATOR' ? 'bg-blue-100 text-blue-700' :
                            verdict.winner === 'RED_TEAM' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {verdict.winner === 'EVALUATOR' ? 'Evaluator wins' :
                             verdict.winner === 'RED_TEAM' ? 'Red Team wins' : 'Draw'}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{formatTime(verdict.timestamp)}</span>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{verdict.content}</p>
                        {verdict.adjustment != null && verdict.adjustment !== 0 && (
                          <div className="mt-2 flex justify-end">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              verdict.adjustment > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {verdict.adjustment > 0 ? '+' : ''}{verdict.adjustment} points
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Final result */}
          {debate.isComplete && debate.finalScore != null && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-center gap-3 py-2 bg-white rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-gray-700">Debate Complete</span>
                <span className="text-lg font-bold text-gray-900">{debate.finalScore.toFixed(1)}/10</span>
              </div>
            </div>
          )}

          {/* Show loading if active but no rounds yet */}
          {!debate.isComplete && debate.rounds.length === 0 && !debate.evaluatorAssessment && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">Waiting for debate to begin...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Main DebateViewer component
export default function DebateViewer() {
  const { slug: urlSlug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const { ideas, loading: ideasLoading } = useIdeas({ sortBy: 'updated_at', sortOrder: 'desc' })
  const [selectedSlug, setSelectedSlug] = useState(urlSlug || '')
  const [showEventLog, setShowEventLog] = useState(false)

  const {
    connected,
    connecting,
    error,
    events,
    connect,
    disconnect,
    clearEvents,
  } = useDebateStream({
    ideaSlug: selectedSlug,
    autoConnect: !!selectedSlug,
  })

  const debatesEndRef = useRef<HTMLDivElement>(null)

  // Group events into isolated debates by criterion
  const debates = useMemo(() => groupEventsByCriterion(events), [events])

  // Find ALL currently active debates (incomplete ones)
  const activeDebateIndices = useMemo(() => {
    const indices: number[] = []
    debates.forEach((d, i) => {
      if (!d.isComplete) indices.push(i)
    })
    return indices
  }, [debates])

  // Determine overall phase based on all debates
  const overallPhase = useMemo(() => {
    if (debates.length === 0) return 'idle'
    const allComplete = debates.every(d => d.isComplete)
    if (allComplete && debates.length > 0) return 'complete'
    return 'evaluating' // Active evaluation in progress
  }, [debates])

  // Update URL when slug changes
  useEffect(() => {
    if (selectedSlug && selectedSlug !== urlSlug) {
      navigate(`/debate/live/${selectedSlug}`, { replace: true })
    }
  }, [selectedSlug, urlSlug, navigate])

  // Auto-scroll to bottom when new debates arrive
  useEffect(() => {
    debatesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [debates.length])

  // Handle idea selection
  const handleIdeaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSlug = e.target.value
    if (newSlug !== selectedSlug) {
      disconnect()
      clearEvents()
      setSelectedSlug(newSlug)
    }
  }

  // Stats
  const completedCount = debates.filter(d => d.isComplete).length
  const totalChallenges = debates.reduce((sum, d) => sum + d.rounds.reduce((s, r) => s + r.challenges.length, 0), 0)

  // Get latest budget status for API call count and cost
  const latestBudgetEvent = useMemo(() => {
    const budgetEvents = events.filter(e => e.type === 'budget:status')
    return budgetEvents.length > 0 ? budgetEvents[budgetEvents.length - 1] : null
  }, [events])
  const apiCalls = latestBudgetEvent?.data.apiCalls as number | undefined
  const budgetRemaining = latestBudgetEvent?.data.remaining as number | undefined
  const budgetTotal = latestBudgetEvent?.data.total as number | undefined

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold text-gray-900">Live Debate</h1>

          {/* Idea selector */}
          <select
            value={selectedSlug}
            onChange={handleIdeaChange}
            disabled={ideasLoading}
            className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          >
            <option value="">Select an idea...</option>
            {ideas.map((idea) => (
              <option key={idea.id} value={idea.slug}>
                {idea.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-4">
          {/* Connection status */}
          <div className="flex items-center space-x-2">
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <span className="text-sm text-amber-600">Connecting...</span>
              </>
            ) : connected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Disconnected</span>
              </>
            )}
          </div>

          {/* Phase indicator - based on overall progress, not per-event */}
          <div className="flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${phaseColors[overallPhase]} animate-pulse`} />
            <span className="text-sm text-gray-600">{phaseLabels[overallPhase]}</span>
            {activeDebateIndices.length > 0 && overallPhase !== 'complete' && (
              <span className="text-xs text-gray-400">
                ({activeDebateIndices.length} active)
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => (connected ? disconnect() : connect())}
              disabled={!selectedSlug}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title={connected ? 'Disconnect' : 'Reconnect'}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={clearEvents}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Clear events"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {!selectedSlug ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Select an idea to watch the AI debate</p>
              <p className="text-gray-400 text-sm mt-2">
                Each criterion is debated separately with Evaluator, Red Team, and Arbiter
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Debates list - grouped by criterion */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-3xl mx-auto">
                {debates.length === 0 ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 text-primary-500 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-500 font-medium">Waiting for debate to start...</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Run an evaluation on the selected idea to see the live debate
                    </p>
                    <div className="mt-6 bg-white rounded-lg p-4 text-left max-w-md mx-auto shadow-sm border">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">How debates work:</h4>
                      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                        <li>Each of the <strong>30 criteria</strong> gets its own debate</li>
                        <li><span className="text-blue-600 font-medium">Evaluator</span> presents initial assessment</li>
                        <li><span className="text-red-600 font-medium">Red Team</span> challenges the assessment</li>
                        <li><span className="text-purple-600 font-medium">Arbiter</span> judges and adjusts score</li>
                        <li>This repeats for <strong>3 rounds</strong> per criterion</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Progress header */}
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-medium text-gray-700">
                        Debates: {completedCount}/{debates.length} complete
                      </h2>
                      <span className="text-xs text-gray-500">
                        {totalChallenges} total challenges
                      </span>
                    </div>

                    {/* Individual debate cards */}
                    {debates.map((debate, idx) => (
                      <DebateCard
                        key={debate.criterion}
                        debate={debate}
                        isActive={activeDebateIndices.includes(idx)}
                        defaultExpanded={activeDebateIndices.includes(idx) || idx === debates.length - 1}
                      />
                    ))}

                    {/* Typing indicator when evaluation is active */}
                    {overallPhase === 'evaluating' && activeDebateIndices.length > 0 && (
                      <div className="flex justify-center my-4">
                        <div className="bg-white rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border">
                          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          <span className="text-sm text-gray-500">
                            Processing {activeDebateIndices.length} debate{activeDebateIndices.length > 1 ? 's' : ''} in parallel...
                          </span>
                        </div>
                      </div>
                    )}

                    <div ref={debatesEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Sidebar - Overview */}
            <div className="w-64 bg-white border-l p-4 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Debate Overview</h3>

              {/* Progress by category */}
              <div className="space-y-2 mb-6">
                {['problem', 'solution', 'feasibility', 'fit', 'market', 'risk'].map((cat) => {
                  const catDebates = debates.filter(d => d.category === cat)
                  const complete = catDebates.filter(d => d.isComplete).length
                  const total = catDebates.length
                  const colors = categoryColors[cat]

                  return total > 0 ? (
                    <div key={cat} className={`p-2 rounded-lg ${colors.bg} ${colors.border} border`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium capitalize ${colors.text}`}>{cat}</span>
                        <span className={`text-xs ${colors.text}`}>{complete}/{total}</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-white rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors.text.replace('text-', 'bg-').replace('-700', '-500')} rounded-full transition-all`}
                          style={{ width: total > 0 ? `${(complete / total) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ) : null
                })}
              </div>

              {/* Legend */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Participants</h4>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Evaluator</div>
                      <div className="text-gray-500">Initial assessment</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Red Team</div>
                      <div className="text-gray-500">3 personas challenge</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Gavel className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">Arbiter</div>
                      <div className="text-gray-500">Judges & adjusts score</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Completion status */}
              {overallPhase === 'complete' && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">All Debates Complete</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {completedCount} criteria evaluated
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Event Log Panel */}
      <EventLogPanel
        events={events}
        isOpen={showEventLog}
        onToggle={() => setShowEventLog(!showEventLog)}
      />

      {/* Status bar */}
      <div className="bg-gray-800 text-white px-4 py-2 text-xs flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span>Criteria: {completedCount}/{debates.length || 30}</span>
          <span>Events: {events.length}</span>
          {apiCalls !== undefined && (
            <span className="text-cyan-400" title="Total API calls made (informational - does not control stopping)">
              API Calls: {apiCalls}
            </span>
          )}
          {budgetRemaining !== undefined && budgetTotal !== undefined && (
            <span className="text-green-400" title="Budget in dollars - evaluation stops when budget is exhausted">
              Budget: ${budgetRemaining.toFixed(2)} / ${budgetTotal.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {overallPhase === 'complete' && (
            <>
              <CheckCircle className="h-3 w-3 text-green-400" />
              <span>Evaluation Complete</span>
            </>
          )}
          {overallPhase === 'evaluating' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
              <span>Processing...</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
