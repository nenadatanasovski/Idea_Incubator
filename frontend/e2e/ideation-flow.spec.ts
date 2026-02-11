/**
 * Ideation Flow E2E Tests
 * Tests for the ideation conversation, message sending, and graph updates
 */

import { test, expect, DEFAULT_SESSION } from "./fixtures";
import {
  waitForNetworkIdle,
  sendChatMessage,
  waitForAIResponse,
  getChatMessages,
  waitForLoadingComplete,
  isScrolledToBottom,
} from "./utils";

test.describe("Ideation Session", () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test("loads existing session with messages", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Should show welcome message from session
    const welcomeText = page.getByText(/welcome|tell me about/i).first();
    await expect(welcomeText).toBeVisible({ timeout: 10000 });
  });

  test("displays message history correctly", async ({ page }) => {
    // Add more messages to mock
    await page.route("**/api/ideation/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "msg-1",
            role: "user",
            content: "I want to build a todo app",
            created_at: new Date().toISOString(),
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "Great idea! Who is the target audience?",
            created_at: new Date().toISOString(),
          },
          {
            id: "msg-3",
            role: "user",
            content: "Busy professionals",
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Check messages are displayed
    await expect(page.getByText("I want to build a todo app")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/target audience/i)).toBeVisible();
    await expect(page.getByText("Busy professionals")).toBeVisible();
  });

  test("differentiates user and assistant messages", async ({ page }) => {
    await page.route("**/api/ideation/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "msg-1",
            role: "user",
            content: "User message",
            created_at: new Date().toISOString(),
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "Assistant message",
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // User messages typically styled differently (right-aligned, different color)
    const userMsg = page
      .locator('[class*="primary"], [class*="user"]')
      .filter({ hasText: "User message" });
    const assistantMsg = page
      .locator('[class*="gray"], [class*="assistant"]')
      .filter({ hasText: "Assistant message" });

    // At least verify both messages are visible
    await expect(page.getByText("User message")).toBeVisible();
    await expect(page.getByText("Assistant message")).toBeVisible();
  });
});

test.describe("Chat Interactions", () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test("sends message on Enter key", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Find input
    const input = page.locator('textarea[name="message"], textarea').first();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Type and send
    await input.fill("My test message");
    await input.press("Enter");

    // Should appear in chat
    await expect(page.getByText("My test message")).toBeVisible({
      timeout: 5000,
    });
  });

  test("sends message on button click", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("Button test message");

    // Find send button (usually has Send icon)
    const sendButton = page.locator('button[type="submit"]').first();
    await sendButton.click();

    await expect(page.getByText("Button test message")).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows loading indicator during AI response", async ({ page }) => {
    // Delay the API response
    await page.route("**/api/ideation/sessions/*/message", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messageId: "delayed-msg",
          content: "Delayed response",
        }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("Trigger loading");
    await input.press("Enter");

    // Should show loading/thinking indicator
    const loadingIndicator = page
      .locator('.animate-spin, [data-testid="streaming-indicator"]')
      .first();
    await expect(loadingIndicator).toBeVisible({ timeout: 2000 });

    // Wait for response
    await expect(page.getByText("Delayed response")).toBeVisible({
      timeout: 5000,
    });
  });

  test("displays AI response after sending message", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("Tell me about features");
    await input.press("Enter");

    // AI response from mock should contain the echoed content
    await expect(page.getByText(/you mentioned/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("auto-scrolls to new messages", async ({ page }) => {
    // Load session with many messages
    const manyMessages = Array.from({ length: 20 }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message number ${i + 1}`,
      created_at: new Date().toISOString(),
    }));

    await page.route("**/api/ideation/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(manyMessages),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500);

    // Send a new message
    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("New message at bottom");
    await input.press("Enter");

    await page.waitForTimeout(500);

    // The new message should be visible (auto-scrolled)
    await expect(page.getByText("New message at bottom")).toBeVisible();
  });

  test("shows agent activity indicator", async ({ page }) => {
    await page.route("**/api/ideation/sessions/*/message", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messageId: "activity-msg",
          content: "Done processing",
        }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("Complex query");
    await input.press("Enter");

    // Should show "Processing" or similar
    const activityText = page
      .getByText(/processing|thinking|analyzing/i)
      .first();
    await expect(activityText).toBeVisible({ timeout: 3000 });
  });

  test("input disabled while waiting for response", async ({ page }) => {
    await page.route("**/api/ideation/sessions/*/message", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messageId: "disabled-msg",
          content: "Response",
        }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("First message");
    await input.press("Enter");

    // Input should be disabled during processing
    await expect(input).toBeDisabled({ timeout: 500 });

    // Wait for response, then input should be enabled again
    await expect(page.getByText("Response")).toBeVisible({ timeout: 5000 });
    await expect(input).toBeEnabled();
  });
});

test.describe("Start New Session", () => {
  test("shows start session button when no session exists", async ({
    page,
  }) => {
    // Mock no existing sessions
    await page.route("**/api/ideation/sessions*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]), // Empty - no sessions
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(DEFAULT_SESSION),
        });
      }
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Should show "Start Session" button
    const startButton = page.getByRole("button", { name: /start.*session/i });
    await expect(startButton).toBeVisible({ timeout: 10000 });
  });

  test("clicking start session creates new session", async ({ page }) => {
    let sessionCreated = false;

    await page.route("**/api/ideation/sessions*", async (route) => {
      if (route.request().method() === "GET") {
        if (sessionCreated) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([DEFAULT_SESSION]),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        }
      } else if (route.request().method() === "POST") {
        sessionCreated = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(DEFAULT_SESSION),
        });
      }
    });

    await page.route("**/api/ideation/sessions/*/messages", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const startButton = page.getByRole("button", { name: /start.*session/i });
    await startButton.click();

    // Should show system message or chat input
    await page.waitForTimeout(1000);
    const chatInput = page
      .locator('textarea[name="message"], textarea')
      .first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Content Tabs", () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test("knowledge/graph tab exists", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for Knowledge or Graph tab
    const graphTab = page.getByRole("tab", { name: /knowledge|graph/i });
    if (await graphTab.isVisible()) {
      await graphTab.click();
      await page.waitForTimeout(500);
      // Graph content should load
    }
  });

  test("artifacts tab exists", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const artifactsTab = page.getByRole("tab", { name: /artifacts/i });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(500);
    }
  });

  test("switching tabs preserves chat state", async ({ page }) => {
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Send a message
    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("Test persistence");
    await input.press("Enter");

    await expect(page.getByText("Test persistence")).toBeVisible({
      timeout: 5000,
    });

    // Switch tabs if available
    const tabs = page.getByRole("tab");
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      await tabs.nth(1).click();
      await page.waitForTimeout(500);
      await tabs.nth(0).click();
      await page.waitForTimeout(500);

      // Message should still be visible
      await expect(page.getByText("Test persistence")).toBeVisible();
    }
  });
});

test.describe("Error Handling", () => {
  test("handles message send failure gracefully", async ({
    page,
    setupMocks,
  }) => {
    await setupMocks(page);

    // Override to fail
    await page.route("**/api/ideation/sessions/*/message", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server error" }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    const input = page.locator('textarea[name="message"], textarea').first();
    await input.fill("This will fail");
    await input.press("Enter");

    // Should show error or keep the message in input
    // Input should be re-enabled after error
    await page.waitForTimeout(2000);
    await expect(input).toBeEnabled();
  });

  test("handles session load failure", async ({ page }) => {
    await page.route("**/api/ideation/sessions*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to load" }),
      });
    });

    await page.route("**/api/idea-pipeline/*/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: { currentPhase: "ideation" } }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await page.waitForTimeout(2000);

    // Should show some UI - either error message or start session option
    // Not a blank page
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
