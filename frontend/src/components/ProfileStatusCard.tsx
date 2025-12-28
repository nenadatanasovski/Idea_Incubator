import { User, AlertTriangle, Link as LinkIcon, Clock } from 'lucide-react'
import { format } from 'date-fns'
import type { UserProfileSummary } from '../types'

interface ProfileStatusCardProps {
  profile: UserProfileSummary | null
  loading: boolean
  onLink: () => void
  onUnlink: () => void
}

function parseGoals(goalsJson: string): string[] {
  try {
    const parsed = JSON.parse(goalsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function ProfileStatusCard({ profile, loading, onLink, onUnlink }: ProfileStatusCardProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-16 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-amber-800">No profile linked</div>
              <p className="text-sm text-amber-700 mt-1">
                Personal Fit scores (FT1-FT5) will default to 5/10 with low confidence.
                Link a profile for accurate evaluation.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onLink}
                  className="btn btn-primary text-sm"
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Link Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const goals = parseGoals(profile.primary_goals)

  return (
    <div className="card border-green-200 bg-green-50">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-green-800">
              Evaluating as: {profile.name}
            </div>
            <div className="text-sm text-green-700 mt-1 space-y-1">
              {goals.length > 0 && (
                <div>
                  <span className="font-medium">Goals:</span>{' '}
                  {goals.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}
                </div>
              )}
              {profile.employment_status && (
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  {profile.employment_status.replace(/-/g, ' ')}
                  {profile.weekly_hours_available && ` (${profile.weekly_hours_available} hrs/week)`}
                </div>
              )}
              {profile.risk_tolerance && (
                <div>
                  <span className="font-medium">Risk:</span>{' '}
                  {profile.risk_tolerance.charAt(0).toUpperCase() + profile.risk_tolerance.slice(1)} tolerance
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center text-xs text-green-600">
              <Clock className="h-3 w-3 mr-1" />
              Updated {format(new Date(profile.updated_at), 'MMM d, yyyy')}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onLink}
            className="btn btn-secondary text-sm"
          >
            Change
          </button>
          <button
            onClick={onUnlink}
            className="btn btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Unlink
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-green-200">
        <p className="text-xs text-green-700">
          FT1-FT5 scores will be personalized based on this profile
        </p>
      </div>
    </div>
  )
}
