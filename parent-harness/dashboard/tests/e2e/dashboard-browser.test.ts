/**
 * E2E Browser Tests for Parent Harness Dashboard
 * Using Puppeteer for browser automation
 * 
 * Prerequisites:
 * 1. Backend running: cd orchestrator && npm run dev
 * 2. Frontend running: cd dashboard && npm run dev
 * 
 * Run: npm run test:e2e:browser
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { browser } from './browser-helper';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3333';

describe('Dashboard E2E Tests (Puppeteer)', () => {
  beforeAll(async () => {
    await browser.start();
  });

  afterAll(async () => {
    await browser.stop();
  });

  describe('Health Checks', () => {
    it('should have backend API running', async () => {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('should load dashboard homepage', async () => {
      await browser.goto(DASHBOARD_URL);
      const title = await browser.getTitle();
      expect(title).toBeTruthy();
    });
  });

  describe('Layout Components', () => {
    beforeAll(async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.waitFor('[data-testid="layout-header"]');
    });

    it('should have header with navigation', async () => {
      const exists = await browser.exists('[data-testid="layout-header"]');
      expect(exists).toBe(true);
    });

    it('should have navigation links', async () => {
      const dashboardLink = await browser.exists('a[href="/"]');
      const tasksLink = await browser.exists('a[href="/tasks"]');
      const sessionsLink = await browser.exists('a[href="/sessions"]');
      
      expect(dashboardLink).toBe(true);
      expect(tasksLink).toBe(true);
      expect(sessionsLink).toBe(true);
    });

    it('should have agent status panel', async () => {
      const exists = await browser.exists('[data-testid="layout-left"]');
      expect(exists).toBe(true);
    });

    it('should have event stream panel', async () => {
      const exists = await browser.exists('[data-testid="layout-main"]');
      expect(exists).toBe(true);
    });

    it('should have task queue panel', async () => {
      const exists = await browser.exists('[data-testid="layout-right"]');
      expect(exists).toBe(true);
    });
  });

  describe('Agent Status Cards', () => {
    beforeAll(async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.waitFor('[data-testid="agent-card"]');
    });

    it('should display agent cards', async () => {
      const exists = await browser.exists('[data-testid="agent-card"]');
      expect(exists).toBe(true);
    });

    it('should show agent status indicators', async () => {
      const text = await browser.getText('[data-testid="layout-left"]');
      expect(text).toMatch(/idle|working|error/i);
    });
  });

  describe('Event Stream', () => {
    beforeAll(async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.waitFor('[data-testid="event-stream"]');
    });

    it('should have event stream component', async () => {
      const exists = await browser.exists('[data-testid="event-stream"]');
      expect(exists).toBe(true);
    });
  });

  describe('Task Cards', () => {
    beforeAll(async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.waitFor('[data-testid="task-card"]');
    });

    it('should display task queue section', async () => {
      const exists = await browser.exists('[data-testid="task-card"]');
      expect(exists).toBe(true);
    });

    it('should show task priority badges', async () => {
      const text = await browser.getText('[data-testid="layout-right"]');
      expect(text).toMatch(/P[0-4]/);
    });
  });

  describe('Navigation', () => {
    it('should navigate to Tasks page', async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.waitFor('a[href="/tasks"]');
      await browser.click('a[href="/tasks"]');
      await browser.wait(500);
      
      const url = browser.getUrl();
      expect(url).toContain('/tasks');
    });

    it('should navigate to Sessions page', async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.waitFor('a[href="/sessions"]');
      await browser.click('a[href="/sessions"]');
      await browser.wait(500);
      
      const url = browser.getUrl();
      expect(url).toContain('/sessions');
    });

    it('should navigate back to Dashboard', async () => {
      await browser.goto(`${DASHBOARD_URL}/sessions`);
      await browser.waitFor('a[href="/"]');
      await browser.click('a[href="/"]');
      await browser.wait(500);
      
      const url = browser.getUrl();
      expect(url).toBe(`${DASHBOARD_URL}/`);
    });
  });

  describe('WebSocket Connection', () => {
    it('should show live connection status', async () => {
      await browser.goto(DASHBOARD_URL);
      await browser.wait(1500);
      
      const text = await browser.getText('[data-testid="layout-left"]');
      expect(text).toMatch(/Live|Connecting/i);
    });
  });
});

describe('API Integration Tests', () => {
  describe('Agents API', () => {
    it('should return list of agents', async () => {
      const response = await fetch(`${API_URL}/api/agents`);
      const agents = await response.json();
      
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBe(13);
    });

    it('should return single agent by ID', async () => {
      const response = await fetch(`${API_URL}/api/agents/build_agent`);
      const agent = await response.json();
      
      expect(agent.id).toBe('build_agent');
      expect(agent.name).toBe('Build Agent');
    });
  });

  describe('Tasks API', () => {
    it('should return list of tasks', async () => {
      const response = await fetch(`${API_URL}/api/tasks`);
      const tasks = await response.json();
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Test Suites API', () => {
    it('should return 16 test suites', async () => {
      const response = await fetch(`${API_URL}/api/tests/suites`);
      const suites = await response.json();
      
      expect(Array.isArray(suites)).toBe(true);
      expect(suites.length).toBe(16);
    });
  });

  describe('Events API', () => {
    it('should return events list', async () => {
      const response = await fetch(`${API_URL}/api/events`);
      const events = await response.json();
      
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Config API', () => {
    it('should return configuration', async () => {
      const response = await fetch(`${API_URL}/api/config`);
      const config = await response.json();
      
      expect(config).toHaveProperty('tick_interval_ms');
      expect(config).toHaveProperty('max_parallel_agents');
    });
  });

  describe('Sessions API', () => {
    it('should return sessions list', async () => {
      const response = await fetch(`${API_URL}/api/sessions`);
      const sessions = await response.json();
      
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});
