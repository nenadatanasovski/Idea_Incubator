/**
 * E2E Test Utilities
 * Helper functions for common test operations
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Wait for an element to be visible and stable
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' }
): Promise<Locator> {
  const element = page.locator(selector);
  await element.waitFor({
    timeout: options?.timeout ?? 5000,
    state: options?.state ?? 'visible',
  });
  return element;
}

/**
 * Wait for text to appear on page
 */
export async function waitForText(
  page: Page,
  text: string | RegExp,
  options?: { timeout?: number }
): Promise<void> {
  await expect(page.getByText(text)).toBeVisible({ timeout: options?.timeout ?? 5000 });
}

/**
 * Wait for network requests to complete
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Fill and submit a form field
 */
export async function fillAndSubmit(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const input = page.locator(selector);
  await input.fill(value);
  await input.press('Enter');
}

/**
 * Get all text content from messages in chat
 */
export async function getChatMessages(page: Page): Promise<string[]> {
  const messages = page.locator('[data-testid="message"], .chat-message');
  const count = await messages.count();
  const texts: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const text = await messages.nth(i).textContent();
    if (text) texts.push(text.trim());
  }
  
  return texts;
}

/**
 * Send a message in the chat panel
 */
export async function sendChatMessage(page: Page, message: string): Promise<void> {
  // Try different input selectors
  const inputSelectors = [
    'textarea[name="message"]',
    'input[type="text"][placeholder*="message"]',
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="thoughts"]',
    '.chat-input textarea',
    '.chat-input input',
  ];

  let input: Locator | null = null;
  
  for (const selector of inputSelectors) {
    const elem = page.locator(selector).first();
    if (await elem.isVisible().catch(() => false)) {
      input = elem;
      break;
    }
  }

  if (!input) {
    // Fallback to any textarea or input in the chat area
    input = page.locator('form textarea, form input[type="text"]').first();
  }

  await input.fill(message);
  await input.press('Enter');
}

/**
 * Wait for AI response in chat
 */
export async function waitForAIResponse(page: Page, timeout = 30000): Promise<void> {
  // Wait for streaming indicator to appear and disappear
  const streamingIndicator = page.locator('[data-testid="streaming-indicator"], .animate-spin').first();
  
  // Check if streaming indicator appears (might already be done)
  const appeared = await streamingIndicator.isVisible().catch(() => false);
  
  if (appeared) {
    // Wait for it to disappear
    await expect(streamingIndicator).not.toBeVisible({ timeout });
  } else {
    // Just wait a bit for any async response
    await page.waitForTimeout(1000);
  }
}

/**
 * Navigate to an idea page
 */
export async function navigateToIdea(page: Page, ideaId: string): Promise<void> {
  await page.goto(`/idea/${ideaId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Check if phase indicator shows expected phase
 */
export async function checkPhase(page: Page, expectedPhase: string): Promise<void> {
  const phaseIndicator = page.locator('[data-testid="phase-indicator"], .phase-indicator, [class*="phase"]').first();
  await expect(phaseIndicator).toContainText(new RegExp(expectedPhase, 'i'), { timeout: 5000 });
}

/**
 * Check if an element is scrolled to bottom
 */
export async function isScrolledToBottom(element: Locator): Promise<boolean> {
  return await element.evaluate((el) => {
    return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 10;
  });
}

/**
 * Get viewport size
 */
export async function getViewportSize(page: Page): Promise<{ width: number; height: number }> {
  const size = page.viewportSize();
  return size ?? { width: 1280, height: 720 };
}

/**
 * Check if element has specific CSS class
 */
export async function hasClass(element: Locator, className: string): Promise<boolean> {
  const classes = await element.getAttribute('class');
  return classes?.includes(className) ?? false;
}

/**
 * Get element's computed width
 */
export async function getComputedWidth(element: Locator): Promise<number> {
  return await element.evaluate((el) => {
    return parseFloat(getComputedStyle(el).width);
  });
}

/**
 * Assert loading state is gone
 */
export async function waitForLoadingComplete(page: Page, timeout = 10000): Promise<void> {
  const loadingSelectors = [
    '[data-testid="loading"]',
    '.animate-spin',
    'text="Loading..."',
    '[class*="loading"]',
  ];

  for (const selector of loadingSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible().catch(() => false)) {
      await expect(element).not.toBeVisible({ timeout });
    }
  }
}

/**
 * Click a button by its text
 */
export async function clickButton(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(text, 'i') }).click();
}

/**
 * Check if toast/notification is visible
 */
export async function checkToast(page: Page, text: string | RegExp): Promise<void> {
  const toast = page.locator('[role="alert"], .toast, [class*="notification"]').filter({
    hasText: text,
  });
  await expect(toast.first()).toBeVisible({ timeout: 5000 });
}

/**
 * Close any visible modals/dialogs
 */
export async function closeModals(page: Page): Promise<void> {
  const closeButtons = page.locator('[data-testid="close-modal"], button[aria-label="Close"], .modal-close');
  const count = await closeButtons.count();
  
  for (let i = 0; i < count; i++) {
    if (await closeButtons.nth(i).isVisible()) {
      await closeButtons.nth(i).click();
    }
  }
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}

/**
 * Mock API response for a specific endpoint
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: object,
  options?: { status?: number; delay?: number }
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    if (options?.delay) {
      await page.waitForTimeout(options.delay);
    }
    await route.fulfill({
      status: options?.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Get task list items from build progress
 */
export async function getBuildTasks(page: Page): Promise<Array<{ name: string; status: string }>> {
  const taskItems = page.locator('[data-testid="task-item"], .task-item, [class*="task"]');
  const count = await taskItems.count();
  const tasks: Array<{ name: string; status: string }> = [];

  for (let i = 0; i < count; i++) {
    const item = taskItems.nth(i);
    const name = await item.locator('.task-name, [class*="name"]').first().textContent() || '';
    const status = await item.getAttribute('data-status') || 'unknown';
    tasks.push({ name: name.trim(), status });
  }

  return tasks;
}
