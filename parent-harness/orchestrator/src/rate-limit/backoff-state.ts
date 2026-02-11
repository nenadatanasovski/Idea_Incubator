/**
 * Rate Limit Backoff State (Shared Module)
 *
 * FIXES:
 * - P0 #2: Circular dependency - extracted to separate module
 * - P1 #9: Frequency-based backoff escalation
 *
 * This module is imported by both orchestrator and spawner to avoid
 * circular dependencies.
 */

// ============ CONSTANTS ============

const MAX_BACKOFF_MS = 900000; // Max 15 minutes
const ESCALATION_WINDOW = 300000; // 5 minutes
const ESCALATION_THRESHOLD = 3; // 3 rate limits in 5 min = escalate

// ============ STATE ============

let rateLimitBackoffUntil = 0;
let rateLimitBackoffMs = 60000; // Start with 1 minute
let rateLimitHistory: number[] = []; // timestamps of recent rate limits
let consecutiveRateLimits = 0;

// ============ FUNCTIONS ============

/**
 * Set rate limit backoff
 *
 * FIXES:
 * - P1 #9: Tracks frequency of rate limits, not just time since last
 */
export function setRateLimitBackoff(durationMs?: number): void {
  const now = Date.now();

  // Add to history
  rateLimitHistory.push(now);

  // Keep only last 5 minutes
  rateLimitHistory = rateLimitHistory.filter(
    (t) => now - t < ESCALATION_WINDOW,
  );

  // Count rate limits in window
  const rateLimitsInWindow = rateLimitHistory.length;

  // Escalate if frequent (3+ in 5 minutes)
  if (rateLimitsInWindow >= ESCALATION_THRESHOLD) {
    consecutiveRateLimits++;
  } else {
    consecutiveRateLimits = 1; // Reset to 1, not 0 (still rate limited)
  }

  // Calculate exponential backoff: 1min, 2min, 4min, 8min, max 15min
  const calculatedBackoff = Math.min(
    60000 * Math.pow(2, consecutiveRateLimits - 1),
    MAX_BACKOFF_MS,
  );

  const backoff = durationMs || calculatedBackoff;
  rateLimitBackoffUntil = now + backoff;
  rateLimitBackoffMs = backoff;

  console.log(
    `⏸️ Rate limit backoff #${consecutiveRateLimits} (${rateLimitsInWindow} in 5min): ${backoff / 1000}s`,
  );

  // Notify via Telegram on severe cases (3+ consecutive)
  if (consecutiveRateLimits >= 3) {
    // Import notify dynamically to avoid circular deps
    import("../telegram/index.js")
      .then(({ notify }) => {
        notify.forwardError?.(
          "rate_limit",
          `⚠️ Repeated rate limits (${consecutiveRateLimits}x) - backed off ${backoff / 1000}s`,
        );
      })
      .catch(() => {
        // Telegram notify not available, ignore
      });
  }
}

/**
 * Clear rate limit backoff
 */
export function clearRateLimitBackoff(): void {
  const wasLimited = rateLimitBackoffUntil > 0;
  rateLimitBackoffUntil = 0;

  if (wasLimited) {
    console.log(
      `✅ Rate limit backoff cleared (was ${consecutiveRateLimits} consecutive)`,
    );
  }

  // Don't reset consecutiveRateLimits here - let time-based reset handle it
  // This allows the system to remember persistent rate limit patterns
}

/**
 * Check if currently rate limited
 */
export function isRateLimited(): boolean {
  const limited = Date.now() < rateLimitBackoffUntil;

  // Auto-clear when backoff expires
  if (!limited && rateLimitBackoffUntil > 0) {
    clearRateLimitBackoff();
  }

  return limited;
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(): {
  isLimited: boolean;
  backoffUntil: number;
  remainingMs: number;
  consecutiveCount: number;
  historyCount: number;
} {
  const now = Date.now();
  return {
    isLimited: isRateLimited(),
    backoffUntil: rateLimitBackoffUntil,
    remainingMs: Math.max(0, rateLimitBackoffUntil - now),
    consecutiveCount: consecutiveRateLimits,
    historyCount: rateLimitHistory.length,
  };
}

/**
 * Reset all backoff state (for testing)
 */
export function resetBackoffState(): void {
  rateLimitBackoffUntil = 0;
  rateLimitBackoffMs = 60000;
  rateLimitHistory = [];
  consecutiveRateLimits = 0;
  console.log("🔄 Rate limit backoff state reset");
}
