import { User, AlertTriangle, Link as LinkIcon } from 'lucide-react'
import type { UserProfileSummary } from '../types'

interface ProfileStatusCardProps {
  profile: UserProfileSummary | null
  loading: boolean
  onLink: () => void
  onUnlink: () => void
  compact?: boolean
}

function parseGoals(goalsJson: string): string[] {
  try {
    const parsed = JSON.parse(goalsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function ProfileStatusCard({ profile, loading, onLink, onUnlink, compact = false }: ProfileStatusCardProps) {
  if (loading) {
    return compact ? (
      <div className="inline-flex items-center px-2 py-1 bg-gray-100 rounded animate-pulse">
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
    ) : (
      <div className="p-3 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-8 bg-gray-200 rounded" />
      </div>
    )
  }

  // Compact variant - inline badge style
  if (compact) {
    if (!profile) {
      return (
        <button
          onClick={onLink}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="h-3 w-3" />
          <span>No profile</span>
        </button>
      )
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs">
        <User className="h-3 w-3 text-green-600" />
        <span className="text-green-800 font-medium">{profile.name}</span>
        <button
          onClick={onLink}
          className="text-gray-400 hover:text-gray-600 ml-1"
          title="Change profile"
        >
          <LinkIcon className="h-3 w-3" />
        </button>
      </div>
    )
  }

  // Full display when no profile - inline alert
  if (!profile) {
    return (
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            No profile linked — Fit scores will default to 5/10
          </span>
        </div>
        <button
          onClick={onLink}
          className="text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          <LinkIcon className="h-3 w-3 inline mr-1" />
          Link
        </button>
      </div>
    )
  }

  const goals = parseGoals(profile.primary_goals)

  // Full display when profile is linked - single line with details on hover
  return (
    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-sm text-green-800">
          <span className="font-medium">{profile.name}</span>
          {goals.length > 0 && (
            <span className="text-green-600 ml-2">
              · {goals.slice(0, 2).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}
              {goals.length > 2 && ` +${goals.length - 2}`}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onLink}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Change
        </button>
        <button
          onClick={onUnlink}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Unlink
        </button>
      </div>
    </div>
  )
}
