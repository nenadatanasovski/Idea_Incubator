// =============================================================================
// FILE: tests/frontend/ideation-integration.test.ts
// Integration tests for the Ideation Agent frontend components
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  ideationReducer,
  initialState,
} from "../../frontend/src/reducers/ideationReducer";
import type {
  IdeationStore,
} from "../../frontend/src/types/ideation-state";
import type { IdeaCandidate, ViabilityRisk } from "../../frontend/src/types";

// =============================================================================
// INTEGRATION TEST: Full Session Flow
// =============================================================================

describe("Ideation Integration: Full Session Flow", () => {
  describe("Happy Path: Discovery Mode", () => {
    it("completes a full session from start to capture", () => {
      let state = initialState;

      // Step 1: Start session
      state = ideationReducer(state, {
        type: "SESSION_START",
        payload: { profileId: "profile-123", entryMode: "discover" },
      });
      expect(state.session.status).toBe("loading");
      expect(state.session.entryMode).toBe("discover");

      // Step 2: Session created with greeting
      state = ideationReducer(state, {
        type: "SESSION_CREATED",
        payload: {
          sessionId: "session-abc",
          greeting: "Let's discover your next idea!",
        },
      });
      expect(state.session.status).toBe("active");
      expect(state.session.sessionId).toBe("session-abc");

      // Step 3: Add greeting message
      state = ideationReducer(state, {
        type: "MESSAGE_RECEIVED",
        payload: {
          message: {
            id: "msg-1",
            sessionId: "session-abc",
            role: "assistant",
            content:
              "Let's discover your next idea! What are you passionate about?",
            buttons: [
              {
                id: "btn-tech",
                label: "Technology",
                value: "tech",
                style: "primary",
              },
              {
                id: "btn-health",
                label: "Health",
                value: "health",
                style: "secondary",
              },
            ],
            form: null,
            createdAt: new Date().toISOString(),
          },
        },
      });
      expect(state.conversation.messages).toHaveLength(1);

      // Step 4: User sends message
      state = ideationReducer(state, {
        type: "MESSAGE_SEND",
        payload: { content: "I'm interested in AI and automation" },
      });
      expect(state.conversation.isLoading).toBe(true);

      // Step 5: User message added
      state = ideationReducer(state, {
        type: "MESSAGE_RECEIVED",
        payload: {
          message: {
            id: "msg-2",
            sessionId: "session-abc",
            role: "user",
            content: "I'm interested in AI and automation",
            buttons: null,
            form: null,
            createdAt: new Date().toISOString(),
          },
        },
      });
      expect(state.conversation.messages).toHaveLength(2);

      // Step 6: Streaming response starts
      state = ideationReducer(state, { type: "MESSAGE_STREAM_START" });
      expect(state.conversation.isStreaming).toBe(true);

      // Step 7: Streaming chunks arrive
      state = ideationReducer(state, {
        type: "MESSAGE_STREAM_CHUNK",
        payload: { chunk: "That's exciting! " },
      });
      state = ideationReducer(state, {
        type: "MESSAGE_STREAM_CHUNK",
        payload: { chunk: "AI is transforming many industries." },
      });
      expect(state.conversation.streamingContent).toBe(
        "That's exciting! AI is transforming many industries.",
      );

      // Step 8: Stream ends with full message
      state = ideationReducer(state, {
        type: "MESSAGE_STREAM_END",
        payload: {
          message: {
            id: "msg-3",
            sessionId: "session-abc",
            role: "assistant",
            content:
              "That's exciting! AI is transforming many industries. What problems have you noticed?",
            buttons: null,
            form: null,
            createdAt: new Date().toISOString(),
          },
        },
      });
      expect(state.conversation.isStreaming).toBe(false);
      expect(state.conversation.isLoading).toBe(false);
      expect(state.conversation.messages).toHaveLength(3);

      // Step 9: Confidence starts to build
      state = ideationReducer(state, {
        type: "CONFIDENCE_UPDATE",
        payload: { confidence: 25 },
      });
      expect(state.candidate.confidence).toBe(25);

      // Step 10: More conversation, candidate emerges
      const candidate: IdeaCandidate = {
        id: "cand-1",
        sessionId: "session-abc",
        title: "AI-Powered Workflow Automation",
        summary: "Automate repetitive business processes using AI",
        confidence: 45,
        viability: 85,
        userSuggested: false,
        status: "forming",
        capturedIdeaId: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state = ideationReducer(state, {
        type: "CANDIDATE_UPDATE",
        payload: { candidate },
      });
      expect(state.candidate.candidate).not.toBeNull();
      expect(state.candidate.candidate?.title).toBe(
        "AI-Powered Workflow Automation",
      );

      // Step 11: Confidence grows to capture-ready
      state = ideationReducer(state, {
        type: "CONFIDENCE_UPDATE",
        payload: { confidence: 75 },
      });
      expect(state.candidate.confidence).toBe(75);

      // Step 12: Session completes with capture
      state = ideationReducer(state, {
        type: "SESSION_COMPLETE",
        payload: { ideaId: "idea-xyz" },
      });
      expect(state.session.status).toBe("completed");
    });
  });

  describe("Happy Path: Have Idea Mode", () => {
    it("validates and captures an existing idea", () => {
      let state = initialState;

      // Start with existing idea
      state = ideationReducer(state, {
        type: "SESSION_START",
        payload: { profileId: "profile-456", entryMode: "have_idea" },
      });
      state = ideationReducer(state, {
        type: "SESSION_CREATED",
        payload: {
          sessionId: "session-def",
          greeting: "Tell me about your idea!",
        },
      });

      // User describes their idea
      state = ideationReducer(state, {
        type: "MESSAGE_RECEIVED",
        payload: {
          message: {
            id: "msg-1",
            sessionId: "session-def",
            role: "user",
            content:
              "I want to build a meal planning app that uses AI to suggest recipes based on what's in your fridge",
            buttons: null,
            form: null,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Candidate forms quickly with high initial confidence
      const candidate: IdeaCandidate = {
        id: "cand-2",
        sessionId: "session-def",
        title: "AI Meal Planning App",
        summary: "Suggests recipes based on fridge contents using AI",
        confidence: 60,
        viability: 75,
        userSuggested: true,
        status: "active",
        capturedIdeaId: null,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state = ideationReducer(state, {
        type: "CANDIDATE_UPDATE",
        payload: { candidate },
      });
      state = ideationReducer(state, {
        type: "CONFIDENCE_UPDATE",
        payload: { confidence: 60 },
      });
      state = ideationReducer(state, {
        type: "VIABILITY_UPDATE",
        payload: { viability: 75, risks: [] },
      });

      expect(state.candidate.candidate?.userSuggested).toBe(true);
      expect(state.candidate.confidence).toBe(60);
      expect(state.candidate.viability).toBe(75);
    });
  });
});

// =============================================================================
// INTEGRATION TEST: Viability Intervention Flow
// =============================================================================

describe("Ideation Integration: Viability Intervention", () => {
  it("triggers intervention when viability drops to warning level", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-warn",
        status: "active",
        entryMode: "discover",
      },
      candidate: {
        ...initialState.candidate,
        candidate: {
          id: "cand-3",
          sessionId: "session-warn",
          title: "Cryptocurrency Exchange",
          summary: "A new crypto exchange",
          confidence: 50,
          viability: 70,
          userSuggested: false,
          status: "active",
          capturedIdeaId: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        confidence: 50,
        viability: 70,
      },
    };

    // Web search finds saturated market
    const risks: ViabilityRisk[] = [
      {
        id: "risk-1",
        candidateId: "cand-3",
        riskType: "saturated_market",
        description: "Over 500 crypto exchanges already exist",
        evidenceUrl: "https://example.com/crypto-exchanges",
        evidenceText: null,
        severity: "high",
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "risk-2",
        candidateId: "cand-3",
        riskType: "too_complex",
        description: "Requires regulatory compliance in multiple jurisdictions",
        evidenceUrl: null,
        evidenceText: null,
        severity: "high",
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date().toISOString(),
      },
    ];

    // Viability drops
    state = ideationReducer(state, {
      type: "VIABILITY_UPDATE",
      payload: { viability: 35, risks },
    });
    expect(state.candidate.viability).toBe(35);
    expect(state.candidate.risks).toHaveLength(2);

    // Intervention triggered
    state = ideationReducer(state, {
      type: "INTERVENTION_SHOW",
      payload: { type: "warning" },
    });
    expect(state.candidate.showIntervention).toBe(true);
    expect(state.candidate.interventionType).toBe("warning");

    // User decides to continue anyway
    state = ideationReducer(state, { type: "INTERVENTION_DISMISS" });
    expect(state.candidate.showIntervention).toBe(false);
    expect(state.candidate.interventionType).toBeNull();
  });

  it("triggers critical intervention when viability drops below 25%", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-crit",
        status: "active",
        entryMode: "have_idea",
      },
      candidate: {
        ...initialState.candidate,
        candidate: {
          id: "cand-4",
          sessionId: "session-crit",
          title: "Teleportation Device",
          summary: "Instant teleportation for humans",
          confidence: 40,
          viability: 50,
          userSuggested: true,
          status: "active",
          capturedIdeaId: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        confidence: 40,
        viability: 50,
      },
    };

    // Web search confirms impossibility
    const risks: ViabilityRisk[] = [
      {
        id: "risk-3",
        candidateId: "cand-4",
        riskType: "impossible",
        description: "Human teleportation violates known physics",
        evidenceUrl: null,
        evidenceText: "Current physics does not support matter teleportation",
        severity: "critical",
        userAcknowledged: false,
        userResponse: null,
        createdAt: new Date().toISOString(),
      },
    ];

    // Viability crashes
    state = ideationReducer(state, {
      type: "VIABILITY_UPDATE",
      payload: { viability: 5, risks },
    });
    expect(state.candidate.viability).toBe(5);

    // Critical intervention
    state = ideationReducer(state, {
      type: "INTERVENTION_SHOW",
      payload: { type: "critical" },
    });
    expect(state.candidate.showIntervention).toBe(true);
    expect(state.candidate.interventionType).toBe("critical");

    // User discards and starts fresh
    state = ideationReducer(state, { type: "CANDIDATE_CLEAR" });
    expect(state.candidate.candidate).toBeNull();
    expect(state.candidate.confidence).toBe(0);
    expect(state.candidate.viability).toBe(100);
  });
});

// =============================================================================
// INTEGRATION TEST: Token Handoff Flow
// =============================================================================

describe("Ideation Integration: Token Handoff", () => {
  it("handles token limit approach and handoff", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-long",
        status: "active",
        entryMode: "discover",
      },
      tokens: {
        usage: {
          total: 50000,
          limit: 100000,
          percentUsed: 50,
          shouldHandoff: false,
        },
        handoffPending: false,
        handoffCount: 0,
      },
    };

    // Token usage grows
    state = ideationReducer(state, {
      type: "TOKEN_UPDATE",
      payload: {
        usage: {
          total: 70000,
          limit: 100000,
          percentUsed: 70,
          shouldHandoff: false,
        },
      },
    });
    expect(state.tokens.usage.percentUsed).toBe(70);

    // Approaching threshold
    state = ideationReducer(state, {
      type: "TOKEN_UPDATE",
      payload: {
        usage: {
          total: 80000,
          limit: 100000,
          percentUsed: 80,
          shouldHandoff: true,
        },
      },
    });
    expect(state.tokens.usage.shouldHandoff).toBe(true);

    // Handoff begins
    state = ideationReducer(state, { type: "HANDOFF_PENDING" });
    expect(state.tokens.handoffPending).toBe(true);

    // Handoff completes (new agent takes over)
    state = ideationReducer(state, { type: "HANDOFF_COMPLETE" });
    expect(state.tokens.handoffPending).toBe(false);
    expect(state.tokens.handoffCount).toBe(1);

    // Token counter resets after handoff
    state = ideationReducer(state, {
      type: "TOKEN_UPDATE",
      payload: {
        usage: {
          total: 5000,
          limit: 100000,
          percentUsed: 5,
          shouldHandoff: false,
        },
      },
    });
    expect(state.tokens.usage.percentUsed).toBe(5);
  });
});

// =============================================================================
// INTEGRATION TEST: Button and Form Interactions
// =============================================================================

describe("Ideation Integration: Interactive Elements", () => {
  it("handles button click flow correctly", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-btn",
        status: "active",
        entryMode: "discover",
      },
      conversation: {
        ...initialState.conversation,
        messages: [
          {
            id: "msg-btn-1",
            sessionId: "session-btn",
            role: "assistant",
            content: "What type of business interests you?",
            buttons: [
              {
                id: "btn-saas",
                label: "SaaS",
                value: "saas",
                style: "primary",
              },
              {
                id: "btn-marketplace",
                label: "Marketplace",
                value: "marketplace",
                style: "secondary",
              },
              {
                id: "btn-service",
                label: "Service",
                value: "service",
                style: "outline",
              },
            ],
            form: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    };

    // User clicks a button
    state = ideationReducer(state, {
      type: "BUTTON_CLICK",
      payload: { buttonId: "btn-saas", buttonValue: "saas" },
    });

    expect(state.conversation.isLoading).toBe(true);
    expect(state.conversation.messages[0].buttonClicked).toBe("btn-saas");
  });

  it("handles form submission flow", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-form",
        status: "active",
        entryMode: "have_idea",
      },
    };

    // Form submit triggers loading
    state = ideationReducer(state, {
      type: "FORM_SUBMIT",
      payload: {
        formId: "form-constraints",
        answers: {
          budget: "10000",
          timeCommitment: "20",
          location: "remote",
        },
      },
    });

    expect(state.conversation.isLoading).toBe(true);
  });
});

// =============================================================================
// INTEGRATION TEST: Error Handling
// =============================================================================

describe("Ideation Integration: Error Handling", () => {
  it("handles session error gracefully", () => {
    let state = initialState;

    state = ideationReducer(state, {
      type: "SESSION_START",
      payload: { profileId: "profile-err", entryMode: "discover" },
    });

    state = ideationReducer(state, {
      type: "SESSION_ERROR",
      payload: { error: "Failed to connect to server" },
    });

    expect(state.session.status).toBe("error");
    expect(state.session.error).toBe("Failed to connect to server");
  });

  it("handles message error and allows retry", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-msg-err",
        status: "active",
        entryMode: "discover",
      },
      conversation: {
        ...initialState.conversation,
        isLoading: true,
        isStreaming: true,
      },
    };

    // Message fails
    state = ideationReducer(state, {
      type: "MESSAGE_ERROR",
      payload: { error: "Network timeout" },
    });

    expect(state.conversation.isLoading).toBe(false);
    expect(state.conversation.isStreaming).toBe(false);
    expect(state.conversation.error).toBe("Network timeout");

    // User retries
    state = ideationReducer(state, {
      type: "MESSAGE_SEND",
      payload: { content: "Retry message" },
    });

    expect(state.conversation.isLoading).toBe(true);
    expect(state.conversation.error).toBeNull();
  });
});

// =============================================================================
// INTEGRATION TEST: Session Lifecycle
// =============================================================================

describe("Ideation Integration: Session Lifecycle", () => {
  it("handles session abandonment correctly", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-abandon",
        status: "active",
        entryMode: "discover",
      },
      candidate: {
        ...initialState.candidate,
        candidate: {
          id: "cand-abandon",
          sessionId: "session-abandon",
          title: "Some Idea",
          summary: null,
          confidence: 30,
          viability: 80,
          userSuggested: false,
          status: "forming",
          capturedIdeaId: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        confidence: 30,
      },
    };

    state = ideationReducer(state, { type: "SESSION_ABANDON" });

    expect(state.session.status).toBe("abandoned");
    // Candidate still exists (for potential recovery)
    expect(state.candidate.candidate).not.toBeNull();
  });

  it("handles multiple handoffs in long session", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-multi-handoff",
        status: "active",
        entryMode: "discover",
      },
      tokens: {
        usage: {
          total: 0,
          limit: 100000,
          percentUsed: 0,
          shouldHandoff: false,
        },
        handoffPending: false,
        handoffCount: 0,
      },
    };

    // First handoff
    state = ideationReducer(state, { type: "HANDOFF_PENDING" });
    state = ideationReducer(state, { type: "HANDOFF_COMPLETE" });
    expect(state.tokens.handoffCount).toBe(1);

    // Second handoff
    state = ideationReducer(state, { type: "HANDOFF_PENDING" });
    state = ideationReducer(state, { type: "HANDOFF_COMPLETE" });
    expect(state.tokens.handoffCount).toBe(2);

    // Third handoff
    state = ideationReducer(state, { type: "HANDOFF_PENDING" });
    state = ideationReducer(state, { type: "HANDOFF_COMPLETE" });
    expect(state.tokens.handoffCount).toBe(3);
  });
});

// =============================================================================
// INTEGRATION TEST: Candidate State Transitions
// =============================================================================

describe("Ideation Integration: Candidate State Transitions", () => {
  it("transitions candidate through forming -> active -> captured", () => {
    let state = initialState;

    // No candidate initially
    expect(state.candidate.candidate).toBeNull();
    expect(state.candidate.confidence).toBe(0);

    // Confidence starts building (no candidate yet)
    state = ideationReducer(state, {
      type: "CONFIDENCE_UPDATE",
      payload: { confidence: 15 },
    });
    expect(state.candidate.confidence).toBe(15);
    expect(state.candidate.candidate).toBeNull();

    // Candidate forms at 30% threshold
    const formingCandidate: IdeaCandidate = {
      id: "cand-forming",
      sessionId: "session-x",
      title: "Emerging Idea",
      summary: null,
      confidence: 30,
      viability: 100,
      userSuggested: false,
      status: "forming",
      capturedIdeaId: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state = ideationReducer(state, {
      type: "CANDIDATE_UPDATE",
      payload: { candidate: formingCandidate },
    });
    state = ideationReducer(state, {
      type: "CONFIDENCE_UPDATE",
      payload: { confidence: 30 },
    });
    expect(state.candidate.candidate?.status).toBe("forming");

    // Candidate becomes active at higher confidence
    const activeCandidate: IdeaCandidate = {
      ...formingCandidate,
      status: "active",
      summary: "A well-defined idea",
      confidence: 60,
    };
    state = ideationReducer(state, {
      type: "CANDIDATE_UPDATE",
      payload: { candidate: activeCandidate },
    });
    state = ideationReducer(state, {
      type: "CONFIDENCE_UPDATE",
      payload: { confidence: 60 },
    });
    expect(state.candidate.candidate?.status).toBe("active");

    // Ready for capture at 75%
    state = ideationReducer(state, {
      type: "CONFIDENCE_UPDATE",
      payload: { confidence: 75 },
    });
    expect(state.candidate.confidence).toBe(75);
  });

  it("handles candidate discard and restart", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-discard",
        status: "active",
        entryMode: "discover",
      },
      candidate: {
        ...initialState.candidate,
        candidate: {
          id: "cand-discard",
          sessionId: "session-discard",
          title: "Failed Idea",
          summary: "This didn't work out",
          confidence: 45,
          viability: 30,
          userSuggested: false,
          status: "active",
          capturedIdeaId: null,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        confidence: 45,
        viability: 30,
        risks: [
          {
            id: "risk-d1",
            candidateId: "cand-discard",
            riskType: "saturated_market",
            description: "Too many competitors",
            evidenceUrl: null,
            evidenceText: null,
            severity: "high",
            userAcknowledged: false,
            userResponse: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    };

    // User discards
    state = ideationReducer(state, { type: "CANDIDATE_CLEAR" });

    expect(state.candidate.candidate).toBeNull();
    expect(state.candidate.confidence).toBe(0);
    expect(state.candidate.viability).toBe(100);
    expect(state.candidate.risks).toHaveLength(0);

    // Session still active for new exploration
    expect(state.session.status).toBe("active");
  });
});

// =============================================================================
// INTEGRATION TEST: Message Threading
// =============================================================================

describe("Ideation Integration: Message Threading", () => {
  it("maintains correct message order through multiple exchanges", () => {
    let state: IdeationStore = {
      ...initialState,
      session: {
        ...initialState.session,
        sessionId: "session-thread",
        status: "active",
        entryMode: "discover",
      },
    };

    const messages = [
      { role: "assistant" as const, content: "Welcome! What excites you?" },
      { role: "user" as const, content: "I love solving problems" },
      { role: "assistant" as const, content: "What kind of problems?" },
      { role: "user" as const, content: "Business efficiency problems" },
      {
        role: "assistant" as const,
        content: "Interesting! Can you give an example?",
      },
      { role: "user" as const, content: "Manual data entry that wastes time" },
      {
        role: "assistant" as const,
        content: "That's a great pain point to explore!",
      },
    ];

    messages.forEach((msg, idx) => {
      state = ideationReducer(state, {
        type: "MESSAGE_RECEIVED",
        payload: {
          message: {
            id: `msg-${idx}`,
            sessionId: "session-thread",
            role: msg.role,
            content: msg.content,
            buttons: null,
            form: null,
            createdAt: new Date(Date.now() + idx * 1000).toISOString(),
          },
        },
      });
    });

    expect(state.conversation.messages).toHaveLength(7);
    expect(state.conversation.messages[0].role).toBe("assistant");
    expect(state.conversation.messages[1].role).toBe("user");
    expect(state.conversation.messages[6].content).toBe(
      "That's a great pain point to explore!",
    );
  });
});
