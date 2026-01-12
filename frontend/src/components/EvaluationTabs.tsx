import { useState } from 'react'
import clsx from 'clsx'
import EvaluationScorecard from './EvaluationScorecard'
import EvaluationDashboard from './EvaluationDashboard'
import RedTeamView from './RedTeamView'
import SynthesisView, { type EvaluationDecision } from './SynthesisView'
import type { Synthesis, UserProfileSummary, RiskResponse, RiskResponseStats } from '../types'

type TabId = 'scorecard' | 'dashboard' | 'redteam' | 'synthesis'

const tabs: { id: TabId; label: string }[] = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'dashboard', label: 'Charts' },
  { id: 'redteam', label: 'Red Team' },
  { id: 'synthesis', label: 'Synthesis' },
]

interface WeakCriterion {
  criterion: string
  category: string
  previousScore?: number
  finalScore: number
  reasoning: string
  debateChallenges?: string[]
}

interface EvaluationTabsProps {
  slug: string
  runId?: string
  synthesis: Synthesis | null
  profile?: UserProfileSummary | null
  riskResponses?: RiskResponse[]
  riskResponseStats?: RiskResponseStats | null
  defaultTab?: TabId
  onClose?: () => void
  weakCriteria?: WeakCriterion[]
  previousScore?: number
  recommendation?: EvaluationDecision
  onDecision?: (decision: EvaluationDecision, reason?: string) => void
}

export default function EvaluationTabs({
  slug,
  runId,
  synthesis,
  profile,
  riskResponses,
  riskResponseStats,
  defaultTab = 'scorecard',
  onClose,
  weakCriteria,
  previousScore,
  recommendation,
  onDecision
}: EvaluationTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)

  return (
    <div className="card p-0 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-primary-600 border-b-2 border-primary-600 bg-white -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            )}
          >
            {tab.label}
          </button>
        ))}
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            Close
          </button>
        )}
      </div>

      {/* Tab Content with dynamic height scrolling */}
      {/* All tabs stay mounted to preserve data - CSS controls visibility */}
      <div className="p-6 overflow-y-auto flex-1 min-h-0">
        <div className={activeTab === 'scorecard' ? '' : 'hidden'}>
          <EvaluationScorecard slug={slug} runId={runId} profile={profile} />
        </div>
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
          <EvaluationDashboard slug={slug} runId={runId} />
        </div>
        <div className={activeTab === 'redteam' ? '' : 'hidden'}>
          <RedTeamView
            slug={slug}
            runId={runId}
            riskResponses={riskResponses}
            riskResponseStats={riskResponseStats}
          />
        </div>
        <div className={activeTab === 'synthesis' ? '' : 'hidden'}>
          <SynthesisView
            synthesis={synthesis}
            weakCriteria={weakCriteria}
            previousScore={previousScore}
            recommendation={recommendation}
            onDecision={onDecision}
          />
        </div>
      </div>
    </div>
  )
}
