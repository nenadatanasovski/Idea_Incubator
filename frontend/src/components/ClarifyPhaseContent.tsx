import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'
import QuestionCard, { type Suggestion } from './QuestionCard'
import ReadinessMeter from './ReadinessMeter'
import IterationHeader from './IterationHeader'
import type { ReadinessScore, Answer, QuestionCategory, CriterionCoverage } from '../types'
import { categoryNames, priorityMeta } from '../types'
import clsx from 'clsx'

interface GroupedQuestion {
  id: string
  text: string
  criterion: string
  category: string
  priority: string
  answered: boolean
  answer?: string
}

interface AllQuestionsData {
  grouped: Record<string, GroupedQuestion[]>
  totalQuestions: number
  answeredCount: number
}

interface IterationContext {
  iterationNumber: number
  previousScore?: number
  currentScore?: number
  focusAreas: string[]
  weakCategories: { category: string; score: number }[]
  userDirection?: string
}

interface ClarifyPhaseContentProps {
  ideaSlug: string
  iterationContext?: IterationContext
  onEvaluate?: () => void
  className?: string
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function ClarifyPhaseContent({
  ideaSlug,
  iterationContext,
  onEvaluate,
  className
}: ClarifyPhaseContentProps) {
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null)
  const [coverage, setCoverage] = useState<CriterionCoverage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)

  // All questions view state
  const [allQuestionsData, setAllQuestionsData] = useState<AllQuestionsData | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['problem', 'solution']))

  // Multiple expanded questions support
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())

  // Bulk AI suggestions state
  const [suggestionsMap, setSuggestionsMap] = useState<Map<string, Suggestion[]>>(new Map())
  const [isFetchingBulkSuggestions, setIsFetchingBulkSuggestions] = useState(false)
  const [bulkSuggestionsProgress, setBulkSuggestionsProgress] = useState({ current: 0, total: 0 })

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Load answers, questions metadata, and all questions
        const [answersRes, questionsRes, allQuestionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/ideas/${ideaSlug}/answers`),
          fetch(`${API_BASE}/api/ideas/${ideaSlug}/questions`),
          fetch(`${API_BASE}/api/ideas/${ideaSlug}/questions/all`)
        ])

        if (answersRes.ok) {
          const answersData = await answersRes.json()
          if (answersData.success) {
            const answerMap = new Map<string, string>()
            answersData.data.answers.forEach((a: Answer) => {
              answerMap.set(a.questionId, a.answer)
            })
            setAnswers(answerMap)
          }
        }

        if (questionsRes.ok) {
          const questionsData = await questionsRes.json()
          if (questionsData.success) {
            setReadiness(questionsData.data.readiness)
            setCoverage(questionsData.data.coverage || [])
            setTotalAnswered(questionsData.data.answeredCount)
            setTotalQuestions(questionsData.data.totalQuestions)
          }
        }

        if (allQuestionsRes.ok) {
          const allData = await allQuestionsRes.json()
          if (allData.success) {
            setAllQuestionsData(allData.data)
          }
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [ideaSlug])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleAnswer = async (questionId: string, answer: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/ideas/${ideaSlug}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer })
      })

      if (!res.ok) {
        throw new Error(`Failed to save answer: ${res.status}`)
      }

      const data = await res.json()
      if (data.success) {
        const newAnswers = new Map(answers).set(questionId, answer)
        setAnswers(newAnswers)
        setReadiness(data.data.readiness)
        setTotalAnswered(prev => prev + 1)

        // Update allQuestionsData
        if (allQuestionsData) {
          setAllQuestionsData(prev => {
            if (!prev) return prev
            const updated = { ...prev, answeredCount: prev.answeredCount + 1, grouped: { ...prev.grouped } }
            for (const cat of Object.keys(updated.grouped)) {
              updated.grouped[cat] = updated.grouped[cat].map(q =>
                q.id === questionId ? { ...q, answered: true, answer } : q
              )
            }
            return updated
          })
        }

        // Collapse the question after answering
        setExpandedQuestions(prev => {
          const next = new Set(prev)
          next.delete(questionId)
          return next
        })
      }
    } catch (err) {
      console.error('Failed to save answer:', err)
    }
  }

  // Toggle individual question expansion
  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  // Fetch AI suggestions for all unanswered questions
  const handleBulkSuggestions = async () => {
    if (!allQuestionsData) return

    // Collect all unanswered questions
    const unansweredQuestions: GroupedQuestion[] = []
    for (const cat of Object.keys(allQuestionsData.grouped)) {
      const questions = allQuestionsData.grouped[cat] || []
      for (const q of questions) {
        if (!q.answered) {
          unansweredQuestions.push(q)
        }
      }
    }

    if (unansweredQuestions.length === 0) return

    setIsFetchingBulkSuggestions(true)
    setBulkSuggestionsProgress({ current: 0, total: unansweredQuestions.length })

    const newSuggestionsMap = new Map(suggestionsMap)
    const newExpandedQuestions = new Set(expandedQuestions)

    // Also expand the categories that contain unanswered questions
    const categoriesToExpand = new Set(expandedCategories)

    // Process questions in parallel batches of 5 to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < unansweredQuestions.length; i += batchSize) {
      const batch = unansweredQuestions.slice(i, i + batchSize)

      const promises = batch.map(async (q) => {
        try {
          const res = await fetch(`${API_BASE}/api/ideas/${ideaSlug}/questions/${q.id}/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })

          if (res.ok) {
            const data = await res.json()
            if (data.success && data.data.suggestions && data.data.suggestions.length > 0) {
              return { questionId: q.id, category: q.category, suggestions: data.data.suggestions }
            }
          }
        } catch (err) {
          console.error(`Failed to get suggestions for question ${q.id}:`, err)
        }
        return null
      })

      const results = await Promise.all(promises)

      for (const result of results) {
        if (result) {
          newSuggestionsMap.set(result.questionId, result.suggestions)
          newExpandedQuestions.add(result.questionId)
          categoriesToExpand.add(result.category)
        }
      }

      setBulkSuggestionsProgress({ current: Math.min(i + batchSize, unansweredQuestions.length), total: unansweredQuestions.length })
    }

    setSuggestionsMap(newSuggestionsMap)
    setExpandedQuestions(newExpandedQuestions)
    setExpandedCategories(categoriesToExpand)
    setIsFetchingBulkSuggestions(false)
  }

  // Count unanswered questions
  const unansweredCount = allQuestionsData
    ? Object.values(allQuestionsData.grouped).flat().filter(q => !q.answered).length
    : 0

  if (loading) {
    return (
      <div className={clsx('card flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={clsx('card text-center py-8', className)}>
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-secondary">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Iteration context banner */}
      {iterationContext && iterationContext.iterationNumber > 1 && (
        <IterationHeader
          iterationNumber={iterationContext.iterationNumber}
          previousScore={iterationContext.previousScore}
          currentScore={iterationContext.currentScore}
          focusAreas={iterationContext.focusAreas}
          weakCategories={iterationContext.weakCategories}
          userDirection={iterationContext.userDirection}
        />
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions area - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress bar */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>{totalAnswered} of {totalQuestions} answered</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%`
                }}
              />
            </div>
          </div>

          {/* Bulk AI Suggestions Button */}
          {unansweredCount > 0 && (
            <button
              onClick={handleBulkSuggestions}
              disabled={isFetchingBulkSuggestions}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isFetchingBulkSuggestions ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>
                    Generating suggestions... ({bulkSuggestionsProgress.current}/{bulkSuggestionsProgress.total})
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Provide AI Suggestions for all {unansweredCount} open questions</span>
                </>
              )}
            </button>
          )}

          {/* Questions view content */}
          {allQuestionsData ? (
            <div className="space-y-4">
              {Object.entries(categoryNames).map(([cat, name]) => {
                const catQuestions = allQuestionsData.grouped[cat] || []
                if (catQuestions.length === 0) return null

                const answered = catQuestions.filter(q => q.answered).length
                const isCategoryExpanded = expandedCategories.has(cat)

                return (
                  <div key={cat} className="card p-0 overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{name}</span>
                        <span className="text-sm text-gray-500">
                          {answered} / {catQuestions.length} answered
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${(answered / catQuestions.length) * 100}%` }}
                          />
                        </div>
                        {isCategoryExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </button>

                    {isCategoryExpanded && (
                      <div className="divide-y divide-gray-100">
                        {catQuestions.map(q => {
                          const isQuestionExpanded = expandedQuestions.has(q.id)
                          const questionSuggestions = suggestionsMap.get(q.id)

                          return (
                            <div key={q.id} className="border-b border-gray-100 last:border-b-0">
                              {/* Question header - clickable to expand/collapse */}
                              <button
                                onClick={() => toggleQuestion(q.id)}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors"
                              >
                                <div className={clsx(
                                  'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                                  q.answered ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                                )}>
                                  {q.answered ? (
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-current" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={clsx('text-sm', q.answered ? 'text-gray-500' : 'text-gray-900')}>
                                    {q.text}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-400">{q.criterion}</span>
                                    <span className={clsx(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      q.priority === 'critical' ? 'bg-red-50 text-red-600' :
                                      q.priority === 'important' ? 'bg-amber-50 text-amber-600' :
                                      'bg-gray-50 text-gray-500'
                                    )}>
                                      {priorityMeta[q.priority as keyof typeof priorityMeta]?.label}
                                    </span>
                                    {questionSuggestions && questionSuggestions.length > 0 && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" />
                                        AI suggestions ready
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isQuestionExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                )}
                              </button>

                              {/* Expanded QuestionCard inline */}
                              {isQuestionExpanded && (
                                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                                  <QuestionCard
                                    question={{
                                      id: q.id,
                                      text: q.text,
                                      criterion: q.criterion,
                                      category: q.category as QuestionCategory,
                                      priority: q.priority as 'critical' | 'important' | 'nice-to-have',
                                      type: 'factual',
                                      idea_types: null,
                                      lifecycle_stages: null,
                                      depends_on: null,
                                      follow_ups: null
                                    }}
                                    onAnswer={handleAnswer}
                                    onSkip={() => toggleQuestion(q.id)}
                                    existingAnswer={q.answer}
                                    ideaSlug={ideaSlug}
                                    initialSuggestions={questionSuggestions}
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card text-center py-8 text-gray-500">
              No questions available
            </div>
          )}
        </div>

        {/* Sidebar - Readiness meter - Sticky below fixed header */}
        <div className="lg:col-span-1">
          <div className="sticky top-28 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
            {readiness && (
              <ReadinessMeter
                readiness={readiness}
                coverage={coverage}
                showDetails={true}
              />
            )}

            {/* Quick stats */}
            <div className="card">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Overall Progress</h4>
              <div className="text-3xl font-bold text-gray-900">
                {totalAnswered} / {totalQuestions}
              </div>
              <p className="text-sm text-gray-500">questions answered</p>

              {readiness?.readyForEvaluation && onEvaluate && (
                <button
                  onClick={onEvaluate}
                  className="w-full btn btn-primary mt-4"
                >
                  Proceed to Evaluation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
