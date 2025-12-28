import { useState } from 'react'
import { HelpCircle, AlertCircle, Lightbulb, Send, X } from 'lucide-react'
import type { Question, QuestionPriority } from '../types'
import { priorityMeta, categoryNames } from '../types'

interface QuestionCardProps {
  question: Question
  onAnswer: (questionId: string, answer: string) => Promise<void>
  onSkip?: (questionId: string) => void
  existingAnswer?: string
  disabled?: boolean
}

function PriorityBadge({ priority }: { priority: QuestionPriority }) {
  const meta = priorityMeta[priority]
  return (
    <span className={`text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  )
}

function QuestionTypeIcon({ type }: { type: Question['type'] }) {
  switch (type) {
    case 'factual':
      return <span title="Factual question"><HelpCircle className="h-4 w-4 text-blue-500" /></span>
    case 'analytical':
      return <span title="Analytical question"><Lightbulb className="h-4 w-4 text-amber-500" /></span>
    case 'reflective':
      return <span title="Reflective question"><AlertCircle className="h-4 w-4 text-purple-500" /></span>
    default:
      return null
  }
}

export default function QuestionCard({
  question,
  onAnswer,
  onSkip,
  existingAnswer,
  disabled = false
}: QuestionCardProps) {
  const [answer, setAnswer] = useState(existingAnswer || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(!existingAnswer)

  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting || disabled) return

    setIsSubmitting(true)
    try {
      await onAnswer(question.id, answer.trim())
      setIsExpanded(false)
    } catch (error) {
      console.error('Failed to submit answer:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={`card ${existingAnswer ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <QuestionTypeIcon type={question.type} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {question.criterion}
              </span>
              <span className="text-xs text-gray-400">
                {categoryNames[question.category]}
              </span>
              <PriorityBadge priority={question.priority} />
            </div>
            <p className="font-medium text-gray-900">{question.text}</p>
          </div>
        </div>
        {existingAnswer && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      {/* Answer Section */}
      {isExpanded && (
        <div className="mt-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            rows={3}
            disabled={disabled || isSubmitting}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              Press Cmd+Enter to submit
            </span>
            <div className="flex gap-2">
              {onSkip && !existingAnswer && (
                <button
                  onClick={() => onSkip(question.id)}
                  disabled={disabled || isSubmitting}
                  className="btn btn-secondary text-sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Skip
                </button>
              )}
              {existingAnswer && (
                <button
                  onClick={() => setIsExpanded(false)}
                  disabled={isSubmitting}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || disabled || isSubmitting}
                className="btn btn-primary text-sm"
              >
                <Send className="h-4 w-4 mr-1" />
                {isSubmitting ? 'Saving...' : existingAnswer ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Answer Display */}
      {existingAnswer && !isExpanded && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-sm text-green-800">{existingAnswer}</p>
        </div>
      )}
    </div>
  )
}
