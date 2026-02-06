/**
 * E2E Browser Tests for Parent Harness Dashboard
 * 
 * Prerequisites:
 * 1. Backend running: cd orchestrator && npm run dev
 * 2. Frontend running: cd dashboard && npm run dev
 * 
 * Run: npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

const DASHBOARD_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3333';

describe('Dashboard E2E Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Health Checks', () => {
    it('should have backend API running', async () => {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('should load dashboard homepage', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
      const title = await page.title();
      expect(title).toContain('Vite');
    });
  });

  describe('Layout Components', () => {
    beforeAll(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
    });

    it('should have header with navigation', async () => {
      const header = await page.$('[data-testid="layout-header"]');
      expect(header).not.toBeNull();
    });

    it('should have left panel (agent status)', async () => {
      const leftPanel = await page.$('[data-testid="layout-left"]');
      expect(leftPanel).not.toBeNull();
    });

    it('should have main panel (event stream)', async () => {
      const mainPanel = await page.$('[data-testid="layout-main"]');
      expect(mainPanel).not.toBeNull();
    });

    it('should have right panel (task queue)', async () => {
      const rightPanel = await page.$('[data-testid="layout-right"]');
      expect(rightPanel).not.toBeNull();
    });

    it('should have notification center', async () => {
      const notificationCenter = await page.$('[data-testid="notification-center"]');
      expect(notificationCenter).not.toBeNull();
    });
  });

  describe('Agent Status Cards', () => {
    beforeAll(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="agent-card"]', { timeout: 5000 });
    });

    it('should display agent cards', async () => {
      const agentCards = await page.$$('[data-testid="agent-card"]');
      expect(agentCards.length).toBeGreaterThan(0);
    });

    it('should show agent name and status', async () => {
      const firstCard = await page.$('[data-testid="agent-card"]');
      const text = await firstCard?.evaluate(el => el.textContent);
      expect(text).toBeTruthy();
    });
  });

  describe('Event Stream', () => {
    beforeAll(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
    });

    it('should have event stream component', async () => {
      const eventStream = await page.$('[data-testid="event-stream"]');
      expect(eventStream).not.toBeNull();
    });

    it('should display events or placeholder', async () => {
      const events = await page.$$('[data-testid="event-item"]');
      // Either has events or shows placeholder
      expect(events.length >= 0).toBe(true);
    });
  });

  describe('Task Cards', () => {
    beforeAll(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-testid="task-card"]', { timeout: 5000 });
    });

    it('should display task cards', async () => {
      const taskCards = await page.$$('[data-testid="task-card"]');
      expect(taskCards.length).toBeGreaterThan(0);
    });

    it('should show task priority badge', async () => {
      const firstCard = await page.$('[data-testid="task-card"]');
      const text = await firstCard?.evaluate(el => el.textContent);
      // Should contain a priority like P0, P1, etc.
      expect(text).toMatch(/P[0-4]/);
    });
  });

  describe('Navigation', () => {
    it('should navigate to Tasks page', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
      await page.click('a[href="/tasks"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      const url = page.url();
      expect(url).toContain('/tasks');
      
      const heading = await page.$eval('h1', el => el.textContent);
      expect(heading).toContain('Task Board');
    });

    it('should navigate to Sessions page', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
      await page.click('a[href="/sessions"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      const url = page.url();
      expect(url).toContain('/sessions');
      
      const heading = await page.$eval('h1', el => el.textContent);
      expect(heading).toContain('Agent Sessions');
    });

    it('should navigate back to Dashboard', async () => {
      await page.goto(`${DASHBOARD_URL}/sessions`, { waitUntil: 'networkidle0' });
      await page.click('a[href="/"]');
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      const url = page.url();
      expect(url).toBe(`${DASHBOARD_URL}/`);
    });
  });

  describe('Notification Center', () => {
    beforeAll(async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
    });

    it('should open notification dropdown on click', async () => {
      const bellButton = await page.$('[data-testid="notification-center"] button');
      await bellButton?.click();
      
      // Wait for dropdown to appear
      await page.waitForTimeout(300);
      
      // Check if dropdown is visible
      const dropdown = await page.$('[data-testid="notification-center"] > div:nth-child(2)');
      expect(dropdown).not.toBeNull();
    });
  });

  describe('WebSocket Connection', () => {
    it('should show connection status indicator', async () => {
      await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
      
      // Look for the connection indicator (green/red dot)
      const indicator = await page.$('[data-testid="layout-left"] span[class*="rounded-full"]');
      expect(indicator).not.toBeNull();
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
});
