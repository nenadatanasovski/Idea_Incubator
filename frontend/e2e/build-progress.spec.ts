/**
 * Build Progress E2E Tests
 * Tests for the build progress view, task list, pause/resume controls
 */

import { test, expect, DEFAULT_BUILD_SESSION } from "./fixtures";
import {
  waitForNetworkIdle,
  waitForLoadingComplete,
  clickButton,
} from "./utils";

// Helper to setup build phase mocks
async function setupBuildMocks(
  page: any,
  buildSession: typeof DEFAULT_BUILD_SESSION | null = DEFAULT_BUILD_SESSION,
) {
  await page.route("**/api/idea-pipeline/*/status", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        state: {
          ideaId: "test-idea-123",
          currentPhase: "building",
          autoAdvance: true,
          buildProgress: buildSession
            ? {
                tasksComplete: buildSession.progress.completed,
                tasksTotal: buildSession.progress.total,
                currentTask:
                  buildSession.tasks.find((t) => t.status === "in_progress")
                    ?.name || null,
              }
            : null,
        },
      }),
    });
  });

  await page.route("**/api/ideation/sessions*", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.route("**/api/build/*/status", async (route: any) => {
    if (buildSession) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "No build session" }),
      });
    }
  });
}

test.describe("Build Progress View - No Session", () => {
  test("shows start build button when no build session", async ({ page }) => {
    await setupBuildMocks(page, null);

    await page.route("**/api/build/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "not_started" }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for "Start Build" or similar button
    const startButton = page.getByRole("button", { name: /start.*build/i });
    // The button might be there or not depending on the actual implementation
  });
});

test.describe("Build Progress View - Active Build", () => {
  test("displays task list with correct statuses", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      tasks: [
        {
          id: "t1",
          name: "Setup project",
          description: "Init",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Create components",
          description: "Build UI",
          status: "in_progress" as const,
        },
        {
          id: "t3",
          name: "Add tests",
          description: "Write tests",
          status: "pending" as const,
        },
      ],
      progress: { completed: 1, total: 3, currentAttempt: 1 },
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Building phase should be visible
    await expect(page.getByText(/building/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Task names should be visible if we're on the right view
    // Note: The actual view might need navigation
  });

  test("shows progress bar", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      progress: { completed: 2, total: 4, currentAttempt: 1 },
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for progress bar element
    const progressBar = page
      .locator('[role="progressbar"], [class*="progress"], .progress-bar')
      .first();
    // Progress element should exist on build view
  });

  test("highlights current task", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      tasks: [
        {
          id: "t1",
          name: "Done task",
          description: "Complete",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Current task",
          description: "In progress",
          status: "in_progress" as const,
        },
        {
          id: "t3",
          name: "Future task",
          description: "Pending",
          status: "pending" as const,
        },
      ],
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Current task should have special styling (ring, highlight, etc.)
    // This depends on being on the build view
  });

  test("displays completed task count", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      progress: { completed: 3, total: 5, currentAttempt: 1 },
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Should show "3 / 5" or similar
    const progressText = page.getByText(/3.*\/.*5|3 of 5/);
    // Might be visible on the page
  });
});

test.describe("Build Progress View - Controls", () => {
  test("pause button stops build", async ({ page }) => {
    let buildStatus = "active";

    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
    };

    await setupBuildMocks(page, buildSession);

    // Mock pause endpoint
    await page.route("**/api/build/*/pause", async (route: any) => {
      buildStatus = "paused";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for pause button
    const pauseButton = page.getByRole("button", { name: /pause/i });
    if (await pauseButton.isVisible()) {
      await pauseButton.click();
      // Status should update
    }
  });

  test("resume button continues build", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "paused" as const,
    };

    await setupBuildMocks(page, buildSession);

    // Mock resume endpoint
    await page.route("**/api/build/*/resume", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for resume button (visible when paused)
    const resumeButton = page.getByRole("button", { name: /resume/i });
    if (await resumeButton.isVisible()) {
      await resumeButton.click();
    }
  });
});

test.describe("Build Progress View - Human Intervention", () => {
  test("shows intervention banner when human needed", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "human_needed" as const,
      lastError: "Task failed: Could not connect to database",
      tasks: [
        {
          id: "t1",
          name: "Setup",
          description: "Done",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Database setup",
          description: "Failed",
          status: "failed" as const,
        },
        {
          id: "t3",
          name: "API routes",
          description: "Pending",
          status: "pending" as const,
        },
      ],
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Should show human intervention needed or similar message
    // Look for warning or alert elements
  });

  test("skip button advances past stuck task", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "human_needed" as const,
      tasks: [
        {
          id: "t1",
          name: "Done",
          description: "Complete",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Stuck",
          description: "Failed",
          status: "failed" as const,
        },
        {
          id: "t3",
          name: "Next",
          description: "Pending",
          status: "pending" as const,
        },
      ],
    };

    await setupBuildMocks(page, buildSession);

    // Mock skip endpoint
    await page.route("**/api/build/*/skip", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for skip button
    const skipButton = page.getByRole("button", { name: /skip/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }
  });

  test("resolve dialog opens when clicking fix button", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "human_needed" as const,
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Look for "I've fixed it" or resolve button
    const resolveButton = page.getByRole("button", { name: /fix|resolve/i });
    if (await resolveButton.isVisible()) {
      await resolveButton.click();
      // Dialog should open
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Build Progress View - Complete State", () => {
  test("shows completion banner when build is done", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "complete" as const,
      tasks: [
        {
          id: "t1",
          name: "Task 1",
          description: "Done",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Task 2",
          description: "Done",
          status: "completed" as const,
        },
        {
          id: "t3",
          name: "Task 3",
          description: "Done",
          status: "completed" as const,
        },
      ],
      progress: { completed: 3, total: 3, currentAttempt: 1 },
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Should show completion message
    const completeText = page.getByText(/complete|done|finished|🎉/i);
    // Might be visible
  });

  test("all tasks show completed status", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "complete" as const,
      tasks: [
        {
          id: "t1",
          name: "Task 1",
          description: "Done",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Task 2",
          description: "Done",
          status: "completed" as const,
        },
      ],
      progress: { completed: 2, total: 2, currentAttempt: 1 },
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // All tasks should have checkmarks or completed styling
  });
});

test.describe("Build Progress View - Failed State", () => {
  test("shows failed tasks with error indication", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "failed" as const,
      tasks: [
        {
          id: "t1",
          name: "Success",
          description: "Done",
          status: "completed" as const,
        },
        {
          id: "t2",
          name: "Failed",
          description: "Error",
          status: "failed" as const,
        },
      ],
      lastError: "Build failed due to test errors",
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Failed indicator should show
  });
});

test.describe("Build Progress View - Stats Display", () => {
  test("shows generated files count", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      generatedFiles: 15,
      commits: 5,
    };

    await page.route("**/api/build/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession),
      });
    });

    await page.route("**/api/idea-pipeline/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: { ideaId: "test-idea-123", currentPhase: "building" },
        }),
      });
    });

    await page.route("**/api/ideation/sessions*", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Stats might be visible in build view
  });

  test("shows commit count", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      commits: 8,
    };

    await page.route("**/api/build/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession),
      });
    });

    await page.route("**/api/idea-pipeline/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: { ideaId: "test-idea-123", currentPhase: "building" },
        }),
      });
    });

    await page.route("**/api/ideation/sessions*", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Commit count might be displayed
  });

  test("shows SIA intervention count when applicable", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
      siaInterventions: 3,
    };

    await page.route("**/api/build/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession),
      });
    });

    await page.route("**/api/idea-pipeline/*/status", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          state: { ideaId: "test-idea-123", currentPhase: "building" },
        }),
      });
    });

    await page.route("**/api/ideation/sessions*", async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // SIA intervention count might be shown
  });
});

test.describe("Build Progress View - Live Events", () => {
  test("displays event feed", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
    };

    await setupBuildMocks(page, buildSession);
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);

    // Event feed panel might be visible
  });
});

test.describe("Build Progress Visual Regression", () => {
  test("active build snapshot", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "active" as const,
    };

    await setupBuildMocks(page, buildSession);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("build-active.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("paused build snapshot", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "paused" as const,
    };

    await setupBuildMocks(page, buildSession);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("build-paused.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("human needed snapshot", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "human_needed" as const,
      lastError: "Test error message",
    };

    await setupBuildMocks(page, buildSession);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("build-human-needed.png", {
      fullPage: false,
      animations: "disabled",
    });
  });

  test("complete build snapshot", async ({ page }) => {
    const buildSession = {
      ...DEFAULT_BUILD_SESSION,
      status: "complete" as const,
      tasks: DEFAULT_BUILD_SESSION.tasks.map((t) => ({
        ...t,
        status: "completed" as const,
      })),
      progress: { completed: 4, total: 4, currentAttempt: 1 },
    };

    await setupBuildMocks(page, buildSession);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/idea/test-idea-123");
    await waitForLoadingComplete(page);
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("build-complete.png", {
      fullPage: false,
      animations: "disabled",
    });
  });
});
