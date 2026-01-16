// agents/ux/screenshot-manager.ts - Screenshot capture and storage

import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import { MCPBridge } from "./mcp-bridge.js";

const DEFAULT_SCREENSHOT_DIR = "screenshots/ux-runs";

export class ScreenshotManager {
  private baseDir: string;

  constructor(baseDir: string = DEFAULT_SCREENSHOT_DIR) {
    this.baseDir = baseDir;
  }

  /**
   * Get the directory for a specific run's screenshots
   */
  getRunDir(runId: string): string {
    return join(this.baseDir, runId);
  }

  /**
   * Ensure the screenshot directory exists
   */
  private ensureDir(runId: string): string {
    const runDir = this.getRunDir(runId);
    if (!existsSync(runDir)) {
      mkdirSync(runDir, { recursive: true });
    }
    return runDir;
  }

  /**
   * Generate a unique screenshot filename
   */
  generateFilename(
    _runId: string,
    stepIndex: number,
    description?: string,
  ): string {
    const paddedIndex = String(stepIndex).padStart(3, "0");
    const safeName = description
      ? `-${description
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 30)}`
      : "";
    return `${paddedIndex}${safeName}.png`;
  }

  /**
   * Capture a screenshot for a step
   */
  async capture(
    bridge: MCPBridge,
    runId: string,
    stepIndex: number,
    description?: string,
  ): Promise<string> {
    const runDir = this.ensureDir(runId);
    const filename = this.generateFilename(runId, stepIndex, description);
    const filepath = join(runDir, filename);

    // Use MCP bridge to capture screenshot
    // The screenshot tool saves to a location, we reference by name
    await bridge.screenshot(filepath);

    return filepath;
  }

  /**
   * Get all screenshots for a run
   */
  getScreenshots(runId: string): string[] {
    const runDir = this.getRunDir(runId);
    if (!existsSync(runDir)) {
      return [];
    }

    return readdirSync(runDir)
      .filter((f) => f.endsWith(".png"))
      .sort()
      .map((f) => join(runDir, f));
  }

  /**
   * Clean up old screenshots
   * @returns Number of files deleted
   */
  cleanup(olderThanDays: number): number {
    if (!existsSync(this.baseDir)) {
      return 0;
    }

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const runDirs = readdirSync(this.baseDir);
    for (const runDir of runDirs) {
      const runPath = join(this.baseDir, runDir);
      const stat = statSync(runPath);

      if (stat.isDirectory() && stat.mtime.getTime() < cutoffTime) {
        // Delete all files in the directory
        const files = readdirSync(runPath);
        for (const file of files) {
          unlinkSync(join(runPath, file));
          deletedCount++;
        }
        // Remove the empty directory
        try {
          readdirSync(runPath).length === 0 && unlinkSync(runPath);
        } catch {
          // Directory might not be empty or already removed
        }
      }
    }

    return deletedCount;
  }

  /**
   * Delete screenshots for a specific run
   */
  deleteRun(runId: string): number {
    const runDir = this.getRunDir(runId);
    if (!existsSync(runDir)) {
      return 0;
    }

    const files = readdirSync(runDir);
    let deletedCount = 0;

    for (const file of files) {
      unlinkSync(join(runDir, file));
      deletedCount++;
    }

    return deletedCount;
  }
}
