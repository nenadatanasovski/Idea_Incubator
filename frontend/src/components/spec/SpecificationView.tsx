/**
 * SpecificationView.tsx
 * Main component for the specification phase content area
 */

import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2, FileText, List, Wrench, Play } from 'lucide-react';
import clsx from 'clsx';
import { useSpecSession } from '../../hooks/useSpecSession';
import { QuestionsList } from './QuestionsList';
import { SpecOverview } from './SpecOverview';
import { FeatureList } from './FeatureList';

interface SpecificationViewProps {
  ideaId: string;
}

type SpecTab = 'overview' | 'features' | 'technical';

export function SpecificationView({ ideaId }: SpecificationViewProps) {
  const {
    session,
    isLoading,
    error,
    startSession,
    answerQuestion,
    finalizeSpec,
    hasQuestions,
    canFinalize,
  } = useSpecSession({ ideaId });

  const [activeTab, setActiveTab] = useState<SpecTab>('overview');
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading specification...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">Error loading specification</h3>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No session state - offer to start one
  if (!session) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="font-medium text-gray-900 mb-2">No Specification Yet</h3>
          <p className="text-gray-600 text-sm mb-4">
            Start a specification session to define the detailed requirements for this idea.
          </p>
          <button
            onClick={startSession}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Specification
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const { draft: currentDraft, questions: pendingQuestions, status } = session;

  // Handle finalize
  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await finalizeSpec();
    } finally {
      setIsFinalizing(false);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: FileText },
    { id: 'features' as const, label: 'Features', icon: List },
    { id: 'technical' as const, label: 'Technical', icon: Wrench },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Status Header */}
      <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {hasQuestions && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {pendingQuestions.length} question{pendingQuestions.length !== 1 ? 's' : ''} need answers
            </span>
          )}
          {status === 'complete' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Specification complete • {session.tasks.length} tasks generated
            </span>
          )}
        </div>

        {canFinalize && (
          <button
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isFinalizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Finalize & Generate Tasks
              </>
            )}
          </button>
        )}
      </div>

      {/* Questions Panel (if any) */}
      {hasQuestions && (
        <div className="p-4 bg-amber-50 border-b shrink-0">
          <h3 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Please clarify the following:
          </h3>
          <QuestionsList
            questions={pendingQuestions}
            onAnswer={answerQuestion}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Spec Content */}
      {currentDraft && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b px-4 bg-white shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition',
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4 bg-gray-50">
            {activeTab === 'overview' && <SpecOverview spec={currentDraft} />}
            {activeTab === 'features' && <FeatureList features={currentDraft.features} />}
            {activeTab === 'technical' && <TechnicalSpec spec={currentDraft} />}
          </div>
        </div>
      )}

      {/* No draft yet */}
      {!currentDraft && status === 'active' && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-500" />
            <p>Generating initial specification draft...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
    pending_input: { label: 'Needs Input', color: 'text-amber-700', bg: 'bg-amber-100' },
    complete: { label: 'Complete', color: 'text-green-700', bg: 'bg-green-100' },
    failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
  };

  const statusConfig = config[status] || config.active;

  return (
    <span
      className={clsx(
        'px-2.5 py-1 rounded-full text-xs font-medium',
        statusConfig.bg,
        statusConfig.color
      )}
    >
      {statusConfig.label}
    </span>
  );
}

function TechnicalSpec({ spec }: { spec: any }) {
  // Placeholder for technical specification view
  // This could include data models, API endpoints, UI components, etc.
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-medium text-gray-900 mb-3">Technical Specification</h3>
        <p className="text-sm text-gray-500 mb-4">
          Detailed technical requirements including data models, API endpoints, and component specifications.
        </p>
        
        {/* Data model section (if available) */}
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 mb-2">System Architecture</h4>
            <p className="text-sm text-gray-600">
              Technical details will be populated as the specification is refined.
            </p>
          </div>
          
          {/* Version info */}
          <div className="text-xs text-gray-400 mt-4">
            Specification version: {spec.version}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpecificationView;
