import { X, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface IdeaDescriptionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  summary: string | null
  content: string | null
}

export default function IdeaDescriptionModal({
  isOpen,
  onClose,
  title,
  summary,
  content
}: IdeaDescriptionModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-grow">
          {summary && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-500 mb-1">Summary</p>
              <p className="text-gray-700">{summary}</p>
            </div>
          )}

          {content ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-gray-500 italic">No detailed description available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
