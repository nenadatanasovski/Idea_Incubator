// =============================================================================
// FILE: frontend/src/components/ideation/IdeationEntryModal.tsx
// Entry modal for choosing how to start ideation
// =============================================================================

import { useState } from "react";
import { Lightbulb, Compass, X, History, ChevronLeft } from "lucide-react";
import type { EntryMode } from "../../types/ideation";
import { SessionList } from "./SessionList";

interface IdeationEntryModalProps {
  isOpen: boolean;
  profileId: string;
  onSelect: (mode: EntryMode) => void;
  onResumeSession: (sessionId: string) => void;
  onClose: () => void;
}

export function IdeationEntryModal({
  isOpen,
  profileId,
  onSelect,
  onResumeSession,
  onClose,
}: IdeationEntryModalProps) {
  const [showSessions, setShowSessions] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-xl p-8 w-full mx-4 shadow-2xl relative transition-all duration-300 ${
          showSessions ? "max-w-5xl" : "max-w-lg"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {showSessions ? (
          <>
            <button
              onClick={() => setShowSessions(false)}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <h2 className="text-2xl font-bold text-center mb-2">
              Previous Sessions
            </h2>
            <p className="text-gray-600 text-center mb-4">
              Continue where you left off
            </p>
            <SessionList
              profileId={profileId}
              onSelectSession={(sessionId) => {
                onResumeSession(sessionId);
              }}
              onClose={() => setShowSessions(false)}
            />
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-2">
              Start Your Ideation Journey
            </h2>
            <p className="text-gray-600 text-center mb-8">
              How would you like to begin?
            </p>

            <div className="space-y-4">
              <EntryOption
                icon={<Lightbulb className="w-8 h-8" />}
                title="I have an idea"
                description="Explore and validate an idea you already have in mind"
                mode="have_idea"
                onSelect={onSelect}
              />
              <EntryOption
                icon={<Compass className="w-8 h-8" />}
                title="Help me discover"
                description="Let's explore your interests and find opportunities together"
                mode="discover"
                onSelect={onSelect}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowSessions(true)}
                className="w-full p-3 text-gray-600 hover:text-blue-600 hover:bg-gray-50
                           rounded-lg transition-all flex items-center justify-center gap-2
                           focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <History className="w-5 h-5" />
                Resume a previous session
              </button>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full text-gray-500 hover:text-gray-700 text-sm py-2 rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EntryOption({
  icon,
  title,
  description,
  mode,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  mode: EntryMode;
  onSelect: (mode: EntryMode) => void;
}) {
  return (
    <button
      onClick={() => onSelect(mode)}
      data-testid={`entry-mode-${mode}`}
      className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500
                 hover:bg-blue-50 transition-all flex items-start gap-4 text-left
                 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="text-blue-600 mt-1">{icon}</div>
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
    </button>
  );
}

export default IdeationEntryModal;
