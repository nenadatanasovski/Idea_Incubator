/**
 * OpenClaw Browser Helper for E2E Tests
 * 
 * Uses OpenClaw's built-in browser control API for automation.
 * This is more stable than Puppeteer for agent-driven testing.
 */

import { execSync } from 'child_process';

const BROWSER_PROFILE = 'openclaw';
const DEFAULT_TIMEOUT = 30000;

export interface SnapshotResult {
  snapshot: string;
  refs: Record<string, unknown>;
}

export interface TabInfo {
  targetId: string;
  url: string;
  title: string;
}

export class BrowserHelper {
  private targetId: string | null = null;

  /**
   * Execute an OpenClaw browser command
   */
  private exec(args: string): string {
    const cmd = `openclaw browser --browser-profile ${BROWSER_PROFILE} ${args} --json 2>/dev/null`;
    try {
      const result = execSync(cmd, { encoding: 'utf-8', timeout: DEFAULT_TIMEOUT });
      return result;
    } catch (error: unknown) {
      const err = error as { status?: number; stderr?: Buffer };
      if (err.status) {
        throw new Error(`Browser command failed: ${args}`);
      }
      throw error;
    }
  }

  /**
   * Parse JSON output from CLI
   */
  private parseJson<T>(output: string): T {
    try {
      return JSON.parse(output) as T;
    } catch {
      throw new Error(`Failed to parse browser output: ${output.slice(0, 100)}`);
    }
  }

  /**
   * Start the browser if not running
   */
  async start(): Promise<void> {
    this.exec('start');
  }

  /**
   * Stop the browser
   */
  async stop(): Promise<void> {
    this.exec('stop');
  }

  /**
   * Get browser status
   */
  async status(): Promise<{ running: boolean; cdpReady: boolean }> {
    const output = this.exec('status');
    return this.parseJson(output);
  }

  /**
   * Open a URL in a new tab
   */
  async open(url: string): Promise<string> {
    const output = this.exec(`open "${url}"`);
    const result = this.parseJson<{ targetId: string }>(output);
    this.targetId = result.targetId;
    return result.targetId;
  }

  /**
   * Navigate current tab to URL
   */
  async navigate(url: string): Promise<void> {
    this.exec(`navigate "${url}"`);
  }

  /**
   * List all tabs
   */
  async tabs(): Promise<TabInfo[]> {
    const output = this.exec('tabs');
    const result = this.parseJson<{ tabs: TabInfo[] }>(output);
    return result.tabs || [];
  }

  /**
   * Focus a tab by targetId
   */
  async focus(targetId: string): Promise<void> {
    this.exec(`focus ${targetId}`);
    this.targetId = targetId;
  }

  /**
   * Close a tab by targetId
   */
  async close(targetId?: string): Promise<void> {
    const id = targetId || this.targetId;
    if (id) {
      this.exec(`close ${id}`);
      if (id === this.targetId) {
        this.targetId = null;
      }
    }
  }

  /**
   * Get interactive snapshot of the page
   */
  async snapshot(options: { interactive?: boolean; compact?: boolean } = {}): Promise<string> {
    let args = 'snapshot';
    if (options.interactive) args += ' --interactive';
    if (options.compact) args += ' --compact';
    const output = this.exec(args);
    
    // For interactive mode, extract just the snapshot text
    try {
      const result = this.parseJson<{ snapshot?: string }>(output);
      return result.snapshot || output;
    } catch {
      return output;
    }
  }

  /**
   * Click an element by ref
   */
  async click(ref: string | number): Promise<void> {
    this.exec(`click ${ref}`);
  }

  /**
   * Type text into an element
   */
  async type(ref: string | number, text: string, options: { submit?: boolean } = {}): Promise<void> {
    let args = `type ${ref} "${text}"`;
    if (options.submit) args += ' --submit';
    this.exec(args);
  }

  /**
   * Press a key
   */
  async press(key: string): Promise<void> {
    this.exec(`press ${key}`);
  }

  /**
   * Wait for a condition
   */
  async wait(options: {
    text?: string;
    url?: string;
    timeoutMs?: number;
    ms?: number;  // Simple timeout
  } = {}): Promise<void> {
    // Simple timeout wait
    if (options.ms) {
      await new Promise(r => setTimeout(r, options.ms));
      return;
    }
    
    let args = 'wait';
    if (options.text) args += ` --text "${options.text}"`;
    if (options.url) args += ` --url "${options.url}"`;
    if (options.timeoutMs) args += ` --timeout-ms ${options.timeoutMs}`;
    
    // Only run command if we have wait conditions
    if (options.text || options.url) {
      try {
        this.exec(args);
      } catch {
        // Wait command can fail, continue
      }
    }
  }

  /**
   * Take a screenshot (returns path)
   */
  async screenshot(options: { fullPage?: boolean } = {}): Promise<string> {
    let args = 'screenshot';
    if (options.fullPage) args += ' --full-page';
    const output = this.exec(args);
    // Extract path from MEDIA:<path> format
    const match = output.match(/MEDIA:(.+)/);
    return match ? match[1].trim() : output.trim();
  }

  /**
   * Get page title from snapshot
   */
  async getTitle(): Promise<string> {
    const tabs = await this.tabs();
    const currentTab = tabs.find(t => t.targetId === this.targetId);
    return currentTab?.title || '';
  }

  /**
   * Check if element exists in snapshot
   */
  async hasElement(text: string): Promise<boolean> {
    const snapshot = await this.snapshot({ interactive: true });
    return snapshot.includes(text);
  }

  /**
   * Get current URL
   */
  async getUrl(): Promise<string> {
    const tabs = await this.tabs();
    const currentTab = tabs.find(t => t.targetId === this.targetId);
    return currentTab?.url || '';
  }
}

// Singleton instance
export const browser = new BrowserHelper();
