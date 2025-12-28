import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Calendar, Tag, Edit2, Trash2, Play, Loader2, Lightbulb } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { format } from 'date-fns'
import { useIdea } from '../hooks/useIdeas'
import { useEvaluationRuns, useSynthesis } from '../hooks/useEvaluations'
import { useIdeaProfile, useProfiles } from '../hooks/useProfiles'
import { useDevelopment } from '../hooks/useQuestions'
import { deleteIdea, triggerEvaluation, updateIdeaStage } from '../api/client'
import { lifecycleStages, scoreInterpretation } from '../types'
import type { LifecycleStage, IdeaType } from '../types'
import EvaluationDashboard from '../components/EvaluationDashboard'
import EvaluationScorecard from '../components/EvaluationScorecard'
import LifecycleTimeline from '../components/LifecycleTimeline'
import RedTeamView from '../components/RedTeamView'
import SynthesisView from '../components/SynthesisView'
import ProfileStatusCard from '../components/ProfileStatusCard'
import ProfileSelector from '../components/ProfileSelector'
import ReadinessMeter from '../components/ReadinessMeter'
import DevelopmentWizard from '../components/DevelopmentWizard'
import AnswerHistory from '../components/AnswerHistory'
import clsx from 'clsx'

const ideaTypeColors: Record<IdeaType, string> = {
  business: 'bg-blue-100 text-blue-800',
  creative: 'bg-purple-100 text-purple-800',
  technical: 'bg-green-100 text-green-800',
  personal: 'bg-orange-100 text-orange-800',
  research: 'bg-cyan-100 text-cyan-800',
}

type TabId = 'overview' | 'develop' | 'scorecard' | 'evaluation' | 'redteam' | 'synthesis'

export default function IdeaDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { idea, loading, error, refetch } = useIdea(slug)
  const { runs } = useEvaluationRuns(slug)
  const [selectedRun, setSelectedRun] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { synthesis } = useSynthesis(slug, selectedRun)

  // Profile state
  const { profile, loading: profileLoading, link: linkProfile, unlink: unlinkProfile } = useIdeaProfile(slug)
  const { profiles } = useProfiles()
  const [showProfileSelector, setShowProfileSelector] = useState(false)
  const [isLinkingProfile, setIsLinkingProfile] = useState(false)

  // Development state (dynamic questioning)
  const {
    readiness,
    coverage,
    answers,
    loading: developmentLoading,
    deleteAnswer,
    refetchAll
  } = useDevelopment(slug)
  const [showDevelopWizard, setShowDevelopWizard] = useState(false)

  const [isDeleting, setIsDeleting] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!slug || !confirm('Are you sure you want to delete this idea? This action cannot be undone.')) {
      return
    }
    setIsDeleting(true)
    setActionError(null)
    try {
      await deleteIdea(slug)
      navigate('/ideas')
    } catch (err) {
      setActionError((err as Error).message)
      setIsDeleting(false)
    }
  }

  const handleEvaluate = async () => {
    if (!slug) return
    setIsEvaluating(true)
    setActionError(null)
    try {
      await triggerEvaluation(slug)
      // Navigate to live debate viewer
      navigate(`/debate/live/${slug}`)
    } catch (err) {
      setActionError((err as Error).message)
      setIsEvaluating(false)
    }
  }

  const handleStageChange = async (newStage: LifecycleStage) => {
    if (!slug) return
    try {
      await updateIdeaStage(slug, newStage)
      refetch()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  const handleLinkProfile = async (profileId: string) => {
    setIsLinkingProfile(true)
    try {
      await linkProfile(profileId)
      setShowProfileSelector(false)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setIsLinkingProfile(false)
    }
  }

  const handleUnlinkProfile = async () => {
    try {
      await unlinkProfile()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="text-gray-500">Loading idea...</p>
      </div>
    )
  }

  if (error || !idea) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-600">
          {error?.message || 'Idea not found'}
        </p>
        <Link to="/ideas" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to ideas
        </Link>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'develop', label: 'Develop', count: answers.length },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'evaluation', label: 'Details' },
    { id: 'redteam', label: 'Red Team' },
    { id: 'synthesis', label: 'Synthesis' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/ideas"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to ideas
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`badge ${ideaTypeColors[idea.idea_type]}`}>
                {idea.idea_type}
              </span>
              <span
                className={`badge ${
                  lifecycleStages[idea.lifecycle_stage as LifecycleStage]?.color ||
                  'bg-gray-500'
                } text-white`}
              >
                {lifecycleStages[idea.lifecycle_stage as LifecycleStage]?.label ||
                  idea.lifecycle_stage}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">
              {idea.title}
            </h1>
            {idea.summary && (
              <p className="mt-2 text-gray-600">{idea.summary}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Created {format(new Date(idea.created_at), 'MMM d, yyyy')}
              </span>
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Updated {format(new Date(idea.updated_at), 'MMM d, yyyy')}
              </span>
            </div>
            {idea.tags && idea.tags.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {idea.tags.map((tag) => (
                    <span key={tag} className="badge bg-gray-100 text-gray-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Score */}
          {idea.avg_final_score !== null && (
            <div className="text-right">
              <div
                className={`text-4xl font-bold ${scoreInterpretation.getColor(
                  idea.avg_final_score
                )}`}
              >
                {idea.avg_final_score.toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">
                {scoreInterpretation.getLevel(idea.avg_final_score)}
              </div>
              {idea.avg_confidence !== null && (
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round(idea.avg_confidence * 100)}% confidence
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDevelopWizard(true)}
              className="btn btn-secondary inline-flex items-center"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Develop Idea
            </button>
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="btn btn-primary inline-flex items-center"
            >
              {isEvaluating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isEvaluating ? 'Starting...' : 'Run Evaluation'}
            </button>
            <Link
              to={`/ideas/${slug}/edit`}
              className="btn btn-secondary inline-flex items-center"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="btn btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50 inline-flex items-center"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </button>
          </div>

          {/* Stage quick-change */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Stage:</span>
            <select
              value={idea.lifecycle_stage}
              onChange={(e) => handleStageChange(e.target.value as LifecycleStage)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {Object.entries(lifecycleStages)
                .sort((a, b) => a[1].order - b[1].order)
                .map(([stage, meta]) => (
                  <option key={stage} value={stage}>
                    {meta.label}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {actionError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {actionError}
          </div>
        )}
      </div>

      {/* Profile Status */}
      <ProfileStatusCard
        profile={profile}
        loading={profileLoading}
        onLink={() => setShowProfileSelector(true)}
        onUnlink={handleUnlinkProfile}
      />

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <ProfileSelector
          profiles={profiles}
          currentProfileId={profile?.id || null}
          onSelect={handleLinkProfile}
          onClose={() => setShowProfileSelector(false)}
          loading={isLinkingProfile}
        />
      )}

      {/* Lifecycle Timeline */}
      <LifecycleTimeline currentStage={idea.lifecycle_stage as LifecycleStage} />

      {/* Evaluation Run Selector */}
      {runs.length > 0 && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Evaluation Run
          </label>
          <select
            value={selectedRun || ''}
            onChange={(e) => setSelectedRun(e.target.value || undefined)}
            className="input max-w-xs"
          >
            <option value="">Latest</option>
            {runs.map((run) => (
              <option key={run} value={run}>
                {run.slice(0, 8)}... ({format(new Date(parseInt(run.split('-')[0], 16) * 1000), 'MMM d, HH:mm')})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 badge bg-gray-100 text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Mini Readiness Indicator */}
          {readiness && !developmentLoading && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Evaluation Readiness</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={clsx(
                      'h-2 rounded-full transition-all duration-300',
                      readiness.overall >= 0.7 ? 'bg-green-500' :
                      readiness.overall >= 0.4 ? 'bg-yellow-500' : 'bg-red-400'
                    )}
                    style={{ width: `${Math.round(readiness.overall * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 min-w-[3rem]">
                  {Math.round(readiness.overall * 100)}%
                </span>
                {!readiness.readyForEvaluation && (
                  <button
                    onClick={() => setActiveTab('develop')}
                    className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    Develop idea →
                  </button>
                )}
                {readiness.readyForEvaluation && (
                  <span className="text-sm text-green-600 font-medium">
                    Ready for evaluation
                  </span>
                )}
              </div>
              {readiness.blockingGaps.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  <span className="font-medium">Missing:</span>{' '}
                  {readiness.blockingGaps.slice(0, 3).join(', ')}
                  {readiness.blockingGaps.length > 3 && ` +${readiness.blockingGaps.length - 3} more`}
                </div>
              )}
            </div>
          )}

          {/* Idea Content */}
          <div className="card">
            <div className="markdown-content">
              {idea.content ? (
                <ReactMarkdown>{idea.content}</ReactMarkdown>
              ) : (
                <p className="text-gray-500 italic">No content available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'develop' && (
        <div className="space-y-6">
          {/* Readiness Meter */}
          {readiness && !developmentLoading && (
            <ReadinessMeter
              readiness={readiness}
              coverage={coverage}
              onDevelop={() => setShowDevelopWizard(true)}
              onEvaluate={handleEvaluate}
            />
          )}

          {developmentLoading && (
            <div className="card">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading development data...
              </div>
            </div>
          )}

          {/* Answer History */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Your Answers ({answers.length})
            </h3>
            <AnswerHistory
              answers={answers}
              onEdit={() => {
                // For now, just open the wizard - editing inline could be added later
                setShowDevelopWizard(true)
              }}
              onDelete={async (questionId) => {
                if (confirm('Delete this answer?')) {
                  try {
                    await deleteAnswer(questionId)
                  } catch (err) {
                    setActionError((err as Error).message)
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {activeTab === 'scorecard' && (
        <EvaluationScorecard slug={slug!} runId={selectedRun} profile={profile} />
      )}

      {activeTab === 'evaluation' && (
        <EvaluationDashboard slug={slug!} runId={selectedRun} />
      )}

      {activeTab === 'redteam' && (
        <RedTeamView slug={slug!} runId={selectedRun} />
      )}

      {activeTab === 'synthesis' && (
        <SynthesisView synthesis={synthesis} />
      )}

      {/* Development Wizard Modal */}
      {showDevelopWizard && slug && (
        <DevelopmentWizard
          isOpen={showDevelopWizard}
          ideaSlug={slug}
          onClose={() => {
            setShowDevelopWizard(false)
            refetchAll()
          }}
          onEvaluate={handleEvaluate}
        />
      )}
    </div>
  )
}
