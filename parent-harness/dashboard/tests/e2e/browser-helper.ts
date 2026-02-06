/**
 * Browser Helper for E2E Tests
 * 
 * Uses Puppeteer for browser automation (no Playwright dependency).
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export class BrowserHelper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Start the browser
   */
  async start(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
  }

  /**
   * Stop the browser
   */
  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Get the current page
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not started. Call start() first.');
    }
    return this.page;
  }

  /**
   * Navigate to a URL
   */
  async goto(url: string): Promise<void> {
    await this.getPage().goto(url, { waitUntil: 'networkidle0' });
  }

  /**
   * Wait for an element to appear
   */
  async waitFor(selector: string, timeout = 10000): Promise<void> {
    await this.getPage().waitForSelector(selector, { timeout });
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    await this.getPage().click(selector);
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string): Promise<void> {
    await this.getPage().type(selector, text);
  }

  /**
   * Get element text content
   */
  async getText(selector: string): Promise<string | null> {
    const element = await this.getPage().$(selector);
    if (!element) return null;
    return element.evaluate(el => el.textContent);
  }

  /**
   * Check if element exists
   */
  async exists(selector: string): Promise<boolean> {
    const element = await this.getPage().$(selector);
    return element !== null;
  }

  /**
   * Get current URL
   */
  getUrl(): string {
    return this.getPage().url();
  }

  /**
   * Take a screenshot
   */
  async screenshot(path: string): Promise<void> {
    await this.getPage().screenshot({ path });
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(): Promise<void> {
    await this.getPage().waitForNavigation({ waitUntil: 'networkidle0' });
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.getPage().title();
  }

  /**
   * Simple wait
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const browser = new BrowserHelper();
