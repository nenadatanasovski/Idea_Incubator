import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import { scoreInterpretation } from '../types'
import type { IdeaType } from '../types'

const ideaTypeColors: Record<IdeaType, string> = {
  business: 'bg-blue-100 text-blue-800',
  creative: 'bg-purple-100 text-purple-800',
  technical: 'bg-green-100 text-green-800',
  personal: 'bg-orange-100 text-orange-800',
  research: 'bg-cyan-100 text-cyan-800',
}

interface IdeaContextHeaderProps {
  title: string
  type: IdeaType
  score: number | null
  confidence: number | null
  onShowDescription?: () => void
  visible: boolean
  rightContent?: React.ReactNode
}

export default function IdeaContextHeader({
  title,
  type,
  score,
  confidence,
  onShowDescription,
  visible,
  rightContent
}: IdeaContextHeaderProps) {
  return (
    <div className={clsx(
      'fixed top-16 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm',
      !visible && 'hidden'
    )}>
      <div className="px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back link, type, title, view description */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/ideas"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <span className="text-gray-300">|</span>
            <span className={`badge ${ideaTypeColors[type]} flex-shrink-0`}>{type}</span>
            <h2 className="font-semibold text-gray-900 truncate">{title}</h2>
            {onShowDescription && (
              <button
                onClick={onShowDescription}
                className="text-xs text-primary-600 hover:text-primary-700 flex-shrink-0"
              >
                View Description
              </button>
            )}
          </div>

          {/* Right: Meta info and score */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {rightContent}
            {score !== null && (
              <div className="flex items-center gap-1">
                <span className={clsx('text-lg font-bold', scoreInterpretation.getColor(score))}>
                  {score.toFixed(2)}
                </span>
                {confidence !== null && (
                  <span className="text-xs text-gray-400">
                    {Math.round(confidence * 100)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
