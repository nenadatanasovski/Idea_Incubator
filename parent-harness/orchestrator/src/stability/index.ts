/**
 * Orchestrator Stability Layer
 *
 * Provides crash resilience, logging, and self-healing capabilities.
 *
 * First Principles:
 * 1. Never crash - catch everything
 * 2. Log everything - persist for forensics
 * 3. Auto-recover - restart on failure
 * 4. Clean state - proper startup/shutdown
 * 5. Self-monitor - detect if stuck
 */

import * as fs from "fs";
import * as path from "path";
import { events } from "../db/events.js";

// Stability state
interface StabilityState {
  startedAt: string;
  lastHeartbeat: string;
  tickCount: number;
  crashCount: number;
  lastCrashAt: string | null;
  lastCrashReason: string | null;
  pid: number;
}

const STABILITY_FILE = path.join(
  process.env.HOME || "/tmp",
  ".harness",
  "stability.json",
);
const CRASH_LOG_FILE = path.join(
  process.env.HOME || "/tmp",
  ".harness",
  "crash.log",
);
const MAX_CRASH_LOG_SIZE = 10 * 1024 * 1024; // 10MB

let state: StabilityState = {
  startedAt: new Date().toISOString(),
  lastHeartbeat: new Date().toISOString(),
  tickCount: 0,
  crashCount: 0,
  lastCrashAt: null,
  lastCrashReason: null,
  pid: process.pid,
};

/**
 * Initialize stability layer
 * Call this at the very start of server.ts
 */
export function initStability(): void {
  // Ensure directory exists
  const dir = path.dirname(STABILITY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check for previous crash
  if (fs.existsSync(STABILITY_FILE)) {
    try {
      const prevState = JSON.parse(
        fs.readFileSync(STABILITY_FILE, "utf-8"),
      ) as StabilityState;

      // If previous instance didn't shutdown cleanly, it crashed
      if (prevState.pid !== process.pid) {
        const crashReason = `Previous instance (PID ${prevState.pid}) crashed or was killed`;
        logCrash(crashReason, { prevState });

        state.crashCount = prevState.crashCount + 1;
        state.lastCrashAt = prevState.lastHeartbeat;
        state.lastCrashReason = crashReason;

        console.log(
          `⚠️ Recovered from crash. Total crashes: ${state.crashCount}`,
        );
        console.log(`   Last crash: ${state.lastCrashAt}`);
      }
    } catch (err) {
      // Corrupted state file - just continue
      console.warn("⚠️ Could not read previous stability state");
    }
  }

  // Write initial state
  saveState();

  // Set up error handlers
  setupErrorHandlers();

  // Set up graceful shutdown
  setupGracefulShutdown();

  // Start self-monitoring
  startSelfMonitor();

  console.log("🛡️ Stability layer initialized");
}

/**
 * Record a successful tick (call this at end of each tick)
 */
export function recordTick(tickNumber: number): void {
  state.tickCount = tickNumber;
  state.lastHeartbeat = new Date().toISOString();
  saveState();
}

/**
 * Get stability stats
 */
export function getStabilityStats(): StabilityState {
  return { ...state };
}

/**
 * Log a crash to file
 */
function logCrash(reason: string, context?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    reason,
    context,
    pid: process.pid,
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };

  const logLine = JSON.stringify(entry) + "\n";

  try {
    // Rotate log if too large
    if (fs.existsSync(CRASH_LOG_FILE)) {
      const stats = fs.statSync(CRASH_LOG_FILE);
      if (stats.size > MAX_CRASH_LOG_SIZE) {
        const backup = CRASH_LOG_FILE + ".old";
        if (fs.existsSync(backup)) fs.unlinkSync(backup);
        fs.renameSync(CRASH_LOG_FILE, backup);
      }
    }

    fs.appendFileSync(CRASH_LOG_FILE, logLine);
  } catch (err) {
    console.error("Failed to write crash log:", err);
  }

  // Also log to observability events
  try {
    events.systemError?.("stability", reason);
  } catch {
    // DB might be unavailable during crash
  }
}

/**
 * Save state to file
 */
function saveState(): void {
  try {
    fs.writeFileSync(STABILITY_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("Failed to save stability state:", err);
  }
}

/**
 * Clear state on clean shutdown
 */
function clearState(): void {
  try {
    if (fs.existsSync(STABILITY_FILE)) {
      fs.unlinkSync(STABILITY_FILE);
    }
  } catch (err) {
    console.error("Failed to clear stability state:", err);
  }
}

/**
 * Set up comprehensive error handlers
 */
function setupErrorHandlers(): void {
  // Uncaught exceptions
  process.on("uncaughtException", (error: Error) => {
    const reason = `Uncaught exception: ${error.message}`;
    console.error("❌ [CRASH] " + reason);
    console.error(error.stack);

    logCrash(reason, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });

    // DON'T exit - try to keep running
    // But increment crash count
    state.crashCount++;
    state.lastCrashAt = new Date().toISOString();
    state.lastCrashReason = reason;
    saveState();
  });

  // Unhandled promise rejections
  process.on(
    "unhandledRejection",
    (reason: unknown, promise: Promise<unknown>) => {
      const reasonStr =
        reason instanceof Error
          ? `${reason.message}\n${reason.stack}`
          : String(reason);

      console.error("❌ [REJECTION] Unhandled promise rejection:", reasonStr);

      logCrash("Unhandled promise rejection", {
        reason: reasonStr,
      });

      // DON'T exit - try to keep running
    },
  );

  // Warning handler
  process.on("warning", (warning: Error) => {
    console.warn("⚠️ [WARNING]", warning.name, warning.message);

    // Log memory warnings especially
    if (
      warning.name === "MaxListenersExceededWarning" ||
      warning.message.includes("memory")
    ) {
      logCrash("Warning: " + warning.message, {
        memory: process.memoryUsage(),
      });
    }
  });
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

    // Clear state file to indicate clean shutdown
    clearState();

    // Give time for cleanup
    setTimeout(() => {
      console.log("👋 Goodbye!");
      process.exit(0);
    }, 1000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Self-monitoring - detect if orchestrator is stuck
 */
function startSelfMonitor(): void {
  const SELF_CHECK_INTERVAL = 60_000; // Every minute
  const STUCK_THRESHOLD = 5 * 60_000; // 5 minutes without tick

  let lastTickCount = 0;
  let stuckCheckCount = 0;

  setInterval(() => {
    const now = Date.now();
    const lastHeartbeat = new Date(state.lastHeartbeat).getTime();
    const timeSinceHeartbeat = now - lastHeartbeat;

    // If no tick in 5 minutes, we might be stuck
    if (timeSinceHeartbeat > STUCK_THRESHOLD) {
      stuckCheckCount++;

      if (stuckCheckCount >= 3) {
        // Definitely stuck - log and try to recover
        const reason = `Self-monitor detected stuck state: no tick for ${Math.floor(timeSinceHeartbeat / 1000)}s`;
        console.error("🚨 " + reason);
        logCrash(reason, {
          lastTickCount: state.tickCount,
          timeSinceHeartbeat,
        });

        // Force a garbage collection if available
        if (global.gc) {
          console.log("🗑️ Forcing garbage collection...");
          global.gc();
        }

        // Reset stuck counter
        stuckCheckCount = 0;
      }
    } else {
      stuckCheckCount = 0;
    }

    // Check for tick progress
    if (state.tickCount === lastTickCount && state.tickCount > 0) {
      // No new ticks - might be a problem
      console.warn(
        `⚠️ No new ticks since last check (tick #${state.tickCount})`,
      );
    }
    lastTickCount = state.tickCount;
  }, SELF_CHECK_INTERVAL);
}

/**
 * Wrap an async function with crash protection
 */
export function crashProtect<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<T | null> {
  return fn().catch((error: Error) => {
    console.error(`❌ Crash protected error in ${context}:`, error.message);
    logCrash(`Protected crash in ${context}: ${error.message}`, {
      stack: error.stack,
    });
    return null;
  });
}

/**
 * Wrap a sync function with crash protection
 */
export function crashProtectSync<T>(fn: () => T, context: string): T | null {
  try {
    return fn();
  } catch (error) {
    const err = error as Error;
    console.error(`❌ Crash protected error in ${context}:`, err.message);
    logCrash(`Protected crash in ${context}: ${err.message}`, {
      stack: err.stack,
    });
    return null;
  }
}

export default {
  initStability,
  recordTick,
  getStabilityStats,
  crashProtect,
  crashProtectSync,
};
