/**
 * E2E Test Fixtures
 * Custom test fixtures for common setup and teardown operations
 */

import { test as base, expect, Page } from '@playwright/test';

// Test data types
export interface MockIdea {
  id: string;
  title: string;
  phase: 'ideation' | 'ideation_ready' | 'specification' | 'spec_ready' | 'building' | 'build_review' | 'deployed' | 'paused' | 'failed';
}

export interface MockSession {
  id: string;
  ideaId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;
}

export interface MockBuildSession {
  id: string;
  ideaId: string;
  status: 'active' | 'paused' | 'complete' | 'failed' | 'human_needed';
  tasks: Array<{
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  }>;
  progress: {
    completed: number;
    total: number;
    currentAttempt: number;
  };
}

// Extended test fixture type
type TestFixtures = {
  mockIdea: MockIdea;
  mockSession: MockSession;
  mockBuildSession: MockBuildSession;
  setupMocks: (page: Page) => Promise<void>;
};

/**
 * Default test data
 */
export const DEFAULT_IDEA: MockIdea = {
  id: 'test-idea-123',
  title: 'Test Idea',
  phase: 'ideation',
};

export const DEFAULT_SESSION: MockSession = {
  id: 'session-123',
  ideaId: 'test-idea-123',
  messages: [
    {
      id: 'msg-1',
      role: 'assistant',
      content: 'Welcome! Tell me about your idea.',
      created_at: new Date().toISOString(),
    },
  ],
};

export const DEFAULT_BUILD_SESSION: MockBuildSession = {
  id: 'build-123',
  ideaId: 'test-idea-123',
  status: 'active',
  tasks: [
    { id: 't1', name: 'Setup project', description: 'Initialize project structure', status: 'completed' },
    { id: 't2', name: 'Create components', description: 'Build UI components', status: 'in_progress' },
    { id: 't3', name: 'Add tests', description: 'Write unit tests', status: 'pending' },
    { id: 't4', name: 'Deploy', description: 'Deploy to production', status: 'pending' },
  ],
  progress: {
    completed: 1,
    total: 4,
    currentAttempt: 1,
  },
};

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
  mockIdea: async ({}, use) => {
    await use(DEFAULT_IDEA);
  },

  mockSession: async ({}, use) => {
    await use(DEFAULT_SESSION);
  },

  mockBuildSession: async ({}, use) => {
    await use(DEFAULT_BUILD_SESSION);
  },

  setupMocks: async ({ page }, use) => {
    const setupMocks = async (p: Page) => {
      // Mock API endpoints
      await p.route('**/api/idea-pipeline/*/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            state: {
              ideaId: DEFAULT_IDEA.id,
              currentPhase: DEFAULT_IDEA.phase,
              autoAdvance: true,
              ideationProgress: {
                completionScore: 0.4,
                confidenceScore: 0.5,
                milestones: {
                  problemDefined: true,
                  solutionClear: false,
                  targetUser: false,
                },
              },
            },
          }),
        });
      });

      await p.route('**/api/ideation/sessions*', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([DEFAULT_SESSION]),
          });
        } else if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(DEFAULT_SESSION),
          });
        }
      });

      await p.route('**/api/ideation/sessions/*/messages', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(DEFAULT_SESSION.messages),
        });
      });

      await p.route('**/api/ideation/sessions/*/message', async (route) => {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messageId: `msg-${Date.now()}`,
            content: `Got it! You mentioned: "${body?.content}". Can you tell me more?`,
          }),
        });
      });

      await p.route('**/api/build/*/status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(DEFAULT_BUILD_SESSION),
        });
      });

      await p.route('**/api/ideas/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: DEFAULT_IDEA.id,
            title: DEFAULT_IDEA.title,
            description: 'A test idea for E2E testing',
          }),
        });
      });
    };

    await setupMocks(page);
    await use(setupMocks);
  },
});

export { expect };

/**
 * Helper to wait for network idle after navigation
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Helper to mock WebSocket connections
 */
export async function mockWebSocket(page: Page, url: string, onMessage?: (data: string) => void) {
  await page.addInitScript((wsUrl: string) => {
    const originalWebSocket = window.WebSocket;
    
    // @ts-ignore
    window.WebSocket = class MockWebSocket extends originalWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        if (url.includes(wsUrl)) {
          super(url, protocols);
          // Allow overriding behavior
        } else {
          super(url, protocols);
        }
      }
    };
  }, url);
}
