import { useState } from 'react'
import { X, AlertTriangle, Check } from 'lucide-react'
import type { IdeaStatus } from '../types'
import { statusConfig } from './StatusBadge'

interface StatusTransitionDialogProps {
  currentStatus: IdeaStatus
  onClose: () => void
  onConfirm: (newStatus: IdeaStatus, reason: string) => void
  isLoading?: boolean
}

// Valid status transitions
const validTransitions: Record<IdeaStatus, IdeaStatus[]> = {
  active: ['paused', 'abandoned', 'completed'],
  paused: ['active', 'abandoned', 'archived'],
  abandoned: ['active', 'archived'],
  completed: ['archived'],
  archived: ['active']
}

const transitionDescriptions: Record<string, string> = {
  'active-paused': 'Temporarily pause work on this idea',
  'active-abandoned': 'Stop pursuing this idea',
  'active-completed': 'Mark this idea as ready to move forward',
  'paused-active': 'Resume work on this idea',
  'paused-abandoned': 'Stop pursuing this paused idea',
  'paused-archived': 'Archive this paused idea for later reference',
  'abandoned-active': 'Resurrect this abandoned idea',
  'abandoned-archived': 'Archive this abandoned idea',
  'completed-archived': 'Archive this completed idea',
  'archived-active': 'Resurrect this archived idea'
}

export default function StatusTransitionDialog({
  currentStatus,
  onClose,
  onConfirm,
  isLoading = false
}: StatusTransitionDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<IdeaStatus | null>(null)
  const [reason, setReason] = useState('')

  const availableTransitions = validTransitions[currentStatus] || []

  const handleConfirm = () => {
    if (selectedStatus) {
      onConfirm(selectedStatus, reason)
    }
  }

  const requiresReason = selectedStatus === 'paused' || selectedStatus === 'abandoned'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Change Status</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Current status:{' '}
            <span className={`font-medium ${statusConfig[currentStatus].color.replace('text-', 'text-')}`}>
              {statusConfig[currentStatus].label}
            </span>
          </p>

          {availableTransitions.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p>No transitions available from this status</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Select new status
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {availableTransitions.map(status => {
                    const config = statusConfig[status]
                    const description = transitionDescriptions[`${currentStatus}-${status}`]
                    const isSelected = selectedStatus === status

                    return (
                      <button
                        key={status}
                        onClick={() => setSelectedStatus(status)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`p-1.5 rounded-full ${config.bgColor}`}>
                          {isSelected ? (
                            <Check className={`h-4 w-4 ${config.color}`} />
                          ) : (
                            <config.icon className={`h-4 w-4 ${config.color}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{config.label}</div>
                          {description && (
                            <div className="text-xs text-gray-500">{description}</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedStatus && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Reason {requiresReason ? '(required)' : '(optional)'}
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={
                      requiresReason
                        ? 'Please provide a reason for this change...'
                        : 'Optional: Add a note about this change...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              )}
            </>
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
            disabled={!selectedStatus || isLoading || (requiresReason && !reason.trim())}
            className="btn btn-primary"
          >
            {isLoading ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
