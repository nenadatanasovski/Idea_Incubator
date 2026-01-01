// =============================================================================
// FILE: frontend/src/pages/IdeationPage.tsx
// Entry point for the Ideation Agent experience
// =============================================================================

import { useState, useCallback } from 'react';
import { IdeationEntryModal } from '../components/ideation/IdeationEntryModal';
import { IdeationSession } from '../components/ideation/IdeationSession';
import type { IdeationPageProps, EntryMode } from '../types/ideation';

export function IdeationPage({ profileId, onComplete, onExit }: IdeationPageProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(true);
  const [isResuming, setIsResuming] = useState(false);

  const handleEntrySelect = useCallback((mode: EntryMode) => {
    setEntryMode(mode);
    setShowEntryModal(false);
    setIsResuming(false);
  }, []);

  const handleResumeSession = useCallback((resumeSessionId: string) => {
    setSessionId(resumeSessionId);
    setEntryMode(null); // Will be loaded from session
    setShowEntryModal(false);
    setIsResuming(true);
  }, []);

  const handleComplete = useCallback((ideaId: string) => {
    onComplete(ideaId);
  }, [onComplete]);

  const handleExit = useCallback(() => {
    setSessionId(null);
    setEntryMode(null);
    setIsResuming(false);
    onExit();
  }, [onExit]);

  if (showEntryModal) {
    return (
      <IdeationEntryModal
        isOpen={true}
        profileId={profileId}
        onSelect={handleEntrySelect}
        onResumeSession={handleResumeSession}
        onClose={onExit}
      />
    );
  }

  return (
    <div className="ideation-page h-screen bg-gray-50">
      <IdeationSession
        sessionId={sessionId || ''}
        profileId={profileId}
        entryMode={entryMode}
        isResuming={isResuming}
        onComplete={handleComplete}
        onExit={handleExit}
      />
    </div>
  );
}

export default IdeationPage;
