// agents/ux/mcp-bridge.ts - Wrapper for Puppeteer MCP tools

import { MCPTools } from "../../types/ux.js";

/**
 * Escape single quotes in CSS selectors for safe JavaScript evaluation
 */
function escapeSelector(selector: string): string {
  return selector.replace(/'/g, "\\'");
}

/**
 * Bridge to Puppeteer MCP tools.
 * Tools must be injected at runtime since they are not available at import time.
 */
export class MCPBridge {
  private tools: MCPTools | null = null;

  setTools(tools: MCPTools): void {
    this.tools = tools;
  }

  hasTools(): boolean {
    return this.tools !== null;
  }

  private ensureTools(): MCPTools {
    if (!this.tools) {
      throw new Error("MCP tools not initialized. Call setTools() first.");
    }
    return this.tools;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<void> {
    const tools = this.ensureTools();
    await tools.navigate({ url });
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    const tools = this.ensureTools();
    await tools.click({ selector });
  }

  /**
   * Type text into an input field
   */
  async type(selector: string, text: string): Promise<void> {
    const tools = this.ensureTools();
    await tools.fill({ selector, value: text });
  }

  /**
   * Select an option in a select element
   */
  async select(selector: string, value: string): Promise<void> {
    const tools = this.ensureTools();
    await tools.select({ selector, value });
  }

  /**
   * Take a screenshot
   * @returns Screenshot name/path
   */
  async screenshot(name: string): Promise<string> {
    const tools = this.ensureTools();
    await tools.screenshot({ name });
    return name;
  }

  /**
   * Wait for a selector to appear using polling
   */
  async waitForSelector(
    selector: string,
    timeout: number = 5000,
  ): Promise<boolean> {
    const tools = this.ensureTools();
    const startTime = Date.now();
    const pollInterval = 100;
    const escapedSelector = escapeSelector(selector);

    while (Date.now() - startTime < timeout) {
      try {
        const result = await tools.evaluate({
          script: `document.querySelector('${escapedSelector}') !== null`,
        });
        if (result === true) {
          return true;
        }
      } catch {
        // Element not found yet, continue polling
      }
      await this.sleep(pollInterval);
    }

    return false;
  }

  /**
   * Evaluate JavaScript in the browser context
   */
  async evaluate<T = unknown>(script: string): Promise<T> {
    const tools = this.ensureTools();
    const result = await tools.evaluate({ script });
    return result as T;
  }

  /**
   * Hover over an element
   */
  async hover(selector: string): Promise<void> {
    const tools = this.ensureTools();
    await tools.hover({ selector });
  }

  /**
   * Get the page title
   */
  async getTitle(): Promise<string> {
    return this.evaluate<string>("document.title");
  }

  /**
   * Get text content of an element
   */
  async getTextContent(selector: string): Promise<string | null> {
    const escaped = escapeSelector(selector);
    return this.evaluate<string | null>(
      `document.querySelector('${escaped}')?.textContent || null`,
    );
  }

  /**
   * Check if an element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    const escaped = escapeSelector(selector);
    return this.evaluate<boolean>(
      `document.querySelector('${escaped}') !== null`,
    );
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.evaluate<string>("window.location.href");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a mock bridge for testing
 */
export function createMockBridge(): MCPBridge {
  const bridge = new MCPBridge();
  const mockTools: MCPTools = {
    navigate: async () => {},
    click: async () => {},
    fill: async () => {},
    select: async () => {},
    screenshot: async () => {},
    evaluate: async () => true,
    hover: async () => {},
  };
  bridge.setTools(mockTools);
  return bridge;
}
