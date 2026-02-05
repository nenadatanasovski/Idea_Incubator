// =============================================================================
// UnifiedIdeaPage.tsx
// New unified idea development page with persistent chat
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { UnifiedLayout, IdeaPhase } from "../components/UnifiedLayout";
import { ChatPanel, ChatMessage } from "../components/ChatPanel";
import { ContentArea } from "../components/ContentArea";
import { Loader2, Network, FileText } from "lucide-react";

// API response types
interface PipelineState {
  ideaId: string;
  currentPhase: IdeaPhase;
  autoAdvance: boolean;
  ideationProgress: {
    completionScore: number;
    confidenceScore: number;
    milestones: Record<string, boolean>;
  };
  specProgress?: {
    sectionsComplete: number;
    sectionsTotal: number;
    generatedTasks: number;
  };
  buildProgress?: {
    tasksComplete: number;
    tasksTotal: number;
    currentTask: string | null;
  };
}

interface IdeationSession {
  id: string;
  ideaId: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }>;
}

export function UnifiedIdeaPage() {
  const { ideaId } = useParams<{ ideaId: string }>();

  // State
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [session, setSession] = useState<IdeationSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentActivity, setAgentActivity] = useState<string | undefined>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_error, setError] = useState<string | null>(null);

  // Load pipeline state
  useEffect(() => {
    if (!ideaId) return;

    const loadState = async () => {
      try {
        const response = await fetch(`/api/idea-pipeline/${ideaId}/status`);
        if (response.ok) {
          const data = await response.json();
          setPipelineState(data.state);
        }
      } catch (err) {
        console.error("Failed to load pipeline state:", err);
      }
    };

    loadState();
    // Poll for updates
    const interval = setInterval(loadState, 10000);
    return () => clearInterval(interval);
  }, [ideaId]);

  // Load or create ideation session
  useEffect(() => {
    if (!ideaId) return;

    const loadSession = async () => {
      setIsLoading(true);
      try {
        // Try to get existing session
        const sessionsRes = await fetch(`/api/ideation/sessions?ideaId=${ideaId}`);
        if (sessionsRes.ok) {
          const sessions = await sessionsRes.json();
          if (sessions.length > 0) {
            const latestSession = sessions[0];
            setSession(latestSession);
            
            // Load messages
            const messagesRes = await fetch(`/api/ideation/sessions/${latestSession.id}/messages`);
            if (messagesRes.ok) {
              const msgs = await messagesRes.json();
              setMessages(msgs.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at),
              })));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        setError("Failed to load session");
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [ideaId]);

  // Send message to ideation agent
  const handleSendMessage = useCallback(async (content: string) => {
    if (!session?.id) {
      setError("No active session");
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setAgentActivity("Processing your message...");

    try {
      const response = await fetch(`/api/ideation/sessions/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: data.messageId || `assistant-${Date.now()}`,
          role: "assistant",
          content: data.content || data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setError("Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message");
    } finally {
      setIsStreaming(false);
      setAgentActivity(undefined);
    }
  }, [session]);

  // Start new session
  const handleStartSession = useCallback(async () => {
    if (!ideaId) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/ideation/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId }),
      });

      if (response.ok) {
        const newSession = await response.json();
        setSession(newSession);
        setMessages([{
          id: "welcome",
          role: "system",
          content: "Session started. Share your idea!",
        }]);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Failed to start session");
    } finally {
      setIsLoading(false);
    }
  }, [ideaId]);

  // Render loading state
  if (isLoading && !session) {
    return (
      <UnifiedLayout ideaId={ideaId} showChat={false}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading idea...</p>
          </div>
        </div>
      </UnifiedLayout>
    );
  }

  // Render no session state
  if (!session && !isLoading) {
    return (
      <UnifiedLayout ideaId={ideaId} currentPhase={pipelineState?.currentPhase} showChat={false}>
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Session</h2>
            <p className="text-gray-600 mb-4">
              Start a new ideation session to develop this idea.
            </p>
            <button
              onClick={handleStartSession}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
            >
              Start Session
            </button>
          </div>
        </div>
      </UnifiedLayout>
    );
  }

  // Get placeholder based on phase
  const getChatPlaceholder = () => {
    switch (pipelineState?.currentPhase) {
      case "ideation":
        return "Share your thoughts...";
      case "specification":
        return "Ask about requirements...";
      case "building":
        return "Give feedback on progress...";
      default:
        return "Type a message...";
    }
  };

  // Render chat panel
  const chatPanel = (
    <ChatPanel
      title="Ideation Chat"
      messages={messages}
      onSendMessage={handleSendMessage}
      isLoading={isLoading}
      isStreaming={isStreaming}
      placeholder={getChatPlaceholder()}
      agentActivity={agentActivity}
    />
  );

  // Render content area - placeholder implementations
  // TODO: Wire these to actual graph/artifact loading hooks
  const renderGraph = () => (
    <div className="h-full p-4 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Network className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Memory Graph</p>
        <p className="text-sm text-gray-400 mt-1">
          Knowledge extracted from conversations will appear here
        </p>
        <p className="text-xs text-gray-300 mt-4">
          Idea: {ideaId}
        </p>
      </div>
    </div>
  );

  const renderArtifacts = () => (
    <div className="h-full p-4 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Artifacts</p>
        <p className="text-sm text-gray-400 mt-1">
          Generated specs, briefs, and documents will appear here
        </p>
        {session && (
          <p className="text-xs text-gray-300 mt-4">
            Session: {session.id}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <UnifiedLayout
      ideaId={ideaId}
      currentPhase={pipelineState?.currentPhase}
      chatPanel={chatPanel}
      showChat={true}
    >
      <ContentArea
        ideaId={ideaId || ""}
        phase={pipelineState?.currentPhase || "ideation"}
        renderGraph={renderGraph}
        renderArtifacts={renderArtifacts}
      />
    </UnifiedLayout>
  );
}

export default UnifiedIdeaPage;
