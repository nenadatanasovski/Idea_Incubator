// =============================================================================
// FILE: frontend/src/__tests__/ideation/ideationReducer.test.ts
// Tests for the ideation reducer
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  ideationReducer,
  initialState,
} from "../../frontend/src/reducers/ideationReducer";
import type {
  IdeationAction,
  IdeationStore,
} from "../../frontend/src/types/ideation-state";

describe("ideationReducer", () => {
  describe("session actions", () => {
    it("handles SESSION_START", () => {
      const action: IdeationAction = {
        type: "SESSION_START",
        payload: { profileId: "profile-123", entryMode: "have_idea" },
      };
      const state = ideationReducer(initialState, action);

      expect(state.session.profileId).toBe("profile-123");
      expect(state.session.entryMode).toBe("have_idea");
      expect(state.session.status).toBe("loading");
      expect(state.session.error).toBeNull();
    });

    it("handles SESSION_CREATED", () => {
      const startedState: IdeationStore = {
        ...initialState,
        session: { ...initialState.session, status: "loading" },
      };
      const action: IdeationAction = {
        type: "SESSION_CREATED",
        payload: { sessionId: "session-456", greeting: "Hello!" },
      };
      const state = ideationReducer(startedState, action);

      expect(state.session.sessionId).toBe("session-456");
      expect(state.session.status).toBe("active");
    });

    it("handles SESSION_ERROR", () => {
      const action: IdeationAction = {
        type: "SESSION_ERROR",
        payload: { error: "Connection failed" },
      };
      const state = ideationReducer(initialState, action);

      expect(state.session.status).toBe("error");
      expect(state.session.error).toBe("Connection failed");
    });

    it("handles SESSION_COMPLETE", () => {
      const activeState: IdeationStore = {
        ...initialState,
        session: { ...initialState.session, status: "active" },
      };
      const action: IdeationAction = {
        type: "SESSION_COMPLETE",
        payload: { ideaId: "idea-789" },
      };
      const state = ideationReducer(activeState, action);

      expect(state.session.status).toBe("completed");
    });

    it("handles SESSION_ABANDON", () => {
      const activeState: IdeationStore = {
        ...initialState,
        session: { ...initialState.session, status: "active" },
      };
      const action: IdeationAction = { type: "SESSION_ABANDON" };
      const state = ideationReducer(activeState, action);

      expect(state.session.status).toBe("abandoned");
    });
  });

  describe("message actions", () => {
    it("handles MESSAGE_SEND", () => {
      const action: IdeationAction = {
        type: "MESSAGE_SEND",
        payload: { content: "Hello" },
      };
      const state = ideationReducer(initialState, action);

      expect(state.conversation.isLoading).toBe(true);
      expect(state.conversation.error).toBeNull();
    });

    it("handles MESSAGE_STREAM_START", () => {
      const action: IdeationAction = { type: "MESSAGE_STREAM_START" };
      const state = ideationReducer(initialState, action);

      expect(state.conversation.isStreaming).toBe(true);
      expect(state.conversation.streamingContent).toBe("");
    });

    it("handles MESSAGE_STREAM_CHUNK", () => {
      const streamingState: IdeationStore = {
        ...initialState,
        conversation: {
          ...initialState.conversation,
          isStreaming: true,
          streamingContent: "Hello",
        },
      };
      const action: IdeationAction = {
        type: "MESSAGE_STREAM_CHUNK",
        payload: { chunk: " World" },
      };
      const state = ideationReducer(streamingState, action);

      expect(state.conversation.streamingContent).toBe("Hello World");
    });

    it("handles MESSAGE_STREAM_END", () => {
      const streamingState: IdeationStore = {
        ...initialState,
        conversation: {
          ...initialState.conversation,
          isLoading: true,
          isStreaming: true,
        },
      };
      const message = {
        id: "msg-1",
        sessionId: "session-1",
        role: "assistant" as const,
        content: "Hello World",
        buttons: null,
        form: null,
        createdAt: new Date().toISOString(),
      };
      const action: IdeationAction = {
        type: "MESSAGE_STREAM_END",
        payload: { message },
      };
      const state = ideationReducer(streamingState, action);

      expect(state.conversation.isLoading).toBe(false);
      expect(state.conversation.isStreaming).toBe(false);
      expect(state.conversation.streamingContent).toBe("");
      expect(state.conversation.messages).toHaveLength(1);
      expect(state.conversation.messages[0].content).toBe("Hello World");
    });

    it("handles MESSAGE_RECEIVED", () => {
      const message = {
        id: "msg-2",
        sessionId: "session-1",
        role: "user" as const,
        content: "My message",
        buttons: null,
        form: null,
        createdAt: new Date().toISOString(),
      };
      const action: IdeationAction = {
        type: "MESSAGE_RECEIVED",
        payload: { message },
      };
      const state = ideationReducer(initialState, action);

      expect(state.conversation.messages).toHaveLength(1);
      expect(state.conversation.messages[0].role).toBe("user");
    });

    it("handles MESSAGE_ERROR", () => {
      const loadingState: IdeationStore = {
        ...initialState,
        conversation: { ...initialState.conversation, isLoading: true },
      };
      const action: IdeationAction = {
        type: "MESSAGE_ERROR",
        payload: { error: "Failed to send" },
      };
      const state = ideationReducer(loadingState, action);

      expect(state.conversation.isLoading).toBe(false);
      expect(state.conversation.isStreaming).toBe(false);
      expect(state.conversation.error).toBe("Failed to send");
    });
  });

  describe("candidate actions", () => {
    it("handles CANDIDATE_UPDATE", () => {
      const candidate = {
        id: "cand-1",
        sessionId: "session-1",
        title: "My Idea",
        summary: "A great idea",
        confidence: 75,
        viability: 80,
        userSuggested: false,
        status: "active" as const,
        capturedIdeaId: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const action: IdeationAction = {
        type: "CANDIDATE_UPDATE",
        payload: { candidate },
      };
      const state = ideationReducer(initialState, action);

      expect(state.candidate.candidate).toEqual(candidate);
    });

    it("handles CANDIDATE_CLEAR", () => {
      const stateWithCandidate: IdeationStore = {
        ...initialState,
        candidate: {
          ...initialState.candidate,
          candidate: {
            id: "cand-1",
            sessionId: "session-1",
            title: "My Idea",
            summary: null,
            confidence: 0,
            viability: 100,
            userSuggested: false,
            status: "active" as const,
            capturedIdeaId: null,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          risks: [],
        },
      };
      const action: IdeationAction = { type: "CANDIDATE_CLEAR" };
      const state = ideationReducer(stateWithCandidate, action);

      expect(state.candidate.candidate).toBeNull();
      expect(state.candidate.risks).toEqual([]);
    });
  });

  describe("intervention actions", () => {
    it("handles INTERVENTION_SHOW", () => {
      const action: IdeationAction = {
        type: "INTERVENTION_SHOW",
        payload: { type: "warning" },
      };
      const state = ideationReducer(initialState, action);

      expect(state.candidate.showIntervention).toBe(true);
      expect(state.candidate.interventionType).toBe("warning");
    });

    it("handles INTERVENTION_DISMISS", () => {
      const interventionState: IdeationStore = {
        ...initialState,
        candidate: {
          ...initialState.candidate,
          showIntervention: true,
          interventionType: "critical",
        },
      };
      const action: IdeationAction = { type: "INTERVENTION_DISMISS" };
      const state = ideationReducer(interventionState, action);

      expect(state.candidate.showIntervention).toBe(false);
      expect(state.candidate.interventionType).toBeNull();
    });
  });

  describe("token actions", () => {
    it("handles TOKEN_UPDATE", () => {
      const usage = {
        total: 50000,
        limit: 100000,
        percentUsed: 50,
        shouldHandoff: false,
      };
      const action: IdeationAction = {
        type: "TOKEN_UPDATE",
        payload: { usage },
      };
      const state = ideationReducer(initialState, action);

      expect(state.tokens.usage).toEqual(usage);
    });

    it("handles HANDOFF_PENDING", () => {
      const action: IdeationAction = { type: "HANDOFF_PENDING" };
      const state = ideationReducer(initialState, action);

      expect(state.tokens.handoffPending).toBe(true);
    });

    it("handles HANDOFF_COMPLETE", () => {
      const pendingState: IdeationStore = {
        ...initialState,
        tokens: {
          ...initialState.tokens,
          handoffPending: true,
          handoffCount: 0,
        },
      };
      const action: IdeationAction = { type: "HANDOFF_COMPLETE" };
      const state = ideationReducer(pendingState, action);

      expect(state.tokens.handoffPending).toBe(false);
      expect(state.tokens.handoffCount).toBe(1);
    });
  });

  describe("button click behavior", () => {
    it("marks button as clicked in last assistant message", () => {
      const stateWithMessages: IdeationStore = {
        ...initialState,
        conversation: {
          ...initialState.conversation,
          messages: [
            {
              id: "msg-1",
              sessionId: "session-1",
              role: "assistant",
              content: "Choose an option:",
              buttons: [
                {
                  id: "btn-1",
                  label: "Option A",
                  value: "a",
                  style: "primary",
                },
                {
                  id: "btn-2",
                  label: "Option B",
                  value: "b",
                  style: "secondary",
                },
              ],
              form: null,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      };
      const action: IdeationAction = {
        type: "BUTTON_CLICK",
        payload: { buttonId: "btn-1", buttonValue: "a" },
      };
      const state = ideationReducer(stateWithMessages, action);

      expect(state.conversation.isLoading).toBe(true);
      expect(state.conversation.messages[0].buttonClicked).toBe("btn-1");
    });
  });
});
