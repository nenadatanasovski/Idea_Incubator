import { describe, test, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Request, Response } from 'express';

// Mock all dependencies before importing the router
vi.mock('../../database/db.js', () => ({
  getDb: vi.fn(() => ({
    run: vi.fn(),
    exec: vi.fn(() => []),
  })),
  saveDb: vi.fn(() => Promise.resolve()),
  getOne: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../../agents/ideation/session-manager.js', () => ({
  sessionManager: {
    create: vi.fn(),
    load: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    abandon: vi.fn(),
    getActiveByProfile: vi.fn(),
  },
}));

vi.mock('../../agents/ideation/message-store.js', () => ({
  messageStore: {
    add: vi.fn(),
    getBySession: vi.fn(),
    getTotalTokens: vi.fn(),
    recordButtonClick: vi.fn(),
  },
}));

vi.mock('../../agents/ideation/memory-manager.js', () => ({
  memoryManager: {
    upsert: vi.fn(),
    getByType: vi.fn(),
    getAll: vi.fn(),
  },
}));

vi.mock('../../agents/ideation/orchestrator.js', () => ({
  agentOrchestrator: {
    processMessage: vi.fn(),
  },
}));

vi.mock('../../agents/ideation/greeting-generator.js', () => ({
  generateGreetingWithButtons: vi.fn(() => ({
    text: 'Welcome! I\'m here to help.',
    buttons: [
      { id: 'btn_frustration', label: 'Something frustrates me', value: 'test', style: 'secondary' },
      { id: 'btn_idea', label: 'I have a rough idea', value: 'test', style: 'secondary' },
      { id: 'btn_explore', label: 'Help me explore', value: 'test', style: 'secondary' },
    ],
  })),
}));

vi.mock('../../agents/ideation/candidate-manager.js', () => ({
  candidateManager: {
    create: vi.fn(),
    getById: vi.fn(),
    getActiveForSession: vi.fn(),
    getActiveBySession: vi.fn(),
    getOrCreateForSession: vi.fn(),
    update: vi.fn(),
    discard: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('../../agents/ideation/streaming.js', () => ({
  createSSEStream: vi.fn(() => ({
    send: vi.fn(),
    end: vi.fn(),
  })),
  StreamingResponseHandler: vi.fn(() => ({
    on: vi.fn(),
    streamMessage: vi.fn(),
  })),
}));

vi.mock('../../utils/anthropic-client.js', () => ({
  getAnthropicClient: vi.fn(() => ({})),
}));

vi.mock('../../agents/ideation/system-prompt.js', () => ({
  buildSystemPrompt: vi.fn(() => 'System prompt'),
}));

// Now import the router after mocks are set up
import { ideationRouter } from '../../server/routes/ideation.js';
import { sessionManager } from '../../agents/ideation/session-manager.js';
import { messageStore } from '../../agents/ideation/message-store.js';
import { agentOrchestrator } from '../../agents/ideation/orchestrator.js';
import { candidateManager } from '../../agents/ideation/candidate-manager.js';
import { getOne } from '../../database/db.js';

// Type definitions for route handler extraction
interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<unknown> }>;
  };
}

// Helper function to get route handler
function getRouteHandler(path: string, method: 'get' | 'post'): ((req: Request, res: Response) => Promise<unknown>) | undefined {
  const router = ideationRouter as unknown as { stack: RouteLayer[] };
  const layer = router.stack.find(l => l.route?.path === path && l.route?.methods?.[method]);
  return layer?.route?.stack[0].handle;
}

// Helper to create mock request
function createMockRequest(options: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): Request {
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
  } as Request;
}

// Helper to create mock response
function createMockResponse() {
  const res = {
    statusCode: 200,
    jsonData: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.jsonData = data;
      return this;
    },
  };
  return res as typeof res & Response;
}

describe('Ideation API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // POST /api/ideation/start
  // ===========================================================================

  describe('POST /start', () => {
    test('PASS: Creates session with valid profile', async () => {
      vi.mocked(getOne).mockResolvedValue({
        id: 'profile-123',
        name: 'Test User',
        technical_skills: 'programming,design',
        interests: 'tech,startups',
        city: 'Sydney',
        country: 'Australia',
      });

      vi.mocked(sessionManager.create).mockResolvedValue({
        id: 'session-123',
        profileId: 'profile-123',
        status: 'active',
        currentPhase: 'exploring',
        entryMode: 'discover',
        startedAt: new Date(),
        completedAt: null,
        lastActivityAt: new Date(),
        handoffCount: 0,
        tokenCount: 0,
        messageCount: 0,
      });

      vi.mocked(messageStore.add).mockResolvedValue({
        id: 'msg-1',
        sessionId: 'session-123',
        role: 'assistant',
        content: 'Welcome!',
        buttonsShown: null,
        buttonClicked: null,
        formShown: null,
        formResponse: null,
        webSearchResults: null,
        tokenCount: 10,
        createdAt: new Date(),
      });

      vi.mocked(sessionManager.update).mockResolvedValue(null);

      const req = createMockRequest({ body: { profileId: 'profile-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/start', 'post');
      expect(handler).toBeDefined();
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { sessionId: string }).sessionId).toBe('session-123');
    });

    test('PASS: Greeting includes buttons', async () => {
      vi.mocked(getOne).mockResolvedValue({ id: 'profile-123', name: 'Test User' });
      vi.mocked(sessionManager.create).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(messageStore.add).mockResolvedValue({} as never);
      vi.mocked(sessionManager.update).mockResolvedValue(null);

      const req = createMockRequest({ body: { profileId: 'profile-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/start', 'post');
      await handler!(req, res);

      const buttons = (res.jsonData as { buttons: unknown[] }).buttons;
      expect(buttons).toHaveLength(3);
    });

    test('FAIL: Returns 404 for invalid profile', async () => {
      vi.mocked(getOne).mockResolvedValue(null);

      const req = createMockRequest({ body: { profileId: 'nonexistent' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/start', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('FAIL: Returns 400 for missing profileId', async () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();

      const handler = getRouteHandler('/start', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/message
  // ===========================================================================

  describe('POST /message', () => {
    test('PASS: Processes message and returns response', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(getOne).mockResolvedValue({ id: 'profile-123', name: 'Test User' });
      vi.mocked(agentOrchestrator.processMessage).mockResolvedValue({
        reply: 'That sounds interesting!', buttons: null, form: null, candidateUpdate: null,
        confidence: 20, viability: 100, requiresIntervention: false, handoffOccurred: false,
      });
      vi.mocked(messageStore.getBySession).mockResolvedValue([]);
      vi.mocked(messageStore.getTotalTokens).mockResolvedValue(100);
      vi.mocked(sessionManager.update).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'session-123', message: 'Healthcare problems' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/message', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { reply: string }).reply).toBeDefined();
    });

    test('PASS: Returns ideaCandidate when confidence is high', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(getOne).mockResolvedValue({ id: 'profile-123', name: 'Test User' });
      vi.mocked(agentOrchestrator.processMessage).mockResolvedValue({
        reply: 'Great idea!', buttons: null, form: null,
        candidateUpdate: { title: 'Healthcare Platform', summary: 'A platform' },
        confidence: 50, viability: 80, requiresIntervention: false, handoffOccurred: false,
      });
      vi.mocked(candidateManager.getOrCreateForSession).mockResolvedValue({
        id: 'candidate-1', sessionId: 'session-123', title: 'Healthcare Platform',
        summary: 'A platform', confidence: 50, viability: 80, userSuggested: false,
        status: 'forming', capturedIdeaId: null, version: 1, createdAt: new Date(), updatedAt: new Date(),
      });
      vi.mocked(messageStore.getBySession).mockResolvedValue([]);
      vi.mocked(messageStore.getTotalTokens).mockResolvedValue(100);
      vi.mocked(sessionManager.update).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'session-123', message: 'Build a platform' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/message', 'post');
      await handler!(req, res);

      expect((res.jsonData as { ideaCandidate: { id: string } }).ideaCandidate).toHaveProperty('id');
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'nonexistent', message: 'Hello' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/message', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('FAIL: Returns 400 for missing message', async () => {
      const req = createMockRequest({ body: { sessionId: 'session-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/message', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('FAIL: Returns 400 for completed session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'completed', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: new Date(), lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });

      const req = createMockRequest({ body: { sessionId: 'session-123', message: 'Hello' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/message', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/button
  // ===========================================================================

  describe('POST /button', () => {
    test('PASS: Button click is processed as message', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(messageStore.getBySession).mockResolvedValue([{
        id: 'msg-1', sessionId: 'session-123', role: 'assistant', content: 'Welcome!',
        buttonsShown: [], buttonClicked: null, formShown: null, formResponse: null,
        webSearchResults: null, tokenCount: 10, createdAt: new Date(),
      }]);
      vi.mocked(getOne).mockResolvedValue({ id: 'profile-123', name: 'Test' });
      vi.mocked(messageStore.recordButtonClick).mockResolvedValue();
      vi.mocked(agentOrchestrator.processMessage).mockResolvedValue({
        reply: 'I understand.', buttons: null, form: null, candidateUpdate: null,
        confidence: 10, viability: 100, requiresIntervention: false, handoffOccurred: false,
      });
      vi.mocked(messageStore.getTotalTokens).mockResolvedValue(100);
      vi.mocked(sessionManager.update).mockResolvedValue(null);

      const req = createMockRequest({
        body: { sessionId: 'session-123', buttonId: 'btn_frustration', buttonValue: 'Something frustrates me' },
      });
      const res = createMockResponse();

      const handler = getRouteHandler('/button', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { reply: string }).reply).toBeDefined();
    });

    test('FAIL: Returns 400 for missing buttonId', async () => {
      const req = createMockRequest({ body: { sessionId: 'session-123', buttonValue: 'test' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/button', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/capture
  // ===========================================================================

  describe('POST /capture', () => {
    test('FAIL: Returns 400 if no candidate exists', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(candidateManager.getActiveForSession).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'session-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/capture', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'nonexistent' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/capture', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // GET /api/ideation/session/:sessionId
  // ===========================================================================

  describe('GET /session/:sessionId', () => {
    test('PASS: Returns session details', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(messageStore.getBySession).mockResolvedValue([]);
      vi.mocked(candidateManager.getActiveForSession).mockResolvedValue(null);

      const req = createMockRequest({ params: { sessionId: 'session-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/session/:sessionId', 'get');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { session: object }).session).toBeDefined();
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({ params: { sessionId: 'nonexistent' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/session/:sessionId', 'get');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // POST /api/ideation/session/:sessionId/abandon
  // ===========================================================================

  describe('POST /session/:sessionId/abandon', () => {
    test('PASS: Abandons active session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(sessionManager.abandon).mockResolvedValue(null);

      const req = createMockRequest({ params: { sessionId: 'session-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/session/:sessionId/abandon', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({ params: { sessionId: 'nonexistent' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/session/:sessionId/abandon', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('FAIL: Returns 400 for already abandoned session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'abandoned', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: new Date(), lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });

      const req = createMockRequest({ params: { sessionId: 'session-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/session/:sessionId/abandon', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // GET /api/ideation/sessions
  // ===========================================================================

  describe('GET /sessions', () => {
    test('PASS: Returns sessions for profile', async () => {
      vi.mocked(sessionManager.getActiveByProfile).mockResolvedValue([{
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      }]);

      const req = createMockRequest({ query: { profileId: 'profile-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/sessions', 'get');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { sessions: unknown[] }).sessions).toBeInstanceOf(Array);
    });

    test('PASS: Returns empty array for profile with no sessions', async () => {
      vi.mocked(sessionManager.getActiveByProfile).mockResolvedValue([]);

      const req = createMockRequest({ query: { profileId: 'profile-no-sessions' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/sessions', 'get');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { sessions: unknown[] }).sessions).toEqual([]);
    });

    test('FAIL: Returns 400 for missing profileId', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      const handler = getRouteHandler('/sessions', 'get');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/form
  // ===========================================================================

  describe('POST /form', () => {
    test('PASS: Processes form submission', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(getOne).mockResolvedValue({ id: 'profile-123', name: 'Test' });
      vi.mocked(messageStore.add).mockResolvedValue({} as never);
      vi.mocked(candidateManager.getActiveForSession).mockResolvedValue(null);
      vi.mocked(agentOrchestrator.processMessage).mockResolvedValue({
        reply: 'Thanks for the details!', buttons: null, form: null, candidateUpdate: null,
        confidence: 20, viability: 100, requiresIntervention: false, handoffOccurred: false,
      });

      const req = createMockRequest({
        body: { sessionId: 'session-123', formId: 'test_form', responses: { field1: 'value1' } },
      });
      const res = createMockResponse();

      const handler = getRouteHandler('/form', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({
        body: { sessionId: 'nonexistent', formId: 'test', responses: {} },
      });
      const res = createMockResponse();

      const handler = getRouteHandler('/form', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('FAIL: Returns 400 for missing formId', async () => {
      const req = createMockRequest({
        body: { sessionId: 'session-123', responses: {} },
      });
      const res = createMockResponse();

      const handler = getRouteHandler('/form', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // POST /api/ideation/save
  // ===========================================================================

  describe('POST /save', () => {
    test('FAIL: Returns 404 when no candidate exists', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(candidateManager.getActiveForSession).mockResolvedValue(null);
      vi.mocked(candidateManager.getById).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'session-123' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/save', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'nonexistent' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/save', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });
  });

  // ===========================================================================
  // POST /api/ideation/discard
  // ===========================================================================

  describe('POST /discard', () => {
    test('PASS: Discards session and creates new one', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue({
        id: 'session-123', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(candidateManager.getActiveForSession).mockResolvedValue(null);
      vi.mocked(sessionManager.abandon).mockResolvedValue(null);
      vi.mocked(getOne).mockResolvedValue({ id: 'profile-123', name: 'Test' });
      vi.mocked(sessionManager.create).mockResolvedValue({
        id: 'session-new', profileId: 'profile-123', status: 'active', currentPhase: 'exploring',
        entryMode: 'discover', startedAt: new Date(), completedAt: null, lastActivityAt: new Date(),
        handoffCount: 0, tokenCount: 0, messageCount: 0,
      });
      vi.mocked(messageStore.add).mockResolvedValue({} as never);

      const req = createMockRequest({ body: { sessionId: 'session-123', reason: 'Want fresh' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/discard', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.jsonData as { newSessionId: string }).newSessionId).toBeDefined();
    });

    test('FAIL: Returns 404 for invalid session', async () => {
      vi.mocked(sessionManager.load).mockResolvedValue(null);

      const req = createMockRequest({ body: { sessionId: 'nonexistent' } });
      const res = createMockResponse();

      const handler = getRouteHandler('/discard', 'post');
      await handler!(req, res);

      expect(res.statusCode).toBe(404);
    });
  });
});
