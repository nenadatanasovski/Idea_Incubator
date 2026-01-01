// =============================================================================
// FILE: frontend/src/pages/IdeationPageWrapper.tsx
// Wrapper page for the Ideation Agent that handles routing and profile selection
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Sparkles, AlertCircle, User, Home } from 'lucide-react';
import { IdeationEntryModal } from '../components/ideation/IdeationEntryModal';
import { IdeationSession } from '../components/ideation/IdeationSession';
import type { EntryMode } from '../types/ideation';

interface UserProfile {
  id: string;
  name: string;
  slug: string;
}

export default function IdeationPageWrapper() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotFound, setSessionNotFound] = useState(false);

  // Load profiles and validate URL session on mount
  useEffect(() => {
    async function init() {
      try {
        // Load profiles first
        const response = await fetch('/api/profiles');
        if (!response.ok) throw new Error('Failed to load profiles');
        const result = await response.json();
        const profileList = result.data || [];
        setProfiles(profileList);

        // Auto-select if only one profile
        if (profileList.length === 1) {
          setSelectedProfileId(profileList[0].id);
        }

        // If URL contains a session ID, validate it
        if (urlSessionId) {
          const sessionResponse = await fetch(`/api/ideation/session/${urlSessionId}`);
          if (!sessionResponse.ok) {
            setSessionNotFound(true);
          } else {
            const sessionData = await sessionResponse.json();
            // Valid session - auto-resume
            if (sessionData.session?.profileId) {
              setSelectedProfileId(sessionData.session.profileId);
            }
            setResumeSessionId(urlSessionId);
            setSessionStarted(true);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [urlSessionId]);

  const handleStartIdeation = useCallback(() => {
    if (!selectedProfileId) {
      setError('Please select a profile first');
      return;
    }
    setShowEntryModal(true);
  }, [selectedProfileId]);

  const handleEntrySelect = useCallback((mode: EntryMode) => {
    setEntryMode(mode);
    setShowEntryModal(false);
    setSessionStarted(true);
    setResumeSessionId(null);
  }, []);

  const handleResumeSession = useCallback((sessionId: string) => {
    setResumeSessionId(sessionId);
    setShowEntryModal(false);
    setSessionStarted(true);
    setEntryMode(null);
  }, []);

  const handleComplete = useCallback((ideaId: string) => {
    // Navigate to the new idea
    navigate(`/ideas/${ideaId}`);
  }, [navigate]);

  const handleExit = useCallback(() => {
    setSessionStarted(false);
    setEntryMode(null);
    setResumeSessionId(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If session ID in URL was not found, show error
  if (sessionNotFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md p-8" data-testid="error-display">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Not Found</h1>
          <p className="text-gray-600 mb-6" data-testid="error-message">
            The ideation session "{urlSessionId}" doesn't exist or has been deleted.
          </p>
          <Link
            to="/ideate"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="error-recovery"
          >
            <Home className="w-4 h-4" />
            Start New Session
          </Link>
        </div>
      </div>
    );
  }

  // If session is started, show full-screen ideation
  if (sessionStarted && selectedProfileId && (entryMode || resumeSessionId)) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50">
        <IdeationSession
          sessionId={resumeSessionId || ''}
          profileId={selectedProfileId}
          entryMode={entryMode}
          isResuming={!!resumeSessionId}
          onComplete={handleComplete}
          onExit={handleExit}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Ideation Agent
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Have a conversation to discover and refine your next business idea.
          The agent will help you explore opportunities and validate concepts.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Profile Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Select Your Profile
        </h2>

        {profiles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">
              No profiles found. Create a profile to get personalized idea recommendations.
            </p>
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Profile
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  selectedProfileId === profile.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <p className="font-medium text-gray-900">{profile.name}</p>
                <p className="text-sm text-gray-500">@{profile.slug}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Start Button */}
      {profiles.length > 0 && (
        <button
          onClick={handleStartIdeation}
          disabled={!selectedProfileId}
          data-testid="start-ideation-btn"
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold
                     rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all
                     disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed
                     focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none
                     flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Start Ideation Session
        </button>
      )}

      {/* Features Preview */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <FeatureCard
          title="Discover Ideas"
          description="Explore your interests and find business opportunities through conversation"
        />
        <FeatureCard
          title="Validate Concepts"
          description="Get real-time market validation with web search integration"
        />
        <FeatureCard
          title="Track Viability"
          description="See confidence and viability scores as your idea takes shape"
        />
        <FeatureCard
          title="Capture Ready"
          description="When ready, capture directly to your idea pipeline"
        />
      </div>

      {/* Entry Modal */}
      <IdeationEntryModal
        isOpen={showEntryModal}
        profileId={selectedProfileId || ''}
        onSelect={handleEntrySelect}
        onResumeSession={handleResumeSession}
        onClose={() => setShowEntryModal(false)}
      />
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}
