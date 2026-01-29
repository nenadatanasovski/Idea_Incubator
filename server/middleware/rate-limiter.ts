/**
 * Rate Limiter Middleware (SEC-004)
 * Simple in-memory rate limiting for API protection
 */
import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Error message when rate limited
  keyGenerator?: (req: Request) => string; // Custom key generator
  name?: string; // Unique name for this rate limiter (used to isolate counters)
}

// Default configuration
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: "Too many requests, please try again later.",
};

// Store for rate limit entries (keyed by identifier)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval (every minute)
const CLEANUP_INTERVAL = 60 * 1000;

// Start cleanup timer
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);

  // Don't prevent process from exiting
  cleanupTimer.unref();
}

function stopCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Check for forwarded IP (behind proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded.split(",")[0];
    return ip.trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Create rate limiter middleware with custom configuration
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const options: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };

  // Start cleanup if not already running
  startCleanup();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ipKey = options.keyGenerator
      ? options.keyGenerator(req)
      : defaultKeyGenerator(req);
    // Include limiter name in key to isolate counters between different rate limiters
    const key = options.name ? `${options.name}:${ipKey}` : ipKey;

    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry or reset expired one
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", options.maxRequests);
      res.setHeader("X-RateLimit-Remaining", options.maxRequests - 1);
      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil((now + options.windowMs) / 1000),
      );

      next();
      return;
    }

    // Increment count
    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, options.maxRequests - entry.count);
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > options.maxRequests) {
      // Rate limited
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);

      res.status(429).json({
        error: options.message,
        retryAfter,
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for different use cases
 */

// General API rate limiter (100 req/min)
export const apiRateLimiter = createRateLimiter({
  name: "api",
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: "Too many API requests. Please wait a moment.",
});

// Strict rate limiter for expensive operations (10 req/min)
export const strictRateLimiter = createRateLimiter({
  name: "strict",
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Rate limit exceeded for this operation. Please wait.",
});

// Auth rate limiter for login/auth endpoints (5 req/min)
export const authRateLimiter = createRateLimiter({
  name: "auth",
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: "Too many authentication attempts. Please wait.",
});

// Ideation session rate limiter (30 messages/min)
export const ideationRateLimiter = createRateLimiter({
  name: "ideation",
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many messages. Please slow down.",
});

// Web search rate limiter (15 searches/min)
export const searchRateLimiter = createRateLimiter({
  name: "search",
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: "Search rate limit reached. Please wait before searching again.",
});

// Export for testing
export { stopCleanup, rateLimitStore };
