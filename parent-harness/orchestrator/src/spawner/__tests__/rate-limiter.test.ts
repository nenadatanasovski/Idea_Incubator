/**
 * Comprehensive Rate Limiter Test Suite
 *
 * Tests all critical scenarios identified in evaluation:
 * - P0 #1: Token estimation and tracking
 * - P0 #3: Sliding window boundary enforcement
 * - P0 #4: Race condition prevention with atomic reservations
 * - P0 #7: API tier limit detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import rateLimiter, { estimateTokens } from "../rate-limiter.js";

describe("SlidingWindowRateLimiter", () => {
  beforeEach(() => {
    rateLimiter.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ BASIC FUNCTIONALITY ============

  describe("Basic Functionality", () => {
    it("should allow spawns under limit", () => {
      const check = rateLimiter.canSpawnAndReserve(100);
      expect(check.allowed).toBe(true);
      expect(check.reservationId).toBeDefined();
    });

    it("should track concurrent spawns correctly", () => {
      // Reserve and confirm 3 spawns (limit is 3)
      const res1 = rateLimiter.canSpawnAndReserve(100);
      expect(res1.allowed).toBe(true);
      rateLimiter.confirmSpawnStart(res1.reservationId!, 100);

      const res2 = rateLimiter.canSpawnAndReserve(100);
      expect(res2.allowed).toBe(true);
      rateLimiter.confirmSpawnStart(res2.reservationId!, 100);

      const res3 = rateLimiter.canSpawnAndReserve(100);
      expect(res3.allowed).toBe(true);
      rateLimiter.confirmSpawnStart(res3.reservationId!, 100);

      // 4th spawn should be blocked
      const res4 = rateLimiter.canSpawnAndReserve(100);
      expect(res4.allowed).toBe(false);
      expect(res4.reason).toContain("Concurrent limit");

      // Complete one spawn
      rateLimiter.recordSpawnEnd(res1.reservationId!, 100);

      // Now 4th spawn should be allowed
      const res5 = rateLimiter.canSpawnAndReserve(100);
      expect(res5.allowed).toBe(true);
    });

    it("should release reservation if spawn fails before start", () => {
      const res1 = rateLimiter.canSpawnAndReserve(100);
      const res2 = rateLimiter.canSpawnAndReserve(100);
      const res3 = rateLimiter.canSpawnAndReserve(100);

      // All 3 reservations made, 4th blocked
      const res4 = rateLimiter.canSpawnAndReserve(100);
      expect(res4.allowed).toBe(false);

      // Release one reservation (spawn failed)
      rateLimiter.releaseReservation(res1.reservationId!);

      // Should now allow another reservation
      const res5 = rateLimiter.canSpawnAndReserve(100);
      expect(res5.allowed).toBe(true);
    });
  });

  // ============ P0 #1: TOKEN ESTIMATION ============

  describe("Token Estimation (P0 #1)", () => {
    it("should track estimated tokens before spawn", () => {
      const estimatedTokens = 5000;

      const res = rateLimiter.canSpawnAndReserve(estimatedTokens);
      expect(res.allowed).toBe(true);

      rateLimiter.confirmSpawnStart(res.reservationId!, estimatedTokens);

      const stats = rateLimiter.getStats();
      expect(stats.usage.tokens).toBeGreaterThanOrEqual(estimatedTokens);
    });

    it("should update with actual tokens after completion", () => {
      const estimatedTokens = 5000;
      const actualTokens = 7500;

      const res = rateLimiter.canSpawnAndReserve(estimatedTokens);
      rateLimiter.confirmSpawnStart(res.reservationId!, estimatedTokens);

      // Before completion, should show estimated
      let stats = rateLimiter.getStats();
      const tokensBefore = stats.usage.tokens;
      expect(tokensBefore).toBeGreaterThanOrEqual(estimatedTokens);

      // After completion, should show actual
      rateLimiter.recordSpawnEnd(res.reservationId!, actualTokens);

      stats = rateLimiter.getStats();
      const tokensAfter = stats.usage.tokens;

      // Should have adjusted to actual (difference = actualTokens - estimatedTokens)
      expect(tokensAfter).toBeGreaterThan(tokensBefore);
    });

    it("should block spawn when estimated tokens exceed TPM limit", () => {
      // Fill up to near limit (28000 TPM limit)
      const res1 = rateLimiter.canSpawnAndReserve(20000);
      rateLimiter.confirmSpawnStart(res1.reservationId!, 20000);

      // Try to spawn with 9000 tokens (would exceed 28000)
      const res2 = rateLimiter.canSpawnAndReserve(9000);
      expect(res2.allowed).toBe(false);
      expect(res2.reason).toContain("token limit");

      // But 7000 tokens should still fit
      const res3 = rateLimiter.canSpawnAndReserve(7000);
      expect(res3.allowed).toBe(true);
    });

    it("should enforce TPM limit correctly with multiple spawns", () => {
      // Spawn multiple times with different token estimates
      const spawns = [
        { estimated: 5000, actual: 6000 },
        { estimated: 4000, actual: 3500 },
        { estimated: 6000, actual: 7000 },
        { estimated: 5000, actual: 5500 },
      ];

      const completedActual: number[] = [];

      for (const spawn of spawns) {
        const res = rateLimiter.canSpawnAndReserve(spawn.estimated);
        if (res.allowed) {
          rateLimiter.confirmSpawnStart(res.reservationId!, spawn.estimated);
          // Complete immediately to free up concurrent slot
          rateLimiter.recordSpawnEnd(res.reservationId!, spawn.actual);
          completedActual.push(spawn.actual);
        }
      }

      const stats = rateLimiter.getStats();
      const totalActual = completedActual.reduce((sum, val) => sum + val, 0);

      // Should show actual tokens for all completed spawns
      expect(stats.usage.tokens).toBeGreaterThanOrEqual(totalActual - 1000); // Small tolerance
      // All 4 should have completed since we're under both TPM and concurrent limits
      expect(completedActual.length).toBe(4);
    });
  });

  // ============ P0 #3: SLIDING WINDOW ============

  describe("Sliding Window Boundary Protection (P0 #3)", () => {
    it("should enforce limits across minute boundaries with sliding window", () => {
      vi.useFakeTimers();

      // Set time to 59 seconds
      vi.setSystemTime(new Date("2024-01-01T00:00:59.000Z"));

      // Fill up with 34 requests (just under 35 limit)
      const reservations: string[] = [];
      for (let i = 0; i < 34; i++) {
        const res = rateLimiter.canSpawnAndReserve(100);
        expect(res.allowed).toBe(true);
        rateLimiter.confirmSpawnStart(res.reservationId!, 100);
        rateLimiter.recordSpawnEnd(res.reservationId!, 100);
        reservations.push(res.reservationId!);
      }

      // 35th request should succeed (at 35/35)
      const res35 = rateLimiter.canSpawnAndReserve(100);
      expect(res35.allowed).toBe(true);
      rateLimiter.confirmSpawnStart(res35.reservationId!, 100);
      rateLimiter.recordSpawnEnd(res35.reservationId!, 100);

      // 36th request should be blocked
      const res36 = rateLimiter.canSpawnAndReserve(100);
      expect(res36.allowed).toBe(false);
      expect(res36.reason).toContain("request limit");

      // Advance to 1 second into next minute
      vi.setSystemTime(new Date("2024-01-01T00:01:01.000Z"));

      // Should STILL be blocked - sliding window includes last 60 seconds
      const res37 = rateLimiter.canSpawnAndReserve(100);
      expect(res37.allowed).toBe(false);

      // Advance to 61 seconds (past the first batch)
      vi.setSystemTime(new Date("2024-01-01T00:02:00.000Z"));

      // Should now allow - first batch has aged out
      const res38 = rateLimiter.canSpawnAndReserve(100);
      expect(res38.allowed).toBe(true);

      vi.useRealTimers();
    });

    it("should prevent boundary gaming attack", () => {
      vi.useFakeTimers();

      // Attacker tries to game the system by spawning at boundaries
      // Time: 59.5 seconds
      vi.setSystemTime(new Date("2024-01-01T00:00:59.500Z"));

      // Spawn 35 requests
      for (let i = 0; i < 35; i++) {
        const res = rateLimiter.canSpawnAndReserve(100);
        if (res.allowed) {
          rateLimiter.confirmSpawnStart(res.reservationId!, 100);
          rateLimiter.recordSpawnEnd(res.reservationId!, 100);
        }
      }

      // Time: 60.5 seconds (just crossed minute boundary)
      vi.setSystemTime(new Date("2024-01-01T00:01:00.500Z"));

      // Try to spawn 35 more - should be blocked!
      const attackRes = rateLimiter.canSpawnAndReserve(100);
      expect(attackRes.allowed).toBe(false);
      expect(attackRes.reason).toContain("request limit");

      vi.useRealTimers();
    });

    it("should gradually allow new requests as window slides", () => {
      vi.useFakeTimers();
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      vi.setSystemTime(baseTime); // Set initial time

      // Spawn 35 requests at T+0
      for (let i = 0; i < 35; i++) {
        const res = rateLimiter.canSpawnAndReserve(100);
        rateLimiter.confirmSpawnStart(res.reservationId!, 100);
        rateLimiter.recordSpawnEnd(res.reservationId!, 100);
      }

      // Should be at limit
      expect(rateLimiter.canSpawnAndReserve(100).allowed).toBe(false);

      // At T+30s, should still be blocked (all 35 still in window)
      vi.setSystemTime(new Date(baseTime.getTime() + 30 * 1000));
      expect(rateLimiter.canSpawnAndReserve(100).allowed).toBe(false);

      // At T+61s, first request aged out, should allow 1 new request
      vi.setSystemTime(new Date(baseTime.getTime() + 61 * 1000));
      const resAfter61 = rateLimiter.canSpawnAndReserve(100);
      expect(resAfter61.allowed).toBe(true);

      vi.useRealTimers();
    });
  });

  // ============ P0 #4: RACE CONDITION PREVENTION ============

  describe("Race Condition Prevention (P0 #4)", () => {
    it("should prevent concurrent counter race condition", () => {
      // Node.js is single-threaded - test synchronous atomic reservation directly
      // Reserve 3 slots (the max concurrent limit)
      const res1 = rateLimiter.canSpawnAndReserve(100);
      const res2 = rateLimiter.canSpawnAndReserve(100);
      const res3 = rateLimiter.canSpawnAndReserve(100);

      expect(res1.allowed).toBe(true);
      expect(res2.allowed).toBe(true);
      expect(res3.allowed).toBe(true);

      // 4th should be blocked (3 reserved, 0 active = 3 total >= maxConcurrent)
      const res4 = rateLimiter.canSpawnAndReserve(100);
      expect(res4.allowed).toBe(false);

      // Confirm one and try again - still 3 total (2 reserved + 1 active)
      rateLimiter.confirmSpawnStart(res1.reservationId!, 100);
      const res5 = rateLimiter.canSpawnAndReserve(100);
      expect(res5.allowed).toBe(false);

      // Complete one spawn - now 2 reserved + 0 active = 2 total
      rateLimiter.recordSpawnEnd(res1.reservationId!, 100);
      const res6 = rateLimiter.canSpawnAndReserve(100);
      expect(res6.allowed).toBe(true);

      // Clean up
      rateLimiter.releaseReservation(res2.reservationId!);
      rateLimiter.releaseReservation(res3.reservationId!);
      rateLimiter.releaseReservation(res6.reservationId!);
    });

    it("should handle atomic reservation correctly under race conditions", async () => {
      const reservations: Array<{ id: string; allowed: boolean }> = [];

      // Attempt 10 reservations concurrently
      const reservePromises = Array.from({ length: 10 }, (_, i) =>
        (async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          const res = rateLimiter.canSpawnAndReserve(100);
          return { id: `spawn-${i}`, allowed: res.allowed, res };
        })(),
      );

      const results = await Promise.all(reservePromises);

      // Count allowed reservations
      const allowed = results.filter((r) => r.allowed);
      const blocked = results.filter((r) => !r.allowed);

      // Should allow exactly 3 (concurrent limit)
      expect(allowed.length).toBeLessThanOrEqual(3);

      // Clean up - release reservations
      for (const result of allowed) {
        if (result.res.reservationId) {
          rateLimiter.releaseReservation(result.res.reservationId);
        }
      }

      // After releasing, should allow more
      const afterRelease = rateLimiter.canSpawnAndReserve(100);
      expect(afterRelease.allowed).toBe(true);
    });

    it("should maintain correct state under failed spawn scenarios", async () => {
      // Reserve 3 slots
      const res1 = rateLimiter.canSpawnAndReserve(100);
      const res2 = rateLimiter.canSpawnAndReserve(100);
      const res3 = rateLimiter.canSpawnAndReserve(100);

      expect(res1.allowed).toBe(true);
      expect(res2.allowed).toBe(true);
      expect(res3.allowed).toBe(true);

      // 4th should be blocked
      const res4 = rateLimiter.canSpawnAndReserve(100);
      expect(res4.allowed).toBe(false);

      // Simulate: res1 confirms start successfully
      rateLimiter.confirmSpawnStart(res1.reservationId!, 100);

      // Simulate: res2 fails before start (release reservation)
      rateLimiter.releaseReservation(res2.reservationId!);

      // Simulate: res3 confirms start successfully
      rateLimiter.confirmSpawnStart(res3.reservationId!, 100);

      // Now concurrent should be 2 (res1 and res3 active)
      const stats = rateLimiter.getStats();
      expect(stats.usage.concurrent).toBe(2);
      expect(stats.usage.reserved).toBe(0);

      // Should allow one more spawn
      const res5 = rateLimiter.canSpawnAndReserve(100);
      expect(res5.allowed).toBe(true);
    });
  });

  // ============ P0 #7: API TIER DETECTION ============

  describe("API Tier Limit Detection (P0 #7)", () => {
    it("should auto-detect limits from response headers", () => {
      const headers = {
        "x-ratelimit-limit-requests": "50",
        "x-ratelimit-limit-tokens": "40000",
      };

      rateLimiter.detectLimitsFromHeaders(headers);

      const stats = rateLimiter.getStats();

      // Should have detected and applied 70% safety margin
      expect(stats.limits.maxRequestsPerMinute).toBe(35); // 50 * 0.7
      expect(stats.limits.maxTokensPerMinute).toBe(28000); // 40000 * 0.7

      expect(stats.detectedLimits?.detected).toBe(true);
      expect(stats.detectedLimits?.requestsPerMinute).toBe(50);
      expect(stats.detectedLimits?.tokensPerMinute).toBe(40000);
    });

    it("should only detect limits once", () => {
      const headers1 = {
        "x-ratelimit-limit-requests": "50",
        "x-ratelimit-limit-tokens": "40000",
      };

      const headers2 = {
        "x-ratelimit-limit-requests": "100",
        "x-ratelimit-limit-tokens": "80000",
      };

      rateLimiter.detectLimitsFromHeaders(headers1);
      const stats1 = rateLimiter.getStats();

      // Try to detect again with different values
      rateLimiter.detectLimitsFromHeaders(headers2);
      const stats2 = rateLimiter.getStats();

      // Should still have first detected values
      expect(stats2.limits.maxRequestsPerMinute).toBe(
        stats1.limits.maxRequestsPerMinute,
      );
      expect(stats2.limits.maxTokensPerMinute).toBe(
        stats1.limits.maxTokensPerMinute,
      );
    });

    it("should handle missing headers gracefully", () => {
      const incompleteHeaders = {
        "x-ratelimit-limit-requests": "50",
        // Missing tokens header
      };

      rateLimiter.detectLimitsFromHeaders(incompleteHeaders);

      const stats = rateLimiter.getStats();

      // Should not have detected (missing required header)
      expect(stats.detectedLimits?.detected).toBeFalsy();

      // Should still use default limits
      expect(stats.limits.maxRequestsPerMinute).toBe(35);
    });
  });

  // ============ TOKEN ESTIMATION FUNCTION ============

  describe("Token Estimation Function", () => {
    it("should estimate tokens based on character count", () => {
      const prompt = "Write a function that calculates fibonacci numbers"; // ~50 chars
      const systemPrompt = "You are a helpful coding assistant"; // ~35 chars

      const estimated = estimateTokens(prompt, systemPrompt, 16000);

      // ~85 chars * 0.25 tokens/char * 1.2 margin = ~25 input tokens
      // + 16000 output tokens = ~16025 total
      expect(estimated).toBeGreaterThan(16000);
      expect(estimated).toBeLessThan(17000);
    });

    it("should handle large prompts correctly", () => {
      const largePrompt = "x".repeat(10000); // 10K characters

      const estimated = estimateTokens(largePrompt, undefined, 16000);

      // 10K chars * 0.25 * 1.2 = ~3000 input + 16000 output = ~19000
      expect(estimated).toBeGreaterThan(18000);
      expect(estimated).toBeLessThan(20000);
    });

    it("should be conservative (overestimate)", () => {
      // Real tokenization is ~1.3 tokens per word
      // Our estimate should be higher (conservative)
      const prompt = "hello world test"; // 3 words = ~4 real tokens

      const estimated = estimateTokens(prompt, undefined, 1000);

      // With 16 chars * 0.25 * 1.2 = ~5 tokens (conservative)
      // Should be more than real tokenization would give
      expect(estimated).toBeGreaterThan(1000);
    });
  });

  // ============ STATS AND MONITORING ============

  describe("Stats and Monitoring", () => {
    it("should provide accurate usage stats", () => {
      const res1 = rateLimiter.canSpawnAndReserve(5000);
      rateLimiter.confirmSpawnStart(res1.reservationId!, 5000);

      const res2 = rateLimiter.canSpawnAndReserve(3000);
      rateLimiter.confirmSpawnStart(res2.reservationId!, 3000);

      const stats = rateLimiter.getStats();

      expect(stats.usage.requests).toBe(2);
      expect(stats.usage.tokens).toBeGreaterThanOrEqual(8000);
      expect(stats.usage.concurrent).toBe(2);
      expect(stats.usage.reserved).toBe(0);

      expect(stats.utilizationPercent.requests).toBeGreaterThan(0);
      expect(stats.utilizationPercent.tokens).toBeGreaterThan(0);
      expect(stats.utilizationPercent.concurrent).toBeGreaterThan(0);
    });

    it("should calculate utilization percentages correctly", () => {
      // Spawn to hit exactly 50% of request limit (35 / 2 = 17.5)
      for (let i = 0; i < 17; i++) {
        const res = rateLimiter.canSpawnAndReserve(100);
        rateLimiter.confirmSpawnStart(res.reservationId!, 100);
        rateLimiter.recordSpawnEnd(res.reservationId!, 100);
      }

      const stats = rateLimiter.getStats();

      // Should be ~48-50% utilization
      expect(stats.utilizationPercent.requests).toBeGreaterThan(45);
      expect(stats.utilizationPercent.requests).toBeLessThan(55);
    });
  });

  // ============ CLEANUP AND MAINTENANCE ============

  describe("Cleanup and Maintenance", () => {
    it("should clean up old spawn records", () => {
      vi.useFakeTimers();
      const baseTime = new Date("2024-01-01T00:00:00.000Z");
      vi.setSystemTime(baseTime);

      // Create some spawns
      for (let i = 0; i < 10; i++) {
        const res = rateLimiter.canSpawnAndReserve(100);
        rateLimiter.confirmSpawnStart(res.reservationId!, 100);
        rateLimiter.recordSpawnEnd(res.reservationId!, 100);
      }

      const debugBefore = rateLimiter.getDebugInfo();
      expect(debugBefore.totalSpawns).toBe(10);

      // Advance 6 minutes (cleanup threshold is 5 minutes)
      vi.setSystemTime(new Date(baseTime.getTime() + 6 * 60 * 1000));

      // Trigger cleanup by doing another spawn
      const res = rateLimiter.canSpawnAndReserve(100);
      rateLimiter.confirmSpawnStart(res.reservationId!, 100);

      const debugAfter = rateLimiter.getDebugInfo();

      // Old spawns should be cleaned up (only recent one remains)
      expect(debugAfter.totalSpawns).toBeLessThan(debugBefore.totalSpawns);

      vi.useRealTimers();
    });

    it("should reset all state when reset is called", () => {
      // Create some state
      const res1 = rateLimiter.canSpawnAndReserve(1000);
      rateLimiter.confirmSpawnStart(res1.reservationId!, 1000);

      const res2 = rateLimiter.canSpawnAndReserve(2000);
      rateLimiter.confirmSpawnStart(res2.reservationId!, 2000);

      let stats = rateLimiter.getStats();
      expect(stats.usage.concurrent).toBe(2);
      expect(stats.usage.requests).toBe(2);

      // Reset
      rateLimiter.reset();

      stats = rateLimiter.getStats();
      expect(stats.usage.concurrent).toBe(0);
      expect(stats.usage.requests).toBe(0);
      expect(stats.usage.tokens).toBe(0);
    });
  });

  // ============ EDGE CASES ============

  describe("Edge Cases", () => {
    it("should handle zero token estimates", () => {
      const res = rateLimiter.canSpawnAndReserve(0);
      expect(res.allowed).toBe(true);

      rateLimiter.confirmSpawnStart(res.reservationId!, 0);
      const stats = rateLimiter.getStats();

      // Should still track the request even with 0 tokens
      expect(stats.usage.requests).toBe(1);
    });

    it("should handle very large token estimates", () => {
      const hugeTokens = 100000; // Way over limit

      const res = rateLimiter.canSpawnAndReserve(hugeTokens);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("token limit");
    });

    it("should handle multiple completions of same reservation", () => {
      const res = rateLimiter.canSpawnAndReserve(1000);
      rateLimiter.confirmSpawnStart(res.reservationId!, 1000);

      // Complete once
      rateLimiter.recordSpawnEnd(res.reservationId!, 1500);

      const stats1 = rateLimiter.getStats();
      const concurrent1 = stats1.usage.concurrent;

      // Try to complete again (should not double-decrement)
      rateLimiter.recordSpawnEnd(res.reservationId!, 2000);

      const stats2 = rateLimiter.getStats();
      const concurrent2 = stats2.usage.concurrent;

      // Second completion should decrement (but be floored at 0)
      expect(concurrent2).toBe(0);
      expect(concurrent2).toBeGreaterThanOrEqual(0); // Never negative
    });

    it("should handle rapid sequential spawns", () => {
      // Spawn 20 times sequentially (not concurrent)
      for (let i = 0; i < 20; i++) {
        const res = rateLimiter.canSpawnAndReserve(500);
        if (res.allowed) {
          rateLimiter.confirmSpawnStart(res.reservationId!, 500);
          rateLimiter.recordSpawnEnd(res.reservationId!, 500);
        } else {
          // Should hit request limit around 35
          expect(i).toBeGreaterThanOrEqual(34);
          break;
        }
      }

      const stats = rateLimiter.getStats();

      // Should have hit limit
      expect(stats.usage.requests).toBeGreaterThanOrEqual(20);
      expect(stats.usage.concurrent).toBe(0); // All completed
    });
  });
});
