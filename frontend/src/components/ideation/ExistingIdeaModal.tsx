// =============================================================================
// FILE: frontend/src/components/ideation/ExistingIdeaModal.tsx
// Modal for handling existing sessions
// =============================================================================

import { useState, useEffect } from "react";
import { Clock, ArrowRight, Plus, X } from "lucide-react";

interface ExistingSession {
  id: string;
  candidateTitle?: string;
  lastMessageAt: string;
  messageCount: number;
  confidence?: number;
  viability?: number;
}

interface ExistingIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSession: ExistingSession;
  onContinue: (sessionId: string) => void;
  onStartFresh: () => void;
}

export function ExistingIdeaModal({
  isOpen,
  onClose,
  existingSession,
  onContinue,
  onStartFresh,
}: ExistingIdeaModalProps) {
  if (!isOpen) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold mb-1">
          You Have an Active Session
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          One idea at a time keeps focus sharp
        </p>

        {/* Existing Session Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start mb-3">
            <p className="font-medium text-gray-700">
              {existingSession.candidateTitle || "Exploring ideas..."}
            </p>
            <div className="flex items-center gap-1 text-gray-500 text-xs">
              <Clock className="w-3 h-3" />
              <span>{formatTime(existingSession.lastMessageAt)}</span>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
              {existingSession.messageCount} messages
            </span>
            {existingSession.confidence !== undefined && (
              <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded">
                {existingSession.confidence}% confident
              </span>
            )}
            {existingSession.viability !== undefined && (
              <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded">
                {existingSession.viability}% viable
              </span>
            )}
          </div>

          <button
            onClick={() => onContinue(existingSession.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2
                       bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue This Session
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-600 text-center mb-3">
            Or if you want to explore something completely different:
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onStartFresh}
              className="flex items-center justify-center gap-2 px-4 py-2
                         border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check for existing sessions.
 */
export function useExistingSessionCheck(profileId: string) {
  const [existingSession, setExistingSession] =
    useState<ExistingSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkForExisting() {
      try {
        const response = await fetch(
          `/api/ideation/sessions?profileId=${profileId}&status=active`,
        );
        const data = await response.json();

        if (data.sessions && data.sessions.length > 0) {
          setExistingSession(data.sessions[0]);
        }
      } catch (error) {
        console.error("Failed to check for existing sessions:", error);
      } finally {
        setIsChecking(false);
      }
    }

    if (profileId) {
      checkForExisting();
    } else {
      setIsChecking(false);
    }
  }, [profileId]);

  return { existingSession, isChecking };
}

export default ExistingIdeaModal;
