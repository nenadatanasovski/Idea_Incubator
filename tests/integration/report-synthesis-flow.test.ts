/**
 * Integration tests for Report Synthesis Flow
 *
 * Tests the report synthesis tracker and job lifecycle.
 * Note: Database-dependent tests are in unit tests with mocked database.
 */
import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { reportSynthesisTracker } from "../../server/services/graph/report-synthesis-tracker.js";
import { computeGroupHash } from "../../server/services/graph/report-generator.js";

describe("Report Synthesis Flow Integration", () => {
  describe("Group Hash Computation", () => {
    it("should compute consistent hashes", () => {
      const nodeIds = [randomUUID(), randomUUID(), randomUUID()];

      const hash1 = computeGroupHash(nodeIds);
      const hash2 = computeGroupHash(nodeIds);

      expect(hash1).toBe(hash2);
    });

    it("should compute same hash regardless of order", () => {
      const nodeIds = [randomUUID(), randomUUID(), randomUUID()];

      const hash1 = computeGroupHash(nodeIds);
      const hash2 = computeGroupHash([...nodeIds].reverse());

      expect(hash1).toBe(hash2);
    });

    it("should compute different hashes for different node sets", () => {
      const set1 = [randomUUID(), randomUUID()];
      const set2 = [randomUUID(), randomUUID()];

      const hash1 = computeGroupHash(set1);
      const hash2 = computeGroupHash(set2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Report Synthesis Tracker", () => {
    it("should track job through full lifecycle", () => {
      const sessionId = `test-${randomUUID().slice(0, 8)}`;

      // Create job
      const { job, abortController } =
        reportSynthesisTracker.createJob(sessionId);
      expect(job.status).toBe("pending");
      expect(reportSynthesisTracker.hasActiveJob(sessionId)).toBe(true);
      expect(abortController.signal.aborted).toBe(false);

      // Update to detecting groups
      reportSynthesisTracker.updateDetectingGroups(sessionId);
      expect(reportSynthesisTracker.getJobStatus(sessionId)?.status).toBe(
        "detecting_groups",
      );

      // Update generating progress
      reportSynthesisTracker.updateGenerating(
        sessionId,
        5,
        2,
        "Market Analysis",
      );
      const progressJob = reportSynthesisTracker.getJobStatus(sessionId);
      expect(progressJob?.status).toBe("generating");
      expect(progressJob?.totalGroups).toBe(5);
      expect(progressJob?.completedGroups).toBe(2);
      expect(progressJob?.currentGroupName).toBe("Market Analysis");

      // Complete job
      reportSynthesisTracker.completeJob(sessionId, 5);
      expect(reportSynthesisTracker.hasActiveJob(sessionId)).toBe(false);

      const completedJob = reportSynthesisTracker.getJobStatus(sessionId);
      expect(completedJob?.status).toBe("complete");
      expect(completedJob?.reportsCreated).toBe(5);
      expect(completedJob?.completedAt).toBeDefined();
    });

    it("should support job cancellation", () => {
      const sessionId = `cancel-${randomUUID().slice(0, 8)}`;

      const { abortController } = reportSynthesisTracker.createJob(sessionId);
      expect(abortController.signal.aborted).toBe(false);

      // Cancel the job
      const cancelled = reportSynthesisTracker.cancelJob(
        sessionId,
        "User requested cancellation",
      );
      expect(cancelled).toBe(true);
      expect(abortController.signal.aborted).toBe(true);

      // Verify status is cancelled
      const job = reportSynthesisTracker.getJobStatus(sessionId);
      expect(job?.status).toBe("cancelled");
      expect(job?.error).toBe("User requested cancellation");
    });

    it("should handle job failure", () => {
      const sessionId = `fail-${randomUUID().slice(0, 8)}`;

      reportSynthesisTracker.createJob(sessionId);
      reportSynthesisTracker.failJob(sessionId, "AI service unavailable");

      expect(reportSynthesisTracker.hasActiveJob(sessionId)).toBe(false);

      const job = reportSynthesisTracker.getJobStatus(sessionId);
      expect(job?.status).toBe("failed");
      expect(job?.error).toBe("AI service unavailable");
    });

    it("should replace existing job for same session", () => {
      const sessionId = `replace-${randomUUID().slice(0, 8)}`;

      const { job: job1 } = reportSynthesisTracker.createJob(sessionId);
      const { job: job2 } = reportSynthesisTracker.createJob(sessionId);

      expect(job2.id).not.toBe(job1.id);
      expect(reportSynthesisTracker.getJobStatus(sessionId)?.id).toBe(job2.id);
    });

    it("should return null for unknown session", () => {
      const job = reportSynthesisTracker.getJobStatus("unknown-session");
      expect(job).toBeNull();
    });

    it("should return false when cancelling non-existent job", () => {
      const result = reportSynthesisTracker.cancelJob("non-existent", "Cancel");
      expect(result).toBe(false);
    });

    it("should detect abort signal during processing", () => {
      const sessionId = `abort-${randomUUID().slice(0, 8)}`;

      const { abortController } = reportSynthesisTracker.createJob(sessionId);

      // Before abort
      expect(reportSynthesisTracker.isCancelled(sessionId)).toBe(false);

      // Manually abort (simulating cancellation request)
      abortController.abort();

      // After abort - isCancelled should return true while job is still active
      expect(reportSynthesisTracker.isCancelled(sessionId)).toBe(true);
    });
  });
});
