/**
 * E2E Browser Tests for Parent Harness Dashboard
 * Using OpenClaw Agent Browser for automation
 * 
 * ⚠️ REQUIRES: Playwright installed in the gateway
 * Install: npm install playwright && npx playwright install chromium
 * 
 * Prerequisites:
 * 1. Backend running: cd orchestrator && npm run dev
 * 2. Frontend running: cd dashboard && npm run dev
 * 3. OpenClaw browser with Playwright: openclaw browser status
 * 
 * Run: npm run test:e2e:browser
 * 
 * If you see "Playwright is not available", install it first.
 * For now, use: npm run test:e2e (Puppeteer-based tests)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { browser } from './browser-helper';

// Use environment variable or default to local
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3333';

describe('Dashboard E2E Tests (Agent Browser)', () => {
  let tabId: string;

  beforeAll(async () => {
    // Ensure browser is running
    const status = await browser.status();
    if (!status.running) {
      await browser.start();
    }
  });

  afterAll(async () => {
    // Close our test tab
    if (tabId) {
      try {
        await browser.close(tabId);
      } catch {
        // Tab may already be closed
      }
    }
  });

  beforeEach(async () => {
    // Open a fresh tab for each test
    if (tabId) {
      try {
        await browser.close(tabId);
      } catch {
        // Ignore
      }
    }
    tabId = await browser.open(DASHBOARD_URL);
    // Wait for page to load
    await browser.wait({ ms: 2000 });
  });

  describe('Health Checks', () => {
    it('should have backend API running', async () => {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('should load dashboard homepage', async () => {
      const title = await browser.getTitle();
      expect(title).toBeTruthy();
    });
  });

  describe('Layout Components', () => {
    it('should have header with navigation', async () => {
      const hasHeader = await browser.hasElement('Parent Harness');
      expect(hasHeader).toBe(true);
    });

    it('should have navigation links', async () => {
      const snapshot = await browser.snapshot({ interactive: true });
      expect(snapshot).toContain('Dashboard');
      expect(snapshot).toContain('Tasks');
      expect(snapshot).toContain('Sessions');
    });

    it('should have agent status panel', async () => {
      const hasAgents = await browser.hasElement('Agents');
      expect(hasAgents).toBe(true);
    });

    it('should have event stream panel', async () => {
      const hasEvents = await browser.hasElement('Event Stream');
      expect(hasEvents).toBe(true);
    });

    it('should have task queue panel', async () => {
      const hasTasks = await browser.hasElement('Task Queue');
      expect(hasTasks).toBe(true);
    });
  });

  describe('Agent Status Cards', () => {
    it('should display agent cards', async () => {
      const snapshot = await browser.snapshot({ interactive: true });
      // Should have at least some agent names
      expect(snapshot).toMatch(/orchestrator|build_agent|spec_agent|qa_agent/);
    });

    it('should show agent status indicators', async () => {
      const snapshot = await browser.snapshot({ interactive: true });
      // Should have status indicators (idle, running)
      expect(snapshot).toMatch(/idle|running|working/i);
    });
  });

  describe('Event Stream', () => {
    it('should have event stream component', async () => {
      const hasEventStream = await browser.hasElement('Event Stream');
      expect(hasEventStream).toBe(true);
    });

    it('should display events or be ready to receive', async () => {
      const snapshot = await browser.snapshot({ interactive: true });
      // Either has events or shows placeholder
      const hasContent = snapshot.includes('events') || snapshot.includes('cron:tick') || snapshot.includes('Auto-scroll');
      expect(hasContent).toBe(true);
    });
  });

  describe('Task Cards', () => {
    it('should display task queue section', async () => {
      const hasTasks = await browser.hasElement('Task Queue');
      expect(hasTasks).toBe(true);
    });

    it('should show task priority badges', async () => {
      const snapshot = await browser.snapshot({ interactive: true });
      // Should contain priority indicators
      expect(snapshot).toMatch(/P[0-4]|priority|pending|assigned/i);
    });
  });

  describe('Navigation', () => {
    it('should navigate to Tasks page', async () => {
      // Get snapshot with refs
      const snapshot = await browser.snapshot({ interactive: true });
      
      // Find and click Tasks link - look for the ref
      const match = snapshot.match(/\[ref=(e?\d+)\].*Tasks/);
      if (match) {
        await browser.click(match[1]);
        await browser.wait({ ms: 1000 });
      }
      
      const url = await browser.getUrl();
      expect(url).toContain('/tasks');
    });

    it('should navigate to Sessions page', async () => {
      const snapshot = await browser.snapshot({ interactive: true });
      
      const match = snapshot.match(/\[ref=(e?\d+)\].*Sessions/);
      if (match) {
        await browser.click(match[1]);
        await browser.wait({ ms: 1000 });
      }
      
      const url = await browser.getUrl();
      expect(url).toContain('/sessions');
    });

    it('should navigate back to Dashboard', async () => {
      // First go to sessions
      await browser.navigate(`${DASHBOARD_URL}/sessions`);
      await browser.wait({ ms: 1000 });
      
      // Get snapshot and click Dashboard
      const snapshot = await browser.snapshot({ interactive: true });
      const match = snapshot.match(/\[ref=(e?\d+)\].*Dashboard/);
      if (match) {
        await browser.click(match[1]);
        await browser.wait({ ms: 1000 });
      }
      
      const url = await browser.getUrl();
      expect(url).toBe(`${DASHBOARD_URL}/`);
    });
  });

  describe('WebSocket Connection', () => {
    it('should show live connection status', async () => {
      // Wait a moment for WebSocket to connect
      await new Promise(r => setTimeout(r, 1000));
      
      const snapshot = await browser.snapshot({ interactive: true });
      // Should show Live or Connecting status
      expect(snapshot).toMatch(/Live|Connected|Connecting/i);
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

    it('should filter tasks by status', async () => {
      const response = await fetch(`${API_URL}/api/tasks?status=pending`);
      const tasks = await response.json();
      
      expect(Array.isArray(tasks)).toBe(true);
      tasks.forEach((task: { status: string }) => {
        expect(task.status).toBe('pending');
      });
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

    it('should filter events by type', async () => {
      const response = await fetch(`${API_URL}/api/events?type=cron:tick`);
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
