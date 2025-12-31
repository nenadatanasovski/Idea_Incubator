import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Tag, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useIdea } from '../hooks/useIdeas'
import { useEvaluationRuns, useSynthesis, useCategoryScores, usePreviousRunScores } from '../hooks/useEvaluations'
import { useIdeaProfile, useProfiles } from '../hooks/useProfiles'
import { useDevelopment } from '../hooks/useQuestions'
import { useAllocation } from '../hooks/useAllocation'
import {
  deleteIdea,
  triggerEvaluation,
  getVersionHistory,
  getLineage,
  getIterations,
  getDebateRounds,
  updateIdeaStatus as updateStatus,
  createBranch as createIdeaBranch,
  updateIncubationPhase,
  type IdeaVersion,
  type IdeaLineage,
  type IterationLog,
} from '../api/client'
import type { DebateRound } from '../types'
import type { IdeaStatus } from '../types'

// New phase-based components
import IncubationStepper, { type IncubationPhase, incubationPhases } from '../components/IncubationStepper'
import PhaseContainer, { CapturePhaseContent, EvaluatePhaseHeaderContent } from '../components/PhaseContainer'
import ClarifyPhaseContent from '../components/ClarifyPhaseContent'
import PositionPhaseContainer from '../components/PositionPhaseContainer'
import { type Gap } from '../components/GapAnalysisView'
import ViabilityAdvisoryModal, { type ViabilityDecision } from '../components/ViabilityAdvisoryModal'
import EvaluationAdvisoryModal, { type EvaluationDecision } from '../components/EvaluationAdvisoryModal'
import IterationHeader from '../components/IterationHeader'
import UpdatePhaseContent from '../components/UpdatePhaseContent'

// Existing components still in use
import ProfileStatusCard from '../components/ProfileStatusCard'
import IdeaContextHeader from '../components/IdeaContextHeader'
import EvaluationTabs from '../components/EvaluationTabs'
import ProfileSelector from '../components/ProfileSelector'
import StatusBadge from '../components/StatusBadge'
import StatusTransitionDialog from '../components/StatusTransitionDialog'
import BranchDialog from '../components/BranchDialog'
import EvaluationSettingsModal from '../components/EvaluationSettingsModal'
import VersionTimeline from '../components/VersionTimeline'
import LineageTree from '../components/LineageTree'
import RiskResponseSummary from '../components/RiskResponseSummary'
import IdeaDescriptionModal from '../components/IdeaDescriptionModal'

// Secondary view modes for detailed views
type SecondaryView = 'none' | 'scorecard' | 'evaluation' | 'redteam' | 'synthesis' | 'history'

export default function IdeaDetailPhased() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { idea, loading, error, refetch } = useIdea(slug)
  const { runs: _runs } = useEvaluationRuns(slug)
  const [selectedRun] = useState<string | undefined>()
  const { synthesis } = useSynthesis(slug, selectedRun)
  const { scores: categoryScores } = useCategoryScores(slug, selectedRun)
  const { previousScores } = usePreviousRunScores(slug, selectedRun)

  // Profile state
  const { profile, loading: profileLoading, link: linkProfile, unlink: unlinkProfile } = useIdeaProfile(slug)
  const { profiles } = useProfiles()
  const [showProfileSelector, setShowProfileSelector] = useState(false)
  const [isLinkingProfile, setIsLinkingProfile] = useState(false)

  // Development state
  const {
    readiness
  } = useDevelopment(slug)

  // Positioning decision (includes risk responses)
  const { decision: positioningDecision } = useAllocation(slug)

  // Lifecycle state
  const [versions, setVersions] = useState<IdeaVersion[]>([])
  const [lineage, setLineage] = useState<IdeaLineage | null>(null)
  const [iterations, setIterations] = useState<IterationLog[]>([])
  const [debateRounds, setDebateRounds] = useState<DebateRound[]>([])
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)

  // Action states
  const [, setIsDeleting] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showEvalSettings, setShowEvalSettings] = useState(false)

  // Phase navigation state
  const [showViabilityAdvisory, setShowViabilityAdvisory] = useState(false)
  const [showEvaluationAdvisory, setShowEvaluationAdvisory] = useState(false)
  const [secondaryView, setSecondaryView] = useState<SecondaryView>('none')

  const [showDescriptionModal, setShowDescriptionModal] = useState(false)

  // Gap data (derived from readiness)
  const [gaps] = useState<Gap[]>([])

  // Helper to map DB phase names to UI phase names
  // DB uses 'differentiation', UI uses 'position'
  const mapDbPhaseToUi = (dbPhase: string | undefined): IncubationPhase => {
    if (!dbPhase) return 'capture'
    if (dbPhase === 'differentiation') return 'position'
    // Check if it's a valid UI phase
    const validPhases: IncubationPhase[] = ['capture', 'clarify', 'position', 'update', 'evaluate', 'iterate']
    if (validPhases.includes(dbPhase as IncubationPhase)) {
      return dbPhase as IncubationPhase
    }
    return 'capture'
  }

  // Position phase completion state
  const [positionPhaseComplete, setPositionPhaseComplete] = useState(false)

  // Optimistic phase state for instant UI updates
  const [optimisticPhase, setOptimisticPhase] = useState<IncubationPhase | null>(null)

  // Derive current phase from idea data (with DB-to-UI mapping), or use optimistic value
  const derivedPhase: IncubationPhase = mapDbPhaseToUi(idea?.incubation_phase)
  const currentPhase: IncubationPhase = optimisticPhase ?? derivedPhase

  // Clear optimistic phase when derived phase catches up
  useEffect(() => {
    if (optimisticPhase && derivedPhase === optimisticPhase) {
      setOptimisticPhase(null)
    }
  }, [derivedPhase, optimisticPhase])

  // Calculate completed phases
  const completedPhases = useMemo(() => {
    const phaseOrder = incubationPhases.map(p => p.id)
    const currentIdx = phaseOrder.indexOf(currentPhase)
    return phaseOrder.slice(0, currentIdx) as IncubationPhase[]
  }, [currentPhase])

  // Build lookup map for previous scores by criterion (from previous evaluation run)
  // Must be defined before any early returns to satisfy React's Rules of Hooks
  const previousScoresByCriterion = useMemo(() => {
    const map = new Map<string, number>()
    if (previousScores) {
      for (const cat of previousScores) {
        for (const criterion of cat.criteria) {
          map.set(criterion.criterion, criterion.final_score)
        }
      }
    }
    return map
  }, [previousScores])

  // Determine if user can advance to next phase
  const canAdvancePhase = useMemo(() => {
    switch (currentPhase) {
      case 'capture':
        return !!(idea?.title && (idea?.summary || idea?.content))
      case 'clarify':
        return (readiness?.overall ?? 0) >= 0.8
      case 'position':
        return positionPhaseComplete
      case 'update':
        return true // User can always proceed after reviewing
      case 'evaluate':
        return !!synthesis
      case 'iterate':
        return true
      default:
        return false
    }
  }, [currentPhase, idea, readiness, positionPhaseComplete, synthesis])

  // Load lifecycle data
  useEffect(() => {
    if (!slug) return

    const loadLifecycleData = async () => {
      try {
        const [versionsData, lineageData, iterationsData, debateRoundsData] = await Promise.all([
          getVersionHistory(slug),
          getLineage(slug),
          getIterations(slug),
          getDebateRounds(slug)
        ])
        setVersions(versionsData)
        setLineage(lineageData)
        setIterations(iterationsData)
        setDebateRounds(debateRoundsData)
      } catch (err) {
        console.error('Failed to load lifecycle data:', err)
      }
    }

    loadLifecycleData()
  }, [slug])


  // Phase navigation handlers (optimistic updates for instant UI response)
  const handlePhaseClick = async (phase: IncubationPhase) => {
    if (!slug) return

    // Check if this requires a gate
    if (currentPhase === 'clarify' && phase === 'position') {
      setShowViabilityAdvisory(true)
      return
    }

    // Optimistic update - set immediately for instant UI response
    setOptimisticPhase(phase)

    // Update in background, don't block UI
    updateIncubationPhase(slug, phase)
      .then(() => refetch())
      .catch(err => {
        setOptimisticPhase(null) // Revert on error
        setActionError((err as Error).message)
      })
  }

  const handleAdvancePhase = () => {
    if (!slug) return

    const phaseOrder = incubationPhases.map(p => p.id)
    const currentIdx = phaseOrder.indexOf(currentPhase)
    const nextPhase = phaseOrder[currentIdx + 1] as IncubationPhase

    if (!nextPhase) return

    // Check if this requires a gate
    if (currentPhase === 'clarify') {
      setShowViabilityAdvisory(true)
      return
    }

    if (currentPhase === 'evaluate' && synthesis) {
      setShowEvaluationAdvisory(true)
      return
    }

    // Optimistic update - instant UI response
    setOptimisticPhase(nextPhase)

    // Update in background
    updateIncubationPhase(slug, nextPhase)
      .then(() => refetch())
      .catch(err => {
        setOptimisticPhase(null)
        setActionError((err as Error).message)
      })
  }

  const handleBackPhase = () => {
    if (!slug) return

    const phaseOrder = incubationPhases.map(p => p.id)
    const currentIdx = phaseOrder.indexOf(currentPhase)
    const prevPhase = phaseOrder[currentIdx - 1] as IncubationPhase

    if (!prevPhase) return

    // Optimistic update - instant UI response
    setOptimisticPhase(prevPhase)

    // Update in background
    updateIncubationPhase(slug, prevPhase)
      .then(() => refetch())
      .catch(err => {
        setOptimisticPhase(null)
        setActionError((err as Error).message)
      })
  }

  // Viability gate decision handler
  const handleViabilityDecision = (decision: ViabilityDecision) => {
    if (!slug) return

    setShowViabilityAdvisory(false)

    if (decision === 'proceed') {
      // Optimistic update
      setOptimisticPhase('position')
      updateIncubationPhase(slug, 'position')
        .then(() => refetch())
        .catch(err => {
          setOptimisticPhase(null)
          setActionError((err as Error).message)
        })
    } else if (decision === 'pause') {
      updateStatus(slug, 'paused', 'Paused at viability gate')
        .then(() => refetch())
        .catch(err => setActionError((err as Error).message))
    }
    // research_more: stay in clarify phase
  }

  // Evaluation gate decision handler
  const handleEvaluationDecision = (decision: EvaluationDecision) => {
    if (!slug) return

    setShowEvaluationAdvisory(false)

    switch (decision) {
      case 'pursue':
        updateStatus(slug, 'completed', 'Pursuing idea after evaluation')
          .then(() => refetch())
          .catch(err => setActionError((err as Error).message))
        break
      case 'iterate':
        // Optimistic update
        setOptimisticPhase('iterate')
        updateIncubationPhase(slug, 'iterate')
          .then(() => refetch())
          .catch(err => {
            setOptimisticPhase(null)
            setActionError((err as Error).message)
          })
        break
      case 'branch':
        setShowBranchDialog(true)
        break
      case 'pause':
        updateStatus(slug, 'paused', 'Paused after evaluation')
          .then(() => refetch())
          .catch(err => setActionError((err as Error).message))
        break
      case 'abandon':
        updateStatus(slug, 'abandoned', 'Abandoned after evaluation')
          .then(() => refetch())
          .catch(err => setActionError((err as Error).message))
        break
    }
  }

  // Standard handlers
  const handleStatusChange = async (newStatus: IdeaStatus, reason: string) => {
    if (!slug) return
    setIsUpdatingStatus(true)
    try {
      await updateStatus(slug, newStatus, reason)
      setShowStatusDialog(false)
      refetch()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleCreateBranch = async (data: { title: string; reason: string; parentAction: 'keep_active' | 'pause' | 'abandon' }) => {
    if (!slug) return
    setIsCreatingBranch(true)
    try {
      const result = await createIdeaBranch(slug, data)
      setShowBranchDialog(false)
      navigate(`/ideas/${result.slug}`)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setIsCreatingBranch(false)
    }
  }

  const _handleDelete = async () => {
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
  void _handleDelete // mark as intentionally unused

  const handleEvaluate = () => {
    if (!slug) return
    setShowEvalSettings(true)
  }

  const handleEvaluateWithSettings = async (settings: { budget: number; unlimited: boolean; debateRounds: number }) => {
    if (!slug) return
    setIsEvaluating(true)
    setActionError(null)
    try {
      await triggerEvaluation(slug, {
        budget: settings.budget,
        unlimited: settings.unlimited,
        debateRounds: settings.debateRounds,
      })
      setShowEvalSettings(false)
      navigate(`/debate/live/${slug}`)
    } catch (err) {
      setActionError((err as Error).message)
      setIsEvaluating(false)
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

  // Loading state
  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        <span className="ml-2 text-gray-500">Loading idea...</span>
      </div>
    )
  }

  if (error || !idea) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-600">{error?.message || 'Idea not found'}</p>
        <Link to="/ideas" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to ideas
        </Link>
      </div>
    )
  }

  const ideaStatus: IdeaStatus = (idea?.status as IdeaStatus) || 'active'
  const iterationNumber = (idea as { iteration_number?: number })?.iteration_number || 1
  const latestIteration = iterations[0]

  // Calculate weak criteria from category scores for evaluation advisory
  // Use final_score to identify weaknesses, include debate challenges as reasoning
  const weakCriteria = categoryScores
    ?.flatMap((cat: { criteria: Array<{ criterion: string; category: string; initial_score: number; final_score: number; reasoning: string }> }) => cat.criteria)
    .filter((c: { final_score: number }) => c.final_score < 6)
    .sort((a: { final_score: number }, b: { final_score: number }) => a.final_score - b.final_score)
    .slice(0, 5)
    .map((c: { criterion: string; category: string; initial_score: number; final_score: number; reasoning: string }) => {
      // Get debate challenges for this criterion
      const criterionDebates = debateRounds.filter(r => r.criterion === c.criterion)
      const debateChallenges = criterionDebates
        .filter(r => r.arbiter_verdict === 'RED_TEAM' || r.arbiter_verdict === 'DRAW')
        .map(r => r.redteam_challenge)
        .filter((ch): ch is string => ch !== null)
      return {
        criterion: c.criterion,
        category: c.category,
        previousScore: previousScoresByCriterion.get(c.criterion),  // From previous evaluation run
        finalScore: c.final_score,
        reasoning: c.reasoning,
        debateChallenges
      }
    }) || []

  // Derive viability recommendation
  const criticalGaps = gaps.filter(g => g.impact === 'critical' && !g.resolved)
  const significantGaps = gaps.filter(g => g.impact === 'significant' && !g.resolved)
  const viabilityRecommendation: ViabilityDecision =
    criticalGaps.length > 0 ? 'research_more' :
    (readiness?.overall ?? 0) < 0.8 ? 'research_more' : 'proceed'

  // Derive evaluation recommendation
  const evaluationRecommendation: EvaluationDecision =
    synthesis?.recommendation === 'PURSUE' ? 'pursue' :
    synthesis?.recommendation === 'REFINE' ? 'iterate' :
    synthesis?.recommendation === 'PAUSE' ? 'pause' : 'iterate'

  return (
    <div className="space-y-4">
      {/* Context Header - fixed bar below nav */}
      <IdeaContextHeader
          title={idea.title}
          type={idea.idea_type}
          score={idea.avg_final_score}
          confidence={idea.avg_confidence}
          visible={true}
          onShowDescription={() => setShowDescriptionModal(true)}
          rightContent={
            <div className="flex items-center gap-3 text-sm">
              <button onClick={() => setShowStatusDialog(true)}>
                <StatusBadge status={ideaStatus} size="sm" />
              </button>
              {iterationNumber > 1 && (
                <span className="badge bg-amber-100 text-amber-800 text-xs">
                  v{iterationNumber}
                </span>
              )}
              <span className="text-gray-400 hidden md:inline">
                {format(new Date(idea.updated_at), 'MMM d')}
              </span>
              {idea.tags && idea.tags.length > 0 && (
                <div className="hidden lg:flex items-center gap-1">
                  <Tag className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">{idea.tags.slice(0, 2).join(', ')}</span>
                  {idea.tags.length > 2 && (
                    <span className="text-gray-400">+{idea.tags.length - 2}</span>
                  )}
                </div>
              )}
              <ProfileStatusCard
                profile={profile}
                loading={profileLoading}
                onLink={() => setShowProfileSelector(true)}
                onUnlink={unlinkProfile}
                compact={true}
              />
            </div>
          }
        />

      {/* Spacer for fixed context header */}
      <div className="h-8" />

      {/* Error display */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {actionError}
          <button
            onClick={() => setActionError(null)}
            className="ml-2 text-red-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Incubation Stepper - Sticky Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-28">
            <IncubationStepper
            currentPhase={currentPhase}
            completedPhases={completedPhases}
            canAdvance={canAdvancePhase}
            readinessPercent={(readiness?.overall ?? 0) * 100}
            blockingGaps={readiness?.blockingGaps || []}
            onPhaseClick={handlePhaseClick}
            onAdvance={handleAdvancePhase}
            onBack={handleBackPhase}
          />
          </div>
        </div>

        {/* Phase Content - Main Area */}
        <div className="lg:col-span-3">
          <PhaseContainer
            currentPhase={currentPhase}
            headerRightContent={currentPhase === 'evaluate' ? (
              <EvaluatePhaseHeaderContent
                hasEvaluation={!!synthesis}
                score={idea.avg_final_score}
                confidence={idea.avg_confidence}
                isEvaluating={isEvaluating}
                onEvaluate={handleEvaluate}
              />
            ) : undefined}
          >
            {/* CAPTURE phase */}
            {currentPhase === 'capture' && (
              <CapturePhaseContent
                ideaTitle={idea.title}
                ideaSummary={idea.summary}
                ideaContent={idea.content}
                onEdit={() => navigate(`/ideas/${slug}/edit`)}
                onContinue={handleAdvancePhase}
              />
            )}

            {/* CLARIFY phase */}
            {currentPhase === 'clarify' && (
              <ClarifyPhaseContent
                ideaSlug={slug!}
                iterationContext={iterationNumber > 1 ? {
                  iterationNumber,
                  previousScore: latestIteration?.previousScore,
                  currentScore: idea.avg_final_score ?? undefined,
                  focusAreas: latestIteration?.focusCategories || [],
                  weakCategories: weakCriteria.map(c => ({
                    category: c.category,
                    score: c.finalScore
                  })),
                  userDirection: latestIteration?.userDirection
                } : undefined}
                onEvaluate={handleEvaluate}
              />
            )}

            {/* POSITION phase */}
            {currentPhase === 'position' && (
              <PositionPhaseContainer
                slug={slug!}
                profile={profile || null}
                onPhaseComplete={() => {
                  setPositionPhaseComplete(true)
                  handleAdvancePhase()
                }}
                onBack={() => handlePhaseClick('clarify')}
              />
            )}

            {/* UPDATE phase */}
            {currentPhase === 'update' && (
              <UpdatePhaseContent
                ideaSlug={slug!}
                currentTitle={idea.title}
                currentSummary={idea.summary}
                onApplied={() => {
                  refetch()
                  handleAdvancePhase()
                }}
                onSkip={handleAdvancePhase}
              />
            )}

            {/* EVALUATE phase */}
            {currentPhase === 'evaluate' && synthesis && (
              <EvaluationTabs
                slug={slug!}
                runId={selectedRun}
                synthesis={synthesis}
                profile={profile}
                riskResponses={positioningDecision?.riskResponses}
                riskResponseStats={positioningDecision?.riskResponseStats}
                defaultTab="scorecard"
                weakCriteria={weakCriteria}
                previousScore={latestIteration?.previousScore}
                recommendation={evaluationRecommendation}
                onDecision={handleEvaluationDecision}
              />
            )}

            {/* ITERATE phase */}
            {currentPhase === 'iterate' && (
              <div className="space-y-6">
                <IterationHeader
                  iterationNumber={iterationNumber}
                  previousScore={latestIteration?.previousScore}
                  currentScore={idea.avg_final_score ?? undefined}
                  focusAreas={latestIteration?.focusCategories || weakCriteria.map(c => c.category)}
                  weakCategories={weakCriteria.map(c => ({ category: c.category, score: c.finalScore }))}
                  userDirection={latestIteration?.userDirection}
                />

                {/* Compact Risk Response Summary */}
                {positioningDecision?.riskResponses && positioningDecision.riskResponses.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Risk responses:</span>
                    <RiskResponseSummary
                      responses={positioningDecision.riskResponses}
                      stats={positioningDecision.riskResponseStats || null}
                      compact
                    />
                  </div>
                )}

                <ClarifyPhaseContent
                  ideaSlug={slug!}
                  iterationContext={{
                    iterationNumber,
                    previousScore: latestIteration?.previousScore,
                    currentScore: idea.avg_final_score ?? undefined,
                    focusAreas: latestIteration?.focusCategories || weakCriteria.map(c => c.category),
                    weakCategories: weakCriteria.map(c => ({ category: c.category, score: c.finalScore })),
                    userDirection: latestIteration?.userDirection
                  }}
                  onEvaluate={handleEvaluate}
                />
              </div>
            )}
          </PhaseContainer>

          {/* History view */}
          {secondaryView === 'history' && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">History & Lineage</h3>
                <button
                  onClick={() => setSecondaryView('none')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>

              {lineage && (
                <LineageTree lineage={lineage} currentSlug={slug!} />
              )}

              <div className="mt-6">
                <VersionTimeline
                  versions={versions}
                  onViewVersion={(version) => console.log('View version', version)}
                  onCompareVersions={(v1, v2) => console.log('Compare', v1, v2)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showProfileSelector && (
        <ProfileSelector
          profiles={profiles}
          currentProfileId={profile?.id || null}
          onSelect={handleLinkProfile}
          onClose={() => setShowProfileSelector(false)}
          loading={isLinkingProfile}
        />
      )}

      {showEvalSettings && (
        <EvaluationSettingsModal
          onStart={handleEvaluateWithSettings}
          onClose={() => setShowEvalSettings(false)}
          loading={isEvaluating}
        />
      )}

      {showStatusDialog && (
        <StatusTransitionDialog
          currentStatus={ideaStatus}
          onClose={() => setShowStatusDialog(false)}
          onConfirm={handleStatusChange}
          isLoading={isUpdatingStatus}
        />
      )}

      {showBranchDialog && (
        <BranchDialog
          parentTitle={idea.title}
          onClose={() => setShowBranchDialog(false)}
          onConfirm={handleCreateBranch}
          isLoading={isCreatingBranch}
        />
      )}

      <IdeaDescriptionModal
        isOpen={showDescriptionModal}
        onClose={() => setShowDescriptionModal(false)}
        title={idea.title}
        summary={idea.summary}
        content={idea.content}
      />

      <ViabilityAdvisoryModal
        isOpen={showViabilityAdvisory}
        readinessPercent={(readiness?.overall ?? 0) * 100}
        criticalGaps={criticalGaps}
        significantGaps={significantGaps}
        recommendation={viabilityRecommendation}
        onDecision={handleViabilityDecision}
        onClose={() => setShowViabilityAdvisory(false)}
      />

      <EvaluationAdvisoryModal
        isOpen={showEvaluationAdvisory}
        overallScore={idea.avg_final_score ?? 0}
        confidence={idea.avg_confidence ?? 0}
        previousScore={latestIteration?.previousScore}
        weakCriteria={weakCriteria}
        recommendation={evaluationRecommendation}
        recommendationReasoning={synthesis?.recommendation_reasoning || 'Consider your options based on the evaluation results.'}
        onDecision={handleEvaluationDecision}
        onClose={() => setShowEvaluationAdvisory(false)}
      />
    </div>
  )
}
