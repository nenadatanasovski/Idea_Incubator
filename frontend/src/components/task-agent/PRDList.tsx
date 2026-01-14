/**
 * PRD List Component
 *
 * Displays a list of PRDs with filtering and status indicators.
 * Part of: Task System V2 Implementation Plan (IMPL-7.1)
 */

import { useState, useEffect } from 'react'
import { FileText, ChevronRight, Check, Clock, Edit, AlertCircle } from 'lucide-react'

interface PRD {
  id: string
  title: string
  description?: string
  status: 'draft' | 'review' | 'approved' | 'archived'
  parentId?: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
  approvedBy?: string
}

interface PRDListProps {
  onSelect?: (prd: PRD) => void
  selectedId?: string
  filter?: 'all' | 'draft' | 'review' | 'approved' | 'archived'
}

const statusConfig = {
  draft: {
    icon: Edit,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Draft'
  },
  review: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'In Review'
  },
  approved: {
    icon: Check,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Approved'
  },
  archived: {
    icon: AlertCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    label: 'Archived'
  }
}

export default function PRDList({ onSelect, selectedId, filter = 'all' }: PRDListProps) {
  const [prds, setPrds] = useState<PRD[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPRDs()
  }, [filter])

  const fetchPRDs = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/prds'
        : `/api/prds?status=${filter}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch PRDs')
      const data = await response.json()
      setPrds(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        <AlertCircle className="h-5 w-5 inline mr-2" />
        {error}
      </div>
    )
  }

  if (prds.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p>No PRDs found</p>
        <p className="text-sm">Create a new PRD to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {prds.map(prd => {
        const config = statusConfig[prd.status]
        const StatusIcon = config.icon
        const isSelected = selectedId === prd.id

        return (
          <div
            key={prd.id}
            onClick={() => onSelect?.(prd)}
            className={`
              p-4 rounded-lg border cursor-pointer transition-all
              ${isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <h3 className="font-medium text-gray-900 truncate">
                    {prd.title}
                  </h3>
                </div>
                {prd.description && (
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    {prd.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                  <span>
                    Updated {new Date(prd.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { statusConfig as prdStatusConfig }
export type { PRD }
