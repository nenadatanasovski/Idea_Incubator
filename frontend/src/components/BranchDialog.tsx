import { useState } from 'react'
import { X, GitBranch, AlertTriangle } from 'lucide-react'

interface BranchDialogProps {
  parentTitle: string
  onClose: () => void
  onConfirm: (data: {
    title: string
    reason: string
    parentAction: 'keep_active' | 'pause' | 'abandon'
  }) => void
  isLoading?: boolean
}

const parentActions = [
  {
    value: 'keep_active' as const,
    label: 'Keep parent active',
    description: 'Continue working on both the parent and the new branch'
  },
  {
    value: 'pause' as const,
    label: 'Pause parent',
    description: 'Focus on the new branch, can resume parent later'
  },
  {
    value: 'abandon' as const,
    label: 'Abandon parent',
    description: 'Replace the parent with this new direction'
  }
]

export default function BranchDialog({
  parentTitle,
  onClose,
  onConfirm,
  isLoading = false
}: BranchDialogProps) {
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [parentAction, setParentAction] = useState<'keep_active' | 'pause' | 'abandon'>('keep_active')

  const handleConfirm = () => {
    if (title.trim() && reason.trim()) {
      onConfirm({
        title: title.trim(),
        reason: reason.trim(),
        parentAction
      })
    }
  }

  const isValid = title.trim().length >= 3 && reason.trim().length >= 10

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Create Branch</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Create a variant of <strong>{parentTitle}</strong> with a different direction or focus.
          </p>

          {/* Title */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              New idea title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter a title for the branched idea..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {title.length > 0 && title.length < 3 && (
              <p className="text-xs text-red-500">Title must be at least 3 characters</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              How is this different? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain what makes this branch different from the original idea..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-red-500">Please provide more detail (at least 10 characters)</p>
            )}
          </div>

          {/* Parent Action */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              What to do with the parent idea?
            </label>
            <div className="space-y-2">
              {parentActions.map(action => (
                <label
                  key={action.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    parentAction === action.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="parentAction"
                    value={action.value}
                    checked={parentAction === action.value}
                    onChange={() => setParentAction(action.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{action.label}</div>
                    <div className="text-xs text-gray-500">{action.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {parentAction === 'abandon' && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Abandoning the parent idea means it will be marked as abandoned. You can still resurrect it later if needed.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
            className="btn btn-primary bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? 'Creating...' : 'Create Branch'}
          </button>
        </div>
      </div>
    </div>
  )
}
