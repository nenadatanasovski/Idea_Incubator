// =============================================================================
// FILE: frontend/src/components/ideation/IdeationSession.tsx
// Main container for an ideation session
// =============================================================================

import {
  useEffect,
  useReducer,
  useCallback,
  useRef,
  useState,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { SessionHeader, type SessionTab } from "./SessionHeader";
import { ConversationPanel } from "./ConversationPanel";
import { IdeaArtifactPanel } from "./IdeaArtifactPanel";
import { GraphTabPanel } from "./GraphTabPanel";
import { ProjectFilesPanel } from "./ProjectFilesPanel";
import { SpecViewPanel } from "./SpecViewPanel";

// Error boundary to wrap GraphTabPanel and prevent crashes from breaking the whole page
interface GraphErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GraphPanelErrorBoundary extends Component<
  { children: ReactNode },
  GraphErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GraphErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GraphPanelErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] bg-amber-50 rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-amber-800 mb-2">
              Graph Panel Issue
            </h3>
            <p className="text-sm text-amber-600 mb-4 max-w-md">
              The graph visualization encountered an error. The rest of the
              session is still working.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  MemoryDatabasePanel,
  type MemoryTableName,
} from "./MemoryDatabasePanel";
import { IdeaTypeModal, type IdeaTypeValue } from "./IdeaTypeModal";
import { UpdateMemoryGraphModal } from "./UpdateMemoryGraphModal";
import { useIdeationAPI } from "../../hooks/useIdeationAPI";
import { useSpec } from "../../hooks/useSpec";
import { useReadiness } from "../../hooks/useReadiness";
import { ideationReducer, initialState } from "../../reducers/ideationReducer";
import type { IdeationSessionProps, Artifact } from "../../types/ideation";
import type { SpecWorkflowState } from "../../types/spec";

// Generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function IdeationSession({
  sessionId: initialSessionId,
  profileId,
  entryMode,
  isResuming = false,
  onComplete: _onComplete,
  onExit,
}: IdeationSessionProps) {
  const [state, dispatch] = useReducer(ideationReducer, initialState);
  const api = useIdeationAPI();
  const initRef = useRef(false);
  const buttonClickInProgressRef = useRef(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [showIdeaTypeModal, setShowIdeaTypeModal] = useState(false);
  const [isSpecEditing, setIsSpecEditing] = useState(false);
  const [isSpecGenerating, setIsSpecGenerating] = useState(false);
  const [hasSpec, setHasSpec] = useState(false);
  // Tab navigation state (T6.1) - persist across page refreshes
  const [activeTab, setActiveTab] = useState<SessionTab>(() => {
    // Try to restore from sessionStorage using the session ID
    if (initialSessionId) {
      const stored = sessionStorage.getItem(`ideation-tab-${initialSessionId}`);
      if (
        stored &&
        ["chat", "graph", "memory", "files", "spec"].includes(stored)
      ) {
        return stored as SessionTab;
      }
    }
    return "chat";
  });
  const [graphUpdateCount, setGraphUpdateCount] = useState(0);
  const [hasGraphUpdates, setHasGraphUpdates] = useState(false);
  // Trigger to refetch graph data (e.g., after deletion)
  const [graphRefetchTrigger, setGraphRefetchTrigger] = useState(0);
  // Success notification for graph actions
  const [graphSuccessNotification, setGraphSuccessNotification] = useState<{
    action: "created" | "updated" | "deleted";
    nodeLabel: string;
  } | null>(null);
  // T9: Project folder state
  const [filesCount, setFilesCount] = useState(0);
  // Memory DB navigation state
  const [memoryHighlightTable, setMemoryHighlightTable] = useState<
    MemoryTableName | undefined
  >();
  const [memoryHighlightId, setMemoryHighlightId] = useState<
    string | undefined
  >();
  // Chat message navigation state (for scrolling to specific messages)
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | undefined
  >();
  // Insight navigation state (for highlighting specific insights in the Insights tab)
  const [highlightInsightSourceId, setHighlightInsightSourceId] = useState<
    string | null
  >(null);
  // Force artifact panel tab switch (for navigation from Source Lineage)
  const [forceArtifactPanelTab, setForceArtifactPanelTab] = useState<
    "idea" | "artifacts" | "spec" | "insights" | null
  >(null);

  // Persist active tab to sessionStorage when it changes
  useEffect(() => {
    const sessionId = state.session.sessionId || initialSessionId;
    if (sessionId) {
      sessionStorage.setItem(`ideation-tab-${sessionId}`, activeTab);
    }
  }, [activeTab, state.session.sessionId, initialSessionId]);

  // Auto-hide artifact panel when graph tab is active on initial load/resume
  useEffect(() => {
    if (activeTab === "graph" && state.session.status === "active") {
      dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: false } });
    }
  }, [state.session.status]);

  // Spec and readiness hooks (SPEC-006-E integration)
  const {
    spec,
    sections: specSections,
    isLoading: isSpecLoading,
    fetchSpec,
    submitForReview,
    approve: approveSpec,
    requestChanges,
    archive: archiveSpec,
  } = useSpec({
    sessionId: state.session.sessionId || "",
    // Only enable when spec generation is triggered or a spec already exists
    // Don't auto-fetch on resume to avoid 404 noise in console
    enabled: isSpecGenerating || hasSpec,
    onWorkflowChange: (fromState, toState) => {
      setToast({
        message: `Spec moved from ${fromState} to ${toState}`,
        type: "success",
      });
      setTimeout(() => setToast(null), 3000);
    },
  });

  useEffect(() => {
    if (spec) {
      setHasSpec(true);
    }
  }, [spec]);

  const { readiness: _readiness, isReady: isReadyForSpec } = useReadiness({
    sessionId: state.session.sessionId || "",
    autoFetch: true,
    // Only enable once we have a valid session ID
    enabled: Boolean(state.session.sessionId),
  });

  // Initialize or resume session (with guard against React 18 Strict Mode double-invoke)
  useEffect(() => {
    if (initRef.current) return;

    initRef.current = true;

    async function initSession() {
      dispatch({ type: "SESSION_START", payload: { profileId, entryMode } });

      try {
        const result = await api.startSession(profileId, entryMode);
        dispatch({
          type: "SESSION_CREATED",
          payload: { sessionId: result.sessionId, greeting: result.greeting },
        });

        // Add greeting message
        dispatch({
          type: "MESSAGE_RECEIVED",
          payload: {
            message: {
              id: generateMessageId(),
              sessionId: result.sessionId,
              role: "assistant",
              content: result.greeting,
              buttons: result.buttons || null,
              form: null,
              createdAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        dispatch({
          type: "SESSION_ERROR",
          payload: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to start session",
          },
        });
      }
    }

    async function resumeSession() {
      dispatch({
        type: "SESSION_START",
        payload: { profileId, entryMode: null },
      });

      try {
        const sessionData = await api.loadSession(initialSessionId);

        dispatch({
          type: "SESSION_CREATED",
          payload: { sessionId: initialSessionId, greeting: "" },
        });

        // Restore session title if present
        if (sessionData.session?.title) {
          dispatch({
            type: "SESSION_TITLE_UPDATE",
            payload: { title: sessionData.session.title },
          });
        }

        // Add all existing messages
        for (const msg of sessionData.messages) {
          dispatch({
            type: "MESSAGE_RECEIVED",
            payload: {
              message: {
                id: msg.id || generateMessageId(),
                sessionId: initialSessionId,
                role: msg.role,
                content: msg.content,
                buttons:
                  (msg.buttonsShown as import("../../types").ButtonOption[]) ||
                  null,
                form:
                  (msg.formShown as import("../../types").FormDefinition) ||
                  null,
                createdAt: msg.createdAt,
              },
            },
          });
        }

        // Update candidate if present
        if (sessionData.candidate) {
          dispatch({
            type: "CANDIDATE_UPDATE",
            payload: {
              candidate: {
                id: sessionData.candidate.id,
                sessionId: initialSessionId,
                title: sessionData.candidate.title,
                summary: sessionData.candidate.summary,
                // Use defaults - confidence/viability deprecated
                confidence: 0,
                viability: 100,
                userSuggested: false,
                status: "forming" as const,
                capturedIdeaId: null,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          });
        }

        // Restore artifacts if present
        console.log(
          "[Session Resume] Artifacts from API:",
          sessionData.artifacts,
        );
        if (sessionData.artifacts && sessionData.artifacts.length > 0) {
          console.log(
            "[Session Resume] Restoring",
            sessionData.artifacts.length,
            "artifacts",
          );
          for (const artifact of sessionData.artifacts) {
            console.log(
              "[Session Resume] Adding artifact:",
              artifact.id,
              artifact.type,
              artifact.title,
            );
            dispatch({
              type: "ARTIFACT_ADD",
              payload: { artifact },
            });
          }
          // Open artifact panel and select the first artifact
          dispatch({
            type: "ARTIFACT_PANEL_TOGGLE",
            payload: { isOpen: true },
          });
          dispatch({
            type: "ARTIFACT_SELECT",
            payload: { artifact: sessionData.artifacts[0] }, // Fixed: pass artifact object, not artifactId
          });
        } else {
          console.log("[Session Resume] No artifacts to restore");
        }

        // Restore sub-agents if present
        console.log(
          "[Session Resume] SubAgents from API:",
          sessionData.subAgents,
        );
        if (sessionData.subAgents && sessionData.subAgents.length > 0) {
          console.log(
            "[Session Resume] Restoring",
            sessionData.subAgents.length,
            "sub-agents",
          );
          for (const subAgent of sessionData.subAgents) {
            console.log(
              "[Session Resume] Adding sub-agent:",
              subAgent.id,
              subAgent.type,
              subAgent.status,
            );
            // First spawn the agent
            dispatch({
              type: "SUBAGENT_SPAWN",
              payload: {
                id: subAgent.id,
                type: subAgent.type as import("../../types/ideation").SubAgentType,
                name: subAgent.name,
              },
            });
            // Then update its status if not spawning
            if (subAgent.status !== "spawning") {
              dispatch({
                type: "SUBAGENT_STATUS",
                payload: {
                  id: subAgent.id,
                  status:
                    subAgent.status as import("../../types/ideation").SubAgentStatus,
                  error: subAgent.error,
                },
              });
            }
          }
        } else {
          console.log("[Session Resume] No sub-agents to restore");
        }

        // Restore linked idea if present in session data
        if (sessionData.session.userSlug && sessionData.session.ideaSlug) {
          console.log(
            "[Session Resume] Restoring linked idea:",
            sessionData.session.userSlug,
            sessionData.session.ideaSlug,
          );
          dispatch({
            type: "SET_LINKED_IDEA",
            payload: {
              userSlug: sessionData.session.userSlug,
              ideaSlug: sessionData.session.ideaSlug,
            },
          });
        } else {
          console.log("[Session Resume] No linked idea to restore");
        }

        // Restore applied insights from memory blocks
        try {
          console.log("[Session Resume] Fetching applied insights...");
          const insightsResponse =
            await api.fetchAppliedInsights(initialSessionId);
          if (
            insightsResponse.success &&
            insightsResponse.data.insights.length > 0
          ) {
            console.log(
              "[Session Resume] Restoring",
              insightsResponse.data.insights.length,
              "applied insights",
            );
            dispatch({
              type: "MEMORY_GRAPH_INSIGHTS_LOAD",
              payload: {
                insights: insightsResponse.data.insights.map((insight) => ({
                  ...insight,
                  // Ensure required ProposedChange fields are present
                  type: insight.type || "create_block",
                  blockType: insight.blockType,
                  title: insight.title,
                  content: insight.content,
                  confidence: insight.confidence || 0.8,
                  graphMembership: insight.graphMembership || [],
                  sourceId: insight.sourceId,
                  sourceType: insight.sourceType,
                  sourceWeight: insight.sourceWeight,
                  corroboratedBy: insight.corroboratedBy || [],
                })),
              },
            });
          } else {
            console.log("[Session Resume] No applied insights to restore");
          }
        } catch (insightsError) {
          // Non-critical - just log and continue
          console.warn(
            "[Session Resume] Failed to load applied insights:",
            insightsError,
          );
        }
      } catch (error) {
        dispatch({
          type: "SESSION_ERROR",
          payload: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to resume session",
          },
        });
      }
    }

    if (isResuming && initialSessionId) {
      resumeSession();
    } else if (!initialSessionId) {
      initSession();
    }
  }, [profileId, entryMode, initialSessionId, isResuming, api]);

  // WebSocket connection for real-time artifact updates
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const sessionId = state.session.sessionId;
    if (!sessionId) return;

    // Create WebSocket connection
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.hostname;
    const wsPort = window.location.port || "3000"; // Use same port as frontend (Vite proxies /ws to backend)
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws?session=${sessionId}`;

    console.log("[WebSocket] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Expose WebSocket for testing
    (
      window as unknown as { __IDEATION_WS__: WebSocket | null }
    ).__IDEATION_WS__ = ws;

    ws.onopen = () => {
      console.log("[WebSocket] Connected to session:", sessionId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WebSocket] Received:", data.type, data);

        switch (data.type) {
          case "artifact:updating":
            console.log("[WebSocket] Artifact updating:", data.data.artifactId);
            // Set artifact status to 'updating' - shows pulsing indicator in tab
            dispatch({
              type: "ARTIFACT_UPDATE",
              payload: {
                id: data.data.artifactId,
                updates: { status: "updating" },
              },
            });
            break;

          case "artifact:updated":
            console.log("[WebSocket] Artifact updated:", data.data.artifactId);
            if (data.data.content) {
              dispatch({
                type: "ARTIFACT_UPDATE",
                payload: {
                  id: data.data.artifactId,
                  updates: {
                    content: data.data.content,
                    status: "ready",
                    updatedAt: new Date().toISOString(),
                  },
                },
              });
              // Open artifact panel to show the update
              dispatch({
                type: "ARTIFACT_PANEL_TOGGLE",
                payload: { isOpen: true },
              });
              // Select the updated artifact
              const updatedArtifact = state.artifacts.artifacts.find(
                (a) => a.id === data.data.artifactId,
              );
              if (updatedArtifact) {
                dispatch({
                  type: "ARTIFACT_SELECT",
                  payload: {
                    artifact: {
                      ...updatedArtifact,
                      content: data.data.content,
                      status: "ready",
                    },
                  },
                });
              }
              // Update the "Updating artifact..." message to show completion
              if (data.data.messageId) {
                dispatch({
                  type: "MESSAGE_CONTENT_UPDATE",
                  payload: {
                    messageId: data.data.messageId,
                    content: `Artifact updated! ${data.data.summary || ""}`,
                  },
                });
              }
            }
            break;

          case "artifact:error":
            console.error("[WebSocket] Artifact error:", data.data.error);
            // Reset artifact status and show error
            dispatch({
              type: "ARTIFACT_UPDATE",
              payload: {
                id: data.data.artifactId,
                updates: { status: "ready" }, // Reset to ready
              },
            });
            setToast({
              message: `Failed to update: ${data.data.error}`,
              type: "error",
            });
            setTimeout(() => setToast(null), 5000);
            break;

          case "connected":
            console.log("[WebSocket] Connection confirmed:", data.data.message);
            break;

          case "pong":
            // Heartbeat response
            break;

          // Sub-agent events
          case "subagent:spawn":
            // ROBUST: Always dispatch spawn - reducer handles idempotency and updates name/type
            // This ensures agent exists even if HTTP response was slow
            console.log(
              "[WebSocket] Sub-agent spawn:",
              data.data.subAgentId,
              data.data.subAgentName,
            );
            dispatch({
              type: "SUBAGENT_SPAWN",
              payload: {
                id: data.data.subAgentId,
                type: data.data.subAgentType,
                name: data.data.subAgentName,
              },
            });
            break;

          case "subagent:status":
            console.log(
              "[WebSocket] Sub-agent status:",
              data.data.subAgentId,
              data.data.subAgentStatus,
            );
            dispatch({
              type: "SUBAGENT_STATUS",
              payload: {
                id: data.data.subAgentId,
                status: data.data.subAgentStatus,
                error: data.data.error,
              },
            });
            break;

          case "subagent:result":
            console.log("[WebSocket] Sub-agent result:", data.data.subAgentId);
            dispatch({
              type: "SUBAGENT_RESULT",
              payload: {
                id: data.data.subAgentId,
                result: data.data.result,
              },
            });
            break;

          case "artifact:created":
            console.log("[WebSocket] Artifact created:", data.data.id);
            // Check if event is scoped to current linked idea (if applicable)
            if (data.data.ideaSlug && state.artifacts.linkedIdea) {
              if (data.data.ideaSlug !== state.artifacts.linkedIdea.ideaSlug) {
                console.log(
                  "[WebSocket] Ignoring artifact:created for different idea",
                );
                break;
              }
            }
            if (data.data.content) {
              dispatch({
                type: "ARTIFACT_ADD",
                payload: {
                  artifact: {
                    id: data.data.id,
                    type: data.data.type || "markdown",
                    title: data.data.title || "Sub-agent Result",
                    content: data.data.content,
                    status: "ready",
                    createdAt: data.data.createdAt || new Date().toISOString(),
                  },
                },
              });
              // Open artifact panel to show the new artifact
              dispatch({
                type: "ARTIFACT_PANEL_TOGGLE",
                payload: { isOpen: true },
              });
            }
            break;

          case "artifact:deleted":
            console.log("[WebSocket] Artifact deleted:", data.data.artifactId);
            // Check if event is scoped to current linked idea (if applicable)
            if (data.data.ideaSlug && state.artifacts.linkedIdea) {
              if (data.data.ideaSlug !== state.artifacts.linkedIdea.ideaSlug) {
                console.log(
                  "[WebSocket] Ignoring artifact:deleted for different idea",
                );
                break;
              }
            }
            dispatch({
              type: "ARTIFACT_REMOVE",
              payload: {
                id: data.data.artifactId,
              },
            });
            break;

          case "classifications:updated":
            console.log(
              "[WebSocket] Classifications updated:",
              data.data.ideaSlug,
            );
            // Only update if classifications are for current linked idea
            if (data.data.ideaSlug && state.artifacts.linkedIdea) {
              if (data.data.ideaSlug !== state.artifacts.linkedIdea.ideaSlug) {
                console.log(
                  "[WebSocket] Ignoring classifications:updated for different idea",
                );
                break;
              }
            }
            if (data.data.classifications) {
              dispatch({
                type: "SET_ARTIFACT_CLASSIFICATIONS",
                payload: {
                  classifications: data.data.classifications,
                },
              });
            }
            break;

          // Follow-up events - async engagement recovery
          case "followup:pending":
            console.log("[WebSocket] Follow-up pending:", data.data.reason);
            dispatch({ type: "FOLLOWUP_PENDING_START" });
            break;

          case "followup:message":
            console.log("[WebSocket] Follow-up message received");
            dispatch({ type: "FOLLOWUP_PENDING_END" });
            // Add the follow-up message to the conversation
            if (data.data.text) {
              dispatch({
                type: "MESSAGE_RECEIVED",
                payload: {
                  message: {
                    id: data.data.messageId || `followup_${Date.now()}`,
                    sessionId: state.session.sessionId || "",
                    role: "assistant",
                    content: data.data.text,
                    buttons: data.data.buttons || null,
                    form: null,
                    createdAt: new Date().toISOString(),
                  },
                },
              });
            }
            break;

          // Chat insights events - real-time insight updates
          case "insight:created":
            console.log("[WebSocket] Insight created:", data.data.insight?.id);
            if (data.data.insight) {
              // Use the efficient INSIGHT_ADD action (handles both cases internally)
              dispatch({
                type: "MEMORY_GRAPH_INSIGHT_ADD",
                payload: { insight: data.data.insight },
              });
            }
            break;

          case "insights:batch":
            console.log(
              "[WebSocket] Insights batch received:",
              data.data.insights?.length,
            );
            if (data.data.insights && data.data.insights.length > 0) {
              dispatch({
                type: "MEMORY_GRAPH_ANALYSIS_COMPLETE",
                payload: {
                  analysis: {
                    context: data.data.context || {
                      who: "system",
                      what: "batch insights",
                      when: new Date().toISOString(),
                      where: "conversation",
                      why: "real-time analysis",
                    },
                    proposedChanges: data.data.insights,
                    cascadeEffects: data.data.cascadeEffects || [],
                    previewNodes: data.data.previewNodes || [],
                    previewEdges: data.data.previewEdges || [],
                  },
                },
              });
            }
            break;

          case "insight:deleted":
            console.log("[WebSocket] Insight deleted:", data.data.insightId);
            if (data.data.insightId) {
              dispatch({
                type: "MEMORY_GRAPH_CHANGE_DELETE",
                payload: { changeId: data.data.insightId },
              });
            }
            break;

          case "insight:updated":
            console.log("[WebSocket] Insight updated:", data.data.insightId);
            if (data.data.insightId && data.data.updates) {
              dispatch({
                type: "MEMORY_GRAPH_CHANGE_EDIT",
                payload: {
                  changeId: data.data.insightId,
                  updates: data.data.updates,
                },
              });
            }
            break;

          default:
            console.log("[WebSocket] Unknown event type:", data.type);
        }
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    // Reconnection logic (WSK-004)
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 1000;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let mounted = true;

    ws.onclose = () => {
      console.log("[WebSocket] Connection closed");
      if (!mounted) return;

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(
          baseDelay * Math.pow(2, reconnectAttempts),
          30000,
        );
        console.log(
          `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`,
        );
        reconnectTimeout = setTimeout(() => {
          if (!mounted) return;
          reconnectAttempts++;
          const newWs = new WebSocket(wsUrl);
          wsRef.current = newWs;
          (
            window as unknown as { __IDEATION_WS__: WebSocket | null }
          ).__IDEATION_WS__ = newWs;
          // Copy event handlers to new WebSocket
          newWs.onopen = ws.onopen;
          newWs.onmessage = ws.onmessage;
          newWs.onerror = ws.onerror;
          newWs.onclose = ws.onclose;
        }, delay);
      } else {
        console.error("[WebSocket] Max reconnection attempts reached");
      }
    };

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    // Cleanup
    return () => {
      mounted = false;
      clearInterval(heartbeat);
      clearTimeout(reconnectTimeout);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      // Clean up test reference
      (
        window as unknown as { __IDEATION_WS__: WebSocket | null }
      ).__IDEATION_WS__ = null;
    };
  }, [state.session.sessionId]);

  // Handle stopping generation
  const handleStopGeneration = useCallback(() => {
    console.log("[IdeationSession] Stopping generation");
    // Clear loading and streaming states
    dispatch({
      type: "MESSAGE_STREAM_END",
      payload: {
        message: {
          id: generateMessageId(),
          sessionId: state.session.sessionId || "",
          role: "assistant" as const,
          content: "*(Generation stopped by user)*",
          buttons: null,
          form: null,
          createdAt: new Date().toISOString(),
        },
      },
    });
  }, [state.session.sessionId]);

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!state.session.sessionId) return;

      dispatch({ type: "MESSAGE_SEND", payload: { content } });

      // Add user message to conversation with temporary ID
      const tempUserMessageId = generateMessageId();
      const userMessage = {
        id: tempUserMessageId,
        sessionId: state.session.sessionId,
        role: "user" as const,
        content,
        buttons: null,
        form: null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "MESSAGE_RECEIVED", payload: { message: userMessage } });

      // Start streaming
      dispatch({ type: "MESSAGE_STREAM_START" });

      try {
        const response = await api.sendMessage(
          state.session.sessionId,
          content,
        );

        // Update user message ID with the real ID from the backend
        if (response.userMessageId) {
          dispatch({
            type: "MESSAGE_UPDATE_ID",
            payload: {
              oldId: tempUserMessageId,
              newId: response.userMessageId,
            },
          });
        }

        // Update with response
        dispatch({
          type: "MESSAGE_STREAM_END",
          payload: {
            message: {
              id: response.messageId || generateMessageId(),
              sessionId: state.session.sessionId,
              role: "assistant",
              content: response.reply,
              buttons: response.buttons || null,
              form: response.form || null,
              createdAt: new Date().toISOString(),
            },
          },
        });

        // Update candidate if present
        if (response.candidateUpdate) {
          dispatch({
            type: "CANDIDATE_UPDATE",
            payload: { candidate: response.candidateUpdate },
          });
        }

        // Update token usage
        if (response.tokenUsage) {
          dispatch({
            type: "TOKEN_UPDATE",
            payload: { usage: response.tokenUsage },
          });
        }

        // Handle async web search if queries were returned
        console.log(
          "[Message Response] webSearchQueries:",
          response.webSearchQueries,
        );
        if (response.webSearchQueries && response.webSearchQueries.length > 0) {
          console.log(
            "[Message Response] Triggering web search with queries:",
            response.webSearchQueries,
          );
          executeAsyncWebSearch(response.webSearchQueries);
        }

        // Handle artifact if returned (mermaid diagrams, code, etc.)
        if (response.artifact) {
          dispatch({
            type: "ARTIFACT_ADD",
            payload: { artifact: response.artifact },
          });
        }

        // Handle artifact update if returned (agent edited an existing artifact)
        if (response.artifactUpdate) {
          dispatch({
            type: "ARTIFACT_UPDATE",
            payload: {
              id: response.artifactUpdate.id,
              updates: {
                content: response.artifactUpdate.content,
                ...(response.artifactUpdate.title && {
                  title: response.artifactUpdate.title,
                }),
                updatedAt: response.artifactUpdate.updatedAt,
              },
            },
          });
          // Open the artifact panel to show the update
          dispatch({
            type: "ARTIFACT_PANEL_TOGGLE",
            payload: { isOpen: true },
          });
          setToast({ message: "Artifact updated!", type: "success" });
          setTimeout(() => setToast(null), 3000);
        }

        // Handle quick-ack with sub-agent tasks - spawn sub-agents immediately for UI
        if (
          response.isQuickAck &&
          response.subAgentTasks &&
          response.subAgentTasks.length > 0
        ) {
          console.log(
            "[Quick-Ack] Spawning",
            response.subAgentTasks.length,
            "sub-agents for message",
            response.messageId,
          );
          // Clear old completed sub-agents before spawning new batch
          dispatch({ type: "SUBAGENT_CLEAR" });
          const triggerMessageId = response.messageId;
          for (const task of response.subAgentTasks) {
            dispatch({
              type: "SUBAGENT_SPAWN",
              payload: {
                id: task.id,
                type: task.type as import("../../types/ideation").SubAgentType,
                name: task.label,
                triggerMessageId,
              },
            });
          }
        }

        // Handle follow-up pending - trigger async follow-up question generation
        if (response.followUpPending && response.followUpContext) {
          console.log(
            "[Follow-Up] Response lacks engagement, triggering async follow-up",
            response.followUpContext.reason,
          );
          dispatch({ type: "FOLLOWUP_PENDING_START" });

          // Trigger follow-up generation asynchronously (don't await)
          api
            .triggerFollowUp(state.session.sessionId, response.followUpContext)
            .then((followUpResult) => {
              console.log("[Follow-Up] Follow-up generated:", followUpResult);
              // The message will be added via WebSocket event
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            })
            .catch((err) => {
              console.error("[Follow-Up] Failed to generate follow-up:", err);
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        dispatch({
          type: "MESSAGE_ERROR",
          payload: { error: errorMessage },
        });

        // If session is not active, treat as session-level error to show full error screen
        if (
          errorMessage.toLowerCase().includes("session is not active") ||
          errorMessage.toLowerCase().includes("session expired")
        ) {
          dispatch({
            type: "SESSION_ERROR",
            payload: {
              error: "Your session has expired. Please start a new session.",
            },
          });
        }
      }
    },
    [state.session.sessionId, api],
  );

  // Execute async web search and add results as artifact
  const executeAsyncWebSearch = useCallback(
    async (queries: string[]) => {
      console.log(
        "[WebSearch] executeAsyncWebSearch called with queries:",
        queries,
      );
      console.log("[WebSearch] Current sessionId:", state.session.sessionId);
      if (!state.session.sessionId) {
        console.log("[WebSearch] No sessionId, returning early");
        return;
      }

      // Create a pending artifact to show loading state
      const pendingArtifactId = `research_${Date.now()}`;
      const pendingArtifact: Artifact = {
        id: pendingArtifactId,
        type: "research",
        title: `Researching: ${queries[0]?.slice(0, 25)}...`,
        content: [],
        queries,
        status: "loading",
        createdAt: new Date().toISOString(),
        identifier: `research_${queries[0]?.slice(0, 20).replace(/\s+/g, "_").toLowerCase() || "results"}`,
      };

      console.log("[WebSearch] Adding pending artifact:", pendingArtifactId);
      dispatch({
        type: "ARTIFACT_ADD",
        payload: { artifact: pendingArtifact },
      });

      try {
        console.log("[WebSearch] Calling API...");
        const resultArtifact = await api.executeWebSearch(
          state.session.sessionId,
          queries,
          state.candidate.candidate?.title,
        );
        console.log(
          "[WebSearch] API returned artifact:",
          resultArtifact.id,
          resultArtifact.title,
        );

        // Update the artifact with results
        console.log("[WebSearch] Updating artifact with results");
        dispatch({
          type: "ARTIFACT_UPDATE",
          payload: {
            id: pendingArtifactId,
            updates: {
              ...resultArtifact,
              id: pendingArtifactId, // Keep the original ID
              status: "ready",
            },
          },
        });
        console.log("[WebSearch] Artifact update dispatched");
      } catch (error) {
        console.error("[WebSearch] Error:", error);
        dispatch({
          type: "ARTIFACT_LOADING_END",
          payload: {
            id: pendingArtifactId,
            error: error instanceof Error ? error.message : "Web search failed",
          },
        });
      }
    },
    [state.session.sessionId, state.candidate.candidate?.title, api],
  );

  // Handle artifact selection
  const handleSelectArtifact = useCallback(
    (artifact: Artifact) => {
      console.log("[IdeationSession] handleSelectArtifact called");
      console.log(
        "[IdeationSession] Artifact to select:",
        artifact.id,
        artifact.title,
      );
      console.log(
        "[IdeationSession] Current artifact before dispatch:",
        state.artifacts.currentArtifact?.id,
      );
      dispatch({ type: "ARTIFACT_SELECT", payload: { artifact } });
    },
    [state.artifacts.currentArtifact?.id],
  );

  // Handle close artifact panel (minimize)
  const handleCloseArtifact = useCallback(() => {
    dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: false } });
  }, []);

  // Handle expand artifact panel
  const handleExpandArtifact = useCallback(() => {
    dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: true } });
  }, []);

  // Handle deleting an artifact
  const handleDeleteArtifact = useCallback(
    async (artifactId: string) => {
      if (!state.session.sessionId) return;

      try {
        await api.deleteArtifact(state.session.sessionId, artifactId);
        dispatch({ type: "ARTIFACT_REMOVE", payload: { id: artifactId } });
        setToast({ message: "Artifact deleted", type: "success" });
      } catch (error) {
        console.error("[DeleteArtifact] Failed:", error);
        setToast({ message: "Failed to delete artifact", type: "error" });
      }
      setTimeout(() => setToast(null), 3000);
    },
    [state.session.sessionId, api],
  );

  // Handle editing an artifact manually
  // Note: content is optional - if not provided, this is just an edit button click
  // which we ignore since inline editing is not yet implemented in IdeaArtifactPanel
  const handleEditArtifact = useCallback(
    async (artifactId: string, content?: string) => {
      console.log("[handleEditArtifact] Called with artifactId:", artifactId);

      // If no content provided, this is just an edit button click - return early
      // Inline editing is handled by the component's own state, not this callback
      if (content === undefined) {
        console.log(
          "[handleEditArtifact] No content provided - edit mode not yet implemented",
        );
        return;
      }

      console.log("[handleEditArtifact] Content length:", content.length);

      if (!state.session.sessionId) return;

      const artifact = state.artifacts.artifacts.find(
        (a) => a.id === artifactId,
      );
      if (!artifact) {
        setToast({ message: "Artifact not found", type: "error" });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      try {
        console.log("[handleEditArtifact] Calling api.saveArtifact...");
        await api.saveArtifact(state.session.sessionId, {
          id: artifactId,
          type: artifact.type,
          title: artifact.title,
          content,
          language: artifact.language,
          identifier: artifact.identifier,
        });
        console.log("[handleEditArtifact] API save successful");

        // Update local state
        console.log(
          "[handleEditArtifact] Dispatching ARTIFACT_UPDATE with content length:",
          content.length,
        );
        dispatch({
          type: "ARTIFACT_UPDATE",
          payload: {
            id: artifactId,
            updates: {
              content,
              updatedAt: new Date().toISOString(),
            },
          },
        });
        console.log("[handleEditArtifact] Dispatch complete");
        setToast({ message: "Artifact saved", type: "success" });
      } catch (error) {
        console.error("[EditArtifact] Failed:", error);
        setToast({ message: "Failed to save artifact", type: "error" });
        throw error; // Re-throw so the panel knows the save failed
      }
      setTimeout(() => setToast(null), 3000);
    },
    [state.session.sessionId, state.artifacts.artifacts, api],
  );

  // Handle renaming an artifact
  const handleRenameArtifact = useCallback(
    async (artifactId: string, newTitle: string) => {
      if (!state.session.sessionId) return;

      const artifact = state.artifacts.artifacts.find(
        (a) => a.id === artifactId,
      );
      if (!artifact) {
        setToast({ message: "Artifact not found", type: "error" });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      try {
        await api.saveArtifact(state.session.sessionId, {
          id: artifactId,
          type: artifact.type,
          title: newTitle,
          content: artifact.content,
          language: artifact.language,
          identifier: artifact.identifier,
        });

        // Update local state
        dispatch({
          type: "ARTIFACT_UPDATE",
          payload: {
            id: artifactId,
            updates: {
              title: newTitle,
              updatedAt: new Date().toISOString(),
            },
          },
        });
        setToast({ message: "Artifact renamed", type: "success" });
      } catch (error) {
        console.error("[RenameArtifact] Failed:", error);
        setToast({ message: "Failed to rename artifact", type: "error" });
        throw error;
      }
      setTimeout(() => setToast(null), 3000);
    },
    [state.session.sessionId, state.artifacts.artifacts, api],
  );

  // Handle artifact click from message (when user clicks @artifact:id reference)
  const handleArtifactClick = useCallback(
    (artifactId: string) => {
      const artifact = state.artifacts.artifacts.find(
        (a) => a.id === artifactId,
      );
      if (artifact) {
        dispatch({ type: "ARTIFACT_SELECT", payload: { artifact } });
        dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: true } });
      } else {
        // Try partial match (in case reference is truncated)
        const partialMatch = state.artifacts.artifacts.find((a) =>
          a.id.startsWith(artifactId),
        );
        if (partialMatch) {
          dispatch({
            type: "ARTIFACT_SELECT",
            payload: { artifact: partialMatch },
          });
          dispatch({
            type: "ARTIFACT_PANEL_TOGGLE",
            payload: { isOpen: true },
          });
        } else {
          setToast({
            message: `Artifact "${artifactId}" not found`,
            type: "error",
          });
          setTimeout(() => setToast(null), 3000);
        }
      }
    },
    [state.artifacts.artifacts],
  );

  // Handle converting a message to an artifact
  const handleConvertToArtifact = useCallback(
    async (content: string, title?: string) => {
      if (!state.session.sessionId) return;

      const artifactId = `text_${Date.now()}`;
      const newArtifact: Artifact = {
        id: artifactId,
        type: "markdown",
        title: title || "Converted Message",
        content,
        status: "ready",
        createdAt: new Date().toISOString(),
        identifier: `msg_${artifactId.slice(-8)}`,
      };

      // Save to database FIRST for persistence (so agent can reference it)
      try {
        console.log("[SaveArtifact] Saving artifact to DB:", artifactId);
        await api.saveArtifact(state.session.sessionId, {
          id: artifactId,
          type: "markdown",
          title: title || "Converted Message",
          content,
          identifier: `msg_${artifactId.slice(-8)}`,
        });
        console.log("[SaveArtifact] Artifact saved successfully:", artifactId);

        // Only add to UI after successful save
        dispatch({ type: "ARTIFACT_ADD", payload: { artifact: newArtifact } });
        dispatch({
          type: "ARTIFACT_SELECT",
          payload: { artifact: newArtifact },
        });
        dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: true } });
        setToast({
          message: `Saved as artifact! ID: ${artifactId}`,
          type: "success",
        });
      } catch (error) {
        console.error("[SaveArtifact] Failed to save artifact:", error);
        setToast({
          message: "Failed to save artifact - try again",
          type: "error",
        });
      }
      setTimeout(() => setToast(null), 3000);
    },
    [state.session.sessionId, api],
  );

  // Handle button clicks
  const handleButtonClick = useCallback(
    async (buttonId: string, buttonValue: string, buttonLabel: string) => {
      if (!state.session.sessionId) return;
      // Prevent double clicks - use ref for synchronous check
      if (buttonClickInProgressRef.current || state.conversation.isLoading)
        return;
      buttonClickInProgressRef.current = true;

      dispatch({ type: "BUTTON_CLICK", payload: { buttonId, buttonValue } });

      // Add user's selection as a message in the conversation (use label for display)
      const tempUserMessageId = generateMessageId();
      const userMessage = {
        id: tempUserMessageId,
        sessionId: state.session.sessionId,
        role: "user" as const,
        content: buttonLabel,
        buttons: null,
        form: null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "MESSAGE_RECEIVED", payload: { message: userMessage } });

      try {
        const response = await api.clickButton(
          state.session.sessionId,
          buttonId,
          buttonValue,
          buttonLabel,
        );

        // Update user message ID with the real ID from the backend
        if (response.userMessageId) {
          dispatch({
            type: "MESSAGE_UPDATE_ID",
            payload: {
              oldId: tempUserMessageId,
              newId: response.userMessageId,
            },
          });
        }

        dispatch({
          type: "MESSAGE_RECEIVED",
          payload: {
            message: {
              id: response.messageId || generateMessageId(),
              sessionId: state.session.sessionId,
              role: "assistant",
              content: response.reply,
              buttons: response.buttons || null,
              form: response.form || null,
              createdAt: new Date().toISOString(),
            },
          },
        });

        // Update candidate if present
        if (response.candidateUpdate) {
          dispatch({
            type: "CANDIDATE_UPDATE",
            payload: { candidate: response.candidateUpdate },
          });
        }
        // Update token usage
        if (response.tokenUsage) {
          dispatch({
            type: "TOKEN_UPDATE",
            payload: { usage: response.tokenUsage },
          });
        }

        // Handle async web search if queries were returned
        console.log(
          "[Button Response] webSearchQueries:",
          response.webSearchQueries,
        );
        if (response.webSearchQueries && response.webSearchQueries.length > 0) {
          console.log(
            "[Button Response] Triggering web search with queries:",
            response.webSearchQueries,
          );
          executeAsyncWebSearch(response.webSearchQueries);
        }

        // Handle quick-ack with sub-agent tasks - spawn sub-agents immediately for UI
        // Same as handleSendMessage - spawns from API response for immediate feedback
        if (
          response.isQuickAck &&
          response.subAgentTasks &&
          response.subAgentTasks.length > 0
        ) {
          console.log(
            "[Quick-Ack/Button] Spawning",
            response.subAgentTasks.length,
            "sub-agents for message",
            response.messageId,
          );
          // Clear old completed sub-agents before spawning new batch
          dispatch({ type: "SUBAGENT_CLEAR" });
          const triggerMessageId = response.messageId;
          for (const task of response.subAgentTasks) {
            dispatch({
              type: "SUBAGENT_SPAWN",
              payload: {
                id: task.id,
                type: task.type as import("../../types/ideation").SubAgentType,
                name: task.label,
                triggerMessageId,
              },
            });
          }
        }

        // Handle follow-up pending - trigger async follow-up question generation
        if (response.followUpPending && response.followUpContext) {
          console.log(
            "[Follow-Up/Button] Response lacks engagement, triggering async follow-up",
            response.followUpContext.reason,
          );
          dispatch({ type: "FOLLOWUP_PENDING_START" });

          // Trigger follow-up generation asynchronously (don't await)
          api
            .triggerFollowUp(state.session.sessionId, response.followUpContext)
            .then((followUpResult) => {
              console.log(
                "[Follow-Up/Button] Follow-up generated:",
                followUpResult,
              );
              // The message will be added via WebSocket event
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            })
            .catch((err) => {
              console.error(
                "[Follow-Up/Button] Failed to generate follow-up:",
                err,
              );
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            });
        }
      } catch (error) {
        dispatch({
          type: "MESSAGE_ERROR",
          payload: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to process button click",
          },
        });
      } finally {
        buttonClickInProgressRef.current = false;
      }
    },
    [state.session.sessionId, api, executeAsyncWebSearch],
  );

  // Handle form submissions
  const handleFormSubmit = useCallback(
    async (formId: string, answers: Record<string, unknown>) => {
      if (!state.session.sessionId) return;

      dispatch({ type: "FORM_SUBMIT", payload: { formId, answers } });

      try {
        const response = await api.submitForm(
          state.session.sessionId,
          formId,
          answers,
        );

        dispatch({
          type: "MESSAGE_RECEIVED",
          payload: {
            message: {
              id: response.messageId || generateMessageId(),
              sessionId: state.session.sessionId,
              role: "assistant",
              content: response.reply,
              buttons: response.buttons || null,
              form: response.form || null,
              createdAt: new Date().toISOString(),
            },
          },
        });

        // Handle follow-up pending - trigger async follow-up question generation
        if (response.followUpPending && response.followUpContext) {
          console.log(
            "[Follow-Up/Form] Response lacks engagement, triggering async follow-up",
            response.followUpContext.reason,
          );
          dispatch({ type: "FOLLOWUP_PENDING_START" });

          // Trigger follow-up generation asynchronously (don't await)
          api
            .triggerFollowUp(state.session.sessionId, response.followUpContext)
            .then((followUpResult) => {
              console.log(
                "[Follow-Up/Form] Follow-up generated:",
                followUpResult,
              );
              // The message will be added via WebSocket event
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            })
            .catch((err) => {
              console.error(
                "[Follow-Up/Form] Failed to generate follow-up:",
                err,
              );
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            });
        }
      } catch (error) {
        dispatch({
          type: "MESSAGE_ERROR",
          payload: {
            error:
              error instanceof Error ? error.message : "Failed to submit form",
          },
        });
      }
    },
    [state.session.sessionId, api],
  );

  // Handle message editing
  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!state.session.sessionId) return;

      // Truncate messages from the edited message onwards in local state
      dispatch({ type: "MESSAGES_TRUNCATE", payload: { messageId } });
      dispatch({ type: "MESSAGE_SEND", payload: { content: newContent } });

      // Add the new user message to conversation with temporary ID
      const tempUserMessageId = generateMessageId();
      const userMessage = {
        id: tempUserMessageId,
        sessionId: state.session.sessionId,
        role: "user" as const,
        content: newContent,
        buttons: null,
        form: null,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "MESSAGE_RECEIVED", payload: { message: userMessage } });

      // Start streaming
      dispatch({ type: "MESSAGE_STREAM_START" });

      try {
        const response = await api.editMessage(
          state.session.sessionId,
          messageId,
          newContent,
        );

        // Update user message ID with the real ID from the backend
        if (response.userMessageId) {
          dispatch({
            type: "MESSAGE_UPDATE_ID",
            payload: {
              oldId: tempUserMessageId,
              newId: response.userMessageId,
            },
          });
        }

        // Update with response
        dispatch({
          type: "MESSAGE_STREAM_END",
          payload: {
            message: {
              id: response.messageId || generateMessageId(),
              sessionId: state.session.sessionId,
              role: "assistant",
              content: response.reply,
              buttons: response.buttons || null,
              form: response.form || null,
              createdAt: new Date().toISOString(),
            },
          },
        });

        // Update candidate if present
        if (response.candidateUpdate) {
          dispatch({
            type: "CANDIDATE_UPDATE",
            payload: { candidate: response.candidateUpdate },
          });
        }

        // Update token usage
        if (response.tokenUsage) {
          dispatch({
            type: "TOKEN_UPDATE",
            payload: { usage: response.tokenUsage },
          });
        }

        // Handle artifact if returned (mermaid diagrams, code, etc.)
        if (response.artifact) {
          dispatch({
            type: "ARTIFACT_ADD",
            payload: { artifact: response.artifact },
          });
        }

        // Handle artifact update if returned (agent edited an existing artifact)
        if (response.artifactUpdate) {
          dispatch({
            type: "ARTIFACT_UPDATE",
            payload: {
              id: response.artifactUpdate.id,
              updates: {
                content: response.artifactUpdate.content,
                ...(response.artifactUpdate.title && {
                  title: response.artifactUpdate.title,
                }),
                updatedAt: response.artifactUpdate.updatedAt,
              },
            },
          });
          // Open the artifact panel to show the update
          dispatch({
            type: "ARTIFACT_PANEL_TOGGLE",
            payload: { isOpen: true },
          });
          setToast({ message: "Artifact updated!", type: "success" });
          setTimeout(() => setToast(null), 3000);
        }

        // Handle async web search if queries were returned
        if (response.webSearchQueries && response.webSearchQueries.length > 0) {
          executeAsyncWebSearch(response.webSearchQueries);
        }

        // Handle quick-ack with sub-agent tasks - spawn sub-agents immediately for UI
        if (
          response.isQuickAck &&
          response.subAgentTasks &&
          response.subAgentTasks.length > 0
        ) {
          console.log(
            "[Quick-Ack/Edit] Spawning",
            response.subAgentTasks.length,
            "sub-agents for message",
            response.messageId,
          );
          // Clear old completed sub-agents before spawning new batch
          dispatch({ type: "SUBAGENT_CLEAR" });
          const triggerMessageId = response.messageId;
          for (const task of response.subAgentTasks) {
            dispatch({
              type: "SUBAGENT_SPAWN",
              payload: {
                id: task.id,
                type: task.type as import("../../types/ideation").SubAgentType,
                name: task.label,
                triggerMessageId,
              },
            });
          }
        }

        // Handle follow-up pending - trigger async follow-up question generation
        if (response.followUpPending && response.followUpContext) {
          console.log(
            "[Follow-Up/Edit] Response lacks engagement, triggering async follow-up",
            response.followUpContext.reason,
          );
          dispatch({ type: "FOLLOWUP_PENDING_START" });

          // Trigger follow-up generation asynchronously (don't await)
          api
            .triggerFollowUp(state.session.sessionId, response.followUpContext)
            .then((followUpResult) => {
              console.log(
                "[Follow-Up/Edit] Follow-up generated:",
                followUpResult,
              );
              // The message will be added via WebSocket event
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            })
            .catch((err) => {
              console.error(
                "[Follow-Up/Edit] Failed to generate follow-up:",
                err,
              );
              dispatch({ type: "FOLLOWUP_PENDING_END" });
            });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to edit message";
        dispatch({
          type: "MESSAGE_ERROR",
          payload: { error: errorMessage },
        });
      }
    },
    [state.session.sessionId, api, executeAsyncWebSearch],
  );

  // Handle tab changes (T6.1)
  const handleTabChange = useCallback((tab: SessionTab) => {
    setActiveTab(tab);
    // Clear graph updates indicator when switching to graph tab
    if (tab === "graph") {
      setHasGraphUpdates(false);
      setGraphUpdateCount(0);
      // Auto-minimize the right panel to give more space for the graph
      dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: false } });
    } else if (tab === "chat") {
      // Auto-expand the right panel when returning to chat
      dispatch({ type: "ARTIFACT_PANEL_TOGGLE", payload: { isOpen: true } });
    }
  }, []);

  // Handle graph update count changes (T6.2)
  const handleGraphUpdateCount = useCallback(
    (count: number) => {
      setGraphUpdateCount(count);
      if (count > 0 && activeTab !== "graph") {
        setHasGraphUpdates(true);
      }
    },
    [activeTab],
  );

  // Source navigation handlers (navigate from graph node to source location)
  const handleNavigateToChatMessage = useCallback(
    (messageId: string, _turnIndex?: number) => {
      setActiveTab("chat");
      setHighlightedMessageId(messageId);
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightedMessageId(undefined), 3000);
    },
    [],
  );

  const handleNavigateToArtifact = useCallback(
    (artifactIdOrTitle: string, _section?: string) => {
      console.log(
        "[handleNavigateToArtifact] Navigating to artifact:",
        artifactIdOrTitle,
      );
      console.log(
        "[handleNavigateToArtifact] Available artifacts:",
        state.artifacts.artifacts.map((a) => ({ id: a.id, title: a.title })),
      );

      // Helper to normalize titles for comparison
      const normalizeTitle = (title: string) =>
        title.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Try multiple matching strategies:
      // 1. Exact ID match
      let artifact = state.artifacts.artifacts.find(
        (a) => a.id === artifactIdOrTitle,
      );

      // 2. If not found, try matching by title (the artifactIdOrTitle might be a title)
      if (!artifact) {
        const normalizedInput = normalizeTitle(artifactIdOrTitle);
        artifact = state.artifacts.artifacts.find(
          (a) => normalizeTitle(a.title) === normalizedInput,
        );
        if (artifact) {
          console.log(
            "[handleNavigateToArtifact] Found artifact by exact title match:",
            artifact.title,
          );
        }
      }

      // 3. If still not found, try partial title match (input contains title or vice versa)
      if (!artifact) {
        const normalizedInput = normalizeTitle(artifactIdOrTitle);
        artifact = state.artifacts.artifacts.find((a) => {
          const normalizedTitle = normalizeTitle(a.title);
          return (
            normalizedTitle.includes(normalizedInput) ||
            normalizedInput.includes(normalizedTitle)
          );
        });
        if (artifact) {
          console.log(
            "[handleNavigateToArtifact] Found artifact by partial title match:",
            artifact.title,
          );
        }
      }

      // 4. If still not found, try matching title words (for "Research: topic" format)
      if (!artifact && artifactIdOrTitle.includes(":")) {
        const titlePart = artifactIdOrTitle
          .split(":")
          .slice(1)
          .join(":")
          .trim();
        if (titlePart) {
          const normalizedTitlePart = normalizeTitle(titlePart);
          artifact = state.artifacts.artifacts.find((a) => {
            const normalizedTitle = normalizeTitle(a.title);
            return (
              normalizedTitle.includes(normalizedTitlePart) ||
              normalizedTitlePart.includes(normalizedTitle)
            );
          });
          if (artifact) {
            console.log(
              "[handleNavigateToArtifact] Found artifact by title part match:",
              artifact.title,
            );
          }
        }
      }

      if (artifact) {
        console.log(
          "[handleNavigateToArtifact] Found artifact:",
          artifact.title,
        );
        dispatch({
          type: "ARTIFACT_SELECT",
          payload: { artifact },
        });
        // Only open the panel if it's currently closed/minimized
        if (!state.artifacts.isPanelOpen) {
          dispatch({
            type: "ARTIFACT_PANEL_TOGGLE",
            payload: { isOpen: true },
          });
        }
        // Force the artifact panel to switch to the artifacts tab
        setForceArtifactPanelTab("artifacts");
      } else {
        // Artifact not found - could be a file-based artifact or ID mismatch
        console.warn(
          "[handleNavigateToArtifact] Artifact not found in session artifacts. ID/Title:",
          artifactIdOrTitle,
          "- This might be a file-based artifact. Consider navigating to Files tab.",
        );
        // If it looks like a file-based artifact (starts with file_ or contains path-like characters)
        if (
          artifactIdOrTitle.startsWith("file_") ||
          artifactIdOrTitle.includes("/")
        ) {
          console.log(
            "[handleNavigateToArtifact] Attempting to navigate to Files tab...",
          );
          setActiveTab("files");
          setToast({
            message: "Artifact may be in project files. Switched to Files tab.",
            type: "success",
          });
          setTimeout(() => setToast(null), 3000);
        }
      }
    },
    [state.artifacts.artifacts, state.artifacts.isPanelOpen],
  );

  const handleNavigateToMemoryDB = useCallback(
    (tableName: string, blockId?: string) => {
      setActiveTab("memory");
      setMemoryHighlightTable(tableName as MemoryTableName);
      setMemoryHighlightId(blockId);
      // Clear highlight after navigation
      setTimeout(() => {
        setMemoryHighlightTable(undefined);
        setMemoryHighlightId(undefined);
      }, 5000);
    },
    [],
  );

  const handleNavigateToExternal = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // Navigate to Insights tab and highlight the insight with matching sourceId
  const handleNavigateToInsight = useCallback(
    (sourceId: string) => {
      console.log(
        "[handleNavigateToInsight] Navigating to insight with sourceId:",
        sourceId,
      );
      // Open the artifact panel if not already open
      if (!state.artifacts.isPanelOpen) {
        dispatch({
          type: "ARTIFACT_PANEL_TOGGLE",
          payload: { isOpen: true },
        });
      }
      // Set the highlight source ID which will trigger the IdeaArtifactPanel
      // to switch to insights tab and highlight the matching insight
      setHighlightInsightSourceId(sourceId);
    },
    [state.artifacts.isPanelOpen],
  );

  // Clear insight highlight (called by IdeaArtifactPanel after highlight timeout)
  const handleClearHighlightInsight = useCallback(() => {
    setHighlightInsightSourceId(null);
  }, []);

  // Refresh insights from backend (called when source mapping completes via WebSocket)
  const handleInsightsRefresh = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      console.log(
        "[IdeationSession] Refreshing insights after source mapping complete",
      );
      const insightsResponse = await api.fetchAppliedInsights(
        state.session.sessionId,
      );
      if (insightsResponse.success && insightsResponse.data.insights) {
        dispatch({
          type: "MEMORY_GRAPH_INSIGHTS_LOAD",
          payload: { insights: insightsResponse.data.insights },
        });
        console.log(
          `[IdeationSession] Refreshed ${insightsResponse.data.insights.length} applied insights`,
        );
      }
    } catch (error) {
      console.warn("[IdeationSession] Failed to refresh insights:", error);
    }
  }, [state.session.sessionId, api]);

  const handleBackToGraph = useCallback(() => {
    setActiveTab("graph");
  }, []);

  // Graph node selection action handlers
  const handleLinkNode = useCallback((nodeId: string) => {
    // TODO: Open a linking dialog to select target node and link type
    console.log("[IdeationSession] handleLinkNode:", nodeId);
  }, []);

  const handleGroupIntoSynthesis = useCallback((nodeId: string) => {
    // TODO: Open a dialog to create a synthesis block grouping selected nodes
    console.log("[IdeationSession] handleGroupIntoSynthesis:", nodeId);
  }, []);

  const handleDeleteNode = useCallback(
    async (nodeId: string, nodeLabel: string) => {
      if (!state.session.sessionId) return;

      try {
        const response = await fetch(
          `/api/ideation/session/${state.session.sessionId}/graph/blocks/${nodeId}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          throw new Error("Failed to delete block");
        }

        console.log("[IdeationSession] Block deleted:", nodeId);
        // Show success notification
        setGraphSuccessNotification({
          action: "deleted",
          nodeLabel,
        });
        // Trigger graph refetch to update the UI
        setGraphRefetchTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("[IdeationSession] Error deleting block:", error);
      }
    },
    [state.session.sessionId],
  );

  // Handle deleting all nodes in a group (from Node Group Report view)
  const handleDeleteNodeGroup = useCallback(
    async (nodeIds: string[], groupName: string) => {
      if (!state.session.sessionId || nodeIds.length === 0) return;

      try {
        console.log(
          "[IdeationSession] Deleting node group:",
          groupName,
          "with",
          nodeIds.length,
          "nodes",
        );

        // Delete all nodes in parallel
        const deletePromises = nodeIds.map((nodeId) =>
          fetch(
            `/api/ideation/session/${state.session.sessionId}/graph/blocks/${nodeId}`,
            { method: "DELETE" },
          ),
        );

        const results = await Promise.all(deletePromises);
        const failedCount = results.filter((r) => !r.ok).length;

        if (failedCount > 0) {
          console.warn(
            "[IdeationSession] Some blocks failed to delete:",
            failedCount,
          );
        }

        console.log(
          "[IdeationSession] Node group deleted:",
          nodeIds.length - failedCount,
          "of",
          nodeIds.length,
          "nodes",
        );

        // Show success notification
        setGraphSuccessNotification({
          action: "deleted",
          nodeLabel: `${nodeIds.length} nodes from "${groupName}"`,
        });
        // Trigger graph refetch to update the UI
        setGraphRefetchTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("[IdeationSession] Error deleting node group:", error);
      }
    },
    [state.session.sessionId],
  );

  // Clear graph notification
  const handleClearGraphNotification = useCallback(() => {
    setGraphSuccessNotification(null);
  }, []);

  // Handle memory graph analysis
  const handleAnalyzeGraph = useCallback(async () => {
    if (!state.session.sessionId) return;

    dispatch({ type: "MEMORY_GRAPH_ANALYSIS_START" });

    try {
      // Pass lastAnalyzedAt for incremental analysis (only analyze new conversations)
      const analysis = await api.analyzeGraphChanges(
        state.session.sessionId,
        undefined, // selectedSourceIds
        undefined, // ideaSlug
        state.memoryGraph.lastAnalyzedAt || undefined, // sinceTimestamp
      );
      dispatch({
        type: "MEMORY_GRAPH_ANALYSIS_COMPLETE",
        payload: { analysis },
      });
    } catch (error) {
      dispatch({
        type: "MEMORY_GRAPH_ANALYSIS_ERROR",
        payload: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to analyze graph changes",
        },
      });
      setToast({
        message: "Failed to analyze graph changes",
        type: "error",
      });
      setTimeout(() => setToast(null), 3000);
    }
  }, [state.session.sessionId, state.memoryGraph.lastAnalyzedAt, api]);

  // Handle applying selected graph changes
  const handleApplyGraphChanges = useCallback(async () => {
    if (!state.session.sessionId) return;
    if (!state.memoryGraph.analysis) return;

    dispatch({ type: "MEMORY_GRAPH_APPLY_START" });

    try {
      const result = await api.applyGraphChanges(
        state.session.sessionId,
        state.memoryGraph.selectedChangeIds,
        state.memoryGraph.analysis.proposedChanges, // Pass the actual changes data
        state.memoryGraph.analysis.sources, // Pass sources for lineage tracking
      );
      dispatch({ type: "MEMORY_GRAPH_APPLY_COMPLETE" });
      setToast({
        message: `Graph updated: ${result.blocksCreated} blocks, ${result.linksCreated} links created`,
        type: "success",
      });
      setTimeout(() => setToast(null), 3000);
      // Refresh the graph tab count
      setGraphUpdateCount((prev) => prev + result.blocksCreated);

      // Fetch updated applied insights from backend to get full data including allSources
      // This runs after source mapping is complete
      try {
        const insightsResponse = await api.fetchAppliedInsights(
          state.session.sessionId,
        );
        if (insightsResponse.success && insightsResponse.data.insights) {
          dispatch({
            type: "MEMORY_GRAPH_INSIGHTS_LOAD",
            payload: { insights: insightsResponse.data.insights },
          });
          console.log(
            `[Graph Apply] Refreshed ${insightsResponse.data.insights.length} applied insights`,
          );
        }
      } catch (fetchError) {
        console.warn(
          "[Graph Apply] Failed to refresh applied insights:",
          fetchError,
        );
        // Don't fail the whole operation - the local state has the basic insight data
      }
    } catch (error) {
      dispatch({
        type: "MEMORY_GRAPH_APPLY_ERROR",
        payload: {
          error:
            error instanceof Error
              ? error.message
              : "Failed to apply graph changes",
        },
      });
    }
  }, [
    state.session.sessionId,
    state.memoryGraph.selectedChangeIds,
    state.memoryGraph.analysis,
    api,
  ]);

  // Handle toggling a proposed change selection
  const handleToggleGraphChange = useCallback(
    (changeId: string) => {
      const currentSelected = state.memoryGraph.selectedChangeIds;
      const newSelected = currentSelected.includes(changeId)
        ? currentSelected.filter((id) => id !== changeId)
        : [...currentSelected, changeId];
      dispatch({
        type: "MEMORY_GRAPH_CHANGES_SELECT",
        payload: { changeIds: newSelected },
      });
    },
    [state.memoryGraph.selectedChangeIds],
  );

  // Handle selecting all proposed changes
  const handleSelectAllGraphChanges = useCallback(() => {
    if (!state.memoryGraph.analysis) return;
    dispatch({
      type: "MEMORY_GRAPH_CHANGES_SELECT",
      payload: {
        changeIds: state.memoryGraph.analysis.proposedChanges.map((c) => c.id),
      },
    });
  }, [state.memoryGraph.analysis]);

  // Handle selecting no proposed changes
  const handleSelectNoGraphChanges = useCallback(() => {
    dispatch({
      type: "MEMORY_GRAPH_CHANGES_SELECT",
      payload: { changeIds: [] },
    });
  }, []);

  // Handle deleting an insight (proposed change) from the insights panel
  const handleDeleteInsight = useCallback((insightId: string) => {
    dispatch({
      type: "MEMORY_GRAPH_CHANGE_DELETE",
      payload: { changeId: insightId },
    });
  }, []);

  // Handle editing an insight (proposed change) from the insights panel
  const handleEditInsight = useCallback(
    (insightId: string, updates: { title?: string; content?: string }) => {
      dispatch({
        type: "MEMORY_GRAPH_CHANGE_EDIT",
        payload: { changeId: insightId, updates },
      });
    },
    [],
  );

  // Handle closing the memory graph modal
  const handleCloseGraphModal = useCallback(() => {
    dispatch({ type: "MEMORY_GRAPH_MODAL_CLOSE" });
  }, []);

  // Handle discard candidate
  const handleDiscard = useCallback(() => {
    dispatch({ type: "CANDIDATE_CLEAR" });
    dispatch({ type: "INTERVENTION_DISMISS" });
  }, []);

  // Handle intervention continue
  const handleContinue = useCallback(() => {
    dispatch({ type: "INTERVENTION_DISMISS" });
  }, []);

  // Handle generating a spec from the session
  const handleGenerateSpec = useCallback(async () => {
    if (!state.session.sessionId) return;

    setIsSpecGenerating(true);
    try {
      const response = await fetch("/api/specs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.session.sessionId,
          userId: profileId,
          ideaTitle: state.candidate.candidate?.title,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate spec");
      }

      // Refresh spec data
      await fetchSpec();
      setToast({ message: "Spec generated successfully!", type: "success" });
    } catch (error) {
      console.error("[GenerateSpec] Error:", error);
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to generate spec",
        type: "error",
      });
    } finally {
      setIsSpecGenerating(false);
    }
    setTimeout(() => setToast(null), 3000);
  }, [
    state.session.sessionId,
    state.candidate.candidate?.title,
    profileId,
    fetchSpec,
  ]);

  // Handle spec edit mode
  const handleSpecEdit = useCallback(() => {
    setIsSpecEditing(true);
  }, []);

  // Handle spec save
  const handleSpecSave = useCallback(
    async (_updates: Record<string, unknown>) => {
      // Updates are handled by the SpecPanel's section editors
      // Just exit edit mode
      setIsSpecEditing(false);
      setToast({ message: "Spec saved", type: "success" });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // Handle spec cancel edit
  const handleSpecCancel = useCallback(() => {
    setIsSpecEditing(false);
  }, []);

  // Handle spec workflow transitions
  const handleSpecTransition = useCallback(
    async (newState: SpecWorkflowState) => {
      try {
        switch (newState) {
          case "review":
            await submitForReview();
            break;
          case "approved":
            await approveSpec();
            break;
          case "draft":
            await requestChanges();
            break;
          case "archived":
            await archiveSpec();
            break;
        }
      } catch (error) {
        setToast({
          message:
            error instanceof Error
              ? error.message
              : "Failed to transition spec",
          type: "error",
        });
        setTimeout(() => setToast(null), 3000);
      }
    },
    [submitForReview, approveSpec, requestChanges, archiveSpec],
  );

  // Handle creating tasks from approved spec
  const handleSpecCreateTasks = useCallback(async () => {
    if (!spec) return;

    try {
      const response = await fetch(`/api/specs/${spec.id}/create-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create tasks");
      }

      const data = await response.json();
      setToast({
        message: `Created ${data.taskCount || 0} tasks from spec`,
        type: "success",
      });
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to create tasks",
        type: "error",
      });
    }
    setTimeout(() => setToast(null), 3000);
  }, [spec]);

  // Handle updating session title
  const handleUpdateTitle = useCallback(
    async (newTitle: string) => {
      if (!state.session.sessionId) return;

      try {
        // Update session title in the backend (triggers folder creation if needed)
        const result = await api.updateSessionTitle(
          state.session.sessionId,
          newTitle,
        );

        // Update session title in local state
        dispatch({
          type: "SESSION_TITLE_UPDATE",
          payload: { title: newTitle },
        });

        // Also update candidate for backward compatibility if one exists
        if (state.candidate.candidate) {
          await api.updateCandidate(state.session.sessionId, {
            title: newTitle,
          });
          dispatch({
            type: "CANDIDATE_UPDATE",
            payload: {
              candidate: {
                ...state.candidate.candidate,
                title: newTitle,
              },
            },
          });
        }

        // Update linked idea if folder was created
        if (result.folderCreated && result.folder) {
          dispatch({
            type: "SET_LINKED_IDEA",
            payload: result.folder,
          });
        }

        setToast({ message: "Title updated", type: "success" });
      } catch (error) {
        console.error("Failed to update title:", error);
        setToast({ message: "Failed to update title", type: "error" });
      }
      setTimeout(() => setToast(null), 2000);
    },
    [state.candidate.candidate, state.session.sessionId, api],
  );

  // Handle idea selection from IdeaSelector
  const handleSelectIdea = useCallback(
    async (idea: { userSlug: string; ideaSlug: string } | null) => {
      if (!state.session.sessionId) return;

      try {
        if (idea) {
          // Link the idea to the session via API
          await api.linkIdea(
            state.session.sessionId,
            idea.userSlug,
            idea.ideaSlug,
          );
          // Update local state
          dispatch({
            type: "SET_LINKED_IDEA",
            payload: idea,
          });
          setToast({
            message: `Now working on: ${idea.ideaSlug}`,
            type: "success",
          });
        } else {
          // Unlink the idea
          dispatch({
            type: "SET_LINKED_IDEA",
            payload: null,
          });
        }
      } catch (error) {
        console.error("Failed to link idea:", error);
        setToast({ message: "Failed to link idea", type: "error" });
      }
      setTimeout(() => setToast(null), 2000);
    },
    [state.session.sessionId, api],
  );

  // Handle opening new idea modal
  const handleNewIdea = useCallback(() => {
    setShowIdeaTypeModal(true);
  }, []);

  // Handle creating a new idea
  const handleCreateIdea = useCallback(
    async (data: {
      name: string;
      ideaType: IdeaTypeValue;
      parent?: {
        type: "internal" | "external";
        slug?: string;
        name?: string;
      };
    }) => {
      if (!state.session.sessionId) {
        setToast({ message: "No active session", type: "error" });
        setTimeout(() => setToast(null), 2000);
        return;
      }

      try {
        // Call API to name/create the idea
        const response = await fetch(
          `/api/ideation/session/${state.session.sessionId}/name-idea`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: data.name,
              ideaType: data.ideaType,
              parent: data.parent,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to create idea");
        }

        const result = await response.json();

        // Update state with the new linked idea
        if (result.success && result.session) {
          dispatch({
            type: "SET_LINKED_IDEA",
            payload: {
              userSlug: result.session.userSlug,
              ideaSlug: result.session.ideaSlug,
            },
          });
          setToast({ message: `Created: ${data.name}`, type: "success" });
        }

        setShowIdeaTypeModal(false);
      } catch (error) {
        console.error("Failed to create idea:", error);
        setToast({
          message:
            error instanceof Error ? error.message : "Failed to create idea",
          type: "error",
        });
      }
      setTimeout(() => setToast(null), 2000);
    },
    [state.session.sessionId],
  );

  if (state.session.status === "error") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-red-600 mb-4">{state.session.error}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (state.session.status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Starting your ideation session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ideation-session h-full flex flex-col relative">
      <SessionHeader
        sessionId={state.session.sessionId || ""}
        sessionTitle={state.session.title}
        tokenUsage={state.tokens.usage}
        candidate={state.candidate.candidate}
        onDiscard={handleDiscard}
        onMinimize={onExit}
        onUpdateTitle={handleUpdateTitle}
        userSlug={profileId}
        linkedIdea={state.artifacts.linkedIdea}
        onSelectIdea={handleSelectIdea}
        onNewIdea={handleNewIdea}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        graphUpdateCount={graphUpdateCount}
        hasGraphUpdates={hasGraphUpdates}
        hasSpec={hasSpec}
        filesCount={filesCount}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main content area - shows Chat or Graph based on active tab */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Chat Tab Panel - always mounted to preserve state, hidden via CSS */}
          <div
            className={`flex-1 flex flex-col min-w-0 overflow-hidden ${activeTab !== "chat" ? "hidden" : ""}`}
            role="tabpanel"
            id="chat-panel"
            aria-labelledby="chat-tab"
            aria-hidden={activeTab !== "chat"}
          >
            <ConversationPanel
              messages={state.conversation.messages}
              isLoading={state.conversation.isLoading}
              followUpPending={state.conversation.followUpPending}
              streamingContent={state.conversation.streamingContent}
              error={state.conversation.error}
              subAgents={state.subAgents.subAgents}
              triggerMessageId={state.subAgents.triggerMessageId}
              highlightedMessageId={highlightedMessageId}
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              onButtonClick={handleButtonClick}
              onFormSubmit={handleFormSubmit}
              onEditMessage={handleEditMessage}
              onArtifactClick={handleArtifactClick}
              onConvertToArtifact={handleConvertToArtifact}
            />
          </div>

          {/* Graph Tab Panel (T6.1 - lazy loaded) - wrapped in error boundary */}
          <GraphPanelErrorBoundary>
            <GraphTabPanel
              sessionId={state.session.sessionId || ""}
              ideaSlug={state.artifacts.linkedIdea?.ideaSlug}
              isVisible={activeTab === "graph"}
              onUpdateCount={handleGraphUpdateCount}
              onUpdateMemoryGraph={handleAnalyzeGraph}
              isAnalyzingGraph={state.memoryGraph.isAnalyzing}
              pendingGraphChanges={state.memoryGraph.pendingChangesCount}
              onNavigateToChatMessage={handleNavigateToChatMessage}
              onNavigateToArtifact={handleNavigateToArtifact}
              onNavigateToMemoryDB={handleNavigateToMemoryDB}
              onNavigateToExternal={handleNavigateToExternal}
              onNavigateToInsight={handleNavigateToInsight}
              onLinkNode={handleLinkNode}
              onGroupIntoSynthesis={handleGroupIntoSynthesis}
              onDeleteNode={handleDeleteNode}
              onDeleteNodeGroup={handleDeleteNodeGroup}
              refetchTrigger={graphRefetchTrigger}
              successNotification={graphSuccessNotification}
              onClearNotification={handleClearGraphNotification}
              onSnapshotRestored={() =>
                setGraphRefetchTrigger((prev) => prev + 1)
              }
              existingInsights={
                state.memoryGraph.analysis?.proposedChanges || []
              }
              onInsightsRefresh={handleInsightsRefresh}
            />
          </GraphPanelErrorBoundary>

          {/* Files Tab Panel (T9.2 - Project folder browser) */}
          {state.artifacts.linkedIdea && (
            <ProjectFilesPanel
              userSlug={state.artifacts.linkedIdea.userSlug}
              ideaSlug={state.artifacts.linkedIdea.ideaSlug}
              isVisible={activeTab === "files"}
              onFilesLoaded={setFilesCount}
              className={activeTab === "files" ? "flex-1" : "hidden"}
            />
          )}

          {/* Spec Tab Panel (T9.3 - Spec view and management) */}
          <SpecViewPanel
            spec={spec}
            sections={specSections}
            isVisible={activeTab === "spec"}
            isLoading={isSpecLoading}
            onRegenerate={handleGenerateSpec}
            className={activeTab === "spec" ? "flex-1" : "hidden"}
          />

          {/* Memory Database Tab Panel - Browse memory blocks and links */}
          {state.session.sessionId && (
            <MemoryDatabasePanel
              sessionId={state.session.sessionId}
              highlightTable={memoryHighlightTable}
              highlightId={memoryHighlightId}
              onBackToGraph={handleBackToGraph}
              className={activeTab === "memory" ? "flex-1" : "hidden"}
              refetchTrigger={graphRefetchTrigger}
            />
          )}
        </div>

        {/* Combined Idea & Artifact Panel - Right side */}
        <IdeaArtifactPanel
          candidate={state.candidate.candidate}
          risks={state.candidate.risks}
          showIntervention={state.candidate.showIntervention}
          onContinue={handleContinue}
          onDiscard={handleDiscard}
          artifacts={state.artifacts.artifacts}
          currentArtifact={state.artifacts.currentArtifact}
          classifications={state.artifacts.artifactClassifications}
          onSelectArtifact={handleSelectArtifact}
          onCloseArtifact={handleCloseArtifact}
          onExpandArtifact={handleExpandArtifact}
          onDeleteArtifact={handleDeleteArtifact}
          onEditArtifact={handleEditArtifact}
          onRenameArtifact={handleRenameArtifact}
          isArtifactLoading={state.artifacts.isLoading}
          isMinimized={!state.artifacts.isPanelOpen}
          // Spec props (SPEC-006-E integration)
          spec={spec}
          specSections={specSections}
          isSpecEditing={isSpecEditing}
          onSpecEdit={handleSpecEdit}
          onSpecSave={handleSpecSave}
          onSpecCancel={handleSpecCancel}
          onSpecTransition={handleSpecTransition}
          onSpecCreateTasks={handleSpecCreateTasks}
          onGenerateSpec={isReadyForSpec ? handleGenerateSpec : undefined}
          isSpecLoading={isSpecLoading || isSpecGenerating}
          // Insights props (chat insights from memory graph analysis)
          // Show both pending (in analysis) and applied insights
          insights={[
            ...(state.memoryGraph.analysis?.proposedChanges || []),
            ...state.memoryGraph.appliedInsights,
          ]}
          pendingInsightsCount={state.memoryGraph.pendingChangesCount}
          onAnalyzeInsights={handleAnalyzeGraph}
          isAnalyzingInsights={state.memoryGraph.isAnalyzing}
          onDeleteInsight={handleDeleteInsight}
          onEditInsight={handleEditInsight}
          // Navigation callbacks for source lineage in insights
          onNavigateToChatMessage={handleNavigateToChatMessage}
          onNavigateToArtifact={handleNavigateToArtifact}
          onNavigateToMemoryDB={handleNavigateToMemoryDB}
          // Highlight specific insight (used for navigation from Source Lineage)
          highlightInsightSourceId={highlightInsightSourceId}
          onClearHighlightInsight={handleClearHighlightInsight}
          // Force tab switch (for navigation from Source Lineage)
          forceActiveTab={forceArtifactPanelTab}
          onForceActiveTabHandled={() => setForceArtifactPanelTab(null)}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          data-testid={
            toast.type === "error" ? "error-toast" : "toast-notification"
          }
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-80 rounded focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Idea Type Modal */}
      <IdeaTypeModal
        isOpen={showIdeaTypeModal}
        userSlug={profileId}
        onClose={() => setShowIdeaTypeModal(false)}
        onSubmit={handleCreateIdea}
      />

      {/* Memory Graph Update Modal */}
      <UpdateMemoryGraphModal
        isOpen={state.memoryGraph.isModalOpen}
        analysis={state.memoryGraph.analysis}
        selectedChangeIds={state.memoryGraph.selectedChangeIds}
        isApplying={state.memoryGraph.isApplying}
        error={state.memoryGraph.error}
        onClose={handleCloseGraphModal}
        onToggleChange={handleToggleGraphChange}
        onSelectAll={handleSelectAllGraphChanges}
        onSelectNone={handleSelectNoGraphChanges}
        onApply={handleApplyGraphChanges}
      />
    </div>
  );
}

export default IdeationSession;
