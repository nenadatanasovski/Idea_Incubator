// =============================================================================
// FILE: frontend/src/components/ideation/IdeaCandidatePanel.tsx
// Panel showing the current idea candidate
// =============================================================================

import "react";
import { Lightbulb, Trash2 } from "lucide-react";
import { RisksList } from "./RisksList";
import type { IdeaCandidatePanelProps } from "../../types/ideation";

export function IdeaCandidatePanel({
  candidate,
  risks,
  onDiscard,
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
          <EmptyState />
        ) : (
          <ActiveState candidate={candidate} risks={risks} />
        )}
      </div>

      {/* Action Buttons */}
      {candidate && (
        <div className="p-4 border-t border-gray-200">
          <button
            data-testid="discard-idea-btn"
            onClick={onDiscard}
            className="w-full flex items-center justify-center gap-2 px-3 py-2
                       border border-red-200 rounded-lg hover:bg-red-50
                       text-red-600 text-sm transition-colors
                       focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Trash2 className="w-4 h-4" />
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lightbulb className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-gray-500 font-medium">No idea yet</p>
      <p className="text-sm text-gray-400 mt-1">
        Start the conversation to explore ideas
      </p>
    </div>
  );
}

function ActiveState({
  candidate,
  risks,
}: {
  candidate: NonNullable<IdeaCandidatePanelProps["candidate"]>;
  risks: IdeaCandidatePanelProps["risks"];
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

      {/* Risks */}
      {risks.length > 0 && <RisksList risks={risks} maxDisplay={3} />}
    </div>
  );
}

export default IdeaCandidatePanel;
