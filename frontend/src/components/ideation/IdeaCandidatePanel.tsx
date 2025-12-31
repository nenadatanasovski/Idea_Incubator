// =============================================================================
// FILE: frontend/src/components/ideation/IdeaCandidatePanel.tsx
// Panel showing the current idea candidate
// =============================================================================

import 'react';
import { Lightbulb, CheckCircle, Save, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ViabilityMeter } from './ViabilityMeter';
import { RisksList } from './RisksList';
import type { IdeaCandidatePanelProps } from '../../types/ideation';

export function IdeaCandidatePanel({
  candidate,
  confidence,
  viability,
  risks,
  onCapture,
  onSave,
  onDiscard,
  onContinue,
  showIntervention,
}: IdeaCandidatePanelProps) {
  return (
    <div className="idea-candidate-panel w-80 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Idea Candidate
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!candidate ? (
          <EmptyState confidence={confidence} />
        ) : showIntervention && viability < 50 ? (
          <InterventionState
            candidate={candidate}
            viability={viability}
            risks={risks}
            onContinue={onContinue}
            onDiscard={onDiscard}
          />
        ) : (
          <ActiveState
            candidate={candidate}
            confidence={confidence}
            viability={viability}
            risks={risks}
          />
        )}
      </div>

      {/* Action Buttons */}
      {candidate && !showIntervention && (
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={onCapture}
            disabled={confidence < 50}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                       bg-green-600 text-white rounded-lg hover:bg-green-700
                       disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Capture Idea
          </button>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2
                         border border-gray-300 rounded-lg hover:bg-gray-50
                         text-gray-700 text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              Save for Later
            </button>
            <button
              onClick={onDiscard}
              className="flex items-center justify-center gap-2 px-3 py-2
                         border border-red-200 rounded-lg hover:bg-red-50
                         text-red-600 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ confidence }: { confidence: number }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lightbulb className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-gray-500 font-medium">No idea yet</p>
      <p className="text-sm text-gray-400 mt-1">
        {confidence > 0
          ? 'Keep exploring to develop your idea'
          : 'Start the conversation to explore ideas'}
      </p>
      {confidence > 0 && confidence < 30 && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Idea Forming</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveState({
  candidate,
  confidence,
  viability,
  risks,
}: {
  candidate: NonNullable<IdeaCandidatePanelProps['candidate']>;
  confidence: number;
  viability: number;
  risks: IdeaCandidatePanelProps['risks'];
}) {
  return (
    <div className="space-y-4">
      {/* Title & Summary */}
      <div>
        <h3 className="font-semibold text-gray-900">{candidate.title}</h3>
        {candidate.summary && (
          <p className="text-sm text-gray-600 mt-1">{candidate.summary}</p>
        )}
      </div>

      {/* Meters */}
      <div className="space-y-3">
        <ConfidenceMeter value={confidence} showLabel size="md" />
        <ViabilityMeter value={viability} risks={risks} showWarning={viability < 50} size="md" />
      </div>

      {/* Risks */}
      {risks.length > 0 && (
        <RisksList risks={risks} maxDisplay={3} />
      )}
    </div>
  );
}

function InterventionState({
  candidate,
  viability,
  risks,
  onContinue,
  onDiscard,
}: {
  candidate: NonNullable<IdeaCandidatePanelProps['candidate']>;
  viability: number;
  risks: IdeaCandidatePanelProps['risks'];
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-800">Viability Concerns</p>
            <p className="text-sm text-orange-700 mt-1">
              This idea has significant risks that may affect its success.
            </p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-semibold text-gray-900">{candidate.title}</h3>
      </div>

      {/* Viability Meter */}
      <ViabilityMeter value={viability} risks={risks} showWarning size="lg" />

      {/* Risks */}
      <RisksList risks={risks} maxDisplay={5} />

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 px-4 py-2
                     bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          Continue Anyway
        </button>
        <button
          onClick={onDiscard}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg
                     hover:bg-gray-50 text-gray-700 transition-colors"
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}

export default IdeaCandidatePanel;
