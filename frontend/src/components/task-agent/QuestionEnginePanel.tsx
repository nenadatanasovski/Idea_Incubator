/**
 * Question Engine Panel Component
 *
 * Displays development questions for task clarification.
 * Part of: Task System V2 Implementation Plan (IMPL-7.12)
 */

import { useState, useEffect } from 'react'
import {
  HelpCircle,
  Check,
  X,
  ChevronRight,
  RefreshCw,
  Send,
  MessageSquare
} from 'lucide-react'

type QuestionCategory =
  | 'requirements'
  | 'scope'
  | 'acceptance'
  | 'dependencies'
  | 'impacts'
  | 'testing'
  | 'architecture'
  | 'risks'

interface DevelopmentQuestion {
  id: string
  category: QuestionCategory
  question: string
  importance: 'required' | 'recommended' | 'optional'
  answer?: string
  answeredAt?: string
}

interface QuestionEnginePanelProps {
  taskId: string
  onComplete?: () => void
}

const categoryConfig: Record<QuestionCategory, { color: string; bgColor: string; label: string }> = {
  requirements: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Requirements' },
  scope: { color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Scope' },
  acceptance: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Acceptance' },
  dependencies: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Dependencies' },
  impacts: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Impacts' },
  testing: { color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Testing' },
  architecture: { color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Architecture' },
  risks: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Risks' }
}

const importanceConfig = {
  required: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Required' },
  recommended: { color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Recommended' },
  optional: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Optional' }
}

export default function QuestionEnginePanel({ taskId, onComplete }: QuestionEnginePanelProps) {
  const [questions, setQuestions] = useState<DevelopmentQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [filterCategory, setFilterCategory] = useState<QuestionCategory | 'all'>('all')

  useEffect(() => {
    fetchQuestions()
  }, [taskId])

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/questions`)
      if (response.ok) {
        setQuestions(await response.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateQuestions = async () => {
    try {
      setGenerating(true)
      const response = await fetch(`/api/task-agent/tasks/${taskId}/questions/generate`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to generate questions')

      const newQuestions = await response.json()
      setQuestions(newQuestions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  const submitAnswer = async (questionId: string) => {
    if (!answerText.trim()) return

    try {
      const response = await fetch(`/api/task-agent/tasks/${taskId}/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText })
      })

      if (!response.ok) throw new Error('Failed to submit answer')

      // Update local state
      setQuestions(questions.map(q =>
        q.id === questionId
          ? { ...q, answer: answerText, answeredAt: new Date().toISOString() }
          : q
      ))
      setActiveQuestion(null)
      setAnswerText('')

      // Check if all required questions are answered
      const updatedQuestions = questions.map(q =>
        q.id === questionId ? { ...q, answer: answerText } : q
      )
      const allRequiredAnswered = updatedQuestions
        .filter(q => q.importance === 'required')
        .every(q => q.answer)

      if (allRequiredAnswered) {
        onComplete?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const skipQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`/api/task-agent/tasks/${taskId}/questions/${questionId}/skip`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to skip question')

      setQuestions(questions.filter(q => q.id !== questionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // Filter and sort questions
  const filteredQuestions = questions
    .filter(q => filterCategory === 'all' || q.category === filterCategory)
    .sort((a, b) => {
      // Unanswered first, then by importance
      if (a.answer && !b.answer) return 1
      if (!a.answer && b.answer) return -1
      const importanceOrder = { required: 0, recommended: 1, optional: 2 }
      return importanceOrder[a.importance] - importanceOrder[b.importance]
    })

  const answeredCount = questions.filter(q => q.answer).length
  const requiredUnanswered = questions.filter(q => q.importance === 'required' && !q.answer).length

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-gray-400" />
          <h3 className="font-medium">Development Questions</h3>
          <span className="text-sm text-gray-500">
            {answeredCount}/{questions.length} answered
          </span>
        </div>
        <button
          onClick={generateQuestions}
          disabled={generating}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {/* Progress */}
      {requiredUnanswered > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {requiredUnanswered} required question{requiredUnanswered > 1 ? 's' : ''} need{requiredUnanswered === 1 ? 's' : ''} answers
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-2 py-1 rounded text-xs ${
            filterCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => {
          const count = questions.filter(q => q.category === key).length
          if (count === 0) return null
          return (
            <button
              key={key}
              onClick={() => setFilterCategory(key as QuestionCategory)}
              className={`px-2 py-1 rounded text-xs ${
                filterCategory === key
                  ? `${config.bgColor} ${config.color}`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {config.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Questions List */}
      <div className="space-y-2">
        {filteredQuestions.map(question => {
          const catConfig = categoryConfig[question.category]
          const impConfig = importanceConfig[question.importance]
          const isActive = activeQuestion === question.id
          const isAnswered = !!question.answer

          return (
            <div
              key={question.id}
              className={`border rounded-lg overflow-hidden ${
                isAnswered ? 'border-gray-200 bg-gray-50' : 'border-gray-200'
              }`}
            >
              {/* Question Header */}
              <div
                onClick={() => !isAnswered && setActiveQuestion(isActive ? null : question.id)}
                className={`p-3 flex items-start gap-3 ${!isAnswered ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                {isAnswered ? (
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <ChevronRight className={`h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs ${catConfig.bgColor} ${catConfig.color}`}>
                      {catConfig.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${impConfig.bgColor} ${impConfig.color}`}>
                      {impConfig.label}
                    </span>
                  </div>
                  <p className={`mt-2 ${isAnswered ? 'text-gray-500' : 'text-gray-900'}`}>
                    {question.question}
                  </p>
                  {isAnswered && (
                    <div className="mt-2 p-2 bg-white rounded border border-gray-100">
                      <p className="text-sm text-gray-700">{question.answer}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Answered {new Date(question.answeredAt!).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                {!isAnswered && question.importance !== 'required' && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      skipQuestion(question.id)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Skip this question"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Answer Input */}
              {isActive && !isAnswered && (
                <div className="p-3 border-t border-gray-100 bg-gray-50">
                  <textarea
                    value={answerText}
                    onChange={e => setAnswerText(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setActiveQuestion(null)
                        setAnswerText('')
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => submitAnswer(question.id)}
                      disabled={!answerText.trim()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {questions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No questions yet</p>
          <p className="text-sm">Click "Generate" to create development questions</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
