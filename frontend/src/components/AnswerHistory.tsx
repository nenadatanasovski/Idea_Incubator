import { useState } from 'react'
import { ChevronDown, ChevronRight, Edit2, Trash2, Bot, User, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import type { Answer, QuestionCategory } from '../types'
import { categoryNames, priorityMeta } from '../types'

interface AnswerHistoryProps {
  answers: Answer[]
  onEdit?: (questionId: string, currentAnswer: string) => void
  onDelete?: (questionId: string) => void
  groupByCategory?: boolean
}

function SourceIcon({ source }: { source: Answer['answerSource'] }) {
  switch (source) {
    case 'user':
      return <span title="User provided"><User className="h-3 w-3" /></span>
    case 'ai_extracted':
      return <span title="AI extracted from content"><Bot className="h-3 w-3" /></span>
    case 'ai_inferred':
      return <span title="AI inferred"><Sparkles className="h-3 w-3" /></span>
    default:
      return null
  }
}

function AnswerCard({
  answer,
  onEdit,
  onDelete
}: {
  answer: Answer
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const question = answer.question
  if (!question) return null

  const priority = priorityMeta[question.priority]

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {question.criterion}
            </span>
            <span className={`text-xs ${priority.color}`}>
              {priority.label}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <SourceIcon source={answer.answerSource} />
              {answer.answerSource === 'user' ? 'You' : 'AI'}
            </span>
            {answer.confidence < 1 && (
              <span className="text-xs text-amber-600">
                {Math.round(answer.confidence * 100)}% confidence
              </span>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-left w-full"
          >
            <p className="text-sm font-medium text-gray-700 line-clamp-2">
              {question.text}
            </p>
          </button>

          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{answer.answer}</p>
              <p className="text-xs text-gray-400 mt-2">
                Answered {format(new Date(answer.answeredAt), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          )}

          {!isExpanded && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{answer.answer}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500"
              title="Edit answer"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
              title="Delete answer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CategorySection({
  category,
  answers,
  onEdit,
  onDelete
}: {
  category: QuestionCategory
  answers: Answer[]
  onEdit?: (questionId: string, currentAnswer: string) => void
  onDelete?: (questionId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <span className="font-medium text-gray-700">
            {categoryNames[category]}
          </span>
          <span className="text-sm text-gray-500">
            ({answers.length} {answers.length === 1 ? 'answer' : 'answers'})
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2">
          {answers.map(answer => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              onEdit={onEdit ? () => onEdit(answer.questionId, answer.answer) : undefined}
              onDelete={onDelete ? () => onDelete(answer.questionId) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AnswerHistory({
  answers,
  onEdit,
  onDelete,
  groupByCategory = true
}: AnswerHistoryProps) {
  if (answers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No answers yet.</p>
        <p className="text-sm mt-1">Start developing your idea to capture answers.</p>
      </div>
    )
  }

  if (!groupByCategory) {
    return (
      <div className="space-y-2">
        {answers.map(answer => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            onEdit={onEdit ? () => onEdit(answer.questionId, answer.answer) : undefined}
            onDelete={onDelete ? () => onDelete(answer.questionId) : undefined}
          />
        ))}
      </div>
    )
  }

  // Group answers by category
  const groupedAnswers = answers.reduce((acc, answer) => {
    const category = answer.question?.category || 'problem'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(answer)
    return acc
  }, {} as Record<QuestionCategory, Answer[]>)

  // Order categories
  const categoryOrder: QuestionCategory[] = [
    'problem',
    'solution',
    'feasibility',
    'fit',
    'market',
    'risk',
    'business_model'
  ]

  return (
    <div className="space-y-3">
      {categoryOrder.map(category => {
        const categoryAnswers = groupedAnswers[category]
        if (!categoryAnswers || categoryAnswers.length === 0) return null

        return (
          <CategorySection
            key={category}
            category={category}
            answers={categoryAnswers}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      })}
    </div>
  )
}
