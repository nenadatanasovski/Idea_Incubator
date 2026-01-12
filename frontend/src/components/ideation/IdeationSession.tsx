// =============================================================================
// FILE: frontend/src/components/ideation/IdeationSession.tsx
// Main container for an ideation session
// =============================================================================

import { useEffect, useReducer, useCallback, useRef, useState } from 'react';
import { SessionHeader } from './SessionHeader';
import { ConversationPanel } from './ConversationPanel';
import { IdeaArtifactPanel } from './IdeaArtifactPanel';
import { IdeaTypeModal, type IdeaTypeValue } from './IdeaTypeModal';
import { useIdeationAPI } from '../../hooks/useIdeationAPI';
import { ideationReducer, initialState } from '../../reducers/ideationReducer';
import type { IdeationSessionProps, Artifact } from '../../types/ideation';

// Generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function IdeationSession({
  sessionId: initialSessionId,
  profileId,
  entryMode,
  isResuming = false,
  onComplete,
  onExit,
}: IdeationSessionProps) {
  const [state, dispatch] = useReducer(ideationReducer, initialState);
  const api = useIdeationAPI();
  const initRef = useRef(false);
  const buttonClickInProgressRef = useRef(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showIdeaTypeModal, setShowIdeaTypeModal] = useState(false);

  // Initialize or resume session (with guard against React 18 Strict Mode double-invoke)
  useEffect(() => {
    if (initRef.current) return;

    initRef.current = true;

    async function initSession() {
      dispatch({ type: 'SESSION_START', payload: { profileId, entryMode } });

      try {
        const result = await api.startSession(profileId, entryMode);
        dispatch({
          type: 'SESSION_CREATED',
          payload: { sessionId: result.sessionId, greeting: result.greeting },
        });

        // Add greeting message
        dispatch({
          type: 'MESSAGE_RECEIVED',
          payload: {
            message: {
              id: generateMessageId(),
              sessionId: result.sessionId,
              role: 'assistant',
              content: result.greeting,
              buttons: result.buttons || null,
              form: null,
              createdAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to start session' },
        });
      }
    }

    async function resumeSession() {
      dispatch({ type: 'SESSION_START', payload: { profileId, entryMode: null } });

      try {
        const sessionData = await api.loadSession(initialSessionId);

        dispatch({
          type: 'SESSION_CREATED',
          payload: { sessionId: initialSessionId, greeting: '' },
        });

        // Add all existing messages
        for (const msg of sessionData.messages) {
          dispatch({
            type: 'MESSAGE_RECEIVED',
            payload: {
              message: {
                id: msg.id || generateMessageId(),
                sessionId: initialSessionId,
                role: msg.role,
                content: msg.content,
                buttons: (msg.buttonsShown as import('../../types').ButtonOption[]) || null,
                form: (msg.formShown as import('../../types').FormDefinition) || null,
                createdAt: msg.createdAt,
              },
            },
          });
        }

        // Update candidate if present
        if (sessionData.candidate) {
          dispatch({
            type: 'CANDIDATE_UPDATE',
            payload: {
              candidate: {
                id: sessionData.candidate.id,
                sessionId: initialSessionId,
                title: sessionData.candidate.title,
                summary: sessionData.candidate.summary,
                confidence: sessionData.candidate.confidence,
                viability: sessionData.candidate.viability,
                userSuggested: false,
                status: 'forming' as const,
                capturedIdeaId: null,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          });
          dispatch({
            type: 'CONFIDENCE_UPDATE',
            payload: { confidence: sessionData.candidate.confidence },
          });
          dispatch({
            type: 'VIABILITY_UPDATE',
            payload: {
              viability: sessionData.candidate.viability,
              risks: [],
            },
          });
        }

        // Restore artifacts if present
        console.log('[Session Resume] Artifacts from API:', sessionData.artifacts);
        if (sessionData.artifacts && sessionData.artifacts.length > 0) {
          console.log('[Session Resume] Restoring', sessionData.artifacts.length, 'artifacts');
          for (const artifact of sessionData.artifacts) {
            console.log('[Session Resume] Adding artifact:', artifact.id, artifact.type, artifact.title);
            dispatch({
              type: 'ARTIFACT_ADD',
              payload: { artifact },
            });
          }
          // Open artifact panel and select the first artifact
          dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
          dispatch({
            type: 'ARTIFACT_SELECT',
            payload: { artifact: sessionData.artifacts[0] },  // Fixed: pass artifact object, not artifactId
          });
        } else {
          console.log('[Session Resume] No artifacts to restore');
        }

        // Restore sub-agents if present
        console.log('[Session Resume] SubAgents from API:', sessionData.subAgents);
        if (sessionData.subAgents && sessionData.subAgents.length > 0) {
          console.log('[Session Resume] Restoring', sessionData.subAgents.length, 'sub-agents');
          for (const subAgent of sessionData.subAgents) {
            console.log('[Session Resume] Adding sub-agent:', subAgent.id, subAgent.type, subAgent.status);
            // First spawn the agent
            dispatch({
              type: 'SUBAGENT_SPAWN',
              payload: {
                id: subAgent.id,
                type: subAgent.type as import('../../types/ideation').SubAgentType,
                name: subAgent.name,
              },
            });
            // Then update its status if not spawning
            if (subAgent.status !== 'spawning') {
              dispatch({
                type: 'SUBAGENT_STATUS',
                payload: {
                  id: subAgent.id,
                  status: subAgent.status as import('../../types/ideation').SubAgentStatus,
                  error: subAgent.error,
                },
              });
            }
          }
        } else {
          console.log('[Session Resume] No sub-agents to restore');
        }
      } catch (error) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to resume session' },
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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = '3001'; // Backend port
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws?session=${sessionId}`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Expose WebSocket for testing
    (window as unknown as { __IDEATION_WS__: WebSocket | null }).__IDEATION_WS__ = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected to session:', sessionId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WebSocket] Received:', data.type, data);

        switch (data.type) {
          case 'artifact:updating':
            console.log('[WebSocket] Artifact updating:', data.data.artifactId);
            // Set artifact status to 'updating' - shows pulsing indicator in tab
            dispatch({
              type: 'ARTIFACT_UPDATE',
              payload: {
                id: data.data.artifactId,
                updates: { status: 'updating' },
              },
            });
            break;

          case 'artifact:updated':
            console.log('[WebSocket] Artifact updated:', data.data.artifactId);
            if (data.data.content) {
              dispatch({
                type: 'ARTIFACT_UPDATE',
                payload: {
                  id: data.data.artifactId,
                  updates: {
                    content: data.data.content,
                    status: 'ready',
                    updatedAt: new Date().toISOString(),
                  },
                },
              });
              // Open artifact panel to show the update
              dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
              // Select the updated artifact
              const updatedArtifact = state.artifacts.artifacts.find(a => a.id === data.data.artifactId);
              if (updatedArtifact) {
                dispatch({ type: 'ARTIFACT_SELECT', payload: { artifact: { ...updatedArtifact, content: data.data.content, status: 'ready' } } });
              }
              // Update the "Updating artifact..." message to show completion
              if (data.data.messageId) {
                dispatch({
                  type: 'MESSAGE_CONTENT_UPDATE',
                  payload: {
                    messageId: data.data.messageId,
                    content: `Artifact updated! ${data.data.summary || ''}`,
                  },
                });
              }
            }
            break;

          case 'artifact:error':
            console.error('[WebSocket] Artifact error:', data.data.error);
            // Reset artifact status and show error
            dispatch({
              type: 'ARTIFACT_UPDATE',
              payload: {
                id: data.data.artifactId,
                updates: { status: 'ready' }, // Reset to ready
              },
            });
            setToast({ message: `Failed to update: ${data.data.error}`, type: 'error' });
            setTimeout(() => setToast(null), 5000);
            break;

          case 'connected':
            console.log('[WebSocket] Connection confirmed:', data.data.message);
            break;

          case 'pong':
            // Heartbeat response
            break;

          // Sub-agent events
          case 'subagent:spawn':
            // ROBUST: Always dispatch spawn - reducer handles idempotency and updates name/type
            // This ensures agent exists even if HTTP response was slow
            console.log('[WebSocket] Sub-agent spawn:', data.data.subAgentId, data.data.subAgentName);
            dispatch({
              type: 'SUBAGENT_SPAWN',
              payload: {
                id: data.data.subAgentId,
                type: data.data.subAgentType,
                name: data.data.subAgentName,
              },
            });
            break;

          case 'subagent:status':
            console.log('[WebSocket] Sub-agent status:', data.data.subAgentId, data.data.subAgentStatus);
            dispatch({
              type: 'SUBAGENT_STATUS',
              payload: {
                id: data.data.subAgentId,
                status: data.data.subAgentStatus,
                error: data.data.error,
              },
            });
            break;

          case 'subagent:result':
            console.log('[WebSocket] Sub-agent result:', data.data.subAgentId);
            dispatch({
              type: 'SUBAGENT_RESULT',
              payload: {
                id: data.data.subAgentId,
                result: data.data.result,
              },
            });
            break;

          case 'artifact:created':
            console.log('[WebSocket] Artifact created:', data.data.id);
            // Check if event is scoped to current linked idea (if applicable)
            if (data.data.ideaSlug && state.artifacts.linkedIdea) {
              if (data.data.ideaSlug !== state.artifacts.linkedIdea.ideaSlug) {
                console.log('[WebSocket] Ignoring artifact:created for different idea');
                break;
              }
            }
            if (data.data.content) {
              dispatch({
                type: 'ARTIFACT_ADD',
                payload: {
                  artifact: {
                    id: data.data.id,
                    type: data.data.type || 'markdown',
                    title: data.data.title || 'Sub-agent Result',
                    content: data.data.content,
                    status: 'ready',
                    createdAt: data.data.createdAt || new Date().toISOString(),
                  },
                },
              });
              // Open artifact panel to show the new artifact
              dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
            }
            break;

          case 'artifact:deleted':
            console.log('[WebSocket] Artifact deleted:', data.data.artifactId);
            // Check if event is scoped to current linked idea (if applicable)
            if (data.data.ideaSlug && state.artifacts.linkedIdea) {
              if (data.data.ideaSlug !== state.artifacts.linkedIdea.ideaSlug) {
                console.log('[WebSocket] Ignoring artifact:deleted for different idea');
                break;
              }
            }
            dispatch({
              type: 'ARTIFACT_REMOVE',
              payload: {
                id: data.data.artifactId,
              },
            });
            break;

          case 'classifications:updated':
            console.log('[WebSocket] Classifications updated:', data.data.ideaSlug);
            // Only update if classifications are for current linked idea
            if (data.data.ideaSlug && state.artifacts.linkedIdea) {
              if (data.data.ideaSlug !== state.artifacts.linkedIdea.ideaSlug) {
                console.log('[WebSocket] Ignoring classifications:updated for different idea');
                break;
              }
            }
            if (data.data.classifications) {
              dispatch({
                type: 'SET_ARTIFACT_CLASSIFICATIONS',
                payload: {
                  classifications: data.data.classifications,
                },
              });
            }
            break;

          default:
            console.log('[WebSocket] Unknown event type:', data.type);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    // Reconnection logic (WSK-004)
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 1000;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let mounted = true;

    ws.onclose = () => {
      console.log('[WebSocket] Connection closed');
      if (!mounted) return;

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), 30000);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
        reconnectTimeout = setTimeout(() => {
          if (!mounted) return;
          reconnectAttempts++;
          const newWs = new WebSocket(wsUrl);
          wsRef.current = newWs;
          (window as unknown as { __IDEATION_WS__: WebSocket | null }).__IDEATION_WS__ = newWs;
          // Copy event handlers to new WebSocket
          newWs.onopen = ws.onopen;
          newWs.onmessage = ws.onmessage;
          newWs.onerror = ws.onerror;
          newWs.onclose = ws.onclose;
        }, delay);
      } else {
        console.error('[WebSocket] Max reconnection attempts reached');
      }
    };

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
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
      (window as unknown as { __IDEATION_WS__: WebSocket | null }).__IDEATION_WS__ = null;
    };
  }, [state.session.sessionId]);

  // Handle stopping generation
  const handleStopGeneration = useCallback(() => {
    console.log('[IdeationSession] Stopping generation');
    // Clear loading and streaming states
    dispatch({ type: 'MESSAGE_STREAM_END', payload: { message: {
      id: generateMessageId(),
      sessionId: state.session.sessionId || '',
      role: 'assistant' as const,
      content: '*(Generation stopped by user)*',
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    }}});
  }, [state.session.sessionId]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'MESSAGE_SEND', payload: { content } });

    // Add user message to conversation with temporary ID
    const tempUserMessageId = generateMessageId();
    const userMessage = {
      id: tempUserMessageId,
      sessionId: state.session.sessionId,
      role: 'user' as const,
      content,
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'MESSAGE_RECEIVED', payload: { message: userMessage } });

    // Start streaming
    dispatch({ type: 'MESSAGE_STREAM_START' });

    try {
      const response = await api.sendMessage(state.session.sessionId, content);

      // Update user message ID with the real ID from the backend
      if (response.userMessageId) {
        dispatch({
          type: 'MESSAGE_UPDATE_ID',
          payload: { oldId: tempUserMessageId, newId: response.userMessageId },
        });
      }

      // Update with response
      dispatch({
        type: 'MESSAGE_STREAM_END',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
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
          type: 'CANDIDATE_UPDATE',
          payload: { candidate: response.candidateUpdate },
        });
      }

      // Update confidence/viability
      if (response.confidence !== undefined) {
        dispatch({
          type: 'CONFIDENCE_UPDATE',
          payload: { confidence: response.confidence },
        });
      }
      if (response.viability !== undefined) {
        dispatch({
          type: 'VIABILITY_UPDATE',
          payload: {
            viability: response.viability,
            risks: response.risks || [],
          },
        });
      }

      // Check for intervention
      if (response.intervention) {
        dispatch({
          type: 'INTERVENTION_SHOW',
          payload: { type: response.intervention.type },
        });
      }

      // Update token usage
      if (response.tokenUsage) {
        dispatch({
          type: 'TOKEN_UPDATE',
          payload: { usage: response.tokenUsage },
        });
      }

      // Handle async web search if queries were returned
      console.log('[Message Response] webSearchQueries:', response.webSearchQueries);
      if (response.webSearchQueries && response.webSearchQueries.length > 0) {
        console.log('[Message Response] Triggering web search with queries:', response.webSearchQueries);
        executeAsyncWebSearch(response.webSearchQueries);
      }

      // Handle artifact if returned (mermaid diagrams, code, etc.)
      if (response.artifact) {
        dispatch({ type: 'ARTIFACT_ADD', payload: { artifact: response.artifact } });
      }

      // Handle artifact update if returned (agent edited an existing artifact)
      if (response.artifactUpdate) {
        dispatch({
          type: 'ARTIFACT_UPDATE',
          payload: {
            id: response.artifactUpdate.id,
            updates: {
              content: response.artifactUpdate.content,
              ...(response.artifactUpdate.title && { title: response.artifactUpdate.title }),
              updatedAt: response.artifactUpdate.updatedAt,
            },
          },
        });
        // Open the artifact panel to show the update
        dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
        setToast({ message: 'Artifact updated!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }

      // Handle quick-ack with sub-agent tasks - spawn sub-agents immediately for UI
      if (response.isQuickAck && response.subAgentTasks && response.subAgentTasks.length > 0) {
        console.log('[Quick-Ack] Spawning', response.subAgentTasks.length, 'sub-agents');
        // Clear old completed sub-agents before spawning new batch
        dispatch({ type: 'SUBAGENT_CLEAR' });
        for (const task of response.subAgentTasks) {
          dispatch({
            type: 'SUBAGENT_SPAWN',
            payload: {
              id: task.id,
              type: task.type,
              name: task.label,
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: errorMessage },
      });

      // If session is not active, treat as session-level error to show full error screen
      if (errorMessage.toLowerCase().includes('session is not active') ||
          errorMessage.toLowerCase().includes('session expired')) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: 'Your session has expired. Please start a new session.' },
        });
      }
    }
  }, [state.session.sessionId, api]);

  // Execute async web search and add results as artifact
  const executeAsyncWebSearch = useCallback(async (queries: string[]) => {
    console.log('[WebSearch] executeAsyncWebSearch called with queries:', queries);
    console.log('[WebSearch] Current sessionId:', state.session.sessionId);
    if (!state.session.sessionId) {
      console.log('[WebSearch] No sessionId, returning early');
      return;
    }

    // Create a pending artifact to show loading state
    const pendingArtifactId = `research_${Date.now()}`;
    const pendingArtifact: Artifact = {
      id: pendingArtifactId,
      type: 'research',
      title: `Researching: ${queries[0]?.slice(0, 25)}...`,
      content: [],
      queries,
      status: 'loading',
      createdAt: new Date().toISOString(),
      identifier: `research_${queries[0]?.slice(0, 20).replace(/\s+/g, '_').toLowerCase() || 'results'}`,
    };

    console.log('[WebSearch] Adding pending artifact:', pendingArtifactId);
    dispatch({ type: 'ARTIFACT_ADD', payload: { artifact: pendingArtifact } });

    try {
      console.log('[WebSearch] Calling API...');
      const resultArtifact = await api.executeWebSearch(
        state.session.sessionId,
        queries,
        state.candidate.candidate?.title
      );
      console.log('[WebSearch] API returned artifact:', resultArtifact.id, resultArtifact.title);

      // Update the artifact with results
      console.log('[WebSearch] Updating artifact with results');
      dispatch({
        type: 'ARTIFACT_UPDATE',
        payload: {
          id: pendingArtifactId,
          updates: {
            ...resultArtifact,
            id: pendingArtifactId, // Keep the original ID
            status: 'ready',
          },
        },
      });
      console.log('[WebSearch] Artifact update dispatched');
    } catch (error) {
      console.error('[WebSearch] Error:', error);
      dispatch({
        type: 'ARTIFACT_LOADING_END',
        payload: {
          id: pendingArtifactId,
          error: error instanceof Error ? error.message : 'Web search failed',
        },
      });
    }
  }, [state.session.sessionId, state.candidate.candidate?.title, api]);

  // Handle artifact selection
  const handleSelectArtifact = useCallback((artifact: Artifact) => {
    console.log('[IdeationSession] handleSelectArtifact called');
    console.log('[IdeationSession] Artifact to select:', artifact.id, artifact.title);
    console.log('[IdeationSession] Current artifact before dispatch:', state.artifacts.currentArtifact?.id);
    dispatch({ type: 'ARTIFACT_SELECT', payload: { artifact } });
  }, [state.artifacts.currentArtifact?.id]);

  // Handle close artifact panel (minimize)
  const handleCloseArtifact = useCallback(() => {
    dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: false } });
  }, []);

  // Handle expand artifact panel
  const handleExpandArtifact = useCallback(() => {
    dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
  }, []);

  // Handle deleting an artifact
  const handleDeleteArtifact = useCallback(async (artifactId: string) => {
    if (!state.session.sessionId) return;

    try {
      await api.deleteArtifact(state.session.sessionId, artifactId);
      dispatch({ type: 'ARTIFACT_REMOVE', payload: { id: artifactId } });
      setToast({ message: 'Artifact deleted', type: 'success' });
    } catch (error) {
      console.error('[DeleteArtifact] Failed:', error);
      setToast({ message: 'Failed to delete artifact', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  }, [state.session.sessionId, api]);

  // Handle editing an artifact manually
  // Note: content is optional - if not provided, this is just an edit button click
  // which we ignore since inline editing is not yet implemented in IdeaArtifactPanel
  const handleEditArtifact = useCallback(async (artifactId: string, content?: string) => {
    console.log('[handleEditArtifact] Called with artifactId:', artifactId);

    // If no content provided, this is just an edit button click - return early
    // Inline editing is handled by the component's own state, not this callback
    if (content === undefined) {
      console.log('[handleEditArtifact] No content provided - edit mode not yet implemented');
      return;
    }

    console.log('[handleEditArtifact] Content length:', content.length);

    if (!state.session.sessionId) return;

    const artifact = state.artifacts.artifacts.find(a => a.id === artifactId);
    if (!artifact) {
      setToast({ message: 'Artifact not found', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      console.log('[handleEditArtifact] Calling api.saveArtifact...');
      await api.saveArtifact(state.session.sessionId, {
        id: artifactId,
        type: artifact.type,
        title: artifact.title,
        content,
        language: artifact.language,
        identifier: artifact.identifier,
      });
      console.log('[handleEditArtifact] API save successful');

      // Update local state
      console.log('[handleEditArtifact] Dispatching ARTIFACT_UPDATE with content length:', content.length);
      dispatch({
        type: 'ARTIFACT_UPDATE',
        payload: {
          id: artifactId,
          updates: {
            content,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      console.log('[handleEditArtifact] Dispatch complete');
      setToast({ message: 'Artifact saved', type: 'success' });
    } catch (error) {
      console.error('[EditArtifact] Failed:', error);
      setToast({ message: 'Failed to save artifact', type: 'error' });
      throw error; // Re-throw so the panel knows the save failed
    }
    setTimeout(() => setToast(null), 3000);
  }, [state.session.sessionId, state.artifacts.artifacts, api]);

  // Handle renaming an artifact
  const handleRenameArtifact = useCallback(async (artifactId: string, newTitle: string) => {
    if (!state.session.sessionId) return;

    const artifact = state.artifacts.artifacts.find(a => a.id === artifactId);
    if (!artifact) {
      setToast({ message: 'Artifact not found', type: 'error' });
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
        type: 'ARTIFACT_UPDATE',
        payload: {
          id: artifactId,
          updates: {
            title: newTitle,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      setToast({ message: 'Artifact renamed', type: 'success' });
    } catch (error) {
      console.error('[RenameArtifact] Failed:', error);
      setToast({ message: 'Failed to rename artifact', type: 'error' });
      throw error;
    }
    setTimeout(() => setToast(null), 3000);
  }, [state.session.sessionId, state.artifacts.artifacts, api]);

  // Handle artifact click from message (when user clicks @artifact:id reference)
  const handleArtifactClick = useCallback((artifactId: string) => {
    const artifact = state.artifacts.artifacts.find(a => a.id === artifactId);
    if (artifact) {
      dispatch({ type: 'ARTIFACT_SELECT', payload: { artifact } });
      dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
    } else {
      // Try partial match (in case reference is truncated)
      const partialMatch = state.artifacts.artifacts.find(a => a.id.startsWith(artifactId));
      if (partialMatch) {
        dispatch({ type: 'ARTIFACT_SELECT', payload: { artifact: partialMatch } });
        dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
      } else {
        setToast({ message: `Artifact "${artifactId}" not found`, type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    }
  }, [state.artifacts.artifacts]);

  // Handle converting a message to an artifact
  const handleConvertToArtifact = useCallback(async (content: string, title?: string) => {
    if (!state.session.sessionId) return;

    const artifactId = `text_${Date.now()}`;
    const newArtifact: Artifact = {
      id: artifactId,
      type: 'markdown',
      title: title || 'Converted Message',
      content,
      status: 'ready',
      createdAt: new Date().toISOString(),
      identifier: `msg_${artifactId.slice(-8)}`,
    };

    // Save to database FIRST for persistence (so agent can reference it)
    try {
      console.log('[SaveArtifact] Saving artifact to DB:', artifactId);
      await api.saveArtifact(state.session.sessionId, {
        id: artifactId,
        type: 'markdown',
        title: title || 'Converted Message',
        content,
        identifier: `msg_${artifactId.slice(-8)}`,
      });
      console.log('[SaveArtifact] Artifact saved successfully:', artifactId);

      // Only add to UI after successful save
      dispatch({ type: 'ARTIFACT_ADD', payload: { artifact: newArtifact } });
      dispatch({ type: 'ARTIFACT_SELECT', payload: { artifact: newArtifact } });
      dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
      setToast({ message: `Saved as artifact! ID: ${artifactId}`, type: 'success' });
    } catch (error) {
      console.error('[SaveArtifact] Failed to save artifact:', error);
      setToast({ message: 'Failed to save artifact - try again', type: 'error' });
    }
    setTimeout(() => setToast(null), 3000);
  }, [state.session.sessionId, api]);

  // Handle button clicks
  const handleButtonClick = useCallback(async (buttonId: string, buttonValue: string, buttonLabel: string) => {
    if (!state.session.sessionId) return;
    // Prevent double clicks - use ref for synchronous check
    if (buttonClickInProgressRef.current || state.conversation.isLoading) return;
    buttonClickInProgressRef.current = true;

    dispatch({ type: 'BUTTON_CLICK', payload: { buttonId, buttonValue } });

    // Add user's selection as a message in the conversation (use label for display)
    const tempUserMessageId = generateMessageId();
    const userMessage = {
      id: tempUserMessageId,
      sessionId: state.session.sessionId,
      role: 'user' as const,
      content: buttonLabel,
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'MESSAGE_RECEIVED', payload: { message: userMessage } });

    try {
      const response = await api.clickButton(state.session.sessionId, buttonId, buttonValue, buttonLabel);

      // Update user message ID with the real ID from the backend
      if (response.userMessageId) {
        dispatch({
          type: 'MESSAGE_UPDATE_ID',
          payload: { oldId: tempUserMessageId, newId: response.userMessageId },
        });
      }

      dispatch({
        type: 'MESSAGE_RECEIVED',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Update metrics if present
      if (response.confidence !== undefined) {
        dispatch({ type: 'CONFIDENCE_UPDATE', payload: { confidence: response.confidence } });
      }
      if (response.viability !== undefined) {
        dispatch({ type: 'VIABILITY_UPDATE', payload: { viability: response.viability, risks: response.risks || [] } });
      }
      if (response.candidateUpdate) {
        dispatch({ type: 'CANDIDATE_UPDATE', payload: { candidate: response.candidateUpdate } });
      }
      // Update token usage
      if (response.tokenUsage) {
        dispatch({
          type: 'TOKEN_UPDATE',
          payload: { usage: response.tokenUsage },
        });
      }

      // Handle async web search if queries were returned
      console.log('[Button Response] webSearchQueries:', response.webSearchQueries);
      if (response.webSearchQueries && response.webSearchQueries.length > 0) {
        console.log('[Button Response] Triggering web search with queries:', response.webSearchQueries);
        executeAsyncWebSearch(response.webSearchQueries);
      }

      // Handle quick-ack with sub-agent tasks - spawn sub-agents immediately for UI
      // Same as handleSendMessage - spawns from API response for immediate feedback
      if (response.isQuickAck && response.subAgentTasks && response.subAgentTasks.length > 0) {
        console.log('[Quick-Ack/Button] Spawning', response.subAgentTasks.length, 'sub-agents');
        // Clear old completed sub-agents before spawning new batch
        dispatch({ type: 'SUBAGENT_CLEAR' });
        for (const task of response.subAgentTasks) {
          dispatch({
            type: 'SUBAGENT_SPAWN',
            payload: {
              id: task.id,
              type: task.type,
              name: task.label,
            },
          });
        }
      }
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to process button click' },
      });
    } finally {
      buttonClickInProgressRef.current = false;
    }
  }, [state.session.sessionId, api, executeAsyncWebSearch]);

  // Handle form submissions
  const handleFormSubmit = useCallback(async (formId: string, answers: Record<string, unknown>) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'FORM_SUBMIT', payload: { formId, answers } });

    try {
      const response = await api.submitForm(state.session.sessionId, formId, answers);

      dispatch({
        type: 'MESSAGE_RECEIVED',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to submit form' },
      });
    }
  }, [state.session.sessionId, api]);

  // Handle message editing
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!state.session.sessionId) return;

    // Truncate messages from the edited message onwards in local state
    dispatch({ type: 'MESSAGES_TRUNCATE', payload: { messageId } });
    dispatch({ type: 'MESSAGE_SEND', payload: { content: newContent } });

    // Add the new user message to conversation with temporary ID
    const tempUserMessageId = generateMessageId();
    const userMessage = {
      id: tempUserMessageId,
      sessionId: state.session.sessionId,
      role: 'user' as const,
      content: newContent,
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'MESSAGE_RECEIVED', payload: { message: userMessage } });

    // Start streaming
    dispatch({ type: 'MESSAGE_STREAM_START' });

    try {
      const response = await api.editMessage(state.session.sessionId, messageId, newContent);

      // Update user message ID with the real ID from the backend
      if (response.userMessageId) {
        dispatch({
          type: 'MESSAGE_UPDATE_ID',
          payload: { oldId: tempUserMessageId, newId: response.userMessageId },
        });
      }

      // Update with response
      dispatch({
        type: 'MESSAGE_STREAM_END',
        payload: {
          message: {
            id: response.messageId || generateMessageId(),
            sessionId: state.session.sessionId,
            role: 'assistant',
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
          type: 'CANDIDATE_UPDATE',
          payload: { candidate: response.candidateUpdate },
        });
      }

      // Update confidence/viability
      if (response.confidence !== undefined) {
        dispatch({
          type: 'CONFIDENCE_UPDATE',
          payload: { confidence: response.confidence },
        });
      }
      if (response.viability !== undefined) {
        dispatch({
          type: 'VIABILITY_UPDATE',
          payload: {
            viability: response.viability,
            risks: response.risks || [],
          },
        });
      }

      // Update token usage
      if (response.tokenUsage) {
        dispatch({
          type: 'TOKEN_UPDATE',
          payload: { usage: response.tokenUsage },
        });
      }

      // Handle artifact if returned (mermaid diagrams, code, etc.)
      if (response.artifact) {
        dispatch({ type: 'ARTIFACT_ADD', payload: { artifact: response.artifact } });
      }

      // Handle artifact update if returned (agent edited an existing artifact)
      if (response.artifactUpdate) {
        dispatch({
          type: 'ARTIFACT_UPDATE',
          payload: {
            id: response.artifactUpdate.id,
            updates: {
              content: response.artifactUpdate.content,
              ...(response.artifactUpdate.title && { title: response.artifactUpdate.title }),
              updatedAt: response.artifactUpdate.updatedAt,
            },
          },
        });
        // Open the artifact panel to show the update
        dispatch({ type: 'ARTIFACT_PANEL_TOGGLE', payload: { isOpen: true } });
        setToast({ message: 'Artifact updated!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      }

      // Handle async web search if queries were returned
      if (response.webSearchQueries && response.webSearchQueries.length > 0) {
        executeAsyncWebSearch(response.webSearchQueries);
      }

      // Handle quick-ack with sub-agent tasks - spawn sub-agents immediately for UI
      if (response.isQuickAck && response.subAgentTasks && response.subAgentTasks.length > 0) {
        console.log('[Quick-Ack/Edit] Spawning', response.subAgentTasks.length, 'sub-agents');
        // Clear old completed sub-agents before spawning new batch
        dispatch({ type: 'SUBAGENT_CLEAR' });
        for (const task of response.subAgentTasks) {
          dispatch({
            type: 'SUBAGENT_SPAWN',
            payload: {
              id: task.id,
              type: task.type,
              name: task.label,
            },
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: errorMessage },
      });
    }
  }, [state.session.sessionId, api, executeAsyncWebSearch]);

  // Handle capture
  const handleCapture = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      const result = await api.captureIdea(state.session.sessionId);
      dispatch({ type: 'SESSION_COMPLETE', payload: { ideaId: result.ideaId } });
      // Pass slug for navigation since route is /ideas/:slug
      onComplete(result.ideaSlug);
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to capture idea' },
      });
    }
  }, [state.session.sessionId, api, onComplete]);

  // Handle save for later
  const handleSave = useCallback(async () => {
    console.log('[handleSave] Called, sessionId:', state.session.sessionId);
    if (!state.session.sessionId) {
      console.log('[handleSave] No session ID, returning early');
      return;
    }

    try {
      console.log('[handleSave] Calling api.saveForLater...');
      await api.saveForLater(state.session.sessionId);
      console.log('[handleSave] Success! Setting toast...');
      // Show success toast
      setToast({ message: 'Idea saved for later! You can resume this session anytime.', type: 'success' });
      // Auto-hide after 4 seconds
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      console.log('[handleSave] Error:', error);
      setToast({ message: error instanceof Error ? error.message : 'Failed to save idea', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    }
  }, [state.session.sessionId, api]);

  // Handle discard candidate
  const handleDiscard = useCallback(() => {
    dispatch({ type: 'CANDIDATE_CLEAR' });
    dispatch({ type: 'INTERVENTION_DISMISS' });
  }, []);

  // Handle intervention continue
  const handleContinue = useCallback(() => {
    dispatch({ type: 'INTERVENTION_DISMISS' });
  }, []);

  // Handle updating candidate title
  const handleUpdateTitle = useCallback(async (newTitle: string) => {
    if (!state.candidate.candidate || !state.session.sessionId) return;

    try {
      // Update in the backend first
      await api.updateCandidate(state.session.sessionId, { title: newTitle });

      // Then update local state
      dispatch({
        type: 'CANDIDATE_UPDATE',
        payload: {
          candidate: {
            ...state.candidate.candidate,
            title: newTitle,
          },
        },
      });
      setToast({ message: 'Title updated', type: 'success' });
    } catch (error) {
      console.error('Failed to update title:', error);
      setToast({ message: 'Failed to update title', type: 'error' });
    }
    setTimeout(() => setToast(null), 2000);
  }, [state.candidate.candidate, state.session.sessionId, api]);

  // Handle idea selection from IdeaSelector
  const handleSelectIdea = useCallback(async (idea: { userSlug: string; ideaSlug: string } | null) => {
    if (!state.session.sessionId) return;

    try {
      if (idea) {
        // Link the idea to the session via API
        await api.linkIdea(state.session.sessionId, idea.userSlug, idea.ideaSlug);
        // Update local state
        dispatch({
          type: 'SET_LINKED_IDEA',
          payload: idea,
        });
        setToast({ message: `Now working on: ${idea.ideaSlug}`, type: 'success' });
      } else {
        // Unlink the idea
        dispatch({
          type: 'SET_LINKED_IDEA',
          payload: null,
        });
      }
    } catch (error) {
      console.error('Failed to link idea:', error);
      setToast({ message: 'Failed to link idea', type: 'error' });
    }
    setTimeout(() => setToast(null), 2000);
  }, [state.session.sessionId, api]);

  // Handle opening new idea modal
  const handleNewIdea = useCallback(() => {
    setShowIdeaTypeModal(true);
  }, []);

  // Handle creating a new idea
  const handleCreateIdea = useCallback(async (data: {
    name: string;
    ideaType: IdeaTypeValue;
    parent?: {
      type: 'internal' | 'external';
      slug?: string;
      name?: string;
    };
  }) => {
    if (!state.session.sessionId) {
      setToast({ message: 'No active session', type: 'error' });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    try {
      // Call API to name/create the idea
      const response = await fetch(`/api/ideation/session/${state.session.sessionId}/name-idea`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: data.name,
          ideaType: data.ideaType,
          parent: data.parent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create idea');
      }

      const result = await response.json();

      // Update state with the new linked idea
      if (result.success && result.session) {
        dispatch({
          type: 'SET_LINKED_IDEA',
          payload: {
            userSlug: result.session.userSlug,
            ideaSlug: result.session.ideaSlug,
          },
        });
        setToast({ message: `Created: ${data.name}`, type: 'success' });
      }

      setShowIdeaTypeModal(false);
    } catch (error) {
      console.error('Failed to create idea:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to create idea',
        type: 'error',
      });
    }
    setTimeout(() => setToast(null), 2000);
  }, [state.session.sessionId]);

  if (state.session.status === 'error') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
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

  if (state.session.status === 'loading') {
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
        sessionId={state.session.sessionId || ''}
        tokenUsage={state.tokens.usage}
        candidate={state.candidate.candidate}
        confidence={state.candidate.confidence}
        viability={state.candidate.viability}
        onCapture={handleCapture}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onMinimize={onExit}
        onUpdateTitle={handleUpdateTitle}
        userSlug={profileId}
        linkedIdea={state.artifacts.linkedIdea}
        onSelectIdea={handleSelectIdea}
        onNewIdea={handleNewIdea}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Conversation Panel - Main content */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          <ConversationPanel
            messages={state.conversation.messages}
            isLoading={state.conversation.isLoading}
            streamingContent={state.conversation.streamingContent}
            error={state.conversation.error}
            subAgents={state.subAgents.subAgents}
            onSendMessage={handleSendMessage}
            onStopGeneration={handleStopGeneration}
            onButtonClick={handleButtonClick}
            onFormSubmit={handleFormSubmit}
            onEditMessage={handleEditMessage}
            onArtifactClick={handleArtifactClick}
            onConvertToArtifact={handleConvertToArtifact}
          />
        </div>

        {/* Combined Idea & Artifact Panel - Right side */}
        <IdeaArtifactPanel
          candidate={state.candidate.candidate}
          confidence={state.candidate.confidence}
          viability={state.candidate.viability}
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
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          data-testid={toast.type === 'error' ? 'error-toast' : 'toast-notification'}
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-all ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 hover:opacity-80 rounded focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
    </div>
  );
}

export default IdeationSession;
