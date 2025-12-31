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

  const handleEntrySelect = useCallback((mode: EntryMode) => {
    setEntryMode(mode);
    setShowEntryModal(false);
  }, []);

  // Session ID is set when session is created in IdeationSession component

  const handleComplete = useCallback((ideaId: string) => {
    onComplete(ideaId);
  }, [onComplete]);

  const handleExit = useCallback(() => {
    setSessionId(null);
    setEntryMode(null);
    onExit();
  }, [onExit]);

  if (showEntryModal) {
    return (
      <IdeationEntryModal
        isOpen={true}
        onSelect={handleEntrySelect}
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
        onComplete={handleComplete}
        onExit={handleExit}
      />
    </div>
  );
}

export default IdeationPage;
