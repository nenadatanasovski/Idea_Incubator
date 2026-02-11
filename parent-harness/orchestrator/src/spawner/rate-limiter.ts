/**
 * Per-Minute Rate Limiter (CORRECTED VERSION)
 *
 * Tracks requests and tokens per minute to prevent Anthropic API 429 errors.
 * Uses sliding window to prevent boundary gaming and atomic reservations
 * to prevent race conditions.
 *
 * FIXES APPLIED:
 * - P0 #1: Token estimation support (estimated tokens tracked before spawn)
 * - P0 #3: Sliding window instead of discrete minute buckets
 * - P0 #4: Atomic reservation system for concurrent counter
 * - P0 #7: Auto-detection of API tier limits from headers
 */

// ============ CONSTANTS ============
export const TIME_CONSTANTS = {
  MILLISECONDS_PER_MINUTE: 60000,
  MILLISECONDS_PER_SECOND: 1000,
} as const;

export const DEFAULT_SAFETY_MARGINS = {
  RPM_PERCENT: 0.7, // 70% of tier limit
  TPM_PERCENT: 0.7,
  CONCURRENT_PERCENT: 0.6, // 60% of tier limit
} as const;

// ============ TYPES ============

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrent: number;
}

export interface SpawnRecord {
  timestamp: number; // When spawn started
  estimatedTokens: number; // Estimated tokens at start
  actualTokens?: number; // Actual tokens after completion
  reservationId: string; // Unique ID for this spawn
}

export interface ApiTierLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrent: number;
  detected: boolean;
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  reservationId?: string; // If allowed, reservation ID to confirm later
  stats: {
    currentRequests: number;
    currentTokens: number;
    concurrent: number;
    reserved: number;
  };
}

// Conservative defaults (70% of Build tier: 50 RPM, 40K TPM, 5 concurrent)
const DEFAULT_LIMITS: RateLimitConfig = {
  maxRequestsPerMinute: 35, // 70% of 50 RPM
  maxTokensPerMinute: 28000, // 70% of 40K TPM
  maxConcurrent: 3, // 60% of 5 concurrent
};

// ============ SLIDING WINDOW RATE LIMITER ============

class SlidingWindowRateLimiter {
  private spawns: Map<string, SpawnRecord> = new Map();
  private limits: RateLimitConfig;
  private concurrentActive = 0;
  private concurrentReserved = 0; // Atomic reservation slots
  private detectedLimits: ApiTierLimits | null = null;
  private lastCleanup = 0;

  constructor(limits: RateLimitConfig = DEFAULT_LIMITS) {
    this.limits = limits;
    this.logInitialization();
  }

  private logInitialization(): void {
    console.log("📊 Rate limiter initialized:");
    console.log(
      `   Max Requests/min: ${this.limits.maxRequestsPerMinute} (${Math.round((this.limits.maxRequestsPerMinute / 35) * 100)}% of assumed tier)`,
    );
    console.log(
      `   Max Tokens/min: ${this.limits.maxTokensPerMinute.toLocaleString()} (${Math.round((this.limits.maxTokensPerMinute / 28000) * 100)}% of assumed tier)`,
    );
    console.log(`   Max Concurrent: ${this.limits.maxConcurrent}`);
    console.warn(
      "⚠️  VERIFY API TIER LIMITS: https://console.anthropic.com/settings/limits",
    );
  }

  /**
   * Auto-detect API tier limits from response headers
   */
  detectLimitsFromHeaders(headers: Record<string, string>): void {
    if (this.detectedLimits?.detected) {
      return; // Already detected
    }

    const limits: Partial<ApiTierLimits> = {};

    // Anthropic returns rate limit headers:
    // x-ratelimit-limit-requests: "50"
    // x-ratelimit-limit-tokens: "40000"
    if (headers["x-ratelimit-limit-requests"]) {
      limits.requestsPerMinute = parseInt(
        headers["x-ratelimit-limit-requests"],
        10,
      );
    }

    if (headers["x-ratelimit-limit-tokens"]) {
      limits.tokensPerMinute = parseInt(
        headers["x-ratelimit-limit-tokens"],
        10,
      );
    }

    if (limits.requestsPerMinute && limits.tokensPerMinute) {
      this.detectedLimits = {
        requestsPerMinute: limits.requestsPerMinute,
        tokensPerMinute: limits.tokensPerMinute,
        concurrent: 5, // Still need to guess this one
        detected: true,
      };

      // Apply safety margins
      this.updateLimits({
        maxRequestsPerMinute: Math.floor(
          limits.requestsPerMinute * DEFAULT_SAFETY_MARGINS.RPM_PERCENT,
        ),
        maxTokensPerMinute: Math.floor(
          limits.tokensPerMinute * DEFAULT_SAFETY_MARGINS.TPM_PERCENT,
        ),
      });

      console.log("✅ Auto-detected API tier limits:", this.detectedLimits);
      console.log("   Applied safety margins:", {
        rpm: `${this.limits.maxRequestsPerMinute} (${Math.round(DEFAULT_SAFETY_MARGINS.RPM_PERCENT * 100)}%)`,
        tpm: `${this.limits.maxTokensPerMinute} (${Math.round(DEFAULT_SAFETY_MARGINS.TPM_PERCENT * 100)}%)`,
      });
    }
  }

  /**
   * Get spawns in the last minute (sliding window)
   */
  private getSpawnsInLastMinute(): SpawnRecord[] {
    const now = Date.now();
    const oneMinuteAgo = now - TIME_CONSTANTS.MILLISECONDS_PER_MINUTE;

    const spawnsInWindow: SpawnRecord[] = [];
    for (const spawn of this.spawns.values()) {
      if (spawn.timestamp > oneMinuteAgo) {
        spawnsInWindow.push(spawn);
      }
    }

    return spawnsInWindow;
  }

  /**
   * Calculate current usage in sliding window
   */
  private getCurrentUsage(): {
    requests: number;
    tokens: number;
    concurrent: number;
    reserved: number;
  } {
    const spawnsInWindow = this.getSpawnsInLastMinute();

    const requests = spawnsInWindow.length;

    // Use actual tokens if available, otherwise estimated
    const tokens = spawnsInWindow.reduce((sum, spawn) => {
      return sum + (spawn.actualTokens ?? spawn.estimatedTokens);
    }, 0);

    return {
      requests,
      tokens,
      concurrent: this.concurrentActive,
      reserved: this.concurrentReserved,
    };
  }

  /**
   * Check if we can spawn AND atomically reserve a slot (thread-safe)
   *
   * FIXES:
   * - P0 #4: Atomic reservation prevents race conditions
   * - Returns reservation ID that must be confirmed
   */
  canSpawnAndReserve(estimatedTokens: number = 0): RateLimitCheck {
    const usage = this.getCurrentUsage();

    const stats = {
      currentRequests: usage.requests,
      currentTokens: usage.tokens,
      concurrent: usage.concurrent,
      reserved: usage.reserved,
    };

    // Check concurrent limit (including reserved slots)
    const totalConcurrent = this.concurrentActive + this.concurrentReserved;
    if (totalConcurrent >= this.limits.maxConcurrent) {
      return {
        allowed: false,
        reason: `Concurrent limit reached (${totalConcurrent}/${this.limits.maxConcurrent})`,
        stats,
      };
    }

    // Check per-minute request limit
    if (usage.requests >= this.limits.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Per-minute request limit (${usage.requests}/${this.limits.maxRequestsPerMinute})`,
        stats,
      };
    }

    // Check per-minute token limit (including estimated tokens for this spawn)
    const projectedTokens = usage.tokens + estimatedTokens;
    if (projectedTokens >= this.limits.maxTokensPerMinute) {
      return {
        allowed: false,
        reason: `Per-minute token limit (${projectedTokens}/${this.limits.maxTokensPerMinute} projected)`,
        stats,
      };
    }

    // ATOMIC: Reserve slot immediately
    this.concurrentReserved++;
    const reservationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.cleanup();

    return {
      allowed: true,
      reservationId,
      stats,
    };
  }

  /**
   * Confirm spawn start (call AFTER spawn begins successfully)
   *
   * FIXES:
   * - P0 #1: Records estimated tokens at spawn start
   */
  confirmSpawnStart(reservationId: string, estimatedTokens: number = 0): void {
    // Release reservation
    this.concurrentReserved = Math.max(0, this.concurrentReserved - 1);

    // Record spawn
    const spawn: SpawnRecord = {
      timestamp: Date.now(),
      estimatedTokens,
      reservationId,
    };

    this.spawns.set(reservationId, spawn);
    this.concurrentActive++;

    this.cleanup();
  }

  /**
   * Release reservation if spawn fails before starting
   */
  releaseReservation(reservationId: string): void {
    this.concurrentReserved = Math.max(0, this.concurrentReserved - 1);
  }

  /**
   * Record spawn completion with actual token usage
   *
   * FIXES:
   * - P0 #1: Adjusts estimated tokens with actual usage
   */
  recordSpawnEnd(reservationId: string, actualTokens: number): void {
    const spawn = this.spawns.get(reservationId);
    if (spawn) {
      spawn.actualTokens = actualTokens;
    } else {
      console.warn(
        `⚠️ recordSpawnEnd: unknown reservation ${reservationId} (may have been cleaned up)`,
      );
    }

    this.concurrentActive = Math.max(0, this.concurrentActive - 1);
    this.cleanup();
  }

  /**
   * Get current usage stats for monitoring
   */
  getStats(): {
    usage: {
      requests: number;
      tokens: number;
      concurrent: number;
      reserved: number;
    };
    limits: RateLimitConfig;
    utilizationPercent: {
      requests: number;
      tokens: number;
      concurrent: number;
    };
    detectedLimits: ApiTierLimits | null;
  } {
    const usage = this.getCurrentUsage();

    return {
      usage,
      limits: this.limits,
      utilizationPercent: {
        requests: (usage.requests / this.limits.maxRequestsPerMinute) * 100,
        tokens: (usage.tokens / this.limits.maxTokensPerMinute) * 100,
        concurrent:
          ((usage.concurrent + usage.reserved) / this.limits.maxConcurrent) *
          100,
      },
      detectedLimits: this.detectedLimits,
    };
  }

  /**
   * Update limits (for config changes or auto-detection)
   */
  updateLimits(limits: Partial<RateLimitConfig>): void {
    const oldLimits = { ...this.limits };
    this.limits = { ...this.limits, ...limits };

    console.log("📊 Rate limiter limits updated:");
    if (oldLimits.maxRequestsPerMinute !== this.limits.maxRequestsPerMinute) {
      console.log(
        `   Requests/min: ${oldLimits.maxRequestsPerMinute} → ${this.limits.maxRequestsPerMinute}`,
      );
    }
    if (oldLimits.maxTokensPerMinute !== this.limits.maxTokensPerMinute) {
      console.log(
        `   Tokens/min: ${oldLimits.maxTokensPerMinute} → ${this.limits.maxTokensPerMinute}`,
      );
    }
    if (oldLimits.maxConcurrent !== this.limits.maxConcurrent) {
      console.log(
        `   Concurrent: ${oldLimits.maxConcurrent} → ${this.limits.maxConcurrent}`,
      );
    }
  }

  /**
   * Clean up old spawns (keep last 5 minutes for debugging)
   */
  private cleanup(): void {
    const now = Date.now();

    // Only cleanup once per minute max
    if (now - this.lastCleanup < TIME_CONSTANTS.MILLISECONDS_PER_MINUTE) {
      return;
    }
    this.lastCleanup = now;

    const fiveMinutesAgo = now - TIME_CONSTANTS.MILLISECONDS_PER_MINUTE * 5;

    let removedCount = 0;
    for (const [id, spawn] of this.spawns.entries()) {
      if (spawn.timestamp < fiveMinutesAgo) {
        this.spawns.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(
        `🧹 Rate limiter cleanup: removed ${removedCount} old spawn records`,
      );
    }
  }

  /**
   * Reset all state (for testing)
   */
  reset(): void {
    this.spawns.clear();
    this.concurrentActive = 0;
    this.concurrentReserved = 0;
    this.lastCleanup = 0;
    this.detectedLimits = null; // Reset API tier detection
    console.log("🔄 Rate limiter reset");
  }

  /**
   * Reconcile concurrentActive with actual running process count.
   * Call periodically to correct any drift from missed recordSpawnEnd calls.
   */
  reconcileConcurrent(actualRunning: number): void {
    if (this.concurrentActive !== actualRunning) {
      console.warn(
        `⚠️ Rate limiter concurrent drift: tracked=${this.concurrentActive}, actual=${actualRunning}. Correcting.`,
      );
      this.concurrentActive = actualRunning;
    }
  }

  /**
   * Get debug info
   */
  getDebugInfo(): {
    totalSpawns: number;
    spawnsInLastMinute: number;
    oldestSpawn: number | null;
    newestSpawn: number | null;
  } {
    const spawnsInWindow = this.getSpawnsInLastMinute();
    const allSpawns = Array.from(this.spawns.values());

    return {
      totalSpawns: this.spawns.size,
      spawnsInLastMinute: spawnsInWindow.length,
      oldestSpawn:
        allSpawns.length > 0
          ? Math.min(...allSpawns.map((s) => s.timestamp))
          : null,
      newestSpawn:
        allSpawns.length > 0
          ? Math.max(...allSpawns.map((s) => s.timestamp))
          : null,
    };
  }
}

// ============ SINGLETON & INITIALIZATION ============

export const rateLimiter = new SlidingWindowRateLimiter();

let configInitialized = false;

/**
 * Initialize rate limiter from config
 *
 * FIXES:
 * - P0 #11: Proper async initialization instead of top-level await
 */
export async function initializeRateLimiter(): Promise<void> {
  if (configInitialized) {
    console.log("⏭️  Rate limiter already initialized, skipping");
    return;
  }

  try {
    const config = await import("../config/index.js");
    const cfg = config.getConfig();

    if (!cfg.rate_limit) {
      throw new Error("rate_limit config missing");
    }

    rateLimiter.updateLimits({
      maxRequestsPerMinute: cfg.rate_limit.max_requests_per_minute ?? 35,
      maxTokensPerMinute: cfg.rate_limit.max_tokens_per_minute ?? 28000,
      maxConcurrent: cfg.rate_limit.max_concurrent ?? 3,
    });

    console.log(
      "✅ Rate limiter initialized from config:",
      rateLimiter.getStats().limits,
    );

    // Listen for config changes
    config.onConfigChange((newConfig) => {
      if (newConfig.rate_limit) {
        console.log("📊 Updating rate limiter from config change");
        rateLimiter.updateLimits({
          maxRequestsPerMinute:
            newConfig.rate_limit.max_requests_per_minute ?? 35,
          maxTokensPerMinute:
            newConfig.rate_limit.max_tokens_per_minute ?? 28000,
          maxConcurrent: newConfig.rate_limit.max_concurrent ?? 3,
        });
      }
    });

    configInitialized = true;
  } catch (err) {
    console.error("❌ CRITICAL: Failed to load rate limiter config:", err);
    console.error("   Using defaults: 35 RPM / 28K TPM / 3 concurrent");
    console.error("   This may not match your API tier - verify limits!");
    throw err; // Fail loudly
  }
}

// ============ TOKEN ESTIMATION ============

/**
 * Estimate tokens for a prompt (rough approximation)
 *
 * FIXES:
 * - P0 #1: Provides token estimation for pre-spawn checks
 *
 * NOTE: This is a conservative estimate. Real tokenization varies.
 * Claude typically uses ~1.3 tokens per word for English text.
 */
export function estimateTokens(
  prompt: string,
  systemPrompt?: string,
  maxOutputTokens: number = 16000,
): number {
  const TOKENS_PER_CHAR = 0.25; // Conservative: ~4 chars per token

  let estimatedInput = 0;

  // Estimate input tokens
  if (prompt) {
    estimatedInput += prompt.length * TOKENS_PER_CHAR;
  }

  if (systemPrompt) {
    estimatedInput += systemPrompt.length * TOKENS_PER_CHAR;
  }

  // Add safety margin (20%) for tokenization overhead
  const inputWithMargin = Math.ceil(estimatedInput * 1.2);

  // Assume worst case: agent uses full output budget
  const estimatedOutput = maxOutputTokens;

  const total = inputWithMargin + estimatedOutput;

  console.log(
    `📏 Token estimate: ${total.toLocaleString()} (input: ${inputWithMargin}, output: ${estimatedOutput})`,
  );

  return total;
}

export default rateLimiter;
