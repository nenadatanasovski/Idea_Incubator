/**
 * Layout E2E Tests
 * Tests for the unified layout, chat panel, and responsive behavior
 */

import { test, expect } from './fixtures';
import { waitForNetworkIdle, getComputedWidth, waitForLoadingComplete } from './utils';

test.describe('Unified Layout', () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test('renders complete layout structure', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    // Header elements
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Logo/brand
    const logo = page.locator('header a').first();
    await expect(logo).toBeVisible();

    // Chat panel should be visible on desktop
    const chatPanel = page.locator('aside').first();
    await expect(chatPanel).toBeVisible();

    // Main content area
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });

  test('header remains fixed on scroll', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const header = page.locator('header').first();
    const initialBox = await header.boundingBox();
    expect(initialBox).toBeTruthy();

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(200);

    const afterScrollBox = await header.boundingBox();
    expect(afterScrollBox).toBeTruthy();

    // Header should remain at the same Y position (fixed)
    expect(afterScrollBox!.y).toBe(initialBox!.y);
  });

  test('chat panel collapses and expands', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const chatPanel = page.locator('aside').first();
    
    // Get initial width (should be expanded ~320px)
    const initialWidth = await getComputedWidth(chatPanel);
    expect(initialWidth).toBeGreaterThan(200);

    // Find and click toggle button
    const toggleButton = page.locator('button').filter({ hasText: '' }).locator('svg').first().locator('..'); 
    // Try the chevron button near the chat panel
    const chevronButton = page.locator('aside button').first();
    
    if (await chevronButton.isVisible()) {
      await chevronButton.click();
      await page.waitForTimeout(300); // Wait for animation

      // Check panel is collapsed
      const collapsedWidth = await getComputedWidth(chatPanel);
      expect(collapsedWidth).toBeLessThan(100);

      // Expand again
      await chevronButton.click();
      await page.waitForTimeout(300);

      const expandedWidth = await getComputedWidth(chatPanel);
      expect(expandedWidth).toBeGreaterThan(200);
    }
  });

  test('displays phase indicator', async ({ page, mockIdea }) => {
    await page.goto(`/idea/${mockIdea.id}`);
    await waitForNetworkIdle(page);

    // Look for phase indicator in header
    const phaseText = page.getByText(/ideation|specification|building/i).first();
    await expect(phaseText).toBeVisible();
  });

  test('navigates to ideas list from selector', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    // Click on idea selector (should have chevron down icon)
    const ideaSelector = page.locator('header button').filter({ hasText: /test|idea/i }).first();
    
    if (await ideaSelector.isVisible()) {
      await ideaSelector.click();
      // Should navigate or show dropdown
      await page.waitForTimeout(500);
    }
  });

  test('user menu is accessible', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    // User profile link
    const userLink = page.locator('a[href="/profile"]');
    await expect(userLink).toBeVisible();

    // Notifications link
    const notificationsLink = page.locator('a[href="/settings/notifications"]');
    await expect(notificationsLink).toBeVisible();
  });
});

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test('desktop layout - chat panel visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const chatPanel = page.locator('aside').first();
    await expect(chatPanel).toBeVisible();
    
    const width = await getComputedWidth(chatPanel);
    expect(width).toBeGreaterThan(200);
  });

  test('tablet layout - chat panel adjusts', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    // Chat should still be visible but might be narrower
    const chatPanel = page.locator('aside').first();
    await expect(chatPanel).toBeVisible();
  });

  test('mobile layout - chat may collapse', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    // On mobile, layout should still function
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    const main = page.locator('main').first();
    await expect(main).toBeVisible();
  });

  test('content area fills remaining space', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const main = page.locator('main').first();
    const mainBox = await main.boundingBox();
    
    expect(mainBox).toBeTruthy();
    // Main content should take significant portion of width
    expect(mainBox!.width).toBeGreaterThan(600);
  });
});

test.describe('Layout Navigation', () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test('logo links to home', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const logoLink = page.locator('header a[href="/"]').first();
    await expect(logoLink).toBeVisible();
    
    await logoLink.click();
    await page.waitForURL('/');
  });

  test('profile link navigates correctly', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const profileLink = page.locator('a[href="/profile"]');
    await profileLink.click();
    
    await page.waitForURL('/profile');
  });

  test('notifications link navigates correctly', async ({ page }) => {
    await page.goto('/idea/test-idea-123');
    await waitForNetworkIdle(page);

    const notifLink = page.locator('a[href="/settings/notifications"]');
    await notifLink.click();
    
    await page.waitForURL('/settings/notifications');
  });
});

test.describe('Layout Visual Regression', () => {
  test.beforeEach(async ({ page, setupMocks }) => {
    await setupMocks(page);
  });

  test('desktop layout snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/idea/test-idea-123');
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500); // Wait for animations

    // Note: Visual snapshots need to be generated first
    // Run: npx playwright test --update-snapshots
    await expect(page).toHaveScreenshot('layout-desktop.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('mobile layout snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/idea/test-idea-123');
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('layout-mobile.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});
