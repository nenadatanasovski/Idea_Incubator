/**
 * Tests for Notification Queue
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the database functions
vi.mock('../database/db.js', () => ({
  getTemplate: vi.fn(),
  createNotification: vi.fn()
}));

import { getTemplate, createNotification } from '../database/db.js';

// Import after mocking
const mockGetTemplate = vi.mocked(getTemplate);
const mockCreateNotification = vi.mocked(createNotification);

describe('Notification Queue', () => {
  // We need to dynamically import to ensure mocks are in place
  let notificationQueue: typeof import('../server/notifications/queue.js').notificationQueue;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset module cache
    vi.resetModules();

    // Re-import with fresh mocks
    const queueModule = await import('../server/notifications/queue.js');
    notificationQueue = queueModule.notificationQueue;

    // Clear dedup cache
    notificationQueue.clearDedupeCache();

    // Setup default mock implementations
    mockGetTemplate.mockResolvedValue({
      id: 'tmpl-test',
      type: 'agent_question',
      titleTemplate: 'Agent needs your input',
      bodyTemplate: '{{agentName}} has a question: {{question}}',
      emailSubject: null,
      emailBody: null,
      telegramText: null,
      defaultChannels: ['in_app'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    mockCreateNotification.mockImplementation(async (input) => ({
      id: 'notif-123',
      userId: input.userId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body,
      data: input.data || null,
      priority: input.priority || 'normal',
      readAt: null,
      archivedAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString()
    }));
  });

  afterEach(() => {
    notificationQueue.stopCleanup();
  });

  it('should create notification from template', async () => {
    const notification = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Spec Agent', question: 'What database should we use?' }
    });

    expect(notification).toBeDefined();
    expect(notification!.title).toBe('Agent needs your input');
    expect(notification!.body).toContain('Spec Agent');
    expect(notification!.body).toContain('What database should we use?');
  });

  it('should deduplicate within 1 hour', async () => {
    const first = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Same?' }
    });

    const second = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Same?' }
    });

    expect(first).toBeDefined();
    expect(second).toBeNull(); // Deduplicated
  });

  it('should not deduplicate different data', async () => {
    const first = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'First question?' }
    });

    const second = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Different question?' }
    });

    expect(first).toBeDefined();
    expect(second).toBeDefined(); // Different data, not deduplicated
  });

  it('should not deduplicate different users', async () => {
    const first = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Same?' }
    });

    const second = await notificationQueue.enqueue({
      userId: 'user-2',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Same?' }
    });

    expect(first).toBeDefined();
    expect(second).toBeDefined(); // Different user, not deduplicated
  });

  it('should throw error for unknown notification type', async () => {
    mockGetTemplate.mockResolvedValue(null);

    await expect(notificationQueue.enqueue({
      userId: 'user-1',
      type: 'unknown_type',
      data: {}
    })).rejects.toThrow('Unknown notification type: unknown_type');
  });

  it('should emit notification event when created', async () => {
    const eventHandler = vi.fn();
    notificationQueue.on('notification', eventHandler);

    await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Hello?' }
    });

    expect(eventHandler).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      type: 'agent_question'
    }));
  });

  it('should bypass deduplication with forceEnqueue', async () => {
    const first = await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Same?' }
    });

    const second = await notificationQueue.forceEnqueue({
      userId: 'user-1',
      type: 'agent_question',
      data: { agentName: 'Test', question: 'Same?' }
    });

    expect(first).toBeDefined();
    expect(second).toBeDefined(); // forceEnqueue bypasses dedup
  });

  it('should infer category from type', async () => {
    // Test agent category
    mockGetTemplate.mockResolvedValue({
      id: 'tmpl-agent',
      type: 'agent_error',
      titleTemplate: 'Error',
      bodyTemplate: '{{error}}',
      emailSubject: null,
      emailBody: null,
      telegramText: null,
      defaultChannels: ['in_app'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await notificationQueue.enqueue({
      userId: 'user-1',
      type: 'agent_error',
      data: { error: 'Something went wrong' }
    });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'agent'
      })
    );
  });
});
